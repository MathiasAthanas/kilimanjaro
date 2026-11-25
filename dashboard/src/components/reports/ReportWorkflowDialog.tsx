import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Eye, Filter, X } from 'lucide-react';
import { Button } from '../common/Button';
import { EXECUTIVE_COLORS, ExecutiveTooltip } from '../charts/ExecutiveCharts';

export type ReportPreviewRow = Record<string, string | number | boolean | null | undefined>;

export type ReportFilterField = {
  key: string;
  label: string;
  type?: 'select' | 'date' | 'search';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
};

type ReportWorkflowProps = {
  title: string;
  description?: string;
  format?: string;
  rows?: ReportPreviewRow[];
  loadRows?: (filters: Record<string, string>) => Promise<ReportPreviewRow[]>;
  fields?: ReportFilterField[];
  onDownload: (filters: Record<string, string>) => Promise<void> | void;
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
};

function filterRows(rows: ReportPreviewRow[], filters: Record<string, string>) {
  return rows.filter((row) => Object.entries(filters).every(([key, raw]) => {
    const value = raw.trim();
    if (!value) return true;
    if (key === 'search') {
      return Object.values(row).some((cell) => String(cell ?? '').toLowerCase().includes(value.toLowerCase()));
    }
    if (key === 'fromDate') {
      const date = String(row.date ?? row.createdAt ?? row.updatedAt ?? '').slice(0, 10);
      return !date || date >= value;
    }
    if (key === 'toDate') {
      const date = String(row.date ?? row.createdAt ?? row.updatedAt ?? '').slice(0, 10);
      return !date || date <= value;
    }
    return String(row[key] ?? '').toLowerCase() === value.toLowerCase();
  }));
}

function DialogFrame({ children, onClose, labelledBy }: { children: ReactNode; onClose: () => void; labelledBy: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () => [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])];
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    };
    window.addEventListener('keydown', keydown);
    return () => { window.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div ref={dialogRef}>{children}</div>
    </div>
  );
}

