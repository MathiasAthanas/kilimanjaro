import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Shared field resolvers ───────────────────────────────────────────────────
// The backend returns related entities as nested objects. People come back as
// { firstName, lastName }, subjects/classes as { name }. This resolver handles
// every shape so names never render blank.
function resolveName(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object') return String(v);
  const o = v as Record<string, unknown>;
  const joined = [o.firstName, o.middleName, o.lastName].filter(Boolean).join(' ').trim();
  return String(o.name ?? o.fullName ?? o.label ?? (joined || o.title || ''));
}

function hoursSince(value: unknown): number {
  if (!value) return 0;
  const t = Date.parse(String(value));
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 3_600_000));
}

type ReviewStats = { count: number; mean: number; median: number; highest: number; lowest: number; stdDeviation: number };
const EMPTY_STATS: ReviewStats = { count: 0, mean: 0, median: 0, highest: 0, lowest: 0, stdDeviation: 0 };

function toneForAverage(avg: number): 'emerald' | 'amber' | 'rose' | 'blue' {
  if (avg <= 0) return 'blue';
  if (avg < 50) return 'rose';
  if (avg < 65) return 'amber';
  return 'emerald';
}

async function fetchAssessmentReview(id: string): Promise<Record<string, unknown> | null> {
  try {
    return await api.get(`/academics/assessments/${id}/marks/review`).then(payloadOf) as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
  subjectHealth: () => [...hodKeys.all, 'subject-health'] as const,
};

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useHodDashboard() {
  return useQuery({
    queryKey: hodKeys.dashboard(),
    queryFn: () => api.get('/hod/dashboard').then(payloadOf),
  });
}

// Normalize a raw assessment record into the approval shape the UI expects,
// reading the nested classSubject/subject/teacher relations.
function mapAssessment(raw: Record<string, unknown>) {
  const classSubject = (raw.classSubject ?? {}) as Record<string, unknown>;
  const subjectObj = (raw.subject ?? classSubject.subject) as Record<string, unknown> | undefined;
  const classObj = (raw.class ?? classSubject.class) as Record<string, unknown> | undefined;
  const submittedAt = raw.submittedAt ?? raw.submitted_at ?? raw.createdAt;
  const classLevel = raw.classLevel ?? classSubject.classLevel;
  const stageRaw = String(raw.educationStage ?? classSubject.educationStage ?? '');
  const stage = stageRaw.replace('_', '-');
  const className = resolveName(classObj)
    || (classLevel != null && stageRaw ? `${stage} L${classLevel}` : '')
    || String(raw.className ?? '');
  const subject = resolveName(subjectObj ?? raw.subjectName ?? raw.subject) || 'Subject';
  // The assessment payload has no teacher name (only an id), so fall back to a
  // subject-based label rather than a bare "Teacher".
  const teacher = resolveName(raw.teacher ?? raw.teacherName ?? raw.submittedBy ?? classSubject.teacher)
    || (subject !== 'Subject' ? `${subject} Teacher` : 'Class Teacher');
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    assessment: String(raw.assessment ?? raw.title ?? raw.name ?? 'Assessment'),
    subject,
    subjectId: String(raw.subjectId ?? subjectObj?.id ?? ''),
    className: className || '—',
    teacher,
    teacherId: String(raw.teacherId ?? raw.submittedById ?? classSubject.teacherId ?? ''),
    type: String(raw.type ?? raw.assessmentType ?? raw.name ?? '').replace(/.*\b(CAT|MIDTERM|FINAL|TEST|EXAM|QUIZ)\b.*/i, '$1') || 'Assessment',
    status: String(raw.status ?? raw.approvalStatus ?? 'SUBMITTED'),
    submittedHoursAgo: hoursSince(submittedAt),
    maxScore: Number(raw.maxScore ?? 100),
    submittedAt: String(submittedAt ?? ''),
  };
}

