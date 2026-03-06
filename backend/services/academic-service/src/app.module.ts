import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AssessmentModule } from './assessments/assessments.module';
import { GradingModule } from './grading/grading.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { JobsModule } from './jobs/jobs.module';
import { PerformanceModule } from './performance/performance.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { ReportCardsModule } from './report-cards/report-cards.module';
import { ResultsModule } from './results/results.module';
import { StudentClientModule } from './student-client/student-client.module';
import { SubjectsModule } from './subjects/subjects.module';
import { SyllabusModule } from './syllabus/syllabus.module';
import { TimetableModule } from './timetable/timetable.module';
import { RolesGuard } from './common/guards/roles.guard';
import { IdentityMiddleware } from './common/middleware/identity.middleware';
import { AccessControlService } from './common/helpers/access-control.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL || 60),
          limit: Number(process.env.THROTTLE_LIMIT || 120),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    StudentClientModule,
    HealthModule,
    SubjectsModule,
    GradingModule,
    AssessmentModule,
    ResultsModule,
    ReportCardsModule,
    TimetableModule,
    SyllabusModule,
    PerformanceModule,
    InternalModule,
    JobsModule,
  ],
  providers: [
    RabbitMqConsumer,
    AccessControlService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdentityMiddleware).forRoutes('*');
  }
}
