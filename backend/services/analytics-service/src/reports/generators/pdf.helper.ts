import * as fs from 'fs';
import * as path from 'path';
// pdfkit publishes a CommonJS constructor; require avoids default interop pitfalls.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

type RowValue = string | number | null | undefined;
type Section = {
  heading: string;
  rows: Array<[string, RowValue]>;
  bullets?: string[];
};

const COLORS = {
  navy: '#061f33',
  blue: '#1c9fd1',
  gold: '#f4b740',
  slate: '#475569',
  muted: '#64748b',
  line: '#dbe4ee',
  paper: '#f6f9fc',
  emerald: '#059669',
  rose: '#dc2626',
};

const PAGE = { width: 595.28, height: 841.89, margin: 44 };
const contentWidth = PAGE.width - PAGE.margin * 2;

function logoPath() {
  return path.resolve(process.cwd(), '../../../dashboard/public/kilimanjaro_logo.png');
}

function formatValue(label: string, value: RowValue) {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(label).toLowerCase();
  const number = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (Number.isFinite(number)) {
    if (text.includes('rate') || text.includes('%') || text.includes('average') || text.includes('score')) {
      return `${number.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    }
    if (
      text.includes('amount') ||
      text.includes('billed') ||
      text.includes('collected') ||
      text.includes('outstanding') ||
      text.includes('revenue') ||
      text.includes('asset') ||
      text.includes('waived') ||
      text.includes('discount')
    ) {
      return `TZS ${number.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return number.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(value).replaceAll('_', ' ');
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
  if (doc.y + needed > PAGE.height - 66) doc.addPage();
}

function footer(doc: any, title: string) {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .save()
      .moveTo(PAGE.margin, PAGE.height - 44)
      .lineTo(PAGE.width - PAGE.margin, PAGE.height - 44)
      .lineWidth(0.6)
      .strokeColor(COLORS.line)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text('Kilimanjaro Schools | Confidential management report', PAGE.margin, PAGE.height - 34, { width: 260 })
      .text(`${title} | Page ${i + 1} of ${pages.count}`, PAGE.width - PAGE.margin - 240, PAGE.height - 34, {
        width: 240,
        align: 'right',
      })
      .restore();
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

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.gold)
    .text('KILIMANJARO SCHOOLS', 136, 34, { characterSpacing: 1.2 })
    .fontSize(24)
    .fillColor('#ffffff')
    .text(title, 136, 51, { width: 370, lineGap: 1 })
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#dbeafe')
    .text(`Generated ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, 136, 108);

  doc.y = 168;
}

function metricCards(doc: any, section: Section) {
  const rows = section.rows.slice(0, 4);
  if (!rows.length) return;
  const gap = 10;
  const w = (contentWidth - gap * 3) / 4;
  const y = doc.y;
  rows.forEach(([label, value], i) => {
    const x = PAGE.margin + i * (w + gap);
    const tone = toneFor(label, value);
    doc.roundedRect(x, y, w, 78, 10).fillAndStroke('#ffffff', COLORS.line);
    doc.rect(x, y, 4, 78).fill(tone);
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(label.toUpperCase(), x + 13, y + 12, { width: w - 22, height: 18 })
      .fontSize(14)
      .fillColor(COLORS.navy)
      .text(formatValue(label, value), x + 13, y + 34, { width: w - 22, height: 30 });
  });
  doc.y = y + 96;
}

function sectionBlock(doc: any, section: Section) {
  ensureSpace(doc, 110);
  const startY = doc.y;
  doc
    .roundedRect(PAGE.margin, startY, contentWidth, 30, 8)
    .fill(COLORS.paper)
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.navy)
    .text(section.heading, PAGE.margin + 14, startY + 9, { width: contentWidth - 28 });

  doc.y = startY + 42;

  const labelW = 190;
  for (const [label, value] of section.rows) {
    ensureSpace(doc, 26);
    const y = doc.y;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.slate)
      .text(label, PAGE.margin + 8, y, { width: labelW })
      .font('Helvetica-Bold')
      .fillColor(COLORS.navy)
      .text(formatValue(label, value), PAGE.margin + labelW + 24, y, {
        width: contentWidth - labelW - 34,
        align: 'right',
      });
    doc
      .moveTo(PAGE.margin + 8, y + 16)
      .lineTo(PAGE.width - PAGE.margin - 8, y + 16)
      .lineWidth(0.35)
      .strokeColor(COLORS.line)
      .stroke();
    doc.y = y + 22;
  }

  if (section.bullets?.length) {
    ensureSpace(doc, 46);
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.navy).text('Management Notes', PAGE.margin + 8);
    doc.moveDown(0.25);
    for (const bullet of section.bullets.slice(0, 16)) {
      ensureSpace(doc, 30);
      const y = doc.y;
      doc.circle(PAGE.margin + 12, y + 5, 2.3).fill(COLORS.gold);
      doc
        .font('Helvetica')
        .fontSize(8.6)
        .fillColor(COLORS.slate)
        .text(String(bullet), PAGE.margin + 22, y, { width: contentWidth - 32, lineGap: 1 });
      doc.moveDown(0.45);
    }
  } else if (!section.rows.length) {
    ensureSpace(doc, 40);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text('No records are available for this section in the selected reporting period.', PAGE.margin + 8, doc.y, {
        width: contentWidth - 16,
      });
  }

  doc.moveDown(0.7);
}

function summarySection(sections: Section[]) {
  return sections
    .flatMap((section) => section.rows.slice(0, 2).map(([label, value]) => `${section.heading}: ${label} is ${formatValue(label, value)}.`))
    .slice(0, 6);
}

export async function createPdf(filePath: string, title: string, sections: Section[]) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const doc = new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true, autoFirstPage: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  drawHeader(doc, title);

  const first = sections[0];
  if (first) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.navy).text('Executive Snapshot', PAGE.margin);
    doc.moveDown(0.5);
    metricCards(doc, first);
  }

  const summary = summarySection(sections);
  if (summary.length) {
    sectionBlock(doc, {
      heading: 'Executive Interpretation',
      rows: [],
      bullets: summary,
    });
  }

  for (const section of sections) sectionBlock(doc, section);

  footer(doc, title);
  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
}
