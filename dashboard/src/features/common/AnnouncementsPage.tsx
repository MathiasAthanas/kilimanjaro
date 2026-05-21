import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { announcements } from './mockData';
import { MetricCard, PageScaffold } from './PageScaffold';

export function AnnouncementsPage() {
  return (
    <PageScaffold title="Announcements" description="School-wide operational messages, audience status and publishing context.">
      <div className="mb-6 grid gap-6 md:grid-cols-4">
        <MetricCard label="Published" value="24" />
        <MetricCard label="Urgent" value="08" tone="text-ks-rose" />
        <MetricCard label="Read Rate" value="89%" />
        <MetricCard label="Drafts" value="12" />
      </div>
      <div className="mb-6 flex max-w-md items-center gap-3 rounded-xl border border-ks-line bg-white px-4 py-2.5 shadow-sm transition focus-within:ring-2 focus-within:ring-ks-blue/20">
        <Search className="h-4 w-4 shrink-0 text-ks-muted" />
        <input className="flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:font-normal" placeholder="Search announcements..." />
      </div>
      <div className="grid gap-4">
        {announcements.map((item) => (
          <Link to={`/app/announcements/${item.id}`} key={item.id}>
            <Card className="p-5 transition hover:border-ks-blue hover:shadow-layer">
              <div className="flex items-start gap-4">
                <AdvancedIcon icon={item.icon} tone={item.priority === 'High' ? 'rose' : item.priority === 'Medium' ? 'amber' : 'blue'} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3"><h3 className="font-display text-xl font-bold text-ks-navy">{item.title}</h3><Badge tone={item.status === 'Active' ? 'emerald' : 'slate'}>{item.status}</Badge></div>
                  <p className="mt-2 text-sm text-ks-muted">{item.body}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ks-muted">{item.audience} · {item.date}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </PageScaffold>
  );
}
