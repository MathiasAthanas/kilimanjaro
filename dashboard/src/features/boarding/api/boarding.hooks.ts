import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import { useSchoolStore } from '../../../lib/school/schoolStore';

export type BoardingStudent = {
  id: string;
  firstName: string;
  lastName: string;
  registrationNumber: string;
  residenceType?: 'BOARDING' | 'DAY_SCHOLAR' | null;
};

export type Dormitory = {
  id: string;
  name: string;
  code: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  notes?: string | null;
  eligibilityNotes?: string | null;
};

export type DormitoryDetail = Dormitory & {
  beds: Array<{ id: string; label: string; status: string }>;
  staffAssignments: Array<{ id: string; staffUserId: string; staffRole: string }>;
  studentAssignments: Array<{
    id: string;
    studentId: string;
    bed?: { id: string; label: string } | null;
    student: BoardingStudent & { enrolments?: Array<{ class?: { name?: string; stream?: string | null } }> };
  }>;
};

export type HostelLeave = {
  id: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'DEPARTED' | 'RETURNED' | 'CANCELLED';
  leaveType: string;
  reason: string;
  departureAt: string;
  expectedReturnAt: string;
  actualReturnAt?: string | null;
  student: BoardingStudent;
  dormitory: { id: string; name: string };
  term: { id: string; name: string };
};

export type RollCallHistory = {
  dormitoryId: string;
  dormitory: { id: string; name: string; code: string; schoolId: string };
  date: string;
  session: 'MORNING' | 'EVENING';
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  excused: number;
  lastMarkedAt: string;
};

export type RollCallDetail = {
  dormitory: { id: string; name: string; code: string; totalBeds: number };
  date: string;
  session: 'MORNING' | 'EVENING';
  records: Array<{ id: string; status: string; note?: string | null; markedAt: string; student: BoardingStudent }>;
};

const keys = {
  all: ['boarding'] as const,
  dashboard: ['boarding', 'dashboard'] as const,
  dormitory: (id: string) => ['boarding', 'dormitory', id] as const,
  leaves: ['boarding', 'leaves'] as const,
  rollCalls: ['boarding', 'roll-calls'] as const,
};

/**
 * Boarding data is school-owned. Include the selected school in every cache key
 * so a group Admin cannot reuse a dormitory from a previously selected school
 * after switching context (which correctly results in a 403 at the API).
 */
function useActiveSchoolKey() {
  return useSchoolStore((state) => state.activeSchool?.id ?? '__group__');
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: keys.all });
}

export function useBoardingDashboard() {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.dashboard, activeSchoolKey],
    queryFn: () => api.get('/boarding/dashboard').then((r) => payloadOf(r) as { dormitories: Dormitory[]; totals: Record<string, number> }),
  });
}

export function useDormitory(id?: string) {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.dormitory(id ?? ''), activeSchoolKey],
    queryFn: () => api.get(`/boarding/dormitories/${id}`).then((r) => payloadOf(r) as DormitoryDetail),
    enabled: !!id,
  });
}

export function useBoardingStudents() {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.all, 'students', activeSchoolKey],
    queryFn: () => api.get('/students', { params: { limit: 500 } }).then((r) =>
      arrayFromApi(payloadOf(r), ['items', 'students']).filter((row) => (row as Record<string, unknown>).residenceType === 'BOARDING') as BoardingStudent[],
    ),
  });
}

export type BoardingStaffMember = { id: string; firstName?: string; lastName?: string; name?: string; role: 'MATRON' | 'PATRON'; email?: string };

/** Every matron and patron of the selected school (two role queries, so neither is lost behind a page limit). */
export function useBoardingStaff(enabled = true) {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.all, 'staff', activeSchoolKey],
    queryFn: async () => {
      const [matrons, patrons] = await Promise.all(['MATRON', 'PATRON'].map((role) =>
        api.get('/auth/users', { params: { role, limit: 100 } }).then((r) => arrayFromApi(payloadOf(r), ['items', 'users']) as unknown as BoardingStaffMember[]),
      ));
      return [...matrons, ...patrons].filter((row) => ['MATRON', 'PATRON'].includes(String(row.role)));
    },
    enabled,
  });
}

export type AwaitingStudent = { id: string; firstName: string; lastName: string; registrationNumber: string; gender?: string; className: string | null; admissionDate?: string };
export type AwaitingDormitory = { id: string; name: string; code: string; schoolId: string; totalBeds: number; occupiedBeds: number; availableBeds: number };

