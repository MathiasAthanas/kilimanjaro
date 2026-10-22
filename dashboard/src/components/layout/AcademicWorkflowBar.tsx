import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { canAccessRoute } from '../../lib/auth/permissions';
import { getAcademicWorkflow } from './academicWorkflow';

/** A navigation-only sequence; it does not imply completion or alter academic state. */
export function AcademicWorkflowBar() {
  const role = useAuthStore((state) => state.session?.user.role);
  const { pathname } = useLocation();
  const steps = getAcademicWorkflow(role).filter((step) => canAccessRoute(role, step.to));
  const inAcademicDesk = pathname.startsWith('/teacher') || pathname.startsWith('/hod') ||
    pathname.startsWith('/aqa') || pathname.startsWith('/principal') || pathname.startsWith('/exams');
  if (!inAcademicDesk || !steps.length) return null;

  const current = steps
    .filter((step) => pathname === step.to || pathname.startsWith(`${step.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <nav aria-label="Academic workflow" className="border-b border-ks-line bg-ks-paper px-5 lg:px-margin-page">
      <div className="flex items-center gap-3 overflow-x-auto py-2">
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-ks-muted">Workflow</span>
        {steps.map((step, index) => (
          <NavLink key={step.to} to={step.to} aria-current={current === step ? 'step' : undefined}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ks-blue ${
              current === step ? 'bg-ks-mist text-ks-navy' : 'text-ks-muted hover:bg-white hover:text-ks-navy'
            }`}>
            <span className="mr-1 text-ks-blue">{index + 1}.</span>{step.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
