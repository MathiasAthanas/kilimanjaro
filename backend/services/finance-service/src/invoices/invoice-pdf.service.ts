import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream } from 'fs';
import { dirname, join } from 'path';
import PDFDocument from 'pdfkit';

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
      const doc = new PDFDocument({ size: 'A4', margin: 48 });
      const stream = createWriteStream(fullPath);
      doc.pipe(stream);

      doc.fontSize(20).text('KILIMANJARO SCHOOLS', { align: 'center' });
      doc.fontSize(14).text('FEE INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(11).text(`Invoice Number: ${invoice.invoiceNumber}`);
      doc.text(`Student: ${invoice.studentName} (${invoice.registrationNumber})`);
      doc.text(`Class: ${invoice.className}`);
      doc.text(`Term: ${invoice.termId}  Year: ${invoice.academicYearId}`);
      doc.text(`Due Date: ${invoice.dueDate.toISOString().slice(0, 10)}`);

      doc.moveDown();
      for (const item of invoice.lineItems) {
        doc.text(`${item.feeCategoryName} - ${item.amount} TZS`);
      }
      doc.moveDown();
      doc.text(`Total: ${invoice.totalAmount} TZS`);
      doc.text(`Paid: ${invoice.paidAmount} TZS`);
      doc.text(`Outstanding: ${invoice.outstandingBalance} TZS`);

      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    return `invoices/${fileName}`;
  }
}
