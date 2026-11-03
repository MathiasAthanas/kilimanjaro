import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { resolveExpectedStudents } from '../exams/engine/expected-students';
import { GradingResolverService } from '../exams/grading-resolver.service';

type Row = Record<string, any>;

/** Assessments whose marks are still the teacher's to enter (progress is worth computing). */
const ACTIVE_STATUSES = ['DRAFT', 'OPEN', 'REJECTED', 'SUBMITTED'];

/**
 * One read-model for everything a teacher sees: their class-subjects (with the
 * school, class name, stream and roll size), their assessments with real
 * entered/required progress, syllabus coverage and the registers they take.
 * Built from the teacher's own assignments, so a teacher with several schools
 * sees all of them and each row carries its schoolId.
 */
@Injectable()
export class TeacherWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentClient: StudentClientService,
    private readonly grading: GradingResolverService,
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

  private rows(payload: any): Row[] {
    if (Array.isArray(payload)) return payload;
    const inner = payload?.data ?? payload;
    if (Array.isArray(inner)) return inner;
    for (const c of [inner?.items, inner?.classes, inner?.students, inner?.terms]) if (Array.isArray(c)) return c;
    return [];
  }

  private async fetchRows(path: string, params: Record<string, unknown>, user: RequestUser): Promise<Row[]> {
    try {
      return this.rows(await this.studentClient.get<unknown>(path, params, this.headers(user)));
    } catch {
      return [];
    }
  }

  private classLabel(c: Row | undefined): string {
    if (!c) return '';
    return `${c.name ?? ''}${c.stream ? ` ${c.stream}` : ''}`.trim();
  }

  private async rosterOf(classId: string, user: RequestUser): Promise<Row[]> {
    return this.fetchRows('/students', { classId, limit: 2000, page: 1 }, user);
  }

  async overview(user: RequestUser) {
    const [classes, years, terms] = await Promise.all([
      this.fetchRows('/students/classes', { limit: 500 }, user),
      this.fetchRows('/students/academic-years', {}, user),
      this.fetchRows('/students/terms', {}, user),
    ]);
    const classById = new Map(classes.map((c) => [String(c.id), c]));
    const yearById = new Map(years.map((y) => [String(y.id), y]));
    const currentTermIds = new Set(terms.filter((t) => t.isCurrent).map((t) => String(t.id)));
    const currentYearIds = new Set(years.filter((y) => y.isCurrent).map((y) => String(y.id)));

    let classSubjects = await this.prisma.classSubject.findMany({
      where: { ...schoolScopeFilter(user), teacherId: user.id, isActive: true },
      include: { subject: true, combination: true },
      orderBy: [{ createdAt: 'desc' }],
    });
    // Only the running year, unless the term calendar is not configured at all.
    const inCurrentYear = classSubjects.filter((cs) => currentYearIds.has(cs.academicYearId));
    if (currentYearIds.size > 0 && inCurrentYear.length > 0) classSubjects = inCurrentYear;

    const csIds = classSubjects.map((cs) => cs.id);
    const syllabusRows = csIds.length
      ? await this.prisma.syllabusTracker.findMany({ where: { classSubjectId: { in: csIds } }, orderBy: { updatedAt: 'desc' } })
      : [];
    const syllabusByCs = new Map<string, any>();
    for (const s of syllabusRows) {
      const cur = syllabusByCs.get(s.classSubjectId);
      // Prefer the running term's record, else the most recently updated one.
      if (!cur || (currentTermIds.has(s.termId) && !currentTermIds.has(cur.termId))) syllabusByCs.set(s.classSubjectId, s);
    }

    const assessmentRows = csIds.length
      ? await this.prisma.assessment.findMany({
          where: { classSubjectId: { in: csIds } },
          include: { examWindow: { select: { id: true, name: true, status: true, closesAt: true } }, classSubject: { include: { subject: true } } },
          orderBy: [{ createdAt: 'desc' }],
        })
      : [];

    // Accurate progress for assessments still being worked on.
    const active = assessmentRows.filter((a) => ACTIVE_STATUSES.includes(a.status));
    const rosterCache = new Map<string, Promise<Row[]>>();
    const rosterFor = (classId: string) => {
      if (!rosterCache.has(classId)) rosterCache.set(classId, this.rosterOf(classId, user));
      return rosterCache.get(classId)!;
    };
    const enteredCounts = assessmentRows.length
      ? await this.prisma.mark.groupBy({ by: ['assessmentId'], where: { assessmentId: { in: assessmentRows.map((a) => a.id) } }, _count: { _all: true } })
      : [];
    const enteredBy = new Map(enteredCounts.map((m) => [m.assessmentId, m._count._all]));
    const progress = new Map<string, { required: number; exempt: number }>();
    await Promise.all(
      active.map(async (a) => {
        const roster = await rosterFor(a.classId);
        const { required, exempt } = await resolveExpectedStudents(this.prisma, a as any, roster.map((s) => String(s.id)));
        progress.set(a.id, { required: required.size, exempt: exempt.size });
      }),
    );

    // Class average: mean percentage of students who sat (absent / not sat are not scores).
    const scoreRows = csIds.length
      ? await this.prisma.mark.findMany({
          where: { classSubjectId: { in: csIds }, isAbsent: false, notSat: false },
          select: { classSubjectId: true, score: true, assessment: { select: { maxScore: true } } },
        })
      : [];
    const avgBy = new Map<string, { sum: number; n: number }>();
    for (const m of scoreRows) {
      const max = Number(m.assessment?.maxScore ?? 0);
      if (!max) continue;
      const cur = avgBy.get(m.classSubjectId) ?? { sum: 0, n: 0 };
      cur.sum += (Number(m.score) / max) * 100;
      cur.n += 1;
      avgBy.set(m.classSubjectId, cur);
    }

    const subjectRoster = new Map<string, number>();
    await Promise.all(
      classSubjects.map(async (cs) => {
        const cls = classById.get(cs.classId);
        if (cs.subject?.isCompulsory && !cs.combinationId) {
          subjectRoster.set(cs.id, Number(cls?.studentCount ?? cls?._count?.enrolments ?? 0));
          return;
        }
        const roster = await rosterFor(cs.classId);
        const termId = [...currentTermIds][0] ?? '';
        const { expected } = await resolveExpectedStudents(
          this.prisma,
          { classId: cs.classId, subjectId: cs.subjectId, termId, academicYearId: cs.academicYearId, educationStage: cs.educationStage, classSubject: { combinationId: cs.combinationId, subject: { isCompulsory: cs.subject?.isCompulsory ?? true } } },
          roster.map((s) => String(s.id)),
        );
        subjectRoster.set(cs.id, expected.size);
      }),
    );

    const homeroom = classes.filter((c) => c.classTeacherId === user.id && (currentYearIds.size === 0 || currentYearIds.has(String(c.academicYearId))));
    const homeroomIds = new Set(homeroom.map((c) => String(c.id)));

    const classItems = classSubjects.map((cs) => {
      const cls = classById.get(cs.classId);
      const syl = syllabusByCs.get(cs.id);
      const mine = assessmentRows.filter((a) => a.classSubjectId === cs.id);
      return {
        classSubjectId: cs.id,
        classId: cs.classId,
        schoolId: cs.schoolId ?? cls?.schoolId ?? null,
        className: cls?.name ?? '',
        stream: cls?.stream ?? null,
        label: this.classLabel(cls) || `${String(cs.educationStage).replace('_', '-')} L${cs.classLevel ?? ''}`.trim(),
        stage: cs.educationStage,
        level: cs.classLevel,
        academicYearId: cs.academicYearId,
        academicYearName: yearById.get(cs.academicYearId)?.name ?? null,
        subjectId: cs.subjectId,
        subjectName: cs.subject?.name ?? 'Subject',
        subjectCode: cs.subject?.code ?? null,
        isOptional: cs.subject?.isCompulsory === false,
        combinationName: cs.combination?.name ?? null,
        combinationCode: cs.combination?.code ?? null,
        studentCount: subjectRoster.get(cs.id) ?? 0,
        classSize: Number(cls?.studentCount ?? cls?._count?.enrolments ?? 0),
        periodsPerWeek: cs.periodsPerWeek,
        average: avgBy.get(cs.id) ? Math.round((avgBy.get(cs.id)!.sum / avgBy.get(cs.id)!.n) * 10) / 10 : null,
        isClassTeacher: homeroomIds.has(String(cs.classId)),
        syllabus: syl
          ? { id: syl.id, termId: syl.termId, totalTopics: syl.totalTopics, coveredTopics: syl.coveredTopics, percent: Math.round(Number(syl.completionPercentage ?? 0)), notes: syl.notes ?? '' }
          : null,
        assessmentCount: mine.length,
        openAssessments: mine.filter((a) => ['DRAFT', 'OPEN', 'REJECTED'].includes(a.status)).length,
      };
    });

    const assessmentItems = assessmentRows.map((a) => {
      const p = progress.get(a.id);
      const entered = enteredBy.get(a.id) ?? 0;
      const cls = classById.get(a.classId);
      const required = p ? p.required : entered;
      return {
        id: a.id,
        name: a.name,
        classSubjectId: a.classSubjectId,
        classId: a.classId,
        schoolId: a.schoolId ?? cls?.schoolId ?? null,
        className: this.classLabel(cls),
        subjectName: a.classSubject?.subject?.name ?? 'Subject',
        status: a.status,
        maxScore: Number(a.maxScore),
        date: a.date,
        submittedAt: a.submittedAt,
        rejectionReason: a.rejectionReason,
        examWindow: a.examWindow ? { id: a.examWindow.id, name: a.examWindow.name, status: a.examWindow.status, closesAt: a.examWindow.closesAt } : null,
        required,
        entered: Math.min(entered, required + (p?.exempt ?? 0)),
        exempt: p?.exempt ?? 0,
        termId: a.termId,
      };
    });

    // A homeroom teacher also takes the register for classes where they teach no subject.
    const registers = new Map<string, { classId: string; schoolId: string | null; label: string; stage: string | null; studentCount: number; isClassTeacher: boolean }>();
    for (const cs of classItems) {
      registers.set(cs.classId, { classId: cs.classId, schoolId: cs.schoolId, label: cs.label, stage: cs.stage, studentCount: cs.classSize, isClassTeacher: cs.isClassTeacher });
    }
    for (const c of homeroom) {
      if (!registers.has(String(c.id))) {
        registers.set(String(c.id), { classId: String(c.id), schoolId: c.schoolId ?? null, label: this.classLabel(c), stage: c.educationStage ?? null, studentCount: Number(c.studentCount ?? 0), isClassTeacher: true });
      }
    }

    return {
      teacherId: user.id,
      generatedAt: new Date().toISOString(),
      currentTermId: [...currentTermIds][0] ?? null,
      schoolIds: [...new Set([...classItems.map((c) => c.schoolId), ...[...registers.values()].map((r) => r.schoolId)].filter(Boolean))],
      classes: classItems,
      assessments: assessmentItems,
      registers: [...registers.values()],
    };
  }

  /** The students of one of the teacher's class-subjects: only those who actually take the subject. */
  async classSubjectStudents(classSubjectId: string, user: RequestUser) {
    const cs = await this.prisma.classSubject.findUnique({ where: { id: classSubjectId }, include: { subject: true } });
    if (!cs) throw new NotFoundException('Class not found');
    if (cs.teacherId !== user.id && user.role === 'TEACHER') throw new ForbiddenException('You are not assigned to this class');
    const [roster, terms] = await Promise.all([this.rosterOf(cs.classId, user), this.fetchRows('/students/terms', {}, user)]);
    const termId = String(terms.find((t) => t.isCurrent)?.id ?? '');
    const { expected } = await resolveExpectedStudents(
      this.prisma,
      { classId: cs.classId, subjectId: cs.subjectId, termId, academicYearId: cs.academicYearId, educationStage: cs.educationStage, classSubject: { combinationId: cs.combinationId, subject: { isCompulsory: cs.subject?.isCompulsory ?? true } } },
      roster.map((s) => String(s.id)),
    );
    const students = roster
      .filter((s) => expected.has(String(s.id)))
      .map((s) => ({
        id: String(s.id),
        name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
        registrationNumber: s.registrationNumber ?? '',
        gender: s.gender ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { classSubjectId, classId: cs.classId, subjectName: cs.subject?.name ?? '', classSize: roster.length, students };
  }

  /** Real class analytics for one class-subject, from the marks the teacher entered. */
  async classSubjectAnalytics(classSubjectId: string, user: RequestUser) {
    const cs = await this.prisma.classSubject.findUnique({ where: { id: classSubjectId }, include: { subject: true } });
    if (!cs) throw new NotFoundException('Class not found');
    if (cs.teacherId !== user.id && user.role === 'TEACHER') throw new ForbiddenException('You are not assigned to this class');

    const [roster, assessments] = await Promise.all([
      this.rosterOf(cs.classId, user),
      this.prisma.assessment.findMany({
        where: { classSubjectId },
        include: { marks: { select: { studentId: true, score: true, isAbsent: true, notSat: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const nameById = new Map(roster.map((s) => [String(s.id), { name: `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(), reg: s.registrationNumber ?? '' }]));
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const median = (xs: number[]) => {
      if (!xs.length) return 0;
      const sorted = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };
    const r1 = (n: number) => Math.round(n * 10) / 10;
    // Grade and pass mark come from the school's own grading scale, the same one the report cards use.
    let scale: any = null;
    try {
      scale = await this.grading.getActiveScale(cs.academicYearId, { educationStage: cs.educationStage, classLevel: cs.classLevel, subjectId: cs.subjectId }, cs.schoolId);
    } catch {
      scale = null;
    }
    const bands: Array<{ grade: string; minScore: number; isPassing: boolean }> = (scale?.grades ?? []).map((g: any) => ({ grade: g.grade, minScore: Number(g.minScore), isPassing: g.isPassing !== false }));
    const gradeOrder = bands.length ? [...bands].sort((a, b) => b.minScore - a.minScore).map((b) => b.grade) : ['A', 'B', 'C', 'D', 'F'];
    const fallbackBand = (pct: number) => (pct >= 75 ? 'A' : pct >= 60 ? 'B' : pct >= 45 ? 'C' : pct >= 30 ? 'D' : 'F');
    const band = (pct: number) => (scale ? this.grading.resolveGrade(scale, pct).grade : fallbackBand(pct));
    const PASS = bands.length ? Math.min(...bands.filter((b) => b.isPassing).map((b) => b.minScore).concat([100])) : 40;

    const perStudent = new Map<string, { pcts: number[]; absent: number }>();
    const rows = assessments
      .filter((a) => a.marks.length > 0)
      .map((a) => {
        const max = Number(a.maxScore) || 100;
        const sat = a.marks.filter((m) => !m.isAbsent && !m.notSat);
        const pcts = sat.map((m) => (Number(m.score) / max) * 100);
        for (const m of a.marks) {
          const cur = perStudent.get(m.studentId) ?? { pcts: [], absent: 0 };
          if (m.isAbsent || m.notSat) cur.absent += 1;
          else cur.pcts.push((Number(m.score) / max) * 100);
          perStudent.set(m.studentId, cur);
        }
        const dist: Record<string, number> = Object.fromEntries(gradeOrder.map((g) => [g, 0]));
        for (const p of pcts) { const g = band(p); dist[g] = (dist[g] ?? 0) + 1; }
        return {
          id: a.id,
          name: a.name,
          status: a.status,
          date: a.date ?? a.createdAt,
          maxScore: max,
          sat: pcts.length,
          absent: a.marks.length - pcts.length,
          average: r1(mean(pcts)),
          median: r1(median(pcts)),
          highest: r1(pcts.length ? Math.max(...pcts) : 0),
          lowest: r1(pcts.length ? Math.min(...pcts) : 0),
          passRate: pcts.length ? Math.round((pcts.filter((p) => p >= PASS).length / pcts.length) * 100) : 0,
          distribution: dist,
        };
      });

    const students = [...perStudent.entries()]
      .map(([id, v]) => {
        const last = v.pcts.length ? v.pcts[v.pcts.length - 1] : null;
        const prev = v.pcts.length > 1 ? v.pcts[v.pcts.length - 2] : null;
        const avg = mean(v.pcts);
        return {
          id,
          name: nameById.get(id)?.name ?? 'Student',
          registrationNumber: nameById.get(id)?.reg ?? '',
          average: r1(avg),
          last: last == null ? null : r1(last),
          delta: last != null && prev != null ? r1(last - prev) : null,
          taken: v.pcts.length,
          absent: v.absent,
          flag: v.pcts.length === 0 ? 'NO_RESULTS' : avg < PASS ? 'AT_RISK' : last != null && prev != null && last - prev >= 10 ? 'IMPROVING' : last != null && prev != null && prev - last >= 10 ? 'DECLINING' : 'OK',
        };
      })
      .sort((a, b) => b.average - a.average);

    const allAvgs = students.filter((s) => s.taken > 0).map((s) => s.average);
    return {
      classSubjectId,
      subjectName: cs.subject?.name ?? '',
      classId: cs.classId,
      schoolId: cs.schoolId,
      studentCount: roster.length,
      passMark: PASS,
      gradeOrder,
      overall: {
        average: r1(mean(allAvgs)),
        median: r1(median(allAvgs)),
        passRate: allAvgs.length ? Math.round((allAvgs.filter((a) => a >= PASS).length / allAvgs.length) * 100) : 0,
        atRisk: students.filter((s) => s.flag === 'AT_RISK').length,
        improving: students.filter((s) => s.flag === 'IMPROVING').length,
        declining: students.filter((s) => s.flag === 'DECLINING').length,
      },
      assessments: rows,
      students,
    };
  }

  /**
   * The teacher's own teaching performance across every class-subject, from the marks
   * they entered. Shaped for the "My Teaching Analytics" page (summary, courses,
   * attention queue and a term-by-term trend).
   */
  async teacherAnalytics(user: RequestUser, q: { academicYearId?: string; termId?: string }) {
    const ov = await this.overview(user);
    const classes = ov.classes.filter((c) => !q.academicYearId || c.academicYearId === q.academicYearId);
    const csIds = classes.map((c) => c.classSubjectId);
    const terms = await this.fetchRows('/students/terms', {}, user);
    const termName = new Map(terms.map((t) => [String(t.id), String(t.name)]));
    const marks = csIds.length
      ? await this.prisma.mark.findMany({
          where: { classSubjectId: { in: csIds }, isAbsent: false, notSat: false, ...(q.termId ? { assessment: { termId: q.termId } } : {}) },
          select: { classSubjectId: true, studentId: true, score: true, assessment: { select: { maxScore: true, termId: true } } },
        })
      : [];

    const passByKey = new Map<string, number>();
    const passMarkOf = async (c: (typeof classes)[number]) => {
      const key = `${c.academicYearId}|${c.stage}|${c.level}|${c.subjectId}|${c.schoolId}`;
      if (passByKey.has(key)) return passByKey.get(key)!;
      let pass = 40;
      try {
        const scale = await this.grading.getActiveScale(c.academicYearId, { educationStage: c.stage, classLevel: c.level, subjectId: c.subjectId }, c.schoolId);
        const passing = (scale?.grades ?? []).filter((g: any) => g.isPassing !== false).map((g: any) => Number(g.minScore));
        if (passing.length) pass = Math.min(...passing);
      } catch {
        /* keep the default */
      }
      passByKey.set(key, pass);
      return pass;
    };

    const r1 = (n: number) => Math.round(n * 10) / 10;
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const courses: any[] = [];
    const attention: Array<{ classId: string; studentId: string; subjectName: string; className: string; avg: number; pass: number }> = [];
    let passingAll = 0;
    let gradedAll = 0;

    for (const c of classes) {
      const pass = await passMarkOf(c);
      const per = new Map<string, number[]>();
      for (const m of marks.filter((x) => x.classSubjectId === c.classSubjectId)) {
        const max = Number(m.assessment?.maxScore ?? 0);
        if (!max) continue;
        per.set(m.studentId, [...(per.get(m.studentId) ?? []), (Number(m.score) / max) * 100]);
      }
      const avgs = [...per.entries()].map(([studentId, pcts]) => ({ studentId, avg: mean(pcts) }));
      const passing = avgs.filter((a) => a.avg >= pass).length;
      passingAll += passing;
      gradedAll += avgs.length;
      for (const a of avgs.filter((x) => x.avg < pass).sort((x, y) => x.avg - y.avg).slice(0, 6)) {
        attention.push({ classId: c.classId, studentId: a.studentId, subjectName: c.subjectName, className: c.label, avg: a.avg, pass });
      }
      courses.push({
        classSubjectId: c.classSubjectId,
        schoolId: c.schoolId,
        subjectName: c.subjectName,
        className: c.label,
        totalStudents: avgs.length,
        passingStudents: passing,
        passRate: avgs.length ? r1((passing / avgs.length) * 100) : 0,
        averageScore: r1(mean(avgs.map((a) => a.avg))),
        topicsCovered: c.syllabus?.coveredTopics ?? null,
        totalTopics: c.syllabus?.totalTopics ?? null,
      });
    }

    // Names for the attention queue (one roster fetch per class involved).
    const rosterCache = new Map<string, Map<string, string>>();
    for (const classId of new Set(attention.map((a) => a.classId))) {
      const roster = await this.rosterOf(classId, user);
      rosterCache.set(classId, new Map(roster.map((st) => [String(st.id), `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim()])));
    }
    const attentionQueue = attention
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 30)
      .map((a) => ({
        studentId: a.studentId,
        studentName: rosterCache.get(a.classId)?.get(a.studentId) ?? 'Student',
        className: a.className,
        subjectName: a.subjectName,
        alertType: 'BELOW_PASS_MARK',
        severity: a.avg < a.pass - 10 ? 'HIGH' : 'MEDIUM',
        averageScore: r1(a.avg),
      }));

    const byTerm = new Map<string, number[]>();
    for (const m of marks) {
      const max = Number(m.assessment?.maxScore ?? 0);
      if (!max) continue;
      const key = m.assessment?.termId ?? '';
      byTerm.set(key, [...(byTerm.get(key) ?? []), (Number(m.score) / max) * 100]);
    }
    const termTrend = [...byTerm.entries()]
      .map(([termId, pcts]) => ({ termId, termName: termName.get(termId) ?? 'Term', averageScore: r1(mean(pcts)), passRate: Math.round((pcts.filter((p) => p >= 40).length / pcts.length) * 100) }))
      .sort((a, b) => a.termName.localeCompare(b.termName));

    return {
      summary: {
        overallPassRate: gradedAll ? r1((passingAll / gradedAll) * 100) : 0,
        totalClasses: classes.length,
        totalStudents: classes.reduce((t, c) => t + c.studentCount, 0),
      },
      courses,
      attentionQueue,
      termTrend,
    };
  }
}
