import { api } from '../../lib/api/client';
import { endpoints } from '../../lib/api/endpoints';
import { normalizeApiError } from '../../lib/api/errors';
import type { AuthSession, SessionUser } from '../../lib/auth/session';
import type { UserRole } from '../../lib/auth/permissions';

const roleByEmail: Record<string, { role: UserRole; name: string; department?: string }> = {
  'rose.mhina@ks.ac.tz': { role: 'TEACHER', name: 'Mwalimu Rose Mhina', department: 'Mathematics' },
  'james.kileo@ks.ac.tz': { role: 'HOD', name: 'Dr. James Kileo', department: 'Science Department' },
  'qa.office@ks.ac.tz': { role: 'AQA', name: 'Ms. Fatuma Ally', department: 'Academic Quality Assurance' },
  'finance.office@ks.ac.tz': { role: 'FINANCE', name: 'Ms. Grace Temba', department: 'Finance Office' },
  'principal@ks.ac.tz': { role: 'PRINCIPAL', name: 'Mr. David Mwasimba', department: 'Executive Office' },
  'admin@ks.ac.tz': { role: 'ADMIN', name: 'System Admin', department: 'System Administration' },
};

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

function demoSession(username: string): AuthSession {
  const normalized = username.toLowerCase();
  const profile = roleByEmail[normalized];
  if (!profile) throw new Error('Demo login is not configured for this user.');

  const user: SessionUser = {
    id: `demo-${profile.role.toLowerCase()}`,
    email: normalized,
    name: profile.name,
    role: profile.role,
    department: profile.department,
    status: 'ACTIVE',
  };

  return {
    accessToken: `demo-access-${profile.role.toLowerCase()}`,
    refreshToken: `demo-refresh-${profile.role.toLowerCase()}`,
    user,
  };
}

export async function login(username: string, password: string): Promise<AuthSession> {
  if (import.meta.env.DEV && password === 'demo1234') {
    return demoSession(username);
  }

  try {
    const identifier = username.trim();
    const credentials = identifier.includes('@')
      ? { email: identifier.toLowerCase(), password }
      : { registrationNumber: identifier, password };
    const response = await api.post(endpoints.auth.login, credentials);
    const accessToken = response.data.accessToken ?? response.data.access_token;
    const refreshToken = response.data.refreshToken ?? response.data.refresh_token;
    const rawUser = response.data.user;

    if (accessToken && rawUser) {
      const user = normalizeApiUser(rawUser, username);
      return { accessToken, refreshToken, user };
    }

    return demoSession(username);
  } catch (error) {
    const normalized = normalizeApiError(error);
    if (normalized.status === 0 || normalized.status === 404 || normalized.status >= 500) {
      return demoSession(username);
    }
    throw normalized;
  }
}

export async function getMe(): Promise<SessionUser> {
  const response = await api.get(endpoints.auth.me);
  return response.data.user ?? response.data;
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
