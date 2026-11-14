/**
 * Turns the `sortBy` / `sortDir` a screen sends into a Prisma orderBy, but only for columns we list.
 * Anything else (a typo, or an attempt to sort by a private field) falls back to the default order.
 */
export function resolveSort(
  sortBy: unknown,
  sortDir: unknown,
  allowlist: Record<string, (dir: 'asc' | 'desc') => Record<string, unknown>>,
  fallback: Array<Record<string, unknown>>,
  tieBreaker: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const key = typeof sortBy === 'string' ? sortBy : '';
  const build = Object.prototype.hasOwnProperty.call(allowlist, key) ? allowlist[key] : undefined;
  if (!build) return fallback;
  const dir: 'asc' | 'desc' = String(sortDir ?? '').toLowerCase() === 'desc' ? 'desc' : 'asc';
  return [build(dir), tieBreaker];
}
