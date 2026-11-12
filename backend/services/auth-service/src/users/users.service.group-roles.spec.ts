import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Role } from '../../generated/prisma';
import { UsersService } from './users.service';

describe('UsersService group-wide role creation', () => {
  const groupActor = { sub: 'admin-1', role: Role.SYSTEM_ADMIN, scope: 'GROUP' as const, schoolIds: ['*'] };
  const schoolActor = { sub: 'admin-2', role: Role.SYSTEM_ADMIN, scope: 'SCHOOL' as const, schoolIds: ['school-a'] };

  let createdUser: Record<string, unknown>;
  let userCreate: jest.Mock;
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    createdUser = {
      id: 'new-user',
      email: 'new@school.test',
      role: Role.MANAGER,
      firstName: 'New',
      lastName: 'User',
      department: null,
      isActive: true,
      mustChangePassword: true,
      createdAt: new Date('2026-11-12T00:00:00Z'),
    };
    userCreate = jest.fn().mockImplementation(async ({ data }) => ({ ...createdUser, role: data.role }));
    prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      schoolMembership: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (work: (tx: unknown) => unknown) => work({ user: { create: userCreate } })),
    };
    const auditService = { createLog: jest.fn() } as any;
    const rabbitMQService = { publish: jest.fn() } as any;
    const configService = {
      get: jest.fn((key: string) => key === 'TEMP_CREDENTIAL_ENCRYPTION_KEY'
        ? 'test-encryption-key-with-at-least-32-characters'
        : undefined),
    } as any;
    service = new UsersService(prisma, auditService, rabbitMQService, configService);
  });

  const dto = (role: Role) => ({ email: 'new@school.test', role, firstName: 'New', lastName: 'User' });

  it('creates a Manager with a group-wide (no school) membership and no department', async () => {
    await service.createUser(dto(Role.MANAGER), 'admin-1', Role.SYSTEM_ADMIN, groupActor);

    const data = userCreate.mock.calls[0][0].data;
    expect(data.role).toBe(Role.MANAGER);
    expect(data.department).toBeUndefined();
    expect(data.schoolMemberships.create).toEqual({ schoolId: null, role: Role.MANAGER, assignedById: 'admin-1' });
  });

  it('creates the first Head of Finance as a group-wide account', async () => {
    createdUser.role = Role.HEAD_OF_FINANCE;
    await service.createUser(dto(Role.HEAD_OF_FINANCE), 'admin-1', Role.SYSTEM_ADMIN, groupActor);

    expect(prisma.schoolMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { role: Role.HEAD_OF_FINANCE, isActive: true } }),
    );
    expect(userCreate.mock.calls[0][0].data.schoolMemberships.create.schoolId).toBeNull();
  });

  it('refuses a second Head of Finance so the appoint/replace flow stays the only way to change them', async () => {
    prisma.schoolMembership.findFirst.mockResolvedValue({ id: 'existing-membership' });

    await expect(
      service.createUser(dto(Role.HEAD_OF_FINANCE), 'admin-1', Role.SYSTEM_ADMIN, groupActor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('does not look up Head of Finance appointments when creating other roles', async () => {
    await service.createUser(dto(Role.MANAGER), 'admin-1', Role.SYSTEM_ADMIN, groupActor);

    expect(prisma.schoolMembership.findFirst).not.toHaveBeenCalled();
  });

  it.each([Role.MANAGER, Role.HEAD_OF_FINANCE])('rejects %s creation from a school-scoped account', async (role) => {
    await expect(
      service.createUser(dto(role), 'admin-2', Role.SYSTEM_ADMIN, schoolActor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(userCreate).not.toHaveBeenCalled();
  });
});
