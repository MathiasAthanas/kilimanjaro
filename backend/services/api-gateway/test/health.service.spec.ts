import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { HealthService } from '../src/health/health.service';

describe('gateway health service', () => {
  it('checks every downstream health endpoint with the correct paths', async () => {
    const httpService = {
      get: jest.fn(() => of({ status: 200 })),
    };
    const service = new HealthService({ get: jest.fn() } as unknown as ConfigService, httpService as any);

    const payload = await service.getStatus();

    expect(payload.services).toEqual({
      auth: 'reachable',
      students: 'reachable',
      academics: 'reachable',
      finance: 'reachable',
      notifications: 'reachable',
      analytics: 'reachable',
    });
    const calledUrls = (httpService.get as jest.Mock).mock.calls.map((call: unknown[]) => call[0]);
    expect(calledUrls).toEqual([
      'http://localhost:3001/api/v1/auth/health',
      'http://localhost:3002/students/health',
      'http://localhost:3003/api/v1/academics/health',
      'http://localhost:3004/api/v1/finance/health',
      'http://localhost:3005/api/v1/notifications/health',
      'http://localhost:3006/api/v1/analytics/health',
    ]);
  });

  it('reports an unreachable service without failing the gateway health response', async () => {
    const httpService = {
      get: jest
        .fn()
        .mockReturnValueOnce(of({ status: 200 }))
        .mockReturnValueOnce(throwError(() => new Error('student down')))
        .mockReturnValue(of({ status: 200 })),
    };
    const service = new HealthService({ get: jest.fn() } as unknown as ConfigService, httpService as any);

    const payload = await service.getStatus();

    expect(payload.status).toBe('ok');
    expect(payload.services.students).toBe('unreachable');
    expect(payload.services.auth).toBe('reachable');
  });
});
