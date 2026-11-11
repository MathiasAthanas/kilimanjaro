import { BadRequestException } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { PREDEFINED_A_LEVEL_COMBINATIONS } from './predefined-combinations';

describe('SubjectsService A-Level combination validation', () => {
  const service = new SubjectsService({} as any, {} as any, {} as any, {} as any);
  const validate = (subjects: any[]) => (service as any).assertALevelCombinationValid(subjects);

  it('rejects combinations with fewer than three principal subjects', () => {
    expect(() => validate([
      { subjectId: 'chemistry', subjectRole: 'PRINCIPAL' },
      { subjectId: 'biology', subjectRole: 'PRINCIPAL' },
      { subjectId: 'general-studies', subjectRole: 'COMPULSORY_SUBSIDIARY' },
    ])).toThrow(BadRequestException);
  });

  it('accepts three principals plus General Studies', () => {
    expect(() => validate([
      { subjectId: 'chemistry', subjectRole: 'PRINCIPAL' },
      { subjectId: 'biology', subjectRole: 'PRINCIPAL' },
      { subjectId: 'geography', subjectRole: 'PRINCIPAL' },
      { subjectId: 'general-studies', subjectRole: 'COMPULSORY_SUBSIDIARY' },
    ])).not.toThrow();
  });

  it('includes HGK with exactly three principal subjects', () => {
    const hgk = PREDEFINED_A_LEVEL_COMBINATIONS.find((combination) => combination.code === 'HGK');
    expect(hgk?.principals.map((subject) => subject.code)).toEqual(['HIST', 'GEO', 'KISW']);
  });
});
