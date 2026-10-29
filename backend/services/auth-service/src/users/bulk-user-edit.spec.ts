import { Role } from '../../generated/prisma';
import { UsersService } from './users.service';

const updatedAt = new Date('2026-10-29T08:00:00.000Z');
const baseUser = {
  id: 'user-1',
  email: 'asha@example.test',
  registrationNumber: null,
  passwordHash: 'hash',
  role: Role.TEACHER,
  firstName: 'Asha',
  lastName: 'Teacher',
  department: 'Science',
  phoneNumber: '+255700000001',
  isActive: true,
  isEmailVerified: false,
  mustChangePassword: false,
  temporaryPasswordEncrypted: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  lastLoginIp: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt,
  createdBy: 'admin-1',
  schoolMemberships: [{ schoolId: 'school-1' }],
};

function uploadRow(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    updatedAt: updatedAt.toISOString(),
    schoolIds: 'school-1',
    role: 'TEACHER',
    firstName: 'Asha Updated',
    lastName: 'Teacher',
    email: 'asha@example.test',
    registrationNumber: null,
    phoneNumber: '+255700000001',
    department: 'Science',
    status: 'ACTIVE' as const,
    ...overrides,
  };
}

describe('UsersService bulk edit', () => {
  const actor = { sub: 'admin-1', role: Role.SYSTEM_ADMIN, scope: 'GROUP' as const };
  let prisma: any;
  let service: UsersService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn()
          .mockResolvedValueOnce([baseUser])
          .mockResolvedValueOnce([{ id: baseUser.id, email: baseUser.email, registrationNumber: null }]),
      },
    };
    service = new UsersService(
      prisma,
      { createLog: jest.fn() } as any,
      { publish: jest.fn() } as any,
      { get: jest.fn(() => 'test-encryption-key-with-at-least-32-characters') } as any,
    );
  });

  it('previews a valid identity change without writing data', async () => {
    const preview = await service.previewBulkEdit([uploadRow()], actor);
    expect(preview.canCommit).toBe(true);
    expect(preview.summary).toEqual({ total: 1, changed: 1, unchanged: 0, invalid: 0 });
    expect(preview.rows[0].changes).toContainEqual({ field: 'firstName', before: 'Asha', after: 'Asha Updated' });
  });

  it('rejects immutable role and school membership changes', async () => {
    const preview = await service.previewBulkEdit([uploadRow({ role: 'FINANCE', schoolIds: 'school-2' })], actor);
    expect(preview.canCommit).toBe(false);
    expect(preview.rows[0].errors).toEqual(expect.arrayContaining([
      'Role is read-only and cannot be changed by bulk edit.',
      'School memberships are read-only. Export a fresh file if memberships changed.',
    ]));
  });

  it('blocks a stale exported row', async () => {
    const preview = await service.previewBulkEdit([uploadRow({ updatedAt: '2026-10-28T08:00:00.000Z' })], actor);
    expect(preview.canCommit).toBe(false);
    expect(preview.rows[0].errors).toContain('This account changed after export. Export a fresh file before editing it.');
  });

  it('commits reviewed rows inside one transaction', async () => {
    const preview = {
      summary: { total: 1, changed: 1, unchanged: 0, invalid: 0 },
      canCommit: true,
      rows: [{
        rowNumber: 2,
        userId: 'user-1',
        name: 'Asha Teacher',
        role: Role.TEACHER,
        changes: [{ field: 'firstName', before: 'Asha', after: 'Asha Updated' }],
        errors: [],
        warnings: [],
        values: {
          firstName: 'Asha Updated', lastName: 'Teacher', email: 'asha@example.test',
          registrationNumber: null, phoneNumber: '+255700000001', department: 'Science', isActive: true,
        },
      }],
    };
    jest.spyOn(service, 'previewBulkEdit').mockResolvedValue(preview);
    const tx = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      refreshToken: { updateMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma.$transaction = jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx));

    const result = await service.commitBulkEdit({ rows: [uploadRow()], resetUserIds: [], confirmed: true }, actor);
    expect(result.updated).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-1', updatedAt },
      data: expect.objectContaining({ firstName: 'Asha Updated' }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
