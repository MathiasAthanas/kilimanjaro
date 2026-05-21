import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { UiApiService } from './ui-api.service';

describe('UiApiService', () => {
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        AUTH_SERVICE_URL: 'http://auth',
        STUDENT_SERVICE_URL: 'http://student',
        ACADEMIC_SERVICE_URL: 'http://academic',
        FINANCE_SERVICE_URL: 'http://finance',
        NOTIFICATION_SERVICE_URL: 'http://notification',
        ANALYTICS_SERVICE_URL: 'http://analytics',
        INTERNAL_API_KEY: 'internal-key',
        PROXY_TIMEOUT_MS: '5000',
      };
      return values[key] ?? fallback;
    }),
  } as unknown as ConfigService;

  function serviceWithResponse(response: unknown, status = 200) {
    const http = {
      request: jest.fn(() => of({ status, data: response })),
    };
    return { service: new UiApiService(http as any, config), http };
  }

  it('unwraps standard downstream envelopes and applies api versioning', async () => {
    const { service, http } = serviceWithResponse({ success: true, data: { ok: true } });

    await expect(
      service.get('academic', '/academics/assessments', { id: 'u1', role: 'TEACHER', email: 't@ks.ac.tz' }),
    ).resolves.toEqual({ ok: true });

    expect(http.request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://academic/api/v1/academics/assessments',
        headers: expect.objectContaining({
          'X-Internal-Api-Key': 'internal-key',
          'X-Internal-Request': 'true',
          'X-User-Id': 'u1',
          'X-User-Role': 'TEACHER',
          'X-User-Email': 't@ks.ac.tz',
        }),
      }),
    );
  });

  it('does not add api versioning to student service routes', async () => {
    const { service, http } = serviceWithResponse({ success: true, data: [] });

    await service.get('student', '/students');

    expect(http.request).toHaveBeenCalledWith(expect.objectContaining({ url: 'http://student/students' }));
  });

  it('returns fallback warnings for optional failed slices', async () => {
    const http = {
      request: jest.fn(() => throwError(() => new Error('downstream offline'))),
    };
    const service = new UiApiService(http as any, config);

    const result = await service.tryGet({ service: 'finance', path: '/finance/invoices' }, []);

    expect(result.data).toEqual([]);
    expect(result.warning).toContain('finance/finance/invoices');
    expect(result.warning).toContain('finance service temporarily unavailable');
  });

  it('throws downstream errors for required get calls', async () => {
    const { service } = serviceWithResponse({ message: 'not allowed' }, 403);

    await expect(service.get('auth', '/auth/users')).rejects.toBeInstanceOf(HttpException);
  });

  it('builds partial envelopes when warnings are present', () => {
    const { service } = serviceWithResponse({ success: true, data: [] });

    expect(service.envelope({ ok: true }, ['one issue'])).toMatchObject({
      data: { ok: true },
      meta: { partial: true, warnings: ['one issue'], source: 'gateway-ui' },
    });
  });
});
