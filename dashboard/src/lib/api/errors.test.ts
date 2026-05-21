import { describe, expect, it } from 'vitest';
import { normalizeApiError } from './errors';

describe('normalizeApiError', () => {
  it('normalizes generic errors', () => {
    expect(normalizeApiError(new Error('Failed')).message).toBe('Failed');
  });
});
