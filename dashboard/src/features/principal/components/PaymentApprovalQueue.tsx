import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Clock, ExternalLink, Paperclip, X, XCircle } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { DataPagination, SortHeader, TableToolbar, useTableControls } from '../../../components/common/table';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { DataError } from '../../../components/feedback/DataError';
import { useAuthStore } from '../../../lib/auth/authStore';
import { errorMessage } from '../../../lib/api/errors';
import { toast } from '../../../lib/toast';
import { fetchMatchingApprovals, useDecidePaymentsMutation, usePendingApprovalsPage, type BulkDecisionResult } from '../api/principal.hooks';
import type { PrincipalPaymentApproval, Urgency } from '../types/principal.types';
import { shortInvoice } from '../utils/invoiceNumber';
import { PaymentDecisionPanel } from './PaymentApproval';

const NOTE_MIN = 8;

const WAIT_TONE: Record<Urgency, string> = {
  critical: 'bg-ks-rose/10 text-ks-rose',
  high: 'bg-ks-amber/10 text-[#8a5a00]',
  medium: 'bg-ks-blue/10 text-ks-blue',
  stable: 'bg-ks-emerald/10 text-ks-emerald',
};

const METHODS: Array<{ key: string; label: string }> = [
  { key: '', label: 'All' },
  { key: 'CASH', label: 'Cash' },
  { key: 'BANK_TRANSFER', label: 'Bank' },
  { key: 'MOBILE_MONEY', label: 'Mobile money' },
];

function methodLabel(method: string): string {
  const m = method.toUpperCase();
  if (m.includes('CASH')) return 'Cash';
  if (m.includes('BANK')) return 'Bank transfer';
  if (m.includes('MOBILE')) return 'Mobile money';
  return method ? method.replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Payment';
}

const tzs = (n: number) => `TZS ${Math.round(n).toLocaleString('en-US')}`;

function quickNotes(methods: string[]): string[] {
  const only = methods.length === 1 ? methods[0].toUpperCase() : '';
  if (only.includes('CASH')) return ['Cash received and counted', 'Matches the receipt book', 'Amount and student verified'];
  if (only.includes('BANK')) return ['Bank slip matches the reference', 'Found on the bank statement', 'Amount and student verified'];
  if (only.includes('MOBILE')) return ['Mobile money message matches the reference', 'Amount and student verified'];
  return ['Checked against the invoices', 'Amount and student verified'];
}

// ─── Decision dialog ───────────────────────────────────────────────────────────

