import { ApiResponse, PaginationMeta } from '@kilimanjaro/types';

export function successResponse<T>(
  message: string,
  data?: T,
  meta?: PaginationMeta,
): ApiResponse<T> {
  return { success: true, message, data, meta };
}

export function errorResponse(message: string): ApiResponse {
  return { success: false, message };
}

export function paginate(total: number, page: number, limit: number): PaginationMeta {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
