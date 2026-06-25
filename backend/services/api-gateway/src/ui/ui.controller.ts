import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GatewayUser, UiApiService, UiEnvelope } from './ui-api.service';

const STUDENT_ROLES = ['STUDENT', 'SYSTEM_ADMIN'];
const PARENT_ROLES = ['PARENT', 'GUARDIAN', 'SYSTEM_ADMIN'];
const TEACHER_ROLES = ['TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN'];
const HOD_ROLES = ['HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN'];
const AQA_ROLES = ['ACADEMIC_QA', 'PRINCIPAL', 'SYSTEM_ADMIN'];
const FINANCE_ROLES = ['FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN'];
const PRINCIPAL_ROLES = ['PRINCIPAL', 'SYSTEM_ADMIN'];
const ADMIN_ROLES = ['SYSTEM_ADMIN'];
const LEADERSHIP_ROLES = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'FINANCE'];

@Controller(['', 'api/v1'])
export class UiController {
  constructor(private readonly ui: UiApiService) {}

  @Get('mobile/student/dashboard')
  @Roles(...STUDENT_ROLES)
  async mobileStudentDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const student = await this.ui.tryGet(
      { service: 'student', path: `/students/internal/by-auth/${user.id}` },
      null,
      user,
    );
    const studentId = this.idFrom(student.data) || user.id;

    const { data, warnings } = await this.ui.collect({
      profile: { service: 'student', path: `/students/${studentId}`, fallback: student.data },
      attendanceSummary: { service: 'student', path: `/students/attendance/summary/${studentId}`, fallback: null },
      performance: { service: 'academic', path: `/academics/performance/student/${studentId}`, fallback: null },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
      notifications: { service: 'notification', path: '/notifications', fallback: [] },
      announcements: { service: 'notification', path: '/notifications/announcements/active', fallback: [] },
      invoices: { service: 'finance', path: `/finance/invoices/student/${studentId}`, fallback: [] },
    }, user);

