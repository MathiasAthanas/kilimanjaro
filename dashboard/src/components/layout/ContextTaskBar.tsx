import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { canAccessRoute } from '../../lib/auth/permissions';
import { getActiveSection, getSectionsForRole } from './RoleSidebar';

/** Existing role links, presented beside the current workflow instead of only in the sidebar. */
export function ContextTaskBar() {
  const role = useAuthStore((state) => state.session?.user.role);
  const { pathname } = useLocation();
  const roleSections = getSectionsForRole(role);
  const groupAcademicSections = (role === 'MANAGER' || role === 'SUPER_ADMIN')
    ? getSectionsForRole('ADMIN').filter((item) => item.title === 'Academic Structure' || item.title === 'Configuration')
    : [];
  const groupOperationsSections = (role === 'MANAGER' || role === 'SUPER_ADMIN')
    ? getSectionsForRole('ADMIN').filter((item) => ['Notifications', 'Timetable', 'Reports & Audit'].includes(item.title))
    : [];
  const groupFinanceSections = (role === 'MANAGER' || role === 'SUPER_ADMIN' || role === 'HEAD_OF_FINANCE')
    ? getSectionsForRole('FINANCE').filter((item) => item.title !== 'Finance Desk')
    : [];
  const section = getActiveSection([...groupAcademicSections, ...groupOperationsSections, ...groupFinanceSections, ...roleSections], pathname);
  if (!section || section.items.length < 2) return null;

  const tasks = section.items.filter((item) => canAccessRoute(role, item.to));
  const exact = tasks.find((item) => item.to === pathname);
  const parent = tasks
    .filter((item) => pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
  const current = exact ?? parent;

  return (
    <nav aria-label={`${section.title} tasks`} className="border-b border-ks-line bg-white px-5 lg:px-margin-page">
      <div className="flex items-center gap-4 overflow-x-auto">
        <span className="shrink-0 py-3 text-[11px] font-black uppercase tracking-wider text-ks-muted">{section.title}</span>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto py-2">
          {tasks.map((item) => (
            <NavLink key={`${item.to}-${item.label}`} to={item.to} aria-current={current === item ? 'page' : undefined}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-blue ${
                current === item ? 'bg-ks-mist text-ks-navy' : 'text-ks-muted hover:bg-ks-paper hover:text-ks-navy'
              }`}>
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
