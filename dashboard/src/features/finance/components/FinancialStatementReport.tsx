import { useState } from 'react';
import {
  BarChart3,
  Download,
  FileText,
  Layers3,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { formatTZS, formatDate } from '../utils/money';
import { useFinancialStatement, downloadStatement, type StatementParams, type FinancialStatement } from '../api/financeOps.hooks';

const PERIODS = [
  { key: 'weekly', label: 'Week' },
  { key: 'monthly', label: 'Month' },
  { key: 'quarterly', label: 'Quarter' },
  { key: 'yearly', label: 'Year' },
  { key: 'custom', label: 'Custom' },
] as const;

const VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'operations', label: 'Inventory & Assets' },
  { key: 'ledger', label: 'Ledger' },
] as const;

type ViewKey = typeof VIEWS[number]['key'];

const labelize = (value: string) => (value || 'Unspecified').replaceAll('_', ' ');
const pct = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const coverage = (outflows: number, ratio: number) => outflows > 0 ? `${ratio.toFixed(2)}x` : 'N/A';

export function FinancialStatementReport() {
  const [period, setPeriod] = useState<string>('monthly');
  const [view, setView] = useState<ViewKey>('overview');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const params: StatementParams = period === 'custom' && start && end ? { period: 'custom', start, end } : { period };
  const { data: s, isLoading } = useFinancialStatement(params);

  const doDownload = async (fmt: 'pdf' | 'csv') => {
    setDownloading(fmt);
    try {
      await downloadStatement(fmt, params);
      toast(`${fmt.toUpperCase()} downloaded`, 'success');
    } catch {
      toast(`Failed to generate ${fmt.toUpperCase()}`, 'error');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-gutter">
      <div className="rounded-lg border border-[#d5dde6] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Statement period</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                      period === p.key ? 'bg-[#00334f] text-white' : 'border border-[#d5dde6] bg-white text-[#64748b] hover:bg-[#eef5f8]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {period === 'custom' && (
              <div className="flex flex-wrap items-end gap-2">
                <DateBox label="From" value={start} onChange={setStart} />
                <DateBox label="To" value={end} onChange={setEnd} />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="rounded" onClick={() => doDownload('pdf')} disabled={downloading !== null}>
              <FileText className="h-4 w-4" /> {downloading === 'pdf' ? 'Generating...' : 'PDF'}
            </Button>
            <Button variant="secondary" className="rounded" onClick={() => doDownload('csv')} disabled={downloading !== null}>
              <Download className="h-4 w-4" /> {downloading === 'csv' ? 'Generating...' : 'CSV'}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[#e2e8f0] pt-3">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wider ${
                view === item.key ? 'bg-[#d59a1b] text-[#0f172a]' : 'border border-[#d5dde6] bg-[#f8fafc] text-[#64748b]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading || !s ? (
        <SkeletonTable cols={4} />
      ) : (
        <>
          <Header s={s} />
          <Summary s={s} />
          {view === 'overview' && <Overview s={s} />}
          {view === 'receivables' && <Receivables s={s} />}
          {view === 'operations' && <Operations s={s} />}
          {view === 'ledger' && <Ledger s={s} />}
        </>
      )}
    </div>
  );
}

function DateBox({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]"
      />
    </label>
  );
}

function Header({ s }: { s: FinancialStatement }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#64748b]">Kilimanjaro Schools</p>
        <h2 className="font-display text-2xl font-black text-[#00334f]">Financial Statement - {s.period.label}</h2>
        <p className="text-xs font-semibold text-[#64748b]">
          Generated {formatDate(s.generatedAt)}. Live from confirmed collections, invoices, expenses, inventory and assets.
        </p>
      </div>
      <div className={`rounded border px-4 py-2 text-right ${s.cashflow.netCashflow >= 0 ? 'border-[#10b981]/30 bg-[#ecfdf5]' : 'border-red-200 bg-red-50'}`}>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Net cash flow</p>
        <p className={`font-mono text-xl font-black tabular-nums ${s.cashflow.netCashflow >= 0 ? 'text-[#047857]' : 'text-red-700'}`}>
          {formatTZS(s.cashflow.netCashflow)}
        </p>
      </div>
    </div>
  );
}