    return this.ui.envelope({
      ...data,
      summary: {
        unreadNotifications: this.ui.summarizeList(data.notifications).count,
        activeAnnouncements: this.ui.summarizeList(data.announcements).count,
        openInvoices: this.ui.summarizeList(data.invoices).count,
        activeAlerts: this.ui.summarizeList(data.alerts).count,
      },
    }, [...this.warning(student), ...warnings]);
  }

  @Get('mobile/student/terms-overview')
  @Roles(...STUDENT_ROLES)
  async mobileStudentTermsOverview(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const studentId = await this.resolveStudentId(user);
    const { data, warnings } = await this.ui.collect({
      terms: { service: 'student', path: '/students/terms', fallback: [] },
      results: { service: 'academic', path: '/academics/results', fallback: [] },
      reportCards: { service: 'academic', path: `/academics/report-cards/student/${studentId}`, fallback: [] },
    }, user);
    return this.ui.envelope({ studentId, ...data }, warnings);
  }

  @Get('mobile/parent/children/:childId/terms-overview')
  @Roles(...PARENT_ROLES)
  async mobileParentChildTermsOverview(@CurrentUser() user: GatewayUser, @Param('childId') childId: string): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      terms: { service: 'student', path: '/students/terms', fallback: [] },
      results: { service: 'academic', path: '/academics/results', params: { studentId: childId }, fallback: [] },
      reportCards: { service: 'academic', path: `/academics/report-cards/student/${childId}`, fallback: [] },
    }, user);
    return this.ui.envelope({ childId, ...data }, warnings);
  }

  @Get('mobile/student/results/terms/:termId')
  @Roles(...STUDENT_ROLES)
  async mobileStudentTermResults(@CurrentUser() user: GatewayUser, @Param('termId') termId: string): Promise<UiEnvelope> {
    const studentId = await this.resolveStudentId(user);
    const result = await this.ui.tryGet(
      { service: 'academic', path: `/academics/internal/results/${studentId}/term/${termId}` },
      null,
      user,
    );
    return this.ui.envelope({ termId, result: result.data }, this.warning(result));
  }

  @Get('mobile/student/report-cards/:termId')
  @Roles(...STUDENT_ROLES)
  async mobileStudentReportCard(@CurrentUser() user: GatewayUser, @Param('termId') termId: string): Promise<UiEnvelope> {
    const studentId = await this.resolveStudentId(user);
    const result = await this.ui.tryGet(
      { service: 'academic', path: `/academics/report-cards/${studentId}/term/${termId}` },
      null,
      user,
    );
    return this.ui.envelope({ termId, reportCard: result.data }, this.warning(result));
  }

  @Get('mobile/student/attendance/summary')
  @Roles(...STUDENT_ROLES)
  async mobileStudentAttendance(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const studentId = await this.resolveStudentId(user);
    const result = await this.ui.tryGet(
      { service: 'student', path: `/students/attendance/summary/${studentId}` },
      null,
      user,
    );
    return this.ui.envelope({ studentId, attendance: result.data }, this.warning(result));
  }

  @Get('mobile/student/finance')
  @Roles(...STUDENT_ROLES)
  async mobileStudentFinance(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const studentId = await this.resolveStudentId(user);
    const { data, warnings } = await this.ui.collect({
      invoices: { service: 'finance', path: `/finance/invoices/student/${studentId}`, fallback: [] },
      balance: { service: 'finance', path: `/finance/internal/student/${studentId}/balance`, fallback: null },
      receipts: { service: 'finance', path: '/finance/receipts', params: { studentId }, fallback: [] },
      payments: { service: 'finance', path: '/finance/payments', params: { studentId }, fallback: [] },
    }, user);
    return this.ui.envelope({ studentId, ...data }, warnings);
  }

  @Get('mobile/parent/children')
  @Roles(...PARENT_ROLES)
  async mobileParentChildren(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet(
      { service: 'student', path: `/students/internal/guardian-by-auth/${user.id}` },
      [],
      user,
    );
    return this.ui.envelope({ children: this.ui.asArray(result.data) }, this.warning(result));
  }

  @Get('mobile/parent/children/:childId/dashboard')
  @Roles(...PARENT_ROLES)
  async mobileParentChildDashboard(@CurrentUser() user: GatewayUser, @Param('childId') childId: string): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      profile: { service: 'student', path: `/students/${childId}`, fallback: null },
      attendanceSummary: { service: 'student', path: `/students/attendance/summary/${childId}`, fallback: null },
      performance: { service: 'academic', path: `/academics/performance/student/${childId}`, fallback: null },
      invoices: { service: 'finance', path: `/finance/invoices/student/${childId}`, fallback: [] },
      announcements: { service: 'notification', path: '/notifications/announcements/active', fallback: [] },
    }, user);
    return this.ui.envelope({ childId, ...data }, warnings);
  }

  @Get('teacher/dashboard')
  @Roles(...TEACHER_ROLES)
  async teacherDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      classes: { service: 'academic', path: '/academics/class-subjects', params: { teacherId: user.id }, fallback: [] },
      assessments: { service: 'academic', path: '/academics/assessments', params: { teacherId: user.id }, fallback: [] },
      timetable: { service: 'academic', path: '/academics/timetables', params: { teacherId: user.id }, fallback: [] },
      syllabus: { service: 'academic', path: '/academics/syllabus', params: { teacherId: user.id }, fallback: [] },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
      announcements: { service: 'notification', path: '/notifications/announcements/active', fallback: [] },
    }, user);
    return this.ui.envelope(this.withCounts(data, ['classes', 'assessments', 'alerts', 'announcements']), warnings);
  }

  @Get('teacher/:resource')
  @Roles(...TEACHER_ROLES)
  async teacherResource(@CurrentUser() user: GatewayUser, @Param('resource') resource: string): Promise<UiEnvelope> {
    const route = this.teacherRoute(resource, user);
    const result = await this.ui.tryGet(route, [], user);
    return this.ui.envelope({ resource, items: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('hod/dashboard')
  @Roles(...HOD_ROLES)
  async hodDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      approvals: { service: 'academic', path: '/academics/assessments/pending-approval', fallback: [] },
      academicOverview: { service: 'analytics', path: '/analytics/academic/overview', fallback: null },
      department: { service: 'analytics', path: '/analytics/department/overview', fallback: null },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
      pairings: { service: 'academic', path: '/academics/performance/pairings', fallback: [] },
      announcements: { service: 'notification', path: '/notifications/announcements/active', fallback: [] },
    }, user);
    return this.ui.envelope(this.withCounts(data, ['approvals', 'alerts', 'pairings', 'announcements']), warnings);
  }

  @Get('hod/approvals/history')
  @Roles(...HOD_ROLES)
  async hodApprovalHistory(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet(
      { service: 'academic', path: '/academics/assessments', params: { status: 'APPROVED,REJECTED' } },
      [],
      user,
    );
    return this.ui.envelope({ approvals: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('hod/:resource')
  @Roles(...HOD_ROLES)
  async hodResource(@CurrentUser() user: GatewayUser, @Param('resource') resource: string): Promise<UiEnvelope> {
    const route = this.hodRoute(resource);
    const result = await this.ui.tryGet(route, [], user);
    return this.ui.envelope({ resource, items: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('aqa/dashboard')
  @Roles(...AQA_ROLES)
  async aqaDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      overview: { service: 'analytics', path: '/analytics/overview', fallback: null },
      academicOverview: { service: 'analytics', path: '/analytics/academic/overview', fallback: null },
      performanceEngine: { service: 'analytics', path: '/analytics/academic/performance-engine', fallback: null },
      atRiskStudents: { service: 'analytics', path: '/analytics/students/at-risk', fallback: [] },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
      pairings: { service: 'academic', path: '/academics/performance/pairings/effectiveness', fallback: [] },
    }, user);
    return this.ui.envelope(this.withCounts(data, ['atRiskStudents', 'alerts', 'pairings']), warnings);
  }

  @Get('finance/dashboard')
  @Roles(...FINANCE_ROLES)
  async financeDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      overview: { service: 'analytics', path: '/analytics/finance/overview', fallback: null },
      forecast: { service: 'analytics', path: '/analytics/finance/revenue-forecast', fallback: null },
      invoices: { service: 'finance', path: '/finance/invoices', fallback: [] },
      pendingPayments: { service: 'finance', path: '/finance/payments/pending-approval', fallback: [] },
      receipts: { service: 'finance', path: '/finance/receipts', fallback: [] },
      assets: { service: 'finance', path: '/finance/assets/summary', fallback: null },
    }, user);
    return this.ui.envelope(this.withCounts(data, ['invoices', 'pendingPayments', 'receipts']), warnings);
  }

  @Get('principal/dashboard')
  @Roles(...PRINCIPAL_ROLES)
  async principalDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      overview: { service: 'analytics', path: '/analytics/overview', fallback: null },
      academic: { service: 'analytics', path: '/analytics/academic/overview', fallback: null },
      finance: { service: 'analytics', path: '/analytics/finance/overview', fallback: null },
      attendance: { service: 'analytics', path: '/analytics/attendance/overview', fallback: null },
      approvals: { service: 'academic', path: '/academics/assessments/pending-approval', fallback: [] },
      payments: { service: 'finance', path: '/finance/payments/pending-approval', fallback: [] },
      discipline: { service: 'student', path: '/students/discipline', fallback: [] },
    }, user);
    return this.ui.envelope(this.withCounts(data, ['approvals', 'payments', 'discipline']), warnings);
  }

  @Get('principal/staff')
  @Roles(...PRINCIPAL_ROLES)
  async principalStaff(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      staff: { service: 'auth', path: '/auth/internal/users-by-role', params: { roles: 'TEACHER,HEAD_OF_DEPARTMENT' }, fallback: [] },
      syllabus: { service: 'academic', path: '/academics/syllabus', fallback: [] },
    }, user);
    return this.ui.envelope({ staff: this.ui.asArray(data.staff), syllabus: this.ui.asArray(data.syllabus) }, warnings);
  }

  @Get('principal/students/:studentId/profile')
  @Roles(...PRINCIPAL_ROLES)
  async principalStudentProfile(@CurrentUser() user: GatewayUser, @Param('studentId') studentId: string): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      student: { service: 'student', path: `/students/${studentId}`, fallback: null },
      discipline: { service: 'student', path: `/students/discipline/${studentId}`, fallback: [] },
      performance: { service: 'academic', path: `/academics/performance/student/${studentId}`, fallback: null },
      balance: { service: 'finance', path: `/finance/internal/student/${studentId}/balance`, fallback: null },
    }, user);
    return this.ui.envelope({ studentId, ...data }, warnings);
  }

  @Get('principal/settings/school')
  @Roles(...PRINCIPAL_ROLES)
  async principalSchoolSettings(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      gradingScale: { service: 'academic', path: '/academics/grading-scales', fallback: [] },
      assessmentTypes: { service: 'academic', path: '/academics/assessment-types', fallback: [] },
    }, user);
    return this.ui.envelope({ ...data }, warnings);
  }

  @Get('principal/audit')
  @Roles(...PRINCIPAL_ROLES)
  async principalAudit(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      financeAudit: { service: 'finance', path: '/finance/audit-logs', fallback: [] },
      notificationLogs: { service: 'notification', path: '/notifications/logs', fallback: [] },
    }, user);
    const logs = [
      ...this.ui.asArray(data.financeAudit).map((item) => ({ ...(item as Record<string, unknown>), _source: 'finance' })),
      ...this.ui.asArray(data.notificationLogs).map((item) => ({ ...(item as Record<string, unknown>), _source: 'notification' })),
    ];
    return this.ui.envelope({ logs }, warnings);
  }

  @Get('admin/system/health')
  @Roles(...ADMIN_ROLES)
  async adminSystemHealth(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      auth: { service: 'auth', path: '/auth/health', fallback: { status: 'unavailable' } },
      student: { service: 'student', path: '/students/health', fallback: { status: 'unavailable' } },
      academic: { service: 'academic', path: '/academics/health', fallback: { status: 'unavailable' } },
      finance: { service: 'finance', path: '/finance/health', fallback: { status: 'unavailable' } },
      notification: { service: 'notification', path: '/notifications/health', fallback: { status: 'unavailable' } },
      analytics: { service: 'analytics', path: '/analytics/health', fallback: { status: 'unavailable' } },
    }, user);
    return this.ui.envelope(data, warnings);
  }

  @Get('admin/dashboard')
  @Roles(...ADMIN_ROLES)
  async adminDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      users: { service: 'auth', path: '/auth/internal/users-by-role', params: { roles: this.allOperationalRoles() }, fallback: [] },
      classes: { service: 'student', path: '/students/classes', fallback: [] },
      terms: { service: 'student', path: '/students/terms', fallback: [] },
      feeCategories: { service: 'finance', path: '/finance/fee-categories', fallback: [] },
      systemHealth: { service: 'analytics', path: '/analytics/health', fallback: { status: 'unknown' } },
    }, user);
    return this.ui.envelope(this.withCounts(data, ['users', 'classes', 'terms', 'feeCategories']), warnings);
  }

  @Get('admin/audit/system')
  @Roles(...ADMIN_ROLES)
  async adminSystemAudit(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      financeAudit: { service: 'finance', path: '/finance/audit-logs', fallback: [] },
      notificationLogs: { service: 'notification', path: '/notifications/logs', fallback: [] },
      users: { service: 'auth', path: '/auth/internal/users-by-role', params: { roles: this.allOperationalRoles() }, fallback: [] },
    }, user);
    return this.ui.envelope({
      ...data,
      auditStreams: [
        { id: 'finance', title: 'Finance Audit', items: this.ui.asArray(data.financeAudit) },
        { id: 'notifications', title: 'Notification Logs', items: this.ui.asArray(data.notificationLogs) },
        { id: 'users', title: 'User Directory Snapshot', items: this.ui.asArray(data.users) },
      ],
    }, warnings);
  }

  @Get('search')
  @Roles(...LEADERSHIP_ROLES)
  async search(@CurrentUser() user: GatewayUser, @Query('q') q = ''): Promise<UiEnvelope> {
    const term = String(q || '').trim().toLowerCase();
    if (!term) return this.ui.envelope({ query: '', results: [] });

    const { data, warnings } = await this.ui.collect({
      students: { service: 'student', path: '/students', fallback: [] },
      users: { service: 'auth', path: '/auth/internal/users-by-role', params: { roles: this.allOperationalRoles() }, fallback: [] },
      announcements: { service: 'notification', path: '/notifications/announcements', fallback: [] },
      invoices: { service: 'finance', path: '/finance/invoices', fallback: [] },
    }, user);

    const results = Object.entries(data).flatMap(([type, value]) =>
      this.ui.asArray(value)
        .filter((item) => JSON.stringify(item).toLowerCase().includes(term))
        .slice(0, 10)
        .map((item) => ({ type, item })),
    );

    return this.ui.envelope({ query: q, results }, warnings);
  }

  @Get('reports/catalog')
  @Roles(...LEADERSHIP_ROLES)
  reportsCatalog(): UiEnvelope {
    return this.ui.envelope({
      reports: [
        { id: 'academic-overview', title: 'Academic Overview', source: '/analytics/academic/overview' },
        { id: 'attendance-overview', title: 'Attendance Overview', source: '/analytics/attendance/overview' },
        { id: 'finance-overview', title: 'Finance Overview', source: '/analytics/finance/overview' },
        { id: 'student-risk', title: 'Students At Risk', source: '/analytics/students/at-risk' },
        { id: 'fee-defaulters', title: 'Fee Defaulters', source: '/finance/reports/fee-defaulters' },
      ],
    });
  }

  @Get('reports/jobs')
  @Roles(...LEADERSHIP_ROLES)
  async reportsJobs(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'analytics', path: '/analytics/reports' }, [], user);
    return this.ui.envelope({ jobs: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('reports/scheduled')
  @Roles(...LEADERSHIP_ROLES)
  async scheduledReports(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'analytics', path: '/analytics/reports', params: { scheduled: true } }, [], user);
    return this.ui.envelope({ scheduledReports: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('reports/templates')
  @Roles(...LEADERSHIP_ROLES)
  reportsTemplates(): UiEnvelope {
    return this.ui.envelope({
      templates: [
        { id: 'teacher-performance', title: 'Teacher Performance Review', roles: ['HEAD_OF_DEPARTMENT', 'PRINCIPAL'] },
        { id: 'department-quality', title: 'Department Quality Pack', roles: ['ACADEMIC_QA', 'PRINCIPAL'] },
        { id: 'finance-board-pack', title: 'Finance Board Pack', roles: ['FINANCE', 'PRINCIPAL'] },
        { id: 'student-risk', title: 'Student Risk Register', roles: ['TEACHER', 'HEAD_OF_DEPARTMENT', 'ACADEMIC_QA'] },
      ],
    });
  }

  @Get('reports/audit')
  @Roles(...LEADERSHIP_ROLES)
  async reportsAudit(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      reportJobs: { service: 'analytics', path: '/analytics/reports', fallback: [] },
      financeAudit: { service: 'finance', path: '/finance/audit-logs', fallback: [] },
    }, user);
    return this.ui.envelope(data, warnings);
  }

  @Get('reports/results-publishing/readiness')
  @Roles(...LEADERSHIP_ROLES)
  async resultsPublishingReadiness(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      pendingApprovals: { service: 'academic', path: '/academics/assessments', params: { status: 'SUBMITTED' }, fallback: [] },
      academicOverview: { service: 'analytics', path: '/analytics/academic/overview', fallback: null },
      atRiskStudents: { service: 'analytics', path: '/analytics/students/at-risk', fallback: [] },
    }, user);
    const blockers = [
      ...this.ui.asArray(data.pendingApprovals).map((item) => ({ type: 'pending_approval', item })),
      ...this.ui.asArray(data.atRiskStudents).map((item) => ({ type: 'student_risk', item })),
    ];
    return this.ui.envelope({ ...data, blockers, ready: blockers.length === 0 }, warnings);
  }

  private async resolveStudentId(user: GatewayUser): Promise<string> {
    const student = await this.ui.tryGet<{ id?: string }>(
      { service: 'student', path: `/students/internal/by-auth/${user.id}` },
      { id: user.id },
      user,
    );
    return this.idFrom(student.data) || user.id;
  }

  private idFrom(value: unknown): string | undefined {
    if (value && typeof value === 'object' && 'id' in value) {
      return String((value as { id: string }).id);
    }
    return undefined;
  }

  private warning(result: { warning?: string }): string[] {
    return result.warning ? [result.warning] : [];
  }

  private withCounts(data: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const counts = keys.reduce<Record<string, number>>((acc, key) => {
      acc[key] = this.ui.summarizeList(data[key]).count;
      return acc;
    }, {});
    return { ...data, counts };
  }

  private teacherRoute(resource: string, user: GatewayUser) {
    const routes: Record<string, { service: 'academic' | 'student' | 'notification'; path: string; params?: Record<string, unknown> }> = {
      classes: { service: 'academic', path: '/academics/class-subjects', params: { teacherId: user.id } },
      assessments: { service: 'academic', path: '/academics/assessments', params: { teacherId: user.id } },
      timetable: { service: 'academic', path: '/academics/timetables', params: { teacherId: user.id } },
      syllabus: { service: 'academic', path: '/academics/syllabus', params: { teacherId: user.id } },
      alerts: { service: 'academic', path: '/academics/performance/alerts' },
      announcements: { service: 'notification', path: '/notifications/announcements/active' },
      attendance: { service: 'student', path: '/students/attendance' },
    };
    return routes[resource] || routes.classes;
  }

  private hodRoute(resource: string) {
    const routes: Record<string, { service: 'academic' | 'analytics' | 'notification'; path: string }> = {
      approvals: { service: 'academic', path: '/academics/assessments/pending-approval' },
      department: { service: 'analytics', path: '/analytics/academic/overview' },
      teachers: { service: 'analytics', path: '/analytics/academic/overview' },
      performance: { service: 'academic', path: '/academics/performance/alerts' },
      interventions: { service: 'academic', path: '/academics/interventions' },
      announcements: { service: 'notification', path: '/notifications/announcements' },
    };
    return routes[resource] || routes.department;
  }

  private allOperationalRoles(): string {
    return [
      'SYSTEM_ADMIN',
      'PRINCIPAL',
      'ACADEMIC_QA',
      'FINANCE',
      'HEAD_OF_DEPARTMENT',
      'TEACHER',
      'PARENT',
      'GUARDIAN',
      'STUDENT',
    ].join(',');
  }
}
