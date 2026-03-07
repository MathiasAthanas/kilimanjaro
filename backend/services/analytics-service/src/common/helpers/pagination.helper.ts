export function paginate(pageRaw?: string, limitRaw?: string) {
  const page = Math.max(1, Number(pageRaw || 1));
  const limit = Math.min(100, Math.max(1, Number(limitRaw || 20)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
