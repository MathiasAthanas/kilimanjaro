import { describe, expect, it } from 'vitest';
import { exportReasonIsValid, markIsValid, parseMarksPaste, reportBuilderIsValid, timetableHasConflict } from './operationsValidation';

describe('operations validation helpers', () => {
  it('validates mark ranges', () => {
    expect(markIsValid(78, 100)).toBe(true);
    expect(markIsValid(101, 100)).toBe(false);
    expect(markIsValid(null, 100, true)).toBe(true);
  });

  it('parses spreadsheet paste input', () => {
    expect(parseMarksPaste('Amina\t80\nJabir\t44')).toEqual([['Amina', '80'], ['Jabir', '44']]);
  });

  it('requires reasons for sensitive exports', () => {
    expect(exportReasonIsValid('Board packet')).toBe(true);
    expect(exportReasonIsValid('short')).toBe(false);
  });

  it('detects timetable conflicts', () => {
    expect(timetableHasConflict([
      { teacher: 'Amina', className: 'Form 3B', day: 'Mon', start: '08:00', end: '09:00' },
      { teacher: 'Amina', className: 'Form 4A', day: 'Mon', start: '08:30', end: '09:30' },
    ])).toBe(true);
  });

  it('validates report builder minimum fields', () => {
    expect(reportBuilderIsValid({ domain: 'academic', type: 'overview', scope: 'school', format: 'PDF' })).toBe(true);
  });
});
