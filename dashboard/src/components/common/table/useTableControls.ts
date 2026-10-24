import { useEffect, useMemo, useRef, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export type TableControlsOptions = {
  /** Initial page size. */
  initialLimit?: number;
  /** Initial sort column (maps to a backend `sortBy` value). */
  initialSortBy?: string;
  /** Initial sort direction. */
  initialSortDir?: SortDir;
  /** Initial non-search filters (e.g. `{ status: 'ACTIVE' }`). */
  initialFilters?: Record<string, string | undefined>;
  /** Debounce for the search box, ms. */
  searchDelay?: number;
};

export type TableControls = {
  /** Live input value (bind to the search box). */
  search: string;
  setSearch: (value: string) => void;
  /** Debounced value that actually drives the query. */
  debouncedSearch: string;

  page: number;
  setPage: (page: number) => void;
  limit: number;
  setLimit: (limit: number) => void;

  sortBy?: string;
  sortDir: SortDir;
  /** Click a column: toggles asc/desc, or switches column (defaults to asc). */
  toggleSort: (column: string) => void;

  filters: Record<string, string | undefined>;
  setFilter: (key: string, value: string | undefined) => void;
  resetFilters: () => void;

  /** Assembled query params for the API (omits empty values). */
  params: Record<string, string | number>;
};

/**
 * Headless state for a SERVER-side list: pagination, debounced search, sorting and
 * arbitrary filters. Returns `params` ready to pass to an API hook. Any change to
 * search / filters / sort resets to page 1 so the user never lands on an empty page.
 */
export function useTableControls(options: TableControlsOptions = {}): TableControls {
  const {
    initialLimit = 20,
    initialSortBy,
    initialSortDir = 'desc',
    initialFilters = {},
    searchDelay = 300,
  } = options;

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimitState] = useState(initialLimit);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortDir, setSortDir] = useState<SortDir>(initialSortDir);
  const [filters, setFilters] = useState<Record<string, string | undefined>>(initialFilters);

  // Debounce the search box.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), searchDelay);
    return () => clearTimeout(id);
  }, [search, searchDelay]);

  // Reset to page 1 whenever the result set changes shape.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, sortBy, sortDir, JSON.stringify(filters)]);

  const toggleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const setFilter = (key: string, value: string | undefined) =>
    setFilters((f) => ({ ...f, [key]: value || undefined }));

  const resetFilters = () => {
    setFilters(initialFilters);
    setSearch('');
  };

  const setLimit = (value: number) => {
    setLimitState(value);
    setPage(1);
  };

  const params = useMemo(() => {
    const out: Record<string, string | number> = { page, limit };
    if (debouncedSearch) out.search = debouncedSearch;
    if (sortBy) {
      out.sortBy = sortBy;
      out.sortDir = sortDir;
    }
    for (const [key, value] of Object.entries(filters)) {
      if (value) out[key] = value;
    }
    return out;
  }, [page, limit, debouncedSearch, sortBy, sortDir, filters]);

  return {
    search,
    setSearch,
    debouncedSearch,
    page,
    setPage,
    limit,
    setLimit,
    sortBy,
    sortDir,
    toggleSort,
    filters,
    setFilter,
    resetFilters,
    params,
  };
}
