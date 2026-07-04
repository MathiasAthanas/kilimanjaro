import type { FinancialStatement } from './financial-statement.service';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const money = (v: number) => `TZS ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(v || 0))}`;
const pct = (v: number) => `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(v || 0)}%`;
const clean = (v: string | null | undefined) => (v || '').replace(/_/g, ' ');
const dash = (v: string | null | undefined) => {
  const text = (v || '').trim();
  return text.length ? text : '-';
};
const shortDate = (v: string) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export interface ExportFile {
  filename: string;
  mimeType: string;
  base64: string;
}

function safeName(statement: FinancialStatement, ext: string): string {
  return `financial-statement-${statement.period.label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${ext}`;
}

function addSection(rows: string[][], title: string, header?: string[]) {
  rows.push([]);
  rows.push([title]);
  if (header) rows.push(header);
}

export function toCsv(s: FinancialStatement): ExportFile {
  const rows: string[][] = [];
  const push = (...cols: (string | number)[]) => rows.push(cols.map((c) => String(c)));

  push('Kilimanjaro Schools - Financial Statement');
  push('Period', s.period.label);
  push('Generated', new Date(s.generatedAt).toLocaleString('en-GB'));
  push('Statement Type', s.period.type.toUpperCase());

  addSection(rows, 'EXECUTIVE SUMMARY', ['Metric', 'Value']);
  push('Total Invoiced', s.collections.totalInvoiced);
  push('Total Collected', s.collections.totalCollected);
  push('Outstanding Receivables', s.collections.outstanding);
  push('Collection Rate %', s.collections.collectionRate);
  push('Total Expenses', s.expenses.total);
  push('Fund Disbursements', s.disbursements.total);
  push('Net Operating Result', s.net.collectedLessExpenses);
  push('Cash Inflows', s.cashflow.inflows);
  push('Cash Outflows', s.cashflow.outflows);
  push('Net Cash Flow', s.cashflow.netCashflow);
  push('Stock Value', s.store.stockValue);
  push('Asset Current Value', s.assets.currentValue);

  addSection(rows, 'RECEIVABLES ROLL-FORWARD', ['Line', 'Amount']);
  push('Opening receivables estimate', s.receivables.rollForward.openingEstimate);
  push('New billings in period', s.receivables.rollForward.newBillings);
  push('Collections received', -s.receivables.rollForward.collections);
  push('Estimated adjustments / timing differences', s.receivables.rollForward.estimatedAdjustments);
  push('Closing outstanding receivables', s.receivables.rollForward.closingOutstanding);

  addSection(rows, 'COLLECTIONS BY METHOD', ['Method', 'Amount', 'Transactions']);
  s.collections.byMethod.forEach((m) => push(clean(m.method), m.amount, m.count));

  addSection(rows, 'EXPENSES BY CATEGORY', ['Category', 'Amount', 'Entries']);
  s.expenses.byCategory.forEach((c) => push(clean(c.category), c.amount, c.count));

  addSection(rows, 'EXPENSES BY DEPARTMENT', ['Department', 'Amount']);
  s.expenses.byDepartment.forEach((d) => push(clean(d.department), d.amount));

  addSection(rows, 'RECEIVABLES AGEING', ['Bucket', 'Amount', 'Invoices']);
  s.receivables.ageing.forEach((a) => push(a.bucket, a.amount, a.count));

  addSection(rows, 'RECEIVABLES BY STATUS', ['Status', 'Amount', 'Invoices']);
  s.receivables.byStatus.forEach((a) => push(clean(a.status), a.amount, a.count));

  addSection(rows, 'TOP OUTSTANDING STUDENTS', ['Student', 'Class', 'Invoice', 'Outstanding', 'Days Overdue']);
  s.receivables.topDebtors.forEach((d) => push(d.studentName, d.className, d.invoiceNumber, d.outstanding, d.daysOverdue));

  addSection(rows, 'INVENTORY BY CATEGORY', ['Category', 'Value', 'Items']);
  s.inventory.byCategory.forEach((i) => push(clean(i.category), i.value, i.items));

  addSection(rows, 'LOW STOCK ITEMS', ['Code', 'Item', 'Category', 'On Hand', 'Reorder Level', 'Value']);
  s.inventory.lowStock.forEach((i) => push(i.itemCode, i.name, clean(i.category), i.quantityOnHand, i.reorderLevel, i.stockValue));

  addSection(rows, 'ASSETS BY STATUS', ['Status', 'Current Value', 'Count']);
  s.assetBreakdown.byStatus.forEach((a) => push(clean(a.status), a.value, a.count));

  addSection(rows, 'ASSETS BY CONDITION', ['Condition', 'Current Value', 'Count']);
  s.assetBreakdown.byCondition.forEach((a) => push(clean(a.condition), a.value, a.count));

  addSection(rows, 'RECENT COLLECTIONS', ['Date', 'Reference', 'Payer', 'Method', 'Amount']);
  s.transactions.recentCollections.forEach((t) => push(shortDate(t.date), dash(t.reference), dash(t.payer), clean(t.method), t.amount));

  addSection(rows, 'RECENT EXPENSES', ['Date', 'Category', 'Description', 'Payee', 'Amount']);
  s.transactions.recentExpenses.forEach((t) => push(shortDate(t.date), clean(t.category), dash(t.description), dash(t.payee), t.amount));

  addSection(rows, 'RECENT DISBURSEMENTS', ['Date', 'Request', 'Title', 'Department', 'Amount']);
  s.transactions.recentDisbursements.forEach((t) => push(shortDate(t.date), t.requestNumber, t.title, clean(t.department), t.amount));

  addSection(rows, 'TREND', ['Period', 'Collected', 'Expenses']);
  s.series.forEach((p) => push(p.label, p.collected, p.expenses));

  const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
  return { filename: safeName(s, 'csv'), mimeType: 'text/csv', base64: Buffer.from('\uFEFF' + csv, 'utf8').toString('base64') };
}

function logoPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', '..', 'dashboard', 'public', 'kilimanjaro_logo.png'),
    path.resolve(process.cwd(), '..', '..', '..', 'dashboard', 'public', 'kilimanjaro_logo.png'),
    path.resolve(process.cwd(), 'dashboard', 'public', 'kilimanjaro_logo.png'),
  ];
  return candidates.find((p: string) => fs.existsSync(p)) ?? null;
}

export async function toPdf(s: FinancialStatement): Promise<ExportFile> {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const navy = '#00334f';
  const gold = '#d59a1b';
  const ink = '#0f172a';
  const muted = '#64748b';
  const line = '#d5dde6';
  const green = '#047857';
  const red = '#b91c1c';

  const pageBottom = () => doc.page.height - 54;
  const ensure = (height: number) => { if (doc.y + height > pageBottom()) doc.addPage(); };
  const title = (text: string) => {
    ensure(40);
    doc.moveDown(0.5).fillColor(navy).font('Helvetica-Bold').fontSize(13).text(text, 42, doc.y, { width: 511 });
    doc.moveDown(0.25);
  };
  const note = (text: string) => doc.fillColor(muted).font('Helvetica').fontSize(8.5).text(text, 42, doc.y, { width: 511 });
  const hr = () => doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor(line).lineWidth(1).stroke();
  const cellText = (value: string, x: number, y: number, width: number, opts = {}) => doc.text(value, x, y, { width, lineGap: 1, ...opts });

  const addHeader = () => {
    doc.rect(0, 0, doc.page.width, 104).fill(navy);
    const logo = logoPath();
    if (logo) doc.image(logo, 42, 22, { width: 48, height: 48 });
    doc.fillColor('white').font('Helvetica-Bold').fontSize(18).text('Kilimanjaro Schools', 104, 22);
    doc.fillColor('#cbd5e1').font('Helvetica').fontSize(9).text('Financial Statement and Management Analysis', 104, 46);
    doc.fillColor(gold).font('Helvetica-Bold').fontSize(12).text(s.period.label, 104, 64);
    doc.fillColor('#cbd5e1').font('Helvetica').fontSize(8).text(`Generated ${new Date(s.generatedAt).toLocaleString('en-GB')} | ${s.period.type.toUpperCase()}`, 104, 82, { width: 430 });
    doc.y = 126;
  };

  const kpi = (label: string, value: string, sub: string, x: number, y: number, color = navy) => {
    doc.roundedRect(x, y, 121, 72, 6).fillAndStroke('#f8fafc', line);
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x + 10, y + 10, { width: 101 });
    doc.fillColor(color).font('Helvetica-Bold').fontSize(12).text(value, x + 10, y + 27, { width: 101 });
    doc.fillColor(muted).font('Helvetica').fontSize(7.5).text(sub, x + 10, y + 49, { width: 101 });
  };

  const table = (headers: string[], rows: string[][], widths: number[]) => {
    ensure(28 + rows.length * 22);
    const x0 = 42;
    let y = doc.y;
    doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), 20).fill('#eef5f8');
    doc.fillColor(navy).font('Helvetica-Bold').fontSize(7.5);
    let x = x0;
    headers.forEach((h, i) => { cellText(h.toUpperCase(), x + 6, y + 6, widths[i] - 12); x += widths[i]; });
    y += 20;
    rows.forEach((row, rowIndex) => {
      ensure(22);
      if (y + 22 > pageBottom()) { doc.addPage(); y = doc.y; }
      doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), 22).fill(rowIndex % 2 ? '#ffffff' : '#f8fafc');
      doc.fillColor(ink).font('Helvetica').fontSize(8);
      x = x0;
      row.forEach((c, i) => { cellText(c, x + 6, y + 6, widths[i] - 12, { align: i === row.length - 1 ? 'right' : 'left' }); x += widths[i]; });
      y += 22;
    });
    doc.y = y + 4;
  };

  const emptyRows = (message: string, width = 510) => table(['Management note'], [[message]], [width]);
  const sectionTable = (text: string, headers: string[], rows: string[][], widths: number[], emptyMessage?: string) => {
    const bodyRows = rows.length ? rows : emptyMessage ? [[emptyMessage]] : [];
    ensure(58 + Math.max(bodyRows.length, 1) * 22);
    title(text);
    if (bodyRows.length) table(rows.length ? headers : ['Management note'], bodyRows, rows.length ? widths : [widths.reduce((a, b) => a + b, 0)]);
  };

  addHeader();

  const y = doc.y;
  const collectionContext = s.collections.totalInvoiced > 0
    ? `${pct(s.collections.collectionRate)} of period billing`
    : `${pct(s.collections.collectionRate)} recovered from open fees`;
  const cashCoverageText = s.cashflow.outflows > 0 ? `${s.ratios.cashCoverage.toFixed(2)}x` : 'N/A - no outflows';

  kpi('Collected', money(s.collections.totalCollected), collectionContext, 42, y, green);
  kpi('Outstanding', money(s.collections.outstanding), `${s.receivables.byStatus.reduce((a, b) => a + b.count, 0)} open invoices`, 174, y, gold);
  kpi('Expenses', money(s.expenses.total), `${s.expenses.count} recorded entries`, 306, y, red);
  kpi('Net Cash Flow', money(s.cashflow.netCashflow), `${money(s.cashflow.inflows)} in / ${money(s.cashflow.outflows)} out`, 438, y, s.cashflow.netCashflow >= 0 ? green : red);
  doc.y = y + 88;

  title('Executive Interpretation');
  note(`This statement consolidates confirmed collections, issued invoices, recorded expenditure, disbursed fund requests, live inventory balances and active asset values. New billings may be zero for the selected period when collections relate to invoices raised before the period. In that case recovery and exposure ratios are calculated against open receivables plus current collections.`);
  doc.moveDown(0.4);
  hr();

  sectionTable(
    'Statement of Financial Performance',
    ['Line item', 'Amount'],
    [
      ['New fees invoiced in selected period', money(s.collections.totalInvoiced)],
      ['Confirmed collections received', money(s.collections.totalCollected)],
      ['Outstanding receivables still open', money(s.collections.outstanding)],
      ['Recorded operating expenses', money(s.expenses.total)],
      ['Approved fund disbursements', money(s.disbursements.total)],
      ['Collected less expenses', money(s.net.collectedLessExpenses)],
    ],
    [350, 160],
  );

  sectionTable(
    'Receivables Roll-Forward',
    ['Line item', 'Amount'],
    [
      ['Opening receivables estimate', money(s.receivables.rollForward.openingEstimate)],
      ['New billings raised in period', money(s.receivables.rollForward.newBillings)],
      ['Collections received during period', `(${money(s.receivables.rollForward.collections)})`],
      ['Estimated adjustments / timing differences', money(s.receivables.rollForward.estimatedAdjustments)],
      ['Closing outstanding receivables', money(s.receivables.rollForward.closingOutstanding)],
    ],
    [350, 160],
  );

  sectionTable(
    'Cash Flow and Operating Ratios',
    ['Measure', 'Value'],
    [
      ['Cash inflows from collections', money(s.cashflow.inflows)],
      ['Cash outflows from expenses and disbursements', money(s.cashflow.outflows)],
      ['Net cash movement', money(s.cashflow.netCashflow)],
      ['Expense to collection rate', pct(s.ratios.expenseToCollectionRate)],
      ['Receivable exposure rate', `${pct(s.ratios.receivableExposureRate)} of recoverable fee base`],
      ['Cash coverage ratio', cashCoverageText],
    ],
    [350, 160],
  );

  sectionTable('Receivables Ageing', ['Age bucket', 'Invoices', 'Amount'], s.receivables.ageing.map((r) => [r.bucket, String(r.count), money(r.amount)]), [220, 90, 200]);

  if (s.receivables.topDebtors.length) {
    sectionTable(
      'Priority Fee Follow-Up List',
      ['Student', 'Class', 'Invoice', 'Days', 'Outstanding'],
      s.receivables.topDebtors.slice(0, 12).map((d) => [d.studentName, d.className, d.invoiceNumber, String(d.daysOverdue), money(d.outstanding)]),
      [138, 92, 100, 55, 125],
    );
  }

  sectionTable('Collections by Payment Method', ['Method', 'Transactions', 'Amount'], s.collections.byMethod.map((m) => [clean(m.method), String(m.count), money(m.amount)]), [220, 90, 200], 'No confirmed collections were recorded in this period.');

  sectionTable('Expenditure Control', ['Category', 'Entries', 'Amount'], s.expenses.byCategory.map((c) => [clean(c.category), String(c.count), money(c.amount)]), [220, 90, 200], 'No recorded expenses were posted in this period. Confirm that all cash and bank outflows have been captured before using this as a final monthly pack.');
  if (s.expenses.byDepartment.length) {
    table(['Department', 'Amount'], s.expenses.byDepartment.slice(0, 10).map((d) => [clean(d.department), money(d.amount)]), [310, 200]);
  }

  sectionTable(
    'Inventory and Assets',
    ['Measure', 'Value'],
    [
      ['Inventory value on hand', money(s.store.stockValue)],
      ['Stock received in period', money(s.store.received)],
      ['Stock issued in period', money(s.store.issued)],
      ['Active asset book value', money(s.assets.currentValue)],
      ['Active asset count', String(s.assets.count)],
    ],
    [350, 160],
  );
  if (s.inventory.lowStock.length) {
    sectionTable(
      'Low Stock Exceptions',
      ['Code', 'Item', 'Category', 'On hand', 'Reorder', 'Value'],
      s.inventory.lowStock.slice(0, 10).map((i) => [i.itemCode, i.name, clean(i.category), String(i.quantityOnHand), String(i.reorderLevel), money(i.stockValue)]),
      [58, 145, 85, 58, 58, 106],
    );
  } else {
    title('Low Stock Exceptions');
    emptyRows('No active store item is currently below its reorder level.');
  }

  title('Recent Transaction Register');
  if (s.transactions.recentCollections.length) {
    table(['Collection date', 'Reference', 'Payer', 'Method', 'Amount'], s.transactions.recentCollections.slice(0, 8).map((t) => [shortDate(t.date), dash(t.reference), dash(t.payer), clean(t.method), money(t.amount)]), [82, 98, 135, 85, 110]);
  } else {
    emptyRows('No recent confirmed collection transactions are available for this period.');
  }
  if (s.transactions.recentExpenses.length) {
    table(['Expense date', 'Category', 'Description', 'Payee', 'Amount'], s.transactions.recentExpenses.slice(0, 8).map((t) => [shortDate(t.date), clean(t.category), dash(t.description), dash(t.payee), money(t.amount)]), [82, 82, 160, 76, 110]);
  }

  doc.end();
  const buffer = await done;
  return { filename: safeName(s, 'pdf'), mimeType: 'application/pdf', base64: buffer.toString('base64') };
}
