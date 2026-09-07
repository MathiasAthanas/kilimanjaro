import { describe, expect, it } from 'vitest';
import { getDefaultRouteForRole, isMobilePrimaryRole, isWebPrimaryRole } from './permissions';

describe('permissions', () => {
  it('maps web roles to default routes', () => {
    expect(getDefaultRouteForRole('TEACHER')).toBe('/teacher');
    expect(getDefaultRouteForRole('ADMIN')).toBe('/admin');
  });

  it('separates mobile and web primary roles', () => {
    expect(isMobilePrimaryRole('STUDENT')).toBe(true);
    expect(isWebPrimaryRole('PRINCIPAL')).toBe(true);
  });
});

import { canAccessRoute } from './permissions';
it('permits both workspaces for a teacher and HOD but not finance', () => {
 expect(canAccessRoute(['TEACHER','HOD'], '/teacher/classes')).toBe(true);
 expect(canAccessRoute(['TEACHER','HOD'], '/hod/approvals')).toBe(true);
 expect(canAccessRoute(['TEACHER','HOD'], '/finance')).toBe(false);
 expect(canAccessRoute([], '/admin')).toBe(false);
 expect(getDefaultRouteForRole('HOD')).toBe('/hod');
});
