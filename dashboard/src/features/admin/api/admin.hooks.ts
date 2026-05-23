import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import type { AdminStatus } from './adminApi';

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: AdminStatus;
  linked: string;
  lastLogin: string;
  createdAt: string;
};

type ApiResponse = { data?: unknown };

function payloadOf(response: ApiResponse) {
  const body = response.data as { data?: unknown } | undefined;
  return body?.data ?? response.data;
}

function arrayFrom(value: unknown, keys: string[] = []) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

function statusToState(status: unknown) {
  const normalized = String(status ?? '').toLowerCase();
  if (['ok', 'online', 'healthy', 'up'].includes(normalized)) return 'ONLINE';
  if (['degraded', 'warning'].includes(normalized)) return 'DEGRADED';
  if (['offline', 'down', 'error', 'failed'].includes(normalized)) return 'OFFLINE';
  return 'UNKNOWN';
}

function toServiceHealth(value: unknown) {
  const payload = value && typeof value === 'object' && 'services' in value
    ? (value as Record<string, unknown>).services
    : value;
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return Object.entries(payload as Record<string, Record<string, unknown>>).map(([key, item]) => ({
    service: String(item?.service ?? key).replace(/(^|-)([a-z])/g, (_, sep: string, letter: string) => `${sep ? ' ' : ''}${letter.toUpperCase()}`),
    state: statusToState(item?.status ?? item?.state),
    uptime: String(item?.uptime ?? item?.uptimePercent ?? 'Live'),
    latency: typeof item?.latency === 'number'
      ? `${item.latency}ms`
      : String(item?.latency ?? item?.latencyMs ?? '-'),
  }));
}

function toAdminUsers(value: unknown) {
  return arrayFrom(value, ['users']).map((raw) => {
    const user = raw as Record<string, unknown>;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const status = user.lockedUntil ? 'LOCKED' : user.isActive === false ? 'INACTIVE' : 'ACTIVE';
    return {
      ...user,
      id: String(user.id ?? user.authUserId ?? user.email ?? crypto.randomUUID()),
      email: String(user.email ?? ''),
      role: String(user.role ?? 'USER'),
      createdAt: String(user.createdAt ?? ''),
      name: String(user.name ?? fullName ?? user.email ?? 'Unknown User'),
      status: String(user.status ?? status) as AdminStatus,
      linked: String(user.linked ?? user.registrationNumber ?? user.phoneNumber ?? 'Portal account'),
      lastLogin: String(user.lastLogin ?? user.lastLoginAt ?? user.updatedAt ?? user.createdAt ?? ''),
    } satisfies AdminUserRow;
  });
}

