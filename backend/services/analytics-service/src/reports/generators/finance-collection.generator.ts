import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class FinanceCollectionGenerator {
  async generate(filePath: string, data: any) {
    const money = (v: any) => `TZS ${Number(v?.toString?.() ?? v ?? 0).toLocaleString('en-US')}`;
    const rate = Number(data.billing?.collectionRate ?? 0);
    const overdueAmount = Number(data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0);
    const financeActions = [
      rate < 80
        ? `Collection is below the 80% management threshold at ${rate.toFixed(2)}%; prioritize classes and categories with the largest gap.`
        : `Collection rate is ${rate.toFixed(2)}%, which is within the expected operating range.`,
      overdueAmount > 0
        ? `${money(overdueAmount)} is overdue; assign daily follow-up owners and review payment plans for top balances.`
        : 'No overdue balance is currently recorded for the selected period.',
      (data.topDefaulters || []).length
        ? `${(data.topDefaulters || []).length} high-risk defaulter records are listed for executive follow-up.`
        : 'No defaulter records were returned for this period.',
    ];

    const categoryBullets = (data.byFeeCategory || [])
      .slice(0, 10)
      .map(
        (row: any) =>
          `${row.categoryName}: billed ${money(row.totalBilled)}, collected ${money(row.totalCollected)}, outstanding ${money(row.outstandingAmount)}, collection ${Number(row.collectionRate || 0).toFixed(2)}%.`,
      );
    const classBullets = (data.byClass || [])
      .slice(0, 10)
      .map((row: any) => `${row.className}${row.stream ? ` ${row.stream}` : ''}: ${Number(row.collectionRate || 0).toFixed(2)}% collected, ${money(row.totalCollected)} received, ${row.overdueCount || 0} overdue invoices.`);
    const trendBullets = (data.collectionTrend || [])
      .slice(-6)
      .map((row: any) => `${row.period}: ${Number(row.rate || 0).toFixed(2)}% collection (${money(row.collected)} collected against ${money(row.billed)} billed).`);
    const methodBullets = (data.byPaymentMethod || [])
      .slice(0, 8)
      .map((row: any) => `${String(row.method || 'Unknown').replaceAll('_', ' ')}: ${money(row.totalAmount)} across ${row.transactionCount || 0} transactions; average ${money(row.averageTransactionAmount)}.`);
    const dailyBullets = (data.dailyCollectionThisMonth || [])
      .slice(-10)
      .map((row: any) => `${row.date}: ${money(row.amount)} from ${row.transactionCount || 0} transactions.`);

    await createPdf(filePath, 'Finance Collection Report', [
      {
        heading: 'Executive Finance Interpretation',
        rows: [
          ['Collection Rate', data.billing?.collectionRate ?? 0],
          ['Outstanding Exposure', data.billing?.totalOutstanding?.toString?.() ?? 0],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0],
          ['Confirmed Payment Channels', (data.byPaymentMethod || []).length],
        ],
        bullets: financeActions,
      },
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
        bullets: [...categoryBullets, ...classBullets],
      },
      {
        heading: 'Payment Channels & Daily Cashflow',
        rows: [
          ['Payment Methods Used', (data.byPaymentMethod || []).length],
          ['Collection Days This Month', (data.dailyCollectionThisMonth || []).length],
        ],
        bullets: [...methodBullets, ...dailyBullets],
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
            .map((row: any) => `${row.studentName} (${row.className}) outstanding ${money(row.outstandingBalance)}, overdue ${row.daysOverdue || 0} days.`),
        ],
      },
    ]);
  }
}
