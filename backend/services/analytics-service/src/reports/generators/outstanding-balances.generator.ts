import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class OutstandingBalancesGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'Outstanding Balances Report', [
      {
        heading: 'Overdue Analysis',
        rows: [
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0],
        ],
      },
      {
        heading: 'Top Defaulters',
        rows: (data.topDefaulters || []).slice(0, 10).map((row: any) => [row.studentName, row.outstandingBalance?.toString?.() ?? '0']),
      },
    ]);
  }
}
