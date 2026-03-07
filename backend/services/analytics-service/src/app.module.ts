import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AcademicModule } from './academic/academic.module';
import { AppCommonModule } from './common/common.module';
import { RolesGuard } from './common/guards/roles.guard';
import { IdentityMiddleware } from './common/middleware/identity.middleware';
import { AttendanceModule } from './attendance/attendance.module';
import { DepartmentModule } from './department/department.module';
import { DownstreamModule } from './downstream/downstream.module';
import { EnrolmentModule } from './enrolment/enrolment.module';
import { ExecutiveModule } from './executive/executive.module';
import { FinanceAnalyticsModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { OverviewModule } from './overview/overview.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { SchedulerAnalyticsModule } from './scheduler/scheduler.module';
import { SnapshotsModule } from './snapshots/snapshots.module';
import { StudentsModule } from './students/students.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: Number(process.env.THROTTLE_TTL || 60), limit: Number(process.env.THROTTLE_LIMIT || 60) }] }),
    ScheduleModule.forRoot(),
    AppCommonModule,
    PrismaModule,
    RedisModule,
    DownstreamModule,
    OverviewModule,
    EnrolmentModule,
    AcademicModule,
    FinanceAnalyticsModule,
    AttendanceModule,
    StudentsModule,
    DepartmentModule,
    ExecutiveModule,
    ReportsModule,
    SnapshotsModule,
    SchedulerAnalyticsModule,
    RabbitMqModule,
    InternalModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(IdentityMiddleware).forRoutes('*');
  }
}
