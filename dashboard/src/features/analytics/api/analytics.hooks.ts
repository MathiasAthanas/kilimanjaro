import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (params?: Record<string, string>) => [...analyticsKeys.all, 'overview', params ?? {}] as const,
  board: (params?: Record<string, string>) => [...analyticsKeys.all, 'board', params ?? {}] as const,
  academic: (params?: Record<string, string>) => [...analyticsKeys.all, 'academic', params ?? {}] as const,
  academicSubject: (subjectId: string, params?: Record<string, string>) => [...analyticsKeys.all, 'academic', 'subject', subjectId, params ?? {}] as const,
  academicClass: (classId: string, params?: Record<string, string>) => [...analyticsKeys.all, 'academic', 'class', classId, params ?? {}] as const,
  academicTeacher: (teacherId: string, params?: Record<string, string>) => [...analyticsKeys.all, 'academic', 'teacher', teacherId, params ?? {}] as const,
  students: (params?: Record<string, string>) => [...analyticsKeys.all, 'students', params ?? {}] as const,
  atRisk: (params?: Record<string, string>) => [...analyticsKeys.all, 'at-risk', params ?? {}] as const,
  topPerformers: (params?: Record<string, string>) => [...analyticsKeys.all, 'top-performers', params ?? {}] as const,
  studentProfile: (studentId: string, params?: Record<string, string>) => [...analyticsKeys.all, 'student', studentId, params ?? {}] as const,
  teacherDashboard: (params?: Record<string, string>) => [...analyticsKeys.all, 'teacher-dashboard', params ?? {}] as const,
  studentDashboard: (params?: Record<string, string>) => [...analyticsKeys.all, 'student-dashboard', params ?? {}] as const,
  parentChild: (childId: string, params?: Record<string, string>) => [...analyticsKeys.all, 'parent-child', childId, params ?? {}] as const,
  department: (params?: Record<string, string>) => [...analyticsKeys.all, 'department', params ?? {}] as const,
  departmentSubject: (subjectId: string, params?: Record<string, string>) => [...analyticsKeys.all, 'department', 'subject', subjectId, params ?? {}] as const,
  finance: (params?: Record<string, string>) => [...analyticsKeys.all, 'finance', params ?? {}] as const,
  attendance: (params?: Record<string, string>) => [...analyticsKeys.all, 'attendance', params ?? {}] as const,
  reports: (params?: Record<string, unknown>) => [...analyticsKeys.all, 'reports', params ?? {}] as const,
  report: (id: string) => [...analyticsKeys.all, 'reports', id] as const,
};

function buildParams(params?: Record<string, string | undefined>): Record<string, string> {
  if (!params) return {};
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) as Record<string, string>;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

export function useSchoolOverview(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.overview(p),
    queryFn: () => api.get('/analytics/overview', { params: p }).then(payloadOf),
    staleTime: 300_000,
  });
}

export function useBoardDashboard(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.board(p),
    queryFn: () => api.get('/analytics/executive/board', { params: p }).then(payloadOf),
    staleTime: 300_000,
  });
}

// ─── Academic ─────────────────────────────────────────────────────────────────

export function useAcademicOverview(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.academic(p),
    queryFn: () => api.get('/analytics/academic/overview', { params: p }).then(payloadOf),
    staleTime: 300_000,
  });
}

export function useAcademicSubject(subjectId: string, params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.academicSubject(subjectId, p),
    queryFn: () => api.get(`/analytics/academic/subject/${subjectId}`, { params: p }).then(payloadOf),
    staleTime: 300_000,
    enabled: !!subjectId,
  });
}

export function useAcademicClass(classId: string, params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.academicClass(classId, p),
    queryFn: () => api.get(`/analytics/academic/class/${classId}`, { params: p }).then(payloadOf),
    staleTime: 300_000,
    enabled: !!classId,
  });
}

export function useAcademicTeacher(teacherId: string, params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.academicTeacher(teacherId, p),
    queryFn: () => api.get(`/analytics/academic/teacher/${teacherId}`, { params: p }).then(payloadOf),
    staleTime: 300_000,
    enabled: !!teacherId,
  });
}

