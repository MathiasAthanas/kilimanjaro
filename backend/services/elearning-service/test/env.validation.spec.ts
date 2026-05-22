import { validateEnv } from '../src/config/env.validation';

describe('elearning env validation', () => {
  it('accepts complete production env', () => {
    const env = {
      NODE_ENV: 'production',
      PORT: '3007',
      DATABASE_URL: 'postgresql://localhost/kilimanjaro?schema=elearning',
      INTERNAL_API_KEY: 'secret',
    };
    expect(validateEnv(env)).toBe(env);
  });

  it('rejects missing production dependencies', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', PORT: '3007' })).toThrow(/Missing required production env vars/);
  });

  it('rejects invalid ports', () => {
    expect(() => validateEnv({ PORT: '99999' })).toThrow(/PORT must be a valid TCP port/);
  });
});
