import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ExamWindowStatus, Prisma } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { ROLES } from '../common/constants/roles';
import { GradingResolverService, ResolvedGrade } from './grading-resolver.service';

interface SubjectScore {
  subjectId: string;
  subjectName: string;
  code: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  points: number;
  isAbsent: boolean;
  missing: boolean;
}

interface StudentRow {
  studentId: string;
  classId: string;
  className: string | null;
  stream: string | null;
  classLevel: number | null;
  educationStage: string;
  registrationNumber: string | null;
  studentName: string | null;
  gender: string | null;
  subjectScores: Record<string, SubjectScore>;
  subjectCount: number;
  total: number;
  mean: number;
  meanPoints: number;
  overall: ResolvedGrade;
  classMeanDev: number;
  standardMeanDev: number;
  prevWindowMean: number | null;
  prevWindowDelta: number | null;
  streamRank?: number;
  streamTotal?: number;
  standardRank?: number;
  standardTotal?: number;
}

@Injectable()
export class ExamResultsService {
  private readonly logger = new Logger(ExamResultsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
    private readonly studentClient: StudentClientService,
    private readonly grading: GradingResolverService,
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
   * Competition ranking (1,2,2,4…): ties share a rank, and the next rank skips.
   * Returns a map keyed by the row's key → rank, plus the group size.
   */
  private rank<T>(rows: T[], key: (r: T) => string, score: (r: T) => number): Record<string, number> {
    const sorted = [...rows].sort((a, b) => score(b) - score(a));
    const ranks: Record<string, number> = {};
    let prevScore: number | null = null;
    let prevRank = 0;
    sorted.forEach((row, index) => {
      let r = index + 1;
      if (prevScore !== null && score(row) === prevScore) {
        r = prevRank;
      }
      ranks[key(row)] = r;
      prevRank = r;
      prevScore = score(row);
    });
    return ranks;
  }

  /** Compute (or recompute) the merit list for a window and persist the rows. */
  async compute(windowId: string, user?: RequestUser) {
    const window = await this.prisma.examWindow.findUnique({ where: { id: windowId } });
    if (!window) throw new NotFoundException('Exam window not found');
    if (user) assertSchoolInScope(user, window.schoolId ?? null);

    const assessments = await this.prisma.assessment.findMany({
      where: { examWindowId: windowId },
      include: { classSubject: { include: { subject: true } } },
    });
    if (!assessments.length) {
      throw new BadRequestException('This window has no assessments to compute. Open the window first.');
    }

    const classIds = [...new Set(assessments.map((a) => a.classId))];

    // Class metadata (level / stream / name) from student-service.
    const classesPayload = await this.studentClient.get<unknown>(
      '/students/classes',
      { academicYearId: window.academicYearId, limit: 1000 },
      this.studentServiceHeaders(user),
    );
    const classMeta = new Map<string, { name: string; level: number | null; stream: string | null; educationStage: string | null }>();
    for (const c of this.unwrap<any>(classesPayload)) {
      classMeta.set(c.id, { name: c.name, level: c.level ?? null, stream: c.stream ?? null, educationStage: c.educationStage ?? null });
    }

    // Students per class.
    const studentMeta = new Map<string, { classId: string; registrationNumber: string | null; name: string; gender: string | null }>();
    const studentsByClass = new Map<string, string[]>();
    for (const classId of classIds) {
      const payload = await this.studentClient.get<unknown>(
        '/students',
        { classId, limit: 2000, page: 1 },
        this.studentServiceHeaders(user),
      );
      const list = this.unwrap<any>(payload);
      const ids: string[] = [];
      for (const s of list) {
        studentMeta.set(s.id, {
          classId,
          registrationNumber: s.registrationNumber ?? null,
          name: this.studentName(s),
          gender: s.gender ?? null,
        });
        ids.push(s.id);
      }
      studentsByClass.set(classId, ids);
    }

    // Marks for every assessment in the window.
    const marks = await this.prisma.mark.findMany({
      where: { assessmentId: { in: assessments.map((a) => a.id) } },
      select: { assessmentId: true, studentId: true, score: true, isAbsent: true },
    });
    const marksByAssessment = new Map<string, Map<string, { score: number; isAbsent: boolean }>>();
    for (const m of marks) {
      let inner = marksByAssessment.get(m.assessmentId);
      if (!inner) {
        inner = new Map();
        marksByAssessment.set(m.assessmentId, inner);
      }
      inner.set(m.studentId, { score: m.score, isAbsent: m.isAbsent });
    }

    // Assessments grouped by class → the subject columns for that class.
    const assessmentsByClass = new Map<string, typeof assessments>();
    for (const a of assessments) {
      const arr = assessmentsByClass.get(a.classId) ?? [];
      arr.push(a);
      assessmentsByClass.set(a.classId, arr as any);
    }

    // Lazy grading-scale cache keyed by stage:level:subject.
    const scaleCache = new Map<string, any>();
    const scaleFor = async (stage: string | null, level: number | null, subjectId: string | null) => {
      const key = `${stage}:${level}:${subjectId}`;
      if (scaleCache.has(key)) return scaleCache.get(key);
      const scale = await this.grading.getActiveScale(
        window.academicYearId,
        { educationStage: stage, classLevel: level, subjectId },
        window.schoolId ?? null,
      );
      scaleCache.set(key, scale);
      return scale;
    };

    // ── Build one row per student ─────────────────────────────────────────
    const rows: StudentRow[] = [];
    for (const classId of classIds) {
      const meta = classMeta.get(classId) ?? { name: null as any, level: null, stream: null, educationStage: null };
      const classAssessments = assessmentsByClass.get(classId) ?? ([] as any);
      const studentIds = studentsByClass.get(classId) ?? [];

      for (const studentId of studentIds) {
        const sMeta = studentMeta.get(studentId)!;
        const subjectScores: Record<string, SubjectScore> = {};
        let total = 0;
        let pointsSum = 0;
        let subjectCount = 0;

        for (const a of classAssessments) {
          const mark = marksByAssessment.get(a.id)?.get(studentId);
          const maxScore = a.maxScore || window.maxScore || 100;
          const missing = !mark;
          const isAbsent = mark?.isAbsent ?? false;
          const score = mark && !isAbsent ? mark.score : 0;
          const percentage = maxScore > 0 ? this.round((score / maxScore) * 100) : 0;
          const subjScale = await scaleFor(a.educationStage, a.classLevel ?? meta.level, a.subjectId);
          const resolved: ResolvedGrade =
            isAbsent || missing
              ? { grade: 'X', points: 0, remark: isAbsent ? 'Absent' : 'No mark', isPassing: false }
              : this.grading.resolveGrade(subjScale, percentage);

          subjectScores[a.subjectId] = {
            subjectId: a.subjectId,
            subjectName: a.classSubject.subject.name,
            code: a.classSubject.subject.code,
            score,
            maxScore,
            percentage,
            grade: resolved.grade,
            points: resolved.points,
            isAbsent,
            missing,
          };
          total += score;
          pointsSum += resolved.points;
          subjectCount += 1;
        }

        const mean = subjectCount ? this.round(total / subjectCount) : 0;
        const meanPoints = subjectCount ? this.round(pointsSum / subjectCount) : 0;
        const overallScale = await scaleFor(meta.educationStage ?? window.educationStage, meta.level, null);
        const overall = this.grading.resolveGrade(overallScale, mean);

        rows.push({
          studentId,
          classId,
          className: meta.name,
          stream: meta.stream,
          classLevel: meta.level,
          educationStage: meta.educationStage ?? window.educationStage ?? 'PRIMARY',
          registrationNumber: sMeta.registrationNumber,
          studentName: sMeta.name,
          gender: sMeta.gender,
          subjectScores,
          subjectCount,
          total: this.round(total),
          mean,
          meanPoints,
          overall,
          classMeanDev: 0,
          standardMeanDev: 0,
          prevWindowMean: null,
          prevWindowDelta: null,
        });
      }
    }

    // ── Stream ranks + stream-mean deviation (per class) ──────────────────
    for (const classId of classIds) {
      const group = rows.filter((r) => r.classId === classId);
      if (!group.length) continue;
      const streamMean = group.reduce((s, r) => s + r.mean, 0) / group.length;
      const ranks = this.rank(group, (r) => r.studentId, (r) => r.total);
      for (const r of group) {
        r.streamRank = ranks[r.studentId];
        r.streamTotal = group.length;
        r.classMeanDev = this.round(r.mean - streamMean);
      }
    }

    // ── Standard ranks + standard-mean deviation (per stage + level) ──────
    // A "standard" is identified by (educationStage, level), NOT level alone:
    // Primary "Class 6" and A-Level "Form 6" are both level 6 but are distinct
    // standards and must never be ranked against each other.
    const standardKey = (r: StudentRow) => `${r.educationStage}::${r.classLevel}`;
    const standardKeys = [...new Set(rows.filter((r) => r.classLevel !== null).map(standardKey))];
    for (const key of standardKeys) {
      const group = rows.filter((r) => r.classLevel !== null && standardKey(r) === key);
      if (!group.length) continue;
      const standardMean = group.reduce((s, r) => s + r.mean, 0) / group.length;
      const ranks = this.rank(group, (r) => r.studentId, (r) => r.total);
      for (const r of group) {
        r.standardRank = ranks[r.studentId];
        r.standardTotal = group.length;
        r.standardMeanDev = this.round(r.mean - standardMean);
      }
    }
    // Students with no level fall back to stream ranking for the standard columns.
    for (const r of rows) {
      if (r.classLevel === null) {
        r.standardRank = r.streamRank;
        r.standardTotal = r.streamTotal;
      }
    }

    // ── Δ vs previous window (enrichment) ─────────────────────────────────
    await this.applyPreviousWindowDelta(window, rows);

    // ── Persist ───────────────────────────────────────────────────────────
    const now = new Date();
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.examWindowResult.upsert({
          where: { examWindowId_studentId: { examWindowId: windowId, studentId: r.studentId } },
          create: {
            schoolId: window.schoolId,
            examWindowId: windowId,
            studentId: r.studentId,
            classId: r.classId,
            className: r.className,
            stream: r.stream,
            classLevel: r.classLevel,
            educationStage: r.educationStage as any,
            registrationNumber: r.registrationNumber,
            studentName: r.studentName,
            gender: r.gender,
            subjectScores: r.subjectScores as unknown as Prisma.InputJsonValue,
            subjectCount: r.subjectCount,
            total: r.total,
            mean: r.mean,
            meanPoints: r.meanPoints,
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
          },
          update: {
            className: r.className,
            stream: r.stream,
            classLevel: r.classLevel,
            educationStage: r.educationStage as any,
            registrationNumber: r.registrationNumber,
            studentName: r.studentName,
            gender: r.gender,
            subjectScores: r.subjectScores as unknown as Prisma.InputJsonValue,
            subjectCount: r.subjectCount,
            total: r.total,
            mean: r.mean,
            meanPoints: r.meanPoints,
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
          },
        }),
      ),
    );

