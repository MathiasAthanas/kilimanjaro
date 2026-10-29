import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma, Role, User } from '../../generated/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto, UserDirectoryCategory } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { BulkEditUserRowDto, CommitBulkEditUsersDto } from './dto/bulk-edit-users.dto';
import { getPagination } from '../common/helpers/pagination.helper';
import { resolveOrderBy } from '../common/helpers/sort.helper';

type AuthActor = {
  sub: string;
  role: string;
  scope?: 'GROUP' | 'SCHOOL';
  schoolIds?: string[];
  activeSchoolId?: string;
};

type BulkEditValue = string | null | boolean;

type BulkEditChange = {
  field: string;
  before: BulkEditValue;
  after: BulkEditValue;
};

type BulkEditPreviewRow = {
  rowNumber: number;
  userId: string;
  name: string;
  role: Role | string;
  changes: BulkEditChange[];
  errors: string[];
  warnings: string[];
  values: {
    firstName: string;
    lastName: string;
    email: string | null;
    registrationNumber: string | null;
    phoneNumber: string | null;
    department: string | null;
    isActive: boolean;
  };
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
    return this.prisma.user.findFirst({
      where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' } },
    });
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
    this.assertCanGrantRole(dto.role, actorRole, actor);
    const phoneLoginableRoles: Role[] = [Role.STUDENT, Role.PARENT];
    if (!phoneLoginableRoles.includes(dto.role) && !dto.email) {
      throw new BadRequestException('email is required for this role');
    }
    if (dto.role === Role.PARENT && !dto.email && !dto.phoneNumber) {
      throw new BadRequestException('email or phoneNumber is required for PARENT role');
    }

    const normalizedEmail = dto.email?.trim().toLowerCase();
    if (normalizedEmail) {
      const existingEmail = await this.findByEmail(normalizedEmail);
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
    const temporaryPasswordEncrypted = this.encryptTemporaryPassword(temporaryPassword);
    const membershipSchoolId = this.resolveMembershipSchoolId(dto, actor);

    try {
      const user = await this.prisma.$transaction((tx) => tx.user.create({
        data: {
          email: normalizedEmail,
          registrationNumber: dto.registrationNumber,
          passwordHash,
          role: dto.role,
          firstName: dto.firstName,
          lastName: dto.lastName,
          department: dto.department,
          phoneNumber: dto.phoneNumber ? UsersService.normalisePhone(dto.phoneNumber) : undefined,
          isActive: dto.isActive ?? true,
          mustChangePassword: true,
          temporaryPasswordEncrypted,
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
    const temporaryPasswordEncrypted = this.encryptTemporaryPassword(temporaryPassword);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email?.trim().toLowerCase() || undefined,
          passwordHash,
          role: Role.PARENT,
          firstName: input.firstName,
          lastName: input.lastName,
          phoneNumber: normalised,
          isActive: true,
          mustChangePassword: true,
          temporaryPasswordEncrypted,
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

  /** Ask student-service how an auth user is used, for safe-delete decisions. */
  private async fetchStudentUsage(authUserId: string): Promise<{
    isStudent: boolean; isGuardian: boolean; activeChildren: number; isClassTeacher: boolean; classTeacherOf: number;
  } | null> {
    const base = (this.configService.get<string>('STUDENT_SERVICE_URL') || 'http://localhost:3002').replace(/\/$/, '');
    const key = this.configService.get<string>('INTERNAL_API_KEY') || '';
    try {
      // student-service has no global /api/v1 prefix on internal routes.
      const res = await fetch(`${base}/students/internal/auth-usage/${authUserId}`, {
        headers: { 'x-internal-api-key': key },
      });
      if (!res.ok) return null;
      const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
      const data = body && typeof body === 'object' && 'data' in body ? (body as { data: unknown }).data : body;
      return data as any;
    } catch {
      return null; // fail-safe handled by caller
    }
  }

  /**
   * Delete a user only when it is safe. Students and guardians are never hard
   * deleted (they anchor student/guardian records) — deactivate instead. Staff
   * who are class teachers are blocked until reassigned. Everything else is
   * removed with its memberships, tokens and audit rows.
   */
  async deleteUser(userId: string, actorId: string, actorRole?: string, actor?: AuthActor): Promise<{ deleted: true }> {
    const user = await this.findManageableById(userId, actorRole, actor);

    if (user.role === Role.STUDENT) {
      throw new ForbiddenException('This user is a student account. Deactivate it or manage it from the student profile instead of deleting.');
    }
    if (user.role === Role.PARENT) {
      throw new ForbiddenException('This user is a guardian account linked to students. Unlink the guardian from all students first, or deactivate the account instead.');
    }

    const usage = await this.fetchStudentUsage(userId);
    if (usage) {
      if (usage.isStudent) throw new ForbiddenException('This user is linked to a student profile. Deactivate the account instead.');
      if (usage.isGuardian && usage.activeChildren > 0) throw new ForbiddenException('This user is a guardian linked to active students. Unlink the guardian first or deactivate the account.');
      if (usage.isClassTeacher) throw new ForbiddenException(`This teacher is assigned to ${usage.classTeacherOf} class(es). Remove the class-teacher assignment first or deactivate the account.`);
    }

    await this.prisma.$transaction([
      this.prisma.schoolMembership.deleteMany({ where: { authUserId: userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_DEACTIVATED,
      metadata: { targetUserId: userId, hardDeleted: true, role: user.role },
    });
    return { deleted: true };
  }

  /**
   * Move a staff user from their current school(s) to another school. Students
   * and guardians must be moved through the student-transfer flow, not here.
   * Group-only roles cannot be pinned to a single school.
   */
  async moveUserSchool(userId: string, toSchoolId: string, actorId: string, actorRole?: string, actor?: AuthActor) {
    const user = await this.findManageableById(userId, actorRole, actor);
    if (!toSchoolId) throw new BadRequestException('A destination school is required');

    if (user.role === Role.STUDENT) throw new BadRequestException('Move students using the student transfer/enrolment flow, not user membership.');
    if (user.role === Role.PARENT) throw new BadRequestException('Guardian school access follows their linked students; move the students instead.');
    if (UsersService.GROUP_ROLES.includes(user.role)) throw new BadRequestException(`${user.role} is a group-wide role and is not scoped to a single school.`);

    // Actor scope: a school-scoped admin can only move users into their own schools.
    if (actor?.scope === 'SCHOOL' && !(actor.schoolIds ?? []).includes(toSchoolId)) {
      throw new ForbiddenException('You cannot move a user into a school outside your scope');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.schoolMembership.updateMany({
        where: { authUserId: userId, role: user.role, isActive: true },
        data: { isActive: false, removedAt: new Date() },
      });
      await tx.schoolMembership.upsert({
        where: { authUserId_schoolId_role: { authUserId: userId, schoolId: toSchoolId, role: user.role } },
        create: { authUserId: userId, schoolId: toSchoolId, role: user.role, assignedById: actorId },
        update: { isActive: true, removedAt: null, assignedById: actorId },
      });
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ROLE_CHANGED,
      metadata: { targetUserId: userId, movedToSchool: toSchoolId, role: user.role },
    });
    return this.listMemberships(userId);
  }

  /**
   * Internal, unscoped hard delete for rollback of orphaned accounts. No actor
   * checks — guarded by the internal API key at the controller. Idempotent.
   */
  async hardDeleteInternal(userId: string): Promise<{ deleted: boolean }> {
    const existing = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!existing) return { deleted: false };
    await this.prisma.$transaction([
      this.prisma.schoolMembership.deleteMany({ where: { authUserId: userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
    return { deleted: true };
  }

  /**
   * Linked-record summary for a user, so the admin UI can explain why a delete
   * or move is restricted. Combines the auth role with student-service usage.
   */
  async getUserUsage(userId: string, actorRole?: string, actor?: AuthActor) {
    const user = await this.findManageableById(userId, actorRole, actor);
    const usage = await this.fetchStudentUsage(userId);
    const reasons: string[] = [];
    if (user.role === Role.STUDENT) reasons.push('Linked to a student profile — deactivate instead of deleting.');
    if (user.role === Role.PARENT) reasons.push('Guardian account — unlink from all students first, or deactivate.');
    if (usage?.isStudent) reasons.push('Has a student profile.');
    if (usage?.isGuardian && usage.activeChildren > 0) reasons.push(`Guardian of ${usage.activeChildren} active student(s).`);
    if (usage?.isClassTeacher) reasons.push(`Class teacher of ${usage.classTeacherOf} class(es) — reassign first.`);
    const groupRole = UsersService.GROUP_ROLES.includes(user.role);
    return {
      role: user.role,
      isGroupRole: groupRole,
      isStudent: usage?.isStudent ?? user.role === Role.STUDENT,
      isGuardian: usage?.isGuardian ?? user.role === Role.PARENT,
      activeChildren: usage?.activeChildren ?? 0,
      isClassTeacher: usage?.isClassTeacher ?? false,
      classTeacherOf: usage?.classTeacherOf ?? 0,
      canHardDelete: reasons.length === 0,
      canMoveSchool: !groupRole && user.role !== Role.STUDENT && user.role !== Role.PARENT,
      restrictions: reasons,
      usageCheckAvailable: usage !== null,
    };
  }

  /** All school memberships for a user (for the user detail page). */
  async listMemberships(userId: string) {
    return this.prisma.schoolMembership.findMany({
      where: { authUserId: userId },
      orderBy: [{ isActive: 'desc' }, { assignedAt: 'desc' }],
    });
  }

  async updateRole(userId: string, role: Role, actorId: string, actorRole?: string, actor?: AuthActor): Promise<void> {
    await this.findManageableById(userId, actorRole, actor);
    this.assertCanGrantRole(role, actorRole, actor);

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
    const normalizedEmail = dto.email === undefined
      ? undefined
      : (dto.email?.trim().toLowerCase() || null);

    if (!normalizedEmail && normalizedEmail !== undefined && existing.role !== Role.STUDENT && existing.role !== Role.PARENT) {
      throw new BadRequestException('Email is required for this role');
    }

    if (normalizedEmail && normalizedEmail !== existing.email) {
      const duplicate = await this.findByEmail(normalizedEmail);
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

    const loginIdentifierChanged = normalizedEmail !== undefined && normalizedEmail !== existing.email;
    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: normalizedEmail,
          registrationNumber: dto.registrationNumber === undefined ? undefined : dto.registrationNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          department: dto.department === undefined ? undefined : dto.department,
          phoneNumber: dto.phoneNumber === undefined
            ? undefined
            : (dto.phoneNumber ? UsersService.normalisePhone(dto.phoneNumber) : null),
        },
      }),
      ...(loginIdentifierChanged
        ? [this.prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })]
        : []),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ROLE_CHANGED,
      metadata: {
        targetUserId: userId,
        action: 'USER_PROFILE_UPDATED',
        before: this.toSafeUser(existing),
        after: this.toSafeUser(user),
        loginIdentifierChanged,
      },
    });

    return this.toSafeUser(user);
  }

  async resetPassword(userId: string, dto: AdminResetPasswordDto, actorId: string, actorRole?: string, actor?: AuthActor) {
    await this.findManageableById(userId, actorRole, actor);
    const temporaryPassword = dto.temporaryPassword || this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const temporaryPasswordEncrypted = this.encryptTemporaryPassword(temporaryPassword);
    const revokeSessions = dto.revokeSessions !== false;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          temporaryPasswordEncrypted,
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: true,
        },
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

  async getTemporaryPassword(userId: string, actorRole?: string, actor?: AuthActor) {
    const user = await this.findManageableById(userId, actorRole, actor);
    if (!user.mustChangePassword) {
      return { available: false, reason: 'PASSWORD_CHANGED' as const };
    }
    if (!user.temporaryPasswordEncrypted) {
      return { available: false, reason: 'NOT_RECORDED' as const };
    }

    await this.auditService.createLog({
      userId: actor?.sub,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      metadata: { targetUserId: userId, action: 'TEMPORARY_PASSWORD_VIEWED' },
    });

    return {
      available: true,
      temporaryPassword: this.decryptTemporaryPassword(user.temporaryPasswordEncrypted),
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

  async previewBulkEdit(rows: BulkEditUserRowDto[], actor: AuthActor) {
    const ids = rows.map((row) => row.userId.trim());
    const duplicateIds = new Set(ids.filter((id, index) => ids.indexOf(id) !== index));
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: [...new Set(ids)] },
        role: this.resolveVisibleRoleFilter(undefined, actor.role),
        ...this.userSchoolScope(actor),
      },
      include: {
        schoolMemberships: {
          where: { isActive: true },
          select: { schoolId: true },
        },
      },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    const previewRows: BulkEditPreviewRow[] = rows.map((row, index) => {
      const user = usersById.get(row.userId.trim());
      const errors: string[] = [];
      const warnings: string[] = [];
      const firstName = row.firstName.trim();
      const lastName = row.lastName.trim();
      const email = row.email?.trim().toLowerCase() || null;
      const registrationNumber = row.registrationNumber?.trim() || null;
      const phoneNumber = row.phoneNumber?.trim()
        ? UsersService.normalisePhone(row.phoneNumber.trim())
        : null;
      const department = row.department?.trim() || null;
      const isActive = row.status === 'ACTIVE';
      const values = { firstName, lastName, email, registrationNumber, phoneNumber, department, isActive };

      if (!user) {
        errors.push('User was not found or is outside your current school access.');
        return {
          rowNumber: index + 2,
          userId: row.userId,
          name: [firstName, lastName].filter(Boolean).join(' ') || row.userId,
          role: row.role,
          changes: [],
          errors,
          warnings,
          values,
        };
      }

      if (duplicateIds.has(user.id)) errors.push('This user appears more than once in the uploaded file.');
      if (!firstName) errors.push('First name is required.');
      if (!lastName) errors.push('Last name is required.');
      if (row.role.trim() !== user.role) errors.push('Role is read-only and cannot be changed by bulk edit.');

      const actualSchoolIds = this.serialiseSchoolIds(user.schoolMemberships.map((membership) => membership.schoolId));
      if (this.normaliseSchoolIds(row.schoolIds) !== actualSchoolIds) {
        errors.push('School memberships are read-only. Export a fresh file if memberships changed.');
      }

      const expectedUpdatedAt = new Date(row.updatedAt);
      if (Number.isNaN(expectedUpdatedAt.getTime()) || expectedUpdatedAt.getTime() !== user.updatedAt.getTime()) {
        errors.push('This account changed after export. Export a fresh file before editing it.');
      }

      if (!(user.role === Role.STUDENT || user.role === Role.PARENT) && !email) {
        errors.push('Email is required for this role.');
      }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email address is invalid.');
      if (user.role === Role.STUDENT && !registrationNumber) errors.push('Registration number is required for students.');
      if (user.role === Role.PARENT && !email && !phoneNumber) errors.push('A parent or guardian requires an email or phone number.');
      if (user.id === actor.sub && !isActive) errors.push('You cannot deactivate your own account.');

      const changes: BulkEditChange[] = [];
      const addChange = (field: string, before: BulkEditValue, after: BulkEditValue) => {
        if (before !== after) changes.push({ field, before, after });
      };
      addChange('firstName', user.firstName, firstName);
      addChange('lastName', user.lastName, lastName);
      addChange('email', user.email, email);
      addChange('registrationNumber', user.registrationNumber, registrationNumber);
      addChange('phoneNumber', user.phoneNumber, phoneNumber);
      addChange('department', user.department, department);
      addChange('status', user.isActive ? 'ACTIVE' : 'INACTIVE', isActive ? 'ACTIVE' : 'INACTIVE');

      if (!changes.length) warnings.push('No editable fields changed.');
      return {
        rowNumber: index + 2,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        role: user.role,
        changes,
        errors,
        warnings,
        values,
      };
    });

    await this.addBulkIdentifierConflicts(previewRows);
    const changed = previewRows.filter((row) => row.changes.length > 0 && row.errors.length === 0).length;
    const invalid = previewRows.filter((row) => row.errors.length > 0).length;
    return {
      summary: {
        total: previewRows.length,
        changed,
        unchanged: previewRows.length - changed - invalid,
        invalid,
      },
      canCommit: changed > 0 && invalid === 0,
      rows: previewRows,
    };
  }

  async commitBulkEdit(dto: CommitBulkEditUsersDto, actor: AuthActor) {
    if (!dto.confirmed) throw new BadRequestException('Confirm the reviewed changes before applying them.');
    const preview = await this.previewBulkEdit(dto.rows, actor);
    if (!preview.canCommit) {
      throw new BadRequestException({
        message: 'Bulk edit cannot be applied. Fix the preview errors and upload the file again.',
        preview,
      });
    }

    const changedRows = preview.rows.filter((row) => row.changes.length > 0 && row.errors.length === 0);
    const changedIds = new Set(changedRows.map((row) => row.userId));
    const resetIds = [...new Set(dto.resetUserIds)];
    if (resetIds.some((id) => !changedIds.has(id))) {
      throw new BadRequestException('Passwords can only be reset for users with reviewed changes in this upload.');
    }

    const credentialMap = new Map<string, { temporaryPassword: string; passwordHash: string; encrypted: string }>();
    // Argon2 is intentionally expensive. Four-at-a-time uses its worker pool
    // without launching an unbounded number of memory-heavy hashes.
    for (let offset = 0; offset < resetIds.length; offset += 4) {
      await Promise.all(resetIds.slice(offset, offset + 4).map(async (userId) => {
        const temporaryPassword = this.generateTemporaryPassword();
        credentialMap.set(userId, {
          temporaryPassword,
          passwordHash: await argon2.hash(temporaryPassword),
          encrypted: this.encryptTemporaryPassword(temporaryPassword),
        });
      }));
    }

    const sourceRows = new Map(dto.rows.map((row) => [row.userId.trim(), row]));
    await this.prisma.$transaction(async (tx) => {
      for (const row of changedRows) {
        const source = sourceRows.get(row.userId);
        if (!source) throw new ConflictException('Uploaded data changed before commit. Preview it again.');
        const credential = credentialMap.get(row.userId);
        const updateResult = await tx.user.updateMany({
          where: { id: row.userId, updatedAt: new Date(source.updatedAt) },
          data: {
            ...row.values,
            ...(credential
              ? {
                  passwordHash: credential.passwordHash,
                  temporaryPasswordEncrypted: credential.encrypted,
                  mustChangePassword: true,
                  failedLoginAttempts: 0,
                  lockedUntil: null,
                }
              : {}),
          },
        });
        if (updateResult.count !== 1) {
          throw new ConflictException(`${row.name} changed while this update was being applied. Export and review a fresh file.`);
        }

        if (row.role === Role.STUDENT) {
          await tx.$executeRaw`
            UPDATE students."Student"
            SET "firstName" = ${row.values.firstName},
                "lastName" = ${row.values.lastName},
                "registrationNumber" = ${row.values.registrationNumber},
                "updatedAt" = NOW()
            WHERE "authUserId" = ${row.userId}
          `;
        } else if (row.role === Role.PARENT) {
          await tx.$executeRaw`
            UPDATE students."Guardian"
            SET "firstName" = ${row.values.firstName},
                "lastName" = ${row.values.lastName},
                "email" = ${row.values.email},
                "phoneNumber" = COALESCE(${row.values.phoneNumber}, "phoneNumber")
            WHERE "authUserId" = ${row.userId}
          `;
        }

        const loginChanged = row.changes.some((change) => ['email', 'registrationNumber', 'phoneNumber', 'status'].includes(change.field));
        if (credential || loginChanged) {
          await tx.refreshToken.updateMany({
            where: { userId: row.userId, isRevoked: false },
            data: { isRevoked: true },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: actor.sub,
            action: AuditAction.USER_ROLE_CHANGED,
            metadata: {
              action: 'BULK_USER_PROFILE_UPDATED',
              targetUserId: row.userId,
              changes: row.changes,
              passwordReset: Boolean(credential),
            },
          },
        });
      }
    }, { maxWait: 10_000, timeout: 180_000 });

    const credentials = changedRows.flatMap((row) => {
      const credential = credentialMap.get(row.userId);
      if (!credential) return [];
      return [{
        userId: row.userId,
        name: row.name,
        login: row.values.email ?? row.values.registrationNumber ?? row.values.phoneNumber ?? '',
        temporaryPassword: credential.temporaryPassword,
      }];
    });
    return {
      message: `${changedRows.length} user account${changedRows.length === 1 ? '' : 's'} updated successfully.`,
      updated: changedRows.length,
      passwordResets: credentials.length,
      credentials,
    };
  }

  async listUsers(query: ListUsersDto, actor?: AuthActor) {
    const pagination = getPagination(query.page, query.limit);

    const where: Prisma.UserWhereInput = {
      role: this.resolveVisibleRoleFilter(query.role, actor?.role, query.category),
      isActive: query.isActive,
      ...(query.phoneNumber ? { phoneNumber: UsersService.normalisePhone(query.phoneNumber) } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search, mode: 'insensitive' } },
              { lastName: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
              { registrationNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...this.userSchoolScope(actor),
    };

    const orderBy = resolveOrderBy<Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[]>(
      query.sortBy,
      query.sortDir,
      {
        name: (dir) => [{ firstName: dir }, { lastName: dir }],
        email: (dir) => ({ email: dir }),
        role: (dir) => ({ role: dir }),
        status: (dir) => ({ isActive: dir }),
        lastLoginAt: (dir) => ({ lastLoginAt: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
      },
      { createdAt: 'desc' },
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy,
        include: {
          schoolMemberships: {
            where: { isActive: true },
            select: { schoolId: true },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSafeUser(item)),
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

  toSafeUser(user: User & { schoolMemberships?: Array<{ schoolId: string | null }> }) {
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
      schoolIds: [...new Set((user.schoolMemberships ?? []).map((membership) => membership.schoolId).filter((id): id is string => Boolean(id)))],
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

  private temporaryCredentialKey(): Buffer {
    const secret = this.configService.get<string>('TEMP_CREDENTIAL_ENCRYPTION_KEY')
      || this.configService.get<string>('INTERNAL_API_KEY');
    if (!secret) {
      throw new InternalServerErrorException('Temporary credential encryption is not configured');
    }
    return crypto.createHash('sha256').update(secret).digest();
  }

  private encryptTemporaryPassword(password: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.temporaryCredentialKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
  }

  private decryptTemporaryPassword(payload: string): string {
    try {
      const [version, iv, tag, ciphertext] = payload.split('.');
      if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('invalid payload');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.temporaryCredentialKey(),
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Temporary password cannot be read; reset it to issue a new one');
    }
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

  private assertCanGrantRole(role: Role, actorRole?: string, actor?: AuthActor): void {
    if (role === Role.SUPER_ADMIN && !this.isSuperAdmin(actorRole)) {
      throw new ForbiddenException('Only super admins can assign this role');
    }
    if (UsersService.GROUP_ROLES.includes(role) && actor?.scope !== 'GROUP') {
      throw new ForbiddenException('Only a group-scoped account can assign a group-wide role');
    }
  }

  private assertCanSeeUser(user: User, actorRole?: string): void {
    if (this.isSystemAdmin(actorRole) && user.role === Role.SUPER_ADMIN) {
      throw new NotFoundException('User not found');
    }
  }

  private resolveVisibleRoleFilter(
    role: Role | undefined,
    actorRole?: string,
    category: UserDirectoryCategory = UserDirectoryCategory.ALL,
  ): Prisma.EnumRoleFilter | Role | undefined {
    const hiddenRoles: Role[] = this.isSystemAdmin(actorRole) ? [Role.SUPER_ADMIN] : [];
    if (role) {
      if (hiddenRoles.includes(role)) return { in: [] };
      return role;
    }

    const categoryRoles: Partial<Record<UserDirectoryCategory, Role[]>> = {
      [UserDirectoryCategory.TEACHERS]: [Role.TEACHER],
      [UserDirectoryCategory.STUDENTS]: [Role.STUDENT],
      [UserDirectoryCategory.PARENTS_GUARDIANS]: [Role.PARENT],
      [UserDirectoryCategory.STAFF]: Object.values(Role).filter((candidate) => candidate !== Role.STUDENT && candidate !== Role.PARENT),
    };
    const included = categoryRoles[category];
    if (included) return { in: included.filter((candidate) => !hiddenRoles.includes(candidate)) };
    return hiddenRoles.length ? { notIn: hiddenRoles } : undefined;
  }

  private serialiseSchoolIds(schoolIds: Array<string | null>): string {
    return [...new Set(schoolIds.filter((id): id is string => Boolean(id)))].sort().join(',');
  }

  private normaliseSchoolIds(value: string): string {
    return [...new Set(value.split(',').map((id) => id.trim()).filter(Boolean))].sort().join(',');
  }

  private async addBulkIdentifierConflicts(rows: BulkEditPreviewRow[]): Promise<void> {
    const validRows = rows.filter((row) => row.errors.length === 0);
    const emailOwners = new Map<string, BulkEditPreviewRow[]>();
    const registrationOwners = new Map<string, BulkEditPreviewRow[]>();
    for (const row of validRows) {
      if (row.values.email) {
        const owners = emailOwners.get(row.values.email) ?? [];
        owners.push(row);
        emailOwners.set(row.values.email, owners);
      }
      if (row.values.registrationNumber) {
        const owners = registrationOwners.get(row.values.registrationNumber) ?? [];
        owners.push(row);
        registrationOwners.set(row.values.registrationNumber, owners);
      }
    }
    for (const owners of emailOwners.values()) {
      if (owners.length > 1) owners.forEach((row) => row.errors.push('Email is duplicated in the uploaded file.'));
    }
    for (const owners of registrationOwners.values()) {
      if (owners.length > 1) owners.forEach((row) => row.errors.push('Registration number is duplicated in the uploaded file.'));
    }

    const identifiers = await this.prisma.user.findMany({
      where: {
        OR: [
          { email: { in: [...emailOwners.keys()] } },
          { registrationNumber: { in: [...registrationOwners.keys()] } },
        ],
      },
      select: { id: true, email: true, registrationNumber: true },
    });
    for (const existing of identifiers) {
      if (existing.email) {
        emailOwners.get(existing.email)?.forEach((row) => {
          if (row.userId !== existing.id) row.errors.push('Email already belongs to another user.');
        });
      }
      if (existing.registrationNumber) {
        registrationOwners.get(existing.registrationNumber)?.forEach((row) => {
          if (row.userId !== existing.id) row.errors.push('Registration number already belongs to another user.');
        });
      }
    }
  }
}
