import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Filter,
  Lock,
  PackagePlus,
  Plus,
  Printer,
  QrCode,
  School,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  UserCircle,
  Hash,
  Calendar,
  Tag,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import type { Asset, AuditEntry, FinanceStatus, Invoice, Payment, PaymentMethod, Receipt } from '../types/finance.types';
import { duplicateReferenceWarning, formatDate, formatTZS, isOverpayment, parseTZSInput } from '../utils/money';
import { useFinanceOverview, usePendingPaymentApprovals } from '../api/finance.hooks';
import { useFileUploadMutation, validateFile } from '../../../lib/api/upload';
import { api } from '../../../lib/api/client';
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
  const { data: overview } = useFinanceOverview() as unknown as { data?: { today: number; outstanding: number } };
  const { data: pendingApprovals } = usePendingPaymentApprovals() as unknown as { data?: unknown[] };
  const pendingCount = Array.isArray(pendingApprovals) ? pendingApprovals.length : 0;
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
              <HeaderStat label="Today" value={formatTZS(overview?.today ?? 0)} />
              <HeaderStat label="Outstanding" value={formatTZS(overview?.outstanding ?? 0)} danger />
              <HeaderStat label="Pending" value={`${pendingCount} approval${pendingCount === 1 ? '' : 's'}`} />
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
            <Td>{formatDate(invoice.dueDate)}</Td>
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
                {payment.number || payment.id}
              </NavLink>
            </Td>
            <Td>{payment.student}</Td>
            <Td>
              {payment.invoiceId ? (
                <NavLink className="font-semibold text-[#00334f] hover:underline" to={`/finance/invoices/${payment.invoiceId}`}>
                  {payment.invoiceNumber}
                </NavLink>
              ) : (
                payment.invoiceNumber
              )}
            </Td>
            <Td><FinanceStatusBadge status={payment.method} /></Td>
            <Td amount>
              <AmountDisplay amount={payment.amount} tone={payment.status === 'REJECTED' ? 'void' : 'paid'} />
            </Td>
            <Td><FinanceStatusBadge status={payment.status} /></Td>
            <Td>{payment.enteredBy}</Td>
            <Td>{formatDate(payment.date)}</Td>
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

// ─── PDF shared helpers ───────────────────────────────────────────────────────