function toAuditEvents(value: unknown) {
  const direct = arrayFrom(value, ['items', 'events']);
  if (direct.length) return direct;
  const payload = value as Record<string, unknown> | undefined;
  const streams = arrayFrom(payload, ['auditStreams']);
  const streamEvents = streams.flatMap((stream) => arrayFrom((stream as Record<string, unknown>).items));
  const financeEvents = arrayFrom(payload, ['financeAudit']);
  const notificationEvents = arrayFrom(payload, ['notificationLogs']);
  return [...streamEvents, ...financeEvents, ...notificationEvents].slice(0, 30).map((raw, index) => {
    const event = raw as Record<string, unknown>;
    return {
      id: String(event.id ?? `${event.action ?? event.eventType ?? 'audit'}-${index}`),
      time: String(event.createdAt ?? event.updatedAt ?? event.deliveredAt ?? new Date().toISOString()),
      actor: String(event.performedByRole ?? event.recipientRole ?? event.sourceService ?? 'System'),
      action: String(event.action ?? event.eventType ?? event.subject ?? 'System Event'),
      entity: String(event.entityType ?? event.channel ?? event.recipientEmail ?? 'System'),
      payload: event,
    };
  });
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: string) => [...adminKeys.users(), id] as const,
  students: (params?: Record<string, unknown>) => [...adminKeys.all, 'students', params ?? {}] as const,
  classes: () => [...adminKeys.all, 'classes'] as const,
  subjects: () => [...adminKeys.all, 'subjects'] as const,
  combinations: () => [...adminKeys.all, 'combinations'] as const,
  pathways: () => [...adminKeys.all, 'pathways'] as const,
  gradingScales: () => [...adminKeys.all, 'grading-scales'] as const,
  assessmentTypes: () => [...adminKeys.all, 'assessment-types'] as const,
  serviceHealth: () => [...adminKeys.all, 'service-health'] as const,
  notifTemplates: () => [...adminKeys.all, 'notif', 'templates'] as const,
  notifTemplate: (id: string) => [...adminKeys.notifTemplates(), id] as const,
  notifLogs: () => [...adminKeys.all, 'notif', 'logs'] as const,
  notifStats: () => [...adminKeys.all, 'notif', 'stats'] as const,
  audit: () => [...adminKeys.all, 'audit'] as const,
  reportJobs: () => [...adminKeys.all, 'report-jobs'] as const,
  systemSettings: () => [...adminKeys.all, 'system', 'settings'] as const,
  featureFlags: () => [...adminKeys.all, 'system', 'feature-flags'] as const,
  academicYears: () => [...adminKeys.all, 'academic-years'] as const,
  terms: () => [...adminKeys.all, 'terms'] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => api.get('/admin/dashboard').then(payloadOf),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => api.get('/auth/users').then((r) => toAdminUsers(payloadOf(r))),
    staleTime: 30_000,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.user(id ?? ''),
    queryFn: () => api.get(`/auth/users/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

export function useAdminStudents(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.students(params),
    queryFn: () => api.get('/students', { params }).then((r) => arrayFrom(payloadOf(r), ['students'])),
    staleTime: 30_000,
  });
}

export function useAdminClasses() {
  return useQuery({
    queryKey: adminKeys.classes(),
    queryFn: () => api.get('/students/classes').then((r) => arrayFrom(payloadOf(r), ['classes'])),
    staleTime: 30_000,
  });
}

export function useAdminSubjects() {
  return useQuery({
    queryKey: adminKeys.subjects(),
    queryFn: () => api.get('/academics/subjects').then((r) => arrayFrom(payloadOf(r), ['subjects'])),
    staleTime: 30_000,
  });
}

export function useSubjectCombinations() {
  return useQuery({
    queryKey: adminKeys.combinations(),
    queryFn: () =>
      api
        .get('/academics/subject-combinations')
        .then((r) => arrayFrom(payloadOf(r), ['combinations', 'subjectCombinations'])),
    staleTime: 30_000,
  });
}

export function useClassPathways() {
  return useQuery({
    queryKey: adminKeys.pathways(),
    queryFn: () => api.get('/students/class-pathways').then((r) => arrayFrom(payloadOf(r), ['pathways', 'classPathways'])),
    staleTime: 60_000,
  });
}

export function useGradingScales() {
  return useQuery({
    queryKey: adminKeys.gradingScales(),
    queryFn: () => api.get('/academics/grading-scales').then((r) => arrayFrom(payloadOf(r), ['gradingScales', 'scales'])),
    staleTime: 60_000,
  });
}

export function useAssessmentTypes() {
  return useQuery({
    queryKey: adminKeys.assessmentTypes(),
    queryFn: () => api.get('/academics/assessment-types').then((r) => arrayFrom(payloadOf(r), ['assessmentTypes', 'types'])),
    staleTime: 60_000,
  });
}

export function useServiceHealth() {
  return useQuery({
    queryKey: adminKeys.serviceHealth(),
    queryFn: () => api.get('/admin/system/health').then((r) => toServiceHealth(payloadOf(r))),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: adminKeys.notifTemplates(),
    queryFn: () => api.get('/notifications/templates').then((r) => arrayFrom(payloadOf(r), ['templates', 'notificationTemplates'])),
    staleTime: 60_000,
  });
}

export function useNotificationTemplate(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.notifTemplate(id ?? ''),
    queryFn: () => api.get(`/notifications/templates/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

export function useNotificationLogs() {
  return useQuery({
    queryKey: adminKeys.notifLogs(),
    queryFn: () => api.get('/notifications/logs').then((r) => arrayFrom(payloadOf(r), ['logs', 'notifications'])),
    staleTime: 15_000,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: adminKeys.notifStats(),
    queryFn: () => api.get('/notifications/stats').then(payloadOf),
    staleTime: 15_000,
  });
}

export function useAdminAuditEvents() {
  return useQuery({
    queryKey: adminKeys.audit(),
    queryFn: () => api.get('/admin/audit/system').then((r) => toAuditEvents(payloadOf(r))),
    staleTime: 15_000,
  });
}

export function useAdminReportJobs() {
  return useQuery({
    queryKey: adminKeys.reportJobs(),
    queryFn: () => api.get('/reports/jobs').then((r) => arrayFrom(payloadOf(r), ['jobs', 'reportJobs'])),
    staleTime: 15_000,
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: adminKeys.systemSettings(),
    queryFn: () => api.get('/admin/system/settings').then(payloadOf),
    staleTime: 60_000,
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: adminKeys.featureFlags(),
    queryFn: () => api.get('/admin/system/feature-flags').then(payloadOf),
    staleTime: 60_000,
  });
}

export function useAcademicYears() {
  return useQuery({
    queryKey: adminKeys.academicYears(),
    queryFn: () => api.get('/students/academic-years').then((r) => arrayFrom(payloadOf(r), ['academicYears', 'years'])),
    staleTime: 60_000,
  });
}

export function useTerms() {
  return useQuery({
    queryKey: adminKeys.terms(),
    queryFn: () => api.get('/students/terms').then((r) => arrayFrom(payloadOf(r), ['terms'])),
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useDeactivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/deactivate`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useActivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/activate`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useChangeUserRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/auth/users/${id}/role`, { role }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useUnlockUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/unlock`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useResetUserPwMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/reset-password`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useInviteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/auth/users/${id}/invite`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useActivateGradingScaleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/academics/grading-scales/${id}/activate`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.gradingScales() }),
  });
}

export function useUpdateNotificationTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/notifications/templates/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.notifTemplates() }),
  });
}

export function useCreateClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/classes', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.classes() }),
  });
}

export function useUpdateClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/students/classes/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.classes() }),
  });
}

export function useCreateSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/subjects', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects() }),
  });
}

export function useUpdateSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/academics/subjects/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects() }),
  });
}

export function useCreateCombinationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/subject-combinations', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.combinations() }),
  });
}

export function useUpdateCombinationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/academics/subject-combinations/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.combinations() }),
  });
}

export function useDeleteCombinationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/academics/subject-combinations/${id}`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.combinations() }),
  });
}

export function useCreateAcademicYearMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/academic-years', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.academicYears() }),
  });
}

export function useCreateTermMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/terms', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.terms() }),
  });
}

export function useBulkPromoteMutation() {
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/promotions/bulk', payload).then((r) => r.data?.data ?? r.data),
  });
}

export function useSendManualNotificationMutation() {
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/notifications/send-manual', payload).then((r) => r.data?.data ?? r.data),
  });
}
