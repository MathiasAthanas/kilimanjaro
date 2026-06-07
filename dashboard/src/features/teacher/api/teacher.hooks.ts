import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import type { Assessment, ClassSubject, TimetableEntry } from '../types/teacher.types';

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
  classes: () => [...teacherKeys.all, 'classes'] as const,
  assessments: () => [...teacherKeys.all, 'assessments'] as const,
  assessment: (id: string) => [...teacherKeys.assessments(), id] as const,
  marksSheet: (id: string) => [...teacherKeys.assessment(id), 'marks', 'sheet'] as const,
  marksReview: (id: string) => [...teacherKeys.assessment(id), 'marks', 'review'] as const,
  students: () => [...teacherKeys.all, 'students'] as const,
  classStudents: (classId: string) => [...teacherKeys.students(), classId] as const,
  attendance: () => [...teacherKeys.all, 'attendance'] as const,
  performanceAlerts: () => [...teacherKeys.all, 'performance', 'alerts'] as const,
  perfPairings: () => [...teacherKeys.all, 'performance', 'pairings'] as const,
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

// Teacher's classes enriched with REAL syllabus %, open-assessment counts and
// class averages. Sourced from /teacher/dashboard which is scoped to THIS
// teacher (the raw /academics/class-subjects endpoint returns the whole school).
export function useTeacherClasses() {
  return useQuery({
    queryKey: teacherKeys.classes(),
    staleTime: 30_000,
    queryFn: async () => {
      const dash = await api.get('/teacher/dashboard').then(payloadOf) as Record<string, unknown>;
      const classSubjects = arrayFromApi(dash.classes, ['classes', 'classSubjects']) as Record<string, unknown>[];
      const assessments = arrayFromApi(dash.assessments, ['assessments']) as Record<string, unknown>[];
      const syllabus = arrayFromApi(dash.syllabus, ['syllabus', 'topics']) as Record<string, unknown>[];

      // syllabus completion keyed by classSubjectId
      const syllabusByCs = new Map<string, number>();
      syllabus.forEach((s) => {
        const id = String(s.classSubjectId ?? '');
        if (id) syllabusByCs.set(id, Number(s.completionPercentage ?? 0));
      });

      // total + open assessment counts per classSubjectId
      const openByCs = new Map<string, number>();
      const totalByCs = new Map<string, number>();
      assessments.forEach((a) => {
        const csId = String(a.classSubjectId ?? (a.classSubject as Record<string, unknown> | undefined)?.id ?? '');
        if (!csId) return;
        totalByCs.set(csId, (totalByCs.get(csId) ?? 0) + 1);
        const status = String(a.status ?? '');
        if (!['APPROVED', 'HOD_APPROVED', 'LOCKED'].includes(status)) openByCs.set(csId, (openByCs.get(csId) ?? 0) + 1);
      });

      return classSubjects.map((raw) => {
        const c = raw;
        const csId = String(c.id ?? crypto.randomUUID());
        const subjectObj = (c.subject ?? (c.classSubject as Record<string, unknown> | undefined)?.subject) as Record<string, unknown> | undefined;
        const syllabusPct = syllabusByCs.get(csId) ?? 0;
        return {
          ...c,
          id: csId,
          classId: String(c.classId ?? c.class_id ?? ''),
          className: classLabel(c.class, c.educationStage, c.classLevel) || 'Class',
          subject: resolveName(subjectObj ?? c.subjectName ?? c.subject) || 'Subject',
          students: 0,
          average: 0,
          attendance: 0,
          syllabus: syllabusPct,
          assessmentCount: totalByCs.get(csId) ?? 0,
          openAssessments: openByCs.get(csId) ?? 0,
          nextLesson: '',
          risk: syllabusPct > 0 && syllabusPct < 40 ? 'HIGH' : syllabusPct < 70 ? 'MEDIUM' : 'LOW',
        } as ClassSubject;
      });
    },
  });
}

