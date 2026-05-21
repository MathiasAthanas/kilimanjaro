import axios from 'axios';
import { useAuthStore } from '../auth/authStore';
import { endpoints } from './endpoints';
import { normalizeApiError } from './errors';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  config.headers.set('x-correlation-id', crypto.randomUUID());
  if (session?.accessToken) {
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const session = useAuthStore.getState().session;

    if (error.response?.status === 401 && session?.refreshToken && !original?._retry) {
      original._retry = true;
      try {
        const response = await axios.post(`${api.defaults.baseURL}${endpoints.auth.refresh}`, {
          refreshToken: session.refreshToken,
        });
        useAuthStore.getState().setSession({ ...session, accessToken: response.data.accessToken }, true);
        original.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        return Promise.reject(normalizeApiError(refreshError));
      }
    }

    return Promise.reject(normalizeApiError(error));
  },
);
