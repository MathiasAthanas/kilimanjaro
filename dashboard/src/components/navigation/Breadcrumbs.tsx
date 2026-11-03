import { Link, useLocation } from 'react-router-dom';

// Record ids in the URL (uuids, long hex strings, numeric ids) mean nothing to a person.
const isRecordId = (part: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part) || /^\d{4,}$/.test(part) || /^[0-9a-f]{20,}$/i.test(part);

export function Breadcrumbs() {
  const parts = useLocation().pathname.split('/').filter(Boolean).slice(1).filter((part) => !isRecordId(part));
  return (
    <nav className="text-xs font-bold uppercase tracking-wider text-ks-muted" aria-label="Breadcrumb">
      <Link to="/app" className="hover:text-ks-blue">App</Link>
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          <span className="mx-2 text-ks-muted/40">/</span>
          <span className="capitalize text-ks-navy">{part.replaceAll('-', ' ')}</span>
        </span>
      ))}
    </nav>
  );
}
