import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeneratedReport, ReportStatus, ReportType } from '../../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, resolveScopeSchoolIds } from '../common/helpers/school-scope.helper';
import { AcademicService } from '../academic/academic.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ExecutiveService } from '../executive/executive.service';
import { FinanceAnalyticsService } from '../finance/finance.service';
import { OverviewService } from '../overview/overview.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { AttendanceSummaryGenerator } from './generators/attendance-summary.generator';
import { BoardExecutiveGenerator } from './generators/board-executive.generator';
import { ClassAcademicGenerator } from './generators/class-academic.generator';
import { FinanceCollectionGenerator } from './generators/finance-collection.generator';
import { OutstandingBalancesGenerator } from './generators/outstanding-balances.generator';
import { PerformanceEngineGenerator } from './generators/performance-engine.generator';
import { ReportCardGenerator } from './generators/report-card.generator';
import { SchoolOverviewGenerator } from './generators/school-overview.generator';
import { StudentProfileGenerator } from './generators/student-profile.generator';
import { TeacherPerformanceGenerator } from './generators/teacher-performance.generator';
import { GenerateReportDto } from './reports.dto';

/** Names shown to people in lists and used for downloaded file names. */
export const REPORT_TITLES: Record<string, string> = {
  SCHOOL_OVERVIEW: 'School Overview Report',
  CLASS_ACADEMIC: 'Class Academic Report',
  STUDENT_PROFILE: 'Student Profile',
  FINANCE_COLLECTION: 'Finance Collection Report',
  OUTSTANDING_BALANCES: 'Outstanding Balances Report',
  PERFORMANCE_ENGINE: 'Performance Engine Report',
  ATTENDANCE_SUMMARY: 'Attendance Summary Report',
  TEACHER_PERFORMANCE: 'Teacher Performance Report',
  TERM_SUMMARY: 'Term Summary Report',
  ANNUAL_SUMMARY: 'Annual Summary Report',
  BOARD_EXECUTIVE: 'Board Executive Report',
  REPORT_CARD: 'Student Report Card',
  CUSTOM: 'Custom Report',
};

