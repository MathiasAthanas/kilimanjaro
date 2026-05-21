import { describe, expect, it } from 'vitest';
import { normalizeRole } from './api';

describe('auth api role normalization', () => {
  it('maps backend role names to web dashboard roles', () => {
    expect(normalizeRole('HEAD_OF_DEPARTMENT')).toBe('HOD');
    expect(normalizeRole('ACADEMIC_QA')).toBe('AQA');
    expect(normalizeRole('SYSTEM_ADMIN')).toBe('ADMIN');
  });

  it('keeps existing web role names unchanged', () => {
    expect(normalizeRole('TEACHER')).toBe('TEACHER');
    expect(normalizeRole('FINANCE')).toBe('FINANCE');
    expect(normalizeRole('PRINCIPAL')).toBe('PRINCIPAL');
  });
});

