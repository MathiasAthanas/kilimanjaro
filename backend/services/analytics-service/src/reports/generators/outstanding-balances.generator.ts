import { Injectable } from '@nestjs/common';
import { createReport } from './pdf.helper';
import { formatClassLabel } from '../../common/helpers/class-label.helper';
import { num, tzs } from './report.format';

@Injectable()
export class OutstandingBalancesGenerator {
  /** `list` is every invoice that still owes money (see FinanceAnalyticsService.getOutstandingList). */
  async generate(filePath: string, data: any, list: any[] = []) {
    const overdueAmount = num(data.overdueAnalysis?.overdueAmount);
    const outstanding = num(data.billing?.totalOutstanding);
    const actions = [
      outstanding > 0
        ? `${tzs(outstanding)} remains outstanding across ${list.length || 'the listed'} invoices; split follow-up by class teacher, finance officer, and guardian contact status.`
        : 'No outstanding balance is currently recorded.',
      overdueAmount > 0
        ? `${tzs(overdueAmount)} is already overdue and should be separated from ordinary outstanding balances.`
        : 'No overdue amount is currently recorded.',
      list.length
        ? 'Learners with the largest balances should receive written payment plans with dated commitments.'
        : 'No learners with an unpaid balance were returned for this period.',
    ];

    await createReport(filePath, 'Outstanding Balances Report', [
      {
        heading: 'Executive Collections Risk',
        rows: [
          ['Total Outstanding', data.billing?.totalOutstanding?.toString?.() ?? 0, 'money'],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0, 'money'],
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0, 'int'],
          ['Collection Rate', data.billing?.collectionRate ?? 0, 'percent'],
        ],
        bullets: actions,
      },
      {
        heading: 'Billing Health',
        rows: [
          ['Total Invoiced', data.billing?.totalInvoiced?.toString?.() ?? 0, 'money'],
          ['Total Collected', data.billing?.totalCollected?.toString?.() ?? 0, 'money'],
          ['Total Outstanding', data.billing?.totalOutstanding?.toString?.() ?? 0, 'money'],
          ['Collection Rate (%)', data.billing?.collectionRate ?? 0, 'percent'],
        ],
      },
      {
        heading: 'Overdue Analysis',
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
        heading: 'Learners With Unpaid Balances',
        rows: [['Invoices With A Balance', list.length, 'int']],
        tables: [
          {
            columns: [
              { header: 'Learner', weight: 2 },
              { header: 'Reg. no.', kind: 'text', weight: 1.7 },
              { header: 'Class', weight: 1.1 },
              { header: 'Invoice', kind: 'text', weight: 1.6 },
              { header: 'Total', kind: 'money' },
              { header: 'Paid', kind: 'money' },
              { header: 'Balance', kind: 'money' },
              { header: 'Days overdue', kind: 'int', weight: 0.9 },
            ],
            rows: list.map((row) => [
              row.studentName,
              row.registrationNumber,
              formatClassLabel(row.className, row.stream),
              row.invoiceNumber,
              num(row.totalAmount),
              num(row.paidAmount),
              num(row.outstandingBalance),
              num(row.daysOverdue),
            ]),
          },
        ],
      },
    ]);
  }
}
