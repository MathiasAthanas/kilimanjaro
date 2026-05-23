import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

export const principalKeys = {
  all: ['principal'] as const,
  dashboard: () => [...principalKeys.all, 'dashboard'] as const,
  staff: () => [...principalKeys.all, 'staff'] as const,
  studentProfile: (id: string) => [...principalKeys.all, 'students', id] as const,
  students: () => [...principalKeys.all, 'students'] as const,
  settings: () => [...principalKeys.all, 'settings'] as const,
  audit: () => [...principalKeys.all, 'audit'] as const,
  pendingApprovals: () => [...principalKeys.all, 'approvals', 'pending'] as const,
  marksReview: (id: string) => [...principalKeys.all, 'approvals', id, 'marks'] as const,
  publishReadiness: () => [...principalKeys.all, 'publish', 'readiness'] as const,
  classTermResults: (cId: string, tId: string) => [...principalKeys.all, 'results', cId, tId] as const,
  pendingPayments: () => [...principalKeys.all, 'payments', 'pending'] as const,
  discipline: () => [...principalKeys.all, 'discipline'] as const,
  announcements: () => [...principalKeys.all, 'announcements'] as const,
  schoolHealth: () => [...principalKeys.all, 'school', 'health'] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function usePrincipalDashboard() {
  return useQuery({
    queryKey: principalKeys.dashboard(),
    queryFn: () => api.get('/principal/dashboard').then(payloadOf),
  });
}

export function usePrincipalStaff() {
  return useQuery({
    queryKey: principalKeys.staff(),
    queryFn: () =>
      api.get('/principal/staff').then((r) => arrayFromApi(payloadOf(r), ['staff', 'teachers'])),
    staleTime: 60_000,
  });
}

export function usePrincipalStudentProfile(studentId: string | undefined) {
  return useQuery({
    queryKey: principalKeys.studentProfile(studentId ?? ''),
    queryFn: () => api.get(`/principal/students/${studentId}/profile`).then(payloadOf),
    enabled: !!studentId,
  });
}

export function usePrincipalStudents() {
  return useQuery({
    queryKey: principalKeys.students(),
    queryFn: () =>
      api.get('/analytics/students').then((r) => arrayFromApi(payloadOf(r), ['students'])),
    staleTime: 30_000,
  });
}

export function usePrincipalSchoolSettings() {
  return useQuery({
    queryKey: principalKeys.settings(),
    queryFn: () => api.get('/principal/settings/school').then(payloadOf),
    staleTime: 60_000,
  });
}

export function usePrincipalAudit() {
  return useQuery({
    queryKey: principalKeys.audit(),
    queryFn: () =>
      api.get('/principal/audit').then((r) => arrayFromApi(payloadOf(r), ['logs', 'auditLogs'])),
    staleTime: 30_000,
  });
}

export function usePendingMarkApprovals() {
  return useQuery({
    queryKey: principalKeys.pendingApprovals(),
    queryFn: () =>
      api
        .get('/academics/assessments/pending-approval')
        .then((r) => arrayFromApi(payloadOf(r), ['assessments', 'approvals'])),
  });
}

export function useMarksForApproval(assessmentId: string | undefined) {
  return useQuery({
    queryKey: principalKeys.marksReview(assessmentId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/assessments/${assessmentId}/marks/review`)
        .then((r) => arrayFromApi(payloadOf(r), ['marks', 'students'])),
    enabled: !!assessmentId,
  });
}

export function usePublishReadiness() {
  return useQuery({
    queryKey: principalKeys.publishReadiness(),
    queryFn: () => api.get('/reports/results-publishing/readiness').then(payloadOf),
    staleTime: 15_000,
  });
}

export function useClassTermResults(classId: string | undefined, termId: string | undefined) {
  return useQuery({
    queryKey: principalKeys.classTermResults(classId ?? '', termId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/results/class/${classId}/term/${termId}`)
        .then((r) => arrayFromApi(payloadOf(r), ['results', 'students'])),
    enabled: !!classId && !!termId,
  });
}

export function usePrincipalPendingPayments() {
  return useQuery({
    queryKey: principalKeys.pendingPayments(),
    queryFn: () =>
      api
        .get('/finance/payments/pending-approval')
        .then((r) => arrayFromApi(payloadOf(r), ['payments', 'approvals'])),
  });
}

export function usePrincipalDiscipline() {
  return useQuery({
    queryKey: principalKeys.discipline(),
    queryFn: () =>
      api
        .get('/students/discipline')
        .then((r) => arrayFromApi(payloadOf(r), ['discipline', 'records'])),
    staleTime: 30_000,
  });
}

export function usePrincipalAnnouncements() {
  return useQuery({
    queryKey: principalKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((r) => arrayFromApi(payloadOf(r), ['announcements'])),
    staleTime: 60_000,
  });
}

export function usePrincipalSchoolHealth() {
  return useQuery({
    queryKey: principalKeys.schoolHealth(),
    queryFn: () => api.get('/analytics/overview').then(payloadOf),
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useApprovePrincipalAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.patch(`/academics/assessments/${id}/approve`, { comment }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingApprovals() }),
  });
}

export function useRejectPrincipalAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/academics/assessments/${id}/reject`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingApprovals() }),
  });
}

export function usePublishResultsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/results/publish', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.publishReadiness() }),
  });
}

export function useApprovePaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.patch(`/finance/payments/approvals/${id}/approve`, { notes }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingPayments() }),
  });
}

export function useRejectPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/finance/payments/approvals/${id}/reject`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingPayments() }),
  });
}

export function useResolveDisciplineMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      api.patch(`/students/discipline/${id}/resolve`, { resolution }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.discipline() }),
  });
}

export function useCreatePrincipalAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/notifications/announcements', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.announcements() }),
  });
}
