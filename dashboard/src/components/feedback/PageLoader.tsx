/** Inline circular loader — centred in its container, not full-screen. */
export function PageLoader({ label = 'Loading data…' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-4 py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-ks-mist border-t-ks-blue" />
      <p className="text-sm font-bold text-ks-muted">{label}</p>
    </div>
  );
}
