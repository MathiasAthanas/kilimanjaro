import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class OutstandingBalancesGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'Outstanding Balances Report', [
      {
        heading: 'Billing Health',
        rows: [
          ['Total Invoiced', data.billing?.totalInvoiced?.toString?.() ?? 0],
          ['Total Collected', data.billing?.totalCollected?.toString?.() ?? 0],
          ['Total Outstanding', data.billing?.totalOutstanding?.toString?.() ?? 0],
          ['Collection Rate (%)', data.billing?.collectionRate ?? 0],
        ],
      },
      {
        heading: 'Overdue Analysis',
        rows: [
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0],
        ],
        bullets: (data.overdueAnalysis?.byDaysOverdue || []).map((row: any) => `${row.bucket}: ${row.count || 0} invoices (${row.amount?.toString?.() ?? 0})`),
      },
      {
        heading: 'Top Defaulters',
        rows: (data.topDefaulters || []).slice(0, 10).map((row: any) => [row.studentName, row.outstandingBalance?.toString?.() ?? '0']),
        bullets: (data.topDefaulters || [])
          .slice(0, 10)
          .map((row: any) => `${row.studentName} (${row.className}) overdue ${row.daysOverdue || 0} days`),
      },
    ]);
  }
}
