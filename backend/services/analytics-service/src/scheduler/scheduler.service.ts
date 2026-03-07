import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportType } from '@prisma/client';
import { ReportsService } from '../reports/reports.service';
import { SnapshotsService } from '../snapshots/snapshots.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private readonly snapshotsService: SnapshotsService, private readonly reportsService: ReportsService) {}

  @Cron('0 3 * * *')
  async nightlySnapshot() {
    const result = await this.snapshotsService.computeDailySnapshots();
    this.logger.log(`nightly_snapshot count=${result.count} errors=${result.errors.length}`);
  }

  @Cron('0 4 * * 0')
  async weeklyKpis() {
    const result = await this.snapshotsService.recordWeeklyKpis();
    this.logger.log(`weekly_kpis period=${result.period} recorded=${result.recorded}`);
  }

  @Cron('0 5 * * *')
  async cleanupSnapshots() {
    const result = await this.snapshotsService.cleanupExpiredSnapshots();
    this.logger.log(`snapshot_cleanup deleted=${result.deleted}`);
  }

  @Cron('0 6 1 * *')
  async monthlyExecutiveReport() {
    await this.reportsService.generateReport(
      {
        reportType: ReportType.BOARD_EXECUTIVE,
        scope: 'school',
      },
      { id: 'system', role: 'SYSTEM_ADMIN' },
    );
    this.logger.log('monthly_board_report_generated');
  }
}
