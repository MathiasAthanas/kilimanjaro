import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitMqConsumer } from './rabbitmq/rabbitmq.consumer';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { StudentClientModule } from './student-client/student-client.module';
import { IdentityMiddleware } from './common/middleware/identity.middleware';
import { RolesGuard } from './common/guards/roles.guard';
import { FeeCategoriesModule } from './fee-categories/fee-categories.module';
import { FeeStructuresModule } from './fee-structures/fee-structures.module';
import { FeeAssignmentsModule } from './fee-assignments/fee-assignments.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { ReportsModule } from './reports/reports.module';
import { AssetsModule } from './assets/assets.module';
import { InternalModule } from './internal/internal.module';
import { JobsModule } from './jobs/jobs.module';
import { AuditModule } from './audit/audit.module';
import { NumberSequenceService } from './common/helpers/number-sequence.service';

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
    AuditModule,
    HealthModule,
    FeeCategoriesModule,
    FeeStructuresModule,
    FeeAssignmentsModule,
    InvoicesModule,
    PaymentsModule,
    ReceiptsModule,
    ReportsModule,
    AssetsModule,
    InternalModule,
    JobsModule,
  ],
  providers: [
    RabbitMqConsumer,
    NumberSequenceService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdentityMiddleware).forRoutes('*');
  }
}
