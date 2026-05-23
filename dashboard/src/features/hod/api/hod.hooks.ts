import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';

// ─── Query key factory ────────────────────────────────────────────────────────

export const hodKeys = {
  all: ['hod'] as const,
  dashboard: () => [...hodKeys.all, 'dashboard'] as const,
  pendingApprovals: () => [...hodKeys.all, 'approvals', 'pending'] as const,
  approvalHistory: () => [...hodKeys.all, 'approvals', 'history'] as const,
  marksReview: (assessmentId: string) => [...hodKeys.all, 'marks', 'review', assessmentId] as const,
  classSubjects: () => [...hodKeys.all, 'class-subjects'] as const,
  teachersList: () => [...hodKeys.all, 'teachers', 'performance'] as const,
  teacherDetail: (teacherId: string) => [...hodKeys.teachersList(), teacherId] as const,
  alerts: () => [...hodKeys.all, 'alerts'] as const,
  pairings: () => [...hodKeys.all, 'pairings'] as const,
  interventions: () => [...hodKeys.all, 'interventions'] as const,
  studentPerformance: (studentId: string) => [...hodKeys.all, 'students', studentId, 'performance'] as const,
  audit: () => [...hodKeys.all, 'audit'] as const,
  announcements: () => [...hodKeys.all, 'announcements'] as const,
};

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useHodDashboard() {
  return useQuery({
    queryKey: hodKeys.dashboard(),
    queryFn: () =>
      api.get('/hod/dashboard').then((res) => res.data?.data ?? res.data),
  });
}

export function useHodPendingApprovals() {
  return useQuery({
    queryKey: hodKeys.pendingApprovals(),
    queryFn: () =>
      api
        .get('/academics/assessments/pending-approval')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodApprovalHistory() {
  return useQuery({
    queryKey: hodKeys.approvalHistory(),
    queryFn: () =>
      api
        .get('/hod/approvals/history')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useMarksApprovalReview(assessmentId: string) {
  return useQuery({
    queryKey: hodKeys.marksReview(assessmentId),
    queryFn: () =>
      api
        .get(`/academics/assessments/${assessmentId}/marks/review`)
        .then((res) => res.data?.data ?? res.data),
    enabled: Boolean(assessmentId),
  });
}

export function useHodClassSubjects() {
  return useQuery({
    queryKey: hodKeys.classSubjects(),
    queryFn: () =>
      api
        .get('/academics/class-subjects')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodTeachersList() {
  return useQuery({
    queryKey: hodKeys.teachersList(),
    queryFn: () =>
      api
        .get('/hod/teachers/performance')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodTeacherDetail(teacherId: string) {
  return useQuery({
    queryKey: hodKeys.teacherDetail(teacherId),
    queryFn: () =>
      api
        .get(`/hod/teachers/${teacherId}/performance`)
        .then((res) => res.data?.data ?? res.data),
    enabled: Boolean(teacherId),
  });
}

export function useHodAlerts() {
  return useQuery({
    queryKey: hodKeys.alerts(),
    queryFn: () =>
      api
        .get('/academics/performance/alerts')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodPairings() {
  return useQuery({
    queryKey: hodKeys.pairings(),
    queryFn: () =>
      api
        .get('/academics/performance/pairings')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodInterventions() {
  return useQuery({
    queryKey: hodKeys.interventions(),
    queryFn: () =>
      api
        .get('/academics/interventions')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodStudentPerformance(studentId: string) {
  return useQuery({
    queryKey: hodKeys.studentPerformance(studentId),
    queryFn: () =>
      api
        .get(`/academics/performance/student/${studentId}`)
        .then((res) => res.data?.data ?? res.data),
    enabled: Boolean(studentId),
  });
}

export function useHodAudit() {
  return useQuery({
    queryKey: hodKeys.audit(),
    queryFn: () =>
      api
        .get('/hod/audit')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useHodAnnouncements() {
  return useQuery({
    queryKey: hodKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useApproveAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/assessments/${id}/approve`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pendingApprovals() }),
  });
}

export function useRejectAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/assessments/${id}/reject`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pendingApprovals() }),
  });
}

export function useResolveHodAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/alerts/${id}/resolve`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.alerts() }),
  });
}

export function useActivateHodPairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/pairings/${id}/activate`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pairings() }),
  });
}

export function useCreateHodInterventionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/academics/interventions', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.interventions() }),
  });
}

export function useCreateHodAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/notifications/announcements', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.announcements() }),
  });
}
