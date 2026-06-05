import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import type { AdminStatus } from './adminApi';

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: AdminStatus;
  linked: string;
  lastLogin: string;
  createdAt: string;
};

function statusToState(status: unknown) {
  const normalized = String(status ?? '').toLowerCase();
  if (['ok', 'online', 'healthy', 'up'].includes(normalized)) return 'ONLINE';
  if (['degraded', 'warning'].includes(normalized)) return 'DEGRADED';
  if (['offline', 'down', 'error', 'failed'].includes(normalized)) return 'OFFLINE';
  return 'UNKNOWN';
}

function toServiceHealth(value: unknown) {
  const payload = value && typeof value === 'object' && 'services' in value
    ? (value as Record<string, unknown>).services
    : value;
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return Object.entries(payload as Record<string, Record<string, unknown>>).map(([key, item]) => ({
    service: String(item?.service ?? key).replace(/(^|-)([a-z])/g, (_, sep: string, letter: string) => `${sep ? ' ' : ''}${letter.toUpperCase()}`),
    state: statusToState(item?.status ?? item?.state),
    uptime: String(item?.uptime ?? item?.uptimePercent ?? 'Live'),
    latency: typeof item?.latency === 'number'
      ? `${item.latency}ms`
      : String(item?.latency ?? item?.latencyMs ?? '-'),
  }));
}

function toAdminUsers(value: unknown) {
  return arrayFromApi(value, ['users']).map((raw) => {
    const user = raw as Record<string, unknown>;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const status = user.lockedUntil ? 'LOCKED' : user.isActive === false ? 'INACTIVE' : 'ACTIVE';
    return {
      ...user,
      id: String(user.id ?? user.authUserId ?? user.email ?? crypto.randomUUID()),
      email: String(user.email ?? ''),
      role: String(user.role ?? 'USER'),
      createdAt: String(user.createdAt ?? ''),
      name: String(user.name ?? fullName ?? user.email ?? 'Unknown User'),
      status: String(user.status ?? status) as AdminStatus,
      linked: String(user.linked ?? user.registrationNumber ?? user.phoneNumber ?? 'Portal account'),
      lastLogin: String(user.lastLogin ?? user.lastLoginAt ?? user.updatedAt ?? user.createdAt ?? ''),
    } satisfies AdminUserRow;
  });
}

function toAdminStudents(value: unknown) {
  return arrayFromApi(value, ['students']).map((raw) => {
    const s = raw as Record<string, unknown>;
    const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
    const classObj = s.class as Record<string, unknown> | undefined;
    // guardians may be a count (number) or an array — normalise to count
    const guardiansRaw = s.guardians ?? s.guardianCount ?? s.parentsCount ?? 0;
    const guardiansCount = Array.isArray(guardiansRaw) ? guardiansRaw.length : Number(guardiansRaw ?? 0);
    return {
      ...s,
      id: String(s.id ?? crypto.randomUUID()),
      registration: String(s.registrationNumber ?? s.registration ?? s.admissionNumber ?? ''),
      name: String(s.name ?? s.fullName ?? fullName ?? ''),
      className: String(classObj?.name ?? s.className ?? s.class_name ?? s.currentClass ?? ''),
      stage: String(s.educationStage ?? s.stage ?? s.level ?? ''),
      status: String(s.status ?? (s.isActive === false ? 'INACTIVE' : 'ACTIVE')),
      guardians: guardiansCount,
      balance: Number(s.outstandingBalance ?? s.totalOwed ?? s.balance ?? s.fee_balance ?? 0),
      risk: String(s.riskLevel ?? s.academicRisk ?? s.risk ?? 'STABLE'),
    };
  });
}

