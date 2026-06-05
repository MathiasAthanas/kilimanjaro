/**
 * Smoke tests: every Teacher page component renders without crashing.
 * Hooks are mocked to return empty/minimal data; no network calls are made.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock framer-motion ───────────────────────────────────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_t, tag) => (props: Record<string, unknown>) => React.createElement(String(tag), props) }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Mock teacher hooks ───────────────────────────────────────────────────────
vi.mock('../api/teacher.hooks', () => ({
  useTeacherClasses:               () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useTeacherAssessments:           () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useTeacherTimetable:             () => ({ data: [], isLoading: false }),
  usePerformanceAlerts:            () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  usePerfPairings:                 () => ({ data: [], isLoading: false, isError: false }),
  useClassStudents:                () => ({ data: [], isLoading: false }),
  useMarksSheet:                   () => ({ data: [], isLoading: false }),
  useAttendanceList:               () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useStudentPerformance:           () => ({ data: undefined, isLoading: false, isError: false }),
  useClassAnalytics:               () => ({ data: undefined }),
  useTeacherAnnouncements:         () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useSubmitAssessmentMutation:     () => ({ mutate: vi.fn(), isPending: false }),
  useSubmitMarksBulkMutation:      () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useMarkAttendanceMutation:       () => ({ mutate: vi.fn(), isPending: false }),
  useCreateAnnouncementMutation:   () => ({ mutate: vi.fn(), isPending: false }),
  useCreateInterventionMutation:   () => ({ mutate: vi.fn(), isPending: false }),
  useResolveAlertMutation:         () => ({ mutate: vi.fn(), isPending: false }),
}));

// ─── Mock operations hooks ────────────────────────────────────────────────────
vi.mock('../../operations/api/operations.hooks', () => ({
  useGenerateReportMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({ id: 'job-1' }), isPending: false }),
  downloadReportWhenReady:   vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock toast ───────────────────────────────────────────────────────────────
vi.mock('../../../lib/toast', () => ({ toast: vi.fn() }));

// ─── Test wrapper ─────────────────────────────────────────────────────────────
function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, path = '/teacher' }: { children: React.ReactNode; path?: string }) {
  return (
    <QueryClientProvider client={makeQc()}>
      <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function renderPage(Component: React.ComponentType, routePath: string, urlPath: string) {
  return render(
    <QueryClientProvider client={makeQc()}>
      <MemoryRouter initialEntries={[urlPath]}>
        <Routes>
          <Route path={routePath} element={<Component />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Import pages after mocks ─────────────────────────────────────────────────
import {
  TeacherHomePage,
  TeacherClassesPage,
  ClassWorkspacePage,
  ClassStudentsPage,
  ClassAnalyticsPage,
  AssessmentListPage,
  MarksEntryPage,
  AssessmentSubmitPage,
  MarksReviewPage,
  AttendancePage,
  AttendanceHistoryPage,
  PerformanceAlertsPage,
  AlertDetailPage,
  PeerPairingsPage,
  PairingDetailPage,
  StudentPerformancePage,
  TimetablePage,
  SyllabusPage,
  TeacherAnnouncementsPage,
  CreateTeacherAnnouncementPage,
  CreateInterventionPage,
  TeacherExportsPage,
} from './TeacherPages';

// ─── Smoke tests ─────────────────────────────────────────────────────────────
describe('Teacher pages smoke tests — all routes render without crashing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('/teacher — TeacherHomePage renders', () => {
    render(<Wrapper><TeacherHomePage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/classes — TeacherClassesPage renders', () => {
    render(<Wrapper path="/teacher/classes"><TeacherClassesPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/classes/:classSubjectId — ClassWorkspacePage renders (not found)', () => {
    renderPage(ClassWorkspacePage, '/teacher/classes/:classSubjectId', '/teacher/classes/cs-1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/classes/:classSubjectId/students — ClassStudentsPage renders (not found)', () => {
    renderPage(ClassStudentsPage, '/teacher/classes/:classSubjectId/students', '/teacher/classes/cs-1/students');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/classes/:classSubjectId/analytics — ClassAnalyticsPage renders (not found)', () => {
    renderPage(ClassAnalyticsPage, '/teacher/classes/:classSubjectId/analytics', '/teacher/classes/cs-1/analytics');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/assessments — AssessmentListPage renders', () => {
    render(<Wrapper path="/teacher/assessments"><AssessmentListPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/assessments/:assessmentId/marks — MarksEntryPage renders (not found)', () => {
    renderPage(MarksEntryPage, '/teacher/assessments/:assessmentId/marks', '/teacher/assessments/a1/marks');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/assessments/:assessmentId/submit — AssessmentSubmitPage renders (not found)', () => {
    renderPage(AssessmentSubmitPage, '/teacher/assessments/:assessmentId/submit', '/teacher/assessments/a1/submit');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/assessments/:assessmentId/review — MarksReviewPage renders (not found)', () => {
    renderPage(MarksReviewPage, '/teacher/assessments/:assessmentId/review', '/teacher/assessments/a1/review');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/attendance — AttendancePage renders', () => {
    render(<Wrapper path="/teacher/attendance"><AttendancePage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/attendance/history — AttendanceHistoryPage renders', () => {
    render(<Wrapper path="/teacher/attendance/history"><AttendanceHistoryPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/performance/alerts — PerformanceAlertsPage renders', () => {
    render(<Wrapper path="/teacher/performance/alerts"><PerformanceAlertsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/performance/alerts/:id — AlertDetailPage renders (not found)', () => {
    renderPage(AlertDetailPage, '/teacher/performance/alerts/:id', '/teacher/performance/alerts/a1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/performance/pairings — PeerPairingsPage renders', () => {
    render(<Wrapper path="/teacher/performance/pairings"><PeerPairingsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/performance/pairings/:id — PairingDetailPage renders (not found)', () => {
    renderPage(PairingDetailPage, '/teacher/performance/pairings/:id', '/teacher/performance/pairings/p1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/students/:studentId/performance — StudentPerformancePage renders (not found)', () => {
    renderPage(StudentPerformancePage, '/teacher/students/:studentId/performance', '/teacher/students/s1/performance');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/timetable — TimetablePage renders', () => {
    render(<Wrapper path="/teacher/timetable"><TimetablePage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/syllabus — SyllabusPage renders', () => {
    render(<Wrapper path="/teacher/syllabus"><SyllabusPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/announcements — TeacherAnnouncementsPage renders (empty state)', () => {
    render(<Wrapper path="/teacher/announcements"><TeacherAnnouncementsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/announcements/create — CreateTeacherAnnouncementPage renders', () => {
    render(<Wrapper path="/teacher/announcements/create"><CreateTeacherAnnouncementPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/interventions/create — CreateInterventionPage renders', () => {
    render(<Wrapper path="/teacher/interventions/create"><CreateInterventionPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/teacher/exports — TeacherExportsPage renders', () => {
    render(<Wrapper path="/teacher/exports"><TeacherExportsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });
});
