import { BadRequestException } from '@nestjs/common';
import { Role } from '../../generated/prisma';
import { MembershipsService } from './memberships.service';

type Membership = { id: string; authUserId: string; schoolId: string | null; role: Role; isActive: boolean };
type UserRow = { id: string; role: Role };

/** In-memory stand-in for the two tables the Head of Finance flow touches. */
function buildPrisma(users: UserRow[], memberships: Membership[]) {
  const matches = (m: Membership, where: Record<string, any> = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (value !== null && typeof value === 'object' && 'not' in value) return m[key as keyof Membership] !== value.not;
      return m[key as keyof Membership] === value;
    });

  return {
    user: {
      findUnique: jest.fn(async ({ where }) => users.find((u) => u.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }) => {
        const user = users.find((u) => u.id === where.id)!;
        Object.assign(user, data);
        return user;
      }),
    },
    schoolMembership: {
      findMany: jest.fn(async ({ where }) => memberships.filter((m) => matches(m, where))),
      findFirst: jest.fn(async ({ where }) => memberships.find((m) => matches(m, where)) ?? null),
      findUnique: jest.fn(async ({ where }) => memberships.find((m) => m.id === where.id) ?? null),
      create: jest.fn(async ({ data }) => {
        const created: Membership = { id: `m-${memberships.length + 1}`, isActive: true, ...data };
        memberships.push(created);
        return created;
      }),
      update: jest.fn(async ({ where, data }) => {
        const membership = memberships.find((m) => m.id === where.id)!;
        Object.assign(membership, data);
        return membership;
      }),
    },
  };
}

describe('MembershipsService Head of Finance appointment', () => {
  const manager = { sub: 'manager-1', role: Role.MANAGER, scope: 'GROUP' as const, schoolIds: ['*'] };
  let users: UserRow[];
  let memberships: Membership[];
  let service: MembershipsService;

  beforeEach(() => {
    users = [
      { id: 'old-hof', role: Role.HEAD_OF_FINANCE },
      { id: 'new-hof', role: Role.FINANCE },
      { id: 'boss', role: Role.SUPER_ADMIN },
      { id: 'mgr', role: Role.MANAGER },
    ];
    memberships = [
      { id: 'm-old-group', authUserId: 'old-hof', schoolId: null, role: Role.HEAD_OF_FINANCE, isActive: true },
      { id: 'm-old-school', authUserId: 'old-hof', schoolId: 'school-a', role: Role.FINANCE, isActive: true },
      { id: 'm-new-school', authUserId: 'new-hof', schoolId: 'school-a', role: Role.FINANCE, isActive: true },
    ];
    const prisma = buildPrisma(users, memberships);
    const audit = { createLog: jest.fn() } as any;
    const rabbit = { publish: jest.fn() } as any;
    service = new MembershipsService(prisma as any, audit, rabbit, {} as any);
  });

  it('lets a Manager appoint a Head of Finance (group role, group-scoped actor)', async () => {
    const membership = await service.appointHeadOfFinance('new-hof', manager.sub, manager.role, manager);

    expect(membership).toMatchObject({ authUserId: 'new-hof', schoolId: null, role: Role.HEAD_OF_FINANCE, isActive: true });
    expect(users.find((u) => u.id === 'new-hof')!.role).toBe(Role.HEAD_OF_FINANCE);
  });

  it('retires the previous Head of Finance and returns them to their school role', async () => {
    await service.appointHeadOfFinance('new-hof', manager.sub, manager.role, manager);

    expect(memberships.find((m) => m.id === 'm-old-group')!.isActive).toBe(false);
    // Their school membership is untouched and their primary role no longer grants group-wide access.
    expect(memberships.find((m) => m.id === 'm-old-school')!.isActive).toBe(true);
    expect(users.find((u) => u.id === 'old-hof')!.role).toBe(Role.FINANCE);
  });

  it('falls back to Finance Officer when the previous holder has no other membership', async () => {
    memberships.splice(1, 1); // drop the old school membership
    await service.appointHeadOfFinance('new-hof', manager.sub, manager.role, manager);

    expect(users.find((u) => u.id === 'old-hof')!.role).toBe(Role.FINANCE);
  });

  it('keeps the single active Head of Finance when the same person is appointed again', async () => {
    await service.appointHeadOfFinance('old-hof', manager.sub, manager.role, manager);

    const active = memberships.filter((m) => m.role === Role.HEAD_OF_FINANCE && m.isActive);
    expect(active).toHaveLength(1);
    expect(users.find((u) => u.id === 'old-hof')!.role).toBe(Role.HEAD_OF_FINANCE);
  });

  it('does not demote a user whose primary role was already changed', async () => {
    users.find((u) => u.id === 'old-hof')!.role = Role.PRINCIPAL;
    await service.appointHeadOfFinance('new-hof', manager.sub, manager.role, manager);

    expect(users.find((u) => u.id === 'old-hof')!.role).toBe(Role.PRINCIPAL);
  });

  it.each(['boss', 'mgr'])('refuses to re-role %s, which would strip their own group access', async (id) => {
    const before = users.find((u) => u.id === id)!.role;

    await expect(service.appointHeadOfFinance(id, manager.sub, manager.role, manager)).rejects.toBeInstanceOf(BadRequestException);
    expect(users.find((u) => u.id === id)!.role).toBe(before);
    expect(memberships.find((m) => m.id === 'm-old-group')!.isActive).toBe(true);
  });
});
