import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

export const hodKeys = {
  all: ['hod'] as const,
  dashboard: () => [...hodKeys.all, 'dashboard'] as const,
  pendingApprovals: () => [...hodKeys.all, 'approvals', 'pending'] as const,
  approvalHistory: () => [...hodKeys.all, 'approvals', 'history'] as const,
  marksReview: (assessmentId: string) => [...hodKeys.all, 'marks', 'review', assessmentId] as const,
  classSubjects: () => [...hodKeys.all, 'class-subjects'] as const,
  teachersList: () => [...hodKeys.all, 'teachers', 'performance'] as const,
  teacherDetail: (teacherId: string) => [...hodKeys.teachersList(), teacherId] as const,
  alerts: () => [...hodKeys.all, 'alerts'] as const,
  pairings: () => [...hodKeys.all, 'pairings'] as const,
  interventions: () => [...hodKeys.all, 'interventions'] as const,
  studentPerformance: (studentId: string) => [...hodKeys.all, 'students', studentId, 'performance'] as const,
  audit: () => [...hodKeys.all, 'audit'] as const,
  announcements: () => [...hodKeys.all, 'announcements'] as const,
};

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useHodDashboard() {
  return useQuery({
    queryKey: hodKeys.dashboard(),
    queryFn: () => api.get('/hod/dashboard').then(payloadOf),
  });
}

export function useHodPendingApprovals() {
  return useQuery({
    queryKey: hodKeys.pendingApprovals(),
    queryFn: () =>
      api
        .get('/academics/assessments/pending-approval')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['assessments', 'approvals']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              assessment: String(a.assessment ?? a.title ?? a.name ?? ''),
              subject: resolve(a.subject ?? a.subjectName),
              className: resolve(a.className ?? a.class ?? a.class_name),
              teacher: resolve(a.teacher ?? a.teacherName ?? a.submittedBy),
              status: String(a.status ?? a.approvalStatus ?? 'PENDING'),
              average: Number(a.average ?? a.classAverage ?? a.mean ?? 0),
              criticalAlerts: Number(a.criticalAlerts ?? a.critical_alerts ?? a.alertCount ?? 0),
              age: String(a.age ?? a.submittedAt ?? a.timeAgo ?? ''),
            };
          }),
        ),
  });
}

export function useHodApprovalHistory() {
  return useQuery({
    queryKey: hodKeys.approvalHistory(),
    queryFn: () =>
      api
        .get('/hod/approvals/history')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['approvals', 'history']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              assessment: String(a.assessment ?? a.title ?? a.name ?? ''),
              subject: resolve(a.subject ?? a.subjectName),
              className: resolve(a.className ?? a.class ?? a.class_name),
              teacher: resolve(a.teacher ?? a.teacherName ?? a.submittedBy),
              average: Number(a.average ?? a.classAverage ?? a.mean ?? 0),
              submittedHoursAgo: Number(a.submittedHoursAgo ?? a.hoursAgo ?? a.age ?? 0),
              type: String(a.type ?? a.assessmentType ?? ''),
              marked: Number(a.marked ?? a.marksEntered ?? 0),
              students: Number(a.students ?? a.studentCount ?? a.totalStudents ?? 0),
              highest: Number(a.highest ?? a.maxScore ?? 0),
              lowest: Number(a.lowest ?? a.minScore ?? 0),
              riskFlags: Array.isArray(a.riskFlags) ? (a.riskFlags as unknown[]).map(String) : [],
            };
          }),
        ),
  });
}

export function useMarksApprovalReview(assessmentId: string) {
  return useQuery({
    queryKey: hodKeys.marksReview(assessmentId),
    queryFn: () =>
      api.get(`/academics/assessments/${assessmentId}/marks/review`).then((r) =>
        arrayFromApi(payloadOf(r), ['marks', 'students']).map((raw) => {
          const m = raw as Record<string, unknown>;
          const resolve = (v: unknown): string => {
            if (!v || typeof v !== 'object') return String(v ?? '');
            const o = v as Record<string, unknown>;
            return String(o.name ?? o.fullName ?? o.label ?? '');
          };
          const rawScore = m.score ?? m.mark ?? m.marks;
          return {
            ...m,
            id: String(m.id ?? crypto.randomUUID()),
            student: resolve(m.student ?? m.studentName ?? m.name),
            registration: String(m.registration ?? m.registrationNumber ?? m.admissionNumber ?? m.studentId ?? ''),
            score: rawScore == null ? null : Number(rawScore),
            maxScore: Number(m.maxScore ?? m.max_score ?? m.totalMarks ?? 100),
            absent: Boolean(m.absent ?? m.isAbsent ?? false),
            note: String(m.note ?? m.notes ?? m.remark ?? m.comment ?? ''),
          };
        }),
      ),
    enabled: Boolean(assessmentId),
  });
}

export function useHodClassSubjects() {
  return useQuery({
    queryKey: hodKeys.classSubjects(),
    queryFn: () =>
      api
        .get('/academics/class-subjects')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['classSubjects', 'classes']).map((raw) => {
            const c = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...c,
              id: String(c.id ?? crypto.randomUUID()),
              name: resolve(c.name ?? c.subjectName ?? c.subject),
              teacher: resolve(c.teacher ?? c.teacherName ?? c.assignedTeacher),
              average: Number(c.average ?? c.classAverage ?? c.averageScore ?? 0),
              change: Number(c.change ?? c.changePercent ?? c.trend ?? 0),
              atRisk: Number(c.atRisk ?? c.at_risk ?? c.atRiskCount ?? c.riskCount ?? 0),
              syllabus: Number(c.syllabus ?? c.syllabusCompletion ?? c.syllabusProgress ?? 0),
              alerts: Number(c.alerts ?? c.alertCount ?? c.totalAlerts ?? 0),
              tone: String(c.tone ?? c.riskLevel ?? c.status ?? 'blue'),
            };
          }),
        ),
  });
}

