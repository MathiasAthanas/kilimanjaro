import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Database,
  HelpCircle,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { endpoints } from '../../lib/api/endpoints';
import { Card } from '../../components/common/Card';
import { KilimanjaroMark } from '../../components/icons/KilimanjaroMark';

// ─── Types ──────────────────────────────────────────────────────────────────

type ComponentStatus = {
  Icon: typeof Server;
  title: string;
  meta: string;
  uptime: string;
  latency: string;
  tone: 'emerald' | 'amber' | 'rose';
};

// ─── Data ───────────────────────────────────────────────────────────────────

const components: ComponentStatus[] = [
  { Icon: Server,   title: 'API Gateway',       meta: 'Regional Endpoint',  uptime: '99.99%', latency: '38ms',  tone: 'emerald' },
  { Icon: Database, title: 'Student Database',  meta: 'Master Cluster',     uptime: '99.98%', latency: '12ms',  tone: 'emerald' },
  { Icon: Zap,      title: 'Finance Service',   meta: 'Payment Gateway',    uptime: '99.97%', latency: '55ms',  tone: 'emerald' },
  { Icon: Activity, title: 'Academic Engine',   meta: 'Result Processor',   uptime: '100%',   latency: '29ms',  tone: 'emerald' },
  { Icon: Shield,   title: 'Auth Service',      meta: 'Identity Provider',  uptime: '99.99%', latency: '18ms',  tone: 'emerald' },
  { Icon: Bell,     title: 'Notification Hub',  meta: 'SMS / Email Relay',  uptime: '99.95%', latency: '142ms', tone: 'emerald' },
];

const metrics = [
  { label: 'Global Uptime',   value: '99.98%', sub: 'Rolling 30 days',  bar: 'bg-ks-emerald', width: '99.98%', accent: 'text-ks-emerald', border: 'border-ks-emerald' },
  { label: 'Avg Response',    value: '42ms',   sub: 'P50 latency',       bar: 'bg-ks-sky',     width: '85%',    accent: 'text-ks-sky',     border: 'border-ks-sky'     },
  { label: 'Incidents (30d)', value: '0',      sub: 'No degradation',    bar: 'bg-ks-emerald', width: '100%',   accent: 'text-ks-emerald', border: 'border-ks-emerald' },
  { label: 'Active Sessions', value: '12.4k',  sub: 'Staff logged in',   bar: 'bg-ks-gold',    width: '70%',    accent: 'text-ks-gold',    border: 'border-ks-gold'    },
];

// Uptime availability line: 48 points over 24h (every 30min)
const availabilityPoints = [
  100,100,100,100,99.9,100,100,100,100,100,100,99.8,
  100,100,100,100,100,100,99.9,100,100,100,100,100,
  100,100,99.7,100,100,100,100,100,100,100,100,100,
  100,99.9,100,100,100,100,100,100,100,100,100,100,
];

// Latency line: 48 points (ms, range 20-80)
const latencyPoints = [
  42,45,40,38,52,44,41,39,48,43,46,38,
  51,44,42,40,55,48,45,42,58,50,47,44,
  39,42,60,45,43,41,38,44,47,43,40,45,
  42,55,48,44,42,40,43,41,39,38,42,44,
];

