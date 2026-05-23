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
import { NavLink, useParams } from 'react-router-dom';
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
import { formatTZS, overdueInvoices } from '../utils/money';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { SkeletonCards } from '../../../components/common/SkeletonCards';

// Zero-value overview — shown when API hasn't returned data yet (no fake numbers)
const EMPTY_OVERVIEW: typeof financeOverview = { totalInvoiced: 0, totalCollected: 0, outstanding: 0, collectionRate: 0, today: 0, overdueInvoices: 0 };

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function FinanceHomePage() {
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as { data: typeof financeOverview };
  const { data: apiPayments = [] as typeof payments } = usePayments() as { data: typeof payments };
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as { data: typeof invoices };
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
          <DenseBarChart values={[
            { label: 'Cash',         value: 740_000,   tone: 'bg-[#10b981]' },
            { label: 'Bank',         value: 880_000,   tone: 'bg-[#00334f]' },
            { label: 'Mobile Money', value: 220_000,   tone: 'bg-[#d59a1b]' },
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
            subtitle="Collections this week"
            data={[320_000, 580_000, 440_000, 810_000, 670_000, 920_000, 1_840_000]}
            startLabel="Mon"
            endLabel="Today"
          />
        </div>
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Invoice pages ────────────────────────────────────────────────────────────

export function InvoiceListPage() {
  const { data: apiInvoices = [] as typeof invoices, isLoading, isError, refetch } = useInvoices() as { data: typeof invoices; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <FinanceWorkspaceShell title="Invoice Ledger" eyebrow="Find, filter, inspect">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices' }]} />
      <FinanceFilters items={['Status', 'Class', 'Term', 'Due date', 'Outstanding amount', 'Student or invoice search']} />
      {isLoading ? (
        <SkeletonTable cols={7} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiInvoices.length ? (
        <EmptyState title="No invoices yet" description="Generate invoices for a term to begin tracking." action={{ label: 'Generate Invoices', href: '/finance/invoices/generate' }} />
      ) : (
        <InvoiceTable rows={apiInvoices} />
      )}
    </FinanceWorkspaceShell>
  );
}

export function GenerateInvoicesPage() {
  return (
    <FinanceFormPage
      title="Generate Invoices"
      eyebrow="Bulk invoice job"
      breadcrumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Invoices', to: '/finance/invoices' }, { label: 'Generate' }]}
      fields={['Term', 'Academic year', 'Scope', 'Selected classes', 'Fee structure set', 'Due date']}
      sideTitle="Generation Preview"
      sideItems={[
        ['Student count', '225'],
        ['Estimated total', formatTZS(118_400_000)],
        ['Conflicts', '7 existing invoices'],
        ['Job status', 'Ready for confirmation'],
      ]}
    >
      <div className="mt-5 rounded border border-[#d5dde6] bg-[#f7f9fb] p-4">
        <p className="text-xs font-black uppercase tracking-widest text-[#00334f]">Progress Simulation</p>
        <div className="mt-3 h-2 rounded bg-[#e2e8f0]">
          <div className="h-full w-[45%] rounded bg-[#00334f]" />
        </div>
        <p className="mt-2 text-sm font-bold text-[#64748b]">Generating invoice 45 of 225 after confirmation.</p>
      </div>
    </FinanceFormPage>
  );
}

export function InvoiceDetailPage() {
  const invoice = useInvoice();
  const { data: allPayments = [] as typeof payments } = usePayments() as { data: typeof payments };
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
              detail: invoice.lastPayment !== 'None' ? `Last: ${invoice.lastPayment}` : 'No payments yet',
              tone: 'green',
              trend: invoice.paid > 0 ? 'up' : undefined,
              progress: invoice.total > 0 ? Math.round((invoice.paid / invoice.total) * 100) : 0,
            },
            {
              label: 'Outstanding',
              value: formatTZS(invoice.outstanding),
              detail: `Due ${invoice.dueDate}`,
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
        <ActionPanel
          title="Invoice Actions"
          items={[
            'Record payment',
            'Download invoice PDF',
            'Regenerate PDF',
            'Apply discount with reason',
            'Waive balance with reason',
            'Cancel invoice',
          ]}
        />
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Payment pages ────────────────────────────────────────────────────────────

export function RecordCashPaymentPage() {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as { data: typeof invoices };
  const { data: apiPayments = [] as typeof payments } = usePayments() as { data: typeof payments };
  return (
    <FinanceWorkspaceShell title="Record Cash Payment" eyebrow="Cash desk entry">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Record Cash' }]} />
      <PaymentForm method="cash" invoices={apiInvoices} references={apiPayments.map((p) => p.reference ?? '')} />
    </FinanceWorkspaceShell>
  );
}

export function RecordBankTransferPage() {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as { data: typeof invoices };
  const { data: apiPayments = [] as typeof payments } = usePayments() as { data: typeof payments };
  return (
    <FinanceWorkspaceShell title="Record Bank Transfer" eyebrow="Statement-safe posting">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Record Bank Transfer' }]} />
      <PaymentForm method="bank" invoices={apiInvoices} references={apiPayments.map((p) => p.reference ?? '')} />
    </FinanceWorkspaceShell>
  );
}

export function PaymentListPage() {
  const { data: apiPayments = [] as typeof payments, isLoading, isError, refetch } = usePayments() as { data: typeof payments; isLoading: boolean; isError: boolean; refetch: () => void };
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
  const { data: apiPending = [] as typeof payments } = usePendingPaymentApprovals() as { data: typeof payments };
  return (
    <FinanceWorkspaceShell title="Pending Payment Approvals" eyebrow="Read-only approval queue">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: 'Pending Approvals' }]} />
      <ReadOnlyApprovalNotice />
      <PaymentTable rows={apiPending} />
    </FinanceWorkspaceShell>
  );
}

export function PaymentDetailPage() {
  const payment = usePayment();
  return (
    <FinanceWorkspaceShell title={payment.id} eyebrow="Payment profile">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Payments', to: '/finance/payments' }, { label: payment.id }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            {
              label: 'Amount',
              value: formatTZS(payment.amount),
              detail: payment.method.replaceAll('_', ' '),
              tone: payment.status === 'REJECTED' ? 'red' : 'green',
              trend: payment.status === 'REJECTED' ? 'down' : 'up',
            },
            {
              label: 'Status',
              value: payment.status,
              detail: payment.date,
              tone: payment.status === 'APPROVED' ? 'green' : payment.status === 'REJECTED' ? 'red' : 'gold',
            },
            {
              label: 'Invoice',
              value: payment.invoiceNumber,
              detail: payment.student,
              tone: 'navy',
            },
            {
              label: 'Entered by',
              value: payment.enteredBy,
              detail: payment.reference ?? 'No reference',
              tone: 'slate',
            },
          ]} />
          <Timeline rows={[
            'Payment captured by Grace Temba',
            'Workflow routed to Principal Office',
            payment.status === 'APPROVED' ? 'Approved · Receipt issued' : 'Awaiting approval or correction',
          ]} />
        </div>
        <ActionPanel
          title="Payment Actions"
          items={[
            'Download receipt',
            'Open invoice',
            'Refund with typed confirmation',
            'View bank evidence',
            'Export audit packet',
          ]}
        />
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Receipt pages ────────────────────────────────────────────────────────────

export function ReceiptListPage() {
  const { data: apiReceipts = [] as typeof receipts, isLoading, isError, refetch } = useReceipts() as { data: typeof receipts; isLoading: boolean; isError: boolean; refetch: () => void };
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
  const receipt = useReceipt();
  return (
    <FinanceWorkspaceShell title={receipt.number} eyebrow="Receipt view">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Receipts', to: '/finance/receipts' }, { label: receipt.number }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <ReceiptPreview receipt={receipt} />
        <ActionPanel
          title="Receipt Controls"
          items={[
            'Download receipt PDF',
            'Void receipt with reason',
            'Open payment profile',
            'Open student statement',
          ]}
        />
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Fee setup pages ──────────────────────────────────────────────────────────

export function FeeCategoriesPage() {
  const { data: apiCategories = [] as typeof feeCategories, isLoading, isError, refetch } = useFeeCategories() as { data: typeof feeCategories; isLoading: boolean; isError: boolean; refetch: () => void };
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
  const { data: apiCategories = [] as typeof feeCategories } = useFeeCategories() as { data: typeof feeCategories };
  const base = apiCategories[0] ?? feeCategories[0];
  return (
    <FinanceFormPage
      title={title}
      eyebrow={mode === 'create' ? 'New billing component' : base.code}
      breadcrumbs={[
        { label: 'Finance', to: '/finance' },
        { label: 'Fee Setup' },
        { label: mode === 'create' ? 'Create Category' : 'Edit Category' },
      ]}
      fields={['Name', 'Code', 'Optional or mandatory', 'Default amount', 'Billing frequency', 'Display order']}
      sideTitle="Safety Rules"
      sideItems={[
        ['Active structures', String(base.usedByStructures)],
        ['Delete behavior', 'Blocked if used'],
        ['Audit', 'Reason captured'],
        ['Preview', 'Required before save'],
      ]}
    />
  );
}

export function FeeStructuresPage() {
  const { data: apiStructures = [] as typeof feeStructures } = useFeeStructures() as { data: typeof feeStructures };
  const { data: apiGroups = [] as typeof studentGroups } = useStudentGroups() as { data: typeof studentGroups };
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
            <Td>{structure.id}</Td>
            <Td>{structure.category}</Td>
            <Td>{structure.className}</Td>
            <Td>{structure.educationStage}</Td>
            <Td>{structure.studentGroup ?? `Level ${structure.classLevel ?? '-'}`}</Td>
            <Td amount><AmountDisplay amount={structure.amount} /></Td>
            <Td>{structure.effectiveTerm}</Td>
            <Td><FinanceStatusBadge status={structure.active ? 'ACTIVE' : 'INACTIVE'} /></Td>
            <Td>
              <Button variant="secondary" className="rounded py-1.5 text-xs">Deactivate</Button>
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
  return (
    <FinanceFormPage
      title="Create Fee Structure"
      eyebrow="Effective term rule"
      breadcrumbs={[
        { label: 'Finance', to: '/finance' },
        { label: 'Fee Setup' },
        { label: 'Create Structure' },
      ]}
      fields={['Category', 'Education stage', 'Class level or form', 'Student group or combination', 'Amount', 'Effective term', 'Applicability rule', 'Approval reason']}
      sideTitle="Impact Preview"
      sideItems={[
        ['Affected students', '184'],
        ['Expected invoice lift', formatTZS(18_400_000)],
        ['Conflict cells', '2'],
        ['Confirmation', 'Required'],
      ]}
    />
  );
}

export function FeeAssignmentsPage() {
  const { data: apiAssignments = [] as typeof feeAssignments } = useFeeAssignments() as { data: typeof feeAssignments };
  return (
    <FinanceWorkspaceShell title="Optional Fee Assignments" eyebrow="Student and bulk assignment">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Fee Setup' }, { label: 'Assignments' }]} />
      <FinanceFilters items={['Fee category', 'Class', 'Term', 'Effective date']} />
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
              <Button variant="secondary" className="rounded py-1.5 text-xs">Remove</Button>
            </Td>
          </tr>
        ))}
      </FinanceTable>
    </FinanceWorkspaceShell>
  );
}

