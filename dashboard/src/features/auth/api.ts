import { api } from '../../lib/api/client';
import { endpoints } from '../../lib/api/endpoints';
import { normalizeApiError } from '../../lib/api/errors';
import type { AuthSession, SessionUser } from '../../lib/auth/session';
import type { UserRole } from '../../lib/auth/permissions';

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
  ADMISSIONS: 'ADMISSIONS',
  ADMISSIONS_OFFICER: 'ADMISSIONS',
  SUPER_ADMIN: 'SUPER_ADMIN',
  MANAGER: 'MANAGER',
  HEAD_OF_SCHOOL: 'HEAD_OF_SCHOOL',
  HEAD_OF_FINANCE: 'HEAD_OF_FINANCE',
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
  const name = raw?.name ?? (fullName || role);

  return {
    id: String(raw?.id ?? raw?.sub ?? `api-${role.toLowerCase()}`),
    email,
    name,
    role,
    phone: raw?.phone ?? raw?.phoneNumber,
    department: raw?.department,
    status: raw?.status ?? (raw?.isActive === false ? 'INACTIVE' : 'ACTIVE'),
    mustChangePassword: Boolean(raw?.mustChangePassword ?? raw?.requiresPasswordChange ?? false),
    requiresPasswordChange: Boolean(raw?.requiresPasswordChange ?? raw?.mustChangePassword ?? false),
    scope: raw?.scope === 'GROUP' ? 'GROUP' : raw?.scope === 'SCHOOL' ? 'SCHOOL' : undefined,
    schoolIds: Array.isArray(raw?.schoolIds) ? raw.schoolIds.map(String) : undefined,
  };
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const identifier = username.trim();

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
    throw normalizeApiError(error);
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
