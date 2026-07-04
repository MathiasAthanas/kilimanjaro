import { useMemo, useState } from 'react';
import {
  AlertTriangle, Calendar, Check, ChevronDown, ChevronUp,
  Clock, Plus, Send, Wallet, X,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonCards } from '../../../components/common/SkeletonCards';
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
type ActionKind = 'forward' | 'approve' | 'reject' | 'disburse' | 'cancel';
const REQUEST_CATEGORIES = EXPENSE_CATEGORY_OPTIONS.filter((category) => category !== 'FUND_DISBURSEMENT');

const PIPELINE = [
  {
    status: 'SUBMITTED', label: 'Submitted', desc: 'Awaiting bursar review',
    color: '#b45309', bg: '#fef9ee', border: '#d59a1b', dot: '#d59a1b',
  },
  {
    status: 'FORWARDED', label: 'Forwarded', desc: 'Awaiting principal decision',
    color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#0284c7',
  },
  {
    status: 'APPROVED', label: 'Approved', desc: 'Ready for disbursement',
    color: '#047857', bg: '#f0fdf9', border: '#6ee7b7', dot: '#10b981',
  },
  {
    status: 'DISBURSED', label: 'Disbursed', desc: 'Funds released',
    color: '#4338ca', bg: '#f5f3ff', border: '#c4b5fd', dot: '#6366f1',
  },
] as const;

const CLOSED_STATUSES = ['REJECTED', 'CANCELLED'] as const;

