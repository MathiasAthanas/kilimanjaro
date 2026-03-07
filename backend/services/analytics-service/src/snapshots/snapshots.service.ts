import { Injectable, Logger } from '@nestjs/common';
import { AcademicService } from '../academic/academic.service';
import { FinanceAnalyticsService } from '../finance/finance.service';
import { OverviewService } from '../overview/overview.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SnapshotsService {
  private readonly logger = new Logger(SnapshotsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly overviewService: OverviewService,
    private readonly academicService: AcademicService,
    private readonly financeService: FinanceAnalyticsService,
  ) {}

  private periodLabel(date = new Date()) {
    return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
  }

  async upsertSnapshot(snapshotType: string, scope: string, scopeId: string | null, period: string, data: unknown, ttlHours = 25) {
    const expiresAt = new Date(Date.now() + ttlHours * 3600000);
    const scopeIdentifier = scopeId ?? '__none__';
    return this.prisma.dashboardSnapshot.upsert({
      where: { snapshotType_scope_scopeId_period: { snapshotType, scope, scopeId: scopeIdentifier, period } },
      create: { snapshotType, scope, scopeId: scopeIdentifier, period, data: data as any, expiresAt },
      update: { data: data as any, expiresAt, computedAt: new Date() },
    });
  }

  async computeDailySnapshots() {
    const period = this.periodLabel();
    const start = Date.now();
    const errors: string[] = [];
    let count = 0;

    try {
      const overview = await this.overviewService.getOverview();
      await this.upsertSnapshot('school_overview', 'school', null, period, overview);
      count += 1;
    } catch (error: any) {
      errors.push(`school_overview: ${error.message}`);
    }

    try {
      const finance = await this.financeService.getOverview();
      await this.upsertSnapshot('finance_collection', 'school', null, period, finance);
      count += 1;
    } catch (error: any) {
      errors.push(`finance_collection: ${error.message}`);
    }

    const classes = await this.prisma.class.findMany({ select: { id: true } });
    for (const klass of classes) {
      try {
        const data = await this.academicService.getClass(klass.id);
        await this.upsertSnapshot('class_academic', 'class', klass.id, period, data);
        count += 1;
      } catch (error: any) {
        errors.push(`class_academic:${klass.id}: ${error.message}`);
      }
    }

    const durationMs = Date.now() - start;
    this.logger.log(
      `snapshot_job start=${new Date(start).toISOString()} end=${new Date().toISOString()} durationMs=${durationMs} count=${count} errors=${errors.length}`,
    );
    return { count, errors, durationMs };
  }

  async recordWeeklyKpis() {
    const period = `${new Date().getFullYear()}-W${Math.ceil(new Date().getDate() / 7)}`;
    const overview = await this.overviewService.getOverview();
    const payload = [
      { kpiName: 'school_enrolment', value: overview.enrolment?.totalStudents || 0 },
      { kpiName: 'collection_rate', value: overview.finance?.collectionRateThisTerm || 0 },
      { kpiName: 'pass_rate', value: overview.academic?.overallPassRate || 0 },
      { kpiName: 'attendance_rate', value: overview.attendance?.schoolAttendanceRate || 0 },
    ];

    for (const item of payload) {
      await this.prisma.kpiHistory.upsert({
        where: { kpiName_scope_period: { kpiName: item.kpiName, scope: 'school', period } },
        create: { kpiName: item.kpiName, scope: 'school', period, value: item.value },
        update: { value: item.value, recordedAt: new Date() },
      });
    }

    return { period, recorded: payload.length };
  }

  async cleanupExpiredSnapshots() {
    const deleted = await this.prisma.dashboardSnapshot.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return { deleted: deleted.count };
  }
}
