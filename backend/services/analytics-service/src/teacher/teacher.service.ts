import { Injectable } from '@nestjs/common';
import { mean } from '../common/helpers/statistics.helper';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TeacherAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async resolveYear(academicYearId?: string) {
    if (academicYearId) return academicYearId;
    return (await this.prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
  }

  private async resolveTerm(academicYearId?: string, termId?: string) {
    if (termId) return termId;
    return (await this.prisma.term.findFirst({ where: { academicYearId, isCurrent: true } }))?.id;
  }

  async myDashboard(teacherId: string, academicYearId?: string, termId?: string) {
    const yearId = await this.resolveYear(academicYearId);
    const scopedTermId = await this.resolveTerm(yearId, termId);
    const cacheKey = `analytics:teacher:dashboard:${teacherId}:${yearId || 'cur'}:${scopedTermId || 'cur'}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const classSubjects = await this.prisma.classSubject.findMany({
      where: { teacherId, academicYearId: yearId || undefined },
    });
    const csIds = classSubjects.map((x) => x.id);
    const csIdsFallback = csIds.length ? csIds : ['__none__'];

    const [results, syllabus, alerts, assessments, classes, subjects] = await Promise.all([
      this.prisma.termResult.findMany({
        where: { classSubjectId: { in: csIdsFallback }, termId: scopedTermId || undefined, isPublished: true },
      }),
      this.prisma.syllabusTracker.findMany({
        where: { classSubjectId: { in: csIdsFallback }, termId: scopedTermId || undefined },
      }),
      this.prisma.performanceAlert.findMany({
        where: { isResolved: false },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.assessment.findMany({
        where: { classSubjectId: { in: csIdsFallback }, termId: scopedTermId || undefined },
      }).catch(() => [] as Awaited<ReturnType<typeof this.prisma.assessment.findMany>>),
      this.prisma.class.findMany({ where: { id: { in: classSubjects.map((x) => x.classId) } } }),
      this.prisma.subject.findMany({ where: { id: { in: classSubjects.map((x) => x.subjectId) } } }),
    ]);

    const studentIdsInTeacherClasses = [...new Set(results.map((r) => r.studentId))];
    const alertsForTeacherStudents = alerts.filter((a) => studentIdsInTeacherClasses.includes(a.studentId));

    const studentMap = studentIdsInTeacherClasses.length
      ? new Map(
          (
            await this.prisma.student.findMany({
              where: { id: { in: studentIdsInTeacherClasses.slice(0, 200) } },
              select: { id: true, firstName: true, lastName: true },
            })
          ).map((s) => [s.id, `${s.firstName} ${s.lastName}`]),
        )
      : new Map<string, string>();

    const courses = classSubjects.map((cs) => {
      const klass = classes.find((c) => c.id === cs.classId);
      const subject = subjects.find((s) => s.id === cs.subjectId);
      const csResults = results.filter((r) => r.classSubjectId === cs.id);
      const csAssessments = assessments.filter((a) => a.classSubjectId === cs.id);
      const csSyllabus = syllabus.find((s) => s.classSubjectId === cs.id);
      const studentIds = [...new Set(csResults.map((r) => r.studentId))];
      const onTime = csAssessments.filter((a) => ['SUBMITTED', 'APPROVED', 'PUBLISHED'].includes(a.status?.toUpperCase() || '')).length;

      return {
        classSubjectId: cs.id,
        className: klass?.name || 'Unknown',
        subjectName: subject?.name || 'Unknown',
        enrolled: studentIds.length,
        avgScore: mean(csResults.map((r) => r.weightedTotal)),
        passRate: csResults.length ? (csResults.filter((r) => r.isPassing).length / csResults.length) * 100 : 0,
        assessmentsTotal: csAssessments.length,
        assessmentsOnTime: onTime,
        syllabusCompletion: csSyllabus?.completionPercentage || 0,
        atRiskCount: alertsForTeacherStudents.filter((a) =>
          csResults.some((r) => r.studentId === a.studentId && r.classSubjectId === cs.id),
        ).length,
      };
    });

    const attentionQueue = alertsForTeacherStudents.slice(0, 30).map((alert) => {
      const matchingResult = results.find((r) => r.studentId === alert.studentId);
      const cs = classSubjects.find((c) => c.id === matchingResult?.classSubjectId);
      const klass = classes.find((c) => c.id === cs?.classId);
      return {
        studentId: alert.studentId,
        studentName: studentMap.get(alert.studentId) || 'Unknown',
        className: klass?.name || 'Unknown',
        alertType: alert.alertType,
        severity: alert.severity,
        subjectName: alert.subjectName,
        message: alert.message,
        daysSince: Math.floor((Date.now() - alert.createdAt.getTime()) / 86400000),
      };
    });

    const termTrend = await Promise.all(
      (await this.prisma.term.findMany({ where: { academicYearId: yearId || undefined }, orderBy: { name: 'asc' } })).map(async (term) => {
        const termRows = await this.prisma.termResult.findMany({
          where: { termId: term.id, classSubjectId: { in: csIdsFallback }, isPublished: true },
          select: { weightedTotal: true, isPassing: true },
        });
        return {
          term: term.name,
          average: mean(termRows.map((r) => r.weightedTotal)),
          passRate: termRows.length ? (termRows.filter((r) => r.isPassing).length / termRows.length) * 100 : 0,
        };
      }),
    );

    const result = {
      summary: {
        totalCourses: courses.length,
        totalStudents: studentIdsInTeacherClasses.length,
        overallPassRate: mean(courses.map((c) => c.passRate)),
        avgSyllabusCompletion: mean(courses.map((c) => c.syllabusCompletion)),
        activeAlerts: alertsForTeacherStudents.length,
      },
      courses,
      attentionQueue,
      termTrend,
    };

    await this.redis.set(cacheKey, result, 300);
    return result;
  }
}
