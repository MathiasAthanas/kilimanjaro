import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { pearsonCorrelation } from '../common/helpers/statistics.helper';
import { RequestUser } from '../common/interfaces/request-user.interface';

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService, private readonly redis: RedisService) {}

  private async currentTermId(academicYearId?: string) {
    if (!academicYearId) {
      const year = await this.prisma.academicYear.findFirst({ where: { isCurrent: true } });
      academicYearId = year?.id;
    }
    return (await this.prisma.term.findFirst({ where: { academicYearId, isCurrent: true } }))?.id;
  }

  private attendanceStats(records: { status: string }[]) {
    const totalDays = records.length;
    const present = records.filter((row) => row.status === 'PRESENT').length;
    const absent = records.filter((row) => row.status === 'ABSENT').length;
    const late = records.filter((row) => row.status === 'LATE').length;
    const excused = records.filter((row) => row.status === 'EXCUSED').length;
    return {
      totalDays,
      present,
      absent,
      late,
      excused,
      attendanceRate: totalDays ? (present / totalDays) * 100 : 0,
    };
  }

  async getOverview(termId?: string, academicYearId?: string, classId?: string) {
    const scopedTerm = termId || (await this.currentTermId(academicYearId));
    const cacheKey = `analytics:attendance:${scopedTerm || 'current'}:${classId || 'all'}`;
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) return cached;

    const where = { termId: scopedTerm || undefined, classId: classId || undefined };
    const [records, classes, students, reportCards, alerts] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where, select: { studentId: true, classId: true, date: true, status: true } }),
      this.prisma.class.findMany({ where: { id: classId || undefined }, select: { id: true, name: true, stream: true } }),
      this.prisma.student.findMany({ select: { id: true, firstName: true, lastName: true } }),
      this.prisma.reportCard.findMany({ where: { termId: scopedTerm || undefined, isPublished: true }, select: { studentId: true, overallAverage: true } }),
      this.prisma.performanceAlert.findMany({ where: { isResolved: false, alertType: { contains: 'ATTENDANCE' } }, select: { studentId: true } }),
    ]);

    const school = this.attendanceStats(records);
    const studentNameMap = new Map(students.map((x) => [x.id, `${x.firstName} ${x.lastName}`]));

    const byClass = classes.map((klass) => {
      const classRows = records.filter((row) => row.classId === klass.id);
      const stats = this.attendanceStats(classRows);
      const classStudentIds = [...new Set(classRows.map((row) => row.studentId))];
      let below = 0;
      for (const id of classStudentIds) {
        const sStats = this.attendanceStats(classRows.filter((row) => row.studentId === id));
        if (sStats.attendanceRate < 80) below += 1;
      }
      return {
        className: klass.name,
        stream: klass.stream,
        attendanceRate: stats.attendanceRate,
        totalDays: stats.totalDays,
        totalPresent: stats.present,
        totalAbsent: stats.absent,
        studentsBelow80: below,
      };
    });

    const dayBuckets = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
      const dayRows = records.filter((row) => row.date.getDay() === idx);
      const stats = this.attendanceStats(dayRows);
      return { dayOfWeek: day, rate: stats.attendanceRate };
    });

    const monthMap = records.reduce<Record<string, { present: number; total: number }>>((acc, row) => {
      const month = row.date.toISOString().slice(0, 7);
      if (!acc[month]) acc[month] = { present: 0, total: 0 };
      if (row.status === 'PRESENT') acc[month].present += 1;
      acc[month].total += 1;
      return acc;
    }, {});

    const byMonth = Object.entries(monthMap)
      .map(([month, stat]) => ({ month, rate: stat.total ? (stat.present / stat.total) * 100 : 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const studentsBelow80Percent = [] as any[];
    const chronicAbsentees = [] as any[];

    for (const student of students) {
      const studentRows = records.filter((row) => row.studentId === student.id);
      if (!studentRows.length) continue;
      const stats = this.attendanceStats(studentRows);
      const klass = classes.find((row) => row.id === studentRows[0].classId);
      if (stats.attendanceRate < 80) {
        studentsBelow80Percent.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          className: klass?.name || 'Unknown',
          attendanceRate: stats.attendanceRate,
          totalAbsent: stats.absent,
          totalDays: stats.totalDays,
        });
      }
      if (stats.attendanceRate < 60) {
        chronicAbsentees.push({
          studentId: student.id,
          studentName: `${student.firstName} ${student.lastName}`,
          className: klass?.name || 'Unknown',
          attendanceRate: stats.attendanceRate,
          consecutiveAbsences: studentRows.slice(-10).filter((row) => row.status === 'ABSENT').length,
        });
      }
    }

    const attendanceScores = reportCards.map((card) => {
      const studentRows = records.filter((row) => row.studentId === card.studentId);
      const stat = this.attendanceStats(studentRows);
      return { attendanceRate: stat.attendanceRate, performance: card.overallAverage };
    });

    const correlation = pearsonCorrelation(
      attendanceScores.map((row) => row.attendanceRate),
      attendanceScores.map((row) => row.performance),
    );

    const data = {
      schoolAttendanceRate: school.attendanceRate,
      byClass,
      byDay: dayBuckets,
      byMonth,
      studentsBelow80Percent: studentsBelow80Percent.slice(0, 50),
      chronicAbsentees: chronicAbsentees.slice(0, 50),
      attendanceVsPerformanceCorrelation: {
        correlation,
        interpretation: correlation > 0.4 ? 'Strong positive relationship' : correlation < -0.2 ? 'Negative relationship' : 'Weak relationship',
        studentsWithAttendanceImpactAlerts: new Set(alerts.map((row) => row.studentId)).size,
      },
    };

    await this.redis.set(cacheKey, data, 1800);
    return data;
  }

  async getStudentAttendance(studentId: string, user?: RequestUser) {
    if (user?.role === 'STUDENT' && user.id !== studentId) {
      throw new ForbiddenException('Students can only access own attendance analytics');
    }

    if (user?.role === 'PARENT') {
      const hasLink = await this.prisma.studentGuardianLink.findFirst({ where: { guardianId: user.id, studentId } });
      if (!hasLink) throw new ForbiddenException('Parents can only access linked students');
    }

    const [records, terms, alerts] = await Promise.all([
      this.prisma.attendanceRecord.findMany({ where: { studentId }, orderBy: { date: 'asc' } }),
      this.prisma.term.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, academicYearId: true } }),
      this.prisma.performanceAlert.findMany({ where: { studentId, isResolved: false, alertType: { contains: 'ATTENDANCE' } }, select: { id: true } }),
    ]);

    const overall = this.attendanceStats(records);

    const byTerm = terms
      .map((term) => {
        const rows = records.filter((row) => row.termId === term.id);
        const stats = this.attendanceStats(rows);
        return {
          termName: term.name,
          rate: stats.attendanceRate,
          present: stats.present,
          absent: stats.absent,
          late: stats.late,
          excused: stats.excused,
        };
      })
      .filter((row) => row.present + row.absent + row.late + row.excused > 0);

    const monthMap = records.reduce<Record<string, { present: number; total: number }>>((acc, row) => {
      const d = row.date;
      const key = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}`;
      if (!acc[key]) acc[key] = { present: 0, total: 0 };
      if (row.status === 'PRESENT') acc[key].present += 1;
      acc[key].total += 1;
      return acc;
    }, {});

    const byMonth = Object.entries(monthMap)
      .map(([month, stat]) => {
        const [year, mon] = month.split('-');
        return { month: mon, year: Number(year), rate: stat.total ? (stat.present / stat.total) * 100 : 0 };
      })
      .sort((a, b) => `${a.year}-${a.month}`.localeCompare(`${b.year}-${b.month}`));

    let currentPresentStreak = 0;
    let longestPresentStreak = 0;
    let running = 0;
    for (const record of records) {
      if (record.status === 'PRESENT') {
        running += 1;
        longestPresentStreak = Math.max(longestPresentStreak, running);
      } else {
        running = 0;
      }
    }
    for (let i = records.length - 1; i >= 0; i -= 1) {
      if (records[i].status === 'PRESENT') currentPresentStreak += 1;
      else break;
    }

    return {
      overall,
      byTerm,
      byMonth,
      streak: { currentPresentStreak, longestPresentStreak },
      attendanceCalendar: records.slice(-120).map((row) => ({ date: row.date.toISOString().slice(0, 10), status: row.status })),
      attendanceImpactAlert: alerts.length > 0,
    };
  }
}