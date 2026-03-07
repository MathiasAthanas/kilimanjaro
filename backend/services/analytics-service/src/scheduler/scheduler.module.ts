import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [SnapshotsModule, ReportsModule],
  providers: [SchedulerService],
})
export class SchedulerAnalyticsModule {}