let _logoCache: string | null = null;
export async function getLogoBase64(): Promise<string | null> {
  if (_logoCache !== null) return _logoCache;
  try {
    const res = await fetch('/kilimanjaro_logo.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => { _logoCache = reader.result as string; resolve(_logoCache); };
      reader.onerror  = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Invoice PDF generator ────────────────────────────────────────────────────

interface InvoicePdfData {
  number: string;
  student: string;
  registration?: string;
  guardian?: string;
  className?: string;
  term?: string;
  dueDate?: string;
  status: string;
  total: number;
  paid: number;
  outstanding: number;
  lineItems?: Array<{ category?: string; feeCategoryName?: string; amount: number; mandatory?: boolean }>;
}

async function generateInvoicePdf(data: InvoicePdfData): Promise<void> {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210;
  const M  = 14;
  const CW = PW - M * 2;

  const NAVY  : [number,number,number] = [0, 51, 79];
  const GOLD  : [number,number,number] = [213,154, 27];
  const LIGHT : [number,number,number] = [248,250,252];
  const SLATE : [number,number,number] = [100,116,139];
  const DARK  : [number,number,number] = [15,  23, 42];
  const WHITE : [number,number,number] = [255,255,255];
  const GREEN : [number,number,number] = [16, 185,129];
  const RED   : [number,number,number] = [220, 38, 38];

  const statusColors: Record<string, [number,number,number]> = {
    PAID: GREEN, PARTIAL: GOLD, OVERDUE: RED, VOID: SLATE, CANCELLED: SLATE,
  };
  const statusColor = statusColors[data.status] ?? NAVY;

  // ── HEADER ─────────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 46, 'F');

  // School logo or fallback KS badge
  if (logo) {
    doc.addImage(logo, 'PNG', M, 7, 28, 28, undefined, 'FAST');
  } else {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.circle(M + 9, 23, 9, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text('KS', M + 9, 21.5, { align: 'center' });
    doc.setFontSize(5);
    doc.setTextColor(...WHITE);
    doc.text('SCHOOLS', M + 9, 27, { align: 'center' });
  }

  const textX = M + 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text('Kilimanjaro Schools', textX, 17);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text('Excellence in Education Since 2003', textX, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 220, 230);
  doc.text('P.O. Box 4502, Moshi, Kilimanjaro, Tanzania  ·  Tel: +255 754 000 000', textX, 27);
  doc.text('finance@kilimanjaroschools.ac.tz', textX, 31);

  // Invoice label + number
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 200, 220);
  doc.text('FEE INVOICE', PW - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(data.number, PW - M, 23, { align: 'right' });

  // Status badge
  doc.setFillColor(...statusColor);
  doc.roundedRect(PW - M - 34, 27, 34, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text(data.status, PW - M - 17, 32.3, { align: 'center' });

  // ── GOLD STRIPE ────────────────────────────────────────────────────────────
  doc.setFillColor(...GOLD);
  doc.rect(0, 46, PW, 2, 'F');

  // ── 2-COLUMN INFO ──────────────────────────────────────────────────────────
  let y = 56;

  // Left: billed to
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(M, y, M, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text('BILLED TO', M + 3, y + 1.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(data.student, M + 3, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  if (data.registration) doc.text(`Reg: ${data.registration}`, M + 3, y + 14);
  if (data.className) doc.text(`Class: ${data.className}`, M + 3, y + 19);
  if (data.guardian) doc.text(`Guardian: ${data.guardian}`, M + 3, y + 24);

  // Right: invoice details
  const rx = M + CW / 2;
  doc.setDrawColor(...GOLD);
  doc.line(rx, y, rx, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text('INVOICE DETAILS', rx + 3, y + 1.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  if (data.term) doc.text(`Term: ${data.term}`, rx + 3, y + 8);
  if (data.dueDate) doc.text(`Due Date: ${formatDate(data.dueDate)}`, rx + 3, y + 14);
  doc.text(`Issued: ${formatDate(new Date().toISOString())}`, rx + 3, y + 19);

  y += 36;

  // ── DASHED SEPARATOR ───────────────────────────────────────────────────────
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(M, y, PW - M, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  // ── FEE BREAKDOWN TABLE ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('FEE SCHEDULE', M, y);
  y += 4;

  const items = (data.lineItems ?? []).map((it) => ({
    name: it.feeCategoryName ?? it.category ?? 'School Fees',
    amount: Number(it.amount),
    mandatory: it.mandatory ?? true,
  }));
  if (items.length === 0) items.push({ name: 'School Fees', amount: data.total, mandatory: true });

  const rowH   = 8;
  const COL_BADGE = 22;
  const COL_AMT   = 46;
  const tableRight = PW - M;

  // Header
  doc.setFillColor(...NAVY);
  doc.rect(M, y, CW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text('DESCRIPTION', M + 3, y + 5.2);
  doc.text('TYPE', tableRight - COL_AMT - COL_BADGE + 3, y + 5.2);
  doc.text('AMOUNT (TZS)', tableRight - 3, y + 5.2, { align: 'right' });
  y += rowH;

  items.forEach((item, i) => {
    doc.setFillColor(...(i % 2 === 0 ? WHITE : LIGHT));
    doc.rect(M, y, CW, rowH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(item.name, M + 3, y + 5.2);
    const bx = tableRight - COL_AMT - COL_BADGE + 2;
    doc.setFillColor(...(item.mandatory ? [0,51,79] : [213,154,27]) as [number,number,number]);
    doc.roundedRect(bx, y + 1.5, COL_BADGE - 4, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...WHITE);
    doc.text(item.mandatory ? 'MANDATORY' : 'OPTIONAL', bx + (COL_BADGE - 4) / 2, y + 5, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(formatTZS(item.amount), tableRight - 3, y + 5.2, { align: 'right' });
    y += rowH;
  });

  // Summary rows
  const summaryRows: Array<{ label: string; value: string; bg: [number,number,number]; textColor: [number,number,number] }> = [
    { label: 'INVOICE TOTAL',   value: formatTZS(data.total),       bg: [30, 41, 59],  textColor: WHITE },
    { label: 'AMOUNT PAID',     value: formatTZS(data.paid),        bg: [5, 46, 22],   textColor: GREEN },
    { label: 'OUTSTANDING BALANCE', value: formatTZS(data.outstanding), bg: data.outstanding <= 0 ? [5,46,22] : NAVY, textColor: data.outstanding <= 0 ? GREEN : GOLD },
  ];

  summaryRows.forEach(({ label, value, bg, textColor }) => {
    doc.setFillColor(...bg);
    doc.rect(M, y, CW, rowH + 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text(label, M + 3, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text(value, tableRight - 3, y + 6, { align: 'right' });
    y += rowH + 1;
  });
  y += 6;

  // ── AMOUNT IN WORDS ────────────────────────────────────────────────────────
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 10, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('TOTAL IN WORDS:', M + 3, y + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const words = amountInWords(data.total);
  doc.text(words, M + 36, y + 4.5);
  y += 14;

  // ── PAYMENT INSTRUCTIONS ───────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, CW, 22, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text('PAYMENT INSTRUCTIONS', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('Please quote your invoice number when making payment.', M + 4, y + 11.5);
  doc.text('Cash: Finance Office · CRDB Bank transfer · Mobile Money (M-Pesa / Airtel)', M + 4, y + 16);
  doc.text(`For enquiries: finance@kilimanjaroschools.ac.tz  ·  +255 754 000 000`, M + 4, y + 20.5);
  y += 28;

  // ── SIGNATURES ─────────────────────────────────────────────────────────────
  const sigW = (CW - 10) / 2;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.5);
  doc.line(M, y + 16, M + sigW, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('FINANCE OFFICER', M + sigW / 2, y + 19.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Authorized Signatory', M + sigW / 2, y + 23, { align: 'center' });

  const s2x = M + sigW + 10;
  doc.line(s2x, y + 16, s2x + sigW, y + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('PRINCIPAL / DIRECTOR', s2x + sigW / 2, y + 19.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('School Stamp', s2x + sigW / 2, y + 23, { align: 'center' });
  y += 30;

  // VOID / CANCELLED watermark
  if (['VOID', 'CANCELLED'].includes(data.status)) {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(80);
    doc.setTextColor(220, 38, 38);
    doc.text(data.status, PW / 2, 148, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, 16, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('This is an official computer-generated invoice of Kilimanjaro Schools.', PW / 2, y + 6, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text(`Verify at: kilimanjaroschools.ac.tz/verify/${data.number}`, PW / 2, y + 11.5, { align: 'center' });

  doc.save(`${data.number}.pdf`);
}

export async function downloadInvoicePdf(invoice: {
  id: string; number: string; student: string; registration?: string; guardian?: string;
  className?: string; term?: string; dueDate?: string; status: string;
  total: number; paid: number; outstanding: number;
  lineItems?: Array<{ category?: string; amount: number; mandatory?: boolean }>;
}, toastFn?: (msg: string, tone?: string) => void): Promise<void> {
  try {
    await generateInvoicePdf({
      number:      invoice.number,
      student:     invoice.student,
      registration: invoice.registration,
      guardian:    invoice.guardian,
      className:   invoice.className,
      term:        invoice.term,
      dueDate:     invoice.dueDate,
      status:      invoice.status,
      total:       invoice.total,
      paid:        invoice.paid,
      outstanding: invoice.outstanding,
      lineItems:   invoice.lineItems,
    });
    toastFn?.('Invoice PDF downloaded', 'success');
  } catch (e: any) {
    console.error('Invoice PDF error:', e);
    toastFn?.(e?.message ?? 'Failed to generate invoice PDF', 'error');
  }
}

// ─── Receipt list ─────────────────────────────────────────────────────────────

// ─── Receipt PDF generator ────────────────────────────────────────────────────

interface ReceiptPdfData {
  number: string;
  studentName: string;
  registrationNumber?: string;
  className?: string;
  amount: number;
  method: string;
  issuedAt: string;
  paidAt?: string;
  referenceNumber?: string | null;
  bankName?: string;
  status: string;
  invoiceNumber?: string;
  termName?: string;
  dueDate?: string;
  lineItems?: Array<{ feeCategoryName?: string; category?: string; amount: number; mandatory?: boolean }>;
  outstandingBalance?: number;
  issuedByName?: string;
}

async function generateReceiptPdf(data: ReceiptPdfData): Promise<void> {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PW = 210;
  const M  = 14;
  const CW = PW - M * 2;

  // ── colour palette ─────────────────────────────────────────────────────────
  const NAVY  : [number,number,number] = [0,  51,  79];
  const GOLD  : [number,number,number] = [213,154, 27];
  const LIGHT : [number,number,number] = [248,250,252];
  const SLATE : [number,number,number] = [100,116,139];
  const DARK  : [number,number,number] = [15,  23, 42];
  const WHITE : [number,number,number] = [255,255,255];
  const GREEN : [number,number,number] = [16, 185,129];
  const VOID_C: [number,number,number] = [100,116,139];

  const isPaid = data.status !== 'VOID';
  const statusColor: [number,number,number] = isPaid ? GREEN : VOID_C;

  // ── HEADER BAND ────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PW, 46, 'F');

  // School logo or fallback KS badge
  if (logo) {
    doc.addImage(logo, 'PNG', M, 7, 28, 28, undefined, 'FAST');
  } else {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.8);
    doc.circle(M + 9, 23, 9, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...GOLD);
    doc.text('KS', M + 9, 21.5, { align: 'center' });
    doc.setFontSize(5);
    doc.setTextColor(...WHITE);
    doc.text('SCHOOLS', M + 9, 27, { align: 'center' });
  }

  // School name + details
  const textX = M + 32;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...WHITE);
  doc.text('Kilimanjaro Schools', textX, 17);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text('Excellence in Education Since 2003', textX, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 220, 230);
  doc.text('P.O. Box 4502, Moshi, Kilimanjaro, Tanzania  ·  Tel: +255 754 000 000', textX, 27);
  doc.text('finance@kilimanjaroschools.ac.tz', textX, 31);

  // Receipt label + number (top-right)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 200, 220);
  doc.text('OFFICIAL RECEIPT', PW - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...WHITE);
  doc.text(data.number, PW - M, 23, { align: 'right' });

  // Status badge
  doc.setFillColor(...statusColor);
  doc.roundedRect(PW - M - 34, 27, 34, 8, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text(isPaid ? '✓  ACTIVE' : '✗  VOID', PW - M - 17, 32.3, { align: 'center' });

  // ── GOLD STRIPE ────────────────────────────────────────────────────────────
  doc.setFillColor(...GOLD);
  doc.rect(0, 46, PW, 2, 'F');

  // ── 3-COLUMN INFO GRID ─────────────────────────────────────────────────────
  let y = 56;
  const col = CW / 3;

  const drawSection = (title: string, lines: string[], cx: number, cy: number) => {
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(M + cx, cy, M + cx, cy + 2 + lines.length * 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text(title.toUpperCase(), M + cx + 3, cy + 1.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    lines.forEach((line, i) => {
      if (i === 0) { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); }
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...SLATE); }
      doc.text(line, M + cx + 3, cy + 7 + i * 5);
    });
  };

  const col1Lines = [data.studentName];
  if (data.registrationNumber) col1Lines.push(`Reg: ${data.registrationNumber}`);
  if (data.className) col1Lines.push(data.className);
  drawSection('Received From', col1Lines, 0, y);

  const col2Lines = [data.invoiceNumber ?? '—'];
  if (data.termName) col2Lines.push(data.termName);
  if (data.dueDate) col2Lines.push(`Due: ${formatDate(data.dueDate)}`);
  drawSection('Invoice Details', col2Lines, col, y);

  const methodLabel = (data.method ?? '').replace(/_/g, ' ');
  const col3Lines = [methodLabel, formatDate(data.paidAt ?? data.issuedAt)];
  if (data.bankName) col3Lines.push(data.bankName);
  if (data.referenceNumber) col3Lines.push(`Ref: ${data.referenceNumber}`);
  drawSection('Payment Method', col3Lines, col * 2, y);

  y += 38;

  // ── DASHED SEPARATOR ───────────────────────────────────────────────────────
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(M, y, PW - M, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  // ── FEE BREAKDOWN TABLE ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('FEE BREAKDOWN', M, y);
  y += 4;

  const items = (data.lineItems ?? []).map((it) => ({
    name: (it.feeCategoryName ?? it.category ?? 'School Fees'),
    amount: it.amount,
    mandatory: it.mandatory ?? true,
  }));
  if (items.length === 0) items.push({ name: 'School Fees', amount: data.amount, mandatory: true });

  const COL_AMT = 50;
  const COL_BADGE = 22;
  const tableLeft = M;
  const tableRight = PW - M;
  const rowH = 8;

  // Table header
  doc.setFillColor(0, 51, 79);
  doc.rect(tableLeft, y, CW, rowH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...WHITE);
  doc.text('DESCRIPTION', tableLeft + 3, y + 5.2);
  doc.text('TYPE', tableRight - COL_AMT - COL_BADGE + 3, y + 5.2);
  doc.text('AMOUNT (TZS)', tableRight - 3, y + 5.2, { align: 'right' });
  y += rowH;

  // Rows
  items.forEach((item, i) => {
    doc.setFillColor(...(i % 2 === 0 ? WHITE : LIGHT));
    doc.rect(tableLeft, y, CW, rowH, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(item.name, tableLeft + 3, y + 5.2);
    // type badge
    const bx = tableRight - COL_AMT - COL_BADGE + 2;
    doc.setFillColor(...(item.mandatory ? [0,51,79] : [213,154,27]) as [number,number,number]);
    doc.roundedRect(bx, y + 1.5, COL_BADGE - 4, 5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...WHITE);
    doc.text(item.mandatory ? 'MANDATORY' : 'OPTIONAL', bx + (COL_BADGE - 4) / 2, y + 5, { align: 'center' });
    // amount
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    doc.text(formatTZS(item.amount), tableRight - 3, y + 5.2, { align: 'right' });
    y += rowH;
  });

  // Total row
  doc.setFillColor(...NAVY);
  doc.rect(tableLeft, y, CW, rowH + 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...WHITE);
  doc.text('TOTAL AMOUNT RECEIVED', tableLeft + 3, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  doc.text(formatTZS(data.amount), tableRight - 3, y + 6, { align: 'right' });
  y += rowH + 5;

  // Amount in words
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(213, 154, 27);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 10, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('AMOUNT IN WORDS:', M + 3, y + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(amountInWords(data.amount), M + 40, y + 4.5);
  y += 14;

  // Remaining balance
  if (data.outstandingBalance !== undefined) {
    const cleared = data.outstandingBalance <= 0;
    doc.setFillColor(...(cleared ? [240,253,244] : [255,251,235]) as [number,number,number]);
    doc.setDrawColor(...(cleared ? [16,185,129] : [213,154,27]) as [number,number,number]);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, CW, 10, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...SLATE);
    doc.text('Remaining balance after this payment:', M + 3, y + 6.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...(cleared ? GREEN : GOLD));
    doc.text(
      cleared ? 'TZS 0  ·  Invoice Fully Cleared ✓' : formatTZS(Math.max(0, data.outstandingBalance)),
      PW - M - 3, y + 6.2, { align: 'right' },
    );
    y += 14;
  }

  // ── DASHED SEPARATOR ───────────────────────────────────────────────────────
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(M, y, PW - M, y);
  doc.setLineDashPattern([], 0);
  y += 8;

  // ── SIGNATURE SECTION ──────────────────────────────────────────────────────
  const sigW = (CW - 10) / 3;
  // QR placeholder box
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.3);
  doc.rect(M, y, sigW, 22, 'D');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...SLATE);
  doc.text('SCAN TO VERIFY', M + sigW / 2, y + 18, { align: 'center' });
  doc.setFontSize(16);
  doc.text('▦', M + sigW / 2, y + 11, { align: 'center' });

  // Finance Officer signature
  const sig1x = M + sigW + 5;
  doc.setDrawColor(...DARK);
  doc.setLineWidth(0.5);
  doc.line(sig1x, y + 19, sig1x + sigW, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('FINANCE OFFICER', sig1x + sigW / 2, y + 22.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Signature & Date', sig1x + sigW / 2, y + 26, { align: 'center' });

  // Principal signature
  const sig2x = sig1x + sigW + 5;
  doc.setDrawColor(...DARK);
  doc.line(sig2x, y + 19, sig2x + sigW, y + 19);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE);
  doc.text('AUTHORISED SIGNATORY', sig2x + sigW / 2, y + 22.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('Principal / Director', sig2x + sigW / 2, y + 26, { align: 'center' });

  y += 33;

  // VOID watermark
  if (!isPaid) {
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(72);
    doc.setTextColor(220, 38, 38);
    doc.text('VOID', PW / 2, 148, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();
  }

  // ── FOOTER ─────────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.rect(M, y, CW, 16, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This is a computer-generated official receipt of Kilimanjaro Schools. Valid without a physical signature.',
    PW / 2, y + 6, { align: 'center' },
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text(
    `Verify authenticity at: kilimanjaroschools.ac.tz/verify/${data.number}`,
    PW / 2, y + 11.5, { align: 'center' },
  );

  doc.save(`${data.number}.pdf`);
}

export async function downloadReceiptPdf(receiptId: string, toast?: (msg: string, tone?: string) => void): Promise<void> {
  try {
    const raw = await api.get(`/finance/receipts/${receiptId}`).then((r) => {
      const d = r.data?.data ?? r.data;
      return d as Record<string, unknown>;
    });

    const lineItems = Array.isArray((raw as any).invoice?.lineItems)
      ? (raw as any).invoice.lineItems
      : Array.isArray((raw as any).lineItems) ? (raw as any).lineItems : [];

    await generateReceiptPdf({
      number:              String(raw.receiptNumber ?? raw.number ?? receiptId),
      studentName:         String(raw.studentName ?? raw.student ?? 'Student'),
      registrationNumber:  raw.registrationNumber ? String(raw.registrationNumber) : undefined,
      className:           raw.className ? String(raw.className) : undefined,
      amount:              Number(raw.amount ?? 0),
      method:              String(raw.method ?? raw.paymentMethod ?? ''),
      issuedAt:            String(raw.issuedAt ?? raw.createdAt ?? new Date().toISOString()),
      paidAt:              raw.paidAt ? String(raw.paidAt) : undefined,
      referenceNumber:     raw.referenceNumber ? String(raw.referenceNumber) : null,
      status:              (raw.isVoided || raw.status === 'VOID') ? 'VOID' : 'ACTIVE',
      invoiceNumber:       raw.invoiceNumber ? String(raw.invoiceNumber) : undefined,
      termName:            raw.termName ? String(raw.termName) : undefined,
      lineItems,
      outstandingBalance:  raw.outstandingBalance !== undefined ? Number(raw.outstandingBalance) : undefined,
    });
    toast?.('Receipt downloaded', 'success');
  } catch (e: any) {
    console.error('Receipt PDF error:', e);
    toast?.(e?.response?.data?.message ?? 'Failed to generate receipt PDF', 'error');
  }
}

export function ReceiptList({ rows, onDownloadPdf }: { rows: Receipt[]; onDownloadPdf?: (id: string) => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handlePdf = async (id: string) => {
    if (loadingId) return;
    setLoadingId(id);
    try {
      if (onDownloadPdf) { onDownloadPdf(id); }
      else { await downloadReceiptPdf(id); }
    } finally {
      setLoadingId(null);
    }
  };

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
            <Td className="font-mono text-[11px] text-[#94a3b8]">{receipt.paymentId?.slice(0, 8)}…</Td>
            <Td>{receipt.student}</Td>
            <Td amount>
              <AmountDisplay amount={receipt.amount} tone={receipt.status === 'VOID' ? 'void' : 'paid'} />
            </Td>
            <Td><FinanceStatusBadge status={receipt.method} /></Td>
            <Td>{formatDate(receipt.issuedAt)}</Td>
            <Td><FinanceStatusBadge status={receipt.status} /></Td>
            <Td>
              <Button
                variant="secondary"
                className="rounded py-1.5 text-xs opacity-0 transition group-hover:opacity-100"
                loading={loadingId === receipt.id}
                onClick={() => handlePdf(receipt.id)}
              >
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

// ─── Amount in words ──────────────────────────────────────────────────────────

function amountInWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n === 0) return 'Zero Tanzanian Shillings Only';
  const whole = Math.round(Math.abs(n));
  const convert = (num: number): string => {
    if (num === 0) return '';
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
    if (num < 1_000) return ones[Math.floor(num / 100)] + ' Hundred' + (num % 100 ? ' ' + convert(num % 100) : '');
    if (num < 1_000_000) return convert(Math.floor(num / 1_000)) + ' Thousand' + (num % 1_000 ? ' ' + convert(num % 1_000) : '');
    if (num < 1_000_000_000) return convert(Math.floor(num / 1_000_000)) + ' Million' + (num % 1_000_000 ? ' ' + convert(num % 1_000_000) : '');
    return convert(Math.floor(num / 1_000_000_000)) + ' Billion' + (num % 1_000_000_000 ? ' ' + convert(num % 1_000_000_000) : '');
  };
  return convert(whole) + ' Tanzanian Shillings Only';
}

// ─── Receipt preview ──────────────────────────────────────────────────────────

export function ReceiptPreview({
  receipt,
  payment,
  invoice,
}: {
  receipt: Receipt;
  payment?: Partial<Payment> & { bankName?: string };
  invoice?: Invoice;
}) {
  const isPaid = receipt.status !== 'VOID';
  const invoiceNum  = payment?.invoiceNumber ?? '—';
  const term        = invoice?.term ?? '—';
  const className   = invoice?.className ?? '';
  const registration = invoice?.registration ?? '';
  const reference   = payment?.reference ?? '';
  const bankName    = payment?.bankName ?? '';
  const dueDate     = invoice?.dueDate;
  const lineItems   = invoice?.lineItems ?? [];
  const outstanding = invoice?.outstanding;

  return (
    <div className="overflow-hidden rounded-xl border border-[#d5dde6] bg-white shadow-lg">

      {/* ── Header bar ── */}
      <div className="bg-[#00334f] px-7 py-6">
        <div className="flex items-start justify-between gap-4">
          {/* School identity */}
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full border-2 border-[#d59a1b] bg-white/10">
              <span className="font-display text-xl font-black leading-none text-[#d59a1b]">KS</span>
              <div className="my-1 h-px w-8 bg-[#d59a1b]/50" />
              <span className="text-[7px] font-black uppercase tracking-widest text-white/70">SCHOOLS</span>
            </div>
            <div>
              <h1 className="font-display text-xl font-black text-white">Kilimanjaro Schools</h1>
              <p className="text-[11px] font-semibold italic text-[#d59a1b]/90">Excellence in Education Since 2003</p>
              <p className="mt-0.5 text-[10px] font-semibold text-white/55">
                P.O. Box 4502, Moshi, Kilimanjaro, Tanzania · Tel: +255 754 000 000
              </p>
              <p className="text-[10px] font-semibold text-white/55">finance@kilimanjaroschools.ac.tz</p>
            </div>
          </div>
          {/* Receipt number + status stamp */}
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Official Receipt</p>
            <p className="mt-1 font-display text-3xl font-black tracking-tight text-white">{receipt.number}</p>
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-widest ${isPaid ? 'bg-[#10b981] text-white' : 'bg-[#64748b] text-white'}`}>
              {isPaid ? <BadgeCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
              {receipt.status}
            </div>
          </div>
        </div>
      </div>

      {/* ── Gold accent stripe ── */}
      <div className="h-1 bg-gradient-to-r from-[#d59a1b] via-[#f0c040] to-[#d59a1b]" />

      {/* ── Body ── */}
      <div className="p-7">

        {/* 3-col info grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="border-l-2 border-[#d59a1b] pl-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Received From</p>
            <p className="font-display text-lg font-black text-[#0f172a]">{receipt.student}</p>
            {registration && <p className="text-xs font-semibold text-[#64748b]">Reg: {registration}</p>}
            {className   && <p className="text-xs font-semibold text-[#64748b]">{className}</p>}
          </div>
          <div className="border-l-2 border-[#d59a1b] pl-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Invoice Details</p>
            <p className="font-black text-[#0f172a]">{invoiceNum}</p>
            {term !== '—'  && <p className="text-xs font-semibold text-[#64748b]">{term}</p>}
            {dueDate       && <p className="text-xs font-semibold text-[#64748b]">Due: {formatDate(dueDate)}</p>}
          </div>
          <div className="border-l-2 border-[#d59a1b] pl-4">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Payment Method</p>
            <p className="font-black text-[#0f172a]">{(receipt.method ?? '').replaceAll('_', ' ')}</p>
            {bankName  && <p className="text-xs font-semibold text-[#64748b]">{bankName}</p>}
            {reference && <p className="font-mono text-xs font-semibold text-[#64748b]">Ref: {reference}</p>}
            <p className="text-xs font-semibold text-[#64748b]">{formatDate(receipt.issuedAt)}</p>
          </div>
        </div>

        {/* Dashed separator */}
        <div className="my-6 border-t-2 border-dashed border-[#e2e8f0]" />

        {/* Fee breakdown */}
        <div>
          <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Fee Breakdown</p>
          <div className="overflow-hidden rounded-lg border border-[#e2e8f0]">
            {lineItems.length > 0 ? (
              lineItems.map((item, i) => (
                <div
                  key={item.category}
                  className={`flex items-center justify-between px-4 py-3 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f8fafc]'} border-b border-[#e2e8f0] last:border-0`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#334155]">{item.category}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${item.mandatory ? 'bg-[#00334f]/10 text-[#00334f]' : 'bg-[#d59a1b]/10 text-[#7a5200]'}`}>
                      {item.mandatory ? 'mandatory' : 'optional'}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-black tabular-nums text-[#0f172a]">{formatTZS(item.amount)}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-[#334155]">School Fees</span>
                <span className="font-mono text-sm font-black tabular-nums text-[#0f172a]">{formatTZS(receipt.amount)}</span>
              </div>
            )}
            {/* Total row */}
            <div className="flex items-center justify-between bg-[#00334f] px-4 py-3.5">
              <span className="font-display text-sm font-black uppercase tracking-wide text-white">Total Amount Received</span>
              <span className="font-display text-xl font-black tabular-nums text-[#d59a1b]">{formatTZS(receipt.amount)}</span>
            </div>
          </div>

          {/* Amount in words */}
          <div className="mt-3 rounded-lg border border-[#d59a1b]/30 bg-[#fffbeb] px-4 py-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Amount in words: </span>
            <span className="text-xs font-bold italic text-[#334155]">{amountInWords(receipt.amount)}</span>
          </div>
        </div>

        {/* Balance after payment */}
        {outstanding !== undefined && (
          <div className={`mt-3 flex items-center justify-between rounded-lg border px-4 py-3 ${outstanding <= 0 ? 'border-[#10b981]/30 bg-[#10b981]/5' : 'border-[#d59a1b]/30 bg-[#d59a1b]/5'}`}>
            <span className="text-xs font-bold text-[#64748b]">Remaining balance after this payment</span>
            <div className="text-right">
              <p className={`font-mono font-black ${outstanding <= 0 ? 'text-[#10b981]' : 'text-[#d59a1b]'}`}>
                {formatTZS(Math.max(0, outstanding))}
              </p>
              {outstanding <= 0 && <p className="text-[10px] font-black text-[#10b981]">Invoice Fully Cleared ✓</p>}
            </div>
          </div>
        )}

        {/* Dashed separator */}
        <div className="my-6 border-t-2 border-dashed border-[#e2e8f0]" />

        {/* Signature + QR row */}
        <div className="grid grid-cols-3 items-end gap-6">
          {/* QR placeholder */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-[#d5dde6] bg-[#f8fafc]">
              <QrCode className="h-10 w-10 text-[#64748b]" />
            </div>
            <p className="text-center text-[9px] font-semibold text-[#94a3b8]">Scan to verify</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 w-full border-b-2 border-[#334155]" />
            <p className="text-[10px] font-black text-[#64748b]">Finance Officer</p>
            <p className="text-[9px] text-[#94a3b8]">Signature &amp; Date</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="mb-2 w-full border-b-2 border-[#334155]" />
            <p className="text-[10px] font-black text-[#64748b]">Authorised Signatory</p>
            <p className="text-[9px] text-[#94a3b8]">Principal / Director</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-5 py-3 text-center">
          <p className="text-[10px] font-semibold text-[#94a3b8]">
            This is a computer-generated official receipt of Kilimanjaro Schools. Valid without a physical signature.
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-[#94a3b8]">
            Verify authenticity at:{' '}
            <span className="font-black text-[#00334f]">kilimanjaroschools.ac.tz/verify/{receipt.number}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

export function AssetCard({ asset }: { asset: Asset }) {
  const meta = asset.isGroup
    ? `${asset.groupType || 'GROUPED ASSET'} - ${asset.childCount ?? 0} item types`
    : `${asset.category} - ${asset.type}`;
  const idLine = asset.isGroup ? asset.assetNumber : asset.serial;
  return (
    <div title={meta} className="rounded-lg border border-[#d5dde6] bg-white transition hover:border-[#00334f]/30 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-[#d5dde6] px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">
            {meta}
          </p>
          <h3 className="mt-1 font-display text-xl font-black text-[#00334f]">{asset.name}</h3>
          <p className="text-xs font-bold text-[#64748b]">{idLine}</p>
        </div>
        <FinanceStatusBadge status={asset.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 p-5">
        <MiniStat label={asset.isGroup ? 'Ledger Cost' : 'Purchase Cost'} value={formatTZS(asset.purchaseCost)} mono />
        <MiniStat label={asset.isGroup ? 'Ledger Value' : 'Book Value'} value={formatTZS(asset.currentValue)} mono />
        <MiniStat label="Location" value={asset.location} />
        <MiniStat label={asset.isGroup ? 'Ledger Items' : 'Condition'} value={asset.isGroup ? `${asset.childCount ?? 0}` : asset.condition} />
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

// ─── Audit action registry ────────────────────────────────────────────────────

type AuditTone = 'green' | 'red' | 'amber' | 'navy' | 'slate';

type ActionMeta = {
  label: string;
  tone: AuditTone;
  describe: (after: Record<string, unknown>, actor: string, actorName?: string) => string;
  keyFields?: string[]; // fields to highlight in the diff
};

const AUDIT_ACTIONS: Record<string, ActionMeta> = {
  // Payments
  PAYMENT_RECORDED:   { label: 'Payment Recorded', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} recorded a payment of ${fmtTZS(a.amount)} via ${a.paymentMethod ?? a.method ?? 'cash'} for ${a.studentName ?? 'a student'}.`,
    keyFields: ['amount', 'paymentMethod', 'method', 'studentName', 'status'] },
  PAYMENT_APPROVED:   { label: 'Payment Approved', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} approved a payment of ${fmtTZS(a.amount)}.`,
    keyFields: ['status', 'amount', 'approvedAt'] },
  PAYMENT_REJECTED:   { label: 'Payment Rejected', tone: 'red',
    describe: (a, _, n) => `${n || 'Finance officer'} rejected a payment of ${fmtTZS(a.amount)}. Reason: ${a.rejectionReason ?? a.reason ?? 'not stated'}.`,
    keyFields: ['status', 'rejectionReason', 'reason'] },
  PAYMENT_VOIDED:     { label: 'Payment Voided', tone: 'red',
    describe: (_, __, n) => `${n || 'Finance officer'} voided a payment record.`,
    keyFields: ['status'] },
  // Invoices
  INVOICE_CREATED:    { label: 'Invoice Generated', tone: 'navy',
    describe: (a, _, n) => `${n || 'Finance officer'} generated an invoice for ${a.studentName ?? a.student ?? 'a student'} totalling ${fmtTZS(a.totalAmount ?? a.total)}.`,
    keyFields: ['studentName', 'totalAmount', 'total', 'status', 'dueDate'] },
  INVOICE_VOIDED:     { label: 'Invoice Voided', tone: 'red',
    describe: (a, _, n) => `${n || 'Finance officer'} voided invoice #${a.invoiceNumber ?? a.number ?? '—'}.`,
    keyFields: ['status', 'voidReason'] },
  DISCOUNT_APPLIED:   { label: 'Discount Applied', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} applied a discount of ${fmtTZS(a.discountAmount ?? a.amount)} to an invoice.`,
    keyFields: ['discountAmount', 'amount', 'reason'] },
  BALANCE_WAIVED:     { label: 'Balance Waived', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} waived ${fmtTZS(a.waivedAmount ?? a.amount)} from an outstanding balance.`,
    keyFields: ['waivedAmount', 'amount', 'reason'] },
  // Receipts
  RECEIPT_GENERATED:  { label: 'Receipt Issued', tone: 'green',
    describe: (a, _, n) => `${n || 'System'} issued a receipt for ${fmtTZS(a.amount)}.`,
    keyFields: ['amount', 'status'] },
  RECEIPT_VOIDED:     { label: 'Receipt Voided', tone: 'red',
    describe: (_, __, n) => `${n || 'Finance officer'} voided a receipt.`,
    keyFields: ['status', 'reason'] },
  // Fee setup
  FEE_CATEGORY_CREATED:  { label: 'Fee Category Created', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} created a new fee category "${a.name}" (${a.isOptional ? 'optional' : 'mandatory'}).`,
    keyFields: ['name', 'isOptional', 'isBillablePerTerm'] },
  FEE_CATEGORY_UPDATED:  { label: 'Fee Category Updated', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} updated fee category "${a.name}".`,
    keyFields: ['name', 'isOptional', 'isBillablePerTerm'] },
  FEE_STRUCTURE_CREATED: { label: 'Fee Structure Created', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} set a fee of ${fmtTZS(a.amount)} for ${a.className ?? 'a class'}.`,
    keyFields: ['amount', 'className', 'effectiveTerm'] },
  FEE_ASSIGNMENT_CREATED:{ label: 'Fee Assigned', tone: 'navy',
    describe: (a, _, n) => `${n || 'Finance officer'} assigned a fee of ${fmtTZS(a.amount)} to ${a.studentName ?? 'a student'}.`,
    keyFields: ['amount', 'studentName', 'category'] },
  // Fund requests
  FUND_REQUEST_SUBMITTED: { label: 'Fund Request Submitted', tone: 'navy',
    describe: (a, role) => `${roleLabel(role)} submitted a fund request "${a.title ?? 'request'}" for ${fmtTZS(a.amount)} from ${a.department ?? 'department'}.`,
    keyFields: ['title', 'amount', 'department', 'neededBy'] },
  FUND_REQUEST_FORWARDED: { label: 'Fund Request Forwarded', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} forwarded fund request "${a.title ?? 'request'}" to the Principal for approval.`,
    keyFields: ['status', 'title'] },
  FUND_REQUEST_APPROVED:  { label: 'Fund Request Approved', tone: 'green',
    describe: (a, role) => `${roleLabel(role)} approved fund request "${a.title ?? 'request'}" for ${fmtTZS(a.amount)}.`,
    keyFields: ['status', 'title', 'amount'] },
  FUND_REQUEST_REJECTED:  { label: 'Fund Request Rejected', tone: 'red',
    describe: (a, role) => `${roleLabel(role)} rejected fund request "${a.title ?? 'request'}". Reason: ${a.rejectionReason ?? a.reason ?? 'not specified'}.`,
    keyFields: ['status', 'rejectionReason', 'reason'] },
  FUND_REQUEST_DISBURSED: { label: 'Funds Disbursed', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} disbursed ${fmtTZS(a.amount)} for fund request "${a.title ?? 'request'}".`,
    keyFields: ['status', 'amount', 'title'] },
  FUND_REQUEST_CANCELLED: { label: 'Fund Request Cancelled', tone: 'red',
    describe: (a, role) => `${roleLabel(role)} cancelled fund request "${a.title ?? 'request'}".`,
    keyFields: ['status', 'title'] },
  // Expenses
  EXPENSE_RECORDED:   { label: 'Expense Recorded', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} recorded an expense of ${fmtTZS(a.amount)} for ${a.category ?? 'general'} — ${a.description ?? a.title ?? 'no description'}.`,
    keyFields: ['amount', 'category', 'description', 'title'] },
  EXPENSE_VOIDED:     { label: 'Expense Voided', tone: 'red',
    describe: (a, _, n) => `${n || 'Finance officer'} voided expense "${a.description ?? a.title ?? '—'}".`,
    keyFields: ['status', 'description'] },
  // Assets
  ASSET_CREATED:      { label: 'Asset Registered', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} registered asset "${a.name}" (${a.category ?? 'asset'}) valued at ${fmtTZS(a.purchaseCost ?? a.currentValue)}.`,
    keyFields: ['name', 'category', 'purchaseCost', 'currentValue', 'location', 'condition'] },
  ASSET_UPDATED:      { label: 'Asset Updated', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} updated details for asset "${a.name}".`,
    keyFields: ['name', 'condition', 'currentValue', 'location', 'status'] },
  ASSET_DISPOSED:     { label: 'Asset Disposed', tone: 'red',
    describe: (a, _, n) => `${n || 'Finance officer'} marked asset "${a.name}" as disposed.`,
    keyFields: ['status', 'name'] },
  // Store / inventory
  STORE_ITEM_CREATED: { label: 'Store Item Added', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} added store item "${a.name}" (${a.category}) to ${a.location ?? 'inventory'} with ${a.quantityOnHand ?? 0} ${a.unit ?? 'units'} at ${fmtTZS(a.unitCost)} each.`,
    keyFields: ['name', 'category', 'quantityOnHand', 'unit', 'unitCost', 'location'] },
  STORE_ITEM_UPDATED: { label: 'Store Item Updated', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} updated store item "${a.name}".`,
    keyFields: ['name', 'unitCost', 'reorderLevel', 'location'] },
  STOCK_RECEIVED:     { label: 'Stock Received', tone: 'green',
    describe: (a, _, n) => `${n || 'Finance officer'} received ${a.quantity} ${a.unit ?? 'units'} of stock${a.supplier ? ` from ${a.supplier}` : ''}.`,
    keyFields: ['quantity', 'unit', 'supplier', 'totalValue', 'balanceAfter'] },
  STOCK_ISSUED:       { label: 'Stock Issued', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} issued ${a.quantity} ${a.unit ?? 'units'} to ${a.issuedTo ?? a.department ?? 'department'}.`,
    keyFields: ['quantity', 'unit', 'issuedTo', 'department', 'reason', 'balanceAfter'] },
  STOCK_ADJUSTED:     { label: 'Stock Adjusted', tone: 'amber',
    describe: (a, _, n) => `${n || 'Finance officer'} adjusted stock. Reason: ${a.reason ?? 'not stated'}.`,
    keyFields: ['quantity', 'balanceAfter', 'reason'] },
};

const ROLE_LABELS: Record<string, string> = {
  FINANCE: 'Finance Officer', PRINCIPAL: 'Principal', ADMIN: 'System Administrator',
  HEAD_OF_DEPARTMENT: 'Head of Department', HOD: 'Head of Department',
  TEACHER: 'Teacher', AQA: 'Academic Officer',
};

function roleLabel(role: string) { return ROLE_LABELS[role] ?? role; }
function fmtTZS(v: unknown) { return v ? `TZS ${Number(v).toLocaleString('en-US')}` : '—'; }

const TONE_STYLES: Record<AuditTone, { dot: string; badge: string; icon: string }> = {
  green: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'text-emerald-600' },
  red:   { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-200',             icon: 'text-red-600' },
  amber: { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700 border-amber-200',       icon: 'text-amber-600' },
  navy:  { dot: 'bg-[#00334f]',   badge: 'bg-[#eef5f8] text-[#00334f] border-[#b0c8d4]',     icon: 'text-[#00334f]' },
  slate: { dot: 'bg-slate-400',   badge: 'bg-slate-50 text-slate-600 border-slate-200',       icon: 'text-slate-500' },
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Name', amount: 'Amount', status: 'Status', category: 'Category',
  description: 'Description', title: 'Title', paymentMethod: 'Payment method', method: 'Payment method',
  studentName: 'Student', totalAmount: 'Total', total: 'Total', dueDate: 'Due date',
  isOptional: 'Optional fee', isBillablePerTerm: 'Billed per term', className: 'Class',
  effectiveTerm: 'Term', department: 'Department', neededBy: 'Needed by',
  rejectionReason: 'Rejection reason', reason: 'Reason', waivedAmount: 'Waived amount',
  discountAmount: 'Discount amount', voidReason: 'Void reason', purchaseCost: 'Purchase cost',
  currentValue: 'Current value', location: 'Location', condition: 'Condition',
  quantityOnHand: 'Quantity on hand', unitCost: 'Unit cost', unit: 'Unit',
  reorderLevel: 'Reorder level', supplier: 'Supplier', issuedTo: 'Issued to',
  quantity: 'Quantity', balanceAfter: 'Balance after', totalValue: 'Total value',
  invoiceNumber: 'Invoice number', number: 'Number', approvedAt: 'Approved at',
};

function fieldLabel(key: string) { return FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim(); }

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString('en-US');
  const s = String(val);
  // ISO date
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString('en-GB');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return s;
}

// Which fields changed between before and after
function computeDiff(before: Record<string, unknown>, after: Record<string, unknown>, highlight?: string[]) {
  const keys = highlight
    ? highlight.filter((k) => k in after || k in before)
    : [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) =>
        !['id', 'createdAt', 'updatedAt', 'createdById', 'updatedById'].includes(k),
      );
  return keys
    .map((k) => ({ key: k, old: before[k], new: after[k] }))
    .filter((d) => String(d.old ?? '') !== String(d.new ?? ''));
}

export function AuditLogRow({ entry }: { entry: AuditEntry & { actorName?: string; actorId?: string; entityType?: string; entityId?: string } }) {
  const [open, setOpen]   = useState(false);
  const [raw,  setRaw]    = useState(false);

  const meta    = AUDIT_ACTIONS[entry.action] ?? { label: entry.action.replace(/_/g, ' '), tone: 'slate' as AuditTone, describe: (_a: unknown, role: string) => `Action performed by ${roleLabel(role)}.` };
  const tone    = meta.tone;
  const styles  = TONE_STYLES[tone];
  const diff    = computeDiff(
    entry.before as Record<string, unknown>,
    entry.after  as Record<string, unknown>,
    meta.keyFields,
  );
  const description = meta.describe(
    entry.after as Record<string, unknown>,
    entry.actor,
    (entry as { actorName?: string }).actorName,
  );

  const dateStr = entry.date
    ? new Date(entry.date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className={`overflow-hidden rounded-xl border bg-white transition-shadow ${open ? 'border-[#b0c8d4] shadow-md' : 'border-[#d5dde6]'}`}>
      {/* ── Row header ── */}
      <button
        className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-[#f7f9fb]"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Tone dot */}
        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${styles.badge}`}>
              {meta.label}
            </span>
            <span className="text-[11px] font-semibold text-[#64748b]">{dateStr}</span>
          </div>
          <p className="mt-1 text-sm font-semibold text-[#0f172a]">{description}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#94a3b8]">
            <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" />{(entry as { actorName?: string }).actorName ? `${(entry as { actorName?: string }).actorName} (${roleLabel(entry.actor)})` : roleLabel(entry.actor)}</span>
            <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{entry.entity}</span>
            {entry.correlationId && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />{entry.correlationId.slice(0, 16)}</span>}
          </div>
        </div>

        {/* Toggle */}
        <div className="shrink-0 text-[#64748b]">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* ── Expanded detail ── */}
      {open && (
        <div className="border-t border-[#d5dde6]">
          {/* What happened */}
          <div className={`px-5 py-4 ${styles.badge.split(' ').map((c: string) => c.startsWith('bg-') ? c : '').join(' ')} border-b border-[#d5dde6]`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">What happened</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">{description}</p>
          </div>

          {/* Changed fields */}
          {diff.length > 0 && (
            <div className="border-b border-[#d5dde6] px-5 py-4">
              <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#64748b]">Changes</p>
              <div className="space-y-2">
                {diff.map((d) => (
                  <div key={d.key} className="grid grid-cols-[160px_1fr_1fr] items-start gap-3 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2.5">
                    <span className="text-[11px] font-black text-[#475569]">{fieldLabel(d.key)}</span>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">Before</p>
                      <p className={`mt-0.5 text-xs font-semibold ${d.old !== undefined && d.old !== null && d.old !== '' ? 'text-[#0f172a]' : 'text-[#cbd5e1]'}`}>
                        {formatFieldValue(d.old)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8]">After</p>
                      <p className={`mt-0.5 text-xs font-bold ${tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : 'text-[#00334f]'}`}>
                        {formatFieldValue(d.new)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 border-b border-[#d5dde6] px-5 py-4 sm:grid-cols-4">
            {[
              { icon: <UserCircle className="h-3.5 w-3.5" />, label: 'Performed by', value: (entry as { actorName?: string }).actorName || roleLabel(entry.actor) },
              { icon: <ShieldCheck className="h-3.5 w-3.5" />, label: 'Role', value: roleLabel(entry.actor) },
              { icon: <Calendar className="h-3.5 w-3.5" />, label: 'Date & time', value: dateStr },
              { icon: <Hash className="h-3.5 w-3.5" />, label: 'Correlation ID', value: entry.correlationId || '—' },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">
                  {m.icon}{m.label}
                </div>
                <p className="mt-1 break-all text-xs font-semibold text-[#0f172a]">{m.value}</p>
              </div>
            ))}
          </div>

          {/* Raw data toggle */}
          <div className="px-5 py-3">
            <button
              onClick={(e) => { e.stopPropagation(); setRaw((v) => !v); }}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-[#94a3b8] hover:text-[#00334f]"
            >
              {raw ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {raw ? 'Hide' : 'Show'} raw data
            </button>
            {raw && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <AuditJsonBlock title="Before" value={entry.before} />
                <AuditJsonBlock title="After"  value={entry.after} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditJsonBlock({ title, value }: { title: string; value: Record<string, string | number | boolean> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-[#0f172a]">
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

export function DenseBarChart({ values, title = 'Collection by Method', subtitle = "Today's transactions" }: { values: Array<{ label: string; value: number; tone?: string }>; title?: string; subtitle?: string }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3">
        <h2 className="font-display text-base font-black text-[#00334f]">{title}</h2>
        <p className="text-xs font-semibold text-[#64748b]">{subtitle}</p>
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
