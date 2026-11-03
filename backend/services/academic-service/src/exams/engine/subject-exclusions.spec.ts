import { matchExclusion } from './subject-exclusions';

const row = (id: string, subjectId: string, classId: string | null, examWindowId: string | null) => ({ id, subjectId, classId, examWindowId });

describe('matchExclusion', () => {
  const rows = [
    row('w-all', 'math', null, 'win1'),
    row('w-class', 'art', 'c1', 'win1'),
    row('s-all', 'music', null, null),
    row('s-class', 'pe', 'c2', null),
  ];

  it('a window rule without a class covers every class', () => {
    expect(matchExclusion(rows, 'math', 'c1', { windowOpened: true })?.source).toBe('WINDOW');
    expect(matchExclusion(rows, 'math', 'c9', { windowOpened: true })?.source).toBe('WINDOW');
  });

  it('a window rule with a class covers only that class', () => {
    expect(matchExclusion(rows, 'art', 'c1', { windowOpened: true })).not.toBeNull();
    expect(matchExclusion(rows, 'art', 'c2', { windowOpened: true })).toBeNull();
  });

  it('standing rules seed a window that has not been opened', () => {
    expect(matchExclusion(rows, 'music', 'c1', { windowOpened: false })?.source).toBe('STANDING');
    expect(matchExclusion(rows, 'pe', 'c2', { windowOpened: false })?.source).toBe('STANDING');
    expect(matchExclusion(rows, 'pe', 'c1', { windowOpened: false })).toBeNull();
  });

  it('standing rules never change a window that is already running', () => {
    expect(matchExclusion(rows, 'music', 'c1', { windowOpened: true })).toBeNull();
  });

  it('a subject nobody omitted is never matched', () => {
    expect(matchExclusion(rows, 'english', 'c1', { windowOpened: false })).toBeNull();
  });
});
