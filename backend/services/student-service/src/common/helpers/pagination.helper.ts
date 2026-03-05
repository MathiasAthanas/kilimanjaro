export function paginate(page = 1, limit = 20): { skip: number; take: number; page: number; limit: number } {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
    page: safePage,
    limit: safeLimit,
  };
}

export function buildPageMeta(page: number, limit: number, total: number): {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
} {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}