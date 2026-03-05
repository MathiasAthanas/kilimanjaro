import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { RabbitMqModule } from '../rabbitmq/rabbitmq.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { InternalApiGuard } from './guards/internal-api.guard';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    PrismaModule,
    UsersModule,
    RedisModule,
    AuditModule,
    RabbitMqModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        privateKey: (configService.get<string>('JWT_PRIVATE_KEY') || '').replace(/\\n/g, '\n'),
        publicKey: (configService.get<string>('JWT_PUBLIC_KEY') || '').replace(/\\n/g, '\n'),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    JwtAuthGuard,
    RolesGuard,
    InternalApiGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard, RolesGuard, InternalApiGuard],
})
export class AuthModule {}
