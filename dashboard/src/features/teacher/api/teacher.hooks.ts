import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import type { Assessment, ClassSubject, TimetableEntry } from '../types/teacher.types';

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

export function useTeacherClasses() {
  return useQuery({
    queryKey: teacherKeys.classes(),
    queryFn: () =>
      api
        .get('/academics/class-subjects')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['classes', 'classSubjects']).map((raw) => {
            const c = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            const studentsRaw = c.students ?? c.studentCount ?? c.totalStudents ?? 0;
            const openRaw = c.openAssessments ?? c.open_assessments ?? c.assessmentCount ?? 0;
            return {
              ...c,
              id: String(c.id ?? crypto.randomUUID()),
              classId: String(c.classId ?? c.class_id ?? c.id ?? ''),
              className: resolve(c.className ?? c.class ?? c.class_name),
              subject: resolve(c.subject ?? c.subjectName),
              students: Array.isArray(studentsRaw) ? studentsRaw.length : Number(studentsRaw),
              average: Number(c.average ?? c.classAverage ?? c.averageScore ?? 0),
              attendance: Number(c.attendance ?? c.attendanceRate ?? c.attendancePercentage ?? 0),
              syllabus: Number(c.syllabus ?? c.syllabusCompletion ?? c.syllabusProgress ?? 0),
              openAssessments: Array.isArray(openRaw) ? openRaw.length : Number(openRaw),
              nextLesson: String(c.nextLesson ?? c.next_lesson ?? c.nextClass ?? ''),
              risk: String(c.risk ?? c.riskLevel ?? c.riskStatus ?? ''),
            } as ClassSubject;
          }),
        ),
    staleTime: 30_000,
  });
}

export function useTeacherAssessments() {
  return useQuery({
    queryKey: teacherKeys.assessments(),
    queryFn: () =>
      api
        .get('/academics/assessments', { params: { mine: true } })
        .then((r) =>
          arrayFromApi(payloadOf(r), ['assessments']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              title: String(a.title ?? a.name ?? a.assessmentTitle ?? ''),
              classSubjectId: String(a.classSubjectId ?? a.class_subject_id ?? a.classId ?? ''),
              className: resolve(a.className ?? a.class ?? a.class_name),
              subject: resolve(a.subject ?? a.subjectName),
              type: String(a.type ?? a.assessmentType ?? a.category ?? ''),
              maxScore: Number(a.maxScore ?? a.max_score ?? a.totalMarks ?? 100),
              status: String(a.status ?? a.assessmentStatus ?? ''),
              entered: Number(a.entered ?? a.marksEntered ?? a.submitted ?? 0),
              total: Number(a.total ?? a.totalStudents ?? a.studentCount ?? 0),
              due: String(a.due ?? a.dueDate ?? a.deadline ?? ''),
              lastSaved: String(a.lastSaved ?? a.last_saved ?? a.updatedAt ?? ''),
            } as Assessment;
          }),
        ),
    staleTime: 30_000,
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
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...s,
              id: String(s.id ?? crypto.randomUUID()),
              roll: String(s.roll ?? s.rollNumber ?? s.rollNo ?? ''),
              name: resolve(s.name ?? s.studentName ?? s.fullName),
              registration: String(s.registration ?? s.registrationNumber ?? s.regNo ?? ''),
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
          arrayFromApi(payloadOf(r), ['attendance', 'records']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              student: resolve(a.student ?? a.studentName ?? a.name),
              className: resolve(a.className ?? a.class ?? a.class_name),
              subject: resolve(a.subject ?? a.subjectName),
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
              severity: String(a.severity ?? a.alertLevel ?? a.level ?? ''),
              type: String(a.type ?? a.alertType ?? ''),
              score: Number(a.score ?? a.currentScore ?? a.averageScore ?? 0),
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
              mentor: resolve(p.mentor ?? p.mentorName ?? p.mentorStudent),
              support: resolve(p.support ?? p.supportName ?? p.supportStudent ?? p.student ?? p.studentName),
              subject: resolve(p.subject ?? p.subjectName),
              className: resolve(p.className ?? p.class ?? p.class_name),
              reason: String(p.reason ?? p.pairingReason ?? p.description ?? ''),
              status: String(p.status ?? p.pairingStatus ?? 'SUGGESTED'),
              outcome: String(p.outcome ?? p.pairingOutcome ?? p.result ?? ''),
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
        .get('/academics/timetables')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['timetables', 'schedule']).map((raw) => {
            const e = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...e,
              id: String(e.id ?? crypto.randomUUID()),
              day: String(e.day ?? e.dayOfWeek ?? e.weekday ?? ''),
              time: String(e.time ?? e.startTime ?? e.period ?? ''),
              className: resolve(e.className ?? e.class ?? e.class_name),
              subject: resolve(e.subject ?? e.subjectName),
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
        .get('/academics/syllabus')
        .then((r) => arrayFromApi(payloadOf(r), ['syllabus', 'topics'])),
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
