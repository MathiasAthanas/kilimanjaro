import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class StudentProfileGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, `Student Profile - ${data.student?.fullName || 'Student'}`, [
      {
        heading: 'Identity',
        rows: [
          ['Student ID', data.student?.id || 'N/A'],
          ['Registration Number', data.student?.registrationNumber || 'N/A'],
          ['Class', data.student?.currentClass?.className || 'N/A'],
        ],
      },
      {
        heading: 'Academic',
        rows: [
          ['Overall Average', data.academic?.currentTermSummary?.overallAverage ?? 0],
          ['Grade', data.academic?.currentTermSummary?.overallGrade ?? 'N/A'],
          ['Projected Grade', data.academic?.projectedGrade ?? 'N/A'],
          ['Subject Count', data.academic?.currentTermSummary?.subjectCount ?? 0],
          ['Failing Subjects', data.academic?.currentTermSummary?.failingSubjectCount ?? 0],
        ],
        bullets: (data.academic?.subjectBreakdown || [])
          .slice(0, 10)
          .map((row: any) => `${row.subjectName}: ${Number(row.score || row.weightedTotal || 0).toFixed(2)} (${row.grade || 'N/A'})`),
      },
      {
        heading: 'Attendance',
        rows: [
          ['Current Term Rate', data.attendance?.currentTerm?.rate ?? 0],
          ['Overall Rate', data.attendance?.overallRate ?? 0],
          ['Current Streak', data.attendance?.streak?.currentPresentStreak ?? 0],
          ['Longest Streak', data.attendance?.streak?.longestPresentStreak ?? 0],
        ],
      },
      {
        heading: 'Financial',
        rows: [
          ['Outstanding', data.financial?.totalOutstandingAllTime?.toString?.() ?? 0],
          ['Payment Behavior', data.financial?.paymentBehavior ?? 'N/A'],
          ['Collection Compliance', data.financial?.collectionComplianceScore ?? 0],
        ],
      },
      {
        heading: 'Summary',
        rows: [
          ['Overall Status', data.summaryCard?.overallStatus ?? 'N/A'],
          ['Risk Level', data.summaryCard?.riskLevel ?? 'N/A'],
          ['Next Step', (data.summaryCard?.nextSteps || [])[0] || 'N/A'],
        ],
        bullets: [
          ...(data.summaryCard?.recommendedActions || []).slice(0, 8).map((row: string) => `Action: ${row}`),
          ...(data.performanceEngine?.activeAlerts || [])
            .slice(0, 5)
            .map((row: any) => `Alert: ${row.alertType || 'N/A'} (${row.severity || 'N/A'}) ${row.subjectName || ''}`),
        ],
      },
    ]);
  }
}
