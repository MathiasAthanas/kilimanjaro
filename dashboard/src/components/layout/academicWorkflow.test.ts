import { describe, expect, it } from 'vitest';
import { canAccessRoute, type UserRole } from '../../lib/auth/permissions';
import { getAcademicWorkflow } from './academicWorkflow';

describe('academic workflow links', () => {
  it.each(['TEACHER', 'HOD', 'AQA', 'PRINCIPAL', 'HEAD_OF_SCHOOL'] as UserRole[])(
    '%s only shows routes already authorized for that role', (role) => {
      const steps = getAcademicWorkflow(role);
      expect(steps.length).toBeGreaterThan(0);
      for (const step of steps) expect(canAccessRoute(role, step.to)).toBe(true);
    },
  );

  it('keeps head-of-school and principal decision paths aligned', () => {
    expect(getAcademicWorkflow('HEAD_OF_SCHOOL')).toEqual(getAcademicWorkflow('PRINCIPAL'));
    expect(getAcademicWorkflow('PRINCIPAL').map((step) => step.to)).toEqual(expect.arrayContaining([
      '/principal/approvals', '/exams/compose', '/principal/results/publish', '/principal/report-cards',
    ]));
  });

  it('does not invent a student or parent web workflow', () => {
    expect(getAcademicWorkflow('STUDENT')).toEqual([]);
    expect(getAcademicWorkflow('PARENT')).toEqual([]);
  });
});
