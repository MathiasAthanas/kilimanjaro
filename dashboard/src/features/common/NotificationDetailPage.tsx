import { Navigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { notifications } from './mockData';
import { PageScaffold } from './PageScaffold';

export function NotificationDetailPage() {
  const { id } = useParams();
  const item = notifications.find((notification) => notification.id === id);
  if (!item) return <Navigate to="/app/404" replace />;
  return (
    <PageScaffold title={item.title} description="Notification detail and related operational context." action={<Button variant="secondary">Mark as read</Button>}>
      <Card className="max-w-4xl p-8">
        <AdvancedIcon icon={item.icon} tone={item.tone} />
        <div className="mt-5 flex items-center gap-3"><Badge tone={item.tone}>{item.status}</Badge><span className="text-sm font-bold text-ks-muted">{item.time}</span></div>
        <p className="mt-6 text-lg leading-8 text-ks-navy">{item.preview}</p>
        <div className="mt-8 rounded-lg border border-ks-line bg-ks-paper p-5">
          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Related action</p>
          <p className="mt-2 text-sm text-ks-muted">Open the connected workspace once the relevant role module is enabled.</p>
        </div>
      </Card>
    </PageScaffold>
  );
}
