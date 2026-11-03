import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { useAuthStore } from '../../../lib/auth/authStore';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import type { Assessment, ClassSubject, MarkRow, Pairing, Student, TeacherRegister, TimetableEntry } from '../types/teacher.types';

// ─── Shared resolvers ─────────────────────────────────────────────────────────
// People come back as { firstName, lastName }, subjects/classes as { name }.
function resolveName(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object') return String(v);
  const o = v as Record<string, unknown>;
  const joined = [o.firstName, o.middleName, o.lastName].filter(Boolean).join(' ').trim();
  return String(o.name ?? o.fullName ?? o.label ?? (joined || o.title || ''));
}

// Build a readable class label from a class object or stage + level.
function classLabel(classObj: unknown, stage?: unknown, level?: unknown): string {
  const fromObj = resolveName(classObj);
  if (fromObj) return fromObj;
  const s = String(stage ?? '').replace('_', '-');
  if (s && level != null) return `${s} L${level}`;
  if (s) return s;
  return '';
}

// ─── Query key factory ────────────────────────────────────────────────────────

export const teacherKeys = {
  all: ['teacher'] as const,
  dashboard: () => [...teacherKeys.all, 'dashboard'] as const,
  workspace: () => [...teacherKeys.all, 'workspace'] as const,
  classes: () => [...teacherKeys.all, 'classes'] as const,
  assessments: () => [...teacherKeys.all, 'assessments'] as const,
  assessment: (id: string) => [...teacherKeys.assessments(), id] as const,
  marksSheet: (id: string) => [...teacherKeys.assessment(id), 'marks', 'sheet'] as const,
  marksReview: (id: string) => [...teacherKeys.assessment(id), 'marks', 'review'] as const,
  students: () => [...teacherKeys.all, 'students'] as const,
  classStudents: (classSubjectId: string) => [...teacherKeys.students(), classSubjectId] as const,
  register: (classId: string) => [...teacherKeys.all, 'register', classId] as const,
  attendance: () => [...teacherKeys.all, 'attendance'] as const,
  performanceAlerts: () => [...teacherKeys.all, 'performance', 'alerts'] as const,
  perfPairings: (classIds?: string[]) => [...teacherKeys.all, 'performance', 'pairings', classIds?.length ? classIds.slice().sort().join(',') : ''] as const,
  studentPerformance: (studentId: string) => [...teacherKeys.all, 'performance', studentId] as const,
  timetable: () => [...teacherKeys.all, 'timetable'] as const,
  syllabus: () => [...teacherKeys.all, 'syllabus'] as const,
  announcements: () => [...teacherKeys.all, 'announcements'] as const,
  classAnalytics: (classId: string) => [...teacherKeys.all, 'analytics', classId] as const,
};

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useTeacherDashboard() {
  return useQuery({
    queryKey: teacherKeys.dashboard(),
    queryFn: () => api.get('/teacher/dashboard').then(payloadOf),
    staleTime: 30_000,
  });
}

type WorkspaceClass = Record<string, any>;
type Workspace = {
  teacherId: string;
  currentTermId: string | null;
  schoolIds: string[];
  classes: WorkspaceClass[];
  assessments: Record<string, any>[];
  registers: Record<string, any>[];
};

/** One call for everything a teacher works with: classes, assessments (with real progress), registers. */
export function useTeacherWorkspace() {
  return useQuery({
    queryKey: teacherKeys.workspace(),
    staleTime: 20_000,
    queryFn: () => api.get('/academics/teacher/workspace').then((r) => payloadOf(r) as Workspace),
  });
}

/** Window assessments are exam work (marks via the exam screen); the rest are classic CATs. */
export function assessmentMarksPath(a: { id: string; examWindow?: { id: string } | null }) {
  return a.examWindow ? `/teacher/exams/marks/${a.id}` : `/teacher/assessments/${a.id}/marks`;
}