// ─── Asset pages ──────────────────────────────────────────────────────────────

export function AssetsListPage() {
  const { data: apiAssets = [] as typeof assets, isLoading: assetsLoading, isError: assetsError, refetch: refetchAssets } = useAssets() as { data: typeof assets; isLoading: boolean; isError: boolean; refetch: () => void };
  const { data: apiAssetSummary } = useAssetSummary() as { data: Record<string, unknown> | undefined };
  const totalCost = (apiAssetSummary?.totalPurchaseCost as number | undefined) ?? 155_200_000;
  const currentValue = (apiAssetSummary?.totalCurrentValue as number | undefined) ?? 110_300_000;
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
          value: String((apiAssetSummary?.serviceDue as number | undefined) ?? 4),
          detail: 'Maintenance attention needed',
          tone: 'gold',
          trend: 'up',
        },
        {
          label: 'Disposed',
          value: String((apiAssetSummary?.disposed as number | undefined) ?? 2),
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
  return (
    <FinanceFormPage
      title={title}
      eyebrow="Asset control"
      breadcrumbs={[
        { label: 'Finance', to: '/finance' },
        { label: 'Assets', to: '/finance/assets' },
        { label: mode === 'create' ? 'Register Asset' : 'Edit Asset' },
      ]}
      fields={['Name', 'Category', 'Type', 'Brand', 'Model', 'Serial number', 'Purchase date', 'Purchase cost', 'Current value', 'Location', 'Assigned to', 'Warranty expiry']}
      sideTitle="Audit Guard"
      sideItems={[
        ['Photo placeholder', 'Ready'],
        ['Disposal', 'Separate flow'],
        ['Value changes', 'Audited'],
        ['Warranty alert', 'Enabled'],
      ]}
    />
  );
}

