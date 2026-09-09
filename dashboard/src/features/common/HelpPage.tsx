import { Bell, BookOpen, CreditCard, Headphones, Search, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';

const HELP_CARDS = [
  { title: 'Login and security', text: 'Password reset, session expiry, account lock and device access.', icon: ShieldAlert },
  { title: 'Academic workflows', text: 'Marks entry, HOD approval, results publishing and report cards.', icon: BookOpen },
  { title: 'Finance workflows', text: 'Payments, receipts, invoices, statements and collections reports.', icon: CreditCard },
  { title: 'Notifications', text: 'Announcements, unread alerts, preferences and message delivery.', icon: Bell },
];

export function HelpPage() {
  const [query, setQuery] = useState('');

  const filteredCards = query.trim().length > 1
    ? HELP_CARDS.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.text.toLowerCase().includes(query.toLowerCase()),
      )
    : HELP_CARDS;

  return (
    <div>
      <nav className="mb-6 text-xs font-bold uppercase tracking-wider text-ks-muted">
        <Link to="/app" className="hover:text-ks-blue">App</Link>
        <span className="mx-2 text-ks-muted/40">/</span>
        <span className="capitalize text-ks-navy">Help &amp; Support</span>
      </nav>
      <section className="relative mb-8 overflow-hidden rounded-2xl bg-ks-navy p-8 text-white">
        <div className="absolute right-[-80px] top-[-80px] h-64 w-64 rounded-full bg-ks-blue/20 blur-[80px]" />
        <h1 className="font-display text-4xl font-bold text-ks-mist">How can we help you today?</h1>
        <p className="mt-3 text-ks-mist/70">Search by topic, feature, or error code.</p>
        <div className="mt-8 flex max-w-2xl items-center gap-3 rounded-xl bg-white px-5 py-4 text-ks-navy shadow-xl">
          <input
            className="flex-1 border-0 bg-transparent outline-none"
            placeholder="Search support center..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search className="h-5 w-5 text-ks-blue" />
        </div>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        {filteredCards.map((card) => (
          <Card key={card.title} className="p-6 transition hover:border-ks-blue hover:shadow-layer">
            <AdvancedIcon icon={card.icon} />
            <h2 className="mt-4 font-display text-xl font-bold text-ks-navy">{card.title}</h2>
            <p className="mt-2 text-sm text-ks-muted">{card.text}</p>
            <button className="mt-5 text-sm font-bold text-ks-blue">Open guide</button>
          </Card>
        ))}
        {filteredCards.length === 0 && (
          <div className="col-span-2 py-12 text-center">
            <p className="font-bold text-ks-muted">No topics match &ldquo;{query}&rdquo;</p>
            <p className="mt-1 text-sm text-ks-muted/60">Try a broader search or contact the system administrator below.</p>
          </div>
        )}
      </div>
      <Card className="mt-6 flex items-center gap-4 p-6">
        <AdvancedIcon icon={Headphones} tone="emerald" />
        <div>
          <h2 className="font-display text-xl font-bold text-ks-navy">Contact system administrator</h2>
          <p className="text-sm text-ks-muted">For urgent access issues, contact the Kilimanjaro Schools IT desk.</p>
        </div>
      </Card>
    </div>
  );
}
