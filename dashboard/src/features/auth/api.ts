import { api } from '../../lib/api/client';
import { endpoints } from '../../lib/api/endpoints';
import { normalizeApiError } from '../../lib/api/errors';
import type { AuthSession, SessionUser } from '../../lib/auth/session';
import type { UserRole } from '../../lib/auth/permissions';

const roleByEmail: Record<string, { role: UserRole; name: string; department?: string }> = {
  // ── Live demo credentials (shown on login page) ─────────────────────────────
  'admin@demo.kilimanjaro.test': { role: 'ADMIN', name: 'System Administrator', department: 'System Administration' },
  'principal@demo.kilimanjaro.test': { role: 'PRINCIPAL', name: 'Dr. Miriam Kileo', department: 'Executive Office' },
  'aqa@demo.kilimanjaro.test': { role: 'AQA', name: 'Quality Assurance', department: 'Academic Quality Assurance' },
  'finance@demo.kilimanjaro.test': { role: 'FINANCE', name: 'Bursar Mtei', department: 'Finance Office' },
  't-english@demo.kilimanjaro.test': { role: 'TEACHER', name: 'Mary Mallya', department: 'Languages' },
  'hod-science@demo.kilimanjaro.test': { role: 'HOD', name: 'HOD Science Msuya', department: 'Science Department' },
  // ── Legacy dev/test shortcuts ─────────────────────────────────────────────
  'admin@ks.ac.tz': { role: 'ADMIN', name: 'System Administrator', department: 'System Administration' },
  'finance.office@ks.ac.tz': { role: 'FINANCE', name: 'Bursar Mtei', department: 'Finance Office' },
  'rose.mhina@ks.ac.tz': { role: 'TEACHER', name: 'Rose Mhina', department: 'Science Department' },
  'james.kileo@ks.ac.tz': { role: 'HOD', name: 'James Kileo', department: 'Science Department' },
  'principal@ks.ac.tz': { role: 'PRINCIPAL', name: 'Dr. Miriam Kileo', department: 'Executive Office' },
  'qa.office@ks.ac.tz': { role: 'AQA', name: 'Quality Assurance', department: 'Academic Quality Assurance' },
};

/** Returns a local demo session without hitting the backend. */
function demoSession(email: string): AuthSession {
  const mapped = roleByEmail[email.toLowerCase().trim()];
  if (!mapped) throw new Error('Email not recognised as a demo account.');
  const role = mapped.role;
  return {
    accessToken: `demo-access-${role.toLowerCase()}`,
    refreshToken: `demo-refresh-${role.toLowerCase()}`,
    user: { id: `demo-${role.toLowerCase()}`, email: email.toLowerCase(), name: mapped.name, role, department: mapped.department },
  };
}

const roleAliases: Record<string, UserRole> = {
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
  TEACHER: 'TEACHER',
  HOD: 'HOD',
  HEAD_OF_DEPARTMENT: 'HOD',
  AQA: 'AQA',
  ACADEMIC_QA: 'AQA',
  FINANCE: 'FINANCE',
  FINANCE_OFFICER: 'FINANCE',
  PRINCIPAL: 'PRINCIPAL',
  ADMIN: 'ADMIN',
  SYSTEM_ADMIN: 'ADMIN',
};

export function normalizeRole(value: unknown): UserRole {
  const role = roleAliases[String(value ?? '').trim().toUpperCase()];
  if (!role) throw new Error(`Unsupported role returned by server: ${String(value ?? 'empty')}`);
  return role;
}

function normalizeApiUser(raw: any, loginIdentifier: string): SessionUser {
  const role = normalizeRole(raw?.role);
  const email = raw?.email ?? (loginIdentifier.includes('@') ? loginIdentifier.toLowerCase() : '');
  const fullName = [raw?.firstName, raw?.lastName].filter(Boolean).join(' ').trim();
  const name = raw?.name ?? (fullName || roleByEmail[email]?.name || role);

  return {
    id: String(raw?.id ?? raw?.sub ?? `api-${role.toLowerCase()}`),
    email,
    name,
    role,
    phone: raw?.phone ?? raw?.phoneNumber,
    department: raw?.department ?? roleByEmail[email]?.department,
    status: raw?.status ?? (raw?.isActive === false ? 'INACTIVE' : 'ACTIVE'),
  };
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const identifier = username.trim();

  // ── DEV shortcut: bypass network entirely with demo accounts ───────────────
  if (import.meta.env.DEV && password === 'demo1234' && roleByEmail[identifier.toLowerCase()]) {
    return demoSession(identifier);
  }

  try {
    const credentials = identifier.includes('@')
      ? { email: identifier.toLowerCase(), password }
      : { registrationNumber: identifier, password };
    const response = await api.post(endpoints.auth.login, credentials);
    const payload = response.data?.data ?? response.data;
    const accessToken = payload.accessToken ?? payload.access_token;
    const refreshToken = payload.refreshToken ?? payload.refresh_token;
    const rawUser = payload.user;

    if (accessToken && rawUser) {
      const user = normalizeApiUser(rawUser, identifier);
      return { accessToken, refreshToken, user };
    }

    throw new Error('Login response was missing token or user data.');
  } catch (error) {
    const normalized = normalizeApiError(error);
    // Network unreachable / backend down — fall back to demo session in DEV
    if (import.meta.env.DEV && (normalized.status === 0 || normalized.status === 404 || normalized.status >= 500)) {
      try { return demoSession(identifier); } catch { /* not a demo account */ }
    }
    throw normalized;
  }
}

export async function getMe(): Promise<SessionUser> {
  const response = await api.get(endpoints.auth.me);
  const payload = response.data?.data ?? response.data;
  return normalizeApiUser(payload.user ?? payload, payload.email ?? '');
}

export async function requestPasswordReset(email: string) {
  try {
    await api.post(endpoints.auth.resetRequest, { email });
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status !== 0 && normalized.status !== 404) throw normalized;
  }
}

export async function completePasswordReset(payload: { email: string; token: string; password: string }) {
  try {
    await api.post(endpoints.auth.resetComplete, payload);
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status !== 0 && normalized.status !== 404) throw normalized;
  }
}

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  try {
    await api.patch(endpoints.auth.changePassword, payload);
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status !== 0 && normalized.status !== 404) throw normalized;
  }
}
