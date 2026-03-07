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
        ],
      },
      {
        heading: 'Attendance',
        rows: [['Current Term Rate', data.attendance?.currentTerm?.rate ?? 0], ['Overall Rate', data.attendance?.overallRate ?? 0]],
      },
      {
        heading: 'Financial',
        rows: [
          ['Outstanding', data.financial?.totalOutstandingAllTime?.toString?.() ?? 0],
          ['Payment Behavior', data.financial?.paymentBehavior ?? 'N/A'],
        ],
      },
      {
        heading: 'Summary',
        rows: [['Overall Status', data.summaryCard?.overallStatus ?? 'N/A'], ['Next Step', (data.summaryCard?.nextSteps || [])[0] || 'N/A']],
      },
    ]);
  }
}
