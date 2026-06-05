import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, dedupeById, payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

export const operationsKeys = {
  all: ['operations'] as const,
  reportCatalog: () => [...operationsKeys.all, 'reports', 'catalog'] as const,
  reportJobs: () => [...operationsKeys.all, 'reports', 'jobs'] as const,
  reportJob: (id: string) => [...operationsKeys.reportJobs(), id] as const,
  scheduledReports: () => [...operationsKeys.all, 'reports', 'scheduled'] as const,
  reportsAudit: () => [...operationsKeys.all, 'reports', 'audit'] as const,
  analyticsOverview: () => [...operationsKeys.all, 'analytics', 'overview'] as const,
  enrolment: () => [...operationsKeys.all, 'analytics', 'enrolment'] as const,
  academicOverview: () => [...operationsKeys.all, 'analytics', 'academic'] as const,
  financeOverview: () => [...operationsKeys.all, 'analytics', 'finance'] as const,
  attendanceOverview: () => [...operationsKeys.all, 'analytics', 'attendance'] as const,
  performanceEngine: () => [...operationsKeys.all, 'analytics', 'performance-engine'] as const,
  assessments: () => [...operationsKeys.all, 'assessments'] as const,
  marksSheet: (id: string) => [...operationsKeys.assessments(), id, 'marks'] as const,
  timetables: () => [...operationsKeys.all, 'timetables'] as const,
  classes: () => [...operationsKeys.all, 'classes'] as const,
  publishReadiness: () => [...operationsKeys.all, 'publish', 'readiness'] as const,
  classTermResults: (cId: string, tId: string) => [...operationsKeys.all, 'results', cId, tId] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useReportCatalog() {
  return useQuery({
    queryKey: operationsKeys.reportCatalog(),
    queryFn: () =>
      api.get('/reports/catalog').then((r) =>
        dedupeById(arrayFromApi(payloadOf(r), ['catalog', 'reportTypes']).map((raw) => {
          const c = raw as Record<string, unknown>;
          // roles may come as an array, a comma-separated string, or be missing
          const rawRoles = c.roles ?? c.allowedRoles ?? c.accessRoles ?? c.permissions;
          const roles: string[] = Array.isArray(rawRoles)
            ? (rawRoles as unknown[]).map(String)
            : typeof rawRoles === 'string' && rawRoles.length > 0
            ? rawRoles.split(',').map((s) => s.trim())
            : [];
          return {
            ...c,
            id: String(c.id ?? crypto.randomUUID()),
            title: String(c.title ?? c.name ?? c.reportName ?? ''),
            domain: String(c.domain ?? c.category ?? c.module ?? ''),
            roles,
            sensitive: Boolean(c.sensitive ?? c.isSensitive ?? false),
          };
        })),
      ),
    staleTime: 60_000,
  });
}

export function useReportJobs() {
  return useQuery({
    queryKey: operationsKeys.reportJobs(),
    queryFn: () =>
      api.get('/reports/jobs').then((r) =>
        dedupeById(arrayFromApi(payloadOf(r), ['jobs', 'reportJobs']).map((raw) => {
          const j = raw as Record<string, unknown>;
          return {
            ...j,
            id: String(j.id ?? crypto.randomUUID()),
            name: String(j.name ?? j.title ?? j.reportName ?? ''),
            status: String(j.status ?? j.jobStatus ?? ''),
            requestedBy: String(j.requestedBy ?? j.createdBy ?? j.requestedByName ?? ''),
            role: String(j.role ?? j.requestedByRole ?? ''),
            scope: String(j.scope ?? j.reportScope ?? ''),
            format: String(j.format ?? j.outputFormat ?? ''),
            created: String(j.created ?? j.createdAt ?? j.created_at ?? j.requestedAt ?? ''),
          };
        })),
      ),
    staleTime: 15_000,
  });
}

export function useReportJob(id: string | undefined) {
  return useQuery({
    queryKey: operationsKeys.reportJob(id ?? ''),
    queryFn: () => api.get(`/reports/jobs/${id}`).then(payloadOf),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useScheduledReports() {
  return useQuery({
    queryKey: operationsKeys.scheduledReports(),
    queryFn: () =>
      api.get('/reports/scheduled').then((r) => arrayFromApi(payloadOf(r), ['scheduled', 'scheduledReports'])),
    staleTime: 60_000,
  });
}

export function useReportsAudit() {
  return useQuery({
    queryKey: operationsKeys.reportsAudit(),
    queryFn: () =>
      api.get('/reports/audit').then((r) => arrayFromApi(payloadOf(r), ['logs', 'auditLogs'])),
    staleTime: 30_000,
  });
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: operationsKeys.analyticsOverview(),
    queryFn: () => api.get('/analytics/overview').then(payloadOf),
    staleTime: 30_000,
  });
}

export function useEnrolmentAnalytics() {
  return useQuery({
    queryKey: operationsKeys.enrolment(),
    queryFn: () => api.get('/analytics/enrolment').then(payloadOf),
    staleTime: 30_000,
  });
}

export function useAcademicOverview() {
  return useQuery({
    queryKey: operationsKeys.academicOverview(),
    queryFn: () => api.get('/analytics/academic/overview').then(payloadOf),
    staleTime: 30_000,
  });
}

export function useOperationsFinanceOverview() {
  return useQuery({
    queryKey: operationsKeys.financeOverview(),
    queryFn: () => api.get('/analytics/finance/overview').then(payloadOf),
    staleTime: 30_000,
  });
}

export function useAttendanceOverview() {
  return useQuery({
    queryKey: operationsKeys.attendanceOverview(),
    queryFn: () => api.get('/analytics/attendance/overview').then(payloadOf),
    staleTime: 30_000,
  });
}

export function usePerformanceEngineAnalytics() {
  return useQuery({
    queryKey: operationsKeys.performanceEngine(),
    queryFn: () => api.get('/analytics/academic/performance-engine').then(payloadOf),
    staleTime: 30_000,
  });
}

export function useAllAssessments() {
  return useQuery({
    queryKey: operationsKeys.assessments(),
    queryFn: () =>
      api.get('/academics/assessments').then((r) =>
        arrayFromApi(payloadOf(r), ['assessments']).map((raw) => {
          const a = raw as Record<string, unknown>;
          const resolve = (v: unknown): string => {
            if (!v || typeof v !== 'object') return String(v ?? '');
            const o = v as Record<string, unknown>;
            return String(o.name ?? o.fullName ?? o.label ?? '');
          };
          return {
            ...a,
            id: String(a.id ?? crypto.randomUUID()),
            title: String(a.title ?? a.name ?? ''),
            className: resolve(a.className ?? a.class ?? a.class_name),
            subject: resolve(a.subject ?? a.subjectName),
            teacher: resolve(a.teacher ?? a.teacherName ?? a.createdBy),
            type: String(a.type ?? a.assessmentType ?? ''),
            status: String(a.status ?? ''),
          };
        }),
      ),
    staleTime: 30_000,
  });
}

export function useAssessmentMarksSheet(assessmentId: string | undefined) {
  return useQuery({
    queryKey: operationsKeys.marksSheet(assessmentId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/assessments/${assessmentId}/marks/sheet`)
        .then((r) =>
          arrayFromApi(payloadOf(r), ['marks', 'students']).map((raw) => {
            const m = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...m,
              id: String(m.id ?? crypto.randomUUID()),
              student: resolve(m.student ?? m.studentName ?? m.name),
              score: Number(m.score ?? m.mark ?? m.marks ?? 0),
              status: String(m.status ?? ''),
            };
          }),
        ),
    enabled: !!assessmentId,
  });
}

export function useAllTimetables() {
  return useQuery({
    queryKey: operationsKeys.timetables(),
    queryFn: () =>
      api.get('/academics/timetables').then((r) =>
        arrayFromApi(payloadOf(r), ['timetables']).map((raw) => {
          const e = raw as Record<string, unknown>;
          const resolve = (v: unknown): string => {
            if (!v || typeof v !== 'object') return String(v ?? '');
            const o = v as Record<string, unknown>;
            return String(o.name ?? o.fullName ?? o.label ?? '');
          };
          return {
            ...e,
            id: String(e.id ?? crypto.randomUUID()),
            day: String(e.day ?? e.dayOfWeek ?? ''),
            time: String(e.time ?? e.startTime ?? e.period ?? ''),
            className: resolve(e.className ?? e.class ?? e.class_name),
            subject: resolve(e.subject ?? e.subjectName),
            teacher: resolve(e.teacher ?? e.teacherName),
            room: String(e.room ?? e.roomNumber ?? e.venue ?? ''),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function useOperationsClasses() {
  return useQuery({
    queryKey: operationsKeys.classes(),
    queryFn: () =>
      api.get('/students/classes').then((r) =>
        arrayFromApi(payloadOf(r), ['classes']).map((raw) => {
          const c = raw as Record<string, unknown>;
          const resolve = (v: unknown): string => {
            if (!v || typeof v !== 'object') return String(v ?? '');
            const o = v as Record<string, unknown>;
            return String(o.name ?? o.fullName ?? o.label ?? '');
          };
          const studentsRaw = c.students ?? c.studentCount ?? c.totalStudents ?? 0;
          return {
            ...c,
            id: String(c.id ?? crypto.randomUUID()),
            name: String(c.name ?? c.className ?? ''),
            teacher: resolve(c.teacher ?? c.teacherName ?? c.classTeacher),
            students: Array.isArray(studentsRaw) ? studentsRaw.length : Number(studentsRaw),
            level: String(c.level ?? c.educationLevel ?? ''),
            status: String(c.status ?? ''),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function usePublishReadiness() {
  return useQuery({
    queryKey: operationsKeys.publishReadiness(),
    queryFn: () => api.get('/reports/results-publishing/readiness').then(payloadOf),
    staleTime: 15_000,
  });
}

export function useClassTermResults(classId: string | undefined, termId: string | undefined) {
  return useQuery({
    queryKey: operationsKeys.classTermResults(classId ?? '', termId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/results/class/${classId}/term/${termId}`)
        .then((r) => arrayFromApi(payloadOf(r), ['results', 'students'])),
    enabled: !!classId && !!termId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useGenerateReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/analytics/reports/generate', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: operationsKeys.reportJobs() }),
  });
}

/**
 * Polls /analytics/reports/:id every 2 s until status is READY, then
 * fetches /analytics/reports/:id/download as a blob and triggers a browser
 * download — no navigation required. Rejects on FAILED or after 60 s.
 */
export async function downloadReportWhenReady(reportId: string, filename: string): Promise<void> {
  const MAX_ATTEMPTS = 30; // 30 × 2 s = 60 s timeout
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    await new Promise<void>((r) => setTimeout(r, 2000));
    const result = await api.get(`/analytics/reports/${reportId}`).then(payloadOf) as Record<string, unknown> | null;
    const status = String(result?.status ?? '');
    if (status === 'READY') {
      const raw = await api
        .get(`/analytics/reports/${reportId}/download`, { responseType: 'blob' })
        .then((r) => r.data as Blob);

      // The backend ResponseInterceptor may wrap the PDF bytes inside a JSON
      // string, producing Content-Type: application/json with body `"<PDF bytes>"`.
      // Detect this by finding the %PDF magic header and slicing from there.
      let blob = raw;
      if (!raw.type.startsWith('application/pdf')) {
        const buf = await raw.arrayBuffer();
        const view = new Uint8Array(buf);
        // Find the %PDF magic bytes (0x25 0x50 0x44 0x46)
        let pdfStart = -1;
        for (let j = 0; j < Math.min(view.length, 8); j++) {
          if (view[j] === 0x25 && view[j + 1] === 0x50 && view[j + 2] === 0x44 && view[j + 3] === 0x46) {
            pdfStart = j;
            break;
          }
        }
        if (pdfStart >= 0) {
          // Also strip a trailing JSON closing quote if present
          let pdfEnd = buf.byteLength;
          if (view[pdfEnd - 1] === 0x22) pdfEnd -= 1;
          blob = new Blob([buf.slice(pdfStart, pdfEnd)], { type: 'application/pdf' });
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return;
    }
    if (status === 'FAILED') throw new Error('generation-failed');
  }
  throw new Error('timeout');
}

export function useDeleteTimetableMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/academics/timetables/${id}`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: operationsKeys.timetables() }),
  });
}

export function useCreateTimetableMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/academics/timetables', body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: operationsKeys.timetables() }),
  });
}

export function useBulkMarksMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, marks }: { assessmentId: string; marks: unknown[] }) =>
      api
        .post(`/academics/assessments/${assessmentId}/marks/bulk`, { marks })
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: operationsKeys.assessments() }),
  });
}

export function usePublishResultsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/results/publish', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: operationsKeys.publishReadiness() }),
  });
}

export function useGenerateReportCardsMutation() {
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/report-cards/generate', payload).then((r) => r.data?.data ?? r.data),
  });
}
