import { Headphones, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { helpCards } from './mockData';

export function HelpPage() {
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
          <input className="flex-1 border-0 bg-transparent outline-none" placeholder="Search support center..." />
          <Search className="h-5 w-5 text-ks-blue" />
        </div>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        {helpCards.map((card) => <Card key={card.title} className="p-6 transition hover:border-ks-blue hover:shadow-layer"><AdvancedIcon icon={card.icon} /><h2 className="mt-4 font-display text-xl font-bold text-ks-navy">{card.title}</h2><p className="mt-2 text-sm text-ks-muted">{card.text}</p><button className="mt-5 text-sm font-bold text-ks-blue">Open guide</button></Card>)}
      </div>
      <Card className="mt-6 flex items-center gap-4 p-6"><AdvancedIcon icon={Headphones} tone="emerald" /><div><h2 className="font-display text-xl font-bold text-ks-navy">Contact system administrator</h2><p className="text-sm text-ks-muted">For urgent access issues, contact the Kilimanjaro Schools IT desk.</p></div></Card>
    </div>
  );
}
