import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { formatClassLabel } from '../../common/helpers/class-label.helper';
import { num, pct, tzs } from './report.format';

@Injectable()
export class FinanceCollectionGenerator {
  async generate(filePath: string, data: any) {
    const rate = num(data.billing?.collectionRate);
    const overdueAmount = num(data.overdueAnalysis?.overdueAmount);
    const defaulters: any[] = data.topDefaulters || [];
    const financeActions = [
      rate < 80
        ? `Collection is below the 80% management threshold at ${pct(rate)}; prioritize classes and categories with the largest gap.`
        : `Collection rate is ${pct(rate)}, which is within the expected operating range.`,
      overdueAmount > 0
        ? `${tzs(overdueAmount)} is overdue; assign daily follow-up owners and review payment plans for top balances.`
        : 'No overdue balance is currently recorded for the selected period.',
      defaulters.length
        ? `${defaulters.length} high-risk defaulter records are listed for executive follow-up.`
        : 'No defaulter records were returned for this period.',
    ];

    await createReport(filePath, 'Finance Collection Report', [
      {
        heading: 'Executive Finance Interpretation',
        rows: [
          ['Collection Rate', data.billing?.collectionRate ?? 0, 'percent'],
          ['Outstanding Exposure', data.billing?.totalOutstanding?.toString?.() ?? 0, 'money'],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0, 'money'],
          ['Confirmed Payment Channels', (data.byPaymentMethod || []).length, 'int'],
        ],
        bullets: financeActions,
      },
      {
        heading: 'Billing',
        rows: [
          ['Total Invoiced', data.billing?.totalInvoiced?.toString?.() ?? 0, 'money'],
          ['Total Collected', data.billing?.totalCollected?.toString?.() ?? 0, 'money'],
          ['Total Outstanding', data.billing?.totalOutstanding?.toString?.() ?? 0, 'money'],
          ['Collection Rate', data.billing?.collectionRate ?? 0, 'percent'],
          ['Waived Amount', data.billing?.waivedAmount?.toString?.() ?? 0, 'money'],
          ['Discounted Amount', data.billing?.discountedAmount?.toString?.() ?? 0, 'money'],
        ],
      },
      {
        heading: 'Overdue',
        rows: [
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0, 'int'],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0, 'money'],
        ],
        tables: [
          {
            title: 'Overdue by age',
            columns: [{ header: 'Age' }, { header: 'Invoices', kind: 'int' }, { header: 'Amount', kind: 'money' }],
            rows: (data.overdueAnalysis?.byDaysOverdue || []).map((row: any) => [row.bucket, num(row.count), num(row.amount)]),
          },
        ],
      },
      {
        heading: 'Collections Breakdown',
        rows: [
          ['Fee Categories Included', (data.byFeeCategory || []).length, 'int'],
          ['Classes Included', (data.byClass || []).length, 'int'],
          ['Payment Methods Used', (data.byPaymentMethod || []).length, 'int'],
        ],
        tables: [
          {
            title: 'By fee category',
            columns: [
              { header: 'Fee category', weight: 2.4 },
              { header: 'Billed', kind: 'money' },
              { header: 'Collected', kind: 'money' },
              { header: 'Outstanding', kind: 'money' },
              { header: 'Collected %', kind: 'percent', weight: 0.8 },
            ],
            rows: (data.byFeeCategory || []).map((row: any) => [row.categoryName, num(row.totalBilled), num(row.totalCollected), num(row.outstandingAmount), num(row.collectionRate)]),
          },
          {
            title: 'By class',
            columns: [
              { header: 'Class', weight: 1.8 },
              { header: 'Billed', kind: 'money' },
              { header: 'Collected', kind: 'money' },
              { header: 'Collected %', kind: 'percent', weight: 0.8 },
              { header: 'Overdue', kind: 'int', weight: 0.7 },
            ],
            rows: (data.byClass || []).map((row: any) => [formatClassLabel(row.className, row.stream), num(row.totalBilled), num(row.totalCollected), num(row.collectionRate), num(row.overdueCount)]),
          },
        ],
      },
      {
        heading: 'Payment Channels & Daily Cashflow',
        rows: [
          ['Payment Methods Used', (data.byPaymentMethod || []).length, 'int'],
          ['Collection Days This Month', (data.dailyCollectionThisMonth || []).length, 'int'],
        ],
        tables: [
          {
            title: 'By payment method',
            columns: [{ header: 'Method' }, { header: 'Transactions', kind: 'int' }, { header: 'Amount', kind: 'money' }, { header: 'Average', kind: 'money' }],
            rows: (data.byPaymentMethod || []).map((row: any) => [String(row.method || 'Unknown').replaceAll('_', ' '), num(row.transactionCount), num(row.totalAmount), num(row.averageTransactionAmount)]),
          },
          {
            title: 'Daily collections this month',
            columns: [{ header: 'Date' }, { header: 'Transactions', kind: 'int' }, { header: 'Amount', kind: 'money' }],
            rows: (data.dailyCollectionThisMonth || []).map((row: any) => [row.date, num(row.transactionCount), num(row.amount)]),
          },
        ],
      },
      {
        heading: 'Trend & Defaulters',
        rows: [
          ['Collection Period Points', (data.collectionTrend || []).length, 'int'],
          ['Top Defaulters Listed', defaulters.length, 'int'],
        ],
        tables: [
          {
            title: 'Collection by term',
            columns: [{ header: 'Term' }, { header: 'Billed', kind: 'money' }, { header: 'Collected', kind: 'money' }, { header: 'Collected %', kind: 'percent', weight: 0.8 }],
            rows: (data.collectionTrend || []).map((row: any) => [row.period, num(row.billed), num(row.collected), num(row.rate)]),
          },
          {
            title: 'Top defaulters',
            columns: [{ header: 'Learner', weight: 2.2 }, { header: 'Class', weight: 1.4 }, { header: 'Outstanding', kind: 'money' }, { header: 'Days overdue', kind: 'int', weight: 0.8 }],
            rows: defaulters.map((row) => [row.studentName, row.className, num(row.outstandingBalance), num(row.daysOverdue)]),
          },
        ],
      },
    ]);
  }
}
