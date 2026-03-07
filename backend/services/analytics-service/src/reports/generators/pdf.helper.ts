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

const formatValue = (value: RowValue) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'number' && Number.isFinite(value)) return Number(value.toFixed(2)).toString();
  return String(value);
};

export async function createPdf(filePath: string, title: string, sections: Section[]) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text(title);
  doc.moveDown();
  doc.fontSize(10).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown();

  for (const section of sections) {
    doc.fontSize(14).text(section.heading);
    doc.moveDown(0.3);
    doc.fontSize(10);
    for (const [label, value] of section.rows) {
      doc.text(`${label}: ${formatValue(value)}`);
    }
    if (section.bullets?.length) {
      doc.moveDown(0.2);
      for (const bullet of section.bullets) {
        doc.text(`- ${bullet}`);
      }
    }
    doc.moveDown();
  }

  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
}
