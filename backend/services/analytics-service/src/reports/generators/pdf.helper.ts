import * as fs from 'fs';
import * as path from 'path';
import { writeCsv, writeXlsx } from './spreadsheet.helper';
import type { ColumnKind, ReportSection, ReportTable, RowValue } from './report.types';
import { formatCell, formatValue, headerLabel, inferKind } from './report.format';

// pdfkit publishes a CommonJS constructor; require avoids default interop pitfalls.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export type { ColumnKind, ReportSection as Section, ReportTable, RowValue } from './report.types';
export type ReportFormat = 'PDF' | 'XLSX' | 'CSV';

const COLORS = {
  navy: '#061f33',
  blue: '#1c9fd1',
  gold: '#f4b740',
  slate: '#475569',
  muted: '#64748b',
  line: '#dbe4ee',
  paper: '#f6f9fc',
  zebra: '#f9fbfd',
  emerald: '#059669',
  rose: '#dc2626',
};

const PAGE = { width: 595.28, height: 841.89, margin: 44 };
/** Nothing may be drawn below this line except the footer. */
const BOTTOM = PAGE.height - 66;
const contentWidth = PAGE.width - PAGE.margin * 2;

function logoPath() {
  return path.resolve(process.cwd(), '../../../dashboard/public/kilimanjaro_logo.png');
}

function toneFor(label: string, raw: RowValue) {
  const value = Number(raw ?? 0);
  const text = label.toLowerCase();
  if (text.includes('critical') || text.includes('overdue') || text.includes('outstanding') || text.includes('risk')) return COLORS.rose;
  if ((text.includes('rate') || text.includes('average')) && value >= 80) return COLORS.emerald;
  if ((text.includes('rate') || text.includes('average')) && value > 0 && value < 60) return COLORS.rose;
  if (text.includes('collected') || text.includes('active') || text.includes('present')) return COLORS.emerald;
  return COLORS.blue;
}

function ensureSpace(doc: any, needed = 120) {
  if (doc.y + needed > BOTTOM) {
    doc.addPage();
    doc.y = PAGE.margin;
    return true;
  }
  return false;
}

/**
 * Draws the footer on every page once the page count is known.
 *
 * pdfkit adds a new page whenever text is written below the bottom margin, so a footer drawn in
 * the margin silently doubled or tripled the page count (blank pages with only a footer). The
 * margin is lowered to zero while the footer is drawn and `lineBreak: false` keeps each line on
 * one row, so footers can never create pages.
 */
function footer(doc: any, title: string) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .save()
      .moveTo(PAGE.margin, PAGE.height - 44)
      .lineTo(PAGE.width - PAGE.margin, PAGE.height - 44)
      .lineWidth(0.6)
      .strokeColor(COLORS.line)
      .stroke()
      .restore();
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text('Kilimanjaro Schools | Confidential management report', PAGE.margin, PAGE.height - 34, { width: 260, lineBreak: false })
      .text(`${title} | Page ${i + 1} of ${range.count}`, PAGE.width - PAGE.margin - 240, PAGE.height - 34, {
        width: 240,
        align: 'right',
        lineBreak: false,
      });
    doc.page.margins.bottom = savedBottom;
  }
}

