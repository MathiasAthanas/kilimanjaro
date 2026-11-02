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
