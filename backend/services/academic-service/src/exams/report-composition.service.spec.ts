import { BadRequestException } from '@nestjs/common';
import { indexStudentCombinations, shouldComposeRow } from './report-composition.service';

describe('report-card composition A-Level combinations', () => {
  it('deduplicates subject-enrolment rows into one student combination', () => {
    const result = indexStudentCombinations([
      { studentId: 'student-1', classId: 'class-1', combinationId: 'HGE' },
      { studentId: 'student-1', classId: 'class-1', combinationId: 'HGE' },
      { studentId: 'student-1', classId: 'class-1', combinationId: 'HGE' },
    ]);

    expect(result.get('student-1:class-1')).toBe('HGE');
  });

  it('blocks ambiguous active combinations instead of calculating the wrong division', () => {
    expect(() => indexStudentCombinations([
      { studentId: 'student-1', classId: 'class-1', combinationId: 'HGE' },
      { studentId: 'student-1', classId: 'class-1', combinationId: 'HGL' },
    ])).toThrow(BadRequestException);
  });
});

describe('report-card composition of reference-only subjects', () => {
  it('keeps a reference subject the student sat so it appears on the card', () => {
    expect(shouldComposeRow(false, 'SCORED')).toBe(true);
  });

  it.each(['NOT_SAT', 'ABSENT', 'EXEMPT', 'MISSING'] as const)(
    'leaves a reference subject off the card when its status is %s',
    (status) => {
      expect(shouldComposeRow(false, status)).toBe(false);
    },
  );

  it.each(['SCORED', 'NOT_SAT', 'ABSENT', 'EXEMPT', 'MISSING'] as const)(
    'always keeps a subject that counts toward the aggregate (%s)',
    (status) => {
      expect(shouldComposeRow(true, status)).toBe(true);
    },
  );
});

