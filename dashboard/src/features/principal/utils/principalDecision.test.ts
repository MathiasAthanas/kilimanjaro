import { describe, expect, it } from 'vitest';
import { assessmentWeightsAreValid, canApprovePayment, canLockMarks, canPublishResults, selectedClassLabel } from './principalDecision';

describe('principal decision safety', () => {
  it('requires both acknowledgments before final marks lock', () => {
    expect(canLockMarks(true, false)).toBe(false);
    expect(canLockMarks(true, true)).toBe(true);
  });

  it('requires selected classes and acknowledgments before publishing results', () => {
    expect(canPublishResults(true, true, 0)).toBe(false);
    expect(canPublishResults(true, true, 2)).toBe(true);
  });

  it('requires confirmation and a meaningful reason before payment approval', () => {
    expect(canApprovePayment(true, 'ok')).toBe(false);
    expect(canApprovePayment(true, 'Bank evidence verified')).toBe(true);
  });

  it('validates assessment weights at exactly 100 percent', () => {
    expect(assessmentWeightsAreValid([40, 30, 30])).toBe(true);
    expect(assessmentWeightsAreValid([50, 30, 30])).toBe(false);
  });

  it('labels selected classes correctly', () => {
    expect(selectedClassLabel(1)).toBe('1 class selected');
    expect(selectedClassLabel(3)).toBe('3 classes selected');
  });
});