export function useTeacherAssessments() {
  return useQuery({
    queryKey: teacherKeys.assessments(),
    staleTime: 30_000,
    queryFn: async () => {
      const raw = arrayFromApi(
        await api.get('/academics/assessments', { params: { mine: true } }).then(payloadOf),
        ['assessments'],
      ) as Record<string, unknown>[];
      return raw.map((a) => {
        const cs = (a.classSubject ?? {}) as Record<string, unknown>;
        const subjectObj = (a.subject ?? cs.subject) as Record<string, unknown> | undefined;
        const status = String(a.status ?? a.assessmentStatus ?? '');
        const name = String(a.title ?? a.name ?? a.assessmentTitle ?? 'Assessment');
        const typeMatch = name.match(/\b(CAT\d?|MIDTERM|FINAL|TEST|EXAM|QUIZ|PRACTICAL)\b/i);
        return {
          ...a,
          id: String(a.id ?? crypto.randomUUID()),
          title: name,
          classSubjectId: String(a.classSubjectId ?? cs.id ?? ''),
          className: classLabel(a.class ?? cs.class, a.educationStage ?? cs.educationStage, a.classLevel ?? cs.classLevel) || '—',
          subject: resolveName(subjectObj ?? a.subjectName ?? a.subject) || 'Subject',
          type: String(a.type ?? a.assessmentType ?? (typeMatch ? typeMatch[1].toUpperCase() : 'Assessment')),
          maxScore: Number(a.maxScore ?? a.max_score ?? a.totalMarks ?? 100),
          status,
          entered: 0,
          total: 0,
          due: String(a.due ?? a.dueDate ?? a.deadline ?? a.date ?? ''),
          lastSaved: String(a.lastSaved ?? a.submittedAt ?? a.updatedAt ?? ''),
        } as Assessment;
      });
    },
  });
}

export function useAssessmentDetail(id: string) {
  return useQuery({
    queryKey: teacherKeys.assessment(id),
    queryFn: () => api.get(`/academics/assessments/${id}`).then(payloadOf),
    enabled: !!id,
  });
}

