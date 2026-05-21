import { validateEnv } from '../src/config/env.validation';

const validProductionEnv = {
  NODE_ENV: 'production',
  PORT: '3000',
  JWT_PUBLIC_KEY: 'public-key',
  INTERNAL_API_KEY: 'internal-key',
  AUTH_SERVICE_URL: 'http://localhost:3001',
  STUDENT_SERVICE_URL: 'http://localhost:3002',
  ACADEMIC_SERVICE_URL: 'http://localhost:3003',
  FINANCE_SERVICE_URL: 'http://localhost:3004',
  NOTIFICATION_SERVICE_URL: 'http://localhost:3005',
  ANALYTICS_SERVICE_URL: 'http://localhost:3006',
};

describe('api-gateway env validation', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnv(validProductionEnv)).toBe(validProductionEnv);
  });

  it('rejects missing production dependencies', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: '3000' })).toThrow(
      /Missing required production env vars/,
    );
  });

  it('rejects invalid TCP ports', () => {
    expect(() => validateEnv({ ...validProductionEnv, PORT: '65537' })).toThrow(
      /PORT must be a valid TCP port/,
    );
  });
});
