import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import {
  PDF_COLORS,
  SchoolProfile,
  fmtDate,
  footer,
  keyValues,
  letterhead,
  lineTable,
  money,
  newDocument,
  titleCase,
  totalsBlock,
} from '../common/pdf/pdf-layout';

@Injectable()
export class InvoicePdfService {
  constructor(private readonly configService: ConfigService) {}

  async generate(invoice: {
    invoiceNumber: string;
    studentName: string;
    registrationNumber: string;
    className: string;
    termId: string;
    academicYearId: string;
    termName?: string | null;
    academicYearName?: string | null;
    school?: SchoolProfile | null;
    status?: string;
    lineItems: Array<{ feeCategoryName: string; amount: string }>;
    totalAmount: string;
    paidAmount: string;
    outstandingBalance: string;
    dueDate: Date;
  }): Promise<string> {
    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    const fileName = `invoice_${invoice.invoiceNumber}.pdf`;
    const fullPath = join(root, 'invoices', fileName);

    mkdirSync(dirname(fullPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = newDocument();
      const stream = createWriteStream(fullPath);
      doc.pipe(stream);

      const status = invoice.status ?? 'ISSUED';
      const badgeColor =
        status === 'PAID' ? PDF_COLORS.GREEN : status === 'OVERDUE' ? PDF_COLORS.RED : status === 'CANCELLED' ? PDF_COLORS.SLATE : PDF_COLORS.AMBER;
      let y = letterhead(doc, invoice.school, 'Fee invoice', invoice.invoiceNumber, {
        text: status === 'PARTIALLY_PAID' ? 'Part paid' : titleCase(status),
        color: badgeColor,
      });

      const term = [invoice.termName, invoice.academicYearName].filter(Boolean).join(' · ');
      y = keyValues(
        doc,
        [
          ['Student', invoice.studentName],
          ['Registration number', invoice.registrationNumber],
          ['Class', invoice.className],
          ['Term', term],
          ['Due date', fmtDate(invoice.dueDate)],
        ],
        y,
      );

      y = lineTable(doc, invoice.lineItems.map((item) => ({ label: item.feeCategoryName, amount: item.amount })), y + 8);
      totalsBlock(
        doc,
        [
          { label: 'Total', value: money(invoice.totalAmount) },
          { label: 'Paid', value: money(invoice.paidAmount), color: PDF_COLORS.GREEN },
          {
            label: 'Outstanding',
            value: money(invoice.outstandingBalance),
            strong: true,
            color: Number(invoice.outstandingBalance) > 0 ? PDF_COLORS.RED : PDF_COLORS.GREEN,
          },
        ],
        y,
      );

      footer(doc, `${invoice.school?.name ?? 'School'} · Invoice ${invoice.invoiceNumber} · Generated ${fmtDate(new Date())}`);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    return `invoices/${fileName}`;
  }
}
