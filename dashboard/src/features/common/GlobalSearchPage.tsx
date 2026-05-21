import { Search, SearchX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { searchResults } from './mockData';
import { PageScaffold } from './PageScaffold';

export function GlobalSearchPage() {
  return (
    <PageScaffold title='Search Results for "Standard 7"' description="Global staff search across students, classes, reports, announcements and help.">
      <div className="mb-6 flex max-w-2xl items-center gap-3 rounded-full border border-ks-line bg-white px-4 py-3 shadow-sm transition focus-within:scale-[1.01] focus-within:ring-2 focus-within:ring-ks-blue/20">
        <Search className="h-5 w-5 text-ks-muted" />
        <input className="flex-1 border-0 bg-transparent outline-none" defaultValue="Standard 7" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-5">
          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Filter Results</p>
          <div className="mt-3 flex flex-col gap-1">
            {['All', 'Students', 'Classes', 'Finance', 'Announcements', 'Help'].map((filter, index) => (
              <button
                key={filter}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${
                  index === 0 ? 'bg-ks-mist text-ks-blue' : 'text-ks-muted hover:bg-ks-paper hover:text-ks-navy'
                }`}
              >
                {filter}
                {index === 0 ? <span className="rounded-full bg-ks-blue px-2 py-0.5 text-[10px] font-extrabold text-white">{searchResults.length}</span> : null}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-ks-line bg-ks-paper p-4 text-center">
            <SearchX className="mx-auto h-8 w-8 text-ks-muted" />
            <p className="mt-2 text-xs font-bold text-ks-muted">Global backend search available once API is connected.</p>
          </div>
        </Card>
        <div className="grid gap-3">
          {searchResults.map((result) => (
            <Link key={result.title} to={result.to}>
              <Card className="flex items-center justify-between p-5 transition hover:border-ks-blue hover:shadow-layer">
                <div>
                  <Badge tone="blue">{result.type}</Badge>
                  <h3 className="mt-2 font-display text-xl font-bold text-ks-navy">{result.title}</h3>
                  <p className="text-sm text-ks-muted">{result.meta}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-ks-blue">Open →</span>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </PageScaffold>
  );
}
