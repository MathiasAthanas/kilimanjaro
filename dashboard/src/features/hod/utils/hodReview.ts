import type { HodApproval, HodMarkRow } from '../types/hod.types';

export function sortOldestApprovalsFirst(approvals: HodApproval[]) {
  return [...approvals].sort((a, b) => b.submittedHoursAgo - a.submittedHoursAgo);
}

export function rejectReasonIsValid(reason: string) {
  return reason.trim().length >= 20;
}

export function isOutlier(row: HodMarkRow, average: number, standardDeviation: number) {
  if (row.score === null || row.absent) return false;
  return Math.abs(row.score - average) > standardDeviation * 2;
}
