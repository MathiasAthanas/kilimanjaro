import { describe, expect, it } from 'vitest';
import { financeHeaderLinks } from './financeHeaderLinks';

describe('finance workspace next steps', () => {
  it('starts in ledgers and keeps posting next to the right ledger', () => {
    expect(financeHeaderLinks('/finance').map((link) => link.to)).toEqual(['/finance/invoices', '/finance/payments']);
    expect(financeHeaderLinks('/finance/invoices').map((link) => link.to)).toContain('/finance/invoices/generate');
    expect(financeHeaderLinks('/finance/payments').map((link) => link.to)).toEqual(expect.arrayContaining([
      '/finance/payments/cash', '/finance/payments/bank', '/finance/payments/pending',
    ]));
  });

  it('returns from records and setup forms to their directories', () => {
    expect(financeHeaderLinks('/finance/invoices/one')[0].to).toBe('/finance/invoices');
    expect(financeHeaderLinks('/finance/payments/cash')[0].to).toBe('/finance/payments');
    expect(financeHeaderLinks('/finance/receipts/one')[0].to).toBe('/finance/receipts');
    expect(financeHeaderLinks('/finance/fee-structures/create')[0].to).toBe('/finance/fee-structures');
    expect(financeHeaderLinks('/finance/assets/one')[0].to).toBe('/finance/assets');
  });
});
