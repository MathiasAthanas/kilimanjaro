import { ConfigService } from '@nestjs/config';
import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ProxyService } from '../src/proxy/proxy.service';

function createService(httpService = { request: jest.fn() }, configValues: Record<string, string> = {}) {
  const configService = {
    get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback),
  };
  return {
    service: new ProxyService(httpService as any, configService as unknown as ConfigService),
    httpService,
    configService,
  };
}

describe('gateway proxy service', () => {
  it('resolves API-prefixed student routes to the unversioned student service path', () => {
    const { service } = createService();

    expect(service.resolveRoute('/api/v1/students/profile')).toMatchObject({
      serviceName: 'student',
      serviceUrl: 'http://localhost:3002',
      outboundPath: '/students/profile',
    });
  });

  it('normalizes singular student and notification routes', () => {
    const { service } = createService();

    expect(service.resolveRoute('/student/me').outboundPath).toBe('/students/me');
    expect(service.resolveRoute('/notification/inbox')).toMatchObject({
      serviceName: 'notification',
      outboundPath: '/api/v1/notifications/inbox',
    });
  });

  it('rejects unknown route prefixes', () => {
    const { service } = createService();

    expect(() => service.resolveRoute('/unknown')).toThrow(HttpException);
  });

  it('forwards protected requests with trusted internal identity headers only', async () => {
    const httpService = { request: jest.fn(() => of({ status: 202, data: { ok: true } })) };
    const { service } = createService(httpService, {
      INTERNAL_API_KEY: 'internal-secret',
      PROXY_TIMEOUT_MS: '5000',
    });
    const req = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-user-id': 'attacker',
      },
      query: { page: '1' },
      body: { message: 'hello' },
    };

    const result = await service.forward(
      req as any,
      {
        serviceName: 'student',
        serviceUrl: 'http://student.internal',
        incomingPath: '/students/messages',
        outboundPath: '/students/messages',
      },
      { id: 'user-1', role: 'STUDENT', email: 'student@example.com' },
    );

    expect(result).toEqual({ statusCode: 202, data: { ok: true } });
    expect(httpService.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        url: 'http://student.internal/students/messages',
        params: { page: '1' },
        data: { message: 'hello' },
        timeout: 5000,
        headers: expect.objectContaining({
          'X-Internal-Api-Key': 'internal-secret',
          'X-Internal-Request': 'true',
          'X-User-Id': 'user-1',
          'X-User-Role': 'STUDENT',
          'X-User-Email': 'student@example.com',
        }),
      }),
    );
  });

  it('does not forward a body for GET requests', async () => {
    const httpService = { request: jest.fn(() => of({ status: 200, data: [] })) };
    const { service } = createService(httpService);

    await service.forward(
      { method: 'GET', headers: {}, query: {}, body: { ignored: true } } as any,
      {
        serviceName: 'finance',
        serviceUrl: 'http://finance.internal',
        incomingPath: '/finance/invoices',
        outboundPath: '/api/v1/finance/invoices',
      },
    );

    expect(httpService.request).toHaveBeenCalledWith(expect.objectContaining({ data: undefined }));
  });

  it('maps downstream network errors to service unavailable', async () => {
    const httpService = { request: jest.fn(() => throwError(() => new Error('down'))) };
    const { service } = createService(httpService);

    await expect(
      service.forward(
        { method: 'GET', headers: {}, query: {}, body: undefined } as any,
        {
          serviceName: 'analytics',
          serviceUrl: 'http://analytics.internal',
          incomingPath: '/analytics',
          outboundPath: '/api/v1/analytics',
        },
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
