import { ApiResponse, PaginationMeta } from '@kilimanjaro/types';

// ─── API Response Helpers ─────────────────────────────────────────────────────

export function successResponse<T>(
  message: string,
  data?: T,
  meta?: PaginationMeta,
): ApiResponse<T> {
  return { success: true, message, data, meta };
}

export function errorResponse(
  message: string,
  errors?: string[],
): ApiResponse {
  return { success: false, message, errors };
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export function getPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export function getPaginationSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

// ─── String Helpers ───────────────────────────────────────────────────────────

export function generateRegistrationNumber(
  year: number,
  sequence: number,
): string {
  return `KS${year}${String(sequence).padStart(4, '0')}`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .trim();
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export function getCurrentAcademicYear(): number {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
