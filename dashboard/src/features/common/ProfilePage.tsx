import { Lock, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { useAuthStore } from '../../lib/auth/authStore';
import { MetricCard, PageScaffold } from './PageScaffold';

export function ProfilePage() {
  const user = useAuthStore((state) => state.session?.user);
  return (
    <PageScaffold title="My Profile" description="Your school portal identity, role scope and security status." action={<Link to="/app/settings"><Button variant="secondary">Edit preferences</Button></Link>}>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <Card className="overflow-hidden">
          <div className="bg-ks-navy p-8 text-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <div className="relative shrink-0">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-ks-gold/30 bg-ks-gold/20 font-display text-3xl font-bold text-ks-gold">
                  {user?.name?.slice(0, 2)?.toUpperCase() ?? 'KS'}
                </div>
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-ks-navy bg-ks-emerald" />
              </div>
              <div>
                <Badge tone="gold">Active Status</Badge>
                <h2 className="mt-3 font-display text-4xl font-bold">{user?.name ?? 'Staff User'}</h2>
                <p className="mt-2 text-ks-mist/70">{user?.department ?? 'Kilimanjaro Schools'} · {user?.role ?? 'STAFF'}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-8 md:grid-cols-2">
            <Info icon={Mail} label="Email" value={user?.email ?? 'not available'} />
            <Info icon={UserRound} label="Role" value={user?.role ?? 'not available'} />
            <Info icon={ShieldCheck} label="Account status" value={user?.status ?? 'ACTIVE'} />
            <Info icon={Lock} label="Gateway" value="/api/v1 secured" />
          </div>
        </Card>
        <div className="grid gap-6">
          <MetricCard label="Account grade" value="A+" tone="text-ks-gold" />
          <MetricCard label="Unread alerts" value="03" />
          <Card className="p-6">
            <h3 className="font-display text-xl font-bold text-ks-navy">Recent security events</h3>
            <div className="mt-4 space-y-2">
              {['Password updated', 'Successful login', 'Session refreshed'].map((event, index) => (
                <div key={event} className="flex items-center gap-3 rounded-lg border border-ks-line bg-ks-paper p-3">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-ks-emerald" />
                  <p className="text-sm font-bold text-ks-navy">{event}</p>
                  <span className="ml-auto text-[10px] text-ks-muted">{index === 0 ? '2d ago' : index === 1 ? 'Today' : '1h ago'}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageScaffold>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="rounded-lg border border-ks-line bg-ks-paper p-4"><div className="flex items-center gap-3"><AdvancedIcon icon={Icon} tone="blue" /><div><p className="text-xs font-black uppercase tracking-wider text-ks-muted">{label}</p><p className="mt-1 font-bold text-ks-navy">{value}</p></div></div></div>;
}
