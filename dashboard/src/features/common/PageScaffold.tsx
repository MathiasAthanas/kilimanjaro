import type { ReactNode } from 'react';
import { Card } from '../../components/common/Card';
import { WorkspaceHeader } from '../../components/layout/WorkspaceHeader';

export function PageScaffold({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <WorkspaceHeader title={title} description={description} action={action} />
      {children}
    </>
  );
}

export function MetricCard({ label, value, tone = 'text-ks-navy' }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="p-6">
      <p className="text-xs font-black uppercase tracking-wider text-ks-muted">{label}</p>
      <p className={`mt-2 font-display text-4xl font-bold ${tone}`}>{value}</p>
    </Card>
  );
}
