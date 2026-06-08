import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  ReceiptText,
  Send,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
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
  useDeactivateFeeStructureMutation,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useCreateFeeCategoryMutation,
  useUpdateFeeCategoryMutation,
  useWaiveInvoiceMutation,
  useRegeneratePdfMutation,
  useApplyInvoiceDiscountMutation,
  useCancelInvoiceMutation,
  useVoidReceiptMutation,
  useDisposeAssetMutation,
  useRefundPaymentMutation,
  useGenerateInvoicesMutation,
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
} from '../components/FinanceWorkspaceShell';
import { formatDate, formatTZS, overdueInvoices } from '../utils/money';
import { useFinanceClasses, useFinanceAcademicYears, useFinanceTerms } from '../api/financeOps.hooks';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { SkeletonCards } from '../../../components/common/SkeletonCards';

// Zero-value overview — shown when API hasn't returned data yet (no fake numbers)
const EMPTY_OVERVIEW: typeof financeOverview = { totalInvoiced: 0, totalCollected: 0, outstanding: 0, collectionRate: 0, today: 0, overdueInvoices: 0 };

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function FinanceHomePage() {
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as unknown as { data: typeof financeOverview };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const overdue = overdueInvoices(apiInvoices);
  const base = apiOverview.totalInvoiced || 1; // guard against division by zero before data loads
  const collectedPct = Math.round((apiOverview.totalCollected / base) * 100);
  const outstandingPct = Math.round((apiOverview.outstanding / base) * 100);
  return (
    <FinanceWorkspaceShell title="Finance Operations Desk" eyebrow="Precision Ledger">
      <FinanceMetricStrip items={[
        {
          label: 'Total Invoiced',
          value: formatTZS(apiOverview.totalInvoiced),
          detail: 'Term II 2026 base',
          tone: 'navy',
          progress: collectedPct,
        },
        {
          label: 'Collected',
          value: formatTZS(apiOverview.totalCollected),
          detail: `${collectedPct}% of invoiced · cash, bank, mobile`,
          tone: 'green',
          trend: 'up',
        },
        {
          label: 'Outstanding',
          value: formatTZS(apiOverview.outstanding),
          detail: `${apiOverview.overdueInvoices} overdue invoices`,
          tone: 'red',
          trend: 'down',
          progress: outstandingPct,
        },
        {
          label: 'Today',
          value: formatTZS(apiOverview.today),
          detail: 'Live collection desk',
          tone: 'gold',
          trend: 'up',
        },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        {/* ── Left: ring + bar chart ── */}
        <div className="space-y-gutter">
          <CollectionRing rate={apiOverview.collectionRate} />
          <DenseBarChart title="Term Collection" subtitle="Invoiced vs collected vs outstanding" values={[
            { label: 'Invoiced',     value: apiOverview.totalInvoiced,  tone: 'bg-[#00334f]' },
            { label: 'Collected',    value: apiOverview.totalCollected, tone: 'bg-[#10b981]' },
            { label: 'Outstanding',  value: apiOverview.outstanding,    tone: 'bg-[#d59a1b]' },
          ]} />
        </div>

        {/* ── Center: recent data ── */}
        <div className="space-y-gutter">
          <SectionTitle title="Recent Payments" to="/finance/payments" />
          <PaymentTable rows={apiPayments.slice(0, 4)} />
          <SectionTitle title="Overdue Invoices" to="/finance/invoices" />
          <InvoiceTable rows={overdue.length ? overdue : apiInvoices.filter((i) => i.status !== 'PAID')} />
        </div>

        {/* ── Right: actions + approval notice ── */}
        <div className="space-y-gutter">
          <ReadOnlyApprovalNotice />
          <ActionPanel
            title="Fast Actions"
            items={[
              'Record cash payment',
              'Record bank transfer',
              'Generate invoices',
              'Open defaulters report',
              'Export daily collection',
            ]}
          />
          <MiniColumnChart
            title="Daily Trend"
            subtitle="Invoiced vs Collected"
            data={[apiOverview.totalCollected, apiOverview.outstanding]}
            startLabel="Collected"
            endLabel="Outstanding"
          />
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Invoice pages ────────────────────────────────────────────────────────────

export function InvoiceListPage() {
  const { data: apiInvoices = [] as typeof invoices, isLoading, isError, refetch } = useInvoices() as unknown as { data: typeof invoices; isLoading: boolean; isError: boolean; refetch: () => void };
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const visibleInvoices = invoiceSearch.trim().length > 0
    ? apiInvoices.filter((inv) => {
        const q = invoiceSearch.toLowerCase();
        return (
          inv.number.toLowerCase().includes(q) ||
          inv.student.toLowerCase().includes(q) ||
          inv.className.toLowerCase().includes(q)
        );
      })
    : apiInvoices;
  return (
    <FinanceWorkspaceShell title="Invoice Ledger" eyebrow="Find, filter, inspect">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]} />
      <FinanceFilters items={['Status', 'Class', 'Term', 'Due date', 'Outstanding amount', 'Student or invoice search']} onSearch={setInvoiceSearch} />
      {isLoading ? (
        <SkeletonTable cols={7} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiInvoices.length ? (
        <EmptyState title="No invoices yet" description="Generate invoices for a term to begin tracking." action={{ label: 'Generate Invoices', href: '/finance/invoices/generate' }} />
      ) : (
        <InvoiceTable rows={visibleInvoices} />
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
  const cancelMutation = useCancelInvoiceMutation();
  const discountMutation = useApplyInvoiceDiscountMutation();
  const waiveMutation = useWaiveInvoiceMutation();
  const regenPdfMutation = useRegeneratePdfMutation();
  const navigate = useNavigate();

  if (isLoading) return <FinanceWorkspaceShell title="Loading…" eyebrow="Invoice investigation"><SkeletonTable cols={3} /></FinanceWorkspaceShell>;
  if (!apiInvoice) return <FinanceWorkspaceShell title="Not Found" eyebrow="Invoice investigation"><EmptyState title="Invoice not found" description="This invoice does not exist or has been cancelled." /></FinanceWorkspaceShell>;

  const invoice = apiInvoice;
  const invoicePayments = allPayments.filter((p) => p.invoiceId === invoice.id || p.invoiceNumber === invoice.number);
  return (
    <FinanceWorkspaceShell title={invoice.number} eyebrow="Invoice investigation">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }, { label: invoice.number }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            {
              label: 'Invoice Total',
              value: formatTZS(invoice.total),
              detail: invoice.term,
              tone: 'navy',
            },
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
            {
              label: 'Status',
              value: invoice.status,
              detail: invoice.student,
              tone: 'slate',
            },
          ]} />
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
          onRecordPayment={() => navigate('/finance/payments/cash')}
          onDownloadPdf={() => { window.open(`/api/v1/finance/invoices/${invoice.id}/pdf`, '_blank'); }}
          onRegenPdf={() => regenPdfMutation.mutate(invoice.id, { onSuccess: () => toast('PDF regenerated', 'success'), onError: () => toast('Failed to regenerate PDF', 'error') })}
          onDiscount={() => { const reason = window.prompt('Discount amount (TZS) and reason (format: 50000|reason):'); if (!reason) return; const [amtStr, ...rest] = reason.split('|'); discountMutation.mutate({ id: invoice.id, body: { discountAmount: Number(amtStr), reason: rest.join('|') } }, { onSuccess: () => toast('Discount applied', 'success'), onError: () => toast('Failed to apply discount', 'error') }); }}
          onWaive={() => { const reason = window.prompt('Reason for waiving balance:'); if (!reason) return; waiveMutation.mutate({ id: invoice.id, body: { reason } }, { onSuccess: () => toast('Balance waived', 'warning'), onError: () => toast('Failed to waive balance', 'error') }); }}
          onCancel={() => { if (!window.confirm('Cancel this invoice? This cannot be undone.')) return; cancelMutation.mutate({ id: invoice.id }, { onSuccess: () => { toast('Invoice cancelled', 'warning'); navigate('/finance/invoices'); }, onError: () => toast('Failed to cancel invoice', 'error') }); }}
          isPending={cancelMutation.isPending || discountMutation.isPending || waiveMutation.isPending || regenPdfMutation.isPending}
        />
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Payment pages ────────────────────────────────────────────────────────────

export function RecordCashPaymentPage() {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  return (
    <FinanceWorkspaceShell title="Record Cash Payment" eyebrow="Cash desk entry">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Record Cash' }]} />
      <PaymentForm method="cash" invoices={apiInvoices} references={apiPayments.map((p) => p.reference ?? '')} />
    </FinanceWorkspaceShell>
  );
}

export function RecordBankTransferPage() {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const { data: apiPayments = [] as typeof payments } = usePayments() as unknown as { data: typeof payments };
  return (
    <FinanceWorkspaceShell title="Record Bank Transfer" eyebrow="Statement-safe posting">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Record Bank Transfer' }]} />
      <PaymentForm method="bank" invoices={apiInvoices} references={apiPayments.map((p) => p.reference ?? '')} />
    </FinanceWorkspaceShell>
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

export function PendingPaymentApprovalsPage() {
  const { data: apiPending = [] as typeof payments } = usePendingPaymentApprovals() as unknown as { data: typeof payments };
  return (
    <FinanceWorkspaceShell title="Pending Payment Approvals" eyebrow="Read-only approval queue">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Pending Approvals' }]} />
      <ReadOnlyApprovalNotice />
      <PaymentTable rows={apiPending} />
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

export function ReceiptListPage() {
  const { data: apiReceipts = [] as typeof receipts, isLoading, isError, refetch } = useReceipts() as unknown as { data: typeof receipts; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <FinanceWorkspaceShell title="Receipt Ledger" eyebrow="Receipts and void controls">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts' }]} />
      {isLoading ? (
        <SkeletonTable cols={5} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiReceipts.length ? (
        <EmptyState title="No receipts yet" description="Receipts are generated automatically when payments are approved." />
      ) : (
        <ReceiptList rows={apiReceipts} />
      )}
    </FinanceWorkspaceShell>
  );
}

export function ReceiptDetailPage() {
  const { id } = useParams();
  const { data: apiReceipt, isLoading } = useReceiptById(id ?? '') as unknown as { data: (typeof receipts)[number] | undefined; isLoading: boolean; isError: boolean };
  const voidMutation = useVoidReceiptMutation();
  const navigate = useNavigate();

  if (isLoading) return <FinanceWorkspaceShell title="Loading…" eyebrow="Receipt view"><SkeletonTable cols={3} /></FinanceWorkspaceShell>;
  if (!apiReceipt) return <FinanceWorkspaceShell title="Not Found" eyebrow="Receipt view"><EmptyState title="Receipt not found" description="This receipt does not exist." /></FinanceWorkspaceShell>;

  const receipt = apiReceipt;
  return (
    <FinanceWorkspaceShell title={receipt.number} eyebrow="Receipt view">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts', to: '/finance/receipts' }, { label: receipt.number }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <ReceiptPreview receipt={receipt} />
        <div className="space-y-gutter">
          <div className="rounded-lg border border-[#d5dde6] bg-white p-5 sticky top-24">
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Receipt Controls</p>
            <div className="mt-4 space-y-2">
              <Button variant="secondary" className="w-full justify-between rounded"
                onClick={() => { window.open(`/api/v1/finance/receipts/${receipt.id}/pdf`, '_blank'); }}>
                <span>Download receipt PDF</span><ArrowRight className="h-4 w-4" />
              </Button>
              {receipt.status !== 'VOID' && (
                <Button variant="secondary" className="w-full justify-between rounded"
                  onClick={() => { const reason = window.prompt('Reason for voiding this receipt:'); if (!reason) return; voidMutation.mutate({ id: receipt.id, body: { reason } }, { onSuccess: () => { toast('Receipt voided', 'warning'); navigate('/finance/receipts'); }, onError: () => toast('Failed to void receipt', 'error') }); }}>
                  <span>Void receipt with reason</span><ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <NavLink to={`/finance/payments/${receipt.paymentId ?? ''}`}><Button variant="secondary" className="w-full justify-between rounded"><span>Open payment profile</span><ArrowRight className="h-4 w-4" /></Button></NavLink>
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
          {apiCategories.map((category) => (
            <tr key={category.id} className="even:bg-[#f7f9fb]">
              <Td>{category.order}</Td>
              <Td>{category.code}</Td>
              <Td>{category.name}</Td>
              <Td>
                <Badge tone={category.mandatory ? 'emerald' : 'amber'}>
                  {category.mandatory ? 'mandatory' : 'optional'}
                </Badge>
              </Td>
              <Td amount><AmountDisplay amount={category.amount} /></Td>
              <Td>{category.frequency}</Td>
              <Td>{category.usedByStructures}</Td>
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
        <ActionPanel title="Category Actions" items={['Create category', 'Save reordered list', 'Preview delete block', 'Sync matrix']} />
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
      setForm({ name: existing.name ?? '', code: existing.code ?? '', mandatory: existing.mandatory ? 'mandatory' : 'optional', amount: String(existing.amount ?? ''), frequency: existing.frequency ?? 'TERM', order: String(existing.order ?? '') });
    }
  }, [existing?.id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) { toast('Name and code are required', 'error'); return; }
    const body = { name: form.name, code: form.code, mandatory: form.mandatory === 'mandatory', amount: Number(form.amount), frequency: form.frequency, order: Number(form.order) || undefined };
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
  return (
    <FinanceWorkspaceShell title="Fee Matrix" eyebrow="Desktop-grade pricing grid">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Matrix' }]} />
      <FeeMatrixGrid
        categories={['Tuition', 'Boarding', 'Meals', 'Library and ICT', 'Exam Preparation', 'Science Lab']}
        classes={['Class 1-3', 'Class 4-6/7', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5 PCM/PCB', 'Form 6']}
      />
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
  const totalCost = (apiAssetSummary?.totalPurchaseCost as number | undefined) ?? 0;
  const currentValue = (apiAssetSummary?.totalCurrentValue as number | undefined) ?? 0;
  return (
    <FinanceWorkspaceShell title="School Assets Ledger" eyebrow="Assets, values, disposal">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets' }]} />
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
          detail: 'Depreciated book value',
          tone: 'green',
          trend: 'down',
          progress: totalCost > 0 ? Math.round((currentValue / totalCost) * 100) : 0,
        },
        {
          label: 'Service Due',
          value: String((apiAssetSummary?.serviceDue as number | undefined) ?? 0),
          detail: 'Maintenance attention needed',
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
  const { data: apiAsset } = useAssetById(id ?? '') as { data: (typeof assets)[number] | undefined };
  const createMutation = useCreateAssetMutation();
  const updateMutation = useUpdateAssetMutation();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const [form, setForm] = useState({ name: '', category: 'ELECTRONICS', type: 'MOVABLE', condition: 'GOOD', status: 'ACTIVE', brand: '', model: '', serialNumber: '', purchaseDate: '', purchaseCost: '', currentValue: '', location: '', assignedTo: '', warrantyExpiry: '' });

  useEffect(() => {
    if (apiAsset) {
      const a = apiAsset as Record<string, unknown>;
      const dateOnly = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '');
      setForm({ name: String(a.name ?? ''), category: String(a.category ?? 'ELECTRONICS'), type: String(a.type ?? 'MOVABLE'), condition: String(a.condition ?? 'GOOD'), status: String(a.status ?? 'ACTIVE'), brand: String(a.brand ?? ''), model: String(a.model ?? ''), serialNumber: String(a.serialNumber ?? ''), purchaseDate: dateOnly(a.purchaseDate), purchaseCost: String(a.purchaseCost ?? ''), currentValue: String(a.currentValue ?? ''), location: String(a.location ?? ''), assignedTo: String(a.assignedTo ?? ''), warrantyExpiry: dateOnly(a.warrantyExpiryDate ?? a.warrantyExpiry) });
    }
  }, [apiAsset?.id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast('Asset name is required', 'error'); return; }
    const body: Record<string, unknown> = {
      name: form.name, category: form.category, type: form.type, condition: form.condition, status: form.status,
      brand: form.brand || undefined, model: form.model || undefined, serialNumber: form.serialNumber || undefined,
      purchaseDate: form.purchaseDate || undefined,
      purchaseCost: form.purchaseCost ? String(form.purchaseCost) : undefined,
      currentValue: form.currentValue ? String(form.currentValue) : undefined,
      location: form.location || undefined, assignedTo: form.assignedTo || undefined,
      warrantyExpiry: form.warrantyExpiry || undefined,
    };
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

  return (
    <FinanceWorkspaceShell title={title} eyebrow="Asset control">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets', to: '/finance/assets' }, { label: mode === 'create' ? 'Register Asset' : 'Edit Asset' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={handleSubmit} className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex items-center gap-3 border-b border-[#d5dde6] pb-4">
            <FileSpreadsheet className="h-5 w-5 text-[#00334f]" />
            <div>
              <h2 className="font-display text-xl font-black text-[#00334f]">{title}</h2>
              <p className="text-sm font-semibold text-[#64748b]">All asset changes are audited.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Name *</span>
              <input required value={form.name} onChange={set('name')} placeholder="e.g. Dell Laptop XPS 15" className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
            </label>
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
              <Send className="h-4 w-4" /> {isPending ? 'Saving…' : (mode === 'create' ? 'Register Asset' : 'Save Changes')}
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
  return (
    <FinanceWorkspaceShell title={asset.name} eyebrow="Asset profile">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets', to: '/finance/assets' }, { label: asset.name }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            { label: 'Purchase Cost', value: formatTZS(asset.purchaseCost), detail: `Purchased ${formatDate(asset.purchaseDate)}`, tone: 'navy' },
            { label: 'Current Value', value: formatTZS(asset.currentValue), detail: `Condition: ${asset.condition}`, tone: 'green', trend: 'down', progress: asset.purchaseCost > 0 ? Math.round((asset.currentValue / asset.purchaseCost) * 100) : 0 },
            { label: 'Location', value: asset.location, detail: `Assigned to: ${asset.assignedTo}`, tone: 'slate' },
            { label: 'Warranty', value: asset.warrantyExpiry, detail: asset.brand, tone: asset.warrantyExpiry === 'Expired' ? 'red' : 'gold', trend: asset.warrantyExpiry === 'Expired' ? 'down' : undefined },
          ]} />
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
  return (
    <FinanceWorkspaceShell title="Financial Reports" eyebrow="Report generator">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports' }]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        <ReportCard title="Collection Summary"    description="Collected, pending, method and fee-category splits."       to="/finance/reports/collection" />
        <ReportCard title="Outstanding Balances"  description="Invoice debt sorted by class, student, and due date."      to="/finance/reports/outstanding" />
        <ReportCard title="Daily Collections"     description="Cash, bank, mobile money close-of-day report."             to="/finance/reports/daily-collections" />
        <ReportCard title="Fee Defaulters"         description="Overdue students and guardian follow-up placeholders."    to="/finance/reports/fee-defaulters" />
      </div>
      <ActionPanel
        title="Recent Generated Reports"
        items={[
          'Term II collection summary PDF',
          'Outstanding balances CSV',
          'Assets ledger CSV',
          'Audit log export',
        ]}
      />
    </FinanceWorkspaceShell>
  );
}

const BAR_TONES = ['bg-[#00334f]', 'bg-[#d59a1b]', 'bg-[#10b981]', 'bg-[#64748b]', 'bg-[#e11d48]', 'bg-[#0ea5e9]'];

export function CollectionSummaryReportPage() {
  const { data: summary } = useCollectionSummary() as unknown as {
    data?: { byPaymentMethod?: Array<{ method: string; totalAmount: unknown }>; byFeeCategory?: Array<{ category?: string; name?: string; totalAmount: unknown }> };
  };
  // Prefer fee-category breakdown; fall back to payment-method mix (both real)
  const cats = summary?.byFeeCategory ?? [];
  const methods = summary?.byPaymentMethod ?? [];
  const source = cats.length
    ? cats.map((c) => ({ label: String(c.category ?? c.name ?? '—'), value: Number(c.totalAmount ?? 0) }))
    : methods.map((m) => ({ label: prettyMethod(m.method), value: Number(m.totalAmount ?? 0) }));
  const chartValues = source.map((s, i) => ({ ...s, tone: BAR_TONES[i % BAR_TONES.length] }));
  return <ReportPage title="Collection Summary Report" reportBreadcrumb="Collection Summary" chartValues={chartValues} />;
}

export function OutstandingBalancesReportPage() {
  const { data: balances = [] } = useOutstandingBalances() as unknown as {
    data: Array<{ className?: string; outstanding?: number }>;
  };
  // Aggregate real outstanding amounts by class, top 6
  const byClass = new Map<string, number>();
  balances.forEach((b) => {
    const key = b.className?.trim() || 'Unassigned';
    byClass.set(key, (byClass.get(key) ?? 0) + (b.outstanding ?? 0));
  });
  const chartValues = [...byClass.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([label, value], i) => ({ label, value, tone: BAR_TONES[i % BAR_TONES.length] }));
  return <ReportPage title="Outstanding Balances Report" reportBreadcrumb="Outstanding Balances" chartValues={chartValues} overdue />;
}

export function DailyCollectionsReportPage() {
  const { data: summary } = useCollectionSummary() as unknown as {
    data?: { byPaymentMethod?: Array<{ method: string; totalAmount: unknown; transactionCount?: number }> };
  };
  const chartValues = (summary?.byPaymentMethod ?? []).map((m, i) => ({
    label: prettyMethod(m.method),
    value: Number(m.totalAmount ?? 0),
    tone: BAR_TONES[i % BAR_TONES.length],
  }));
  return <ReportPage title="Daily Collections Report" reportBreadcrumb="Daily Collections" chartValues={chartValues} />;
}

function prettyMethod(m: string): string {
  return String(m ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FeeDefaultersReportPage() {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as unknown as { data: typeof invoices };
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as unknown as { data: typeof financeOverview };
  const overdue = overdueInvoices(apiInvoices);
  return (
    <FinanceWorkspaceShell title="Fee Defaulters Report" eyebrow="Overdue follow-up">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Fee Defaulters' }]} />
      {(() => {
        const overdueTotal = overdue.reduce((s, i) => s + (i.outstanding ?? 0), 0);
        const thirtyDays = overdue.filter((i) => { const d = new Date(i.dueDate ?? ''); return !isNaN(d.getTime()) && (Date.now() - d.getTime()) > 30 * 864e5; }).length;
        const largest = [...overdue].sort((a, b) => (b.outstanding ?? 0) - (a.outstanding ?? 0))[0];
        return (
          <>
            <FinanceMetricStrip items={[
              { label: 'Overdue Total', value: formatTZS(overdueTotal || apiOverview.outstanding), detail: `${overdue.length} outstanding invoices`, tone: 'red', trend: 'down', progress: apiOverview.totalInvoiced > 0 ? Math.round(((overdueTotal || apiOverview.outstanding) / apiOverview.totalInvoiced) * 100) : 0 },
              { label: '30+ Days', value: String(thirtyDays), detail: 'Guardian contact needed', tone: 'gold', trend: 'up' },
              { label: 'Largest Balance', value: formatTZS(largest?.outstanding ?? 0), detail: largest ? `${largest.student} · ${largest.className}` : '—', tone: 'red' },
              { label: 'Total Overdue', value: String(overdue.length), detail: 'Needs follow-up', tone: 'navy' },
            ]} />
            <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
              <InvoiceTable rows={overdue.length > 0 ? overdue : apiInvoices.filter((i) => i.status !== 'PAID')} />
              <div className="space-y-gutter sticky top-24 h-fit">
                <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Defaulter Actions</p>
                  <div className="mt-4 space-y-2">
                    <Button variant="secondary" className="w-full justify-between rounded" onClick={() => toast('CSV export started…', 'info')}><span>Export defaulters CSV</span><ArrowRight className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="w-full justify-between rounded" onClick={() => toast('PDF export started…', 'info')}><span>Export defaulters PDF</span><ArrowRight className="h-4 w-4" /></Button>
                    <NavLink to="/principal/finance"><Button variant="secondary" className="w-full justify-between rounded"><span>Flag for Principal review</span><ArrowRight className="h-4 w-4" /></Button></NavLink>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}
    </FinanceWorkspaceShell>
  );
}

// ─── Audit + export pages ─────────────────────────────────────────────────────

export function FinancialAuditLogPage() {
  const { data: apiAudit = [] as typeof auditEntries } = useFinanceAuditLogs() as unknown as { data: typeof auditEntries };
  return (
    <FinanceWorkspaceShell title="Financial Audit Log" eyebrow="Immutable ledger events">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Audit Log' }]} />
      <AuditImmutableBanner />
      <FinanceFilters items={['Action', 'Actor', 'Entity', 'Date range', 'Correlation ID']} />
      <div className="space-y-3">
        {apiAudit.map((entry) => <AuditLogRow key={entry.id} entry={entry} />)}
      </div>
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

function InvoiceActionPanel({ invoice, onRecordPayment, onDownloadPdf, onRegenPdf, onDiscount, onWaive, onCancel, isPending }: {
  invoice: (typeof invoices)[number];
  onRecordPayment: () => void;
  onDownloadPdf: () => void;
  onRegenPdf: () => void;
  onDiscount: () => void;
  onWaive: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const canCancel = invoice.status !== 'PAID' && invoice.status !== 'VOID';
  return (
    <div className="space-y-gutter sticky top-24 h-fit">
      <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
        <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Invoice Actions</p>
        <div className="mt-4 space-y-2">
          {invoice.status !== 'PAID' && <Button variant="secondary" className="w-full justify-between rounded" onClick={onRecordPayment}><span>Record payment</span><ArrowRight className="h-4 w-4" /></Button>}
          <Button variant="secondary" className="w-full justify-between rounded" onClick={onDownloadPdf}><span>Download invoice PDF</span><ArrowRight className="h-4 w-4" /></Button>
          <Button variant="secondary" className="w-full justify-between rounded" onClick={onRegenPdf} disabled={isPending}><span>Regenerate PDF</span><ArrowRight className="h-4 w-4" /></Button>
          {invoice.status !== 'PAID' && <Button variant="secondary" className="w-full justify-between rounded" onClick={onDiscount} disabled={isPending}><span>Apply discount</span><ArrowRight className="h-4 w-4" /></Button>}
          {invoice.status !== 'PAID' && <Button variant="secondary" className="w-full justify-between rounded" onClick={onWaive} disabled={isPending}><span>Waive balance</span><ArrowRight className="h-4 w-4" /></Button>}
          {canCancel && <Button variant="secondary" className="w-full justify-between rounded border-red-200 text-red-600 hover:bg-red-50" onClick={onCancel} disabled={isPending}><span>Cancel invoice</span><ArrowRight className="h-4 w-4" /></Button>}
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
