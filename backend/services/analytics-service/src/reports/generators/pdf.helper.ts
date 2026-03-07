import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

export async function createPdf(filePath: string, title: string, sections: Array<{ heading: string; rows: Array<[string, string | number | null]> }>) {
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
      doc.text(`${label}: ${value ?? '-'}`);
    }
    doc.moveDown();
  }

  doc.end();
  await new Promise<void>((resolve) => stream.on('finish', () => resolve()));
}
