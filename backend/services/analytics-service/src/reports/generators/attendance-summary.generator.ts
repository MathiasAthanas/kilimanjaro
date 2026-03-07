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
      },
      {
        heading: 'Correlation',
        rows: [
          ['Attendance vs Performance', data.attendanceVsPerformanceCorrelation?.correlation ?? 0],
          ['Interpretation', data.attendanceVsPerformanceCorrelation?.interpretation ?? 'N/A'],
        ],
      },
    ]);
  }
}