const LEADERS = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'MANAGING_DIRECTOR', 'BOARD_DIRECTOR', 'PRINCIPAL', 'HEAD_OF_SCHOOL'];
const FINANCE_TEAM = [...LEADERS, 'FINANCE', 'HEAD_OF_FINANCE'];
const ACADEMIC_LEADS = [...LEADERS, 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT'];
const TEACHING = [...ACADEMIC_LEADS, 'TEACHER'];

/** Who may generate which report. The endpoint itself is open to all of them, so each type is checked here. */
export const REPORT_ACCESS: Record<string, string[]> = {
  SCHOOL_OVERVIEW: [...LEADERS, 'ACADEMIC_QA', 'HEAD_OF_FINANCE'],
  TERM_SUMMARY: [...LEADERS, 'ACADEMIC_QA', 'HEAD_OF_FINANCE'],
  ANNUAL_SUMMARY: [...LEADERS, 'ACADEMIC_QA', 'HEAD_OF_FINANCE'],
  CUSTOM: [...LEADERS, 'ACADEMIC_QA', 'HEAD_OF_FINANCE'],
  BOARD_EXECUTIVE: LEADERS,
  FINANCE_COLLECTION: FINANCE_TEAM,
  OUTSTANDING_BALANCES: FINANCE_TEAM,
  PERFORMANCE_ENGINE: ACADEMIC_LEADS,
  ATTENDANCE_SUMMARY: TEACHING,
  CLASS_ACADEMIC: TEACHING,
  TEACHER_PERFORMANCE: TEACHING,
  STUDENT_PROFILE: [...TEACHING, 'FINANCE', 'HEAD_OF_FINANCE'],
  REPORT_CARD: TEACHING,
};

export function slug(title: string): string {
  return title.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

const schoolFilter = (schoolId: string) => ({ parameters: { path: ['schoolId'], equals: schoolId } });

@Injectable()
export class ReportsService {
  private readonly storageRoot: string;
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly overviewService: OverviewService,
    private readonly academicService: AcademicService,
    private readonly financeService: FinanceAnalyticsService,
    private readonly attendanceService: AttendanceService,
    private readonly studentsService: StudentsService,
    private readonly executiveService: ExecutiveService,
    private readonly schoolOverviewGenerator: SchoolOverviewGenerator,
    private readonly classAcademicGenerator: ClassAcademicGenerator,
    private readonly studentProfileGenerator: StudentProfileGenerator,
    private readonly financeCollectionGenerator: FinanceCollectionGenerator,
    private readonly outstandingBalancesGenerator: OutstandingBalancesGenerator,
    private readonly performanceEngineGenerator: PerformanceEngineGenerator,
    private readonly attendanceSummaryGenerator: AttendanceSummaryGenerator,
    private readonly teacherPerformanceGenerator: TeacherPerformanceGenerator,
    private readonly boardExecutiveGenerator: BoardExecutiveGenerator,
    private readonly reportCardGenerator: ReportCardGenerator,
  ) {
    this.storageRoot = path.resolve(this.config.get<string>('PDF_STORAGE_PATH', './storage/analytics'));
  }

  private fileFor(reportId: string, format: string): string {
    return path.join(this.storageRoot, `${reportId}.${format.toLowerCase()}`);
  }

  /** The schools a report reads from: the one asked for, else everything the caller may see (null = whole group). */
  private scopeFor(body: GenerateReportDto, user: RequestUser): string[] | null {
    if (body.schoolId) {
      assertSchoolInScope(user, body.schoolId);
      return [body.schoolId];
    }
    return resolveScopeSchoolIds(user);
  }

  /** What the screens need from a stored report: its format, why it failed, and the file size. */
  private view(report: GeneratedReport) {
    const params = ((report.parameters ?? {}) as Record<string, any>) || {};
    const format = String(params.format ?? 'PDF').toUpperCase();
    return {
      ...report,
      format,
      schoolId: (params.schoolId as string | null) ?? null,
      error: (params.error as string | null) ?? null,
      sizeBytes: report.rowCount ?? null,
      fileName: `${slug(report.title)}.${format.toLowerCase()}`,
    };
  }

  async generateReport(body: GenerateReportDto, user: RequestUser) {
    const format = (body.format ?? 'PDF').toUpperCase() as 'PDF' | 'XLSX' | 'CSV';
    const allowed = REPORT_ACCESS[body.reportType];
    if (allowed && !allowed.includes(user.role)) {
      throw new ForbiddenException(`Your role cannot generate the ${REPORT_TITLES[body.reportType] ?? body.reportType}`);
    }
    if (format !== 'PDF' && body.reportType === ReportType.REPORT_CARD) {
      throw new BadRequestException('Report cards are only available as PDF');
    }
    const needsScopeId: ReportType[] = [ReportType.CLASS_ACADEMIC, ReportType.STUDENT_PROFILE, ReportType.TEACHER_PERFORMANCE, ReportType.REPORT_CARD];
    if (needsScopeId.includes(body.reportType) && !body.scopeId) {
      const what = body.reportType === ReportType.CLASS_ACADEMIC ? 'class' : body.reportType === ReportType.TEACHER_PERFORMANCE ? 'teacher' : 'student';
      throw new BadRequestException(`Choose the ${what} for this ${REPORT_TITLES[body.reportType]?.toLowerCase() ?? 'report'} first`);
    }
    if (body.reportType === ReportType.REPORT_CARD) {
      if (!body.termId) throw new BadRequestException('REPORT_CARD requires scopeId (studentId) and termId');
      // Fail now with the real reason ("no report card exists for this term") instead of a silent FAILED row later.
      await this.studentsService.getReportCard(body.scopeId!, body.termId);
    }
    const schoolIds = this.scopeFor(body, user);
    const singleSchool = schoolIds && schoolIds.length === 1 && schoolIds[0] !== '__none__' ? schoolIds[0] : null;
    const baseParameters = { ...(body.parameters || {}), format, schoolId: singleSchool };

    const created = await this.prisma.generatedReport.create({
      data: {
        reportType: body.reportType,
        title: REPORT_TITLES[body.reportType] ?? `${body.reportType} Report`,
        scope: body.scope,
        scopeId: body.scopeId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        period: body.termId || body.academicYearId || null,
        generatedById: user.id,
        generatedByRole: user.role,
        parameters: baseParameters as any,
        status: ReportStatus.GENERATING,
      },
    });

    void this.runGeneration(created.id, body, format, schoolIds, user).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Report ${created.id} (${body.reportType}) failed: ${message}`);
      await this.prisma.generatedReport.update({
        where: { id: created.id },
        data: {
          status: ReportStatus.FAILED,
          completedAt: new Date(),
          parameters: { ...baseParameters, error: message.slice(0, 300) } as any,
        },
      });
    });

    return { reportId: created.id, status: ReportStatus.GENERATING, format };
  }

  private async runGeneration(reportId: string, body: GenerateReportDto, format: string, schoolIds: string[] | null, user: RequestUser) {
    const file = this.fileFor(reportId, format);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });

    switch (body.reportType) {
      case ReportType.CLASS_ACADEMIC: {
        const data = await this.academicService.getClass(body.scopeId || '', body.academicYearId, body.termId);
        await this.classAcademicGenerator.generate(file, data);
        break;
      }
      case ReportType.STUDENT_PROFILE: {
        const data = await this.studentsService.getProfile(body.scopeId || '', user, body.academicYearId);
        await this.studentProfileGenerator.generate(file, data);
        break;
      }
      case ReportType.FINANCE_COLLECTION: {
        const data = await this.financeService.getOverview(body.academicYearId, body.termId, schoolIds);
        await this.financeCollectionGenerator.generate(file, data);
        break;
      }
      case ReportType.OUTSTANDING_BALANCES: {
        const [data, list] = await Promise.all([
          this.financeService.getOverview(body.academicYearId, body.termId, schoolIds),
          this.financeService.getOutstandingList(body.academicYearId, body.termId, schoolIds),
        ]);
        await this.outstandingBalancesGenerator.generate(file, data, list);
        break;
      }
      case ReportType.PERFORMANCE_ENGINE: {
        const data = await this.academicService.getPerformanceEngine(body.academicYearId, body.termId, schoolIds);
        await this.performanceEngineGenerator.generate(file, data);
        break;
      }
      case ReportType.ATTENDANCE_SUMMARY: {
        const data = await this.attendanceService.getOverview(body.termId, body.academicYearId, body.scopeId, schoolIds);
        await this.attendanceSummaryGenerator.generate(file, data);
        break;
      }
      case ReportType.TEACHER_PERFORMANCE: {
        const data = await this.academicService.getTeacher(body.scopeId || '', body.academicYearId, body.termId);
        await this.teacherPerformanceGenerator.generate(file, data);
        break;
      }
      case ReportType.BOARD_EXECUTIVE: {
        const data = await this.executiveService.boardDashboard(body.academicYearId);
        await this.boardExecutiveGenerator.generate(file, data);
        break;
      }
      case ReportType.REPORT_CARD: {
        const data = await this.studentsService.getReportCard(body.scopeId!, body.termId!);
        await this.reportCardGenerator.generate(file, data as any);
        break;
      }
      default: {
        // SCHOOL_OVERVIEW, TERM_SUMMARY, ANNUAL_SUMMARY and CUSTOM are all built from the school overview.
        const data = await this.overviewService.getOverview(body.academicYearId, schoolIds);
        await this.schoolOverviewGenerator.generate(file, data, REPORT_TITLES[body.reportType] ?? 'School Overview Report');
      }
    }

    const stats = await fs.promises.stat(file);
    await this.prisma.generatedReport.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.READY,
        pdfUrl: file,
        completedAt: new Date(),
        rowCount: stats.size,
      },
    });
  }

  async listReports(user: RequestUser | undefined, reportType?: string, status?: string, generatedById?: string, page = 1, limit = 20) {
    const and: any[] = [];
    if (reportType) and.push({ reportType });
    if (status) and.push({ status });
    if (generatedById) and.push({ generatedById });

    const groupSuperRoles = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BOARD_DIRECTOR'];
    const schoolPrivilegedRoles = ['PRINCIPAL', 'HEAD_OF_SCHOOL', 'ACADEMIC_QA'];

    if (user) {
      if (groupSuperRoles.includes(user.role) || user.scope === 'GROUP') {
        // Group-scoped or super roles see all reports, but with a school selected the list matches the switcher.
        if (user.activeSchoolId) and.push({ OR: [schoolFilter(user.activeSchoolId), { generatedById: user.id }] });
      } else if (schoolPrivilegedRoles.includes(user.role) && user.scope === 'SCHOOL') {
        // School-scoped privileged roles see all reports generated for their school(s).
        const ids = (user.schoolIds ?? []).filter((id) => id !== '*');
        and.push({ OR: [{ generatedById: user.id }, ...ids.map(schoolFilter)] });
      } else {
        // Everyone else (finance, HOD, etc.) sees only their own reports.
        and.push({ generatedById: user.id });
      }
    }

    const where = and.length ? { AND: and } : {};
    const take = Math.min(100, Math.max(1, limit));
    const [rows, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Math.max(0, (page - 1) * take),
        take,
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return { data: rows.map((row) => this.view(row)), pagination: { page, limit: take, total } };
  }

  private canAccess(report: GeneratedReport, user?: RequestUser) {
    if (!user) return false;
    // Super/group roles can always access any report.
    const alwaysAllowed = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BOARD_DIRECTOR'];
    if (alwaysAllowed.includes(user.role) || user.scope === 'GROUP') return true;
    if (report.generatedById === user.id) return true;
    // School-privileged roles can access reports scoped to their school(s).
    const schoolPrivileged = ['PRINCIPAL', 'HEAD_OF_SCHOOL', 'ACADEMIC_QA'];
    if (schoolPrivileged.includes(user.role) && user.scope === 'SCHOOL') {
      const reportSchool = this.view(report).schoolId;
      if (!reportSchool) return false; // unscoped reports belong to whoever generated them
      return (user.schoolIds ?? []).some((id) => id === '*' || id === reportSchool);
    }
    return false;
  }

  private async load(id: string, user?: RequestUser) {
    const report = await this.prisma.generatedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (!this.canAccess(report, user)) throw new ForbiddenException('Access denied');
    return report;
  }

  async getReport(id: string, user?: RequestUser) {
    return this.view(await this.load(id, user));
  }

  async getDownload(id: string, user?: RequestUser) {
    const report = await this.load(id, user);
    if (report.status === ReportStatus.FAILED) {
      throw new BadRequestException(this.view(report).error || 'This report could not be generated');
    }
    if (!report.pdfUrl || !fs.existsSync(report.pdfUrl)) throw new NotFoundException('Report file not ready');
    const view = this.view(report);
    return { filePath: report.pdfUrl, format: view.format, fileName: view.fileName };
  }
}
