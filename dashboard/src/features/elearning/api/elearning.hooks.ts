import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, dedupeById, payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

export const elKeys = {
  all: ['elearning'] as const,
  courses: () => [...elKeys.all, 'courses'] as const,
  course: (id: string) => [...elKeys.courses(), id] as const,
  teacherAnalytics: () => [...elKeys.all, 'analytics', 'teacher'] as const,
  hodOverview: () => [...elKeys.all, 'analytics', 'hod'] as const,
  principalOverview: () => [...elKeys.all, 'analytics', 'principal'] as const,
  aqaOverview: () => [...elKeys.all, 'analytics', 'aqa'] as const,
  lessons: (courseId: string) => [...elKeys.course(courseId), 'lessons'] as const,
  materials: (courseId: string, lessonId: string) => [...elKeys.lessons(courseId), lessonId, 'materials'] as const,
  assignments: (courseId: string) => [...elKeys.course(courseId), 'assignments'] as const,
  assignment: (courseId: string, id: string) => [...elKeys.assignments(courseId), id] as const,
  assignmentSubmissions: (courseId: string, assignmentId: string) => [...elKeys.assignment(courseId, assignmentId), 'submissions'] as const,
  assignmentSummary: (courseId: string, assignmentId: string) => [...elKeys.assignment(courseId, assignmentId), 'summary'] as const,
  missingStudents: (courseId: string, assignmentId: string) => [...elKeys.assignment(courseId, assignmentId), 'missing'] as const,
  submission: (id: string) => [...elKeys.all, 'submissions', id] as const,
  quizzes: (courseId: string) => [...elKeys.course(courseId), 'quizzes'] as const,
  quiz: (courseId: string, id: string) => [...elKeys.quizzes(courseId), id] as const,
  quizResults: (courseId: string, quizId: string) => [...elKeys.quiz(courseId, quizId), 'results'] as const,
  engagement: (courseId: string) => [...elKeys.course(courseId), 'engagement'] as const,
  struggling: (courseId: string) => [...elKeys.course(courseId), 'struggling'] as const,
  progress: (courseId: string) => [...elKeys.course(courseId), 'progress'] as const,
  announcements: (courseId: string) => [...elKeys.course(courseId), 'announcements'] as const,
  discussions: (courseId: string) => [...elKeys.course(courseId), 'discussions'] as const,
  discussion: (threadId: string) => [...elKeys.all, 'discussions', threadId] as const,
  auditLogs: () => [...elKeys.all, 'audit-logs'] as const,
};

// ─── Response types ───────────────────────────────────────────────────────────

