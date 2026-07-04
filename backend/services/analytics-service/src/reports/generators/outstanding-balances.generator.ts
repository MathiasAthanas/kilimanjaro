import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class OutstandingBalancesGenerator {
  async generate(filePath: string, data: any) {
    const money = (v: any) => `TZS ${Number(v?.toString?.() ?? v ?? 0).toLocaleString('en-US')}`;
    const overdueAmount = Number(data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0);
    const outstanding = Number(data.billing?.totalOutstanding?.toString?.() ?? 0);
    const actions = [
      outstanding > 0
        ? `${money(outstanding)} remains outstanding; split follow-up by class teacher, finance officer, and guardian contact status.`
        : 'No outstanding balance is currently recorded.',
      overdueAmount > 0
        ? `${money(overdueAmount)} is already overdue and should be separated from ordinary outstanding balances.`
        : 'No overdue amount is currently recorded.',
      (data.topDefaulters || []).length
        ? 'Top defaulters should receive written payment plans with dated commitments.'
        : 'No top defaulter records were returned for this period.',
    ];

    await createPdf(filePath, 'Outstanding Balances Report', [
      {
        heading: 'Executive Collections Risk',
        rows: [
          ['Total Outstanding', data.billing?.totalOutstanding?.toString?.() ?? 0],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0],
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0],
          ['Collection Rate', data.billing?.collectionRate ?? 0],
        ],
        bullets: actions,
      },
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
        bullets: (data.overdueAnalysis?.byDaysOverdue || []).map((row: any) => `${row.bucket}: ${row.count || 0} invoices totaling ${money(row.amount)}.`),
      },
      {
        heading: 'Top Defaulters',
        rows: (data.topDefaulters || []).slice(0, 10).map((row: any) => [row.studentName, row.outstandingBalance?.toString?.() ?? '0']),
        bullets: (data.topDefaulters || [])
          .slice(0, 10)
          .map((row: any) => `${row.studentName} (${row.className}) has ${money(row.outstandingBalance)} outstanding and is overdue ${row.daysOverdue || 0} days.`),
      },
    ]);
  }
}