export function AssetDetailPage() {
  const asset = useAsset();
  return (
    <FinanceWorkspaceShell title={asset.name} eyebrow="Asset profile">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Assets', to: '/finance/assets' }, { label: asset.name }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <FinanceMetricStrip items={[
            {
              label: 'Purchase Cost',
              value: formatTZS(asset.purchaseCost),
              detail: `Purchased ${asset.purchaseDate}`,
              tone: 'navy',
            },
            {
              label: 'Current Value',
              value: formatTZS(asset.currentValue),
              detail: `Condition: ${asset.condition}`,
              tone: 'green',
              trend: 'down',
              progress: asset.purchaseCost > 0 ? Math.round((asset.currentValue / asset.purchaseCost) * 100) : 0,
            },
            {
              label: 'Location',
              value: asset.location,
              detail: `Assigned to: ${asset.assignedTo}`,
              tone: 'slate',
            },
            {
              label: 'Warranty',
              value: asset.warrantyExpiry,
              detail: asset.brand,
              tone: asset.warrantyExpiry === 'Expired' ? 'red' : 'gold',
              trend: asset.warrantyExpiry === 'Expired' ? 'down' : undefined,
            },
          ]} />
          <Timeline rows={[
            'Asset registered',
            'Location verified',
            'Depreciation review scheduled',
            'Disposal requires finance-admin confirmation',
          ]} />
        </div>
        <ActionPanel
          title="Asset Controls"
          items={[
            'Edit asset',
            'Upload photo placeholder',
            'Schedule service',
            'Dispose with reason',
            'Export asset card',
          ]}
        />
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

