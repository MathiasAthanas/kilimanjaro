/** Role and department rules for the Create / Edit User forms. */

export type DeptOption = { value: string; label: string };

/** Group-wide roles. Only a group-scoped account may grant these (the auth service enforces it too). */
export const GROUP_ROLE_OPTIONS = [
  { value: 'MANAGER', label: 'Manager (all schools)' },
  { value: 'HEAD_OF_FINANCE', label: 'Head of Finance (all schools)' },
];

/** Roles that must be tied to a department: the gateway filters a Head of Department's view by it. */
export const DEPARTMENT_REQUIRED_ROLES = ['HEAD_OF_DEPARTMENT'];

/** Only these dashboard roles can create users (the auth service allows SUPER_ADMIN / SYSTEM_ADMIN). */
export function canGrantGroupRoles(session: { user: { role: string; scope?: string } } | null): boolean {
  const role = session?.user.role ?? '';
  return (role === 'ADMIN' || role === 'SUPER_ADMIN') && session?.user.scope === 'GROUP';
}

/** A department is optional: most roles (finance, admin, head of school...) do not belong to one. */
const NO_DEPARTMENT: { value: string; label: string } = { value: '', label: 'None (no department)' };

const ROLE_DEPT_KEYWORDS: Record<string, string> = {
  FINANCE: 'finance',
  PRINCIPAL: 'principal',
  ACADEMIC_QA: 'quality',
  SYSTEM_ADMIN: 'system',
};

function departmentChoicesForRole(role: string, departments: { name: string }[]): DeptOption[] {
  const all = departments.map((d) => ({ value: d.name, label: d.name }));
  if (all.length === 0) return all;
  const keyword = ROLE_DEPT_KEYWORDS[role];
  if (keyword) {
    const filtered = all.filter((o) => o.value.toLowerCase().includes(keyword));
    return filtered.length > 0 ? filtered : all;
  }
  const restricted = Object.values(ROLE_DEPT_KEYWORDS);
  const filtered = all.filter((o) => !restricted.some((k) => o.value.toLowerCase().includes(k)));
  return filtered.length > 0 ? filtered : all;
}

/** Department choices for a role, always led by "None" so a department is never forced. */
export function departmentOptionsForRole(role: string, departments: { name: string }[], current?: string | null): DeptOption[] {
  const lead: DeptOption = DEPARTMENT_REQUIRED_ROLES.includes(role)
    ? { value: '', label: 'Select a department…' }
    : NO_DEPARTMENT;
  const options = [lead, ...departmentChoicesForRole(role, departments)];
  // Keep a saved value that is no longer in the filtered list, so editing a user never silently wipes it.
  if (current && !options.some((o) => o.value === current)) options.push({ value: current, label: `${current} (current)` });
  return options;
}
