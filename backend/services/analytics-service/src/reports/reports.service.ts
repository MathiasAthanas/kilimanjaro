import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeneratedReport, ReportStatus, ReportType } from '../../generated/prisma';
import * as fs from 'fs';
import * as path from 'path';
import { RequestUser } from '../common/interfaces/request-user.interface';
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

@Injectable()
export class ReportsService {
  private readonly storageRoot: string;

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

  private reportFile(report: GeneratedReport): string {
    return path.join(this.storageRoot, `${report.id}.pdf`);
  }

  async generateReport(body: GenerateReportDto, user: RequestUser) {
    const created = await this.prisma.generatedReport.create({
      data: {
        reportType: body.reportType,
        title: `${body.reportType} Report`,
        scope: body.scope,
        scopeId: body.scopeId,
        academicYearId: body.academicYearId,
        termId: body.termId,
        period: body.termId || body.academicYearId || null,
        generatedById: user.id,
        generatedByRole: user.role,
        parameters: (body.parameters || {}) as any,
        status: ReportStatus.GENERATING,
      },
    });

    void this.runGeneration(created.id, body, user).catch(async () => {
      await this.prisma.generatedReport.update({
        where: { id: created.id },
        data: { status: ReportStatus.FAILED, completedAt: new Date() },
      });
    });

    return { reportId: created.id, status: ReportStatus.GENERATING };
  }

  private async runGeneration(reportId: string, body: GenerateReportDto, user: RequestUser) {
    const report = await this.prisma.generatedReport.findUnique({ where: { id: reportId } });
    if (!report) return;
    const file = this.reportFile(report);
    await fs.promises.mkdir(path.dirname(file), { recursive: true });

    switch (body.reportType) {
      case ReportType.SCHOOL_OVERVIEW: {
        const data = await this.overviewService.getOverview(body.academicYearId, body.schoolId ?? undefined);
        await this.schoolOverviewGenerator.generate(file, data);
        break;
      }
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
        const data = await this.financeService.getOverview(body.academicYearId, body.termId, body.schoolId);
        await this.financeCollectionGenerator.generate(file, data);
        break;
      }
      case ReportType.OUTSTANDING_BALANCES: {
        const data = await this.financeService.getOverview(body.academicYearId, body.termId, body.schoolId);
        await this.outstandingBalancesGenerator.generate(file, data);
        break;
      }
      case ReportType.PERFORMANCE_ENGINE: {
        const data = await this.academicService.getPerformanceEngine(body.academicYearId, body.termId);
        await this.performanceEngineGenerator.generate(file, data);
        break;
      }
      case ReportType.ATTENDANCE_SUMMARY: {
        const data = await this.attendanceService.getOverview(body.termId, body.academicYearId, body.scopeId);
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
        if (!body.scopeId || !body.termId) {
          throw new BadRequestException('REPORT_CARD requires scopeId (studentId) and termId');
        }
        const data = await this.studentsService.getReportCard(body.scopeId, body.termId);
        await this.reportCardGenerator.generate(file, data as any);
        break;
      }
      default: {
        const data = await this.overviewService.getOverview(body.academicYearId, body.schoolId ?? undefined);
        await this.schoolOverviewGenerator.generate(file, data);
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
    const where: any = {};
    if (reportType) where.reportType = reportType;
    if (status) where.status = status;
    if (generatedById) where.generatedById = generatedById;

    const groupSuperRoles = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BOARD_DIRECTOR'];
    const schoolPrivilegedRoles = ['PRINCIPAL', 'HEAD_OF_SCHOOL', 'ACADEMIC_QA'];

    if (user) {
      if (groupSuperRoles.includes(user.role) || user.scope === 'GROUP') {
        // Group-scoped or super roles see all reports — no extra filter.
      } else if (schoolPrivilegedRoles.includes(user.role) && user.scope === 'SCHOOL') {
        // School-scoped privileged roles see all reports generated for their school(s).
        where.OR = [
          { generatedById: user.id },
          { schoolId: { in: (user.schoolIds ?? []).filter((id) => id !== '*') } },
        ];
      } else {
        // Everyone else (finance, HOD, etc.) sees only their own reports.
        where.generatedById = user.id;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.generatedReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: Math.max(0, (page - 1) * limit),
        take: Math.max(1, limit),
      }),
      this.prisma.generatedReport.count({ where }),
    ]);

    return { data, pagination: { page, limit, total } };
  }

  private canAccess(report: GeneratedReport, user?: RequestUser) {
    if (!user) return false;
    // Super/group roles can always access any report.
    const alwaysAllowed = ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'BOARD_DIRECTOR'];
    if (alwaysAllowed.includes(user.role) || user.scope === 'GROUP') return true;
    // School-privileged roles can access reports scoped to their school(s).
    const schoolPrivileged = ['PRINCIPAL', 'HEAD_OF_SCHOOL', 'ACADEMIC_QA'];
    if (schoolPrivileged.includes(user.role) && user.scope === 'SCHOOL') {
      const reportSchool = (report as any).schoolId as string | null;
      if (!reportSchool) return true; // global report
      return (user.schoolIds ?? []).some((id) => id === '*' || id === reportSchool);
    }
    return report.generatedById === user.id;
  }

  async getReport(id: string, user?: RequestUser) {
    const report = await this.prisma.generatedReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (!this.canAccess(report, user)) throw new ForbiddenException('Access denied');
    return report;
  }

  async getDownloadPath(id: string, user?: RequestUser) {
    const report = await this.getReport(id, user);
    if (!report.pdfUrl) throw new NotFoundException('Report file not ready');
    return report.pdfUrl;
  }
}