export function CollectionSummaryReportPage() {
  return (
    <ReportPage
      title="Collection Summary Report"
      reportBreadcrumb="Collection Summary"
      trendData={[180_000, 620_000, 400_000, 880_000, 540_000, 760_000, 920_000, 450_000, 1_100_000, 780_000, 660_000, 840_000, 590_000, 1_200_000]}
      chartValues={[
        { label: 'Tuition',  value: 58_200_000, tone: 'bg-[#00334f]' },
        { label: 'Boarding', value: 14_900_000, tone: 'bg-[#d59a1b]' },
        { label: 'Meals',    value: 9_400_000,  tone: 'bg-[#10b981]' },
        { label: 'ICT',      value: 7_121_000,  tone: 'bg-[#64748b]' },
      ]}
    />
  );
}

export function OutstandingBalancesReportPage() {
  return (
    <ReportPage
      title="Outstanding Balances Report"
      reportBreadcrumb="Outstanding Balances"
      trendData={[1_200_000, 980_000, 1_450_000, 820_000, 1_100_000, 760_000, 1_380_000, 900_000, 1_050_000, 1_200_000, 880_000, 1_100_000, 970_000, 1_400_000]}
      chartValues={[
        { label: 'Form 3', value: 11_800_000, tone: 'bg-[#e11d48]' },
        { label: 'Form 2', value: 8_600_000,  tone: 'bg-[#d59a1b]' },
        { label: 'Form 4', value: 6_200_000,  tone: 'bg-[#00334f]' },
        { label: 'Form 1', value: 5_459_000,  tone: 'bg-[#64748b]' },
      ]}
      overdue
    />
  );
}

export function DailyCollectionsReportPage() {
  return (
    <ReportPage
      title="Daily Collections Report"
      reportBreadcrumb="Daily Collections"
      trendData={[240_000, 560_000, 320_000, 720_000, 480_000, 640_000, 880_000, 410_000, 760_000, 920_000, 380_000, 690_000, 540_000, 1_040_000]}
      chartValues={[
        { label: '08:00', value: 240_000, tone: 'bg-[#10b981]' },
        { label: '10:00', value: 560_000, tone: 'bg-[#00334f]' },
        { label: '12:00', value: 320_000, tone: 'bg-[#d59a1b]' },
        { label: '14:00', value: 720_000, tone: 'bg-[#10b981]' },
      ]}
    />
  );
}

