import { describe, expect, it } from 'vitest';
import { loginSchema, resetPasswordSchema } from './schemas';

describe('auth schemas', () => {
  it('requires login credentials', () => {
    expect(loginSchema.safeParse({ username: '', password: '', remember: false }).success).toBe(false);
  });

  it('validates matching reset passwords', () => {
    expect(resetPasswordSchema.safeParse({ email: 'a@b.com', token: '1234', password: 'password1', confirmPassword: 'password2' }).success).toBe(false);
  });
});
