export function normalizeTzPhone(input: string): string | null {
  const raw = (input || '').replace(/\s+/g, '').replace(/-/g, '');
  if (!raw) return null;

  if (raw.startsWith('+') && /^\+\d{10,15}$/.test(raw)) return raw;
  if (raw.startsWith('255') && /^255\d{9}$/.test(raw)) return `+${raw}`;
  if ((raw.startsWith('07') || raw.startsWith('06')) && raw.length === 10) return `+255${raw.slice(1)}`;
  if (/^\+\d{10,15}$/.test(raw)) return raw;
  return null;
}
