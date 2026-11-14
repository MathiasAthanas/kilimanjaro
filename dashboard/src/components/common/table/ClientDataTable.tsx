import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { DataPagination } from './DataPagination';
import { SortHeader } from './SortHeader';
import { TableToolbar } from './TableToolbar';
import { useClientTable } from './useClientTable';
import type { SortDir } from './useTableControls';

export type DataColumn<T> = {
  key: string;
  label: string;
  /** Makes the header sortable. Return a number or string to order by. */
  sort?: (row: T) => unknown;
  render: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
};

export type ClientDataTableProps<T> = {
  rows: T[];
  columns: Array<DataColumn<T>>;
  rowKey: (row: T) => string;
  /** What each row is called in the count and footer, e.g. "students". */
  unit: string;
  /** Text the search box looks in. Leave out to hide the search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  initialSortBy?: string;
  initialSortDir?: SortDir;
  initialPageSize?: number;
  /** Remembers the page size the user picks, per table. */
  storageKey?: string;
  /** 'navy' = dark header (principal screens); 'light' = pale header (finance and manager screens). */
  theme?: 'navy' | 'light';
  minWidth?: number;
  /** Filters or buttons shown to the right of the search box. */
  toolbar?: ReactNode;
  empty?: ReactNode;
  rowClassName?: (row: T) => string;
};

/**
 * One table for every in-memory list: search, click-to-sort headers, and 25 / 50 / 100 rows per page (remembered).
 * Use it so Manager, Principal and Finance lists all look and behave the same way.
 */
export function ClientDataTable<T>({
  rows,
  columns,
  rowKey,
  unit,
  searchText,
  searchPlaceholder = 'Search…',
  initialSortBy,
  initialSortDir = 'asc',
  initialPageSize = 25,
  storageKey,
  theme = 'light',
  minWidth = 760,
  toolbar,
  empty,
  rowClassName,
}: ClientDataTableProps<T>) {
  const searchAccessors = useMemo(() => (searchText ? [searchText] : []), [searchText]);
  const sortAccessors = useMemo(() => Object.fromEntries(columns.filter((c) => c.sort).map((c) => [c.key, c.sort!])), [columns]);
  const table = useClientTable(rows, { searchAccessors, sortAccessors, initialSortBy, initialSortDir, pageSize: initialPageSize, storageKey });
  const dark = theme === 'navy';
  const sortProps = { activeSortBy: table.sortBy, sortDir: table.sortDir, onSort: table.toggleSort, compact: true, tone: dark ? ('dark' as const) : ('light' as const) };
  const alignClass = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className="space-y-3">
      {(searchText || toolbar) && (
        <TableToolbar search={table.search} onSearch={table.setSearch} placeholder={searchPlaceholder} total={table.total} unit={unit} searchable={Boolean(searchText)}>
          {toolbar}
        </TableToolbar>
      )}
      <div className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${dark ? 'border-ks-line' : 'border-[#d5dde6]'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" style={{ minWidth }}>
            <thead className={dark ? 'bg-ks-navy text-white' : 'bg-[#eef5f8]'}>
              <tr>
                {columns.map((c) =>
                  c.sort ? (
                    <SortHeader key={c.key} label={c.label} column={c.key} align={c.align} className={c.className} {...sortProps} />
                  ) : (
                    <th key={c.key} className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest ${dark ? 'text-white' : 'text-[#00334f]'} ${alignClass(c.align)} ${c.className ?? ''}`}>{c.label}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${dark ? 'divide-ks-line' : 'divide-[#e2e8f0]'}`}>
              {table.rows.map((row, i) => (
                <tr key={rowKey(row)} className={`transition even:bg-[#f7f9fb] hover:bg-[#eef5f8] ${rowClassName?.(row) ?? ''}`}>
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-middle font-semibold text-[#334155] ${alignClass(c.align)} ${c.className ?? ''}`}>{c.render(row, i)}</td>
                  ))}
                </tr>
              ))}
              {table.rows.length === 0 && (
                <tr><td colSpan={columns.length} className="px-4 py-10 text-center text-sm font-bold text-[#64748b]">{empty ?? (table.search ? 'Nothing matches that search.' : `No ${unit} to show.`)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {table.total > 0 && (
          <div className="border-t border-[#e2e8f0] bg-white px-4 py-3">
            <DataPagination page={table.page} pageSize={table.pageSize} total={table.total} onPageChange={table.setPage} onPageSizeChange={table.setPageSize} unit={unit} variant="navy" />
          </div>
        )}
      </div>
    </div>
  );
}
