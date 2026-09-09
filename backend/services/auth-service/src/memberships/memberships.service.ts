import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, Prisma, Role } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { UsersService } from '../users/users.service';

const GROUP_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SYSTEM_ADMIN, Role.MANAGER, Role.HEAD_OF_FINANCE];

type MembershipActor = {
  sub: string;
  role: string;
  scope?: 'GROUP' | 'SCHOOL';
  schoolIds?: string[];
  activeSchoolId?: string;
};

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly usersService: UsersService,
  ) {}

  async assign(
    input: { authUserId: string; schoolId?: string | null; role: Role },
    actorId: string,
    actorRole?: string,
    actor?: MembershipActor,
  ) {
    this.assertCanAssignRole(input.role, actorRole);
    const isGroupRole = GROUP_ROLES.includes(input.role);
    const schoolId = isGroupRole ? null : input.schoolId ?? null;
    this.assertSchoolScope(schoolId, actor);
    if (!isGroupRole && !schoolId) {
      throw new BadRequestException(`${input.role} is a school role — schoolId is required`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: input.authUserId } });
    if (!user) throw new NotFoundException('User not found');
    this.assertCanSeeRole(user.role, actorRole);

    const existing = await this.prisma.schoolMembership.findFirst({
      where: { authUserId: input.authUserId, schoolId, role: input.role },
    });
    const membership = existing
      ? await this.prisma.schoolMembership.update({
          where: { id: existing.id },
          data: { isActive: true, removedAt: null, assignedById: actorId },
        })
      : await this.prisma.schoolMembership.create({
          data: { authUserId: input.authUserId, schoolId, role: input.role, assignedById: actorId },
        });

    // Heads of School get their primary role upgraded so their home dashboard matches
    if (input.role === Role.HEAD_OF_SCHOOL && user.role !== Role.HEAD_OF_SCHOOL && !GROUP_ROLES.includes(user.role)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { role: Role.HEAD_OF_SCHOOL } });
    }

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ROLE_CHANGED,
      metadata: { membership: membership.id, targetUserId: input.authUserId, role: input.role, schoolId },
    });
    await this.rabbitmqService.publish('membership.changed', {
      authUserId: input.authUserId,
      schoolId,
      role: input.role,
      isActive: true,
      actorId,
    });

    return membership;
  }

  async assignWithUser(
    input: {
      firstName: string;
      lastName: string;
      email?: string;
      phoneNumber?: string;
      role: Role;
      schoolId?: string | null;
    },
    actorId: string,
    actorRole?: string,
    actor?: MembershipActor,
  ) {
    const created = await this.usersService.createUser(
      {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        role: input.role,
        schoolId: input.schoolId ?? undefined,
        isActive: true,
      },
      actorId,
      actorRole,
      actor,
    );
    const membership = await this.assign(
      { authUserId: created.id, schoolId: input.schoolId, role: input.role },
      actorId,
      actorRole,
      actor,
    );
    return { user: created, membership };
  }

  async revoke(id: string, actorId: string, actorRole?: string, actor?: MembershipActor) {
    const membership = await this.prisma.schoolMembership.findUnique({ where: { id } });
    if (!membership) throw new NotFoundException('Membership not found');
    this.assertCanSeeRole(membership.role, actorRole);
    this.assertSchoolScope(membership.schoolId, actor);
    const updated = await this.prisma.schoolMembership.update({
      where: { id },
      data: { isActive: false, removedAt: new Date() },
    });
    await this.rabbitmqService.publish('membership.changed', {
      authUserId: membership.authUserId,
      schoolId: membership.schoolId,
      role: membership.role,
      isActive: false,
      actorId,
    });
    return updated;
  }

  async list(filters: { schoolId?: string; role?: Role; authUserId?: string }, actorRole?: string, actor?: MembershipActor) {
    const schoolId = filters.schoolId ?? actor?.activeSchoolId;
    if (schoolId) this.assertSchoolScope(schoolId, actor);
    const memberships = await this.prisma.schoolMembership.findMany({
      where: {
        isActive: true,
        schoolId,
        role: this.resolveVisibleRoleFilter(filters.role, actorRole),
        authUserId: filters.authUserId,
        user: this.isSystemAdmin(actorRole) ? { role: { not: Role.SUPER_ADMIN } } : undefined,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phoneNumber: true, role: true, isActive: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });
    return memberships;
  }

  /** Manager appoints (or replaces) the single group Head of Finances. */
  async appointHeadOfFinance(authUserId: string, actorId: string) {
    const current = await this.prisma.schoolMembership.findMany({
      where: { role: Role.HEAD_OF_FINANCE, isActive: true },
    });
    for (const m of current) {
      if (m.authUserId !== authUserId) await this.revoke(m.id, actorId, Role.MANAGER);
    }
    const membership = await this.assign({ authUserId, role: Role.HEAD_OF_FINANCE }, actorId);
    await this.prisma.user.update({ where: { id: authUserId }, data: { role: Role.HEAD_OF_FINANCE } });
    return membership;
  }

  private assertSchoolScope(schoolId: string | null, actor?: MembershipActor): void {
    if (!schoolId || !actor || actor.scope === 'GROUP') return;
    if (actor.activeSchoolId && actor.activeSchoolId !== schoolId) {
      throw new ForbiddenException('Membership changes must use the currently selected school');
    }
    if (!actor.schoolIds?.includes(schoolId)) {
      throw new ForbiddenException('Membership belongs to a school outside your scope');
    }
  }

  private isSystemAdmin(actorRole?: string): boolean {
    return actorRole === Role.SYSTEM_ADMIN || actorRole === 'ADMIN';
  }

  private isSuperAdmin(actorRole?: string): boolean {
    return actorRole === Role.SUPER_ADMIN;
  }

  private assertCanAssignRole(role: Role, actorRole?: string): void {
    if (role === Role.SUPER_ADMIN && !this.isSuperAdmin(actorRole)) {
      throw new ForbiddenException('Only super admins can assign this role');
    }
  }

  private assertCanSeeRole(role: Role, actorRole?: string): void {
    if (this.isSystemAdmin(actorRole) && role === Role.SUPER_ADMIN) {
      throw new NotFoundException('Membership not found');
    }
  }

  private resolveVisibleRoleFilter(role: Role | undefined, actorRole?: string): Prisma.EnumRoleFilter | Role | undefined {
    if (!this.isSystemAdmin(actorRole)) return role;
    if (role === Role.SUPER_ADMIN) return { in: [] };
    return role ?? { not: Role.SUPER_ADMIN };
  }
}
