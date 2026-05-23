import { Bell, BookOpen, CreditCard, Settings, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { useMarkNotificationReadMutation, useNotifications } from './common.hooks';
import { notifications } from './mockData';
import { PageScaffold } from './PageScaffold';

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

export function NotificationDetailPage() {
  const { id } = useParams();
  const { data: rawNotifs } = useNotifications() as { data: Record<string, unknown>[] | undefined };
  const markRead = useMarkNotificationReadMutation();

  // Normalise API data, fall back to mock
  const allNotifs = rawNotifs
    ? rawNotifs.map((n) => {
        const cat = String(n.category ?? 'System');
        return {
          id:      String(n.id ?? ''),
          title:   String(n.title ?? ''),
          preview: String(n.message ?? n.preview ?? ''),
          category: cat,
          status:  String(n.status ?? 'Unread'),
          time:    n.createdAt ? new Date(String(n.createdAt)).toLocaleString() : String(n.time ?? ''),
          unread:  n.isRead === false || n.unread === true,
          icon:    (CATEGORY_ICON[cat] ?? Bell) as LucideIcon,
          tone:    (CATEGORY_TONE[cat] ?? 'slate') as NotifTone,
        };
      })
    : notifications;

  const item = allNotifs.find((n) => n.id === id);
  if (!item) return <Navigate to="/app/404" replace />;

  return (
    <PageScaffold
      title={item.title}
      description="Notification detail and related operational context."
      action={
        <Button variant="secondary" onClick={() => markRead.mutate(item.id)}>
          Mark as read
        </Button>
      }
    >
      <Card className="max-w-4xl p-8">
        <AdvancedIcon icon={item.icon} tone={item.tone} />
        <div className="mt-5 flex items-center gap-3">
          <Badge tone={item.tone}>{item.status}</Badge>
          <span className="text-sm font-bold text-ks-muted">{item.time}</span>
        </div>
        <p className="mt-6 text-lg leading-8 text-ks-navy">{item.preview}</p>
        <div className="mt-8 rounded-lg border border-ks-line bg-ks-paper p-5">
          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Related action</p>
          <p className="mt-2 text-sm text-ks-muted">Open the connected workspace once the relevant role module is enabled.</p>
        </div>
      </Card>
    </PageScaffold>
  );
}