export interface ElearningLesson {
  id: string;
  courseSpaceId: string;
  title: string;
  topic?: string;
  week?: number;
  orderIndex: number;
  estimatedMinutes?: number;
  status: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElearningMaterial {
  id: string;
  lessonId?: string;
  courseSpaceId: string;
  title: string;
  type: string;
  status: string;
  body?: string;
  fileKey?: string;
  externalUrl?: string;
  isDownloadable: boolean;
  estimatedMinutes?: number;
  orderIndex: number;
  viewCount: number;
  downloadCount: number;
  createdAt: string;
}

export interface ElearningCourse {
  id: string;
  classSubjectId: string;
  subjectName: string;
  className: string;
  term: string;
  academicYear: string;
  status: string;
  teacherId: string;
  enrolledCount: number;
  lessons: ElearningLesson[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ElearningAssignment {
  id: string;
  courseSpaceId: string;
  lessonId?: string;
  title: string;
  instructions?: string;
  submissionMode: string;
  dueAt?: string;
  maxScore?: number;
  allowLateSubmission: boolean;
  latePenaltyPercent: number;
  status: string;
  publishedAt?: string;
  closedAt?: string;
  createdAt: string;
}

export interface ElearningSubmission {
  id: string;
  assignmentId: string;
  courseSpaceId: string;
  studentId: string;
  studentName?: string;
  status: string;
  textAnswer?: string;
  fileKey?: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  isLate: boolean;
  submittedAt?: string;
  gradedAt?: string;
  createdAt: string;
}

export interface ElearningQuizOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  orderIndex: number;
}

export interface ElearningQuizQuestion {
  id: string;
  quizId: string;
  type: string;
  prompt: string;
  points: number;
  orderIndex: number;
  explanation?: string;
  correctAnswer?: string;
  options: ElearningQuizOption[];
}

export interface ElearningQuiz {
  id: string;
  courseSpaceId: string;
  lessonId?: string;
  title: string;
  instructions?: string;
  timeLimitMinutes?: number;
  maxAttempts: number;
  passingScore?: number;
  status: string;
  questions: ElearningQuizQuestion[];
  createdAt: string;
}

export interface ElearningQuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  studentName?: string;
  status: string;
  score?: number;
  maxScore?: number;
  percentScore?: number;
  isPassed?: boolean;
  startedAt: string;
  submittedAt?: string;
  manualMarksPending?: number;
}

export interface SubmissionSummary {
  total: number;
  submitted: number;
  missing: number;
  late: number;
  graded: number;
  returned: number;
}

export interface MissingStudent {
  studentId: string;
  studentName?: string;
  lastActivity?: string;
}

export interface CourseEngagement {
  courseId: string;
  heatmap: { day: number; value: number }[];
  materialStats: { total: number; viewed: number; unviewed: number };
  assignmentStats: { total: number; submitted: number; late: number };
  quizStats: { total: number; attempts: number; averageScore: number };
  studentRiskFlags: { studentId: string; completionPercent: number; reason: string }[];
  activityTimeline: { label: string; value: number }[];
  progress: { studentId: string; completionPercent: number }[];
}

export interface TeacherAnalytics {
  courses: ElearningCourse[];
  activeCourses: number;
  submissionsPending: number;
}

export interface RoleOverview {
  role: string;
  courses: number;
  active: number;
  materials: number;
  assignments: number;
  quizzes: number;
  attempts: number;
}

export interface ElearningAnnouncement {
  id: string;
  courseSpaceId: string;
  title: string;
  body: string;
  status: string;
  isPinned: boolean;
  audience: string;
  publishedAt?: string;
  createdAt: string;
}

export interface ElearningDiscussion {
  id: string;
  courseSpaceId: string;
  lessonId?: string;
  title: string;
  authorId: string;
  authorName?: string;
  isResolved: boolean;
  isPinned: boolean;
  replies: ElearningDiscussionReply[];
  createdAt: string;
}

export interface ElearningDiscussionReply {
  id: string;
  threadId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  actorId: string;
  actorName?: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

// ─── Course display shape (UI adapter) ───────────────────────────────────────

/** Merged shape compatible with all CourseCard render fields */
export interface CourseDisplay {
  id: string;
  subjectName: string;
  className: string;
  classSubjectId: string;
  term: string;
  academicYear: string;
  status: string;
  emoji: string;
  enrolledCount: number;
  lessonCount: number;
  publishedLessons: number;
  materialCount: number;
  assignmentCount: number;
  quizCount: number;
  completion: number;
  pendingSubmissions: number;
  manualMarks: number;
  inactiveStudents: number;
  health: number;
  teacherName?: string;
}

export function mapApiCourse(c: ElearningCourse): CourseDisplay {
  const publishedLessons = c.lessons?.filter((l) => l.status === 'PUBLISHED').length ?? 0;
  const lessonCount = c.lessons?.length ?? 0;
  return {
    id: c.id,
    subjectName: c.subjectName,
    className: c.className,
    classSubjectId: c.classSubjectId,
    term: c.term,
    academicYear: c.academicYear,
    status: c.status,
    emoji: c.subjectName?.[0]?.toUpperCase() ?? 'C',
    enrolledCount: c.enrolledCount,
    lessonCount,
    publishedLessons,
    materialCount: 0,
    assignmentCount: 0,
    quizCount: 0,
    completion: 0,
    pendingSubmissions: 0,
    manualMarks: 0,
    inactiveStudents: 0,
    health: Math.round((publishedLessons / Math.max(lessonCount, 1)) * 100),
  };
}

// ─── Queries — Courses ────────────────────────────────────────────────────────

function normaliseCourse(raw: Record<string, unknown>): ElearningCourse {
  const resolve = (v: unknown): string => {
    if (!v || typeof v !== 'object') return String(v ?? '');
    const o = v as Record<string, unknown>;
    return String(o.name ?? o.fullName ?? o.label ?? o.title ?? '');
  };
  const lessonsRaw = raw.lessons;
  return {
    ...(raw as Partial<ElearningCourse>),
    id: String(raw.id ?? crypto.randomUUID()),
    classSubjectId: String(raw.classSubjectId ?? raw.class_subject_id ?? raw.classId ?? ''),
    subjectName: resolve(raw.subjectName ?? raw.subject ?? raw.subjectId),
    className: resolve(raw.className ?? raw.class ?? raw.class_name),
    term: resolve(raw.term ?? raw.termName),
    academicYear: String(raw.academicYear ?? raw.academic_year ?? ''),
    status: String(raw.status ?? ''),
    teacherId: String(raw.teacherId ?? raw.teacher_id ?? ''),
    enrolledCount: Number(raw.enrolledCount ?? raw.enrolled_count ?? raw.students ?? 0),
    lessons: Array.isArray(lessonsRaw) ? lessonsRaw as ElearningLesson[] : [],
    isActive: Boolean(raw.isActive ?? raw.is_active ?? raw.status === 'ACTIVE'),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? ''),
  } as ElearningCourse;
}

export function useElearningCourses() {
  return useQuery({
    queryKey: elKeys.courses(),
    queryFn: () =>
      api.get('/elearning/courses').then((r) =>
        dedupeById(arrayFromApi(payloadOf(r), ['courses']).map((raw) => normaliseCourse(raw as Record<string, unknown>))),
      ),
  });
}

export function useElearningCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.course(courseId ?? ''),
    queryFn: () =>
      api.get(`/elearning/courses/${courseId}`).then((r) => {
        const raw = payloadOf(r);
        return normaliseCourse(raw as Record<string, unknown>);
      }),
    enabled: Boolean(courseId),
  });
}