export function ReportWorkflow({
  title,
  description,
  format = 'PDF',
  rows = [],
  loadRows,
  fields = [],
  onDownload,
  disabled = false,
  busy = false,
  compact = false,
}: ReportWorkflowProps) {
  const [stage, setStage] = useState<'closed' | 'request' | 'preview'>('closed');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [loadedRows, setLoadedRows] = useState<ReportPreviewRow[] | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const sourceRows = loadedRows ?? rows;
  const scopedRows = useMemo(() => filterRows(sourceRows, filters), [sourceRows, filters]);
  const columns = useMemo(() => {
    const keys: string[] = [];
    scopedRows.slice(0, 25).forEach((row) => Object.keys(row).forEach((key) => {
      if (!keys.includes(key) && key !== 'id') keys.push(key);
    }));
    return keys.slice(0, 7);
  }, [scopedRows]);
  const numericColumn = columns.find((key) => scopedRows.some((row) => typeof row[key] === 'number'));
  const labelColumn = columns.find((key) => scopedRows.some((row) => typeof row[key] === 'string'));
  const chartData = numericColumn
    ? scopedRows.slice(0, 10).map((row, index) => ({
        name: String(row[labelColumn ?? ''] ?? index + 1).slice(0, 18),
        value: Number(row[numericColumn] ?? 0),
      }))
    : [];
  const pages = Math.max(1, Math.ceil(scopedRows.length / pageSize));
  const pageRows = scopedRows.slice((page - 1) * pageSize, page * pageSize);
  const requiredMissing = fields.some((field) => field.required && !filters[field.key]);
  const selector = 'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15';

  const open = () => {
    setFilters({});
    setLoadedRows(null);
    setLoadError('');
    setPage(1);
    setStage('request');
  };

  return (
    <>
      <div className={`flex gap-2 ${compact ? '' : 'mt-4'}`}>
        <Button type="button" variant="secondary" className="flex-1 rounded-xl" disabled={disabled || busy} onClick={open}>
          <Eye className="h-4 w-4" /> View
        </Button>
        <Button type="button" className="flex-1 rounded-xl" disabled={disabled || busy} onClick={open}>
          <Download className="h-4 w-4" /> {busy ? 'Preparing…' : `Download ${format}`}
        </Button>
      </div>

      {stage === 'request' && (
        <DialogFrame onClose={() => setStage('closed')} labelledBy="report-filter-title">
          <form
            className="mx-auto my-6 max-w-2xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7"
            onSubmit={async (event) => {
              event.preventDefault();
              if (requiredMissing) return;
              setLoadError('');
              if (loadRows) {
                setLoadingRows(true);
                try { setLoadedRows(await loadRows(filters)); }
                catch { setLoadError('The report data could not be loaded. Check your connection and try again.'); return; }
                finally { setLoadingRows(false); }
              }
              setPage(1);
              setStage('preview');
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600"><Filter className="h-3.5 w-3.5" /> Report request</p>
                <h2 id="report-filter-title" className="mt-1 font-display text-2xl font-black text-slate-900">{title}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">Choose the report scope before opening its preview.</p>
              </div>
              <button type="button" aria-label="Close report request" onClick={() => setStage('closed')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            {description && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">{description}</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className={`text-xs font-black uppercase tracking-wide text-slate-500 ${field.type === 'search' ? 'sm:col-span-2' : ''}`}>
                  {field.label}{field.required ? ' *' : ''}
                  {field.type === 'select' ? (
                    <select required={field.required} className={selector} value={filters[field.key] ?? ''} onChange={(event) => setFilters((current) => ({ ...current, [field.key]: event.target.value }))}>
                      <option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>
                      {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : (
                    <input required={field.required} type={field.type === 'date' ? 'date' : 'search'} className={selector} value={filters[field.key] ?? ''} placeholder={field.placeholder} onChange={(event) => setFilters((current) => ({ ...current, [field.key]: event.target.value }))} />
                  )}
                </label>
              ))}
            </div>
            {loadError && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{loadError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setStage('closed')}>Cancel</Button>
              <Button type="submit" className="rounded-xl" disabled={requiredMissing || loadingRows}><Eye className="h-4 w-4" /> {loadingRows ? 'Loading preview…' : 'View report'}</Button>
            </div>
          </form>
        </DialogFrame>
      )}

      {stage === 'preview' && (
        <DialogFrame onClose={() => setStage('closed')} labelledBy="report-preview-title">
          <div className="mx-auto my-2 max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-7">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Filtered live preview</p>
                <h2 id="report-preview-title" className="font-display text-2xl font-black text-slate-900">{title}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{scopedRows.length.toLocaleString('en-US')} rows · {format} download</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setStage('request')}>Filters</Button>
                <Button type="button" className="rounded-xl" disabled={busy} onClick={() => void onDownload(filters)}><Download className="h-4 w-4" /> {busy ? 'Preparing…' : 'Download / Export'}</Button>
                <button type="button" aria-label="Close report preview" onClick={() => setStage('closed')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
            </header>

            <div className="grid gap-4 bg-slate-50 p-5 sm:grid-cols-3 sm:p-7">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">Rows</p><p className="mt-1 text-2xl font-black text-slate-900">{scopedRows.length.toLocaleString('en-US')}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">Columns</p><p className="mt-1 text-2xl font-black text-slate-900">{columns.length}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase text-slate-400">Format</p><p className="mt-1 text-2xl font-black text-slate-900">{format}</p></div>
            </div>

            {chartData.length > 0 && (
              <div className="border-t border-slate-200 px-5 py-5 sm:px-7">
                <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{numericColumn} overview</p>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 9, fill: '#94A3B8' }} />
                      <Tooltip content={<ExecutiveTooltip />} />
                      <Bar dataKey="value" name={numericColumn} fill={EXECUTIVE_COLORS.indigo} radius={[6, 6, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="overflow-x-auto border-t border-slate-200">
              {pageRows.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm font-semibold text-slate-500">No rows match the selected filters.</div>
              ) : (
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-4 py-3">{column.replaceAll('_', ' ')}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">{pageRows.map((row, index) => <tr key={String(row.id ?? `${page}-${index}`)}>{columns.map((column) => <td key={column} className="max-w-[260px] truncate px-4 py-3 font-semibold text-slate-700">{String(row[column] ?? '—')}</td>)}</tr>)}</tbody>
                </table>
              )}
            </div>
            <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-xs font-bold text-slate-500 sm:px-7">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2"><Button type="button" variant="secondary" className="rounded-lg py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button type="button" variant="secondary" className="rounded-lg py-1.5 text-xs" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
            </footer>
          </div>
        </DialogFrame>
      )}
    </>
  );
}
