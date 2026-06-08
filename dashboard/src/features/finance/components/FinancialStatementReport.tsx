import { useState } from 'react';
import { Download, FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { formatTZS, formatDate } from '../utils/money';
import { useFinancialStatement, downloadStatement, type StatementParams } from '../api/financeOps.hooks';

const PERIODS = [
  { key: 'weekly', label: 'This Week' },
  { key: 'monthly', label: 'This Month' },
  { key: 'quarterly', label: 'This Quarter' },
  { key: 'yearly', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
] as const;

const BAR_TONES = ['bg-[#00334f]', 'bg-[#d59a1b]', 'bg-[#10b981]', 'bg-[#64748b]', 'bg-[#e11d48]', 'bg-[#0ea5e9]'];

export function FinancialStatementReport() {
  const [period, setPeriod] = useState<string>('monthly');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const params: StatementParams = period === 'custom' && start && end ? { period: 'custom', start, end } : { period };
  const { data: s, isLoading } = useFinancialStatement(params);

  const doDownload = async (fmt: 'pdf' | 'csv') => {
    setDownloading(fmt);
    try { await downloadStatement(fmt, params); toast(`${fmt.toUpperCase()} downloaded`, 'success'); }
    catch { toast(`Failed to generate ${fmt.toUpperCase()}`, 'error'); }
    finally { setDownloading(null); }
  };

  const seriesMax = Math.max(1, ...(s?.series ?? []).flatMap((p) => [p.collected, p.expenses]));
  const catMax = Math.max(1, ...(s?.expenses.byCategory ?? []).map((c) => c.amount));

  return (
    <div className="space-y-gutter">
      {/* Controls */}
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-[#d5dde6] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-[#64748b]">Period</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PERIODS.map((p) => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`rounded px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${period === p.key ? 'bg-[#00334f] text-white' : 'border border-[#d5dde6] bg-white text-[#64748b] hover:bg-[#eef5f8]'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {period === 'custom' && (
            <div className="flex items-end gap-2">
              <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">From</span>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 h-10 rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]" /></label>
              <label className="block"><span className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">To</span>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-10 rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 font-semibold outline-none focus:border-[#00334f]" /></label>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="rounded" onClick={() => doDownload('pdf')} disabled={downloading !== null}>
            <FileText className="h-4 w-4" /> {downloading === 'pdf' ? 'Generating…' : 'PDF'}
          </Button>
          <Button variant="secondary" className="rounded" onClick={() => doDownload('csv')} disabled={downloading !== null}>
            <Download className="h-4 w-4" /> {downloading === 'csv' ? 'Generating…' : 'Excel (CSV)'}
          </Button>
        </div>
      </div>

      {isLoading || !s ? (
        <SkeletonTable cols={4} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-black text-[#00334f]">{s.period.label}</h2>
              <p className="text-xs font-semibold text-[#64748b]">Generated {formatDate(s.generatedAt)} · {s.period.type.toUpperCase()} statement</p>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Collected" value={formatTZS(s.collections.totalCollected)} detail={`${s.collections.collectionRate}% of invoiced`} tone="green" />
            <Kpi label="Expenditure" value={formatTZS(s.expenses.total)} detail={`${s.expenses.count} entries`} tone="red" />
            <Kpi label="Net Position" value={formatTZS(s.net.collectedLessExpenses)} detail={s.net.collectedLessExpenses >= 0 ? 'Surplus' : 'Deficit'} tone={s.net.collectedLessExpenses >= 0 ? 'navy' : 'red'} />
            <Kpi label="Outstanding" value={formatTZS(s.collections.outstanding)} detail="Fees receivable" tone="gold" />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Fund Disbursed" value={formatTZS(s.disbursements.total)} detail={`${s.disbursements.count} requests`} tone="slate" />
            <Kpi label="Stock Value" value={formatTZS(s.store.stockValue)} detail={`In TZS ${formatTZS(s.store.received)} · Out ${formatTZS(s.store.issued)}`} tone="slate" />
            <Kpi label="Asset Value" value={formatTZS(s.assets.currentValue)} detail={`${s.assets.count} assets`} tone="navy" />
            <Kpi label="Invoiced" value={formatTZS(s.collections.totalInvoiced)} detail="This period" tone="slate" />
          </div>

          {/* Trend + breakdown */}
          <div className="grid gap-gutter xl:grid-cols-2">
            <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <h3 className="font-display text-lg font-black text-[#00334f]">Collections vs Expenses</h3>
              <p className="text-xs font-semibold text-[#64748b]">{s.series.length}-point trend</p>
              {!s.series.length ? <p className="mt-6 text-sm text-[#64748b]">No dated activity in this period.</p> : (
                <div className="mt-5 flex items-end gap-2" style={{ height: 180 }}>
                  {s.series.map((p, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 150 }}>
                        <div className="w-1/2 rounded-t bg-[#10b981]" style={{ height: `${(p.collected / seriesMax) * 100}%` }} title={`Collected ${formatTZS(p.collected)}`} />
                        <div className="w-1/2 rounded-t bg-[#e11d48]" style={{ height: `${(p.expenses / seriesMax) * 100}%` }} title={`Expenses ${formatTZS(p.expenses)}`} />
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
            </div>

            <div className="rounded-lg border border-[#d5dde6] bg-white p-5">
              <h3 className="font-display text-lg font-black text-[#00334f]">Expenditure by Category</h3>
              <p className="text-xs font-semibold text-[#64748b]">Where the money went</p>
              {!s.expenses.byCategory.length ? <p className="mt-6 text-sm text-[#64748b]">No expenses recorded.</p> : (
                <div className="mt-5 space-y-3">
                  {s.expenses.byCategory.map((c, i) => (
                    <div key={c.category}>
                      <div className="mb-1 flex items-center justify-between text-xs font-black">
                        <span className="uppercase tracking-wide text-[#64748b]">{c.category.replaceAll('_', ' ')}</span>
                        <span className="font-mono tabular-nums text-[#00334f]">{formatTZS(c.amount)}</span>
                      </div>
                      <div className="h-4 overflow-hidden rounded bg-[#e2e8f0]">
                        <div className={`h-full rounded ${BAR_TONES[i % BAR_TONES.length]}`} style={{ width: `${(c.amount / catMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Collections by method */}
          {s.collections.byMethod.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
              <div className="border-b border-[#d5dde6] bg-[#f7f9fb] px-5 py-3"><h3 className="font-display text-base font-black text-[#00334f]">Collections by Method</h3></div>
              <table className="w-full text-left text-sm">
                <thead className="bg-[#eef5f8]"><tr>{['Method', 'Transactions', 'Amount'].map((c) => <th key={c} className="px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{c}</th>)}</tr></thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {s.collections.byMethod.map((m) => (
                    <tr key={m.method} className="even:bg-[#f7f9fb]">
                      <td className="px-5 py-2.5 font-bold text-[#0f172a]">{m.method.replaceAll('_', ' ')}</td>
                      <td className="px-5 py-2.5 text-[#475569]">{m.count}</td>
                      <td className="px-5 py-2.5 font-mono font-black tabular-nums text-[#0f172a]">{formatTZS(m.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'navy' | 'green' | 'red' | 'gold' | 'slate' }) {
  const rail = tone === 'green' ? 'border-l-[#10b981]' : tone === 'red' ? 'border-l-[#e11d48]' : tone === 'gold' ? 'border-l-[#d59a1b]' : tone === 'slate' ? 'border-l-[#64748b]' : 'border-l-[#00334f]';
  return (
    <div className={`rounded-lg border border-[#d5dde6] border-l-4 bg-white p-5 ${rail}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className="mt-1.5 font-mono text-[26px] font-black leading-none tabular-nums text-[#0f172a]">{value}</p>
      <p className="mt-1.5 text-[11px] font-bold text-[#64748b]">{detail}</p>
    </div>
  );
}
