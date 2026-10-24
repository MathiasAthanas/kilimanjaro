import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { canAccessRoute, type UserRole } from '../../lib/auth/permissions';
import { useSchoolStore } from '../../lib/school/schoolStore';
import { isGroupWorkspacePath } from './schoolScope';

const managerTasks = [
  { to: '/principal', label: 'School Overview' },
  { to: '/finance/invoices', label: 'Finance' },
  { to: '/principal/performance', label: 'Academics' },
  { to: '/admin/students', label: 'People' },
  { to: '/admin/academic/setup', label: 'Setup' },
  { to: '/admin/reports', label: 'Reports' },
];
const financeTasks = [
  { to: '/finance/invoices', label: 'Invoices' },
  { to: '/finance/payments', label: 'Payments' },
  { to: '/finance/reports/statement', label: 'Statement' },
  { to: '/finance/reports', label: 'Reports' },
];

/** Group-role drill-down links only appear after an authorized school is selected. */
export function SchoolWorkBar() {
  const session = useAuthStore((state) => state.session);
  const activeSchool = useSchoolStore((state) => state.activeSchool);
  const { pathname } = useLocation();
  if (!session || session.user.scope !== 'GROUP' || !activeSchool || isGroupWorkspacePath(pathname)) return null;

  const role = session.user.role as UserRole;
  const tasks = (role === 'HEAD_OF_FINANCE' ? financeTasks : managerTasks)
    .filter((task) => canAccessRoute(role, task.to));
  if (!tasks.length) return null;

  return (
    <nav aria-label={`${activeSchool.name} school workspaces`} className="border-b border-ks-line bg-white px-5 lg:px-margin-page">
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto py-2">
        <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-ks-muted">In {activeSchool.name}</span>
        {tasks.map((task) => (
          <NavLink key={task.to} to={task.to}
            className={({ isActive }) => `shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-blue ${isActive ? 'bg-ks-mist text-ks-navy' : 'text-ks-muted hover:bg-ks-paper hover:text-ks-navy'}`}>
            {task.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
