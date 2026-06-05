import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

export const principalKeys = {
  all: ['principal'] as const,
  dashboard: () => [...principalKeys.all, 'dashboard'] as const,
  staff: () => [...principalKeys.all, 'staff'] as const,
  studentProfile: (id: string) => [...principalKeys.all, 'students', id] as const,
  students: () => [...principalKeys.all, 'students'] as const,
  settings: () => [...principalKeys.all, 'settings'] as const,
  audit: () => [...principalKeys.all, 'audit'] as const,
  pendingApprovals: () => [...principalKeys.all, 'approvals', 'pending'] as const,
  marksReview: (id: string) => [...principalKeys.all, 'approvals', id, 'marks'] as const,
  publishReadiness: () => [...principalKeys.all, 'publish', 'readiness'] as const,
  classTermResults: (cId: string, tId: string) => [...principalKeys.all, 'results', cId, tId] as const,
  pendingPayments: () => [...principalKeys.all, 'payments', 'pending'] as const,
  discipline: () => [...principalKeys.all, 'discipline'] as const,
  announcements: () => [...principalKeys.all, 'announcements'] as const,
  schoolHealth: () => [...principalKeys.all, 'school', 'health'] as const,
};

// ─── Normalizers ──────────────────────────────────────────────────────────────

/** Coerce a 0–1 fraction or 0–100 integer to a rounded integer 0–100. */
function toScore(v: unknown): number {
  const n = Number(v ?? 0);
  return n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function usePrincipalDashboard() {
  return useQuery({
    queryKey: principalKeys.dashboard(),
    queryFn: () => api.get('/principal/dashboard').then(payloadOf),
  });
}

export function usePrincipalStaff() {
  return useQuery({
    queryKey: principalKeys.staff(),
    queryFn: () =>
      api.get('/principal/staff').then((r) =>
        arrayFromApi(payloadOf(r), ['staff', 'teachers']).map((raw) => {
          const s = raw as Record<string, unknown>;
          const deptRaw = s.department;
          const deptObj = deptRaw && typeof deptRaw === 'object' ? (deptRaw as Record<string, unknown>) : undefined;
          return {
            ...s,
            id: String(s.id ?? crypto.randomUUID()),
            name: String(s.name ?? s.fullName ?? [s.firstName, s.lastName].filter(Boolean).join(' ') ?? ''),
            role: String(s.role ?? s.jobTitle ?? s.position ?? s.title ?? ''),
            department: String(deptObj ? (deptObj.name ?? '') : (deptRaw ?? s.departmentName ?? s.dept ?? '')),
            onTime: Number(s.onTime ?? s.onTimePercentage ?? s.submissionTimeliness ?? s.punctuality ?? 0),
            syllabus: Number(s.syllabus ?? s.syllabusCompletion ?? s.syllabusProgress ?? s.syllabusPercentage ?? 0),
            classes: (() => { const r = s.classes ?? s.classCount ?? s.totalClasses ?? 0; return Array.isArray(r) ? r.length : Number(r); })(),
          };
        }),
      ),
    staleTime: 60_000,
  });
}

export function usePrincipalStudentProfile(studentId: string | undefined) {
  return useQuery({
    queryKey: principalKeys.studentProfile(studentId ?? ''),
    queryFn: () => api.get(`/principal/students/${studentId}/profile`).then(payloadOf),
    enabled: !!studentId,
  });
}

export function usePrincipalStudents() {
  return useQuery({
    queryKey: principalKeys.students(),
    queryFn: () =>
      api.get('/analytics/students').then((r) =>
        arrayFromApi(payloadOf(r), ['students']).map((raw) => {
          const s = raw as Record<string, unknown>;
          const fullName = [s.firstName, s.lastName].filter(Boolean).join(' ').trim();
          const classRaw = s.class;
          const classObj = classRaw && typeof classRaw === 'object' ? (classRaw as Record<string, unknown>) : undefined;
          return {
            ...s,
            id: String(s.id ?? crypto.randomUUID()),
            name: String(s.name ?? s.fullName ?? fullName ?? ''),
            className: String(classObj ? (classObj.name ?? '') : (classRaw ?? s.className ?? s.class_name ?? s.currentClass ?? '')),
            academicAverage: Number(s.academicAverage ?? s.average ?? s.overallAverage ?? s.gpa ?? 0),
            attendance: Number(s.attendance ?? s.attendanceRate ?? s.attendancePercentage ?? 0),
            financeBalance: Number(s.financeBalance ?? s.outstandingBalance ?? s.totalOwed ?? s.balance ?? s.fee_balance ?? 0),
            alertStatus: String(s.alertStatus ?? s.riskLevel ?? s.academicRisk ?? (s.isAtRisk ? 'Watch' : 'Improving')),
            disciplineStatus: String(s.disciplineStatus ?? (s.hasOpenDiscipline ? 'Open' : 'Clear')),
            guardian: String(s.guardian ?? s.guardianPhone ?? s.guardianContact ?? s.parentPhone ?? ''),
          };
        }),
      ),
    staleTime: 30_000,
  });
}

export function usePrincipalSchoolSettings() {
  return useQuery({
    queryKey: principalKeys.settings(),
    queryFn: () => api.get('/principal/settings/school').then(payloadOf),
    staleTime: 60_000,
  });
}

export function usePrincipalAudit() {
  return useQuery({
    queryKey: principalKeys.audit(),
    queryFn: () =>
      api.get('/principal/audit').then((r) =>
        arrayFromApi(payloadOf(r), ['logs', 'auditLogs']).map((raw) => {
          const e = raw as Record<string, unknown>;
          return {
            ...e,
            id: String(e.id ?? crypto.randomUUID()),
            date: String(e.date ?? e.createdAt ?? e.created_at ?? e.timestamp ?? e.time ?? ''),
            actor: String(e.actor ?? e.actorName ?? e.performedBy ?? e.userId ?? ''),
            decision: String(e.decision ?? e.action ?? e.event ?? e.actionType ?? ''),
            entity: String(e.entity ?? e.entityId ?? e.target ?? e.subject ?? ''),
            reason: String(e.reason ?? e.notes ?? e.comment ?? e.description ?? ''),
            correlationId: String(e.correlationId ?? e.correlation_id ?? e.traceId ?? e.requestId ?? ''),
          };
        }),
      ),
    staleTime: 30_000,
  });
}

export function usePendingMarkApprovals() {
  return useQuery({
    queryKey: principalKeys.pendingApprovals(),
    queryFn: () =>
      api.get('/academics/assessments/pending-approval').then((r) =>
        arrayFromApi(payloadOf(r), ['assessments', 'approvals']).map((raw) => {
          const a = raw as Record<string, unknown>;
          const subjectRaw = a.subject;
          const subjectObj = subjectRaw && typeof subjectRaw === 'object' ? (subjectRaw as Record<string, unknown>) : undefined;
          const classRaw = a.class;
          const classObj = classRaw && typeof classRaw === 'object' ? (classRaw as Record<string, unknown>) : undefined;
          return {
            ...a,
            id: String(a.id ?? crypto.randomUUID()),
            assessment: String(a.assessment ?? a.title ?? a.name ?? a.assessmentTitle ?? ''),
            subject: String(subjectObj ? (subjectObj.name ?? '') : (subjectRaw ?? a.subjectName ?? '')),
            className: String(classObj ? (classObj.name ?? '') : (classRaw ?? a.className ?? a.class_name ?? '')),
            teacher: String(a.teacher ?? a.teacherName ?? a.submittedBy ?? ''),
            hodStatus: String(a.hodStatus ?? a.hod_status ?? a.approvalStatus ?? 'READY'),
            average: Number(a.average ?? a.classAverage ?? a.mean ?? 0),
            criticalAlerts: Number(a.criticalAlerts ?? a.critical_alerts ?? a.alertCount ?? 0),
            age: String(a.age ?? a.submittedAt ?? a.timeAgo ?? ''),
            principalStatus: String(a.principalStatus ?? a.principal_status ?? 'PENDING'),
          };
        }),
      ),
  });
}

export function useMarksForApproval(assessmentId: string | undefined) {
  return useQuery({
    queryKey: principalKeys.marksReview(assessmentId ?? ''),
    queryFn: () =>
      api.get(`/academics/assessments/${assessmentId}/marks/review`).then((r) =>
        arrayFromApi(payloadOf(r), ['marks', 'students']).map((raw) => {
          const m = raw as Record<string, unknown>;
          return {
            ...m,
            registration: String(m.registration ?? m.registrationNumber ?? m.admissionNumber ?? m.studentId ?? ''),
            student: String(m.student ?? m.studentName ?? m.name ?? m.fullName ?? ''),
            score: Number(m.score ?? m.marks ?? m.totalScore ?? m.obtainedMarks ?? 0),
            previous: Number(m.previous ?? m.previousScore ?? m.lastScore ?? m.lastMarks ?? 0),
            alert: String(m.alert ?? m.alertStatus ?? m.flag ?? m.remark ?? ''),
          };
        }),
      ),
    enabled: !!assessmentId,
  });
}

export function usePublishReadiness() {
  return useQuery({
    queryKey: principalKeys.publishReadiness(),
    queryFn: () =>
      api.get('/reports/results-publishing/readiness').then((r) =>
        arrayFromApi(payloadOf(r), ['classes', 'readiness', 'results']).map((raw) => {
          const c = raw as Record<string, unknown>;
          const classRaw = c.class;
          const classObj = classRaw && typeof classRaw === 'object' ? (classRaw as Record<string, unknown>) : undefined;
          return {
            ...c,
            id: String(c.id ?? crypto.randomUUID()),
            className: String(classObj ? (classObj.name ?? '') : (classRaw ?? c.className ?? c.class_name ?? c.name ?? '')),
            students: Number(c.students ?? c.studentCount ?? c.totalStudents ?? 0),
            lockedAssessments: Number(c.lockedAssessments ?? c.locked_assessments ?? c.assessmentCount ?? 0),
            missingItems: Number(c.missingItems ?? c.missing_items ?? c.missingCount ?? 0),
            reportCardReadiness: Number(c.reportCardReadiness ?? c.readiness ?? c.completionRate ?? c.readinessPercentage ?? 0),
          };
        }),
      ),
    staleTime: 15_000,
  });
}

export function useClassTermResults(classId: string | undefined, termId: string | undefined) {
  return useQuery({
    queryKey: principalKeys.classTermResults(classId ?? '', termId ?? ''),
    queryFn: () =>
      api
        .get(`/academics/results/class/${classId}/term/${termId}`)
        .then((r) => arrayFromApi(payloadOf(r), ['results', 'students'])),
    enabled: !!classId && !!termId,
  });
}

export function usePrincipalPendingPayments() {
  return useQuery({
    queryKey: principalKeys.pendingPayments(),
    queryFn: () =>
      api.get('/finance/payments/pending-approval').then((r) =>
        arrayFromApi(payloadOf(r), ['payments', 'approvals']).map((raw) => {
          const p = raw as Record<string, unknown>;
          const studentRaw = p.student;
          const studentObj = studentRaw && typeof studentRaw === 'object' ? (studentRaw as Record<string, unknown>) : undefined;
          return {
            ...p,
            id: String(p.id ?? crypto.randomUUID()),
            paymentId: String(p.paymentId ?? p.payment_id ?? p.transactionId ?? p.id ?? ''),
            student: String(studentObj ? (studentObj.name ?? studentObj.fullName ?? '') : (studentRaw ?? p.studentName ?? p.payer ?? '')),
            invoice: String(p.invoice ?? p.invoiceId ?? p.invoiceNumber ?? p.invoice_number ?? ''),
            method: String(p.method ?? p.paymentMethod ?? p.payment_method ?? p.type ?? ''),
            amount: Number(p.amount ?? p.total ?? p.paymentAmount ?? 0),
            reference: String(p.reference ?? p.referenceNumber ?? p.transactionRef ?? p.bankReference ?? ''),
            enteredBy: String(p.enteredBy ?? p.recordedBy ?? p.createdBy ?? p.staffName ?? ''),
            age: String(p.age ?? p.timeAgo ?? p.elapsedTime ?? ''),
            risk: String(p.risk ?? p.riskLevel ?? p.flagLevel ?? 'medium'),
          };
        }),
      ),
  });
}

export function usePrincipalDiscipline() {
  return useQuery({
    queryKey: principalKeys.discipline(),
    queryFn: () =>
      api.get('/students/discipline').then((r) =>
        arrayFromApi(payloadOf(r), ['discipline', 'records']).map((raw) => {
          const d = raw as Record<string, unknown>;
          const studentRaw = d.student;
          const studentObj = studentRaw && typeof studentRaw === 'object' ? (studentRaw as Record<string, unknown>) : undefined;
          return {
            ...d,
            id: String(d.id ?? crypto.randomUUID()),
            student: String(studentObj ? (studentObj.name ?? studentObj.fullName ?? '') : (studentRaw ?? d.studentName ?? '')),
            className: String(d.className ?? d.class ?? d.class_name ?? ''),
            category: String(d.category ?? d.type ?? d.incidentType ?? d.incidentCategory ?? ''),
            severity: String(d.severity ?? d.severityLevel ?? 'medium'),
            date: String(d.date ?? d.incidentDate ?? d.createdAt ?? d.created_at ?? ''),
            description: String(d.description ?? d.details ?? d.notes ?? d.comment ?? ''),
            status: String(d.status ?? (d.isResolved ? 'RESOLVED' : 'OPEN')),
          };
        }),
      ),
    staleTime: 30_000,
  });
}

export function usePrincipalAnnouncements() {
  return useQuery({
    queryKey: principalKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((r) => arrayFromApi(payloadOf(r), ['announcements'])),
    staleTime: 60_000,
  });
}

export function usePrincipalFinanceOverview() {
  return useQuery({
    queryKey: [...principalKeys.all, 'finance', 'overview'] as const,
    queryFn: () =>
      api.get('/analytics/finance/overview').then((r) => {
        const raw = payloadOf(r) as Record<string, unknown>;
        const billing = (raw.billing ?? raw) as Record<string, unknown>;
        const overdue = (raw.overdueAnalysis ?? {}) as Record<string, unknown>;
        const trend = Array.isArray(raw.collectionTrend) ? (raw.collectionTrend as Array<Record<string, unknown>>) : [];
        const byClass = Array.isArray(raw.byClass) ? (raw.byClass as Array<Record<string, unknown>>) : [];
        const daily = Array.isArray(raw.dailyCollectionThisMonth) ? (raw.dailyCollectionThisMonth as Array<Record<string, unknown>>) : [];
        const todayKey = new Date().toISOString().slice(0, 10);
        const todayEntry = daily.find((d) => d.date === todayKey);
        return {
          collectionRate: Number(billing.collectionRate ?? 0),
          totalOutstanding: Number(billing.totalOutstanding ?? overdue.overdueAmount ?? 0),
          totalCollected: Number(billing.totalCollected ?? 0),
          todayCollection: Number(todayEntry?.amount ?? 0),
          overdueCount: Number(overdue.overdueCount ?? 0),
          collectionTrend: trend.map((t) => Number(t.rate ?? 0)),
          byClass: byClass.map((c) => ({ label: String(c.className ?? ''), value: Number(c.overdueCount ?? 0) })),
        };
      }),
    staleTime: 30_000,
  });
}

export function usePrincipalSchoolHealth() {
  return useQuery({
    queryKey: principalKeys.schoolHealth(),
    queryFn: () =>
      api.get('/analytics/overview').then((r) => {
        const raw = payloadOf(r) as Record<string, unknown>;
        return {
          score: toScore(raw.score ?? raw.overallPassRate ?? raw.schoolAverage ?? raw.average ?? 0),
          academic: toScore(raw.academic ?? raw.academicScore ?? raw.schoolAverage ?? raw.averageScore ?? raw.overallPassRate ?? 0),
          finance: toScore(raw.finance ?? raw.financeScore ?? raw.collectionRate ?? raw.feeCollectionRate ?? 0),
          operations: toScore(raw.operations ?? raw.operationsScore ?? raw.attendanceRate ?? 0),
          trend: Number(raw.trend ?? raw.trendValue ?? raw.weeklyTrend ?? 0),
        };
      }),
    staleTime: 30_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useApprovePrincipalAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      api.patch(`/academics/assessments/${id}/approve`, { comment }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingApprovals() }),
  });
}