// ─── Students ─────────────────────────────────────────────────────────────────

export function useStudentsList(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.students(p),
    queryFn: () => api.get('/analytics/students', { params: p }).then(payloadOf),
    staleTime: 120_000,
  });
}

export function useAtRiskStudents(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.atRisk(p),
    queryFn: () => api.get('/analytics/students/at-risk', { params: p }).then((r) => {
      const raw = payloadOf(r);
      return Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
    }),
    staleTime: 120_000,
  });
}

export function useTopPerformers(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.topPerformers(p),
    queryFn: () => api.get('/analytics/students/top-performers', { params: p }).then((r) => {
      const raw = payloadOf(r);
      return Array.isArray(raw) ? raw : (raw as any)?.data ?? [];
    }),
    staleTime: 300_000,
  });
}

export function useStudentProfile(studentId: string, params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.studentProfile(studentId, p),
    queryFn: () => api.get(`/analytics/students/${studentId}`, { params: p }).then(payloadOf),
    staleTime: 300_000,
    enabled: !!studentId,
  });
}

// ─── Teacher ──────────────────────────────────────────────────────────────────

export function useTeacherMyDashboard(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.teacherDashboard(p),
    queryFn: () => api.get('/analytics/teacher/my-dashboard', { params: p }).then(payloadOf),
    staleTime: 180_000,
  });
}

// ─── Student self-dashboard ────────────────────────────────────────────────────

export function useStudentMyDashboard(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.studentDashboard(p),
    queryFn: () => api.get('/analytics/students/my-dashboard', { params: p }).then(payloadOf),
    staleTime: 180_000,
  });
}

// ─── Parent child dashboard ───────────────────────────────────────────────────

export function useParentChildDashboard(childId: string, params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.parentChild(childId, p),
    queryFn: () => api.get(`/analytics/students/parent-child/${childId}`, { params: p }).then(payloadOf),
    staleTime: 180_000,
    enabled: !!childId,
  });
}

// ─── Department ───────────────────────────────────────────────────────────────

export function useDepartmentSubject(subjectId: string, params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.departmentSubject(subjectId, p),
    queryFn: () => api.get(`/analytics/department/${subjectId}`, { params: p }).then(payloadOf),
    staleTime: 300_000,
    enabled: !!subjectId,
  });
}

// ─── Finance analytics ────────────────────────────────────────────────────────

export function useFinanceAnalyticsOverview(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.finance(p),
    queryFn: () => api.get('/analytics/finance/overview', { params: p }).then(payloadOf),
    staleTime: 300_000,
  });
}

// ─── Attendance analytics ─────────────────────────────────────────────────────

export function useAttendanceAnalytics(params?: Record<string, string>) {
  const p = buildParams(params);
  return useQuery({
    queryKey: analyticsKeys.attendance(p),
    queryFn: () => api.get('/analytics/attendance/overview', { params: p }).then(payloadOf),
    staleTime: 300_000,
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function useReportsList(params?: Record<string, unknown>) {
  const p = params ?? {};
  return useQuery({
    queryKey: analyticsKeys.reports(p),
    queryFn: () => api.get('/analytics/reports', { params: p }).then((r) => {
      const raw = payloadOf(r);
      return (Array.isArray(raw) ? raw : (raw as any)?.data ?? []) as Array<{
        id: string;
        reportType: string;
        title: string;
        status: string;
        generatedByRole: string;
        createdAt: string;
        completedAt?: string;
      }>;
    }),
    staleTime: 30_000,
  });
}

export function useReportDetail(id: string) {
  return useQuery({
    queryKey: analyticsKeys.report(id),
    queryFn: () => api.get(`/analytics/reports/${id}`).then(payloadOf),
    staleTime: 10_000,
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data as any;
      return data?.status === 'GENERATING' ? 3000 : false;
    },
  });
}

export function useGenerateReportMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/analytics/reports/generate', body).then(payloadOf),
    onSuccess: () => qc.invalidateQueries({ queryKey: analyticsKeys.reports() }),
  });
}