function toAuditEvents(value: unknown) {
  const direct = arrayFromApi(value, ['items', 'events']);
  if (direct.length) return direct;
  const payload = value as Record<string, unknown> | undefined;
  const streams = arrayFromApi(payload, ['auditStreams']);
  const streamEvents = streams.flatMap((stream) => arrayFromApi((stream as Record<string, unknown>).items));
  const financeEvents = arrayFromApi(payload, ['financeAudit']);
  const notificationEvents = arrayFromApi(payload, ['notificationLogs']);
  return [...streamEvents, ...financeEvents, ...notificationEvents].slice(0, 30).map((raw, index) => {
    const event = raw as Record<string, unknown>;
    return {
      id: String(event.id ?? `${event.action ?? event.eventType ?? 'audit'}-${index}`),
      time: [event.createdAt, event.updatedAt, event.deliveredAt]
        .find((v): v is string => typeof v === 'string' && v.length > 0)
        ?? new Date().toISOString(),
      actor: String(event.performedByRole ?? event.recipientRole ?? event.sourceService ?? 'System'),
      action: String(event.action ?? event.eventType ?? event.subject ?? 'System Event'),
      entity: String(event.entityType ?? event.channel ?? event.recipientEmail ?? 'System'),
      payload: event,
    };
  });
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const adminKeys = {
  all: ['admin'] as const,
  dashboard: () => [...adminKeys.all, 'dashboard'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: string) => [...adminKeys.users(), id] as const,
  students: (params?: Record<string, unknown>) => [...adminKeys.all, 'students', params ?? {}] as const,
  classes: () => [...adminKeys.all, 'classes'] as const,
  subjects: () => [...adminKeys.all, 'subjects'] as const,
  combinations: () => [...adminKeys.all, 'combinations'] as const,
  pathways: () => [...adminKeys.all, 'pathways'] as const,
  gradingScales: () => [...adminKeys.all, 'grading-scales'] as const,
  assessmentTypes: () => [...adminKeys.all, 'assessment-types'] as const,
  serviceHealth: () => [...adminKeys.all, 'service-health'] as const,
  notifTemplates: () => [...adminKeys.all, 'notif', 'templates'] as const,
  notifTemplate: (id: string) => [...adminKeys.notifTemplates(), id] as const,
  notifLogs: () => [...adminKeys.all, 'notif', 'logs'] as const,
  notifStats: () => [...adminKeys.all, 'notif', 'stats'] as const,
  audit: () => [...adminKeys.all, 'audit'] as const,
  reportJobs: () => [...adminKeys.all, 'report-jobs'] as const,
  systemSettings: () => [...adminKeys.all, 'system', 'settings'] as const,
  featureFlags: () => [...adminKeys.all, 'system', 'feature-flags'] as const,
  academicYears: () => [...adminKeys.all, 'academic-years'] as const,
  terms: () => [...adminKeys.all, 'terms'] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: adminKeys.dashboard(),
    queryFn: () => api.get('/admin/dashboard').then(payloadOf),
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => api.get('/auth/users').then((r) => toAdminUsers(payloadOf(r))),
    staleTime: 30_000,
  });
}

