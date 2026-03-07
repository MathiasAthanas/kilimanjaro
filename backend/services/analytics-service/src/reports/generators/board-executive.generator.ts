import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class BoardExecutiveGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'Board Executive Report', [
      {
        heading: 'Institutional Health',
        rows: [
          ['Overall Score', data.institutionalHealth?.overallScore ?? 0],
          ['Trend', data.institutionalHealth?.trend ?? 'N/A'],
        ],
      },
      {
        heading: 'Key Metrics',
        rows: [
          ['Total Students', data.keyMetrics?.totalStudents ?? 0],
          ['Pass Rate', data.keyMetrics?.overallPassRate ?? 0],
          ['Collection Rate', data.keyMetrics?.feeCollectionRate ?? 0],
          ['Attendance Rate', data.keyMetrics?.schoolAttendanceRate ?? 0],
        ],
      },
      {
        heading: 'Governance',
        rows: [
          ['Results Published On Time', data.complianceAndGovernance?.resultsPublishedOnTime ?? 0],
          ['Financial Audits Clean', data.complianceAndGovernance?.financialAuditsClean ? 'YES' : 'NO'],
          ['All Classes Have Teachers', data.complianceAndGovernance?.allClassesHaveTeachers ? 'YES' : 'NO'],
        ],
      },
    ]);
  }
}
