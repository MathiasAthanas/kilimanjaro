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

function apiMessage(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').join('. ');
  }
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const data = asRecord(error.response?.data);
    const nestedError = asRecord(data?.error);
    const message = apiMessage(data?.message)
      || apiMessage(nestedError?.message)
      || apiMessage(error.message)
      || 'Request failed';
    return {
      status: error.response?.status ?? 0,
      code: typeof data?.code === 'string' ? data.code : error.code,
      message,
      details: data?.details ?? data,
      correlationId: error.response?.headers?.['x-correlation-id'] as string | undefined,
      response: { status: error.response?.status ?? 0, data: { message, details: data?.details ?? data } },
    };
  }

  // The Axios interceptor already normalizes failures. Callers may normalize
  // again, so preserve that useful status/message instead of replacing it with
  // the unhelpful "Unknown API error" fallback.
  const record = asRecord(error);
  if (record) {
    const response = asRecord(record.response);
    const responseData = asRecord(response?.data);
    const nestedError = asRecord(record.error) ?? asRecord(responseData?.error);
    const status = Number(record.status ?? response?.status ?? record.statusCode ?? 0);
    const message = apiMessage(record.message)
      || apiMessage(responseData?.message)
      || apiMessage(nestedError?.message);
    if (message || status) {
      const safeMessage = message || 'Request failed';
      return {
        status: Number.isFinite(status) ? status : 0,
        code: typeof record.code === 'string' ? record.code : undefined,
        message: safeMessage,
        details: record.details ?? responseData?.details ?? record,
        correlationId: typeof record.correlationId === 'string' ? record.correlationId : undefined,
        response: {
          status: Number.isFinite(status) ? status : 0,
          data: { message: safeMessage, details: record.details ?? responseData?.details ?? record },
        },
      };
    }
  }

  if (error instanceof Error) {
    return { status: 0, message: error.message };
  }

  return { status: 0, message: 'Unknown API error', details: error };
}

export function loginErrorMessage(error: unknown): string {
  const normalized = normalizeApiError(error);
  const serverMessage = normalized.message;

  if (normalized.status === 0) {
    return /timeout/i.test(serverMessage)
      ? 'The sign-in service took too long to respond. Check your connection and try again.'
      : 'Unable to reach the sign-in service. Check your internet connection and try again.';
  }
  if (normalized.status === 400) {
    return serverMessage && !/^(Bad Request|Request failed)$/i.test(serverMessage)
      ? serverMessage
      : 'Check the username and password fields, then try again.';
  }
  if (normalized.status === 401) {
    if (/students must login with registration number/i.test(serverMessage)) {
      return 'Students must sign in using their registration number, not an email address.';
    }
    if (/only students can login with registration number/i.test(serverMessage)) {
      return 'Staff and parents must sign in using their email address.';
    }
    return 'The username or password is incorrect. Check your details and try again.';
  }
  if (normalized.status === 403) {
    return /deactiv/i.test(serverMessage)
      ? 'This account is inactive. Contact your school administrator for assistance.'
      : 'This account is not allowed to sign in. Contact your school administrator.';
  }
  if (normalized.status === 423) {
    return 'This account is temporarily locked after repeated failed attempts. Try again later or contact your school administrator.';
  }
  if (normalized.status === 429) {
    return 'Sign-in is temporarily busy. Wait a moment and try again.';
  }
  if ([502, 503, 504].includes(normalized.status)) {
    return 'The sign-in service is temporarily unavailable. Please try again shortly.';
  }
  if (normalized.status >= 500) {
    return 'The sign-in service encountered a problem. Please try again or contact support if it continues.';
  }
  return serverMessage && !/^Unknown API error$/i.test(serverMessage)
    ? serverMessage
    : 'Unable to sign in. Please try again.';
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