    await this.prisma.examWindow.update({ where: { id: windowId }, data: { computedAt: now } });
    await this.redis.delByPattern(`exam-window:meritlist:${windowId}`);

    await this.rabbitMq.publish('exam.results.computed', {
      examWindowId: windowId,
      termId: window.termId,
      academicYearId: window.academicYearId,
      studentsRanked: rows.length,
      classes: classIds.length,
      schoolId: window.schoolId,
    });

    return {
      computed: rows.length,
      classes: classIds.length,
      standards: standardKeys.length,
      computedAt: now,
    };
  }

  private async applyPreviousWindowDelta(
    window: { id: string; schoolId: string | null; academicYearId: string; termId: string; createdAt: Date },
    rows: StudentRow[],
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
          r.prevWindowDelta = this.round(r.mean - prev.mean);
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
        summaries: { byStream: [], bySubject: [], byGender: [] },
      };
    }

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
      rows: results,
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
      seen.add(r.overallGrade);
      const scores = r.subjectScores as Record<string, SubjectScore>;
      for (const key of Object.keys(scores ?? {})) {
        seen.add(scores[key].grade);
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
        distribution: this.distribution(group.map((g) => g.overallGrade), codes),
      };
    });

    // Per subject (across all rows).
    const bySubject = subjects.map((subj) => {
      const grades: string[] = [];
      const percs: number[] = [];
      for (const r of results) {
        const s = (r.subjectScores as Record<string, SubjectScore>)?.[subj.subjectId];
        if (s) {
          grades.push(s.grade);
          percs.push(s.percentage);
        }
      }
      return {
        subjectId: subj.subjectId,
        subjectName: subj.subjectName,
        entries: grades.length,
        meanMarks: round(percs.reduce((s, m) => s + m, 0) / Math.max(percs.length, 1)),
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
      distribution: this.distribution(group.map((g) => g.overallGrade), codes),
    }));

    return { byStream, bySubject, byGender };
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
        if (s.missing) continue;
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