export function useHodTeachersList() {
  return useQuery({
    queryKey: hodKeys.teachersList(),
    queryFn: () =>
      api
        .get('/hod/teachers/performance')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['teachers', 'performance']).map((raw) => {
            const t = raw as Record<string, unknown>;
            const fullName = [t.firstName, t.lastName].filter(Boolean).join(' ').trim();
            const deptRaw = t.department ?? t.departmentName ?? t.dept;
            const deptObj = deptRaw && typeof deptRaw === 'object' ? (deptRaw as Record<string, unknown>) : undefined;
            const classesRaw = t.classes ?? t.classCount ?? t.totalClasses ?? 0;
            return {
              ...t,
              id: String(t.id ?? crypto.randomUUID()),
              name: String(t.name ?? t.fullName ?? fullName ?? ''),
              role: String(t.role ?? t.jobTitle ?? t.position ?? ''),
              department: String(deptObj ? (deptObj.name ?? '') : (deptRaw ?? '')),
              onTime: Number(t.onTime ?? t.onTimePercentage ?? t.submissionTimeliness ?? 0),
              syllabus: Number(t.syllabus ?? t.syllabusCompletion ?? t.syllabusProgress ?? 0),
              classes: Array.isArray(classesRaw) ? classesRaw.length : Number(classesRaw),
            };
          }),
        ),
  });
}

export function useHodTeacherDetail(teacherId: string) {
  return useQuery({
    queryKey: hodKeys.teacherDetail(teacherId),
    queryFn: () => api.get(`/hod/teachers/${teacherId}/performance`).then(payloadOf),
    enabled: Boolean(teacherId),
  });
}

export function useHodAlerts() {
  return useQuery({
    queryKey: hodKeys.alerts(),
    queryFn: () =>
      api
        .get('/academics/performance/alerts')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['alerts', 'performanceAlerts']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolve(a.student ?? a.studentName),
              subject: resolve(a.subject ?? a.subjectName),
              className: resolve(a.className ?? a.class ?? a.class_name),
              reason: String(a.reason ?? a.description ?? a.message ?? ''),
              severity: String(a.severity ?? a.alertLevel ?? a.level ?? ''),
              type: String(a.type ?? a.alertType ?? ''),
              studentId: String(a.studentId ?? a.student_id ?? a.id ?? ''),
              action: String(a.action ?? a.recommendedAction ?? a.nextAction ?? 'Review'),
            };
          }),
        ),
  });
}

export function useHodPairings() {
  return useQuery({
    queryKey: hodKeys.pairings(),
    queryFn: () =>
      api
        .get('/academics/performance/pairings')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['pairings']).map((raw) => {
            const p = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...p,
              id: String(p.id ?? crypto.randomUUID()),
              mentor: resolve(p.mentor ?? p.mentorName),
              support: resolve(p.support ?? p.supportName ?? p.student ?? p.studentName),
              subject: resolve(p.subject ?? p.subjectName),
              className: resolve(p.className ?? p.class ?? p.class_name),
              benefit: String(p.benefit ?? p.reason ?? p.pairingReason ?? p.description ?? ''),
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              outcome: String(p.outcome ?? p.pairingOutcome ?? p.result ?? p.status ?? ''),
              status: String(p.status ?? p.pairingStatus ?? 'SUGGESTED'),
            };
          }),
        ),
  });
}

export function useHodInterventions() {
  return useQuery({
    queryKey: hodKeys.interventions(),
    queryFn: () =>
      api
        .get('/academics/interventions')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['interventions']).map((raw) => {
            const i = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...i,
              id: String(i.id ?? crypto.randomUUID()),
              student: resolve(i.student ?? i.studentName),
              subject: resolve(i.subject ?? i.subjectName),
              className: resolve(i.className ?? i.class ?? i.class_name),
              age: String(i.age ?? i.createdAt ?? i.created_at ?? i.timeAgo ?? ''),
              type: String(i.type ?? i.interventionType ?? ''),
              note: String(i.note ?? i.notes ?? i.description ?? ''),
              status: String(i.status ?? i.interventionStatus ?? 'FOLLOW_UP_REQUIRED'),
            };
          }),
        ),
  });
}

export function useHodStudentPerformance(studentId: string) {
  return useQuery({
    queryKey: hodKeys.studentPerformance(studentId),
    queryFn: () => api.get(`/academics/performance/student/${studentId}`).then(payloadOf),
    enabled: Boolean(studentId),
  });
}

export function useHodAudit() {
  return useQuery({
    queryKey: hodKeys.audit(),
    queryFn: () =>
      api.get('/hod/audit').then((r) => arrayFromApi(payloadOf(r), ['logs', 'auditLogs'])),
  });
}

export function useHodAnnouncements() {
  return useQuery({
    queryKey: hodKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((r) => arrayFromApi(payloadOf(r), ['announcements'])),
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useApproveAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/assessments/${id}/approve`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pendingApprovals() }),
  });
}

export function useRejectAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/assessments/${id}/reject`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pendingApprovals() }),
  });
}

export function useResolveHodAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/alerts/${id}/resolve`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.alerts() }),
  });
}

export function useActivateHodPairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/pairings/${id}/activate`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pairings() }),
  });
}

export function useCreateHodInterventionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/academics/interventions', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.interventions() }),
  });
}

export function useCreateHodAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/notifications/announcements', body).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.announcements() }),
  });
}