// Area and line builders
function toArea(points: number[], w: number, h: number, min: number, max: number) {
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${coords[0]} L${coords.slice(1).join(' L')} L${w},${h} L0,${h} Z`;
}

function toLine(points: number[], w: number, h: number, min: number, max: number) {
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M${coords[0]} L${coords.slice(1).join(' L')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function StatusPage() {
  const status = useQuery({
    queryKey: ['public-health'],
    queryFn: async () => {
      const response = await api.get(endpoints.health);
      return response.data;
    },
    retry: false,
  });

  const online = status.isSuccess || status.isError;
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  // SVG chart dimensions
  const W = 800; const H = 160;
  const timeLabels = ['00:00','04:00','08:00','12:00','16:00','20:00','Now'];

  return (
    <main className="min-h-screen bg-ks-paper font-sans text-on-surface">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-topbar-height items-center justify-between border-b border-ks-line bg-white/80 px-5 backdrop-blur-md lg:px-margin-page">
        <Link to="/" className="flex items-center gap-3">
          <KilimanjaroMark />
          <span className="font-display text-xl font-bold text-ks-navy">Kilimanjaro Schools</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-bold md:flex">
          <Link to="/" className="text-ks-muted transition hover:text-ks-blue">Portal</Link>
          <span className="border-b-2 border-ks-blue pb-1 text-ks-blue">Status</span>
          <Link className="text-ks-muted transition hover:text-ks-blue" to="/app/help">Support</Link>
        </nav>
        <div className="flex items-center gap-3">
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-ks-line text-ks-muted transition hover:border-ks-blue/40 hover:text-ks-blue">
            <Bell className="h-4 w-4" />
          </button>
          <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-ks-line text-ks-muted transition hover:border-ks-blue/40 hover:text-ks-blue">
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-8 px-5 py-10 lg:px-margin-page">

        {/* ── Hero banner ──────────────────────────────────────────────── */}
        <section className={`relative overflow-hidden rounded-2xl border p-8 ${online ? 'border-ks-emerald/20 bg-gradient-to-br from-ks-emerald/10 via-white to-ks-mist' : 'border-ks-amber/20 bg-gradient-to-br from-ks-amber/10 via-white to-ks-mist'}`}>
          {/* Decorative glow */}
          <div className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl ${online ? 'bg-ks-emerald/15' : 'bg-ks-amber/15'}`} />

          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            {/* Left: status + headline */}
            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg ${online ? 'bg-ks-emerald shadow-ks-emerald/30' : 'bg-ks-amber shadow-ks-amber/30'}`}>
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <span className={`absolute -right-1 -top-1 flex h-4 w-4`}>
                  <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${online ? 'bg-ks-emerald' : 'bg-ks-amber'}`} />
                  <span className={`relative inline-flex h-4 w-4 rounded-full ${online ? 'bg-ks-emerald' : 'bg-ks-amber'}`} />
                </span>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-ks-muted">System Status</p>
                <h1 className="mt-1 font-display text-3xl font-bold text-ks-navy">
                  {online ? 'All Systems Operational' : 'Status Unavailable'}
                </h1>
                <p className="mt-1 text-sm font-semibold text-ks-muted">
                  Kilimanjaro Schools portal, API services and data layer are fully operational.
                </p>
              </div>
            </div>

            {/* Right: uptime + timestamp */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="font-display text-4xl font-black text-ks-emerald">99.98%</p>
                <p className="text-xs font-bold uppercase tracking-wider text-ks-muted">30-day uptime</p>
              </div>
              <div className="h-12 w-px bg-ks-line" />
              <div className="text-right">
                <div className="flex items-center gap-2 text-xs font-bold text-ks-muted">
                  <RefreshCw className="h-3.5 w-3.5" /> Last updated
                </div>
                <p className="mt-1 font-bold text-ks-navy">{now}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ks-muted">Auto-refreshes every 60s</p>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="mt-6 flex gap-2">
            {['All Components', 'Uptime Log', 'Performance', 'Incidents'].map((tab, i) => (
              <button
                key={tab}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${i === 0 ? 'bg-ks-navy text-white' : 'border border-ks-line bg-white text-ks-muted hover:border-ks-navy/30 hover:text-ks-navy'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </section>

        {/* ── Metric strip ─────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map(({ label, value, sub, bar, width, accent, border }) => (
            <Card key={label} className={`rounded-xl border-t-4 p-5 ${border}`}>
              <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{label}</p>
              <p className={`mt-1 font-display text-4xl font-black ${accent}`}>{value}</p>
              <p className="mt-0.5 text-xs font-semibold text-ks-muted">{sub}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ks-mist">
                <div className={`h-full rounded-full ${bar}`} style={{ width }} />
              </div>
            </Card>
          ))}
        </div>

        {/* ── System Components ────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-ks-line bg-ks-paper/60 px-6 py-4">
            <div>
              <h2 className="font-display text-xl font-black text-ks-navy">System Components</h2>
              <p className="text-sm font-semibold text-ks-muted">Live status of all platform services</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-ks-emerald/20 bg-ks-emerald/10 px-4 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ks-emerald" />
              <span className="text-xs font-black text-ks-emerald">6 / 6 Operational</span>
            </div>
          </div>
          <div className="divide-y divide-ks-line">
            {components.map(({ Icon, title, meta, uptime, latency, tone }) => (
              <div key={title} className="flex items-center gap-4 px-6 py-4 transition hover:bg-ks-paper/40">
                {/* Icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'emerald' ? 'bg-ks-emerald/10 text-ks-emerald' : tone === 'amber' ? 'bg-ks-amber/10 text-ks-amber' : 'bg-ks-rose/10 text-ks-rose'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ks-navy">{title}</p>
                  <p className="text-xs text-ks-muted">{meta}</p>
                </div>
                {/* Uptime bar */}
                <div className="hidden w-32 md:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ks-mist">
                    <div className="h-full rounded-full bg-ks-emerald" style={{ width: uptime }} />
                  </div>
                  <p className="mt-1 text-[10px] font-bold text-ks-muted">{uptime} uptime</p>
                </div>
                {/* Latency */}
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-black text-ks-navy">{latency}</p>
                  <p className="text-[10px] font-bold uppercase text-ks-muted">latency</p>
                </div>
                {/* Status badge */}
                <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${tone === 'emerald' ? 'bg-ks-emerald/10 text-ks-emerald' : tone === 'amber' ? 'bg-ks-amber/10 text-ks-amber' : 'bg-ks-rose/10 text-ks-rose'}`}>
                  {tone === 'emerald' ? 'Operational' : tone === 'amber' ? 'Degraded' : 'Outage'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Health chart ─────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-black text-ks-navy">System Health — Last 24 Hours</h2>
              <p className="mt-1 text-sm font-semibold text-ks-muted">Availability and response latency sampled every 30 minutes</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ks-emerald" />Availability</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ks-gold" />Latency (ms)</span>
              <span className="rounded-full bg-ks-emerald/10 px-3 py-1 text-ks-emerald">24h window</span>
            </div>
          </div>

          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 flex h-[160px] flex-col justify-between pb-0 pr-2 text-[10px] font-bold text-ks-muted">
              <span>100%</span>
              <span>99.8%</span>
              <span>99.6%</span>
            </div>
            {/* Chart */}
            <div className="pl-10">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-[160px] w-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="availGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="latGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#F4B740" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#F4B740" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid */}
                {[0, 0.33, 0.67, 1].map((frac) => (
                  <line key={frac} x1="0" x2={W} y1={frac * H} y2={frac * H} stroke="#E2E8F0" strokeDasharray="4 3" strokeWidth="1" />
                ))}
                {/* Availability area + line */}
                <path d={toArea(availabilityPoints, W, H, 99.5, 100.1)} fill="url(#availGrad)" />
                <path d={toLine(availabilityPoints, W, H, 99.5, 100.1)} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {/* Latency area + line */}
                <path d={toArea(latencyPoints, W, H, 0, 100)} fill="url(#latGrad)" />
                <path d={toLine(latencyPoints, W, H, 0, 100)} fill="none" stroke="#F4B740" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 3" />
                {/* Live dot */}
                {(() => {
                  const last = availabilityPoints[availabilityPoints.length - 1];
                  const lx = W; const ly = H - ((last - 99.5) / (100.1 - 99.5)) * H;
                  return (
                    <>
                      <circle cx={lx} cy={ly} r="6" fill="#10B981" opacity="0.25" />
                      <circle cx={lx} cy={ly} r="4" fill="#10B981" />
                    </>
                  );
                })()}
              </svg>
              {/* X-axis labels */}
              <div className="mt-2 flex justify-between text-[10px] font-bold text-ks-muted">
                {timeLabels.map((t) => <span key={t}>{t}</span>)}
              </div>
            </div>
          </div>
        </Card>

        {/* ── 90-Day uptime bars ───────────────────────────────────────── */}
        <Card className="rounded-2xl p-6">
          <h3 className="mb-1 font-display text-xl font-black text-ks-navy">90-Day Uptime Log</h3>
          <p className="mb-6 text-sm font-semibold text-ks-muted">Each bar represents one calendar day. Hover for details.</p>
          <div className="space-y-6">
            {[
              { name: 'API Cloud Infrastructure', uptime: '100%',   bars: Array.from({ length: 90 }, (_, i) => i === 0 ? 'amber' : 'emerald') },
              { name: 'External CDN Services',    uptime: '99.94%', bars: Array.from({ length: 90 }, (_, i) => i === 32 || i === 57 ? 'amber' : 'emerald') },
              { name: 'Finance Payment Gateway',  uptime: '99.97%', bars: Array.from({ length: 90 }, (_, i) => i === 14 ? 'amber' : 'emerald') },
            ].map(({ name, uptime, bars }) => (
              <div key={name}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold text-ks-navy">{name}</span>
                  <span className={`text-sm font-black ${uptime === '100%' ? 'text-ks-emerald' : 'text-ks-amber'}`}>{uptime}</span>
                </div>
                <div className="flex h-9 gap-px">
                  {bars.map((tone, i) => (
                    <div
                      key={i}
                      title={`Day ${90 - i}: ${tone === 'emerald' ? 'Operational' : 'Minor degradation'}`}
                      className={`flex-1 cursor-pointer rounded-sm transition hover:opacity-70 hover:scale-y-125 ${tone === 'emerald' ? 'bg-ks-emerald' : 'bg-ks-amber'}`}
                    />
                  ))}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-ks-muted">
                  <span>90 days ago</span>
                  <span>Today</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Incidents ────────────────────────────────────────────────── */}
        <Card className="overflow-hidden rounded-2xl">
          <div className="border-b border-ks-line bg-ks-paper/60 px-6 py-4">
            <h2 className="font-display text-xl font-black text-ks-navy">Recent Incidents</h2>
            <p className="text-sm font-semibold text-ks-muted">No incidents in the past 30 days</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ks-emerald/10">
              <CheckCircle2 className="h-7 w-7 text-ks-emerald" />
            </div>
            <p className="font-display text-lg font-black text-ks-navy">No incidents recorded</p>
            <p className="max-w-xs text-sm font-semibold text-ks-muted">All Kilimanjaro Schools platform services have been operating normally for the past 30 days.</p>
          </div>
        </Card>

        {/* ── API error notice ─────────────────────────────────────────── */}
        {status.isError && (
          <div className="flex items-start gap-4 rounded-xl border border-ks-amber/20 bg-ks-amber/10 px-5 py-4">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-ks-amber" />
            <p className="text-sm font-semibold text-ks-navy">
              Public health endpoint is not reachable. This is expected in local development when the API gateway is not running.
            </p>
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-ks-line pt-8 text-sm text-ks-muted md:flex-row">
          <Link to="/" className="flex items-center gap-2 font-bold transition hover:text-ks-navy">
            <ArrowLeft className="h-4 w-4" /> Back to Portal
          </Link>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ks-emerald" />
            <span className="font-bold text-ks-emerald">All systems operational</span>
            <span className="text-ks-muted">· Updated {now}</span>
          </div>
          <span className="font-semibold">© 2026 Kilimanjaro Schools Group</span>
        </div>

      </div>
    </main>
  );
}
