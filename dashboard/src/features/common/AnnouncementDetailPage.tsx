import { ArrowLeft, Calendar, CreditCard, Megaphone, ShieldAlert, ThumbsUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useAnnouncement, useAnnouncements } from './common.hooks';
import { announcements } from './mockData';
import { PageScaffold } from './PageScaffold';

function audienceIcon(audience: string): LucideIcon {
  if (/finance/i.test(audience)) return CreditCard;
  if (/admin/i.test(audience)) return ShieldAlert;
  if (/teacher|hod|aqa/i.test(audience)) return Megaphone;
  return Calendar;
}

export function AnnouncementDetailPage() {
  const { id } = useParams();

  // Try fetching the single announcement directly first
  const { data: singleRaw } = useAnnouncement(id) as { data: Record<string, unknown> | undefined };
  // Fall back to list lookup
  const { data: rawList } = useAnnouncements() as { data: Record<string, unknown>[] | undefined };

  // Resolve item: prefer single fetch, then list, then mock
  const rawItem: Record<string, unknown> | undefined =
    singleRaw ??
    rawList?.find((a) => String(a.id) === id) ??
    (announcements.find((a) => a.id === id) as unknown as Record<string, unknown>);

  if (!rawItem) return <Navigate to="/app/404" replace />;

  const priority = String(rawItem.priority ?? 'Low');
  const audience = String(rawItem.audience ?? 'All');
  const item = {
    id:       String(rawItem.id ?? ''),
    title:    String(rawItem.title ?? ''),
    audience,
    status:   String(rawItem.status ?? 'Active'),
    date:     rawItem.publishedAt
      ? new Date(String(rawItem.publishedAt)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : String(rawItem.date ?? ''),
    priority,
    body:     String(rawItem.body ?? rawItem.content ?? ''),
    icon:     audienceIcon(audience) as LucideIcon,
  };

  return (
    <PageScaffold
      title={item.title}
      description={`${item.audience} · ${item.date}`}
      action={
        <Link to="/app/announcements">
          <Button variant="secondary"><ArrowLeft className="h-4 w-4" /> Back</Button>
        </Link>
      }
    >
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
