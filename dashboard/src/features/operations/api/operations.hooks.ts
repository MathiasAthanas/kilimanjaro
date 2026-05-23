import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';

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
      api.get('/reports/catalog').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useReportJobs() {
  return useQuery({
    queryKey: operationsKeys.reportJobs(),
    queryFn: () =>
      api.get('/reports/jobs').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 15_000,
  });
}

export function useReportJob(id: string | undefined) {
  return useQuery({
    queryKey: operationsKeys.reportJob(id ?? ''),
    queryFn: () => api.get(`/reports/jobs/${id}`).then((r) => r.data?.data ?? r.data),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useScheduledReports() {
  return useQuery({
    queryKey: operationsKeys.scheduledReports(),
    queryFn: () =>
      api.get('/reports/scheduled').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useReportsAudit() {
  return useQuery({
    queryKey: operationsKeys.reportsAudit(),
    queryFn: () =>
      api.get('/reports/audit').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useAnalyticsOverview() {
  return useQuery({
    queryKey: operationsKeys.analyticsOverview(),
    queryFn: () => api.get('/analytics/overview').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function useEnrolmentAnalytics() {
  return useQuery({
    queryKey: operationsKeys.enrolment(),
    queryFn: () => api.get('/analytics/enrolment').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function useAcademicOverview() {
  return useQuery({
    queryKey: operationsKeys.academicOverview(),
    queryFn: () => api.get('/analytics/academic/overview').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function useOperationsFinanceOverview() {
  return useQuery({
    queryKey: operationsKeys.financeOverview(),
    queryFn: () => api.get('/analytics/finance/overview').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function useAttendanceOverview() {
  return useQuery({
    queryKey: operationsKeys.attendanceOverview(),
    queryFn: () => api.get('/analytics/attendance/overview').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function usePerformanceEngineAnalytics() {
  return useQuery({
    queryKey: operationsKeys.performanceEngine(),
    queryFn: () =>
      api.get('/analytics/academic/performance-engine').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function useAllAssessments() {
  return useQuery({
    queryKey: operationsKeys.assessments(),
    queryFn: () =>
      api.get('/academics/assessments').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useAssessmentMarksSheet(assessmentId: string | undefined) {
  return useQuery({
    queryKey: operationsKeys.marksSheet(assessmentId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/assessments/${assessmentId}/marks/sheet`)
        .then((r) => r.data?.data ?? []),
    enabled: !!assessmentId,
  });
}

export function useAllTimetables() {
  return useQuery({
    queryKey: operationsKeys.timetables(),
    queryFn: () =>
      api.get('/academics/timetables').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useOperationsClasses() {
  return useQuery({
    queryKey: operationsKeys.classes(),
    queryFn: () =>
      api.get('/students/classes').then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function usePublishReadiness() {
  return useQuery({
    queryKey: operationsKeys.publishReadiness(),
    queryFn: () =>
      api.get('/reports/results-publishing/readiness').then((r) => r.data?.data ?? r.data),
    staleTime: 15_000,
  });
}

export function useClassTermResults(classId: string | undefined, termId: string | undefined) {
  return useQuery({
    queryKey: operationsKeys.classTermResults(classId ?? '', termId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/results/class/${classId}/term/${termId}`)
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
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

export function useDeleteTimetableMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/academics/timetables/${id}`).then((r) => r.data?.data ?? r.data),
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
