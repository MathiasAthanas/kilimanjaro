import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

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
    queryFn: () => api.get('/aqa/dashboard').then(payloadOf),
  });
}

export function useAqaAlerts() {
  return useQuery({
    queryKey: aqaKeys.alerts(),
    queryFn: () =>
      api
        .get('/academics/performance/alerts')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['alerts', 'performanceAlerts']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolve(a.student ?? a.studentName),
              subject: resolve(a.subject ?? a.subjectName),
              className: resolve(a.className ?? a.class ?? a.class_name),
              pairingStatus: String(a.pairingStatus ?? a.pairing_status ?? a.alertStatus ?? ''),
              severity: String(a.severity ?? a.alertLevel ?? a.level ?? ''),
              score: Number(a.score ?? a.currentScore ?? a.averageScore ?? 0),
              type: String(a.type ?? a.alertType ?? ''),
            };
          }),
        ),
  });
}

export function useAqaAlertsByClass(classId: string) {
  return useQuery({
    queryKey: aqaKeys.alertsByClass(classId),
    queryFn: () =>
      api
        .get(`/academics/performance/alerts/class/${classId}`)
        .then((r) => arrayFromApi(payloadOf(r), ['alerts'])),
    enabled: Boolean(classId),
  });
}

export function useAqaHeatmap() {
  return useQuery({
    queryKey: aqaKeys.heatmap(),
    queryFn: () =>
      api
        .get('/aqa/analytics/heatmap')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['heatmap', 'data']).map((raw) => {
            const c = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...c,
              id: String(c.id ?? crypto.randomUUID()),
              subject: resolve(c.subject ?? c.subjectName),
              className: resolve(c.className ?? c.class ?? c.class_name),
              average: Number(c.average ?? c.score ?? c.averageScore ?? 0),
              classId: String(c.classId ?? c.class_id ?? c.id ?? ''),
            };
          }),
        ),
  });
}

export function useAqaPairings() {
  return useQuery({
    queryKey: aqaKeys.pairings(),
    queryFn: () =>
      api
        .get('/academics/performance/pairings')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['pairings']).map((raw) => {
            const p = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...p,
              id: String(p.id ?? crypto.randomUUID()),
              mentor: resolve(p.mentor ?? p.mentorName),
              teacher: resolve(p.teacher ?? p.teacherName),
              student: resolve(p.student ?? p.studentName),
              subject: resolve(p.subject ?? p.subjectName),
              className: resolve(p.className ?? p.class ?? p.class_name),
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              outcome: String(p.outcome ?? p.pairingOutcome ?? p.result ?? p.status ?? ''),
            };
          }),
        ),
  });
}

export function useAqaInterventions() {
  return useQuery({
    queryKey: aqaKeys.interventions(),
    queryFn: () =>
      api
        .get('/academics/interventions')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['interventions']).map((raw) => {
            const i = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...i,
              id: String(i.id ?? crypto.randomUUID()),
              student: resolve(i.student ?? i.studentName),
              note: String(i.note ?? i.notes ?? i.description ?? ''),
              week: String(i.week ?? i.weekLabel ?? i.createdAt ?? i.created_at ?? ''),
              roleOwner: resolve(i.roleOwner ?? i.owner ?? i.assignedTo ?? i.teacher),
              status: String(i.status ?? i.interventionStatus ?? 'OPEN'),
            };
          }),
        ),
  });
}

export function useAqaReports() {
  return useQuery({
    queryKey: aqaKeys.reports(),
    queryFn: () =>
      api
        .get('/analytics/reports')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['reports']).map((raw) => {
            const rep = raw as Record<string, unknown>;
            return {
              ...rep,
              id: String(rep.id ?? crypto.randomUUID()),
              title: String(rep.title ?? rep.name ?? rep.reportName ?? ''),
              status: String(rep.status ?? rep.reportStatus ?? 'PENDING'),
              type: String(rep.type ?? rep.reportType ?? rep.category ?? ''),
              generatedAt: String(rep.generatedAt ?? rep.generated_at ?? rep.createdAt ?? rep.created_at ?? ''),
            };
          }),
        ),
  });
}

export function useEngineConfig() {
  return useQuery({
    queryKey: aqaKeys.engineConfig(),
    queryFn: () => api.get('/academics/performance/engine/config').then(payloadOf),
  });
}

export function useEngineRuns() {
  return useQuery({
    queryKey: aqaKeys.engineRuns(),
    queryFn: () =>
      api
        .get('/aqa/performance/engine/runs')
        .then((r) => arrayFromApi(payloadOf(r), ['runs', 'engineRuns'])),
  });
}

export function useAqaStudentProfile(studentId: string) {
  return useQuery({
    queryKey: aqaKeys.studentProfile(studentId),
    queryFn: () => api.get(`/analytics/students/${studentId}`).then(payloadOf),
    enabled: Boolean(studentId),
  });
}

export function useAtRiskStudents() {
  return useQuery({
    queryKey: aqaKeys.atRiskStudents(),
    queryFn: () =>
      api
        .get('/analytics/students/at-risk')
        .then((r) => arrayFromApi(payloadOf(r), ['students', 'atRiskStudents'])),
  });
}

export function useAqaSchoolSummary() {
  return useQuery({
    queryKey: aqaKeys.schoolSummary(),
    queryFn: () => api.get('/academics/performance/school/summary').then(payloadOf),
  });
}

export function useAqaAudit() {
  return useQuery({
    queryKey: aqaKeys.audit(),
    queryFn: () =>
      api.get('/aqa/audit').then((r) => arrayFromApi(payloadOf(r), ['logs', 'auditLogs'])),
  });
}

export function useAqaAnnouncements() {
  return useQuery({
    queryKey: aqaKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((r) => arrayFromApi(payloadOf(r), ['announcements'])),
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

export function useCreateAqaAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/notifications/announcements', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: aqaKeys.announcements() }),
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