export function FeeDefaultersReportPage() {
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as { data: typeof invoices };
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as { data: typeof financeOverview };
  const overdue = overdueInvoices(apiInvoices);
  return (
    <FinanceWorkspaceShell title="Fee Defaulters Report" eyebrow="Overdue follow-up">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: 'Fee Defaulters' }]} />
      <FinanceMetricStrip items={[
        {
          label: 'Overdue Total',
          value: formatTZS(32_059_000),
          detail: `${overdue.length} outstanding invoices`,
          tone: 'red',
          trend: 'down',
          progress: apiOverview.totalInvoiced > 0 ? Math.round((32_059_000 / apiOverview.totalInvoiced) * 100) : 0,
        },
        {
          label: '30+ Days',
          value: '18',
          detail: 'Guardian contact needed',
          tone: 'gold',
          trend: 'up',
        },
        {
          label: 'Largest Balance',
          value: formatTZS(1_450_000),
          detail: 'Jabir Hassan · Form 3B',
          tone: 'red',
        },
        {
          label: 'Export Ready',
          value: 'CSV / PDF',
          detail: 'Communication placeholder',
          tone: 'navy',
        },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <InvoiceTable rows={overdue.length > 0 ? overdue : apiInvoices.filter((i) => i.status !== 'PAID')} />
        <ActionPanel
          title="Defaulter Actions"
          items={[
            'Export defaulters CSV',
            'Export defaulters PDF',
            'Generate guardian letters',
            'Flag for principal review',
            'Send bulk SMS placeholder',
          ]}
        />
      </div>
    </FinanceWorkspaceShell>
  );
}

// ─── Audit + export pages ─────────────────────────────────────────────────────