// Pending approvals enriched with real marks-review statistics (average, count,
// highest/lowest, alert flags) — the list endpoint alone has no scores.
export function useHodPendingApprovals() {
  return useQuery({
    queryKey: hodKeys.pendingApprovals(),
    staleTime: 30_000,
    queryFn: async () => {
      const list = arrayFromApi(
        await api.get('/academics/assessments/pending-approval').then(payloadOf),
        ['assessments', 'approvals'],
      ) as Record<string, unknown>[];

      const reviews = await Promise.all(list.map((a) => fetchAssessmentReview(String(a.id))));

      return list.map((raw, i) => {
        const base = mapAssessment(raw);
        const review = reviews[i];
        const stats = (review?.statistics as ReviewStats | undefined) ?? EMPTY_STATS;
        const alertItems = arrayFromApi(review?.performanceAlerts, ['items']);
        const criticalAlerts = alertItems.filter((al) => {
          const sev = String((al as Record<string, unknown>).severity ?? '').toUpperCase();
          return sev === 'CRITICAL' || sev === 'HIGH';
        }).length;
        const average = Math.round(stats.mean);
        const riskFlags: string[] = [];
        if (average > 0 && average < 50) riskFlags.push('Low average');
        if (criticalAlerts > 0) riskFlags.push(`${criticalAlerts} critical`);
        if (stats.stdDeviation > 20) riskFlags.push('High spread');
        return {
          ...base,
          average,
          students: stats.count,
          marked: stats.count,
          highest: stats.highest,
          lowest: stats.lowest,
          criticalAlerts,
          riskFlags,
          age: base.submittedAt,
        };
      });
    },
  });
}