export function useRejectPrincipalAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/academics/assessments/${id}/reject`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingApprovals() }),
  });
}

export function usePublishResultsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/academics/results/publish', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.publishReadiness() }),
  });
}

export function useApprovePaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.patch(`/finance/payments/approvals/${id}/approve`, { notes }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingPayments() }),
  });
}

export function useRejectPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/finance/payments/approvals/${id}/reject`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingPayments() }),
  });
}

export function useResolveDisciplineMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      api.patch(`/students/discipline/${id}/resolve`, { resolution }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.discipline() }),
  });
}

export function useCreatePrincipalAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: unknown) =>
      api.post('/notifications/announcements', payload).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.announcements() }),
  });
}

// ─── Operations-controller mutations ─────────────────────────────────────────
// These hit the dedicated operations store routes that write immutable audit events.

export function useLockMarksMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, reason }: { assessmentId: string; reason?: string }) =>
      api.patch(`/principal/approvals/marks/${assessmentId}/lock`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingApprovals() }),
  });
}

export function useReturnMarksMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assessmentId, reason }: { assessmentId: string; reason: string }) =>
      api.patch(`/principal/approvals/marks/${assessmentId}/return`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.pendingApprovals() }),
  });
}

export function useSignReportCardMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, signatureText }: { id: string; signatureText: string }) =>
      api.post(`/principal/report-cards/${id}/sign`, { signatureText }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.publishReadiness() }),
  });
}

export function usePatchSchoolSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) =>
      api.patch('/principal/settings/school', settings).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: principalKeys.settings() }),
  });
}
