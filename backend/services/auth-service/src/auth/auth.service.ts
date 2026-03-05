import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuditAction, User } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetCompleteDto } from './dto/password-reset-complete.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly redisService: RedisService,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  async validateLocalCredentials(input: {
    email?: string;
    registrationNumber?: string;
    password: string;
    ip: string;
    userAgent: string;
  }): Promise<{ id: string; role: string } | null> {
    const result = await this.doLogin(
      {
        email: input.email,
        registrationNumber: input.registrationNumber,
        password: input.password,
      },
      { ip: input.ip, userAgent: input.userAgent },
      true,
    );

    if (!result?.user) {
      return null;
    }

    return { id: result.user.id, role: result.user.role };
  }

  async login(dto: LoginDto, meta: { ip: string; userAgent: string }) {
    return this.doLogin(dto, meta, false);
  }

  private async doLogin(dto: LoginDto, meta: { ip: string; userAgent: string }, localOnly: boolean) {
    await this.enforceIpLoginThrottle(meta.ip);

    const user = dto.email
      ? await this.usersService.findByEmail(dto.email)
      : dto.registrationNumber
        ? await this.usersService.findByRegistrationNumber(dto.registrationNumber)
        : null;

    if (!user) {
      await this.auditService.createLog({
        action: AuditAction.LOGIN_FAILED,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        metadata: { reason: 'USER_NOT_FOUND' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new HttpException(
        `Account locked. Try again after ${user.lockedUntil.toISOString()}`,
        423,
      );
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is deactivated');
    }

    if (dto.email && user.role === 'STUDENT') {
      throw new UnauthorizedException('Students must login with registration number');
    }

    if (dto.registrationNumber && user.role !== 'STUDENT') {
      throw new UnauthorizedException('Only students can login with registration number');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      const update = await this.usersService.registerFailedLogin(user.id);

      await this.auditService.createLog({
        userId: user.id,
        action: update.locked ? AuditAction.ACCOUNT_LOCKED : AuditAction.LOGIN_FAILED,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        metadata: update.locked
          ? { failedLoginAttempts: update.failedLoginAttempts, lockedUntil: update.lockedUntil?.toISOString() }
          : { failedLoginAttempts: update.failedLoginAttempts },
      });

      if (update.locked) {
        await this.rabbitmqService.publish('account.locked', {
          userId: user.id,
          email: user.email,
          lockedUntil: update.lockedUntil?.toISOString(),
        });
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.registerSuccessfulLogin(user.id, meta.ip);

    await this.auditService.createLog({
      userId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    if (localOnly) {
      return { user: { id: user.id, role: user.role } };
    }

    return this.issueTokens(user, meta);
  }

  async refresh(refreshToken: string, meta: { ip: string; userAgent: string }) {
    const parsed = this.parseRefreshToken(refreshToken);

    if (!parsed) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const record = await this.prisma.refreshToken.findUnique({
      where: { id: parsed.id },
      include: { user: true },
    });

    if (!record || record.isRevoked || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const valid = await argon2.verify(record.tokenHash, refreshToken);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { isRevoked: true },
    });

    await this.auditService.createLog({
      userId: record.userId,
      action: AuditAction.TOKEN_REFRESHED,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    return this.issueTokens(record.user, meta);
  }

  async logout(user: { sub: string; jti: string; exp?: number }, refreshToken?: string): Promise<void> {
    if (user.jti && user.exp) {
      const ttl = Math.max(user.exp - Math.floor(Date.now() / 1000), 1);
      await this.redisService.set(`auth:blacklist:jti:${user.jti}`, '1', ttl);
    }

    if (refreshToken) {
      const parsed = this.parseRefreshToken(refreshToken, false);
      if (parsed) {
        await this.prisma.refreshToken.updateMany({
          where: { id: parsed.id, userId: user.sub },
          data: { isRevoked: true },
        });
      }
    }

    await this.auditService.createLog({
      userId: user.sub,
      action: AuditAction.LOGOUT,
    });
  }

  async requestPasswordReset(email: string, meta: { ip: string; userAgent: string }): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const otp = this.generateOtp();
    const otpHash = await argon2.hash(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        otpHash,
        expiresAt,
        ipAddress: meta.ip,
      },
    });

    await this.auditService.createLog({
      userId: user.id,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    await this.rabbitmqService.publish('password.reset.requested', {
      userId: user.id,
      email: user.email,
      otp,
      expiresAt: expiresAt.toISOString(),
    });
  }

  async completePasswordReset(
    dto: PasswordResetCompleteDto,
    meta: { ip: string; userAgent: string },
  ): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid reset request');
    }

    const tokens = await this.prisma.passwordResetToken.findMany({
      where: {
        userId: user.id,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    let validTokenId: string | null = null;
    for (const token of tokens) {
      const valid = await argon2.verify(token.otpHash, dto.otp);
      if (valid) {
        validTokenId = token.id;
        break;
      }
    }

    if (!validTokenId) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: validTokenId },
        data: { isUsed: true },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    await this.auditService.createLog({
      userId: user.id,
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto, meta: { ip: string; userAgent: string }) {
    const user = await this.usersService.findById(userId);
    const currentValid = await argon2.verify(user.passwordHash, dto.currentPassword);

    if (!currentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);

    await this.auditService.createLog({
      userId,
      action: AuditAction.PASSWORD_CHANGED,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  async me(userId: string) {
    const user = await this.usersService.findById(userId);
    return this.usersService.toSafeUser(user);
  }

  async getUserForGateway(userId: string) {
    const user = await this.usersService.findById(userId);
    return { id: user.id, role: user.role, isActive: user.isActive };
  }

  async isJtiBlacklisted(jti: string): Promise<boolean> {
    const found = await this.redisService.get(`auth:blacklist:jti:${jti}`);
    return Boolean(found);
  }

  private async issueTokens(user: User, meta: { ip: string; userAgent: string }) {
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
      email: user.email,
      registrationNumber: user.registrationNumber,
      jti,
    });

    const refreshTokenId = crypto.randomUUID();
    const refreshSecret = crypto.randomBytes(64).toString('hex');
    const refreshToken = `${refreshTokenId}.${refreshSecret}`;
    const tokenHash = await argon2.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        id: refreshTokenId,
        tokenHash,
        userId: user.id,
        expiresAt,
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  private parseRefreshToken(token: string, strict = true): { id: string; secret: string } | null {
    const [id, secret] = token.split('.', 2);
    if (!id || !secret) {
      if (strict) {
        throw new UnauthorizedException('Invalid refresh token format');
      }
      return null;
    }
    return { id, secret };
  }

  private async enforceIpLoginThrottle(ipAddress: string): Promise<void> {
    const safeIp = ipAddress || 'unknown';
    const key = `auth:login:ip:${safeIp}`;
    const ttl = Number(this.configService.get<string>('LOGIN_THROTTLE_TTL', '900'));
    const limit = Number(this.configService.get<string>('LOGIN_THROTTLE_LIMIT', '10'));
    const attempts = await this.redisService.incrWithExpiry(key, ttl);

    if (attempts > limit) {
      throw new HttpException('Too many login attempts. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private generateOtp(): string {
    return `${Math.floor(100000 + Math.random() * 900000)}`;
  }
}