function drawHeader(doc: any, title: string) {
  doc.rect(0, 0, PAGE.width, 142).fill(COLORS.navy);
  doc.rect(0, 124, PAGE.width, 18).fill(COLORS.gold);

  const lp = logoPath();
  if (fs.existsSync(lp)) {
    doc.image(lp, PAGE.margin, 26, { width: 76, height: 76 });
  } else {
    doc.circle(PAGE.margin + 38, 64, 38).fill(COLORS.blue);
  }

  // Long titles ("Class Academic Report - Class 2 A") shrink to fit two lines instead of colliding with the date.
  let size = 24;
  doc.font('Helvetica-Bold');
  for (const candidate of [24, 21, 18, 16, 14]) {
    size = candidate;
    doc.fontSize(candidate);
    if (doc.heightOfString(title, { width: 370 }) <= 54) break;
  }

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.gold)
    .text('KILIMANJARO SCHOOLS', 136, 34, { characterSpacing: 1.2, lineBreak: false })
    .fontSize(size)
    .fillColor('#ffffff')
    .text(title, 136, 51, { width: 370, height: 56, lineGap: 1 })
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#dbeafe')
    .text(`Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, 136, 108, { lineBreak: false });

  doc.x = PAGE.margin;
  doc.y = 168;
}

function metricCards(doc: any, section: ReportSection) {
  const rows = section.rows.slice(0, 4);
  if (!rows.length) return;
  const gap = 10;
  const w = (contentWidth - gap * 3) / 4;
  const y = doc.y;
  rows.forEach(([label, value, kind], i) => {
    const x = PAGE.margin + i * (w + gap);
    const tone = toneFor(label, value);
    doc.roundedRect(x, y, w, 78, 10).fillAndStroke('#ffffff', COLORS.line);
    doc.rect(x, y, 4, 78).fill(tone);
    const text = formatValue(label, value, kind);
    // Shrink the figure until it fits on one line: "TZS 340,769,000" used to wrap and lose its number.
    let size = 14;
    doc.font('Helvetica-Bold');
    while (size > 7 && doc.fontSize(size).widthOfString(text) > w - 22) size -= 0.5;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(label.toUpperCase(), x + 13, y + 12, { width: w - 22, height: 18 })
      .fontSize(size)
      .fillColor(COLORS.navy)
      .text(text, x + 13, y + 36, { width: w - 22, lineBreak: false });
  });
  doc.x = PAGE.margin;
  doc.y = y + 96;
}

function headingBar(doc: any, heading: string) {
  const startY = doc.y;
  doc
    .roundedRect(PAGE.margin, startY, contentWidth, 30, 8)
    .fill(COLORS.paper)
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.navy)
    .text(heading, PAGE.margin + 14, startY + 9, { width: contentWidth - 28, lineBreak: false });
  doc.x = PAGE.margin;
  doc.y = startY + 42;
}

function drawTable(doc: any, section: ReportSection, table: ReportTable) {
  const tableWidth = contentWidth - 16;
  const x0 = PAGE.margin + 8;
  const weights = table.columns.map((c) => c.weight ?? (c.kind && c.kind !== 'text' ? 1 : 2.2));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => (tableWidth * w) / totalWeight);
  const PAD = 5;

  doc.font('Helvetica-Bold').fontSize(7.5);
  const headerHeight = Math.min(
    32,
    Math.max(20, ...table.columns.map((c, i) => doc.heightOfString(headerLabel(c), { width: widths[i] - PAD * 2 }) + 11)),
  );

  const header = () => {
    const y = doc.y;
    doc.rect(x0, y, tableWidth, headerHeight).fill(COLORS.navy);
    let x = x0;
    table.columns.forEach((c, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#ffffff')
        .text(headerLabel(c), x + PAD, y + 6, { width: widths[i] - PAD * 2, height: headerHeight - 8, align: isNumeric(c.kind) ? 'right' : 'left', ellipsis: true });
      x += widths[i];
    });
    doc.x = PAGE.margin;
    doc.y = y + headerHeight;
  };

  if (table.title) {
    ensureSpace(doc, 60);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text(table.title, x0, doc.y, { width: tableWidth, lineBreak: false });
    doc.y += 6;
  }
  ensureSpace(doc, headerHeight + 22);
  header();

  table.rows.forEach((row, rowIndex) => {
    const cells = table.columns.map((c, i) => formatCell(row[i], c.kind));
    doc.font('Helvetica').fontSize(8);
    let height = 0;
    cells.forEach((text, i) => {
      height = Math.max(height, doc.heightOfString(text, { width: widths[i] - PAD * 2 }));
    });
    const rowHeight = Math.max(18, Math.min(height, 48) + 8);
    if (ensureSpace(doc, rowHeight + 2)) header();

    const y = doc.y;
    if (rowIndex % 2 === 0) doc.rect(x0, y, tableWidth, rowHeight).fill(COLORS.zebra);
    let x = x0;
    cells.forEach((text, i) => {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.slate)
        .text(text, x + PAD, y + 5, { width: widths[i] - PAD * 2, height: rowHeight - 6, align: isNumeric(table.columns[i].kind) ? 'right' : 'left', ellipsis: true });
      x += widths[i];
    });
    doc
      .moveTo(x0, y + rowHeight)
      .lineTo(x0 + tableWidth, y + rowHeight)
      .lineWidth(0.3)
      .strokeColor(COLORS.line)
      .stroke();
    doc.x = PAGE.margin;
    doc.y = y + rowHeight;
  });

  if (!table.rows.length) {
    doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text('No records for the selected period.', x0 + PAD, doc.y + 6, { width: tableWidth, lineBreak: false });
    doc.y += 24;
  }
  doc.x = PAGE.margin;
  doc.y += 10;
  void section;
}

function isNumeric(kind?: ColumnKind) {
  return !!kind && kind !== 'text';
}

function sectionBlock(doc: any, section: ReportSection, opts: { skipRows?: number; showHeading?: boolean } = {}) {
  const rows = section.rows.slice(opts.skipRows ?? 0);
  const hasBody = rows.length || section.bullets?.length || section.tables?.length;
  if (opts.showHeading !== false) {
    ensureSpace(doc, 110);
    headingBar(doc, section.heading);
  }

  const labelW = 190;
  for (const [label, value, kind] of rows) {
    ensureSpace(doc, 26);
    const y = doc.y;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.slate)
      .text(label, PAGE.margin + 8, y, { width: labelW, lineBreak: false, ellipsis: true })
      .font('Helvetica-Bold')
      .fillColor(COLORS.navy)
      .text(formatValue(label, value, kind), PAGE.margin + labelW + 24, y, {
        width: contentWidth - labelW - 34,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      });
    doc
      .moveTo(PAGE.margin + 8, y + 16)
      .lineTo(PAGE.width - PAGE.margin - 8, y + 16)
      .lineWidth(0.35)
      .strokeColor(COLORS.line)
      .stroke();
    doc.x = PAGE.margin;
    doc.y = y + 22;
  }

  for (const table of section.tables ?? []) drawTable(doc, section, table);

  if (section.bullets?.length) {
    ensureSpace(doc, 46);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text('Management Notes', PAGE.margin + 8);
    doc.moveDown(0.25);
    for (const bullet of section.bullets.slice(0, 40)) {
      doc.font('Helvetica').fontSize(8.6);
      const needed = doc.heightOfString(String(bullet), { width: contentWidth - 32, lineGap: 1 }) + 10;
      ensureSpace(doc, needed);
      const y = doc.y;
      doc.circle(PAGE.margin + 12, y + 5, 2.3).fill(COLORS.gold);
      doc
        .font('Helvetica')
        .fontSize(8.6)
        .fillColor(COLORS.slate)
        .text(String(bullet), PAGE.margin + 22, y, { width: contentWidth - 32, lineGap: 1 });
      doc.moveDown(0.45);
    }
  } else if (!hasBody) {
    ensureSpace(doc, 40);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text('No records are available for this section in the selected reporting period.', PAGE.margin + 8, doc.y, {
        width: contentWidth - 16,
      });
  }

  doc.x = PAGE.margin;
  doc.moveDown(0.7);
}

async function writePdf(filePath: string, title: string, sections: ReportSection[]) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, autoFirstPage: true });
  const stream = fs.createWriteStream(filePath);
  const finished = new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
  doc.pipe(stream);

  drawHeader(doc, title);

  // The first section is the executive view: its first four figures become cards, the rest stays below.
  const first = sections[0];
  if (first) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy).text('Executive Snapshot', PAGE.margin, doc.y, { lineBreak: false });
    doc.y += 18;
    metricCards(doc, first);
    if (first.rows.length > 4 || first.bullets?.length || first.tables?.length) {
      sectionBlock(doc, first, { skipRows: 4, showHeading: false });
    }
  }
  for (const section of sections.slice(1)) sectionBlock(doc, section);

  footer(doc, title);
  doc.end();
  await finished;
}

/**
 * Writes the report in the format implied by the file extension (.pdf, .xlsx or .csv),
 * so one definition of a report produces all three.
 */
export async function createReport(filePath: string, title: string, sections: ReportSection[]) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.xlsx') return writeXlsx(filePath, title, sections);
  if (ext === '.csv') return writeCsv(filePath, title, sections);
  return writePdf(filePath, title, sections);
}

/** @deprecated use createReport; kept so older callers keep working. */
export const createPdf = createReport;

export { inferKind };
