import type { FinancialStatement } from './financial-statement.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

const tzs = (v: number) => `TZS ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;

export interface ExportFile {
  filename: string;
  mimeType: string;
  base64: string;
}

function safeName(statement: FinancialStatement, ext: string): string {
  return `financial-statement-${statement.period.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${ext}`;
}

// ── CSV (Excel-compatible) ────────────────────────────────────────────────────
export function toCsv(s: FinancialStatement): ExportFile {
  const rows: string[][] = [];
  const push = (...cols: (string | number)[]) => rows.push(cols.map((c) => String(c)));

  push('Kilimanjaro Schools — Financial Statement');
  push('Period', s.period.label);
  push('Generated', new Date(s.generatedAt).toLocaleString('en-GB'));
  push('');
  push('COLLECTIONS');
  push('Total Invoiced', s.collections.totalInvoiced);
  push('Total Collected', s.collections.totalCollected);
  push('Outstanding', s.collections.outstanding);
  push('Collection Rate %', s.collections.collectionRate);
  push('');
  push('Collections by Method', 'Amount', 'Count');
  s.collections.byMethod.forEach((m) => push(m.method, m.amount, m.count));
  push('');
  push('EXPENSES');
  push('Total Expenses', s.expenses.total);
  push('Expense Count', s.expenses.count);
  push('');
  push('Expenses by Category', 'Amount', 'Count');
  s.expenses.byCategory.forEach((c) => push(c.category, c.amount, c.count));
  if (s.expenses.byDepartment.length) {
    push('');
    push('Expenses by Department', 'Amount');
    s.expenses.byDepartment.forEach((d) => push(d.department, d.amount));
  }
  push('');
  push('FUND DISBURSEMENTS');
  push('Total Disbursed', s.disbursements.total);
  push('Disbursement Count', s.disbursements.count);
  push('');
  push('STORE / INVENTORY');
  push('Stock Value (on hand)', s.store.stockValue);
  push('Stock Received (period)', s.store.received);
  push('Stock Issued (period)', s.store.issued);
  push('');
  push('ASSETS');
  push('Purchase Cost', s.assets.purchaseCost);
  push('Current Value', s.assets.currentValue);
  push('Asset Count', s.assets.count);
  push('');
  push('NET POSITION');
  push('Collected less Expenses', s.net.collectedLessExpenses);
  push('');
  push('TREND', 'Collected', 'Expenses');
  s.series.forEach((p) => push(p.label, p.collected, p.expenses));

  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
  return { filename: safeName(s, 'csv'), mimeType: 'text/csv', base64: Buffer.from(csv, 'utf8').toString('base64') };
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export async function toPdf(s: FinancialStatement): Promise<ExportFile> {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const navy = '#00334f';
  const muted = '#64748b';
  const line = () => doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#d5dde6').stroke();

  // Header
  doc.fillColor(navy).fontSize(20).font('Helvetica-Bold').text('Kilimanjaro Schools', { continued: false });
  doc.fillColor(muted).fontSize(11).font('Helvetica').text('Financial Statement');
  doc.moveDown(0.4);
  doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold').text(s.period.label);
  doc.fillColor(muted).fontSize(9).font('Helvetica').text(`Generated ${new Date(s.generatedAt).toLocaleString('en-GB')} · ${s.period.type.toUpperCase()}`);
  doc.moveDown(0.6); line(); doc.moveDown(0.6);

  const kpi = (label: string, value: string) => {
    doc.fillColor(muted).fontSize(9).font('Helvetica-Bold').text(label.toUpperCase(), { continued: true });
    doc.fillColor('#0f172a').font('Helvetica').text(`   ${value}`);
  };
  const section = (title: string) => { doc.moveDown(0.6); doc.fillColor(navy).fontSize(12).font('Helvetica-Bold').text(title); doc.moveDown(0.2); };
  const rowKV = (k: string, v: string) => {
    const y = doc.y;
    doc.fillColor('#334155').fontSize(10).font('Helvetica').text(k, 56, y);
    doc.fillColor('#0f172a').font('Helvetica-Bold').text(v, 300, y, { width: 247, align: 'right' });
    doc.moveDown(0.2);
  };

  section('Collections');
  rowKV('Total Invoiced', tzs(s.collections.totalInvoiced));
  rowKV('Total Collected', tzs(s.collections.totalCollected));
  rowKV('Outstanding', tzs(s.collections.outstanding));
  rowKV('Collection Rate', `${s.collections.collectionRate}%`);
  s.collections.byMethod.forEach((m) => rowKV(`  ${m.method.replace(/_/g, ' ')} (${m.count})`, tzs(m.amount)));

  section('Expenditure');
  rowKV('Total Expenses', tzs(s.expenses.total));
  s.expenses.byCategory.forEach((c) => rowKV(`  ${c.category.replace(/_/g, ' ')} (${c.count})`, tzs(c.amount)));

  section('Fund Disbursements');
  rowKV('Total Disbursed', tzs(s.disbursements.total));
  rowKV('Disbursement Count', String(s.disbursements.count));

  section('Store / Inventory');
  rowKV('Stock Value (on hand)', tzs(s.store.stockValue));
  rowKV('Stock Received (period)', tzs(s.store.received));
  rowKV('Stock Issued (period)', tzs(s.store.issued));

  section('Assets');
  rowKV('Purchase Cost', tzs(s.assets.purchaseCost));
  rowKV('Current Value', tzs(s.assets.currentValue));
  rowKV('Asset Count', String(s.assets.count));

  doc.moveDown(0.6); line(); doc.moveDown(0.4);
  doc.fillColor(navy).fontSize(13).font('Helvetica-Bold').text('Net Position (Collected − Expenses)', { continued: true });
  doc.fillColor(s.net.collectedLessExpenses >= 0 ? '#047857' : '#b91c1c').text(`   ${tzs(s.net.collectedLessExpenses)}`);

  doc.moveDown(1);
  doc.fillColor(muted).fontSize(8).font('Helvetica').text('This statement is generated from live finance records and is intended for internal management use.', { align: 'center' });

  doc.end();
  const buffer = await done;
  return { filename: safeName(s, 'pdf'), mimeType: 'application/pdf', base64: buffer.toString('base64') };
}
