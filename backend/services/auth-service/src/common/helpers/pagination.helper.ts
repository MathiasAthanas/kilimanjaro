export interface PaginationResult {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export function getPagination(page = 1, limit = 20): PaginationResult {
  const normalizedPage = Number.isFinite(page) && page > 0 ? page : 1;
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
    take: normalizedLimit,
  };
}
