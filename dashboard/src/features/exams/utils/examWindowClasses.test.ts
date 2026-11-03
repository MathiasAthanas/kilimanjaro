import { describe, expect, it } from 'vitest';
import { eligibleExamClasses, includedExamClassIds } from './examWindowClasses';

const classes = [
  { id: '1a', academicYearId: '2026', educationStage: 'PRIMARY', level: 1 },
  { id: '1b', academicYearId: '2026', educationStage: 'PRIMARY', level: 1 },
  { id: '2a', academicYearId: '2026', educationStage: 'PRIMARY', level: 2 },
  { id: 'old', academicYearId: '2025', educationStage: 'PRIMARY', level: 1 },
  { id: 'form1', academicYearId: '2026', educationStage: 'O_LEVEL', level: 1 },
];

describe('exam window class scope', () => {
  it('only offers classes from the window academic year and stage', () => {
    expect(eligibleExamClasses(classes, { academicYearId: '2026', educationStage: 'PRIMARY' }).map((item) => item.id))
      .toEqual(['1a', '1b', '2a']);
  });

  it('resolves explicit, standard and all-class scopes', () => {
    const eligible = eligibleExamClasses(classes, { academicYearId: '2026', educationStage: 'PRIMARY' });
    expect([...includedExamClassIds(eligible, { scopeType: 'STREAMS', scopeClassIds: ['1a'] })]).toEqual(['1a']);
    expect([...includedExamClassIds(eligible, { scopeType: 'STANDARDS', scopeLevels: [1] })]).toEqual(['1a', '1b']);
    expect([...includedExamClassIds(eligible, { scopeType: 'ALL_CLASSES' })]).toEqual(['1a', '1b', '2a']);
  });
});
