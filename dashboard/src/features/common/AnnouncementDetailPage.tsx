import { ArrowLeft, ThumbsUp } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { announcements } from './mockData';
import { PageScaffold } from './PageScaffold';

export function AnnouncementDetailPage() {
  const { id } = useParams();
  const item = announcements.find((announcement) => announcement.id === id);
  if (!item) return <Navigate to="/app/404" replace />;
  return (
    <PageScaffold title={item.title} description={`${item.audience} · ${item.date}`} action={<Link to="/app/announcements"><Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>}>
      <Card className="mx-auto max-w-4xl p-8">
        <Badge tone={item.priority === 'High' ? 'rose' : 'blue'}>{`${item.priority} Priority`}</Badge>
        <article className="prose prose-slate mt-6 max-w-none">
          <p className="text-lg leading-8 text-ks-navy">{item.body}</p>
          <h2 className="font-display text-2xl text-ks-navy">1. Review Objectives</h2>
          <p className="text-ks-muted">Evaluate operational readiness, identify unresolved blockers, and ensure each department acts before deadlines.</p>
          <h2 className="font-display text-2xl text-ks-navy">2. Documentation Requirements</h2>
          <p className="text-ks-muted">All related approvals, reports, comments and exports should remain traceable through the staff portal.</p>
        </article>
        <div className="mt-8 flex items-center justify-between rounded-lg border border-ks-line bg-ks-paper p-4">
          <span className="text-sm font-bold text-ks-navy">Was this announcement helpful?</span>
          <Button variant="secondary"><ThumbsUp className="h-4 w-4" /> Yes</Button>
        </div>
      </Card>
    </PageScaffold>
  );
}
