import { validateEnv } from '../src/config/env.validation';

const validProductionEnv = {
  NODE_ENV: 'production',
  PORT: '3002',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/student',
  INTERNAL_API_KEY: 'internal-key',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
};

describe('student-service env validation', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnv(validProductionEnv)).toBe(validProductionEnv);
  });

  it('rejects missing production dependencies', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: '3002' })).toThrow(
      /Missing required production env vars/,
    );
  });

  it('rejects invalid TCP ports', () => {
    expect(() => validateEnv({ ...validProductionEnv, PORT: '0' })).toThrow(
      /PORT must be a valid TCP port/,
    );
  });
});