// Teacher's classes: the real class name, school, subject roster and syllabus %,
// straight from the teacher's own assignments.
export function useTeacherClasses() {
  const ws = useTeacherWorkspace();
  const data = useMemo(() => {
    if (!ws.data) return undefined;
    return ws.data.classes.map((c): ClassSubject => {
      const syl = c.syllabus as { percent: number; totalTopics: number; coveredTopics: number; termId: string; notes: string } | null;
      const pct = syl?.percent ?? 0;
      return {
        id: String(c.classSubjectId),
        classId: String(c.classId ?? ''),
        schoolId: String(c.schoolId ?? ''),
        subjectId: String(c.subjectId ?? ''),
        className: String(c.label ?? '') || 'Class',
        subject: String(c.subjectName ?? '') || 'Subject',
        stage: String(c.stage ?? ''),
        isOptional: Boolean(c.isOptional),
        combination: String(c.combinationCode ?? ''),
        students: Number(c.studentCount ?? 0),
        classSize: Number(c.classSize ?? 0),
        average: Number(c.average ?? 0),
        attendance: 0,
        syllabus: pct,
        syllabusTotal: syl?.totalTopics ?? 0,
        syllabusCovered: syl?.coveredTopics ?? 0,
        syllabusTermId: syl?.termId ?? '',
        syllabusNotes: syl?.notes ?? '',
        assessmentCount: Number(c.assessmentCount ?? 0),
        openAssessments: Number(c.openAssessments ?? 0),
        isClassTeacher: Boolean(c.isClassTeacher),
        periodsPerWeek: Number(c.periodsPerWeek ?? 0),
        nextLesson: '',
        risk: !syl ? 'MEDIUM' : pct < 40 ? 'HIGH' : pct < 70 ? 'MEDIUM' : 'LOW',
      };
    });
  }, [ws.data]);
  return { data, isLoading: ws.isLoading, isError: ws.isError, refetch: ws.refetch, error: ws.error };
}

export function useTeacherRegisters() {
  const ws = useTeacherWorkspace();
  const data = useMemo(
    () =>
      ws.data?.registers.map((r): TeacherRegister => ({
        classId: String(r.classId),
        schoolId: String(r.schoolId ?? ''),
        label: String(r.label ?? '') || 'Class',
        stage: String(r.stage ?? ''),
        studentCount: Number(r.studentCount ?? 0),
        isClassTeacher: Boolean(r.isClassTeacher),
      })),
    [ws.data],
  );
  return { data, isLoading: ws.isLoading, isError: ws.isError, refetch: ws.refetch };
}

export function useTeacherAssessments() {
  const ws = useTeacherWorkspace();
  const data = useMemo(() => {
    if (!ws.data) return undefined;
    return ws.data.assessments.map((a): Assessment => {
      const win = (a.examWindow ?? null) as Assessment['examWindow'];
      const name = String(a.name ?? 'Assessment');
      const typeMatch = name.match(/\b(CAT\d?|MIDTERM|FINAL|TEST|EXAM|QUIZ|PRACTICAL)\b/i);
      return {
        id: String(a.id),
        title: name,
        classSubjectId: String(a.classSubjectId ?? ''),
        classId: String(a.classId ?? ''),
        schoolId: String(a.schoolId ?? ''),
        className: String(a.className ?? '') || '—',
        subject: String(a.subjectName ?? '') || 'Subject',
        type: win ? 'Exam' : typeMatch ? typeMatch[1].toUpperCase() : 'Assessment',
        maxScore: Number(a.maxScore ?? 100),
        status: String(a.status ?? '') as Assessment['status'],
        entered: Number(a.entered ?? 0),
        total: Number(a.required ?? 0),
        due: win?.closesAt ? String(win.closesAt) : String(a.date ?? ''),
        lastSaved: String(a.submittedAt ?? ''),
        rejectionReason: String(a.rejectionReason ?? ''),
        examWindow: win,
      };
    });
  }, [ws.data]);
  return { data, isLoading: ws.isLoading, isError: ws.isError, refetch: ws.refetch };
}

