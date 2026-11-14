export type DataPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional page-size control. */
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  unit?: string;
  /** 'navy' matches the finance, manager and principal screens; 'indigo' the admin console. */
  variant?: 'indigo' | 'navy';
};

const BTN =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Canonical table pagination footer: "showing X–Y of total", prev/next, a compact
 * window of page numbers, and an optional page-size selector. Shared across every
 * feature so paging looks and behaves identically everywhere.
 */
export function DataPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  unit = 'results',
  variant = 'indigo',
}: DataPaginationProps) {
  const active = variant === 'navy' ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#4338CA] bg-[#4338CA] text-white';
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
      <p className="text-xs font-semibold text-slate-500">
        Showing <span className="font-black text-slate-700">{from}–{to}</span> of{' '}
        <span className="font-black text-slate-700">{total}</span> {unit}
      </p>
      <div className="flex items-center gap-1.5">
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="mr-1 h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-600 outline-none transition hover:border-slate-300"
            aria-label="Rows per page"
          >
            {(pageSizeOptions.includes(pageSize) ? pageSizeOptions : [...pageSizeOptions, pageSize].sort((a, b) => a - b)).map((size) => (
              <option key={size} value={size}>{size} / page</option>
            ))}
          </select>
        )}
        <button className={`${BTN} border-slate-200 bg-white text-slate-600 hover:border-slate-300`} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>Prev</button>
        {start > 1 && <span className="px-1 text-xs font-black text-slate-400">…</span>}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`${BTN} ${p === page ? active : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
          >
            {p}
          </button>
        ))}
        {end < pageCount && <span className="px-1 text-xs font-black text-slate-400">…</span>}
        <button className={`${BTN} border-slate-200 bg-white text-slate-600 hover:border-slate-300`} onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>Next</button>
      </div>
    </div>
  );
}
