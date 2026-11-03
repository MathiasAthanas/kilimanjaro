import { describe, expect, it } from 'vitest';
import { loginErrorMessage, normalizeApiError } from './errors';

describe('normalizeApiError', () => {
  it('normalizes generic errors', () => {
    expect(normalizeApiError(new Error('Failed')).message).toBe('Failed');
  });

  it('preserves an error that was already normalized by the API interceptor', () => {
    expect(normalizeApiError({ status: 401, message: 'Invalid credentials' })).toMatchObject({
      status: 401,
      message: 'Invalid credentials',
    });
  });

  it('turns login statuses into clear instructions', () => {
    expect(loginErrorMessage({ status: 401, message: 'Invalid credentials' }))
      .toBe('The username or password is incorrect. Check your details and try again.');
    expect(loginErrorMessage({ status: 423, message: 'Account locked' }))
      .toContain('temporarily locked');
    expect(loginErrorMessage({ status: 429, message: 'Too many requests' }))
      .toBe('Sign-in is temporarily busy. Wait a moment and try again.');
    expect(loginErrorMessage({ status: 503, message: 'Unavailable' }))
      .toContain('temporarily unavailable');
  });

  it('explains network failures without exposing transport noise', () => {
    expect(loginErrorMessage({ status: 0, message: 'Network Error' }))
      .toContain('Check your internet connection');
  });
});
