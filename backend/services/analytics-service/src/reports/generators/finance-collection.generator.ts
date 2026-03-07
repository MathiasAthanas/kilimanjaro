import { Injectable } from '@nestjs/common';
import { createPdf } from './pdf.helper';

@Injectable()
export class FinanceCollectionGenerator {
  async generate(filePath: string, data: any) {
    await createPdf(filePath, 'Finance Collection Report', [
      {
        heading: 'Billing',
        rows: [
          ['Total Invoiced', data.billing?.totalInvoiced?.toString?.() ?? 0],
          ['Total Collected', data.billing?.totalCollected?.toString?.() ?? 0],
          ['Collection Rate', data.billing?.collectionRate ?? 0],
        ],
      },
      {
        heading: 'Overdue',
        rows: [
          ['Overdue Count', data.overdueAnalysis?.overdueCount ?? 0],
          ['Overdue Amount', data.overdueAnalysis?.overdueAmount?.toString?.() ?? 0],
        ],
      },
    ]);
  }
}
