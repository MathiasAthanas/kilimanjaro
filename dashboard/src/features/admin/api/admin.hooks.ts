import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';

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
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data?.data ?? r.data),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () =>
      api.get('/auth/users').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.user(id ?? ''),
    queryFn: () => api.get(`/auth/users/${id}`).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });
}

export function useAdminStudents(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.students(params),
    queryFn: () =>
      api.get('/students', { params }).then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useAdminClasses() {
  return useQuery({
    queryKey: adminKeys.classes(),
    queryFn: () =>
      api.get('/students/classes').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useAdminSubjects() {
  return useQuery({
    queryKey: adminKeys.subjects(),
    queryFn: () =>
      api.get('/academics/subjects').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useSubjectCombinations() {
  return useQuery({
    queryKey: adminKeys.combinations(),
    queryFn: () =>
      api
        .get('/academics/subject-combinations')
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useClassPathways() {
  return useQuery({
    queryKey: adminKeys.pathways(),
    queryFn: () =>
      api.get('/students/class-pathways').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useGradingScales() {
  return useQuery({
    queryKey: adminKeys.gradingScales(),
    queryFn: () =>
      api.get('/academics/grading-scales').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useAssessmentTypes() {
  return useQuery({
    queryKey: adminKeys.assessmentTypes(),
    queryFn: () =>
      api.get('/academics/assessment-types').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useServiceHealth() {
  return useQuery({
    queryKey: adminKeys.serviceHealth(),
    queryFn: () =>
      api.get('/admin/system/health').then((r) => r.data?.data ?? r.data),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: adminKeys.notifTemplates(),
    queryFn: () =>
      api.get('/notifications/templates').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useNotificationTemplate(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.notifTemplate(id ?? ''),
    queryFn: () => api.get(`/notifications/templates/${id}`).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });
}

export function useNotificationLogs() {
  return useQuery({
    queryKey: adminKeys.notifLogs(),
    queryFn: () =>
      api.get('/notifications/logs').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 15_000,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: adminKeys.notifStats(),
    queryFn: () => api.get('/notifications/stats').then((r) => r.data?.data ?? r.data),
    staleTime: 15_000,
  });
}

export function useAdminAuditEvents() {
  return useQuery({
    queryKey: adminKeys.audit(),
    queryFn: () =>
      api.get('/admin/audit/system').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 15_000,
  });
}

export function useAdminReportJobs() {
  return useQuery({
    queryKey: adminKeys.reportJobs(),
    queryFn: () =>
      api.get('/reports/jobs').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 15_000,
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: adminKeys.systemSettings(),
    queryFn: () => api.get('/admin/system/settings').then((r) => r.data?.data ?? r.data),
    staleTime: 60_000,
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: adminKeys.featureFlags(),
    queryFn: () => api.get('/admin/system/feature-flags').then((r) => r.data?.data ?? r.data),
    staleTime: 60_000,
  });
}

export function useAcademicYears() {
  return useQuery({
    queryKey: adminKeys.academicYears(),
    queryFn: () =>
      api.get('/students/academic-years').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useTerms() {
  return useQuery({
    queryKey: adminKeys.terms(),
    queryFn: () =>
      api.get('/students/terms').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
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
