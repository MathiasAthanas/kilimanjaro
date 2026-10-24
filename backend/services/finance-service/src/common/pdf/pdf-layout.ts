import PDFDocument = require('pdfkit');

/** What a school prints at the top of its documents (all optional except the name). */
export interface SchoolProfile {
  name: string;
  motto?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

const NAVY = '#00334f';
const GOLD = '#d59a1b';
const GREY = '#64748b';
const INK = '#0f172a';
const LINE = '#d5dde6';

export const PAGE_MARGIN = 48;
export const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;

export function money(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  return `TZS ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function titleCase(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Navy band with the school identity on the left and the document label, number and status on the right. */
export function letterhead(
  doc: PDFKit.PDFDocument,
  school: SchoolProfile | null | undefined,
  label: string,
  number: string,
  badge?: { text: string; color: string },
): number {
  const top = 0;
  const height = 104;
  doc.rect(0, top, 595.28, height).fill(NAVY);
  doc.rect(0, top + height, 595.28, 3).fill(GOLD);

  const name = school?.name || 'School';
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17).text(name, PAGE_MARGIN, 26, { width: 320, lineBreak: false, ellipsis: true });
  let y = 48;
  if (school?.motto) {
    doc.fillColor(GOLD).font('Helvetica-Oblique').fontSize(9).text(school.motto, PAGE_MARGIN, y, { width: 320, lineBreak: false, ellipsis: true });
    y += 14;
  }
  const contact = [school?.address, school?.phone].filter(Boolean).join('  ·  ');
  doc.fillColor('#c8dce6').font('Helvetica').fontSize(8);
  if (contact) {
    doc.text(contact, PAGE_MARGIN, y, { width: 320, lineBreak: false, ellipsis: true });
    y += 12;
  }
  if (school?.email) doc.text(school.email, PAGE_MARGIN, y, { width: 320, lineBreak: false, ellipsis: true });

  const right = 595.28 - PAGE_MARGIN;
  doc.fillColor('#a0c8dc').font('Helvetica').fontSize(8).text(label.toUpperCase(), right - 200, 24, { width: 200, align: 'right' });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16).text(number, right - 200, 38, { width: 200, align: 'right' });
  if (badge) {
    const w = 84;
    doc.roundedRect(right - w, 66, w, 18, 3).fill(badge.color);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(badge.text.toUpperCase(), right - w, 71, { width: w, align: 'center' });
  }

  doc.fillColor(INK);
  return top + height + 28;
}

/** Two-column label/value grid. Returns the y below the grid. */
export function keyValues(doc: PDFKit.PDFDocument, rows: Array<[string, string]>, startY: number): number {
  const colW = CONTENT_WIDTH / 2;
  let y = startY;
  for (let i = 0; i < rows.length; i += 2) {
    for (let c = 0; c < 2; c++) {
      const row = rows[i + c];
      if (!row) continue;
      const x = PAGE_MARGIN + c * colW;
      doc.fillColor(GREY).font('Helvetica-Bold').fontSize(7).text(row[0].toUpperCase(), x, y, { width: colW - 12 });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10.5).text(row[1] || '—', x, y + 10, { width: colW - 12 });
    }
    y += 38;
  }
  return y;
}

export function lineTable(doc: PDFKit.PDFDocument, items: Array<{ label: string; amount: string | number }>, startY: number): number {
  let y = startY;
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 22).fill('#eef3f7');
  doc.fillColor(GREY).font('Helvetica-Bold').fontSize(8).text('FEE ITEM', PAGE_MARGIN + 10, y + 7).text('AMOUNT', PAGE_MARGIN, y + 7, { width: CONTENT_WIDTH - 10, align: 'right' });
  y += 22;
  if (!items.length) {
    doc.fillColor(GREY).font('Helvetica').fontSize(9.5).text('No line items', PAGE_MARGIN + 10, y + 8);
    return y + 28;
  }
  for (const item of items) {
    doc.fillColor(INK).font('Helvetica').fontSize(10).text(item.label, PAGE_MARGIN + 10, y + 8, { width: CONTENT_WIDTH - 140 });
    doc.text(money(item.amount), PAGE_MARGIN, y + 8, { width: CONTENT_WIDTH - 10, align: 'right' });
    y += 26;
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).lineWidth(0.5).strokeColor(LINE).stroke();
  }
  return y + 8;
}

export function totalsBlock(doc: PDFKit.PDFDocument, rows: Array<{ label: string; value: string; strong?: boolean; color?: string }>, startY: number): number {
  const w = 230;
  const x = PAGE_MARGIN + CONTENT_WIDTH - w;
  let y = startY + 6;
  for (const row of rows) {
    doc
      .fillColor(row.color ?? (row.strong ? NAVY : GREY))
      .font(row.strong ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(row.strong ? 12 : 10)
      .text(row.label, x, y, { width: w / 2 })
      .text(row.value, x + w / 2, y, { width: w / 2, align: 'right' });
    y += row.strong ? 24 : 18;
  }
  return y;
}

export function footer(doc: PDFKit.PDFDocument, text: string): void {
  const y = 780;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y).lineWidth(0.5).strokeColor(LINE).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(8).text(text, PAGE_MARGIN, y + 8, { width: CONTENT_WIDTH, align: 'center' });
}

export function newDocument(): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', margin: 0 });
}

export const PDF_COLORS = { NAVY, GOLD, GREY, INK, LINE, GREEN: '#10b981', RED: '#e11d48', AMBER: '#d59a1b', SLATE: '#64748b' };