export function useTeacherAnalytics() {
  return useQuery({
    queryKey: elKeys.teacherAnalytics(),
    queryFn: () => api.get('/elearning/analytics/teacher/courses').then(payloadOf) as Promise<TeacherAnalytics>,
  });
}

export function useHodOverview() {
  return useQuery({
    queryKey: elKeys.hodOverview(),
    queryFn: () => api.get('/elearning/analytics/hod/overview').then(payloadOf) as Promise<RoleOverview>,
  });
}

export function usePrincipalOverview() {
  return useQuery({
    queryKey: elKeys.principalOverview(),
    queryFn: () => api.get('/elearning/analytics/principal/overview').then(payloadOf) as Promise<RoleOverview>,
  });
}

export function useAqaOverview() {
  return useQuery({
    queryKey: elKeys.aqaOverview(),
    queryFn: () => api.get('/elearning/analytics/aqa/courses').then(payloadOf) as Promise<{ courses: ElearningCourse[] }>,
  });
}

// ─── Queries — Lessons ────────────────────────────────────────────────────────

export function useElearningLessons(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.lessons(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/lessons`)
        .then((r) =>
          arrayFromApi(payloadOf(r), ['lessons']).map((raw) => {
            const l = raw as Record<string, unknown>;
            return {
              ...l,
              id: String(l.id ?? crypto.randomUUID()),
              courseSpaceId: String(l.courseSpaceId ?? l.courseId ?? l.course_space_id ?? ''),
              title: String(l.title ?? l.name ?? l.lessonTitle ?? ''),
              topic: l.topic != null ? String(l.topic) : undefined,
              week: l.week != null ? Number(l.week) : undefined,
              orderIndex: Number(l.orderIndex ?? l.order ?? l.order_index ?? 0),
              estimatedMinutes: l.estimatedMinutes != null ? Number(l.estimatedMinutes) : undefined,
              status: String(l.status ?? 'DRAFT'),
              description: l.description != null ? String(l.description) : undefined,
              createdAt: String(l.createdAt ?? l.created_at ?? ''),
              updatedAt: String(l.updatedAt ?? l.updated_at ?? ''),
            } as ElearningLesson;
          }),
        ),
    enabled: Boolean(courseId),
  });
}

// ─── Queries — Materials ──────────────────────────────────────────────────────

export function useElearningMaterials(courseId: string | undefined, lessonId: string | undefined) {
  return useQuery({
    queryKey: elKeys.materials(courseId ?? '', lessonId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/lessons/${lessonId}/materials`)
        .then((r) => arrayFromApi(payloadOf(r), ['materials']) as ElearningMaterial[]),
    enabled: Boolean(courseId) && Boolean(lessonId),
  });
}

