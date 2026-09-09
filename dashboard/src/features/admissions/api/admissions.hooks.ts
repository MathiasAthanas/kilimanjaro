import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdmissionStage =
  | 'INQUIRY'
  | 'APPLICATION'
  | 'ASSESSMENT'
  | 'OFFER'
  | 'ACCEPTED'
  | 'ENROLLED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type AdmissionSourceChannel =
  | 'WALK_IN'
  | 'REFERRAL'
  | 'WEBSITE'
  | 'SOCIAL_MEDIA'
  | 'PHONE_CALL'
  | 'SCHOOL_EVENT'
  | 'OTHER';

export interface ApplicantRow {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  nationality?: string;
  previousSchool?: string | null;
  prospectiveClassId?: string | null;
  prospectiveClass?: { id: string; name: string; stream?: string | null; level?: number; capacity?: number } | null;
  educationStage?: string | null;
  guardianFirstName: string;
  guardianLastName: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  guardianRelationship?: string;
  sourceChannel: AdmissionSourceChannel;
  stage: AdmissionStage;
  notes?: string | null;
  studentId?: string | null;
  createdAt: string;
  updatedAt?: string;
  stageEvents?: Array<{ id: string; fromStage: AdmissionStage | null; toStage: AdmissionStage; actorId: string; note?: string | null; createdAt: string }>;
  assessments?: Array<{ id: string; scheduledAt: string; subjectFocus?: string | null; score?: number | null; maxScore?: number | null; outcome: string; notes?: string | null }>;
  offer?: { id: string; classId: string; admissionNumber?: string | null; feeExpectation?: number | null; decision: string; issuedAt: string; respondedAt?: string | null; expiresAt?: string | null; note?: string | null } | null;
}

export interface AdmissionsAnalytics {
  funnel: Array<{ stage: AdmissionStage; count: number }>;
  totals: { total: number; active: number; enrolled: number; rejected: number; withdrawn: number; conversionRate: number };
  sourceChannels: Array<{ channel: AdmissionSourceChannel; count: number }>;
  capacity: Array<{
    classId: string;
    className: string;
    level: number;
    educationStage: string;
    capacity: number;
    filled: number;
    available: number;
    pipeline: number;
    enrolledFromAdmissions: number;
  }>;
  academicYear: { id: string; name: string } | null;
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const admissionsKeys = {
  all: ['admissions'] as const,
  applicants: (filters?: Record<string, unknown>) => [...admissionsKeys.all, 'applicants', filters ?? {}] as const,
  applicant: (id: string) => [...admissionsKeys.all, 'applicant', id] as const,
  analytics: () => [...admissionsKeys.all, 'analytics'] as const,
  classes: () => [...admissionsKeys.all, 'classes'] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useApplicants(filters?: { stage?: AdmissionStage; search?: string; prospectiveClassId?: string; limit?: number }) {
  return useQuery({
    queryKey: admissionsKeys.applicants(filters),
    queryFn: () =>
      api
        .get('/admissions/applicants', { params: { limit: 200, ...filters } })
        .then((r) => {
          const payload = payloadOf(r) as { items?: ApplicantRow[] } | ApplicantRow[] | null;
          const items = Array.isArray(payload) ? payload : payload?.items ?? [];
          return items as ApplicantRow[];
        }),
    staleTime: 15_000,
  });
}

export function useApplicant(id: string | undefined) {
  return useQuery({
    queryKey: admissionsKeys.applicant(id ?? ''),
    queryFn: () => api.get(`/admissions/applicants/${id}`).then((r) => payloadOf(r) as ApplicantRow),
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useAdmissionsAnalytics() {
  return useQuery({
    queryKey: admissionsKeys.analytics(),
    queryFn: () => api.get('/admissions/analytics').then((r) => payloadOf(r) as AdmissionsAnalytics),
    staleTime: 30_000,
  });
}

export function useAdmissionsClasses() {
  return useQuery({
    queryKey: admissionsKeys.classes(),
    queryFn: () =>
      api.get('/students/classes', { params: { limit: 100 } }).then((r) =>
        arrayFromApi(payloadOf(r), ['classes', 'items']).map((raw) => {
          const c = raw as Record<string, unknown>;
          return {
            id: String(c.id ?? ''),
            name: String(c.name ?? ''),
            stream: c.stream ? String(c.stream) : '',
            level: Number(c.level ?? 0),
            capacity: Number(c.capacity ?? 0),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function invalidateAdmissions(qc: ReturnType<typeof useQueryClient>, applicantId?: string) {
  qc.invalidateQueries({ queryKey: admissionsKeys.all });
  if (applicantId) qc.invalidateQueries({ queryKey: admissionsKeys.applicant(applicantId) });
}

export function useCreateApplicantMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/admissions/applicants', body).then((r) => payloadOf(r) as ApplicantRow),
    onSuccess: () => invalidateAdmissions(qc),
  });
}

export function useUpdateApplicantMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) =>
      api.patch(`/admissions/applicants/${id}`, body).then((r) => payloadOf(r) as ApplicantRow),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.id),
  });
}

export function useTransitionStageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, toStage, note }: { id: string; toStage: AdmissionStage; note?: string }) =>
      api.post(`/admissions/applicants/${id}/transition`, { toStage, note }).then((r) => payloadOf(r) as ApplicantRow),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.id),
  });
}

export function useScheduleAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; scheduledAt: string; subjectFocus?: string; maxScore?: number; notes?: string }) =>
      api.post(`/admissions/applicants/${id}/assessments`, body).then((r) => payloadOf(r)),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.id),
  });
}

export function useRecordAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, applicantId: _applicantId, ...body }: { assessmentId: string; applicantId: string; score?: number; outcome?: string; notes?: string }) =>
      api.patch(`/admissions/assessments/${assessmentId}`, body).then((r) => payloadOf(r)),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.applicantId),
  });
}

export function useIssueOfferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; classId: string; feeExpectation?: number; expiresAt?: string; note?: string }) =>
      api.post(`/admissions/applicants/${id}/offer`, body).then((r) => payloadOf(r)),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.id),
  });
}

export function useOfferDecisionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'ACCEPTED' | 'DECLINED'; note?: string }) =>
      api.post(`/admissions/applicants/${id}/offer/decision`, { decision, note }).then((r) => payloadOf(r)),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.id),
  });
}

export function useConvertApplicantMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, admissionDate }: { id: string; admissionDate?: string }) =>
      api.post(`/admissions/applicants/${id}/convert`, { admissionDate }).then((r) => payloadOf(r) as { applicant: ApplicantRow; student: { id: string; registrationNumber: string } }),
    onSuccess: (_data, variables) => invalidateAdmissions(qc, variables.id),
  });
}
