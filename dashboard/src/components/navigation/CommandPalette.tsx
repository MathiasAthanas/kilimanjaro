import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Kbd } from '../common/Kbd';

const results = [
  { group: 'Navigation', label: 'Profile', to: '/app/profile' },
  { group: 'Navigation', label: 'Settings', to: '/app/settings' },
  { group: 'Navigation', label: 'Notifications', to: '/app/notifications' },
  { group: 'Academics', label: 'Teacher workspace', to: '/teacher' },
  { group: 'Finance', label: 'Finance hub', to: '/finance' },
  { group: 'Reports', label: 'Reports center', to: '/reports' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey && event.key.toLowerCase() === 'k') || event.key === '/') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const filtered = useMemo(
    () => results.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())),
    [query],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-ks-slate/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto mt-24 max-w-2xl overflow-hidden rounded-xl border border-ks-line bg-white shadow-shell">
        <div className="flex items-center gap-3 border-b border-ks-line px-5 py-4">
          <Search className="h-5 w-5 text-ks-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search routes, students, reports, finance..."
            className="flex-1 border-0 bg-transparent text-sm outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-96 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-ks-muted">No results found. Global backend search can be connected later.</p>
          ) : (
            filtered.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-4 py-3 hover:bg-ks-paper"
              >
                <span className="font-bold text-ks-navy">{item.label}</span>
                <span className="text-xs font-bold uppercase tracking-wider text-ks-muted">{item.group}</span>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
