import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function NavItem({ to, icon: Icon, label, end = false }: { to: string; icon: LucideIcon; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 overflow-hidden rounded-lg px-4 py-3 text-sm font-bold transition-all ${
          isActive
            ? 'nav-active-rail bg-ks-mist/10 text-ks-gold'
            : 'text-ks-mist/70 hover:bg-ks-mist/5 hover:text-ks-mist'
        }`
      }
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}
