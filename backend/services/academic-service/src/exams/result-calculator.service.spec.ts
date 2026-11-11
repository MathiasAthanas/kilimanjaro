import { BadRequestException } from '@nestjs/common';
import { ResultCalculatorService } from './result-calculator.service';

describe('ResultCalculatorService A-Level readiness', () => {
  const service = new ResultCalculatorService({} as any, {} as any, {} as any);

  it('blocks calculation when an A-Level student has no combination', () => {
    const ctx = {
      window: {},
      classIds: ['class-1'],
      rows: [],
      missing: [],
      scaleIssues: [],
      combinationIssues: [{
        studentId: 'student-1',
        studentName: 'Asha Mollel',
        registrationNumber: 'KS-A-001',
        classId: 'class-1',
        className: 'Form 5 CBG',
      }],
      warnings: [],
    };

    expect(() => service.assertCalculable(ctx)).toThrow(BadRequestException);
    try {
      service.assertCalculable(ctx);
    } catch (error) {
      const response = (error as BadRequestException).getResponse() as any;
      expect(response.code).toBe('A_LEVEL_COMBINATION_MISSING');
      expect(response.message).toContain('Asha Mollel (KS-A-001)');
    }
  });
});
