import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import PDFDocument from 'pdfkit';

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
    lineItems: Array<{ feeCategoryName: string; amount: string }>;
    previousBalance: string;
    amountPaid: string;
    remainingBalance: string;
    issuedByName: string;
    issuedAt: Date;
  }): Promise<string> {
    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    const fileName = `receipt_${input.receiptNumber}.pdf`;
    const fullPath = join(root, 'receipts', fileName);

    mkdirSync(dirname(fullPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = createWriteStream(fullPath);
      doc.pipe(stream);

      doc.fontSize(20).text('KILIMANJARO SCHOOLS', { align: 'center' });
      doc.fontSize(13).text('OFFICIAL PAYMENT RECEIPT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Receipt: ${input.receiptNumber}`, { align: 'center' });

      doc.moveDown();
      doc.fontSize(11).text(`Payment Date: ${input.paymentDate.toISOString()}`);
      doc.text(`Payment Method: ${input.paymentMethod}`);
      if (input.referenceNumber) doc.text(`Reference: ${input.referenceNumber}`);
      doc.text(`Student: ${input.studentName} (${input.registrationNumber})`);
      doc.text(`Class: ${input.className}`);
      doc.text(`Academic Year: ${input.academicYearId} | Term: ${input.termId}`);

      doc.moveDown();
      for (const item of input.lineItems) {
        doc.text(`${item.feeCategoryName} - ${item.amount} TZS`);
      }

      doc.moveDown();
      doc.text(`Previous Balance: ${input.previousBalance} TZS`);
      doc.text(`Amount Paid: ${input.amountPaid} TZS`);
      doc.text(`Remaining Balance: ${input.remainingBalance} TZS`);

      doc.moveDown();
      doc.fontSize(9).text('This is an official receipt of Kilimanjaro Schools');
      doc.text(`Issued by: ${input.issuedByName} on ${input.issuedAt.toISOString()}`);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    return `receipts/${fileName}`;
  }
}