// ─── Queries — Assignments ────────────────────────────────────────────────────

export function useElearningAssignments(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.assignments(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/assignments`)
        .then((r) => arrayFromApi(payloadOf(r), ['assignments']) as ElearningAssignment[]),
    enabled: Boolean(courseId),
  });
}

export function useElearningAssignment(courseId: string | undefined, assignmentId: string | undefined) {
  return useQuery({
    queryKey: elKeys.assignment(courseId ?? '', assignmentId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/assignments/${assignmentId}`)
        .then(payloadOf) as Promise<ElearningAssignment>,
    enabled: Boolean(courseId) && Boolean(assignmentId),
  });
}

export function useAssignmentSubmissions(courseId: string | undefined, assignmentId: string | undefined) {
  return useQuery({
    queryKey: elKeys.assignmentSubmissions(courseId ?? '', assignmentId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/assignments/${assignmentId}/submissions`)
        .then((r) =>
          arrayFromApi(payloadOf(r), ['submissions']).map((raw) => {
            const s = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...s,
              id: String(s.id ?? crypto.randomUUID()),
              assignmentId: String(s.assignmentId ?? s.assignment_id ?? ''),
              courseSpaceId: String(s.courseSpaceId ?? s.course_space_id ?? ''),
              studentId: String(s.studentId ?? s.student_id ?? ''),
              studentName: s.studentName != null ? resolve(s.studentName ?? s.student) : undefined,
              status: String(s.status ?? 'PENDING'),
              score: s.score != null ? Number(s.score) : undefined,
              maxScore: s.maxScore != null ? Number(s.maxScore) : undefined,
              feedback: s.feedback != null ? String(s.feedback) : undefined,
              isLate: Boolean(s.isLate ?? s.is_late ?? false),
              submittedAt: s.submittedAt != null ? String(s.submittedAt) : undefined,
              gradedAt: s.gradedAt != null ? String(s.gradedAt) : undefined,
              createdAt: String(s.createdAt ?? s.created_at ?? ''),
            } as ElearningSubmission;
          }),
        ),
    enabled: Boolean(courseId) && Boolean(assignmentId),
  });
}

export function useSubmissionSummary(courseId: string | undefined, assignmentId: string | undefined) {
  return useQuery({
    queryKey: elKeys.assignmentSummary(courseId ?? '', assignmentId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/assignments/${assignmentId}/submissions/summary`)
        .then(payloadOf) as Promise<SubmissionSummary>,
    enabled: Boolean(courseId) && Boolean(assignmentId),
  });
}

export function useMissingStudents(courseId: string | undefined, assignmentId: string | undefined) {
  return useQuery({
    queryKey: elKeys.missingStudents(courseId ?? '', assignmentId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/assignments/${assignmentId}/submissions/missing`)
        .then((r) => arrayFromApi(payloadOf(r), ['students', 'missing']) as MissingStudent[]),
    enabled: Boolean(courseId) && Boolean(assignmentId),
  });
}

export function useSubmission(submissionId: string | undefined) {
  return useQuery({
    queryKey: elKeys.submission(submissionId ?? ''),
    queryFn: () =>
      api.get(`/elearning/submissions/${submissionId}`).then(payloadOf) as Promise<ElearningSubmission>,
    enabled: Boolean(submissionId),
  });
}

// ─── Queries — Quizzes ────────────────────────────────────────────────────────

export function useElearningQuizzes(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.quizzes(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/quizzes`)
        .then((r) => arrayFromApi(payloadOf(r), ['quizzes']) as ElearningQuiz[]),
    enabled: Boolean(courseId),
  });
}

