import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync, createWriteStream, existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { SchoolProfile, fmtDate, newDocument } from '../common/pdf/pdf-layout';

export type InvoicePdfBranding = {
  accentColor: string;
  title: string;
  note: string | null;
  signatoryName: string | null;
  logo: Buffer | null;
  signature: Buffer | null;
  stamp: Buffer | null;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  createdAt: Date;
  dueDate: Date;
  status?: string;
  studentName: string;
  registrationNumber: string;
  className: string;
  academicYearName?: string | null;
  termName?: string | null;
  school?: SchoolProfile | null;
  branding?: InvoicePdfBranding | null;
  lineItems: Array<{ name: string; amount: number; paid: number; balance: number }>;
  installments: Array<{ groupLabel?: string | null; label: string; description?: string | null; dueDate: Date; amount: number; balance: number }>;
  accounts: Array<{ bankName: string; accountName: string; accountNumber: string; description?: string | null }>;
  totalAmount: number;
  paidAmount: number;
  previousBalance: number;
  outstandingBalance: number;
};

const INK = '#1f2937';
const GREY = '#6b7280';
const LINE = '#e5e7eb';
const HEAD = '#3b4256';
const W = 595.28;
const H = 841.89;
const M = 40;
const CW = W - M * 2;

const num = (value: number) => (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Black or white, whichever reads better on this colour. */
function textOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.62 ? '#1f2937' : '#ffffff';
}

@Injectable()
export class InvoicePdfService {
  private static defaultLogoCache: Buffer | null | undefined;

  constructor(private readonly configService: ConfigService) {}

  /** The Kilimanjaro Schools badge, used when a school has not uploaded a logo of its own. */
  private static defaultLogo(): Buffer | null {
    if (InvoicePdfService.defaultLogoCache !== undefined) return InvoicePdfService.defaultLogoCache;
    const found = [
      join(__dirname, 'assets', 'kilimanjaro_logo.png'),
      join(process.cwd(), 'src', 'invoices', 'assets', 'kilimanjaro_logo.png'),
      join(process.cwd(), 'dist', 'src', 'invoices', 'assets', 'kilimanjaro_logo.png'),
    ].find((candidate) => existsSync(candidate));
    InvoicePdfService.defaultLogoCache = found ? readFileSync(found) : null;
    return InvoicePdfService.defaultLogoCache;
  }

