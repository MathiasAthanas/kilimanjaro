import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class AttendanceSummaryGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'Attendance Summary Report', [
      {
        heading: 'Attendance',
        rows: [
          ['School Attendance Rate', data.schoolAttendanceRate ?? 0],
          ['Students Below 80%', (data.studentsBelow80Percent || []).length],
          ['Chronic Absentees', (data.chronicAbsentees || []).length],
        ],
        bullets: (data.byClass || [])
          .slice(0, 10)
          .map((row: any) => `${row.className}${row.stream ? ` ${row.stream}` : ''}: ${Number(row.attendanceRate || 0).toFixed(2)}%`),
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
        bullets: [
          ...(data.byDay || []).map((row: any) => `${row.dayOfWeek}: ${Number(row.rate || 0).toFixed(2)}%`),
          ...(data.chronicAbsentees || [])
            .slice(0, 10)
            .map((row: any) => `${row.studentName} (${row.className}) rate ${Number(row.attendanceRate || 0).toFixed(2)}%, consecutive absences ${row.consecutiveAbsences || 0}`),
        ],
      },
    ]);
  }
}
