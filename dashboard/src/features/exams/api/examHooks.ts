import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Query keys ────────────────────────────────────────────────────────────
export const examKeys = {
  all: ['exams'] as const,
  types: () => [...examKeys.all, 'types'] as const,
  windows: (f?: Record<string, unknown>) => [...examKeys.all, 'windows', f ?? {}] as const,
  window: (id: string) => [...examKeys.all, 'window', id] as const,
  merit: (id: string, f?: Record<string, unknown>) => [...examKeys.all, 'merit', id, f ?? {}] as const,
  teacher: () => [...examKeys.all, 'teacher-windows'] as const,
  template: (assessmentId: string) => [...examKeys.all, 'template', assessmentId] as const,
  editRequests: (f?: Record<string, unknown>) => [...examKeys.all, 'edit-requests', f ?? {}] as const,
  compositions: (termId?: string) => [...examKeys.all, 'compositions', termId ?? ''] as const,
  ref: () => [...examKeys.all, 'reference'] as const,
};

// ─── Reference data (years / terms / classes / subjects) ─────────────────────
export function useExamReference() {
  return useQuery({
    queryKey: examKeys.ref(),
    staleTime: 60_000,
    queryFn: async () => {
      const [years, terms, classes] = await Promise.all([
        api.get('/students/academic-years').then((r) => arrayFromApi(payloadOf(r), ['academicYears', 'years'])),
        api.get('/students/terms').then((r) => arrayFromApi(payloadOf(r), ['terms'])),
        api.get('/students/classes', { params: { limit: 500 } }).then((r) => arrayFromApi(payloadOf(r), ['classes'])),
      ]);
      return { years, terms, classes } as {
        years: Record<string, unknown>[];
        terms: Record<string, unknown>[];
        classes: Record<string, unknown>[];
      };
    },
  });
}

// ─── Exam types ──────────────────────────────────────────────────────────────
export function useExamTypes() {
  return useQuery({
    queryKey: examKeys.types(),
    staleTime: 30_000,
    queryFn: () => api.get('/academics/exam-types').then((r) => arrayFromApi(payloadOf(r), ['examTypes'])) as Promise<Record<string, unknown>[]>,
  });
}

export function useCreateExamType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academics/exam-types', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.types() }),
  });
}

export function useUpdateExamType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/academics/exam-types/${id}`, body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.types() }),
  });
}

export function useDeleteExamType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/academics/exam-types/${id}`).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.types() }),
  });
}

export function useMigrateExamTypes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/academics/exam-types/migrate-from-assessment-types', {}).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.types() }),
  });
}

// ─── Exam windows ────────────────────────────────────────────────────────────
export function useExamWindows(filters: Record<string, string | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: examKeys.windows(clean),
    staleTime: 15_000,
    queryFn: () => api.get('/academics/exam-windows', { params: clean }).then((r) => arrayFromApi(payloadOf(r), ['windows'])) as Promise<Record<string, unknown>[]>,
  });
}

export function useExamWindow(id: string) {
  return useQuery({
    queryKey: examKeys.window(id),
    enabled: !!id,
    queryFn: () => api.get(`/academics/exam-windows/${id}`).then(payloadOf) as Promise<Record<string, unknown>>,
  });
}

export function useCreateExamWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academics/exam-windows', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...examKeys.all, 'windows'] }),
  });
}

/** Lifecycle action: open | close | publish | unpublish | archive. */
export function useWindowAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: Record<string, unknown> }) =>
      api.post(`/academics/exam-windows/${id}/${action}`, body ?? {}).then(payloadOf),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: examKeys.window(v.id) });
      qc.invalidateQueries({ queryKey: [...examKeys.all, 'windows'] });
      qc.invalidateQueries({ queryKey: [...examKeys.all, 'merit', v.id] });
    },
  });
}

