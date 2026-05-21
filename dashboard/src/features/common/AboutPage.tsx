import { Building2, Database, Server, Users } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { MetricCard, PageScaffold } from './PageScaffold';

export function AboutPage() {
  return (
    <PageScaffold title="About Kilimanjaro Schools System" description="Pioneering digital excellence in Tanzanian education.">
      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-8">
          <AdvancedIcon icon={Building2} tone="gold" />
          <h2 className="mt-6 font-display text-4xl font-bold text-ks-navy">Pioneering Digital Excellence in Tanzanian Education</h2>
          <p className="mt-5 text-lg leading-8 text-ks-muted">The Kilimanjaro Schools webapp is the authoritative operational control center for staff workflows, approvals, analytics, finance, communication, and system governance.</p>
        </Card>
        <Card className="p-8">
          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">System Status</p>
          <p className="mt-2 font-display text-2xl font-bold text-ks-navy">v1.0.0 <span className="text-sm text-ks-emerald">(Stable)</span></p>
          <div className="mt-6 space-y-4">
            <Info icon={Server} label="Environment" value={import.meta.env.MODE} />
            <Info icon={Database} label="Gateway" value={import.meta.env.VITE_API_BASE_URL ?? '/api/v1'} />
            <Info icon={Users} label="Role model" value="RBAC enabled" />
          </div>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <MetricCard label="Students enrolled" value="12,450" tone="text-ks-blue" />
        <MetricCard label="Staff users" value="842" tone="text-ks-navy" />
        <MetricCard label="Core modules" value="07" tone="text-ks-gold" />
      </div>
    </PageScaffold>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-ks-line bg-ks-paper p-3"><Icon className="h-5 w-5 text-ks-blue" /><div><p className="text-xs font-bold text-ks-muted">{label}</p><p className="font-bold text-ks-navy">{value}</p></div></div>;
}
