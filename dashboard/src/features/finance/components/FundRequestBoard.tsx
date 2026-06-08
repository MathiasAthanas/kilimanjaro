import { useMemo, useState } from 'react';
import { ArrowRight, Plus, Send, Check, X, Wallet, Clock } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { formatTZS, formatDate } from '../utils/money';
import { EXPENSE_CATEGORY_OPTIONS } from './financeOpsConstants';
import {
  useFundRequests,
  useFundRequestSummary,
  useCreateFundRequestMutation,
  useForwardFundRequestMutation,
  useApproveFundRequestMutation,
  useRejectFundRequestMutation,
  useDisburseFundRequestMutation,
  useCancelFundRequestMutation,
  type FundRequestRow,
} from '../api/financeOps.hooks';

export type FundBoardRole = 'bursar' | 'hod' | 'principal';

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'APPROVED' ? 'emerald' :
    status === 'DISBURSED' ? 'gold' :
    status === 'FORWARDED' ? 'blue' :
    status === 'SUBMITTED' ? 'amber' :
    status === 'REJECTED' ? 'rose' : 'slate';
  return <Badge tone={tone as 'emerald' | 'gold' | 'blue' | 'amber' | 'rose' | 'slate'}>{status}</Badge>;
}

const STATUS_TABS = ['ALL', 'SUBMITTED', 'FORWARDED', 'APPROVED', 'DISBURSED', 'REJECTED'] as const;

type ActionKind = 'forward' | 'approve' | 'reject' | 'disburse' | 'cancel';

export function FundRequestBoard({ role, userName }: { role: FundBoardRole; userName: string }) {
  const { data: requests = [], isLoading } = useFundRequests();
  const { data: summary } = useFundRequestSummary();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; req: FundRequestRow } | null>(null);

  const visible = useMemo(
    () => (tab === 'ALL' ? requests : requests.filter((r) => r.status === tab)),
    [requests, tab],
  );

  const canCreate = role === 'hod' || role === 'bursar' || role === 'principal';

  return (
    <div className="space-y-gutter">
      {/* Summary */}
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={<Clock className="h-4 w-4" />} label="Awaiting Bursar" value={summary?.pendingForward ?? 0} tone="amber" />
        <SummaryCard icon={<Send className="h-4 w-4" />} label="Awaiting Principal" value={summary?.pendingApproval ?? 0} tone="blue" />
        <SummaryCard icon={<Wallet className="h-4 w-4" />} label="Awaiting Disbursement" value={summary?.approvedAwaitingDisbursement ?? 0} tone="emerald" />
      </div>

      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${tab === t ? 'bg-[#00334f] text-white' : 'bg-white text-[#64748b] border border-[#d5dde6] hover:bg-[#eef5f8]'}`}
            >
              {t}
            </button>
          ))}
        </div>
        {canCreate && (
          <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30] hover:shadow-none" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-3.5 w-3.5" /> New Request
          </Button>
        )}
      </div>

      {showCreate && <CreateForm userName={userName} onDone={() => setShowCreate(false)} />}

      {/* Table */}
      {isLoading ? (
        <SkeletonTable cols={7} />
      ) : !visible.length ? (
        <EmptyState title="No fund requests" description={role === 'hod' ? 'Submit a request to ask the bursar for funds.' : 'No requests in this view yet.'} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" style={{ minWidth: 1000 }}>
              <thead className="bg-[#eef5f8]">
                <tr>
                  {['Request', 'Title', 'Dept', 'Requested by', 'Amount', 'Status', 'Actions'].map((c) => (
                    <th key={c} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {visible.map((r) => (
                  <tr key={r.id} className="bg-white even:bg-[#f7f9fb] hover:bg-[#eef5f8]">
                    <td className="px-4 py-3 font-black text-[#00334f]">{r.requestNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#0f172a]">{r.title}</div>
                      <div className="text-[11px] text-[#64748b]">{r.category.replaceAll('_', ' ')}</div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{r.department || '—'}</td>
                    <td className="px-4 py-3 text-[#475569]">{r.requestedByName}</td>
                    <td className="px-4 py-3 text-right font-mono font-black tabular-nums text-[#0f172a]">{formatTZS(r.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {role === 'bursar' && r.status === 'SUBMITTED' && (
                          <>
                            <MiniBtn tone="navy" onClick={() => setAction({ kind: 'forward', req: r })}>Forward</MiniBtn>
                            <MiniBtn tone="rose" onClick={() => setAction({ kind: 'reject', req: r })}>Reject</MiniBtn>
                          </>
                        )}
                        {role === 'bursar' && r.status === 'APPROVED' && (
                          <MiniBtn tone="green" onClick={() => setAction({ kind: 'disburse', req: r })}>Disburse</MiniBtn>
                        )}
                        {role === 'principal' && r.status === 'FORWARDED' && (
                          <>
                            <MiniBtn tone="green" onClick={() => setAction({ kind: 'approve', req: r })}>Approve</MiniBtn>
                            <MiniBtn tone="rose" onClick={() => setAction({ kind: 'reject', req: r })}>Reject</MiniBtn>
                          </>
                        )}
                        {role === 'hod' && (r.status === 'SUBMITTED' || r.status === 'FORWARDED') && (
                          <MiniBtn tone="slate" onClick={() => setAction({ kind: 'cancel', req: r })}>Cancel</MiniBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Event trail preview for selected status workflows is shown inline on the detail modal */}
      {action && <ActionModal action={action} userName={userName} onClose={() => setAction(null)} />}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'amber' | 'blue' | 'emerald' }) {
  const color = tone === 'amber' ? 'text-[#d59a1b]' : tone === 'blue' ? 'text-[#0284c7]' : 'text-[#10b981]';
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#d5dde6] bg-white p-4">
      <div className={`grid h-10 w-10 place-items-center rounded-full bg-[#f1f5f9] ${color}`}>{icon}</div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
        <p className="font-mono text-2xl font-black tabular-nums text-[#0f172a]">{value}</p>
      </div>
    </div>
  );
}

function MiniBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone: 'navy' | 'green' | 'rose' | 'slate' }) {
  const cls =
    tone === 'green' ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' :
    tone === 'rose' ? 'border-rose-200 text-rose-700 hover:bg-rose-50' :
    tone === 'slate' ? 'border-slate-200 text-slate-600 hover:bg-slate-50' :
    'border-[#00334f]/20 text-[#00334f] hover:bg-[#eef5f8]';
  return (
    <button onClick={onClick} className={`rounded border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide transition ${cls}`}>
      {children}
    </button>
  );
}

// ─── Create form ────────────────────────────────────────────────────────────────
function CreateForm({ userName, onDone }: { userName: string; onDone: () => void }) {
  const createMutation = useCreateFundRequestMutation();
  const [form, setForm] = useState({ title: '', description: '', category: 'ACADEMIC', amount: '', department: '', neededBy: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.amount) { toast('Title, description and amount are required', 'error'); return; }
    createMutation.mutate(
      { ...form, amount: form.amount, requestedByName: userName, neededBy: form.neededBy || undefined, department: form.department || undefined },
      {
        onSuccess: () => { toast('Fund request submitted', 'success'); setForm({ title: '', description: '', category: 'ACADEMIC', amount: '', department: '', neededBy: '' }); onDone(); },
        onError: () => toast('Failed to submit request', 'error'),
      },
    );
  };

  const input = 'mt-1 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]';
  const lbl = 'text-[11px] font-black uppercase tracking-widest text-[#64748b]';
  return (
    <form onSubmit={submit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
      <h3 className="font-display text-lg font-black text-[#00334f]">New Fund Request</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2"><span className={lbl}>Title *</span><input value={form.title} onChange={set('title')} className={input} placeholder="e.g. Science lab reagents" /></label>
        <label className="block md:col-span-2"><span className={lbl}>Description *</span><textarea value={form.description} onChange={set('description')} className={`${input} h-20 py-2`} placeholder="What the funds are for" /></label>
        <label className="block"><span className={lbl}>Category</span>
          <select value={form.category} onChange={set('category')} className={input}>
            {EXPENSE_CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="block"><span className={lbl}>Amount (TZS) *</span><input type="number" value={form.amount} onChange={set('amount')} className={input} placeholder="450000" /></label>
        <label className="block"><span className={lbl}>Department</span><input value={form.department} onChange={set('department')} className={input} placeholder="e.g. Science" /></label>
        <label className="block"><span className={lbl}>Needed by</span><input type="date" value={form.neededBy} onChange={set('neededBy')} className={input} /></label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={createMutation.isPending}>
          <Send className="h-4 w-4" /> {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
        </Button>
        <Button type="button" variant="secondary" className="rounded" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Action modal (forward / approve / reject / disburse / cancel) ───────────────
function ActionModal({ action, userName, onClose }: { action: { kind: ActionKind; req: FundRequestRow }; userName: string; onClose: () => void }) {
  const forward = useForwardFundRequestMutation();
  const approve = useApproveFundRequestMutation();
  const reject = useRejectFundRequestMutation();
  const disburse = useDisburseFundRequestMutation();
  const cancel = useCancelFundRequestMutation();
  const [note, setNote] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const { kind, req } = action;
  const meta: Record<ActionKind, { title: string; cta: string; danger?: boolean }> = {
    forward: { title: 'Forward to Principal', cta: 'Forward' },
    approve: { title: 'Approve Request', cta: 'Approve' },
    reject: { title: 'Reject Request', cta: 'Reject', danger: true },
    disburse: { title: 'Disburse Funds', cta: 'Disburse' },
    cancel: { title: 'Cancel Request', cta: 'Cancel Request', danger: true },
  };

  const busy = forward.isPending || approve.isPending || reject.isPending || disburse.isPending || cancel.isPending;

  const run = () => {
    const onSuccess = (msg: string) => { toast(msg, 'success'); onClose(); };
    const onError = () => toast('Action failed', 'error');
    if (kind === 'forward') forward.mutate({ id: req.id, body: { note, actorName: userName } }, { onSuccess: () => onSuccess('Forwarded to Principal'), onError });
    else if (kind === 'approve') approve.mutate({ id: req.id, body: { note, actorName: userName } }, { onSuccess: () => onSuccess('Request approved'), onError });
    else if (kind === 'reject') {
      if (!note.trim()) { toast('A reason is required to reject', 'error'); return; }
      reject.mutate({ id: req.id, body: { reason: note, actorName: userName } }, { onSuccess: () => onSuccess('Request rejected'), onError });
    } else if (kind === 'disburse') disburse.mutate({ id: req.id, body: { method, reference: reference || undefined, note: note || undefined, actorName: userName } }, { onSuccess: () => onSuccess('Funds disbursed'), onError });
    else cancel.mutate({ id: req.id, body: { reason: note || undefined, actorName: userName } }, { onSuccess: () => onSuccess('Request cancelled'), onError });
  };

  const input = 'mt-1 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 py-2 font-semibold outline-none focus:border-[#00334f]';
  const lbl = 'text-[11px] font-black uppercase tracking-widest text-[#64748b]';
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-[#d5dde6] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-black text-[#00334f]">{meta[kind].title}</h2>
            <p className="mt-1 text-sm font-semibold text-[#64748b]">{req.requestNumber} · {req.title}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9]"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 rounded-lg bg-[#f7f9fb] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-[#64748b]">Amount</span>
            <span className="font-mono text-lg font-black text-[#0f172a]">{formatTZS(req.amount)}</span>
          </div>
          <p className="mt-2 text-sm text-[#475569]">{req.description}</p>
        </div>

        {/* Event trail */}
        {req.events.length > 0 && (
          <div className="mt-4 space-y-1.5 border-l-2 border-[#e2e8f0] pl-4">
            {req.events.map((ev) => (
              <div key={ev.id} className="text-xs">
                <span className="font-black text-[#00334f]">{ev.action}</span>
                <span className="text-[#64748b]"> · {ev.actorName} · {formatDate(ev.createdAt)}</span>
                {ev.note && <span className="text-[#94a3b8]"> — {ev.note}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-3">
          {kind === 'disburse' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className={lbl}>Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={input}>
                  {['BANK_TRANSFER', 'CASH', 'MOBILE_MONEY', 'OTHER'].map((m) => <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label className="block"><span className={lbl}>Reference</span><input value={reference} onChange={(e) => setReference(e.target.value)} className={input} placeholder="e.g. CRDB-FR-001" /></label>
            </div>
          )}
          <label className="block">
            <span className={lbl}>{kind === 'reject' ? 'Reason *' : 'Note'}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${input} h-20`} placeholder={kind === 'reject' ? 'Why is this being rejected?' : 'Optional note for the audit trail'} />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" className="rounded" onClick={onClose}>Close</Button>
          <Button
            className={`rounded ${meta[kind].danger ? 'bg-[#e11d48] hover:bg-[#be123c]' : 'bg-[#00334f] hover:bg-[#001e30]'} hover:shadow-none`}
            onClick={run}
            disabled={busy}
          >
            {meta[kind].danger ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />} {busy ? 'Working…' : meta[kind].cta}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ArrowRight };
