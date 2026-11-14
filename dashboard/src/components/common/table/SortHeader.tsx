import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortDir } from './useTableControls';

export type SortHeaderProps = {
  label: string;
  /** The backend/accessor key this column sorts by. */
  column: string;
  activeSortBy?: string;
  sortDir: SortDir;
  onSort: (column: string) => void;
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Tighter cell padding for dense tables. */
  compact?: boolean;
  /** 'dark' sits on a dark header (white text); 'light' sits on a pale header (navy text). */
  tone?: 'dark' | 'light';
};

/**
 * A sortable `<th>` for use inside an existing table head. Shows a neutral
 * up/down glyph until active, then the current direction. Drop it in place of a
 * plain `<th>`; non-sortable columns can stay plain `<th>`.
 */
export function SortHeader({
  label,
  column,
  activeSortBy,
  sortDir,
  onSort,
  className = '',
  align = 'left',
  compact = false,
  tone = 'dark',
}: SortHeaderProps) {
  const active = activeSortBy === column;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={`${compact ? 'px-4 py-3' : 'px-5 py-4'} ${className}`} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1.5 ${justify} ${tone === 'light' ? 'text-[10px] text-[#00334f] hover:text-[#0284c7]' : 'text-[11px] hover:text-white/80'} font-black uppercase tracking-widest transition`}
      >
        <span>{label}</span>
        {active ? (
          sortDir === 'asc'
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40 transition group-hover:opacity-70" />
        )}
      </button>
    </th>
  );
}
