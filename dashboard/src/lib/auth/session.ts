import type { UserRole } from './permissions';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  department?: string;
  status?: string;
  mustChangePassword?: boolean;
  requiresPasswordChange?: boolean;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  user: SessionUser;
};

const key = 'ks.web.session.v2';
const legacyKeys = ['ks.web.session'];

export function getStoredSession(): AuthSession | null {
  for (const legacyKey of legacyKeys) {
    localStorage.removeItem(legacyKey);
    sessionStorage.removeItem(legacyKey);
  }

  const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function storeSession(session: AuthSession, remember: boolean) {
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(key, JSON.stringify(session));
  if (remember) sessionStorage.removeItem(key);
}

export function clearSession() {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}
