export enum SortDir {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Safely resolve a client-supplied `sortBy`/`sortDir` into a Prisma `orderBy` via an
 * allow-list mapping each public column name to an `orderBy` fragment. Unknown or
 * absent columns fall back to `fallback`, so callers can never sort by an unindexed
 * or sensitive field (or inject arbitrary keys).
 */
export function resolveOrderBy<TOrderBy>(
  sortBy: string | undefined,
  sortDir: SortDir | undefined,
  allowed: Record<string, (dir: 'asc' | 'desc') => TOrderBy>,
  fallback: TOrderBy,
): TOrderBy {
  if (!sortBy || !(sortBy in allowed)) return fallback;
  const dir: 'asc' | 'desc' = sortDir === SortDir.ASC ? 'asc' : 'desc';
  return allowed[sortBy](dir);
}
