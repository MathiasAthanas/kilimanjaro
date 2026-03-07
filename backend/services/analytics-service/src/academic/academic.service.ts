import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { mean, standardDeviation } from '../common/helpers/statistics.helper';

@Injectable()
export class AcademicService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  private async currentYearId() {
    return (await this.prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
  }

  private async currentTermId(academicYearId?: string) {
    return (await this.prisma.term.findFirst({ where: { academicYearId, isCurrent: true } }))?.id;
  }

  private gradeDistribution(results: { grade: string }[]) {
    const base = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    for (const result of results) {
      const key = (result.grade || 'F').charAt(0).toUpperCase();
      if (Object.prototype.hasOwnProperty.call(base, key)) {
        base[key as keyof typeof base] += 1;
      }
    }
    return base;
  }

  async getOverview(academicYearId?: string, termId?: string) {
    const yearId = academicYearId || (await this.currentYearId());
    const scopedTermId = termId || (await this.currentTermId(yearId));
    const key = `analytics:academic:overview:${yearId || 'current'}:${scopedTermId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const where = {
      academicYearId: yearId || undefined,
      termId: scopedTermId || undefined,
      isPublished: true,
    };

    const [results, classes, classSubjects, alerts, terms] = await Promise.all([
      this.prisma.termResult.findMany({ where, select: { studentId: true, subjectId: true, subjectName: true, weightedTotal: true, isPassing: true, grade: true } }),
      this.prisma.class.findMany({ where: { academicYearId: yearId || undefined }, select: { id: true, name: true, stream: true } }),
      this.prisma.classSubject.findMany({ where: { academicYearId: yearId || undefined }, select: { id: true, classId: true, subjectId: true, teacherId: true } }),
      this.prisma.performanceAlert.findMany({ where: { isResolved: false }, select: { studentId: true, severity: true } }),
      this.prisma.term.findMany({ where: { academicYearId: yearId || undefined }, orderBy: { name: 'asc' }, take: 4 }),
    ]);
    const assessments = await this.prisma.assessment
      .findMany({
        where: { termId: scopedTermId || undefined, classSubjectId: { in: classSubjects.map((item) => item.id).length ? classSubjects.map((item) => item.id) : ['__none__'] } },
        select: { classSubjectId: true, status: true },
      })
      .catch(() => [] as { classSubjectId: string; status: string }[]);

    const schoolAverage = mean(results.map((row) => row.weightedTotal));
    const passRate = results.length ? (results.filter((row) => row.isPassing).length / results.length) * 100 : 0;

    const groupedBySubject = new Map<string, { scores: number[]; pass: number; fail: number }>();
    for (const result of results) {
      if (!groupedBySubject.has(result.subjectName)) groupedBySubject.set(result.subjectName, { scores: [], pass: 0, fail: 0 });
      const bucket = groupedBySubject.get(result.subjectName)!;
      bucket.scores.push(result.weightedTotal);
      if (result.isPassing) bucket.pass += 1;
      else bucket.fail += 1;
    }

    const subjectRankings = [...groupedBySubject.entries()]
      .map(([subjectName, stat]) => ({
        subjectName,
        average: mean(stat.scores),
        passRate: stat.scores.length ? (stat.pass / stat.scores.length) * 100 : 0,
        highestScore: stat.scores.length ? Math.max(...stat.scores) : 0,
        lowestScore: stat.scores.length ? Math.min(...stat.scores) : 0,
        stdDeviation: standardDeviation(stat.scores),
      }))
      .sort((a, b) => b.average - a.average)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const classRankings = await Promise.all(
      classes.map(async (klass) => {
        const classSubjectIds = classSubjects.filter((entry) => entry.classId === klass.id).map((entry) => entry.subjectId);
        const classResults = results.filter((entry) => classSubjectIds.includes(entry.subjectId));
        const classAverage = mean(classResults.map((entry) => entry.weightedTotal));
        const classPassRate = classResults.length ? (classResults.filter((entry) => entry.isPassing).length / classResults.length) * 100 : 0;

        const studentIds = [...new Set(classResults.map((entry) => entry.studentId))];
        const topStudent = studentIds.length
          ? await this.prisma.student.findFirst({
              where: { id: { in: studentIds } },
              orderBy: { firstName: 'asc' },
              select: { firstName: true, lastName: true },
            })
          : null;

        return {
          className: klass.name,
          stream: klass.stream,
          average: classAverage,
          passRate: classPassRate,
          topStudent: { name: topStudent ? `${topStudent.firstName} ${topStudent.lastName}` : null, average: classAverage },
        };
      }),
    );

    const teacherPerformanceSummary = classSubjects.map((entry) => {
      const subjectRows = results.filter((row) => row.subjectId === entry.subjectId);
      const subjectAssessments = assessments.filter((item) => item.classSubjectId === entry.id);
      const onTimeCount = subjectAssessments.filter((item) => ['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes((item.status || '').toUpperCase())).length;
      const submissionTimeliness = subjectAssessments.length ? (onTimeCount / subjectAssessments.length) * 100 : 0;
      return {
        teacherId: entry.teacherId,
        subjectName: subjectRows[0]?.subjectName || 'Unknown',
        className: classes.find((klass) => klass.id === entry.classId)?.name || 'Unknown',
        classAverage: mean(subjectRows.map((row) => row.weightedTotal)),
        passRate: subjectRows.length ? (subjectRows.filter((row) => row.isPassing).length / subjectRows.length) * 100 : 0,
        submissionTimeliness,
      };
    });

    const termOverTermComparison = await Promise.all(
      terms.map(async (term) => {
        const termResults = await this.prisma.termResult.findMany({
          where: { academicYearId: yearId || undefined, termId: term.id, isPublished: true },
          select: { studentId: true, weightedTotal: true, isPassing: true },
        });

        return {
          termName: term.name,
          schoolAverage: mean(termResults.map((item) => item.weightedTotal)),
          passRate: termResults.length ? (termResults.filter((item) => item.isPassing).length / termResults.length) * 100 : 0,
          totalStudents: new Set(termResults.map((item) => item.studentId)).size,
        };
      }),
    );

    const result = {
      schoolAverage,
      passRate,
      gradeDistribution: this.gradeDistribution(results),
      subjectRankings,
      classRankings: classRankings.sort((a, b) => b.average - a.average).map((item, idx) => ({ ...item, rank: idx + 1 })),
      teacherPerformanceSummary,
      termOverTermComparison,
      atRiskStudents: alerts.filter((item) => ['CRITICAL', 'HIGH'].includes(item.severity)).length,
    };

    await this.redis.set(key, result, 1200);
    return result;
  }

  async getSubject(subjectId: string, academicYearId?: string, termId?: string, classId?: string) {
    const scopedTermId = termId || (await this.currentTermId(academicYearId));
    const key = `analytics:academic:subject:${subjectId}:${scopedTermId || 'current'}:${classId || 'all'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { subjectId, academicYearId: academicYearId || undefined, classId: classId || undefined },
      select: { id: true, classId: true, teacherId: true },
    });
    const classSubjectIds = classSubjects.map((entry) => entry.id);