export function useAdminUser(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.user(id ?? ''),
    queryFn: () => api.get(`/auth/users/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

export function useAdminStudents(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: adminKeys.students(params),
    queryFn: () => api.get('/students', { params }).then((r) => toAdminStudents(payloadOf(r))),
    staleTime: 30_000,
  });
}

export function useAdminClasses() {
  return useQuery({
    queryKey: adminKeys.classes(),
    queryFn: () =>
      api.get('/students/classes').then((r) =>
        arrayFromApi(payloadOf(r), ['classes']).map((raw) => {
          const c = raw as Record<string, unknown>;
          const teacherRaw = c.teacher ?? c.classTeacher ?? c.teacherName;
          const teacherObj = teacherRaw && typeof teacherRaw === 'object' ? (teacherRaw as Record<string, unknown>) : undefined;
          const pathwayRaw = c.pathway ?? c.nextClass ?? c.promotionTo;
          const pathwayObj = pathwayRaw && typeof pathwayRaw === 'object' ? (pathwayRaw as Record<string, unknown>) : undefined;
          const studentsRaw = c.students ?? c.studentCount ?? c.totalStudents ?? 0;
          return {
            ...c,
            id: String(c.id ?? crypto.randomUUID()),
            name: String(c.name ?? c.className ?? c.class_name ?? ''),
            level: String(c.level ?? c.formLevel ?? c.classLevel ?? ''),
            stream: String(c.stream ?? c.section ?? c.division ?? ''),
            stage: String(c.stage ?? c.educationStage ?? c.level_type ?? ''),
            curriculum: String(c.curriculum ?? c.curriculumCode ?? ''),
            students: Array.isArray(studentsRaw) ? studentsRaw.length : Number(studentsRaw),
            teacher: String(teacherObj ? (teacherObj.name ?? teacherObj.fullName ?? '') : (teacherRaw ?? '')),
            pathway: String(pathwayObj ? (pathwayObj.name ?? '') : (pathwayRaw ?? '')),
            status: String(c.status ?? (c.isActive === false ? 'INACTIVE' : 'ACTIVE')),
            year: String(c.year ?? c.academicYear ?? ''),
          };
        }),
      ),
    staleTime: 30_000,
  });
}

export function useAdminSubjects() {
  return useQuery({
    queryKey: adminKeys.subjects(),
    queryFn: () =>
      api.get('/academics/subjects').then((r) =>
        arrayFromApi(payloadOf(r), ['subjects']).map((raw) => {
          const s = raw as Record<string, unknown>;
          const deptRaw = s.department ?? s.departmentName ?? s.dept;
          const deptObj = deptRaw && typeof deptRaw === 'object' ? (deptRaw as Record<string, unknown>) : undefined;
          const classesRaw = s.classes ?? s.classCount ?? s.totalClasses ?? 0;
          const teachersRaw = s.teachers ?? s.teacherCount ?? s.totalTeachers ?? 0;
          return {
            ...s,
            id: String(s.id ?? crypto.randomUUID()),
            name: String(s.name ?? s.subjectName ?? ''),
            code: String(s.code ?? s.subjectCode ?? ''),
            stage: String(s.stage ?? s.educationStage ?? s.level ?? ''),
            department: String(deptObj ? (deptObj.name ?? '') : (deptRaw ?? '')),
            status: String(s.status ?? (s.isActive === false ? 'INACTIVE' : 'ACTIVE')),
            classes: Array.isArray(classesRaw) ? classesRaw.length : Number(classesRaw),
            teachers: Array.isArray(teachersRaw) ? teachersRaw.length : Number(teachersRaw),
          };
        }),
      ),
    staleTime: 30_000,
  });
}

export function useSubjectCombinations() {
  return useQuery({
    queryKey: adminKeys.combinations(),
    queryFn: () =>
      api
        .get('/academics/subject-combinations')
        .then((r) => arrayFromApi(payloadOf(r), ['combinations', 'subjectCombinations'])),
    staleTime: 30_000,
  });
}

export function useClassPathways() {
  return useQuery({
    queryKey: adminKeys.pathways(),
    queryFn: () =>
      api.get('/students/class-pathways').then((r) =>
        arrayFromApi(payloadOf(r), ['pathways', 'classPathways']).map((raw) => {
          const p = raw as Record<string, unknown>;
          const fromClass = p.fromClass && typeof p.fromClass === 'object' ? p.fromClass as Record<string, unknown> : undefined;
          const toClass = p.toClass && typeof p.toClass === 'object' ? p.toClass as Record<string, unknown> : undefined;
          const transitionType = String(p.transitionType ?? p.type ?? 'PROMOTION');
          return {
            ...p,
            id: String(p.id ?? `${p.fromClassId ?? p.from}-${p.academicYearId ?? ''}`),
            from: String(p.from ?? fromClass?.name ?? p.fromClassId ?? ''),
            to: String(p.to ?? toClass?.name ?? (transitionType === 'GRADUATION' ? 'Graduation' : 'No class / graduation')),
            type: transitionType.split('_').map((word) => word.charAt(0) + word.slice(1).toLowerCase()).join(' '),
            rule: String(p.rule ?? p.note ?? 'Universal progression mapping'),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function useGradingScales() {
  return useQuery({
    queryKey: adminKeys.gradingScales(),
    queryFn: () =>
      api.get('/academics/grading-scales').then((r) =>
        arrayFromApi(payloadOf(r), ['gradingScales', 'scales']).map((raw) => {
          const s = raw as Record<string, unknown>;
          const grades = Array.isArray(s.grades) ? s.grades : Array.isArray(s.boundaries) ? s.boundaries : [];
          const stage = String(s.educationStage ?? s.stage ?? '');
          const classLevel = s.classLevel === null || s.classLevel === undefined ? '' : String(s.classLevel);
          return {
            ...s,
            id: String(s.id ?? crypto.randomUUID()),
            name: String(s.name ?? ''),
            active: Boolean(s.isActive ?? s.active),
            academicYearId: String(s.academicYearId ?? ''),
            educationStage: stage,
            classLevel,
            subjectId: String(s.subjectId ?? ''),
            scope: String(s.scope ?? [stage.replace('_', '-'), classLevel ? `Level ${classLevel}` : 'All levels'].filter(Boolean).join(' / ')),
            boundaries: grades.map((grade: unknown) => {
              const g = grade as Record<string, unknown>;
              return {
                label: String(g.label ?? g.grade ?? ''),
                min: Number(g.min ?? g.minScore ?? 0),
                max: Number(g.max ?? g.maxScore ?? 0),
                points: Number(g.points ?? 0),
                remark: String(g.remark ?? ''),
                isPassing: Boolean(g.isPassing ?? true),
              };
            }),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function useAssessmentTypes() {
  return useQuery({
    queryKey: adminKeys.assessmentTypes(),
    queryFn: () =>
      api.get('/academics/assessment-types').then((r) =>
        arrayFromApi(payloadOf(r), ['assessmentTypes', 'types']).map((raw) => {
          const t = raw as Record<string, unknown>;
          return {
            ...t,
            id: String(t.id ?? crypto.randomUUID()),
            name: String(t.name ?? ''),
            code: String(t.code ?? ''),
            weight: Number(t.weight ?? t.percentage ?? t.weightPercent ?? t.weightPercentage ?? 0),
            maxScore: Number(t.maxScore ?? t.maximumScore ?? t.max_score ?? 100),
            academicYearId: String(t.academicYearId ?? ''),
            educationStage: String(t.educationStage ?? t.stage ?? ''),
            classLevel: t.classLevel === null || t.classLevel === undefined ? '' : String(t.classLevel),
            subjectId: String(t.subjectId ?? ''),
            isActive: Boolean(t.isActive ?? true),
            scope: String(t.scope ?? t.level ?? t.stageScope ?? t.educationStage ?? ''),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function useServiceHealth() {
  return useQuery({
    queryKey: adminKeys.serviceHealth(),
    queryFn: () => api.get('/admin/system/health').then((r) => toServiceHealth(payloadOf(r))),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: adminKeys.notifTemplates(),
    queryFn: () =>
      api.get('/notifications/templates').then((r) =>
        arrayFromApi(payloadOf(r), ['templates', 'notificationTemplates']).map((raw) => {
          const t = raw as Record<string, unknown>;
          return {
            ...t,
            id: String(t.id ?? ''),
            name: String(t.name ?? t.subject ?? ''),
            channel: String(t.channel ?? t.deliveryChannel ?? ''),
            eventType: String(t.eventType ?? t.event_type ?? t.type ?? ''),
            status: String(t.status ?? (t.isActive === false ? 'INACTIVE' : 'ACTIVE')),
            // normalise date field – API may use updatedAt, updated_at, lastModifiedAt
            lastEdited: String(t.lastEdited ?? t.updatedAt ?? t.updated_at ?? t.lastModifiedAt ?? ''),
            editor: String(t.editor ?? t.updatedBy ?? t.lastModifiedBy ?? ''),
            body: String(t.body ?? t.content ?? t.template ?? ''),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function useNotificationTemplate(id: string | undefined) {
  return useQuery({
    queryKey: adminKeys.notifTemplate(id ?? ''),
    queryFn: () => api.get(`/notifications/templates/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

export function useNotificationLogs() {
  return useQuery({
    queryKey: adminKeys.notifLogs(),
    queryFn: () =>
      api.get('/notifications/logs').then((r) =>
        arrayFromApi(payloadOf(r), ['logs', 'notifications']).map((raw) => {
          const l = raw as Record<string, unknown>;
          return {
            ...l,
            id: String(l.id ?? crypto.randomUUID()),
            time: String(l.time ?? l.createdAt ?? l.sentAt ?? l.timestamp ?? l.deliveredAt ?? ''),
            channel: String(l.channel ?? l.deliveryChannel ?? ''),
            recipient: String(l.recipient ?? l.recipientPhone ?? l.recipientEmail ?? l.recipientName ?? ''),
            eventType: String(l.eventType ?? l.event_type ?? l.type ?? ''),
            status: String(l.status ?? l.deliveryStatus ?? ''),
            attempts: Number(l.attempts ?? l.retryCount ?? 0),
            provider: String(l.provider ?? l.gateway ?? l.providerResponse ?? ''),
          };
        }),
      ),
    staleTime: 15_000,
  });
}

export function useNotificationStats() {
  return useQuery({
    queryKey: adminKeys.notifStats(),
    queryFn: () => api.get('/notifications/stats').then(payloadOf),
    staleTime: 15_000,
  });
}

export function useAdminAuditEvents() {
  return useQuery({
    queryKey: adminKeys.audit(),
    queryFn: () => api.get('/admin/audit/system').then((r) => toAuditEvents(payloadOf(r))),
    staleTime: 15_000,
  });
}

export function useAdminReportJobs() {
  return useQuery({
    queryKey: adminKeys.reportJobs(),
    queryFn: () =>
      api.get('/reports/jobs').then((r) =>
        arrayFromApi(payloadOf(r), ['jobs', 'reportJobs']).map((raw) => {
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
            // normalise created date — API may use createdAt, requestedAt, etc.
            created: String(j.created ?? j.createdAt ?? j.created_at ?? j.requestedAt ?? ''),
          };
        }),
      ),
    staleTime: 15_000,
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: adminKeys.systemSettings(),
    queryFn: () => api.get('/admin/system/settings').then(payloadOf),
    staleTime: 60_000,
  });
}

export function useUpdateSystemSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      api.patch('/admin/system/settings', { settings }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.systemSettings() }),
  });
}

