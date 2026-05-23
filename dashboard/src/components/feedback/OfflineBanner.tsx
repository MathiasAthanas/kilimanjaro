import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Sticky top banner shown when the browser loses network connectivity. */
export function OfflineBanner() {
  const online = useNetworkStatus();
  if (online) return null;
  return (
    <div className="sticky top-0 z-[9999] flex items-center gap-3 bg-ks-rose px-5 py-2.5 text-white shadow-md lg:px-margin-page">
      <WifiOff className="h-4 w-4 shrink-0" />
      <p className="text-sm font-bold">
        You&apos;re offline — we can&apos;t reach the server right now. Check your connection and try again.
      </p>
    </div>
  );
}
