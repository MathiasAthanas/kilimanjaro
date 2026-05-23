import { Bell, BookOpen, CheckCheck, CreditCard, Settings, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { useMarkAllReadMutation, useNotifications, useUnreadCount } from './common.hooks';
import { notifications } from './mockData';
import { MetricCard, PageScaffold } from './PageScaffold';

type NotifTone = 'blue' | 'emerald' | 'rose' | 'amber' | 'slate';

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Finance:      CreditCard,
  Academic:     TrendingUp,
  System:       Settings,
  Announcement: BookOpen,
};

const CATEGORY_TONE: Record<string, NotifTone> = {
  Finance:      'emerald',
  Academic:     'rose',
  System:       'amber',
  Announcement: 'blue',
};

function normalizeNotif(item: Record<string, unknown>) {
  const cat = String(item.category ?? 'System');
  return {
    id:      String(item.id ?? ''),
    title:   String(item.title ?? ''),
    preview: String(item.message ?? item.preview ?? ''),
    category: cat,
    status:  String(item.status ?? 'Unread'),
    time:    item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : String(item.time ?? ''),
    unread:  item.isRead === false || item.unread === true,
    icon:    (CATEGORY_ICON[cat] ?? Bell) as LucideIcon,
    tone:    (CATEGORY_TONE[cat] ?? 'slate') as NotifTone,
  };
}

const FILTERS = ['All', 'Unread', 'Academic', 'Finance', 'System'] as const;

export function NotificationsPage() {
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const { data: rawNotifs } = useNotifications() as { data: Record<string, unknown>[] | undefined };
  const { data: unreadCount = 0 } = useUnreadCount() as unknown as { data: number };
  const markAllRead = useMarkAllReadMutation();

  const apiNotifs = rawNotifs?.map(normalizeNotif) ?? notifications;

  const displayed = activeFilter === 'All'
    ? apiNotifs
    : activeFilter === 'Unread'
    ? apiNotifs.filter((n) => n.unread)
    : apiNotifs.filter((n) => n.category === activeFilter);

  const criticalCount = apiNotifs.filter((n) => n.tone === 'rose' && n.unread).length;
  const total = apiNotifs.length;
  const actionRate = total > 0
    ? `${Math.round(((total - apiNotifs.filter((n) => n.unread).length) / total) * 100)}%`
    : '—';

  return (
    <PageScaffold
      title="Notifications Inbox"
      description="Manage your academic alerts and operational updates."
      action={
        <Button onClick={() => markAllRead.mutate()}>
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </Button>
      }
    >
      <div className="mb-6 flex gap-8 border-b border-ks-line">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`-mb-px inline-flex items-center gap-2 pb-3 text-sm font-bold ${
              filter === activeFilter ? 'border-b-2 border-ks-blue text-ks-blue' : 'text-ks-muted hover:text-ks-blue'
            }`}
          >
            {filter}
            {filter === 'Unread' && unreadCount > 0 ? (
              <span className="rounded-full bg-ks-blue px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                {unreadCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {displayed.map((item) => (
          <Link
            key={item.id}
            to={`/app/notifications/${item.id}`}
            className={`group flex items-start gap-4 border-b border-ks-line p-5 transition hover:bg-ks-paper ${
              item.unread ? 'bg-white' : 'bg-ks-paper/30 opacity-75'
            }`}
          >
            <AdvancedIcon icon={item.icon} tone={item.tone} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between gap-4">
                <h4 className="truncate font-bold text-ks-navy">{item.title}</h4>
                <span className="shrink-0 text-xs font-bold text-ks-muted">{item.time}</span>
              </div>
              <p className="truncate text-sm text-ks-muted">{item.preview}</p>
              <div className="mt-2"><Badge tone={item.tone}>{item.status}</Badge></div>
            </div>
            {item.unread ? <span className="mt-5 h-2.5 w-2.5 rounded-full bg-ks-blue" /> : null}
          </Link>
        ))}
        <div className="flex items-center justify-between border-t border-ks-line bg-ks-paper/50 px-6 py-4">
          <p className="text-xs font-bold text-ks-muted">Showing {displayed.length} of {total} notifications</p>
          <span className="text-sm font-bold text-ks-navy">1</span>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <MetricCard label="Unread Alerts" value={String(unreadCount).padStart(2, '0')} />
        <MetricCard label="Action Rate" value={actionRate} />
        <MetricCard label="Critical Issues" value={String(criticalCount).padStart(2, '0')} tone="text-ks-rose" />
      </div>
    </PageScaffold>
  );
}
