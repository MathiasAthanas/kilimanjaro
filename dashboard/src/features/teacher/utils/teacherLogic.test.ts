import { describe, expect, it, vi } from 'vitest';

vi.mock('framer-motion', () => ({ motion: new Proxy({}, { get: () => () => null }), AnimatePresence: () => null }));

import { marksProgress } from '../components/TeacherWorkspaceShell';
import { assessmentMarksPath, clockMinutes } from '../api/teacher.hooks';
import type { MarkRow } from '../types/teacher.types';

const row = (id: string, exempt = false): MarkRow => ({
  id, roll: '1', name: id, registration: id, average: 0, attendance: 0, alert: 'None', lastAssessment: '',
  score: '', absent: false, notSat: false, exempt, saved: false, note: '', state: 'saved',
});

describe('marksProgress', () => {
  const rows = [row('a'), row('b'), row('c'), row('d'), row('e', true)];

  it('counts blanks, invalid scores and exempt students separately', () => {
    const p = marksProgress(rows, {
      a: { status: 'SCORED', score: '55' },
      b: { status: 'SCORED', score: '' },
      c: { status: 'SCORED', score: '140' },
      d: { status: 'ABSENT', score: '' },
    }, 100);
    expect(p).toEqual({ complete: 2, blank: 1, invalid: 1, exempt: 1, required: 4 });
  });

  it('treats Absent and Not sat as complete results (they count as 0)', () => {
    const p = marksProgress([row('a'), row('b')], { a: { status: 'ABSENT', score: '' }, b: { status: 'NOT_SAT', score: '' } }, 50);
    expect(p.complete).toBe(2);
    expect(p.blank).toBe(0);
  });

  it('never asks for a mark from an exempt student', () => {
    expect(marksProgress([row('x', true)], {}, 100)).toMatchObject({ required: 0, blank: 0, exempt: 1 });
  });

  it('rejects negative and non-numeric scores', () => {
    const p = marksProgress([row('a'), row('b')], { a: { status: 'SCORED', score: '-1' }, b: { status: 'SCORED', score: 'abc' } }, 100);
    expect(p.invalid).toBe(2);
  });
});

describe('clockMinutes', () => {
  it('reads school timetable times with or without a leading zero', () => {
    expect(clockMinutes('8:00')).toBe(480);
    expect(clockMinutes('08:30')).toBe(510);
    expect(clockMinutes('1:15 PM')).toBe(13 * 60 + 15);
    expect(clockMinutes('12:00 AM')).toBe(0);
  });

  it('returns null for anything else', () => {
    expect(clockMinutes('after lunch')).toBeNull();
  });
});

describe('assessmentMarksPath', () => {
  it('sends exam-window assessments to the exam marks screen and CATs to the classic one', () => {
    expect(assessmentMarksPath({ id: 'a1', examWindow: { id: 'w1' } })).toBe('/teacher/exams/marks/a1');
    expect(assessmentMarksPath({ id: 'a2', examWindow: null })).toBe('/teacher/assessments/a2/marks');
  });
});
