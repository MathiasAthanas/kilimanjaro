import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, User } from '../../generated/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { getPagination } from '../common/helpers/pagination.helper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rabbitmqService: RabbitMQService,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByRegistrationNumber(registrationNumber: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { registrationNumber } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createUser(dto: CreateUserDto, createdBy: string): Promise<ReturnType<UsersService['toSafeUser']>> {
    if (dto.role === Role.STUDENT && !dto.registrationNumber) {
      throw new BadRequestException('registrationNumber is required for STUDENT role');
    }

    if (dto.role !== Role.STUDENT && !dto.email) {
      throw new BadRequestException('email is required for non-STUDENT roles');
    }

    if (dto.email) {
      const existingEmail = await this.findByEmail(dto.email);
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.registrationNumber) {
      const existingReg = await this.findByRegistrationNumber(dto.registrationNumber);
      if (existingReg) {
        throw new ConflictException('Registration number already exists');
      }
    }

    const passwordHash = await argon2.hash(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          registrationNumber: dto.registrationNumber,
          passwordHash,
          role: dto.role,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phoneNumber: dto.phoneNumber,
          createdBy,
        },
      });

      await this.auditService.createLog({
        userId: createdBy,
        action: AuditAction.USER_CREATED,
        metadata: { createdUserId: user.id, role: user.role },
      });

      await this.rabbitmqService.publish('user.created', {
        userId: user.id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt.toISOString(),
      });

      return this.toSafeUser(user);
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User with this identifier already exists');
      }
      throw error;
    }
  }

  async deactivateUser(userId: string, actorId: string): Promise<void> {
    await this.findById(userId);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isActive: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } }),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_DEACTIVATED,
      metadata: { targetUserId: userId },
    });
  }

  async activateUser(userId: string, actorId: string): Promise<void> {
    await this.findById(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ACTIVATED,
      metadata: { targetUserId: userId },
    });
  }

  async updateRole(userId: string, role: Role, actorId: string): Promise<void> {
    await this.findById(userId);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { role } }),
      this.prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } }),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ROLE_CHANGED,
      metadata: { targetUserId: userId, role },
    });
  }

  async unlockUser(userId: string, actorId: string): Promise<void> {
    await this.findById(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.ACCOUNT_UNLOCKED,
      metadata: { targetUserId: userId },
    });
  }

  async updateUser(userId: string, dto: UpdateUserDto, actorId: string): Promise<ReturnType<UsersService['toSafeUser']>> {
    const existing = await this.findById(userId);

    if (dto.email && dto.email !== existing.email) {
      const duplicate = await this.findByEmail(dto.email);
      if (duplicate && duplicate.id !== userId) {
        throw new ConflictException('Email already exists');
      }
    }

    if (dto.registrationNumber && dto.registrationNumber !== existing.registrationNumber) {
      const duplicate = await this.findByRegistrationNumber(dto.registrationNumber);
      if (duplicate && duplicate.id !== userId) {
        throw new ConflictException('Registration number already exists');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email === undefined ? undefined : dto.email,
        registrationNumber: dto.registrationNumber === undefined ? undefined : dto.registrationNumber,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber === undefined ? undefined : dto.phoneNumber,
      },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ROLE_CHANGED,
      metadata: {
        targetUserId: userId,
        action: 'USER_PROFILE_UPDATED',
        before: this.toSafeUser(existing),
        after: this.toSafeUser(user),
      },
    });

    return this.toSafeUser(user);
  }

  async resetPassword(userId: string, dto: AdminResetPasswordDto, actorId: string) {
    await this.findById(userId);
    const temporaryPassword = dto.temporaryPassword || this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const revokeSessions = dto.revokeSessions !== false;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
      }),
      ...(revokeSessions
        ? [this.prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })]
        : []),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      metadata: { targetUserId: userId, adminReset: true, revokeSessions },
    });

    return {
      message: 'Password reset successfully',
      temporaryPassword,
      revokeSessions,
    };
  }

  async inviteUser(userId: string, actorId: string) {
    const user = await this.findById(userId);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      metadata: { targetUserId: userId, action: 'USER_INVITE_SENT' },
    });

    await this.rabbitmqService.publish('user.invite.requested', {
      userId: user.id,
      role: user.role,
      email: user.email,
      registrationNumber: user.registrationNumber,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return { message: 'Invite queued', userId: user.id };
  }

  async listSessions(userId: string) {
    await this.findById(userId);
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      isRevoked: session.isRevoked,
      status: session.isRevoked ? 'REVOKED' : session.expiresAt < new Date() ? 'EXPIRED' : 'ACTIVE',
    }));
  }

  async revokeSession(userId: string, sessionId: string, actorId: string) {
    await this.findById(userId);
    await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.LOGOUT,
      metadata: { targetUserId: userId, sessionId, adminRevoked: true },
    });

    return { message: 'Session revoked', sessionId };
  }

  async revokeAllSessions(userId: string, actorId: string) {
    await this.findById(userId);
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.LOGOUT,
      metadata: { targetUserId: userId, revokedCount: result.count, adminRevokedAll: true },
    });

    return { message: 'Sessions revoked', revokedCount: result.count };
  }

  async listUsers(query: ListUsersDto) {
    const pagination = getPagination(query.page, query.limit);

    const where: Prisma.UserWhereInput = {
      role: query.role,
      isActive: query.isActive,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item: User) => this.toSafeUser(item)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async registerFailedLogin(userId: string): Promise<{ failedLoginAttempts: number; locked: boolean; lockedUntil: Date | null }> {
    const user = await this.findById(userId);
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= 5;
    const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });

    return { failedLoginAttempts: attempts, locked: shouldLock, lockedUntil };
  }

  async registerSuccessfulLogin(userId: string, ipAddress: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });
  }

  toSafeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      registrationNumber: user.registrationNumber,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdBy: user.createdBy,
    };
  }

  private generateTemporaryPassword(): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `Temp-${random}-Kili`;
  }
}
