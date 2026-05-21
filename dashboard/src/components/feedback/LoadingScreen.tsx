export function LoadingScreen({ label = 'Loading Kilimanjaro Schools portal...' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-ks-paper">
      <div className="rounded-xl border border-ks-line bg-white p-8 text-center shadow-layer">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ks-mist border-t-ks-blue" />
        <p className="mt-4 text-sm font-bold text-ks-navy">{label}</p>
      </div>
    </div>
  );
}
