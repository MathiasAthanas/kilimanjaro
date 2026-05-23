import { Calendar, CreditCard, Megaphone, Search, ShieldAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { useAnnouncements } from './common.hooks';
import { announcements } from './mockData';
import { MetricCard, PageScaffold } from './PageScaffold';

type AnnTone = 'blue' | 'emerald' | 'rose' | 'amber' | 'slate';

function priorityTone(priority: string): AnnTone {
  if (priority === 'High') return 'rose';
  if (priority === 'Medium') return 'amber';
  return 'blue';
}

function audienceIcon(audience: string): LucideIcon {
  if (/finance/i.test(audience)) return CreditCard;
  if (/admin/i.test(audience)) return ShieldAlert;
  if (/teacher|hod|aqa/i.test(audience)) return Megaphone;
  return Calendar;
}

function normalizeAnn(item: Record<string, unknown>) {
  const priority = String(item.priority ?? 'Low');
  const audience = String(item.audience ?? 'All');
  return {
    id:       String(item.id ?? ''),
    title:    String(item.title ?? ''),
    audience,
    status:   String(item.status ?? 'Active'),
    date:     item.publishedAt
      ? new Date(String(item.publishedAt)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : String(item.date ?? ''),
    priority,
    body:     String(item.body ?? item.content ?? ''),
    icon:     audienceIcon(audience),
  };
}

export function AnnouncementsPage() {
  const [query, setQuery] = useState('');
  const { data: rawAnnouncements } = useAnnouncements() as { data: Record<string, unknown>[] | undefined };

  const apiAnnouncements = rawAnnouncements?.map(normalizeAnn) ?? announcements;

  const filtered = query.length > 1
    ? apiAnnouncements.filter((a) =>
        a.title.toLowerCase().includes(query.toLowerCase()) ||
        a.body.toLowerCase().includes(query.toLowerCase()),
      )
    : apiAnnouncements;

  const publishedCount = apiAnnouncements.filter((a) => a.status === 'Active').length;
  const urgentCount    = apiAnnouncements.filter((a) => a.priority === 'High').length;
  const draftCount     = apiAnnouncements.filter((a) => a.status === 'Draft').length;

  return (
    <PageScaffold title="Announcements" description="School-wide operational messages, audience status and publishing context.">
      <div className="mb-6 grid gap-6 md:grid-cols-4">
        <MetricCard label="Published" value={String(publishedCount).padStart(2, '0')} />
        <MetricCard label="Urgent"    value={String(urgentCount).padStart(2, '0')} tone="text-ks-rose" />
        <MetricCard label="Read Rate" value="89%" />
        <MetricCard label="Drafts"    value={String(draftCount).padStart(2, '0')} />
      </div>
      <div className="mb-6 flex max-w-md items-center gap-3 rounded-xl border border-ks-line bg-white px-4 py-2.5 shadow-sm transition focus-within:ring-2 focus-within:ring-ks-blue/20">
        <Search className="h-4 w-4 shrink-0 text-ks-muted" />
        <input
          className="flex-1 border-0 bg-transparent text-sm font-semibold outline-none placeholder:font-normal"
          placeholder="Search announcements..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="grid gap-4">
        {filtered.map((item) => (
          <Link to={`/app/announcements/${item.id}`} key={item.id}>
            <Card className="p-5 transition hover:border-ks-blue hover:shadow-layer">
              <div className="flex items-start gap-4">
                <AdvancedIcon icon={item.icon} tone={priorityTone(item.priority)} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-xl font-bold text-ks-navy">{item.title}</h3>
                    <Badge tone={item.status === 'Active' ? 'emerald' : 'slate'}>{item.status}</Badge>
                  </div>
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
