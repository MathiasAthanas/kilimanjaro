import { BadRequestException } from '@nestjs/common';
import { SubjectsService } from './subjects.service';

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
});
