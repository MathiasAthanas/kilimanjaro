import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { DataPagination } from './DataPagination';
import { useClientTable } from './useClientTable';
import type { SortDir } from './useTableControls';

export type TableSort = { by?: string; dir: SortDir; onSort: (column: string) => void };

export type PagedRows<T> = {
  /** Only the rows of the current page, already sorted. Render these. */
  rows: T[];
  total: number;
  /** Hand this to the table shell so its sortable headers work. */
  sort: TableSort;
  /** Page numbers and the 25 / 50 / 100 selector. Render it under the table. */
  pager: ReactNode;
};

/**
 * Adds sorting, paging and a remembered page size to a list that is already in memory, without changing how its rows
 * are drawn: map over `rows`, pass `sort` to the table shell, and put `pager` underneath.
 */
export function usePagedRows<T>(
  data: T[],
  options: { sortAccessors?: Record<string, (row: T) => unknown>; initialSortBy?: string; initialSortDir?: SortDir; storageKey: string; unit: string; pageSize?: number },
): PagedRows<T> {
  const sortAccessors = useMemo(() => options.sortAccessors ?? {}, [options.sortAccessors]);
  const table = useClientTable(data, { sortAccessors, initialSortBy: options.initialSortBy, initialSortDir: options.initialSortDir, pageSize: options.pageSize ?? 25, storageKey: options.storageKey });
  const pager = table.total > 0 ? (
    <div className="border-t border-[#e2e8f0] bg-white px-4 py-3">
      <DataPagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} unit={options.unit} variant="navy" />
    </div>
  ) : null;
  return { rows: table.rows, total: table.total, sort: { by: table.sortBy, dir: table.sortDir, onSort: table.toggleSort }, pager };
}
