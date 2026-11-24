import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { num, pct } from './report.format';

@Injectable()
export class BoardExecutiveGenerator {
  async generate(filePath: string, data: any) {
    const health = num(data.institutionalHealth?.overallScore);
    const collection = num(data.keyMetrics?.feeCollectionRate);
    const attendance = num(data.keyMetrics?.schoolAttendanceRate);
    const boardActions = [
      health < 75
        ? `Institutional health is ${pct(health)}; board should require a recovery plan with accountable owners.`
        : `Institutional health is ${pct(health)}, with no immediate institution-wide crisis signal.`,
      collection < 80
        ? `Fee collection is below target at ${pct(collection)}; finance risk should remain on the board agenda.`
        : `Fee collection is ${pct(collection)}, within the acceptable board monitoring range.`,
      attendance < 90
        ? `Attendance is ${pct(attendance)}; student welfare and class monitoring need board visibility.`
        : `Attendance is ${pct(attendance)}, supporting stable academic delivery.`,
    ];

    await createReport(filePath, 'Board Executive Report', [
      {
        heading: 'Board-Level Interpretation',
        rows: [
          ['Institutional Health', data.institutionalHealth?.overallScore ?? 0, 'percent'],
          ['Pass Rate', data.keyMetrics?.overallPassRate ?? 0, 'percent'],
          ['Collection Rate', data.keyMetrics?.feeCollectionRate ?? 0, 'percent'],
          ['Attendance Rate', data.keyMetrics?.schoolAttendanceRate ?? 0, 'percent'],
        ],
        bullets: boardActions,
      },
      {
        heading: 'Institutional Health',
        rows: [
          ['Overall Score', data.institutionalHealth?.overallScore ?? 0, 'percent'],
          ['Trend', data.institutionalHealth?.trend ?? 'N/A', 'text'],
        ],
      },
      {
        heading: 'Key Metrics',
        rows: [
          ['Total Students', data.keyMetrics?.totalStudents ?? 0, 'int'],
          ['Enrolment Growth Rate', data.keyMetrics?.enrolmentGrowthRate ?? 0, 'percent'],
          ['Pass Rate', data.keyMetrics?.overallPassRate ?? 0, 'percent'],
          ['Collection Rate', data.keyMetrics?.feeCollectionRate ?? 0, 'percent'],
          ['Attendance Rate', data.keyMetrics?.schoolAttendanceRate ?? 0, 'percent'],
          ['Staff Count', data.keyMetrics?.staffCount ?? 0, 'int'],
        ],
      },
      {
        heading: 'Financial & Academic Summary',
        rows: [
          ['Annual Revenue Forecast', data.financialSummary?.annualRevenueForecast?.toString?.() ?? 0, 'money'],
          ['Collected To Date', data.financialSummary?.collectedToDate?.toString?.() ?? 0, 'money'],
          ['Asset Value', data.financialSummary?.totalAssetValue?.toString?.() ?? 0, 'money'],
          ['Top Performing Class', data.academicSummary?.topPerformingClass ?? 'N/A', 'text'],
          ['Bottom Performing Class', data.academicSummary?.bottomPerformingClass ?? 'N/A', 'text'],
          ['At Risk Student %', data.academicSummary?.atRiskStudentPercentage ?? 0, 'percent'],
        ],
        bullets: (data.academicSummary?.subjectsNeedingAttention || []).map((item: string) => `Subject needing attention: ${item}.`),
      },
      {
        heading: 'Governance',
        rows: [
          ['Results Published On Time', data.complianceAndGovernance?.resultsPublishedOnTime ?? 0, 'percent'],
          ['Financial Audits Clean', data.complianceAndGovernance?.financialAuditsClean ? 'YES' : 'NO', 'text'],
          ['All Classes Have Teachers', data.complianceAndGovernance?.allClassesHaveTeachers ? 'YES' : 'NO', 'text'],
        ],
      },
      {
        heading: 'Year-over-Year',
        rows: [['Comparison Points', (data.yearOverYearComparison || []).length, 'int']],
        tables: [
          {
            columns: [
              { header: 'Year' },
              { header: 'Students', kind: 'int' },
              { header: 'Pass rate %', kind: 'percent' },
              { header: 'Collection %', kind: 'percent' },
              { header: 'Attendance %', kind: 'percent' },
            ],
            rows: (data.yearOverYearComparison || []).map((row: any) => [row.year, num(row.students), num(row.passRate), num(row.collectionRate), num(row.attendanceRate)]),
          },
        ],
      },
    ]);
  }
}
