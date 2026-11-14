import { describe, expect, it } from 'vitest';
import { baseClassLabel, groupClassesByLevel, priceTarget, structuresFor } from './classLevels';

const P = 'school-p';
const cls = (id: string, name: string, level: number, stream: string, stage = 'PRIMARY', schoolId = P) => ({ id, name, level, stream, educationStage: stage, schoolId });

describe('baseClassLabel', () => {
  it('drops the stream so Class 1 A and Class 1 B are both Class 1', () => {
    expect(baseClassLabel('Class 1 A', 'A')).toBe('Class 1');
    expect(baseClassLabel('Class 1 B', 'B')).toBe('Class 1');
    expect(baseClassLabel('Class 1A', 'A')).toBe('Class 1');
    expect(baseClassLabel('Form 5 CBA', 'CBA')).toBe('Form 5');
    expect(baseClassLabel('Form 1', 'A')).toBe('Form 1');
    expect(baseClassLabel('Form 5', 'PCM')).toBe('Form 5');
    expect(baseClassLabel('Standard 3', '')).toBe('Standard 3');
  });
});

describe('groupClassesByLevel', () => {
  const classes = [
    cls('c1a', 'Class 1 A', 1, 'A'), cls('c1b', 'Class 1 B', 1, 'B'), cls('c2a', 'Class 2 A', 2, 'A'),
    cls('f1a', 'Form 1', 1, 'A', 'O_LEVEL', 'school-s'), cls('f1b', 'Form 1', 1, 'B', 'O_LEVEL', 'school-s'),
  ];

  it('puts every stream of a level in one group, in level order', () => {
    const groups = groupClassesByLevel(classes);
    expect(groups.map((g) => g.label)).toEqual(['Class 1', 'Form 1', 'Class 2']);
    expect(groups[0]).toMatchObject({ classIds: ['c1a', 'c1b'], streams: ['A', 'B'], level: 1, ambiguous: false });
  });

  it('keeps the same level of different schools apart', () => {
    const groups = groupClassesByLevel([cls('a', 'Form 1', 1, 'A', 'O_LEVEL', 'school-x'), cls('b', 'Form 1', 1, 'A', 'O_LEVEL', 'school-y')]);
    expect(groups).toHaveLength(2);
  });

  it('flags look-alike classes that a stage + level price would both hit', () => {
    const groups = groupClassesByLevel([cls('n', 'Nursery', 0, 'A'), cls('p', 'Pre-Unit', 0, 'A')]);
    expect(groups.every((g) => g.ambiguous)).toBe(true);
  });
});

describe('priceTarget', () => {
  const [group] = groupClassesByLevel([cls('c1a', 'Class 1 A', 1, 'A'), cls('c1b', 'Class 1 B', 1, 'B')]);

  it('is one stage + level price once a school is chosen', () => {
    expect(priceTarget(group, P)).toEqual({ mode: 'level', educationStage: 'PRIMARY', classLevel: 1 });
  });

  it('falls back to every class of the group when no school is chosen or the school differs', () => {
    expect(priceTarget(group, null)).toEqual({ mode: 'classes', classIds: ['c1a', 'c1b'] });
    expect(priceTarget(group, 'other')).toEqual({ mode: 'classes', classIds: ['c1a', 'c1b'] });
  });

  it('never uses a stage + level price for look-alike classes', () => {
    const [n] = groupClassesByLevel([cls('n', 'Nursery', 0, 'A'), cls('p', 'Pre-Unit', 0, 'A')]);
    expect(priceTarget(n, P).mode).toBe('classes');
  });
});

describe('structuresFor', () => {
  const [group] = groupClassesByLevel([cls('c1a', 'Class 1 A', 1, 'A'), cls('c1b', 'Class 1 B', 1, 'B')]);
  const structures = [
    { id: 'lvl', category: 'Tuition', classId: null, educationStage: 'PRIMARY', rawClassLevel: 1, schoolId: P, termId: null, active: true },
    { id: 'a', category: 'Tuition', classId: 'c1a', educationStage: 'PRIMARY', rawClassLevel: 1, schoolId: P, termId: null, active: true },
    { id: 'other', category: 'Tuition', classId: 'zzz', termId: null, active: true },
    { id: 'term1', category: 'Tuition', classId: 'c1b', termId: 't1', active: true },
    { id: 'off', category: 'Tuition', classId: 'c1b', termId: null, active: false },
    { id: 'meals', category: 'Meals', classId: 'c1b', termId: null, active: true },
    { id: 'stageOnly', category: 'Tuition', classId: null, educationStage: 'PRIMARY', rawClassLevel: null, schoolId: P, termId: null, active: true },
  ];

  it('finds the level price and any stream-specific one for the whole group', () => {
    expect(structuresFor(structures, 'Tuition', group, '').map((s) => s.id).sort()).toEqual(['a', 'lvl']);
  });

  it('keeps terms apart, ignores switched-off prices and other fees', () => {
    expect(structuresFor(structures, 'Tuition', group, 't1').map((s) => s.id)).toEqual(['term1']);
    expect(structuresFor(structures, 'Meals', group, '').map((s) => s.id)).toEqual(['meals']);
  });

  it('does not mistake a whole-stage price for a level price', () => {
    expect(structuresFor(structures, 'Tuition', group, '').some((s) => s.id === 'stageOnly')).toBe(false);
  });
});
