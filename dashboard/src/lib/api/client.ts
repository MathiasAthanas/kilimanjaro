import axios from 'axios';
import { useAuthStore } from '../auth/authStore';
import { useSchoolStore } from '../school/schoolStore';
import { endpoints } from './endpoints';
import { normalizeApiError } from './errors';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// A refresh token is rotated by the auth service. When a dashboard route starts
// several protected queries at once, they must share one refresh request rather
// than racing to use the same token and falsely logging the user out.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(refreshToken: string, sessionAccessToken: string): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${api.defaults.baseURL}${endpoints.auth.refresh}`, { refreshToken })
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        if (!payload?.accessToken) throw new Error('Refresh response did not include an access token.');
        const current = useAuthStore.getState().session;
        // Do not overwrite a newer login/session that happened while this request ran.
        if (current?.accessToken === sessionAccessToken) {
          useAuthStore.getState().setSession({
            ...current,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken ?? current.refreshToken,
          }, true);
        }
        return String(payload.accessToken);
      })
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  config.headers.set('x-correlation-id', crypto.randomUUID());
  if (session?.accessToken) {
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  // Multi-school: scope every call to the selected school (gateway validates)
  const activeSchool = useSchoolStore.getState().activeSchool;
  if (activeSchool?.id) {
    config.headers.set('X-Active-School', activeSchool.id);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as (typeof error.config & { _retry?: boolean });
    const session = useAuthStore.getState().session;

    if (error.response?.status === 401 && session?.refreshToken && !original?._retry) {
      original._retry = true;
      try {
        const current = useAuthStore.getState().session;
        // Another request may already have refreshed the token before this
        // interceptor runs. Retry with that newer token without refreshing again.
        const accessToken = current?.accessToken && current.accessToken !== session.accessToken
          ? current.accessToken
          : await refreshAccessToken(session.refreshToken, session.accessToken);
        original.headers.set('Authorization', `Bearer ${accessToken}`);
        return api(original);
      } catch (refreshError) {
        // Only clear the session if it is still the session that failed. A
        // concurrent successful refresh or fresh login must remain intact.
        if (useAuthStore.getState().session?.accessToken === session.accessToken) {
          useAuthStore.getState().logout();
        }
        return Promise.reject(normalizeApiError(refreshError));
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);
