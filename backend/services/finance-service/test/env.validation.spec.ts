import { validateEnv } from '../src/config/env.validation';

const validProductionEnv = {
  NODE_ENV: 'production',
  PORT: '3004',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/finance',
  INTERNAL_API_KEY: 'internal-key',
  WEBHOOK_SECRET: 'webhook-secret',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
  STUDENT_SERVICE_URL: 'http://localhost:3002',
  ACADEMIC_SERVICE_URL: 'http://localhost:3003',
};

describe('finance-service env validation', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnv(validProductionEnv)).toBe(validProductionEnv);
  });

  it('rejects missing production dependencies', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: '3004' })).toThrow(
      /Missing required production env vars/,
    );
  });

  it('rejects invalid TCP ports', () => {
    expect(() => validateEnv({ ...validProductionEnv, PORT: 'abc' })).toThrow(
      /PORT must be a valid TCP port/,
    );
  });
});