function DecisionDialog({
  mode,
  rows,
  onClose,
  onFinished,
}: {
  mode: 'APPROVE' | 'REJECT';
  rows: PrincipalPaymentApproval[];
  onClose: () => void;
  /** Called with the ids that really were decided, so they leave the selection. */
  onFinished: (doneIds: string[], failed: BulkDecisionResult['failed']) => void;
}) {
  const decide = useDecidePaymentsMutation();
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<BulkDecisionResult | null>(null);
  const approving = mode === 'APPROVE';
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const noteOk = note.trim().length >= NOTE_MIN;
  const ready = approving ? confirmed : noteOk;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !decide.isPending) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide.isPending, onClose]);

  const submit = () => {
    if (!ready || decide.isPending) return;
    decide.mutate(
      { decision: mode, approvalIds: rows.map((r) => r.id), reason: note.trim() || undefined },
      {
        onSuccess: (res) => {
          setResult(res);
          onFinished(res.done, res.failed);
          if (!res.failed.length) toast(approving ? `${res.succeeded} payment${res.succeeded === 1 ? '' : 's'} approved · receipts issued` : `${res.succeeded} payment${res.succeeded === 1 ? '' : 's'} rejected`, approving ? 'success' : 'info');
        },
        onError: (e) => toast(errorMessage(e, 'Could not complete this decision. Nothing was changed.'), 'error'),
      },
    );
  };

  const nameOf = (id: string) => rows.find((r) => r.id === id)?.student ?? 'Payment';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ks-navy/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={approving ? 'Approve payments' : 'Reject payments'}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-ks-line p-5">
          <div>
            <h2 className="font-display text-xl font-black text-ks-navy">
              {result ? 'Done' : approving ? `Approve ${rows.length} payment${rows.length === 1 ? '' : 's'}` : `Reject ${rows.length} payment${rows.length === 1 ? '' : 's'}`}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-ks-muted">{tzs(total)} in total</p>
          </div>
          <button type="button" onClick={onClose} disabled={decide.isPending} aria-label="Close" className="rounded-lg p-1.5 text-ks-muted transition hover:bg-ks-paper hover:text-ks-navy disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 p-5">
            <div className={`flex items-start gap-3 rounded-xl border p-4 ${result.succeeded ? 'border-ks-emerald/30 bg-ks-emerald/10 text-ks-emerald' : 'border-ks-rose/30 bg-ks-rose/10 text-ks-rose'}`}>
              {result.succeeded ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
              <p className="text-sm font-black">
                {result.succeeded} of {result.requested} {approving ? 'approved' : 'rejected'}
                {result.failed.length > 0 && <span className="block text-xs font-semibold opacity-90">{result.failed.length} could not be decided and stay selected.</span>}
              </p>
            </div>
            {result.failed.length > 0 && (
              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {result.failed.map((f) => (
                  <li key={f.approvalId} className="rounded-lg border border-ks-line bg-ks-paper px-3 py-2 text-xs">
                    <span className="font-black text-ks-navy">{nameOf(f.approvalId)}</span>
                    <span className="block font-semibold text-ks-slate">{f.message}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-ks-navy text-sm font-black text-white transition hover:brightness-110">Close</button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-ks-line bg-ks-paper/60 p-3 text-sm">
              {rows.slice(0, 6).map((r) => (
                <li key={r.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-bold text-ks-navy">{r.student}</span>
                  <span className="shrink-0 font-mono text-xs font-bold text-ks-slate">{tzs(r.amount)}</span>
                </li>
              ))}
              {rows.length > 6 && <li className="pt-1 text-xs font-bold text-ks-muted">and {rows.length - 6} more</li>}
            </ul>

            <div>
              <label htmlFor="decision-note" className="text-[10px] font-black uppercase tracking-widest text-ks-muted">
                {approving ? 'Note (optional, kept in the audit log)' : `Reason for rejecting (at least ${NOTE_MIN} characters)`}
              </label>
              {approving && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {quickNotes([...new Set(rows.map((r) => r.method))]).map((text) => (
                    <button key={text} type="button" onClick={() => setNote(text)} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${note === text ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line bg-white text-ks-slate hover:border-ks-navy hover:text-ks-navy'}`}>{text}</button>
                  ))}
                </div>
              )}
              <textarea
                id="decision-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                autoFocus={!approving}
                className="mt-2 w-full resize-none rounded-xl border border-ks-line bg-white p-3 text-sm font-semibold text-ks-navy outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/15"
                placeholder={approving ? 'Pick one above or write your own…' : 'For example: the reference does not match the bank statement'}
              />
            </div>

            {approving && (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm font-bold text-ks-slate">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-ks-navy" />
                I have checked {rows.length === 1 ? 'this payment' : 'these payments'} against the invoice{rows.length === 1 ? '' : 's'}.
              </label>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onClose} disabled={decide.isPending} className="h-11 rounded-xl border border-ks-line bg-white text-sm font-black text-ks-slate transition hover:bg-ks-paper disabled:opacity-40">Cancel</button>
              <button
                type="button"
                onClick={submit}
                disabled={!ready || decide.isPending}
                className={`h-11 rounded-xl text-sm font-black text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 ${approving ? 'bg-ks-emerald' : 'bg-ks-rose'}`}
              >
                {decide.isPending ? 'Working…' : approving ? `Approve ${rows.length}` : `Reject ${rows.length}`}
              </button>
            </div>
            <p className="text-xs font-semibold text-ks-muted" aria-live="polite">
              {approving ? (confirmed ? 'Approving issues each receipt straight away.' : 'Tick the box to enable Approve.') : (noteOk ? 'The finance office will see this reason.' : `Write at least ${NOTE_MIN} characters.`)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── The queue ─────────────────────────────────────────────────────────────────

/**
 * Everything waiting for a decision, built for a queue of hundreds: server-side search, method filter, sorting and
 * 25 / 50 / 100 per page (remembered), a selection that survives paging, and approve / reject for the whole selection.
 */
export function PaymentApprovalQueue({ detailHref = (row: PrincipalPaymentApproval) => `/principal/finance/approvals/${row.id}` }: { detailHref?: (row: PrincipalPaymentApproval) => string }) {
  const myId = useAuthStore((s) => s.session?.user.id);
  const controls = useTableControls({ initialLimit: 25, initialSortBy: 'requestedAt', initialSortDir: 'asc', storageKey: 'payment-approvals' });
  const { data, isLoading, isError, isFetching, refetch } = usePendingApprovalsPage(controls.params);
  const [selected, setSelected] = useState<Map<string, PrincipalPaymentApproval>>(new Map());
  const [open, setOpen] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ mode: 'APPROVE' | 'REJECT'; rows: PrincipalPaymentApproval[] } | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);

  const rows = data?.items ?? [];
  const total = data?.meta.total ?? 0;
  const mine = (r: PrincipalPaymentApproval) => Boolean(myId) && r.enteredById === myId;
  const decidable = useMemo(() => rows.filter((r) => !mine(r)), [rows, myId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pageAllSelected = decidable.length > 0 && decidable.every((r) => selected.has(r.id));
  const selectedRows = useMemo(() => [...selected.values()], [selected]);
  const selectedTotal = selectedRows.reduce((s, r) => s + r.amount, 0);
  const method = controls.filters.method ?? '';

  const toggle = (row: PrincipalPaymentApproval) => setSelected((cur) => {
    const next = new Map(cur);
    if (next.has(row.id)) next.delete(row.id); else next.set(row.id, row);
    return next;
  });
  const togglePage = () => setSelected((cur) => {
    const next = new Map(cur);
    if (pageAllSelected) decidable.forEach((r) => next.delete(r.id)); else decidable.forEach((r) => next.set(r.id, r));
    return next;
  });
  const selectAllMatching = async () => {
    setSelectingAll(true);
    try {
      const found = (await fetchMatchingApprovals(controls.params)).filter((r) => !mine(r));
      setSelected((cur) => {
        const next = new Map(cur);
        for (const r of found) next.set(r.id, r);
        return next;
      });
      toast(`${found.length} payments selected${total > found.length ? ` (the first ${found.length} of ${total})` : ''}`, 'info');
    } catch (e) {
      toast(errorMessage(e, 'Could not select every matching payment.'), 'error');
    } finally {
      setSelectingAll(false);
    }
  };

  const finished = (doneIds: string[]) => setSelected((cur) => {
    const next = new Map(cur);
    doneIds.forEach((id) => next.delete(id));
    return next;
  });

  const head = { activeSortBy: controls.sortBy, sortDir: controls.sortDir, onSort: controls.toggleSort, compact: true, tone: 'light' as const };

  return (
    <div className="space-y-4">
      <TableToolbar search={controls.search} onSearch={controls.setSearch} placeholder="Search student, invoice number, payment number or reference…" total={total} unit={total === 1 ? 'payment waiting' : 'payments waiting'}>
        <div className="flex gap-1 rounded-xl border border-ks-line bg-white p-1" role="group" aria-label="Payment method">
          {METHODS.map((m) => (
            <button
              key={m.key || 'all'}
              type="button"
              onClick={() => controls.setFilter('method', m.key || undefined)}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${method === m.key ? 'bg-ks-navy text-white' : 'text-ks-slate hover:bg-ks-paper'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </TableToolbar>

      {isLoading ? (
        <SkeletonTable cols={6} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : total === 0 ? (
        <div className="rounded-2xl border border-dashed border-ks-line bg-white px-6 py-14 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-ks-emerald" />
          <h3 className="mt-3 font-display text-xl font-black text-ks-navy">{controls.debouncedSearch || method ? 'Nothing matches that search or filter' : 'You are all caught up'}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm font-semibold text-ks-muted">
            {controls.debouncedSearch || method ? 'Try a different name, invoice number or method.' : 'No payments are waiting. New cash and bank payments appear here as soon as the finance office records them.'}
          </p>
        </div>
      ) : (
        <div className={`overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm transition-opacity ${isFetching ? 'opacity-80' : ''}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-ks-line bg-[#eef5f8]">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" checked={pageAllSelected} onChange={togglePage} aria-label="Select every payment on this page" className="h-4 w-4 accent-ks-navy" />
                  </th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">Student</th>
                  <SortHeader label="Invoice" column="invoice" {...head} />
                  <SortHeader label="Method" column="method" {...head} />
                  <SortHeader label="Amount" column="amount" align="right" {...head} />
                  <SortHeader label="Waiting" column="requestedAt" {...head} />
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-[#00334f]">Decide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ks-line">
                {rows.map((row) => {
                  const expanded = open === row.id;
                  const own = mine(row);
                  const checked = selected.has(row.id);
                  const waiting = row.age === 'just now' ? 'Just now' : row.age;
                  return (
                    <Fragment key={row.id}>
                      <tr className={`transition ${checked ? 'bg-ks-blue/5' : 'hover:bg-[#f7f9fb]'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={checked} disabled={own} onChange={() => toggle(row)} aria-label={`Select ${row.student}`} className="h-4 w-4 accent-ks-navy disabled:opacity-30" />
                        </td>
                        <td className="max-w-[240px] px-4 py-3">
                          <p className="truncate font-black text-ks-navy">{row.student}</p>
                          <p className="truncate text-[11px] font-semibold text-ks-muted">{[row.registration, row.className].filter(Boolean).join(' · ') || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          {row.invoiceId ? (
                            <NavLink to={`/finance/invoices/${row.invoiceId}`} title={row.invoice} className="inline-flex items-center gap-1 font-mono text-[13px] font-bold text-ks-blue hover:underline">
                              {shortInvoice(row.invoice) || 'Invoice'} <ExternalLink className="h-3 w-3" />
                            </NavLink>
                          ) : <span className="font-mono text-[13px] text-ks-muted">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-black text-ks-navy">{methodLabel(row.method)}</p>
                          <p className="max-w-[160px] truncate font-mono text-[11px] font-semibold text-ks-muted" title={row.reference}>{row.reference || (row.method.toUpperCase().includes('CASH') ? 'cash' : 'no reference')}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-black tabular-nums text-ks-navy">{tzs(row.amount)}</td>
                        <td className="px-4 py-3">
                          {waiting ? (
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${WAIT_TONE[row.risk]}`}><Clock className="h-3 w-3" /> {waiting}</span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {own ? (
                              <span className="rounded-md bg-ks-paper px-2 py-1 text-[10px] font-black uppercase tracking-wider text-ks-muted" title="Someone else must decide a payment you entered">You entered this</span>
                            ) : (
                              <>
                                <button type="button" onClick={() => setDialog({ mode: 'APPROVE', rows: [row] })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-ks-emerald px-2.5 text-xs font-black text-white transition hover:brightness-95"><CheckCircle2 className="h-3.5 w-3.5" /> Approve</button>
                                <button type="button" onClick={() => setDialog({ mode: 'REJECT', rows: [row] })} aria-label={`Reject ${row.student}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-ks-rose/40 text-ks-rose transition hover:bg-ks-rose/5"><XCircle className="h-4 w-4" /></button>
                              </>
                            )}
                            <button type="button" onClick={() => setOpen(expanded ? null : row.id)} aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ks-slate transition hover:bg-ks-paper">
                              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-ks-paper/60">
                          <td />
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
                              <dl className="grid content-start gap-x-8 gap-y-3 sm:grid-cols-2">
                                <div><dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Payment number</dt><dd className="mt-1 font-mono text-[13px] font-bold text-ks-navy">{row.paymentNumber || '—'}</dd></div>
                                <div><dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Received on</dt><dd className="mt-1 text-sm font-bold text-ks-navy">{row.paidAt ? new Date(row.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</dd></div>
                                <div><dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Full invoice number</dt><dd className="mt-1 break-all font-mono text-[13px] font-bold text-ks-navy">{row.invoice || '—'}</dd></div>
                                <div><dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Entered by</dt><dd className="mt-1 text-sm font-bold text-ks-navy">{own ? 'You' : row.enteredBy}</dd></div>
                                <div className="sm:col-span-2"><dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Evidence</dt><dd className="mt-1 text-sm font-bold">{row.evidenceUrl ? <a href={row.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ks-blue hover:underline"><Paperclip className="h-3.5 w-3.5" /> View attachment</a> : <span className="font-semibold text-ks-muted">Nothing attached</span>}</dd></div>
                                {row.notes && <div className="sm:col-span-2"><dt className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Finance office note</dt><dd className="mt-1 text-sm font-bold text-ks-navy">{row.notes}</dd></div>}
                                <div className="sm:col-span-2"><NavLink to={detailHref(row)} className="inline-flex items-center gap-1 text-xs font-black text-ks-navy hover:underline">Full detail <ChevronRight className="h-3.5 w-3.5" /></NavLink></div>
                              </dl>
                              {!own && (
                                <div className="rounded-xl border border-ks-line bg-white p-4">
                                  <PaymentDecisionPanel approval={row} />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ks-line bg-white px-4 py-3">
            <DataPagination
              page={controls.page}
              pageSize={controls.limit}
              total={total}
              onPageChange={controls.setPage}
              onPageSizeChange={controls.setLimit}
              unit="payments"
              variant="navy"
            />
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-ks-navy/20 bg-white px-4 py-3 shadow-xl" role="region" aria-label="Selected payments">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-ks-navy">{selected.size} selected{selectedTotal > 0 && <span className="ml-2 font-mono text-ks-slate">{tzs(selectedTotal)}</span>}</p>
            <p className="text-xs font-semibold text-ks-muted">
              {total > selected.size && (
                <button type="button" onClick={selectAllMatching} disabled={selectingAll} className="font-black text-ks-blue hover:underline disabled:opacity-50">
                  {selectingAll ? 'Selecting…' : `Select all ${Math.min(total, 200)} matching`}
                </button>
              )}
              {total > selected.size && ' · '}
              <button type="button" onClick={() => setSelected(new Map())} className="font-black text-ks-slate hover:underline">Clear selection</button>
            </p>
          </div>
          <button type="button" onClick={() => setDialog({ mode: 'REJECT', rows: selectedRows })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-ks-rose/40 bg-white px-4 text-sm font-black text-ks-rose transition hover:bg-ks-rose/5"><XCircle className="h-4 w-4" /> Reject {selected.size}</button>
          <button type="button" onClick={() => setDialog({ mode: 'APPROVE', rows: selectedRows })} className="inline-flex h-10 items-center gap-2 rounded-xl bg-ks-emerald px-4 text-sm font-black text-white shadow-sm transition hover:brightness-95"><CheckCircle2 className="h-4 w-4" /> Approve {selected.size}</button>
        </div>
      )}

      {dialog && <DecisionDialog mode={dialog.mode} rows={dialog.rows} onClose={() => setDialog(null)} onFinished={(ids) => finished(ids)} />}
    </div>
  );
}
