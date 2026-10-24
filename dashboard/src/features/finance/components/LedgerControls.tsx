import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';

/** Returns `value` once it has stopped changing for `delay` ms, so typing does not fire a request per key. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function LedgerSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[260px] flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-[#d5dde6] bg-white pl-9 pr-4 text-sm font-semibold placeholder:text-[#94a3b8] outline-none focus:border-[#00334f] focus:ring-2 focus:ring-[#00334f]/10"
      />
    </div>
  );
}

export interface LedgerTab { key: string; label: string; count?: number }

export function LedgerTabs({ tabs, active, onChange }: { tabs: LedgerTab[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[#d5dde6]">
      {tabs.map(({ key, label, count }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`relative whitespace-nowrap px-4 py-2.5 text-sm font-black transition-colors ${active === key ? 'text-[#00334f]' : 'text-[#64748b] hover:text-[#0f172a]'}`}
        >
          {label}
          {count !== undefined && (
            <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-black ${active === key ? 'bg-[#00334f] text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>{count}</span>
          )}
          {active === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00334f]" />}
        </button>
      ))}
    </div>
  );
}

/** Pager for the server-paged ledgers (1-based pages). */
export function LedgerPager({ page, totalPages, total, limit, noun, onPage }: { page: number; totalPages: number; total: number; limit: number; noun: string; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const windowSize = Math.min(totalPages, 7);
  const first = totalPages <= 7 ? 1 : page <= 4 ? 1 : page >= totalPages - 3 ? totalPages - 6 : page - 3;
  const btn = 'flex h-8 w-8 items-center justify-center rounded border border-[#d5dde6] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:opacity-40';
  return (
    <div className="flex items-center justify-between pt-1">
      <span className="text-xs font-semibold text-[#64748b]">Showing {from}–{to} of {total} {noun}</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        {Array.from({ length: windowSize }, (_, i) => first + i).map((p) => (
          <button
            key={p}
            onClick={() => onPage(p)}
            className={`h-8 w-8 rounded border text-xs font-black transition ${page === p ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#d5dde6] text-[#64748b] hover:bg-[#f1f5f9]'}`}
          >
            {p}
          </button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={btn} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export const selectClass = 'h-10 rounded-lg border border-[#d5dde6] bg-white px-3 text-sm font-semibold text-[#0f172a] outline-none focus:border-[#00334f]';
