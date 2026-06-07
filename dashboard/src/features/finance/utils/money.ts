export function formatTZS(amount: number) {
  const sign = amount < 0 ? '-' : '';
  const value = Math.abs(amount);
  return `${sign}TZS ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
}

/** Format an ISO date string as e.g. "13 May 2026". Falls back to '—'. */
export function formatDate(value: unknown): string {
  if (!value || typeof value !== 'string') return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function parseTZSInput(value: string) {
  return Number(value.replace(/[^\d]/g, '')) || 0;
}

export function isOverpayment(amount: number, outstanding: number) {
  return amount > outstanding;
}

export function bankReferenceIsValid(reference: string) {
  return reference.trim().length > 0;
}

export function duplicateReferenceWarning(reference: string, existingReferences: string[]) {
  const normalized = reference.trim().toLowerCase();
  return normalized.length > 0 && existingReferences.some((item) => item.trim().toLowerCase() === normalized);
}

export function overdueInvoices<T extends { status: string }>(rows: T[]) {
  return rows.filter((row) => row.status === 'OVERDUE');
}
