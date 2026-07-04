import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class BoardExecutiveGenerator {
  async generate(filePath: string, data: any) {
    const health = Number(data.institutionalHealth?.overallScore ?? 0);
    const collection = Number(data.keyMetrics?.feeCollectionRate ?? 0);
    const attendance = Number(data.keyMetrics?.schoolAttendanceRate ?? 0);
    const boardActions = [
      health < 75
        ? `Institutional health is ${health.toFixed(2)}%; board should require a recovery plan with accountable owners.`
        : `Institutional health is ${health.toFixed(2)}%, with no immediate institution-wide crisis signal.`,
      collection < 80
        ? `Fee collection is below target at ${collection.toFixed(2)}%; finance risk should remain on the board agenda.`
        : `Fee collection is ${collection.toFixed(2)}%, within the acceptable board monitoring range.`,
      attendance < 90
        ? `Attendance is ${attendance.toFixed(2)}%; student welfare and class monitoring need board visibility.`
        : `Attendance is ${attendance.toFixed(2)}%, supporting stable academic delivery.`,
    ];

    await createPdf(filePath, 'Board Executive Report', [
      {
        heading: 'Board-Level Interpretation',
        rows: [
          ['Institutional Health', data.institutionalHealth?.overallScore ?? 0],
          ['Pass Rate', data.keyMetrics?.overallPassRate ?? 0],
          ['Collection Rate', data.keyMetrics?.feeCollectionRate ?? 0],
          ['Attendance Rate', data.keyMetrics?.schoolAttendanceRate ?? 0],
        ],
        bullets: boardActions,
      },
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
          ['Enrolment Growth Rate', data.keyMetrics?.enrolmentGrowthRate ?? 0],
          ['Pass Rate', data.keyMetrics?.overallPassRate ?? 0],
          ['Collection Rate', data.keyMetrics?.feeCollectionRate ?? 0],
          ['Attendance Rate', data.keyMetrics?.schoolAttendanceRate ?? 0],
          ['Staff Count', data.keyMetrics?.staffCount ?? 0],
        ],
      },
      {
        heading: 'Financial & Academic Summary',
        rows: [
          ['Annual Revenue Forecast', data.financialSummary?.annualRevenueForecast?.toString?.() ?? 0],
          ['Collected To Date', data.financialSummary?.collectedToDate?.toString?.() ?? 0],
          ['Asset Value', data.financialSummary?.totalAssetValue?.toString?.() ?? 0],
          ['Top Performing Class', data.academicSummary?.topPerformingClass ?? 'N/A'],
          ['Bottom Performing Class', data.academicSummary?.bottomPerformingClass ?? 'N/A'],
          ['At Risk Student %', data.academicSummary?.atRiskStudentPercentage ?? 0],
        ],
        bullets: [
          ...(data.academicSummary?.subjectsNeedingAttention || []).map((item: string) => `Subject needing attention: ${item}.`),
          `Top performing class: ${data.academicSummary?.topPerformingClass || 'Not available'}.`,
          `Lowest performing class: ${data.academicSummary?.bottomPerformingClass || 'Not available'}.`,
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
      {
        heading: 'Year-over-Year',
        rows: [['Comparison Points', (data.yearOverYearComparison || []).length]],
        bullets: (data.yearOverYearComparison || []).map(
          (row: any) =>
            `${row.year}: students ${row.students || 0}, pass ${Number(row.passRate || 0).toFixed(2)}%, collection ${Number(row.collectionRate || 0).toFixed(2)}%, attendance ${Number(row.attendanceRate || 0).toFixed(2)}%`,
        ),
      },
    ]);
  }
}
