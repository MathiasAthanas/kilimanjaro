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
}: SortHeaderProps) {
  const active = activeSortBy === column;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={`px-5 py-4 ${className}`} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`group inline-flex items-center gap-1.5 ${justify} text-[11px] font-black uppercase tracking-widest transition hover:text-white/80`}
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
