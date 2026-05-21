import axios from 'axios';

export type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
  correlationId?: string;
};

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiError> | undefined;
    return {
      status: error.response?.status ?? 0,
      code: data?.code ?? error.code,
      message: data?.message ?? error.message ?? 'Request failed',
      details: data?.details ?? data,
      correlationId: error.response?.headers?.['x-correlation-id'] as string | undefined,
    };
  }

  if (error instanceof Error) {
    return { status: 0, message: error.message };
  }

  return { status: 0, message: 'Unknown API error', details: error };
}
