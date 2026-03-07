import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module';
import { FinanceAnalyticsModule } from '../finance/finance.module';
import { OverviewModule } from '../overview/overview.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ExecutiveController } from './executive.controller';
import { ExecutiveService } from './executive.service';

@Module({
  imports: [PrismaModule, RedisModule, OverviewModule, AcademicModule, FinanceAnalyticsModule],
  controllers: [ExecutiveController],
  providers: [ExecutiveService],
  exports: [ExecutiveService],
})
export class ExecutiveModule {}
