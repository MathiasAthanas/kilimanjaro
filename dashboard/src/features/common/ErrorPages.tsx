import { AlertTriangle, ArrowLeft, Home, Search, ShieldAlert } from 'lucide-react';
import { Link, useRouteError } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { useAuthStore } from '../../lib/auth/authStore';

export function ForbiddenPage() {
  const role = useAuthStore((state) => state.session?.user.role ?? 'Unknown');
  return <ErrorFrame icon={ShieldAlert} title="Access Restricted" eyebrow="Error 403: Forbidden" message={`Your current role (${role}) does not have permission to access this workspace. This attempt has been logged for security.`} />;
}

export function NotFoundPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-ks-paper p-6">
      <div className="absolute right-[-10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-ks-mist blur-[120px]" />
      <div className="relative z-10 grid w-full max-w-4xl items-center gap-12 md:grid-cols-2">
        <div className="rounded-xl border-4 border-white bg-ks-mist/50 p-12 text-center shadow-2xl"><span className="font-display text-8xl font-bold text-ks-gold">404</span><p className="mt-2 text-xs font-black uppercase tracking-widest text-ks-muted">Resource unavailable</p></div>
        <div>
          <h1 className="font-display text-4xl font-bold text-ks-navy">Lost in the Halls?</h1>
          <p className="mt-4 text-ks-muted">The page may have moved, been deleted, or may not exist in the Staff Portal.</p>
          <div className="mt-6 flex items-center gap-3 rounded-lg border border-ks-line bg-white px-4 py-3"><Search className="h-5 w-5 text-ks-muted" /><input className="flex-1 border-0 outline-none" placeholder="Search portal..." /></div>
          <div className="mt-6 flex gap-3"><Link to="/app"><Button><Home className="h-4 w-4" /> Back home</Button></Link><Button variant="secondary" onClick={() => history.back()}><ArrowLeft className="h-4 w-4" /> Go back</Button></div>
        </div>
      </div>
    </main>
  );
}

export function AppErrorPage() {
  const error = useRouteError();
  return <ErrorFrame icon={AlertTriangle} title="Something went wrong" eyebrow="System Boundary" message={`A recoverable portal error occurred. Incident ID: KS-ERR-${Math.floor(Math.random() * 90000 + 10000)}. ${error instanceof Error ? error.message : ''}`} />;
}

function ErrorFrame({ icon, title, eyebrow, message }: { icon: typeof AlertTriangle; title: string; eyebrow: string; message: string }) {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <Card className="max-w-3xl p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <AdvancedIcon icon={icon} tone="rose" />
          <div><p className="text-xs font-black uppercase tracking-wider text-ks-rose">{eyebrow}</p><h1 className="mt-2 font-display text-4xl font-bold text-ks-navy">{title}</h1><p className="mt-3 text-sm leading-6 text-ks-muted">{message}</p></div>
        </div>
        <div className="mt-8 flex gap-3 border-t border-ks-line pt-6"><Link to="/app"><Button>Back to workspace</Button></Link><Link to="/app/help"><Button variant="secondary">Contact support</Button></Link></div>
      </Card>
    </div>
  );
}
