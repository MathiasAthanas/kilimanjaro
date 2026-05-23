import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';

// ─── Query key factory ────────────────────────────────────────────────────────

export const aqaKeys = {
  all: ['aqa'] as const,
  dashboard: () => [...aqaKeys.all, 'dashboard'] as const,
  alerts: () => [...aqaKeys.all, 'alerts'] as const,
  alertsByClass: (classId: string) => [...aqaKeys.alerts(), 'class', classId] as const,
  heatmap: () => [...aqaKeys.all, 'heatmap'] as const,
  pairings: () => [...aqaKeys.all, 'pairings'] as const,
  interventions: () => [...aqaKeys.all, 'interventions'] as const,
  reports: () => [...aqaKeys.all, 'reports'] as const,
  engineConfig: () => [...aqaKeys.all, 'engine', 'config'] as const,
  engineRuns: () => [...aqaKeys.all, 'engine', 'runs'] as const,
  studentProfile: (studentId: string) => [...aqaKeys.all, 'students', studentId] as const,
  atRiskStudents: () => [...aqaKeys.all, 'students', 'at-risk'] as const,
  schoolSummary: () => [...aqaKeys.all, 'school', 'summary'] as const,
  audit: () => [...aqaKeys.all, 'audit'] as const,
  announcements: () => [...aqaKeys.all, 'announcements'] as const,
};

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useAqaDashboard() {
  return useQuery({
    queryKey: aqaKeys.dashboard(),
    queryFn: () =>
      api.get('/aqa/dashboard').then((res) => res.data?.data ?? res.data),
  });
}

export function useAqaAlerts() {
  return useQuery({
    queryKey: aqaKeys.alerts(),
    queryFn: () =>
      api
        .get('/academics/performance/alerts')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaAlertsByClass(classId: string) {
  return useQuery({
    queryKey: aqaKeys.alertsByClass(classId),
    queryFn: () =>
      api
        .get(`/academics/performance/alerts/class/${classId}`)
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
    enabled: Boolean(classId),
  });
}

export function useAqaHeatmap() {
  return useQuery({
    queryKey: aqaKeys.heatmap(),
    queryFn: () =>
      api
        .get('/aqa/analytics/heatmap')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaPairings() {
  return useQuery({
    queryKey: aqaKeys.pairings(),
    queryFn: () =>
      api
        .get('/academics/performance/pairings')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaInterventions() {
  return useQuery({
    queryKey: aqaKeys.interventions(),
    queryFn: () =>
      api
        .get('/academics/interventions')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaReports() {
  return useQuery({
    queryKey: aqaKeys.reports(),
    queryFn: () =>
      api
        .get('/analytics/reports')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useEngineConfig() {
  return useQuery({
    queryKey: aqaKeys.engineConfig(),
    queryFn: () =>
      api
        .get('/academics/performance/engine/config')
        .then((res) => res.data?.data ?? res.data),
  });
}

export function useEngineRuns() {
  return useQuery({
    queryKey: aqaKeys.engineRuns(),
    queryFn: () =>
      api
        .get('/aqa/performance/engine/runs')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaStudentProfile(studentId: string) {
  return useQuery({
    queryKey: aqaKeys.studentProfile(studentId),
    queryFn: () =>
      api
        .get(`/analytics/students/${studentId}`)
        .then((res) => res.data?.data ?? res.data),
    enabled: Boolean(studentId),
  });
}

export function useAtRiskStudents() {
  return useQuery({
    queryKey: aqaKeys.atRiskStudents(),
    queryFn: () =>
      api
        .get('/analytics/students/at-risk')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaSchoolSummary() {
  return useQuery({
    queryKey: aqaKeys.schoolSummary(),
    queryFn: () =>
      api
        .get('/academics/performance/school/summary')
        .then((res) => res.data?.data ?? res.data),
  });
}

export function useAqaAudit() {
  return useQuery({
    queryKey: aqaKeys.audit(),
    queryFn: () =>
      api
        .get('/aqa/audit')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAqaAnnouncements() {
  return useQuery({
    queryKey: aqaKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useUpdateEngineConfigMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch('/academics/performance/engine/config', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.engineConfig() }),
  });
}

export function useRunEngineMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: Record<string, unknown>) =>
      api.post('/academics/performance/engine/run', body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.engineRuns() }),
  });
}

export function useResolveAqaAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/alerts/${id}/resolve`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.alerts() }),
  });
}

export function useEscalateAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/alerts/${id}/escalate`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.alerts() }),
  });
}

export function useActivateAqaPairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/pairings/${id}/activate`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.pairings() }),
  });
}

export function useRejectAqaPairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/pairings/${id}/reject`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.pairings() }),
  });
}

export function useCreateAqaInterventionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/academics/interventions', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.interventions() }),
  });
}

export function useGenerateAqaReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/analytics/reports/generate', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.reports() }),
  });
}