export function useMarksSheet(assessmentId: string) {
  return useQuery({
    queryKey: teacherKeys.marksSheet(assessmentId),
    queryFn: () =>
      api.get(`/academics/assessments/${assessmentId}/marks/sheet`).then(payloadOf),
    enabled: !!assessmentId,
    staleTime: 30_000,
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

export function useClassStudents(classId: string) {
  return useQuery({
    queryKey: teacherKeys.classStudents(classId),
    queryFn: () =>
      api
        .get(`/students/classes/${classId}/students`)
        .then((r) =>
          arrayFromApi(payloadOf(r), ['students']).map((raw) => {
            const s = raw as Record<string, unknown>;
            return {
              ...s,
              id: String(s.id ?? crypto.randomUUID()),
              roll: String(s.roll ?? s.rollNumber ?? s.rollNo ?? ''),
              name: resolveName(s.student ?? s) || resolveName({ firstName: s.firstName, lastName: s.lastName }),
              registration: String(s.registrationNumber ?? s.registration ?? s.regNo ?? ''),
              average: Number(s.average ?? s.averageScore ?? s.academicAverage ?? 0),
              attendance: Number(s.attendance ?? s.attendanceRate ?? s.attendancePercentage ?? 0),
              alert: String(s.alert ?? s.alertStatus ?? s.riskLevel ?? ''),
              lastAssessment: String(s.lastAssessment ?? s.last_assessment ?? s.lastScore ?? ''),
            };
          }),
        ),
    enabled: !!classId,
    staleTime: 30_000,
  });
}

export function useAttendanceList() {
  return useQuery({
    queryKey: teacherKeys.attendance(),
    queryFn: () =>
      api
        .get('/students/attendance')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'attendance', 'records']).map((raw) => {
            const a = raw as Record<string, unknown>;
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolveName(a.student ?? a.studentName ?? a.name) || 'Student',
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

export function usePerformanceAlerts() {
  return useQuery({
    queryKey: teacherKeys.performanceAlerts(),
    queryFn: () =>
      api
        .get('/students/performance/alerts')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'alerts', 'performanceAlerts']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const snapshot = (a.triggeredBySnapshot ?? {}) as Record<string, unknown>;
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolveName(a.student ?? a.studentName) || 'Student',
              subject: String(a.subjectName ?? resolveName(a.subject) ?? ''),
              className: classLabel(a.class ?? snapshot.class) || '—',
              severity: String(a.severity ?? a.alertLevel ?? a.level ?? 'MEDIUM').toUpperCase(),
              type: String(a.alertType ?? a.type ?? ''),
              reason: String(a.message ?? a.reason ?? a.description ?? ''),
              action: String(a.action ?? a.recommendedAction ?? 'Review'),
              score: Number(a.currentScore ?? a.score ?? snapshot.score ?? 0),
            };
          }),
        ),
    staleTime: 30_000,
  });
}

export function usePerfPairings() {
  return useQuery({
    queryKey: teacherKeys.perfPairings(),
    queryFn: () =>
      api
        .get('/students/performance/pairings')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'pairings']).map((raw) => {
            const p = raw as Record<string, unknown>;
            return {
              ...p,
              id: String(p.id ?? crypto.randomUUID()),
              mentor: resolveName(p.peer ?? p.mentor ?? p.mentorName) || 'Mentor',
              support: resolveName(p.student ?? p.support ?? p.supportName) || 'Student',
              subject: String(p.subjectName ?? resolveName(p.subject) ?? ''),
              className: classLabel(p.class) || '—',
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              status: String(p.status ?? p.pairingStatus ?? 'SUGGESTED').toUpperCase(),
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

export function useTeacherTimetable() {
  return useQuery({
    queryKey: teacherKeys.timetable(),
    queryFn: () =>
      api
        .get('/teacher/dashboard')
        .then((r) =>
          arrayFromApi((payloadOf(r) as Record<string, unknown>).timetable, ['timetables', 'schedule']).map((raw) => {
            const e = raw as Record<string, unknown>;
            const day = String(e.dayOfWeek ?? e.day ?? e.weekday ?? '');
            const start = String(e.startTime ?? e.time ?? e.period ?? '');
            const end = String(e.endTime ?? '');
            return {
              ...e,
              id: String(e.id ?? crypto.randomUUID()),
              day: day.charAt(0) + day.slice(1).toLowerCase(),
              time: end ? `${start}–${end}` : start,
              className: classLabel(e.class, e.educationStage, e.classLevel) || '—',
              subject: resolveName(e.subject ?? e.subjectName) || 'Subject',
              room: String(e.room ?? e.roomNumber ?? e.venue ?? e.location ?? ''),
              current: Boolean(e.current ?? e.isCurrent ?? false),
            } as TimetableEntry;
          }),
        ),
    staleTime: 30_000,
  });
}

export function useTeacherSyllabus() {
  return useQuery({
    queryKey: teacherKeys.syllabus(),
    queryFn: () =>
      api
        .get('/teacher/dashboard')
        .then((r) => arrayFromApi((payloadOf(r) as Record<string, unknown>).syllabus, ['syllabus', 'topics']).map((raw) => {
          const s = raw as Record<string, unknown>;
          const cs = (s.classSubject ?? {}) as Record<string, unknown>;
          const subjectObj = cs.subject as Record<string, unknown> | undefined;
          return {
            ...s,
            id: String(s.id ?? crypto.randomUUID()),
            classSubjectId: String(s.classSubjectId ?? cs.id ?? ''),
            subject: resolveName(subjectObj ?? s.subjectName) || 'Subject',
            className: classLabel(cs.class, cs.educationStage, cs.classLevel) || '—',
            totalTopics: Number(s.totalTopics ?? 0),
            coveredTopics: Number(s.coveredTopics ?? 0),
            completion: Number(s.completionPercentage ?? s.completion ?? 0),
            notes: String(s.notes ?? ''),
          };
        })),
    staleTime: 30_000,
  });
}

export function useTeacherAnnouncements() {
  return useQuery({
    queryKey: teacherKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((r) => arrayFromApi(payloadOf(r), ['announcements'])),
    staleTime: 30_000,
  });
}

export function useClassAnalytics(classId: string) {
  return useQuery({
    queryKey: teacherKeys.classAnalytics(classId),
    queryFn: () => api.get(`/teacher/classes/${classId}/analytics`).then(payloadOf),
    enabled: !!classId,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherKeys.assessments() }),
  });
}

export function useSubmitAssessmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .post(`/academics/assessments/${id}/submit`)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherKeys.assessments() }),
  });
}

export function useMarkAttendanceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api
        .post('/students/attendance', payload)
        .then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherKeys.attendance() }),
  });
}

export function useResolveAlertMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api
        .patch(`/students/performance/alerts/${id}/resolve`)
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
    onSuccess: () => qc.invalidateQueries({ queryKey: teacherKeys.all }),
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
