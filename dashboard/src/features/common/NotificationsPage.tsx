import { CheckCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { notifications } from './mockData';
import { MetricCard, PageScaffold } from './PageScaffold';

export function NotificationsPage() {
  return (
    <PageScaffold title="Notifications Inbox" description="Manage your academic alerts and operational updates." action={<Button><CheckCheck className="h-4 w-4" /> Mark all as read</Button>}>
      <div className="mb-6 flex gap-8 border-b border-ks-line">
        {['All', 'Unread', 'Academic', 'Finance', 'System'].map((filter, index) => (
          <button
            key={filter}
            className={`-mb-px inline-flex items-center gap-2 pb-3 text-sm font-bold ${
              index === 0 ? 'border-b-2 border-ks-blue text-ks-blue' : 'text-ks-muted hover:text-ks-blue'
            }`}
          >
            {filter}
            {filter === 'Unread' ? <span className="rounded-full bg-ks-blue px-1.5 py-0.5 text-[10px] font-extrabold text-white">3</span> : null}
          </button>
        ))}
      </div>
      <Card className="overflow-hidden">
        {notifications.map((item) => (
          <Link key={item.id} to={`/app/notifications/${item.id}`} className={`group flex items-start gap-4 border-b border-ks-line p-5 transition hover:bg-ks-paper ${item.unread ? 'bg-white' : 'bg-ks-paper/30 opacity-75'}`}>
            <AdvancedIcon icon={item.icon} tone={item.tone} />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex justify-between gap-4"><h4 className="truncate font-bold text-ks-navy">{item.title}</h4><span className="shrink-0 text-xs font-bold text-ks-muted">{item.time}</span></div>
              <p className="truncate text-sm text-ks-muted">{item.preview}</p>
              <div className="mt-2"><Badge tone={item.tone}>{item.status}</Badge></div>
            </div>
            {item.unread ? <span className="mt-5 h-2.5 w-2.5 rounded-full bg-ks-blue" /> : null}
          </Link>
        ))}
        <div className="flex items-center justify-between border-t border-ks-line bg-ks-paper/50 px-6 py-4"><p className="text-xs font-bold text-ks-muted">Showing 4 of 28 notifications</p><span className="text-sm font-bold text-ks-navy">1</span></div>
      </Card>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <MetricCard label="Unread Alerts" value="03" />
        <MetricCard label="Action Rate" value="92%" />
        <MetricCard label="Critical Issues" value="01" tone="text-ks-rose" />
      </div>
    </PageScaffold>
  );
}
