import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { FinanceController } from './finance.controller';
import { FinanceAnalyticsService } from './finance.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [FinanceController],
  providers: [FinanceAnalyticsService],
  exports: [FinanceAnalyticsService],
})
export class FinanceAnalyticsModule {}