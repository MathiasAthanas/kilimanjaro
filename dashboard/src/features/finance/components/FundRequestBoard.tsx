import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Calendar, Check, ChevronLeft, ChevronRight,
  Clock, Plus, Search, Send, ShieldAlert, Wallet, X,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonCards } from '../../../components/common/SkeletonCards';
import { toast } from '../../../lib/toast';
import { formatTZS, formatDate } from '../utils/money';
import { EXPENSE_CATEGORY_OPTIONS } from './financeOpsConstants';
import {
  useFundRequestsPage,
  useFundRequest,
  useFundRequestSummary,
  useCreateFundRequestMutation,
  useSchoolApproveFundRequestMutation,
  useFinanceReviewFundRequestMutation,
  useManagerApproveFundRequestMutation,
  useRejectFundRequestMutation,
  useDisburseFundRequestMutation,
  useCancelFundRequestMutation,
  type FundRequestRow,
} from '../api/financeOps.hooks';

// Approval chain: initiate (HOD / Head of School) → Head of School approval
// → Finance review → Manager approval → Finance disburses.
export type FundBoardRole = 'hod' | 'headOfSchool' | 'finance' | 'manager';
type ActionKind = 'schoolApprove' | 'financeReview' | 'managerApprove' | 'reject' | 'disburse' | 'cancel';
const REQUEST_CATEGORIES = EXPENSE_CATEGORY_OPTIONS.filter((category) => category !== 'FUND_DISBURSEMENT');
const PAGE_SIZE = 20;

type StageMeta = {
  status: string; label: string; desc: string;
  color: string; bg: string; border: string; dot: string;
};

const PIPELINE: StageMeta[] = [
  { status: 'SUBMITTED',        label: 'Submitted',        desc: 'Awaiting Head of School',   color: '#b45309', bg: '#fef9ee', border: '#d59a1b', dot: '#d59a1b' },
  { status: 'SCHOOL_APPROVED',  label: 'School Approved',  desc: 'Awaiting Finance review',    color: '#0369a1', bg: '#f0f9ff', border: '#7dd3fc', dot: '#0284c7' },
  { status: 'FINANCE_REVIEWED', label: 'Finance Reviewed', desc: 'Awaiting Manager approval',  color: '#7c3aed', bg: '#f5f3ff', border: '#c4b5fd', dot: '#8b5cf6' },
  { status: 'MANAGER_APPROVED', label: 'Manager Approved', desc: 'Ready for disbursement',     color: '#047857', bg: '#f0fdf9', border: '#6ee7b7', dot: '#10b981' },
  { status: 'DISBURSED',        label: 'Disbursed',        desc: 'Funds released',             color: '#4338ca', bg: '#eef2ff', border: '#a5b4fc', dot: '#6366f1' },
];

