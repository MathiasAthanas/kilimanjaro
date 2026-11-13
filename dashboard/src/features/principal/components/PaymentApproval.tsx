import { CheckCircle2, ChevronRight, Clock, ExternalLink, Paperclip, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { errorMessage } from '../../../lib/api/errors';
import { useApprovePaymentMutation, useRejectPaymentMutation } from '../api/principal.hooks';
import type { PrincipalPaymentApproval, Urgency } from '../types/principal.types';
import { shortInvoice } from '../utils/invoiceNumber';
import { canApprovePayment } from '../utils/principalDecision';

function methodLabel(method: string): string {
  const m = method.toUpperCase();
  if (m.includes('CASH')) return 'Cash';
  if (m.includes('BANK')) return 'Bank transfer';
  if (m.includes('MOBILE')) return 'Mobile money';
  if (m.includes('CHEQUE') || m.includes('CHECK')) return 'Cheque';
  return method ? method.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Payment';
}

/** One-tap notes that fit how the money arrived, so the approver is not typing the same sentence all day. */
function quickNotes(method: string): string[] {
  const m = method.toUpperCase();
  const common = 'Amount and student verified';
  if (m.includes('CASH')) return ['Cash received and counted', 'Matches the receipt book', common];
  if (m.includes('BANK')) return ['Bank slip matches the reference', 'Found on the bank statement', common];
  if (m.includes('MOBILE')) return ['Mobile money message matches the reference', common];
  return ['Details checked against the invoice', common];
}

const WAIT_TONE: Record<Urgency, string> = {
  critical: 'bg-ks-rose/10 text-ks-rose',
  high: 'bg-ks-amber/10 text-[#8a5a00]',
  medium: 'bg-ks-blue/10 text-ks-blue',
  stable: 'bg-ks-emerald/10 text-ks-emerald',
};

const NOTE_MIN = 8;

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-ks-navy">{children}</dd>
    </div>
  );
}

