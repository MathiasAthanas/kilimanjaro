import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Lock,
  Plus,
  School,
  Search,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import type { Asset, AuditEntry, FinanceStatus, Invoice, Payment, PaymentMethod, Receipt } from '../types/finance.types';
import { duplicateReferenceWarning, formatTZS, isOverpayment, parseTZSInput } from '../utils/money';
import { useFileUploadMutation, validateFile } from '../../../lib/api/upload';
import type { UploadedFile } from '../../../lib/api/upload';
import { useAuthStore } from '../../../lib/auth/authStore';

// ─── Shell ────────────────────────────────────────────────────────────────────

export function FinanceWorkspaceShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name ?? 'Finance Officer';
  return (
    <div className="min-h-[calc(100vh-80px)] space-y-gutter bg-[#f7f9fb]">
      {/* ── Page header card ── */}
      <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white shadow-sm">
        {/* Title bar */}
        <div className="relative overflow-hidden border-b border-[#d5dde6]">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-[linear-gradient(105deg,#f7f9fb_0%,#eef5f8_40%,#dce9f0_100%)]" />
          <div className="relative grid gap-6 p-7 xl:grid-cols-[minmax(0,1fr)_auto]">
            {/* Title block */}
            <div className="flex items-start gap-4">
              <div className="mt-1 h-full w-1 self-stretch rounded-full bg-[#00334f]" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">{eyebrow}</p>
                <h1 className="mt-1 font-display text-[38px] font-black leading-tight tracking-[-0.025em] text-[#00334f]">
                  {title}
                </h1>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">
                  {userName} · Finance Office
                </p>
              </div>
            </div>
            {/* Live stats */}
            <div className="flex shrink-0 items-start gap-2 xl:pt-1">
              <HeaderStat label="Today" value={formatTZS(1_840_000)} />
              <HeaderStat label="Outstanding" value={formatTZS(32_059_000)} danger />
              <HeaderStat label="Pending" value="2 approvals" />
            </div>
          </div>
        </div>

        {/* Action strip */}
        <div className="flex items-center justify-end gap-2 bg-[#f7f9fb] px-5 py-3">
          {action ?? (
            <NavLink to="/finance/payments/cash">
              <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30] hover:shadow-none">
                <Plus className="h-3.5 w-3.5" /> Record Payment
              </Button>
            </NavLink>
          )}
        </div>
      </section>

      {children}
    </div>
  );
}

function HeaderStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-[110px] rounded border border-[#d5dde6] bg-white px-4 py-3 text-center">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black tabular-nums ${danger ? 'text-[#e11d48]' : 'text-[#00334f]'}`}>{value}</p>
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export function FinanceBreadcrumb({ crumbs }: { crumbs: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
      {crumbs.map((crumb, i) => (
        <span key={crumb.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-[#c1c7cf]" />}
          {crumb.to ? (
            <NavLink to={crumb.to} className="text-[#64748b] transition hover:text-[#00334f]">{crumb.label}</NavLink>
          ) : (
            <span className="text-[#00334f]">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Amount display ───────────────────────────────────────────────────────────

export function AmountDisplay({ amount, tone = 'neutral' }: { amount: number; tone?: 'neutral' | 'paid' | 'outstanding' | 'overdue' | 'refund' | 'void' }) {
  const color =
    tone === 'paid'        ? 'text-[#10b981]' :
    tone === 'outstanding' ? 'text-[#d97706]' :
    tone === 'overdue'     ? 'text-[#e11d48]' :
    tone === 'refund'      ? 'text-[#7c3aed]' :
    tone === 'void'        ? 'text-[#64748b] line-through' :
    'text-[#0f172a]';
  return (
    <span className={`block text-right font-mono font-black tabular-nums ${color}`}>
      {formatTZS(amount)}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

export function FinanceStatusBadge({ status }: { status: FinanceStatus | PaymentMethod }) {
  const tone =
    status === 'PAID' || status === 'APPROVED' || status === 'ACTIVE' || status === 'CASH'
      ? 'emerald'
      : status === 'PARTIAL' || status === 'PENDING' || status === 'BANK' || status === 'MOBILE_MONEY'
      ? 'amber'
      : status === 'OVERDUE' || status === 'REJECTED' || status === 'VOID' || status === 'DISPOSED'
      ? 'rose'
      : 'slate';
  return <Badge tone={tone}>{status.replaceAll('_', ' ')}</Badge>;
}

// ─── Metric strip ─────────────────────────────────────────────────────────────

export function FinanceMetricStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    detail: string;
    tone: 'navy' | 'green' | 'red' | 'gold' | 'slate';
    trend?: 'up' | 'down';
    progress?: number; // 0-100
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const rail =
          item.tone === 'green' ? 'border-l-[#10b981]' :
          item.tone === 'red'   ? 'border-l-[#e11d48]' :
          item.tone === 'gold'  ? 'border-l-[#d59a1b]' :
          item.tone === 'slate' ? 'border-l-[#64748b]' :
          'border-l-[#00334f]';
        const trendColor =
          item.tone === 'red' ? 'text-[#e11d48]' :
          item.tone === 'green' ? 'text-[#10b981]' :
          'text-[#64748b]';
        return (
          <div key={item.label} className={`rounded-lg border border-[#d5dde6] border-l-4 bg-white p-6 ${rail}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{item.label}</p>
            <p className="mt-2 font-mono text-[34px] font-black leading-none tabular-nums text-[#0f172a]">{item.value}</p>
            <div className="mt-2 flex items-center gap-1">
              {item.trend === 'up'   && <TrendingUp   className={`h-3.5 w-3.5 ${trendColor}`} />}
              {item.trend === 'down' && <TrendingDown  className={`h-3.5 w-3.5 ${trendColor}`} />}
              <p className={`text-xs font-bold ${trendColor}`}>{item.detail}</p>
            </div>
            {item.progress !== undefined && (
              <div className="mt-3 h-1.5 rounded-full bg-[#e2e8f0]">
                <div
                  className={`h-full rounded-full transition-all ${
                    item.tone === 'green' ? 'bg-[#10b981]' :
                    item.tone === 'red'   ? 'bg-[#e11d48]' :
                    item.tone === 'gold'  ? 'bg-[#d59a1b]' :
                    'bg-[#00334f]'
                  }`}
                  style={{ width: `${Math.min(100, item.progress)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Collection ring ──────────────────────────────────────────────────────────

export function CollectionRing({ rate }: { rate: number }) {
  const r = 60;
  const circumference = 2 * Math.PI * r;
  const filled = (rate / 100) * circumference;
  const grade = rate >= 90 ? 'Excellent' : rate >= 75 ? 'On Track' : rate >= 60 ? 'Lagging' : 'Critical';
  const gradeColor = rate >= 90 ? '#10b981' : rate >= 75 ? '#0284c7' : rate >= 60 ? '#d97706' : '#e11d48';
  const hint = rate >= 90 ? 'Exceeding target' : rate >= 75 ? 'Close to target' : `${100 - rate}% gap remaining`;
  const [hovered, setHovered] = useState(false);
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white p-6">
      <p className="mb-4 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Collection Rate</p>
      <div className="flex justify-center">
        <div
          className="relative h-52 w-52 cursor-default"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
            <motion.circle
              cx="70" cy="70" r={r} fill="none"
              stroke="#10b981" strokeWidth="12"
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${filled} ${circumference - filled}` }}
              transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {!hovered ? (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center"
                >
                  <motion.p
                    className="font-mono text-[42px] font-black leading-none tabular-nums text-[#00334f]"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.45, delay: 1.0, ease: 'backOut' }}
                  >
                    {rate}%
                  </motion.p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-widest" style={{ color: gradeColor }}>{grade}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#64748b]">Collected</p>
                </motion.div>
              ) : (
                <motion.div
                  key="hov"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col items-center gap-1 px-4 text-center"
                >
                  <p className="font-mono text-[34px] font-black leading-none tabular-nums text-[#00334f]">
                    {rate}<span className="text-xl text-[#64748b]">%</span>
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: gradeColor }}>{grade}</p>
                  <p className="mt-1 text-[9px] font-semibold leading-snug text-[#64748b]">{hint}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2 border-t border-[#e2e8f0] pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase tracking-wide text-[#64748b]">Target</span>
          <span className="font-mono font-black text-[#00334f]">100%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-black uppercase tracking-wide text-[#64748b]">Gap</span>
          <span className="font-mono font-black text-[#e11d48]">{100 - rate}%</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-bold text-[#64748b]">Against total invoiced · Term II</p>
    </div>
  );
}

// ─── Finance table ────────────────────────────────────────────────────────────

export function FinanceTable({ columns, children, minWidth = 1100 }: { columns: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="bg-[#eef5f8]">
            <tr>
              {columns.map((col) => (
                <th key={col} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Finance filters ──────────────────────────────────────────────────────────

export function FinanceFilters({ items, onSearch }: { items: string[]; onSearch?: (q: string) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d5dde6] bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-[#00334f]">
        <Filter className="h-3.5 w-3.5" />
        <span className="text-[10px] font-black uppercase tracking-widest">Filters</span>
      </div>
      <div className="h-4 w-px bg-[#d5dde6]" />
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => setActive(active === item ? null : item)}
            className={`rounded-full border px-3 py-1 text-[11px] font-black transition-all ${
              active === item
                ? 'border-[#00334f] bg-[#00334f] text-white'
                : 'border-[#d5dde6] bg-[#f7f9fb] text-[#334155] hover:border-[#00334f]/40 hover:bg-white hover:text-[#00334f]'
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      {active && (
        <button
          className="ml-auto text-[11px] font-black text-[#e11d48] hover:underline"
          onClick={() => setActive(null)}
        >
          Clear
        </button>
      )}
      <div className="ml-auto flex items-center gap-2 rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 py-1.5">
        <Search className="h-3.5 w-3.5 text-[#64748b]" />
        <input
          type="text"
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            onSearch?.(e.target.value);
          }}
          className="w-40 bg-transparent text-sm font-semibold text-[#334155] outline-none placeholder:text-[#94a3b8]"
        />
      </div>
    </div>
  );
}

// ─── Invoice table ────────────────────────────────────────────────────────────

export function InvoiceTable({ rows }: { rows: Invoice[] }) {
  return (
    <FinanceTable columns={['Invoice', 'Student', 'Class', 'Term', 'Total', 'Paid', 'Outstanding', 'Status', 'Due Date', '']}>
      {rows.map((invoice) => {
        const railColor =
          invoice.status === 'PAID'    ? '#10b981' :
          invoice.status === 'OVERDUE' ? '#e11d48' :
          invoice.status === 'PARTIAL' ? '#d59a1b' : '#64748b';
        return (
          <tr
            key={invoice.id}
            className="group bg-white transition even:bg-[#f7f9fb] hover:bg-[#eef5f8]"
            style={{ borderLeft: `3px solid ${railColor}` }}
          >
            <Td>
              <NavLink className="font-black text-[#00334f] hover:underline" to={`/finance/invoices/${invoice.id}`}>
                {invoice.number}
              </NavLink>
            </Td>
            <Td>
              <div className="font-black text-[#0f172a]">{invoice.student}</div>
              <div className="text-[11px] text-[#64748b]">{invoice.registration}</div>
            </Td>
            <Td>{invoice.className}</Td>
            <Td>{invoice.term}</Td>
            <Td amount><AmountDisplay amount={invoice.total} /></Td>
            <Td amount><AmountDisplay amount={invoice.paid} tone="paid" /></Td>
            <Td amount>
              <AmountDisplay amount={invoice.outstanding} tone={invoice.status === 'OVERDUE' ? 'overdue' : 'outstanding'} />
            </Td>
            <Td><FinanceStatusBadge status={invoice.status} /></Td>
            <Td>{invoice.dueDate}</Td>
            <Td>
              <NavLink
                className="text-xs font-black text-[#00334f] opacity-0 transition group-hover:opacity-100 hover:underline"
                to={`/finance/invoices/${invoice.id}`}
              >
                Inspect →
              </NavLink>
            </Td>
          </tr>
        );
      })}
    </FinanceTable>
  );
}

// ─── Payment table ────────────────────────────────────────────────────────────

export function PaymentTable({ rows }: { rows: Payment[] }) {
  return (
    <FinanceTable columns={['Payment', 'Student', 'Invoice', 'Method', 'Amount', 'Status', 'Entered by', 'Date', 'Receipt', '']}>
      {rows.map((payment) => {
        const railColor =
          payment.status === 'APPROVED' ? '#10b981' :
          payment.status === 'REJECTED' ? '#e11d48' :
          '#64748b';
        return (
          <tr
            key={payment.id}
            className="group bg-white transition even:bg-[#f7f9fb] hover:bg-[#eef5f8]"
            style={{ borderLeft: `3px solid ${railColor}` }}
          >
            <Td>
              <NavLink className="font-black text-[#00334f] hover:underline" to={`/finance/payments/${payment.id}`}>
                {payment.id}
              </NavLink>
            </Td>
            <Td>{payment.student}</Td>
            <Td>{payment.invoiceNumber}</Td>
            <Td><FinanceStatusBadge status={payment.method} /></Td>
            <Td amount>
              <AmountDisplay amount={payment.amount} tone={payment.status === 'REJECTED' ? 'void' : 'paid'} />
            </Td>
            <Td><FinanceStatusBadge status={payment.status} /></Td>
            <Td>{payment.enteredBy}</Td>
            <Td>{payment.date}</Td>
            <Td>
              {payment.receiptId ? (
                <NavLink className="font-black text-[#00334f] hover:underline" to={`/finance/receipts/${payment.receiptId}`}>
                  View
                </NavLink>
              ) : (
                <span className="text-[#64748b]">Pending</span>
              )}
            </Td>
            <Td>
              <NavLink
                className="text-xs font-black text-[#00334f] opacity-0 transition group-hover:opacity-100 hover:underline"
                to={`/finance/payments/${payment.id}`}
              >
                Detail →
              </NavLink>
            </Td>
          </tr>
        );
      })}
    </FinanceTable>
  );
}

// ─── Receipt list ─────────────────────────────────────────────────────────────

export function ReceiptList({ rows }: { rows: Receipt[] }) {
  return (
    <FinanceTable columns={['Receipt #', 'Payment', 'Student', 'Amount', 'Method', 'Issued', 'Status', '']} minWidth={920}>
      {rows.map((receipt) => {
        const railColor = receipt.status === 'VOID' ? '#64748b' : '#10b981';
        return (
          <tr
            key={receipt.id}
            className="group bg-white transition even:bg-[#f7f9fb] hover:bg-[#eef5f8]"
            style={{ borderLeft: `3px solid ${railColor}` }}
          >
            <Td>
              <NavLink className="font-black text-[#00334f] hover:underline" to={`/finance/receipts/${receipt.id}`}>
                {receipt.number}
              </NavLink>
            </Td>
            <Td>{receipt.paymentId}</Td>
            <Td>{receipt.student}</Td>
            <Td amount>
              <AmountDisplay amount={receipt.amount} tone={receipt.status === 'VOID' ? 'void' : 'paid'} />
            </Td>
            <Td><FinanceStatusBadge status={receipt.method} /></Td>
            <Td>{receipt.issuedAt}</Td>
            <Td><FinanceStatusBadge status={receipt.status} /></Td>
            <Td>
              <Button variant="secondary" className="rounded py-1.5 text-xs opacity-0 transition group-hover:opacity-100">
                <Download className="h-3 w-3" /> PDF
              </Button>
            </Td>
          </tr>
        );
      })}
    </FinanceTable>
  );
}

// ─── Payment form ─────────────────────────────────────────────────────────────

export function PaymentForm({ method, invoices, references }: { method: 'cash' | 'bank'; invoices: Invoice[]; references: string[] }) {
  const sessionUser = useAuthStore((state) => state.session?.user?.name ?? 'Finance Officer');
  const selectedInvoice = invoices.find((i) => i.outstanding > 0) ?? invoices[0];
  const [amountText, setAmountText] = useState('400000');
  const [reference, setReference] = useState(method === 'bank' ? 'CRDB-8841' : '');
  const [confirmed, setConfirmed] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<UploadedFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useFileUploadMutation();
  const amount = parseTZSInput(amountText);
  const overpay = isOverpayment(amount, selectedInvoice.outstanding);
  const missingReference = method === 'bank' && !reference.trim();
  const duplicateReference = method === 'bank' && duplicateReferenceWarning(reference, references);
  const blocked = amount <= 0 || missingReference || (overpay && !confirmed);

  const handleEvidenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError(null);
    uploadMutation.mutate(file, {
      onSuccess: (result) => setEvidenceFile(result.file),
      onError: (err) => setUploadError(err instanceof Error ? err.message : 'Upload failed'),
    });
  };

  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* ── Form ── */}
      <div className="rounded-lg border border-[#d5dde6] bg-white">
        <div className="flex items-center gap-3 border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-4">
          <WalletCards className="h-5 w-5 text-[#00334f]" />
          <div>
            <h2 className="font-display text-xl font-black text-[#00334f]">
              Record {method === 'bank' ? 'Bank Transfer' : 'Cash Payment'}
            </h2>
            <p className="text-sm font-semibold text-[#64748b]">
              Validation-first entry · Approval trail attached
            </p>
          </div>
        </div>
        <div className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Invoice Search" value={`${selectedInvoice.number} – ${selectedInvoice.student}`} />
            <Field label="Payer / Guardian" value={selectedInvoice.guardian} />
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Amount (TZS)</span>
              <div className="relative mt-2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[#94a3b8]">TZS</span>
                <input
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  className="h-11 w-full rounded border border-[#d5dde6] pl-12 pr-3 font-mono font-black outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
                />
              </div>
            </label>
            <Field label="Payment Date" value="May 21, 2026" />
            {method === 'bank' ? (
              <>
                <Field label="Bank Name" value="CRDB Bank" />
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Reference Number</span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="mt-2 h-11 w-full rounded border border-[#d5dde6] px-3 font-mono font-black outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
                    placeholder="e.g. CRDB-XXXXXXX"
                  />
                </label>
                {/* ── Bank slip / evidence upload ── */}
                <div className="md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Bank Slip / Evidence</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleEvidenceChange}
                  />
                  {evidenceFile ? (
                    <div className="mt-2 flex items-center gap-3 rounded border border-[#10b981]/30 bg-[#10b981]/5 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10b981]" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[#00334f]">{evidenceFile.originalName}</p>
                        <p className="text-[10px] font-semibold text-[#64748b]">{(evidenceFile.sizeBytes / 1024).toFixed(0)} KB · uploaded</p>
                      </div>
                      <button type="button" onClick={() => setEvidenceFile(null)} className="ml-auto shrink-0 text-[10px] font-black text-[#e11d48] hover:underline">Remove</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded border-2 border-dashed border-[#d5dde6] bg-[#f7f9fb] py-3 text-xs font-black text-[#64748b] transition hover:border-[#00334f] hover:text-[#00334f] disabled:opacity-50"
                    >
                      <TrendingUp className="h-4 w-4" />
                      {uploadMutation.isPending ? 'Uploading…' : 'Upload bank slip or receipt (JPEG, PNG, PDF)'}
                    </button>
                  )}
                  {uploadError && <p className="mt-1 text-[11px] font-black text-[#e11d48]">{uploadError}</p>}
                </div>
              </>
            ) : (
              <>
                <Field label="Received By" value={sessionUser} />
                <Field label="Cash Drawer" value="FD-02 / Morning Session" />
              </>
            )}
          </div>
          <textarea
            className="mt-4 h-24 w-full rounded border border-[#d5dde6] p-3 text-sm font-semibold text-[#334155] outline-none focus:border-[#00334f]"
            defaultValue="Payment captured from finance desk. Receipt awaits approval if workflow requires."
          />
          <div className="mt-4 space-y-2">
            {overpay && <Warning text={`Amount exceeds outstanding balance by ${formatTZS(amount - selectedInvoice.outstanding)}. Confirmation required.`} />}
            {missingReference && <Warning text="Bank reference number is required before submission." />}
            {duplicateReference && <Warning text="Duplicate bank reference detected. Verify statement before submitting." />}
          </div>
          {overpay && (
            <label className="mt-4 flex items-center gap-2 text-sm font-bold text-[#00334f]">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4 accent-[#00334f]" />
              I confirm this overpayment should be accepted for review.
            </label>
          )}
          <Button disabled={blocked} className="mt-5 rounded bg-[#00334f] hover:bg-[#001e30] hover:shadow-none disabled:opacity-50">
            <CheckCircle2 className="h-4 w-4" /> Submit for Posting
          </Button>
        </div>
      </div>

      {/* ── Invoice summary ── */}
      <InvoiceSummary invoice={selectedInvoice} amount={amount} />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</span>
      <input
        className="mt-2 h-11 w-full rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold text-[#334155] outline-none focus:border-[#00334f] focus:bg-white focus:ring-2 focus:ring-[#00334f]/10"
        defaultValue={value}
      />
    </label>
  );
}

function Warning({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded border border-[#e11d48]/30 bg-[#e11d48]/5 px-3 py-2 text-xs font-black text-[#e11d48]">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {text}
    </div>
  );
}

function InvoiceSummary({ invoice, amount }: { invoice: Invoice; amount: number }) {
  return (
    <div className="sticky top-24 h-fit rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Selected Invoice</p>
        <h3 className="mt-1 font-display text-2xl font-black text-[#00334f]">{invoice.number}</h3>
        <p className="text-sm font-bold text-[#64748b]">{invoice.student} · {invoice.className}</p>
      </div>
      <div className="p-5">
        <div className="space-y-3">
          <SummaryLine label="Invoice total"  value={formatTZS(invoice.total)}       />
          <SummaryLine label="Already paid"   value={formatTZS(invoice.paid)}        good />
          <SummaryLine label="Outstanding"    value={formatTZS(invoice.outstanding)} danger />
          <div className="border-t border-[#e2e8f0] pt-3">
            <SummaryLine label="This payment" value={formatTZS(amount)} />
          </div>
        </div>
        <div className="mt-5 rounded border-l-4 border-[#00334f] bg-[#f7f9fb] p-3 text-xs font-bold text-[#64748b]">
          Finance officers can enter payments but cannot approve their own entries. Approval is delegated to Principal or Managing Director.
        </div>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, good = false, danger = false }: { label: string; value: string; good?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-bold text-[#64748b]">{label}</span>
      <span className={`font-mono font-black tabular-nums ${good ? 'text-[#10b981]' : danger ? 'text-[#e11d48]' : 'text-[#0f172a]'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Fee matrix grid ──────────────────────────────────────────────────────────

export function FeeMatrixGrid({ categories, classes }: { categories: string[]; classes: string[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          {/* Header row */}
          <div
            className="grid bg-[#eef5f8] text-[10px] font-black uppercase tracking-widest text-[#00334f]"
            style={{ gridTemplateColumns: `220px repeat(${classes.length}, 1fr)` }}
          >
            <div className="sticky left-0 z-10 border-r border-b border-[#d5dde6] bg-[#eef5f8] px-4 py-3">
              Fee Category
            </div>
            {classes.map((cl) => (
              <div key={cl} className="border-r border-b border-[#d5dde6] px-4 py-3 text-right">{cl}</div>
            ))}
          </div>
          {/* Data rows */}
          {categories.map((category, ri) => (
            <div
              key={category}
              className="grid border-t border-[#d5dde6] bg-white even:bg-[#f7f9fb]"
              style={{ gridTemplateColumns: `220px repeat(${classes.length}, 1fr)` }}
            >
              <div className="sticky left-0 z-10 border-r border-[#d5dde6] bg-inherit px-4 py-3 font-black text-[#00334f]">
                {category}
              </div>
              {classes.map((cl, ci) => {
                const amount = 120_000 + ri * 95_000 + ci * 18_000;
                return (
                  <button
                    key={cl}
                    className="border-r border-[#d5dde6] px-4 py-3 text-right font-mono font-black text-[#0f172a] tabular-nums transition hover:bg-[#dbe8ee] hover:text-[#00334f]"
                  >
                    {ri === 3 && ci === 1 ? (
                      <span className="text-[#d59a1b]">+ Add</span>
                    ) : (
                      formatTZS(amount)
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Receipt preview ──────────────────────────────────────────────────────────

export function ReceiptPreview({ receipt }: { receipt: Receipt }) {
  const isPaid = receipt.status !== 'VOID';
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white shadow-sm">
      {/* School letterhead */}
      <div className="flex items-center justify-between border-b border-[#d5dde6] bg-[#f7f9fb] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-[#00334f]/20 bg-[#00334f]/5">
            <School className="h-5 w-5 text-[#00334f]" />
          </div>
          <div>
            <p className="font-display text-sm font-black text-[#00334f]">Kilimanjaro Schools</p>
            <p className="text-[11px] text-[#64748b]">P.O. Box 4502 · Arusha, Tanzania</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Official Receipt</p>
          <p className="font-display text-lg font-black text-[#00334f]">{receipt.number}</p>
        </div>
      </div>

      {/* Main body */}
      <div className="relative p-6">
        {/* Status watermark */}
        <div className="pointer-events-none absolute right-8 top-8 select-none">
          <div className={`rotate-12 border-2 px-5 py-1.5 text-sm font-black uppercase tracking-widest opacity-20 ${
            isPaid ? 'border-[#10b981] text-[#10b981]' : 'border-[#64748b] text-[#64748b]'
          }`}>
            {receipt.status}
          </div>
        </div>

        {/* Payer + student grid */}
        <div className="grid gap-px bg-[#e2e8f0] sm:grid-cols-2">
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Student</p>
            <p className="mt-1.5 font-display text-lg font-black text-[#0f172a]">{receipt.student}</p>
            <p className="text-sm font-semibold text-[#64748b]">Payment ID: {receipt.paymentId}</p>
          </div>
          <div className="bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Transaction</p>
            <p className="mt-1.5 text-sm font-bold text-[#334155]">Method: {receipt.method.replaceAll('_', ' ')}</p>
            <p className="text-sm font-bold text-[#334155]">Issued: {receipt.issuedAt}</p>
          </div>
        </div>

        {/* Amount block with perforated edge */}
        <div className="mt-px border-t-2 border-dashed border-[#d5dde6] bg-[#f7f9fb] p-5">
          <div className="flex items-end justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Amount Received</p>
            <AmountDisplay amount={receipt.amount} tone={receipt.status === 'VOID' ? 'void' : 'paid'} />
          </div>
          <div className="mt-3 h-px bg-[#e2e8f0]" />
          <p className="mt-3 text-center text-[11px] font-black uppercase tracking-widest text-[#64748b]">
            This receipt is computer-generated and is valid without a signature.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

export function AssetCard({ asset }: { asset: Asset }) {
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white transition hover:border-[#00334f]/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-[#d5dde6] px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">
            {asset.category} · {asset.type}
          </p>
          <h3 className="mt-1 font-display text-xl font-black text-[#00334f]">{asset.name}</h3>
          <p className="text-xs font-bold text-[#64748b]">{asset.serial}</p>
        </div>
        <FinanceStatusBadge status={asset.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        <MiniStat label="Purchase Cost" value={formatTZS(asset.purchaseCost)} mono />
        <MiniStat label="Book Value" value={formatTZS(asset.currentValue)} mono />
        <MiniStat label="Location" value={asset.location} />
        <MiniStat label="Condition" value={asset.condition} />
      </div>
      <div className="border-t border-[#d5dde6] px-5 py-3">
        <NavLink to={`/finance/assets/${asset.id}`} className="flex items-center gap-1 text-xs font-black text-[#00334f] hover:underline">
          Open asset profile <ArrowRight className="h-3.5 w-3.5" />
        </NavLink>
      </div>
    </div>
  );
}

function MiniStat({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className={`mt-1 text-sm font-black text-[#0f172a] ${mono ? 'font-mono tabular-nums' : ''}`}>{value}</p>
    </div>
  );
}

// ─── Audit components ─────────────────────────────────────────────────────────

export function AuditImmutableBanner() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#00334f] bg-[#00334f] px-5 py-4 text-white">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-white/20 bg-white/10">
        <Lock className="h-5 w-5 text-[#d59a1b]" />
      </div>
      <div>
        <p className="font-display text-lg font-black">Immutable Financial Audit Trail</p>
        <p className="text-sm font-semibold text-white/70">
          Rows cannot be edited or deleted. Every mutation must carry actor, reason, and correlation ID.
        </p>
      </div>
      <div className="ml-auto rounded border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/80">
        Read-only
      </div>
    </div>
  );
}

export function AuditLogRow({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`overflow-hidden rounded-lg border border-[#d5dde6] bg-white transition ${open ? 'shadow-sm' : ''}`}>
      <button
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-[#f7f9fb]"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#00334f]" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">
              {entry.date} · {entry.correlationId}
            </p>
            <h3 className="mt-1 font-display text-lg font-black text-[#00334f]">{entry.action}</h3>
            <p className="text-sm font-semibold text-[#64748b]">
              {entry.actor} · {entry.entity}
            </p>
          </div>
        </div>
        <Badge tone="slate">{open ? '▲ Collapse' : '▼ Expand'}</Badge>
      </button>
      {open && (
        <div className="grid gap-3 border-t border-[#d5dde6] p-5 md:grid-cols-2">
          <JsonBlock title="Before" value={entry.before} />
          <JsonBlock title="After"  value={entry.after}  />
        </div>
      )}
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: Record<string, string | number | boolean> }) {
  return (
    <div className="overflow-hidden rounded border border-[#d5dde6] bg-[#0f172a]">
      <div className="border-b border-white/10 px-4 py-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#d59a1b]">{title}</p>
      </div>
      <pre className="overflow-x-auto p-4 text-xs font-semibold leading-relaxed text-white/80">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

// ─── Table cell ───────────────────────────────────────────────────────────────

export function Td({ children, amount = false }: { children: ReactNode; amount?: boolean }) {
  return (
    <td className={`px-4 py-3 text-sm font-semibold text-[#334155] ${amount ? 'text-right' : ''}`}>
      {children}
    </td>
  );
}

// ─── Action panel ─────────────────────────────────────────────────────────────

export function ActionPanel({ title, items, onAction }: { title: string; items: string[]; onAction?: (item: string) => void }) {
  const handleClick = (item: string) => {
    if (onAction) { onAction(item); return; }
    // Default: show a lightweight toast via DOM so ActionPanel has no extra deps
    const host = document.getElementById('toast-host');
    if (!host) return;
    const el = document.createElement('div');
    el.style.cssText = 'background:#1E293B;color:white;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:700;border-left:4px solid #0284C7;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;gap:10px;max-width:340px;opacity:0;transform:translateX(20px);transition:opacity .2s,transform .2s;margin-top:8px;pointer-events:auto;';
    el.textContent = item;
    host.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; }));
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.parentNode?.removeChild(el), 220); }, 3000);
  };

  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3">
        <h2 className="font-display text-base font-black text-[#00334f]">{title}</h2>
      </div>
      <div className="p-3">
        <div className="space-y-1.5">
          {items.map((item) => (
            <button
              key={item}
              onClick={() => handleClick(item)}
              className="flex w-full items-center justify-between rounded border border-transparent bg-transparent px-4 py-3 text-left text-sm font-bold text-[#334155] transition hover:border-[#d5dde6] hover:bg-[#f7f9fb] hover:text-[#00334f]"
            >
              {item}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#c1c7cf]" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Report card ──────────────────────────────────────────────────────────────

export function ReportCard({ title, description, to }: { title: string; description: string; to: string }) {
  return (
    <NavLink
      to={to}
      className="group flex flex-col rounded-lg border border-[#d5dde6] bg-white p-5 transition hover:border-[#00334f] hover:shadow-sm"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded border border-[#00334f]/20 bg-[#00334f]/5">
        <FileText className="h-5 w-5 text-[#00334f]" />
      </div>
      <h3 className="mt-4 font-display text-xl font-black text-[#00334f]">{title}</h3>
      <p className="mt-2 grow text-sm font-semibold text-[#64748b]">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#d59a1b] transition group-hover:gap-2">
        Generate <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </NavLink>
  );
}

// ─── Dense bar chart ──────────────────────────────────────────────────────────

export function DenseBarChart({ values }: { values: Array<{ label: string; value: number; tone?: string }> }) {
  const max = Math.max(...values.map((v) => v.value));
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3">
        <h2 className="font-display text-base font-black text-[#00334f]">Collection by Method</h2>
        <p className="text-xs font-semibold text-[#64748b]">Today's transactions</p>
      </div>
      <div className="space-y-4 p-5">
        {values.map((item, i) => {
          const pct  = (item.value / max) * 100;
          const isHov = hov === i;
          return (
            <div
              key={item.label}
              className="cursor-pointer"
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            >
              <div className="mb-2 flex items-center justify-between text-xs font-black">
                <span className={`uppercase tracking-wider transition-colors ${isHov ? 'text-[#00334f]' : 'text-[#64748b]'}`}>{item.label}</span>
                <span className="font-mono tabular-nums text-[#00334f]">{formatTZS(item.value)}</span>
              </div>
              <div className="relative h-5 overflow-hidden rounded bg-[#e2e8f0]">
                <motion.div
                  className={`h-full rounded ${item.tone ?? 'bg-[#00334f]'}`}
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%`, opacity: isHov ? 1 : 0.8 }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.1 }}
                />
                <AnimatePresence>
                  {isHov && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pointer-events-none absolute inset-0 flex items-center px-2 text-[10px] font-black text-white drop-shadow"
                    >
                      {Math.round(pct)}% of top · {formatTZS(item.value)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Mini column chart (daily trend) ─────────────────────────────────────────

export function MiniColumnChart({
  title,
  subtitle,
  data,
  startLabel,
  endLabel,
}: {
  title: string;
  subtitle: string;
  data: number[];
  startLabel?: string;
  endLabel?: string;
}) {
  const max = Math.max(...data);
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="font-display text-base font-black text-[#00334f]">{title}</h3>
          <p className="text-xs font-semibold text-[#64748b]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#00334f]" />
          <span className="text-[10px] font-black uppercase tracking-wider text-[#64748b]">Payments</span>
        </div>
      </div>
      <div className="flex h-36 items-end gap-1">
        {data.map((v, i) => {
          const pctH  = Math.max(4, (v / max) * 100);
          const isHov = hov === i;
          return (
            <div
              key={i}
              className="relative flex flex-1 flex-col justify-end"
              style={{ height: '100%' }}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            >
              <AnimatePresence>
                {isHov && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#00334f] px-2.5 py-1.5 text-center shadow-lg"
                  >
                    <p className="font-mono text-xs font-black tabular-nums text-white">{formatTZS(v)}</p>
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#00334f]" />
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.div
                className={`w-full rounded-t transition-colors ${isHov ? 'bg-[#00334f]/65' : 'bg-[#00334f]/20'}`}
                initial={{ height: '0%' }}
                animate={{ height: `${pctH}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.04 }}
              />
            </div>
          );
        })}
      </div>
      {(startLabel || endLabel) && (
        <div className="mt-2 flex justify-between text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      )}
    </div>
  );
}

// ─── Read-only approval notice ────────────────────────────────────────────────

export function ReadOnlyApprovalNotice() {
  return (
    <div className="rounded-lg border border-[#d59a1b]/40 bg-[#d59a1b]/5 px-4 py-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-[#7a5200]" />
        <p className="font-display text-sm font-black text-[#7a5200]">
          Approval is done by Principal or Managing Director
        </p>
      </div>
      <p className="mt-1 text-sm font-semibold text-[#7a5200]/80">
        Finance can inspect payment evidence, but approval controls are intentionally read-only here.
      </p>
    </div>
  );
}
