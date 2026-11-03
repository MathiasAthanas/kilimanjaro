import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamWindowStatus, ExemptionScope, ExemptionStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { assertSchoolInScope, requireWriteSchoolId, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { CalcExemption, ResultCalculatorService } from './result-calculator.service';
import { CreateExemptionDto, ExemptionFilterDto, RevokeExemptionDto } from './dto/exemption.dto';

const APPROVER_ROLES: string[] = [
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
];

@Injectable()
export class ExemptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly calculator: ResultCalculatorService,
    private readonly studentClient: StudentClientService,
  ) {}

  private studentServiceHeaders(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private unwrapRows(payload: any): any[] {
    if (Array.isArray(payload)) return payload;
    const root = payload?.data ?? payload ?? {};
    if (Array.isArray(root)) return root;
    for (const value of [root.items, root.students, root.data]) {
      if (Array.isArray(value)) return value;
    }
    return [];
  }

  private assertApprover(user: RequestUser) {
    if (!APPROVER_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only the principal, administrators or academic QA can approve result exemptions.');
    }
  }

  /** Active school when set; otherwise the school that owns the exam window / class (so group admins need not switch first). */
  private async resolveSchoolId(dto: CreateExemptionDto, user: RequestUser): Promise<string> {
    try {
      return requireWriteSchoolId(user, 'result exemption');
    } catch (err) {
      const owner = dto.examWindowId
        ? await this.prisma.examWindow.findUnique({ where: { id: dto.examWindowId }, select: { schoolId: true } })
        : (await this.prisma.classSubject.findFirst({
            where: { classId: dto.classId, academicYearId: dto.academicYearId, isActive: true },
            select: { schoolId: true },
          })) ??
          (await this.prisma.assessment.findFirst({ where: { classId: dto.classId, termId: dto.termId }, select: { schoolId: true } }));
      if (!owner?.schoolId) throw err;
      assertSchoolInScope(user, owner.schoolId);
      return owner.schoolId;
    }
  }

  /** Windows (of the affected term) whose published results an exemption change would alter. */
  private async assertNotPublished(args: { termId: string; academicYearId: string; examWindowId?: string | null; classId: string }) {
    if (args.examWindowId) {
      const w = await this.prisma.examWindow.findUnique({ where: { id: args.examWindowId }, select: { status: true, name: true } });
      if (w?.status === ExamWindowStatus.PUBLISHED) {
        throw new ConflictException(`"${w.name}" is published. Unpublish it (or get an edit request approved) before changing exemptions.`);
      }
    } else {
      const published = await this.prisma.examWindow.findFirst({
        where: {
          termId: args.termId,
          academicYearId: args.academicYearId,
          status: ExamWindowStatus.PUBLISHED,
          results: { some: { classId: args.classId } },
        },
        select: { name: true },
      });
      if (published) {
        throw new ConflictException(`"${published.name}" is published for this class. Unpublish it before changing a term-wide exemption.`);
      }
    }
    const card = await this.prisma.reportCard.findFirst({
      where: { classId: args.classId, termId: args.termId, isPublished: true },
      select: { id: true },
    });
    if (card) {
      throw new ConflictException('Report cards for this class and term are published. Unpublish them before changing exemptions.');
    }
  }

  private async validateTarget(dto: CreateExemptionDto, user: RequestUser, schoolId: string) {
    if (dto.scope === 'STUDENT' && !(dto.studentIds?.length)) {
      throw new BadRequestException('Select at least one student for a student exemption.');
    }
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
    if (!subject) throw new BadRequestException('Subject not found.');
    let window: { id: string; schoolId: string | null; termId: string; academicYearId: string } | null = null;
    if (dto.examWindowId) {
      window = await this.prisma.examWindow.findUnique({
        where: { id: dto.examWindowId },
        select: { id: true, schoolId: true, termId: true, academicYearId: true },
      });
      const w = window;
      if (!w) throw new BadRequestException('Exam window not found.');
      assertSchoolInScope(user, w.schoolId ?? null);
      if (w.schoolId && w.schoolId !== schoolId) {
        throw new BadRequestException('The exam window does not belong to the selected school.');
      }
      if (w.termId !== dto.termId || w.academicYearId !== dto.academicYearId) {
        throw new BadRequestException('The exam window does not belong to the selected term.');
      }
    }

    const classSubject = await this.prisma.classSubject.findFirst({
      where: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        isActive: true,
        OR: [{ schoolId }, { schoolId: null }],
      },
      select: { id: true, schoolId: true },
    });
    if (!classSubject) {
      throw new BadRequestException('The selected subject is not assigned to this class for the academic year.');
    }
    if (classSubject.schoolId && classSubject.schoolId !== schoolId) {
      throw new BadRequestException('The selected class subject does not belong to the selected school.');
    }

    if (window) {
      const assessment = await this.prisma.assessment.findFirst({
        where: { examWindowId: window.id, classId: dto.classId, subjectId: dto.subjectId },
        select: { id: true },
      });
      if (!assessment) {
        throw new BadRequestException('The selected class subject is not included in this exam window.');
      }
    }

    if (dto.scope === 'STUDENT') {
      const rosterPayload = await this.studentClient.get<unknown>(
        '/students',
        { classId: dto.classId, page: 1, limit: 2000 },
        this.studentServiceHeaders(user),
      );
      const rosterIds = new Set(this.unwrapRows(rosterPayload).map((student) => String(student.id)));
      const invalid = [...new Set(dto.studentIds ?? [])].filter((studentId) => !rosterIds.has(studentId));
      if (invalid.length) {
        throw new BadRequestException(`${invalid.length} selected student(s) are not enrolled in this class.`);
      }
    }
    return subject;
  }

  /** What-if: which students are affected and how their averages/divisions change. */
  async preview(dto: CreateExemptionDto, user: RequestUser) {
    this.assertApprover(user);
    const schoolId = await this.resolveSchoolId(dto, user);
    const subject = await this.validateTarget(dto, user, schoolId);

    const windows = await this.prisma.examWindow.findMany({
      where: {
        termId: dto.termId,
        academicYearId: dto.academicYearId,
        ...(dto.examWindowId ? { id: dto.examWindowId } : {}),
        assessments: { some: { classId: dto.classId } },
      },
      select: { id: true, name: true, status: true },
    });
    const hypothetical: CalcExemption[] = (dto.scope === 'CLASS' ? [null] : dto.studentIds!).map((studentId, i) => ({
      id: `preview-${i}`,
      classId: dto.classId,
      subjectId: dto.subjectId,
      studentId,
      examWindowId: dto.examWindowId ?? null,
      reason: dto.reason ?? 'Preview',
    }));

    const perWindow: any[] = [];
    let affectedStudents = new Set<string>();
    for (const w of windows) {
      const before = await this.calculator.build(w.id, user);
      const after = await this.calculator.build(w.id, user, hypothetical);
      const beforeById = new Map(before.rows.map((r) => [r.studentId, r]));
      const students = after.rows
        .filter((r) => r.classId === dto.classId && r.outcomes.some((o) => o.subjectId === dto.subjectId))
        .filter((r) => dto.scope === 'CLASS' || dto.studentIds!.includes(r.studentId))
        .map((r) => {
          const b = beforeById.get(r.studentId)!;
          affectedStudents.add(r.studentId);
          const prior = b.outcomes.find((o) => o.subjectId === dto.subjectId);
          return {
            studentId: r.studentId,
            studentName: r.studentName,
            registrationNumber: r.registrationNumber,
            subjectStatusBefore: prior?.status ?? null,
            preservedScore: prior && prior.status !== 'MISSING' ? prior.score : null,
            averageBefore: b.summary.mean,
            averageAfter: r.summary.mean,
            subjectsAssessedBefore: b.summary.subjectsAssessed,
            subjectsAssessedAfter: r.summary.subjectsAssessed,
            divisionBefore: b.summary.division.division ?? b.summary.division.descriptor,
            divisionAfter: r.summary.division.division ?? r.summary.division.descriptor,
            becomesUngraded: b.summary.division.eligible && !r.summary.division.eligible,
          };
        });
      perWindow.push({ examWindowId: w.id, windowName: w.name, status: w.status, students });
    }

    return {
      subject: { id: subject.id, name: subject.name },
      scope: dto.scope,
      term: dto.examWindowId ? 'EXAM_WINDOW' : 'ENTIRE_TERM',
      studentsAffected: affectedStudents.size,
      ungradedAfter: perWindow.reduce((n, w) => n + w.students.filter((s: any) => s.becomesUngraded).length, 0),
      windows: perWindow,
      publishedWarning: windows.some((w) => w.status === ExamWindowStatus.PUBLISHED)
        ? 'One or more affected windows are published; unpublish before applying.'
        : null,
    };
  }

  async create(dto: CreateExemptionDto, user: RequestUser) {
    this.assertApprover(user);
    const schoolId = await this.resolveSchoolId(dto, user);
    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new BadRequestException('A reason (at least 5 characters) is required for an exemption.');
    }
    await this.validateTarget(dto, user, schoolId);
    await this.assertNotPublished({ termId: dto.termId, academicYearId: dto.academicYearId, examWindowId: dto.examWindowId, classId: dto.classId });

    const targets: Array<string | null> = dto.scope === 'CLASS' ? [null] : [...new Set(dto.studentIds!)];
    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const out: Prisma.ResultCalculationExemptionGetPayload<object>[] = [];
      for (const studentId of targets) {
        const existing = await tx.resultCalculationExemption.findFirst({
          where: {
            status: ExemptionStatus.APPROVED,
            termId: dto.termId,
            classId: dto.classId,
            subjectId: dto.subjectId,
            studentId,
            examWindowId: dto.examWindowId ?? null,
          },
        });
        if (existing) {
          out.push(existing);
          continue;
        }
        const row = await tx.resultCalculationExemption.create({
          data: {
            schoolId,
            academicYearId: dto.academicYearId,
            termId: dto.termId,
            examWindowId: dto.examWindowId ?? null,
            classId: dto.classId,
            subjectId: dto.subjectId,
            studentId,
            scope: studentId ? ExemptionScope.STUDENT : ExemptionScope.CLASS,
            reason: dto.reason!.trim(),
            status: ExemptionStatus.APPROVED,
            createdById: user.id,
            createdByRole: user.role,
            approvedById: user.id,
            approvedAt: now,
          },
        });
        out.push(row);
      }
      await tx.academicAuditLog.create({
        data: {
          schoolId,
          action: 'RESULT_EXEMPTION_CREATED',
          performedById: user.id,
          payload: { ...dto, exemptionIds: out.map((o) => o.id) } as unknown as Prisma.InputJsonValue,
        },
      });
      return out;
    });

    await this.invalidate(dto.examWindowId);
    await this.rabbitMq.publish('exam.exemption.created', { termId: dto.termId, classId: dto.classId, subjectId: dto.subjectId, count: created.length, schoolId });
    return { created: created.length, exemptions: created, recomputeRequired: true };
  }

  async revoke(id: string, dto: RevokeExemptionDto, user: RequestUser) {
    this.assertApprover(user);
    const row = await this.prisma.resultCalculationExemption.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Exemption not found');
    assertSchoolInScope(user, row.schoolId ?? null);
    if (row.status === ExemptionStatus.REVOKED) throw new BadRequestException('This exemption is already revoked.');
    await this.assertNotPublished({ termId: row.termId, academicYearId: row.academicYearId, examWindowId: row.examWindowId, classId: row.classId });

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.resultCalculationExemption.update({
        where: { id },
        data: { status: ExemptionStatus.REVOKED, revokedById: user.id, revokedAt: new Date(), revokeReason: dto.reason ?? null },
      });
      await tx.academicAuditLog.create({
        data: {
          schoolId: row.schoolId,
          action: 'RESULT_EXEMPTION_REVOKED',
          performedById: user.id,
          payload: { exemptionId: id, reason: dto.reason ?? null } as unknown as Prisma.InputJsonValue,
        },
      });
      return u;
    });
    await this.invalidate(row.examWindowId);
    return { ...updated, recomputeRequired: true };
  }

  async list(filters: ExemptionFilterDto, user: RequestUser) {
    return this.prisma.resultCalculationExemption.findMany({
      where: {
        ...schoolScopeFilter(user),
        termId: filters.termId,
        academicYearId: filters.academicYearId,
        classId: filters.classId,
        subjectId: filters.subjectId,
        studentId: filters.studentId,
        ...(filters.examWindowId ? { OR: [{ examWindowId: filters.examWindowId }, { examWindowId: null }] } : {}),
        status: (filters.status as ExemptionStatus | undefined) ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async invalidate(examWindowId?: string | null) {
    if (examWindowId) await this.redis.delByPattern(`exam-window:*:${examWindowId}`);
  }
}
