import { Bell, ChevronDown, HelpCircle, Menu, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../lib/auth/authStore';
import { Avatar } from '../common/Avatar';
import { Kbd } from '../common/Kbd';

type TopCommandBarProps = {
  onMenuToggle?: () => void;
};

export function TopCommandBar({ onMenuToggle }: TopCommandBarProps) {
  const session = useAuthStore((state) => state.session);

  return (
    <header className="sticky top-0 z-50 flex h-topbar-height items-center justify-between border-b border-ks-line bg-surface/80 px-5 backdrop-blur-md lg:px-margin-page">
      <div className="flex min-w-0 items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="flex items-center justify-center rounded-lg p-2 text-ks-navy transition hover:bg-ks-mist/20 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <button className="hidden items-center gap-2 rounded-lg border border-ks-line bg-white px-3 py-1.5 text-sm font-bold text-ks-navy transition hover:bg-ks-paper md:flex">
          Term 1, 2026
          <ChevronDown className="h-3.5 w-3.5 text-ks-muted" />
        </button>
        <div className="hidden h-6 w-px bg-ks-line md:block" />
        <Link to="/app/search" className="flex min-w-0 items-center gap-3 text-sm font-bold text-ks-muted transition hover:text-ks-navy">
          <Search className="h-5 w-5" />
          <span className="hidden truncate sm:block">Search schools, staff or students...</span>
          <Kbd>Ctrl K</Kbd>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/app/notifications" className="relative rounded-full p-2 text-ks-navy transition hover:bg-ks-mist/40" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-white bg-ks-rose" />
        </Link>
        <Link to="/app/help" className="rounded-full p-2 text-ks-navy transition hover:bg-ks-mist/40" aria-label="Help">
          <HelpCircle className="h-5 w-5" />
        </Link>
        <div className="hidden h-8 w-px bg-ks-line md:block" />
        <Link to="/app/profile" className="flex items-center gap-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-bold text-ks-navy">{session?.user.name ?? 'Staff User'}</p>
            <p className="text-[10px] text-ks-muted">{session?.user.role ?? 'Operational Staff'}</p>
          </div>
          <Avatar name={session?.user.name ?? 'Staff User'} />
        </Link>
      </div>
    </header>
  );
}
