import { Role } from '../../generated/prisma';
import { AuthService } from './auth.service';

describe('AuthService school scope', () => {
  const findById = jest.fn();
  const findMany = jest.fn();
  const service = new AuthService(
    { findById } as any,
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
});
