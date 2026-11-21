import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { payloadOf } from '../../../lib/api/response';
import { useSchoolStore } from '../../../lib/school/schoolStore';

export type ResidenceType = 'BOARDING' | 'DAY_SCHOLAR';

export const residenceLabel = (value?: string | null) =>
  value === 'BOARDING' ? 'Boarding' : value === 'DAY_SCHOLAR' ? 'Day Scholar' : 'Not classified';

export type ResidenceSummary = {
  totals: { total: number; boarding: number; dayScholar: number; unclassified: number; scheduled: number };
  classes: Array<{ classId: string; name: string; level: number; stream: string | null; schoolId: string | null; total: number; unclassified: number; boarding: number; dayScholar: number }>;
};

export type ResidenceStudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  registrationNumber: string;
  gender?: string;
  residenceType: ResidenceType | null;
  className: string | null;
  classId: string | null;
};

export type ResidenceChangeRow = {
  id: string;
  fromType: ResidenceType | null;
  toType: ResidenceType;
  status: 'SCHEDULED' | 'APPLIED' | 'CANCELLED';
  effectiveTermName?: string | null;
  effectiveFrom?: string | null;
  reason?: string | null;
  releasedDormitoryName?: string | null;
  source: string;
  createdAt: string;
  appliedAt?: string | null;
};

export type ResidenceHistory = { current: ResidenceType | null; changes: ResidenceChangeRow[] };

export type ResidencePolicy = 'NEXT_TERM' | 'THIS_TERM' | 'ASK';

const useSchoolKey = () => useSchoolStore((s) => s.activeSchool?.id ?? '__group__');

export function useResidenceSummary() {
  const school = useSchoolKey();
  return useQuery({ queryKey: ['residence', 'summary', school], queryFn: () => api.get('/residence/summary').then((r) => payloadOf(r) as ResidenceSummary) });
}

export function useResidenceStudents(params: { classId?: string; status?: string; search?: string; page?: number }) {
  const school = useSchoolKey();
  return useQuery({
    queryKey: ['residence', 'students', school, params],
    queryFn: () => api.get('/residence/students', { params: { ...params, limit: 50 } }).then((r) => payloadOf(r) as { total: number; page: number; limit: number; items: ResidenceStudentRow[] }),
    placeholderData: (previous) => previous,
  });
}

export function useResidenceHistory(studentId?: string) {
  return useQuery({
    queryKey: ['residence', 'history', studentId],
    queryFn: () => api.get(`/residence/students/${studentId}/history`).then((r) => payloadOf(r) as ResidenceHistory),
    enabled: !!studentId,
  });
}

/** How the school wants mid-term changes billed. Falls back to "ask" when it cannot be read (for example no school is selected). */
export function useResidencePolicy() {
  const school = useSchoolKey();
  return useQuery({
    queryKey: ['residence', 'policy', school],
    queryFn: () => api.get('/finance/settings/residence-policy').then((r) => (payloadOf(r) as { residenceChangePolicy: ResidencePolicy }).residenceChangePolicy),
    retry: false,
    staleTime: 60_000,
  });
}

function useInvalidateResidence() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['residence'] });
    qc.invalidateQueries({ queryKey: ['boarding'] });
    qc.invalidateQueries({ queryKey: ['admin'] });
    qc.invalidateQueries({ queryKey: ['students'] });
    qc.invalidateQueries({ queryKey: ['finance'] });
  };
}

export function useChangeResidence() {
  const invalidate = useInvalidateResidence();
  return useMutation({
    mutationFn: ({ studentId, ...body }: { studentId: string; residenceType: ResidenceType; effective: 'NOW' | 'NEXT_TERM'; reason?: string }) =>
      api.post(`/residence/students/${studentId}/change`, body).then((r) => payloadOf(r) as { applied: boolean; releasedDormitoryId?: string | null; effectiveTerm?: { name: string; startDate: string } }),
    onSuccess: invalidate,
  });
}

export function useCancelScheduledResidence() {
  const invalidate = useInvalidateResidence();
  return useMutation({ mutationFn: (changeId: string) => api.patch(`/residence/changes/${changeId}/cancel`).then(payloadOf), onSuccess: invalidate });
}

export function useBulkClassify() {
  const invalidate = useInvalidateResidence();
  return useMutation({
    mutationFn: (body: { residenceType: ResidenceType; classId?: string; studentIds?: string[] }) =>
      api.post('/residence/bulk', body).then((r) => payloadOf(r) as { requested: number; updated: number; skipped: number }),
    onSuccess: invalidate,
  });
}