export function useFeatureFlags() {
  return useQuery({
    queryKey: adminKeys.featureFlags(),
    queryFn: () => api.get('/admin/system/feature-flags').then(payloadOf),
    staleTime: 60_000,
  });
}

export function useAcademicYears() {
  return useQuery({
    queryKey: adminKeys.academicYears(),
    queryFn: () => api.get('/students/academic-years').then((r) => arrayFromApi(payloadOf(r), ['academicYears', 'years'])),
    staleTime: 60_000,
  });
}

export function useTerms() {
  return useQuery({
    queryKey: adminKeys.terms(),
    queryFn: () => api.get('/students/terms').then((r) => arrayFromApi(payloadOf(r), ['terms'])),
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useDeactivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/deactivate`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useActivateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/activate`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useChangeUserRoleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/auth/users/${id}/role`, { role }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useUnlockUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/auth/users/${id}/unlock`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useResetUserPwMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/auth/users/${id}/reset-password`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useCreateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/auth/users', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useInviteUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/auth/users/${id}/invite`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useActivateGradingScaleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/academics/grading-scales/${id}/activate`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.gradingScales() }),
  });
}

export function useCreateGradingScaleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/grading-scales', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.gradingScales() }),
  });
}

export function useSaveAssessmentTypesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { rows: Array<Record<string, unknown>>; deactivateIds?: string[] }) => {
      const deactivated = await Promise.all((payload.deactivateIds ?? []).map((id) =>
        api.patch(`/academics/assessment-types/${id}`, { isActive: false }).then((r) => r.data?.data ?? r.data),
      ));
      const saved = await Promise.all(payload.rows.map((row) => {
        const id = String(row.id ?? '');
        const isNew = !id || id.startsWith('new-');
        const body = { ...row };
        delete body.id;
        return isNew
          ? api.post('/academics/assessment-types', body).then((r) => r.data?.data ?? r.data)
          : api.patch(`/academics/assessment-types/${id}`, body).then((r) => r.data?.data ?? r.data);
      }));
      return { saved, deactivated };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.assessmentTypes() }),
  });
}

export function useUpdateNotificationTemplateMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/notifications/templates/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.notifTemplates() }),
  });
}

export function useCreateClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/classes', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.classes() }),
  });
}

export function useCreateClassPathwayMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/class-pathways', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.pathways() });
      qc.invalidateQueries({ queryKey: adminKeys.classes() });
    },
  });
}

export function useUpdateClassMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/students/classes/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.classes() }),
  });
}

export function useCreateSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/subjects', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects() }),
  });
}

export function useUpdateSubjectMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/academics/subjects/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.subjects() }),
  });
}

export function useCreateCombinationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/subject-combinations', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.combinations() }),
  });
}

export function useUpdateCombinationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      api.patch(`/academics/subject-combinations/${id}`, payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.combinations() }),
  });
}

export function useDeleteCombinationMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/academics/subject-combinations/${id}`).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.combinations() }),
  });
}

export function useCreateAcademicYearMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/academic-years', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.academicYears() }),
  });
}

export function useCreateTermMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/terms', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.terms() }),
  });
}

export function useBulkPromoteMutation() {
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students/promotions/bulk', payload).then((r) => r.data?.data ?? r.data),
  });
}

export function useCreateStudentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/students', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.students() }),
  });
}

export function useSendManualNotificationMutation() {
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/notifications/send-manual', payload).then((r) => r.data?.data ?? r.data),
  });
}

export function useBulkImportUsersMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { records: Record<string, string>[] }) =>
      api.post('/auth/users/bulk', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

export function useBulkImportStudentsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { records: Record<string, string>[] }) =>
      api.post('/students/bulk', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...adminKeys.all, 'students'] }),
  });
}

export function useUpdateUserMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/auth/users/${id}`, body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...adminKeys.all, 'users'] }),
  });
}

export function useRunEngineAdminMutation() {
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/analytics/engine/run', body).then((r) => r.data?.data ?? r.data),
  });
}
