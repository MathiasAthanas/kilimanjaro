import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  Equal,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Layers,
  Link2,
  Link2Off,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  Search,
  Send,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  WalletCards,
  X,
  Zap,
  MessageSquare,
  ClipboardCheck,
  Eye,
  Timer,
  UploadCloud,
  Paperclip,
  Printer,
  RefreshCw,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { downloadReportWhenReady, useGenerateReportMutation } from '../../operations/api/operations.hooks';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  assets,
  auditEntries,
  feeAssignments,
  feeCategories,
  feeStructures,
  financeOverview,
  invoices,
  payments,
  receipts,
  studentGroups,
} from '../api/financeApi';
import {
  useAssetSummary,
  useAssets,
  useAsset as useAssetById,
  useFixedAssetRegister,
  useFinanceAuditLogs,
  useFinanceOverview,
  useFeeAssignments,
  useFeeCategories,
  useFeeStructures,
  useInvoice as useInvoiceById,
  useInvoices,
  usePendingPaymentApprovals,
  usePayments,
  useReceipts,
  useReceipt as useReceiptById,
  useStudentGroups,
  useCollectionSummary,
  useOutstandingBalances,
  useDeleteFeeAssignmentMutation,
  useCreateFeeStructureMutation,
  useUpdateFeeStructureMutation,
  useDeactivateFeeStructureMutation,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useCreateFeeCategoryMutation,
  useUpdateFeeCategoryMutation,
  useReorderFeeCategoriesMutation,
  useWaiveInvoiceMutation,
  useApplyInvoiceDiscountMutation,
  useCancelInvoiceMutation,
  useVoidReceiptMutation,
  useDisposeAssetMutation,
  useRefundPaymentMutation,
  useGenerateInvoicesMutation,
  useStudentInvoices,
  useStudentStatement,
  useCashPaymentMutation,
  useBankTransferMutation,
  useAddPaymentNoteMutation,
  useDailyCollections,
  useFeeDefaulters,
} from '../api/finance.hooks';
import {
  ActionPanel,
  AmountDisplay,
  AssetCard,
  AuditImmutableBanner,
  AuditLogRow,
  CollectionRing,
  DenseBarChart,
  FeeMatrixGrid,
  FinanceBreadcrumb,
  FinanceFilters,
  FinanceMetricStrip,
  FinanceStatusBadge,
  FinanceTable,
  FinanceWorkspaceShell,
  InvoiceTable,
  MiniColumnChart,
  PaymentForm,
  PaymentTable,
  ReadOnlyApprovalNotice,
  ReceiptList,
  ReceiptPreview,
  ReportCard,
  Td,
  downloadReceiptPdf,
  downloadInvoicePdf,
  getLogoBase64,
} from '../components/FinanceWorkspaceShell';
import { formatDate, formatTZS, overdueInvoices, parseTZSInput, isOverpayment, duplicateReferenceWarning } from '../utils/money';
import { useFileUploadMutation, validateFile } from '../../../lib/api/upload';
import type { UploadedFile } from '../../../lib/api/upload';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useFinanceClasses, useFinanceAcademicYears, useFinanceTerms, useFundRequestSummary, useFundRequests, useStoreSummary, useExpenseSummary } from '../api/financeOps.hooks';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { SkeletonCards } from '../../../components/common/SkeletonCards';

