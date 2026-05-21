import { Construction } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';

const labels: Record<string, string> = {
  teacher: 'Teacher Desktop Dashboard',
  hod: 'HOD Desktop Dashboard',
  aqa: 'AQA Command Center',
  finance: 'Finance Office',
  principal: 'Principal Executive Workspace',
  admin: 'Admin System Management',
  reports: 'Reports and Exports',
};

const tones: Record<string, string> = {
  teacher: 'bg-ks-blue/10 text-ks-blue',
  hod: 'bg-ks-emerald/10 text-ks-emerald',
  aqa: 'bg-ks-amber/10 text-ks-amber',
  finance: 'bg-ks-gold/15 text-[#7a5200]',
  principal: 'bg-ks-navy/10 text-ks-navy',
  admin: 'bg-ks-slate/10 text-ks-slate',
  reports: 'bg-ks-sky/10 text-ks-sky',
};

export function RoleComingSoonPage() {
  const segment = useLocation().pathname.split('/')[1] || 'workspace';
  const iconTone = tones[segment] ?? 'bg-ks-blue/10 text-ks-blue';
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <Card className="w-full max-w-2xl overflow-hidden p-0 text-center">
        <div className="border-b border-ks-line bg-gradient-to-br from-ks-paper to-ks-mist/30 p-10">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${iconTone}`}>
            <Construction className="h-8 w-8" />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">Route prepared</p>
          <h1 className="mt-3 font-display text-3xl font-bold text-ks-navy">{labels[segment] ?? 'Workspace'}</h1>
          <p className="mt-2 text-sm font-semibold text-ks-muted">Ready for implementation</p>
        </div>
        <div className="p-8">
          <p className="text-sm leading-7 text-ks-muted">The protected shell, routing, auth, command bar and shared UI are in place. The detailed role screens will be implemented in the next development phase.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/app/profile"><Button>Open profile</Button></Link>
            <Link to="/app/notifications"><Button variant="secondary">Notifications</Button></Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
