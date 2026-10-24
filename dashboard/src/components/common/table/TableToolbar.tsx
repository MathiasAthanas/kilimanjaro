import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';

export type TableToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  /** Filter controls rendered on the right (selects, chips, buttons…). */
  children?: ReactNode;
  /** Optional result count shown under/next to the search. */
  total?: number;
  /** Label for the counted unit, e.g. "students". */
  unit?: string;
  /** Hide the search box (filter-only toolbar). */
  searchable?: boolean;
};

/**
 * Standard toolbar above a data table: debounced search box (bind `search` to a
 * controls hook), an optional filter slot, and an optional result count.
 */
export function TableToolbar({
  search,
  onSearch,
  placeholder = 'Search…',
  children,
  total,
  unit = 'results',
  searchable = true,
}: TableToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-1 flex-wrap items-center gap-3">
        {searchable && (
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-semibold outline-none transition hover:border-slate-300 focus:border-[#4338CA] focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearch('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {typeof total === 'number' && (
          <span className="text-xs font-bold text-slate-500">
            {total} {unit}
          </span>
        )}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