const CLOSED: Record<string, StageMeta> = {
  REJECTED:  { status: 'REJECTED',  label: 'Rejected',  desc: 'Request declined', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
  CANCELLED: { status: 'CANCELLED', label: 'Cancelled', desc: 'Withdrawn',        color: '#64748b', bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8' },
};

const STATUS_META = (status: string): StageMeta =>
  PIPELINE.find((p) => p.status === status) ?? CLOSED[status] ?? CLOSED.CANCELLED;

// Which event action records each pipeline stage (for the progress trail).
const STAGE_EVENT: Record<string, string> = {
  SUBMITTED: 'INITIATED',
  SCHOOL_APPROVED: 'SCHOOL_APPROVED',
  FINANCE_REVIEWED: 'FINANCE_REVIEWED',
  MANAGER_APPROVED: 'MANAGER_APPROVED',
  DISBURSED: 'DISBURSED',
};

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

// ─── Tiny action button ───────────────────────────────────────────────────────
function ActionBtn({
  children, onClick, tone, icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone: 'navy' | 'green' | 'indigo' | 'red' | 'slate' | 'amber';
  icon?: React.ReactNode;
}) {
  const cls: Record<string, string> = {
    navy:   'border-[#00334f]/20 text-[#00334f]   hover:bg-[#eef5f8]',
    green:  'border-emerald-200  text-emerald-700  hover:bg-emerald-50',
    indigo: 'border-indigo-200   text-indigo-700   hover:bg-indigo-50',
    red:    'border-red-200      text-red-600      hover:bg-red-50',
    slate:  'border-slate-200    text-slate-600    hover:bg-slate-50',
    amber:  'border-amber-300    text-amber-700    bg-amber-50 hover:bg-amber-100',
  };
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition ${cls[tone]}`}>
      {icon}{children}
    </button>
  );
}

// ─── Debounce helper ──────────────────────────────────────────────────────────
function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ════════════════════════════════ LIST ═══════════════════════════════════════
export function FundRequestBoard({
  role, userName, basePath,
}: {
  role: FundBoardRole;
  userName: string;
  basePath: string;
}) {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const debouncedSearch = useDebounced(search.trim());

  // Reset to first page whenever the filter or search changes.
  useEffect(() => { setPage(1); }, [statusFilter, debouncedSearch]);

  const { data, isLoading, isFetching } = useFundRequestsPage({
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const { data: summary } = useFundRequestSummary();

  const rows = data?.items ?? [];
  const meta = data?.meta;
  const byStatusCount = (summary?.byStatus ?? {}) as Record<string, { count: number }>;
  const totalAll = useMemo(
    () => Object.values(byStatusCount).reduce((s, v) => s + (v?.count ?? 0), 0),
    [byStatusCount],
  );

  const canCreate = role === 'hod' || role === 'headOfSchool' || role === 'manager';

  // Role "what needs me now" banner.
  const myQueue =
    role === 'headOfSchool' ? (summary?.pendingSchoolApproval ?? 0)
    : role === 'finance' ? (summary?.pendingFinanceReview ?? 0)
    : role === 'manager' ? (summary?.pendingManagerApproval ?? 0)
    : 0;
  const myQueueLabel =
    role === 'headOfSchool' ? 'awaiting your school approval'
    : role === 'finance' ? 'awaiting your finance review'
    : role === 'manager' ? 'awaiting your final approval'
    : '';

  const tabs: Array<{ key: string; label: string; count: number }> = [
    { key: 'ALL', label: 'All', count: totalAll },
    ...PIPELINE.map((p) => ({ key: p.status, label: p.label, count: byStatusCount[p.status]?.count ?? 0 })),
    { key: 'REJECTED', label: 'Rejected', count: byStatusCount.REJECTED?.count ?? 0 },
    { key: 'CANCELLED', label: 'Cancelled', count: byStatusCount.CANCELLED?.count ?? 0 },
  ];

  return (
    <div className="space-y-5">
      {/* ── Role queue banners ── */}
      {(myQueue > 0 || (role === 'finance' && (summary?.approvedAwaitingDisbursement ?? 0) > 0)) && (
        <div className="flex flex-wrap gap-3">
          {myQueue > 0 && (
            <button
              onClick={() => setStatusFilter(
                role === 'headOfSchool' ? 'SUBMITTED' : role === 'finance' ? 'SCHOOL_APPROVED' : 'FINANCE_REVIEWED',
              )}
              className="flex items-center gap-2.5 rounded-xl border border-[#d59a1b]/30 bg-[#fffbeb] px-4 py-2.5 hover:bg-[#fef6da]">
              <Clock className="h-4 w-4 text-[#d59a1b]" />
              <span className="text-sm font-bold text-[#7a5200]">
                {myQueue} request{myQueue !== 1 ? 's' : ''} {myQueueLabel}
              </span>
            </button>
          )}
          {role === 'finance' && (summary?.approvedAwaitingDisbursement ?? 0) > 0 && (
            <button
              onClick={() => setStatusFilter('MANAGER_APPROVED')}
              className="flex items-center gap-2.5 rounded-xl border border-[#10b981]/30 bg-[#f0fdf9] px-4 py-2.5 hover:bg-[#e3fbf1]">
              <Wallet className="h-4 w-4 text-[#10b981]" />
              <span className="text-sm font-bold text-[#065f46]">
                {summary?.approvedAwaitingDisbursement} ready to disburse
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#64748b]">Funding Pipeline</p>
          <p className="mt-0.5 text-sm font-semibold text-[#64748b]">
            {meta?.total ?? rows.length} {statusFilter === 'ALL' ? 'total' : STATUS_META(statusFilter).label.toLowerCase()}
            {debouncedSearch ? ` · matching “${debouncedSearch}”` : ''}
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

      {/* ── Filter tabs + search ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => {
            const active = statusFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                  active
                    ? 'border-[#00334f] bg-[#00334f] text-white'
                    : 'border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#cbd5e1]'
                }`}>
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] font-black ${active ? 'bg-white/20' : 'bg-[#f1f5f9] text-[#94a3b8]'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number, title, requester or department…"
            className="h-10 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] pl-9 pr-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#00334f] focus:bg-white" />
        </div>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <SkeletonCards count={3} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d5dde6] bg-white p-6">
          <EmptyState
            title={debouncedSearch || statusFilter !== 'ALL' ? 'No matching requests' : 'No fund requests yet'}
            description={
              debouncedSearch || statusFilter !== 'ALL'
                ? 'Try a different filter or search term.'
                : canCreate
                ? 'Create the first request to start the school approval, finance review and manager approval workflow.'
                : 'No requests have been submitted yet.'
            }
          />
        </div>
      ) : (
        <div className={`overflow-hidden rounded-xl border border-[#e2e8f0] bg-white transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
          {/* Column header (desktop) */}
          <div className="hidden grid-cols-[1.6fr_1fr_1fr_0.9fr] gap-3 border-b border-[#f1f5f9] bg-[#f8fafc] px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#94a3b8] md:grid">
            <span>Request</span>
            <span>Requested by</span>
            <span>Status</span>
            <span className="text-right">Amount</span>
          </div>
          <ul className="divide-y divide-[#f1f5f9]">
            {rows.map((req) => {
              const overdue = req.neededBy && new Date(req.neededBy).getTime() < Date.now() && req.status !== 'DISBURSED';
              return (
                <li key={req.id}>
                  <Link
                    to={`${basePath}/${req.id}`}
                    className="grid grid-cols-1 gap-2 px-4 py-3 transition hover:bg-[#f8fafc] md:grid-cols-[1.6fr_1fr_1fr_0.9fr] md:items-center md:gap-3">
                    {/* Request */}
                    <div className="min-w-0">
                      <p className="text-[10px] font-black tracking-widest text-[#94a3b8]">{req.requestNumber}</p>
                      <p className="truncate text-sm font-bold text-[#0f172a]">{req.title}</p>
                      <p className="mt-0.5 flex items-center gap-2 text-[10px] font-semibold text-[#94a3b8]">
                        <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 text-[#64748b]">{req.category.replace(/_/g, ' ')}</span>
                        {req.department && <span>{req.department}</span>}
                        {req.neededBy && (
                          <span className={`flex items-center gap-0.5 ${overdue ? 'text-red-600' : ''}`}>
                            <Calendar className="h-2.5 w-2.5" /> {formatDate(req.neededBy)}
                            {overdue && <AlertTriangle className="h-2.5 w-2.5" />}
                          </span>
                        )}
                      </p>
                    </div>
                    {/* Requested by */}
                    <div className="min-w-0 text-xs">
                      <p className="truncate font-semibold text-[#475569]">{req.requestedByName}</p>
                      {req.requestedByRole && <p className="truncate text-[10px] text-[#94a3b8]">{req.requestedByRole}</p>}
                    </div>
                    {/* Status */}
                    <div><StatusBadge status={req.status} /></div>
                    {/* Amount */}
                    <div className="flex items-center justify-between md:justify-end md:gap-2">
                      <span className="text-sm font-black tabular-nums text-[#00334f]">{formatTZS(req.amount)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#cbd5e1]" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-[#94a3b8]">
            Page {meta.page} of {meta.totalPages} · {meta.total} total
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={meta.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-bold text-[#475569] disabled:opacity-40 hover:bg-[#f8fafc]">
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            {pageWindow(meta.page, meta.totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="px-1 text-xs text-[#cbd5e1]">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={`h-8 w-8 rounded-lg text-xs font-black transition ${
                    p === meta.page ? 'bg-[#00334f] text-white' : 'border border-[#e2e8f0] text-[#475569] hover:bg-[#f8fafc]'
                  }`}>
                  {p}
                </button>
              ),
            )}
            <button
              disabled={meta.page >= meta.totalPages}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] px-2.5 py-1.5 text-xs font-bold text-[#475569] disabled:opacity-40 hover:bg-[#f8fafc]">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact page-number window: 1 … 4 5 [6] 7 8 … 20
function pageWindow(current: number, total: number): (number | '…')[] {
  const out: (number | '…')[] = [];
  const push = (n: number) => out.push(n);
  const around = new Set<number>([1, total, current, current - 1, current + 1]);
  let last = 0;
  for (let i = 1; i <= total; i++) {
    if (around.has(i)) {
      if (i - last > 1) out.push('…');
      push(i);
      last = i;
    }
  }
  return out;
}

// ════════════════════════════════ DETAIL (full page) ═════════════════════════
export function FundRequestDetailView({
  role, userName, basePath,
}: {
  role: FundBoardRole;
  userName: string;
  basePath: string;
}) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: req, isLoading, isError } = useFundRequest(id);
  const [action, setAction] = useState<{ kind: ActionKind; req: FundRequestRow; override?: boolean; decision?: boolean } | null>(null);

  if (isLoading) return <SkeletonCards count={2} />;
  if (isError || !req) {
    return (
      <div className="space-y-4">
        <BackLink to={basePath} />
        <div className="rounded-xl border border-dashed border-[#d5dde6] bg-white p-8">
          <EmptyState title="Request not found" description="This fund request may have been removed or is outside your access." />
        </div>
      </div>
    );
  }

  const isManager = role === 'manager';
  const status = req.status;

  // The manager's OWN stage — a native decision (approve / reject), not an override.
  const managerOwnStage = isManager && status === 'FINANCE_REVIEWED';

  // Any step whose native owner is another role. Here the manager does NOT get that
  // role's buttons — only a single "Override as Manager" that gates the approve/reject
  // decision, so it is always explicit (and recorded) that the manager stepped in.
  const overrideKind: ActionKind | null =
    isManager && status === 'SUBMITTED' ? 'schoolApprove'
    : isManager && status === 'SCHOOL_APPROVED' ? 'financeReview'
    : isManager && status === 'MANAGER_APPROVED' ? 'disburse'
    : null;
  const overrideOwner =
    status === 'SUBMITTED' ? 'Head of School'
    : status === 'SCHOOL_APPROVED' ? 'Finance'
    : status === 'MANAGER_APPROVED' ? 'Finance'
    : '';

  // Native (non-manager) role actions.
  const canSchoolApprove = role === 'headOfSchool' && status === 'SUBMITTED';
  const canFinanceReview = role === 'finance' && status === 'SCHOOL_APPROVED';
  const canManagerApprove = managerOwnStage; // manager's own stage
  const canDisburse = role === 'finance' && status === 'MANAGER_APPROVED';
  // Standalone reject: native owners at their stage, and the manager only at his own
  // stage. At override stages the manager rejects from inside the override instead.
  const canReject =
    (role === 'headOfSchool' && status === 'SUBMITTED') ||
    (role === 'finance' && status === 'SCHOOL_APPROVED') ||
    managerOwnStage;
  const canCancel =
    (role === 'hod' || role === 'headOfSchool') &&
    ['SUBMITTED', 'SCHOOL_APPROVED', 'FINANCE_REVIEWED'].includes(status);

  const hasActions =
    canSchoolApprove || canFinanceReview || canManagerApprove || canDisburse || canReject || canCancel || Boolean(overrideKind);

  return (
    <div className="space-y-5">
      <BackLink to={basePath} />

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <div className="min-w-0">
          <p className="text-[11px] font-black tracking-widest text-[#94a3b8]">{req.requestNumber}</p>
          <h1 className="font-display text-2xl font-black text-[#00334f]">{req.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">{req.category.replace(/_/g, ' ')}</span>
            {req.department && <span className="text-[11px] font-semibold text-[#475569]">{req.department}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Amount</p>
          <p className="font-mono text-2xl font-black text-[#0f172a]">{formatTZS(req.amount)}</p>
          {req.neededBy && (
            <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-bold text-[#64748b]">
              <Calendar className="h-3 w-3" /> Needed {formatDate(req.neededBy)}
            </p>
          )}
        </div>
      </div>

      {/* ── Pipeline progress ── */}
      <PipelineProgress req={req} />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Details + actions ── */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Request</p>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">{req.description || 'No description provided.'}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Field label="Requested by" value={req.requestedByName} sub={req.requestedByRole} />
              {req.principalName && <Field label="School approval" value={req.principalName} sub={req.principalNote} />}
              {req.bursarName && <Field label="Finance review" value={req.bursarName} sub={req.bursarNote} />}
              {req.managerName && <Field label="Manager decision" value={req.managerName} sub={req.managerNote} />}
              {req.disbursedByName && <Field label="Disbursed by" value={req.disbursedByName} sub={req.disbursementRef ? `Ref ${req.disbursementRef}` : req.disbursementMethod} />}
            </div>
            {req.rejectionReason && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Rejection reason</p>
                <p className="mt-0.5 text-xs text-red-700">{req.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          {hasActions && (
            <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Actions</p>

              {overrideKind ? (
                <>
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" /> This step belongs to {overrideOwner}
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700/90">
                      It isn’t at your stage yet. As Manager you can step in — choose to approve or reject inside the override. Either way it is recorded on the request as a <strong>manager override</strong> so {overrideOwner} can see what was done.
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionBtn tone="amber" icon={<ShieldAlert className="h-3.5 w-3.5" />} onClick={() => setAction({ kind: overrideKind, req, override: true, decision: true })}>
                      Override as Manager
                    </ActionBtn>
                  </div>
                </>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {canSchoolApprove && (
                    <ActionBtn tone="navy" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setAction({ kind: 'schoolApprove', req })}>School Approve</ActionBtn>
                  )}
                  {canFinanceReview && (
                    <ActionBtn tone="navy" icon={<Send className="h-3.5 w-3.5" />} onClick={() => setAction({ kind: 'financeReview', req })}>Finance Review</ActionBtn>
                  )}
                  {canManagerApprove && (
                    <ActionBtn tone="green" icon={<Check className="h-3.5 w-3.5" />} onClick={() => setAction({ kind: 'managerApprove', req })}>Manager Approve</ActionBtn>
                  )}
                  {canDisburse && (
                    <ActionBtn tone="indigo" icon={<Wallet className="h-3.5 w-3.5" />} onClick={() => setAction({ kind: 'disburse', req })}>Disburse</ActionBtn>
                  )}
                  {canReject && (
                    <ActionBtn tone="red" icon={<X className="h-3.5 w-3.5" />} onClick={() => setAction({ kind: 'reject', req })}>Reject</ActionBtn>
                  )}
                  {canCancel && (
                    <ActionBtn tone="slate" onClick={() => setAction({ kind: 'cancel', req })}>Cancel Request</ActionBtn>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Event timeline ── */}
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Activity</p>
          {req.events.length === 0 ? (
            <p className="mt-3 text-xs text-[#94a3b8]">No activity recorded yet.</p>
          ) : (
            <div className="mt-3 space-y-3 border-l-2 border-[#e2e8f0] pl-4">
              {req.events.map((ev) => {
                const isOverride = ev.note?.startsWith('[Manager override]');
                return (
                  <div key={ev.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white"
                      style={{ background: isOverride ? '#f59e0b' : '#00334f' }} />
                    <p className="text-xs font-black text-[#0f172a]">
                      {ev.action.replace(/_/g, ' ')}
                      {isOverride && <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700">Override</span>}
                    </p>
                    <p className="text-[11px] text-[#64748b]">{ev.actorName}{ev.actorRole ? ` · ${ev.actorRole}` : ''}</p>
                    {ev.note && <p className="text-[11px] italic text-[#94a3b8]">{ev.note.replace('[Manager override] ', '')}</p>}
                    <p className="text-[10px] text-[#cbd5e1]">{formatDate(ev.createdAt)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {action && (
        <ActionModal
          action={action}
          userName={userName}
          onClose={() => setAction(null)}
          onDone={() => { setAction(null); navigate(basePath); }}
        />
      )}
    </div>
  );
}

function BackLink({ to }: { to: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-[#00334f]">
      <ArrowLeft className="h-4 w-4" /> Back to requests
    </Link>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">{label}</p>
      <p className="font-bold text-[#0f172a]">{value || '—'}</p>
      {sub && <p className="text-[11px] text-[#94a3b8]">{sub}</p>}
    </div>
  );
}

// ─── Pipeline progress stepper ────────────────────────────────────────────────
function PipelineProgress({ req }: { req: FundRequestRow }) {
  const closed = CLOSED[req.status];
  const currentIdx = PIPELINE.findIndex((p) => p.status === req.status);
  const eventFor = (stageStatus: string) =>
    req.events.find((e) => e.action === STAGE_EVENT[stageStatus]) ?? null;

  return (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">Approval progress</p>

      {closed && (
        <div className="mt-3 rounded-lg px-3 py-2 text-[11px] font-bold"
          style={{ background: closed.bg, color: closed.color, border: `1px solid ${closed.border}` }}>
          This request was {closed.label.toLowerCase()}.{req.rejectionReason ? ` ${req.rejectionReason}` : ''}
        </div>
      )}

      <ol className="mt-4 flex flex-col gap-0 md:flex-row md:items-start md:gap-0">
        {PIPELINE.map((stage, i) => {
          const done = currentIdx >= 0 && i < currentIdx;
          const current = i === currentIdx;
          const reached = done || current;
          const ev = eventFor(stage.status);
          const submittedActor = stage.status === 'SUBMITTED' && !ev
            ? { actorName: req.requestedByName, createdAt: req.createdAt }
            : ev;
          return (
            <li key={stage.status} className="flex flex-1 gap-3 md:flex-col md:items-center md:text-center">
              {/* Connector + dot */}
              <div className="flex flex-col items-center md:w-full md:flex-row">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black md:mx-auto"
                  style={{
                    background: reached ? stage.dot : '#f1f5f9',
                    color: reached ? '#fff' : '#cbd5e1',
                    boxShadow: current ? `0 0 0 4px ${stage.bg}` : undefined,
                  }}>
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                {i < PIPELINE.length - 1 && (
                  <span className="my-1 h-6 w-0.5 md:my-0 md:h-0.5 md:w-full"
                    style={{ background: done ? stage.dot : '#e2e8f0' }} />
                )}
              </div>
              {/* Label */}
              <div className="pb-4 md:pb-0 md:px-1">
                <p className="text-[11px] font-black" style={{ color: reached ? stage.color : '#94a3b8' }}>{stage.label}</p>
                <p className="text-[10px] text-[#94a3b8]">{stage.desc}</p>
                {reached && submittedActor?.actorName && (
                  <p className="mt-0.5 text-[10px] font-semibold text-[#64748b]">
                    {submittedActor.actorName}
                    {submittedActor.createdAt ? ` · ${formatDate(submittedActor.createdAt)}` : ''}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
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
  action, userName, onClose, onDone,
}: {
  action: { kind: ActionKind; req: FundRequestRow; override?: boolean; decision?: boolean };
  userName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const schoolApprove  = useSchoolApproveFundRequestMutation();
  const financeReview  = useFinanceReviewFundRequestMutation();
  const managerApprove = useManagerApproveFundRequestMutation();
  const reject   = useRejectFundRequestMutation();
  const disburse = useDisburseFundRequestMutation();
  const cancel   = useCancelFundRequestMutation();

  const [note, setNote]           = useState('');
  const [method, setMethod]       = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const { kind, req, override, decision } = action;

  const META: Record<ActionKind, { title: string; cta: string; danger?: boolean }> = {
    schoolApprove:  { title: 'Head of School Approval', cta: 'Approve' },
    financeReview:  { title: 'Finance Review',          cta: 'Send to Manager' },
    managerApprove: { title: 'Manager Final Approval',  cta: 'Approve' },
    reject:         { title: 'Reject Request',          cta: 'Reject',        danger: true },
    disburse:       { title: 'Disburse Funds',          cta: 'Disburse' },
    cancel:         { title: 'Cancel Request',          cta: 'Cancel Request', danger: true },
  };

  const busy = schoolApprove.isPending || financeReview.isPending || managerApprove.isPending || reject.isPending || disburse.isPending || cancel.isPending;
  const owner = kind === 'schoolApprove' ? 'Head of School' : (kind === 'financeReview' || kind === 'disburse') ? 'Finance' : '';
  // Reject is only permitted while the request is still in an approval stage.
  const rejectAllowedHere = req.status !== 'MANAGER_APPROVED';

  const ok  = (msg: string) => { toast(msg, 'success'); onDone(); };
  const err = () => toast('Action failed', 'error');

  // Perform the forward (progress) action for this kind.
  const runForward = () => {
    if (kind === 'schoolApprove')
      schoolApprove.mutate({ id: req.id, body: { note, actorName: userName, override } }, { onSuccess: () => ok(override ? 'Overridden — school approval recorded' : 'Approved at school level'), onError: err });
    else if (kind === 'financeReview')
      financeReview.mutate({ id: req.id, body: { note, actorName: userName, override } }, { onSuccess: () => ok(override ? 'Overridden — sent to Manager' : 'Reviewed, sent to Manager'), onError: err });
    else if (kind === 'managerApprove')
      managerApprove.mutate({ id: req.id, body: { note, actorName: userName } }, { onSuccess: () => ok('Approved by Manager'), onError: err });
    else if (kind === 'disburse')
      disburse.mutate({ id: req.id, body: { method, reference: reference || undefined, note: note || undefined, actorName: userName, override } }, { onSuccess: () => ok(override ? 'Overridden — funds disbursed' : 'Funds disbursed'), onError: err });
    else if (kind === 'cancel')
      cancel.mutate({ id: req.id, body: { reason: note || undefined, actorName: userName } }, { onSuccess: () => ok('Request cancelled'), onError: err });
  };

  const runReject = () => {
    if (!note.trim()) { toast('A reason is required to reject', 'error'); return; }
    reject.mutate({ id: req.id, body: { reason: note, actorName: userName, override } }, { onSuccess: () => ok(override ? 'Overridden — request rejected' : 'Request rejected'), onError: err });
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
            <h2 className="font-display text-xl font-black text-[#00334f]">
              {override ? 'Override as Manager' : kind === 'reject' ? 'Reject Request' : META[kind].title}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-[#64748b]">{req.requestNumber} · {req.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#64748b] hover:bg-[#f1f5f9]">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Override notice */}
        {override && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs font-semibold text-amber-800">
              This step belongs to <strong>{owner}</strong>. {decision
                ? <>Choose to <strong>approve</strong> or <strong>reject</strong> on their behalf — either way it is recorded as a <strong>manager override</strong> so {owner} can see it.</>
                : <>You are stepping in — recorded as a <strong>manager override</strong>.</>}
            </p>
          </div>
        )}

        {/* Summary */}
        <div className="mt-4 rounded-xl bg-[#f7f9fb] p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#64748b]">Amount</span>
            <span className="font-mono text-xl font-black text-[#0f172a]">{formatTZS(req.amount)}</span>
          </div>
          {req.department && <p className="mt-1.5 text-xs font-semibold text-[#64748b]">{req.department} · {req.category.replace(/_/g, ' ')}</p>}
          <p className="mt-1.5 text-sm text-[#475569] leading-relaxed">{req.description}</p>
        </div>

        {/* Action fields */}
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
            <span className={lbl}>
              {kind === 'reject' ? 'Rejection reason *' : decision ? 'Note (approve) / reason (reject)' : 'Note (optional)'}
            </span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              className={`${inp} h-[72px]`}
              placeholder={
                decision                  ? 'Add a note for approval, or the reason if rejecting…' :
                kind === 'reject'         ? 'Why is this request being rejected?' :
                kind === 'financeReview'  ? 'Any notes for the Manager?' :
                kind === 'schoolApprove'  ? 'Any conditions or notes?' :
                kind === 'managerApprove' ? 'Any conditions or notes?' :
                kind === 'disburse'       ? 'Any notes for the record?' : ''
              } />
          </label>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {decision ? (
            <>
              {rejectAllowedHere && (
                <Button variant="danger" onClick={runReject} disabled={busy}>
                  {busy ? 'Working…' : 'Override — Reject'}
                </Button>
              )}
              <Button variant="primary" onClick={runForward} disabled={busy}>
                {busy ? 'Working…' : `Override — ${META[kind].cta}`}
              </Button>
            </>
          ) : kind === 'reject' ? (
            <Button variant="danger" onClick={runReject} disabled={busy}>{busy ? 'Working…' : 'Reject'}</Button>
          ) : (
            <Button variant={META[kind].danger ? 'danger' : 'primary'} onClick={runForward} disabled={busy}>
              {busy ? 'Working…' : override ? `Override — ${META[kind].cta}` : META[kind].cta}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
