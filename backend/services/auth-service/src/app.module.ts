import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RabbitMqModule } from './rabbitmq/rabbitmq.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { MembershipsModule } from './memberships/memberships.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    RedisModule,
    RabbitMqModule,
    AuditModule,
    UsersModule,
    MembershipsModule,
    AuthModule,
    HealthModule,
  ],
})
export class AppModule {}
