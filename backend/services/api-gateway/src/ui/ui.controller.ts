import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GatewayUser, UiApiService, UiEnvelope } from './ui-api.service';

const STUDENT_ROLES = ['STUDENT', 'SYSTEM_ADMIN'];
const PARENT_ROLES = ['PARENT', 'GUARDIAN', 'SYSTEM_ADMIN'];
const TEACHER_ROLES = ['TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN'];
const HOD_ROLES = ['HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN'];
const AQA_ROLES = ['ACADEMIC_QA', 'PRINCIPAL', 'SYSTEM_ADMIN'];
const FINANCE_ROLES = ['FINANCE', 'HEAD_OF_FINANCE', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGING_DIRECTOR', 'SYSTEM_ADMIN'];
const PRINCIPAL_ROLES = ['PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN', 'SYSTEM_ADMIN'];
const ADMIN_ROLES = ['SYSTEM_ADMIN'];
const LEADERSHIP_ROLES = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'FINANCE'];

@Controller(['', 'api/v1'])
export class UiController {
  constructor(private readonly ui: UiApiService) {}

  /// Schools the signed-in user can work in (id + name), for the mobile school switcher.
  @Get('mobile/schools')
  async mobileSchools(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const ids = (user.schoolIds ?? []).filter((id) => id && id !== '*');
    const res = await this.ui.tryGet({ service: 'student', path: '/schools' }, [], this.asService(user));
    // Biggest school first, so staff in several schools land where the data is (not an empty one).
    const sizes = await this.ui.tryGet({ service: 'student', path: '/students/internal/schools' }, [], this.asService(user));
    const studentCount = new Map((this.ui.asArray(sizes.data) as Record<string, any>[]).map((sc) => [String(sc.id), Number(sc.studentCount ?? 0)]));
    const schools = (this.ui.asArray(res.data) as Record<string, any>[])
      .filter((sc) => user.scope === 'GROUP' || ids.includes(String(sc.id)))
      .map((sc) => ({ id: sc.id, name: sc.name, code: sc.code ?? null }))
      .sort((a, b) => (studentCount.get(String(b.id)) ?? 0) - (studentCount.get(String(a.id)) ?? 0) || String(a.name).localeCompare(String(b.name)));
    return this.ui.envelope({ schools }, this.warning(res));
  }

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
      results: { service: 'academic', path: '/academics/results', params: { studentId }, fallback: [] },
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
    }, user);
    // /finance/payments is staff-only; a student's confirmed payments are exactly their receipts.
    return this.ui.envelope({ studentId, ...data, payments: this.ui.asArray(data.receipts) }, warnings);
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

  @Get('mobile/parent/children/:childId/school-contact')
  @Roles(...PARENT_ROLES)
  async mobileParentSchoolContact(
    @CurrentUser() user: GatewayUser,
    @Param('childId') childId: string,
  ): Promise<UiEnvelope> {
    const profile = await this.ui.tryGet(
      { service: 'student', path: `/students/${childId}` },
      null,
      user,
    );
    const schoolId = this.pickId(profile.data, ['school']);
    if (!schoolId) {
      return this.ui.envelope(
        { childId, schoolName: '', address: '', openHours: '', emergencyPhone: '', actions: [], teachers: [], faqItems: [] },
        this.warning(profile),
      );
    }
    // The parent is authorized (PARENT_ROLES) and the schoolId was derived from
    // their own child's profile. The school-details endpoint is staff-scoped, so
    // the gateway — the trust boundary — reads it as a trusted service and
    // returns only non-sensitive contact fields below.
    const school = await this.ui.tryGet(
      { service: 'student', path: `/schools/${schoolId}` },
      null,
      this.asService(user),
    );
    const s = (school.data as unknown as Record<string, unknown>) ?? {};
    const phone = (s.phone as string) ?? '';
    const email = (s.email as string) ?? '';
    const address = (s.address as string) ?? '';
    const actions: Array<Record<string, string>> = [];
    if (phone) actions.push({ type: 'PHONE', label: 'Call school', value: phone });
    if (email) actions.push({ type: 'EMAIL', label: 'Email school', value: email });
    if (address) actions.push({ type: 'MAPS', label: 'View on map', value: address });
    return this.ui.envelope(
      {
        childId,
        schoolName: (s.name as string) ?? '',
        address,
        openHours: '',
        emergencyPhone: phone,
        actions,
        teachers: [],
        faqItems: [],
      },
      [...this.warning(profile), ...this.warning(school)],
    );
  }

  @Get('mobile/parent/children/:childId/class-averages')
  @Roles(...PARENT_ROLES)
  async mobileParentClassAverages(
    @CurrentUser() user: GatewayUser,
    @Param('childId') childId: string,
    @Query('termId') termId?: string,
  ): Promise<UiEnvelope> {
    const profile = await this.ui.tryGet(
      { service: 'student', path: `/students/${childId}` },
      null,
      user,
    );
    // The active class lives on the most recent enrolment, not the top-level
    // student record, so resolve it from there (falling back to any top-level
    // classId a leaner student payload might expose).
    const profileObj = (profile.data as unknown as Record<string, unknown>) ?? {};
    const enrolments = this.ui.asArray(profileObj.enrolments ?? profileObj.enrollments);
    const firstEnrolment = (enrolments[0] as Record<string, unknown>) ?? {};
    const classId =
      this.pickId(firstEnrolment, ['class']) ?? this.pickId(profile.data, ['class']);
    if (!classId) {
      return this.ui.envelope({ childId, averages: {} }, this.warning(profile));
    }
    // classId derives from the parent's own child; the class-analytics endpoint
    // is staff-scoped, so the gateway reads it as a trusted service and exposes
    // ONLY aggregated per-subject averages below — never any individual student
    // identity or result.
    const analytics = await this.ui.tryGet(
      {
        service: 'analytics',
        path: `/analytics/academic/class/${classId}`,
        params: termId ? { termId } : undefined,
      },
      null,
      this.asService(user),
    );
    const subjects = this.ui.asArray(
      (analytics.data as unknown as Record<string, unknown> | null)?.subjects,
    );
    const averages: Record<string, number> = {};
    for (const entry of subjects) {
      const row = entry as Record<string, unknown>;
      const name = row.subjectName as string;
      const avg = Number(row.classAverage);
      // Aggregated only — no individual student identities or results exposed.
      if (name && Number.isFinite(avg)) averages[name] = avg;
    }
    return this.ui.envelope(
      { childId, averages },
      [...this.warning(profile), ...this.warning(analytics)],
    );
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
    const warnings = this.warning(result);
    const items = await this.shapeTeacherItems(resource, this.ui.asArray(result.data) as Record<string, any>[], user, warnings);
    return this.ui.envelope({ resource, items, raw: result.data }, warnings);
  }

  /// Students of one class-subject, shaped for the mobile roster/marks screens.
  @Get('teacher/class-subjects/:classSubjectId/students')
  @Roles(...TEACHER_ROLES)
  async teacherClassStudents(@CurrentUser() user: GatewayUser, @Param('classSubjectId') classSubjectId: string): Promise<UiEnvelope> {
    const warnings: string[] = [];
    // The mobile app may also pass a class id directly.
    const classId: string = (await this.resolveClassId(user, classSubjectId)) ?? classSubjectId;
    const labels = await this.classLabels(user);
    const students = await this.ui.tryGet(
      { service: 'student', path: '/students', params: { classId, limit: 1000, page: 1 } },
      [],
      user,
    );
    warnings.push(...this.warning(students));
    const items = (this.ui.asArray(students.data) as Record<string, any>[]).map((st) => ({
      id: st.id,
      firstName: st.firstName,
      lastName: st.lastName,
      name: `${st.firstName ?? ''} ${st.lastName ?? ''}`.trim(),
      registrationNumber: st.registrationNumber,
      classLabel: labels.get(classId)?.label ?? '',
    }));
    return this.ui.envelope({ resource: 'students', items, raw: items }, warnings);
  }

  /// Records a class's attendance for a day; resolves class and current term from the class-subject.
  @Post('teacher/attendance')
  @Roles(...TEACHER_ROLES)
  async teacherMarkAttendance(
    @CurrentUser() user: GatewayUser,
    @Body() body: { classSubjectId?: string; classId?: string; date?: string; records?: Array<{ studentId: string; status: string; note?: string }> },
  ): Promise<UiEnvelope> {
    if (!Array.isArray(body?.records) || body.records.length === 0) {
      throw new BadRequestException('Attendance records are required');
    }
    let classId = body.classId;
    if (!classId && body.classSubjectId) {
      classId = await this.resolveClassId(user, body.classSubjectId);
    }
    if (!classId) throw new BadRequestException('classId could not be resolved');
    const terms = this.ui.asArray(await this.ui.get('student', '/students/terms', user)) as Record<string, any>[];
    const current = terms.find((t) => t.isCurrent) ?? terms[0];
    if (!current) throw new BadRequestException('No active term is configured');
    const date = (body.date ?? new Date().toISOString()).slice(0, 10);
    const result = await this.ui.post('student', '/students/attendance', {
      classId,
      termId: current.id,
      date,
      records: body.records,
    }, user);
    return this.ui.envelope(result);
  }

  /// Updates a teacher's syllabus coverage for one class-subject.
  @Patch('teacher/syllabus/:classSubjectId')
  @Roles(...TEACHER_ROLES)
  async teacherUpdateSyllabus(
    @CurrentUser() user: GatewayUser,
    @Param('classSubjectId') classSubjectId: string,
    @Body() body: { coveredTopics?: number },
  ): Promise<UiEnvelope> {
    const list = await this.ui.get('academic', '/academics/syllabus', user, { teacherId: user.id });
    const record = (this.ui.asArray(list) as Record<string, any>[]).find((r) => r.classSubjectId === classSubjectId);
    if (!record) throw new NotFoundException('Syllabus record not found for this class subject');
    const updated = await this.ui.patch('academic', `/academics/syllabus/${record.id}`, { coveredTopics: Number(body?.coveredTopics ?? 0) }, user);
    return this.ui.envelope(updated);
  }

  /// class-subjects have no by-id route; look the id up in the caller's own list.
  private async resolveClassId(user: GatewayUser, classSubjectId: string): Promise<string | undefined> {
    const params = ['TEACHER', 'HEAD_OF_DEPARTMENT'].includes(user.role) ? { teacherId: user.id } : undefined;
    const list = await this.ui.tryGet({ service: 'academic', path: '/academics/class-subjects', params }, [], user);
    const match = (this.ui.asArray(list.data) as Record<string, any>[]).find((cs) => String(cs.id) === classSubjectId);
    return match?.classId;
  }

  private async classLabels(user: GatewayUser): Promise<Map<string, { label: string; studentCount: number }>> {
    const res = await this.ui.tryGet({ service: 'student', path: '/students/classes', params: { limit: 500 } }, [], user);
    const map = new Map<string, { label: string; studentCount: number }>();
    for (const c of this.ui.asArray(res.data) as Record<string, any>[]) {
      map.set(String(c.id), {
        label: `${c.name ?? ''}${c.stream ? ` ${c.stream}` : ''}`.trim(),
        studentCount: Number(c.studentCount ?? c._count?.enrolments ?? 0),
      });
    }
    return map;
  }

  /// Converts raw downstream rows into the shapes the mobile teacher screens render.
  private async shapeTeacherItems(
    resource: string,
    rows: Record<string, any>[],
    user: GatewayUser,
    warnings: string[],
  ): Promise<unknown[]> {
    if (!['classes', 'assessments', 'attendance', 'alerts', 'timetable', 'syllabus'].includes(resource)) return rows;

    const labels = await this.classLabels(user);
    const labelOf = (classId?: string) => (classId ? labels.get(classId)?.label ?? '' : '');
    const classSubjects: Record<string, any>[] = resource === 'classes'
      ? rows
      : (this.ui.asArray(
          (await this.ui.tryGet({ service: 'academic', path: '/academics/class-subjects', params: { teacherId: user.id } }, [], user)).data,
        ) as Record<string, any>[]);
    const csById = new Map(classSubjects.map((cs) => [String(cs.id), cs]));

    switch (resource) {
      case 'classes':
        return rows.map((cs) => ({
          ...cs,
          subject: cs.subject?.name ?? '',
          subjectName: cs.subject?.name ?? '',
          classLabel: labelOf(cs.classId),
          studentCount: labels.get(String(cs.classId))?.studentCount ?? 0,
          averageScore: 0,
          attendanceRate: 0,
          nextLesson: '',
        }));
      case 'assessments':
        return rows.map((a) => ({
          ...a,
          title: a.name,
          dueLabel: a.date ? String(a.date).slice(0, 10) : '',
          totalStudents: labels.get(String(a.classId))?.studentCount ?? 0,
          // Anything past OPEN has had its marks entered for the whole class.
          enteredCount: ['SUBMITTED', 'HOD_APPROVED', 'APPROVED', 'LOCKED', 'MARKS_ENTERED'].includes(String(a.status))
            ? labels.get(String(a.classId))?.studentCount ?? 0
            : Number(a._count?.marks ?? 0),
        }));
      case 'attendance': {
        const today = new Date().toISOString().slice(0, 10);
        const marked = await this.ui.tryGet(
          { service: 'student', path: '/students/attendance', params: { startDate: today, endDate: today, limit: 1000 } },
          [],
          user,
        );
        warnings.push(...this.warning(marked));
        const markedClasses = new Set((this.ui.asArray(marked.data) as Record<string, any>[]).map((r) => String(r.classId)));
        const seen = new Set<string>();
        const sessions: unknown[] = [];
        for (const cs of classSubjects) {
          const classId = String(cs.classId);
          if (seen.has(classId)) continue;
          seen.add(classId);
          const done = markedClasses.has(classId);
          sessions.push({
            id: cs.id,
            classSubjectId: cs.id,
            classId,
            title: labelOf(classId) || 'Class',
            timeLabel: 'Today',
            statusLabel: done ? 'MARKED' : 'PENDING',
            isUrgent: !done,
          });
        }
        return sessions;
      }
      case 'alerts':
        return rows.map((al) => ({
          ...al,
          studentName: `${al.student?.firstName ?? ''} ${al.student?.lastName ?? ''}`.trim(),
          classLabel: '',
          subject: al.subjectName ?? '',
          type: al.alertType,
          previousScore: Number(al.currentScore ?? 0) - Number(al.trendSlope ?? 0),
          currentScore: Number(al.currentScore ?? 0),
        }));
      case 'timetable':
        return rows.map((slot) => {
          const day = String(slot.dayOfWeek ?? '');
          return {
            ...slot,
            day: day ? day.charAt(0) + day.slice(1).toLowerCase() : '',
            time: `${slot.startTime ?? ''} - ${slot.endTime ?? ''}`,
            title: `${slot.subject?.name ?? ''} · ${labelOf(slot.classId)}`.trim(),
            classSubjectId: '',
            room: slot.room ?? '',
          };
        });
      case 'syllabus':
        return rows.map((r) => {
          const cs = csById.get(String(r.classSubjectId));
          return {
            ...r,
            title: `${cs?.subject?.name ?? 'Subject'} · ${labelOf(cs?.classId)}`.trim(),
            covered: Number(r.coveredTopics ?? 0),
            total: Number(r.totalTopics ?? 0),
            nextTopic: r.notes ?? '',
          };
        });
      default:
        return rows;
    }
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
    const warnings: string[] = [];
    let items: unknown[];
    if (resource === 'department' || resource === 'teachers') {
      items = await this.hodDepartment(resource, user, warnings);
    } else if (resource === 'timetable') {
      items = await this.hodTimetable(user, warnings);
    } else {
      const route = this.hodRoute(resource);
      const result = await this.ui.tryGet(route, [], user);
      warnings.push(...this.warning(result));
      items = await this.shapeHodItems(resource, this.ui.asArray(result.data) as Record<string, any>[], user);
    }
    return this.ui.envelope({ resource, items, raw: items }, warnings);
  }

  /// Weekly slots for the classes and subjects of the HOD's own department.
  private async hodTimetable(user: GatewayUser, warnings: string[]): Promise<unknown[]> {
    const [csRes, ttRes, staff, names, labels] = await Promise.all([
      this.ui.tryGet({ service: 'academic', path: '/academics/class-subjects' }, [], user),
      this.ui.tryGet({ service: 'academic', path: '/academics/timetables' }, [], user),
      this.staffDirectory(user),
      this.subjectNames(user),
      this.classLabels(user),
    ]);
    warnings.push(...this.warning(csRes), ...this.warning(ttRes));
    const mine = new Set(
      (this.ui.asArray(csRes.data) as Record<string, any>[]).map((cs) => `${cs.classId}:${cs.subjectId}`),
    );
    const order = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    return (this.ui.asArray(ttRes.data) as Record<string, any>[])
      .filter((slot) => mine.has(`${slot.classId}:${slot.subjectId}`))
      .sort((a, b) => order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek) || String(a.startTime).localeCompare(String(b.startTime), undefined, { numeric: true }))
      .map((slot) => ({
        id: slot.id,
        day: String(slot.dayOfWeek ?? '').slice(0, 3).replace(/^./, (c: string) => c.toUpperCase()).replace(/(?<=.)./g, (c: string) => c.toLowerCase()),
        time: String(slot.startTime ?? ''),
        title: `${names.get(String(slot.subjectId)) ?? 'Subject'} ${labels.get(String(slot.classId))?.label ?? ''}`.trim(),
        subtitle: `${staff.get(String(slot.teacherId))?.name ?? 'Teacher'}${slot.room ? ` - ${slot.room}` : ''}`,
      }));
  }

  private async staffDirectory(user: GatewayUser): Promise<Map<string, { name: string; department: string | null }>> {
    const res = await this.ui.tryGet(
      { service: 'auth', path: '/auth/internal/users-by-role', params: { roles: 'TEACHER,HEAD_OF_DEPARTMENT' } },
      { users: [] } as { users?: Record<string, any>[] },
      user,
    );
    const users = (Array.isArray(res.data) ? res.data : (res.data as { users?: Record<string, any>[] })?.users ?? []) as Record<string, any>[];
    const map = new Map<string, { name: string; department: string | null }>();
    for (const u of users) {
      map.set(String(u.id), {
        name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || String(u.email ?? ''),
        department: u.department ?? null,
      });
    }
    return map;
  }

  private async subjectNames(user: GatewayUser): Promise<Map<string, string>> {
    const res = await this.ui.tryGet({ service: 'academic', path: '/academics/subjects', params: { limit: 500 } }, [], user);
    return new Map((this.ui.asArray(res.data) as Record<string, any>[]).map((sub) => [String(sub.id), String(sub.name)]));
  }

  /// Department view for a head of department: subjects and teachers of their own department.
  private async hodDepartment(resource: string, user: GatewayUser, warnings: string[]): Promise<unknown[]> {
    const staff = await this.staffDirectory(user);
    const myDepartment = staff.get(user.id)?.department ?? null;
    const inDepartment = (teacherId: string) => {
      const member = staff.get(teacherId);
      return !!member && (!myDepartment || member.department === myDepartment);
    };
    const classSubjectsRes = await this.ui.tryGet({ service: 'academic', path: '/academics/class-subjects', params: { limit: 1000 } }, [], user);
    warnings.push(...this.warning(classSubjectsRes));
    const classSubjects = (this.ui.asArray(classSubjectsRes.data) as Record<string, any>[]).filter((cs) => inDepartment(String(cs.teacherId)));
    const names = await this.subjectNames(user);

    if (resource === 'teachers') {
      const byTeacher = new Map<string, Set<string>>();
      for (const cs of classSubjects) {
        const set = byTeacher.get(String(cs.teacherId)) ?? new Set<string>();
        set.add(names.get(String(cs.subjectId)) ?? cs.subject?.name ?? 'Subject');
        byTeacher.set(String(cs.teacherId), set);
      }
      return [...byTeacher.entries()].map(([id, subjects]) => ({
        id,
        name: staff.get(id)?.name ?? id,
        subjects: [...subjects].join(', '),
        onTimeRate: 0,
        averageScore: 0,
        syllabusCompletion: 0,
      }));
    }

    const subjectIds = [...new Set(classSubjects.map((cs) => String(cs.subjectId)))].slice(0, 8);
    // Analytics scopes by the active school, so query each subject within the school that teaches it.
    const schoolOfSubject = new Map(classSubjects.map((cs) => [String(cs.subjectId), cs.schoolId as string | undefined]));
    const analytics = await Promise.all(
      subjectIds.map((id) =>
        this.ui.tryGet<Record<string, any> | null>(
          { service: 'analytics', path: `/analytics/department/${id}` },
          null,
          { ...user, activeSchoolId: schoolOfSubject.get(id) ?? user.activeSchoolId },
        ),
      ),
    );
    const teacherName = (raw?: string) => {
      const id = String(raw ?? '').replace(/^Teacher\s+/, '');
      return staff.get(id)?.name ?? (raw ?? '');
    };
    return subjectIds.map((id, i) => {
      const a = analytics[i].data ?? {};
      if (analytics[i].warning) warnings.push(analytics[i].warning as string);
      return {
        id,
        name: a.subjectName ?? names.get(id) ?? 'Subject',
        average: Number(a.overallAverage ?? 0),
        syllabusCompletion: Number(a.syllabusCompletionAverage ?? 0),
        atRiskStudents: Array.isArray(a.atRiskStudents) ? a.atRiskStudents.length : 0,
        classes: (Array.isArray(a.byClass) ? a.byClass : []).map((c: Record<string, any>) => ({
          classLabel: `${c.className ?? ''} ${c.stream ?? ''}`.trim(),
          teacherName: teacherName(c.teacherName),
          average: Number(c.average ?? 0),
          studentCount: 0,
        })),
      };
    });
  }

  private async shapeHodItems(resource: string, rows: Record<string, any>[], user: GatewayUser): Promise<unknown[]> {
    if (!['approvals', 'performance'].includes(resource)) return rows;
    const labels = await this.classLabels(user);
    const names = await this.subjectNames(user);
    const staff = await this.staffDirectory(user);
    if (resource === 'performance') {
      return rows.map((al) => {
        const studentName = `${al.student?.firstName ?? ''} ${al.student?.lastName ?? ''}`.trim();
        return {
          ...al,
          title: `${studentName || 'Student'} - ${al.subjectName ?? ''}`.trim(),
          subject: al.subjectName ?? '',
          classLabel: '',
          isEscalated: al.severity === 'CRITICAL',
        };
      });
    }
    const daysAgo = (iso?: string) => {
      if (!iso) return '';
      const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
      return days === 0 ? 'Today' : days === 1 ? '1 day ago' : `${days} days ago`;
    };
    return rows.map((a) => ({
      ...a,
      subject: names.get(String(a.subjectId)) ?? '',
      classLabel: labels.get(String(a.classId))?.label ?? '',
      assessmentType: a.name ?? '',
      teacherName: staff.get(String(a.submittedById ?? ''))?.name ?? '',
      submittedAgo: daysAgo(a.submittedAt),
      studentCount: labels.get(String(a.classId))?.studentCount ?? 0,
    }));
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

  /// Marks awaiting the principal's final approval, shaped for the mobile approvals list.
  @Get('principal/approvals')
  @Roles(...PRINCIPAL_ROLES)
  async principalApprovals(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'academic', path: '/academics/assessments/pending-approval' }, [], user);
    const items = await this.shapeHodItems('approvals', this.ui.asArray(result.data) as Record<string, any>[], user);
    return this.ui.envelope({ resource: 'approvals', items }, this.warning(result));
  }

  /// Unresolved high/critical performance alerts with the student's name attached.
  @Get('principal/at-risk')
  @Roles(...PRINCIPAL_ROLES)
  async principalAtRisk(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet(
      { service: 'academic', path: '/academics/performance/alerts', params: { severity: 'HIGH,CRITICAL' } },
      [],
      user,
    );
    const items = await this.shapeHodItems('performance', this.ui.asArray(result.data) as Record<string, any>[], user);
    return this.ui.envelope({ resource: 'at-risk', items }, this.warning(result));
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

  /// by-auth lookups return `{ studentId, ... }`; full records return `{ id, ... }`.
  private idFrom(value: unknown): string | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const obj = value as { id?: unknown; studentId?: unknown };
    const id = obj.id ?? obj.studentId;
    return typeof id === 'string' && id ? id : undefined;
  }

  private warning(result: { warning?: string }): string[] {
    return result.warning ? [result.warning] : [];
  }

  /// Returns a copy of the user with an elevated role for a trusted, read-only
  /// downstream call the gateway has already authorized. The original school
  /// scope is preserved, so cross-school data can never be reached this way —
  /// only the role gate is satisfied.
  private asService(user: GatewayUser): GatewayUser {
    return { ...user, role: 'SYSTEM_ADMIN' };
  }

  /// Resolves an id from a downstream record, tolerating either a flat
  /// `<key>Id` string or a nested `{ <key>: { id } }` relation object.
  private pickId(source: unknown, keys: string[]): string | null {
    if (!source || typeof source !== 'object') return null;
    const obj = source as Record<string, unknown>;
    for (const key of keys) {
      const flat = obj[`${key}Id`] ?? obj[key];
      if (typeof flat === 'string' && flat) return flat;
      if (flat && typeof flat === 'object') {
        const nested = (flat as Record<string, unknown>).id;
        if (typeof nested === 'string' && nested) return nested;
      }
    }
    return null;
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
