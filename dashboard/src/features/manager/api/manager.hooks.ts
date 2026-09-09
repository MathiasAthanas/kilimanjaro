import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { payloadOf } from '../../../lib/api/response';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SchoolRow {
  id: string;
  name: string;
  code: string;
  type: 'NURSERY' | 'PRIMARY' | 'SECONDARY';
  gender: 'MALE' | 'FEMALE' | 'BOTH';
  motto?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
}

export interface SchoolScorecard {
  id: string;
  name: string;
  code: string;
  type: string;
  gender: string;
  logoUrl?: string | null;
  isActive: boolean;
  students: number;
  capacity: number;
  capacityFillPct: number | null;
  academicMean: number | null;
  collectionRate: number | null;
  invoiced: number;
  collected: number;
  outstanding: number;
  attendanceRate: number | null;
  atRisk: number;
  health: 'GOOD' | 'WATCH' | 'CRITICAL';
}

export interface GroupOverview {
  totals: {
    schools: number;
    students: number;
    invoiced: number;
    collected: number;
    outstanding: number;
    collectionRate: number | null;
    academicMean: number | null;
    atRisk: number;
    needingAttention: number;
  };
  schools: SchoolScorecard[];
  attention: Array<{ id: string; name: string; health: string; reasons: string[] }>;
}

export interface GroupFinance {
  totals: { invoiced: number; collected: number; outstanding: number; collectionRate: number | null };
  bySchool: Array<{ id: string; name: string; code: string; invoiced: number; collected: number; outstanding: number; collectionRate: number | null }>;
  trend: Array<{ termId: string; period: string; invoiced: number; collected: number; rate: number }>;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const managerKeys = {
  all: ['manager'] as const,
  schools: () => [...managerKeys.all, 'schools'] as const,
  schoolSummary: (id: string) => [...managerKeys.all, 'schools', id, 'summary'] as const,
  groupOverview: () => [...managerKeys.all, 'group', 'overview'] as const,
  groupFinance: () => [...managerKeys.all, 'group', 'finance'] as const,
  memberships: (filters?: { schoolId?: string; role?: string; authUserId?: string }) =>
    [...managerKeys.all, 'memberships', filters ?? {}] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useSchools() {
  return useQuery({
    queryKey: managerKeys.schools(),
    queryFn: () => api.get('/schools').then((r) => payloadOf(r) as SchoolRow[]),
    staleTime: 30_000,
  });
}

export function useSchoolSummary(id: string | undefined) {
  return useQuery({
    queryKey: managerKeys.schoolSummary(id ?? ''),
    queryFn: () => api.get(`/schools/${id}/summary`).then(payloadOf),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useGroupOverview() {
  return useQuery({
    queryKey: managerKeys.groupOverview(),
    queryFn: () => api.get('/analytics/group/overview').then((r) => payloadOf(r) as GroupOverview),
    staleTime: 30_000,
  });
}

export function useGroupFinance() {
  return useQuery({
    queryKey: managerKeys.groupFinance(),
    queryFn: () => api.get('/analytics/group/finance').then((r) => payloadOf(r) as GroupFinance),
    staleTime: 30_000,
  });
}

export function useMemberships(filters?: { schoolId?: string; role?: string }) {
  return useQuery({
    queryKey: managerKeys.memberships(filters),
    queryFn: () =>
      api
        .get('/auth/memberships', { params: filters })
        .then((r) => payloadOf(r) as Array<{ id: string; role: string; schoolId: string | null; user: { id: string; firstName: string; lastName: string; email?: string; isActive?: boolean } }>),
    staleTime: 15_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateSchoolMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<SchoolRow>) => api.post('/schools', body).then((r) => payloadOf(r) as SchoolRow),
    onSuccess: () => qc.invalidateQueries({ queryKey: managerKeys.all }),
  });
}

export function useUpdateSchoolMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<SchoolRow> & { id: string; acknowledgeNarrowing?: boolean }) =>
      api.patch(`/schools/${id}`, body).then((r) => payloadOf(r) as SchoolRow),
    onSuccess: () => qc.invalidateQueries({ queryKey: managerKeys.all }),
  });
}

export function useSetSchoolStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/schools/${id}/status`, { isActive }).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: managerKeys.all }),
  });
}

export function useAssignMembershipMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { authUserId: string; schoolId?: string; role: string }) =>
      api.post('/auth/memberships', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: managerKeys.all }),
  });
}

export function useAssignWithUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { firstName: string; lastName: string; email?: string; phoneNumber?: string; role: string; schoolId?: string }) =>
      api.post('/auth/memberships/with-user', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: managerKeys.all }),
  });
}

export function useAppointHeadOfFinanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (authUserId: string) =>
      api.post('/auth/memberships/head-of-finance', { authUserId }).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: managerKeys.all }),
  });
}

export function useAdminUsers(search?: string) {
  return useQuery({
    queryKey: [...managerKeys.all, 'users', search ?? ''] as const,
    queryFn: () =>
      api
        .get('/auth/users', { params: { limit: 50, search } })
        .then((r) => {
          const payload = payloadOf(r) as { items?: unknown[] } | unknown[];
          const items = Array.isArray(payload) ? payload : payload?.items ?? [];
          return items as Array<{ id: string; firstName: string; lastName: string; email?: string; role: string }>;
        }),
    staleTime: 15_000,
  });
}

export const formatTZS = (v: number) =>
  `TZS ${Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const SCHOOL_TYPE_LABELS: Record<string, string> = {
  NURSERY: 'Nursery',
  PRIMARY: 'Primary',
  SECONDARY: 'Secondary',
};
export const SCHOOL_GENDER_LABELS: Record<string, string> = {
  MALE: 'Boys',
  FEMALE: 'Girls',
  BOTH: 'Boys & Girls',
};
