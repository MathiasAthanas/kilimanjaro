import { describe, expect, it } from 'vitest';
import { DEPARTMENT_REQUIRED_ROLES, GROUP_ROLE_OPTIONS, canGrantGroupRoles, departmentOptionsForRole } from './userForm';
import { roleRisk } from './adminValidation';

const departments = [{ name: 'Sciences' }, { name: 'Languages' }, { name: 'Finance' }, { name: 'Principal Office' }];

describe('user form department rules', () => {
  it('always offers "None" first so a department is never forced', () => {
    for (const role of ['TEACHER', 'FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN', 'ACADEMIC_QA', 'MANAGER', 'HEAD_OF_FINANCE']) {
      expect(departmentOptionsForRole(role, departments)[0]).toEqual({ value: '', label: 'None (no department)' });
    }
  });

  it('works when the school has no departments yet', () => {
    expect(departmentOptionsForRole('TEACHER', [])).toEqual([{ value: '', label: 'None (no department)' }]);
  });

  it('keeps the existing role-based filtering of department choices', () => {
    expect(departmentOptionsForRole('FINANCE', departments).map((o) => o.value)).toEqual(['', 'Finance']);
    expect(departmentOptionsForRole('TEACHER', departments).map((o) => o.value)).toEqual(['', 'Sciences', 'Languages']);
  });

  it('makes a department mandatory for Heads of Department only', () => {
    expect(DEPARTMENT_REQUIRED_ROLES).toEqual(['HEAD_OF_DEPARTMENT']);
    expect(departmentOptionsForRole('HEAD_OF_DEPARTMENT', departments)[0].label).toBe('Select a department…');
  });

  it('keeps a saved department that is no longer in the filtered list', () => {
    const options = departmentOptionsForRole('FINANCE', departments, 'Catering');
    expect(options.at(-1)).toEqual({ value: 'Catering', label: 'Catering (current)' });
    expect(departmentOptionsForRole('FINANCE', departments, 'Finance')).toHaveLength(2);
  });
});

describe('group-wide roles in the user form', () => {
  it('offers Manager and Head of Finance', () => {
    expect(GROUP_ROLE_OPTIONS.map((o) => o.value)).toEqual(['MANAGER', 'HEAD_OF_FINANCE']);
  });

  it('is available only to group-scoped administrators', () => {
    expect(canGrantGroupRoles({ user: { role: 'ADMIN', scope: 'GROUP' } })).toBe(true);
    expect(canGrantGroupRoles({ user: { role: 'SUPER_ADMIN', scope: 'GROUP' } })).toBe(true);
    expect(canGrantGroupRoles({ user: { role: 'ADMIN', scope: 'SCHOOL' } })).toBe(false);
    expect(canGrantGroupRoles({ user: { role: 'MANAGER', scope: 'GROUP' } })).toBe(false);
    expect(canGrantGroupRoles({ user: { role: 'HEAD_OF_FINANCE', scope: 'GROUP' } })).toBe(false);
    expect(canGrantGroupRoles(null)).toBe(false);
  });

  it('flags the group-wide roles as privileged', () => {
    expect(roleRisk('MANAGER')).toBe('high');
    expect(roleRisk('HEAD_OF_FINANCE')).toBe('high');
    expect(roleRisk('TEACHER')).toBe('standard');
  });
});
