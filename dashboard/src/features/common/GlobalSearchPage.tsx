import { Search, SearchX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { useSearch } from './common.hooks';
import { PageScaffold } from './PageScaffold';

type SearchResult = { type: string; title: string; meta: string; to: string };

const FILTERS = ['All', 'Students', 'Classes', 'Finance', 'Announcements', 'Help'] as const;

export function GlobalSearchPage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const { data: apiResults } = useSearch(query) as { data: SearchResult[] | undefined };
  const results: SearchResult[] = apiResults ?? [];

  const filtered = activeFilter === 'All'
    ? results
    : results.filter((r) => r.type === activeFilter);

  return (
    <PageScaffold
      title={query.length > 2 ? `Search Results for "${query}"` : 'Search'}
      description="Global staff search across students, classes, reports, announcements and help."
    >
      <div className="mb-6 flex max-w-2xl items-center gap-3 rounded-full border border-ks-line bg-white px-4 py-3 shadow-sm transition focus-within:scale-[1.01] focus-within:ring-2 focus-within:ring-ks-blue/20">
        <Search className="h-5 w-5 text-ks-muted" />
        <input
          className="flex-1 border-0 bg-transparent outline-none"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything…"
          autoFocus
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit p-5">
          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Filter Results</p>
          <div className="mt-3 flex flex-col gap-1">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${
                  filter === activeFilter ? 'bg-ks-mist text-ks-blue' : 'text-ks-muted hover:bg-ks-paper hover:text-ks-navy'
                }`}
              >
                {filter}
                {filter === activeFilter ? (
                  <span className="rounded-full bg-ks-blue px-2 py-0.5 text-[10px] font-extrabold text-white">{filtered.length}</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-ks-line bg-ks-paper p-4 text-center">
            <SearchX className="mx-auto h-8 w-8 text-ks-muted" />
            <p className="mt-2 text-xs font-bold text-ks-muted">
              {query.length > 2
                ? `${results.length} result${results.length !== 1 ? 's' : ''} found.`
                : 'Type 3+ characters to search.'}
            </p>
          </div>
        </Card>
        <div className="grid gap-3">
          {query.length <= 2 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Search className="mb-4 h-10 w-10 text-ks-muted/40" />
              <p className="font-bold text-ks-muted">Start typing to search</p>
              <p className="mt-1 text-sm text-ks-muted/60">Search across students, classes, reports, and announcements.</p>
            </div>
          )}
          {query.length > 2 && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <SearchX className="mb-4 h-10 w-10 text-ks-muted/40" />
              <p className="font-bold text-ks-muted">No results for &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-sm text-ks-muted/60">Try a different search term.</p>
            </div>
          )}
          {filtered.map((result) => (
            <Link key={`${result.type}-${result.title}`} to={result.to}>
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