/** Boarders who still need a dormitory: the matron and patron to-do list. */
export function useBoardingAwaiting() {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.all, 'awaiting', activeSchoolKey],
    queryFn: () => api.get('/boarding/awaiting').then((r) => payloadOf(r) as { total: number; students: AwaitingStudent[]; dormitories: AwaitingDormitory[] }),
  });
}

export function useBoardingTerms() {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.all, 'terms', activeSchoolKey],
    queryFn: () => api.get('/students/terms').then((r) => arrayFromApi(payloadOf(r), ['items', 'terms']).filter((row) => (row as Record<string, unknown>).isCurrent === true)),
  });
}

export function useHostelLeaves() {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({ queryKey: [...keys.leaves, activeSchoolKey], queryFn: () => api.get('/boarding/leaves').then((r) => arrayFromApi(payloadOf(r)) as HostelLeave[]) });
}

export function useRollCallHistory(dormitoryId?: string) {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.rollCalls, dormitoryId ?? '', activeSchoolKey],
    queryFn: () => api.get('/boarding/roll-calls', { params: dormitoryId ? { dormitoryId } : undefined }).then((r) => arrayFromApi(payloadOf(r)) as RollCallHistory[]),
  });
}

export function useRollCallDetail(dormitoryId?: string, date?: string, session?: string) {
  const activeSchoolKey = useActiveSchoolKey();
  return useQuery({
    queryKey: [...keys.rollCalls, 'detail', dormitoryId ?? '', date ?? '', session ?? '', activeSchoolKey],
    queryFn: () => api.get(`/boarding/roll-calls/${dormitoryId}/${date}/${session}`).then((r) => payloadOf(r) as RollCallDetail),
    enabled: !!dormitoryId && !!date && !!session,
  });
}

function boardingMutation<T extends Record<string, unknown>>(fn: (input: T) => Promise<unknown>) {
  return () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => invalidate(qc) });
  };
}

export const useCreateDormitory = boardingMutation((body: { name: string; code?: string; totalBeds: number; notes?: string; eligibilityNotes?: string; staff?: Array<{ staffUserId: string; staffRole: 'MATRON' | 'PATRON' }> }) =>
  api.post('/boarding/dormitories', body).then(payloadOf));
export const useUpdateDormitory = boardingMutation(({ id, ...body }: { id: string; name?: string; totalBeds?: number; notes?: string; eligibilityNotes?: string }) =>
  api.patch(`/boarding/dormitories/${id}`, body).then(payloadOf));
export const useAssignDormitoryStaff = boardingMutation(({ dormitoryId, ...body }: { dormitoryId: string; staffUserId: string; staffRole: string }) =>
  api.post(`/boarding/dormitories/${dormitoryId}/staff`, body).then(payloadOf));
export const useAssignDormitoryStudent = boardingMutation(({ dormitoryId, ...body }: { dormitoryId: string; studentId: string; bedId?: string }) =>
  api.post(`/boarding/dormitories/${dormitoryId}/students`, body).then(payloadOf));
export const useUnassignDormitoryStudent = boardingMutation(({ dormitoryId, studentId }: { dormitoryId: string; studentId: string }) =>
  api.patch(`/boarding/dormitories/${dormitoryId}/students/${studentId}/end`).then(payloadOf));
export const useUnassignDormitoryStaff = boardingMutation(({ dormitoryId, staffUserId }: { dormitoryId: string; staffUserId: string }) =>
  api.patch(`/boarding/dormitories/${dormitoryId}/staff/${staffUserId}/end`).then(payloadOf));
export const useUpdateDormitoryBed = boardingMutation(({ dormitoryId, bedId, status }: { dormitoryId: string; bedId: string; status: string }) =>
  api.patch(`/boarding/dormitories/${dormitoryId}/beds/${bedId}`, { status }).then(payloadOf));
export const useRecordHostelRollCall = boardingMutation(({ dormitoryId, ...body }: { dormitoryId: string; date: string; session: string; records: Array<{ studentId: string; status: string }> }) =>
  api.post(`/boarding/dormitories/${dormitoryId}/roll-call`, body).then(payloadOf));
export const useCreateHostelLeave = boardingMutation((body: { dormitoryId: string; studentId: string; termId: string; leaveType: string; reason: string; departureAt: string; expectedReturnAt: string }) =>
  api.post('/boarding/leaves', body).then(payloadOf));
export const useTransitionHostelLeave = boardingMutation(({ id, ...body }: { id: string; status: string; note?: string; actualReturnAt?: string }) =>
  api.patch(`/boarding/leaves/${id}/status`, body).then(payloadOf));
