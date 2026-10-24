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
export class ReceiptPdfService {
  constructor(private readonly configService: ConfigService) {}

  async generate(input: {
    receiptNumber: string;
    paymentDate: Date;
    paymentMethod: string;
    referenceNumber?: string | null;
    studentName: string;
    registrationNumber: string;
    className: string;
    academicYearId: string;
    termId: string;
    termName?: string | null;
    academicYearName?: string | null;
    invoiceNumber?: string | null;
    school?: SchoolProfile | null;
    lineItems: Array<{ feeCategoryName: string; amount: string }>;
    previousBalance: string;
    amountPaid: string;
    remainingBalance: string;
    issuedByName: string;
    issuedAt: Date;
    voided?: boolean;
  }): Promise<string> {
    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    const fileName = `receipt_${input.receiptNumber}.pdf`;
    const fullPath = join(root, 'receipts', fileName);

    mkdirSync(dirname(fullPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = newDocument();
      const stream = createWriteStream(fullPath);
      doc.pipe(stream);

      let y = letterhead(doc, input.school, 'Official receipt', input.receiptNumber, {
        text: input.voided ? 'Void' : 'Paid',
        color: input.voided ? PDF_COLORS.SLATE : PDF_COLORS.GREEN,
      });

      const term = [input.termName, input.academicYearName].filter(Boolean).join(' · ');
      y = keyValues(
        doc,
        [
          ['Received from / for', input.studentName],
          ['Registration number', input.registrationNumber],
          ['Class', input.className],
          ['Term', term],
          ['Payment date', fmtDate(input.paymentDate)],
          ['Payment method', titleCase(input.paymentMethod)],
          ['Reference', input.referenceNumber || '—'],
          ['Invoice', input.invoiceNumber || '—'],
        ],
        y,
      );

      y = lineTable(doc, input.lineItems.map((item) => ({ label: item.feeCategoryName, amount: item.amount })), y + 8);
      totalsBlock(
        doc,
        [
          { label: 'Balance before payment', value: money(input.previousBalance) },
          { label: 'Amount received', value: money(input.amountPaid), strong: true, color: PDF_COLORS.GREEN },
          { label: 'Balance remaining', value: money(input.remainingBalance), color: Number(input.remainingBalance) > 0 ? PDF_COLORS.RED : PDF_COLORS.GREEN },
        ],
        y,
      );

      footer(doc, `${input.school?.name ?? 'School'} · Receipt ${input.receiptNumber} · Issued ${fmtDate(input.issuedAt)} by ${input.issuedByName}`);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    return `receipts/${fileName}`;
  }
}
