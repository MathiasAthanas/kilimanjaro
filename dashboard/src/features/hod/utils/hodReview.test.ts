import { describe, expect, it } from 'vitest';
import type { HodApproval, HodMarkRow } from '../types/hod.types';
import { isOutlier, rejectReasonIsValid, sortOldestApprovalsFirst } from './hodReview';

const approval = (id: string, submittedHoursAgo: number) => ({ id, submittedHoursAgo }) as HodApproval;
const mark = (score: number | null, absent = false): HodMarkRow => ({
  student: 'Test student', registration: 'TEST', score, maxScore: 100, absent, note: '',
});

describe('hod review utilities', () => {
  it('sorts pending approvals oldest first', () => {
    const rows = [approval('newer', 2), approval('oldest', 48), approval('middle', 12)];
    expect(sortOldestApprovalsFirst(rows).map((row) => row.id)).toEqual(['oldest', 'middle', 'newer']);
  });

  it('requires a deliberate rejection reason', () => {
    expect(rejectReasonIsValid('too low')).toBe(false);
    expect(rejectReasonIsValid('Outlier scores require teacher correction.')).toBe(true);
  });

  it('flags score outliers using two standard deviations', () => {
    expect(isOutlier(mark(95), 54, 18)).toBe(true);
    expect(isOutlier(mark(55), 54, 18)).toBe(false);
    expect(isOutlier(mark(null, true), 54, 18)).toBe(false);
  });
});
