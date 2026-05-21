import { describe, expect, it } from 'vitest';
import { canSubmitMarks, validateScore, validateSyllabusProgress } from './marks';

describe('teacher marks utilities', () => {
  it('rejects scores above the assessment maximum', () => {
    expect(validateScore(101, 100, false)).toMatchObject({ valid: false, message: 'Cannot exceed 100' });
  });

  it('allows absent rows without a score', () => {
    expect(validateScore('', 100, true)).toMatchObject({ valid: true, message: 'Absent' });
  });

  it('blocks submit while rows are dirty or invalid', () => {
    expect(canSubmitMarks([{ score: 80, absent: false, state: 'dirty' }], 100)).toBe(false);
    expect(canSubmitMarks([{ score: 120, absent: false, state: 'saved' }], 100)).toBe(false);
    expect(canSubmitMarks([{ score: 80, absent: false, state: 'saved' }], 100)).toBe(true);
  });

  it('rejects syllabus progress above total topics', () => {
    expect(validateSyllabusProgress(11, 10)).toBe(false);
    expect(validateSyllabusProgress(8, 10)).toBe(true);
  });
});
