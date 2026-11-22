import { LineChart } from '../../analytics/components/Charts';
import { useRollCallHistory } from '../api/boarding.hooks';

/** Uses recorded sessions only; missing sessions are not rendered as zero attendance. */
export function BoardingRollCallTrend() {
  const history = useRollCallHistory();
  if (history.isLoading || history.isError) return <section className="rounded-2xl border border-ks-line bg-white p-5 text-sm text-ks-muted">{history.isError ? 'Roll-call trend is unavailable.' : 'Loading roll-call trend…'}</section>;
  const byDate = new Map<string, { present: number; total: number }>();
  for (const row of history.data ?? []) {
    const date = row.date.slice(0, 10);
    const current = byDate.get(date) ?? { present: 0, total: 0 };
    current.present += row.present;
    current.total += row.total;
    byDate.set(date, current);
  }
  const days = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-7);
  if (!days.length) return <section className="rounded-2xl border border-ks-line bg-white p-5"><h3 className="font-display text-lg font-black text-ks-navy">Roll-call attendance trend</h3><p className="mt-2 text-sm text-ks-muted">Record a morning or evening roll call to see the daily trend.</p></section>;
  return <LineChart title="Roll-call attendance trend" subtitle="Present students as a percentage of recorded morning and evening sessions · last seven recorded dates" values={days.map(([, count]) => count.total ? Math.round(count.present / count.total * 100) : 0)} labels={days.map(([date]) => date.slice(5))} />;
}
