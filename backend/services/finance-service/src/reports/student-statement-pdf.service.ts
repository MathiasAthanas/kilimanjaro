import { Injectable } from '@nestjs/common';
import {
  CONTENT_WIDTH,
  PAGE_MARGIN,
  PDF_COLORS,
  SchoolProfile,
  fmtDate,
  keyValues,
  letterhead,
  money,
  newDocument,
  titleCase,
} from '../common/pdf/pdf-layout';

export interface StatementInvoice {
  invoiceNumber: string;
  termName?: string | null;
  issuedAt?: Date | string | null;
  dueDate?: Date | string | null;
  totalAmount: unknown;
  paidAmount: unknown;
  outstandingBalance: unknown;
  status: string;
  lineItems?: Array<{ feeCategoryName?: string | null; amount: unknown }>;
  payments?: Array<{ paymentNumber?: string | null; method?: string | null; amount: unknown; status?: string | null; paidAt?: Date | string | null; referenceNumber?: string | null }>;
}

export interface StatementInput {
  school?: SchoolProfile | null;
  studentName: string;
  registrationNumber: string;
  className?: string | null;
  invoices: StatementInvoice[];
}

const BOTTOM = 790;
const num = (value: unknown) => Number(String(value ?? 0)) || 0;

/** One A4 statement per learner: every invoice with what was billed, what was paid and what is still owed. */
@Injectable()
export class StudentStatementPdfService {
  async render(input: StatementInput): Promise<Buffer> {
    const doc = newDocument();
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const invoices = [...input.invoices].sort((a, b) => new Date(a.issuedAt ?? 0).getTime() - new Date(b.issuedAt ?? 0).getTime());
    const live = invoices.filter((invoice) => invoice.status !== 'CANCELLED');
    const totalBilled = live.reduce((sum, invoice) => sum + num(invoice.totalAmount), 0);
    const totalPaid = live.reduce((sum, invoice) => sum + num(invoice.paidAmount), 0);
    const totalDue = live.reduce((sum, invoice) => sum + num(invoice.outstandingBalance), 0);

    let y = letterhead(doc, input.school, 'Fee statement', input.registrationNumber || 'Statement');
    y = keyValues(
      doc,
      [
        ['Learner', input.studentName],
        ['Registration number', input.registrationNumber],
        ['Class', input.className ?? '—'],
        ['Statement date', fmtDate(new Date())],
      ],
      y,
    );

    // Summary strip
    const cardW = (CONTENT_WIDTH - 20) / 3;
    [
      ['Total billed', money(totalBilled), PDF_COLORS.NAVY],
      ['Total paid', money(totalPaid), PDF_COLORS.GREEN],
      ['Balance due', money(totalDue), totalDue > 0 ? PDF_COLORS.RED : PDF_COLORS.GREEN],
    ].forEach(([label, value, color], i) => {
      const x = PAGE_MARGIN + i * (cardW + 10);
      doc.roundedRect(x, y, cardW, 52, 6).lineWidth(0.7).strokeColor(PDF_COLORS.LINE).stroke();
      doc.fillColor(PDF_COLORS.GREY).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 12, y + 10, { width: cardW - 24, lineBreak: false });
      doc.fillColor(color).font('Helvetica-Bold').fontSize(14).text(value, x + 12, y + 26, { width: cardW - 24, lineBreak: false });
    });
    y += 72;

    const newPage = () => {
      doc.addPage();
      return PAGE_MARGIN;
    };
    const ensure = (needed: number) => {
      if (y + needed > BOTTOM) y = newPage();
    };

    if (!live.length) {
      doc.fillColor(PDF_COLORS.GREY).font('Helvetica').fontSize(10).text('No invoices have been issued to this learner yet.', PAGE_MARGIN, y, { width: CONTENT_WIDTH });
    }

    for (const invoice of invoices) {
      const items = invoice.lineItems ?? [];
      const payments = (invoice.payments ?? []).filter((payment) => (payment.status ?? 'CONFIRMED') === 'CONFIRMED');
      ensure(70 + Math.min(items.length, 3) * 16);

      // Invoice heading bar
      doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 24).fill('#eef3f7');
      doc.fillColor(PDF_COLORS.NAVY).font('Helvetica-Bold').fontSize(10).text(`${invoice.invoiceNumber}${invoice.termName ? `  ·  ${invoice.termName}` : ''}`, PAGE_MARGIN + 10, y + 7, { width: 300, lineBreak: false });
      doc.fillColor(PDF_COLORS.GREY).font('Helvetica').fontSize(8).text(`Issued ${fmtDate(invoice.issuedAt)}  ·  Due ${fmtDate(invoice.dueDate)}  ·  ${titleCase(invoice.status)}`, PAGE_MARGIN + 220, y + 8, { width: CONTENT_WIDTH - 230, align: 'right', lineBreak: false });
      y += 30;

      for (const item of items) {
        ensure(18);
        doc.fillColor(PDF_COLORS.INK).font('Helvetica').fontSize(9).text(item.feeCategoryName || 'Fee', PAGE_MARGIN + 10, y, { width: CONTENT_WIDTH - 140, lineBreak: false, ellipsis: true });
        doc.text(money(num(item.amount)), PAGE_MARGIN, y, { width: CONTENT_WIDTH - 10, align: 'right', lineBreak: false });
        y += 16;
      }
      for (const payment of payments) {
        ensure(18);
        const label = `Paid ${fmtDate(payment.paidAt)} · ${titleCase(payment.method)}${payment.referenceNumber ? ` · ${payment.referenceNumber}` : ''}`;
        doc.fillColor(PDF_COLORS.GREEN).font('Helvetica').fontSize(9).text(label, PAGE_MARGIN + 10, y, { width: CONTENT_WIDTH - 140, lineBreak: false, ellipsis: true });
        doc.text(`- ${money(num(payment.amount))}`, PAGE_MARGIN, y, { width: CONTENT_WIDTH - 10, align: 'right', lineBreak: false });
        y += 16;
      }

      ensure(30);
      doc.moveTo(PAGE_MARGIN, y + 2).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 2).lineWidth(0.5).strokeColor(PDF_COLORS.LINE).stroke();
      const owed = num(invoice.outstandingBalance);
      doc.fillColor(PDF_COLORS.NAVY).font('Helvetica-Bold').fontSize(9.5).text('Balance on this invoice', PAGE_MARGIN + 10, y + 9, { width: 250, lineBreak: false });
      doc.fillColor(owed > 0 ? PDF_COLORS.RED : PDF_COLORS.GREEN).text(money(owed), PAGE_MARGIN, y + 9, { width: CONTENT_WIDTH - 10, align: 'right', lineBreak: false });
      y += 34;
    }

    // Page footers. The document has no margin, so text near the bottom can never add a page.
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor(PDF_COLORS.GREY).font('Helvetica').fontSize(8).text(
        `${input.school?.name || 'School'} · Fee statement · ${input.studentName}${range.count > 1 ? ` · Page ${i + 1} of ${range.count}` : ''}`,
        PAGE_MARGIN,
        812,
        { width: CONTENT_WIDTH, align: 'center', lineBreak: false },
      );
    }

    doc.end();
    return done;
  }
}
