import { describe, expect, it } from 'vitest';
import { canSelectSchool, isGroupWorkspacePath } from './schoolScope';

describe('school drill-down scope', () => {
  it('uses actual scope rather than the ADMIN role label', () => {
    expect(canSelectSchool('SCHOOL', ['school-b'], 'school-a')).toBe(false);
    expect(canSelectSchool('SCHOOL', ['school-b'], 'school-b')).toBe(true);
    expect(canSelectSchool('GROUP', [], 'school-a')).toBe(true);
    expect(canSelectSchool('GROUP', ['school-b'], 'school-a')).toBe(false);
  });

  it('separates group totals from school workspaces', () => {
    expect(isGroupWorkspacePath('/manager/finance')).toBe(true);
    expect(isGroupWorkspacePath('/finance-group')).toBe(true);
    expect(isGroupWorkspacePath('/finance/invoices')).toBe(false);
    expect(isGroupWorkspacePath('/principal')).toBe(false);
  });
});
