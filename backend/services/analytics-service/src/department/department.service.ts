import { Injectable } from '@nestjs/common';
import { mean } from '../common/helpers/statistics.helper';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  private async currentTerm(academicYearId?: string) {
    if (!academicYearId) academicYearId = (await this.prisma.academicYear.findFirst({ where: { isCurrent: true } }))?.id;
    return this.prisma.term.findFirst({ where: { academicYearId, isCurrent: true } });
  }

  async getDepartmentSubjectAnalytics(subjectId: string, academicYearId?: string, termId?: string) {
    const term = termId ? await this.prisma.term.findUnique({ where: { id: termId } }) : await this.currentTerm(academicYearId);
    const classSubjects = await this.prisma.classSubject.findMany({
      where: { subjectId, academicYearId: academicYearId || undefined },
    });

    const [subject, classes, results, alerts, pairings, interventions, syllabus] = await Promise.all([
      this.prisma.subject.findUnique({ where: { id: subjectId } }),
      this.prisma.class.findMany({ where: { id: { in: classSubjects.map((x) => x.classId) } } }),
      this.prisma.termResult.findMany({
        where: {
          classSubjectId: { in: classSubjects.map((x) => x.id).length ? classSubjects.map((x) => x.id) : ['__none__'] },
          termId: term?.id || undefined,
          isPublished: true,
        },
      }),
      this.prisma.performanceAlert.findMany({ where: { subjectId, isResolved: false } }),
      this.prisma.peerPairing.findMany({ where: { subjectId, status: 'ACTIVE' } }),
      this.prisma.academicIntervention.findMany({ where: { subjectId } }).catch(() => []),
      this.prisma.syllabusTracker.findMany({ where: { classSubjectId: { in: classSubjects.map((x) => x.id) } } }),
    ]);

    const students = await this.prisma.student.findMany({ where: { id: { in: [...new Set(results.map((x) => x.studentId))] } } });

    const byClass = classSubjects.map((entry) => {
      const classRows = results.filter((r) => r.classSubjectId === entry.id);
      const klass = classes.find((x) => x.id === entry.classId);
      const syllabusRow = syllabus.find((x) => x.classSubjectId === entry.id);
      return {
        className: klass?.name || 'Unknown',
        stream: klass?.stream || null,
        teacherName: `Teacher ${entry.teacherId}`,
        average: mean(classRows.map((x) => x.weightedTotal)),
        passRate: classRows.length ? (classRows.filter((x) => x.isPassing).length / classRows.length) * 100 : 0,
        syllabusCompletion: syllabusRow?.completionPercentage || 0,
      };
    });

    const byTeacher = Object.entries(
      classSubjects.reduce<Record<string, { classes: number; scores: number[]; passes: number; total: number }>>((acc, row) => {
        if (!acc[row.teacherId]) acc[row.teacherId] = { classes: 0, scores: [], passes: 0, total: 0 };
        const classRows = results.filter((r) => r.classSubjectId === row.id);
        acc[row.teacherId].classes += 1;
        acc[row.teacherId].scores.push(...classRows.map((x) => x.weightedTotal));
        acc[row.teacherId].passes += classRows.filter((x) => x.isPassing).length;
        acc[row.teacherId].total += classRows.length;
        return acc;
      }, {}),
    ).map(([teacherId, stats]) => ({
      teacherName: `Teacher ${teacherId}`,
      classCount: stats.classes,
      average: mean(stats.scores),
      passRate: stats.total ? (stats.passes / stats.total) * 100 : 0,
      onTimeSubmissions: 0,
      atRiskStudents: alerts.filter((x) => ['CRITICAL', 'HIGH'].includes(x.severity)).length,
    }));

    const termTrend = await Promise.all(
      (await this.prisma.term.findMany({ where: { academicYearId: academicYearId || undefined }, orderBy: { name: 'asc' } })).map(async (t) => {
        const tRows = await this.prisma.termResult.findMany({
          where: { termId: t.id, classSubjectId: { in: classSubjects.map((x) => x.id) }, isPublished: true },
        });
        return {
          term: t.name,
          average: mean(tRows.map((x) => x.weightedTotal)),
          passRate: tRows.length ? (tRows.filter((x) => x.isPassing).length / tRows.length) * 100 : 0,
        };
      }),
    );

    return {
      subjectName: subject?.name || 'Unknown',
      totalStudentsTaught: new Set(results.map((x) => x.studentId)).size,
      overallAverage: mean(results.map((x) => x.weightedTotal)),
      passRate: results.length ? (results.filter((x) => x.isPassing).length / results.length) * 100 : 0,
      gradeDistribution: results.reduce<Record<string, number>>((acc, row) => {
        const grade = row.grade.charAt(0).toUpperCase();
        acc[grade] = (acc[grade] || 0) + 1;
        return acc;
      }, {}),
      byClass,
      byTeacher,
      termTrend,
      syllabusCompletionAverage: mean(syllabus.map((x) => x.completionPercentage)),
      atRiskStudents: alerts.slice(0, 20).map((alert) => ({
        studentName: (() => {
          const s = students.find((x) => x.id === alert.studentId);
          return s ? `${s.firstName} ${s.lastName}` : 'Unknown';
        })(),
        className: classes[0]?.name || 'Unknown',
        score: results.find((x) => x.studentId === alert.studentId && x.subjectId === subjectId)?.weightedTotal || null,
        alertType: alert.alertType,
      })),
      activePairings: pairings.length,
      interventionsThisTerm: interventions.length,
    };
  }
}
