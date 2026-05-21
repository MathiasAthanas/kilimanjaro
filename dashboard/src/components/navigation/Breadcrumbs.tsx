import { Link, useLocation } from 'react-router-dom';

export function Breadcrumbs() {
  const parts = useLocation().pathname.split('/').filter(Boolean);
  return (
    <nav className="text-xs font-bold uppercase tracking-wider text-ks-muted" aria-label="Breadcrumb">
      <Link to="/app" className="hover:text-ks-blue">App</Link>
      {parts.slice(1).map((part, index) => (
        <span key={`${part}-${index}`}>
          <span className="mx-2 text-ks-muted/40">/</span>
          <span className="capitalize text-ks-navy">{part.replaceAll('-', ' ')}</span>
        </span>
      ))}
    </nav>
  );
}
