import { describe, expect, it } from 'vitest';
import { hodApprovals, hodMarks } from '../api/hodApi';
import { isOutlier, rejectReasonIsValid, sortOldestApprovalsFirst } from './hodReview';

describe('hod review utilities', () => {
  it('sorts pending approvals oldest first', () => {
    expect(sortOldestApprovalsFirst(hodApprovals)[0].id).toBe('hod-appr-chem-3b-midterm');
  });

  it('requires a deliberate rejection reason', () => {
    expect(rejectReasonIsValid('too low')).toBe(false);
    expect(rejectReasonIsValid('Outlier scores require teacher correction.')).toBe(true);
  });

  it('flags score outliers using two standard deviations', () => {
    expect(isOutlier(hodMarks[3], 54, 18)).toBe(true);
    expect(isOutlier(hodMarks[1], 54, 18)).toBe(false);
  });
});
