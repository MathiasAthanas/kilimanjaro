import { api } from '../../../lib/api/client';
import { formatClassLabel } from '../../../lib/classLabel';

type Row = Record<string, unknown>;
type Column = [header: string, value: (row: Row) => unknown];

const payload = (r: { data?: unknown }): unknown => {
  const d = r.data as { data?: unknown } | undefined;
  return d && typeof d === 'object' && 'data' in d ? d.data : d;
};
const rowsOf = (v: unknown): Row[] => {
  if (Array.isArray(v)) return v as Row[];
  const o = v as { items?: unknown } | null;
  return Array.isArray(o?.items) ? (o!.items as Row[]) : [];
};
const text = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const day = (v: unknown): string => (v ? String(v).slice(0, 10) : '');
const nested = (v: unknown, key: string): unknown => (v && typeof v === 'object' ? (v as Row)[key] : undefined);

/** Quotes a cell, and defuses spreadsheet formulas (=, +, -, @) in text that came from users. */
function cell(value: unknown): string {
  let s = text(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function download(fileName: string, rows: Row[], columns: Column[]): void {
  const lines = [columns.map(([h]) => cell(h)).join(',')];
  for (const row of rows) lines.push(columns.map(([, get]) => cell(get(row))).join(','));
  // BOM so Excel reads UTF-8 names correctly
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Walks every page of a server-paged ledger (capped so a mistake cannot hammer the API). */
async function allPages(path: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let page = 1; page <= 100; page++) {
    const raw = payload(await api.get(path, { params: { paged: 1, limit: 100, page } })) as { items?: Row[]; meta?: { totalPages?: number } };
    out.push(...(raw.items ?? []));
    if (page >= (raw.meta?.totalPages ?? 1)) break;
  }
  return out;
}

const stamp = () => new Date().toISOString().slice(0, 10);

export type ExportKey = 'invoices' | 'payments' | 'receipts' | 'outstanding' | 'collection' | 'fee-structures' | 'assets' | 'audit';

export const EXPORTS: Array<{ key: ExportKey; label: string; description: string }> = [
  { key: 'invoices', label: 'Invoices', description: 'Every invoice with student, class, term, amounts and status.' },
  { key: 'payments', label: 'Payments', description: 'Every payment with method, reference and approval status.' },
  { key: 'receipts', label: 'Receipts', description: 'Every receipt issued, including voided ones.' },
  { key: 'outstanding', label: 'Outstanding balances', description: 'Invoices that still owe money, biggest debt first.' },
  { key: 'collection', label: 'Collection by class', description: 'Billed, collected and outstanding per class.' },
  { key: 'fee-structures', label: 'Fee structures', description: 'What each class is charged per fee category and term.' },
  { key: 'assets', label: 'Assets register', description: 'Tracked assets with cost, current value and condition.' },
  { key: 'audit', label: 'Audit log', description: 'The financial audit trail you are allowed to see.' },
];

/** Loads the same scoped records used by CSV exports for the pre-download preview. */
export async function loadFinanceExportRows(key: ExportKey): Promise<Array<Record<string, string | number | boolean | null | undefined>>> {
  switch (key) {
    case 'invoices':
      return (await allPages('/finance/invoices')).map((r) => ({ id: text(r.id), invoice: text(r.invoiceNumber), student: text(r.studentName), registration: text(r.registrationNumber), className: text(r.className), term: text(r.termName), total: Number(r.totalAmount ?? 0), paid: Number(r.paidAmount ?? 0), outstanding: Number(r.outstandingBalance ?? 0), status: text(r.status), date: day(r.dueDate) }));
    case 'payments':
      return (await allPages('/finance/payments')).map((r) => ({ id: text(r.id), payment: text(r.paymentNumber), student: text(r.studentName), invoice: text(r.invoiceNumber), method: text(r.method), amount: Number(r.amount ?? 0), status: text(r.status), reference: text(r.referenceNumber), date: day(r.paidAt) }));
    case 'receipts':
      return (await allPages('/finance/receipts')).map((r) => ({ id: text(r.id), receipt: text(r.receiptNumber), payment: text(r.paymentNumber), student: text(r.studentName), amount: Number(r.amount ?? 0), method: text(r.method), status: r.isVoided ? 'VOID' : 'ACTIVE', date: day(r.issuedAt) }));
    case 'outstanding':
      return rowsOf(payload(await api.get('/finance/reports/outstanding-balances'))).map((r) => ({ id: text(r.id ?? r.invoiceId), student: text(r.studentName), registration: text(r.registrationNumber), className: text(r.className), invoice: text(r.invoiceNumber), total: Number(r.totalAmount ?? 0), paid: Number(r.paidAmount ?? 0), outstanding: Number(r.outstanding ?? r.outstandingBalance ?? 0), daysOverdue: Number(r.daysOverdue ?? 0), date: day(r.dueDate) }));
    case 'collection': {
      const raw = payload(await api.get('/finance/reports/collection-summary')) as { byClass?: Row[] };
      return (raw.byClass ?? []).map((r) => ({ id: text(r.classId ?? r.className), className: text(r.className), invoices: Number(r.invoiceCount ?? 0), billed: Number(r.billed ?? 0), collected: Number(r.collected ?? 0), outstanding: Number(r.outstanding ?? 0), collectionRate: Number(r.collectionRate ?? 0) }));
    }
    case 'fee-structures': {
      const [structures, classes, terms] = await Promise.all([api.get('/finance/fee-structures').then((r) => rowsOf(payload(r))), api.get('/students/classes').then((r) => rowsOf(payload(r))), api.get('/students/terms').then((r) => rowsOf(payload(r)))]);
      const className = new Map(classes.map((c) => [text(c.id), formatClassLabel(text(c.name), text(c.stream))]));
      const termName = new Map(terms.map((t) => [text(t.id), text(t.name)]));
      return structures.map((r) => ({ id: text(r.id), category: text(nested(r.feeCategory, 'name')), className: className.get(text(r.classId)) ?? '', stage: text(r.educationStage), term: termName.get(text(r.termId)) ?? 'All terms', amount: Number(r.amount ?? 0), status: r.isActive ? 'ACTIVE' : 'INACTIVE' }));
    }
    case 'assets':
      return rowsOf(payload(await api.get('/finance/assets'))).map((r) => ({ id: text(r.id), assetNumber: text(r.assetNumber), name: text(r.name), category: text(r.category), location: text(r.location), condition: text(r.condition), status: text(r.status), purchaseCost: Number(r.purchaseCost ?? 0), currentValue: Number(r.currentValue ?? 0), date: day(r.purchaseDate) }));
    case 'audit':
      return rowsOf(payload(await api.get('/finance/audit-logs', { params: { limit: 1000 } }))).map((r) => ({ id: text(r.id), date: text(r.createdAt), role: text(r.performedByRole), action: text(r.action), entityType: text(r.entityType), entityId: text(r.entityId) }));
  }
}

export async function exportFinanceCsv(key: ExportKey): Promise<number> {
  switch (key) {
    case 'invoices': {
      const rows = await allPages('/finance/invoices');
      download(`invoices-${stamp()}.csv`, rows, [
        ['Invoice', (r) => r.invoiceNumber], ['Student', (r) => r.studentName], ['Registration', (r) => r.registrationNumber],
        ['Class', (r) => r.className], ['Term', (r) => r.termName], ['Total', (r) => r.totalAmount], ['Paid', (r) => r.paidAmount],
        ['Outstanding', (r) => r.outstandingBalance], ['Status', (r) => r.status], ['Due date', (r) => day(r.dueDate)],
      ]);
      return rows.length;
    }
    case 'payments': {
      const rows = await allPages('/finance/payments');
      download(`payments-${stamp()}.csv`, rows, [
        ['Payment', (r) => r.paymentNumber], ['Student', (r) => r.studentName], ['Registration', (r) => r.registrationNumber],
        ['Invoice', (r) => r.invoiceNumber], ['Method', (r) => r.method], ['Amount', (r) => r.amount], ['Status', (r) => r.status],
        ['Reference', (r) => r.referenceNumber], ['Paid by', (r) => r.payerName], ['Paid on', (r) => day(r.paidAt)],
      ]);
      return rows.length;
    }
    case 'receipts': {
      const rows = await allPages('/finance/receipts');
      download(`receipts-${stamp()}.csv`, rows, [
        ['Receipt', (r) => r.receiptNumber], ['Payment', (r) => r.paymentNumber], ['Invoice', (r) => r.invoiceNumber],
        ['Student', (r) => r.studentName], ['Amount', (r) => r.amount], ['Method', (r) => r.method], ['Issued', (r) => day(r.issuedAt)],
        ['Status', (r) => (r.isVoided ? 'VOID' : 'ACTIVE')], ['Void reason', (r) => r.voidReason],
      ]);
      return rows.length;
    }
    case 'outstanding': {
      const rows = rowsOf(payload(await api.get('/finance/reports/outstanding-balances')));
      download(`outstanding-balances-${stamp()}.csv`, rows, [
        ['Student', (r) => r.studentName], ['Registration', (r) => r.registrationNumber], ['Class', (r) => r.className],
        ['Invoice', (r) => r.invoiceNumber], ['Total', (r) => r.totalAmount], ['Paid', (r) => r.paidAmount],
        ['Outstanding', (r) => r.outstanding ?? r.outstandingBalance], ['Due date', (r) => day(r.dueDate)], ['Days overdue', (r) => r.daysOverdue],
      ]);
      return rows.length;
    }
    case 'collection': {
      const raw = payload(await api.get('/finance/reports/collection-summary')) as { byClass?: Row[] };
      const rows = raw.byClass ?? [];
      download(`collection-by-class-${stamp()}.csv`, rows, [
        ['Class', (r) => r.className], ['Invoices', (r) => r.invoiceCount], ['Billed', (r) => r.billed], ['Collected', (r) => r.collected],
        ['Outstanding', (r) => r.outstanding], ['Collection rate %', (r) => r.collectionRate],
      ]);
      return rows.length;
    }
    case 'fee-structures': {
      const [structures, classes, terms] = await Promise.all([
        api.get('/finance/fee-structures').then((r) => rowsOf(payload(r))),
        api.get('/students/classes').then((r) => rowsOf(payload(r))),
        api.get('/students/terms').then((r) => rowsOf(payload(r))),
      ]);
      const className = new Map(classes.map((c) => [text(c.id), formatClassLabel(text(c.name), text(c.stream))]));
      const termName = new Map(terms.map((t) => [text(t.id), text(t.name)]));
      download(`fee-structures-${stamp()}.csv`, structures, [
        ['Fee category', (r) => nested(r.feeCategory, 'name')], ['Class', (r) => className.get(text(r.classId)) ?? ''], ['Stage', (r) => r.educationStage],
        ['Level', (r) => r.classLevel], ['Student group', (r) => r.studentGroup], ['Residence', (r) => r.residenceType], ['Term', (r) => termName.get(text(r.termId)) ?? 'All terms'],
        ['Amount', (r) => r.amount], ['Active', (r) => (r.isActive ? 'yes' : 'no')],
      ]);
      return structures.length;
    }
    case 'assets': {
      const rows = rowsOf(payload(await api.get('/finance/assets')));
      download(`assets-${stamp()}.csv`, rows, [
        ['Asset number', (r) => r.assetNumber], ['Name', (r) => r.name], ['Category', (r) => r.category], ['Type', (r) => r.type],
        ['Location', (r) => r.location], ['Condition', (r) => r.condition], ['Status', (r) => r.status], ['Purchased', (r) => day(r.purchaseDate)],
        ['Purchase cost', (r) => r.purchaseCost], ['Current value', (r) => r.currentValue],
      ]);
      return rows.length;
    }
    case 'audit': {
      // The audit endpoint answers at most 100 rows a page and has no total, so keep going until a page is short.
      const rows: Row[] = [];
      for (let page = 1; page <= 50; page++) {
        const batch = rowsOf(payload(await api.get('/finance/audit-logs', { params: { limit: 100, page } })));
        rows.push(...batch);
        if (batch.length < 100) break;
      }
      download(`financial-audit-log-${stamp()}.csv`, rows, [
        ['When', (r) => r.createdAt], ['Role', (r) => r.performedByRole], ['Action', (r) => r.action], ['Record type', (r) => r.entityType], ['Record id', (r) => r.entityId],
      ]);
      return rows.length;
    }
  }
}
