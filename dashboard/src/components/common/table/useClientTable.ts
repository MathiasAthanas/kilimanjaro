import { useEffect, useMemo, useRef, useState } from 'react';
import type { SortDir } from './useTableControls';

export type ClientTableOptions<T> = {
  /** Fields (or a custom fn) used by the search box. */
  searchAccessors?: Array<(row: T) => unknown>;
  /** Column -> value accessor, for sortable headers. */
  sortAccessors?: Record<string, (row: T) => unknown>;
  initialSortBy?: string;
  initialSortDir?: SortDir;
  pageSize?: number;
  searchDelay?: number;
};

export type ClientTable<T> = {
  /** The rows to render (filtered + sorted + paginated). */
  rows: T[];
  /** Total after filtering (drives pagination + count). */
  total: number;
  search: string;
  setSearch: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  sortBy?: string;
  sortDir: SortDir;
  toggleSort: (column: string) => void;
};

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Headless search / sort / pagination for a CLIENT-side list already held in memory
 * (small, static reference lists). For large or scoped datasets use
 * `useTableControls` + a server-side query instead.
 */
export function useClientTable<T>(data: T[], options: ClientTableOptions<T> = {}): ClientTable<T> {
  const {
    searchAccessors = [],
    sortAccessors = {},
    initialSortBy,
    initialSortDir = 'asc',
    pageSize = 10,
    searchDelay = 250,
  } = options;

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim().toLowerCase()), searchDelay);
    return () => clearTimeout(id);
  }, [search, searchDelay]);

  const filtered = useMemo(() => {
    if (!debounced || searchAccessors.length === 0) return data;
    return data.filter((row) =>
      searchAccessors.some((accessor) => String(accessor(row) ?? '').toLowerCase().includes(debounced)),
    );
  }, [data, debounced, searchAccessors]);

  const sorted = useMemo(() => {
    const accessor = sortBy ? sortAccessors[sortBy] : undefined;
    if (!accessor) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const result = compare(accessor(a), accessor(b));
      return sortDir === 'asc' ? result : -result;
    });
    return copy;
  }, [filtered, sortBy, sortDir, sortAccessors]);

  // Keep the page in range when the result set shrinks.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [debounced, sortBy, sortDir]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  return { rows, total, search, setSearch, page: safePage, setPage, pageSize, sortBy, sortDir, toggleSort };
}
