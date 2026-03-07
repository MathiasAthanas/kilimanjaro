import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module';
import { FinanceAnalyticsModule } from '../finance/finance.module';
import { OverviewModule } from '../overview/overview.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SnapshotsService } from './snapshots.service';

@Module({
  imports: [PrismaModule, OverviewModule, AcademicModule, FinanceAnalyticsModule],
  providers: [SnapshotsService],
  exports: [SnapshotsService],
})
export class SnapshotsModule {}
