import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AssessmentStatus, ExamWindowStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import {
  assertSchoolInScope,
  resolveWriteSchoolId,
  schoolScopeFilter,
} from '../common/helpers/school-scope.helper';
import { CreateExamWindowDto, ExamWindowFilterDto, UpdateExamWindowDto } from './dto/exam-window.dto';
import { CreateEditRequestDto, DecideEditRequestDto } from './dto/edit-request.dto';
import { ExamResultsService } from './exam-results.service';

export interface ScopeClass {
  id: string;
  name: string;
  level: number | null;
  stream: string | null;
  educationStage: string | null;
  schoolId: string | null;
}

@Injectable()
export class ExamWindowsService {
  private readonly logger = new Logger(ExamWindowsService.name);

  private static readonly ADMIN_ROLES: string[] = [
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.MANAGER,
    ROLES.HEAD_OF_SCHOOL,
    ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly studentClient: StudentClientService,
    private readonly examResults: ExamResultsService,
  ) {}

  private unwrap<T>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const p = payload as Record<string, unknown> | null;
    if (!p) return [];
    const inner = (p.data ?? p) as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as T[];
    for (const c of [inner?.items, inner?.classes]) {
      if (Array.isArray(c)) return c as T[];
    }
    return [];
  }

  private studentServiceHeaders(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  /** Resolve the classes a window's scope selects, from student-service. */
  async resolveScopeClasses(
    window: { academicYearId: string; educationStage: string | null; scopeType: string; scopeLevels: number[]; scopeClassIds: string[] },
    user: RequestUser,
  ): Promise<ScopeClass[]> {
    const payload = await this.studentClient.get<unknown>(
      '/students/classes',
      { academicYearId: window.academicYearId, limit: 1000 },
      this.studentServiceHeaders(user),
    );
    let classes = this.unwrap<any>(payload).map((c) => ({
      id: c.id,
      name: c.name,
      level: c.level ?? null,
      stream: c.stream ?? null,
      educationStage: c.educationStage ?? null,
      schoolId: c.schoolId ?? null,
    })) as ScopeClass[];

    if (window.educationStage) {
      classes = classes.filter((c) => c.educationStage === window.educationStage);
    }

    if (window.scopeType === 'STANDARDS') {
      const levels = new Set(window.scopeLevels);
      classes = classes.filter((c) => c.level !== null && levels.has(c.level));
    } else if (window.scopeType === 'STREAMS') {
      const ids = new Set(window.scopeClassIds);
      classes = classes.filter((c) => ids.has(c.id));
    }

    return classes;
  }

  async create(dto: CreateExamWindowDto, user: RequestUser) {
    const schoolId = resolveWriteSchoolId(user);

    const examType = await this.prisma.examType.findUnique({ where: { id: dto.examTypeId } });
    if (!examType) {
      throw new BadRequestException('Selected exam type does not exist.');
    }
    assertSchoolInScope(user, examType.schoolId ?? null);

    const window = await this.prisma.examWindow.create({
      data: {
        schoolId,
        examTypeId: dto.examTypeId,
        name: dto.name,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        educationStage: dto.educationStage as any,
        scopeType: dto.scopeType as any,
        scopeLevels: dto.scopeType === 'STANDARDS' ? dto.scopeLevels ?? [] : [],
        scopeClassIds: dto.scopeType === 'STREAMS' ? dto.scopeClassIds ?? [] : [],
        maxScore: dto.maxScore ?? 100,
        weight: dto.weight ?? examType.defaultWeight,
        countsToReportCard: dto.countsToReportCard ?? true,
        instructions: dto.instructions,
        opensAt: dto.opensAt ? new Date(dto.opensAt) : null,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
        createdById: user.id,
        status: ExamWindowStatus.DRAFT,
      },
    });

    let fanOut: { assessmentsCreated: number; classesCovered: number; subjectsCovered: number } | null = null;
    if (dto.openNow) {
      fanOut = await this.open(window.id, user);
    }

    return { ...(await this.detail(window.id, user)), fanOut };
  }

  /** Fan out one Assessment per class-subject in scope, and set the window OPEN. */
  async open(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Only a DRAFT or REOPENED window can be (re)opened. Current status: ${window.status}.`);
    }

    const classes = await this.resolveScopeClasses(window, user);
    if (!classes.length) {
      throw new BadRequestException('The selected scope matched no classes. Check the classes exist for this academic year.');
    }
    const classIds = classes.map((c) => c.id);

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { academicYearId: window.academicYearId, isActive: true, classId: { in: classIds } },
      include: { subject: true },
    });
    if (!classSubjects.length) {
      throw new BadRequestException('No subjects are assigned to the classes in scope. Assign class-subjects first.');
    }

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const cs of classSubjects) {
        const existing = await tx.assessment.findUnique({
          where: { classSubjectId_examWindowId: { classSubjectId: cs.id, examWindowId: id } },
        });
        if (existing) {
          if (existing.status === AssessmentStatus.LOCKED) {
            // reopening: allow edits again
            await tx.assessment.update({ where: { id: existing.id }, data: { status: AssessmentStatus.OPEN } });
          }
          continue;
        }
        await tx.assessment.create({
          data: {
            classSubjectId: cs.id,
            examWindowId: id,
            classId: cs.classId,
            subjectId: cs.subjectId,
            educationStage: cs.educationStage,
            classLevel: cs.classLevel,
            combinationId: cs.combinationId,
            termId: window.termId,
            academicYearId: window.academicYearId,
            schoolId: cs.schoolId ?? window.schoolId,
            name: `${cs.subject.name} — ${window.name}`,
            maxScore: window.maxScore,
            status: AssessmentStatus.OPEN,
          },
        });
        created += 1;
      }

      await tx.examWindow.update({
        where: { id },
        data: { status: ExamWindowStatus.OPEN, openedAt: window.openedAt ?? new Date() },
      });
    });

    await this.rabbitMq.publish('exam.window.opened', {
      examWindowId: id,
      name: window.name,
      termId: window.termId,
      academicYearId: window.academicYearId,
      classIds,
      schoolId: window.schoolId,
    });

    return { assessmentsCreated: created, classesCovered: classIds.length, subjectsCovered: classSubjects.length };
  }

  /** Close entry, lock marks, and compute the merit list. */
  async close(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Only an OPEN window can be closed. Current status: ${window.status}.`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.mark.updateMany({
        where: { assessment: { examWindowId: id } },
        data: { isLocked: true },
      });
      await tx.assessment.updateMany({
        where: { examWindowId: id, status: { not: AssessmentStatus.LOCKED } },
        data: { status: AssessmentStatus.LOCKED, lockedAt: new Date() },
      });
      await tx.examWindow.update({
        where: { id },
        data: { status: ExamWindowStatus.CLOSED, closedAt: new Date() },
      });
    });

    const merit = await this.examResults.compute(id, user);
    return { closed: true, ...merit };
  }

  async publish(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.CLOSED, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Compute/close the window before publishing. Current status: ${window.status}.`);
    }

    // Ensure results exist / are fresh before publishing.
    const resultCount = await this.prisma.examWindowResult.count({ where: { examWindowId: id } });
    if (resultCount === 0) {
      await this.examResults.compute(id, user);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.examWindowResult.updateMany({
        where: { examWindowId: id },
        data: { isPublished: true, publishedAt: new Date() },
      });
      await tx.examWindow.update({
        where: { id },
        data: { status: ExamWindowStatus.PUBLISHED, publishedAt: new Date(), publishedById: user.id },
      });
      // Close the edit-request loop: any still-open edit request for this window
      // (from a grant→edit cycle) moves to its terminal REPUBLISHED state for a
      // clean audit trail. No-op on a normal first publish (no such requests).
      await tx.resultEditRequest.updateMany({
        where: { examWindowId: id, status: { in: ['GRANTED', 'COMPLETED'] } },
        data: { status: 'REPUBLISHED', republishedAt: new Date() },
      });
    });

    const results = await this.prisma.examWindowResult.findMany({
      where: { examWindowId: id },
      select: { studentId: true, classId: true },
    });
    const studentIds = [...new Set(results.map((r) => r.studentId))];
    const classIds = [...new Set(results.map((r) => r.classId))];

    await this.rabbitMq.publish('exam.window.published', {
      examWindowId: id,
      name: window.name,
      termId: window.termId,
      academicYearId: window.academicYearId,
      studentIds,
      classIds,
      schoolId: window.schoolId,
    });

    // Linkage: feed the performance engine + analytics via the legacy event
    // contracts (performance.snapshot.ready / results.published / finalized).
    let downstream = { snapshots: 0, classes: 0 };
    try {
      downstream = await this.examResults.emitDownstreamEvents(id);
    } catch (err) {
      this.logger.warn(`Downstream event emission failed for window ${id}: ${(err as Error)?.message ?? err}`);
    }

    await this.redis.delByPattern(`exam-window:*:${id}`);
    return { published: true, students: studentIds.length, classes: classIds.length, downstream };
  }

  async unpublish(id: string, user: RequestUser, reason?: string) {
    const window = await this.getWindowOrThrow(id, user);
    if (window.status !== ExamWindowStatus.PUBLISHED) {
      throw new BadRequestException('Only a published window can be unpublished.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.examWindowResult.updateMany({
        where: { examWindowId: id },
        data: { isPublished: false, publishedAt: null },
      });
      await tx.examWindow.update({
        where: { id },
        data: { status: ExamWindowStatus.CLOSED },
      });
    });

    await this.rabbitMq.publish('exam.window.unpublished', {
      examWindowId: id,
      reason: reason ?? null,
      schoolId: window.schoolId,
    });
    await this.redis.delByPattern(`exam-window:*:${id}`);
    return { unpublished: true };
  }

  async update(id: string, dto: UpdateExamWindowDto, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (window.status === ExamWindowStatus.PUBLISHED) {
      throw new BadRequestException('Unpublish the window before editing its settings.');
    }
    await this.prisma.examWindow.update({
      where: { id },
      data: {
        name: dto.name,
        maxScore: dto.maxScore,
        weight: dto.weight,
        countsToReportCard: dto.countsToReportCard,
        instructions: dto.instructions,
        opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
        closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
      },
    });
    return this.detail(id, user);
  }

  async archive(id: string, user: RequestUser) {
    await this.getWindowOrThrow(id, user);
    await this.prisma.examWindow.update({ where: { id }, data: { status: ExamWindowStatus.ARCHIVED } });
    return { archived: true };
  }

  async list(filters: ExamWindowFilterDto, user: RequestUser) {
    const where: Prisma.ExamWindowWhereInput = {
      ...schoolScopeFilter(user),
      academicYearId: filters.academicYearId,
      termId: filters.termId,
      examTypeId: filters.examTypeId,
      status: filters.status as any,
      ...(filters.search
        ? { name: { contains: filters.search, mode: 'insensitive' } }
        : {}),
    };

    const windows = await this.prisma.examWindow.findMany({
      where,
      include: {
        examType: true,
        _count: { select: { assessments: true, results: true, editRequests: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    // Per-window progress: how many assessments are submitted/locked.
    const ids = windows.map((w) => w.id);
    const grouped = ids.length
      ? await this.prisma.assessment.groupBy({
          by: ['examWindowId', 'status'],
          where: { examWindowId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const progressByWindow = new Map<string, Record<string, number>>();
    for (const g of grouped) {
      const key = g.examWindowId as string;
      const rec = progressByWindow.get(key) ?? {};
      rec[g.status] = g._count._all;
      progressByWindow.set(key, rec);
    }

    return windows.map((w) => {
      const byStatus = progressByWindow.get(w.id) ?? {};
      const total = w._count.assessments;
      const locked = byStatus[AssessmentStatus.LOCKED] ?? 0;
      const submitted =
        (byStatus[AssessmentStatus.SUBMITTED] ?? 0) + (byStatus[AssessmentStatus.HOD_APPROVED] ?? 0);
      const open = (byStatus[AssessmentStatus.OPEN] ?? 0) + (byStatus[AssessmentStatus.DRAFT] ?? 0);
      return {
        ...w,
        progress: {
          totalAssessments: total,
          open,
          submitted,
          locked,
          percentSubmitted: total ? Math.round(((submitted + locked) / total) * 100) : 0,
          percentLocked: total ? Math.round((locked / total) * 100) : 0,
        },
      };
    });
  }

  private async getWindowOrThrow(id: string, user?: RequestUser) {
    const window = await this.prisma.examWindow.findUnique({ where: { id }, include: { examType: true } });
    if (!window) {
      throw new NotFoundException('Exam window not found');
    }
    assertSchoolInScope(user, window.schoolId ?? null);
    return window;
  }

  async detail(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    const assessments = await this.prisma.assessment.findMany({
      where: { examWindowId: id },
      include: { classSubject: { include: { subject: true } } },
      orderBy: [{ classId: 'asc' }, { subjectId: 'asc' }],
    });

    const byStatus: Record<string, number> = {};
    for (const a of assessments) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    }

    const classIds = [...new Set(assessments.map((a) => a.classId))];
    return {
      ...window,
      assessmentCount: assessments.length,
      classCount: classIds.length,
      statusBreakdown: byStatus,
      assessments,
    };
  }

  /** Windows a teacher can act on right now, with their own subjects surfaced. */
  async teacherWindows(user: RequestUser) {
    const windows = await this.prisma.examWindow.findMany({
      where: {
        ...schoolScopeFilter(user),
        status: { in: [ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] },
        assessments: { some: { classSubject: { teacherId: user.id } } },
      },
      include: { examType: true },
      orderBy: [{ closesAt: 'asc' }, { createdAt: 'desc' }],
    });

    const result: any[] = [];
    for (const w of windows) {
      const myAssessments = await this.prisma.assessment.findMany({
        where: { examWindowId: w.id, classSubject: { teacherId: user.id } },
        include: { classSubject: { include: { subject: true } }, _count: { select: { marks: true } } },
        orderBy: [{ classId: 'asc' }],
      });
      result.push({
        id: w.id,
        name: w.name,
        examType: w.examType,
        termId: w.termId,
        status: w.status,
        opensAt: w.opensAt,
        closesAt: w.closesAt,
        instructions: w.instructions,
        maxScore: w.maxScore,
        mySubjects: myAssessments.map((a) => ({
          assessmentId: a.id,
          subjectId: a.subjectId,
          subjectName: a.classSubject.subject.name,
          classId: a.classId,
          status: a.status,
          marksEntered: a._count.marks,
          maxScore: a.maxScore,
        })),
      });
    }
    return result;
  }

  // ─── Result edit-request workflow ─────────────────────────────────────────

  async createEditRequest(dto: CreateEditRequestDto, user: RequestUser) {
    const window = await this.getWindowOrThrow(dto.examWindowId, user);

    let assessment: { id: string; classSubjectId: string | null; subjectId: string; classId: string; classSubject: { teacherId: string } } | null = null;
    if (dto.assessmentId) {
      const a = await this.prisma.assessment.findUnique({
        where: { id: dto.assessmentId },
        include: { classSubject: { select: { teacherId: true } } },
      });
      if (!a || a.examWindowId !== dto.examWindowId) {
        throw new BadRequestException('The referenced assessment is not part of this exam window.');
      }
      if (user.role === ROLES.TEACHER && a.classSubject.teacherId !== user.id) {
        throw new ForbiddenException('Teachers can only request edits on their own subjects.');
      }
      assessment = { id: a.id, classSubjectId: a.classSubjectId, subjectId: a.subjectId, classId: a.classId, classSubject: a.classSubject };
    }

    const request = await this.prisma.resultEditRequest.create({
      data: {
        schoolId: window.schoolId,
        examWindowId: dto.examWindowId,
        assessmentId: assessment?.id ?? null,
        classSubjectId: assessment?.classSubjectId ?? null,
        subjectId: assessment?.subjectId ?? null,
        classId: assessment?.classId ?? null,
        requestedById: user.id,
        requestedByRole: user.role,
        reason: dto.reason,
      },
    });

    await this.rabbitMq.publish('exam.edit.requested', {
      editRequestId: request.id,
      examWindowId: dto.examWindowId,
      requestedById: user.id,
      schoolId: window.schoolId,
    });
    return request;
  }

  async listEditRequests(filters: { examWindowId?: string; status?: string }, user: RequestUser) {
    const mineOnly = user.role === ROLES.TEACHER;
    return this.prisma.resultEditRequest.findMany({
      where: {
        ...schoolScopeFilter(user),
        examWindowId: filters.examWindowId,
        status: filters.status as any,
        ...(mineOnly ? { requestedById: user.id } : {}),
      },
      include: { examWindow: { select: { name: true, status: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  /** Admin grants an edit request → the affected assessment(s) unlock & the window reopens/unpublishes. */
  async grantEditRequest(id: string, dto: DecideEditRequestDto, user: RequestUser) {
    if (!ExamWindowsService.ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only an admin/principal/AQA can grant edit requests.');
    }
    const request = await this.prisma.resultEditRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Edit request not found');
    assertSchoolInScope(user, request.schoolId ?? null);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`This request is already ${request.status}.`);
    }

    await this.prisma.$transaction(async (tx) => {
      // Unlock either the single assessment, or all assessments in the window.
      const assessmentWhere: Prisma.AssessmentWhereInput = request.assessmentId
        ? { id: request.assessmentId }
        : { examWindowId: request.examWindowId };

      await tx.mark.updateMany({ where: { assessment: assessmentWhere }, data: { isLocked: false } });
      await tx.assessment.updateMany({ where: assessmentWhere, data: { status: AssessmentStatus.OPEN } });

      // Unpublish results & reopen the window so the teacher can edit.
      await tx.examWindowResult.updateMany({
        where: { examWindowId: request.examWindowId },
        data: { isPublished: false, publishedAt: null },
      });
      await tx.examWindow.update({
        where: { id: request.examWindowId },
        data: { status: ExamWindowStatus.REOPENED },
      });

      await tx.resultEditRequest.update({
        where: { id },
        data: {
          status: 'GRANTED',
          decidedById: user.id,
          decidedByRole: user.role,
          decidedAt: new Date(),
          decisionNote: dto.note,
        },
      });
    });

    await this.rabbitMq.publish('exam.edit.granted', {
      editRequestId: id,
      examWindowId: request.examWindowId,
      grantedById: user.id,
      teacherId: request.requestedById,
      schoolId: request.schoolId,
    });
    await this.redis.delByPattern(`exam-window:*:${request.examWindowId}`);
    return this.prisma.resultEditRequest.findUnique({ where: { id } });
  }

  async rejectEditRequest(id: string, dto: DecideEditRequestDto, user: RequestUser) {
    if (!ExamWindowsService.ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only an admin/principal/AQA can decide edit requests.');
    }
    const request = await this.prisma.resultEditRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Edit request not found');
    assertSchoolInScope(user, request.schoolId ?? null);
    if (request.status !== 'REQUESTED') {
      throw new BadRequestException(`This request is already ${request.status}.`);
    }
    const updated = await this.prisma.resultEditRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedById: user.id,
        decidedByRole: user.role,
        decidedAt: new Date(),
        decisionNote: dto.note,
      },
    });
    await this.rabbitMq.publish('exam.edit.rejected', {
      editRequestId: id,
      examWindowId: request.examWindowId,
      teacherId: request.requestedById,
      schoolId: request.schoolId,
    });
    return updated;
  }

  /** Teacher signals they are done editing → request moves to COMPLETED, awaiting republish. */
  async completeEditRequest(id: string, user: RequestUser) {
    const request = await this.prisma.resultEditRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Edit request not found');
    if (user.role === ROLES.TEACHER && request.requestedById !== user.id) {
      throw new ForbiddenException('Teachers can only complete their own edit requests.');
    }
    if (request.status !== 'GRANTED') {
      throw new BadRequestException('Only a granted request can be marked complete.');
    }
    return this.prisma.resultEditRequest.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
}
