import { Role } from '../../generated/prisma';
import { AuthService } from './auth.service';

describe('AuthService school scope', () => {
  const findById = jest.fn();
  const findMany = jest.fn();
  const toSafeUser = jest.fn((user) => user);
  const service = new AuthService(
    { findById, toSafeUser } as any,
    { schoolMembership: { findMany } } as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns SYSTEM_ADMIN as a school-scoped user from its memberships', async () => {
    findById.mockResolvedValue({ id: 'admin-1', role: Role.SYSTEM_ADMIN, isActive: true });
    findMany.mockResolvedValue([{ schoolId: 'school-a', role: Role.SYSTEM_ADMIN }]);

    await expect(service.getUserForGateway('admin-1')).resolves.toEqual({
      id: 'admin-1',
      role: Role.SYSTEM_ADMIN,
      isActive: true,
      scope: 'SCHOOL',
      schoolIds: ['school-a'],
    });
  });

  it('keeps SUPER_ADMIN as the intentional group-wide role', async () => {
    findById.mockResolvedValue({ id: 'super-1', role: Role.SUPER_ADMIN, isActive: true });
    findMany.mockResolvedValue([]);

    await expect(service.getUserForGateway('super-1')).resolves.toMatchObject({
      scope: 'GROUP',
      schoolIds: ['*'],
    });
  });

  it.each([Role.TEACHER, Role.PARENT, Role.HEAD_OF_DEPARTMENT])(
    'keeps the union of active school memberships for a multi-school %s',
    async (role) => {
      findById.mockResolvedValue({ id: 'multi-school-user', role, isActive: true });
      findMany.mockResolvedValue([
        { schoolId: 'school-a', role },
        { schoolId: 'school-b', role },
        { schoolId: 'school-a', role },
      ]);

      await expect(service.getUserForGateway('multi-school-user')).resolves.toMatchObject({
        role,
        scope: 'SCHOOL',
        schoolIds: ['school-a', 'school-b'],
      });
    },
  );

  it('returns live scope details from the current-user endpoint', async () => {
    findById.mockResolvedValue({ id: 'super-1', role: Role.SUPER_ADMIN, isActive: true });
    findMany.mockResolvedValue([]);

    await expect(service.me('super-1')).resolves.toMatchObject({
      id: 'super-1',
      scope: 'GROUP',
      schoolIds: ['*'],
    });
  });
});
