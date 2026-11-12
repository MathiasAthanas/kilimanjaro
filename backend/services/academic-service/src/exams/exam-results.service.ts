import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExamWindowStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { ROLES } from '../common/constants/roles';
import { GradingResolverService } from './grading-resolver.service';
import { CalcContext, CalcStudentRow, ResultCalculatorService } from './result-calculator.service';
import { SubjectOutcome } from './engine/result-engine';

type SubjectScore = SubjectOutcome;

@Injectable()
export class ExamResultsService {
  private readonly logger = new Logger(ExamResultsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly studentClient: StudentClientService,
    private readonly grading: GradingResolverService,
    private readonly calculator: ResultCalculatorService,
  ) {}

  private unwrap<T>(payload: any): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const p = payload as Record<string, unknown> | null;
    if (!p) return [];
    const inner = (p.data ?? p) as Record<string, unknown>;
    if (Array.isArray(inner)) return inner as T[];
    for (const c of [inner?.items, inner?.classes, inner?.students]) {
      if (Array.isArray(c)) return c as T[];
    }
    return [];
  }

  private studentServiceHeaders(user?: RequestUser): Record<string, string> {
    if (!user) return {};
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private round(n: number, dp = 2): number {
    const f = Math.pow(10, dp);
    return Math.round(n * f) / f;
  }

  private studentName(s: any): string {
    return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(' ').trim();
  }

  /**
   * Validate + calculate a window WITHOUT writing anything. Throws a structured
   * error when a grading scale is missing or any expected subject result is
   * MISSING (blocks closing / calculation until resolved).
   */
  async calculate(windowId: string, user?: RequestUser): Promise<CalcContext> {
    const ctx = await this.calculator.build(windowId, user);
    this.calculator.assertCalculable(ctx);
    await this.applyPreviousWindowDelta(ctx.window, ctx.rows);
    return ctx;
  }

  /** Upsert merit rows for a calculated window. Pass a transaction client to make it atomic with the caller. */
  async persist(client: Prisma.TransactionClient, ctx: CalcContext, now = new Date()): Promise<void> {
    const windowId = ctx.window.id as string;
    for (const r of ctx.rows) {
      const dv = r.summary.division;
      const data = {
        className: r.className,
        stream: r.stream,
        classLevel: r.classLevel,
        educationStage: r.educationStage as any,
        registrationNumber: r.registrationNumber,
        studentName: r.studentName,
        gender: r.gender,
        subjectScores: r.subjectScores as unknown as Prisma.InputJsonValue,
        subjectCount: r.summary.subjectsAssessed,
        subjectsExpected: r.summary.subjectsExpected,
        subjectsAssessed: r.summary.subjectsAssessed,
        division: dv.division ?? dv.descriptor,
        divisionPoints: dv.totalPoints,
        divisionNote: dv.note ?? dv.descriptor,
        total: r.summary.total,
        mean: r.summary.mean,
        meanPoints: r.summary.meanPoints,
        overallGrade: r.overall.grade,
        overallPoints: r.overall.points,
        overallRemark: r.overall.remark,
        isPassing: r.overall.isPassing,
        classMeanDev: r.classMeanDev,
        standardMeanDev: r.standardMeanDev,
        prevWindowMean: r.prevWindowMean,
        prevWindowDelta: r.prevWindowDelta,
        streamRank: r.streamRank,
        streamTotal: r.streamTotal,
        standardRank: r.standardRank,
        standardTotal: r.standardTotal,
        computedAt: now,
      };
      await client.examWindowResult.upsert({
        where: { examWindowId_studentId: { examWindowId: windowId, studentId: r.studentId } },
        create: { schoolId: ctx.window.schoolId, examWindowId: windowId, studentId: r.studentId, classId: r.classId, ...data },
        update: data,
      });
    }
    // Students no longer on the roster (moved/withdrawn) must not linger on the merit list.
    await client.examWindowResult.deleteMany({
      where: { examWindowId: windowId, studentId: { notIn: ctx.rows.map((r) => r.studentId) } },
    });
    await client.examWindow.update({ where: { id: windowId }, data: { computedAt: now } });
  }

  /**
   * Explicit recomputation of a closed window's merit list (the ONLY way existing
   * results change after the additive migration). Published windows must be
   * unpublished first so published results are never silently altered.
   */
  async compute(windowId: string, user?: RequestUser) {
    const window = await this.prisma.examWindow.findUnique({ where: { id: windowId } });
    if (!window) throw new NotFoundException('Exam window not found');
    if (user) assertSchoolInScope(user, window.schoolId ?? null);
    if (window.status === ExamWindowStatus.PUBLISHED) {
      throw new BadRequestException('This window is published. Unpublish it (or have an edit request approved) before recalculating.');
    }
    if (window.status === ExamWindowStatus.DRAFT) {
      throw new BadRequestException('Open the window and enter marks before calculating results.');
    }

    const ctx = await this.calculate(windowId, user);
    const now = new Date();
    await this.prisma.$transaction((tx) => this.persist(tx, ctx, now), { timeout: 120000, maxWait: 20000 });
    return this.afterCompute(ctx, now);
  }

  async afterCompute(ctx: CalcContext, now: Date) {
    const windowId = ctx.window.id as string;
    await this.redis.delByPattern(`exam-window:meritlist:${windowId}`);
    await this.rabbitMq.publish('exam.results.computed', {
      examWindowId: windowId,
      termId: ctx.window.termId,
      academicYearId: ctx.window.academicYearId,
      studentsRanked: ctx.rows.length,
      classes: ctx.classIds.length,
      schoolId: ctx.window.schoolId,
    });
    const standards = new Set(ctx.rows.filter((r) => r.classLevel !== null).map((r) => `${r.educationStage}::${r.classLevel}`));
    return {
      computed: ctx.rows.length,
      classes: ctx.classIds.length,
      standards: standards.size,
      exemptSubjects: ctx.rows.reduce((n, r) => n + r.summary.exemptCount, 0),
      ungraded: ctx.rows.filter((r) => !r.summary.division.eligible).length,
      computedAt: now,
    };
  }

  /**
   * Student-by-subject readiness matrix for a window: every expected subject has
   * exactly one status (SCORED / ABSENT / NOT_SAT / MISSING / EXEMPT). Anything
   * MISSING (or a missing grading scale) blocks closing and calculation.
   */
  async readiness(windowId: string, user: RequestUser) {
    const ctx = await this.calculator.build(windowId, user);
    const counts = { students: ctx.rows.length, expected: 0, scored: 0, absent: 0, notSat: 0, missing: 0, exempt: 0 };
    const subjectCols = new Map<string, { subjectId: string; subjectName: string; code: string }>();
    for (const r of ctx.rows) {
      for (const o of r.outcomes) {
        counts.expected += 1;
        if (o.status === 'SCORED') counts.scored += 1;
        else if (o.status === 'ABSENT') counts.absent += 1;
        else if (o.status === 'NOT_SAT') counts.notSat += 1;
        else if (o.status === 'MISSING') counts.missing += 1;
        else counts.exempt += 1;
        if (!subjectCols.has(o.subjectId)) subjectCols.set(o.subjectId, { subjectId: o.subjectId, subjectName: o.subjectName, code: o.code });
      }
    }

    const blockers: Array<{ code: string; message: string }> = [];
    for (const issue of ctx.scaleIssues) blockers.push({ code: 'GRADING_SCALE_MISSING', message: issue.message });
    if (ctx.combinationIssues.length) {
      const e = this.calculator.combinationError(ctx.combinationIssues);
      blockers.push({ code: 'A_LEVEL_COMBINATION_MISSING', message: String((e.getResponse() as any).message) });
    }
    if (ctx.missing.length) {
      const e = this.calculator.incompleteError(ctx.missing);
      blockers.push({ code: 'RESULTS_INCOMPLETE', message: String((e.getResponse() as any).message) });
    }
    const closable = ([ExamWindowStatus.OPEN, ExamWindowStatus.REOPENED] as ExamWindowStatus[]).includes(ctx.window.status);

    const classes = ctx.classIds.map((classId) => {
      const group = ctx.rows.filter((r) => r.classId === classId);
      return {
        classId,
        className: group[0]?.className ?? classId,
        students: group
          .sort((a, b) => (a.registrationNumber ?? '').localeCompare(b.registrationNumber ?? ''))
          .map((r) => ({
            studentId: r.studentId,
            studentName: r.studentName,
            registrationNumber: r.registrationNumber,
            subjectsExpected: r.summary.subjectsExpected,
            subjectsAssessed: r.summary.subjectsAssessed,
            mean: r.summary.mean,
            division: r.summary.division.division ?? r.summary.division.descriptor,
            divisionPoints: r.summary.division.totalPoints,
            divisionEligible: r.summary.division.eligible,
            warnings: r.warnings,
            cells: Object.fromEntries(
              r.outcomes.map((o) => [
                o.subjectId,
                {
                  status: o.status,
                  score: o.status === 'MISSING' ? null : o.score,
                  maxScore: o.maxScore,
                  percentage: o.percentage,
                  grade: o.grade,
                  countsTowardAggregate: o.countsTowardAggregate !== false,
                  exemptReason: o.exemptReason ?? null,
                },
              ]),
            ),
          })),
      };
    });

    return {
      window: { id: ctx.window.id, name: ctx.window.name, status: ctx.window.status, termId: ctx.window.termId, academicYearId: ctx.window.academicYearId, computedAt: ctx.window.computedAt },
      ready: blockers.length === 0,
      canClose: blockers.length === 0 && closable,
      blockers,
      counts,
      scaleIssues: ctx.scaleIssues,
      combinationIssues: ctx.combinationIssues,
      warnings: ctx.warnings,
      subjects: [...subjectCols.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
      missing: ctx.missing.slice(0, 1000),
      classes,
    };
  }

  private async applyPreviousWindowDelta(
    window: { id: string; schoolId: string | null; academicYearId: string; termId: string; createdAt: Date },
    rows: CalcStudentRow[],
  ): Promise<void> {
    try {
      const candidates = await this.prisma.examWindow.findMany({
        where: {
          id: { not: window.id },
          academicYearId: window.academicYearId,
          termId: window.termId,
          schoolId: window.schoolId,
          createdAt: { lte: window.createdAt },
          status: { in: [ExamWindowStatus.CLOSED, ExamWindowStatus.PUBLISHED, ExamWindowStatus.REOPENED] },
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!candidates.length) return;
      const candidateIds = candidates.map((c) => c.id);
      const order = new Map(candidateIds.map((id, i) => [id, i])); // 0 = most recent

      const studentIds = rows.map((r) => r.studentId);
      const prior = await this.prisma.examWindowResult.findMany({
        where: { examWindowId: { in: candidateIds }, studentId: { in: studentIds } },
        select: { examWindowId: true, studentId: true, mean: true },
      });

      // Pick, per student, the mean from the most-recent prior window they appear in.
      const bestByStudent = new Map<string, { rank: number; mean: number }>();
      for (const p of prior) {
        const rank = order.get(p.examWindowId) ?? Number.MAX_SAFE_INTEGER;
        const cur = bestByStudent.get(p.studentId);
        if (!cur || rank < cur.rank) {
          bestByStudent.set(p.studentId, { rank, mean: p.mean });
        }
      }

      for (const r of rows) {
        const prev = bestByStudent.get(r.studentId);
        if (prev) {
          r.prevWindowMean = this.round(prev.mean);
          r.prevWindowDelta = this.round(r.summary.mean - prev.mean);
        }
      }
    } catch (err) {
      this.logger.warn(`Previous-window delta computation skipped: ${(err as Error)?.message ?? err}`);
    }
  }

  /**
   * The merit list for a window: ranked rows + the subject columns + the
   * grade-summary breakdowns (per stream, per subject, by gender) — mirrors the
   * two-sheet Excel export the school uses.
   */
  async getMeritList(windowId: string, user: RequestUser, filter?: { classId?: string; level?: number }) {
    const window = await this.prisma.examWindow.findUnique({ where: { id: windowId }, include: { examType: true } });
    if (!window) throw new NotFoundException('Exam window not found');
    assertSchoolInScope(user, window.schoolId ?? null);

    const where: Prisma.ExamWindowResultWhereInput = {
      examWindowId: windowId,
      classId: filter?.classId,
      classLevel: filter?.level,
    };
    // Students/parents only see published merit rows for their own records.
    if (user.role === ROLES.STUDENT || user.role === ROLES.PARENT) {
      where.isPublished = true;
    }

    const results = await this.prisma.examWindowResult.findMany({
      where,
      orderBy: [{ classLevel: 'asc' }, { standardRank: 'asc' }, { total: 'desc' }],
    });

    if (!results.length) {
      return {
        window: this.windowSummary(window),
        subjects: [],
        rows: [],
        summaries: { overall: null, byStream: [], bySubject: [], byGender: [] },
      };
    }

    // Resolve combinations at read time too, so previously published A-Level
    // merit rows gain their current assigned code without changing marks.
    const aLevelRows = results.filter((row) => row.educationStage === 'A_LEVEL');
    const combinationByStudentClass = new Map<string, string>();
    const combinationByClass = new Map<string, string>();
    if (aLevelRows.length) {
      const studentIds = [...new Set(aLevelRows.map((row) => row.studentId))];
      const classIds = [...new Set(aLevelRows.map((row) => row.classId))];
      const [enrolments, classSubjects] = await Promise.all([
        this.prisma.studentSubjectEnrollment.findMany({
          where: {
            studentId: { in: studentIds },
            academicYearId: window.academicYearId,
            isActive: true,
            combinationId: { not: null },
            OR: [{ termId: null }, { termId: window.termId }],
          },
          select: { studentId: true, classId: true, combination: { select: { code: true } } },
        }),
        this.prisma.classSubject.findMany({
          where: {
            classId: { in: classIds },
            academicYearId: window.academicYearId,
            isActive: true,
            combinationId: { not: null },
          },
          select: { classId: true, combination: { select: { code: true } } },
        }),
      ]);
      const codesByStudentClass = new Map<string, Set<string>>();
      for (const enrolment of enrolments) {
        if (!enrolment.combination?.code) continue;
        const key = `${enrolment.studentId}:${enrolment.classId}`;
        if (!codesByStudentClass.has(key)) codesByStudentClass.set(key, new Set());
        codesByStudentClass.get(key)!.add(enrolment.combination.code);
      }
      for (const [key, codes] of codesByStudentClass) {
        if (codes.size === 1) combinationByStudentClass.set(key, [...codes][0]);
      }
      const codesByClass = new Map<string, Set<string>>();
      for (const subject of classSubjects) {
        if (!subject.combination?.code) continue;
        if (!codesByClass.has(subject.classId)) codesByClass.set(subject.classId, new Set());
        codesByClass.get(subject.classId)!.add(subject.combination.code);
      }
      for (const [classId, codes] of codesByClass) {
        if (codes.size === 1) combinationByClass.set(classId, [...codes][0]);
      }
    }
    const displayRows = results.map((row) => ({
      ...row,
      combinationCode: row.educationStage === 'A_LEVEL'
        ? combinationByStudentClass.get(`${row.studentId}:${row.classId}`) ?? combinationByClass.get(row.classId) ?? null
        : null,
    }));

    // Subject columns (union across rows, ordered by subject name).
    const subjectCols = new Map<string, { subjectId: string; subjectName: string; code: string }>();
    for (const r of results) {
      const scores = r.subjectScores as unknown as Record<string, SubjectScore>;
      for (const key of Object.keys(scores ?? {})) {
        const s = scores[key];
        if (!subjectCols.has(s.subjectId)) {
          subjectCols.set(s.subjectId, { subjectId: s.subjectId, subjectName: s.subjectName, code: s.code });
        }
      }
    }
    const subjects = [...subjectCols.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));

    const gradeCodes = this.deriveGradeCodes(results);
    const summaries = this.buildSummaries(results, subjects, gradeCodes);

    return {
      window: this.windowSummary(window),
      subjects,
      gradeCodes,
      rows: displayRows,
      summaries,
    };
  }

  private windowSummary(window: any) {
    return {
      id: window.id,
      name: window.name,
      status: window.status,
      examType: window.examType ? { id: window.examType.id, name: window.examType.name, code: window.examType.code } : null,
      termId: window.termId,
      academicYearId: window.academicYearId,
      maxScore: window.maxScore,
      computedAt: window.computedAt,
      publishedAt: window.publishedAt,
    };
  }

  private deriveGradeCodes(results: any[]): string[] {
    const seen = new Set<string>();
    for (const r of results) {
      if (r.overallGrade && r.overallGrade !== '-') seen.add(r.overallGrade);
      const scores = r.subjectScores as Record<string, SubjectScore>;
      for (const key of Object.keys(scores ?? {})) {
        const sc = scores[key];
        if (sc.status === 'EXEMPT' || sc.status === 'MISSING' || !sc.grade) continue;
        seen.add(sc.grade);
      }
    }
    // Prefer the conventional order A,B,C,D,E,F then specials.
    const order = ['A', 'B', 'C', 'D', 'E', 'F', 'S', 'X', 'Y'];
    const ordered = order.filter((g) => seen.has(g));
    const extras = [...seen].filter((g) => !order.includes(g)).sort();
    return [...ordered, ...extras];
  }

  private distribution(grades: string[], codes: string[]): Record<string, number> {
    const dist: Record<string, number> = {};
    for (const c of codes) dist[c] = 0;
    for (const g of grades) dist[g] = (dist[g] ?? 0) + 1;
    return dist;
  }

  private buildSummaries(results: any[], subjects: { subjectId: string; subjectName: string }[], codes: string[]) {
    const round = (n: number) => this.round(n, 1);
    const stats = (values: number[]) => ({
      highestMarks: values.length ? round(Math.max(...values)) : 0,
      lowestMarks: values.length ? round(Math.min(...values)) : 0,
    });
    const passRate = (passing: number, entries: number) => round((passing / Math.max(entries, 1)) * 100);
    const divisionDistribution = (rows: any[]) => {
      const dist: Record<string, number> = {
        'Division I': 0,
        'Division II': 0,
        'Division III': 0,
        'Division IV': 0,
        'Division 0': 0,
        Ungraded: 0,
      };
      for (const row of rows) {
        if (!['O_LEVEL', 'A_LEVEL'].includes(row.educationStage)) continue;
        const division = String(row.division ?? 'Ungraded');
        const key = Object.prototype.hasOwnProperty.call(dist, division) ? division : 'Ungraded';
        dist[key] += 1;
      }
      return dist;
    };

    // Per stream (class).
    const byClass = new Map<string, any[]>();
    for (const r of results) {
      const arr = byClass.get(r.classId) ?? [];
      arr.push(r);
      byClass.set(r.classId, arr);
    }
    const byStream = [...byClass.values()].map((group) => {
      const means = group.map((g) => g.mean);
      return {
        classId: group[0].classId,
        className: group[0].className,
        stream: group[0].stream,
        entries: group.length,
        meanMarks: round(means.reduce((s, m) => s + m, 0) / Math.max(means.length, 1)),
        ...stats(means),
        passRate: passRate(group.filter((g) => g.isPassing).length, group.length),
        distribution: this.distribution(group.map((g) => g.overallGrade).filter((g) => g && g !== '-'), codes),
        divisionDistribution: divisionDistribution(group),
        educationStage: group[0].educationStage,
      };
    });

    // Per subject (across all rows).
    const bySubject = subjects.map((subj) => {
      const grades: string[] = [];
      const percs: number[] = [];
      for (const r of results) {
        const s = (r.subjectScores as Record<string, SubjectScore>)?.[subj.subjectId];
        // Exempt / unresolved subjects never enter subject grade summaries or means.
        if (s && s.status !== 'EXEMPT' && s.status !== 'MISSING' && s.percentage !== null && s.percentage !== undefined) {
          grades.push(s.grade);
          percs.push(s.percentage);
        }
      }
      return {
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        entries: grades.length,
        meanMarks: round(percs.reduce((s, m) => s + m, 0) / Math.max(percs.length, 1)),
        ...stats(percs),
        passRate: passRate(
          results.filter((r) => {
            const score = (r.subjectScores as Record<string, SubjectScore>)?.[subj.subjectId];
            return score && score.status !== 'EXEMPT' && score.status !== 'MISSING' && score.isPassing;
          }).length,
          grades.length,
        ),
        distribution: this.distribution(grades, codes),
      };
    });

    // By gender.
    const byGenderMap = new Map<string, any[]>();
    for (const r of results) {
      const key = (r.gender ?? 'UNKNOWN').toString().toUpperCase();
      const arr = byGenderMap.get(key) ?? [];
      arr.push(r);
      byGenderMap.set(key, arr);
    }
    const byGender = [...byGenderMap.entries()].map(([gender, group]) => ({
      gender,
      entries: group.length,
      meanMarks: round(group.reduce((s, g) => s + g.mean, 0) / Math.max(group.length, 1)),
      ...stats(group.map((item) => item.mean)),
      passRate: passRate(group.filter((item) => item.isPassing).length, group.length),
      distribution: this.distribution(group.map((g) => g.overallGrade).filter((g) => g && g !== '-'), codes),
      divisionDistribution: divisionDistribution(group),
    }));

    const overallMeans = results.map((result) => result.mean);
    const overall = {
      entries: results.length,
      classes: byClass.size,
      meanMarks: round(overallMeans.reduce((sum, value) => sum + value, 0) / Math.max(overallMeans.length, 1)),
      ...stats(overallMeans),
      passRate: passRate(results.filter((result) => result.isPassing).length, results.length),
      distribution: this.distribution(results.map((result) => result.overallGrade).filter((grade) => grade && grade !== '-'), codes),
      divisionDistribution: divisionDistribution(results),
    };

    return { overall, byStream, bySubject, byGender };
  }

  /**
   * Emit the SAME downstream events the legacy results flow emits, so the exam
   * lifecycle feeds existing consumers unchanged:
   *  - `performance.snapshot.ready` per (student, subject) → student-service
   *    performance engine (`ingestSnapshot`) builds snapshots + alerts + pairings.
   *  - `results.published` + `academic.results.finalized` per class → analytics
   *    (KPI history, cache-bust, term-end auto reports) and the perf engine's
   *    attendance-correlation pass.
   * Called on exam-window publish. No-op-safe when RabbitMQ is down (events drop).
   */
  async emitDownstreamEvents(windowId: string): Promise<{ snapshots: number; classes: number }> {
    const window = await this.prisma.examWindow.findUnique({ where: { id: windowId } });
    if (!window) return { snapshots: 0, classes: 0 };

    const [results, assessments] = await Promise.all([
      this.prisma.examWindowResult.findMany({ where: { examWindowId: windowId } }),
      this.prisma.assessment.findMany({ where: { examWindowId: windowId }, include: { classSubject: { select: { teacherId: true } } } }),
    ]);
    if (!results.length) return { snapshots: 0, classes: 0 };

    const teacherByClassSubject = new Map<string, string>();
    for (const a of assessments) {
      teacherByClassSubject.set(`${a.classId}:${a.subjectId}`, a.classSubject.teacherId);
    }

    // Build per-subject snapshot rows and per-(class,subject) rank.
    interface Snap {
      studentId: string; subjectId: string; subjectName: string; classId: string;
      score: number; grade: string; breakdown: unknown; teacherId: string; rank?: number; totalStudentsInClass?: number;
    }
    const snaps: Snap[] = [];
    const classStudents = new Map<string, Set<string>>();
    for (const r of results) {
      if (!classStudents.has(r.classId)) classStudents.set(r.classId, new Set());
      classStudents.get(r.classId)!.add(r.studentId);
      const scores = r.subjectScores as unknown as Record<string, SubjectScore>;
      for (const key of Object.keys(scores ?? {})) {
        const s = scores[key];
        if (s.missing || s.status === 'EXEMPT' || s.status === 'MISSING' || s.percentage === null) continue;
        snaps.push({
          studentId: r.studentId,
          subjectId: s.subjectId,
          subjectName: s.subjectName,
          classId: r.classId,
          score: s.percentage,
          grade: s.grade,
          breakdown: { examWindowId: windowId, raw: s.score, maxScore: s.maxScore, percentage: s.percentage },
          teacherId: teacherByClassSubject.get(`${r.classId}:${s.subjectId}`) ?? '',
        });
      }
    }

    // Per-subject rank within class.
    const groups = new Map<string, Snap[]>();
    for (const s of snaps) {
      const k = `${s.classId}:${s.subjectId}`;
      const arr = groups.get(k) ?? [];
      arr.push(s);
      groups.set(k, arr);
    }
    for (const arr of groups.values()) {
      const sorted = [...arr].sort((a, b) => b.score - a.score);
      let prev: number | null = null;
      let prevRank = 0;
      sorted.forEach((s, i) => {
        let rank = i + 1;
        if (prev !== null && s.score === prev) rank = prevRank;
        s.rank = rank;
        s.totalStudentsInClass = arr.length;
        prevRank = rank;
        prev = s.score;
      });
    }

    for (const s of snaps) {
      await this.rabbitMq.publish('performance.snapshot.ready', {
        studentId: s.studentId,
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        classId: s.classId,
        termId: window.termId,
        academicYearId: window.academicYearId,
        score: s.score,
        grade: s.grade,
        assessmentBreakdown: s.breakdown,
        rank: s.rank,
        totalStudentsInClass: s.totalStudentsInClass,
        teacherId: s.teacherId,
        schoolId: window.schoolId,
      });
    }

    // Per-class results.published + academic.results.finalized (analytics + perf).
    for (const [classId, studentSet] of classStudents.entries()) {
      const classRows = results.filter((r) => r.classId === classId);
      const avg = classRows.reduce((sum, r) => sum + r.mean, 0) / Math.max(classRows.length, 1);
      const passRate = (classRows.filter((r) => r.isPassing).length / Math.max(classRows.length, 1)) * 100;
      await this.rabbitMq.publish('results.published', {
        classId,
        termId: window.termId,
        academicYearId: window.academicYearId,
        studentIds: [...studentSet],
        examWindowId: windowId,
        schoolId: window.schoolId,
      });
      await this.rabbitMq.publish('academic.results.finalized', {
        classId,
        termId: window.termId,
        academicYearId: window.academicYearId,
        examWindowId: windowId,
        value: Number(passRate.toFixed(2)),
        summary: {
          totalStudents: studentSet.size,
          averageScore: Number(avg.toFixed(2)),
          passRate: Number(passRate.toFixed(2)),
        },
        schoolId: window.schoolId,
      });
    }

    return { snapshots: snaps.length, classes: classStudents.size };
  }

  /** A single student's merit row across a window (used by student/parent views). */
  async studentResult(windowId: string, studentId: string, user: RequestUser) {
    const window = await this.prisma.examWindow.findUnique({ where: { id: windowId } });
    if (!window) throw new NotFoundException('Exam window not found');
    assertSchoolInScope(user, window.schoolId ?? null);

    const row = await this.prisma.examWindowResult.findUnique({
      where: { examWindowId_studentId: { examWindowId: windowId, studentId } },
    });
    if (!row) throw new NotFoundException('No result for this student in this window');
    if ((user.role === ROLES.STUDENT || user.role === ROLES.PARENT) && !row.isPublished) {
      throw new NotFoundException('Results are not published yet');
    }
    return row;
  }

  /** List a student's published windows across a term (student/parent history). */
  async listStudentWindows(studentId: string, user: RequestUser, termId?: string) {
    const rows = await this.prisma.examWindowResult.findMany({
      where: {
        ...schoolScopeFilter(user),
        studentId,
        isPublished: true,
        examWindow: termId ? { termId } : undefined,
      },
      include: { examWindow: { include: { examType: true } } },
      orderBy: { computedAt: 'desc' },
    });
    return rows;
  }
}
