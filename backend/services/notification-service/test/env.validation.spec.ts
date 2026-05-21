import { validateEnv } from '../src/config/env.validation';

const validProductionEnv = {
  NODE_ENV: 'production',
  PORT: '3005',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/notification',
  INTERNAL_API_KEY: 'internal-key',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
  AUTH_SERVICE_URL: 'http://localhost:3001',
  STUDENT_SERVICE_URL: 'http://localhost:3002',
};

describe('notification-service env validation', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnv(validProductionEnv)).toBe(validProductionEnv);
  });

  it('rejects missing production dependencies', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: '3005' })).toThrow(
      /Missing required production env vars/,
    );
  });

  it('rejects invalid TCP ports', () => {
    expect(() => validateEnv({ ...validProductionEnv, PORT: '65536' })).toThrow(
      /PORT must be a valid TCP port/,
    );
  });
});
