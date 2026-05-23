import { ServerCrash } from 'lucide-react';
import { Button } from '../common/Button';

interface DataErrorProps {
  message?: string;
  onRetry?: () => void;
}

/** Shown inside a page section when an API call fails. */
export function DataError({
  message = 'We couldn\'t load this data. The server may be unavailable.',
  onRetry,
}: DataErrorProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-ks-rose/30 bg-ks-rose/5 p-8 text-center">
      <ServerCrash className="h-8 w-8 text-ks-rose/70" />
      <p className="max-w-sm text-sm font-bold text-ks-slate">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