export function useElearningQuiz(courseId: string | undefined, quizId: string | undefined) {
  return useQuery({
    queryKey: elKeys.quiz(courseId ?? '', quizId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/quizzes/${quizId}`)
        .then(payloadOf) as Promise<ElearningQuiz>,
    enabled: Boolean(courseId) && Boolean(quizId),
  });
}

export function useQuizResults(courseId: string | undefined, quizId: string | undefined) {
  return useQuery({
    queryKey: elKeys.quizResults(courseId ?? '', quizId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/quizzes/${quizId}/results`)
        .then((r) =>
          arrayFromApi(payloadOf(r), ['attempts', 'results']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              quizId: String(a.quizId ?? a.quiz_id ?? ''),
              studentId: String(a.studentId ?? a.student_id ?? ''),
              studentName: a.studentName != null ? resolve(a.studentName ?? a.student) : undefined,
              status: String(a.status ?? ''),
              score: a.score != null ? Number(a.score) : undefined,
              maxScore: a.maxScore != null ? Number(a.maxScore) : undefined,
              percentScore: a.percentScore != null ? Number(a.percentScore) : undefined,
              isPassed: a.isPassed != null ? Boolean(a.isPassed) : undefined,
              startedAt: String(a.startedAt ?? a.started_at ?? ''),
              submittedAt: a.submittedAt != null ? String(a.submittedAt) : undefined,
              manualMarksPending: a.manualMarksPending != null ? Number(a.manualMarksPending) : undefined,
            } as ElearningQuizAttempt;
          }),
        ),
    enabled: Boolean(courseId) && Boolean(quizId),
  });
}

// ─── Queries — Engagement ─────────────────────────────────────────────────────

export function useCourseEngagement(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.engagement(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/analytics/teacher/courses/${courseId}/engagement`)
        .then(payloadOf) as Promise<CourseEngagement>,
    enabled: Boolean(courseId),
    staleTime: 60_000,
  });
}

export function useStrugglingStudents(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.struggling(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/analytics/teacher/courses/${courseId}/struggling`)
        .then((r) => arrayFromApi(payloadOf(r), ['students', 'struggling']) as { studentId: string; completionPercent: number }[]),
    enabled: Boolean(courseId),
  });
}

// ─── Queries — Announcements + Discussions ───────────────────────────────────

