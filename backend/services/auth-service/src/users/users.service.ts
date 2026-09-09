import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

type AuthActor = {
  sub: string;
  role: string;
  scope?: 'GROUP' | 'SCHOOL';
  schoolIds?: string[];
  activeSchoolId?: string;
};

@Injectable()
export class UsersService {
  private static readonly GROUP_ROLES: Role[] = [
    Role.SUPER_ADMIN,
    Role.SYSTEM_ADMIN,
    Role.MANAGER,
    Role.HEAD_OF_FINANCE,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {}

  static normalisePhone(phone: string): string {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('255')) return `+${digits}`;
    if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
    if (digits.length === 9) return `+255${digits}`;
    return `+${digits}`;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByRegistrationNumber(registrationNumber: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { registrationNumber } });
  }

  async findByPhoneNumber(phone: string): Promise<User | null> {
    const normalised = UsersService.normalisePhone(phone);
    return this.prisma.user.findFirst({
      where: { phoneNumber: { in: [normalised, phone.trim()] } },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findManageableById(id: string, actorRole?: string, actor?: AuthActor): Promise<User> {
    const user = await this.findById(id);
    this.assertCanSeeUser(user, actorRole);
    await this.assertUserInSchoolScope(user, actor);
    return user;
  }

  async createUser(dto: CreateUserDto, createdBy: string, actorRole?: string, actor?: AuthActor) {
    this.assertCanGrantRole(dto.role, actorRole);
    const phoneLoginableRoles: Role[] = [Role.STUDENT, Role.PARENT];
    if (!phoneLoginableRoles.includes(dto.role) && !dto.email) {
      throw new BadRequestException('email is required for this role');
    }
    if (dto.role === Role.PARENT && !dto.email && !dto.phoneNumber) {
      throw new BadRequestException('email or phoneNumber is required for PARENT role');
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

    const temporaryPassword = dto.password || this.generateNamePassword(dto.firstName, dto.lastName);
    const passwordHash = await argon2.hash(temporaryPassword);
    const membershipSchoolId = this.resolveMembershipSchoolId(dto, actor);

    try {
      const user = await this.prisma.$transaction((tx) => tx.user.create({
        data: {
          email: dto.email,
          registrationNumber: dto.registrationNumber,
          passwordHash,
          role: dto.role,
          firstName: dto.firstName,
          lastName: dto.lastName,
          department: dto.department,
          phoneNumber: dto.phoneNumber ? UsersService.normalisePhone(dto.phoneNumber) : undefined,
          isActive: dto.isActive ?? true,
          mustChangePassword: true,
          createdBy,
          schoolMemberships: {
            create: {
              schoolId: membershipSchoolId,
              role: dto.role,
              assignedById: createdBy,
            },
          },
        },
      }));

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

      return {
        ...this.toSafeUser(user),
        temporaryPassword,
      };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User with this identifier already exists');
      }
      throw error;
    }
  }

  /**
   * Find-or-create a PARENT account keyed by normalised phone number.
   * Used by service-to-service flows (admissions enrolment, bulk import) so
   * siblings always share one parent account. Default password follows the
   * documented `Parent@XXXX` scheme (last 4 digits of the normalised phone).
   */
  async ensureParentAccount(
    input: { firstName: string; lastName: string; phoneNumber: string; email?: string; schoolId?: string | null },
    actorId: string,
  ): Promise<{ id: string; created: boolean; phoneNumber: string; temporaryPassword?: string }> {
    if (!input.phoneNumber?.trim()) {
      throw new BadRequestException('phoneNumber is required for a parent account');
    }

    const normalised = UsersService.normalisePhone(input.phoneNumber);
    if (!input.schoolId) {
      throw new BadRequestException('schoolId is required for a parent account');
    }
    const existing = await this.prisma.user.findFirst({
      where: { role: Role.PARENT, phoneNumber: normalised },
    });
    if (existing) {
      const membership = await this.prisma.schoolMembership.findFirst({
        where: { authUserId: existing.id, schoolId: input.schoolId, role: Role.PARENT, isActive: true },
        select: { id: true },
      });
      if (!membership) {
        await this.prisma.schoolMembership.upsert({
          where: { authUserId_schoolId_role: { authUserId: existing.id, schoolId: input.schoolId, role: Role.PARENT } },
          create: { authUserId: existing.id, schoolId: input.schoolId, role: Role.PARENT, assignedById: actorId },
          update: { isActive: true, removedAt: null, assignedById: actorId },
        });
      }
      return { id: existing.id, created: false, phoneNumber: normalised };
    }

    const temporaryPassword = `Parent@${normalised.slice(-4)}`;
    const passwordHash = await argon2.hash(temporaryPassword);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email || undefined,
          passwordHash,
          role: Role.PARENT,
          firstName: input.firstName,
          lastName: input.lastName,
          phoneNumber: normalised,
          isActive: true,
          mustChangePassword: true,
          createdBy: actorId,
          schoolMemberships: {
            create: { schoolId: input.schoolId, role: Role.PARENT, assignedById: actorId },
          },
        },
      });

      await this.auditService.createLog({
        userId: actorId,
        action: AuditAction.USER_CREATED,
        metadata: { createdUserId: user.id, role: user.role, via: 'ensureParentAccount' },
      });

      await this.rabbitmqService.publish('user.created', {
        userId: user.id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt.toISOString(),
      });

      return { id: user.id, created: true, phoneNumber: normalised, temporaryPassword };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        // lost a race with a concurrent import — re-read the winner
        const winner = await this.prisma.user.findFirst({
          where: { role: Role.PARENT, phoneNumber: normalised },
        });
        if (winner) return { id: winner.id, created: false, phoneNumber: normalised };
      }
      throw error;
    }
  }

  async deactivateUser(userId: string, actorId: string, actorRole?: string, actor?: AuthActor): Promise<void> {
    await this.findManageableById(userId, actorRole, actor);

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

  async activateUser(userId: string, actorId: string, actorRole?: string, actor?: AuthActor): Promise<void> {
    await this.findManageableById(userId, actorRole, actor);

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

  async updateRole(userId: string, role: Role, actorId: string, actorRole?: string, actor?: AuthActor): Promise<void> {
    await this.findManageableById(userId, actorRole, actor);
    this.assertCanGrantRole(role, actorRole);

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

  async unlockUser(userId: string, actorId: string, actorRole?: string, actor?: AuthActor): Promise<void> {
    await this.findManageableById(userId, actorRole, actor);

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

  async updateUser(userId: string, dto: UpdateUserDto, actorId: string, actorRole?: string, actor?: AuthActor): Promise<ReturnType<UsersService['toSafeUser']>> {
    const existing = await this.findManageableById(userId, actorRole, actor);

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
        department: dto.department === undefined ? undefined : dto.department,
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

  async resetPassword(userId: string, dto: AdminResetPasswordDto, actorId: string, actorRole?: string, actor?: AuthActor) {
    await this.findManageableById(userId, actorRole, actor);
    const temporaryPassword = dto.temporaryPassword || this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const revokeSessions = dto.revokeSessions !== false;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, mustChangePassword: true },
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

  async inviteUser(userId: string, actorId: string, actorRole?: string, actor?: AuthActor) {
    const user = await this.findManageableById(userId, actorRole, actor);

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

  async listSessions(userId: string, actorRole?: string, actor?: AuthActor) {
    await this.findManageableById(userId, actorRole, actor);
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

  async revokeSession(userId: string, sessionId: string, actorId: string, actorRole?: string, actor?: AuthActor) {
    await this.findManageableById(userId, actorRole, actor);
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

  async revokeAllSessions(userId: string, actorId: string, actorRole?: string, actor?: AuthActor) {
    await this.findManageableById(userId, actorRole, actor);
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

  async listUsers(query: ListUsersDto, actor?: AuthActor) {
    const pagination = getPagination(query.page, query.limit);

    const where: Prisma.UserWhereInput = {
      role: this.resolveVisibleRoleFilter(query.role, actor?.role),
      isActive: query.isActive,
      ...(query.phoneNumber ? { phoneNumber: UsersService.normalisePhone(query.phoneNumber) } : {}),
      ...this.userSchoolScope(actor),
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
    const maxAttempts = Number(this.configService.get('LOGIN_MAX_ATTEMPTS', '100'));
    const lockMinutes = Number(this.configService.get('LOGIN_LOCK_MINUTES', '15'));
    const shouldLock = attempts >= maxAttempts;
    const lockedUntil = shouldLock ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;

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
      department: user.department,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      mustChangePassword: user.mustChangePassword,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdBy: user.createdBy,
    };
  }

  async stats() {
    const [total, activeCount, byRoleRaw] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    ]);
    const byRole = byRoleRaw.reduce<Record<string, number>>((acc, row) => {
      acc[row.role] = row._count._all;
      return acc;
    }, {});
    return { total, active: activeCount, inactive: total - activeCount, byRole };
  }

  private generateTemporaryPassword(): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `Temp-${random}-Kili`;
  }

  private generateNamePassword(_firstName: string, lastName: string): string {
    const base = lastName.charAt(0).toUpperCase() + lastName.slice(1).toLowerCase().replace(/[^a-z]/g, '');
    const digits = Math.floor(1000 + Math.random() * 9000);
    return `${base}@Kili${digits}`;
  }

  private resolveMembershipSchoolId(dto: CreateUserDto, actor?: AuthActor): string | null {
    if (UsersService.GROUP_ROLES.includes(dto.role)) {
      return null;
    }

    const schoolId = dto.schoolId ?? actor?.activeSchoolId ?? this.singleSchoolId(actor);
    if (!schoolId) {
      throw new BadRequestException(`Select a school before creating a ${dto.role} account`);
    }
    if (actor?.activeSchoolId && actor.activeSchoolId !== schoolId) {
      throw new ForbiddenException('User accounts must be created in the currently selected school');
    }
    if (actor?.scope === 'SCHOOL' && !actor.schoolIds?.includes(schoolId)) {
      throw new ForbiddenException('You cannot create users outside your school scope');
    }
    return schoolId;
  }

  private singleSchoolId(actor?: AuthActor): string | null {
    if (actor?.scope !== 'SCHOOL') return null;
    const ids = (actor.schoolIds ?? []).filter((id) => id && id !== '*');
    return ids.length === 1 ? ids[0] : null;
  }

  private userSchoolScope(actor?: AuthActor): Prisma.UserWhereInput {
    if (!actor || (actor.scope === 'GROUP' && !actor.activeSchoolId)) return {};
    const schoolIds = actor.activeSchoolId
      ? [actor.activeSchoolId]
      : (actor.schoolIds ?? []).filter((id) => id && id !== '*');
    return {
      schoolMemberships: {
        some: { isActive: true, schoolId: { in: schoolIds.length ? schoolIds : ['__none__'] } },
      },
    };
  }

  private async assertUserInSchoolScope(user: User, actor?: AuthActor): Promise<void> {
    if (!actor || (actor.scope === 'GROUP' && !actor.activeSchoolId)) return;
    const scoped = this.userSchoolScope(actor).schoolMemberships;
    const membership = await this.prisma.schoolMembership.findFirst({
      where: { authUserId: user.id, ...(scoped?.some ?? {}) },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('User not found');
    }
  }

  private isSystemAdmin(actorRole?: string): boolean {
    return actorRole === Role.SYSTEM_ADMIN || actorRole === 'ADMIN';
  }

  private isSuperAdmin(actorRole?: string): boolean {
    return actorRole === Role.SUPER_ADMIN;
  }

  private assertCanGrantRole(role: Role, actorRole?: string): void {
    if (role === Role.SUPER_ADMIN && !this.isSuperAdmin(actorRole)) {
      throw new ForbiddenException('Only super admins can assign this role');
    }
  }

  private assertCanSeeUser(user: User, actorRole?: string): void {
    if (this.isSystemAdmin(actorRole) && user.role === Role.SUPER_ADMIN) {
      throw new NotFoundException('User not found');
    }
  }

  private resolveVisibleRoleFilter(role: Role | undefined, actorRole?: string): Prisma.EnumRoleFilter | Role | undefined {
    if (!this.isSystemAdmin(actorRole)) return role;
    if (role === Role.SUPER_ADMIN) return { in: [] };
    return role ?? { not: Role.SUPER_ADMIN };
  }
}