/** The decision form: a note, a confirmation, and Approve / Reject. Works the same in the list and on the detail page. */
export function PaymentDecisionPanel({ approval, onDone }: { approval: PrincipalPaymentApproval; onDone?: () => void }) {
  const approveMutation = useApprovePaymentMutation();
  const rejectMutation = useRejectPaymentMutation();
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<'approved' | 'rejected' | null>(null);
  const busy = approveMutation.isPending || rejectMutation.isPending;
  const noteOk = note.trim().length >= NOTE_MIN;
  const canApprove = canApprovePayment(confirmed, note);

  if (outcome) {
    const ok = outcome === 'approved';
    return (
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${ok ? 'border-ks-emerald/30 bg-ks-emerald/10 text-ks-emerald' : 'border-ks-rose/30 bg-ks-rose/10 text-ks-rose'}`}>
        {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0" />}
        <div>
          <p className="text-sm font-black">{ok ? 'Payment approved' : 'Payment rejected'}</p>
          <p className="mt-0.5 text-xs font-semibold opacity-90">{ok ? 'The invoice balance is updated and the receipt has been issued.' : 'The finance office can see your reason and correct the entry.'}</p>
        </div>
      </div>
    );
  }

  const approve = () => {
    if (!canApprove || busy) return;
    approveMutation.mutate(
      { id: approval.id, notes: note.trim() },
      {
        onSuccess: () => { setOutcome('approved'); toast('Payment approved · receipt issued', 'success'); onDone?.(); },
        onError: (e) => toast(errorMessage(e, 'Could not approve this payment. Please try again.'), 'error'),
      },
    );
  };

  const reject = () => {
    if (!noteOk || busy) return;
    rejectMutation.mutate(
      { id: approval.id, reason: note.trim() },
      {
        onSuccess: () => { setOutcome('rejected'); toast('Payment rejected', 'info'); onDone?.(); },
        onError: (e) => toast(errorMessage(e, 'Could not reject this payment. Please try again.'), 'error'),
      },
    );
  };

  const hint = !noteOk
    ? `Write a short note (at least ${NOTE_MIN} characters). It is kept in the audit log.`
    : !confirmed
      ? 'Tick the box to enable Approve.'
      : 'Ready. Approving issues the receipt straight away.';

  return (
    <div className="flex h-full flex-col">
      <label htmlFor={`note-${approval.id}`} className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Decision note</label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {quickNotes(approval.method).map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setNote(text)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${note === text ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line bg-white text-ks-slate hover:border-ks-navy hover:text-ks-navy'}`}
          >
            {text}
          </button>
        ))}
      </div>
      <textarea
        id={`note-${approval.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        maxLength={500}
        className="mt-2 w-full resize-none rounded-xl border border-ks-line bg-white p-3 text-sm font-semibold text-ks-navy outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/15"
        placeholder="Pick one above or write your own…"
      />

      <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm font-bold text-ks-slate">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ks-navy" />
        I have checked this payment against the invoice.
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={approve}
          disabled={!canApprove || busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ks-emerald px-4 text-sm font-black text-white shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          onClick={reject}
          disabled={!noteOk || busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-ks-rose/40 bg-white px-4 text-sm font-black text-ks-rose transition hover:bg-ks-rose/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <XCircle className="h-4 w-4" /> {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
        </button>
      </div>
      <p className="mt-2 text-xs font-semibold text-ks-muted" aria-live="polite">{hint}</p>
    </div>
  );
}

/** A payment waiting for a decision: what it is on the left, what to do about it on the right. */
export function PaymentApprovalCard({ approval, onDone, showDetailLink = true }: { approval: PrincipalPaymentApproval; onDone?: () => void; showDetailLink?: boolean }) {
  const waiting = approval.age === 'just now' ? 'Just submitted' : approval.age ? `Waiting ${approval.age}` : '';
  const isCash = approval.method.toUpperCase().includes('CASH');
  return (
    <article className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-ks-navy/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-ks-navy">{methodLabel(approval.method)}</span>
            {waiting && (
              <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${WAIT_TONE[approval.risk]}`}>
                <Clock className="h-3 w-3" /> {waiting}
              </span>
            )}
            <span className="ml-auto font-mono text-[11px] font-bold text-ks-muted">{approval.paymentNumber || 'Payment'}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <h3 className="font-display text-2xl font-black leading-tight text-ks-navy">{approval.student}</h3>
              {approval.registration && <p className="mt-0.5 text-sm font-semibold text-ks-muted">{approval.registration}</p>}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Amount</p>
              <p className="font-mono text-2xl font-black text-ks-navy">TZS {approval.amount.toLocaleString('en-US')}</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-x-8 gap-y-4 border-t border-ks-line pt-5 sm:grid-cols-2">
            <Fact label="Invoice">
              <span title={approval.invoice} className="font-mono text-[13px]">{approval.invoice ? shortInvoice(approval.invoice) : '—'}</span>
              {approval.invoiceId && (
                <NavLink to={`/finance/invoices/${approval.invoiceId}`} className="mt-1 flex items-center gap-1 text-xs font-black text-ks-blue hover:underline">
                  Open invoice <ExternalLink className="h-3 w-3" />
                </NavLink>
              )}
            </Fact>
            <Fact label="Received on">{formatDate(approval.paidAt)}</Fact>
            <Fact label="Reference">{approval.reference || <span className="font-semibold text-ks-muted">{isCash ? 'None (cash)' : 'None given'}</span>}</Fact>
            <Fact label="Entered by">{approval.enteredBy}</Fact>
            <Fact label="Evidence">
              {approval.evidenceUrl ? (
                <a href={approval.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ks-blue hover:underline">
                  <Paperclip className="h-3.5 w-3.5" /> View attachment
                </a>
              ) : (
                <span className="font-semibold text-ks-muted">Nothing attached</span>
              )}
            </Fact>
            {approval.notes && <Fact label="Finance office note" wide>{approval.notes}</Fact>}
          </dl>

          {showDetailLink && (
            <NavLink to={`/principal/finance/approvals/${approval.id}`} className="mt-5 inline-flex items-center gap-1 text-xs font-black text-ks-navy hover:underline">
              Full detail <ChevronRight className="h-3.5 w-3.5" />
            </NavLink>
          )}
        </div>

        <div className="border-t border-ks-line bg-ks-paper/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <PaymentDecisionPanel approval={approval} onDone={onDone} />
        </div>
      </div>
    </article>
  );
}
