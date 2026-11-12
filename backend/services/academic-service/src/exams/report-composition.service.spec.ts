import { BadRequestException } from '@nestjs/common';
import { indexStudentCombinations } from './report-composition.service';

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
