import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Shared resolver ──────────────────────────────────────────────────────────
function resolveName(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object') return String(v);
  const o = v as Record<string, unknown>;
  const joined = [o.firstName, o.middleName, o.lastName].filter(Boolean).join(' ').trim();
  return String(o.name ?? o.fullName ?? o.label ?? (joined || o.title || ''));
}

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
          arrayFromApi(payloadOf(r), ['items', 'alerts', 'performanceAlerts']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const snapshot = (a.triggeredBySnapshot ?? {}) as Record<string, unknown>;
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolveName(a.student ?? a.studentName) || 'Student',
              studentId: String(a.studentId ?? ''),
              subject: String(a.subjectName ?? resolveName(a.subject) ?? ''),
              className: resolveName(a.class ?? snapshot.class) || '—',
              pairingStatus: String(a.pairingStatus ?? a.pairing_status ?? a.alertStatus ?? ''),
              severity: String(a.severity ?? a.alertLevel ?? a.level ?? 'MEDIUM').toUpperCase(),
              score: Number(a.currentScore ?? a.score ?? snapshot.score ?? 0),
              message: String(a.message ?? a.reason ?? ''),
              type: String(a.alertType ?? a.type ?? ''),
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

// The heatmap endpoint returns { heatmap: { academic: { subjectRankings: [...] } } }.
// Map each subject ranking into a heat cell the UI can render.
export function useAqaHeatmap() {
  return useQuery({
    queryKey: aqaKeys.heatmap(),
    queryFn: () =>
      api
        .get('/aqa/analytics/heatmap')
        .then((r) => {
          const payload = payloadOf(r) as Record<string, unknown>;
          const heatmap = (payload.heatmap ?? payload) as Record<string, unknown>;
          const academic = (heatmap.academic ?? {}) as Record<string, unknown>;
          const rankings = arrayFromApi(academic.subjectRankings ?? heatmap.subjectRankings, ['subjectRankings']);
          return rankings.map((raw) => {
            const c = raw as Record<string, unknown>;
            const average = Math.round(Number(c.average ?? c.score ?? 0));
            return {
              id: String(c.subjectId ?? c.id ?? crypto.randomUUID()),
              subject: String(c.subjectName ?? resolveName(c.subject) ?? ''),
              className: `Rank #${c.rank ?? '—'}`,
              average,
              passRate: Math.round(Number(c.passRate ?? 0)),
              highestScore: Number(c.highestScore ?? 0),
              lowestScore: Number(c.lowestScore ?? 0),
              alerts: average < 50 ? 3 : average < 65 ? 1 : 0,
              classId: String(c.subjectId ?? ''),
            };
          });
        }),
  });
}

export function useAqaPairings() {
  return useQuery({
    queryKey: aqaKeys.pairings(),
    queryFn: () =>
      api
        .get('/academics/performance/pairings')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'pairings']).map((raw) => {
            const p = raw as Record<string, unknown>;
            return {
              ...p,
              id: String(p.id ?? crypto.randomUUID()),
              mentor: resolveName(p.peer ?? p.mentor ?? p.mentorName) || 'Mentor',
              teacher: resolveName(p.teacher ?? p.teacherName) || '',
              student: resolveName(p.student ?? p.studentName) || 'Student',
              support: resolveName(p.student ?? p.studentName) || 'Student',
              subject: String(p.subjectName ?? resolveName(p.subject) ?? ''),
              className: resolveName(p.class) || '—',
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              status: String(p.status ?? p.pairingStatus ?? 'SUGGESTED').toUpperCase(),
              mentorScore: p.peerScoreAtPairing == null ? null : Number(p.peerScoreAtPairing),
              supportScore: p.studentScoreAtPairing == null ? null : Number(p.studentScoreAtPairing),
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
          arrayFromApi(payloadOf(r), ['items', 'interventions']).map((raw) => {
            const i = raw as Record<string, unknown>;
            return {
              ...i,
              id: String(i.id ?? crypto.randomUUID()),
              student: resolveName(i.student ?? i.studentName) || 'Student',
              subject: String(i.subjectName ?? resolveName(i.subject) ?? ''),
              note: String(i.note ?? i.notes ?? i.description ?? i.details ?? ''),
              week: String(i.week ?? i.weekLabel ?? i.createdAt ?? i.created_at ?? ''),
              roleOwner: resolveName(i.roleOwner ?? i.owner ?? i.assignedTo ?? i.teacher) || 'Staff',
              status: String(i.status ?? i.interventionStatus ?? 'OPEN').toUpperCase(),
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
        .then((r) => arrayFromApi(payloadOf(r), ['items', 'students', 'atRiskStudents']).map((raw) => {
          const s = raw as Record<string, unknown>;
          return {
            ...s,
            id: String(s.id ?? s.studentId ?? crypto.randomUUID()),
            student: resolveName(s.student ?? s) || resolveName({ firstName: s.firstName, lastName: s.lastName }) || 'Student',
            registration: String(s.registrationNumber ?? s.registration ?? ''),
            subject: String(s.subjectName ?? resolveName(s.subject) ?? ''),
            average: Number(s.average ?? s.currentScore ?? s.score ?? 0),
            riskLevel: String(s.riskLevel ?? s.severity ?? s.risk ?? ''),
          };
        })),
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
