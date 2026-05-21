import { AlertTriangle } from 'lucide-react';
import { AdvancedIcon } from '../icons/AdvancedIcon';
import { Button } from './Button';

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-ks-rose/20 bg-white p-10 text-center">
      <AdvancedIcon icon={AlertTriangle} tone="rose" />
      <h3 className="mt-4 font-display text-xl font-bold text-ks-navy">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ks-muted">{message}</p>
      {onRetry ? <Button className="mt-5" variant="secondary" onClick={onRetry}>Try again</Button> : null}
    </div>
  );
}
