import { useEffect, useRef } from 'react';
import { getMe } from '../../features/auth/api';
import { useAuthStore } from './authStore';

/**
 * Called once inside AppShell. Validates the stored access token against the
 * server's /auth/me endpoint. If the server rejects the token AND refresh also
 * fails (handled by the Axios interceptor), `useAuthStore.logout()` is called
 * and the user is redirected to login.
 *
 * Demo tokens (value starts with "demo-") are skipped — they will never pass
 * server validation and are intentionally client-side only.
 */
export function useSessionValidation() {
  const session = useAuthStore((s) => s.session);
  const logout  = useAuthStore((s) => s.logout);
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const token = session?.accessToken ?? '';
    // Skip demo tokens — they are dev-only and won't validate against the server
    if (!token || token.startsWith('demo-')) return;

    getMe().catch(() => {
      // getMe failed even after the refresh-token interceptor had a chance to
      // recover — the session is genuinely expired or revoked.
      logout();
    });
  }, [session, logout]);
}
