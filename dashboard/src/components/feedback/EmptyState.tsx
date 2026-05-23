import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import { Button } from '../common/Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  Icon?: LucideIcon;
  action?: { label: string; onClick: () => void } | { label: string; href: string };
}

/** Shown when a list or data area loads successfully but returns zero records. */
export function EmptyState({
  title = 'Nothing here yet',
  description = 'Records will appear here once they are created.',
  Icon = Inbox,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ks-line bg-ks-paper px-8 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ks-mist">
        <Icon className="h-5 w-5 text-ks-muted" />
      </div>
      <p className="text-sm font-bold text-ks-slate">{title}</p>
      <p className="max-w-xs text-xs font-semibold text-ks-muted">{description}</p>
      {action && (
        'href' in action ? (
          <a href={action.href}>
            <Button variant="secondary" className="mt-1">{action.label}</Button>
          </a>
        ) : (
          <Button variant="secondary" className="mt-1" onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
}
