import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { StudentsModule } from './students/students.module';
import { GuardiansModule } from './guardians/guardians.module';
import { ClassesModule } from './classes/classes.module';
import { AttendanceModule } from './attendance/attendance.module';
import { DisciplineModule } from './discipline/discipline.module';
import { PerformanceModule } from './performance/performance.module';
import { InternalModule } from './internal/internal.module';
import { HealthModule } from './health/health.module';
import { RolesGuard } from './common/guards/roles.guard';
import { IdentityMiddleware } from './common/middleware/identity.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL || 60),
          limit: Number(process.env.THROTTLE_LIMIT || 60),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    StudentsModule,
    GuardiansModule,
    ClassesModule,
    AttendanceModule,
    DisciplineModule,
    PerformanceModule,
    InternalModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(IdentityMiddleware).forRoutes('*');
  }
}
