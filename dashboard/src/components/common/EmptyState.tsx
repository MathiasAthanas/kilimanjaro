import { Inbox } from 'lucide-react';
import { AdvancedIcon } from '../icons/AdvancedIcon';

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ks-line bg-white p-10 text-center">
      <AdvancedIcon icon={Inbox} tone="blue" />
      <h3 className="mt-4 font-display text-xl font-bold text-ks-navy">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-ks-muted">{message}</p>
    </div>
  );
}