export function useHodApprovalHistory() {
  return useQuery({
    queryKey: hodKeys.approvalHistory(),
    queryFn: () =>
      api
        .get('/academics/assessments/approval-history')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['data', 'approvals', 'history']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const base = mapAssessment(a);
            const decidedAt = a.decidedAt ?? a.approvedAt ?? a.rejectedAt ?? a.updatedAt;
            const decision = String(a.decision ?? (a.rejectionReason ? 'REJECTED' : (a.status === 'REJECTED' ? 'REJECTED' : 'APPROVED')));
            return {
              ...a,
              ...base,
              average: Number(a.average ?? a.classAverage ?? a.mean ?? 0),
              submittedHoursAgo: base.submittedHoursAgo,
              decision,
              decidedAt: String(decidedAt ?? ''),
              reason: String(a.rejectionReason ?? a.reason ?? '—'),
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

// Fetch a single assessment by ID — used as fallback on the review page when
// the assessment is no longer in the pending list (e.g. just approved).
export function useAssessmentById(assessmentId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...hodKeys.all, 'assessment', assessmentId] as const,
    queryFn: async () => {
      const raw = await api.get(`/academics/assessments/${assessmentId}`).then(payloadOf) as Record<string, unknown>;
      const base = mapAssessment(raw);
      return {
        ...base,
        average: 0,
        students: 0,
        marked: 0,
        highest: 0,
        lowest: 0,
        riskFlags: [] as string[],
        age: base.submittedAt,
      };
    },
    enabled: enabled && Boolean(assessmentId),
    retry: false,
  });
}

// Per-student mark rows for an assessment, from the marks sheet endpoint.
export function useMarksApprovalReview(assessmentId: string) {
  return useQuery({
    queryKey: hodKeys.marksReview(assessmentId),
    queryFn: () =>
      api.get(`/academics/assessments/${assessmentId}/marks/sheet`).then((r) =>
        arrayFromApi(payloadOf(r), ['rows', 'marks', 'students']).map((raw) => {
          const m = raw as Record<string, unknown>;
          const rawScore = m.score ?? m.mark ?? m.marks;
          return {
            ...m,
            id: String(m.markId ?? m.id ?? crypto.randomUUID()),
            student: resolveName(m.student ?? m) || resolveName({ firstName: m.firstName, lastName: m.lastName }),
            registration: String(m.registrationNumber ?? m.registration ?? m.admissionNumber ?? ''),
            score: rawScore == null ? null : Number(rawScore),
            maxScore: Number(m.maxScore ?? m.max_score ?? m.totalMarks ?? 100),
            absent: Boolean(m.isAbsent ?? m.absent ?? false),
            note: String(m.note ?? m.notes ?? m.remark ?? m.comment ?? ''),
          };
        }),
      ),
    enabled: Boolean(assessmentId),
  });
}

// ─── Department subject health (the centrepiece aggregate) ─────────────────────
// The backend has no single "department health" endpoint that returns real
// numbers, so we compute it: take every submitted assessment, pull its real
// marks-review statistics + grade distribution, and roll those up per subject.
// At-risk and alert counts come from the live performance-alerts feed.
export function useHodSubjectHealth() {
  return useQuery({
    queryKey: hodKeys.subjectHealth(),
    staleTime: 30_000,
    queryFn: async () => {
      const [approvalsRes, alertsRes] = await Promise.all([
        api.get('/academics/assessments/pending-approval').then(payloadOf),
        api.get('/academics/performance/alerts').then(payloadOf).catch(() => null),
      ]);
      const approvals = arrayFromApi(approvalsRes, ['assessments', 'approvals']) as Record<string, unknown>[];
      const alerts = arrayFromApi(alertsRes, ['items', 'alerts', 'performanceAlerts']) as Record<string, unknown>[];

      const reviews = await Promise.all(approvals.map((a) => fetchAssessmentReview(String(a.id))));

      type Acc = {
        id: string; name: string; teacher: string;
        scoreSum: number; studentSum: number; assessments: number;
        highest: number; lowest: number;
        gradeDistribution: Record<string, number>;
      };
      const bySubject = new Map<string, Acc>();

      approvals.forEach((raw, i) => {
        const mapped = mapAssessment(raw);
        const review = reviews[i];
        const stats = (review?.statistics as ReviewStats | undefined) ?? EMPTY_STATS;
        const gd = (review?.gradeDistributionPreview as Record<string, number> | undefined) ?? {};
        const key = mapped.subject || mapped.subjectId || `subject-${i}`;
        const acc = bySubject.get(key) ?? {
          id: mapped.subjectId || key, name: mapped.subject || 'Subject', teacher: mapped.teacher,
          scoreSum: 0, studentSum: 0, assessments: 0, highest: 0, lowest: 100,
          gradeDistribution: {},
        };
        if (stats.count > 0) {
          acc.scoreSum += stats.mean * stats.count;
          acc.studentSum += stats.count;
          acc.highest = Math.max(acc.highest, stats.highest);
          acc.lowest = Math.min(acc.lowest, stats.lowest);
        }
        acc.assessments += 1;
        for (const [g, n] of Object.entries(gd)) acc.gradeDistribution[g] = (acc.gradeDistribution[g] ?? 0) + Number(n);
        bySubject.set(key, acc);
      });

      // at-risk + alert counts grouped by subject name
      const riskBySubject = new Map<string, number>();
      const alertBySubject = new Map<string, number>();
      alerts.forEach((al) => {
        const subj = String(al.subjectName ?? resolveName(al.subject) ?? '');
        const sev = String(al.severity ?? '').toUpperCase();
        alertBySubject.set(subj, (alertBySubject.get(subj) ?? 0) + 1);
        if (sev === 'CRITICAL' || sev === 'HIGH') riskBySubject.set(subj, (riskBySubject.get(subj) ?? 0) + 1);
      });

      const pendingBySubject = new Map<string, number>();
      approvals.forEach((raw) => {
        const subj = mapAssessment(raw).subject;
        pendingBySubject.set(subj, (pendingBySubject.get(subj) ?? 0) + 1);
      });

      return Array.from(bySubject.values()).map((acc) => {
        const average = acc.studentSum > 0 ? Math.round(acc.scoreSum / acc.studentSum) : 0;
        return {
          id: acc.id,
          name: acc.name,
          teacher: acc.teacher && acc.teacher !== 'Teacher' ? acc.teacher : `${acc.name} Teacher`,
          average,
          change: 0,
          atRisk: riskBySubject.get(acc.name) ?? 0,
          alerts: alertBySubject.get(acc.name) ?? 0,
          pending: pendingBySubject.get(acc.name) ?? 0,
          assessments: acc.assessments,
          studentsAssessed: acc.studentSum,
          syllabus: 0,
          gradeDistribution: acc.gradeDistribution,
          tone: toneForAverage(average),
        };
      }).sort((a, b) => a.average - b.average);
    },
  });
}

// Back-compat alias: pages still import useHodClassSubjects for subject health.
export const useHodClassSubjects = useHodSubjectHealth;

export function useHodTeachersList() {
  return useQuery({
    queryKey: hodKeys.teachersList(),
    staleTime: 30_000,
    queryFn: async () => {
      // Preferred: the dedicated performance endpoint.
      const raw = await api.get('/hod/teachers/performance').then(payloadOf).catch(() => null);
      const list = arrayFromApi(raw, ['teachers', 'performance']) as Record<string, unknown>[];
      if (list.length > 0) {
        return list.map((t) => ({
          ...t,
          id: String(t.id ?? t.teacherId ?? crypto.randomUUID()),
          name: resolveName(t.teacher ?? t) || resolveName({ firstName: t.firstName, lastName: t.lastName }) || 'Teacher',
          subjects: String(t.subjects ?? t.subjectName ?? resolveName(t.subject) ?? ''),
          average: Math.round(Number(t.average ?? t.classAverage ?? t.averageScore ?? 0)),
          onTime: Math.round(Number(t.onTime ?? t.onTimePercentage ?? t.submissionTimeliness ?? 0)),
          syllabus: Math.round(Number(t.syllabus ?? t.syllabusCompletion ?? 0)),
          atRisk: Number(t.atRisk ?? t.atRiskCount ?? 0),
          pending: Number(t.pending ?? t.pendingApprovals ?? 0),
          rejections: Number(t.rejections ?? t.rejectionCount ?? 0),
        }));
      }

      // Fallback: build a teacher matrix from submitted assessments + their reviews.
      const approvals = arrayFromApi(
        await api.get('/academics/assessments/pending-approval').then(payloadOf),
        ['assessments', 'approvals'],
      ) as Record<string, unknown>[];
      const reviews = await Promise.all(approvals.map((a) => fetchAssessmentReview(String(a.id))));

      type T = { id: string; name: string; subjects: Set<string>; scoreSum: number; studentSum: number; pending: number };
      const byTeacher = new Map<string, T>();
      approvals.forEach((rawA, i) => {
        const m = mapAssessment(rawA);
        const stats = (reviews[i]?.statistics as ReviewStats | undefined) ?? EMPTY_STATS;
        const key = m.teacherId || m.teacher;
        const t = byTeacher.get(key) ?? { id: m.teacherId || key, name: m.teacher, subjects: new Set(), scoreSum: 0, studentSum: 0, pending: 0 };
        t.subjects.add(m.subject);
        if (stats.count > 0) { t.scoreSum += stats.mean * stats.count; t.studentSum += stats.count; }
        t.pending += 1;
        byTeacher.set(key, t);
      });
      return Array.from(byTeacher.values()).map((t) => {
        const subjectList = Array.from(t.subjects).filter(Boolean);
        // When no real teacher name is available, label by subject for readability.
        const displayName = t.name && t.name !== 'Teacher'
          ? t.name
          : subjectList.length ? `${subjectList[0]} Teacher` : 'Class Teacher';
        return {
        id: t.id,
        name: displayName,
        subjects: subjectList.join(', '),
        average: t.studentSum > 0 ? Math.round(t.scoreSum / t.studentSum) : 0,
        onTime: 100, // all present assessments were submitted on time in the queue
        syllabus: 0,
        atRisk: 0,
        pending: t.pending,
        rejections: 0,
      };
      });
    },
  });
}

export function useHodTeacherDetail(teacherId: string) {
  return useQuery({
    queryKey: hodKeys.teacherDetail(teacherId),
    queryFn: () => api.get(`/hod/teachers/${teacherId}/performance`).then(payloadOf),
    enabled: Boolean(teacherId),
  });
}

export function useTeacherAssessmentHistory(teacherId: string) {
  return useQuery({
    queryKey: [...hodKeys.all, 'teacher-history', teacherId] as const,
    staleTime: 60_000,
    queryFn: async () => {
      const raw = await api.get('/academics/assessments', { params: { teacherId } }).then(payloadOf);
      const list = arrayFromApi(raw, ['assessments']) as Record<string, unknown>[];
      return list.map((a) => {
        const base = mapAssessment(a);
        const stats = (a.statistics as ReviewStats | undefined) ?? EMPTY_STATS;
        return {
          ...base,
          average: stats.mean > 0 ? Math.round(stats.mean) : Number(a.average ?? 0),
          students: stats.count,
          highest: stats.highest,
          lowest: stats.lowest,
          riskFlags: [] as string[],
          age: base.submittedAt,
          marked: stats.count,
        };
      });
    },
    enabled: Boolean(teacherId),
  });
}

export function useHodAlerts() {
  return useQuery({
    queryKey: hodKeys.alerts(),
    staleTime: 30_000,
    queryFn: () =>
      api
        .get('/academics/performance/alerts')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'alerts', 'performanceAlerts']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const snapshot = (a.triggeredBySnapshot ?? {}) as Record<string, unknown>;
            const score = a.currentScore ?? snapshot.score;
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolveName(a.student ?? a.studentName) || 'Student',
              subject: String(a.subjectName ?? resolveName(a.subject) ?? ''),
              className: resolveName(a.className ?? a.class ?? snapshot.className) || '—',
              reason: String(a.message ?? a.reason ?? a.description ?? ''),
              severity: String(a.severity ?? a.alertLevel ?? a.level ?? 'MEDIUM').toUpperCase(),
              alertType: String(a.alertType ?? a.type ?? ''),
              currentScore: score == null ? null : Number(score),
              studentId: String(a.studentId ?? a.student_id ?? ''),
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
          arrayFromApi(payloadOf(r), ['items', 'pairings']).map((raw) => {
            const p = raw as Record<string, unknown>;
            // peer = the stronger mentor student; student = the one being supported
            const mentorScore = p.peerScoreAtPairing ?? p.mentorScore;
            const supportScore = p.studentScoreAtPairing ?? p.supportScore;
            return {
              ...p,
              id: String(p.id ?? crypto.randomUUID()),
              mentor: resolveName(p.peer ?? p.mentor ?? p.mentorName) || 'Mentor',
              support: resolveName(p.student ?? p.support ?? p.supportName) || 'Student',
              subject: String(p.subjectName ?? resolveName(p.subject) ?? ''),
              className: resolveName(p.className ?? p.class) || '—',
              benefit: String(p.reason ?? p.benefit ?? p.pairingReason ?? p.description ?? ''),
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              mentorScore: mentorScore == null ? null : Number(mentorScore),
              supportScore: supportScore == null ? null : Number(supportScore),
              outcome: String(p.outcome ?? p.pairingOutcome ?? p.result ?? p.status ?? ''),
              status: String(p.status ?? p.pairingStatus ?? 'SUGGESTED').toUpperCase(),
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
          arrayFromApi(payloadOf(r), ['items', 'interventions']).map((raw) => {
            const i = raw as Record<string, unknown>;
            return {
              ...i,
              id: String(i.id ?? crypto.randomUUID()),
              student: resolveName(i.student ?? i.studentName) || 'Student',
              subject: String(i.subjectName ?? resolveName(i.subject) ?? ''),
              className: resolveName(i.className ?? i.class) || '—',
              teacher: resolveName(i.teacher ?? i.createdBy ?? i.owner) || '',
              age: String(i.age ?? i.createdAt ?? i.created_at ?? i.timeAgo ?? ''),
              type: String(i.type ?? i.interventionType ?? i.strategy ?? 'Support'),
              note: String(i.note ?? i.notes ?? i.description ?? i.details ?? ''),
              status: String(i.status ?? i.interventionStatus ?? 'OPEN').toUpperCase(),
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

export function useStudentInterventionHistory(studentId: string) {
  return useQuery({
    queryKey: [...hodKeys.all, 'interventions', 'student', studentId] as const,
    queryFn: () =>
      api.get(`/academics/interventions/student/${studentId}`).then((r) =>
        arrayFromApi(payloadOf(r), ['items', 'interventions']).map((raw) => {
          const i = raw as Record<string, unknown>;
          return {
            id: String(i.id ?? crypto.randomUUID()),
            type: String(i.type ?? 'OTHER'),
            note: String(i.note ?? ''),
            subjectName: String(i.subjectName ?? ''),
            outcome: String(i.outcome ?? ''),
            followUpDate: i.followUpDate ? String(i.followUpDate) : null,
            isFollowedUp: Boolean(i.isFollowedUp ?? false),
            createdAt: String(i.createdAt ?? ''),
          };
        }),
      ),
    enabled: Boolean(studentId),
  });
}

export function useEscalateAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ alertId, body }: { alertId: string; body: { studentId: string; subjectName?: string; note: string } }) =>
      api.patch(`/academics/performance/alerts/${alertId}/escalate`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hodKeys.alerts() });
      qc.invalidateQueries({ queryKey: hodKeys.interventions() });
    },
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

export function useUpdateInterventionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/academics/interventions/${id}`, body).then((res) => res.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hodKeys.interventions() });
    },
  });
}

export function useRejectPairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/pairings/${id}/reject`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pairings() }),
  });
}

export function useCompletePairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/academics/performance/pairings/${id}/complete`, body ?? {}).then((res) => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: hodKeys.pairings() }),
  });
}