// ─── Pipeline card ────────────────────────────────────────────────────────────
function PipelineCard({
  req, role, onAction, expanded, onToggle,
}: {
  req: FundRequestRow;
  role: FundBoardRole;
  onAction: (kind: ActionKind) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const now = Date.now();
  const neededMs = req.neededBy ? new Date(req.neededBy).getTime() : null;
  const isOverdue = neededMs !== null && neededMs < now && req.status !== 'DISBURSED';
  const isDueSoon = !isOverdue && neededMs !== null && neededMs - now < 2 * 86_400_000;

  const canForward  = role === 'bursar'    && req.status === 'SUBMITTED';
  const canApprove  = role === 'principal' && req.status === 'FORWARDED';
  const canReject   = (role === 'bursar' && req.status === 'SUBMITTED') ||
                      (role === 'principal' && req.status === 'FORWARDED');
  const canDisburse = role === 'bursar'    && req.status === 'APPROVED';
  const canCancel   = role === 'hod'       && (req.status === 'SUBMITTED' || req.status === 'FORWARDED');
  const hasActions  = canForward || canApprove || canReject || canDisburse || canCancel;

  return (
    <div className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm transition-shadow hover:shadow-md">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-black tracking-widest text-[#94a3b8]">{req.requestNumber}</p>
          <p className="mt-0.5 truncate text-sm font-bold text-[#0f172a] leading-snug">{req.title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black tabular-nums text-[#00334f]">{formatTZS(req.amount)}</p>
          {isOverdue && (
            <span className="flex items-center justify-end gap-0.5 text-[10px] font-black text-red-600">
              <AlertTriangle className="h-2.5 w-2.5" /> OVERDUE
            </span>
          )}
          {isDueSoon && (
            <span className="text-[10px] font-black text-orange-500">DUE SOON</span>
          )}
        </div>
      </div>

      {/* ── Meta ── */}
      <div className="border-t border-[#f1f5f9] px-3.5 py-2 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {req.department && (
            <span className="text-[11px] font-semibold text-[#475569]">{req.department}</span>
          )}
          <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">
            {req.category.replace(/_/g, ' ')}
          </span>
        </div>
        <p className="text-[11px] font-semibold text-[#64748b]">
          By {req.requestedByName}
          {req.requestedByRole ? <span className="font-normal"> · {req.requestedByRole}</span> : null}
        </p>
        {req.neededBy && (
          <p className={`flex items-center gap-1 text-[10px] font-bold ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-500' : 'text-[#94a3b8]'}`}>
            <Calendar className="h-2.5 w-2.5" /> Needed {formatDate(req.neededBy)}
          </p>
        )}
        {req.description && (
          <p className="text-[11px] text-[#94a3b8] leading-snug line-clamp-2">{req.description}</p>
        )}
      </div>

      {/* ── Event trail (collapsible) ── */}
      {req.events.length > 0 && (
        <>
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-between border-t border-[#f1f5f9] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#64748b] hover:bg-[#f8fafc]">
            <span>{req.events.length} event{req.events.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {expanded && (
            <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-3.5 py-2 space-y-2">
              {req.events.map((ev) => (
                <div key={ev.id} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00334f]" />
                  <div>
                    <span className="text-[10px] font-black text-[#00334f]">{ev.action}</span>
                    <span className="text-[10px] text-[#64748b]"> · {ev.actorName}</span>
                    {ev.note && <p className="text-[10px] italic text-[#94a3b8]">{ev.note}</p>}
                    <p className="text-[10px] text-[#cbd5e1]">{formatDate(ev.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Bursar note / principal note displayed on card ── */}
      {(req.bursarNote || req.principalNote) && (
        <div className="border-t border-[#f1f5f9] px-3.5 py-2 space-y-1">
          {req.bursarNote && (
            <p className="text-[10px] text-[#64748b]">
              <span className="font-black">Bursar:</span> {req.bursarNote}
            </p>
          )}
          {req.principalNote && (
            <p className="text-[10px] text-[#64748b]">
              <span className="font-black">Principal:</span> {req.principalNote}
            </p>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      {hasActions && (
        <div className="border-t border-[#f1f5f9] px-3.5 py-2.5 flex flex-wrap gap-1.5">
          {canForward && (
            <ActionBtn tone="navy" icon={<Send className="h-3 w-3" />} onClick={() => onAction('forward')}>
              Forward
            </ActionBtn>
          )}
          {canApprove && (
            <ActionBtn tone="green" icon={<Check className="h-3 w-3" />} onClick={() => onAction('approve')}>
              Approve
            </ActionBtn>
          )}
          {canDisburse && (
            <ActionBtn tone="indigo" icon={<Wallet className="h-3 w-3" />} onClick={() => onAction('disburse')}>
              Disburse
            </ActionBtn>
          )}
          {canReject && (
            <ActionBtn tone="red" icon={<X className="h-3 w-3" />} onClick={() => onAction('reject')}>
              Reject
            </ActionBtn>
          )}
          {canCancel && (
            <ActionBtn tone="slate" onClick={() => onAction('cancel')}>Cancel</ActionBtn>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tiny action button ───────────────────────────────────────────────────────
function ActionBtn({
  children, onClick, tone, icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'navy' | 'green' | 'indigo' | 'red' | 'slate';
  icon?: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    navy:   'border-[#00334f]/20 text-[#00334f]   hover:bg-[#eef5f8]',
    green:  'border-emerald-200  text-emerald-700  hover:bg-emerald-50',
    indigo: 'border-indigo-200   text-indigo-700   hover:bg-indigo-50',
    red:    'border-red-200      text-red-600      hover:bg-red-50',
    slate:  'border-slate-200    text-slate-600    hover:bg-slate-50',
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition ${cls[tone]}`}>
      {icon}{children}
    </button>
  );
}

// ─── Main board ───────────────────────────────────────────────────────────────
export function FundRequestBoard({ role, userName }: { role: FundBoardRole; userName: string }) {
  const { data: requests = [], isLoading } = useFundRequests();
  const { data: summary } = useFundRequestSummary();
  const [showCreate, setShowCreate] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; req: FundRequestRow } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showClosed, setShowClosed] = useState(false);

  const byStatus = useMemo(() => {
    const map: Record<string, FundRequestRow[]> = {};
    requests.forEach((r) => { (map[r.status] ??= []).push(r); });
    return map;
  }, [requests]);

  const toggleExpanded = (id: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const closedTotal = CLOSED_STATUSES.reduce((s, st) => s + (byStatus[st]?.length ?? 0), 0);
  const canCreate = role === 'hod' || role === 'bursar' || role === 'principal';

  if (isLoading) return <SkeletonCards count={4} />;

  return (
    <div className="space-y-6">

      {/* ── FO action banners ── */}
      {role === 'bursar' && (
        <div className="flex flex-wrap gap-3">
          {(summary?.pendingForward ?? 0) > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#d59a1b]/30 bg-[#fffbeb] px-4 py-2.5">
              <Clock className="h-4 w-4 text-[#d59a1b]" />
              <span className="text-sm font-bold text-[#7a5200]">
                {summary?.pendingForward} request{(summary?.pendingForward ?? 0) !== 1 ? 's' : ''} waiting to be forwarded
              </span>
            </div>
          )}
          {(summary?.approvedAwaitingDisbursement ?? 0) > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl border border-[#10b981]/30 bg-[#f0fdf9] px-4 py-2.5">
              <Wallet className="h-4 w-4 text-[#10b981]" />
              <span className="text-sm font-bold text-[#065f46]">
                {summary?.approvedAwaitingDisbursement} request{(summary?.approvedAwaitingDisbursement ?? 0) !== 1 ? 's' : ''} ready to disburse
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Header row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#64748b]">Funding Pipeline</p>
          <p className="mt-0.5 text-sm font-semibold text-[#64748b]">
            {requests.length} total · {PIPELINE.reduce((s, p) => s + (byStatus[p.status]?.length ?? 0), 0)} active
          </p>
        </div>
        {canCreate && (
          <Button variant={showCreate ? 'secondary' : 'primary'} onClick={() => setShowCreate((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showCreate ? 'Close form' : 'New Request'}
          </Button>
        )}
      </div>

      {/* ── Create form ── */}
      {showCreate && <CreateForm userName={userName} onDone={() => setShowCreate(false)} />}

      {!requests.length && !showCreate && (
        <div className="rounded-xl border border-dashed border-[#d5dde6] bg-white p-6">
          <EmptyState
            title="No fund requests yet"
            description={
              canCreate
                ? 'Create the first request to start the bursar review and principal approval workflow.'
                : 'No requests have been submitted yet.'
            }
          />
          {canCreate && (
            <div className="mt-4 flex justify-center">
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> New Request
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Pipeline columns ── */}
      {requests.length > 0 && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PIPELINE.map((stage) => {
          const cards = byStatus[stage.status] ?? [];
          return (
            <div key={stage.status} className="flex flex-col gap-3">
              {/* Column header */}
              <div
                className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
                style={{ background: stage.bg, border: `1.5px solid ${stage.border}` }}>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: stage.dot }} />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide" style={{ color: stage.color }}>
                      {stage.label}
                    </p>
                    <p className="text-[10px] text-[#64748b]">{stage.desc}</p>
                  </div>
                </div>
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black text-white"
                  style={{ background: stage.dot }}>
                  {cards.length}
                </span>
              </div>

              {/* Cards */}
              {cards.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] py-8 text-[11px] text-[#cbd5e1]">
                  No requests
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cards.map((req) => (
                    <PipelineCard
                      key={req.id}
                      req={req}
                      role={role}
                      onAction={(kind) => setAction({ kind, req })}
                      expanded={expanded.has(req.id)}
                      onToggle={() => toggleExpanded(req.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>}

      {/* ── Closed requests ── */}
      {closedTotal > 0 && (
        <div className="rounded-xl border border-[#e2e8f0] bg-white">
          <button
            onClick={() => setShowClosed((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-bold text-[#64748b] hover:bg-[#f8fafc] rounded-xl">
            <span>Closed requests ({closedTotal})</span>
            {showClosed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showClosed && (
            <div className="border-t border-[#f1f5f9] p-4 grid gap-4 sm:grid-cols-2">
              {CLOSED_STATUSES.map((status) => {
                const cards = byStatus[status] ?? [];
                if (!cards.length) return null;
                const isRejected = status === 'REJECTED';
                return (
                  <div key={status}>
                    <p className={`mb-2 text-[10px] font-black uppercase tracking-widest ${isRejected ? 'text-red-600' : 'text-[#64748b]'}`}>
                      {status} ({cards.length})
                    </p>
                    <div className="space-y-2">
                      {cards.map((req) => (
                        <div key={req.id} className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 opacity-80">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-[#94a3b8]">{req.requestNumber}</p>
                              <p className="truncate text-sm font-bold text-[#475569]">{req.title}</p>
                            </div>
                            <p className="shrink-0 text-sm font-black tabular-nums text-[#64748b]">{formatTZS(req.amount)}</p>
                          </div>
                          {req.rejectionReason && (
                            <p className="mt-1.5 text-[10px] italic text-red-500">{req.rejectionReason}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Action modal ── */}
      {action && (
        <ActionModal action={action} userName={userName} onClose={() => setAction(null)} />
      )}
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────
function CreateForm({ userName, onDone }: { userName: string; onDone: () => void }) {
  const createMutation = useCreateFundRequestMutation();
  const [form, setForm] = useState({
    title: '', description: '', category: 'ACADEMIC',
    amount: '', department: '', neededBy: '',
  });
  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.amount) {
      toast('Title, description and amount are required', 'error');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast('Amount must be greater than zero', 'error');
      return;
    }
    createMutation.mutate(
      {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        amount: String(amount),
        requestedByName: userName,
        neededBy: form.neededBy || undefined,
        department: form.department.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast('Fund request submitted', 'success');
          setForm({ title: '', description: '', category: 'ACADEMIC', amount: '', department: '', neededBy: '' });
          onDone();
        },
        onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to submit request', 'error'),
      },
    );
  };

  const inp = 'mt-1 h-10 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#00334f] focus:bg-white';
  const lbl = 'text-[10px] font-black uppercase tracking-widest text-[#64748b]';

  return (
    <form onSubmit={submit} className="rounded-xl border border-[#d5dde6] bg-white p-5 shadow-sm">
      <h3 className="font-display text-lg font-black text-[#00334f]">New Fund Request</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className={lbl}>Title *</span>
          <input value={form.title} onChange={set('title')} className={inp} placeholder="e.g. Science lab reagents for Form 4" />
        </label>
        <label className="block md:col-span-2">
          <span className={lbl}>Description *</span>
          <textarea value={form.description} onChange={set('description')}
            className={`${inp} h-20 py-2.5`} placeholder="What are the funds needed for and why?" />
        </label>
        <label className="block">
          <span className={lbl}>Category</span>
          <select value={form.category} onChange={set('category')} className={inp}>
            {REQUEST_CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Amount (TZS) *</span>
          <input type="number" value={form.amount} onChange={set('amount')} className={inp} placeholder="450000" />
        </label>
        <label className="block">
          <span className={lbl}>Department</span>
          <input value={form.department} onChange={set('department')} className={inp} placeholder="e.g. Science" />
        </label>
        <label className="block">
          <span className={lbl}>Needed by</span>
          <input type="date" value={form.neededBy} onChange={set('neededBy')} className={inp} />
        </label>
      </div>
      <div className="mt-5 flex gap-2.5">
        <Button type="submit" disabled={createMutation.isPending}>
          <Send className="h-4 w-4" />
          {createMutation.isPending ? 'Submitting…' : 'Submit Request'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

// ─── Action modal ─────────────────────────────────────────────────────────────
function ActionModal({
  action, userName, onClose,
}: {
  action: { kind: ActionKind; req: FundRequestRow };
  userName: string;
  onClose: () => void;
}) {
  const forward  = useForwardFundRequestMutation();
  const approve  = useApproveFundRequestMutation();
  const reject   = useRejectFundRequestMutation();
  const disburse = useDisburseFundRequestMutation();
  const cancel   = useCancelFundRequestMutation();

  const [note, setNote]           = useState('');
  const [method, setMethod]       = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const { kind, req } = action;

  const META: Record<ActionKind, { title: string; cta: string; danger?: boolean }> = {
    forward:  { title: 'Forward to Principal',  cta: 'Forward' },
    approve:  { title: 'Approve Request',        cta: 'Approve' },
    reject:   { title: 'Reject Request',         cta: 'Reject',        danger: true },
    disburse: { title: 'Disburse Funds',         cta: 'Disburse' },
    cancel:   { title: 'Cancel Request',         cta: 'Cancel Request', danger: true },
  };

  const busy = forward.isPending || approve.isPending || reject.isPending || disburse.isPending || cancel.isPending;

  const run = () => {
    const ok  = (msg: string) => { toast(msg, 'success'); onClose(); };
    const err = () => toast('Action failed', 'error');
    if (kind === 'forward')
      forward.mutate({ id: req.id, body: { note, actorName: userName } }, { onSuccess: () => ok('Forwarded to Principal'), onError: err });
    else if (kind === 'approve')
      approve.mutate({ id: req.id, body: { note, actorName: userName } }, { onSuccess: () => ok('Request approved'), onError: err });
    else if (kind === 'reject') {
      if (!note.trim()) { toast('A reason is required to reject', 'error'); return; }
      reject.mutate({ id: req.id, body: { reason: note, actorName: userName } }, { onSuccess: () => ok('Request rejected'), onError: err });
    } else if (kind === 'disburse')
      disburse.mutate({ id: req.id, body: { method, reference: reference || undefined, note: note || undefined, actorName: userName } }, { onSuccess: () => ok('Funds disbursed'), onError: err });
    else
      cancel.mutate({ id: req.id, body: { reason: note || undefined, actorName: userName } }, { onSuccess: () => ok('Request cancelled'), onError: err });
  };

  const inp = 'mt-1 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 py-2.5 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#00334f] focus:bg-white';
  const lbl = 'text-[10px] font-black uppercase tracking-widest text-[#64748b]';

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4 backdrop-blur-sm"
      role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl border border-[#d5dde6] bg-white p-6 shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-black text-[#00334f]">{META[kind].title}</h2>
            <p className="mt-0.5 text-sm font-semibold text-[#64748b]">{req.requestNumber} · {req.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Request summary */}
        <div className="mt-4 rounded-xl bg-[#f7f9fb] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#64748b]">Amount</span>
            <span className="font-mono text-xl font-black text-[#0f172a]">{formatTZS(req.amount)}</span>
          </div>
          {req.department && <p className="mt-1.5 text-xs font-semibold text-[#64748b]">{req.department} · {req.category.replace(/_/g, ' ')}</p>}
          <p className="mt-1.5 text-sm text-[#475569] leading-relaxed">{req.description}</p>
        </div>

        {/* Event trail */}
        {req.events.length > 0 && (
          <div className="mt-4 space-y-2 border-l-2 border-[#e2e8f0] pl-4">
            {req.events.map((ev) => (
              <div key={ev.id} className="text-xs">
                <span className="font-black text-[#00334f]">{ev.action}</span>
                <span className="text-[#64748b]"> · {ev.actorName} · {formatDate(ev.createdAt)}</span>
                {ev.note && <p className="text-[#94a3b8] italic">{ev.note}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Action-specific fields */}
        <div className="mt-5 space-y-3">
          {kind === 'disburse' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={lbl}>Disbursement Method</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inp}>
                  {['BANK_TRANSFER', 'CASH', 'MOBILE_MONEY', 'OTHER'].map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={lbl}>Reference</span>
                <input value={reference} onChange={(e) => setReference(e.target.value)} className={inp} placeholder="e.g. CRDB-FR-001" />
              </label>
            </div>
          )}
          <label className="block">
            <span className={lbl}>{kind === 'reject' ? 'Rejection reason *' : 'Note (optional)'}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              className={`${inp} h-[72px]`}
              placeholder={
                kind === 'reject'  ? 'Why is this request being rejected?' :
                kind === 'forward' ? 'Any notes for the principal?' :
                kind === 'approve' ? 'Any conditions or notes?' :
                kind === 'disburse'? 'Any notes for the record?' : ''
              } />
          </label>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button
            variant={META[kind].danger ? 'danger' : 'primary'}
            onClick={run}
            disabled={busy}>
            {busy ? 'Working…' : META[kind].cta}
          </Button>
        </div>
      </div>
    </div>
  );
}