  /** Draws the invoice and returns its path under the PDF storage folder. */
  async generate(invoice: InvoicePdfData): Promise<string> {
    const root = this.configService.get<string>('PDF_STORAGE_PATH', './storage');
    const fileName = `invoice_${invoice.invoiceNumber}.pdf`;
    const fullPath = join(root, 'invoices', fileName);
    mkdirSync(dirname(fullPath), { recursive: true });

    await new Promise<void>((resolve, reject) => {
      const doc = newDocument();
      const stream = createWriteStream(fullPath);
      doc.pipe(stream);
      try {
        this.draw(doc, invoice);
      } catch (err) {
        doc.end();
        reject(err);
        return;
      }
      doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
    return `invoices/${fileName}`;
  }

  private draw(doc: PDFKit.PDFDocument, inv: InvoicePdfData) {
    const brand = inv.branding;
    const accent = brand?.accentColor || '#d59a1b';
    const onAccent = textOn(accent);
    const school = inv.school;

    // ── Header: logo + school identity ──
    let textX = M;
    const logo = brand?.logo ?? InvoicePdfService.defaultLogo();
    if (logo) {
      try {
        doc.image(logo, M, 30, { fit: [74, 74] });
        textX = M + 88;
      } catch {
        // an unreadable image never blocks an invoice
      }
    }
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(17).text((school?.name || 'School').toUpperCase(), textX, 34, { width: W - textX - M });
    let y = doc.y + 3;
    doc.font('Helvetica').fontSize(9).fillColor(GREY);
    if (school?.motto) { doc.font('Helvetica-Oblique').text(school.motto, textX, y, { width: W - textX - M }); y = doc.y + 1; doc.font('Helvetica'); }
    for (const part of [school?.address, school?.phone, school?.email]) {
      if (!part) continue;
      doc.text(part, textX, y, { width: W - textX - M });
      y = doc.y + 1;
    }

    // ── Accent band with the title ──
    const bandY = 112;
    doc.rect(0, bandY, 345, 26).fill(accent);
    doc.rect(W - 54, bandY, 54, 26).fill(accent);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(27).text((brand?.title || 'INVOICE').toUpperCase(), 360, bandY - 4, { width: W - 54 - 360 - 8, align: 'center', lineBreak: false });

    // ── Who and what ──
    let top = bandY + 46;
    const term = [inv.termName, inv.academicYearName].filter(Boolean).join(' · ');
    const left: Array<[string, string]> = [
      ['INVOICE TO', inv.studentName],
      ['REG NO', inv.registrationNumber],
      ['CLASS', inv.className],
      ['ACADEMIC YEAR', term || '—'],
    ];
    let ly = top;
    for (const [k, v] of left) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(`${k}: `, M, ly, { continued: true }).font('Helvetica').text(v || '—', { width: 330 });
      ly = doc.y + 6;
    }
    const rx = W - M - 200;
    doc.fillColor(GREY).font('Helvetica').fontSize(10).text('Invoice No #', rx, top, { width: 200, align: 'right', continued: false });
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(13).text(inv.invoiceNumber, rx, top + 13, { width: 200, align: 'right' });
    doc.fillColor(GREY).font('Helvetica').fontSize(10).text(`Created on ${fmtDate(inv.createdAt)}`, rx, top + 34, { width: 200, align: 'right' });
    doc.text(`Due ${fmtDate(inv.dueDate)}`, rx, top + 48, { width: 200, align: 'right' });
    const badge = inv.status === 'PAID' ? ['PAID', '#10b981'] : inv.status === 'OVERDUE' ? ['OVERDUE', '#e11d48'] : inv.status === 'PARTIALLY_PAID' ? ['PART PAID', accent] : inv.status === 'CANCELLED' || inv.status === 'VOID' ? ['CANCELLED', '#6b7280'] : null;
    if (badge) {
      doc.roundedRect(W - M - 82, top + 66, 82, 18, 3).fill(badge[1]);
      doc.fillColor(badge[1] === accent ? onAccent : '#ffffff').font('Helvetica-Bold').fontSize(8).text(badge[0], W - M - 82, top + 71.5, { width: 82, align: 'center' });
    }

    // ── Fees table ──
    let ty = Math.max(ly, top + 88) + 8;
    ty = this.tableHeader(doc, ty, [
      { t: 'SN', x: M, w: 30 },
      { t: 'Fees', x: M + 30, w: 215 },
      { t: 'Amount', x: M + 245, w: 90, right: true },
      { t: 'Amount Paid', x: M + 335, w: 90, right: true },
      { t: 'Balance', x: M + 425, w: CW - 425, right: true },
    ]);
    inv.lineItems.forEach((item, idx) => {
      ty = this.ensureSpace(doc, ty, 24);
      doc.fillColor(GREY).font('Helvetica').fontSize(9.5).text(String(idx + 1), M + 8, ty + 7, { width: 24 });
      doc.fillColor(INK).text(item.name, M + 34, ty + 7, { width: 205, lineBreak: false, ellipsis: true });
      doc.text(num(item.amount), M + 245, ty + 7, { width: 86, align: 'right' });
      doc.text(num(item.paid), M + 335, ty + 7, { width: 86, align: 'right' });
      doc.text(num(item.balance), M + 425, ty + 7, { width: CW - 433, align: 'right' });
      ty += 24;
      doc.moveTo(M, ty).lineTo(M + CW, ty).lineWidth(0.5).strokeColor(LINE).stroke();
    });
    ty = this.ensureSpace(doc, ty, 28);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text('Total', M + 34, ty + 9, { width: 205, align: 'right' });
    doc.text(num(inv.totalAmount), M + 245, ty + 9, { width: 86, align: 'right' });
    doc.text(num(inv.paidAmount), M + 335, ty + 9, { width: 86, align: 'right' });
    doc.text(num(Math.max(0, inv.totalAmount - inv.paidAmount)), M + 425, ty + 9, { width: CW - 433, align: 'right' });
    ty += 30;

    // ── Payment plan ──
    if (inv.installments.length) {
      ty = this.ensureSpace(doc, ty, 80);
      doc.fillColor(GREY).font('Helvetica').fontSize(14).text('Payment Plan', M, ty);
      ty += 24;
      ty = this.tableHeader(doc, ty, [
        { t: 'Payment Plan', x: M, w: 170 },
        { t: 'Fees', x: M + 170, w: 190 },
        { t: 'Amount', x: M + 360, w: 80, right: true },
        { t: 'Balance', x: M + 440, w: CW - 440, right: true },
      ], true);
      for (const item of inv.installments) {
        const title = [item.groupLabel, item.label].filter(Boolean).join(' ');
        const fees = item.description || '';
        doc.font('Helvetica').fontSize(8.5);
        const h = Math.max(28, doc.heightOfString(fees, { width: 180 }) + 12, doc.heightOfString(`${title} Deadline ${fmtDate(item.dueDate)}`, { width: 160 }) + 12);
        ty = this.ensureSpace(doc, ty, h);
        doc.fillColor(INK).font('Helvetica').fontSize(8.5).text(title, M + 6, ty + 7, { width: 160, continued: true }).fillColor(GREY).text(`  Deadline ${fmtDate(item.dueDate)}`);
        doc.fillColor(INK).fontSize(8.5).text(fees, M + 174, ty + 7, { width: 180 });
        doc.text(num(item.amount), M + 360, ty + 7, { width: 76, align: 'right' });
        doc.text(num(item.balance), M + 440, ty + 7, { width: CW - 446, align: 'right' });
        ty += h;
        doc.moveTo(M, ty).lineTo(M + CW, ty).lineWidth(0.5).strokeColor(LINE).stroke();
      }
      ty += 14;
    }

    // ── Payment info (left) and totals (right) ──
    const blockH = Math.max(120, 50 + inv.accounts.length * 28);
    ty = this.ensureSpace(doc, ty, blockH + 10);
    const blockTop = ty;
    doc.fillColor(INK).font('Helvetica').fontSize(14).text('Payment Info', M, ty);
    let ay = ty + 24;
    if (inv.accounts.length) {
      const cols = [
        { t: 'Bank', x: M, w: 66 },
        { t: 'Account Name', x: M + 66, w: 102 },
        { t: 'Account Number', x: M + 168, w: 72 },
        { t: 'Description', x: M + 240, w: 52 },
      ];
      doc.rect(M, ay, 292, 20).lineWidth(0.5).strokeColor(LINE).stroke();
      cols.forEach((c) => doc.fillColor(INK).font('Helvetica-Bold').fontSize(7.5).text(c.t, c.x + 5, ay + 6, { width: c.w - 8 }));
      ay += 20;
      for (const a of inv.accounts) {
        doc.font('Helvetica').fontSize(7.5);
        const rh = Math.max(26, doc.heightOfString(a.accountName, { width: 94 }) + 12, doc.heightOfString(a.bankName, { width: 58 }) + 12, doc.heightOfString(a.description || '', { width: 44 }) + 12);
        doc.rect(M, ay, 292, rh).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.fillColor(INK).text(a.bankName, cols[0].x + 5, ay + 7, { width: 58 });
        doc.text(a.accountName, cols[1].x + 5, ay + 7, { width: 94 });
        doc.text(a.accountNumber, cols[2].x + 5, ay + 7, { width: 64 });
        doc.text(a.description || '', cols[3].x + 5, ay + 7, { width: 44 });
        ay += rh;
      }
    } else {
      doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(9).text('Payment details are available from the school accounts office.', M, ay, { width: 292 });
    }

    const tx = W - M - 205;
    let sy = blockTop + 4;
    const row = (label: string, value: number) => {
      doc.fillColor(INK).font('Helvetica').fontSize(11).text(label, tx, sy, { width: 120 });
      doc.text(num(value), tx + 90, sy, { width: 115, align: 'right' });
      sy += 21;
      doc.moveTo(tx, sy - 5).lineTo(tx + 205, sy - 5).lineWidth(0.5).strokeColor(LINE).stroke();
    };
    row('Invoice Amount', inv.totalAmount);
    row('Previous Balance', inv.previousBalance);
    row('Amount Paid', inv.paidAmount);
    sy += 4;
    doc.rect(tx - 10, sy, 215, 32).fill(accent);
    doc.fillColor(onAccent).font('Helvetica-Bold').fontSize(12).text('Total Balance', tx, sy + 10, { width: 110 });
    doc.text(num(inv.outstandingBalance + inv.previousBalance), tx + 80, sy + 10, { width: 115, align: 'right' });
    ty = Math.max(ay, sy + 32) + 14;

    // ── Note, and the school stamp when one has been uploaded (no signature area) ──
    const note = brand?.note || 'Payment of 100% of the fees for the term is preferred.';
    ty = this.ensureSpace(doc, ty, 90);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text('Note:', M, ty);
    doc.fillColor(GREY).font('Helvetica').fontSize(8.5).text(note, M, ty + 15, { width: 300 });
    if (brand?.stamp) {
      try { doc.image(brand.stamp, W - M - 120, ty - 6, { fit: [120, 84] }); } catch { /* ignore */ }
    }
    doc.moveTo(M, ty + 84).lineTo(W - M, ty + 84).lineWidth(1.5).strokeColor(accent).stroke();

    // ── Page footers ──
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text(`${school?.name || 'School'} · Invoice ${inv.invoiceNumber}${range.count > 1 ? ` · Page ${i + 1} of ${range.count}` : ''}`, M, H - 28, { width: CW, align: 'center', lineBreak: false });
    }
  }

  private tableHeader(doc: PDFKit.PDFDocument, y: number, cols: Array<{ t: string; x: number; w: number; right?: boolean }>, light = false): number {
    doc.rect(M, y, CW, 26).fill(light ? '#f3f4f6' : HEAD);
    cols.forEach((c) => doc.fillColor(light ? INK : '#ffffff').font('Helvetica-Bold').fontSize(9).text(c.t, c.x + 8, y + 8.5, { width: c.w - 16, align: c.right ? 'right' : 'left', lineBreak: false }));
    return y + 26;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number): number {
    if (y + needed <= H - 50) return y;
    doc.addPage();
    return 44;
  }
}