export function useAssessmentDetail(id: string) {
  return useQuery({
    queryKey: teacherKeys.assessment(id),
    queryFn: () => api.get(`/academics/assessments/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

/** Legacy (CAT) marks sheet: one row per student who takes the subject, with any marks already saved. */
export function useMarksSheet(assessmentId: string) {
  return useQuery({
    queryKey: teacherKeys.marksSheet(assessmentId),
    queryFn: () =>
      api.get(`/academics/assessments/${assessmentId}/marks/sheet`).then((r) => {
        const sheet = payloadOf(r) as { assessment?: Record<string, unknown>; rows?: Record<string, unknown>[] };
        const rows = (sheet.rows ?? []).map((row, index): MarkRow => {
          const exempt = Boolean(row.exempt);
          const notSat = Boolean(row.notSat);
          const absent = Boolean(row.isAbsent) && !notSat;
          const hasMark = row.markId != null;
          return {
            id: String(row.studentId),
            roll: String(index + 1),
            name: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Student',
            registration: String(row.registrationNumber ?? ''),
            average: 0,
            attendance: 0,
            alert: 'None',
            lastAssessment: '',
            score: hasMark && !absent && !notSat && row.score != null ? Number(row.score) : '',
            absent,
            notSat,
            exempt,
            note: String(row.note ?? ''),
            saved: hasMark,
            state: 'saved',
          } as MarkRow;
        });
        return { assessment: sheet.assessment ?? {}, rows };
      }),
    enabled: !!assessmentId,
    staleTime: 0,
  });
}

export function useMarksReview(assessmentId: string) {
  return useQuery({
    queryKey: teacherKeys.marksReview(assessmentId),
    queryFn: () =>
      api.get(`/academics/assessments/${assessmentId}/marks/review`).then(payloadOf),
    enabled: !!assessmentId,
  });
}

/** The students who take one of the teacher's class-subjects (optional subjects / combinations respected). */
export function useClassStudents(classSubjectId: string) {
  return useQuery({
    queryKey: teacherKeys.classStudents(classSubjectId),
    queryFn: () =>
      api.get(`/academics/teacher/class-subjects/${classSubjectId}/students`).then((r) => {
        const d = payloadOf(r) as { students?: Record<string, unknown>[]; classSize?: number };
        return (d.students ?? []).map((s, index): Student => ({
          id: String(s.id),
          roll: String(index + 1),
          name: String(s.name ?? ''),
          registration: String(s.registrationNumber ?? ''),
          average: 0,
          attendance: 0,
          alert: 'None',
          lastAssessment: '',
        }));
      }),
    enabled: !!classSubjectId,
    staleTime: 30_000,
  });
}

/** A class register: every student in the class, with today's status if the register was already taken. */
export function useRegisterStudents(classId: string) {
  return useQuery({
    queryKey: teacherKeys.register(classId),
    queryFn: () =>
      api.get(`/teacher/class-subjects/${classId}/students`).then((r) => {
        const d = payloadOf(r) as { items?: Record<string, unknown>[] };
        return (d.items ?? []).map((s, index): Student => ({
          id: String(s.id),
          roll: String(index + 1),
          name: String(s.name ?? ''),
          registration: String(s.registrationNumber ?? ''),
          average: 0,
          attendance: 0,
          alert: 'None',
          lastAssessment: '',
          todayStatus: (s.attendanceStatus as string | null) ?? null,
        }));
      }),
    enabled: !!classId,
    staleTime: 0,
  });
}

export function useAttendanceList() {
  return useQuery({
    queryKey: teacherKeys.attendance(),
    queryFn: () =>
      api
        .get('/students/attendance', { params: { limit: 500 } })
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'attendance', 'records']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const st = (a.student ?? {}) as Record<string, unknown>;
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              studentId: String(a.studentId ?? ''),
              classId: String(a.classId ?? ''),
              schoolId: String(a.schoolId ?? ''),
              student: resolveName(a.student ?? a.studentName ?? a.name) || String(st.registrationNumber ?? '') || 'Student',
              className: classLabel(a.class, (a.class as Record<string, unknown> | undefined)?.educationStage, (a.class as Record<string, unknown> | undefined)?.level) || '—',
              subject: resolveName(a.subject ?? a.subjectName) || '',
              date: String(a.date ?? a.attendanceDate ?? a.recordedAt ?? ''),
              status: String(a.status ?? a.attendanceStatus ?? ''),
            };
          }),
        ),
    staleTime: 30_000,
  });
}

function normalizeSeverity(v: unknown): 'CRITICAL' | 'AT_RISK' | 'INFO' {
  const t = String(v ?? '').toUpperCase();
  if (t === 'CRITICAL' || t === 'HIGH' || t === 'URGENT') return 'CRITICAL';
  if (t === 'AT_RISK' || t === 'MEDIUM' || t === 'WARNING' || t === 'MODERATE') return 'AT_RISK';
  return 'INFO';
}

export function usePerformanceAlerts() {
  return useQuery({
    queryKey: teacherKeys.performanceAlerts(),
    queryFn: () =>
      api
        .get('/students/performance/alerts', { params: { limit: 200 } })
        .then((r) =>
          (arrayFromApi(payloadOf(r), ['items', 'alerts', 'performanceAlerts']) as Record<string, unknown>[])
            .filter((a) => a.isResolved !== true)
            .map((a) => {
              const snapshot = (a.triggeredBySnapshot ?? {}) as Record<string, unknown>;
              const type = String(a.alertType ?? a.type ?? '');
              return {
                ...a,
                id: String(a.id ?? crypto.randomUUID()),
                studentId: String(a.studentId ?? ''),
                schoolId: String(a.schoolId ?? ''),
                registration: String((a.student as Record<string, unknown> | undefined)?.registrationNumber ?? ''),
                student: resolveName(a.student ?? a.studentName) || 'Student',
                subject: String(a.subjectName ?? resolveName(a.subject) ?? ''),
                className: classLabel(a.class ?? snapshot.class) || '',
                severity: normalizeSeverity(a.severity ?? a.alertLevel ?? a.level),
                type,
                reason: String(a.message ?? a.reason ?? a.description ?? ''),
                action: String(a.action ?? a.recommendedAction ?? 'Review'),
                score: Number(a.currentScore ?? a.score ?? snapshot.score ?? 0),
              };
            }),
        ),
    staleTime: 30_000,
  });
}

export function usePerfPairings(classIds?: string[]) {
  return useQuery({
    queryKey: teacherKeys.perfPairings(classIds),
    // Only fetch once we know which classes the teacher owns. An explicit empty
    // array means "loaded, but teacher has no classes" — don't fetch.
    enabled: classIds !== undefined && classIds.length > 0,
    queryFn: () =>
      api
        .get('/students/performance/pairings', {
          params: { classIds: classIds!.join(','), limit: 100 },
        })
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'pairings']).map((raw) => {
            const p = raw as Record<string, unknown>;
            return {
              ...p,
              id: String(p.id ?? crypto.randomUUID()),
              mentor: resolveName(p.peer ?? p.mentor ?? p.mentorName) || 'Mentor',
              support: resolveName(p.student ?? p.support ?? p.supportName) || 'Student',
              subject: String(p.subjectName ?? resolveName(p.subject) ?? ''),
              className: classLabel(p.class) || '',
              classId: String(p.classId ?? ''),
              schoolId: String(p.schoolId ?? ''),
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              status: String(p.status ?? p.pairingStatus ?? 'SUGGESTED').toUpperCase() as Pairing['status'],
              outcome: String(p.outcome ?? p.pairingOutcome ?? p.result ?? ''),
              mentorScore: p.peerScoreAtPairing == null ? null : Number(p.peerScoreAtPairing),
              supportScore: p.studentScoreAtPairing == null ? null : Number(p.studentScoreAtPairing),
            };
          }),
        ),
    staleTime: 30_000,
  });
}

export function useStudentPerformance(studentId: string) {
  return useQuery({
    queryKey: teacherKeys.studentPerformance(studentId),
    queryFn: () => api.get(`/students/performance/${studentId}`).then(payloadOf),
    enabled: !!studentId,
  });
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

/** "8:00" / "08:00" / "8:00 AM" → minutes after midnight (null when unreadable). */
export function clockMinutes(value: string): number | null {
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return h * 60 + Number(m[2]);
}

export function useTeacherTimetable() {
  const classes = useTeacherRegisters();
  const q = useQuery({
    queryKey: teacherKeys.timetable(),
    queryFn: () =>
      api
        .get('/teacher/dashboard')
        .then((r) => arrayFromApi((payloadOf(r) as Record<string, unknown>).timetable, ['timetables', 'schedule']) as Record<string, unknown>[]),
    staleTime: 30_000,
  });
  const data = useMemo(() => {
    if (!q.data) return undefined;
    const labelOf = new Map((classes.data ?? []).map((c) => [c.classId, c.label]));
    const now = new Date();
    const today = DAYS[(now.getDay() + 6) % 7];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return q.data
      .map((e): TimetableEntry & { sortKey: number } => {
        const rawDay = String(e.dayOfWeek ?? e.day ?? '').toUpperCase();
        const start = String(e.startTime ?? e.time ?? '');
        const end = String(e.endTime ?? '');
        const s = clockMinutes(start);
        const f = clockMinutes(end);
        return {
          id: String(e.id ?? crypto.randomUUID()),
          day: rawDay.charAt(0) + rawDay.slice(1).toLowerCase(),
          time: end ? `${start}–${end}` : start,
          className: labelOf.get(String(e.classId ?? '')) || classLabel(e.class, e.educationStage, e.classLevel) || '—',
          subject: resolveName(e.subject ?? e.subjectName) || 'Subject',
          room: String(e.room ?? e.roomNumber ?? e.venue ?? e.location ?? ''),
          schoolId: String(e.schoolId ?? ''),
          current: rawDay === today && s != null && f != null && nowMin >= s && nowMin < f,
          sortKey: DAYS.indexOf(rawDay) * 10000 + (s ?? 0),
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [q.data, classes.data]);
  return { data, isLoading: q.isLoading || classes.isLoading, isError: q.isError, refetch: q.refetch };
}

/** Syllabus coverage per class-subject, straight from the workspace. */
export function useTeacherSyllabus() {
  const ws = useTeacherClasses();
  const data = useMemo(
    () =>
      ws.data?.map((c) => ({
        id: c.id,
        termId: c.syllabusTermId,
        classSubjectId: c.id,
        subject: c.subject,
        className: c.className,
        totalTopics: c.syllabusTotal,
        coveredTopics: c.syllabusCovered,
        completion: c.syllabus,
        notes: c.syllabusNotes,
      })),
    [ws.data],
  );
  return { data, isLoading: ws.isLoading, isError: ws.isError, refetch: ws.refetch };
}

export function useCurrentTerm() {
  return useQuery({
    queryKey: [...teacherKeys.all, 'current-term'],
    queryFn: () =>
      api.get('/students/terms').then((r) => {
        const terms = arrayFromApi(payloadOf(r), ['terms']) as Record<string, unknown>[];
        return terms.find((t) => t.isCurrent) ?? terms[terms.length - 1] ?? null;
      }),
    staleTime: 60_000,
  });
}

/** The announcements this teacher wrote (newest first). */
export function useTeacherAnnouncements() {
  const me = useAuthStore((st) => st.session?.user.id ?? '');
  return useQuery({
    queryKey: [...teacherKeys.announcements(), me],
    enabled: !!me,
    queryFn: () =>
      api
        .get('/notifications/announcements', { params: { authorId: me, limit: 50 } })
        .then((r) => arrayFromApi(payloadOf(r), ['announcements', 'items']) as Record<string, unknown>[]),
    staleTime: 15_000,
  });
}

/** Name and registration number for the student profile header. */
export function useStudentBasic(studentId: string) {
  return useQuery({
    queryKey: [...teacherKeys.students(), 'basic', studentId],
    enabled: !!studentId,
    queryFn: () =>
      api.get(`/students/${studentId}`).then((r) => {
        const s = payloadOf(r) as Record<string, unknown>;
        return { name: [s.firstName, s.lastName].filter(Boolean).join(' '), registration: String(s.registrationNumber ?? '') };
      }),
    staleTime: 60_000,
  });
}

export type ClassAnalyticsData = {
  classSubjectId: string;
  subjectName: string;
  studentCount: number;
  passMark: number;
  gradeOrder: string[];
  overall: { average: number; median: number; passRate: number; atRisk: number; improving: number; declining: number };
  assessments: Array<{ id: string; name: string; status: string; sat: number; absent: number; average: number; median: number; highest: number; lowest: number; passRate: number; distribution: Record<string, number> }>;
  students: Array<{ id: string; name: string; registrationNumber: string; average: number; last: number | null; delta: number | null; taken: number; absent: number; flag: string }>;
};

/** Real class analytics from the marks the teacher entered (class average, pass rate, per-student standing). */
export function useClassAnalytics(classSubjectId: string) {
  return useQuery({
    queryKey: teacherKeys.classAnalytics(classSubjectId),
    queryFn: () => api.get(`/academics/teacher/class-subjects/${classSubjectId}/analytics`).then((r) => payloadOf(r) as ClassAnalyticsData),
    enabled: !!classSubjectId,
    staleTime: 30_000,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useSubmitMarksBulkMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, marks }: { id: string; marks: unknown[] }) =>
      api
        .post(`/academics/assessments/${id}/marks/bulk`, { marks })
        .then((r) => r.data?.data ?? r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: teacherKeys.workspace() });
      qc.invalidateQueries({ queryKey: teacherKeys.marksSheet(v.id) });
    },
  });
}

export function useSubmitAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post(`/academics/assessments/${id}/submit`)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: teacherKeys.workspace() });
      qc.invalidateQueries({ queryKey: teacherKeys.marksSheet(id) });
    },
  });
}

export function useMarkAttendanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    // The gateway resolves the current term, so the teacher only sends class, date and the register.
    mutationFn: (payload: { classId: string; date: string; records: Array<{ studentId: string; status: string; note?: string }> }) =>
      api
        .post('/teacher/attendance', payload)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: teacherKeys.attendance() });
      qc.invalidateQueries({ queryKey: teacherKeys.register(v.classId) });
    },
  });
}

export function useResolveAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api
        .patch(`/students/performance/alerts/${id}/resolve`, note?.trim() ? { resolutionNote: note.trim() } : {})
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherKeys.performanceAlerts() }),
  });
}

export function useCreateInterventionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api
        .post('/academics/interventions', payload)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...teacherKeys.all, 'interventions'] }),
  });
}

/** Support plans this teacher has recorded (their own follow-up list). */
export function useMyInterventions() {
  return useQuery({
    queryKey: [...teacherKeys.all, 'interventions'],
    queryFn: () => api.get('/academics/interventions/mine').then((r) => arrayFromApi(payloadOf(r), ['items']) as Record<string, any>[]),
    staleTime: 30_000,
  });
}

export function useUpdateSyllabusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      classSubjectId,
      termId,
      totalTopics,
      coveredTopics,
      notes,
    }: {
      classSubjectId: string;
      termId: string;
      totalTopics: number;
      coveredTopics: number;
      notes?: string;
    }) =>
      api
        .post('/academics/syllabus', { classSubjectId, termId, totalTopics, coveredTopics, notes })
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherKeys.workspace() });
    },
  });
}

export function useCreatePairingMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api
        .post('/students/performance/pairings', payload)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...teacherKeys.all, 'performance', 'pairings'] }),
  });
}

export function useUpdatePairingStatusMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) =>
      api
        .patch(`/students/performance/pairings/${id}/status`, { status, rejectionReason })
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...teacherKeys.all, 'performance', 'pairings'] }),
  });
}

export function useCreateAnnouncementMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api
        .post('/notifications/announcements', payload)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherKeys.announcements() }),
  });
}

// ─── Report Card Remarks ──────────────────────────────────────────────────────

export const reportCardKeys = {
  all: ['report-cards'] as const,
  forStudent: (studentId: string) => [...reportCardKeys.all, 'student', studentId] as const,
};

export function useStudentReportCards(studentId: string) {
  return useQuery({
    queryKey: reportCardKeys.forStudent(studentId),
    enabled: !!studentId,
    queryFn: () =>
      api.get(`/academics/report-cards/student/${studentId}`).then((r) => {
        const data = r.data?.data ?? r.data ?? [];
        return (Array.isArray(data) ? data : [data]) as Record<string, unknown>[];
      }),
    staleTime: 60_000,
  });
}

export function useUpdateReportCardCommentsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, teacherComment }: { id: string; teacherComment: string }) =>
      api.patch(`/academics/report-cards/${id}/comments`, { teacherComment }).then((r) => r.data?.data ?? r.data),
    onSuccess: (_data) => {
      const studentId = String(_data?.studentId ?? '');
      if (studentId) qc.invalidateQueries({ queryKey: reportCardKeys.forStudent(studentId) });
    },
  });
}
