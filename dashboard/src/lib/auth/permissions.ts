export type UserRole = 'STUDENT' | 'PARENT' | 'TEACHER' | 'HOD' | 'AQA' | 'FINANCE' | 'PRINCIPAL' | 'ADMIN';

const defaultRoutes: Record<UserRole, string> = {
  STUDENT: '/app/mobile-guidance',
  PARENT: '/app/mobile-guidance',
  TEACHER: '/teacher',
  HOD: '/hod',
  AQA: '/aqa',
  FINANCE: '/finance',
  PRINCIPAL: '/principal',
  ADMIN: '/admin',
};

export function getDefaultRouteForRole(role: UserRole) {
  return defaultRoutes[role] ?? '/app/403';
}

export function isWebPrimaryRole(role: UserRole) {
  return ['TEACHER', 'HOD', 'AQA', 'FINANCE', 'PRINCIPAL', 'ADMIN'].includes(role);
}

export function isMobilePrimaryRole(role: UserRole) {
  return role === 'STUDENT' || role === 'PARENT';
}

export function canAccessRoute(role: UserRole | undefined, route: string) {
  if (!role) return false;
  if (route.startsWith('/app')) return true;
  if (route.startsWith('/teacher')) return role === 'TEACHER' || role === 'ADMIN';
  if (route.startsWith('/hod')) return role === 'HOD' || role === 'ADMIN';
  if (route.startsWith('/aqa')) return role === 'AQA' || role === 'ADMIN';
  if (route.startsWith('/finance')) return role === 'FINANCE' || role === 'PRINCIPAL' || role === 'ADMIN';
  if (route.startsWith('/principal')) return role === 'PRINCIPAL' || role === 'ADMIN';
  if (route.startsWith('/admin')) return role === 'ADMIN';
  if (route.startsWith('/reports')) return ['TEACHER', 'HOD', 'AQA', 'FINANCE', 'PRINCIPAL', 'ADMIN'].includes(role);
  if (route.startsWith('/academics')) return ['TEACHER', 'HOD', 'AQA', 'PRINCIPAL', 'ADMIN'].includes(role);
  if (route.startsWith('/analytics')) return ['HOD', 'AQA', 'FINANCE', 'PRINCIPAL', 'ADMIN'].includes(role);
  if (route.startsWith('/timetables')) return ['TEACHER', 'HOD', 'ADMIN'].includes(role);
  return true;
}