// ─── Merit list ──────────────────────────────────────────────────────────────
export function useMeritList(id: string, filters: Record<string, string | number | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
  return useQuery({
    queryKey: examKeys.merit(id, clean),
    enabled: !!id,
    queryFn: () => api.get(`/academics/exam-windows/${id}/merit-list`, { params: clean }).then(payloadOf) as Promise<Record<string, unknown>>,
  });
}

// ─── Binary export download (xlsx / pdf / csv) ───────────────────────────────
export async function downloadMeritExport(
  windowId: string,
  format: 'xlsx' | 'pdf' | 'csv',
  filters: Record<string, string | number | undefined> = {},
): Promise<void> {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
  const res = await api.get(`/academics/exam-windows/${windowId}/merit-list/${format}`, {
    params,
    responseType: 'blob',
  });
  const blob = res.data as Blob;
  const cd = String(res.headers?.['content-disposition'] ?? '');
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? `merit-list.${format}`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Teacher: open windows + marks ───────────────────────────────────────────
export function useTeacherExamWindows() {
  return useQuery({
    queryKey: examKeys.teacher(),
    staleTime: 15_000,
    queryFn: () => api.get('/academics/exam-windows/teacher').then((r) => arrayFromApi(payloadOf(r), ['windows'])) as Promise<Record<string, unknown>[]>,
  });
}

export function useMarksTemplate(assessmentId: string) {
  return useQuery({
    queryKey: examKeys.template(assessmentId),
    enabled: !!assessmentId,
    queryFn: () => api.get(`/academics/exam-windows/assessments/${assessmentId}/template`).then(payloadOf) as Promise<Record<string, unknown>>,
  });
}

export async function downloadMarksTemplateCsv(assessmentId: string): Promise<void> {
  const res = await api.get(`/academics/exam-windows/assessments/${assessmentId}/template/csv`, { responseType: 'blob' });
  const blob = res.data as Blob;
  const cd = String(res.headers?.['content-disposition'] ?? '');
  const filename = cd.match(/filename="?([^"]+)"?/)?.[1] ?? 'marks-template.csv';
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
}

export function useUploadMarks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, rows, autoSubmit }: { assessmentId: string; rows: unknown[]; autoSubmit?: boolean }) =>
      api.post(`/academics/exam-windows/assessments/${assessmentId}/marks/upload`, { rows, autoSubmit }).then(payloadOf),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: examKeys.template(v.assessmentId) });
      qc.invalidateQueries({ queryKey: examKeys.teacher() });
    },
  });
}

export function useSubmitAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assessmentId: string) => api.post(`/academics/assessments/${assessmentId}/submit`, {}).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.teacher() }),
  });
}

// ─── Edit requests ───────────────────────────────────────────────────────────
export function useEditRequests(filters: Record<string, string | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: examKeys.editRequests(clean),
    staleTime: 10_000,
    queryFn: () => api.get('/academics/exam-windows/edit-requests', { params: clean }).then((r) => arrayFromApi(payloadOf(r), ['editRequests', 'requests'])) as Promise<Record<string, unknown>[]>,
  });
}

export function useCreateEditRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academics/exam-windows/edit-requests', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...examKeys.all, 'edit-requests'] }),
  });
}

export function useDecideEditRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'grant' | 'reject' | 'complete'; note?: string }) =>
      api.post(`/academics/exam-windows/edit-requests/${id}/${decision}`, { note }).then(payloadOf),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...examKeys.all, 'edit-requests'] });
      qc.invalidateQueries({ queryKey: [...examKeys.all, 'windows'] });
    },
  });
}

// ─── Report card composition ─────────────────────────────────────────────────
export function useCompositions(termId?: string) {
  return useQuery({
    queryKey: examKeys.compositions(termId),
    staleTime: 15_000,
    queryFn: () => api.get('/academics/report-card-compositions', { params: termId ? { termId } : {} }).then((r) => arrayFromApi(payloadOf(r), ['compositions'])) as Promise<Record<string, unknown>[]>,
  });
}

export function useComposeReportCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academics/report-card-compositions', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...examKeys.all, 'compositions'] }),
  });
}