export function useElearningAnnouncements(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.announcements(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/announcements`)
        .then((r) =>
          arrayFromApi(payloadOf(r), ['announcements']).map((raw) => {
            const a = raw as Record<string, unknown>;
            return {
              ...a,
              id: String(a.id ?? crypto.randomUUID()),
              courseSpaceId: String(a.courseSpaceId ?? a.course_space_id ?? ''),
              title: String(a.title ?? a.subject ?? a.heading ?? ''),
              body: String(a.body ?? a.content ?? a.message ?? ''),
              status: String(a.status ?? 'DRAFT'),
              isPinned: Boolean(a.isPinned ?? a.is_pinned ?? false),
              audience: String(a.audience ?? a.targetAudience ?? 'STUDENTS'),
              publishedAt: a.publishedAt != null ? String(a.publishedAt) : undefined,
              createdAt: String(a.createdAt ?? a.created_at ?? ''),
            } as ElearningAnnouncement;
          }),
        ),
    enabled: Boolean(courseId),
  });
}

export function useElearningDiscussions(courseId: string | undefined) {
  return useQuery({
    queryKey: elKeys.discussions(courseId ?? ''),
    queryFn: () =>
      api
        .get(`/elearning/courses/${courseId}/discussions`)
        .then((r) => arrayFromApi(payloadOf(r), ['discussions', 'threads']) as ElearningDiscussion[]),
    enabled: Boolean(courseId),
  });
}

export function useElearningDiscussion(threadId: string | undefined) {
  return useQuery({
    queryKey: elKeys.discussion(threadId ?? ''),
    queryFn: () =>
      api.get(`/elearning/discussions/${threadId}`).then(payloadOf) as Promise<ElearningDiscussion>,
    enabled: Boolean(threadId),
  });
}

// ─── Queries — Audit ─────────────────────────────────────────────────────────

export function useElearningAuditLogs() {
  return useQuery({
    queryKey: elKeys.auditLogs(),
    queryFn: () =>
      api
        .get('/elearning/admin/audit-logs')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['logs', 'auditLogs']).map((raw) => {
            const l = raw as Record<string, unknown>;
            const resolve = (v: unknown): string => {
              if (!v || typeof v !== 'object') return String(v ?? '');
              const o = v as Record<string, unknown>;
              return String(o.name ?? o.fullName ?? o.label ?? '');
            };
            return {
              ...l,
              id: String(l.id ?? crypto.randomUUID()),
              action: String(l.action ?? l.eventType ?? l.event ?? ''),
              actorId: String(l.actorId ?? l.actor_id ?? l.userId ?? ''),
              actorName: l.actorName != null ? resolve(l.actorName ?? l.actor) : undefined,
              entityType: String(l.entityType ?? l.entity_type ?? l.resourceType ?? ''),
              entityId: String(l.entityId ?? l.entity_id ?? l.resourceId ?? ''),
              createdAt: String(l.createdAt ?? l.created_at ?? l.timestamp ?? ''),
            } as AuditLog;
          }),
        ),
    staleTime: 60_000,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function usePublishCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      api.patch(`/elearning/courses/${courseId}/publish`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: elKeys.courses() }),
  });
}

export function usePublishLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, lessonId }: { courseId: string; lessonId: string }) =>
      api.patch(`/elearning/courses/${courseId}/lessons/${lessonId}/publish`).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.lessons(courseId) }),
  });
}

export function usePublishAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, assignmentId }: { courseId: string; assignmentId: string }) =>
      api.patch(`/elearning/courses/${courseId}/assignments/${assignmentId}/publish`).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.assignments(courseId) }),
  });
}

export function usePublishQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, quizId }: { courseId: string; quizId: string }) =>
      api.patch(`/elearning/courses/${courseId}/quizzes/${quizId}/publish`).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.quizzes(courseId) }),
  });
}

export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, score, feedback }: { submissionId: string; score: number; feedback?: string }) =>
      api.patch(`/elearning/submissions/${submissionId}/grade`, { score, feedback }).then((r) => r.data),
    onSuccess: (_d, { submissionId }) => qc.invalidateQueries({ queryKey: elKeys.submission(submissionId) }),
  });
}

export function useReturnSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, feedback }: { submissionId: string; feedback?: string }) =>
      api.patch(`/elearning/submissions/${submissionId}/return`, { feedback }).then((r) => r.data),
    onSuccess: (_d, { submissionId }) => qc.invalidateQueries({ queryKey: elKeys.submission(submissionId) }),
  });
}

export function useGradeShortAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      attemptId,
      questionId,
      score,
      feedback,
    }: { attemptId: string; questionId: string; score: number; feedback?: string }) =>
      api
        .patch(`/elearning/attempts/${attemptId}/grade-short-answer`, { questionId, score, feedback })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: elKeys.all }),
  });
}

export function useAddDiscussionReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, body }: { threadId: string; body: string }) =>
      api.post(`/elearning/discussions/${threadId}/replies`, { body }).then((r) => r.data),
    onSuccess: (_d, { threadId }) =>
      qc.invalidateQueries({ queryKey: elKeys.discussion(threadId) }),
  });
}

export function usePublishAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, announcementId }: { courseId: string; announcementId: string }) =>
      api.patch(`/elearning/courses/${courseId}/announcements/${announcementId}/publish`).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.announcements(courseId) }),
  });
}

export function useResolveDiscussion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) =>
      api.patch(`/elearning/discussions/${threadId}/resolve`).then((r) => r.data),
    onSuccess: (_d, threadId) => qc.invalidateQueries({ queryKey: elKeys.discussion(threadId) }),
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: (payload: { fileName: string; contentBase64: string; mimeType: string; domain?: string }) =>
      api.post<{ fileKey: string; url: string }>('/elearning/uploads/local', payload).then((r) => r.data),
  });
}

export function useCreateLesson() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, body }: { courseId: string; body: Record<string, unknown> }) =>
      api.post<ElearningLesson>(`/elearning/courses/${courseId}/lessons`, body).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.lessons(courseId) }),
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, body }: { courseId: string; body: Record<string, unknown> }) =>
      api.post<ElearningAssignment>(`/elearning/courses/${courseId}/assignments`, body).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.assignments(courseId) }),
  });
}

export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, body }: { courseId: string; body: Record<string, unknown> }) =>
      api.post<ElearningQuiz>(`/elearning/courses/${courseId}/quizzes`, body).then((r) => r.data),
    onSuccess: (_d, { courseId }) => qc.invalidateQueries({ queryKey: elKeys.quizzes(courseId) }),
  });
}

export function useAddQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, body }: { quizId: string; courseId: string; body: Record<string, unknown> }) =>
      api.post<ElearningQuizQuestion>(`/elearning/quizzes/${quizId}/questions`, body).then((r) => r.data),
    onSuccess: (_d, { courseId, quizId }) =>
      qc.invalidateQueries({ queryKey: elKeys.quiz(courseId, quizId) }),
  });
}
