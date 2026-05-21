import { describe, expect, it } from 'vitest';
import {
  bankReferenceIsValid,
  duplicateReferenceWarning,
  formatTZS,
  isOverpayment,
  overdueInvoices,
} from './money';

describe('finance money utilities', () => {
  it('formats Tanzanian shillings without decimals', () => {
    expect(formatTZS(1_200_000)).toBe('TZS 1,200,000');
    expect(formatTZS(-45_000)).toBe('-TZS 45,000');
  });

  it('detects overpayments against the selected invoice', () => {
    expect(isOverpayment(1_300_000, 1_200_000)).toBe(true);
    expect(isOverpayment(800_000, 1_200_000)).toBe(false);
  });

  it('requires and de-duplicates bank references', () => {
    expect(bankReferenceIsValid('CRDB-8841')).toBe(true);
    expect(bankReferenceIsValid('   ')).toBe(false);
    expect(duplicateReferenceWarning(' crdb-8841 ', ['CRDB-8841'])).toBe(true);
  });

  it('filters overdue invoices for finance triage', () => {
    expect(overdueInvoices([{ status: 'PAID' }, { status: 'OVERDUE' }])).toHaveLength(1);
  });
});