export function FinancialAuditLogPage() {
  const { data: apiAudit = [] as typeof auditEntries } = useFinanceAuditLogs() as { data: typeof auditEntries };
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
  const exportItems = [
    { label: 'Invoices CSV',                icon: FileText },
    { label: 'Payments CSV',                icon: WalletCards },
    { label: 'Receipts CSV',                icon: ReceiptText },
    { label: 'Outstanding balances CSV/PDF', icon: AlertTriangle },
    { label: 'Collection summary PDF',       icon: FileSpreadsheet },
    { label: 'Fee matrix CSV',               icon: FileSpreadsheet },
    { label: 'Assets CSV',                   icon: FileText },
    { label: 'Audit log CSV',                icon: ShieldCheck },
  ] as const;

  return (
    <FinanceWorkspaceShell title="Finance Export Center" eyebrow="Controlled extraction">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Export Center' }]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {exportItems.map(({ label, icon: Icon }) => (
          <div key={label} className="group flex flex-col rounded-lg border border-[#d5dde6] bg-white p-5 transition hover:border-[#00334f] hover:shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-[#00334f]/20 bg-[#00334f]/5">
              <Icon className="h-5 w-5 text-[#00334f]" />
            </div>
            <h3 className="mt-4 font-display text-lg font-black text-[#00334f]">{label}</h3>
            <p className="mt-2 grow text-sm font-semibold text-[#64748b]">
              Export creates an audit row with actor, filters, and timestamp.
            </p>
            <Button className="mt-4 w-full rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none">
              <Download className="h-4 w-4" /> Export
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
      <Button className="mt-4 rounded bg-[#00334f] hover:shadow-none">
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
  trendData,
  overdue = false,
}: {
  title: string;
  reportBreadcrumb: string;
  chartValues: Array<{ label: string; value: number; tone?: string }>;
  trendData: number[];
  overdue?: boolean;
}) {
  const { data: apiOverview = EMPTY_OVERVIEW } = useFinanceOverview() as { data: typeof financeOverview };
  const { data: apiPayments = [] as typeof payments } = usePayments() as { data: typeof payments };
  const collected = overdue ? 32_059_000 : 89_621_000;
  const collectedPct = apiOverview.totalInvoiced > 0 ? Math.round((collected / apiOverview.totalInvoiced) * 100) : 0;
  return (
    <FinanceWorkspaceShell title={title} eyebrow="Generated report workspace">
      <FinanceBreadcrumb crumbs={[{ label: 'Finance', to: '/finance' }, { label: 'Reports', to: '/finance/reports' }, { label: reportBreadcrumb }]} />
      <FinanceMetricStrip items={[
        {
          label: overdue ? 'Outstanding' : 'Collected',
          value: formatTZS(collected),
          detail: 'Current term',
          tone: overdue ? 'red' : 'green',
          trend: overdue ? 'down' : 'up',
          progress: collectedPct,
        },
        {
          label: 'Invoices',
          value: '1,248',
          detail: 'Report scope',
          tone: 'navy',
        },
        {
          label: 'Rows',
          value: '312',
          detail: 'Exportable records',
          tone: 'slate',
        },
        {
          label: 'Generated',
          value: 'Today',
          detail: 'Grace Temba',
          tone: 'gold',
        },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <MiniColumnChart
            title="Daily Collection Trend"
            subtitle={`Revenue performance over the last ${trendData.length} days`}
            data={trendData}
            startLabel="Day 1"
            endLabel={`Day ${trendData.length}`}
          />
          <DenseBarChart values={chartValues} />
        </div>
        <ActionPanel
          title="Report Actions"
          items={[
            'Download PDF',
            'Export CSV',
            'Save filters',
            'Send to Principal',
            'Schedule weekly',
          ]}
        />
      </div>
      <PaymentTable rows={apiPayments} />
    </FinanceWorkspaceShell>
  );
}

function FinanceFormPage({
  title,
  eyebrow,
  fields,
  sideTitle,
  sideItems,
  breadcrumbs,
  children,
}: {
  title: string;
  eyebrow: string;
  fields: string[];
  sideTitle: string;
  sideItems: Array<[string, string]>;
  breadcrumbs?: Array<{ label: string; to?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <FinanceWorkspaceShell title={title} eyebrow={eyebrow}>
      {breadcrumbs && <FinanceBreadcrumb crumbs={breadcrumbs} />}
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
          <div className="flex items-center gap-3 border-b border-[#d5dde6] pb-4">
            <FileSpreadsheet className="h-5 w-5 text-[#00334f]" />
            <div>
              <h2 className="font-display text-xl font-black text-[#00334f]">{title}</h2>
              <p className="text-sm font-semibold text-[#64748b]">
                All changes will require confirmation and audit reason.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="block">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">{field}</span>
                <input className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10" />
              </label>
            ))}
          </div>
          {children}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none">
              <Send className="h-4 w-4" /> Preview and Confirm
            </Button>
            <Button variant="secondary" className="rounded">Save Draft</Button>
          </div>
        </div>
        <SideSummary title={sideTitle} items={sideItems} />
      </div>
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
            <span
              className={`absolute -left-[29px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${
                index === rows.length - 1 ? 'bg-[#d59a1b]' : 'bg-[#00334f]'
              }`}
            />
            <p className="text-sm font-black text-[#00334f]">{row}</p>
            <p className="text-xs font-semibold text-[#64748b]">
              May {21 - index}, 2026 / FIN-TRACE-{8800 + index}
            </p>
          </div>
        ))}
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

// ─── Param hooks ──────────────────────────────────────────────────────────────

function useInvoice() {
  const { id } = useParams();
  const { data: apiInvoice } = useInvoiceById(id ?? '') as { data: (typeof invoices)[number] | undefined };
  const { data: apiInvoices = [] as typeof invoices } = useInvoices() as { data: typeof invoices };
  return apiInvoice ?? apiInvoices.find((i) => i.id === id || i.number === id) ?? invoices[0];
}

function usePayment() {
  const { id } = useParams();
  const { data: apiPayments = [] as typeof payments } = usePayments() as { data: typeof payments };
  return apiPayments.find((p) => p.id === id) ?? payments[0];
}

function useReceipt() {
  const { id } = useParams();
  const { data: apiReceipt } = useReceiptById(id ?? '') as { data: (typeof receipts)[number] | undefined };
  const { data: apiReceipts = [] as typeof receipts } = useReceipts() as { data: typeof receipts };
  return apiReceipt ?? apiReceipts.find((r) => r.id === id || r.number === id) ?? receipts[0];
}

function useAsset() {
  const { id } = useParams();
  const { data: apiAsset } = useAssetById(id ?? '') as { data: (typeof assets)[number] | undefined };
  const { data: apiAssets = [] as typeof assets } = useAssets() as { data: typeof assets };
  return apiAsset ?? apiAssets.find((a) => a.id === id) ?? assets[0];
}
