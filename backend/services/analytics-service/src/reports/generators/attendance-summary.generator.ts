import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class AttendanceSummaryGenerator {
  async generate(filePath: string, data: any) {
    const rate = Number(data.schoolAttendanceRate ?? 0);
    const classBullets = (data.byClass || [])
      .slice(0, 15)
      .map(
        (row: any) =>
          `${row.className}${row.stream ? ` ${row.stream}` : ''}: ${Number(row.attendanceRate || 0).toFixed(2)}% attendance, ${row.totalAbsent || 0} absences, ${row.studentsBelow80 || 0} learners below 80%.`,
      );
    const dayBullets = (data.byDay || [])
      .filter((row: any) => Number(row.rate || 0) > 0)
      .map((row: any) => `${row.dayOfWeek}: ${Number(row.rate || 0).toFixed(2)}% attendance.`);
    const monthBullets = (data.byMonth || [])
      .slice(-8)
      .map((row: any) => `${row.month}: ${Number(row.rate || 0).toFixed(2)}% attendance.`);
    const actions = [
      rate < 90
        ? `School attendance is ${rate.toFixed(2)}%; require class-level intervention plans for any group below 90%.`
        : `School attendance is healthy at ${rate.toFixed(2)}%.`,
      (data.studentsBelow80Percent || []).length
        ? `${(data.studentsBelow80Percent || []).length} learners are below 80%; schedule guardian contact and daily monitoring.`
        : 'No learners below 80% were returned for this reporting period.',
      (data.chronicAbsentees || []).length
        ? `${(data.chronicAbsentees || []).length} chronic absentee records require escalation.`
        : 'No chronic absentee list was returned for this reporting period.',
    ];

    await createPdf(filePath, 'Attendance Summary Report', [
      {
        heading: 'Attendance Management View',
        rows: [
          ['School Attendance Rate', data.schoolAttendanceRate ?? 0],
          ['Classes Tracked', (data.byClass || []).length],
          ['Learners Below 80%', (data.studentsBelow80Percent || []).length],
          ['Chronic Absentees', (data.chronicAbsentees || []).length],
        ],
        bullets: actions,
      },
      {
        heading: 'Attendance',
        rows: [
          ['School Attendance Rate', data.schoolAttendanceRate ?? 0],
          ['Students Below 80%', (data.studentsBelow80Percent || []).length],
          ['Chronic Absentees', (data.chronicAbsentees || []).length],
        ],
        bullets: classBullets,
      },
      {
        heading: 'Correlation',
        rows: [
          ['Attendance vs Performance', data.attendanceVsPerformanceCorrelation?.correlation ?? 0],
          ['Interpretation', data.attendanceVsPerformanceCorrelation?.interpretation ?? 'N/A'],
          ['Attendance Impact Alerts', data.attendanceVsPerformanceCorrelation?.studentsWithAttendanceImpactAlerts ?? 0],
        ],
      },
      {
        heading: 'Trend Highlights',
        rows: [
          ['Daily Trend Points', (data.byDay || []).length],
          ['Monthly Trend Points', (data.byMonth || []).length],
        ],
        bullets: [...dayBullets, ...monthBullets],
      },
      {
        heading: 'Learner Follow-Up List',
        rows: [
          ['Below 80% List', (data.studentsBelow80Percent || []).length],
          ['Chronic Absentee List', (data.chronicAbsentees || []).length],
        ],
        bullets: [
          ...(data.studentsBelow80Percent || [])
            .slice(0, 12)
            .map((row: any) => `${row.studentName} (${row.className}) attendance ${Number(row.attendanceRate || 0).toFixed(2)}%, absent ${row.totalAbsent || 0}/${row.totalDays || 0} sessions.`),
          ...(data.chronicAbsentees || [])
            .slice(0, 12)
            .map((row: any) => `Chronic absentee: ${row.studentName} (${row.className}) rate ${Number(row.attendanceRate || 0).toFixed(2)}%, recent absences ${row.consecutiveAbsences || 0}.`),
        ],
      },
    ]);
  }
}
