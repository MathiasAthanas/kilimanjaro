export type UserRole =
  | 'STUDENT'
  | 'PARENT'
  | 'TEACHER'
  | 'HOD'
  | 'AQA'
  | 'FINANCE'
  | 'PRINCIPAL'
  | 'ADMIN'
  | 'ADMISSIONS'
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'HEAD_OF_SCHOOL'
  | 'HEAD_OF_FINANCE';

const defaultRoutes: Record<UserRole, string> = {
  STUDENT: '/app/mobile-guidance',
  PARENT: '/app/mobile-guidance',
  TEACHER: '/teacher',
  HOD: '/hod',
  AQA: '/aqa',
  FINANCE: '/finance',
  PRINCIPAL: '/principal',
  ADMIN: '/admin',
  ADMISSIONS: '/admissions',
  SUPER_ADMIN: '/superadmin',
  MANAGER: '/manager',
  HEAD_OF_SCHOOL: '/principal',
  HEAD_OF_FINANCE: '/finance-group',
};

export function getDefaultRouteForRole(role: UserRole) {
  return defaultRoutes[role] ?? '/app/403';
}

export function isWebPrimaryRole(role: UserRole) {
  return [
    'TEACHER', 'HOD', 'AQA', 'FINANCE', 'PRINCIPAL', 'ADMIN', 'ADMISSIONS',
    'SUPER_ADMIN', 'MANAGER', 'HEAD_OF_SCHOOL', 'HEAD_OF_FINANCE',
  ].includes(role);
}

export function isMobilePrimaryRole(role: UserRole) {
  return role === 'STUDENT' || role === 'PARENT';
}

/** Roles whose scope is the whole group (see every school). */
export function isGroupRole(role: UserRole | undefined) {
  return role === 'SUPER_ADMIN' || role === 'MANAGER' || role === 'HEAD_OF_FINANCE' || role === 'ADMIN';
}

export function canAccessRoute(role: UserRole | undefined, route: string) {
  if (!role) return false;
  if (route.startsWith('/app')) return true;
  if (route.startsWith('/superadmin')) return role === 'SUPER_ADMIN';
  if (route.startsWith('/manager')) return role === 'MANAGER' || role === 'SUPER_ADMIN';
  if (route.startsWith('/finance-group')) return ['HEAD_OF_FINANCE', 'MANAGER', 'SUPER_ADMIN'].includes(role);
  if (route.startsWith('/teacher')) return role === 'TEACHER' || role === 'HOD' || role === 'ADMIN';
  if (route.startsWith('/hod')) return role === 'HOD' || role === 'ADMIN';
  if (route.startsWith('/aqa')) return role === 'AQA' || role === 'ADMIN';
  if (route.startsWith('/finance')) return ['FINANCE', 'PRINCIPAL', 'ADMIN', 'HEAD_OF_FINANCE', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN'].includes(role);
  // The principal workspace is the Head of School portal; Manager/Super Admin
  // enter it when they drill into a school (school scope comes from the header)
  if (route.startsWith('/principal')) return ['PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN', 'ADMIN'].includes(role);
  if (route.startsWith('/admissions')) return ['ADMISSIONS', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN', 'ADMIN'].includes(role);
  if (route.startsWith('/admin')) return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER';
  if (route.startsWith('/reports')) return ['TEACHER', 'HOD', 'AQA', 'FINANCE', 'PRINCIPAL', 'ADMIN', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'HEAD_OF_FINANCE'].includes(role);
  if (route.startsWith('/academics')) return ['TEACHER', 'HOD', 'AQA', 'PRINCIPAL', 'ADMIN', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN'].includes(role);
  // Exam lifecycle management surface — admins, principals, AQA & group roles.
  if (route.startsWith('/exams')) return ['AQA', 'PRINCIPAL', 'ADMIN', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN'].includes(role);
  if (route.startsWith('/analytics')) return ['HOD', 'AQA', 'FINANCE', 'PRINCIPAL', 'ADMIN', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN', 'HEAD_OF_FINANCE'].includes(role);
  if (route.startsWith('/timetables')) return ['TEACHER', 'HOD', 'ADMIN', 'MANAGER', 'HEAD_OF_SCHOOL', 'SUPER_ADMIN'].includes(role);
  return true;
}
