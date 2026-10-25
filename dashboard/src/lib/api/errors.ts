import axios from 'axios';

export type ApiError = {
  status: number;
  code?: string;
  message: string;
  details?: unknown;
  correlationId?: string;
  /** Axios-style shape, so older call sites that read `error.response.data.message` keep getting the server's reason. */
  response?: { status: number; data: { message: string; details?: unknown } };
};

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as Partial<ApiError> | undefined;
    const message = data?.message ?? error.message ?? 'Request failed';
    return {
      status: error.response?.status ?? 0,
      code: data?.code ?? error.code,
      message,
      details: data?.details ?? data,
      correlationId: error.response?.headers?.['x-correlation-id'] as string | undefined,
      response: { status: error.response?.status ?? 0, data: { message: Array.isArray(message) ? message.join('. ') : message, details: data?.details ?? data } },
    };
  }

  if (error instanceof Error) {
    return { status: 0, message: error.message };
  }

  return { status: 0, message: 'Unknown API error', details: error };
}

/**
 * The sentence to show a person for a failed request. API failures arrive as plain `{ status, message }`
 * objects (see the response interceptor), not `Error`s, so both shapes are read; Nest sends a list of
 * messages for validation errors.
 */
export function errorMessage(error: unknown, fallback: string): string {
  const raw = (error as { message?: unknown } | null | undefined)?.message;
  const text = Array.isArray(raw) ? raw.filter((m) => typeof m === 'string').join('. ') : typeof raw === 'string' ? raw : '';
  // Transport-level noise is not helpful to a bursar
  if (!text || /^(Request failed|Network Error|timeout of)/i.test(text)) return fallback;
  return text;
}
