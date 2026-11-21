import { selectApplicableStructures } from './fee-matching';

const context = {
  schoolId: 'school-a', classId: 'class-1', educationStage: 'PRIMARY', classLevel: 1,
  studentGroupCodes: [], residenceType: 'BOARDING' as const, academicYearId: 'year-1', termId: 'term-1',
};

const base = {
  schoolId: 'school-a', feeCategoryId: 'tuition', classId: null, educationStage: null,
  classLevel: null, studentGroup: null, residenceType: null, academicYearId: 'year-1',
  termId: 'term-1', isActive: true, feeCategory: { isOptional: false },
};

describe('residence-aware fee matching', () => {
  it('selects the exact class and residence rule over broader rules', () => {
    const selected = selectApplicableStructures([
      { ...base, id: 'broad' },
      { ...base, id: 'residence', residenceType: 'BOARDING' as const },
      { ...base, id: 'exact', classId: 'class-1', residenceType: 'BOARDING' as const },
      { ...base, id: 'day', classId: 'class-1', residenceType: 'DAY_SCHOLAR' as const },
    ], context, new Set());
    expect(selected.map((row) => row.id)).toEqual(['exact']);
  });

  it('does not add optional fees without an explicit assignment', () => {
    const optional = { ...base, id: 'boarding-fee', feeCategoryId: 'boarding', residenceType: 'BOARDING' as const, feeCategory: { isOptional: true } };
    expect(selectApplicableStructures([optional], context, new Set())).toEqual([]);
    expect(selectApplicableStructures([optional], context, new Set(['boarding']))).toHaveLength(1);
  });

  it('matches every populated dimension conjunctively', () => {
    const wrongClass = { ...base, id: 'wrong', classId: 'class-2', residenceType: 'BOARDING' as const };
    expect(selectApplicableStructures([wrongClass], context, new Set())).toEqual([]);
  });
});
