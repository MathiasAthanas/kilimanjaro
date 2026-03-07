import { Injectable } from '@nestjs/common';
import { mean } from '../common/helpers/statistics.helper';
import { FinanceAnalyticsService } from '../finance/finance.service';
import { OverviewService } from '../overview/overview.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class ExecutiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly overviewService: OverviewService,
    private readonly financeService: FinanceAnalyticsService,
  ) {}

  private scoreTrend(values: number[]) {
    if (values.length < 2) return 'STABLE';
    const first = values[0];
    const last = values[values.length - 1];
    if (last - first > 2) return 'IMPROVING';
    if (first - last > 2) return 'DECLINING';
    return 'STABLE';
  }

  async boardDashboard(academicYearId?: string) {
    const key = `analytics:board:${academicYearId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const [overview, financeForecast, reportCards, classes, trends, invoices] = await Promise.all([
      this.overviewService.getOverview(academicYearId),
      this.financeService.getRevenueForecast(academicYearId),
      this.prisma.reportCard.findMany({ where: { isPublished: true }, orderBy: { academicYearId: 'asc' } }),
      this.prisma.class.findMany(),
      this.prisma.kpiHistory.findMany({ where: { scope: 'school' }, orderBy: { period: 'asc' }, take: 12 }),
      this.prisma.invoice.findMany({ where: { academicYearId: academicYearId || undefined } }),
    ]);

    const classMap = classes.map((klass) => {
      const cards = reportCards.filter((row) => row.classId === klass.id);
      return { className: klass.name, avg: mean(cards.map((row) => row.overallAverage)) };
    });
    classMap.sort((a, b) => b.avg - a.avg);

    const passRate = overview.academic?.overallPassRate || 0;
    const collectionRate = overview.finance?.collectionRateThisTerm || 0;
    const attendanceRate = overview.attendance?.schoolAttendanceRate || 0;

    const result = {
      institutionalHealth: {
        overallScore: mean([passRate, collectionRate, attendanceRate]),
        trend: this.scoreTrend(trends.map((row) => row.value)),
      },
      keyMetrics: {
        totalStudents: overview.enrolment?.totalStudents || 0,
        enrolmentGrowthRate: overview.enrolment?.enrolmentGrowthRate || 0,
        overallPassRate: passRate,
        feeCollectionRate: collectionRate,
        schoolAttendanceRate: attendanceRate,
        staffCount: 0,
      },
      financialSummary: {
        annualRevenueForecast: financeForecast.projectedFinalCollection,
        collectedToDate: financeForecast.collectedToDate,
        collectionRate,
        totalAssetValue: (await this.financeService.getAssetsSummary()).totalCurrentValue,
      },
      academicSummary: {
        topPerformingClass: classMap[0]?.className || null,
        bottomPerformingClass: classMap[classMap.length - 1]?.className || null,
        subjectsNeedingAttention: (overview.academic?.subjectPassRates || [])
          .slice(-3)
          .map((row: any) => row.subjectName),
        atRiskStudentPercentage:
          (overview.academic?.atRiskStudentCount || 0) && (overview.enrolment?.totalStudents || 0)
            ? ((overview.academic.atRiskStudentCount / overview.enrolment.totalStudents) * 100)
            : 0,
      },
      yearOverYearComparison: (await this.prisma.academicYear.findMany({ orderBy: { name: 'asc' }, take: 3 })).map((year) => ({
        year: year.name,
        students: overview.enrolment?.totalStudents || 0,
        passRate,
        collectionRate,
        attendanceRate,
      })),
      complianceAndGovernance: {
        resultsPublishedOnTime: reportCards.length ? 100 : 0,
        financialAuditsClean: invoices.every((invoice) => invoice.status !== 'DISPUTED'),
        allClassesHaveTeachers: classes.every((klass) => Boolean(klass.classTeacherId)),
      },
    };

    await this.redis.set(key, result, 3600);
    return result;
  }

  async managingDirectorDashboard(academicYearId?: string) {
    const key = `analytics:md:${academicYearId || 'current'}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const [board, pairings, notifications, classSubjects, syllabus] = await Promise.all([
      this.boardDashboard(academicYearId),
      this.prisma.peerPairing.findMany(),
      this.prisma.notification.findMany({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      this.prisma.classSubject.findMany(),
      this.prisma.syllabusTracker.findMany(),
    ]);

    const result = {
      ...board,
      operationalMetrics: {
        pendingApprovals: {
          marks: 0,
          manualPayments: 0,
          pairings: pairings.filter((row) => row.status === 'PENDING').length,
        },
        overdueTasksByDepartment: [{ department: 'Academics', count: pairings.filter((row) => row.status === 'PENDING').length }],
        systemUsageStats: {
          activeUsersThisWeek: new Set(notifications.map((row) => row.recipientId)).size,
          notificationsSentThisWeek: notifications.length,
        },
      },
      staffPerformance: {
        teachersWithLateSubmissions: 0,
        averageApprovalTurnaround: 0,
        syllabusCompletionRate: mean(syllabus.map((row) => row.completionPercentage)),
      },
    };

    await this.redis.set(key, result, 1800);
    return result;
  }
}
