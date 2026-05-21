import { describe, expect, it } from 'vitest';
import { assessmentWeightsAreValid, gradeBoundariesAreValid, handlebarsIsValid, roleRisk, typedConfirmationIsValid } from './adminValidation';

describe('admin validation helpers', () => {
  it('validates handlebars templates', () => {
    expect(handlebarsIsValid('Hello {{student.name}}')).toBe(true);
    expect(handlebarsIsValid('Hello {{student-name}}')).toBe(false);
    expect(handlebarsIsValid('Hello {{student.name}')).toBe(false);
  });

  it('validates grading boundaries without gaps or overlaps', () => {
    expect(gradeBoundariesAreValid([{ min: 0, max: 49, label: 'F' }, { min: 50, max: 100, label: 'A' }])).toBe(true);
    expect(gradeBoundariesAreValid([{ min: 0, max: 40, label: 'F' }, { min: 50, max: 100, label: 'A' }])).toBe(false);
  });

  it('requires assessment weights to total 100', () => {
    expect(assessmentWeightsAreValid([20, 30, 50])).toBe(true);
    expect(assessmentWeightsAreValid([20, 30, 40])).toBe(false);
  });

  it('checks typed confirmations and privileged role risk', () => {
    expect(typedConfirmationIsValid('RESET', 'RESET')).toBe(true);
    expect(roleRisk('ADMIN')).toBe('high');
  });
});
