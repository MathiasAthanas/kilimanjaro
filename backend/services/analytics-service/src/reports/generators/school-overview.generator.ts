import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class SchoolOverviewGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'School Overview Report', [
      {
        heading: 'Enrolment',
        rows: [
          ['Total Students', data.enrolment?.totalStudents ?? 0],
          ['Active Students', data.enrolment?.activeStudents ?? 0],
          ['New Admissions This Year', data.enrolment?.newAdmissionsThisYear ?? 0],
        ],
      },
      {
        heading: 'Academic',
        rows: [
          ['Overall Pass Rate', data.academic?.overallPassRate ?? 0],
          ['School Average', data.academic?.schoolAverage ?? 0],
          ['At Risk Students', data.academic?.atRiskStudentCount ?? 0],
        ],
      },
      {
        heading: 'Finance',
        rows: [
          ['Total Billed', data.finance?.totalBilledThisTerm?.toString?.() ?? 0],
          ['Total Collected', data.finance?.totalCollectedThisTerm?.toString?.() ?? 0],
          ['Collection Rate', data.finance?.collectionRateThisTerm ?? 0],
        ],
      },
      {
        heading: 'Attendance',
        rows: [
          ['Attendance Rate', data.attendance?.schoolAttendanceRate ?? 0],
          ['Classes Below 80%', data.attendance?.classesBelow80Percent ?? 0],
        ],
      },
    ]);
  }
}
