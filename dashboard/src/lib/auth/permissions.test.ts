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
