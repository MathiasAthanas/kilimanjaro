import { Role } from '../../generated/prisma';
import { UsersService } from './users.service';

describe('UsersService temporary credentials', () => {
  const prisma = {} as any;
  const auditService = { createLog: jest.fn() } as any;
  const rabbitMQService = {} as any;
  const configService = {
    get: jest.fn((key: string) => key === 'TEMP_CREDENTIAL_ENCRYPTION_KEY'
      ? 'test-encryption-key-with-at-least-32-characters'
      : undefined),
  } as any;
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma, auditService, rabbitMQService, configService);
  });

  it('encrypts a temporary password without storing plaintext and decrypts it accurately', () => {
    const password = 'Shirima@Kili4821';
    const encrypted = (service as any).encryptTemporaryPassword(password) as string;

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(password);
    expect((service as any).decryptTemporaryPassword(encrypted)).toBe(password);
  });

  it('reveals the credential only while a password change is required', async () => {
    const password = 'Shirima@Kili4821';
    const temporaryPasswordEncrypted = (service as any).encryptTemporaryPassword(password);
    jest.spyOn(service, 'findManageableById').mockResolvedValue({
      id: 'user-1',
      role: Role.TEACHER,
      mustChangePassword: true,
      temporaryPasswordEncrypted,
    } as any);

    await expect(service.getTemporaryPassword('user-1', Role.SYSTEM_ADMIN, {
      sub: 'admin-1', role: Role.SYSTEM_ADMIN, scope: 'GROUP',
    })).resolves.toEqual({ available: true, temporaryPassword: password });
    expect(auditService.createLog).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'admin-1',
      metadata: expect.objectContaining({ action: 'TEMPORARY_PASSWORD_VIEWED' }),
    }));
  });

  it('does not reveal a credential after the user changes it', async () => {
    jest.spyOn(service, 'findManageableById').mockResolvedValue({
      id: 'user-1', role: Role.TEACHER, mustChangePassword: false,
    } as any);

    await expect(service.getTemporaryPassword('user-1')).resolves.toEqual({
      available: false,
      reason: 'PASSWORD_CHANGED',
    });
  });

  it('explains when a legacy temporary password was not recorded', async () => {
    jest.spyOn(service, 'findManageableById').mockResolvedValue({
      id: 'user-1', role: Role.TEACHER, mustChangePassword: true, temporaryPasswordEncrypted: null,
    } as any);

    await expect(service.getTemporaryPassword('user-1')).resolves.toEqual({
      available: false,
      reason: 'NOT_RECORDED',
    });
  });
});
