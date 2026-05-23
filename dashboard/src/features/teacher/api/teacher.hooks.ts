import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';

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
    queryFn: () =>
      api.get('/teacher/dashboard').then((r) => r.data?.data ?? r.data),
    staleTime: 30_000,
  });
}

export function useTeacherClasses() {
  return useQuery({
    queryKey: teacherKeys.classes(),
    queryFn: () =>
      api
        .get('/academics/class-subjects')
        .then((r) => r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useTeacherAssessments() {
  return useQuery({
    queryKey: teacherKeys.assessments(),
    queryFn: () =>
      api
        .get('/academics/assessments', { params: { mine: true } })
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useAssessmentDetail(id: string) {
  return useQuery({
    queryKey: teacherKeys.assessment(id),
    queryFn: () =>
      api
        .get(`/academics/assessments/${id}`)
        .then((r) => r.data?.data ?? r.data),
    enabled: !!id,
  });
}

export function useMarksSheet(assessmentId: string) {
  return useQuery({
    queryKey: teacherKeys.marksSheet(assessmentId),
    queryFn: () =>
      api
        .get(`/academics/assessments/${assessmentId}/marks/sheet`)
        .then((r) => r.data?.data ?? r.data),
    enabled: !!assessmentId,
    staleTime: 30_000,
  });
}

export function useMarksReview(assessmentId: string) {
  return useQuery({
    queryKey: teacherKeys.marksReview(assessmentId),
    queryFn: () =>
      api
        .get(`/academics/assessments/${assessmentId}/marks/review`)
        .then((r) => r.data?.data ?? r.data),
    enabled: !!assessmentId,
  });
}

export function useClassStudents(classId: string) {
  return useQuery({
    queryKey: teacherKeys.classStudents(classId),
    queryFn: () =>
      api
        .get(`/students/classes/${classId}/students`)
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
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
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function usePerformanceAlerts() {
  return useQuery({
    queryKey: teacherKeys.performanceAlerts(),
    queryFn: () =>
      api
        .get('/students/performance/alerts')
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function usePerfPairings() {
  return useQuery({
    queryKey: teacherKeys.perfPairings(),
    queryFn: () =>
      api
        .get('/students/performance/pairings')
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useStudentPerformance(studentId: string) {
  return useQuery({
    queryKey: teacherKeys.studentPerformance(studentId),
    queryFn: () =>
      api
        .get(`/students/performance/${studentId}`)
        .then((r) => r.data?.data ?? r.data),
    enabled: !!studentId,
  });
}

export function useTeacherTimetable() {
  return useQuery({
    queryKey: teacherKeys.timetable(),
    queryFn: () =>
      api
        .get('/academics/timetables')
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useTeacherSyllabus() {
  return useQuery({
    queryKey: teacherKeys.syllabus(),
    queryFn: () =>
      api
        .get('/academics/syllabus')
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useTeacherAnnouncements() {
  return useQuery({
    queryKey: teacherKeys.announcements(),
    queryFn: () =>
      api
        .get('/notifications/announcements')
        .then((r) => r.data?.data?.items ?? r.data?.data ?? []),
    staleTime: 30_000,
  });
}

export function useClassAnalytics(classId: string) {
  return useQuery({
    queryKey: teacherKeys.classAnalytics(classId),
    queryFn: () =>
      api
        .get(`/teacher/classes/${classId}/analytics`)
        .then((r) => r.data?.data ?? r.data),
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
