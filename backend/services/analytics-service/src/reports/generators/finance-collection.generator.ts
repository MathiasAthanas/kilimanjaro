import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class FinanceCollectionGenerator {
  async generate(filePath: string, data: any) {
    const categoryBullets = (data.byFeeCategory || [])
      .slice(0, 10)
      .map(
        (row: any) =>
          `${row.categoryName}: billed=${row.totalBilled?.toString?.() ?? 0}, collected=${row.totalCollected?.toString?.() ?? 0}, rate=${Number(row.collectionRate || 0).toFixed(2)}%`,
      );
    const classBullets = (data.byClass || [])
      .slice(0, 10)
      .map((row: any) => `${row.className}${row.stream ? ` ${row.stream}` : ''}: ${Number(row.collectionRate || 0).toFixed(2)}% (${row.overdueCount || 0} overdue)`);
    const trendBullets = (data.collectionTrend || [])
      .slice(-6)
      .map((row: any) => `${row.period}: ${Number(row.rate || 0).toFixed(2)}% (billed=${row.billed?.toString?.() ?? 0}, collected=${row.collected?.toString?.() ?? 0})`);
    await createPdf(filePath, 'Finance Collection Report', [
      {
        heading: 'Billing',
        rows: [
          ['Total Invoiced', data.billing?.totalInvoiced?.toString?.() ?? 0],
          ['Total Collected', data.billing?.totalCollected?.toString?.() ?? 0],
          ['Total Outstanding', data.billing?.totalOutstanding?.toString?.() ?? 0],
          ['Collection Rate', data.billing?.collectionRate ?? 0],
          ['Waived Amount', data.billing?.waivedAmount?.toString?.() ?? 0],
          ['Discounted Amount', data.billing?.discountedAmount?.toString?.() ?? 0],
        ],
      },
      {
        heading: 'Overdue',
        rows: [
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0],
        ],
        bullets: (data.overdueAnalysis?.byDaysOverdue || []).map((row: any) => `${row.bucket}: ${row.count || 0} invoices (${row.amount?.toString?.() ?? 0})`),
      },
      {
        heading: 'Collections Breakdown',
        rows: [
          ['Fee Categories Included', (data.byFeeCategory || []).length],
          ['Classes Included', (data.byClass || []).length],
          ['Payment Methods Used', (data.byPaymentMethod || []).length],
        ],
        bullets: [...categoryBullets, ...classBullets.slice(0, 5)],
      },
      {
        heading: 'Trend & Defaulters',
        rows: [
          ['Collection Period Points', (data.collectionTrend || []).length],
          ['Top Defaulters Listed', (data.topDefaulters || []).length],
        ],
        bullets: [
          ...trendBullets,
          ...(data.topDefaulters || [])
            .slice(0, 10)
            .map((row: any) => `Defaulter: ${row.studentName} (${row.className}) outstanding=${row.outstandingBalance?.toString?.() ?? 0}, overdue=${row.daysOverdue || 0} days`),
        ],
      },
    ]);
  }
}