// Zero-value overview — shown when API hasn't returned data yet (no fake numbers)
const EMPTY_OVERVIEW: typeof financeOverview = { totalInvoiced: 0, totalCollected: 0, outstanding: 0, collectionRate: 0, today: 0, overdueInvoices: 0 };

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function FinanceHomePage() {
  const navigate = useNavigate();

  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as unknown as { data: typeof financeOverview };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const { data: pendingApprovals = [] } = usePendingPaymentApprovals() as unknown as { data: unknown[] };
  const { data: fundSummary } = useFundRequestSummary() as unknown as { data?: { pendingForward: number; pendingApproval: number; approvedAwaitingDisbursement: number } };
  const { data: storeSummary } = useStoreSummary() as unknown as { data?: { lowStockCount: number; totalStockValue: number } };
  const { data: fundRequests = [] } = useFundRequests({ status: 'SUBMITTED' }) as unknown as { data: Array<{ id: string; title: string; department: string; amount: number; status: string; requestNumber: string; neededBy: string }> };
  const { data: collectionData } = useCollectionSummary() as unknown as { data?: { byPaymentMethod?: Array<{ method: string; amount: number; count: number }> } };
  const { data: expenseSummary } = useExpenseSummary() as unknown as { data?: { totalSpent: number; byCategory: Array<{ category: string; total: number }> } };

  const [studentSearch, setStudentSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const overdue = overdueInvoices(apiInvoices);
  const base = apiOverview.totalInvoiced || 1;
  const collectedPct = Math.min(100, Math.round((apiOverview.totalCollected / base) * 100));
  const pendingCount = Array.isArray(pendingApprovals) ? pendingApprovals.length : 0;
  const foActionCount = (fundSummary?.pendingForward ?? 0) + (fundSummary?.approvedAwaitingDisbursement ?? 0);
  const lowStockCount = storeSummary?.lowStockCount ?? 0;

  // Student search: filter invoices by student name
  const studentMatches = studentSearch.trim().length >= 2
    ? Array.from(
        new Map(
          apiInvoices
            .filter((inv) => inv.student.toLowerCase().includes(studentSearch.toLowerCase()) || inv.registration?.toLowerCase().includes(studentSearch.toLowerCase()))
            .map((inv) => [inv.studentId ?? inv.student, inv]),
        ).values(),
      ).slice(0, 6)
    : [];

  // Collection by method
  const byMethod = (collectionData?.byPaymentMethod ?? []);
  const totalMethodAmount = byMethod.reduce((s, m) => s + m.amount, 0) || 1;
  const methodColors: Record<string, string> = { CASH: 'bg-[#00334f]', BANK: 'bg-[#10b981]', MOBILE_MONEY: 'bg-[#d59a1b]' };
  const methodLabels: Record<string, string> = { CASH: 'Cash', BANK: 'Bank Transfer', MOBILE_MONEY: 'Mobile Money' };

  // Recent payments — last 8, most recent first
  const recentPayments = [...apiPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  // Top overdue — biggest outstanding first
  const topOverdue = [...overdue].sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

  // Fund requests needing FO action
  const foFundRequests = fundRequests.filter((f) => f.status === 'SUBMITTED' || f.status === 'APPROVED').slice(0, 4);

  return (
    <FinanceWorkspaceShell title="Finance Operations Desk" eyebrow="Command Centre">

      {/* ── Alert Strip ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            icon: Clock, label: 'Payment Queue', count: pendingCount,
            detail: pendingCount > 0 ? `${pendingCount} awaiting Principal approval` : 'Queue is clear',
            to: '/finance/payments/pending',
            tone: pendingCount > 0 ? 'border-[#d59a1b]/40 bg-[#fffbeb]' : 'border-[#d5dde6] bg-white',
            iconTone: pendingCount > 0 ? 'bg-[#d59a1b] text-white' : 'bg-[#f7f9fb] text-[#64748b]',
            valueTone: pendingCount > 0 ? 'text-[#d59a1b]' : 'text-[#00334f]',
          },
          {
            icon: AlertTriangle, label: 'Overdue Invoices', count: overdue.length,
            detail: overdue.length > 0 ? `${formatTZS(overdue.reduce((s, i) => s + i.outstanding, 0))} total` : 'No overdue invoices',
            to: '/finance/reports/fee-defaulters',
            tone: overdue.length > 0 ? 'border-red-200 bg-red-50' : 'border-[#d5dde6] bg-white',
            iconTone: overdue.length > 0 ? 'bg-red-500 text-white' : 'bg-[#f7f9fb] text-[#64748b]',
            valueTone: overdue.length > 0 ? 'text-red-600' : 'text-[#00334f]',
          },
          {
            icon: Briefcase, label: 'Fund Requests', count: foActionCount,
            detail: foActionCount > 0 ? `${fundSummary?.pendingForward ?? 0} to forward · ${fundSummary?.approvedAwaitingDisbursement ?? 0} to disburse` : 'No FO action needed',
            to: '/finance/fund-requests',
            tone: foActionCount > 0 ? 'border-blue-200 bg-blue-50' : 'border-[#d5dde6] bg-white',
            iconTone: foActionCount > 0 ? 'bg-blue-600 text-white' : 'bg-[#f7f9fb] text-[#64748b]',
            valueTone: foActionCount > 0 ? 'text-blue-600' : 'text-[#00334f]',
          },
          {
            icon: Package, label: 'Low Stock', count: lowStockCount,
            detail: lowStockCount > 0 ? `${lowStockCount} item${lowStockCount !== 1 ? 's' : ''} below reorder level` : 'Stock levels OK',
            to: '/finance/store',
            tone: lowStockCount > 0 ? 'border-orange-200 bg-orange-50' : 'border-[#d5dde6] bg-white',
            iconTone: lowStockCount > 0 ? 'bg-orange-500 text-white' : 'bg-[#f7f9fb] text-[#64748b]',
            valueTone: lowStockCount > 0 ? 'text-orange-600' : 'text-[#00334f]',
          },
        ].map(({ icon: Icon, label, count, detail, to, tone, iconTone, valueTone }) => (
          <NavLink key={label} to={to} className={`group flex items-center gap-3 rounded-xl border p-4 transition hover:shadow-md ${tone}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#64748b]">{label}</p>
              <p className={`font-display text-2xl font-black leading-tight ${valueTone}`}>{count}</p>
              <p className="truncate text-[10px] font-semibold text-[#64748b]">{detail}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#94a3b8] transition group-hover:translate-x-0.5" />
          </NavLink>
        ))}
      </div>

      {/* ── Command Bar: Student Search + Quick Actions ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Student Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={studentSearch}
            onChange={(e) => { setStudentSearch(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
            placeholder="Find a student by name or registration number…"
            className="h-11 w-full rounded-xl border border-[#d5dde6] bg-white pl-10 pr-10 text-sm font-semibold text-[#00334f] shadow-sm placeholder:font-normal placeholder:text-[#94a3b8] focus:border-[#00334f] focus:outline-none focus:ring-2 focus:ring-[#00334f]/10"
          />
          {studentSearch && (
            <button onClick={() => { setStudentSearch(''); setSearchOpen(false); }} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#00334f]">
              <X className="h-4 w-4" />
            </button>
          )}
          {/* Dropdown */}
          {searchOpen && studentMatches.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[#d5dde6] bg-white shadow-xl">
              {studentMatches.map((inv) => (
                <button
                  key={inv.studentId ?? inv.student}
                  onMouseDown={() => {
                    navigate(`/finance/students/${inv.studentId ?? inv.student}`);
                    setStudentSearch('');
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#f7f9fb]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00334f]/10 text-xs font-black text-[#00334f]">
                    {inv.student.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-[#00334f] truncate">{inv.student}</p>
                    <p className="text-[10px] font-semibold text-[#64748b]">{inv.className} · {inv.registration}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-xs font-black ${inv.outstanding > 0 ? 'text-red-600' : 'text-[#10b981]'}`}>
                      {inv.outstanding > 0 ? formatTZS(inv.outstanding) : 'Paid'}
                    </p>
                    <p className="text-[9px] font-semibold text-[#94a3b8]">{inv.outstanding > 0 ? 'outstanding' : 'in full'}</p>
                  </div>
                </button>
              ))}
              <div className="border-t border-[#d5dde6] px-4 py-2 text-[10px] font-semibold text-[#94a3b8]">
                Click a student to view their invoices
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="flex shrink-0 gap-2">
          <NavLink to="/finance/payments/cash">
            <Button className="h-11 rounded-xl bg-[#00334f] hover:bg-[#001e30]">
              <Banknote className="mr-1.5 h-4 w-4" /> Cash
            </Button>
          </NavLink>
          <NavLink to="/finance/payments/bank">
            <Button variant="secondary" className="h-11 rounded-xl border-[#d5dde6] hover:bg-[#f7f9fb]">
              <WalletCards className="mr-1.5 h-4 w-4" /> Bank
            </Button>
          </NavLink>
          <NavLink to="/finance/invoices/generate">
            <Button variant="secondary" className="h-11 rounded-xl border-[#d5dde6] hover:bg-[#f7f9fb]">
              <Zap className="mr-1.5 h-4 w-4" /> Generate Invoices
            </Button>
          </NavLink>
        </div>
      </div>

      {/* ── Metric Strip ── */}
      <FinanceMetricStrip items={[
        { label: 'Today\'s Collection', value: formatTZS(apiOverview.today), detail: 'Live collection desk total', tone: 'gold', trend: apiOverview.today > 0 ? 'up' : undefined },
        { label: 'Term Collected', value: formatTZS(apiOverview.totalCollected), detail: `${collectedPct}% of invoiced amount`, tone: 'green', trend: 'up', progress: collectedPct },
        { label: 'Outstanding', value: formatTZS(apiOverview.outstanding), detail: `${apiOverview.overdueInvoices} overdue · ${formatTZS(apiOverview.totalInvoiced)} invoiced`, tone: 'red', trend: overdue.length > 0 ? 'down' : undefined },
        { label: 'Payment Queue', value: String(pendingCount), detail: pendingCount > 0 ? 'Awaiting Principal approval' : 'Queue is clear', tone: pendingCount > 0 ? 'gold' : 'navy' },
      ]} />

      {/* ── Main three-column grid ── */}
      <div className="grid gap-gutter xl:grid-cols-[280px_minmax(0,1fr)_300px]">

        {/* ── LEFT: Collection breakdown ── */}
        <div className="space-y-gutter">
          <CollectionRing rate={apiOverview.collectionRate} />

          {/* Collection by method */}
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#64748b]">Collection by method</p>
            {byMethod.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-[#64748b]">No payment data yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {byMethod.map((m) => {
                  const pct = Math.round((m.amount / totalMethodAmount) * 100);
                  const barColor = methodColors[m.method] ?? 'bg-[#64748b]';
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#00334f]">{methodLabels[m.method] ?? m.method}</span>
                        <span className="font-black text-[#00334f]">{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 w-full rounded-full bg-[#f7f9fb]">
                        <div className={`h-2 rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-0.5 text-[10px] font-semibold text-[#64748b]">{formatTZS(m.amount)} · {m.count} payment{m.count !== 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Term bar chart */}
          <DenseBarChart
            title="Term Summary"
            subtitle="Invoiced vs Collected vs Outstanding"
            values={[
              { label: 'Invoiced', value: apiOverview.totalInvoiced, tone: 'bg-[#00334f]' },
              { label: 'Collected', value: apiOverview.totalCollected, tone: 'bg-[#10b981]' },
              { label: 'Outstanding', value: apiOverview.outstanding, tone: 'bg-[#d59a1b]' },
            ]}
          />
        </div>

        {/* ── CENTER: Recent payments + top overdue ── */}
        <div className="space-y-gutter">

          {/* Recent Payments */}
          <div className="rounded-xl border border-[#d5dde6] bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#d5dde6] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#00334f]" />
                <h2 className="font-display text-base font-black text-[#00334f]">Recent Payments</h2>
              </div>
              <NavLink to="/finance/payments" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#d59a1b] hover:underline">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>
            {recentPayments.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm font-semibold text-[#64748b]">No payments recorded yet.</div>
            ) : (
              <div className="divide-y divide-[#d5dde6]">
                {recentPayments.map((p) => {
                  const methodIcon = p.method === 'CASH' ? '💵' : p.method === 'BANK' ? '🏦' : '📱';
                  const statusColor = p.status === 'APPROVED' ? 'text-[#10b981]' : p.status === 'REJECTED' ? 'text-red-500' : 'text-[#d59a1b]';
                  return (
                    <NavLink key={p.id} to={`/finance/payments/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f7f9fb] transition">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7f9fb] text-base">{methodIcon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#00334f] truncate">{p.student}</p>
                        <p className="text-[10px] font-semibold text-[#64748b]">
                          {methodLabels[p.method] ?? p.method} · {p.date ? formatDate(p.date) : '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-[#00334f]">{formatTZS(p.amount)}</p>
                        <p className={`text-[10px] font-black uppercase ${statusColor}`}>{p.status}</p>
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Overdue Invoices */}
          <div className="rounded-xl border border-red-100 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h2 className="font-display text-base font-black text-[#00334f]">Overdue Invoices</h2>
                {overdue.length > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">{overdue.length}</span>
                )}
              </div>
              <NavLink to="/finance/reports/fee-defaulters" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-500 hover:underline">
                Defaulters <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>
            {topOverdue.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[#10b981]" />
                <p className="mt-2 text-sm font-black text-[#10b981]">No overdue invoices</p>
                <p className="text-xs font-semibold text-[#64748b]">All students are up to date.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#f1f5f9]">
                {topOverdue.map((inv) => {
                  const daysOverdue = inv.dueDate ? Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000) : 0;
                  return (
                    <NavLink key={inv.id} to={`/finance/invoices/${inv.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f7f9fb] transition">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-black text-red-600">
                        {inv.student.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-[#00334f] truncate">{inv.student}</p>
                        <p className="text-[10px] font-semibold text-[#64748b]">{inv.className} · {daysOverdue > 0 ? `${daysOverdue}d overdue` : 'Due today'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black text-red-600">{formatTZS(inv.outstanding)}</p>
                        <p className="text-[10px] font-semibold text-[#64748b]">outstanding</p>
                      </div>
                    </NavLink>
                  );
                })}
                {overdue.length > 5 && (
                  <NavLink to="/finance/reports/fee-defaulters" className="flex items-center justify-center gap-1.5 py-3 text-xs font-black text-red-500 hover:bg-red-50">
                    +{overdue.length - 5} more overdue students <ArrowRight className="h-3.5 w-3.5" />
                  </NavLink>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Fund requests + expense snapshot ── */}
        <div className="space-y-gutter">

          {/* Fund Requests needing FO action */}
          <div className="rounded-xl border border-[#d5dde6] bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#d5dde6] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#00334f]" />
                <h2 className="font-display text-base font-black text-[#00334f]">Fund Requests</h2>
                {foActionCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-black text-white">{foActionCount}</span>
                )}
              </div>
              <NavLink to="/finance/fund-requests" className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#d59a1b] hover:underline">
                All <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>

            {/* Pipeline summary */}
            <div className="grid grid-cols-3 divide-x divide-[#d5dde6] border-b border-[#d5dde6]">
              {[
                { label: 'To Forward', value: fundSummary?.pendingForward ?? 0, color: 'text-[#d59a1b]' },
                { label: 'At Principal', value: fundSummary?.pendingApproval ?? 0, color: 'text-blue-600' },
                { label: 'To Disburse', value: fundSummary?.approvedAwaitingDisbursement ?? 0, color: 'text-[#10b981]' },
              ].map((s) => (
                <div key={s.label} className="py-3 text-center">
                  <p className={`font-display text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#94a3b8]">{s.label}</p>
                </div>
              ))}
            </div>

            {foFundRequests.length === 0 ? (
              <div className="px-5 py-5 text-center text-sm font-semibold text-[#64748b]">No requests need FO action.</div>
            ) : (
              <div className="divide-y divide-[#f1f5f9]">
                {foFundRequests.map((f) => (
                  <NavLink key={f.id} to="/finance/fund-requests" className="flex items-center gap-3 px-4 py-3 hover:bg-[#f7f9fb] transition">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white ${f.status === 'APPROVED' ? 'bg-[#10b981]' : 'bg-[#d59a1b]'}`}>
                      {f.status === 'APPROVED' ? '✓' : '→'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-[#00334f] truncate">{f.title}</p>
                      <p className="text-[10px] font-semibold text-[#64748b]">{f.department} · {f.status === 'APPROVED' ? 'Disburse' : 'Forward to Principal'}</p>
                    </div>
                    <p className="shrink-0 text-xs font-black text-[#00334f]">{formatTZS(f.amount)}</p>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Expense Snapshot */}
          {(expenseSummary?.totalSpent ?? 0) > 0 && (
            <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#64748b]">Expenses this term</p>
                <NavLink to="/finance/expenses" className="text-[10px] font-black uppercase tracking-widest text-[#d59a1b] hover:underline">View</NavLink>
              </div>
              <p className="mt-1 font-display text-2xl font-black text-[#00334f]">{formatTZS(expenseSummary?.totalSpent ?? 0)}</p>
              <div className="mt-3 space-y-2">
                {(expenseSummary?.byCategory ?? []).slice(0, 4).map((c) => {
                  const maxCat = Math.max(...(expenseSummary?.byCategory ?? []).map((x) => x.total), 1);
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-semibold text-[#64748b] capitalize">{c.category.toLowerCase().replace(/_/g, ' ')}</span>
                        <span className="font-black text-[#00334f]">{formatTZS(c.total)}</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full rounded-full bg-[#f7f9fb]">
                        <div className="h-1.5 rounded-full bg-[#00334f]/40" style={{ width: `${(c.total / maxCat) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick nav links */}
          <div className="rounded-xl border border-[#d5dde6] bg-white p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#64748b]">Quick Links</p>
            <div className="space-y-1.5">
              {[
                { label: 'Invoice Ledger', to: '/finance/invoices', icon: FileText },
                { label: 'Receipts', to: '/finance/receipts', icon: ReceiptText },
                { label: 'Fee Defaulters Report', to: '/finance/reports/fee-defaulters', icon: AlertTriangle },
                { label: 'Export Centre', to: '/finance/exports', icon: Download },
                { label: 'Audit Log', to: '/finance/audit', icon: ShieldCheck },
              ].map(({ label, to, icon: Icon }) => (
                <NavLink key={to} to={to} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#00334f] hover:bg-[#f7f9fb] transition">
                  <Icon className="h-3.5 w-3.5 text-[#64748b]" />
                  {label}
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-[#94a3b8]" />
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Invoice pages ────────────────────────────────────────────────────────────

const INV_PAGE_SIZE = 20;
type InvStatusTab = 'ALL' | 'OVERDUE' | 'PARTIAL' | 'PAID' | 'VOID';

function InvoiceLedgerTable({ rows }: { rows: (typeof invoices) }) {
  return (
    <FinanceTable columns={['Invoice #', 'Student', 'Class', 'Term', 'Total', 'Paid', 'Outstanding', 'Status', 'Due Date', '']}>
      {rows.map((inv) => {
        const railColor =
          inv.status === 'PAID'    ? '#10b981' :
          inv.status === 'OVERDUE' ? '#e11d48' :
          inv.status === 'PARTIAL' ? '#d59a1b' :
          inv.status === 'VOID' || inv.status === 'CANCELLED' ? '#94a3b8' : '#64748b';
        return (
          <tr key={inv.id} className="group bg-white transition even:bg-[#f7f9fb] hover:bg-[#eef5f8]" style={{ borderLeft: `3px solid ${railColor}` }}>
            <Td>
              <NavLink className="font-black text-[#00334f] hover:underline" to={`/finance/invoices/${inv.id}`}>
                {inv.number}
              </NavLink>
            </Td>
            <Td>
              <NavLink className="font-black text-[#0f172a] hover:text-[#00334f] hover:underline" to={`/finance/students/${inv.studentId ?? inv.id}`}>
                {inv.student}
              </NavLink>
              <div className="text-[11px] text-[#64748b]">{inv.registration}</div>
            </Td>
            <Td>{inv.className}</Td>
            <Td>{inv.term}</Td>
            <Td amount><AmountDisplay amount={inv.total} /></Td>
            <Td amount><AmountDisplay amount={inv.paid} tone="paid" /></Td>
            <Td amount><AmountDisplay amount={inv.outstanding} tone={inv.status === 'OVERDUE' ? 'overdue' : 'outstanding'} /></Td>
            <Td><FinanceStatusBadge status={inv.status} /></Td>
            <Td>{formatDate(inv.dueDate)}</Td>
            <Td>
              <NavLink className="text-xs font-black text-[#00334f] opacity-0 transition group-hover:opacity-100 hover:underline" to={`/finance/invoices/${inv.id}`}>
                Inspect →
              </NavLink>
            </Td>
          </tr>
        );
      })}
    </FinanceTable>
  );
}

export function InvoiceListPage() {
  const { data: apiInvoices = [] as typeof invoices, isLoading, isError, refetch } = useInvoices() as unknown as { data: typeof invoices; isLoading: boolean; isError: boolean; refetch: () => void };
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<InvStatusTab>('ALL');
  const [classFilter, setClassFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const [page, setPage] = useState(0);

  const classes = useMemo(() => Array.from(new Set(apiInvoices.map((i) => i.className))).filter(Boolean).sort(), [apiInvoices]);
  const terms = useMemo(() => Array.from(new Set(apiInvoices.map((i) => i.term))).filter(Boolean).sort(), [apiInvoices]);

  const counts = useMemo(() => ({
    ALL:     apiInvoices.length,
    OVERDUE: apiInvoices.filter((i) => i.status === 'OVERDUE').length,
    PARTIAL: apiInvoices.filter((i) => i.status === 'PARTIAL').length,
    PAID:    apiInvoices.filter((i) => i.status === 'PAID').length,
    VOID:    apiInvoices.filter((i) => i.status === 'VOID' || i.status === 'CANCELLED').length,
  }), [apiInvoices]);

  const visible = useMemo(() => {
    let r = apiInvoices;
    if (statusTab !== 'ALL') r = r.filter((i) => i.status === statusTab || (statusTab === 'VOID' && i.status === 'CANCELLED'));
    if (classFilter) r = r.filter((i) => i.className === classFilter);
    if (termFilter) r = r.filter((i) => i.term === termFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((i) =>
        i.number.toLowerCase().includes(q) ||
        i.student.toLowerCase().includes(q) ||
        (i.registration ?? '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [apiInvoices, statusTab, classFilter, termFilter, search]);

  const totalPages = Math.ceil(visible.length / INV_PAGE_SIZE);
  const pageInvoices = visible.slice(page * INV_PAGE_SIZE, (page + 1) * INV_PAGE_SIZE);

  const totalAmount = visible.reduce((s, i) => s + i.total, 0);
  const totalPaid = visible.reduce((s, i) => s + i.paid, 0);
  const totalOutstanding = visible.reduce((s, i) => s + i.outstanding, 0);

  const INV_TABS: { key: InvStatusTab; label: string }[] = [
    { key: 'ALL',     label: 'All'     },
    { key: 'OVERDUE', label: 'Overdue' },
    { key: 'PARTIAL', label: 'Partial' },
    { key: 'PAID',    label: 'Paid'    },
    { key: 'VOID',    label: 'Void'    },
  ];

  return (
    <FinanceWorkspaceShell title="Invoice Ledger" eyebrow="Find, filter, inspect every invoice">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]} />

      <FinanceMetricStrip items={[
        { label: 'Total Invoiced', value: formatTZS(totalAmount), detail: `${visible.length} invoices`, tone: 'navy' },
        {
          label: 'Collected',
          value: formatTZS(totalPaid),
          detail: totalAmount > 0 ? `${Math.round((totalPaid / totalAmount) * 100)}% collection rate` : '—',
          tone: 'green',
          progress: totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0,
        },
        { label: 'Outstanding', value: formatTZS(totalOutstanding), detail: `${counts.OVERDUE} overdue`, tone: counts.OVERDUE > 0 ? 'red' : 'gold' },
        { label: 'Overdue', value: String(counts.OVERDUE), detail: 'require immediate action', tone: 'red' },
      ]} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search student name, invoice #, or registration…"
            className="h-10 w-full rounded-lg border border-[#d5dde6] bg-white pl-9 pr-4 text-sm font-semibold placeholder:text-[#94a3b8] outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
          />
        </div>
        <select value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setPage(0); }} className="h-10 rounded-lg border border-[#d5dde6] bg-white px-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#00334f]">
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={termFilter} onChange={(e) => { setTermFilter(e.target.value); setPage(0); }} className="h-10 rounded-lg border border-[#d5dde6] bg-white px-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#00334f]">
          <option value="">All Terms</option>
          {terms.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <NavLink
          to="/finance/invoices/generate"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#00334f] px-4 text-sm font-black text-white transition-colors hover:bg-[#001e30]"
        >
          <Plus className="h-4 w-4" /> Generate
        </NavLink>
      </div>

      <div className="flex gap-1 border-b border-[#d5dde6]">
        {INV_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setStatusTab(key); setPage(0); }}
            className={`relative px-4 py-2.5 text-sm font-black transition-colors ${statusTab === key ? 'text-[#00334f]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
          >
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${statusTab === key ? 'bg-[#00334f] text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {counts[key]}
            </span>
            {statusTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00334f]" />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable cols={9} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiInvoices.length ? (
        <EmptyState title="No invoices yet" description="Generate invoices for a term to begin tracking." action={{ label: 'Generate Invoices', href: '/finance/invoices/generate' }} />
      ) : !visible.length ? (
        <EmptyState title="No matching invoices" description="Try adjusting your search or filters." />
      ) : (
        <>
          <InvoiceLedgerTable rows={pageInvoices} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-[#64748b]">
                Showing {page * INV_PAGE_SIZE + 1}–{Math.min((page + 1) * INV_PAGE_SIZE, visible.length)} of {visible.length} invoices
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#d5dde6] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 w-8 rounded border text-xs font-black transition ${page === p ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#d5dde6] text-[#64748b] hover:bg-[#f1f5f9]'}`}
                    >
                      {p + 1}
                    </button>
                  );
                })}
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded border border-[#d5dde6] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </FinanceWorkspaceShell>
  );
}

export function GenerateInvoicesPage() {
  const navigate = useNavigate();
  const generateMutation = useGenerateInvoicesMutation();
  const [form, setForm] = useState({ term: '', academicYear: new Date().getFullYear().toString(), dueDate: '', scope: 'ALL' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.term || !form.dueDate) { toast('Term and due date are required', 'error'); return; }
    generateMutation.mutate({ term: form.term, academicYear: form.academicYear, dueDate: form.dueDate, scope: form.scope }, {
      onSuccess: () => { toast('Invoice generation started. Invoices will appear shortly.', 'success'); navigate('/finance/invoices'); },
      onError: () => toast('Failed to start invoice generation. Please try again.', 'error'),
    });
  };

  return (
    <FinanceWorkspaceShell title="Generate Invoices" eyebrow="Bulk invoice job">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }, { label: 'Generate' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex items-center gap-3 border-b border-[#d5dde6] pb-4">
            <FileSpreadsheet className="h-5 w-5 text-[#00334f]" />
            <div>
              <h2 className="font-display text-xl font-black text-[#00334f]">Generate Term Invoices</h2>
              <p className="text-sm font-semibold text-[#64748b]">Creates invoices for all eligible enrolled students based on their fee structure.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Term *</span>
              <input required value={form.term} onChange={set('term')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" placeholder="e.g. Term II 2026" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Academic Year</span>
              <input value={form.academicYear} onChange={set('academicYear')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" placeholder="e.g. 2026" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Due Date *</span>
              <input required type="date" value={form.dueDate} onChange={set('dueDate')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Scope</span>
              <select value={form.scope} onChange={set('scope')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]">
                <option value="ALL">All students</option>
                <option value="UNPAID_ONLY">Skip already invoiced</option>
              </select>
            </label>
          </div>
          <div className="mt-5 rounded border border-[#d59a1b]/30 bg-[#d59a1b]/5 p-3 text-xs font-bold text-[#7a5200]">
            This will generate invoices for all enrolled students who do not already have one for this term. The action is audited.
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={generateMutation.isPending}>
              <Send className="h-4 w-4" /> {generateMutation.isPending ? 'Generating…' : 'Generate Invoices'}
            </Button>
            <Button type="button" variant="secondary" className="rounded" onClick={() => navigate('/finance/invoices')}>Cancel</Button>
          </div>
        </form>
        <SideSummary title="Generation Preview" items={[
          ['Term', form.term || '—'],
          ['Due date', form.dueDate || '—'],
          ['Scope', form.scope === 'ALL' ? 'All students' : 'New invoices only'],
          ['Audit', 'Full trail captured'],
        ]} />
      </div>
    </FinanceWorkspaceShell>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const { data: apiInvoice, isLoading } = useInvoiceById(id ?? '') as unknown as { data: (typeof invoices)[number] | undefined; isLoading: boolean; isError: boolean };
  const { data: allPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  const cancelMutation   = useCancelInvoiceMutation();
  const discountMutation = useApplyInvoiceDiscountMutation();
  const waiveMutation    = useWaiveInvoiceMutation();
  const navigate = useNavigate();

  type ActiveAction = 'discount' | 'waive' | 'cancel' | null;
  const [activeAction, setActiveAction]   = useState<ActiveAction>(null);
  const [discountForm, setDiscountForm]   = useState({ amount: '', reason: '' });
  const [waiveForm, setWaiveForm]         = useState({ reason: '' });
  const [cancelForm, setCancelForm]       = useState({ reason: '' });
  const [pdfLoading, setPdfLoading]       = useState(false);

  if (isLoading) return <FinanceWorkspaceShell title="Loading…" eyebrow="Invoice detail"><SkeletonTable cols={3} /></FinanceWorkspaceShell>;
  if (!apiInvoice) return <FinanceWorkspaceShell title="Not Found" eyebrow="Invoice detail"><EmptyState title="Invoice not found" description="This invoice does not exist or has been cancelled." /></FinanceWorkspaceShell>;

  const invoice = apiInvoice;
  const embeddedPayments = Array.isArray((invoice as any).payments) ? (invoice as any).payments : [];
  const invoicePayments = embeddedPayments.length > 0
    ? embeddedPayments
    : allPayments.filter((p) => p.invoiceId === invoice.id || p.invoiceNumber === invoice.number);
  const hasConfirmedPayment = invoicePayments.some((p) => String(p.status).toUpperCase() === 'CONFIRMED');
  const isPending = cancelMutation.isPending || discountMutation.isPending || waiveMutation.isPending || pdfLoading;
  const discountPreviewBalance = invoice.outstanding - (Number(discountForm.amount) || 0);

  const handleDownloadPdf = async () => {
    if (pdfLoading) return;
    setPdfLoading(true);
    await downloadInvoicePdf(invoice, toast);
    setPdfLoading(false);
  };

  const handleDiscount = () => {
    const amt = Number(discountForm.amount);
    if (!amt || amt <= 0) { toast('Enter a valid discount amount', 'error'); return; }
    if (amt > invoice.outstanding) { toast('Discount cannot exceed the outstanding balance', 'error'); return; }
    if (!discountForm.reason.trim()) { toast('A reason is required', 'error'); return; }
    discountMutation.mutate(
      { id: invoice.id, body: { discountAmount: String(amt), discountReason: discountForm.reason } },
      {
        onSuccess: () => { toast('Discount applied', 'success'); setActiveAction(null); setDiscountForm({ amount: '', reason: '' }); },
        onError: () => toast('Failed to apply discount', 'error'),
      },
    );
  };

  const handleWaive = () => {
    if (!waiveForm.reason.trim()) { toast('A reason is required', 'error'); return; }
    waiveMutation.mutate(
      { id: invoice.id, body: { waiverReason: waiveForm.reason } },
      {
        onSuccess: () => { toast('Balance waived', 'warning'); setActiveAction(null); setWaiveForm({ reason: '' }); },
        onError: () => toast('Failed to waive balance', 'error'),
      },
    );
  };

  const handleCancel = () => {
    if (hasConfirmedPayment) { toast('Invoices with confirmed payments cannot be cancelled. Use waive or discount instead.', 'warning'); return; }
    if (!cancelForm.reason.trim()) { toast('A cancellation reason is required', 'error'); return; }
    cancelMutation.mutate(
      { id: invoice.id, body: { cancellationReason: cancelForm.reason } },
      {
        onSuccess: () => { toast('Invoice cancelled', 'warning'); navigate('/finance/invoices'); },
        onError: () => toast('Failed to cancel invoice', 'error'),
      },
    );
  };

  return (
    <FinanceWorkspaceShell title={invoice.number} eyebrow="Invoice detail">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }, { label: invoice.number }]} />

      {/* Student identity card */}
      <NavLink
        to={`/finance/students/${invoice.studentId ?? invoice.id}`}
        className="flex items-center gap-4 rounded-lg border border-[#d5dde6] bg-white p-4 transition hover:border-[#00334f] hover:shadow-sm"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00334f]/10">
          <GraduationCap className="h-6 w-6 text-[#00334f]" />
        </div>
        <div className="flex-1">
          <p className="font-display text-lg font-black text-[#00334f]">{invoice.student}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs font-semibold text-[#64748b]">
            {invoice.registration && <span>Reg: {invoice.registration}</span>}
            {invoice.className && <span>Class: {invoice.className}</span>}
            {invoice.term && <span>Term: {invoice.term}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs font-black text-[#00334f]">
          View Ledger <ChevronRight className="h-4 w-4" />
        </div>
      </NavLink>

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            { label: 'Invoice Total', value: formatTZS(invoice.total), detail: invoice.term, tone: 'navy' },
            {
              label: 'Paid',
              value: formatTZS(invoice.paid),
              detail: invoice.lastPayment && invoice.lastPayment !== 'None' ? `Last: ${formatDate(invoice.lastPayment)}` : 'No payments yet',
              tone: 'green',
              trend: invoice.paid > 0 ? 'up' : undefined,
              progress: invoice.total > 0 ? Math.round((invoice.paid / invoice.total) * 100) : 0,
            },
            {
              label: 'Outstanding',
              value: formatTZS(invoice.outstanding),
              detail: `Due ${formatDate(invoice.dueDate)}`,
              tone: invoice.status === 'OVERDUE' ? 'red' : 'gold',
              trend: invoice.status === 'OVERDUE' ? 'down' : undefined,
            },
            { label: 'Status', value: invoice.status, detail: formatDate(invoice.dueDate), tone: 'slate' },
          ]} />

          {/* Inline action forms */}
          {activeAction === 'discount' && (
            <div className="rounded-lg border border-[#d59a1b]/40 bg-[#d59a1b]/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-black text-[#7a5200]">Apply Discount</h3>
                <button onClick={() => setActiveAction(null)} className="text-[#64748b] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Discount Amount (TZS) *</span>
                  <input
                    type="number"
                    min="0"
                    max={invoice.outstanding}
                    value={discountForm.amount}
                    onChange={(e) => setDiscountForm((p) => ({ ...p, amount: e.target.value }))}
                    className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
                    placeholder="e.g. 50000"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Reason *</span>
                  <input
                    value={discountForm.reason}
                    onChange={(e) => setDiscountForm((p) => ({ ...p, reason: e.target.value }))}
                    className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
                    placeholder="e.g. Scholarship, hardship"
                  />
                </label>
              </div>
              {discountForm.amount && Number(discountForm.amount) > 0 && (
                <div className="mt-3 rounded border border-[#d59a1b]/30 bg-white p-3 text-sm">
                  <span className="font-semibold text-[#64748b]">New balance after discount: </span>
                  <span className={`font-black ${discountPreviewBalance <= 0 ? 'text-[#10b981]' : 'text-[#d59a1b]'}`}>
                    {formatTZS(Math.max(0, discountPreviewBalance))}
                  </span>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button onClick={handleDiscount} disabled={isPending} className="rounded bg-[#d59a1b] text-white hover:bg-[#b57f10] hover:shadow-none">
                  {isPending ? 'Applying…' : 'Apply Discount'}
                </Button>
                <Button variant="secondary" className="rounded" onClick={() => setActiveAction(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {activeAction === 'waive' && (
            <div className="rounded-lg border border-[#7c3aed]/30 bg-[#7c3aed]/5 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-base font-black text-[#5b21b6]">Waive Outstanding Balance</h3>
                <button onClick={() => setActiveAction(null)} className="text-[#64748b] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
              </div>
              <div className="mb-3 rounded border border-[#7c3aed]/20 bg-white p-3 text-sm">
                <span className="font-semibold text-[#64748b]">Balance to be waived: </span>
                <span className="font-black text-[#7c3aed]">{formatTZS(invoice.outstanding)}</span>
                <span className="ml-2 text-xs text-[#64748b]">— invoice will be marked PAID</span>
              </div>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Reason *</span>
                <input
                  value={waiveForm.reason}
                  onChange={(e) => setWaiveForm({ reason: e.target.value })}
                  className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
                  placeholder="e.g. Board approved waiver, full scholarship"
                />
              </label>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleWaive} disabled={isPending} className="rounded bg-[#7c3aed] text-white hover:bg-[#5b21b6] hover:shadow-none">
                  {isPending ? 'Waiving…' : 'Confirm Waive'}
                </Button>
                <Button variant="secondary" className="rounded" onClick={() => setActiveAction(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {activeAction === 'cancel' && (
            <div className="rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-black text-[#9f0f2c]">Cancel Invoice</h3>
                <button onClick={() => setActiveAction(null)} className="text-[#64748b] hover:text-[#0f172a]"><X className="h-4 w-4" /></button>
              </div>
              <p className="mb-1 text-sm font-semibold text-[#64748b]">
                You are about to cancel invoice <span className="font-black text-[#0f172a]">{invoice.number}</span> for{' '}
                <span className="font-black text-[#0f172a]">{invoice.student}</span>.
              </p>
              <p className="mb-4 text-xs font-bold text-[#e11d48]">This action is permanent and cannot be undone. Any existing payments will remain in the ledger.</p>
              {hasConfirmedPayment && (
                <div className="mb-4 rounded border border-[#e11d48]/20 bg-white p-3 text-sm font-semibold text-[#9f0f2c]">
                  This invoice has confirmed payments, so it cannot be cancelled. Use a discount or waiver if the remaining balance must be cleared.
                </div>
              )}
              <label className="mb-4 block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Cancellation Reason *</span>
                <input
                  value={cancelForm.reason}
                  onChange={(e) => setCancelForm({ reason: e.target.value })}
                  disabled={hasConfirmedPayment}
                  className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10 disabled:bg-[#f1f5f9]"
                  placeholder="e.g. Duplicate invoice, wrong billing term"
                />
              </label>
              <div className="flex gap-2">
                <Button onClick={handleCancel} disabled={isPending || hasConfirmedPayment} className="rounded bg-[#e11d48] text-white hover:bg-[#9f0f2c] hover:shadow-none">
                  {isPending ? 'Cancelling…' : 'Yes, Cancel Invoice'}
                </Button>
                <Button variant="secondary" className="rounded" onClick={() => setActiveAction(null)}>Keep Invoice</Button>
              </div>
            </div>
          )}

          <FinanceTable columns={['Category', 'Mandatory', 'Amount']} minWidth={640}>
            {invoice.lineItems.map((item) => (
              <tr key={item.category} className="even:bg-[#f7f9fb]">
                <Td>{item.category}</Td>
                <Td>
                  <Badge tone={item.mandatory ? 'emerald' : 'amber'}>
                    {item.mandatory ? 'mandatory' : 'optional'}
                  </Badge>
                </Td>
                <Td amount><AmountDisplay amount={item.amount} /></Td>
              </tr>
            ))}
          </FinanceTable>
          <PaymentTable rows={invoicePayments} />
        </div>

        <InvoiceActionPanel
          invoice={invoice}
          onRecordPayment={() => navigate(`/finance/payments/cash?invoiceId=${invoice.id}`)}
          onDownloadPdf={handleDownloadPdf}
          onRegenPdf={handleDownloadPdf}
          onDiscount={() => { setActiveAction((a) => a === 'discount' ? null : 'discount'); }}
          onWaive={() => { setActiveAction((a) => a === 'waive' ? null : 'waive'); }}
          onCancel={() => { setActiveAction((a) => a === 'cancel' ? null : 'cancel'); }}
          canCancel={!hasConfirmedPayment}
          isPending={isPending}
        />
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Student Ledger ───────────────────────────────────────────────────────────

export function StudentLedgerPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { data: studentInvoices = [] as typeof invoices, isLoading } = useStudentInvoices(studentId ?? '') as unknown as { data: typeof invoices; isLoading: boolean };
  const { data: allPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  const { data: allReceipts = [] as typeof receipts } = useReceipts() as unknown as { data: typeof receipts };
  const { data: statementData } = useStudentStatement(studentId ?? '') as unknown as { data?: { url?: string } };
  const navigate = useNavigate();
  const generateStatement = useGenerateReportMutation();

  type LedgerTab = 'invoices' | 'payments' | 'receipts';
  const [activeTab, setActiveTab] = useState<LedgerTab>('invoices');
  const [copiedId, setCopiedId] = useState(false);

  const studentInfo = studentInvoices[0] as (typeof invoices)[number] | undefined;
  const invoiceIds = useMemo(() => new Set(studentInvoices.map((i) => i.id)), [studentInvoices]);
  const studentPayments = useMemo(
    () => allPayments.filter((p) => p.invoiceId && invoiceIds.has(p.invoiceId)),
    [allPayments, invoiceIds],
  );
  const studentReceipts = useMemo(
    () => allReceipts.filter((r) => {
      const receiptPaymentId = (r as unknown as Record<string, string>).paymentId;
      return studentPayments.some((p) => p.id === receiptPaymentId || p.receiptId === r.id);
    }),
    [allReceipts, studentPayments],
  );

  const totalInvoiced  = studentInvoices.reduce((s, i) => s + i.total, 0);
  const totalPaid      = studentInvoices.reduce((s, i) => s + i.paid, 0);
  const balanceDue     = studentInvoices.reduce((s, i) => s + i.outstanding, 0);
  const lastPaymentDate = studentPayments
    .map((p) => p.date)
    .filter(Boolean)
    .sort()
    .at(-1);

  const copyId = () => {
    if (!studentId) return;
    void navigator.clipboard.writeText(studentId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    });
  };

  const handleDownloadStatement = () => {
    if (statementData?.url) {
      window.open(statementData.url, '_blank');
    } else {
      generateStatement.mutate(
        { reportType: 'STUDENT_STATEMENT', params: { studentId: studentId ?? '' } },
        {
          onSuccess: (job) => downloadReportWhenReady(job),
          onError: () => toast('Failed to generate statement', 'error'),
        },
      );
    }
  };

  const LEDGER_TABS: { key: LedgerTab; label: string; count: number }[] = [
    { key: 'invoices',  label: 'Invoices',  count: studentInvoices.length  },
    { key: 'payments',  label: 'Payments',  count: studentPayments.length  },
    { key: 'receipts',  label: 'Receipts',  count: studentReceipts.length  },
  ];

  if (isLoading) {
    return (
      <FinanceWorkspaceShell title="Student Ledger" eyebrow="Loading…">
        <SkeletonCards count={3} />
        <SkeletonTable cols={6} />
      </FinanceWorkspaceShell>
    );
  }

  return (
    <FinanceWorkspaceShell
      title={studentInfo?.student ?? 'Student Ledger'}
      eyebrow="Full financial history"
    >
      <FinanceBreadcrumb crumbs={[
        { label: 'Finance', to: '/finance' },
        { label: 'Invoices', to: '/finance/invoices' },
        { label: studentInfo?.student ?? studentId ?? '…' },
      ]} />

      {/* Student identity + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[#d5dde6] bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00334f]/10">
            <GraduationCap className="h-7 w-7 text-[#00334f]" />
          </div>
          <div>
            <h2 className="font-display text-xl font-black text-[#00334f]">{studentInfo?.student ?? '—'}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-[#64748b]">
              {studentInfo?.registration && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" /> {studentInfo.registration}
                </span>
              )}
              {studentInfo?.className && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" /> {studentInfo.className}
                </span>
              )}
              {studentId && (
                <button
                  onClick={copyId}
                  className="flex items-center gap-1 text-[#94a3b8] transition hover:text-[#00334f]"
                >
                  {copiedId ? <Check className="h-3 w-3 text-[#10b981]" /> : <Copy className="h-3 w-3" />}
                  {copiedId ? 'Copied!' : `ID: ${studentId.slice(0, 8)}…`}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            className="rounded"
            onClick={() => navigate(`/finance/payments/cash?studentId=${studentId ?? ''}`)}
          >
            <CreditCard className="h-4 w-4" /> Record Payment
          </Button>
          <Button
            className="rounded bg-[#00334f] text-white hover:bg-[#001e30] hover:shadow-none"
            onClick={handleDownloadStatement}
            disabled={generateStatement.isPending}
          >
            <Download className="h-4 w-4" />
            {generateStatement.isPending ? 'Generating…' : 'Download Statement'}
          </Button>
        </div>
      </div>

      <FinanceMetricStrip items={[
        { label: 'Total Invoiced', value: formatTZS(totalInvoiced), detail: `${studentInvoices.length} invoices`, tone: 'navy' },
        {
          label: 'Total Paid',
          value: formatTZS(totalPaid),
          detail: totalInvoiced > 0 ? `${Math.round((totalPaid / totalInvoiced) * 100)}% settled` : '—',
          tone: 'green',
          progress: totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0,
        },
        { label: 'Balance Due', value: formatTZS(balanceDue), detail: balanceDue > 0 ? 'outstanding' : 'all clear', tone: balanceDue > 0 ? 'red' : 'green' },
        { label: 'Last Payment', value: lastPaymentDate ? formatDate(lastPaymentDate) : '—', detail: lastPaymentDate ? `${studentPayments.length} payments total` : 'No payments yet', tone: 'slate' },
      ]} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#d5dde6]">
        {LEDGER_TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`relative px-4 py-2.5 text-sm font-black transition-colors ${activeTab === key ? 'text-[#00334f]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
          >
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === key ? 'bg-[#00334f] text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {count}
            </span>
            {activeTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00334f]" />}
          </button>
        ))}
      </div>

      {activeTab === 'invoices' && (
        !studentInvoices.length ? (
          <EmptyState title="No invoices" description="No invoices have been generated for this student yet." />
        ) : (
          <InvoiceLedgerTable rows={studentInvoices} />
        )
      )}
      {activeTab === 'payments' && (
        !studentPayments.length ? (
          <EmptyState title="No payments" description="No payments have been recorded for this student." />
        ) : (
          <PaymentTable rows={studentPayments} />
        )
      )}
      {activeTab === 'receipts' && (
        !studentReceipts.length ? (
          <EmptyState title="No receipts" description="Receipts will appear here once payments are approved." />
        ) : (
          <ReceiptList rows={studentReceipts} />
        )
      )}
    </FinanceWorkspaceShell>
  );
}

// ─── Payment pages ────────────────────────────────────────────────────────────

export function RecordCashPaymentPage() {
  return (
    <FinanceWorkspaceShell title="Record Cash Payment" eyebrow="Cash desk · real-time balance preview">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Record Cash' }]} />
      <SmartPaymentForm method="cash" />
    </FinanceWorkspaceShell>
  );
}

export function RecordBankTransferPage() {
  return (
    <FinanceWorkspaceShell title="Record Bank Transfer" eyebrow="Statement-safe · duplicate detection">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Record Bank Transfer' }]} />
      <SmartPaymentForm method="bank" />
    </FinanceWorkspaceShell>
  );
}

// ─── Smart Payment Form (Cash + Bank) ─────────────────────────────────────────

function PmtSummaryLine({ label, value, good, danger }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-bold text-[#64748b]">{label}</span>
      <span className={`font-mono font-black tabular-nums ${good ? 'text-[#10b981]' : danger ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>{value}</span>
    </div>
  );
}

function PmtWarning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 px-3 py-2.5 text-xs font-black text-[#e11d48]">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {text}
    </div>
  );
}

function BalancePreviewPanel({ invoice, amount }: { invoice: (typeof invoices)[number]; amount: number }) {
  const newBalance = invoice.outstanding - amount;
  const isOver   = amount > 0 && amount > invoice.outstanding;
  const isClear  = amount > 0 && amount >= invoice.outstanding;
  const isPartial = amount > 0 && amount < invoice.outstanding;

  const statusBg    = isOver ? 'bg-[#7c3aed]/10 text-[#5b21b6]' : isClear ? 'bg-[#10b981]/10 text-[#047857]' : 'bg-[#d59a1b]/10 text-[#7a5200]';
  const newBalColor = isOver || isClear ? '#10b981' : '#d59a1b';

  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Balance Preview</p>
        <h3 className="mt-0.5 font-display text-xl font-black text-[#00334f]">{invoice.number}</h3>
        <p className="text-xs font-bold text-[#64748b]">{invoice.student} · {invoice.className}</p>
      </div>
      <div className="space-y-3 p-5">
        <PmtSummaryLine label="Invoice total"  value={formatTZS(invoice.total)} />
        <PmtSummaryLine label="Already paid"   value={formatTZS(invoice.paid)}        good />
        <PmtSummaryLine label="Outstanding"    value={formatTZS(invoice.outstanding)} danger />
        <div className="border-t border-[#e2e8f0] pt-3 space-y-3">
          <PmtSummaryLine label="This payment" value={amount > 0 ? formatTZS(amount) : '—'} />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-[#64748b]">New balance</span>
            <span className="font-mono font-black tabular-nums" style={{ color: amount > 0 ? newBalColor : '#94a3b8' }}>
              {amount > 0 ? formatTZS(Math.max(0, newBalance)) : '—'}
            </span>
          </div>
        </div>
        {amount > 0 && (
          <div className={`mt-1 rounded-lg p-3 text-xs font-bold ${statusBg}`}>
            {isOver    && `Overpayment of ${formatTZS(amount - invoice.outstanding)} — excess held as student credit`}
            {isClear   && !isOver && 'This payment will clear the invoice in full ✓'}
            {isPartial && `Partial payment — ${formatTZS(newBalance)} will remain outstanding`}
          </div>
        )}
        {/* Progress bar */}
        {invoice.total > 0 && (
          <div className="mt-1">
            <div className="flex justify-between text-[10px] font-black text-[#64748b] mb-1">
              <span>Collection progress</span>
              <span>{Math.min(100, Math.round(((invoice.paid + (amount > 0 ? amount : 0)) / invoice.total) * 100))}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#e2e8f0] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#10b981] transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round(((invoice.paid + (amount > 0 ? amount : 0)) / invoice.total) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SmartPaymentForm({ method }: { method: 'cash' | 'bank' }) {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionUser = useAuthStore((s) => (s.session as unknown as { user?: { name?: string } } | null)?.user?.name ?? 'Finance Officer');

  const cashMutation = useCashPaymentMutation();
  const bankMutation = useBankTransferMutation();
  const uploadMutation = useFileUploadMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preInvoiceId = searchParams.get('invoiceId');
  const preStudentId = searchParams.get('studentId');

  const [search, setSearch]                 = useState('');
  const [searchOpen, setSearchOpen]         = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<(typeof invoices)[number] | null>(null);
  const [amountText, setAmountText]         = useState('');
  const [paymentDate, setPaymentDate]       = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes]                   = useState('');
  const [reference, setReference]           = useState('');
  const [bankName, setBankName]             = useState('');
  const [evidenceFile, setEvidenceFile]     = useState<UploadedFile | null>(null);
  const [uploadError, setUploadError]       = useState('');
  const [overpayConfirmed, setOverpayConfirmed] = useState(false);

  // Auto-select invoice from URL params once invoices load
  useEffect(() => {
    if (!apiInvoices.length) return;
    if (preInvoiceId) {
      const inv = apiInvoices.find((i) => i.id === preInvoiceId);
      if (inv) pickInvoice(inv);
    } else if (preStudentId) {
      const inv = apiInvoices
        .filter((i) => i.studentId === preStudentId && i.outstanding > 0)
        .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];
      if (inv) pickInvoice(inv);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiInvoices.length, preInvoiceId, preStudentId]);

  const pickInvoice = (inv: (typeof invoices)[number]) => {
    setSelectedInvoice(inv);
    setSearch('');
    setSearchOpen(false);
    setAmountText(String(inv.outstanding));
    setOverpayConfirmed(false);
  };

  const amount             = parseTZSInput(amountText);
  const outstanding        = selectedInvoice?.outstanding ?? 0;
  const overpay            = isOverpayment(amount, outstanding);
  const missingReference   = method === 'bank' && !reference.trim();
  const duplicateRef       = method === 'bank' && duplicateReferenceWarning(reference, apiPayments.map((p) => p.reference ?? ''));
  const canSubmit          = !!selectedInvoice && amount > 0 && !missingReference && (!overpay || overpayConfirmed);
  const isPending          = cashMutation.isPending || bankMutation.isPending;

  const searchResults = useMemo(() => {
    if (search.trim().length < 2) return [] as typeof invoices;
    const q = search.toLowerCase();
    return apiInvoices.filter((i) =>
      i.outstanding > 0 &&
      (i.student.toLowerCase().includes(q) ||
       i.number.toLowerCase().includes(q) ||
       (i.registration ?? '').toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [apiInvoices, search]);

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError('');
    uploadMutation.mutate(file, {
      onSuccess: (result) => setEvidenceFile((result as unknown as { file: UploadedFile }).file),
      onError: (err) => setUploadError(err instanceof Error ? err.message : 'Upload failed'),
    });
  };

  const handleSubmit = () => {
    if (!selectedInvoice || !canSubmit) return;
    const body: Record<string, unknown> = {
      invoiceId: selectedInvoice.id,
      amount: String(amount),
      payerName: selectedInvoice.student || 'Payer',
      paidAt: paymentDate,
      notes: notes.trim() || undefined,
    };
    if (method === 'bank') {
      body.referenceNumber = reference.trim();
      const bankNote = bankName.trim() ? `Bank: ${bankName.trim()}` : '';
      body.notes = [body.notes, bankNote].filter(Boolean).join('\n') || undefined;
      if (evidenceFile) body.supportingDocumentUrl = evidenceFile.url;
    }
    const mutate = method === 'cash' ? cashMutation : bankMutation;
    mutate.mutate(body, {
      onSuccess: () => {
        toast(`${method === 'cash' ? 'Cash payment' : 'Bank transfer'} submitted for approval`, 'success');
        navigate('/finance/payments');
      },
      onError: () => toast('Failed to submit payment. Please try again.', 'error'),
    });
  };

  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── Left: form steps ── */}
      <div className="space-y-gutter">

        {/* Step 1 — Student / Invoice search */}
        <div className="rounded-lg border border-[#d5dde6] bg-white">
          <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Step 1 — Identify payer</p>
            <h3 className="mt-0.5 font-display text-base font-black text-[#00334f]">Search by student name, registration, or invoice number</h3>
          </div>
          <div className="p-5">
            {selectedInvoice ? (
              <div className="flex items-start justify-between gap-4 rounded-lg border border-[#10b981]/40 bg-[#10b981]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#10b981]/15">
                    <GraduationCap className="h-5 w-5 text-[#10b981]" />
                  </div>
                  <div>
                    <p className="font-display font-black text-[#0f172a]">{selectedInvoice.student}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] font-semibold text-[#64748b]">
                      <span>{selectedInvoice.number}</span>
                      {selectedInvoice.registration && <span>Reg: {selectedInvoice.registration}</span>}
                      {selectedInvoice.className && <span>{selectedInvoice.className}</span>}
                      {selectedInvoice.term && <span>{selectedInvoice.term}</span>}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedInvoice(null); setAmountText(''); }}
                  className="shrink-0 text-xs font-black text-[#64748b] transition-colors hover:text-[#e11d48]"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#64748b]" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
                  placeholder="Type student name, registration, or invoice #…"
                  className="h-12 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] pl-10 pr-4 text-sm font-semibold placeholder:text-[#94a3b8] outline-none focus:border-[#00334f] focus:bg-white focus:ring-2 focus:ring-[#00334f]/10"
                />
                {searchOpen && searchResults.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[#d5dde6] bg-white shadow-xl">
                    {searchResults.map((inv) => (
                      <button
                        key={inv.id}
                        onMouseDown={() => pickInvoice(inv)}
                        className="flex w-full items-center justify-between border-b border-[#f1f5f9] px-4 py-3 text-left transition-colors last:border-0 hover:bg-[#eef5f8]"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#0f172a]">{inv.student}</p>
                          <p className="text-[11px] font-semibold text-[#64748b]">{inv.number} · {inv.className} · {inv.term}</p>
                        </div>
                        <div className="ml-4 shrink-0 text-right">
                          <p className="font-mono font-black text-[#e11d48]">{formatTZS(inv.outstanding)}</p>
                          <p className="text-[10px] font-semibold text-[#64748b]">outstanding</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchOpen && search.trim().length >= 2 && searchResults.length === 0 && (
                  <div className="absolute z-30 mt-1 w-full rounded-lg border border-[#d5dde6] bg-white p-4 shadow-xl">
                    <p className="text-sm font-semibold text-[#64748b]">No invoices with outstanding balance found for "{search}"</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2 — Payment details (visible once invoice is selected) */}
        {selectedInvoice && (
          <div className="rounded-lg border border-[#d5dde6] bg-white">
            <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Step 2 — Payment details</p>
              <h3 className="mt-0.5 font-display text-base font-black text-[#00334f]">
                {method === 'cash' ? 'Cash desk entry' : 'Bank transfer details'}
              </h3>
            </div>
            <div className="p-5">
              <div className="grid gap-4 md:grid-cols-2">

                {/* Amount — full-width, large, auto-focused */}
                <div className="md:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Amount (TZS) *</span>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[#94a3b8]">TZS</span>
                    <input
                      autoFocus
                      value={amountText}
                      onChange={(e) => { setAmountText(e.target.value); setOverpayConfirmed(false); }}
                      className="h-14 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] pl-14 pr-36 font-mono text-xl font-black tabular-nums outline-none focus:border-[#00334f] focus:bg-white focus:ring-2 focus:ring-[#00334f]/10"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => setAmountText(String(selectedInvoice.outstanding))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[#00334f]/10 px-2 py-1 text-[10px] font-black text-[#00334f] transition hover:bg-[#00334f]/20"
                    >
                      Full balance ({formatTZS(selectedInvoice.outstanding)})
                    </button>
                  </div>
                </div>

                {/* Payment date */}
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Payment Date *</span>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:bg-white focus:ring-2 focus:ring-[#00334f]/10"
                  />
                </label>

                {method === 'cash' ? (
                  <label className="block">
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Received By</span>
                    <input
                      readOnly
                      value={sessionUser}
                      className="mt-2 h-11 w-full rounded-lg border border-[#d5dde6] bg-[#f1f5f9] px-3 font-semibold text-[#64748b] outline-none"
                    />
                  </label>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Bank Reference # *</span>
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 font-mono font-black outline-none focus:border-[#00334f] focus:bg-white focus:ring-2 focus:ring-[#00334f]/10"
                        placeholder="e.g. CRDB-20260601-XXXXX"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Bank Name</span>
                      <input
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="mt-2 h-11 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:bg-white focus:ring-2 focus:ring-[#00334f]/10"
                        placeholder="e.g. CRDB Bank, NMB, Stanbic"
                      />
                    </label>
                    {/* Bank slip upload */}
                    <div className="md:col-span-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Bank Slip / Evidence</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={handleEvidenceChange}
                      />
                      {evidenceFile ? (
                        <div className="mt-2 flex items-center gap-3 rounded-lg border border-[#10b981]/30 bg-[#10b981]/5 px-4 py-3">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10b981]" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-[#0f172a]">{(evidenceFile as unknown as Record<string, string>).originalName}</p>
                            <p className="text-[10px] font-semibold text-[#64748b]">{(((evidenceFile as unknown as Record<string, number>).sizeBytes ?? 0) / 1024).toFixed(0)} KB · uploaded</p>
                          </div>
                          <button type="button" onClick={() => setEvidenceFile(null)} className="shrink-0 text-xs font-black text-[#e11d48] hover:underline">Remove</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadMutation.isPending}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#d5dde6] bg-[#f7f9fb] py-4 text-xs font-black text-[#64748b] transition hover:border-[#00334f] hover:text-[#00334f] disabled:opacity-50"
                        >
                          <TrendingUp className="h-4 w-4" />
                          {uploadMutation.isPending ? 'Uploading…' : 'Upload bank slip (JPEG, PNG, PDF · max 5 MB)'}
                        </button>
                      )}
                      {uploadError && <p className="mt-1.5 text-[11px] font-black text-[#e11d48]">{uploadError}</p>}
                    </div>
                  </>
                )}

                {/* Notes */}
                <div className="md:col-span-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Notes (optional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="mt-2 w-full resize-none rounded-lg border border-[#d5dde6] bg-[#f7f9fb] p-3 text-sm font-semibold text-[#334155] outline-none focus:border-[#00334f] focus:bg-white"
                    placeholder="Any additional notes about this payment…"
                  />
                </div>
              </div>

              {/* Validation warnings */}
              <div className="mt-4 space-y-2">
                {overpay         && <PmtWarning text={`Amount exceeds outstanding balance by ${formatTZS(amount - outstanding)}. Confirm below to proceed.`} />}
                {missingReference && <PmtWarning text="Bank reference number is required before submission." />}
                {duplicateRef    && <PmtWarning text="This reference has already been recorded — verify the bank statement before submitting." />}
              </div>

              {overpay && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-[#00334f]">
                  <input type="checkbox" checked={overpayConfirmed} onChange={(e) => setOverpayConfirmed(e.target.checked)} className="h-4 w-4 accent-[#00334f]" />
                  I confirm this overpayment — excess will be held as student credit.
                </label>
              )}

              <div className="mt-5 flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isPending}
                  className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isPending ? 'Submitting…' : 'Submit for Approval'}
                </Button>
                <Button variant="secondary" className="rounded" onClick={() => navigate(-1 as unknown as string)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Right: balance preview ── */}
      <div className="sticky top-24 h-fit space-y-gutter">
        {selectedInvoice ? (
          <BalancePreviewPanel invoice={selectedInvoice} amount={amount} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#d5dde6] px-6 py-12 text-center">
            <Search className="h-10 w-10 text-[#d5dde6]" />
            <p className="mt-3 text-sm font-bold text-[#94a3b8]">Search for a student above to see invoice details and a live balance preview</p>
          </div>
        )}
        <div className="rounded-lg border border-[#d5dde6] bg-[#f7f9fb] p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#00334f]" />
            <span className="text-[11px] font-black uppercase tracking-widest text-[#00334f]">Approval trail</span>
          </div>
          <p className="text-xs font-semibold text-[#64748b]">
            Finance Officers post payments but cannot approve their own entries. Each payment is reviewed by the Principal or MD before it is finalised and a receipt is issued.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PaymentListPage() {
  const { data: apiPayments = [] as typeof payments, isLoading, isError, refetch } = usePayments() as unknown as { data: typeof payments; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <FinanceWorkspaceShell title="Payment Ledger" eyebrow="Search and reconcile">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments' }]} />
      <FinanceFilters items={['Method', 'Status', 'Date range', 'Amount range', 'Entered by']} />
      {isLoading ? (
        <SkeletonTable cols={6} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiPayments.length ? (
        <EmptyState title="No payments recorded" description="Payments will appear here once they are entered at the cash desk." />
      ) : (
        <PaymentTable rows={apiPayments} />
      )}
    </FinanceWorkspaceShell>
  );
}

const STALE_HOURS = 48;

function isStale(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const ms = Date.now() - new Date(dateStr).getTime();
  return ms > STALE_HOURS * 60 * 60 * 1000;
}

function hoursAgo(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  const h = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ${h % 24}h ago`;
}

type QueueTab = 'all' | 'cash' | 'bank' | 'stale';

export function PendingPaymentApprovalsPage() {
  const { data: apiPending = [] as typeof payments, isLoading, isError, refetch } = usePendingPaymentApprovals() as unknown as { data: typeof payments; isLoading: boolean; isError: boolean; refetch: () => void };
  const addNoteMutation = useAddPaymentNoteMutation();
  const uploadMutation  = useFileUploadMutation();
  const fileInputRef    = useRef<HTMLInputElement>(null);

  const [tab, setTab]               = useState<QueueTab>('all');
  const [search, setSearch]         = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteText, setNoteText]     = useState<Record<string, string>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string[]>>({});
  const [evidenceId, setEvidenceId] = useState<Record<string, string>>({});
  const [uploadErr, setUploadErr]   = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const staleCount = apiPending.filter((p) => isStale(p.date)).length;

  const TABS: { key: QueueTab; label: string; count: number }[] = [
    { key: 'all',   label: 'All',          count: apiPending.length },
    { key: 'cash',  label: 'Cash',         count: apiPending.filter((p) => (p.method ?? '').toUpperCase().includes('CASH')).length },
    { key: 'bank',  label: 'Bank',         count: apiPending.filter((p) => (p.method ?? '').toUpperCase().includes('BANK')).length },
    { key: 'stale', label: `Stale >${STALE_HOURS}h`, count: staleCount },
  ];

  const visible = useMemo(() => {
    let r = apiPending;
    if (tab === 'cash')  r = r.filter((p) => (p.method ?? '').toUpperCase().includes('CASH'));
    if (tab === 'bank')  r = r.filter((p) => (p.method ?? '').toUpperCase().includes('BANK'));
    if (tab === 'stale') r = r.filter((p) => isStale(p.date));
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((p) =>
        (p.student ?? '').toLowerCase().includes(q) ||
        (p.invoiceNumber ?? '').toLowerCase().includes(q) ||
        (p.reference ?? '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [apiPending, tab, search]);

  const totalValue = visible.reduce((s, p) => s + p.amount, 0);

  const submitNote = (paymentId: string) => {
    const text = (noteText[paymentId] ?? '').trim();
    if (!text) return;
    addNoteMutation.mutate(
      { id: paymentId, note: text },
      {
        onSuccess: () => {
          setLocalNotes((prev) => ({ ...prev, [paymentId]: [...(prev[paymentId] ?? []), text] }));
          setNoteText((prev) => ({ ...prev, [paymentId]: '' }));
          toast('Note added', 'success');
        },
        onError: () => toast('Failed to save note', 'error'),
      },
    );
  };

  const handleEvidence = (paymentId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setUploadErr(err); return; }
    setUploadErr('');
    setUploadingFor(paymentId);
    uploadMutation.mutate(file, {
      onSuccess: (result) => {
        const fileId = ((result as unknown as Record<string, Record<string, string>>).file?.id) ?? '';
        setEvidenceId((prev) => ({ ...prev, [paymentId]: fileId }));
        setUploadingFor(null);
        toast('Evidence attached', 'success');
      },
      onError: (err) => {
        setUploadErr(err instanceof Error ? err.message : 'Upload failed');
        setUploadingFor(null);
      },
    });
  };

  return (
    <FinanceWorkspaceShell title="Payment Queue" eyebrow="FO verification · Principal approves">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Payment Queue' }]} />

      {/* Alert strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`flex items-center gap-3 rounded-lg border p-4 ${staleCount > 0 ? 'border-[#e11d48]/30 bg-[#e11d48]/5' : 'border-[#d5dde6] bg-white'}`}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${staleCount > 0 ? 'bg-[#e11d48]/15' : 'bg-[#f1f5f9]'}`}>
            <Timer className={`h-5 w-5 ${staleCount > 0 ? 'text-[#e11d48]' : 'text-[#64748b]'}`} />
          </div>
          <div>
            <p className={`text-2xl font-black ${staleCount > 0 ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>{staleCount}</p>
            <p className="text-xs font-bold text-[#64748b]">Stale &gt;{STALE_HOURS}h — need Principal attention</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[#d5dde6] bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00334f]/10">
            <Clock className="h-5 w-5 text-[#00334f]" />
          </div>
          <div>
            <p className="text-2xl font-black text-[#0f172a]">{apiPending.length}</p>
            <p className="text-xs font-bold text-[#64748b]">Total awaiting approval</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-[#d5dde6] bg-white p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#10b981]/10">
            <Banknote className="h-5 w-5 text-[#10b981]" />
          </div>
          <div>
            <p className="font-display text-xl font-black text-[#0f172a]">{formatTZS(apiPending.reduce((s, p) => s + p.amount, 0))}</p>
            <p className="text-xs font-bold text-[#64748b]">Total value in queue</p>
          </div>
        </div>
      </div>

      {/* FO role notice */}
      <div className="flex items-start gap-3 rounded-lg border border-[#d59a1b]/40 bg-[#fffbeb] px-4 py-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7a5200]" />
        <p className="text-xs font-bold text-[#7a5200]">
          As Finance Officer you can add verification notes and attach evidence to each payment. Approval is handled by the Principal or MD — you cannot approve your own entries.
        </p>
      </div>

      {/* Search + tabs */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student, invoice, or reference…"
          className="h-10 w-full rounded-lg border border-[#d5dde6] bg-white pl-9 pr-4 text-sm font-semibold placeholder:text-[#94a3b8] outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
        />
      </div>

      <div className="flex gap-1 border-b border-[#d5dde6]">
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-4 py-2.5 text-sm font-black transition-colors ${tab === key ? 'text-[#00334f]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
          >
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${tab === key ? 'bg-[#00334f] text-white' : key === 'stale' && count > 0 ? 'bg-[#e11d48] text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {count}
            </span>
            {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00334f]" />}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-1 text-xs font-semibold text-[#64748b]">
          {visible.length} shown · {formatTZS(totalValue)} total
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => expandedId && handleEvidence(expandedId, e)}
      />

      {/* Queue cards */}
      {isLoading ? (
        <SkeletonCards count={4} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiPending.length ? (
        <EmptyState title="Queue is clear" description="No payments are awaiting approval. The Principal has reviewed everything." />
      ) : !visible.length ? (
        <EmptyState title="No matches" description="Adjust the search or filter to see payments." />
      ) : (
        <div className="space-y-3">
          {visible.map((payment) => {
            const stale      = isStale(payment.date);
            const expanded   = expandedId === payment.id;
            const pending    = addNoteMutation.isPending && expandedId === payment.id;
            const notes      = localNotes[payment.id] ?? [];
            const hasEvidence = Boolean(evidenceId[payment.id]);
            const method     = (payment.method ?? '').toUpperCase();
            const isCash     = method.includes('CASH');
            const methodLabel = isCash ? 'Cash' : method.includes('BANK') ? 'Bank' : method.replace(/_/g, ' ');
            const methodColor = isCash ? 'bg-[#00334f] text-white' : 'bg-[#10b981] text-white';

            return (
              <div
                key={payment.id}
                className={`rounded-lg border bg-white transition-shadow ${stale ? 'border-[#e11d48]/40' : 'border-[#d5dde6]'} ${expanded ? 'shadow-md' : 'shadow-sm hover:shadow-md'}`}
              >
                {/* Card header */}
                <button
                  className="flex w-full items-start gap-4 p-4 text-left"
                  onClick={() => setExpandedId(expanded ? null : payment.id)}
                >
                  {/* Method badge */}
                  <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-[11px] font-black ${methodColor}`}>{methodLabel}</span>

                  {/* Student + invoice */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <p className="font-display font-black text-[#0f172a]">{payment.student}</p>
                      {payment.invoiceNumber && (
                        <span className="text-xs font-semibold text-[#64748b]">Invoice {payment.invoiceNumber}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px] font-semibold text-[#64748b]">
                      {payment.enteredBy && <span>By {payment.enteredBy}</span>}
                      {payment.reference  && <span>Ref: <span className="font-mono">{payment.reference}</span></span>}
                    </div>
                  </div>

                  {/* Amount + age */}
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-lg font-black text-[#0f172a]">{formatTZS(payment.amount)}</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1.5">
                      {stale && (
                        <span className="flex items-center gap-0.5 rounded bg-[#e11d48]/10 px-1.5 py-0.5 text-[10px] font-black text-[#e11d48]">
                          <Timer className="h-2.5 w-2.5" /> STALE
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-[#64748b]">{hoursAgo(payment.date)}</span>
                    </div>
                  </div>

                  {/* Expand chevron */}
                  <ChevronRight className={`mt-1 h-4 w-4 shrink-0 text-[#94a3b8] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Expanded panel */}
                {expanded && (
                  <div className="border-t border-[#f1f5f9] px-4 pb-4 pt-4">
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                      {/* Left: note area */}
                      <div className="space-y-4">
                        <div>
                          <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-[#64748b]">Verification Notes</p>
                          {/* Existing session notes */}
                          {notes.length > 0 && (
                            <div className="mb-3 space-y-2">
                              {notes.map((note, i) => (
                                <div key={i} className="flex items-start gap-2 rounded-lg bg-[#f7f9fb] p-3">
                                  <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#00334f]" />
                                  <p className="text-xs font-semibold text-[#334155]">{note}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          <textarea
                            value={noteText[payment.id] ?? ''}
                            onChange={(e) => setNoteText((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                            rows={3}
                            placeholder="Add a verification note for the Principal… e.g. 'Confirmed bank statement reference, payment received 2026-06-24'"
                            className="w-full resize-none rounded-lg border border-[#d5dde6] bg-[#f7f9fb] p-3 text-sm font-semibold text-[#334155] outline-none focus:border-[#00334f] focus:bg-white"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              onClick={() => submitNote(payment.id)}
                              disabled={!(noteText[payment.id] ?? '').trim() || pending}
                              className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              {pending ? 'Saving…' : 'Add Note'}
                            </Button>
                            {/* Evidence upload */}
                            <Button
                              variant="secondary"
                              className="rounded"
                              onClick={() => {
                                setUploadErr('');
                                fileInputRef.current?.click();
                              }}
                              disabled={uploadMutation.isPending && uploadingFor === payment.id}
                            >
                              {hasEvidence
                                ? <><Paperclip className="h-3.5 w-3.5 text-[#10b981]" /> Evidence attached</>
                                : uploadMutation.isPending && uploadingFor === payment.id
                                  ? <><UploadCloud className="h-3.5 w-3.5" /> Uploading…</>
                                  : <><UploadCloud className="h-3.5 w-3.5" /> Attach evidence</>
                              }
                            </Button>
                          </div>
                          {uploadErr && <p className="mt-1.5 text-[11px] font-black text-[#e11d48]">{uploadErr}</p>}
                        </div>
                      </div>

                      {/* Right: quick facts + links */}
                      <div className="space-y-3">
                        <div className="rounded-lg border border-[#d5dde6] bg-[#f7f9fb] p-4">
                          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Payment Facts</p>
                          <div className="space-y-2 text-xs font-semibold text-[#64748b]">
                            <div className="flex justify-between"><span>Amount</span><span className="font-black text-[#0f172a]">{formatTZS(payment.amount)}</span></div>
                            <div className="flex justify-between"><span>Method</span><span className="font-black text-[#0f172a]">{methodLabel}</span></div>
                            <div className="flex justify-between"><span>Date</span><span className="font-black text-[#0f172a]">{formatDate(payment.date)}</span></div>
                            {payment.reference && <div className="flex justify-between"><span>Reference</span><span className="font-mono font-black text-[#0f172a]">{payment.reference}</span></div>}
                            <div className="flex justify-between"><span>Entered by</span><span className="font-black text-[#0f172a]">{payment.enteredBy || '—'}</span></div>
                            <div className="flex justify-between"><span>Queue age</span><span className={`font-black ${stale ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>{hoursAgo(payment.date)}</span></div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          {payment.invoiceId && (
                            <NavLink
                              to={`/finance/invoices/${payment.invoiceId}`}
                              className="flex items-center justify-between rounded-lg border border-[#d5dde6] bg-white px-3 py-2.5 text-xs font-black text-[#00334f] transition hover:border-[#00334f] hover:bg-[#eef5f8]"
                            >
                              <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> View Invoice</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </NavLink>
                          )}
                          <NavLink
                            to={`/finance/payments/${payment.id}`}
                            className="flex items-center justify-between rounded-lg border border-[#d5dde6] bg-white px-3 py-2.5 text-xs font-black text-[#00334f] transition hover:border-[#00334f] hover:bg-[#eef5f8]"
                          >
                            <span className="flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Full Payment Detail</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </NavLink>
                        </div>
                        {stale && (
                          <div className="rounded-lg border border-[#e11d48]/30 bg-[#e11d48]/5 p-3 text-[11px] font-bold text-[#9f0f2c]">
                            This payment has been waiting {hoursAgo(payment.date)} without approval. Consider following up with the Principal.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </FinanceWorkspaceShell>
  );
}

export function PaymentDetailPage() {
  const { id } = useParams();
  const { data: apiPayments = [] as typeof payments, isLoading } = usePayments() as unknown as { data: typeof payments; isLoading: boolean };
  const refundMutation = useRefundPaymentMutation();
  const navigate = useNavigate();

  if (isLoading) return <FinanceWorkspaceShell title="Loading…" eyebrow="Payment profile"><SkeletonTable cols={4} /></FinanceWorkspaceShell>;
  const payment = apiPayments.find((p) => p.id === id) ?? null;
  if (!payment) return <FinanceWorkspaceShell title="Not Found" eyebrow="Payment profile"><EmptyState title="Payment not found" description="This payment record does not exist." /></FinanceWorkspaceShell>;

  return (
    <FinanceWorkspaceShell title={payment.id} eyebrow="Payment profile">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: payment.id }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            { label: 'Amount', value: formatTZS(payment.amount), detail: payment.method.replaceAll('_', ' '), tone: payment.status === 'REJECTED' ? 'red' : 'green', trend: payment.status === 'REJECTED' ? 'down' : 'up' },
            { label: 'Status', value: payment.status, detail: formatDate(payment.date), tone: payment.status === 'APPROVED' ? 'green' : payment.status === 'REJECTED' ? 'red' : 'gold' },
            { label: 'Invoice', value: payment.invoiceNumber, detail: payment.student, tone: 'navy' },
            { label: 'Reference', value: payment.reference ?? '—', detail: payment.enteredBy, tone: 'slate' },
          ]} />
          <Timeline rows={[
            `Payment recorded by ${payment.enteredBy || 'Finance staff'}`,
            'Routed for Principal approval',
            payment.status === 'APPROVED' ? 'Approved · Receipt issued' : (payment.status === 'REJECTED' ? 'Rejected · Awaiting correction' : 'Awaiting approval'),
          ]} />
        </div>
        <div className="space-y-gutter">
          <div className="rounded-lg border border-[#d5dde6] bg-white p-5 sticky top-24">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Payment Actions</p>
            <div className="mt-4 space-y-2">
              <NavLink to={`/finance/invoices/${payment.invoiceId ?? payment.invoiceNumber}`}><Button variant="secondary" className="w-full justify-between rounded"><span>Open invoice</span><ArrowRight className="h-4 w-4" /></Button></NavLink>
              {payment.status === 'APPROVED' && (
                <Button variant="secondary" className="w-full justify-between rounded"
                  onClick={() => { if (!window.confirm('Refund this payment? Enter reason below.')) return; const reason = window.prompt('Refund reason:'); if (!reason) return; refundMutation.mutate({ id: payment.id, body: { reason } }, { onSuccess: () => toast('Refund processed', 'warning'), onError: () => toast('Failed to process refund', 'error') }); }}>
                  <span>Refund with reason</span><ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button variant="secondary" className="w-full justify-between rounded" onClick={() => navigate('/finance/receipts')}>
                <span>View receipts</span><ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Receipt pages ────────────────────────────────────────────────────────────

const RCP_PAGE_SIZE = 20;
type RcpStatusTab = 'ALL' | 'ACTIVE' | 'VOID';

export function ReceiptListPage() {
  const { data: apiReceipts = [] as typeof receipts, isLoading, isError, refetch } = useReceipts() as unknown as { data: typeof receipts; isLoading: boolean; isError: boolean; refetch: () => void };
  const [search, setSearch]     = useState('');
  const [statusTab, setStatusTab] = useState<RcpStatusTab>('ALL');
  const [page, setPage]         = useState(0);

  const counts = useMemo(() => ({
    ALL:    apiReceipts.length,
    ACTIVE: apiReceipts.filter((r) => r.status !== 'VOID').length,
    VOID:   apiReceipts.filter((r) => r.status === 'VOID').length,
  }), [apiReceipts]);

  const visible = useMemo(() => {
    let r = [...apiReceipts].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    if (statusTab !== 'ALL') r = r.filter((rc) => statusTab === 'VOID' ? rc.status === 'VOID' : rc.status !== 'VOID');
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((rc) =>
        rc.number.toLowerCase().includes(q) ||
        rc.student.toLowerCase().includes(q) ||
        (rc.paymentId ?? '').toLowerCase().includes(q),
      );
    }
    return r;
  }, [apiReceipts, statusTab, search]);

  const totalPages    = Math.ceil(visible.length / RCP_PAGE_SIZE);
  const pageReceipts  = visible.slice(page * RCP_PAGE_SIZE, (page + 1) * RCP_PAGE_SIZE);
  const totalValue    = visible.filter((r) => r.status !== 'VOID').reduce((s, r) => s + r.amount, 0);

  const RCP_TABS: { key: RcpStatusTab; label: string }[] = [
    { key: 'ALL',    label: 'All'    },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'VOID',   label: 'Void'   },
  ];

  return (
    <FinanceWorkspaceShell title="Receipt Ledger" eyebrow="Official payment receipts · search and void">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts' }]} />

      <FinanceMetricStrip items={[
        { label: 'Total Receipts', value: String(counts.ALL),    detail: 'all time',         tone: 'navy'  },
        { label: 'Active',         value: String(counts.ACTIVE), detail: formatTZS(totalValue), tone: 'green' },
        { label: 'Voided',         value: String(counts.VOID),   detail: 'cancelled',        tone: counts.VOID > 0 ? 'red' : 'slate' },
        { label: 'Showing',        value: String(visible.length), detail: search || statusTab !== 'ALL' ? 'filtered' : 'all receipts', tone: 'slate' },
      ]} />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search receipt number, student name, or payment ID…"
          className="h-10 w-full rounded-lg border border-[#d5dde6] bg-white pl-9 pr-4 text-sm font-semibold placeholder:text-[#94a3b8] outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-[#d5dde6]">
        {RCP_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setStatusTab(key); setPage(0); }}
            className={`relative px-4 py-2.5 text-sm font-black transition-colors ${statusTab === key ? 'text-[#00334f]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
          >
            {label}
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${statusTab === key ? 'bg-[#00334f] text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              {counts[key]}
            </span>
            {statusTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00334f]" />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable cols={6} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiReceipts.length ? (
        <EmptyState title="No receipts yet" description="Receipts are generated automatically when payments are approved by the Principal." />
      ) : !visible.length ? (
        <EmptyState title="No matching receipts" description="Adjust your search or filter." />
      ) : (
        <>
          <ReceiptList rows={pageReceipts} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-[#64748b]">
                Showing {page * RCP_PAGE_SIZE + 1}–{Math.min((page + 1) * RCP_PAGE_SIZE, visible.length)} of {visible.length}
              </span>
              <div className="flex items-center gap-1">
                <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="flex h-8 w-8 items-center justify-center rounded border border-[#d5dde6] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`h-8 w-8 rounded border text-xs font-black transition ${page === p ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#d5dde6] text-[#64748b] hover:bg-[#f1f5f9]'}`}>{p + 1}</button>
                  );
                })}
                <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="flex h-8 w-8 items-center justify-center rounded border border-[#d5dde6] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </FinanceWorkspaceShell>
  );
}

export function ReceiptDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const { data: apiReceipt, isLoading }                   = useReceiptById(id ?? '') as unknown as { data: (typeof receipts)[number] | undefined; isLoading: boolean };
  const { data: allPayments = [] as typeof payments }     = usePayments()             as unknown as { data: typeof payments };
  const voidMutation = useVoidReceiptMutation();

  const receipt  = apiReceipt;
  const payment  = allPayments.find((p) => p.id === receipt?.paymentId);
  const { data: invoice } = useInvoiceById(payment?.invoiceId ?? '') as unknown as { data: (typeof invoices)[number] | undefined };

  const [voidOpen, setVoidOpen]     = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleVoid = () => {
    if (!voidReason.trim() || !receipt) return;
    voidMutation.mutate(
      { id: receipt.id, body: { reason: voidReason } },
      {
        onSuccess: () => { toast('Receipt voided', 'warning'); navigate('/finance/receipts'); },
        onError:   () => toast('Failed to void receipt', 'error'),
      },
    );
  };

  const handleDownloadPdf = async () => {
    if (!receipt?.id || pdfLoading) return;
    setPdfLoading(true);
    await downloadReceiptPdf(receipt.id, toast);
    setPdfLoading(false);
  };

  if (isLoading) return <FinanceWorkspaceShell title="Loading…" eyebrow="Receipt"><SkeletonTable cols={3} /></FinanceWorkspaceShell>;
  if (!receipt)  return <FinanceWorkspaceShell title="Not Found" eyebrow="Receipt"><EmptyState title="Receipt not found" description="This receipt does not exist or has been removed." /></FinanceWorkspaceShell>;

  return (
    <FinanceWorkspaceShell title={receipt.number} eyebrow="Official receipt">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts', to: '/finance/receipts' }, { label: receipt.number }]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_300px]">

        {/* Branded receipt */}
        <ReceiptPreview
          receipt={receipt}
          payment={payment as typeof payment & { bankName?: string }}
          invoice={invoice}
        />

        {/* Sidebar controls */}
        <div className="sticky top-24 h-fit space-y-gutter">

          {/* Actions */}
          <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Receipt Actions</p>
            <div className="mt-4 space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-between rounded"
                loading={pdfLoading}
                onClick={handleDownloadPdf}
              >
                <span className="flex items-center gap-2"><Download className="h-4 w-4" /> {pdfLoading ? 'Generating…' : 'Download PDF'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-between rounded"
                onClick={() => window.print()}
              >
                <span className="flex items-center gap-2"><Printer className="h-4 w-4" /> Print Receipt</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              {payment?.invoiceId && (
                <NavLink to={`/finance/invoices/${payment.invoiceId}`}>
                  <Button variant="secondary" className="w-full justify-between rounded">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> View Invoice</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </NavLink>
              )}
              {invoice?.studentId && (
                <NavLink to={`/finance/students/${invoice.studentId}`}>
                  <Button variant="secondary" className="w-full justify-between rounded">
                    <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Student Ledger</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </NavLink>
              )}
              {receipt.paymentId && (
                <NavLink to={`/finance/payments/${receipt.paymentId}`}>
                  <Button variant="secondary" className="w-full justify-between rounded">
                    <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Payment Profile</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </NavLink>
              )}
            </div>
          </div>

          {/* Void form */}
          {receipt.status !== 'VOID' && (
            <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Void Receipt</p>
              {!voidOpen ? (
                <button
                  onClick={() => setVoidOpen(true)}
                  className="mt-3 w-full rounded border border-[#e11d48]/30 py-2.5 text-xs font-black text-[#e11d48] transition hover:bg-[#e11d48]/5"
                >
                  Void this receipt…
                </button>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="rounded-lg border border-[#e11d48]/20 bg-[#e11d48]/5 p-3 text-xs font-bold text-[#9f0f2c]">
                    Voiding a receipt is permanent. The associated payment record remains in the ledger.
                  </div>
                  <label className="block">
                    <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Reason *</span>
                    <textarea
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      rows={3}
                      placeholder="e.g. Duplicate receipt issued, data entry error…"
                      className="mt-1.5 w-full resize-none rounded border border-[#d5dde6] bg-[#f7f9fb] p-2.5 text-sm font-semibold outline-none focus:border-[#e11d48] focus:ring-2 focus:ring-[#e11d48]/10"
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleVoid}
                      disabled={!voidReason.trim() || voidMutation.isPending}
                      className="flex-1 rounded bg-[#e11d48] text-white hover:bg-[#9f0f2c] hover:shadow-none"
                    >
                      {voidMutation.isPending ? 'Voiding…' : 'Confirm Void'}
                    </Button>
                    <Button variant="secondary" className="rounded" onClick={() => { setVoidOpen(false); setVoidReason(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Receipt facts */}
          <div className="rounded-lg border border-[#d5dde6] bg-[#f7f9fb] p-4">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Receipt Facts</p>
            <div className="space-y-2 text-xs font-semibold text-[#64748b]">
              <div className="flex justify-between"><span>Receipt #</span><span className="font-black text-[#0f172a]">{receipt.number}</span></div>
              <div className="flex justify-between"><span>Amount</span><span className="font-mono font-black text-[#0f172a]">{formatTZS(receipt.amount)}</span></div>
              <div className="flex justify-between"><span>Method</span><span className="font-black text-[#0f172a]">{(receipt.method ?? '').replaceAll('_', ' ')}</span></div>
              <div className="flex justify-between"><span>Issued</span><span className="font-black text-[#0f172a]">{formatDate(receipt.issuedAt)}</span></div>
              <div className="flex justify-between"><span>Status</span><span className={`font-black ${receipt.status === 'VOID' ? 'text-[#e11d48]' : 'text-[#10b981]'}`}>{receipt.status}</span></div>
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Fee setup pages ──────────────────────────────────────────────────────────

export function FeeCategoriesPage() {
  const { data: apiCategories = [] as typeof feeCategories, isLoading, isError, refetch } = useFeeCategories() as unknown as { data: typeof feeCategories; isLoading: boolean; isError: boolean; refetch: () => void };
  const { refetch: refetchStructures } = useFeeStructures();
  const reorderMutation = useReorderFeeCategoriesMutation();
  const navigate = useNavigate();
  const [orderedCategories, setOrderedCategories] = useState<typeof feeCategories>([]);
  const [deletePreview, setDeletePreview] = useState<Array<{ name: string; blockers: string[] }>>([]);

  useEffect(() => {
    setOrderedCategories([...(apiCategories as typeof feeCategories)].sort((a, b) => a.order - b.order));
  }, [apiCategories]);

  const orderChanged = useMemo(() => {
    const serverIds = [...(apiCategories as typeof feeCategories)].sort((a, b) => a.order - b.order).map((c) => c.id).join('|');
    const localIds = orderedCategories.map((c) => c.id).join('|');
    return Boolean(serverIds && localIds && serverIds !== localIds);
  }, [apiCategories, orderedCategories]);

  const moveCategory = (id: string, direction: -1 | 1) => {
    setOrderedCategories((rows) => {
      const index = rows.findIndex((row) => row.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= rows.length) return rows;
      const next = [...rows];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const handleSaveOrder = () => {
    if (!orderedCategories.length) { toast('No categories to reorder', 'warning'); return; }
    reorderMutation.mutate(orderedCategories.map((category) => category.id), {
      onSuccess: () => { toast('Category order saved', 'success'); setDeletePreview([]); },
      onError: () => toast('Failed to save category order', 'error'),
    });
  };

  const handleDeletePreview = () => {
    const preview = orderedCategories.map((category) => {
      const row = category as any;
      const blockers = [
        row.usedByStructures ? `${row.usedByStructures} fee structures` : '',
        row.usedByAssignments ? `${row.usedByAssignments} student assignments` : '',
        row.usedByInvoices ? `${row.usedByInvoices} invoice line items` : '',
      ].filter(Boolean);
      return { name: category.name, blockers };
    });
    setDeletePreview(preview);
    const blocked = preview.filter((item) => item.blockers.length).length;
    toast(blocked ? `${blocked} categories are blocked from delete` : 'No delete blockers found', blocked ? 'warning' : 'success');
  };

  const handleSyncMatrix = async () => {
    await Promise.all([refetch(), refetchStructures()]);
    setDeletePreview([]);
    toast('Fee categories and matrix data refreshed', 'success');
  };

  return (
    <FinanceWorkspaceShell title="Fee Categories" eyebrow="Setup and ordering">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Categories' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        {isLoading ? (
          <SkeletonTable cols={9} />
        ) : isError ? (
          <DataError onRetry={refetch} />
        ) : !apiCategories.length ? (
          <EmptyState title="No fee categories" description="Create the first fee category to start building fee structures." action={{ label: 'Create Category', href: '/finance/fee-categories/create' }} />
        ) : (
        <FinanceTable columns={['Order', 'Code', 'Name', 'Type', 'Default Amount', 'Frequency', 'Used By', 'Status', 'Actions']} minWidth={940}>
          {orderedCategories.map((category, index) => (
            <tr key={category.id} className="even:bg-[#f7f9fb]">
              <Td>
                <div className="flex items-center gap-2">
                  <span className="w-5 font-mono text-xs font-black tabular-nums">{index}</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => moveCategory(category.id, -1)}
                      disabled={index === 0}
                      className="rounded border border-[#d5dde6] p-1 text-[#00334f] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveCategory(category.id, 1)}
                      disabled={index === orderedCategories.length - 1}
                      className="rounded border border-[#d5dde6] p-1 text-[#00334f] disabled:cursor-not-allowed disabled:opacity-30"
                      title="Move down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </Td>
              <Td>{category.code}</Td>
              <Td>{category.name}</Td>
              <Td>
                <Badge tone={category.mandatory ? 'emerald' : 'amber'}>
                  {category.mandatory ? 'mandatory' : 'optional'}
                </Badge>
              </Td>
              <Td amount><AmountDisplay amount={category.amount} /></Td>
              <Td>{category.frequency}</Td>
              <Td>
                <div className="text-xs font-bold text-[#334155]">
                  <div>{category.usedByStructures} structures</div>
                  <div className="text-[#64748b]">{(category as any).usedByAssignments ?? 0} assignments / {(category as any).usedByInvoices ?? 0} invoices</div>
                </div>
              </Td>
              <Td><FinanceStatusBadge status={category.active ? 'ACTIVE' : 'INACTIVE'} /></Td>
              <Td>
                <NavLink className="font-black text-[#00334f]" to={`/finance/fee-categories/${category.id}/edit`}>
                  Edit
                </NavLink>
              </Td>
            </tr>
          ))}
        </FinanceTable>
        )}
        <div className="space-y-gutter sticky top-24 h-fit">
          <div className="rounded-lg border border-[#d5dde6] bg-white">
            <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3">
              <h2 className="font-display text-base font-black text-[#00334f]">Category Actions</h2>
            </div>
            <div className="space-y-2 p-3">
              <Button variant="secondary" className="w-full justify-between rounded" onClick={() => navigate('/finance/fee-categories/create')}>
                <span>Create category</span><ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="w-full justify-between rounded" onClick={handleSaveOrder} disabled={!orderChanged || reorderMutation.isPending}>
                <span>{reorderMutation.isPending ? 'Saving...' : 'Save reordered list'}</span><ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="w-full justify-between rounded" onClick={handleDeletePreview}>
                <span>Preview delete block</span><ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="w-full justify-between rounded" onClick={handleSyncMatrix}>
                <span>Sync matrix</span><ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {deletePreview.length > 0 && (
            <div className="rounded-lg border border-[#d5dde6] bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Delete Preview</p>
              <div className="mt-3 space-y-2">
                {deletePreview.map((item) => (
                  <div key={item.name} className="rounded border border-[#e2e8f0] bg-[#f8fafc] p-3">
                    <p className="text-sm font-black text-[#00334f]">{item.name}</p>
                    <p className={`mt-1 text-xs font-bold ${item.blockers.length ? 'text-[#e11d48]' : 'text-[#047857]'}`}>
                      {item.blockers.length ? `Blocked: ${item.blockers.join(', ')}` : 'Can be deleted by system admin'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

export function CreateFeeCategoryPage() {
  return <FeeCategoryForm title="Create Fee Category" mode="create" />;
}

export function EditFeeCategoryPage() {
  return <FeeCategoryForm title="Edit Fee Category" mode="edit" />;
}

function FeeCategoryForm({ title, mode }: { title: string; mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: apiCategories = [] as typeof feeCategories } = useFeeCategories() as unknown as { data: typeof feeCategories };
  const existing = mode === 'edit' ? (apiCategories.find((c) => c.id === id) ?? null) : null;
  const createMutation = useCreateFeeCategoryMutation();
  const updateMutation = useUpdateFeeCategoryMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState({
    name: '',
    code: '',
    mandatory: 'mandatory',
    amount: '',
    frequency: 'TERM',
    order: '',
  });

  useEffect(() => {
    if (existing) {
      const frequency = String(existing.frequency ?? '').toUpperCase().includes('TERM') ? 'TERM' : 'ONE_TIME';
      setForm({ name: existing.name ?? '', code: existing.code ?? '', mandatory: existing.mandatory ? 'mandatory' : 'optional', amount: String(existing.amount ?? ''), frequency, order: String(existing.order ?? '') });
    }
  }, [existing?.id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { toast('Name and code are required', 'error'); return; }
    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      isOptional: form.mandatory !== 'mandatory',
      isBillablePerTerm: form.frequency === 'TERM',
      displayOrder: Number(form.order) || undefined,
    };
    if (mode === 'create') {
      createMutation.mutate(body, {
        onSuccess: () => { toast('Fee category created', 'success'); navigate('/finance/fee-categories'); },
        onError: () => toast('Failed to create category', 'error'),
      });
    } else if (id) {
      updateMutation.mutate({ id, body }, {
        onSuccess: () => { toast('Fee category updated', 'success'); navigate('/finance/fee-categories'); },
        onError: () => toast('Failed to update category', 'error'),
      });
    }
  };

  return (
    <FinanceWorkspaceShell title={title} eyebrow={mode === 'create' ? 'New billing component' : (existing?.code ?? 'Edit')}>
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: mode === 'create' ? 'Create Category' : 'Edit Category' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex items-center gap-3 border-b border-[#d5dde6] pb-4">
            <FileSpreadsheet className="h-5 w-5 text-[#00334f]" />
            <div>
              <h2 className="font-display text-xl font-black text-[#00334f]">{title}</h2>
              <p className="text-sm font-semibold text-[#64748b]">All changes are audited with actor and reason.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Name *</span>
              <input required value={form.name} onChange={set('name')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]" placeholder="e.g. Tuition Fee" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Code *</span>
              <input required value={form.code} onChange={set('code')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]" placeholder="e.g. TUITION" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Type</span>
              <select value={form.mandatory} onChange={set('mandatory')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]">
                <option value="mandatory">Mandatory</option><option value="optional">Optional</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Default Amount (TZS)</span>
              <input type="number" value={form.amount} onChange={set('amount')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]" placeholder="e.g. 450000" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Billing Frequency</span>
              <select value={form.frequency} onChange={set('frequency')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]">
                <option value="TERM">Per Term</option><option value="ANNUAL">Annual</option><option value="MONTHLY">Monthly</option><option value="ONE_TIME">One Time</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Display Order</span>
              <input type="number" value={form.order} onChange={set('order')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]" placeholder="e.g. 1" />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={isPending}>
              <Send className="h-4 w-4" /> {isPending ? 'Saving…' : (mode === 'create' ? 'Create Category' : 'Save Changes')}
            </Button>
            <Button type="button" variant="secondary" className="rounded" onClick={() => navigate('/finance/fee-categories')}>Cancel</Button>
          </div>
        </form>
        <SideSummary title="Safety Rules" items={[
          ['Used by', String(existing?.usedByStructures ?? 0) + ' structures'],
          ['Delete', 'Blocked if in use'],
          ['Audit', 'Reason required'],
          ['Preview', 'Shown before save'],
        ]} />
      </div>
    </FinanceWorkspaceShell>
  );
}

export function FeeStructuresPage() {
  const { data: apiStructures = [] as typeof feeStructures } = useFeeStructures() as unknown as { data: typeof feeStructures };
  const { data: apiGroups = [] as typeof studentGroups } = useStudentGroups() as unknown as { data: typeof studentGroups };
  const deactivateMutation = useDeactivateFeeStructureMutation();
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const handleDeactivate = (id: string) => {
    setDeactivating(id);
    deactivateMutation.mutate(id, {
      onSuccess: () => { toast('Fee structure deactivated', 'warning'); setDeactivating(null); },
      onError: () => { toast('Failed to deactivate structure', 'error'); setDeactivating(null); },
    });
  };
  const stageTotals = apiStructures.reduce<Record<string, number>>((acc, structure) => {
    acc[structure.educationStage] = (acc[structure.educationStage] ?? 0) + structure.amount;
    return acc;
  }, {});

  return (
    <FinanceWorkspaceShell title="Fee Structures" eyebrow="Class and term pricing">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Structures' }]} />
      <div className="grid gap-3 md:grid-cols-3">
        {['Primary', 'O-Level', 'A-Level'].map((stage) => (
          <div key={stage} className="rounded-[24px] border border-[#d7dee8] bg-white p-4 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#6a7485]">{stage}</p>
            <p className="mt-2 font-mono text-xl font-black text-[#10233f]">{formatTZS(stageTotals[stage] ?? 0)}</p>
            <p className="mt-1 text-xs font-semibold text-[#6a7485]">Active fee targets in this stage</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FinanceTable columns={['Group Code', 'Name', 'Members', 'Fee Target', 'Status']} minWidth={760}>
          {apiGroups.map((group) => (
            <tr key={group.id} className="even:bg-[#f7f9fb]">
              <Td>{group.code}</Td>
              <Td>{group.name}</Td>
              <Td>{group.members}</Td>
              <Td>{group.feeTarget}</Td>
              <Td><FinanceStatusBadge status="ACTIVE" /></Td>
            </tr>
          ))}
        </FinanceTable>
        <ActionPanel
          title="Student Group Targeting"
          items={[
            'Create group: BOARDER, DAY_SCHOLAR, SCIENCE_COMBINATIONS',
            'Assign students into billing groups',
            'Preview group fees before invoice generation',
            'Audit every group membership change',
          ]}
        />
      </div>
      <FinanceTable columns={['Structure', 'Category', 'Target', 'Stage', 'Group', 'Amount', 'Effective Term', 'Status', 'Actions']} minWidth={1060}>
        {apiStructures.map((structure) => (
          <tr key={structure.id} className="even:bg-[#f7f9fb]">
            <Td>#{structure.id.slice(0, 8)}</Td>
            <Td>{structure.category}</Td>
            <Td>{structure.className || '—'}</Td>
            <Td>{structure.educationStage ? structure.educationStage.replaceAll('_', ' ') : '—'}</Td>
            <Td>{structure.studentGroup || (structure.classLevel ? `Level ${structure.classLevel}` : '—')}</Td>
            <Td amount><AmountDisplay amount={structure.amount} /></Td>
            <Td>{structure.effectiveTerm || 'Annual'}</Td>
            <Td><FinanceStatusBadge status={structure.active ? 'ACTIVE' : 'INACTIVE'} /></Td>
            <Td>
              <Button
                variant="secondary"
                className="rounded py-1.5 text-xs"
                disabled={deactivating === structure.id}
                onClick={() => handleDeactivate(structure.id)}
              >
                {deactivating === structure.id ? '…' : 'Deactivate'}
              </Button>
            </Td>
          </tr>
        ))}
      </FinanceTable>
    </FinanceWorkspaceShell>
  );
}

export function FeeMatrixPage() {
  type ColDef = { id: string; label: string; classIds: string[]; mirrorOf: string | null };

  const { data: rawCategories = [] } = useFeeCategories() as unknown as { data: typeof feeCategories };
  const { data: apiClasses = [] } = useFinanceClasses();
  const { data: apiStructures = [] } = useFeeStructures() as unknown as { data: typeof feeStructures };
  const { data: years = [] } = useFinanceAcademicYears();
  const { data: terms = [] } = useFinanceTerms();
  const createMutation = useCreateFeeStructureMutation();
  const updateMutation = useUpdateFeeStructureMutation();

  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [stageTab, setStageTab] = useState<'Primary' | 'O-Level' | 'A-Level'>('O-Level');
  const [columns, setColumns] = useState<ColDef[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>>>({});
  const [original, setOriginal] = useState<Record<string, Record<string, { amount: string; structureId: string | null }>>>({});
  const [matrixNeedsInit, setMatrixNeedsInit] = useState(true);
  const [editCell, setEditCell] = useState<{ cat: string; col: string } | null>(null);
  const [selCols, setSelCols] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [mirrorPicker, setMirrorPicker] = useState<string | null>(null);
  const [colMenu, setColMenu] = useState<string | null>(null);
  const [fillRow, setFillRow] = useState<{ catId: string; value: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const effectiveYearId = yearId || currentYear?.id || '';

  const categories = useMemo(
    () => [...(rawCategories as typeof feeCategories)].sort((a, b) => a.order - b.order),
    [rawCategories],
  );

  const stageClasses = useMemo(
    () =>
      apiClasses
        .filter((c) => {
          const norm = c.educationStage.replace(/_/g, '-');
          return norm === stageTab || c.educationStage === stageTab;
        })
        .sort((a, b) => a.level - b.level),
    [apiClasses, stageTab],
  );

  // Reset columns and signal matrix re-init on stage change
  useEffect(() => {
    if (!stageClasses.length) return;
    setColumns(stageClasses.map((c) => ({ id: c.id, label: c.name, classIds: [c.id], mirrorOf: null })));
    setSelCols(new Set());
    setGroupMode(false);
    setColMenu(null);
    setMirrorPicker(null);
    setEditCell(null);
    setMatrixNeedsInit(true);
  }, [stageTab, stageClasses.length]); // eslint-disable-line

  // Populate matrix from API structures (only on demand)
  useEffect(() => {
    if (!matrixNeedsInit || !columns.length || !categories.length) return;
    setMatrixNeedsInit(false);
    const newMat: Record<string, Record<string, string>> = {};
    const newOrig: Record<string, Record<string, { amount: string; structureId: string | null }>> = {};
    categories.forEach((cat) => {
      newMat[cat.id] = {};
      newOrig[cat.id] = {};
      columns.forEach((col) => {
        const struct = (apiStructures as typeof feeStructures).find((s) =>
          s.category === cat.name &&
          col.classIds.some((cid) => {
            const cls = apiClasses.find((c) => c.id === cid);
            return cls && s.className === cls.name;
          }),
        );
        const amt = struct ? String(struct.amount) : '';
        newMat[cat.id][col.id] = amt;
        newOrig[cat.id][col.id] = { amount: amt, structureId: struct?.id ?? null };
      });
    });
    setMatrix(newMat);
    setOriginal(newOrig);
  }, [matrixNeedsInit, columns, categories, apiStructures, apiClasses]);

  const effectiveAmt = (catId: string, colId: string): string => {
    const col = columns.find((c) => c.id === colId);
    return col?.mirrorOf ? (matrix[catId]?.[col.mirrorOf] ?? '') : (matrix[catId]?.[colId] ?? '');
  };

  const setCell = (catId: string, colId: string, val: string) =>
    setMatrix((p) => ({ ...p, [catId]: { ...(p[catId] ?? {}), [colId]: val } }));

  const dirtyCount = useMemo(() => {
    let n = 0;
    categories.forEach((cat) =>
      columns.forEach((col) => {
        const eff = col.mirrorOf ? (matrix[cat.id]?.[col.mirrorOf] ?? '') : (matrix[cat.id]?.[col.id] ?? '');
        if (eff !== (original[cat.id]?.[col.id]?.amount ?? '') && eff !== '') n++;
      }),
    );
    return n;
  }, [categories, columns, matrix, original]);

  const doGroup = () => {
    if (selCols.size < 2 || !groupName.trim()) return;
    const ids = [...selCols];
    const [first, ...rest] = ids;
    const allClassIds = ids.flatMap((id) => columns.find((c) => c.id === id)?.classIds ?? []);
    setColumns((prev) =>
      prev.filter((c) => !rest.includes(c.id)).map((c) =>
        c.id === first ? { ...c, label: groupName.trim(), classIds: allClassIds } : c,
      ),
    );
    const trimKeys = (prev: Record<string, Record<string, string>>) => {
      const next = { ...prev };
      Object.keys(next).forEach((cId) => { const r = { ...(next[cId] ?? {}) }; rest.forEach((id) => delete r[id]); next[cId] = r; });
      return next;
    };
    setMatrix(trimKeys);
    setOriginal((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((cId) => { const r = { ...(next[cId] ?? {}) }; rest.forEach((id) => delete r[id]); next[cId] = r; });
      return next;
    });
    setSelCols(new Set());
    setGroupName('');
    setGroupMode(false);
  };

  const discardChanges = () =>
    setMatrix((prev) => {
      const next = { ...prev };
      Object.entries(original).forEach(([cId, row]) => {
        next[cId] = { ...(next[cId] ?? {}) };
        Object.entries(row).forEach(([colId, v]) => { next[cId][colId] = v.amount; });
      });
      return next;
    });

  const handleSave = async () => {
    if (!effectiveYearId) { toast('Select an academic year', 'error'); return; }
    setIsSaving(true);
    try {
      let saved = 0;
      for (const cat of categories) {
        for (const col of columns) {
          const eff = effectiveAmt(cat.id, col.id);
          const orig = original[cat.id]?.[col.id];
          if (!eff || eff === (orig?.amount ?? '')) continue;
          const amount = Number(eff);
          if (isNaN(amount) || amount <= 0) continue;
          if (orig?.structureId) {
            await updateMutation.mutateAsync({ id: orig.structureId, body: { amount: String(amount) } });
            saved++;
          } else {
            for (const classId of col.classIds) {
              await createMutation.mutateAsync({ feeCategoryId: cat.id, classId, amount: String(amount), academicYearId: effectiveYearId, termId: termId || undefined, currency: 'TZS' });
              saved++;
            }
          }
        }
      }
      toast(`${saved} fee structure${saved === 1 ? '' : 's'} saved`, 'success');
      setOriginal((prev) => {
        const next = { ...prev };
        categories.forEach((cat) => {
          next[cat.id] = { ...(next[cat.id] ?? {}) };
          columns.forEach((col) => {
            const eff = effectiveAmt(cat.id, col.id);
            if (next[cat.id]?.[col.id] !== undefined) next[cat.id][col.id] = { ...next[cat.id][col.id], amount: eff };
          });
        });
        return next;
      });
    } catch {
      toast('Failed to save some structures', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const STAGE_TABS: Array<'Primary' | 'O-Level' | 'A-Level'> = ['Primary', 'O-Level', 'A-Level'];
  const cap = 'text-[11px] font-black uppercase tracking-widest text-[#64748b]';
  const filteredTerms = terms.filter((t) => !effectiveYearId || t.academicYearId === effectiveYearId);

  return (
    <FinanceWorkspaceShell title="Fee Matrix" eyebrow="Click cells to edit · group classes · mirror structures">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Matrix' }]} />

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className={cap}>Academic Year</p>
          <select value={effectiveYearId} onChange={(e) => setYearId(e.target.value)}
            className="mt-1 h-9 rounded border border-[#d5dde6] bg-white px-3 text-sm font-semibold text-[#00334f] outline-none focus:border-[#00334f]">
            {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' ✓' : ''}</option>)}
          </select>
        </div>
        <div>
          <p className={cap}>Term</p>
          <select value={termId} onChange={(e) => setTermId(e.target.value)}
            className="mt-1 h-9 rounded border border-[#d5dde6] bg-white px-3 text-sm font-semibold text-[#00334f] outline-none focus:border-[#00334f]">
            <option value="">All Terms</option>
            {filteredTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {groupMode ? (
            <>
              <span className="text-xs text-[#64748b]">{selCols.size} selected</span>
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doGroup()}
                placeholder="Group name (e.g. Form 1-2)"
                className="h-9 w-44 rounded border border-[#d5dde6] px-3 text-sm outline-none focus:border-[#00334f]" />
              <Button onClick={doGroup} disabled={selCols.size < 2 || !groupName.trim()}>
                <Layers className="h-4 w-4" /> Group
              </Button>
              <Button variant="secondary" onClick={() => { setGroupMode(false); setSelCols(new Set()); setGroupName(''); }}>
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => setGroupMode(true)}>
              <Layers className="h-4 w-4" /> Group Classes
            </Button>
          )}
        </div>
      </div>

      {/* ── Stage tabs ── */}
      <div className="flex w-fit gap-1 rounded-xl border border-[#d5dde6] bg-[#f7f9fb] p-1">
        {STAGE_TABS.map((s) => (
          <button key={s} onClick={() => setStageTab(s)}
            className={`rounded-lg px-5 py-1.5 text-sm font-bold transition-all ${stageTab === s ? 'bg-white shadow text-[#00334f]' : 'text-[#64748b] hover:text-[#00334f]'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-5 text-[11px] text-[#64748b]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-[#d5dde6] bg-white" /> Click cell to edit</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-[#d59a1b]/40 bg-[#fef3c7]" /> Unsaved change</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm border border-blue-200 bg-blue-50" /> Mirrored from another class</span>
        <span className="flex items-center gap-1.5"><Equal className="h-3 w-3" /> Fill entire row with one amount</span>
        <span className="flex items-center gap-1.5"><MoreHorizontal className="h-3 w-3" /> Column: group or mirror options</span>
      </div>

      {/* ── Matrix grid ── */}
      {!columns.length ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-[#d5dde6] bg-white p-16 text-sm text-[#64748b]">
          No classes found for <strong className="ml-1">{stageTab}</strong>. Add classes in the academic module first.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#d5dde6] bg-white"
          onClick={() => { setColMenu(null); setMirrorPicker(null); }}>
          <table className="min-w-max border-collapse">
            <thead>
              <tr className="bg-[#f7f9fb]">
                <th className="sticky left-0 z-20 min-w-[220px] bg-[#f7f9fb] border-b border-r border-[#d5dde6] px-4 py-3 text-left">
                  <span className={cap}>Fee Category</span>
                </th>
                {columns.map((col) => {
                  const mirrorSrc = col.mirrorOf ? columns.find((c) => c.id === col.mirrorOf) : null;
                  return (
                    <th key={col.id} className="relative min-w-[152px] border-b border-r border-[#d5dde6] px-2 py-2 text-center last:border-r-0">
                      <div className="flex flex-col items-center gap-0.5">
                        {groupMode && (
                          <input type="checkbox" checked={selCols.has(col.id)}
                            onChange={() => setSelCols((p) => { const n = new Set(p); n.has(col.id) ? n.delete(col.id) : n.add(col.id); return n; })}
                            className="mb-0.5 h-4 w-4 accent-[#00334f]"
                            onClick={(e) => e.stopPropagation()} />
                        )}
                        <span className="text-xs font-bold text-[#00334f]">{col.label}</span>
                        {col.classIds.length > 1 && (
                          <span className="rounded-full bg-[#00334f]/10 px-2 py-0.5 text-[10px] font-bold text-[#00334f]">
                            {col.classIds.length} classes
                          </span>
                        )}
                        {mirrorSrc && (
                          <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                            <Link2 className="h-2.5 w-2.5" /> {mirrorSrc.label}
                          </span>
                        )}
                        {/* Column menu */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setColMenu(colMenu === col.id ? null : col.id); setMirrorPicker(null); }}
                            className="mt-0.5 rounded p-0.5 text-[#94a3b8] hover:bg-[#e2e8f0] hover:text-[#00334f]">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                          {colMenu === col.id && (
                            <div className="absolute right-0 top-7 z-30 w-48 overflow-hidden rounded-lg border border-[#d5dde6] bg-white shadow-xl">
                              {mirrorPicker !== col.id ? (
                                <>
                                  <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-[#00334f] hover:bg-[#f7f9fb]"
                                    onClick={() => setMirrorPicker(col.id)}>
                                    <Link2 className="h-3.5 w-3.5 text-blue-500" /> Same as…
                                  </button>
                                  {col.mirrorOf && (
                                    <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-[#00334f] hover:bg-[#f7f9fb]"
                                      onClick={() => { setColumns((p) => p.map((c) => c.id === col.id ? { ...c, mirrorOf: null } : c)); setColMenu(null); }}>
                                      <Link2Off className="h-3.5 w-3.5 text-orange-400" /> Break mirror
                                    </button>
                                  )}
                                  {col.classIds.length > 1 && (
                                    <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                                      onClick={() => {
                                        const restored = col.classIds.map((cid) => {
                                          const cls = apiClasses.find((c) => c.id === cid);
                                          return { id: cid, label: cls?.name ?? cid, classIds: [cid], mirrorOf: null as null };
                                        });
                                        setColumns((prev) => {
                                          const others = prev.filter((c) => c.id !== col.id);
                                          return [...others, ...restored].sort((a, b) =>
                                            stageClasses.findIndex((c) => c.id === a.classIds[0]) - stageClasses.findIndex((c) => c.id === b.classIds[0]),
                                          );
                                        });
                                        setColMenu(null);
                                      }}>
                                      Ungroup
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="p-2">
                                  <p className="mb-1.5 text-[10px] font-black uppercase text-[#64748b]">Copy amounts from</p>
                                  <div className="max-h-40 overflow-y-auto">
                                    {columns.filter((c) => c.id !== col.id).map((c) => (
                                      <button key={c.id}
                                        className="flex w-full items-center rounded px-2 py-1.5 text-left text-xs text-[#00334f] hover:bg-[#f7f9fb]"
                                        onClick={() => {
                                          setColumns((p) => p.map((cc) => cc.id === col.id ? { ...cc, mirrorOf: c.id } : cc));
                                          setColMenu(null);
                                          setMirrorPicker(null);
                                        }}>
                                        {c.label}
                                      </button>
                                    ))}
                                  </div>
                                  <button className="mt-1.5 px-1 text-[10px] text-[#64748b] hover:text-[#00334f]"
                                    onClick={() => setMirrorPicker(null)}>← Back</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
                <th className="min-w-[130px] border-b border-[#d5dde6] bg-[#f0f4f8] px-4 py-3 text-right">
                  <span className={cap}>Row Total</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat, ri) => {
                const rowTotal = columns.reduce((s, col) => s + (Number(effectiveAmt(cat.id, col.id)) || 0), 0);
                const even = ri % 2 === 0;
                return (
                  <tr key={cat.id}>
                    <td className="sticky left-0 z-10 border-b border-r border-[#d5dde6] px-4 py-2.5"
                      style={{ background: even ? '#ffffff' : '#f9fafb' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-[#00334f]">{cat.name}</p>
                          <p className="mt-0.5 text-[10px] text-[#94a3b8]">
                            {cat.mandatory ? '● Mandatory' : '○ Optional'} · {cat.frequency}
                          </p>
                        </div>
                        <button title="Fill all columns with same amount"
                          onClick={(e) => { e.stopPropagation(); setFillRow({ catId: cat.id, value: '' }); }}
                          className="shrink-0 rounded p-1 text-[#94a3b8] hover:bg-[#e2e8f0] hover:text-[#00334f]">
                          <Equal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {fillRow?.catId === cat.id && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <input autoFocus value={fillRow.value}
                            onChange={(e) => setFillRow((f) => f && { ...f, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                columns.forEach((col) => { if (!col.mirrorOf) setCell(cat.id, col.id, fillRow.value); });
                                setFillRow(null);
                              }
                              if (e.key === 'Escape') setFillRow(null);
                            }}
                            placeholder="Amount for all"
                            className="h-7 w-28 rounded border border-[#d59a1b] px-2 text-xs outline-none" />
                          <button className="text-[10px] font-bold text-[#d59a1b]"
                            onClick={() => { columns.forEach((col) => { if (!col.mirrorOf) setCell(cat.id, col.id, fillRow.value); }); setFillRow(null); }}>
                            Apply
                          </button>
                          <button className="text-[10px] text-[#94a3b8]" onClick={() => setFillRow(null)}>✕</button>
                        </div>
                      )}
                    </td>
                    {columns.map((col) => {
                      const isMirror = !!col.mirrorOf;
                      const eff = effectiveAmt(cat.id, col.id);
                      const orig = original[cat.id]?.[col.id]?.amount ?? '';
                      const isDirty = eff !== orig && eff !== '';
                      const isEditing = editCell?.cat === cat.id && editCell?.col === col.id;
                      const cellBg = isMirror ? '#eff6ff' : isDirty ? '#fef3c7' : even ? '#ffffff' : '#f9fafb';
                      return (
                        <td key={col.id}
                          onClick={() => { if (!isMirror) { setEditCell({ cat: cat.id, col: col.id }); setColMenu(null); setMirrorPicker(null); } }}
                          style={{ background: cellBg }}
                          className={`relative border-b border-r border-[#d5dde6] px-2 py-2 text-right last:border-r-0 transition-colors ${isMirror ? 'cursor-default' : 'cursor-pointer'}`}>
                          {isEditing && !isMirror ? (
                            <input autoFocus
                              value={matrix[cat.id]?.[col.id] ?? ''}
                              onChange={(e) => setCell(cat.id, col.id, e.target.value)}
                              onBlur={() => setEditCell(null)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') setEditCell(null);
                                if (e.key === 'Tab') { e.preventDefault(); setEditCell(null); }
                                if (e.key === 'Escape') { setCell(cat.id, col.id, orig); setEditCell(null); }
                              }}
                              className="h-8 w-full rounded border border-[#00334f] bg-white px-2 text-right text-sm font-bold text-[#00334f] outline-none" />
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              {isDirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#d59a1b]" />}
                              {isMirror && <Link2 className="h-3 w-3 shrink-0 text-blue-400" />}
                              <span className={`text-sm font-bold tabular-nums ${eff ? 'text-[#00334f]' : 'text-[#cbd5e1]'}`}>
                                {eff ? formatTZS(Number(eff)) : '—'}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-[#d5dde6] bg-[#f0f4f8] px-3 py-2 text-right">
                      <span className="text-sm font-bold tabular-nums text-[#00334f]">{rowTotal ? formatTZS(rowTotal) : '—'}</span>
                    </td>
                  </tr>
                );
              })}
              {/* ── Column totals row ── */}
              <tr className="bg-[#00334f]">
                <td className="sticky left-0 z-10 bg-[#00334f] px-4 py-3">
                  <span className="text-xs font-black uppercase tracking-widest text-white/70">Total / Student</span>
                </td>
                {columns.map((col) => {
                  const tot = categories.reduce((s, cat) => s + (Number(effectiveAmt(cat.id, col.id)) || 0), 0);
                  return (
                    <td key={col.id} className="px-3 py-3 text-right">
                      <span className="text-sm font-black tabular-nums text-[#f0c040]">{tot ? formatTZS(tot) : '—'}</span>
                    </td>
                  );
                })}
                <td className="bg-[#001e2e] px-3 py-3 text-right">
                  <span className="text-sm font-black tabular-nums text-[#f0c040]">
                    {formatTZS(categories.reduce((rs, cat) => rs + columns.reduce((s, col) => s + (Number(effectiveAmt(cat.id, col.id)) || 0), 0), 0))}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Save bar ── */}
      {dirtyCount > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-xl border border-[#d59a1b]/40 bg-[#fffbeb] px-5 py-3.5 shadow-xl">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#d59a1b]" />
            <span className="text-sm font-bold text-[#7a5200]">
              {dirtyCount} unsaved change{dirtyCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={discardChanges}>Discard</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : `Save ${dirtyCount} change${dirtyCount !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </FinanceWorkspaceShell>
  );
}

export function CreateFeeStructurePage() {
  const navigate = useNavigate();
  const createMutation = useCreateFeeStructureMutation();
  const { data: apiCategories = [] as typeof feeCategories } = useFeeCategories() as unknown as { data: typeof feeCategories };
  const { data: classes = [] } = useFinanceClasses();
  const { data: years = [] } = useFinanceAcademicYears();
  const { data: terms = [] } = useFinanceTerms();

  const [mode, setMode] = useState<'class' | 'stage' | 'group'>('class');
  const [categoryId, setCategoryId] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [termId, setTermId] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [educationStage, setEducationStage] = useState('O_LEVEL');
  const [classLevel, setClassLevel] = useState('');
  const [studentGroup, setStudentGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Default to current academic year once loaded
  const currentYear = years.find((y) => y.isCurrent) ?? years[0];
  const effectiveYearId = academicYearId || currentYear?.id || '';
  const yearTerms = terms.filter((t) => !effectiveYearId || t.academicYearId === effectiveYearId);

  const sel = 'mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]';
  const cap = 'text-[11px] font-black uppercase tracking-widest text-[#64748b]';

  const toggleClass = (id: string) => setSelectedClasses((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const classesByStage = classes.reduce<Record<string, typeof classes>>((acc, c) => { (acc[c.educationStage] ??= []).push(c); return acc; }, {});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId || !amount) { toast('Fee category and amount are required', 'error'); return; }
    if (!effectiveYearId) { toast('Academic year is required', 'error'); return; }
    const base = { feeCategoryId: categoryId, academicYearId: effectiveYearId, termId: termId || undefined, amount: String(amount), currency: 'TZS' };

    let payloads: Record<string, unknown>[] = [];
    if (mode === 'class') {
      if (!selectedClasses.length) { toast('Select at least one class', 'error'); return; }
      payloads = selectedClasses.map((classId) => ({ ...base, classId }));
    } else if (mode === 'stage') {
      payloads = [{ ...base, educationStage, classLevel: classLevel ? Number(classLevel) : undefined }];
    } else {
      if (!studentGroup) { toast('Select a student group', 'error'); return; }
      payloads = [{ ...base, studentGroup }];
    }

    setSubmitting(true);
    try {
      let ok = 0;
      for (const body of payloads) { await createMutation.mutateAsync(body); ok++; }
      toast(`${ok} fee structure${ok === 1 ? '' : 's'} created`, 'success');
      navigate('/finance/fee-structures');
    } catch {
      toast('Failed to create one or more fee structures', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FinanceWorkspaceShell title="Create Fee Structure" eyebrow="Class-wise fee definition">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Create Structure' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex items-center gap-3 border-b border-[#d5dde6] pb-4">
            <FileSpreadsheet className="h-5 w-5 text-[#00334f]" />
            <div>
              <h2 className="font-display text-xl font-black text-[#00334f]">Create Fee Structure</h2>
              <p className="text-sm font-semibold text-[#64748b]">Define a fee amount and apply it to specific classes, a stage/level, or a student group.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className={cap}>Fee Category *</span>
              <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={sel}>
                <option value="">Select category…</option>
                {apiCategories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </label>
            <label className="block">
              <span className={cap}>Amount per class (TZS) *</span>
              <input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={sel} placeholder="e.g. 450000" />
            </label>
            <label className="block">
              <span className={cap}>Academic Year *</span>
              <select value={effectiveYearId} onChange={(e) => setAcademicYearId(e.target.value)} className={sel}>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (current)' : ''}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={cap}>Term</span>
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className={sel}>
                <option value="">All terms / annual</option>
                {yearTerms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isCurrent ? ' (current)' : ''}</option>)}
              </select>
            </label>
          </div>

          {/* Targeting mode */}
          <div className="mt-6">
            <span className={cap}>Apply to</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {([['class', 'Specific classes'], ['stage', 'Stage / level'], ['group', 'Student group']] as const).map(([m, lbl]) => (
                <button type="button" key={m} onClick={() => setMode(m)}
                  className={`rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${mode === m ? 'bg-[#00334f] text-white' : 'border border-[#d5dde6] bg-white text-[#64748b] hover:bg-[#eef5f8]'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {mode === 'class' && (
            <div className="mt-4 space-y-4">
              {Object.entries(classesByStage).map(([stage, list]) => (
                <div key={stage}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] font-black uppercase tracking-widest text-[#00334f]">{stage.replaceAll('_', ' ')}</p>
                    <button type="button" className="text-[11px] font-black uppercase text-[#0284c7] hover:underline"
                      onClick={() => { const ids = list.map((c) => c.id); const allSel = ids.every((id) => selectedClasses.includes(id)); setSelectedClasses((p) => allSel ? p.filter((x) => !ids.includes(x)) : [...new Set([...p, ...ids])]); }}>
                      Toggle all
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {list.map((c) => (
                      <label key={c.id} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm font-bold transition ${selectedClasses.includes(c.id) ? 'border-[#00334f] bg-[#eef5f8] text-[#00334f]' : 'border-[#d5dde6] bg-white text-[#475569]'}`}>
                        <input type="checkbox" checked={selectedClasses.includes(c.id)} onChange={() => toggleClass(c.id)} className="accent-[#00334f]" />
                        {c.name}{c.stream ? ` ${c.stream}` : ''}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {!classes.length && <p className="text-sm font-semibold text-[#64748b]">Loading classes…</p>}
            </div>
          )}

          {mode === 'stage' && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className={cap}>Education Stage</span>
                <select value={educationStage} onChange={(e) => setEducationStage(e.target.value)} className={sel}>
                  <option value="PRIMARY">Primary</option><option value="O_LEVEL">O-Level</option><option value="A_LEVEL">A-Level</option>
                </select>
              </label>
              <label className="block">
                <span className={cap}>Class Level (number, optional)</span>
                <input type="number" value={classLevel} onChange={(e) => setClassLevel(e.target.value)} className={sel} placeholder="e.g. 3 for Form 3" />
              </label>
            </div>
          )}

          {mode === 'group' && (
            <div className="mt-4">
              <label className="block max-w-sm">
                <span className={cap}>Student Group Code</span>
                <input value={studentGroup} onChange={(e) => setStudentGroup(e.target.value)} className={sel} placeholder="e.g. BOARDING" />
              </label>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={submitting}>
              <Send className="h-4 w-4" /> {submitting ? 'Creating…' : mode === 'class' && selectedClasses.length > 1 ? `Create ${selectedClasses.length} Structures` : 'Create Structure'}
            </Button>
            <Button type="button" variant="secondary" className="rounded" onClick={() => navigate('/finance/fee-structures')}>Cancel</Button>
          </div>
        </form>
        <SideSummary title="Impact Preview" items={[
          ['Category', categoryId ? (apiCategories.find((c) => c.id === categoryId)?.name ?? '—') : '—'],
          ['Amount', amount ? formatTZS(Number(amount)) : '—'],
          ['Applies to', mode === 'class' ? `${selectedClasses.length} class(es)` : mode === 'stage' ? `${educationStage.replaceAll('_', ' ')}${classLevel ? ` · L${classLevel}` : ''}` : (studentGroup || 'group')],
          ['Term', termId ? (yearTerms.find((t) => t.id === termId)?.name ?? '—') : 'Annual'],
        ]} />
      </div>
    </FinanceWorkspaceShell>
  );
}

export function FeeAssignmentsPage() {
  const { data: apiAssignments = [] as typeof feeAssignments, isLoading, isError, refetch } = useFeeAssignments() as unknown as { data: typeof feeAssignments; isLoading: boolean; isError: boolean; refetch: () => void };
  const removeMutation = useDeleteFeeAssignmentMutation();
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <FinanceWorkspaceShell title="Optional Fee Assignments" eyebrow="Student and bulk assignment">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Assignments' }]} />
      <FinanceFilters items={['Fee category', 'Class', 'Term', 'Effective date']} />
      {isLoading ? <SkeletonTable cols={8} /> : isError ? <DataError onRetry={refetch} /> : apiAssignments.length === 0 ? <EmptyState title="No fee assignments" description="Assign optional fees to students individually or in bulk." /> : (
      <FinanceTable columns={['Assignment', 'Student', 'Class', 'Category', 'Amount', 'Term', 'Effective', 'Actions']} minWidth={900}>
        {apiAssignments.map((assignment) => (
          <tr key={assignment.id} className="even:bg-[#f7f9fb]">
            <Td>{assignment.id}</Td>
            <Td>{assignment.student}</Td>
            <Td>{assignment.className}</Td>
            <Td>{assignment.category}</Td>
            <Td amount><AmountDisplay amount={assignment.amount} /></Td>
            <Td>{assignment.term}</Td>
            <Td>{assignment.effectiveDate}</Td>
            <Td>
              <Button variant="secondary" className="rounded py-1.5 text-xs" disabled={removing === assignment.id || removeMutation.isPending}
                onClick={() => {
                  setRemoving(assignment.id);
                  removeMutation.mutate(assignment.id, {
                    onSuccess: () => { toast('Fee assignment removed', 'warning'); setRemoving(null); },
                    onError: () => { toast('Failed to remove assignment', 'error'); setRemoving(null); },
                  });
                }}>
                {removing === assignment.id ? '…' : 'Remove'}
              </Button>
            </Td>
          </tr>
        ))}
      </FinanceTable>
      )}
    </FinanceWorkspaceShell>
  );
}

// ─── Asset pages ──────────────────────────────────────────────────────────────

export function AssetsListPage() {
  const { data: apiAssets = [] as typeof assets, isLoading: assetsLoading, isError: assetsError, refetch: refetchAssets } = useAssets() as unknown as { data: typeof assets; isLoading: boolean; isError: boolean; refetch: () => void };
  const { data: apiAssetSummary } = useAssetSummary() as { data: Record<string, unknown> | undefined };
  const { data: fixedRegister } = useFixedAssetRegister() as { data: any };
  const totalCost = (apiAssetSummary?.totalPurchaseCost as number | undefined) ?? 0;
  const currentValue = Number(apiAssetSummary?.fixedAssetValue ?? apiAssetSummary?.totalCurrentValue ?? 0);
  const groupedCount = Number(apiAssetSummary?.groupedAssets ?? 0);
  const componentCount = Number(apiAssetSummary?.componentAssets ?? 0);
  return (
    <FinanceWorkspaceShell title="School Assets Ledger" eyebrow="Assets, values, disposal">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets' }]} />
      <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Asset Entry</p>
            <h3 className="font-display text-xl font-black text-[#00334f]">Register assets or build grouped ledgers</h3>
            <p className="text-sm font-semibold text-[#64748b]">Create a classroom/building ledger first, then add chairs, desks, boards and other items inside it.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavLink to="/finance/assets/create?mode=single">
              <Button variant="secondary" className="rounded"><Plus className="h-4 w-4" /> Single Asset</Button>
            </NavLink>
            <NavLink to="/finance/assets/create?mode=group">
              <Button className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none"><Layers className="h-4 w-4" /> Grouped Ledger</Button>
            </NavLink>
            <NavLink to="/finance/assets/create?mode=component">
              <Button variant="secondary" className="rounded"><Package className="h-4 w-4" /> Item in Group</Button>
            </NavLink>
          </div>
        </div>
      </div>
      <FinanceMetricStrip items={[
        {
          label: 'Purchase Cost',
          value: formatTZS(totalCost),
          detail: `${apiAssets.length} tracked assets`,
          tone: 'navy',
        },
        {
          label: 'Current Value',
          value: formatTZS(currentValue),
          detail: 'Whole-school fixed asset value',
          tone: 'green',
          trend: 'down',
          progress: totalCost > 0 ? Math.round((currentValue / totalCost) * 100) : 0,
        },
        {
          label: 'Grouped Ledgers',
          value: String(groupedCount),
          detail: `${componentCount} component records`,
          tone: 'gold',
          trend: 'up',
        },
        {
          label: 'Disposed',
          value: String((apiAssetSummary?.disposed as number | undefined) ?? 0),
          detail: 'This academic year',
          tone: 'slate',
        },
      ]} />
      {fixedRegister && (
        <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Fixed Asset Register</p>
              <h3 className="font-display text-xl font-black text-[#00334f]">Whole-school asset valuation</h3>
              <p className="text-sm font-semibold text-[#64748b]">Grouped classroom/building ledgers plus standalone assets.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Total Value</p>
              <p className="font-mono text-2xl font-black tabular-nums text-[#047857]">{formatTZS(Number(fixedRegister.totalValue ?? 0))}</p>
            </div>
          </div>
          {Array.isArray(fixedRegister.groups) && fixedRegister.groups.length > 0 && (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {fixedRegister.groups.slice(0, 6).map((group: any) => (
                <NavLink key={group.id} to={`/finance/assets/${group.id}`} className="rounded border border-[#e2e8f0] bg-[#f8fafc] p-3 transition hover:border-[#00334f]/30 hover:bg-white">
                  <p className="truncate text-sm font-black text-[#00334f]">{group.name}</p>
                  <p className="mt-1 text-xs font-semibold text-[#64748b]">{group.location || 'No location'} - {group.childCount ?? group.childAssets?.length ?? 0} items</p>
                  <p className="mt-2 font-mono text-sm font-black text-[#0f172a]">{formatTZS(Number(group.groupCurrentValue ?? group.currentValue ?? 0))}</p>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      )}
      {assetsLoading ? (
        <SkeletonCards count={6} cols="xl:grid-cols-3" />
      ) : assetsError ? (
        <DataError onRetry={refetchAssets} />
      ) : !apiAssets.length ? (
        <EmptyState title="No assets registered" description="Register school assets to track their value and maintenance schedule." action={{ label: 'Register Asset', href: '/finance/assets/create' }} />
      ) : (
        <div className="grid gap-gutter xl:grid-cols-3">
          {apiAssets.map((asset) => <AssetCard key={asset.id} asset={asset} />)}
        </div>
      )}
    </FinanceWorkspaceShell>
  );
}

export function CreateAssetPage() {
  return <AssetForm title="Register New Asset" mode="create" />;
}

export function EditAssetPage() {
  return <AssetForm title="Edit Asset" mode="edit" />;
}

function AssetForm({ title, mode }: { title: string; mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { data: apiAsset } = useAssetById(id ?? '') as { data: (typeof assets)[number] | undefined };
  const { data: assetParents = [] } = useAssets() as unknown as { data: Array<any> };
  const createMutation = useCreateAssetMutation();
  const updateMutation = useUpdateAssetMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [assetMode, setAssetMode] = useState<'single' | 'group' | 'component'>('single');
  const [form, setForm] = useState({ name: '', category: 'ELECTRONICS', type: 'MOVABLE', condition: 'GOOD', status: 'ACTIVE', groupType: 'CLASSROOM', parentAssetId: '', quantity: '1', unitCost: '', brand: '', model: '', serialNumber: '', purchaseDate: '', purchaseCost: '', currentValue: '', location: '', assignedTo: '', warrantyExpiry: '' });

  useEffect(() => {
    if (mode === 'create') {
      const requestedMode = searchParams.get('mode');
      const parent = searchParams.get('parent');
      if (requestedMode === 'group' || requestedMode === 'component' || requestedMode === 'single') setAssetMode(requestedMode);
      if (parent) setForm((p) => ({ ...p, parentAssetId: parent }));
    }
  }, [mode, searchParams]);

  useEffect(() => {
    if (apiAsset) {
      const a = apiAsset as Record<string, unknown>;
      const dateOnly = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '');
      setAssetMode(a.isGroup ? 'group' : a.parentAssetId ? 'component' : 'single');
      setForm({ name: String(a.name ?? ''), category: String(a.category ?? 'ELECTRONICS'), type: String(a.type ?? 'MOVABLE'), condition: String(a.condition ?? 'GOOD'), status: String(a.status ?? 'ACTIVE'), groupType: String(a.groupType ?? 'CLASSROOM'), parentAssetId: String(a.parentAssetId ?? ''), quantity: String(a.quantity ?? '1'), unitCost: String(a.unitCost ?? ''), brand: String(a.brand ?? ''), model: String(a.model ?? ''), serialNumber: String(a.serialNumber ?? ''), purchaseDate: dateOnly(a.purchaseDate), purchaseCost: String(a.purchaseCost ?? ''), currentValue: String(a.currentValue ?? ''), location: String(a.location ?? ''), assignedTo: String(a.assignedTo ?? ''), warrantyExpiry: dateOnly(a.warrantyExpiryDate ?? a.warrantyExpiry) });
    }
  }, [apiAsset?.id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Asset name is required', 'error'); return; }
    const body: Record<string, unknown> = {
      name: form.name, category: form.category, type: form.type, condition: form.condition, status: form.status,
      isGroup: assetMode === 'group',
      groupType: assetMode === 'group' ? form.groupType : undefined,
      parentAssetId: assetMode === 'component' ? form.parentAssetId : undefined,
      quantity: assetMode === 'component' ? form.quantity : '1',
      unitCost: assetMode === 'component' ? form.unitCost || form.purchaseCost : undefined,
      brand: form.brand || undefined, model: form.model || undefined, serialNumber: form.serialNumber || undefined,
      purchaseDate: form.purchaseDate || undefined,
      purchaseCost: assetMode === 'group' ? undefined : form.purchaseCost ? String(form.purchaseCost) : undefined,
      currentValue: assetMode === 'group' ? undefined : form.currentValue ? String(form.currentValue) : undefined,
      location: form.location || undefined, assignedTo: form.assignedTo || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
    };
    if (assetMode === 'component' && !form.parentAssetId) { toast('Select the group ledger this item belongs to', 'error'); return; }
    if (mode === 'create') {
      createMutation.mutate(body, {
        onSuccess: () => { toast('Asset registered', 'success'); navigate('/finance/assets'); },
        onError: () => toast('Failed to register asset', 'error'),
      });
    } else if (id) {
      updateMutation.mutate({ id, body }, {
        onSuccess: () => { toast('Asset updated', 'success'); navigate('/finance/assets'); },
        onError: () => toast('Failed to update asset', 'error'),
      });
    }
  };

  const selectDefs: [string, keyof typeof form, readonly string[]][] = [
    ['Category', 'category', ['FURNITURE', 'ELECTRONICS', 'VEHICLE', 'BUILDING', 'EQUIPMENT', 'LABORATORY', 'LIBRARY', 'SPORTS', 'OTHER']],
    ['Type', 'type', ['FIXED', 'MOVABLE']],
    ['Condition', 'condition', ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CONDEMNED']],
    ['Status', 'status', ['ACTIVE', 'UNDER_MAINTENANCE', 'DISPOSED', 'LOST', 'STOLEN']],
  ];
  const fieldDefs: [string, keyof typeof form, string, string][] = [
    ['Brand', 'brand', 'e.g. Dell', 'text'],
    ['Model', 'model', 'e.g. XPS 15', 'text'],
    ['Serial Number', 'serialNumber', 'e.g. SN-12345', 'text'],
    ['Purchase Date', 'purchaseDate', '', 'date'],
    ['Purchase Cost (TZS)', 'purchaseCost', 'e.g. 2500000', 'number'],
    ['Current Value (TZS)', 'currentValue', 'e.g. 1800000', 'number'],
    ['Location', 'location', 'e.g. Lab 1', 'text'],
    ['Assigned To', 'assignedTo', 'e.g. ICT Department', 'text'],
    ['Warranty Expiry', 'warrantyExpiry', '', 'date'],
  ];
  const structureTitle =
    assetMode === 'group' ? 'Create Grouped Asset Ledger' :
    assetMode === 'component' ? 'Add Item to Group Ledger' :
    title;
  const submitLabel =
    mode === 'edit' ? 'Save Changes' :
    assetMode === 'group' ? 'Create Grouped Ledger' :
    assetMode === 'component' ? 'Add Item to Ledger' :
    'Register Asset';

  return (
    <FinanceWorkspaceShell title={structureTitle} eyebrow="Asset control">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets', to: '/finance/assets' }, { label: mode === 'create' ? 'Register Asset' : 'Edit Asset' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex items-center gap-3 border-b border-[#d5dde6] pb-4">
            <FileSpreadsheet className="h-5 w-5 text-[#00334f]" />
            <div>
              <h2 className="font-display text-xl font-black text-[#00334f]">{structureTitle}</h2>
              <p className="text-sm font-semibold text-[#64748b]">Register standalone assets, grouped ledgers, or the items inside a group.</p>
            </div>
          </div>
          <div className="mt-5">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Asset structure</span>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {([
                ['single', 'Single asset', 'One asset such as a vehicle, laptop, or machine.'],
                ['group', 'Grouped ledger', 'A classroom, building, lab, dormitory, or office containing many items.'],
                ['component', 'Item inside group', 'Chairs, desks, boards, fixtures, and other counted items.'],
              ] as const).map(([modeKey, label, desc]) => (
                <button
                  key={modeKey}
                  type="button"
                  onClick={() => setAssetMode(modeKey)}
                  className={`rounded-lg border p-3 text-left transition ${assetMode === modeKey ? 'border-[#00334f] bg-[#eef5f8]' : 'border-[#d5dde6] bg-white hover:bg-[#f8fafc]'}`}
                >
                  <p className="text-sm font-black text-[#00334f]">{label}</p>
                  <p className="mt-1 text-xs font-semibold text-[#64748b]">{desc}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Name *</span>
              <input required value={form.name} onChange={set('name')} placeholder={assetMode === 'group' ? 'e.g. Form Four A Classroom' : assetMode === 'component' ? 'e.g. Student chairs' : 'e.g. Toyota Hiace School Van'} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
            </label>
            {assetMode === 'group' && (
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Group Type</span>
                <select value={form.groupType} onChange={set('groupType')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10">
                  {['CLASSROOM', 'BUILDING', 'LABORATORY', 'OFFICE', 'DORMITORY', 'LIBRARY', 'STORE', 'OTHER'].map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
            )}
            {assetMode === 'component' && (
              <>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Belongs to Group *</span>
                  <select value={form.parentAssetId} onChange={set('parentAssetId')} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10">
                    <option value="">Select classroom / group ledger</option>
                    {assetParents.filter((asset) => asset.isGroup).map((asset) => <option key={asset.id} value={asset.id}>{asset.name} - {asset.location || asset.groupType}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Quantity</span>
                  <input type="number" value={form.quantity} onChange={set('quantity')} placeholder="45" className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Unit Cost (TZS)</span>
                  <input type="number" value={form.unitCost} onChange={set('unitCost')} placeholder="35000" className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
                </label>
              </>
            )}
            {selectDefs.map(([label, key, opts]) => (
              <label key={key} className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">{label}</span>
                <select value={form[key]} onChange={set(key)} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10">
                  {opts.map((o) => <option key={o} value={o}>{o.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
            ))}
            {fieldDefs.map(([label, key, placeholder, type]) => (
              <label key={key} className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">{label}</span>
                <input type={type} value={form[key]} onChange={set(key)} placeholder={placeholder} className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
              </label>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="submit" className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={isPending}>
              <Send className="h-4 w-4" /> {isPending ? 'Saving...' : submitLabel}
            </Button>
            <Button type="button" variant="secondary" className="rounded" onClick={() => navigate('/finance/assets')}>Cancel</Button>
          </div>
        </form>
        <SideSummary title="Audit Guard" items={[
          ['Asset', form.name || '—'],
          ['Location', form.location || '—'],
          ['Value', form.currentValue ? formatTZS(Number(form.currentValue)) : '—'],
          ['Disposal', 'Separate workflow'],
        ]} />
      </div>
    </FinanceWorkspaceShell>
  );
}

export function AssetDetailPage() {
  const { id } = useParams();
  const { data: apiAsset, isLoading } = useAssetById(id ?? '') as unknown as { data: (typeof assets)[number] | undefined; isLoading: boolean; isError: boolean };
  const disposeMutation = useDisposeAssetMutation();
  const navigate = useNavigate();

  if (isLoading) return <FinanceWorkspaceShell title="Loading…" eyebrow="Asset profile"><SkeletonTable cols={4} /></FinanceWorkspaceShell>;
  if (!apiAsset) return <FinanceWorkspaceShell title="Not Found" eyebrow="Asset profile"><EmptyState title="Asset not found" description="This asset does not exist or has been removed." /></FinanceWorkspaceShell>;

  const asset = apiAsset;
  const childAssets = Array.isArray((asset as any).childAssets) ? (asset as any).childAssets : [];
  const isGroup = (asset as any).isGroup === true;
  return (
    <FinanceWorkspaceShell title={asset.name} eyebrow="Asset profile">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets', to: '/finance/assets' }, { label: asset.name }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            { label: isGroup ? 'Ledger Cost' : 'Purchase Cost', value: formatTZS(asset.purchaseCost), detail: isGroup ? `${childAssets.length} item types` : `Purchased ${formatDate(asset.purchaseDate)}`, tone: 'navy' },
            { label: isGroup ? 'Ledger Value' : 'Current Value', value: formatTZS(asset.currentValue), detail: isGroup ? 'Rolled up from items inside' : `Condition: ${asset.condition}`, tone: 'green', trend: 'down', progress: asset.purchaseCost > 0 ? Math.round((asset.currentValue / asset.purchaseCost) * 100) : 0 },
            { label: 'Location', value: asset.location, detail: `Assigned to: ${asset.assignedTo}`, tone: 'slate' },
            { label: 'Warranty', value: asset.warrantyExpiry, detail: asset.brand, tone: asset.warrantyExpiry === 'Expired' ? 'red' : 'gold', trend: asset.warrantyExpiry === 'Expired' ? 'down' : undefined },
          ]} />
          {isGroup && (
            <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Grouped Asset Ledger</p>
                  <h3 className="font-display text-lg font-black text-[#00334f]">Items inside {asset.name}</h3>
                </div>
                <NavLink to={`/finance/assets/create?mode=component&parent=${asset.id}`}><Button variant="secondary" className="rounded"><Plus className="h-4 w-4" /> Add item</Button></NavLink>
              </div>
              {!childAssets.length ? (
                <EmptyState title="No items inside this group" description="Add chairs, boards, desks, equipment or fixtures to build this asset ledger." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-[#eef5f8]">
                      <tr>{['Item', 'Category', 'Qty', 'Unit Cost', 'Total Cost', 'Current Value', 'Condition'].map((col) => <th key={col} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{col}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {childAssets.map((item: any) => (
                        <tr key={item.id} className="even:bg-[#f7f9fb]">
                          <td className="px-4 py-2.5 font-bold text-[#0f172a]">{item.name}</td>
                          <td className="px-4 py-2.5 text-[#475569]">{String(item.category ?? '').replaceAll('_', ' ')}</td>
                          <td className="px-4 py-2.5 font-mono font-black tabular-nums text-[#0f172a]">{Number(item.quantity ?? 1).toLocaleString('en-US')}</td>
                          <td className="px-4 py-2.5 font-mono font-semibold tabular-nums text-[#475569]">{formatTZS(Number(item.unitCost ?? 0))}</td>
                          <td className="px-4 py-2.5 font-mono font-black tabular-nums text-[#0f172a]">{formatTZS(Number(item.purchaseCost ?? 0))}</td>
                          <td className="px-4 py-2.5 font-mono font-black tabular-nums text-[#047857]">{formatTZS(Number(item.currentValue ?? 0))}</td>
                          <td className="px-4 py-2.5 text-[#475569]">{item.condition}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <Timeline rows={['Asset registered', 'Location verified', 'Depreciation reviewed', 'Disposal requires admin confirmation']} />
        </div>
        <div className="space-y-gutter sticky top-24 h-fit">
          <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Asset Controls</p>
            <div className="mt-4 space-y-2">
              <NavLink to={`/finance/assets/${asset.id}/edit`}><Button variant="secondary" className="w-full justify-between rounded"><span>Edit asset</span><ArrowRight className="h-4 w-4" /></Button></NavLink>
              <Button variant="secondary" className="w-full justify-between rounded"
                onClick={() => { const reason = window.prompt('Reason for disposing this asset:'); if (!reason) return; disposeMutation.mutate({ id: asset.id, body: { reason } }, { onSuccess: () => { toast('Asset disposed and recorded', 'warning'); navigate('/finance/assets'); }, onError: () => toast('Failed to dispose asset', 'error') }); }}>
                <span>{disposeMutation.isPending ? 'Disposing…' : 'Dispose with reason'}</span><ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Report pages ─────────────────────────────────────────────────────────────

export function FinancialReportsPage() {
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as unknown as { data: typeof financeOverview };
  const { data: summary } = useCollectionSummary() as unknown as {
    data?: { totalInvoiced?: number; totalCollected?: number; outstanding?: number; collectionRate?: number };
  };
  const { data: balances = [] } = useOutstandingBalances() as unknown as {
    data: Array<{ outstanding?: number; daysOverdue?: number }>;
  };

  const totalInvoiced = Number(summary?.totalInvoiced ?? apiOverview.totalInvoiced ?? 0);
  const totalCollected = Number(summary?.totalCollected ?? apiOverview.totalCollected ?? 0);
  const outstanding = Number(summary?.outstanding ?? apiOverview.outstanding ?? 0);
  const collectionRate = Number(summary?.collectionRate ?? apiOverview.collectionRate ?? 0);
  const totalOutstanding = balances.reduce((s, b) => s + Number(b.outstanding ?? 0), 0);
  const studentsWithDebt = balances.filter((b) => Number(b.outstanding ?? 0) > 0).length;

  const hubCards = [
    {
      icon: <FileText className="h-6 w-6 text-[#00334f]" />,
      title: 'Collection Summary',
      description: 'Collected vs invoiced amounts, payment method splits, and fee category breakdown.',
      kpiLabel: 'Collection Rate',
      kpiValue: `${Math.round(collectionRate)}%`,
      kpiTone: collectionRate >= 80 ? '#10b981' : collectionRate >= 60 ? '#f59e0b' : '#ef4444',
      to: '/finance/reports/collection',
    },
    {
      icon: <WalletCards className="h-6 w-6 text-[#d59a1b]" />,
      title: 'Outstanding Balances',
      description: 'Invoice debt by class and student. Aging buckets, risk levels, and due dates.',
      kpiLabel: 'Total Outstanding',
      kpiValue: formatTZS(totalOutstanding),
      kpiTone: totalOutstanding > 0 ? '#ef4444' : '#10b981',
      to: '/finance/reports/outstanding',
    },
    {
      icon: <Activity className="h-6 w-6 text-[#10b981]" />,
      title: 'Daily Collections',
      description: 'Day-by-day cash, bank transfer, and mobile money close-of-day summary.',
      kpiLabel: 'Students with Debt',
      kpiValue: String(studentsWithDebt),
      kpiTone: studentsWithDebt > 0 ? '#f59e0b' : '#10b981',
      to: '/finance/reports/daily-collections',
    },
    {
      icon: <AlertTriangle className="h-6 w-6 text-[#ef4444]" />,
      title: 'Fee Defaulters',
      description: 'Overdue students with guardian contact tracking and escalation workflow.',
      kpiLabel: 'Overdue Invoices',
      kpiValue: String(apiOverview.overdueInvoices ?? 0),
      kpiTone: (apiOverview.overdueInvoices ?? 0) > 0 ? '#ef4444' : '#10b981',
      to: '/finance/reports/fee-defaulters',
    },
  ];

  return (
    <FinanceWorkspaceShell title="Financial Reports" eyebrow="Report generator">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports' }]} />

      {/* KPI strip */}
      <FinanceMetricStrip items={[
        { label: 'Total Invoiced', value: formatTZS(totalInvoiced), detail: 'Current term', tone: 'navy' },
        { label: 'Total Collected', value: formatTZS(totalCollected), detail: 'Confirmed payments', tone: 'green', trend: 'up' },
        { label: 'Collection Rate', value: `${Math.round(collectionRate)}%`, detail: 'Term target', tone: collectionRate >= 80 ? 'green' : 'gold' },
        { label: 'Outstanding', value: formatTZS(outstanding), detail: `${studentsWithDebt} students`, tone: 'red', trend: outstanding > 0 ? 'down' : undefined },
      ]} />

      {/* Report hub cards */}
      <div className="grid gap-gutter md:grid-cols-2">
        {hubCards.map((card) => (
          <div key={card.title} className="flex flex-col rounded-xl border border-[#d5dde6] bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 rounded-lg bg-[#eef5f8] p-3">{card.icon}</div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-lg font-black text-[#00334f]">{card.title}</h3>
                <p className="mt-1 text-sm font-semibold text-[#64748b] leading-relaxed">{card.description}</p>
              </div>
            </div>
            <div className="mt-5 flex items-end justify-between border-t border-[#eef5f8] pt-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">{card.kpiLabel}</p>
                <p className="mt-0.5 font-mono text-xl font-black" style={{ color: card.kpiTone }}>{card.kpiValue}</p>
              </div>
              <NavLink
                to={card.to}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00334f] px-4 py-2 text-sm font-bold text-white hover:bg-[#004b6e] transition-colors"
              >
                View Report <ArrowRight className="h-4 w-4" />
              </NavLink>
            </div>
          </div>
        ))}
      </div>
    </FinanceWorkspaceShell>
  );
}

const BAR_TONES = ['bg-[#00334f]', 'bg-[#d59a1b]', 'bg-[#10b981]', 'bg-[#64748b]', 'bg-[#e11d48]', 'bg-[#0ea5e9]'];

export function CollectionSummaryReportPage() {
  const { data: summary } = useCollectionSummary() as unknown as {
    data?: {
      totalInvoiced?: number;
      totalCollected?: number;
      outstanding?: number;
      collectionRate?: number;
      byPaymentMethod?: Array<{ method: string; totalAmount: unknown; transactionCount?: number }>;
      byFeeCategory?: Array<{ category?: string; name?: string; totalAmount: unknown; count?: number }>;
    };
  };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };

  const totalInvoiced = Number(summary?.totalInvoiced ?? 0);
  const totalCollected = Number(summary?.totalCollected ?? 0);
  const outstanding = Number(summary?.outstanding ?? 0);
  const collectionRate = Number(summary?.collectionRate ?? 0);
  const methods = summary?.byPaymentMethod ?? [];
  const cats = summary?.byFeeCategory ?? [];
  const methodTotal = methods.reduce((s, m) => s + Number(m.totalAmount ?? 0), 0) || 1;

  // 14-day payment trend
  const trendData = useMemo(() => {
    const today = new Date();
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      byDay.set(d.toISOString().slice(0, 10), 0);
    }
    apiPayments.forEach((p) => {
      const day = String(p.date ?? '').slice(0, 10);
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + Number(p.amount ?? 0));
    });
    return [...byDay.values()];
  }, [apiPayments]);

  async function handleDownloadPdf() {
    toast('Generating PDF…', 'info');
    try {
      const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PW = 210; const M = 14;
      // Header
      doc.setFillColor(0, 51, 79); doc.rect(0, 0, PW, 44, 'F');
      doc.setFillColor(213, 154, 27); doc.rect(0, 44, PW, 1.5, 'F');
      if (logo) doc.addImage(logo, 'PNG', M, 7, 26, 26, undefined, 'FAST');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
      doc.text('Collection Summary Report', M + 32, 22);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, M + 32, 30);
      // KPIs
      let y = 58;
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Summary', M, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const kpis: Array<[string, string]> = [
        ['Total Invoiced', formatTZS(totalInvoiced)],
        ['Total Collected', formatTZS(totalCollected)],
        ['Outstanding', formatTZS(outstanding)],
        ['Collection Rate', `${Math.round(collectionRate)}%`],
      ];
      kpis.forEach(([k, v]) => {
        doc.text(k, M, y); doc.text(v, PW - M, y, { align: 'right' }); y += 6;
      });
      // Payment methods table
      if (methods.length) {
        y += 4;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('Payment Method Breakdown', M, y); y += 7;
        doc.setFillColor(0, 51, 79);
        doc.rect(M, y - 4, PW - 2 * M, 7, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(9);
        doc.text('Method', M + 2, y); doc.text('Transactions', 110, y); doc.text('Amount', PW - M - 2, y, { align: 'right' });
        y += 3; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
        methods.forEach((m, i) => {
          if (i % 2 === 0) { doc.setFillColor(238, 245, 248); doc.rect(M, y - 3, PW - 2 * M, 6, 'F'); }
          doc.text(prettyMethod(m.method), M + 2, y);
          doc.text(String(m.transactionCount ?? 0), 110, y);
          doc.text(formatTZS(Number(m.totalAmount ?? 0)), PW - M - 2, y, { align: 'right' });
          y += 6;
        });
      }
      // Fee categories table
      if (cats.length) {
        y += 4;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
        doc.text('Fee Category Breakdown', M, y); y += 7;
        doc.setFillColor(0, 51, 79); doc.rect(M, y - 4, PW - 2 * M, 7, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(9);
        doc.text('Category', M + 2, y); doc.text('Amount', PW - M - 2, y, { align: 'right' });
        y += 3; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
        cats.forEach((c, i) => {
          if (i % 2 === 0) { doc.setFillColor(238, 245, 248); doc.rect(M, y - 3, PW - 2 * M, 6, 'F'); }
          doc.text(String(c.category ?? c.name ?? '—'), M + 2, y);
          doc.text(formatTZS(Number(c.totalAmount ?? 0)), PW - M - 2, y, { align: 'right' });
          y += 6;
        });
      }
      // Footer
      const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${totalPages}`, PW / 2, 290, { align: 'center' });
      }
      doc.save(`Collection-Summary-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast('PDF downloaded', 'success');
    } catch {
      toast('Failed to generate PDF', 'error');
    }
  }

  return (
    <FinanceWorkspaceShell title="Collection Summary Report" eyebrow="Finance report">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Collection Summary' }]} />

      <FinanceMetricStrip items={[
        { label: 'Total Invoiced', value: formatTZS(totalInvoiced), detail: 'Current term', tone: 'navy' },
        { label: 'Total Collected', value: formatTZS(totalCollected), detail: 'Confirmed payments', tone: 'green', trend: 'up', progress: collectionRate },
        { label: 'Collection Rate', value: `${Math.round(collectionRate)}%`, detail: 'Term rate', tone: collectionRate >= 80 ? 'green' : 'gold' },
        { label: 'Outstanding', value: formatTZS(outstanding), detail: 'Unpaid balance', tone: 'red', trend: outstanding > 0 ? 'down' : undefined },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-gutter">

          {/* Payment Method Breakdown */}
          <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
            <h2 className="font-display text-lg font-black text-[#00334f]">Payment Method Breakdown</h2>
            {methods.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-[#64748b]">No payment method data available.</p>
            ) : (
              <div className="mt-5 space-y-4">
                {methods.map((m) => {
                  const amt = Number(m.totalAmount ?? 0);
                  const pct = Math.round((amt / methodTotal) * 100);
                  return (
                    <div key={m.method}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-bold text-[#0f172a]">{prettyMethod(m.method)}</span>
                        <span className="font-mono font-black text-[#00334f]">{formatTZS(amt)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#e2e8f0]">
                        <div className="h-2 rounded-full bg-[#00334f]" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-[#64748b] mt-0.5">
                        <span>{m.transactionCount ?? 0} transactions</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {methods.length > 0 && (
              <table className="mt-5 w-full text-sm border-t border-[#e2e8f0] pt-4">
                <thead>
                  <tr className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">
                    <th className="py-2 text-left">Method</th>
                    <th className="py-2 text-right">Count</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {methods.map((m) => {
                    const amt = Number(m.totalAmount ?? 0);
                    const pct = Math.round((amt / methodTotal) * 100);
                    return (
                      <tr key={m.method} className="border-t border-[#f1f5f9]">
                        <td className="py-2 font-bold text-[#0f172a]">{prettyMethod(m.method)}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{m.transactionCount ?? 0}</td>
                        <td className="py-2 text-right font-mono font-black text-[#00334f]">{formatTZS(amt)}</td>
                        <td className="py-2 text-right font-semibold text-[#64748b]">{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Fee Category Breakdown */}
          {cats.length > 0 && (
            <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
              <h2 className="font-display text-lg font-black text-[#00334f]">Fee Category Breakdown</h2>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">
                    <th className="py-2 text-left">Category</th>
                    <th className="py-2 text-right">Count</th>
                    <th className="py-2 text-right">Amount Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={String(c.category ?? c.name)} className="border-t border-[#f1f5f9]">
                      <td className="py-2 font-bold text-[#0f172a]">{String(c.category ?? c.name ?? '—')}</td>
                      <td className="py-2 text-right font-mono text-[#64748b]">{c.count ?? 0}</td>
                      <td className="py-2 text-right font-mono font-black text-[#00334f]">{formatTZS(Number(c.totalAmount ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 14-day trend chart */}
          <MiniColumnChart
            title="14-Day Collection Trend"
            subtitle={`${apiPayments.length} payments in period`}
            data={trendData.length ? trendData : [0]}
            startLabel="14 days ago"
            endLabel="Today"
          />
        </div>

        {/* Sidebar actions */}
        <div className="sticky top-24 h-fit space-y-gutter">
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Export Report</p>
            <div className="mt-4 space-y-2">
              <button
                onClick={handleDownloadPdf}
                className="flex w-full items-center justify-between rounded-lg border border-[#d5dde6] px-4 py-2.5 text-sm font-bold text-[#0f172a] hover:bg-[#eef5f8] transition-colors"
              >
                <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Download PDF</span>
                <ArrowRight className="h-4 w-4 text-[#64748b]" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Quick Stats</p>
            <div className="mt-4 space-y-3">
              {[
                ['Methods used', String(methods.length)],
                ['Fee categories', String(cats.length)],
                ['Payment records', String(apiPayments.length)],
                ['Rate', `${Math.round(collectionRate)}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#64748b]">{k}</span>
                  <span className="font-mono font-black text-[#0f172a]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

export function OutstandingBalancesReportPage() {
  const { data: balances = [] } = useOutstandingBalances() as unknown as {
    data: Array<{
      invoiceNumber?: string; student?: string; registration?: string;
      className?: string; totalAmount?: number; paidAmount?: number;
      outstanding?: number; dueDate?: string; daysOverdue?: number;
    }>;
  };

  const [sortField, setSortField] = useState<'outstanding' | 'daysOverdue' | 'student'>('outstanding');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');

  const activeBalances = useMemo(() => balances.filter((b) => Number(b.outstanding ?? 0) > 0), [balances]);

  const totalOutstanding = useMemo(() => activeBalances.reduce((s, b) => s + Number(b.outstanding ?? 0), 0), [activeBalances]);
  const avgOutstanding = activeBalances.length > 0 ? totalOutstanding / activeBalances.length : 0;
  const maxDaysOverdue = useMemo(() => Math.max(0, ...activeBalances.map((b) => Number(b.daysOverdue ?? 0))), [activeBalances]);

  // Aging buckets
  const aging = useMemo(() => {
    const buckets = [
      { label: 'Current (Not Overdue)', min: -Infinity, max: 0, color: '#10b981', rows: [] as typeof activeBalances },
      { label: '1–30 Days', min: 1, max: 30, color: '#f59e0b', rows: [] as typeof activeBalances },
      { label: '31–60 Days', min: 31, max: 60, color: '#ef4444', rows: [] as typeof activeBalances },
      { label: '61–90 Days', min: 61, max: 90, color: '#dc2626', rows: [] as typeof activeBalances },
      { label: '90+ Days', min: 91, max: Infinity, color: '#991b1b', rows: [] as typeof activeBalances },
    ];
    activeBalances.forEach((b) => {
      const d = Number(b.daysOverdue ?? 0);
      const bucket = buckets.find((bk) => d >= bk.min && d <= bk.max);
      if (bucket) bucket.rows.push(b);
    });
    return buckets;
  }, [activeBalances]);

  // By class
  const byClass = useMemo(() => {
    const map = new Map<string, { students: Set<string>; total: number }>();
    activeBalances.forEach((b) => {
      const cls = b.className?.trim() || 'Unassigned';
      if (!map.has(cls)) map.set(cls, { students: new Set(), total: 0 });
      const g = map.get(cls)!;
      if (b.student) g.students.add(b.student);
      g.total += Number(b.outstanding ?? 0);
    });
    return [...map.entries()].sort(([, a], [, b]) => b.total - a.total);
  }, [activeBalances]);

  const filteredRows = useMemo(() => {
    let rows = activeBalances;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((b) =>
        (b.student ?? '').toLowerCase().includes(q) ||
        (b.registration ?? '').toLowerCase().includes(q) ||
        (b.className ?? '').toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = sortField === 'student' ? String(a.student ?? '') : Number((a as Record<string, unknown>)[sortField] ?? 0);
      const bv = sortField === 'student' ? String(b.student ?? '') : Number((b as Record<string, unknown>)[sortField] ?? 0);
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [activeBalances, search, sortField, sortDir]);

  function riskBadge(days: number) {
    if (days <= 0) return <Badge variant="success">Current</Badge>;
    if (days <= 30) return <Badge variant="success">Low</Badge>;
    if (days <= 60) return <Badge variant="warning">Medium</Badge>;
    if (days <= 90) return <Badge variant="error">High</Badge>;
    return <span className="inline-flex items-center rounded-full bg-[#991b1b] px-2 py-0.5 text-xs font-bold text-white">Critical</span>;
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  }

  async function handleDownloadPdf() {
    toast('Generating PDF…', 'info');
    try {
      const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297; const PH = 210; const M = 14;
      // Header
      doc.setFillColor(0, 51, 79); doc.rect(0, 0, PW, 40, 'F');
      doc.setFillColor(213, 154, 27); doc.rect(0, 40, PW, 1.5, 'F');
      if (logo) doc.addImage(logo, 'PNG', M, 7, 22, 22, undefined, 'FAST');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
      doc.text('Outstanding Balances Report', M + 28, 20);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()} · ${activeBalances.length} students with outstanding balances`, M + 28, 28);
      let y = 52;
      // Summary KPIs
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Total Outstanding: ${formatTZS(totalOutstanding)}`, M, y);
      doc.text(`Students: ${activeBalances.length}`, M + 90, y);
      doc.text(`Average: ${formatTZS(avgOutstanding)}`, M + 140, y);
      doc.text(`Oldest: ${maxDaysOverdue} days`, M + 220, y);
      y += 10;
      // Aging table
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Aging Analysis', M, y); y += 7;
      doc.setFillColor(0, 51, 79); doc.rect(M, y - 4, PW - 2 * M, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(9);
      doc.text('Bucket', M + 2, y); doc.text('Count', M + 80, y); doc.text('Total', M + 120, y); doc.text('%', M + 190, y);
      y += 3; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
      aging.forEach((bk, i) => {
        const bkTotal = bk.rows.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
        const pct = totalOutstanding > 0 ? Math.round((bkTotal / totalOutstanding) * 100) : 0;
        if (i % 2 === 0) { doc.setFillColor(238, 245, 248); doc.rect(M, y - 3, PW - 2 * M, 6, 'F'); }
        doc.text(bk.label, M + 2, y);
        doc.text(String(bk.rows.length), M + 80, y);
        doc.text(formatTZS(bkTotal), M + 120, y);
        doc.text(`${pct}%`, M + 190, y);
        y += 6;
      });
      y += 4;
      // Student table header
      if (y + 30 > PH - 20) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('Student Outstanding Balances', M, y); y += 7;
      doc.setFillColor(0, 51, 79); doc.rect(M, y - 4, PW - 2 * M, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8);
      doc.text('Student', M + 2, y); doc.text('Reg', M + 55, y); doc.text('Class', M + 90, y);
      doc.text('Total', M + 130, y); doc.text('Paid', M + 165, y); doc.text('Outstanding', M + 200, y); doc.text('Days', M + 245, y);
      y += 3; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
      filteredRows.forEach((b, i) => {
        if (y > PH - 15) { doc.addPage(); y = 20; }
        if (i % 2 === 0) { doc.setFillColor(238, 245, 248); doc.rect(M, y - 3, PW - 2 * M, 6, 'F'); }
        doc.text(String(b.student ?? '—').slice(0, 22), M + 2, y);
        doc.text(String(b.registration ?? '—').slice(0, 12), M + 55, y);
        doc.text(String(b.className ?? '—').slice(0, 12), M + 90, y);
        doc.text(formatTZS(Number(b.totalAmount ?? 0)), M + 130, y);
        doc.text(formatTZS(Number(b.paidAmount ?? 0)), M + 165, y);
        doc.text(formatTZS(Number(b.outstanding ?? 0)), M + 200, y);
        doc.text(String(b.daysOverdue ?? 0), M + 245, y);
        y += 6;
      });
      const totalPages2 = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages2; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${totalPages2}`, PW / 2, PH - 5, { align: 'center' });
      }
      doc.save(`Outstanding-Balances-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast('PDF downloaded', 'success');
    } catch {
      toast('Failed to generate PDF', 'error');
    }
  }

  return (
    <FinanceWorkspaceShell title="Outstanding Balances Report" eyebrow="Finance report">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Outstanding Balances' }]} />

      <FinanceMetricStrip items={[
        { label: 'Total Outstanding', value: formatTZS(totalOutstanding), detail: 'Unpaid balance', tone: 'red', trend: totalOutstanding > 0 ? 'down' : undefined },
        { label: 'Students with Debt', value: String(activeBalances.length), detail: 'Active debtors', tone: 'navy' },
        { label: 'Average Outstanding', value: formatTZS(avgOutstanding), detail: 'Per student', tone: 'gold' },
        { label: 'Oldest Debt', value: `${maxDaysOverdue} days`, detail: 'Max days overdue', tone: maxDaysOverdue > 90 ? 'red' : maxDaysOverdue > 30 ? 'gold' : 'slate' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-gutter">

          {/* Aging analysis */}
          <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
            <h2 className="font-display text-lg font-black text-[#00334f]">Aging Analysis</h2>
            <div className="mt-4 space-y-3">
              {aging.map((bk) => {
                const bkTotal = bk.rows.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);
                const pct = totalOutstanding > 0 ? Math.round((bkTotal / totalOutstanding) * 100) : 0;
                return (
                  <div key={bk.label} className="flex items-center gap-4">
                    <div className="w-36 flex-shrink-0">
                      <p className="text-sm font-bold text-[#0f172a]">{bk.label}</p>
                      <p className="text-xs font-semibold text-[#64748b]">{bk.rows.length} students</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-[#e2e8f0]">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: bk.color }} />
                      </div>
                    </div>
                    <div className="w-32 text-right">
                      <p className="font-mono text-sm font-black text-[#0f172a]">{formatTZS(bkTotal)}</p>
                      <p className="text-xs font-semibold text-[#64748b]">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By class */}
          {byClass.length > 0 && (
            <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
              <h2 className="font-display text-lg font-black text-[#00334f]">By Class</h2>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">
                    <th className="py-2 text-left">Class</th>
                    <th className="py-2 text-right">Students</th>
                    <th className="py-2 text-right">Total Outstanding</th>
                    <th className="py-2 text-right">Avg / Student</th>
                  </tr>
                </thead>
                <tbody>
                  {byClass.map(([cls, g]) => (
                    <tr key={cls} className="border-t border-[#f1f5f9]">
                      <td className="py-2 font-bold text-[#0f172a]">{cls}</td>
                      <td className="py-2 text-right font-mono text-[#64748b]">{g.students.size}</td>
                      <td className="py-2 text-right font-mono font-black text-[#ef4444]">{formatTZS(g.total)}</td>
                      <td className="py-2 text-right font-mono text-[#64748b]">{formatTZS(g.students.size > 0 ? g.total / g.students.size : 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Student table */}
          <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="font-display text-lg font-black text-[#00334f]">Student Balances</h2>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#64748b]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student…"
                  className="rounded-lg border border-[#d5dde6] pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00334f]"
                />
              </div>
            </div>
            {filteredRows.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-[#64748b]">No outstanding balances found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-black uppercase tracking-widest text-[#64748b] border-b border-[#e2e8f0]">
                      <th className="py-2 text-left cursor-pointer hover:text-[#00334f]" onClick={() => toggleSort('student')}>
                        Student {sortField === 'student' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="py-2 text-left">Class</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-right">Paid</th>
                      <th className="py-2 text-right cursor-pointer hover:text-[#00334f]" onClick={() => toggleSort('outstanding')}>
                        Outstanding {sortField === 'outstanding' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="py-2 text-right cursor-pointer hover:text-[#00334f]" onClick={() => toggleSort('daysOverdue')}>
                        Days {sortField === 'daysOverdue' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                      </th>
                      <th className="py-2 text-center">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((b, i) => (
                      <tr key={`${b.invoiceNumber}-${i}`} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc]">
                        <td className="py-2">
                          <p className="font-bold text-[#0f172a]">{b.student ?? '—'}</p>
                          <p className="text-xs text-[#64748b]">{b.registration ?? ''}</p>
                        </td>
                        <td className="py-2 font-semibold text-[#64748b]">{b.className ?? '—'}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{formatTZS(Number(b.totalAmount ?? 0))}</td>
                        <td className="py-2 text-right font-mono text-[#10b981]">{formatTZS(Number(b.paidAmount ?? 0))}</td>
                        <td className="py-2 text-right font-mono font-black text-[#ef4444]">{formatTZS(Number(b.outstanding ?? 0))}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{b.daysOverdue ?? 0}</td>
                        <td className="py-2 text-center">{riskBadge(Number(b.daysOverdue ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sticky top-24 h-fit space-y-gutter">
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Export</p>
            <div className="mt-4">
              <button
                onClick={handleDownloadPdf}
                className="flex w-full items-center justify-between rounded-lg border border-[#d5dde6] px-4 py-2.5 text-sm font-bold text-[#0f172a] hover:bg-[#eef5f8] transition-colors"
              >
                <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Landscape PDF</span>
                <ArrowRight className="h-4 w-4 text-[#64748b]" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Aging Summary</p>
            <div className="mt-4 space-y-3">
              {aging.map((bk) => (
                <div key={bk.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: bk.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: bk.color }} />
                    {bk.label}
                  </span>
                  <span className="font-mono font-black text-[#0f172a]">{bk.rows.length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

export function DailyCollectionsReportPage() {
  const { data: dailyRows = [] } = useDailyCollections() as unknown as {
    data: Array<{
      date?: string;
      totalAmount?: number;
      transactionCount?: number;
      byMethod?: Array<{ method: string; amount: number }>;
    }>;
  };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };

  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  // Derive daily aggregates from payments if dailyRows is empty
  const effectiveRows = useMemo(() => {
    if (dailyRows.length > 0) return dailyRows;
    // Build from payments
    const byDay = new Map<string, { totalAmount: number; transactionCount: number; byMethod: Map<string, number> }>();
    apiPayments.forEach((p) => {
      const day = String(p.date ?? '').slice(0, 10);
      if (!day) return;
      if (!byDay.has(day)) byDay.set(day, { totalAmount: 0, transactionCount: 0, byMethod: new Map() });
      const g = byDay.get(day)!;
      g.totalAmount += Number(p.amount ?? 0);
      g.transactionCount += 1;
      const method = String((p as Record<string, unknown>).method ?? 'UNKNOWN');
      g.byMethod.set(method, (g.byMethod.get(method) ?? 0) + Number(p.amount ?? 0));
    });
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, g]) => ({
        date,
        totalAmount: g.totalAmount,
        transactionCount: g.transactionCount,
        byMethod: [...g.byMethod.entries()].map(([method, amount]) => ({ method, amount })),
      }));
  }, [dailyRows, apiPayments]);

  const sortedDesc = useMemo(() => [...effectiveRows].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? ''))), [effectiveRows]);

  const todayTotal = useMemo(() => effectiveRows.filter((r) => String(r.date ?? '').slice(0, 10) === today).reduce((s, r) => s + Number(r.totalAmount ?? 0), 0), [effectiveRows, today]);
  const weekTotal = useMemo(() => effectiveRows.filter((r) => String(r.date ?? '') >= weekAgo).reduce((s, r) => s + Number(r.totalAmount ?? 0), 0), [effectiveRows, weekAgo]);
  const monthTotal = useMemo(() => effectiveRows.filter((r) => String(r.date ?? '') >= monthStart).reduce((s, r) => s + Number(r.totalAmount ?? 0), 0), [effectiveRows, monthStart]);
  const avgDaily = effectiveRows.length > 0 ? effectiveRows.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0) / effectiveRows.length : 0;

  const bestDay = useMemo(() => [...effectiveRows].sort((a, b) => Number(b.totalAmount ?? 0) - Number(a.totalAmount ?? 0))[0], [effectiveRows]);
  const busiestDay = useMemo(() => [...effectiveRows].sort((a, b) => Number(b.transactionCount ?? 0) - Number(a.transactionCount ?? 0))[0], [effectiveRows]);

  // Method mix totals across all days
  const methodMix = useMemo(() => {
    const map = new Map<string, number>();
    effectiveRows.forEach((r) => {
      (r.byMethod ?? []).forEach((m) => {
        map.set(m.method, (map.get(m.method) ?? 0) + Number(m.amount ?? 0));
      });
    });
    const grand = [...map.values()].reduce((s, v) => s + v, 0) || 1;
    return [...map.entries()].sort(([, a], [, b]) => b - a).map(([method, amount]) => ({
      method,
      amount,
      pct: Math.round((amount / grand) * 100),
    }));
  }, [effectiveRows]);

  // Running total for table
  const tableRows = useMemo(() => {
    let running = 0;
    return [...sortedDesc].map((r) => {
      running += Number(r.totalAmount ?? 0);
      const cash = (r.byMethod ?? []).find((m) => m.method === 'CASH')?.amount ?? 0;
      const bank = (r.byMethod ?? []).find((m) => m.method === 'BANK_TRANSFER')?.amount ?? 0;
      const mobile = (r.byMethod ?? []).find((m) => m.method === 'MOBILE_MONEY')?.amount ?? 0;
      return { ...r, cash, bank, mobile, running };
    });
  }, [sortedDesc]);

  async function handleDownloadPdf() {
    toast('Generating PDF…', 'info');
    try {
      const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297; const PH = 210; const M = 14;
      doc.setFillColor(0, 51, 79); doc.rect(0, 0, PW, 40, 'F');
      doc.setFillColor(213, 154, 27); doc.rect(0, 40, PW, 1.5, 'F');
      if (logo) doc.addImage(logo, 'PNG', M, 7, 22, 22, undefined, 'FAST');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(255, 255, 255);
      doc.text('Daily Collections Report', M + 28, 20);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, M + 28, 28);
      let y = 52;
      doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(`Today: ${formatTZS(todayTotal)}`, M, y);
      doc.text(`This Week: ${formatTZS(weekTotal)}`, M + 70, y);
      doc.text(`This Month: ${formatTZS(monthTotal)}`, M + 150, y);
      doc.text(`Daily Avg: ${formatTZS(avgDaily)}`, M + 230, y);
      y += 10;
      // Method mix
      if (methodMix.length) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Payment Method Mix', M, y); y += 7;
        doc.setFillColor(0, 51, 79); doc.rect(M, y - 4, PW - 2 * M, 7, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(9);
        doc.text('Method', M + 2, y); doc.text('Amount', M + 100, y); doc.text('Share', M + 160, y);
        y += 3; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
        methodMix.forEach((m, i) => {
          if (i % 2 === 0) { doc.setFillColor(238, 245, 248); doc.rect(M, y - 3, PW - 2 * M, 6, 'F'); }
          doc.text(prettyMethod(m.method), M + 2, y);
          doc.text(formatTZS(m.amount), M + 100, y);
          doc.text(`${m.pct}%`, M + 160, y);
          y += 6;
        });
        y += 4;
      }
      // Daily table
      if (y + 20 > PH - 20) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Daily Breakdown', M, y); y += 7;
      doc.setFillColor(0, 51, 79); doc.rect(M, y - 4, PW - 2 * M, 7, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(8);
      doc.text('Date', M + 2, y); doc.text('Txns', M + 45, y); doc.text('Cash', M + 70, y); doc.text('Bank', M + 115, y); doc.text('Mobile', M + 160, y); doc.text('Total', M + 205, y); doc.text('Running', M + 245, y);
      y += 3; doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
      tableRows.forEach((r, i) => {
        if (y > PH - 15) { doc.addPage(); y = 20; }
        if (i % 2 === 0) { doc.setFillColor(238, 245, 248); doc.rect(M, y - 3, PW - 2 * M, 6, 'F'); }
        doc.text(formatDate(String(r.date ?? '')), M + 2, y);
        doc.text(String(r.transactionCount ?? 0), M + 45, y);
        doc.text(formatTZS(r.cash), M + 70, y);
        doc.text(formatTZS(r.bank), M + 115, y);
        doc.text(formatTZS(r.mobile), M + 160, y);
        doc.text(formatTZS(Number(r.totalAmount ?? 0)), M + 205, y);
        doc.text(formatTZS(r.running), M + 245, y);
        y += 6;
      });
      const totalPages3 = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages3; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
        doc.text(`Page ${i} of ${totalPages3}`, PW / 2, PH - 5, { align: 'center' });
      }
      doc.save(`Daily-Collections-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast('PDF downloaded', 'success');
    } catch {
      toast('Failed to generate PDF', 'error');
    }
  }

  return (
    <FinanceWorkspaceShell title="Daily Collections Report" eyebrow="Finance report">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Daily Collections' }]} />

      <FinanceMetricStrip items={[
        { label: "Today's Collections", value: formatTZS(todayTotal), detail: today, tone: 'green', trend: 'up' },
        { label: 'This Week', value: formatTZS(weekTotal), detail: 'Last 7 days', tone: 'navy' },
        { label: 'This Month', value: formatTZS(monthTotal), detail: new Date().toLocaleString('default', { month: 'long' }), tone: 'gold' },
        { label: 'Daily Average', value: formatTZS(avgDaily), detail: `${effectiveRows.length} active days`, tone: 'slate' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-gutter">

          {/* Highlights */}
          {(bestDay || busiestDay) && (
            <div className="grid gap-gutter sm:grid-cols-2">
              {bestDay && (
                <div className="rounded-xl border border-[#10b981]/30 bg-[#10b981]/5 p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#10b981]">Best Day</p>
                  <p className="mt-1 font-display text-xl font-black text-[#0f172a]">{formatTZS(Number(bestDay.totalAmount ?? 0))}</p>
                  <p className="text-sm font-semibold text-[#64748b]">{formatDate(String(bestDay.date ?? ''))}</p>
                </div>
              )}
              {busiestDay && (
                <div className="rounded-xl border border-[#d59a1b]/30 bg-[#d59a1b]/5 p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#d59a1b]">Busiest Day</p>
                  <p className="mt-1 font-display text-xl font-black text-[#0f172a]">{busiestDay.transactionCount ?? 0} transactions</p>
                  <p className="text-sm font-semibold text-[#64748b]">{formatDate(String(busiestDay.date ?? ''))}</p>
                </div>
              )}
            </div>
          )}

          {/* Method mix */}
          {methodMix.length > 0 && (
            <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
              <h2 className="font-display text-lg font-black text-[#00334f]">Payment Method Mix</h2>
              <div className="mt-4 space-y-4">
                {methodMix.map((m, i) => (
                  <div key={m.method}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-bold text-[#0f172a]">{prettyMethod(m.method)}</span>
                      <span className="font-mono font-black text-[#00334f]">{formatTZS(m.amount)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#e2e8f0]">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${m.pct}%`, backgroundColor: ['#00334f', '#d59a1b', '#10b981'][i % 3] }}
                      />
                    </div>
                    <p className="text-xs font-semibold text-[#64748b] mt-0.5 text-right">{m.pct}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily table */}
          <div className="rounded-xl border border-[#d5dde6] bg-white p-6">
            <h2 className="font-display text-lg font-black text-[#00334f]">Daily Breakdown</h2>
            {tableRows.length === 0 ? (
              <p className="mt-4 py-8 text-center text-sm font-semibold text-[#64748b]">No daily collection data available.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] font-black uppercase tracking-widest text-[#64748b] border-b border-[#e2e8f0]">
                      <th className="py-2 text-left">Date</th>
                      <th className="py-2 text-right">Txns</th>
                      <th className="py-2 text-right">Cash</th>
                      <th className="py-2 text-right">Bank Transfer</th>
                      <th className="py-2 text-right">Mobile Money</th>
                      <th className="py-2 text-right">Total</th>
                      <th className="py-2 text-right">Running Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r, i) => (
                      <tr key={`${r.date}-${i}`} className={`border-t border-[#f1f5f9] hover:bg-[#f8fafc] ${String(r.date ?? '').slice(0, 10) === today ? 'bg-[#eef5f8]' : ''}`}>
                        <td className="py-2 font-bold text-[#0f172a]">
                          {formatDate(String(r.date ?? ''))}
                          {String(r.date ?? '').slice(0, 10) === today && (
                            <span className="ml-2 rounded-full bg-[#00334f] px-1.5 py-0.5 text-[10px] font-black text-white">TODAY</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{r.transactionCount ?? 0}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{formatTZS(r.cash)}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{formatTZS(r.bank)}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{formatTZS(r.mobile)}</td>
                        <td className="py-2 text-right font-mono font-black text-[#00334f]">{formatTZS(Number(r.totalAmount ?? 0))}</td>
                        <td className="py-2 text-right font-mono text-[#64748b]">{formatTZS(r.running)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="sticky top-24 h-fit space-y-gutter">
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Export</p>
            <div className="mt-4">
              <button
                onClick={handleDownloadPdf}
                className="flex w-full items-center justify-between rounded-lg border border-[#d5dde6] px-4 py-2.5 text-sm font-bold text-[#0f172a] hover:bg-[#eef5f8] transition-colors"
              >
                <span className="flex items-center gap-2"><Download className="h-4 w-4" /> Landscape PDF</span>
                <ArrowRight className="h-4 w-4 text-[#64748b]" />
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Period Totals</p>
            <div className="mt-4 space-y-3">
              {[
                ["Today", formatTZS(todayTotal)],
                ["This Week", formatTZS(weekTotal)],
                ["This Month", formatTZS(monthTotal)],
                ["Daily Avg", formatTZS(avgDaily)],
                ["Active Days", String(effectiveRows.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#64748b]">{k}</span>
                  <span className="font-mono font-black text-[#0f172a]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

function prettyMethod(m: string): string {
  return String(m ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FeeDefaultersReportPage() {
  type ContactStatus = 'PENDING' | 'CONTACTED' | 'PROMISED' | 'ESCALATED';
  type ContactNote = { text: string; method: string; date: string; followUp: string };

  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as unknown as { data: typeof financeOverview };

  const overdue = useMemo(() => overdueInvoices(apiInvoices), [apiInvoices]);

  // Group overdue invoices by student
  const studentGroups = useMemo(() => {
    const map = new Map<string, {
      studentId: string; student: string; registration: string;
      className: string; guardian: string;
      invs: typeof overdue; totalOutstanding: number; maxDaysOverdue: number;
    }>();
    overdue.forEach((inv) => {
      const key = inv.studentId || inv.student;
      if (!map.has(key)) {
        map.set(key, { studentId: inv.studentId || key, student: inv.student, registration: inv.registration, className: inv.className, guardian: inv.guardian, invs: [], totalOutstanding: 0, maxDaysOverdue: 0 });
      }
      const g = map.get(key)!;
      g.invs.push(inv);
      g.totalOutstanding += inv.outstanding ?? 0;
      const days = inv.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000)) : 0;
      g.maxDaysOverdue = Math.max(g.maxDaysOverdue, days);
    });
    return [...map.values()];
  }, [overdue]);

  // Per-student contact tracking (session state)
  const [contactStatus, setContactStatus] = useState<Record<string, ContactStatus>>({});
  const [contactNotes, setContactNotes] = useState<Record<string, ContactNote[]>>({});
  const [noteForm, setNoteForm] = useState<{ sid: string; text: string; method: string; followUp: string } | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactStatus | 'ALL'>('ALL');
  const [sort, setSort] = useState<'outstanding' | 'days' | 'name'>('outstanding');

  // Summary metrics
  const overdueTotal = overdue.reduce((s, i) => s + (i.outstanding ?? 0), 0);
  const thirtyPlus   = studentGroups.filter((g) => g.maxDaysOverdue > 30).length;
  const notContacted = studentGroups.filter((g) => !contactStatus[g.studentId]).length;
  const escalated    = Object.values(contactStatus).filter((v) => v === 'ESCALATED').length;

  const filtered = useMemo(() => {
    let list = [...studentGroups];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.student.toLowerCase().includes(q) || g.className.toLowerCase().includes(q) || g.registration.toLowerCase().includes(q) || (g.guardian ?? '').toLowerCase().includes(q));
    }
    if (statusFilter !== 'ALL') list = list.filter((g) => (contactStatus[g.studentId] ?? 'PENDING') === statusFilter);
    if (sort === 'outstanding') list.sort((a, b) => b.totalOutstanding - a.totalOutstanding);
    else if (sort === 'days')   list.sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue);
    else                        list.sort((a, b) => a.student.localeCompare(b.student));
    return list;
  }, [studentGroups, search, statusFilter, sort, contactStatus]);

  const submitNote = () => {
    if (!noteForm || !noteForm.text.trim()) return;
    const { sid, text, method, followUp } = noteForm;
    setContactNotes((p) => ({ ...p, [sid]: [...(p[sid] ?? []), { text, method, date: new Date().toISOString(), followUp }] }));
    if ((contactStatus[sid] ?? 'PENDING') === 'PENDING') setContactStatus((p) => ({ ...p, [sid]: 'CONTACTED' }));
    setNoteForm(null);
  };

  const toggleCard = (sid: string) =>
    setExpandedCards((p) => { const n = new Set(p); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });

  const STATUS_LABEL: Record<ContactStatus, string> = { PENDING: 'Not Contacted', CONTACTED: 'Contacted', PROMISED: 'Promise to Pay', ESCALATED: 'Escalated' };
  const STATUS_COLOR: Record<ContactStatus, string> = {
    PENDING:   'bg-[#f1f5f9] text-[#64748b]',
    CONTACTED: 'bg-blue-100 text-blue-700',
    PROMISED:  'bg-amber-100 text-amber-700',
    ESCALATED: 'bg-red-100 text-red-700',
  };
  const inp = 'mt-1 w-full rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 py-2 text-sm font-semibold outline-none focus:border-[#00334f] focus:bg-white';
  const cap = 'text-[10px] font-black uppercase tracking-widest text-[#64748b]';

  return (
    <FinanceWorkspaceShell title="Fee Defaulters" eyebrow="Guardian contacts · follow-up log · student ledger links">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Fee Defaulters' }]} />

      <FinanceMetricStrip items={[
        { label: 'Total Outstanding', value: formatTZS(overdueTotal || apiOverview.outstanding), detail: `${studentGroups.length} students`, tone: 'red', trend: 'down', progress: apiOverview.totalInvoiced > 0 ? Math.round(((overdueTotal || apiOverview.outstanding) / apiOverview.totalInvoiced) * 100) : 0 },
        { label: '30+ Days Overdue',  value: String(thirtyPlus),   detail: 'Urgent follow-up needed',  tone: 'gold', trend: 'up' },
        { label: 'Not Yet Contacted', value: String(notContacted), detail: 'No contact logged yet',    tone: 'navy' },
        { label: 'Escalated',         value: String(escalated),    detail: 'Referred for action',      tone: 'red' },
      ]} />

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, class, guardian…"
            className="h-10 w-full rounded-lg border border-[#d5dde6] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#00334f]" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(['ALL', 'PENDING', 'CONTACTED', 'PROMISED', 'ESCALATED'] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${statusFilter === s ? 'bg-[#00334f] text-white' : 'border border-[#d5dde6] bg-white text-[#64748b] hover:bg-[#f7f9fb]'}`}>
              {s === 'ALL' ? 'All' : s === 'PENDING' ? 'Not Contacted' : STATUS_LABEL[s as ContactStatus]}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-10 rounded-lg border border-[#d5dde6] bg-white px-3 text-sm font-semibold text-[#00334f] outline-none">
          <option value="outstanding">Sort: Amount ↓</option>
          <option value="days">Sort: Days Overdue ↓</option>
          <option value="name">Sort: Name A–Z</option>
        </select>
        <Button variant="secondary" onClick={() => toast('CSV export started…', 'info')}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* ── Defaulter cards ── */}
      {!filtered.length ? (
        <EmptyState title="No defaulters" description="No overdue invoices matching the current filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map((def) => {
            const status = (contactStatus[def.studentId] ?? 'PENDING') as ContactStatus;
            const notes = contactNotes[def.studentId] ?? [];
            const isExpanded = expandedCards.has(def.studentId);
            const isNoting = noteForm?.sid === def.studentId;

            return (
              <div key={def.studentId} className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white shadow-sm">

                {/* ── Main row ── */}
                <div className="flex flex-wrap items-start gap-5 px-5 py-4">
                  {/* Student identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black text-[#00334f]">{def.student}</p>
                      <span className="text-[10px] text-[#94a3b8]">{def.registration}</span>
                      <span className="rounded-full bg-[#00334f]/10 px-2 py-0.5 text-[10px] font-bold text-[#00334f]">{def.className}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_COLOR[status]}`}>{STATUS_LABEL[status]}</span>
                    </div>
                    {def.guardian && (
                      <p className="mt-1 text-sm text-[#475569]">
                        <span className="font-bold">Guardian:</span> {def.guardian}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-[#64748b]">
                      <span>{def.invs.length} overdue invoice{def.invs.length !== 1 ? 's' : ''}</span>
                      <span className={`font-black ${def.maxDaysOverdue > 30 ? 'text-red-600' : 'text-orange-500'}`}>
                        {def.maxDaysOverdue} days overdue
                      </span>
                      {notes.length > 0 && <span className="text-blue-600">{notes.length} contact note{notes.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>

                  {/* Amount + actions */}
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <p className="font-mono text-2xl font-black tabular-nums text-red-600">{formatTZS(def.totalOutstanding)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <NavLink to={`/finance/students/${def.studentId}`}>
                        <button className="flex items-center gap-1 rounded-lg border border-[#00334f]/20 px-2.5 py-1.5 text-[10px] font-black text-[#00334f] hover:bg-[#f0f4f8]">
                          <BookOpen className="h-3 w-3" /> Ledger
                        </button>
                      </NavLink>
                      <NavLink to={`/finance/payments/cash?studentId=${def.studentId}`}>
                        <button className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-50">
                          <CreditCard className="h-3 w-3" /> Record Payment
                        </button>
                      </NavLink>
                    </div>
                    <select value={status}
                      onChange={(e) => setContactStatus((p) => ({ ...p, [def.studentId]: e.target.value as ContactStatus }))}
                      className="h-7 rounded border border-[#d5dde6] bg-white px-2 text-[10px] font-bold text-[#00334f] outline-none">
                      <option value="PENDING">Not Contacted</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="PROMISED">Promise to Pay</option>
                      <option value="ESCALATED">Escalated</option>
                    </select>
                  </div>
                </div>

                {/* ── Invoice mini-list ── */}
                <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-5 py-2.5">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {def.invs.map((inv) => {
                      const days = inv.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / 86_400_000)) : 0;
                      return (
                        <div key={inv.id} className="flex items-center gap-2 text-[11px]">
                          <NavLink to={`/finance/invoices/${inv.id}`} className="font-black text-[#00334f] hover:underline">{inv.number}</NavLink>
                          <span className="text-[#94a3b8]">{inv.term}</span>
                          <span className="font-bold text-red-600">{formatTZS(inv.outstanding ?? 0)}</span>
                          <span className="text-[#cbd5e1]">{days}d ago</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Contact log (collapsible) ── */}
                <div className="border-t border-[#f1f5f9]">
                  <button onClick={() => toggleCard(def.studentId)}
                    className="flex w-full items-center justify-between px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#64748b] hover:bg-[#f8fafc]">
                    <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Contact Log ({notes.length})</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#f1f5f9] bg-[#f8fafc] px-5 py-4 space-y-4">
                      {/* Past notes */}
                      {notes.length > 0 && (
                        <div className="space-y-2.5">
                          {notes.map((n, i) => (
                            <div key={i} className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-black uppercase text-[#00334f]">{n.method.replace(/_/g, ' ')}</span>
                                <span className="text-[#94a3b8]">{formatDate(n.date)}</span>
                              </div>
                              <p className="mt-1.5 text-sm text-[#0f172a]">{n.text}</p>
                              {n.followUp && <p className="mt-1 text-[10px] text-[#64748b]">Follow-up scheduled: {formatDate(n.followUp)}</p>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Note form */}
                      {isNoting ? (
                        <div className="rounded-lg border border-[#d5dde6] bg-white p-4 space-y-3">
                          <p className={cap}>Log Contact</p>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="block">
                              <span className={cap}>Method</span>
                              <select value={noteForm.method}
                                onChange={(e) => setNoteForm((f) => f && { ...f, method: e.target.value })}
                                className={inp}>
                                {['PHONE', 'IN_PERSON', 'SMS', 'LETTER', 'EMAIL'].map((m) => (
                                  <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>
                                ))}
                              </select>
                            </label>
                            <label className="block">
                              <span className={cap}>Next Follow-up</span>
                              <input type="date" value={noteForm.followUp}
                                onChange={(e) => setNoteForm((f) => f && { ...f, followUp: e.target.value })}
                                className={inp} />
                            </label>
                          </div>
                          <textarea value={noteForm.text}
                            onChange={(e) => setNoteForm((f) => f && { ...f, text: e.target.value })}
                            placeholder="What was discussed? Any commitment to pay? Outcome of the contact…"
                            className="h-20 w-full resize-none rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 py-2 text-sm outline-none focus:border-[#00334f] focus:bg-white" />
                          <div className="flex gap-2">
                            <Button onClick={submitNote} disabled={!noteForm.text.trim()}>
                              <Check className="h-4 w-4" /> Save Note
                            </Button>
                            <Button variant="secondary" onClick={() => setNoteForm(null)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setNoteForm({ sid: def.studentId, text: '', method: 'PHONE', followUp: '' })}
                          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#d5dde6] py-3 text-[11px] font-black text-[#64748b] hover:border-[#00334f] hover:text-[#00334f]">
                          <Plus className="h-3.5 w-3.5" /> Log a contact
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </FinanceWorkspaceShell>
  );
}

// ─── Audit + export pages ─────────────────────────────────────────────────────

// Role → which action prefixes are visible (undefined = all)
const ROLE_ACTION_PREFIXES: Record<string, string[] | undefined> = {
  ADMIN:     undefined,
  FINANCE:   undefined,
  PRINCIPAL: ['FUND_REQUEST', 'EXPENSE', 'ASSET', 'INVOICE', 'PAYMENT', 'BALANCE', 'DISCOUNT'],
};

const ACTION_CATEGORY_LABELS: Record<string, string> = {
  PAYMENT: 'Payments', INVOICE: 'Invoices', RECEIPT: 'Receipts', FEE: 'Fee Setup',
  FUND_REQUEST: 'Fund Requests', EXPENSE: 'Expenses', ASSET: 'Assets',
  STORE: 'Store & Inventory', STOCK: 'Store & Inventory', BALANCE: 'Invoices', DISCOUNT: 'Invoices',
};

function actionCategory(action: string) {
  const prefix = Object.keys(ACTION_CATEGORY_LABELS).find((p) => action.startsWith(p));
  return prefix ? ACTION_CATEGORY_LABELS[prefix] : 'Other';
}

export function FinancialAuditLogPage() {
  type AuditRow = typeof auditEntries[0] & { actorName?: string; actorId?: string; entityType?: string; entityId?: string };
  const { data: apiAudit = [] as AuditRow[], isLoading } = useFinanceAuditLogs() as unknown as { data: AuditRow[]; isLoading: boolean };
  const session = useAuthStore((s) => s.session);
  const userRole = (session?.user as { role?: string } | undefined)?.role ?? 'FINANCE';
  const userName = session?.user?.name ?? 'Finance Officer';

  const [search, setSearch]   = useState('');
  const [category, setCategory] = useState('All');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Role-based visibility filter
  const allowedPrefixes = ROLE_ACTION_PREFIXES[userRole];
  const roleFiltered = allowedPrefixes
    ? apiAudit.filter((e) => allowedPrefixes.some((p) => e.action.startsWith(p)))
    : apiAudit;

  // Category filter
  const categories = ['All', ...Array.from(new Set(roleFiltered.map((e) => actionCategory(e.action)))).sort()];
  const catFiltered = category === 'All' ? roleFiltered : roleFiltered.filter((e) => actionCategory(e.action) === category);

  // Search filter
  const entries = search.trim()
    ? catFiltered.filter((e) => {
        const q = search.toLowerCase();
        return e.action.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q) || e.entity.toLowerCase().includes(q) || (e.actorName ?? '').toLowerCase().includes(q);
      })
    : catFiltered;

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PW = 297; const PH = 210; const M = 14; const CW = PW - M * 2;

      // Header
      doc.setFillColor(0, 51, 79); doc.rect(0, 0, PW, 44, 'F');
      if (logo) { doc.addImage(logo, 'PNG', M, 7, 26, 26, undefined, 'FAST'); }
      const tx = M + 30;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255); doc.text('Kilimanjaro Schools', tx, 15);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(7.5); doc.setTextColor(213, 154, 27); doc.text('Excellence in Education Since 2003', tx, 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(200, 220, 230);
      doc.text('P.O. Box 4502, Moshi, Kilimanjaro, Tanzania', tx, 25);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(160, 200, 220);
      doc.text('FINANCIAL AUDIT LOG', PW - M, 13, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.text('Immutable Audit Trail', PW - M, 22, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(213, 154, 27);
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}  ·  User: ${userName}  ·  Role: ${userRole}`, PW - M, 28, { align: 'right' });
      doc.setFillColor(213, 154, 27); doc.rect(0, 44, PW, 1.5, 'F');
      doc.setFillColor(248, 250, 252); doc.rect(0, 45.5, PW, 11, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0, 51, 79);
      doc.text(`${entries.length} event(s) · Category: ${category} · ${search ? `Search: "${search}"` : 'No search filter'}`, M, 53);

      let y = 63;
      // Table header
      doc.setFillColor(230, 240, 248); doc.rect(M, y, CW, 6.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(0, 51, 79);
      doc.text('DATE & TIME', M + 3, y + 4.5); doc.text('EVENT', M + 42, y + 4.5); doc.text('DESCRIPTION', M + 90, y + 4.5); doc.text('PERFORMED BY', M + 195, y + 4.5); doc.text('ENTITY', PW - M - 3, y + 4.5, { align: 'right' });
      y += 6.5;

      entries.forEach((e, idx) => {
        if (y > PH - 18) { doc.addPage(); y = 20; }
        if (idx % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(M, y, CW, 7, 'F'); }
        const dateStr = e.date ? new Date(e.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.2); doc.setTextColor(100, 116, 139); doc.text(dateStr, M + 3, y + 4.5);
        doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 51, 79); doc.text(e.action.replace(/_/g, ' '), M + 42, y + 4.5);
        // Generate description
        const meta = { describe: (_a: unknown, role: string, n?: string) => `${n || role} — ${e.action.replace(/_/g, ' ').toLowerCase()}` };
        const desc = meta.describe(e.after, e.actor, e.actorName);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42); doc.text(desc.substring(0, 68), M + 90, y + 4.5);
        doc.text((e.actorName ? `${e.actorName} (${e.actor})` : e.actor).substring(0, 28), M + 195, y + 4.5);
        doc.text(e.entity.substring(0, 22), PW - M - 3, y + 4.5, { align: 'right' });
        y += 7;
      });

      const tp = doc.getNumberOfPages();
      for (let p = 1; p <= tp; p++) {
        doc.setPage(p);
        doc.setFillColor(0, 51, 79); doc.rect(0, PH - 10, PW, 10, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(160, 200, 220);
        doc.text('Kilimanjaro Schools — Financial Audit Log — Confidential & Immutable', 14, PH - 4);
        doc.text(`Page ${p} of ${tp}`, PW - 14, PH - 4, { align: 'right' });
      }
      doc.save(`Audit-Log-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch { toast('Failed to generate PDF', 'error'); }
    finally { setPdfLoading(false); }
  };

  return (
    <FinanceWorkspaceShell title="Financial Audit Log" eyebrow="Immutable ledger events">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Audit Log' }]} />
      <AuditImmutableBanner />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94a3b8]" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, actors, entities…"
            className="h-10 w-full rounded-lg border border-[#d5dde6] bg-white pl-9 pr-3 text-sm font-semibold outline-none focus:border-[#00334f]"
          />
        </div>
        {/* Category filter */}
        <select value={category} onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-lg border border-[#d5dde6] bg-white px-3 text-sm font-semibold outline-none focus:border-[#00334f]">
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {/* Role badge */}
        <div className="flex items-center gap-1.5 rounded-lg border border-[#b0c8d4] bg-[#eef5f8] px-3 py-2 text-[11px] font-black uppercase tracking-widest text-[#00334f]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {allowedPrefixes ? `${userRole} view` : 'Full audit view'}
        </div>
        {/* PDF report */}
        <button
          onClick={handleDownloadPdf} disabled={pdfLoading || entries.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[#00334f] px-4 py-2 text-xs font-black text-white hover:bg-[#001e30] disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" />
          {pdfLoading ? 'Generating…' : 'Download Report'}
        </button>
      </div>

      {/* Count */}
      <p className="text-[11px] font-semibold text-[#94a3b8]">
        {isLoading ? 'Loading…' : `${entries.length} event(s) visible based on your role and filters`}
      </p>

      {/* Entries */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-[#eef5f8]" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-[#d5dde6] bg-white py-16 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-[#d5dde6]" />
          <p className="mt-3 font-black text-[#0f172a]">No audit events found</p>
          <p className="mt-1 text-sm text-[#64748b]">Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => <AuditLogRow key={entry.id} entry={entry} />)}
        </div>
      )}
    </FinanceWorkspaceShell>
  );
}

export function FinanceExportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const generateMutation = useGenerateReportMutation();

  const exportItems = [
    { label: 'Invoices CSV',                 icon: FileText,        reportType: 'finance-invoices',             format: 'csv' },
    { label: 'Payments CSV',                 icon: WalletCards,     reportType: 'finance-payments',             format: 'csv' },
    { label: 'Receipts CSV',                 icon: ReceiptText,     reportType: 'finance-receipts',             format: 'csv' },
    { label: 'Outstanding balances PDF',     icon: AlertTriangle,   reportType: 'finance-outstanding-balances', format: 'pdf' },
    { label: 'Collection summary PDF',       icon: FileSpreadsheet, reportType: 'finance-collection-summary',   format: 'pdf' },
    { label: 'Fee matrix CSV',               icon: FileSpreadsheet, reportType: 'finance-fee-matrix',           format: 'csv' },
    { label: 'Assets CSV',                   icon: FileText,        reportType: 'finance-assets',               format: 'csv' },
    { label: 'Audit log CSV',                icon: ShieldCheck,     reportType: 'finance-audit-log',            format: 'csv' },
  ];

  const handleExport = async (item: typeof exportItems[0]) => {
    setGenerating(item.label);
    toast(`Generating ${item.label}…`, 'info');
    try {
      const result = await generateMutation.mutateAsync({ type: item.reportType, format: item.format }) as Record<string, unknown> | undefined;
      const jobId = String(result?.id ?? result?.jobId ?? '');
      if (!jobId) throw new Error('No job id');
      await downloadReportWhenReady(jobId, `${item.label}.${item.format}`);
      toast(`${item.label} downloaded`, 'success');
    } catch {
      toast(`Failed to generate ${item.label}. Please try again.`, 'error');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <FinanceWorkspaceShell title="Finance Export Center" eyebrow="Controlled extraction">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Export Center' }]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {exportItems.map((item) => (
          <div key={item.label} className="group flex flex-col rounded-lg border border-[#d5dde6] bg-white p-5 transition hover:border-[#00334f] hover:shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-[#00334f]/20 bg-[#00334f]/5">
              <item.icon className="h-5 w-5 text-[#00334f]" />
            </div>
            <h3 className="mt-4 font-display text-lg font-black text-[#00334f]">{item.label}</h3>
            <p className="mt-2 grow text-sm font-semibold text-[#64748b]">
              Export creates an audit row with actor, filters, and timestamp.
            </p>
            <Button className="mt-4 w-full rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none" disabled={generating !== null}
              onClick={() => handleExport(item)}>
              <Download className="h-4 w-4" /> {generating === item.label ? 'Generating…' : 'Export'}
            </Button>
          </div>
        ))}
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Route index page ─────────────────────────────────────────────────────────

export function FinanceRouteIndexPage() {
  const links: Array<[string, string, LucideIcon]> = [
    ['Invoices',  '/finance/invoices',              FileText],
    ['Payments',  '/finance/payments',              Banknote],
    ['Receipts',  '/finance/receipts',              ReceiptText],
    ['Fees',      '/finance/fee-structures',        FileSpreadsheet],
    ['Reports',   '/finance/reports',               WalletCards],
    ['Audit',     '/finance/audit',                 ShieldCheck],
  ];

  return (
    <FinanceWorkspaceShell title="Finance Workspace Index" eyebrow="Route safety">
      <div className="grid gap-gutter md:grid-cols-3">
        {links.map(([label, to, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className="rounded-lg border border-[#d5dde6] bg-white p-5 transition hover:border-[#00334f] hover:shadow-sm"
          >
            <Icon className="h-6 w-6 text-[#00334f]" />
            <p className="mt-3 font-display text-xl font-black text-[#00334f]">{label}</p>
          </NavLink>
        ))}
      </div>
    </FinanceWorkspaceShell>
  );
}

export function FinanceNotReadyState() {
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white p-6">
      <AlertTriangle className="h-6 w-6 text-[#e11d48]" />
      <h2 className="mt-3 font-display text-xl font-black text-[#00334f]">Data unavailable</h2>
      <p className="mt-1 text-sm font-semibold text-[#64748b]">
        Retry will call the finance gateway once live endpoints are attached.
      </p>
      <Button className="mt-4 rounded bg-[#00334f] hover:shadow-none" onClick={() => window.location.reload()}>
        <CheckCircle2 className="h-4 w-4" /> Retry
      </Button>
    </div>
  );
}

// ─── Shared page components ───────────────────────────────────────────────────

function ReportPage({
  title,
  reportBreadcrumb,
  chartValues,
  overdue = false,
}: {
  title: string;
  reportBreadcrumb: string;
  chartValues: Array<{ label: string; value: number; tone?: string }>;
  overdue?: boolean;
}) {
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as unknown as { data: typeof financeOverview };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  const generateMutation = useGenerateReportMutation();
  const collected = overdue ? apiOverview.outstanding : apiOverview.totalCollected;
  const collectedPct = apiOverview.totalInvoiced > 0 ? Math.round((collected / apiOverview.totalInvoiced) * 100) : 0;
  const invoiceCount = apiPayments.length;
  const today = new Date().toLocaleDateString();
  // Real collection trend: bucket confirmed payments by day
  const trendData = useMemo(() => {
    const byDay = new Map<string, number>();
    apiPayments.forEach((p) => {
      const day = String(p.date ?? '').slice(0, 10);
      if (!day) return;
      byDay.set(day, (byDay.get(day) ?? 0) + (p.amount ?? 0));
    });
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [apiPayments]);
  return (
    <FinanceWorkspaceShell title={title} eyebrow="Generated report workspace">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: reportBreadcrumb }]} />
      <FinanceMetricStrip items={[
        { label: overdue ? 'Outstanding' : 'Collected', value: formatTZS(collected), detail: 'Current term', tone: overdue ? 'red' : 'green', trend: overdue ? 'down' : 'up', progress: collectedPct },
        { label: 'Payments', value: String(invoiceCount), detail: 'Report scope', tone: 'navy' },
        { label: 'Collection Rate', value: `${apiOverview.collectionRate}%`, detail: 'Term rate', tone: 'slate' },
        { label: 'Generated', value: today, detail: 'Live report', tone: 'gold' },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <MiniColumnChart title="Collection Trend" subtitle={trendData.length ? `${trendData.length}-day view` : 'No dated payments yet'} data={trendData.length ? trendData : [collected]} startLabel="Earliest" endLabel="Latest" />
          {chartValues.length ? <DenseBarChart values={chartValues} /> : null}
        </div>
        <div className="space-y-gutter sticky top-24 h-fit">
          <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Report Actions</p>
            <div className="mt-4 space-y-2">
              <Button variant="secondary" className="w-full justify-between rounded"
                onClick={async () => { toast('Generating PDF…', 'info'); try { const result = await generateMutation.mutateAsync({ type: 'finance-report', format: 'pdf', report: reportBreadcrumb }) as Record<string, unknown>; const jobId = String(result?.id ?? result?.jobId ?? ''); if (jobId) { await downloadReportWhenReady(jobId, `${reportBreadcrumb}.pdf`); toast('PDF downloaded', 'success'); } } catch { toast('Failed to generate PDF', 'error'); } }}>
                <span>Download PDF</span><ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="secondary" className="w-full justify-between rounded"
                onClick={async () => { toast('Generating CSV…', 'info'); try { const result = await generateMutation.mutateAsync({ type: 'finance-report', format: 'csv', report: reportBreadcrumb }) as Record<string, unknown>; const jobId = String(result?.id ?? result?.jobId ?? ''); if (jobId) { await downloadReportWhenReady(jobId, `${reportBreadcrumb}.csv`); toast('CSV downloaded', 'success'); } } catch { toast('Failed to generate CSV', 'error'); } }}>
                <span>Export CSV</span><ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <PaymentTable rows={apiPayments} />
    </FinanceWorkspaceShell>
  );
}

function SideSummary({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="sticky top-24 h-fit rounded-lg border border-[#d5dde6] bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Preview</p>
      <h3 className="mt-1 font-display text-2xl font-black text-[#00334f]">{title}</h3>
      <div className="mt-5 space-y-3 border-t border-[#d5dde6] pt-4">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-[#64748b]">{label}</span>
            <span className="text-right font-mono font-black text-[#0f172a]">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded border-l-4 border-[#e11d48] bg-[#e11d48]/5 p-3 text-xs font-bold text-[#e11d48]">
        High-risk finance mutations require reason, confirmation, and immutable audit logging.
      </div>
    </div>
  );
}

function Timeline({ rows }: { rows: string[] }) {
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
      <h2 className="font-display text-xl font-black text-[#00334f]">Timeline</h2>
      <div className="mt-5 space-y-4 border-l-2 border-[#d5dde6] pl-5">
        {rows.map((row, index) => (
          <div key={row} className="relative">
            <span className={`absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${index === rows.length - 1 ? 'bg-[#d59a1b]' : 'bg-[#00334f]'}`} />
            <p className="text-sm font-black text-[#00334f]">{row}</p>
            <p className="text-xs font-semibold text-[#64748b]">Recorded in system</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function InvoiceActionPanel({ invoice, onRecordPayment, onDownloadPdf, onRegenPdf, onDiscount, onWaive, onCancel, canCancel = true, isPending }: {
  invoice: (typeof invoices)[number];
  onRecordPayment: () => void;
  onDownloadPdf: () => void;
  onRegenPdf: () => void;
  onDiscount: () => void;
  onWaive: () => void;
  onCancel: () => void;
  canCancel?: boolean;
  isPending: boolean;
}) {
  const showCancel = canCancel && invoice.status !== 'PAID' && invoice.status !== 'VOID' && invoice.status !== 'CANCELLED';
  return (
    <div className="space-y-gutter sticky top-24 h-fit">
      <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Invoice Actions</p>
        <div className="mt-4 space-y-2">
          {invoice.status !== 'PAID' && (
            <Button variant="secondary" className="w-full justify-between rounded" onClick={onRecordPayment}>
              <span>Record payment</span><ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <Button variant="secondary" className="w-full justify-between rounded" loading={isPending} onClick={onDownloadPdf}>
            <span className="flex items-center gap-2"><Download className="h-4 w-4" />{isPending ? 'Generating…' : 'Download invoice PDF'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="w-full justify-between rounded" loading={isPending} onClick={onRegenPdf}>
            <span className="flex items-center gap-2"><RefreshCw className="h-4 w-4" />{isPending ? 'Generating…' : 'Re-download PDF'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          {invoice.status !== 'PAID' && (
            <Button variant="secondary" className="w-full justify-between rounded" onClick={onDiscount} disabled={isPending}>
              <span>Apply discount</span><ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {invoice.status !== 'PAID' && (
            <Button variant="secondary" className="w-full justify-between rounded" onClick={onWaive} disabled={isPending}>
              <span>Waive balance</span><ArrowRight className="h-4 w-4" />
            </Button>
          )}
          {showCancel ? (
            <Button variant="secondary" className="w-full justify-between rounded border-red-200 text-red-600 hover:bg-red-50" onClick={onCancel} disabled={isPending}>
              <span>Cancel invoice</span><ArrowRight className="h-4 w-4" />
            </Button>
          ) : invoice.status !== 'PAID' && invoice.status !== 'VOID' && invoice.status !== 'CANCELLED' ? (
            <div className="flex items-center gap-2 rounded border border-red-100 px-3 py-2.5 text-xs font-semibold text-red-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Cancel blocked — payments exist on this invoice
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, to }: { title: string; to: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="font-display text-xl font-black text-[#00334f]">{title}</h2>
      <NavLink to={to} className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#d59a1b]">
        Open <ArrowRight className="h-3.5 w-3.5" />
      </NavLink>
    </div>
  );
}

// ─── Param hooks — these are now unused (detail pages use hooks directly) ─────
// Kept for any remaining internal uses
