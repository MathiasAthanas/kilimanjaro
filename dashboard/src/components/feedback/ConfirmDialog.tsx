import { Button } from '../common/Button';

export function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-ks-slate/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-ks-line bg-white p-6 shadow-shell">
        <h2 className="font-display text-2xl font-bold text-ks-navy">{title}</h2>
        <p className="mt-2 text-sm text-ks-muted">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  );
}
