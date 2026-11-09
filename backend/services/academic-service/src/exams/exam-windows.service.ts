import {
  BadRequestException,
  ConflictException,
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
  requireWriteSchoolId,
  schoolScopeFilter,
} from '../common/helpers/school-scope.helper';
import {
  AddExamWindowClassesDto,
  CreateExamWindowDto,
  ExamWindowFilterDto,
  ExcludeExamWindowClassesDto,
  PreviewExamWindowClassExclusionDto,
  UpdateExamWindowDto,
} from './dto/exam-window.dto';
import { CreateEditRequestDto, DecideEditRequestDto } from './dto/edit-request.dto';
import { ExamResultsService } from './exam-results.service';
import { AuthClientService } from '../auth-client/auth-client.service';
import { resolveExpectedStudents } from './engine/expected-students';
import { matchExclusion } from './engine/subject-exclusions';

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

  /** Subject ids a Head of Department is responsible for (department link, else subjects they teach). */
  private async hodSubjectIds(user: RequestUser): Promise<string[]> {
    const ids = new Set<string>();
    try {
      const dept = await this.studentClient.get<any>(`/students/internal/departments/by-user/${user.id}`, {}, { 'X-User-Id': user.id, 'X-User-Role': user.role });
      const d = dept?.data ?? dept;
      if (d?.id) {
        const subjects = await this.prisma.subject.findMany({ where: { departmentId: d.id }, select: { id: true } });
        subjects.forEach((x) => ids.add(x.id));
      }
    } catch {
      /* fall back to the subjects they teach */
    }
    const own = await this.prisma.classSubject.findMany({ where: { teacherId: user.id }, select: { subjectId: true } });
    own.forEach((x) => ids.add(x.subjectId));
    return [...ids];
  }

  /**
   * Who may decide an edit request: admins / principals / AQA for any request, a Head of
   * Department only for a request on a subject of their own department.
   */
  private async assertCanDecide(user: RequestUser, request: { subjectId: string | null; assessmentId: string | null }) {
    if (ExamWindowsService.ADMIN_ROLES.includes(user.role)) return;
    if (user.role === ROLES.HEAD_OF_DEPARTMENT) {
      if (!request.subjectId) {
        throw new ForbiddenException('This request covers the whole window, so only an administrator can decide it.');
      }
      const mine = await this.hodSubjectIds(user);
      if (mine.includes(request.subjectId)) return;
      throw new ForbiddenException('This subject belongs to another department. Its own Head of Department or an administrator must decide.');
    }
    throw new ForbiddenException('Only the Head of Department, an administrator, the principal or academic QA can decide edit requests.');
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly studentClient: StudentClientService,
    private readonly examResults: ExamResultsService,
    private readonly authClient: AuthClientService,
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

  /** Shared checks for creating / editing a window, so a bad window is caught before teachers see it. */
  private assertDates(opensAt?: string | Date | null, closesAt?: string | Date | null) {
    if (opensAt && closesAt && new Date(closesAt).getTime() <= new Date(opensAt).getTime()) {
      throw new BadRequestException('The closing date must be after the opening date.');
    }
  }

  private async assertTermInYear(academicYearId: string, termId: string, user: RequestUser) {
    const payload = await this.studentClient.get<unknown>('/students/terms', {}, this.studentServiceHeaders(user));
    const term = this.unwrap<any>(payload).find((t) => t.id === termId);
    if (!term) throw new BadRequestException('The selected term does not exist.');
    if (term.academicYearId !== academicYearId) {
      throw new BadRequestException('The selected term does not belong to the selected academic year.');
    }
  }

  private async assertNameFree(schoolId: string | null, termId: string, name: string, exceptId?: string) {
    const clash = await this.prisma.examWindow.findFirst({
      where: {
        schoolId,
        termId,
        name: { equals: name.trim(), mode: 'insensitive' },
        status: { not: ExamWindowStatus.ARCHIVED },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) throw new BadRequestException(`An exam window called "${name.trim()}" already exists in this term. Choose a different name.`);
  }

  async create(dto: CreateExamWindowDto, user: RequestUser) {
    const schoolId = requireWriteSchoolId(user, 'exam window');

    const examType = await this.prisma.examType.findUnique({ where: { id: dto.examTypeId } });
    if (!examType) {
      throw new BadRequestException('Selected exam type does not exist.');
    }
    assertSchoolInScope(user, examType.schoolId ?? null);

    this.assertDates(dto.opensAt, dto.closesAt);
    await this.assertTermInYear(dto.academicYearId, dto.termId, user);
    await this.assertNameFree(schoolId, dto.termId, dto.name);
    const scope = await this.resolveScopeClasses(
      { academicYearId: dto.academicYearId, educationStage: dto.educationStage ?? null, scopeType: dto.scopeType, scopeLevels: dto.scopeLevels ?? [], scopeClassIds: dto.scopeClassIds ?? [] },
      user,
    );
    if (!scope.length) {
      throw new BadRequestException('The selected scope matches no classes in this academic year. Check the stage, standards or classes.');
    }

    const window = await this.prisma.examWindow.create({
      data: {
        schoolId,
        examTypeId: dto.examTypeId,
        name: dto.name.trim(),
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

    let fanOut: { assessmentsCreated: number; classesCovered: number; subjectsCovered: number; omitted: number } | null = null;
    if (dto.openNow) {
      fanOut = await this.open(window.id, user);
    }

    return { ...(await this.detail(window.id, user)), fanOut };
  }

  /** A window the caller may see (school scope enforced). Public for the subject-planning service. */
  getWindow(id: string, user?: RequestUser) {
    return this.getWindowOrThrow(id, user);
  }

  /** Omissions that apply to a window: its own, plus the school's standing rules. */
  private loadExclusions(window: { id: string; schoolId: string | null }) {
    return this.prisma.examSubjectExclusion.findMany({
      where: { OR: [{ examWindowId: window.id }, { examWindowId: null, schoolId: window.schoolId }] },
    });
  }

  /**
   * Create the missing marks sheets (one Assessment per class-subject in scope), skipping every subject the
   * admin has omitted. Safe to repeat: existing sheets are left alone, so it also adds subjects assigned
   * after the window opened.
   */
  private async fanOut(window: Awaited<ReturnType<ExamWindowsService['getWindowOrThrow']>>, user: RequestUser) {
    const classes = await this.resolveScopeClasses(window, user);
    if (!classes.length) {
      throw new BadRequestException('The selected scope matched no classes. Check the classes exist for this academic year.');
    }
    const classIds = classes.map((c) => c.id);

    const all = await this.prisma.classSubject.findMany({
      where: { academicYearId: window.academicYearId, isActive: true, classId: { in: classIds } },
      include: { subject: true },
    });
    const classSubjects = all.filter((cs) => cs.subject.isActive);
    if (!classSubjects.length) {
      throw new BadRequestException('No subjects are assigned to the classes in scope. Assign class-subjects first.');
    }

    const rules = await this.loadExclusions(window);
    const firstOpen = window.openedAt == null;
    const included: typeof classSubjects = [];
    const seedFromStanding: Array<{ subjectId: string; classId: string | null; reason: string }> = [];
    for (const cs of classSubjects) {
      const hit = matchExclusion(rules, cs.subjectId, cs.classId, { windowOpened: !firstOpen });
      if (!hit) { included.push(cs); continue; }
      if (hit.source === 'STANDING' && !seedFromStanding.some((x) => x.subjectId === hit.row.subjectId && x.classId === hit.row.classId)) {
        seedFromStanding.push({ subjectId: hit.row.subjectId, classId: hit.row.classId, reason: `School rule: ${hit.row.reason}` });
      }
    }
    if (!included.length) {
      throw new BadRequestException('Every subject in scope has been omitted, so there is nothing to examine. Restore at least one subject.');
    }

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      // The first time a window opens, the school's standing rules become this window's own (history stays stable).
      for (const rule of seedFromStanding) {
        await tx.examSubjectExclusion.create({
          data: { schoolId: window.schoolId, examWindowId: window.id, subjectId: rule.subjectId, classId: rule.classId, reason: rule.reason, createdById: user.id },
        });
      }
      for (const cs of included) {
        const existing = await tx.assessment.findUnique({
          where: { classSubjectId_examWindowId: { classSubjectId: cs.id, examWindowId: window.id } },
        });
        if (existing) {
          if (existing.status === AssessmentStatus.LOCKED && window.status === ExamWindowStatus.REOPENED) {
            // reopening: allow edits again
            await tx.assessment.update({ where: { id: existing.id }, data: { status: AssessmentStatus.OPEN } });
          }
          continue;
        }
        await tx.assessment.create({
          data: {
            classSubjectId: cs.id,
            examWindowId: window.id,
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
        where: { id: window.id },
        data: {
          status: window.status === ExamWindowStatus.DRAFT ? ExamWindowStatus.OPEN : window.status,
          openedAt: window.openedAt ?? new Date(),
          ...(created > 0 ? { subjectsChangedAt: new Date() } : {}),
        },
      });
    });

    return { assessmentsCreated: created, classesCovered: classIds.length, subjectsCovered: included.length, omitted: classSubjects.length - included.length, classIds };
  }

  /** Fan out one Assessment per class-subject in scope (minus omitted subjects), and set the window OPEN. */
  async open(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Only a DRAFT or REOPENED window can be (re)opened. Current status: ${window.status}.`);
    }
    const { classIds, ...summary } = await this.fanOut(window, user);

    await this.rabbitMq.publish('exam.window.opened', {
      examWindowId: id,
      name: window.name,
      termId: window.termId,
      academicYearId: window.academicYearId,
      classIds,
      schoolId: window.schoolId,
    });

    return summary;
  }

  /** Add marks sheets for subjects assigned after the window opened (omitted subjects stay omitted). */
  async syncSubjects(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Subjects can only be added while the window is OPEN or REOPENED. Current status: ${window.status}.`);
    }
    const { classIds: _c, ...summary } = await this.fanOut(window, user);
    await this.redis.delByPattern(`exam-window:*:${id}`);
    return summary;
  }

  /**
   * Append classes without disturbing the classes, marks sheets or marks already in the window.
   * Once a window is open its scope becomes an explicit class list so future class creation cannot
   * silently change an exam that is already running.
   */
  async addClasses(id: string, dto: AddExamWindowClassesDto, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(
        `Classes can only be added while the window is DRAFT, OPEN or REOPENED. Current status: ${window.status}. Reopen it first.`,
      );
    }

    const eligible = await this.resolveScopeClasses(
      {
        academicYearId: window.academicYearId,
        educationStage: window.educationStage,
        scopeType: 'ALL_CLASSES',
        scopeLevels: [],
        scopeClassIds: [],
      },
      user,
    );
    const eligibleById = new Map(eligible.map((item) => [item.id, item]));
    const requestedIds = [...new Set(dto.classIds)];
    const invalidIds = requestedIds.filter((classId) => !eligibleById.has(classId));
    if (invalidIds.length) {
      throw new BadRequestException(
        `${invalidIds.length} selected class${invalidIds.length === 1 ? ' is' : 'es are'} not in this window's school, academic year and stage. Refresh the class list and try again.`,
      );
    }

    const current = await this.resolveScopeClasses(window, user);
    const currentIds = new Set(current.map((item) => item.id));
    const addedIds = requestedIds.filter((classId) => !currentIds.has(classId));
    if (!addedIds.length) {
      return {
        ...(await this.detail(id, user)),
        addedClasses: 0,
        assessmentsCreated: 0,
        message: 'Every selected class is already included in this exam window.',
      };
    }

    const classSubjects = await this.prisma.classSubject.findMany({
      where: {
        academicYearId: window.academicYearId,
        classId: { in: addedIds },
        isActive: true,
        subject: { isActive: true },
      },
      include: { subject: true },
    });
    const classesWithSubjects = new Set(classSubjects.map((item) => item.classId));
    const withoutSubjects = addedIds.filter((classId) => !classesWithSubjects.has(classId));
    if (withoutSubjects.length) {
      const labels = withoutSubjects.map((classId) => eligibleById.get(classId)?.name ?? classId);
      throw new BadRequestException(
        `${labels.join(', ')} ${labels.length === 1 ? 'has' : 'have'} no active subjects assigned. Assign subjects first, then add ${labels.length === 1 ? 'the class' : 'those classes'} to the exam.`,
      );
    }

    const opened = window.status !== ExamWindowStatus.DRAFT;
    const rules = opened ? await this.loadExclusions(window) : [];
    const included = opened
      ? classSubjects.filter((item) => !matchExclusion(rules, item.subjectId, item.classId, { windowOpened: true }))
      : [];
    if (opened) {
      const classesWithIncludedSubjects = new Set(included.map((item) => item.classId));
      const fullyOmitted = addedIds.filter((classId) => !classesWithIncludedSubjects.has(classId));
      if (fullyOmitted.length) {
        const labels = fullyOmitted.map((classId) => eligibleById.get(classId)?.name ?? classId);
        throw new BadRequestException(
          `Every subject is omitted for ${labels.join(', ')}. Restore at least one subject before adding ${labels.length === 1 ? 'this class' : 'these classes'}.`,
        );
      }
    }

    const nextIds = [...currentIds, ...addedIds];
    const assessmentsCreated = await this.prisma.$transaction(async (tx) => {
      await tx.examWindow.update({
        where: { id },
        data: {
          scopeType: 'STREAMS',
          scopeLevels: [],
          scopeClassIds: nextIds,
          ...(opened && included.length ? { subjectsChangedAt: new Date() } : {}),
        },
      });
      if (!opened) return 0;

      const result = await tx.assessment.createMany({
        data: included.map((item) => ({
          classSubjectId: item.id,
          examWindowId: id,
          classId: item.classId,
          subjectId: item.subjectId,
          educationStage: item.educationStage,
          classLevel: item.classLevel,
          combinationId: item.combinationId,
          termId: window.termId,
          academicYearId: window.academicYearId,
          schoolId: item.schoolId ?? window.schoolId,
          name: `${item.subject.name} - ${window.name}`,
          maxScore: window.maxScore,
          status: AssessmentStatus.OPEN,
        })),
        skipDuplicates: true,
      });
      return result.count;
    });

    await this.redis.delByPattern(`exam-window:*:${id}`);
    await this.rabbitMq.publish('exam.window.classes.added', {
      examWindowId: id,
      classIds: addedIds,
      addedById: user.id,
      schoolId: window.schoolId,
      assessmentsCreated,
    });

    return {
      ...(await this.detail(id, user)),
      addedClasses: addedIds.length,
      assessmentsCreated,
      message: `${addedIds.length} class${addedIds.length === 1 ? '' : 'es'} added${opened ? ` and ${assessmentsCreated} marks sheet${assessmentsCreated === 1 ? '' : 's'} created` : ''}.`,
    };
  }

  private assertClassScopeCanChange(status: ExamWindowStatus) {
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(status)) {
      throw new BadRequestException(
        `Classes can only be excluded while the window is DRAFT, OPEN or REOPENED. Current status: ${status}. Reopen it first.`,
      );
    }
  }

  private async classExclusionImpact(
    window: Awaited<ReturnType<ExamWindowsService['getWindowOrThrow']>>,
    classIds: string[],
    user: RequestUser,
  ) {
    this.assertClassScopeCanChange(window.status);
    const requestedIds = [...new Set(classIds)];
    if (!requestedIds.length) {
      throw new BadRequestException('Select at least one class to exclude.');
    }
    const current = await this.resolveScopeClasses(window, user);
    const currentById = new Map(current.map((item) => [item.id, item]));
    const invalidIds = requestedIds.filter((classId) => !currentById.has(classId));
    if (invalidIds.length) {
      throw new BadRequestException(
        `${invalidIds.length} selected class${invalidIds.length === 1 ? ' is' : 'es are'} not included in this exam window. Refresh and try again.`,
      );
    }
    if (requestedIds.length >= current.length) {
      throw new BadRequestException('An exam window must keep at least one class. Archive this window instead if the whole exam was cancelled.');
    }

    const sheets = await this.prisma.assessment.findMany({
      where: { examWindowId: window.id, classId: { in: requestedIds } },
      select: { id: true, classId: true, _count: { select: { marks: true } } },
    });
    const marksEntered = sheets.reduce((total, sheet) => total + sheet._count.marks, 0);
    const calculatedResults = await this.prisma.examWindowResult.count({
      where: { examWindowId: window.id, classId: { in: requestedIds } },
    });

    return {
      classIds: requestedIds,
      classes: requestedIds.map((classId) => ({
        id: classId,
        name: currentById.get(classId)?.name ?? classId,
        stream: currentById.get(classId)?.stream ?? null,
      })),
      remainingClassIds: current.filter((item) => !requestedIds.includes(item.id)).map((item) => item.id),
      marksSheets: sheets.length,
      marksEntered,
      calculatedResults,
      requiresDiscardConfirmation: marksEntered > 0,
      confirmationText: `EXCLUDE ${requestedIds.length} ${requestedIds.length === 1 ? 'CLASS' : 'CLASSES'}`,
    };
  }

  async previewClassExclusion(id: string, dto: PreviewExamWindowClassExclusionDto, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    return this.classExclusionImpact(window, dto.classIds, user);
  }

  /**
   * Remove classes from this exam only. School classes, enrolments and users are untouched.
   * Existing marks are never discarded unless the caller explicitly confirms that impact.
   */
  async excludeClasses(id: string, dto: ExcludeExamWindowClassesDto, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    const impact = await this.classExclusionImpact(window, dto.classIds, user);
    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Give a short reason. It is kept in the audit trail.');
    }
    if (impact.marksEntered > 0 && !dto.discardMarks) {
      throw new ConflictException(
        `${impact.marksEntered} entered mark${impact.marksEntered === 1 ? '' : 's'} would be permanently removed. Review the impact and confirm that entered marks may be discarded.`,
      );
    }

    const schoolId = window.schoolId ?? requireWriteSchoolId(user, 'exam class exclusion');
    const now = new Date();
    const removed = await this.prisma.$transaction(
      async (tx) => {
        const fresh = await tx.examWindow.findUnique({ where: { id }, select: { status: true } });
        if (!fresh) throw new NotFoundException('Exam window not found');
        this.assertClassScopeCanChange(fresh.status);

        // Prevent a teacher save racing this review: FK checks for a new Mark wait
        // until these assessment rows are either retained or removed.
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "academics"."Assessment"
            WHERE "examWindowId" = ${id}
              AND "classId" IN (${Prisma.join(impact.classIds)})
            FOR UPDATE`,
        );
        const sheets = await tx.assessment.findMany({
          where: { examWindowId: id, classId: { in: impact.classIds } },
          select: { id: true, _count: { select: { marks: true } } },
        });
        const marksEntered = sheets.reduce((total, sheet) => total + sheet._count.marks, 0);
        if (marksEntered > 0 && !dto.discardMarks) {
          throw new ConflictException(
            `${marksEntered} entered mark${marksEntered === 1 ? '' : 's'} would be permanently removed. Review the updated impact and confirm that entered marks may be discarded.`,
          );
        }

        const results = await tx.examWindowResult.deleteMany({
          where: { examWindowId: id, classId: { in: impact.classIds } },
        });
        const assessments = await tx.assessment.deleteMany({
          where: { examWindowId: id, classId: { in: impact.classIds } },
        });
        const scopeUpdate = await tx.examWindow.updateMany({
          where: { id, updatedAt: window.updatedAt },
          data: {
            scopeType: 'STREAMS',
            scopeLevels: [],
            scopeClassIds: impact.remainingClassIds,
            subjectsChangedAt: now,
            computedAt: null,
          },
        });
        if (scopeUpdate.count !== 1) {
          throw new ConflictException('This exam window changed while you were reviewing it. Refresh the class list and review the impact again.');
        }
        await tx.academicAuditLog.create({
          data: {
            schoolId,
            action: 'EXAM_WINDOW_CLASSES_EXCLUDED',
            performedById: user.id,
            payload: {
              examWindowId: id,
              classIds: impact.classIds,
              classes: impact.classes,
              reason,
              marksSheetsRemoved: assessments.count,
              marksDiscarded: marksEntered,
              calculatedResultsRemoved: results.count,
            },
          },
        });
        return {
          marksSheetsRemoved: assessments.count,
          marksDiscarded: marksEntered,
          calculatedResultsRemoved: results.count,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 20_000, timeout: 120_000 },
    );

    await this.redis.delByPattern(`exam-window:*:${id}`);
    await this.rabbitMq.publish('exam.window.classes.excluded', {
      examWindowId: id,
      classIds: impact.classIds,
      excludedById: user.id,
      schoolId,
      reason,
      ...removed,
    });

    return {
      ...(await this.detail(id, user)),
      excludedClasses: impact.classIds.length,
      ...removed,
      message: `${impact.classIds.length} class${impact.classIds.length === 1 ? '' : 'es'} excluded from this exam. School classes, students and accounts were not changed.`,
    };
  }

  /**
   * Close entry and calculate the merit list ATOMICALLY.
   * Order: validate (grading scales + every expected subject resolved) ->
   * calculate in memory -> ONE transaction that locks marks/assessments, persists
   * the results and flips the window to CLOSED. Any failure leaves the window
   * open and editable with nothing locked or written.
   */
  async close(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Only an OPEN window can be closed. Current status: ${window.status}.`);
    }

    const ctx = await this.examResults.calculate(id, user);
    const now = new Date();

    await this.prisma.$transaction(
      async (tx) => {
        await tx.mark.updateMany({ where: { assessment: { examWindowId: id } }, data: { isLocked: true } });
        await tx.assessment.updateMany({
          where: { examWindowId: id, status: { not: AssessmentStatus.LOCKED } },
          data: { status: AssessmentStatus.LOCKED, lockedAt: now },
        });
        await this.examResults.persist(tx, ctx, now);
        await tx.examWindow.update({ where: { id }, data: { status: ExamWindowStatus.CLOSED, closedAt: now, computedAt: now } });
      },
      { timeout: 120000, maxWait: 20000 },
    );

    const merit = await this.examResults.afterCompute(ctx, now);
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
    } else if (window.computedAt) {
      // Marks or exemptions changed after the last calculation -> published figures would be wrong.
      const [staleMarks, staleExemptions] = await Promise.all([
        this.prisma.mark.count({
          where: {
            assessment: { examWindowId: id },
            OR: [{ lastEditedAt: { gt: window.computedAt } }, { enteredAt: { gt: window.computedAt } }],
          },
        }),
        this.prisma.resultCalculationExemption.count({
          where: {
            termId: window.termId,
            academicYearId: window.academicYearId,
            OR: [{ examWindowId: null }, { examWindowId: id }],
            updatedAt: { gt: window.computedAt },
          },
        }),
      ]);
      const staleSubjects = window.subjectsChangedAt && window.subjectsChangedAt > window.computedAt;
      if (staleMarks || staleExemptions || staleSubjects) {
        throw new BadRequestException(
          'Marks, exemptions or the subject list changed after the last calculation. Recalculate results before publishing.',
        );
      }
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
    if (window.status === ExamWindowStatus.ARCHIVED) {
      throw new BadRequestException('An archived window cannot be edited.');
    }
    const scopeEdit = dto.scopeType !== undefined || dto.scopeLevels !== undefined || dto.scopeClassIds !== undefined || dto.educationStage !== undefined;
    if (scopeEdit && window.status !== ExamWindowStatus.DRAFT) {
      throw new BadRequestException('Which classes an exam covers can only change while it is a DRAFT. Once teachers have marks sheets, omit subjects instead.');
    }
    this.assertDates(dto.opensAt ?? window.opensAt, dto.closesAt ?? window.closesAt);
    if (dto.name && dto.name.trim().toLowerCase() !== window.name.toLowerCase()) {
      await this.assertNameFree(window.schoolId, window.termId, dto.name, id);
    }

    const scopeType = (dto.scopeType ?? window.scopeType) as string;
    if (scopeEdit) {
      const classes = await this.resolveScopeClasses(
        {
          academicYearId: window.academicYearId,
          educationStage: (dto.educationStage ?? window.educationStage) as string | null,
          scopeType,
          scopeLevels: dto.scopeLevels ?? window.scopeLevels,
          scopeClassIds: dto.scopeClassIds ?? window.scopeClassIds,
        },
        user,
      );
      if (!classes.length) throw new BadRequestException('The selected scope matches no classes in this academic year.');
    }

    const maxChange = dto.maxScore !== undefined && dto.maxScore !== window.maxScore;
    if (maxChange && window.status === ExamWindowStatus.CLOSED) {
      throw new BadRequestException('Results are already calculated. Reopen the window before changing the maximum score.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (maxChange && window.status !== ExamWindowStatus.DRAFT) {
        // Marks sheets copy the maximum when they are created, so an open window has to carry the change down.
        const tooHigh = await tx.mark.count({ where: { assessment: { examWindowId: id }, score: { gt: dto.maxScore! } } });
        if (tooHigh > 0) {
          throw new BadRequestException(`${tooHigh} mark(s) already entered are above ${dto.maxScore}. Correct them first, or keep the current maximum.`);
        }
        await tx.assessment.updateMany({ where: { examWindowId: id, status: { not: AssessmentStatus.LOCKED } }, data: { maxScore: dto.maxScore! } });
      }
      await tx.examWindow.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          maxScore: dto.maxScore,
          weight: dto.weight,
          countsToReportCard: dto.countsToReportCard,
          instructions: dto.instructions,
          opensAt: dto.opensAt ? new Date(dto.opensAt) : undefined,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
          ...(scopeEdit
            ? {
                educationStage: (dto.educationStage ?? window.educationStage) as any,
                scopeType: scopeType as any,
                scopeLevels: scopeType === 'STANDARDS' ? dto.scopeLevels ?? window.scopeLevels : [],
                scopeClassIds: scopeType === 'STREAMS' ? dto.scopeClassIds ?? window.scopeClassIds : [],
              }
            : {}),
        },
      });
    });
    await this.redis.delByPattern(`exam-window:*:${id}`);
    return this.detail(id, user);
  }

  async archive(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.CLOSED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(
        window.status === ExamWindowStatus.ARCHIVED
          ? 'This window is already archived.'
          : `A ${window.status} window cannot be archived. Close it (or unpublish it) first.`,
      );
    }
    await this.prisma.examWindow.update({ where: { id }, data: { status: ExamWindowStatus.ARCHIVED } });
    return { archived: true };
  }

  async list(filters: ExamWindowFilterDto, user: RequestUser) {
    const where: Prisma.ExamWindowWhereInput = {
      ...schoolScopeFilter(user),
      academicYearId: filters.academicYearId,
      termId: filters.termId,
      examTypeId: filters.examTypeId,
      status: filters.status ? (filters.status as any) : { not: ExamWindowStatus.ARCHIVED },
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

    const classRows = ids.length
      ? await this.prisma.assessment.groupBy({ by: ['examWindowId', 'classId'], where: { examWindowId: { in: ids } } })
      : [];
    const classCountByWindow = new Map<string, number>();
    for (const r of classRows) {
      const key = r.examWindowId as string;
      classCountByWindow.set(key, (classCountByWindow.get(key) ?? 0) + 1);
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
        classCount: classCountByWindow.get(w.id) ?? 0,
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

  private async rosterIdsByClass(classIds: string[], user: RequestUser): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    for (const classId of classIds) {
      const payload = await this.studentClient.get<unknown>('/students', { classId, limit: 2000, page: 1 }, this.studentServiceHeaders(user));
      out.set(classId, this.unwrap<any>(payload).map((s) => s.id as string));
    }
    return out;
  }

  /** Entry progress for each assessment: who must have a mark, how many have one. */
  private async entryProgress(assessments: any[], user: RequestUser) {
    const rosters = await this.rosterIdsByClass([...new Set(assessments.map((a) => a.classId))], user);
    const marks = await this.prisma.mark.groupBy({
      by: ['assessmentId'],
      where: { assessmentId: { in: assessments.map((a) => a.id) } },
      _count: { _all: true },
    });
    const enteredBy = new Map(marks.map((m) => [m.assessmentId, m._count._all]));
    const out = new Map<string, { required: number; entered: number; exempt: number }>();
    for (const a of assessments) {
      const { required, exempt } = await resolveExpectedStudents(this.prisma, a, rosters.get(a.classId) ?? []);
      out.set(a.id, { required: required.size, entered: Math.min(enteredBy.get(a.id) ?? 0, required.size + exempt.size), exempt: exempt.size });
    }
    return out;
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

    const progress = assessments.length ? await this.entryProgress(assessments, user) : new Map();
    const names = await this.authClient.getUserNames(assessments.map((a) => a.classSubject.teacherId));

    const classIds = [...new Set(assessments.map((a) => a.classId))];
    return {
      ...window,
      assessmentCount: assessments.length,
      classCount: classIds.length,
      statusBreakdown: byStatus,
      assessments: assessments.map((a) => ({
        ...a,
        teacherId: a.classSubject.teacherId,
        teacherName: names.get(a.classSubject.teacherId) ?? null,
        entry: progress.get(a.id) ?? { required: 0, entered: 0, exempt: 0 },
      })),
    };
  }

  /**
   * The teacher's exam work: open windows first (marks to enter), then recently closed / published
   * ones so a locked subject is still visible and an edit can be requested from there.
   */
  async teacherWindows(user: RequestUser) {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120);
    const windows = await this.prisma.examWindow.findMany({
      where: {
        ...schoolScopeFilter(user),
        OR: [
          { status: { in: [ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] } },
          { status: { in: [ExamWindowStatus.CLOSED, ExamWindowStatus.PUBLISHED] }, createdAt: { gte: since } },
        ],
        assessments: { some: { classSubject: { teacherId: user.id } } },
      },
      include: { examType: true },
      orderBy: [{ createdAt: 'desc' }],
    });
    const rank = (s: string) => (s === 'OPEN' || s === 'REOPENED' ? 0 : 1);
    windows.sort((a, b) => rank(a.status) - rank(b.status) || (a.closesAt?.getTime() ?? Infinity) - (b.closesAt?.getTime() ?? Infinity));

    const result: any[] = [];
    for (const w of windows) {
      const myAssessments = await this.prisma.assessment.findMany({
        where: { examWindowId: w.id, classSubject: { teacherId: user.id } },
        include: { classSubject: { include: { subject: true } } },
        orderBy: [{ classId: 'asc' }],
      });
      const progress = await this.entryProgress(myAssessments, user);
      const requests = await this.prisma.resultEditRequest.findMany({
        where: { examWindowId: w.id, assessmentId: { in: myAssessments.map((a) => a.id) } },
        orderBy: { createdAt: 'desc' },
      });
      const windowOpen = w.status === ExamWindowStatus.OPEN || w.status === ExamWindowStatus.REOPENED;
      const editable: AssessmentStatus[] = [AssessmentStatus.OPEN, AssessmentStatus.DRAFT, AssessmentStatus.REJECTED, AssessmentStatus.SUBMITTED];
      result.push({
        id: w.id,
        name: w.name,
        examType: w.examType,
        termId: w.termId,
        academicYearId: w.academicYearId,
        status: w.status,
        opensAt: w.opensAt,
        closesAt: w.closesAt,
        instructions: w.instructions,
        maxScore: w.maxScore,
        mySubjects: myAssessments.map((a) => {
          const p = progress.get(a.id) ?? { required: 0, entered: 0, exempt: 0 };
          const latest = requests.find((r) => r.assessmentId === a.id) ?? null;
          return {
            assessmentId: a.id,
            subjectId: a.subjectId,
            subjectName: a.classSubject.subject.name,
            classId: a.classId,
            status: a.status,
            marksEntered: p.entered,
            required: p.required,
            exempt: p.exempt,
            complete: p.required > 0 && p.entered >= p.required,
            canEdit: windowOpen && editable.includes(a.status),
            maxScore: a.maxScore,
            editRequest: latest ? { id: latest.id, status: latest.status, reason: latest.reason, decisionNote: latest.decisionNote } : null,
          };
        }),
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

    // No permission is needed while the subject is still open for entry.
    if (assessment && (window.status === ExamWindowStatus.OPEN || window.status === ExamWindowStatus.REOPENED)) {
      const a = await this.prisma.assessment.findUnique({ where: { id: assessment.id }, select: { status: true } });
      if (a && ([AssessmentStatus.OPEN, AssessmentStatus.DRAFT, AssessmentStatus.REJECTED, AssessmentStatus.SUBMITTED] as AssessmentStatus[]).includes(a.status)) {
        throw new BadRequestException('This subject is still open for marks entry. You can edit it now without a request.');
      }
    }
    const pending = await this.prisma.resultEditRequest.findFirst({
      where: { examWindowId: dto.examWindowId, assessmentId: assessment?.id ?? null, status: { in: ['REQUESTED', 'GRANTED'] } },
    });
    if (pending) {
      throw new BadRequestException(
        pending.status === 'GRANTED'
          ? 'An edit has already been approved for this subject. Open it and make your changes.'
          : 'An edit request for this subject is already waiting for approval.',
      );
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
    let hodScope: Prisma.ResultEditRequestWhereInput | undefined;
    if (user.role === ROLES.HEAD_OF_DEPARTMENT) {
      const subjectIds = await this.hodSubjectIds(user);
      hodScope = { OR: [{ subjectId: { in: subjectIds.length ? subjectIds : ['__none__'] } }, { requestedById: user.id }] };
    }
    const rows = await this.prisma.resultEditRequest.findMany({
      where: {
        ...schoolScopeFilter(user),
        examWindowId: filters.examWindowId,
        status: filters.status as any,
        ...(mineOnly ? { requestedById: user.id } : {}),
        ...(hodScope ?? {}),
      },
      include: { examWindow: { select: { name: true, status: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });
    // Readable context: who asked, for which subject / class.
    const names = await this.authClient.getUserNames(rows.map((r) => r.requestedById));
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.subjectId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
    const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
    return rows.map((r) => ({ ...r, requestedByName: names.get(r.requestedById) ?? null, subjectName: r.subjectId ? subjectName.get(r.subjectId) ?? null : null }));
  }

  /** Admin grants an edit request → the affected assessment(s) unlock & the window reopens/unpublishes. */
  async grantEditRequest(id: string, dto: DecideEditRequestDto, user: RequestUser) {
    const request = await this.prisma.resultEditRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Edit request not found');
    assertSchoolInScope(user, request.schoolId ?? null);
    await this.assertCanDecide(user, request);
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
    const request = await this.prisma.resultEditRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Edit request not found');
    assertSchoolInScope(user, request.schoolId ?? null);
    await this.assertCanDecide(user, request);
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
    // Editing is over for this subject: lock it again so nothing changes behind the scenes.
    return this.prisma.$transaction(async (tx) => {
      if (request.assessmentId) {
        await tx.mark.updateMany({ where: { assessmentId: request.assessmentId }, data: { isLocked: true } });
        await tx.assessment.update({ where: { id: request.assessmentId }, data: { status: AssessmentStatus.LOCKED, lockedAt: new Date() } });
      }
      return tx.resultEditRequest.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
    });
  }

  /**
   * Admin-initiated correction: withdraw published results (if any), unlock the window and record
   * the permission as an approved edit request so the audit trail is identical to the request flow.
   */
  async reopen(id: string, user: RequestUser, reason?: string) {
    if (!ExamWindowsService.ADMIN_ROLES.includes(user.role)) {
      throw new ForbiddenException('Only an administrator, the principal or academic QA can reopen a window.');
    }
    const window = await this.getWindowOrThrow(id, user);
    if (!([ExamWindowStatus.CLOSED, ExamWindowStatus.PUBLISHED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Only a closed or published window can be reopened for corrections. Current status: ${window.status}.`);
    }
    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('Give a reason (at least 5 characters) for reopening. It is kept in the audit trail.');
    }
    const wasPublished = window.status === ExamWindowStatus.PUBLISHED;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.examWindowResult.updateMany({ where: { examWindowId: id }, data: { isPublished: false, publishedAt: null } });
      await tx.mark.updateMany({ where: { assessment: { examWindowId: id } }, data: { isLocked: false } });
      await tx.assessment.updateMany({ where: { examWindowId: id }, data: { status: AssessmentStatus.OPEN } });
      await tx.examWindow.update({ where: { id }, data: { status: ExamWindowStatus.REOPENED } });
      await tx.resultEditRequest.create({
        data: {
          schoolId: window.schoolId,
          examWindowId: id,
          requestedById: user.id,
          requestedByRole: user.role,
          reason: reason.trim(),
          status: 'GRANTED',
          decidedById: user.id,
          decidedByRole: user.role,
          decidedAt: now,
          decisionNote: wasPublished ? 'Reopened by administrator (results unpublished)' : 'Reopened by administrator',
        },
      });
    });
    await this.rabbitMq.publish('exam.window.reopened', { examWindowId: id, reopenedById: user.id, schoolId: window.schoolId });
    await this.redis.delByPattern(`exam-window:*:${id}`);
    return { reopened: true, wasPublished };
  }

  /** One step after corrections: validate + recalculate + close, then publish again. */
  async republish(id: string, user: RequestUser) {
    const window = await this.getWindowOrThrow(id, user);
    let closed: Awaited<ReturnType<ExamWindowsService['close']>> | null = null;
    if (window.status === ExamWindowStatus.OPEN || window.status === ExamWindowStatus.REOPENED) {
      closed = await this.close(id, user);
    }
    const published = await this.publish(id, user);
    return { republished: true, closed, published };
  }
}
