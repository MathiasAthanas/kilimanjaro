import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { num } from './report.format';

@Injectable()
export class StudentProfileGenerator {
  async generate(filePath: string, data: any) {
    await createReport(filePath, `Student Profile - ${data.student?.fullName || 'Student'}`, [
      {
        heading: 'Identity',
        rows: [
          ['Student Name', data.student?.fullName || 'N/A', 'text'],
          ['Registration Number', data.student?.registrationNumber || 'N/A', 'text'],
          ['Class', data.student?.currentClass?.className || 'N/A', 'text'],
          ['Current Status', data.summaryCard?.overallStatus ?? 'N/A', 'text'],
        ],
      },
      {
        heading: 'Academic',
        rows: [
          ['Overall Average', data.academic?.currentTermSummary?.overallAverage ?? 0, 'percent'],
          ['Grade', data.academic?.currentTermSummary?.overallGrade ?? 'N/A', 'text'],
          ['Projected Grade', data.academic?.projectedGrade ?? 'N/A', 'text'],
          ['Subject Count', data.academic?.currentTermSummary?.subjectCount ?? 0, 'int'],
          ['Failing Subjects', data.academic?.currentTermSummary?.failingSubjectCount ?? 0, 'int'],
        ],
        tables: [
          {
            title: 'Subject results',
            columns: [{ header: 'Subject' }, { header: 'Score', kind: 'decimal' }, { header: 'Grade', kind: 'text', weight: 0.7 }],
            rows: (data.academic?.subjectBreakdown || []).map((row: any) => [row.subjectName, num(row.score || row.weightedTotal), row.grade || '-']),
          },
        ],
      },
      {
        heading: 'Attendance',
        rows: [
          ['Current Term Rate', data.attendance?.currentTerm?.rate ?? 0, 'percent'],
          ['Overall Rate', data.attendance?.overallRate ?? 0, 'percent'],
          ['Current Streak (days)', data.attendance?.streak?.currentPresentStreak ?? 0, 'int'],
          ['Longest Streak (days)', data.attendance?.streak?.longestPresentStreak ?? 0, 'int'],
        ],
      },
      {
        heading: 'Financial',
        rows: [
          ['Outstanding', data.financial?.totalOutstandingAllTime?.toString?.() ?? 0, 'money'],
          ['Payment Behavior', data.financial?.paymentBehavior ?? 'N/A', 'text'],
          ['Collection Compliance', data.financial?.collectionComplianceScore ?? 0, 'percent'],
        ],
      },
      {
        heading: 'Summary',
        rows: [
          ['Overall Status', data.summaryCard?.overallStatus ?? 'N/A', 'text'],
          ['Risk Level', data.summaryCard?.riskLevel ?? 'N/A', 'text'],
          ['Next Step', (data.summaryCard?.nextSteps || [])[0] || 'N/A', 'text'],
        ],
        tables: [
          {
            title: 'Active alerts',
            columns: [{ header: 'Alert' }, { header: 'Severity', kind: 'text', weight: 1 }, { header: 'Subject' }],
            rows: (data.performanceEngine?.activeAlerts || []).map((row: any) => [row.alertType || '-', row.severity || '-', row.subjectName || '-']),
          },
        ],
        bullets: (data.summaryCard?.recommendedActions || []).map((row: string) => `Action: ${row}`),
      },
    ]);
  }
}
