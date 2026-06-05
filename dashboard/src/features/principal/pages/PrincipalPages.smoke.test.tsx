/**
 * Smoke tests: every Principal page component renders without crashing.
 * Hooks are mocked to return empty/minimal data; no network calls are made.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock framer-motion (jsdom has no layout engine) ─────────────────────────
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_t, tag) => (props: Record<string, unknown>) => React.createElement(String(tag), props) }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Mock all principal hooks ─────────────────────────────────────────────────
vi.mock('../api/principal.hooks', () => ({
  usePendingMarkApprovals:                () => ({ data: [], isLoading: false, isError: false }),
  useMarksForApproval:                    () => ({ data: [], isLoading: false }),
  usePublishReadiness:                    () => ({ data: [], isLoading: false, isError: false }),
  usePrincipalPendingPayments:            () => ({ data: [], isLoading: false }),
  usePrincipalDiscipline:                 () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  usePrincipalStudents:                   () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  usePrincipalStaff:                      () => ({ data: [], isLoading: false }),
  usePrincipalAudit:                      () => ({ data: [], isLoading: false }),
  usePrincipalAnnouncements:              () => ({ data: [], isLoading: false }),
  usePrincipalSchoolHealth:               () => ({ data: undefined }),
  usePrincipalSchoolSettings:             () => ({ data: undefined }),
  usePrincipalFinanceOverview:            () => ({ data: undefined }),
  useCreatePrincipalAnnouncementMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useResolveDisciplineMutation:           () => ({ mutate: vi.fn(), isPending: false }),
  useSignReportCardMutation:              () => ({ mutate: vi.fn(), isPending: false }),
  usePatchSchoolSettingsMutation:         () => ({ mutate: vi.fn(), isPending: false }),
  useApprovePrincipalAssessmentMutation:  () => ({ mutate: vi.fn(), isPending: false }),
  useRejectPrincipalAssessmentMutation:   () => ({ mutate: vi.fn(), isPending: false }),
  usePublishResultsMutation:              () => ({ mutate: vi.fn(), isPending: false }),
  useApprovePaymentMutation:              () => ({ mutate: vi.fn(), isPending: false }),
  useRejectPaymentMutation:               () => ({ mutate: vi.fn(), isPending: false }),
  useLockMarksMutation:                   () => ({ mutate: vi.fn(), isPending: false }),
  useReturnMarksMutation:                 () => ({ mutate: vi.fn(), isPending: false }),
  usePrincipalDashboard:                  () => ({ data: undefined }),
  usePrincipalAnalytics:                  () => ({ data: undefined }),
}));

// ─── Mock operations hooks ────────────────────────────────────────────────────
vi.mock('../../operations/api/operations.hooks', () => ({
  useGenerateReportMutation: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
  downloadReportWhenReady:   vi.fn(),
}));

// ─── Mock elearning hooks (used by PrincipalElearningPage) ───────────────────
vi.mock('../../elearning/api/elearning.hooks', () => ({
  usePrincipalOverview:    () => ({ data: undefined }),
  useElearningCourses:     () => ({ data: [], isLoading: false }),
  useElearningAnalytics:   () => ({ data: undefined }),
  useCourseSummaryMetrics: () => ({ data: undefined }),
  mapApiCourse:            (c: unknown) => c,
}));

// ─── Mock toast ───────────────────────────────────────────────────────────────
vi.mock('../../../lib/toast', () => ({ toast: vi.fn() }));

// ─── Test wrapper ─────────────────────────────────────────────────────────────
function makeQc() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function Wrapper({ children, path = '/principal' }: { children: React.ReactNode; path?: string }) {
  return (
    <QueryClientProvider client={makeQc()}>
      <MemoryRouter initialEntries={[path]}>
        {children}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Helper that renders a page component inside a route so useParams works
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

// ─── Import all pages after mocks are set up ─────────────────────────────────
import { PrincipalElearningPage } from '../../elearning/pages/ElearningPages';
import {
  PrincipalHomePage,
  MarksFinalApprovalPage,
  PrincipalMarksReviewPage,
  ResultsPublishingPage,
  ReportCardsManagementPage,
  PrincipalReportCardDetailPage,
  FinanceOversightPage,
  PaymentApprovalsPage,
  PaymentApprovalDetailPage,
  PrincipalInvoiceManagementPage,
  PrincipalPerformanceOverviewPage,
  PrincipalStudentProfilePage,
  PrincipalStudentsPage,
  DisciplineOverviewPage,
  StaffOverviewPage,
  PrincipalAnnouncementsPage,
  CreatePrincipalAnnouncementPage,
  PrincipalAnalyticsPage,
  PrincipalReportsPage,
  SchoolSettingsPage,
  PrincipalAuditPage,
  PrincipalExportsPage,
} from './PrincipalPages';

// ─── Smoke tests ─────────────────────────────────────────────────────────────

describe('Principal pages smoke tests — all routes render without crashing', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('/principal — PrincipalHomePage renders', () => {
    render(<Wrapper><PrincipalHomePage /></Wrapper>);
    // If React threw, test would already fail. Just assert something mounted.
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/approvals — MarksFinalApprovalPage renders', () => {
    render(<Wrapper path="/principal/approvals"><MarksFinalApprovalPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/approvals/marks/:assessmentId — PrincipalMarksReviewPage renders (loading)', () => {
    renderPage(PrincipalMarksReviewPage, '/principal/approvals/marks/:assessmentId', '/principal/approvals/marks/a1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/results/publish — ResultsPublishingPage renders (empty state)', () => {
    render(<Wrapper path="/principal/results/publish"><ResultsPublishingPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/report-cards — ReportCardsManagementPage renders', () => {
    render(<Wrapper path="/principal/report-cards"><ReportCardsManagementPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/report-cards/:id — PrincipalReportCardDetailPage renders', () => {
    renderPage(PrincipalReportCardDetailPage, '/principal/report-cards/:id', '/principal/report-cards/rc1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/finance — FinanceOversightPage renders', () => {
    render(<Wrapper path="/principal/finance"><FinanceOversightPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/finance/approvals — PaymentApprovalsPage renders', () => {
    render(<Wrapper path="/principal/finance/approvals"><PaymentApprovalsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/finance/approvals/:id — PaymentApprovalDetailPage renders (loading)', () => {
    renderPage(PaymentApprovalDetailPage, '/principal/finance/approvals/:id', '/principal/finance/approvals/p1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/finance/invoices — PrincipalInvoiceManagementPage renders', () => {
    render(<Wrapper path="/principal/finance/invoices"><PrincipalInvoiceManagementPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/performance — PrincipalPerformanceOverviewPage renders', () => {
    render(<Wrapper path="/principal/performance"><PrincipalPerformanceOverviewPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/students — PrincipalStudentsPage renders', () => {
    render(<Wrapper path="/principal/students"><PrincipalStudentsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/students/:studentId — PrincipalStudentProfilePage renders (loading)', () => {
    renderPage(PrincipalStudentProfilePage, '/principal/students/:studentId', '/principal/students/s1');
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/discipline — DisciplineOverviewPage renders', () => {
    render(<Wrapper path="/principal/discipline"><DisciplineOverviewPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/staff — StaffOverviewPage renders', () => {
    render(<Wrapper path="/principal/staff"><StaffOverviewPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/announcements — PrincipalAnnouncementsPage renders', () => {
    render(<Wrapper path="/principal/announcements"><PrincipalAnnouncementsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/announcements/create — CreatePrincipalAnnouncementPage renders', () => {
    render(<Wrapper path="/principal/announcements/create"><CreatePrincipalAnnouncementPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/analytics — PrincipalAnalyticsPage renders', () => {
    render(<Wrapper path="/principal/analytics"><PrincipalAnalyticsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/reports — PrincipalReportsPage renders', () => {
    render(<Wrapper path="/principal/reports"><PrincipalReportsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/settings/school — SchoolSettingsPage renders', () => {
    render(<Wrapper path="/principal/settings/school"><SchoolSettingsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/audit — PrincipalAuditPage renders', () => {
    render(<Wrapper path="/principal/audit"><PrincipalAuditPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/exports — PrincipalExportsPage renders', () => {
    render(<Wrapper path="/principal/exports"><PrincipalExportsPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });

  it('/principal/elearning — PrincipalElearningPage renders', () => {
    render(<Wrapper path="/principal/elearning"><PrincipalElearningPage /></Wrapper>);
    expect(document.body.firstChild).toBeTruthy();
  });
});
