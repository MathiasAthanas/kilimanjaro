import { Navigate } from 'react-router-dom';
import { CheckCircle2, School, ShieldCheck } from 'lucide-react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { useAuthStore } from '../lib/auth/authStore';
import { getDefaultRouteForRole, isMobilePrimaryRole } from '../lib/auth/permissions';

export function RoleRedirect() {
  const session = useAuthStore((state) => state.session);
  if (!session) return <Navigate to="/login" replace />;

  if (isMobilePrimaryRole(session.user.role)) {
    return (
      <div className="grid min-h-[70vh] place-items-center">
        <Card className="max-w-lg p-8 text-center">
          <h1 className="font-display text-3xl font-bold text-ks-navy">Mobile app recommended</h1>
          <p className="mt-3 text-sm text-ks-muted">Student and parent web workspaces are intentionally disabled for now. Use the Kilimanjaro mobile app for daily access.</p>
          <Button className="mt-6" onClick={() => window.location.assign('/app/profile')}>Open profile</Button>
        </Card>
      </div>
    );
  }

  return <RoleRouterProgress target={getDefaultRouteForRole(session.user.role)} />;
}

function RoleRouterProgress({ target }: { target: string }) {
  return (
    <div className="grid min-h-[72vh] place-items-center">
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-ks-line bg-white shadow-layer">
          <School className="h-12 w-12 text-ks-gold" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold text-ks-navy">Kilimanjaro Schools</h1>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.3em] text-ks-muted">Syncing Session...</p>
        <div className="mx-auto mt-8 h-2 max-w-sm overflow-hidden rounded-full bg-ks-mist">
          <div className="h-full w-[95%] animate-pulse rounded-full bg-ks-blue" />
        </div>
        <div className="mt-8 grid gap-3 text-left">
          {['Retrieving Role Profile', 'Validating Permission Scope', 'Preparing Workspace Shell'].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-lg border border-ks-line bg-white p-3">
              <CheckCircle2 className="h-5 w-5 text-ks-emerald" />
              <span className="text-sm font-bold text-ks-navy">{item}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-ks-line bg-ks-mist/40 px-4 py-2 text-xs font-black uppercase tracking-wider text-ks-navy">
          <ShieldCheck className="h-4 w-4 text-ks-emerald" /> Secured route: {target}
        </div>
        <Navigate to={target} replace />
      </div>
    </div>
  );
}
