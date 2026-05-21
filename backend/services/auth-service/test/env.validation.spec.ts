import { validateEnv } from '../src/config/env.validation';

const validProductionEnv = {
  NODE_ENV: 'production',
  PORT: '3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/auth',
  JWT_PRIVATE_KEY: 'private-key',
  JWT_PUBLIC_KEY: 'public-key',
  INTERNAL_API_KEY: 'internal-key',
  REDIS_HOST: 'localhost',
  REDIS_PORT: '6379',
  RABBITMQ_URL: 'amqp://localhost:5672',
};

describe('auth-service env validation', () => {
  it('accepts a complete production environment', () => {
    expect(validateEnv(validProductionEnv)).toBe(validProductionEnv);
  });

  it('rejects missing production secrets', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: '3001' })).toThrow(
      /Missing required production env vars/,
    );
  });

  it('rejects invalid TCP ports', () => {
    expect(() => validateEnv({ ...validProductionEnv, PORT: '70000' })).toThrow(
      /PORT must be a valid TCP port/,
    );
  });
});
