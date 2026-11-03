import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ExamWindowStatus } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';
import { AuthClientService } from '../auth-client/auth-client.service';
import { RedisService } from '../redis/redis.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, requireWriteSchoolId, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { ExamWindowsService } from './exam-windows.service';
import { OmitSubjectDto } from './dto/omit-subject.dto';
import { matchExclusion } from './engine/subject-exclusions';

type SubjectState = 'INCLUDED' | 'OMITTED' | 'NOT_ADDED';

/**
 * "What will this exam contain, and who teaches it?" — the admin's view of an exam window before and
 * after it opens — plus the controls to leave a subject out for the whole window or for chosen classes,
 * or school-wide for every window opened from then on.
 */
@Injectable()
export class ExamWindowSubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly windows: ExamWindowsService,
    private readonly studentClient: StudentClientService,
    private readonly authClient: AuthClientService,
    private readonly redis: RedisService,
  ) {}

  private headers(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private async classMeta(academicYearId: string, user: RequestUser) {
    const payload: any = await this.studentClient.get<unknown>('/students/classes', { academicYearId, limit: 1000 }, this.headers(user));
    const rows: any[] = Array.isArray(payload) ? payload : payload?.data ?? payload?.items ?? payload?.classes ?? [];
    return new Map(rows.map((c) => [String(c.id), c]));
  }

  private label(c: any): string {
    return c ? `${c.name ?? ''}${c.stream ? ` ${c.stream}` : ''}`.trim() : 'Class';
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  async plan(id: string, user: RequestUser) {
    const window = await this.windows.getWindow(id, user);
    const classes = await this.windows.resolveScopeClasses(window, user);
    const classIds = classes.map((c) => c.id);
    const meta = await this.classMeta(window.academicYearId, user);

    const classSubjects = classIds.length
      ? await this.prisma.classSubject.findMany({
          where: { academicYearId: window.academicYearId, isActive: true, classId: { in: classIds } },
          include: { subject: true, combination: true },
        })
      : [];
    const assessments = await this.prisma.assessment.findMany({
      where: { examWindowId: id },
      select: { id: true, classSubjectId: true, status: true, maxScore: true, _count: { select: { marks: true } } },
    });
    const assessmentByCs = new Map(assessments.map((a) => [a.classSubjectId, a]));
    const rules = await this.prisma.examSubjectExclusion.findMany({
      where: { OR: [{ examWindowId: id }, { examWindowId: null, schoolId: window.schoolId }] },
      orderBy: { createdAt: 'asc' },
    });
    const names = await this.authClient.getUserNames([...classSubjects.map((cs) => cs.teacherId), ...rules.map((r) => r.createdById)]);
    const opened = window.openedAt != null || assessments.length > 0;

    const warnings: string[] = [];
    const bySubject = new Map<string, { subjectId: string; subjectName: string; classes: number; included: number; omitted: number; notAdded: number }>();
    const classRows = classes
      .map((c) => {
        const own = classSubjects.filter((cs) => cs.classId === c.id).sort((a, b) => a.subject.name.localeCompare(b.subject.name));
        const subjects = own.map((cs) => {
          const a = assessmentByCs.get(cs.id);
          const hit = matchExclusion(rules, cs.subjectId, cs.classId, { windowOpened: opened });
          const state: SubjectState = hit ? 'OMITTED' : a ? 'INCLUDED' : opened ? 'NOT_ADDED' : 'INCLUDED';
          const teacherName = names.get(cs.teacherId) ?? null;
          const itemWarnings: string[] = [];
          if (!teacherName && state !== 'OMITTED') itemWarnings.push('No teacher could be found for this subject');
          const agg = bySubject.get(cs.subjectId) ?? { subjectId: cs.subjectId, subjectName: cs.subject.name, classes: 0, included: 0, omitted: 0, notAdded: 0 };
          agg.classes += 1;
          if (state === 'OMITTED') agg.omitted += 1; else if (state === 'NOT_ADDED') agg.notAdded += 1; else agg.included += 1;
          bySubject.set(cs.subjectId, agg);
          return {
            classSubjectId: cs.id,
            subjectId: cs.subjectId,
            subjectName: cs.subject.name,
            subjectCode: cs.subject.code,
            isOptional: cs.subject.isCompulsory === false,
            combination: cs.combination?.code ?? null,
            teacherId: cs.teacherId,
            teacherName,
            state,
            assessmentId: a?.id ?? null,
            assessmentStatus: a?.status ?? null,
            marksEntered: a?._count.marks ?? 0,
            exclusion: hit
              ? { id: hit.row.id, source: hit.source, scope: hit.row.classId ? 'CLASS' : 'ALL_CLASSES', reason: hit.row.reason, createdAt: hit.row.createdAt, createdByName: names.get(hit.row.createdById) ?? null }
              : null,
            warnings: itemWarnings,
          };
        });
        if (!own.length) warnings.push(`${this.label(meta.get(c.id) ?? c)} has no subjects assigned, so it will have no marks sheets.`);
        return { classId: c.id, label: this.label(meta.get(c.id) ?? c), level: c.level, stage: c.educationStage, studentCount: Number(meta.get(c.id)?.studentCount ?? 0), subjects };
      })
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.label.localeCompare(b.label));

    const standing = rules.filter((r) => r.examWindowId === null);
    const subjectNames = new Map(classSubjects.map((cs) => [cs.subjectId, cs.subject.name]));
    const all = classRows.flatMap((c) => c.subjects);
    return {
      window: { id: window.id, name: window.name, status: window.status, opened, scopeType: window.scopeType },
      summary: {
        classes: classRows.length,
        subjects: bySubject.size,
        marksSheets: all.filter((s) => s.state === 'INCLUDED').length,
        omitted: all.filter((s) => s.state === 'OMITTED').length,
        notAdded: all.filter((s) => s.state === 'NOT_ADDED').length,
        withoutTeacher: all.filter((s) => s.state !== 'OMITTED' && !s.teacherName).length,
        teachers: new Set(all.filter((s) => s.state !== 'OMITTED').map((s) => s.teacherId)).size,
      },
      /** Whether subjects can still be omitted / restored. */
      editable: ([ExamWindowStatus.DRAFT, ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status),
      classes: classRows,
      subjects: [...bySubject.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
      standingRules: standing.map((r) => ({
        id: r.id,
        subjectId: r.subjectId,
        subjectName: subjectNames.get(r.subjectId) ?? null,
        classId: r.classId,
        className: r.classId ? this.label(meta.get(r.classId)) : null,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      warnings,
    };
  }

  // ── Omit / restore ─────────────────────────────────────────────────────────

  async omit(id: string, dto: OmitSubjectDto, user: RequestUser) {
    const window = await this.windows.getWindow(id, user);
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(
        window.status === ExamWindowStatus.PUBLISHED || window.status === ExamWindowStatus.CLOSED
          ? `Results for this window are already calculated. Reopen it for corrections before leaving a subject out (status ${window.status}).`
          : `Subjects cannot be changed on a ${window.status} window.`,
      );
    }
    const reason = dto.reason.trim();
    if (reason.length < 3) throw new BadRequestException('Give a short reason. It is kept in the audit trail.');

    const inScope = await this.windows.resolveScopeClasses(window, user);
    const scopeIds = new Set(inScope.map((c) => c.id));
    const targets = [...new Set(dto.classIds ?? [])];
    for (const cid of targets) {
      if (!scopeIds.has(cid)) throw new BadRequestException('One of the chosen classes is not part of this exam window.');
    }
    const classWhere = targets.length ? { in: targets } : { in: [...scopeIds] };

    const taught = await this.prisma.classSubject.findMany({
      where: { academicYearId: window.academicYearId, isActive: true, subjectId: dto.subjectId, classId: classWhere },
      select: { id: true, classId: true },
    });
    if (!taught.length) throw new BadRequestException('That subject is not taught in the chosen classes, so there is nothing to omit.');
    const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId }, select: { name: true } });

    const existing = await this.prisma.examSubjectExclusion.findMany({ where: { examWindowId: id, subjectId: dto.subjectId } });
    if (existing.some((e) => e.classId === null)) {
      throw new ConflictException(`${subject?.name ?? 'This subject'} is already left out of every class in this window.`);
    }
    const alreadyClasses = new Set(existing.map((e) => e.classId));
    const newTargets = targets.length ? targets.filter((c) => !alreadyClasses.has(c)) : [];
    if (targets.length && !newTargets.length) {
      throw new ConflictException(`${subject?.name ?? 'This subject'} is already left out of the chosen classes.`);
    }

    // Marks sheets that already exist for the chosen classes go away with the subject; refuse to lose marks silently.
    const sheets = await this.prisma.assessment.findMany({
      where: { examWindowId: id, subjectId: dto.subjectId, classId: targets.length ? { in: newTargets } : undefined },
      select: { id: true, classId: true, _count: { select: { marks: true } } },
    });
    const marksAtStake = sheets.reduce((t, a) => t + a._count.marks, 0);
    if (marksAtStake > 0 && !dto.discardMarks) {
      const meta = await this.classMeta(window.academicYearId, user);
      const detail = sheets.filter((a) => a._count.marks > 0).map((a) => `${this.label(meta.get(a.classId))}: ${a._count.marks}`).join(', ');
      throw new ConflictException(`${marksAtStake} mark(s) have already been entered for ${subject?.name ?? 'this subject'} (${detail}). Confirm to discard them, or keep the subject.`);
    }

    const schoolId = window.schoolId ?? requireWriteSchoolId(user, 'exam subject omission');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (!targets.length && existing.length) {
        // "All classes" supersedes any class-specific omissions made earlier.
        await tx.examSubjectExclusion.deleteMany({ where: { examWindowId: id, subjectId: dto.subjectId } });
      }
      await tx.assessment.deleteMany({ where: { id: { in: sheets.map((a) => a.id) } } });
      const rows = targets.length ? newTargets : [null];
      for (const classId of rows) {
        await tx.examSubjectExclusion.create({
          data: { schoolId, examWindowId: id, subjectId: dto.subjectId, classId, reason, createdById: user.id, discardedMarks: classId ? sheets.filter((a) => a.classId === classId).reduce((t, a) => t + a._count.marks, 0) : marksAtStake },
        });
        if (dto.applyToAllWindows) {
          const dup = await tx.examSubjectExclusion.findFirst({ where: { examWindowId: null, schoolId, subjectId: dto.subjectId, classId } });
          if (!dup) await tx.examSubjectExclusion.create({ data: { schoolId, examWindowId: null, subjectId: dto.subjectId, classId, reason, createdById: user.id } });
        }
      }
      await tx.examWindow.update({ where: { id }, data: { subjectsChangedAt: now } });
      await tx.academicAuditLog.create({
        data: {
          schoolId,
          action: 'EXAM_SUBJECT_OMITTED',
          performedById: user.id,
          payload: { examWindowId: id, subjectId: dto.subjectId, classIds: targets, reason, discardedMarks: marksAtStake, standingRule: !!dto.applyToAllWindows },
        },
      });
    });
    await this.redis.delByPattern(`exam-window:*:${id}`);
    return { omitted: true, subject: subject?.name ?? null, classes: targets.length || 'all', sheetsRemoved: sheets.length, marksDiscarded: marksAtStake, standingRule: !!dto.applyToAllWindows };
  }

  async restore(id: string, exclusionId: string, user: RequestUser) {
    const window = await this.windows.getWindow(id, user);
    if (!([ExamWindowStatus.DRAFT, ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(window.status)) {
      throw new BadRequestException(`Subjects cannot be changed on a ${window.status} window. Reopen it first.`);
    }
    const row = await this.prisma.examSubjectExclusion.findUnique({ where: { id: exclusionId } });
    if (!row || row.examWindowId !== id) throw new NotFoundException('That omission does not belong to this exam window.');

    await this.prisma.$transaction(async (tx) => {
      await tx.examSubjectExclusion.delete({ where: { id: exclusionId } });
      await tx.examWindow.update({ where: { id }, data: { subjectsChangedAt: new Date() } });
      await tx.academicAuditLog.create({
        data: { schoolId: window.schoolId, action: 'EXAM_SUBJECT_RESTORED', performedById: user.id, payload: { examWindowId: id, subjectId: row.subjectId, classId: row.classId } },
      });
    });
    // Once teachers have sheets, bring the restored subject back with its marks sheets right away.
    let sheetsAdded = 0;
    if (window.status !== ExamWindowStatus.DRAFT) sheetsAdded = (await this.windows.syncSubjects(id, user)).assessmentsCreated;
    return { restored: true, sheetsAdded };
  }

  // ── School-wide (standing) rules ───────────────────────────────────────────

  async listStanding(user: RequestUser) {
    const rows = await this.prisma.examSubjectExclusion.findMany({
      where: { examWindowId: null, ...schoolScopeFilter(user) },
      orderBy: { createdAt: 'desc' },
    });
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.subjectId))] } }, select: { id: true, name: true } });
    const sn = new Map(subjects.map((s) => [s.id, s.name]));
    return rows.map((r) => ({ id: r.id, schoolId: r.schoolId, subjectId: r.subjectId, subjectName: sn.get(r.subjectId) ?? null, classId: r.classId, reason: r.reason, createdAt: r.createdAt }));
  }

  async removeStanding(ruleId: string, user: RequestUser) {
    const row = await this.prisma.examSubjectExclusion.findUnique({ where: { id: ruleId } });
    if (!row || row.examWindowId !== null) throw new NotFoundException('School-wide rule not found.');
    assertSchoolInScope(user, row.schoolId ?? null);
    await this.prisma.examSubjectExclusion.delete({ where: { id: ruleId } });
    await this.prisma.academicAuditLog.create({ data: { schoolId: row.schoolId, action: 'EXAM_SUBJECT_RULE_REMOVED', performedById: user.id, payload: { subjectId: row.subjectId, classId: row.classId } } });
    return { removed: true };
  }
}
