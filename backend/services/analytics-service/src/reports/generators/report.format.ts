import type { ColumnKind, RowValue } from './report.types';

const MONEY_HINT = /(amount|billed|invoiced|collected|outstanding|revenue|asset|waived|discount|exposure|cost|forecast|balance)/;
const PERCENT_HINT = /(rate|average|score|%|percent)/;
const COUNT_HINT = /(below|count|invoices|channels)/;

/** Parses numbers that arrive as numbers, Decimal strings ("1234.5") or comma-grouped text. Returns null for anything else. */
export function toNumber(value: RowValue): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Guesses how to show a figure from its label. Generators pass an explicit kind whenever the guess would be wrong. */
export function inferKind(label: string): ColumnKind {
  const text = label.toLowerCase();
  if (COUNT_HINT.test(text) && !/rate|%\)/.test(text)) return 'int';
  if (PERCENT_HINT.test(text)) return 'percent';
  if (MONEY_HINT.test(text)) return 'money';
  return 'int';
}

function render(n: number, kind: ColumnKind): string {
  switch (kind) {
    case 'money':
      return `TZS ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    case 'percent':
      return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;
    case 'decimal':
      return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    default:
      return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
}

const tidy = (value: RowValue) => String(value).replaceAll('_', ' ');

export function formatValue(label: string, value: RowValue, kind?: ColumnKind): string {
  if (value === null || value === undefined || value === '') return '-';
  const resolved = kind ?? inferKind(label);
  if (resolved === 'text') return tidy(value);
  const n = toNumber(value);
  return n === null ? tidy(value) : render(n, resolved);
}

/** Table cells: amounts are plain numbers because the column header already says (TZS). */
export function formatCell(value: RowValue, kind?: ColumnKind): string {
  if (value === null || value === undefined || value === '') return '-';
  if (!kind || kind === 'text') return tidy(value);
  const n = toNumber(value);
  if (n === null) return tidy(value);
  return kind === 'money' ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : render(n, kind);
}

/** Column heading, with the currency spelled out once for money columns. */
export function headerLabel(column: { header: string; kind?: ColumnKind }): string {
  return column.kind === 'money' && !/tzs/i.test(column.header) ? `${column.header} (TZS)` : column.header;
}

/** Reads a number from a Prisma Decimal, a numeric string or a number; anything else is 0. */
export const num = (value: any): number => {
  const n = Number(value?.toString?.() ?? value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** "TZS 1,234,567" for use inside sentences. */
export const tzs = (value: any): string => `TZS ${num(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const pct = (value: any, digits = 2): string => `${num(value).toFixed(digits)}%`;

/** "CASH" or "BANK_TRANSFER" as "Cash" / "Bank transfer". */
export const words = (value: any): string => {
  const text = String(value ?? 'Unknown').replaceAll('_', ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