function Summary({ s }: { s: FinancialStatement }) {
  const collectionDetail = s.collections.totalInvoiced > 0
    ? `${pct(s.collections.collectionRate)} of ${formatTZS(s.collections.totalInvoiced)} new billings`
    : `${pct(s.collections.collectionRate)} recovered from open fees`;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Kpi icon={<WalletCards className="h-4 w-4" />} label="Collected" value={formatTZS(s.collections.totalCollected)} detail={collectionDetail} tone="green" />
      <Kpi icon={<ReceiptText className="h-4 w-4" />} label="Receivable exposure" value={formatTZS(s.collections.outstanding)} detail={`${pct(s.ratios.receivableExposureRate)} of recoverable fees`} tone="gold" />
      <Kpi icon={<TrendingDown className="h-4 w-4" />} label="Operating expenses" value={formatTZS(s.expenses.total)} detail={`${s.expenses.count} recorded entries`} tone="red" />
      <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Net result" value={formatTZS(s.net.collectedLessExpenses)} detail={s.net.collectedLessExpenses >= 0 ? 'Operating surplus' : 'Operating deficit'} tone={s.net.collectedLessExpenses >= 0 ? 'green' : 'red'} />
    </div>
  );
}

function Overview({ s }: { s: FinancialStatement }) {
  const seriesMax = Math.max(1, ...s.series.flatMap((p) => [p.collected, p.expenses]));
  return (
    <div className="space-y-gutter">
      <div className="grid gap-gutter xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Collections vs Expenses" subtitle={`${s.series.length} reporting points`}>
          {!s.series.length ? <Empty text="No dated activity in this period." /> : (
            <div className="mt-5 flex items-end gap-2" style={{ height: 190 }}>
              {s.series.map((p) => (
                <div key={p.label} className="flex min-w-8 flex-1 flex-col items-center gap-1">
                  <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 154 }}>
                    <div className="w-1/2 rounded-t bg-[#10b981]" style={{ height: `${Math.max(2, (p.collected / seriesMax) * 100)}%` }} title={`Collected ${formatTZS(p.collected)}`} />
                    <div className="w-1/2 rounded-t bg-[#e11d48]" style={{ height: `${Math.max(2, (p.expenses / seriesMax) * 100)}%` }} title={`Expenses ${formatTZS(p.expenses)}`} />
                  </div>
                  <span className="text-[8px] font-bold text-[#64748b]">{p.label}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-4 text-[11px] font-black uppercase tracking-wide">
            <span className="flex items-center gap-1 text-[#10b981]"><TrendingUp className="h-3 w-3" /> Collected</span>
            <span className="flex items-center gap-1 text-[#e11d48]"><TrendingDown className="h-3 w-3" /> Expenses</span>
          </div>
        </Panel>
        <Panel title="Management Ratios" subtitle="Controls and cash pressure">
          <Ratio label="Expense to collection" value={pct(s.ratios.expenseToCollectionRate)} amount={`${formatTZS(s.expenses.total)} spent`} tone={s.ratios.expenseToCollectionRate > 75 ? 'red' : 'green'} />
          <Ratio label="Receivable exposure" value={pct(s.ratios.receivableExposureRate)} amount={`${formatTZS(s.collections.outstanding)} open`} tone={s.ratios.receivableExposureRate > 30 ? 'red' : 'gold'} />
          <Ratio label="Cash coverage" value={coverage(s.cashflow.outflows, s.ratios.cashCoverage)} amount={s.cashflow.outflows > 0 ? `${formatTZS(s.cashflow.inflows)} inflow` : 'No outflows recorded'} tone={s.cashflow.outflows === 0 || s.ratios.cashCoverage >= 1 ? 'green' : 'red'} />
        </Panel>
      </div>
      <div className="grid gap-gutter xl:grid-cols-2">
        <MoneyTable title="Collections by Method" columns={['Method', 'Txns', 'Amount']} rows={s.collections.byMethod.map((m) => [labelize(m.method), String(m.count), formatTZS(m.amount)])} />
        <MoneyTable title="Expenses by Category" columns={['Category', 'Entries', 'Amount']} rows={s.expenses.byCategory.map((c) => [labelize(c.category), String(c.count), formatTZS(c.amount)])} />
      </div>
      <MoneyTable
        title="Receivables Roll-Forward"
        columns={['Line', 'Amount']}
        rows={[
          ['Opening receivables estimate', formatTZS(s.receivables.rollForward.openingEstimate)],
          ['New billings in selected period', formatTZS(s.receivables.rollForward.newBillings)],
          ['Collections received', `(${formatTZS(s.receivables.rollForward.collections)})`],
          ['Estimated adjustments / timing differences', formatTZS(s.receivables.rollForward.estimatedAdjustments)],
          ['Closing outstanding receivables', formatTZS(s.receivables.rollForward.closingOutstanding)],
        ]}
      />
      <FormalStatement s={s} />
    </div>
  );
}

function Receivables({ s }: { s: FinancialStatement }) {
  return (
    <div className="space-y-gutter">
      <div className="grid gap-gutter xl:grid-cols-2">
        <MoneyTable title="Ageing Schedule" columns={['Bucket', 'Invoices', 'Amount']} rows={s.receivables.ageing.map((a) => [a.bucket, String(a.count), formatTZS(a.amount)])} />
        <MoneyTable title="Open Invoices by Status" columns={['Status', 'Invoices', 'Amount']} rows={s.receivables.byStatus.map((a) => [labelize(a.status), String(a.count), formatTZS(a.amount)])} />
      </div>
      <MoneyTable
        title="Priority Fee Follow-Up"
        columns={['Student', 'Class', 'Invoice', 'Days Overdue', 'Outstanding']}
        rows={s.receivables.topDebtors.map((d) => [d.studentName, d.className, d.invoiceNumber, String(d.daysOverdue), formatTZS(d.outstanding)])}
      />
    </div>
  );
}

function Operations({ s }: { s: FinancialStatement }) {
  return (
    <div className="space-y-gutter">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Layers3 className="h-4 w-4" />} label="Stock value" value={formatTZS(s.store.stockValue)} detail={`${formatTZS(s.store.received)} received`} tone="navy" />
        <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Stock issued" value={formatTZS(s.store.issued)} detail="Period consumption" tone="gold" />
        <Kpi icon={<Layers3 className="h-4 w-4" />} label="Asset value" value={formatTZS(s.assets.currentValue)} detail={`${s.assets.count} active assets`} tone="green" />
        <Kpi icon={<ReceiptText className="h-4 w-4" />} label="Fund disbursed" value={formatTZS(s.disbursements.total)} detail={`${s.disbursements.count} approved requests`} tone="slate" />
      </div>
      <div className="grid gap-gutter xl:grid-cols-2">
        <MoneyTable title="Inventory by Category" columns={['Category', 'Items', 'Value']} rows={s.inventory.byCategory.map((i) => [labelize(i.category), String(i.items), formatTZS(i.value)])} />
        <MoneyTable title="Asset Value by Status" columns={['Status', 'Assets', 'Value']} rows={s.assetBreakdown.byStatus.map((a) => [labelize(a.status), String(a.count), formatTZS(a.value)])} />
      </div>
      <MoneyTable
        title="Low Stock Exceptions"
        columns={['Code', 'Item', 'Category', 'On Hand', 'Reorder Level', 'Value']}
        rows={s.inventory.lowStock.map((i) => [i.itemCode, i.name, labelize(i.category), String(i.quantityOnHand), String(i.reorderLevel), formatTZS(i.stockValue)])}
      />
      <MoneyTable title="Asset Condition" columns={['Condition', 'Assets', 'Value']} rows={s.assetBreakdown.byCondition.map((a) => [labelize(a.condition), String(a.count), formatTZS(a.value)])} />
    </div>
  );
}

function Ledger({ s }: { s: FinancialStatement }) {
  return (
    <div className="space-y-gutter">
      <MoneyTable
        title="Recent Collections"
        columns={['Date', 'Reference', 'Payer', 'Method', 'Amount']}
        rows={s.transactions.recentCollections.map((t) => [formatDate(t.date), t.reference || '-', t.payer || '-', labelize(t.method), formatTZS(t.amount)])}
      />
      <MoneyTable
        title="Recent Expenses"
        columns={['Date', 'Category', 'Description', 'Payee', 'Amount']}
        rows={s.transactions.recentExpenses.map((t) => [formatDate(t.date), labelize(t.category), t.description || '-', t.payee || '-', formatTZS(t.amount)])}
      />
      <MoneyTable
        title="Recent Fund Disbursements"
        columns={['Date', 'Request', 'Title', 'Department', 'Amount']}
        rows={s.transactions.recentDisbursements.map((t) => [formatDate(t.date), t.requestNumber, t.title, labelize(t.department), formatTZS(t.amount)])}
      />
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
      <h3 className="font-display text-lg font-black text-[#00334f]">{title}</h3>
      {subtitle && <p className="text-xs font-semibold text-[#64748b]">{subtitle}</p>}
      {children}
    </div>
  );
}

function Kpi({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: 'navy' | 'green' | 'red' | 'gold' | 'slate' }) {
  const color = tone === 'green' ? 'text-[#047857] border-l-[#10b981]' : tone === 'red' ? 'text-red-700 border-l-[#e11d48]' : tone === 'gold' ? 'text-[#a16207] border-l-[#d59a1b]' : tone === 'slate' ? 'text-[#475569] border-l-[#64748b]' : 'text-[#00334f] border-l-[#00334f]';
  return (
    <div className={`rounded-lg border border-[#d5dde6] border-l-4 bg-white p-5 ${color}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
        <span className={color.split(' ')[0]}>{icon}</span>
      </div>
      <p className="mt-1.5 font-mono text-[24px] font-black leading-none tabular-nums text-[#0f172a]">{value}</p>
      <p className="mt-1.5 text-[11px] font-bold text-[#64748b]">{detail}</p>
    </div>
  );
}

function Ratio({ label, value, amount, tone }: { label: string; value: string; amount: string; tone: 'green' | 'red' | 'gold' }) {
  const text = tone === 'green' ? 'text-[#047857]' : tone === 'red' ? 'text-red-700' : 'text-[#a16207]';
  return (
    <div className="mt-4 flex items-center justify-between border-b border-[#e2e8f0] pb-3 last:border-b-0">
      <div>
        <p className="text-sm font-black text-[#0f172a]">{label}</p>
        <p className="text-xs font-semibold text-[#64748b]">{amount}</p>
      </div>
      <p className={`font-mono text-xl font-black tabular-nums ${text}`}>{value}</p>
    </div>
  );
}

function MoneyTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3">
        <h3 className="font-display text-base font-black text-[#00334f]">{title}</h3>
      </div>
      {!rows.length ? <Empty text="No records found for this period." /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#eef5f8]">
              <tr>{columns.map((c) => <th key={c} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {rows.map((row, idx) => (
                <tr key={`${title}-${idx}`} className="even:bg-[#f7f9fb]">
                  {row.map((cell, i) => (
                    <td key={`${idx}-${i}`} className={`px-5 py-2.5 ${i === row.length - 1 ? 'font-mono font-black tabular-nums text-[#0f172a]' : i === 0 ? 'font-bold text-[#0f172a]' : 'text-[#475569]'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormalStatement({ s }: { s: FinancialStatement }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#d5dde6] bg-[#00334f] px-6 py-5 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Kilimanjaro Schools</p>
        <h3 className="mt-1 font-display text-xl font-black text-white">Statement of Financial Performance</h3>
        <p className="mt-0.5 text-xs font-semibold text-white/70">{s.period.label} - Generated {formatDate(s.generatedAt)}</p>
      </div>
      <div className="divide-y divide-[#f1f5f9] px-6">
        <PlSection label="Income and Receivables" />
        <PlRow label="New fees invoiced in selected period" value={s.collections.totalInvoiced} />
        <PlRow label="Confirmed collections" value={s.collections.totalCollected} accent="green" />
        <PlRow label="Outstanding receivables" value={s.collections.outstanding} accent="red" />
        <PlSection label="Cash Outflows" />
        <PlRow label="Operating expenses" value={s.expenses.total} accent="red" />
        <PlRow label="Fund disbursements" value={s.disbursements.total} accent="red" />
        <PlSection label="Net Position" />
        <PlRow label={s.net.collectedLessExpenses >= 0 ? 'Operating surplus' : 'Operating deficit'} value={s.net.collectedLessExpenses} accent={s.net.collectedLessExpenses >= 0 ? 'green' : 'red'} bold />
        <PlSection label="Balance Snapshot" />
        <PlRow label="Inventory on hand" value={s.store.stockValue} />
        <PlRow label="Active asset book value" value={s.assets.currentValue} />
        <div className="py-4" />
      </div>
    </div>
  );
}

function PlSection({ label }: { label: string }) {
  return <div className="pb-1 pt-5"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#64748b]">{label}</p></div>;
}

function PlRow({ label, value, accent, bold }: { label: string; value: number; accent?: 'green' | 'red'; bold?: boolean }) {
  const color = accent === 'green' ? 'text-[#047857]' : accent === 'red' ? 'text-red-600' : 'text-[#475569]';
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className={`text-sm ${bold ? 'font-black text-[#00334f]' : 'text-[#475569]'}`}>{label}</span>
      <span className={`font-mono tabular-nums ${bold ? 'text-base font-black' : 'text-sm font-semibold'} ${color}`}>
        {value < 0 ? `(${formatTZS(-value)})` : formatTZS(value)}
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="p-5 text-sm font-semibold text-[#64748b]">{text}</p>;
}