    const results = await this.prisma.termResult.findMany({
      where: {
        classSubjectId: { in: classSubjectIds.length ? classSubjectIds : ['__none__'] },
        termId: scopedTermId || undefined,
        academicYearId: academicYearId || undefined,
        isPublished: true,
      },
      select: { studentId: true, subjectName: true, weightedTotal: true, grade: true, rank: true, isPassing: true, totalStudentsInClass: true, classSubjectId: true },
      orderBy: { weightedTotal: 'desc' },
    });

    const classes = await this.prisma.class.findMany({ where: { id: { in: classSubjects.map((entry) => entry.classId) } } });
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });

    const byClass = classSubjects.map((entry) => {
      const classResults = results.filter((row) => row.classSubjectId === entry.id);
      const scores = classResults.map((row) => row.weightedTotal);
      const klass = classes.find((item) => item.id === entry.classId);
      return {
        className: klass?.name || 'Unknown',
        stream: klass?.stream,
        average: mean(scores),
        passRate: scores.length ? (classResults.filter((row) => row.isPassing).length / scores.length) * 100 : 0,
        topScore: scores.length ? Math.max(...scores) : 0,
        bottomScore: scores.length ? Math.min(...scores) : 0,
        stdDeviation: standardDeviation(scores),
        teacherId: entry.teacherId,
      };
    });

    const scoreDistributionBuckets = Array.from({ length: 10 }).map((_, index) => {
      const min = index * 10;
      const max = index === 9 ? 100 : min + 9;
      const count = results.filter((row) => row.weightedTotal >= min && row.weightedTotal <= max).length;
      return { range: `${min}-${max}`, count };
    });

    const termTrend = await Promise.all(
      (await this.prisma.term.findMany({ where: { academicYearId: academicYearId || undefined }, orderBy: { name: 'asc' } })).map(async (term) => {
        const termRows = await this.prisma.termResult.findMany({
          where: {
            termId: term.id,
            classSubjectId: { in: classSubjectIds.length ? classSubjectIds : ['__none__'] },
            isPublished: true,
          },
          select: { weightedTotal: true, isPassing: true },
        });
        return {
          term: term.name,
          average: mean(termRows.map((row) => row.weightedTotal)),
          passRate: termRows.length ? (termRows.filter((row) => row.isPassing).length / termRows.length) * 100 : 0,
        };
      }),
    );

    const topPerformersRaw = results.slice(0, 10);
    const bottomPerformersRaw = [...results].slice(-10);
    const studentMap = new Map((await this.prisma.student.findMany({ where: { id: { in: [...new Set(results.map((row) => row.studentId))] } }, select: { id: true, firstName: true, lastName: true } })).map((x) => [x.id, `${x.firstName} ${x.lastName}`]));
    const activeAlertIds = new Set((await this.prisma.performanceAlert.findMany({ where: { subjectId, isResolved: false }, select: { studentId: true } })).map((x) => x.studentId));

    const data = {
      subjectName: subject?.name || results[0]?.subjectName || 'Unknown',
      overallAverage: mean(results.map((row) => row.weightedTotal)),
      passRate: results.length ? (results.filter((row) => row.isPassing).length / results.length) * 100 : 0,
      gradeDistribution: this.gradeDistribution(results),
      byClass,
      scoreDistributionBuckets,
      termTrend,
      topPerformers: topPerformersRaw.map((row) => ({ studentId: row.studentId, studentName: studentMap.get(row.studentId) || 'Unknown', score: row.weightedTotal, grade: row.grade, rank: row.rank })),
      needsAttention: bottomPerformersRaw.map((row) => ({ studentId: row.studentId, studentName: studentMap.get(row.studentId) || 'Unknown', score: row.weightedTotal, grade: row.grade, hasActiveAlert: activeAlertIds.has(row.studentId) })),
    };

    await this.redis.set(key, data, 1200);
    return data;
  }

  async getTeacher(teacherId: string, academicYearId?: string, termId?: string) {
    const scopedTermId = termId || (await this.currentTermId(academicYearId));
    const key = `analytics:academic:teacher:${teacherId}:${scopedTermId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { teacherId, academicYearId: academicYearId || undefined },
      select: { id: true, classId: true, subjectId: true },
    });

    const ids = classSubjects.map((entry) => entry.id);
    const [results, subjects, classes, syllabus, alerts, assessments] = await Promise.all([
      this.prisma.termResult.findMany({ where: { classSubjectId: { in: ids.length ? ids : ['__none__'] }, termId: scopedTermId || undefined, isPublished: true } }),
      this.prisma.subject.findMany({ where: { id: { in: classSubjects.map((entry) => entry.subjectId) } } }),
      this.prisma.class.findMany({ where: { id: { in: classSubjects.map((entry) => entry.classId) } } }),
      this.prisma.syllabusTracker.findMany({ where: { classSubjectId: { in: ids.length ? ids : ['__none__'] }, termId: scopedTermId || undefined } }),
      this.prisma.performanceAlert.findMany({ where: { isResolved: false }, select: { studentId: true, severity: true } }),
      this.prisma.assessment.findMany({
        where: { classSubjectId: { in: ids.length ? ids : ['__none__'] }, termId: scopedTermId || undefined },
        select: { classSubjectId: true, status: true },
      }).catch(() => [] as { classSubjectId: string; status: string }[]),
    ]);

    const subjectsRows = classSubjects.map((entry) => {
      const scores = results.filter((row) => row.classSubjectId === entry.id);
      const className = classes.find((klass) => klass.id === entry.classId)?.name || 'Unknown';
      const subjectName = subjects.find((subject) => subject.id === entry.subjectId)?.name || 'Unknown';
      const assessmentRows = assessments.filter((item) => item.classSubjectId === entry.id);
      const submissionsOnTime = assessmentRows.filter((item) => ['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes((item.status || '').toUpperCase())).length;
      const submissionsLate = Math.max(0, assessmentRows.length - submissionsOnTime);
      return {
        subjectName,
        className,
        classAverage: mean(scores.map((row) => row.weightedTotal)),
        passRate: scores.length ? (scores.filter((row) => row.isPassing).length / scores.length) * 100 : 0,
        stdDeviation: standardDeviation(scores.map((row) => row.weightedTotal)),
        submissionsOnTime,
        submissionsLate,
        averageApprovalTime: submissionsOnTime ? Number((submissionsLate / submissionsOnTime).toFixed(2)) : 0,
        syllabusCompletion: mean(syllabus.filter((item) => item.classSubjectId === entry.id).map((item) => item.completionPercentage)),
        atRiskStudentsInClass: alerts.filter((item) => ['CRITICAL', 'HIGH'].includes(item.severity)).length,
        improvingStudentsInClass: alerts.filter((item) => !['CRITICAL', 'HIGH'].includes(item.severity)).length,
      };
    });

    const trendTerms = await this.prisma.term.findMany({ where: { academicYearId: academicYearId || undefined }, orderBy: { name: 'asc' } });
    const termTrend = await Promise.all(
      trendTerms.map(async (term) => {
        const termRows = await this.prisma.termResult.findMany({ where: { termId: term.id, classSubjectId: { in: ids.length ? ids : ['__none__'] }, isPublished: true } });
        return {
          term: term.name,
          average: mean(termRows.map((row) => row.weightedTotal)),
          passRate: termRows.length ? (termRows.filter((row) => row.isPassing).length / termRows.length) * 100 : 0,
        };
      }),
    );

    const data = {
      teacherName: `Teacher ${teacherId}`,
      subjects: subjectsRows,
      overallClassAverage: mean(subjectsRows.map((row) => row.classAverage)),
      overallPassRate: mean(subjectsRows.map((row) => row.passRate)),
      termTrend,
    };

    await this.redis.set(key, data, 1800);
    return data;
  }

  async getClass(classId: string, academicYearId?: string, termId?: string) {
    const scopedTermId = termId || (await this.currentTermId(academicYearId));
    const key = `analytics:academic:class:${classId}:${scopedTermId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const [klass, classSubjects] = await Promise.all([
      this.prisma.class.findUnique({ where: { id: classId } }),
      this.prisma.classSubject.findMany({ where: { classId, academicYearId: academicYearId || undefined } }),
    ]);

    const classSubjectIds = classSubjects.map((entry) => entry.id);
    const [results, reportCards, alerts, pairings, subjects] = await Promise.all([
      this.prisma.termResult.findMany({ where: { classSubjectId: { in: classSubjectIds.length ? classSubjectIds : ['__none__'] }, termId: scopedTermId || undefined, isPublished: true } }),
      this.prisma.reportCard.findMany({ where: { classId, termId: scopedTermId || undefined, academicYearId: academicYearId || undefined, isPublished: true } }),
      this.prisma.performanceAlert.findMany({ where: { isResolved: false }, select: { studentId: true, severity: true } }),
      this.prisma.peerPairing.findMany({ where: { status: 'ACTIVE' }, select: { studentId: true } }),
      this.prisma.subject.findMany({ where: { id: { in: classSubjects.map((entry) => entry.subjectId) } } }),
    ]);

    const students = await this.prisma.enrolment.findMany({ where: { classId, isActive: true }, select: { studentId: true } });
    const studentIds = students.map((entry) => entry.studentId);
    const studentMap = new Map((await this.prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, firstName: true, lastName: true } })).map((x) => [x.id, `${x.firstName} ${x.lastName}`]));

    const subjectSummaries = classSubjects.map((entry) => {
      const rows = results.filter((row) => row.classSubjectId === entry.id);
      const scores = rows.map((row) => row.weightedTotal);
      return {
        subjectName: subjects.find((s) => s.id === entry.subjectId)?.name || 'Unknown',
        teacherName: `Teacher ${entry.teacherId}`,
        average: mean(scores),
        passRate: rows.length ? (rows.filter((row) => row.isPassing).length / rows.length) * 100 : 0,
        highestScore: scores.length ? Math.max(...scores) : 0,
        lowestScore: scores.length ? Math.min(...scores) : 0,
      };
    });

    const overallRankings = reportCards
      .sort((a, b) => (a.rank || 9999) - (b.rank || 9999))
      .map((row, index) => ({
        rank: row.rank || index + 1,
        studentId: row.studentId,
        studentName: studentMap.get(row.studentId) || 'Unknown',
        overallAverage: row.overallAverage,
        grade: row.overallGrade,
        passingSubjects: row.subjectCount - row.failingSubjectCount,
        failingSubjects: row.failingSubjectCount,
      }));

    const termComparison = await Promise.all(
      (await this.prisma.term.findMany({ where: { academicYearId: academicYearId || undefined }, orderBy: { name: 'asc' } })).map(async (term) => {
        const termRows = await this.prisma.termResult.findMany({ where: { termId: term.id, classSubjectId: { in: classSubjectIds.length ? classSubjectIds : ['__none__'] }, isPublished: true } });
        return {
          term: term.name,
          average: mean(termRows.map((x) => x.weightedTotal)),
          passRate: termRows.length ? (termRows.filter((x) => x.isPassing).length / termRows.length) * 100 : 0,
        };
      }),
    );

    const data = {
      className: klass?.name || 'Unknown',
      stream: klass?.stream,
      studentCount: studentIds.length,
      subjectSummaries,
      overallRankings,
      gradeDistribution: this.gradeDistribution(results),
      passRate: results.length ? (results.filter((row) => row.isPassing).length / results.length) * 100 : 0,
      atRiskCount: alerts.filter((a) => ['HIGH', 'CRITICAL'].includes(a.severity)).length,
      criticalCount: alerts.filter((a) => a.severity === 'CRITICAL').length,
      activePairings: pairings.filter((pairing) => studentIds.includes(pairing.studentId)).length,
      termComparison,
    };

    await this.redis.set(key, data, 1200);
    return data;
  }

  async getPerformanceEngine(academicYearId?: string, termId?: string) {
    const scopedTermId = termId || (await this.currentTermId(academicYearId));
    const key = `analytics:academic:engine:${academicYearId || 'current'}:${scopedTermId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const [alerts, pairings, interventions, students, classes] = await Promise.all([
      this.prisma.performanceAlert.findMany({ where: { createdAt: scopedTermId ? undefined : undefined } }),
      this.prisma.peerPairing.findMany(),
      this.prisma.academicIntervention.findMany(),
      this.prisma.student.findMany({ select: { id: true, firstName: true, lastName: true } }),
      this.prisma.class.findMany({ select: { id: true, name: true } }),
    ]);

    const byType = alerts.reduce<Record<string, number>>((acc, row) => {
      acc[row.alertType] = (acc[row.alertType] || 0) + 1;
      return acc;
    }, {});

    const bySeverity = alerts.reduce<Record<string, number>>((acc, row) => {
      acc[row.severity] = (acc[row.severity] || 0) + 1;
      return acc;
    }, {});

    const resolved = alerts.filter((row) => row.isResolved);
    const unresolved = alerts.filter((row) => !row.isResolved);

    const avgResolutionDays = resolved.length
      ? mean(
          resolved
            .filter((row) => row.resolvedAt)
            .map((row) => ((row.resolvedAt as Date).getTime() - row.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : 0;

    const pairingCompleted = pairings.filter((row) => row.status === 'COMPLETED');
    const positivePairings = pairingCompleted.filter((row) => (row.outcomeDelta || 0) > 0);

    const byInterventionType = interventions.reduce<Record<string, number>>((acc, row) => {
      acc[row.type] = (acc[row.type] || 0) + 1;
      return acc;
    }, {});

    const chronicByStudent = unresolved.reduce<Record<string, number>>((acc, row) => {
      acc[row.studentId] = (acc[row.studentId] || 0) + 1;
      return acc;
    }, {});

    const studentName = (studentId: string) => {
      const s = students.find((item) => item.id === studentId);
      return s ? `${s.firstName} ${s.lastName}` : 'Unknown';
    };

    const chronicUnderperformers = Object.entries(chronicByStudent)
      .filter(([, count]) => count >= 3)
      .map(([studentId, count]) => ({
        studentId,
        studentName: studentName(studentId),
        className: classes[0]?.name || 'Unknown',
        subjectCount: count,
      }));

    const subjectAlerts = alerts.reduce<Record<string, { alertCount: number; resolvedCount: number }>>((acc, row) => {
      if (!acc[row.subjectName]) acc[row.subjectName] = { alertCount: 0, resolvedCount: 0 };
      acc[row.subjectName].alertCount += 1;
      if (row.isResolved) acc[row.subjectName].resolvedCount += 1;
      return acc;
    }, {});

    const mostAlertedSubjects = Object.entries(subjectAlerts)
      .map(([subjectName, stats]) => ({ subjectName, ...stats }))
      .sort((a, b) => b.alertCount - a.alertCount)
      .slice(0, 10);

    const data = {
      alertsSummary: {
        totalAlerts: alerts.length,
        byType,
        bySeverity,
        resolvedCount: resolved.length,
        unresolvedCount: unresolved.length,
        resolutionRate: alerts.length ? (resolved.length / alerts.length) * 100 : 0,
        averageResolutionDays: avgResolutionDays,
      },
      pairingSummary: {
        totalSuggested: pairings.length,
        activated: pairings.filter((row) => row.status === 'ACTIVE').length,
        rejected: pairings.filter((row) => row.status === 'REJECTED').length,
        completed: pairingCompleted.length,
        expired: pairings.filter((row) => row.status === 'EXPIRED').length,
        activationRate: pairings.length ? (pairings.filter((row) => row.status === 'ACTIVE').length / pairings.length) * 100 : 0,
        positiveOutcomeCount: positivePairings.length,
        negativeOutcomeCount: pairingCompleted.filter((row) => (row.outcomeDelta || 0) <= 0).length,
        averageScoreImprovement: mean(pairingCompleted.map((row) => row.outcomeDelta || 0)),
        effectivenessRate: pairingCompleted.length ? (positivePairings.length / pairingCompleted.length) * 100 : 0,
      },
      interventionSummary: {
        totalInterventions: interventions.length,
        byType: byInterventionType,
        followedUpCount: interventions.filter((row) => row.isFollowedUp).length,
        followUpRate: interventions.length ? (interventions.filter((row) => row.isFollowedUp).length / interventions.length) * 100 : 0,
      },
      mostAlertedSubjects,
      mostAlertedClasses: classes.slice(0, 10).map((klass) => ({ className: klass.name, alertCount: unresolved.length })),
      chronicUnderperformers,
      successStories: pairings
        .filter((row) => (row.outcomeDelta || 0) > 0)
        .slice(0, 10)
        .map((row) => ({
          studentId: row.studentId,
          studentName: studentName(row.studentId),
          subjectName: row.subjectName,
          scoreAtAlert: row.studentScoreAtPairing,
          currentScore: row.outcomeScore || row.studentScoreAtPairing,
          improvement: row.outcomeDelta || 0,
        })),
    };

    await this.redis.set(key, data, 1800);
    return data;
  }
}
