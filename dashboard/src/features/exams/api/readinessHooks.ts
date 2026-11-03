import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import { examKeys } from './examHooks';

// ─── Readiness matrix + calculation exemptions ───────────────────────────────
export function useWindowReadiness(id: string, enabled = true) {
  return useQuery({
    queryKey: [...examKeys.all, 'readiness', id] as const,
    enabled: !!id && enabled,
    staleTime: 5_000,
    queryFn: () => api.get(`/academics/exam-windows/${id}/readiness`).then(payloadOf) as Promise<Record<string, any>>,
  });
}

export function useExemptions(filters: Record<string, string | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: [...examKeys.all, 'exemptions', clean] as const,
    staleTime: 5_000,
    queryFn: () => api.get('/academics/result-exemptions', { params: clean }).then((r) => arrayFromApi(payloadOf(r), ['exemptions'])) as Promise<Record<string, any>[]>,
  });
}

export function usePreviewExemption() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academics/result-exemptions/preview', body).then(payloadOf) as Promise<Record<string, any>>,
  });
}

export function useCreateExemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academics/result-exemptions', body).then(payloadOf) as Promise<Record<string, any>>,
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.all }),
  });
}

export function useRevokeExemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post(`/academics/result-exemptions/${id}/revoke`, { reason }).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: examKeys.all }),
  });
}

// ─── Performance & student-list export ───────────────────────────────────────
export type PerformanceParams = {
  examWindowId?: string;
  termId?: string;
  academicYearId?: string;
  classId?: string;
  level?: string;
  educationStage?: string;
};

const cleanParams = (p: PerformanceParams) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== ''));

export function usePerformancePreview(params: PerformanceParams, enabled: boolean) {
  const clean = cleanParams(params);
  return useQuery({
    queryKey: [...examKeys.all, 'performance', clean] as const,
    enabled,
    staleTime: 10_000,
    retry: false,
    queryFn: () => api.get('/academics/performance-export/preview', { params: clean }).then(payloadOf) as Promise<Record<string, any>>,
  });
}

export async function downloadPerformanceExport(format: 'xlsx' | 'pdf' | 'csv', params: PerformanceParams): Promise<void> {
  const res = await api.get(`/academics/performance-export/${format}`, { params: cleanParams(params), responseType: 'blob' });
  const blob = res.data as Blob;
  const cd = String(res.headers?.['content-disposition'] ?? '');
  const filename = cd.match(/filename="?([^"]+)"?/)?.[1] ?? `student-performance.${format}`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
}
