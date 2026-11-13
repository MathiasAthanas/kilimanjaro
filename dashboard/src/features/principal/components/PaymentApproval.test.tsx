import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PrincipalPaymentApproval } from '../types/principal.types';

const approve = vi.fn();
const reject = vi.fn();
vi.mock('../api/principal.hooks', () => ({
  useApprovePaymentMutation: () => ({ mutate: approve, isPending: false }),
  useRejectPaymentMutation: () => ({ mutate: reject, isPending: false }),
}));

import { PaymentApprovalCard } from './PaymentApproval';
import { shortInvoice } from '../utils/invoiceNumber';

const payment = (over: Partial<PrincipalPaymentApproval> = {}): PrincipalPaymentApproval => ({
  id: 'a1', paymentId: 'p1', paymentNumber: 'PAY-KS-PRIMARY-SHOO-2026-00000001', student: 'Thawban Hilal Athumani', registration: 'KEMS-P-26112',
  invoice: 'INV-KS-PRIMARY-SHOO-2026-8F7DEA98B19645A7A4A29C51B82BD99C-00238', invoiceId: 'inv1', method: 'CASH', amount: 700000, reference: '', enteredBy: 'Finance office',
  age: 'just now', risk: 'stable', notes: '', evidenceUrl: '', paidAt: '2026-11-13T09:00:00.000Z', ...over,
});

const renderCard = (over?: Partial<PrincipalPaymentApproval>) =>
  render(<MemoryRouter><PaymentApprovalCard approval={payment(over)} /></MemoryRouter>);

const approveBtn = () => screen.getByRole('button', { name: /Approve/ }) as HTMLButtonElement;
const rejectBtn = () => screen.getByRole('button', { name: /Reject/ }) as HTMLButtonElement;

describe('shortInvoice', () => {
  it('drops the long internal code but keeps the readable ends', () => {
    expect(shortInvoice('INV-KS-PRIMARY-SHOO-2026-8F7DEA98B19645A7A4A29C51B82BD99C-00238')).toBe('INV-KS-PRIMARY-SHOO-2026-…00238');
  });
  it('leaves an ordinary number alone', () => {
    expect(shortInvoice('INV-2026-0001')).toBe('INV-2026-0001');
  });
});

describe('PaymentApprovalCard', () => {
  beforeEach(() => { approve.mockReset(); reject.mockReset(); });

  it('shows who, how much and what for, without the evidence wording for cash being wrong', () => {
    renderCard();
    expect(screen.getByText('Thawban Hilal Athumani')).toBeTruthy();
    expect(screen.getByText('TZS 700,000')).toBeTruthy();
    expect(screen.getByText('None (cash)')).toBeTruthy();
    expect(screen.getByText('Cash received and counted')).toBeTruthy();
    expect(screen.queryByText(/bank slip/i)).toBeNull();
  });

  it('offers bank wording for a bank payment', () => {
    renderCard({ method: 'BANK_TRANSFER', reference: 'NMB-1' });
    expect(screen.getByText('Bank slip matches the reference')).toBeTruthy();
    expect(screen.getByText('NMB-1')).toBeTruthy();
  });

  it('keeps Approve and Reject locked until there is a real note, and Approve until the box is ticked', () => {
    renderCard();
    expect(approveBtn().disabled).toBe(true);
    expect(rejectBtn().disabled).toBe(true);
    fireEvent.click(screen.getByText('Cash received and counted'));
    expect(rejectBtn().disabled).toBe(false);
    expect(approveBtn().disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(approveBtn().disabled).toBe(false);
  });

  it('sends the note with the approval', () => {
    renderCard();
    fireEvent.click(screen.getByText('Matches the receipt book'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(approveBtn());
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve.mock.calls[0][0]).toEqual({ id: 'a1', notes: 'Matches the receipt book' });
  });

  it('rejects with the typed reason and does not need the confirmation box', () => {
    renderCard();
    fireEvent.change(screen.getByPlaceholderText(/Pick one above/), { target: { value: 'Amount does not match the receipt' } });
    fireEvent.click(rejectBtn());
    expect(reject).toHaveBeenCalledTimes(1);
    expect(reject.mock.calls[0][0]).toEqual({ id: 'a1', reason: 'Amount does not match the receipt' });
  });

  it('refuses a note that is too short', () => {
    renderCard();
    fireEvent.change(screen.getByPlaceholderText(/Pick one above/), { target: { value: 'ok' } });
    expect(rejectBtn().disabled).toBe(true);
  });
});
