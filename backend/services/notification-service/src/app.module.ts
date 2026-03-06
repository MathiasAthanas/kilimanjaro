import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnnouncementsModule } from './announcements/announcements.module';
import { AdminModule } from './admin/admin.module';
import { CommonModule } from './common/common.module';
import { IdentityMiddleware } from './common/middleware/identity.middleware';
import { RolesGuard } from './common/guards/roles.guard';
import { DeviceTokensModule } from './device-tokens/device-tokens.module';
import { DispatchModule } from './dispatch/dispatch.module';
import { DownstreamModule } from './downstream/downstream.module';
import { FirebaseModule } from './firebase/firebase.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PreferencesModule } from './preferences/preferences.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: Number(process.env.THROTTLE_TTL || 60), limit: Number(process.env.THROTTLE_LIMIT || 60) }],
    }),
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,
    RedisModule,
    DownstreamModule,
    FirebaseModule,
    QueuesModule,
    DispatchModule,
    RabbitMqModule,
    TemplatesModule,
    NotificationsModule,
    DeviceTokensModule,
    PreferencesModule,
    AnnouncementsModule,
    AdminModule,
    InternalModule,
    SchedulerModule,
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
