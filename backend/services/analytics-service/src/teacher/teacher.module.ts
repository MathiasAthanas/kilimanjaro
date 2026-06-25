import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { TeacherAnalyticsController } from './teacher.controller';
import { TeacherAnalyticsService } from './teacher.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [TeacherAnalyticsController],
  providers: [TeacherAnalyticsService],
  exports: [TeacherAnalyticsService],
})
export class TeacherAnalyticsModule {}
