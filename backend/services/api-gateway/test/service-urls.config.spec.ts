import { ConfigService } from '@nestjs/config';
import { getServiceUrls } from '../src/common/config/service-urls.config';

describe('service URL config', () => {
  it('uses stable local defaults for all downstream services', () => {
    const urls = getServiceUrls({ get: jest.fn() } as unknown as ConfigService);

    expect(urls).toEqual({
      auth: 'http://localhost:3001',
      student: 'http://localhost:3002',
      academic: 'http://localhost:3003',
      finance: 'http://localhost:3004',
      notification: 'http://localhost:3005',
      analytics: 'http://localhost:3006',
      elearning: 'http://localhost:3007',
    });
  });

  it('allows production URLs to override defaults', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'AUTH_SERVICE_URL' ? 'https://auth.internal' : undefined)),
    };

    expect(getServiceUrls(config as unknown as ConfigService).auth).toBe('https://auth.internal');
  });
});
