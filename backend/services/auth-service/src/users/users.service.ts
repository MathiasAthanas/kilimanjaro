import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role, User } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
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
}
