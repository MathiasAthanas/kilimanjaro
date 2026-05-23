import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  GraduationCap,
  Landmark,
  Lock,
  Mail,
  MapPin,
  Phone,
  School,
  Settings,
  Shield,
  TrendingUp,
  User,
  WalletCards,
  Zap,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { KilimanjaroMark } from '../../components/icons/KilimanjaroMark';

const roles = [
  { title: 'Teacher', description: 'Class workspace, marks entry, and attendance tracking with automated reminders.', Icon: User },
  { title: 'HOD', description: 'Approval queue and department analytics for curriculum compliance.', Icon: School },
  { title: 'AQA', description: 'Performance engine and academic alerts to ensure top-tier standards.', Icon: BarChart3 },
  { title: 'Finance', description: 'Invoices, payments, and fee structure management for full fiscal transparency.', Icon: WalletCards },
  { title: 'Principal', description: 'School health overview and executive approvals for high-level operations.', Icon: Landmark },
  { title: 'Admin', description: 'User management and system configuration for the entire digital campus.', Icon: Settings },
] as const;

const modules = [
  { title: 'Academic Quality Assurance', description: 'Automated moderation and standards tracking.', Icon: GraduationCap },
  { title: 'Financial Management', description: 'End-to-end ledger and digital payment gateway.', Icon: WalletCards },
  { title: 'Student Information System', description: '360-degree profiles of every student journey.', Icon: User },
  { title: 'School Governance', description: 'Policy management and digital audit trail.', Icon: Landmark },
] as const;

const stats = [
  { value: '6', label: 'Role workspaces' },
  { value: '8', label: 'Staff access levels' },
  { value: '12+', label: 'Core modules' },
  { value: '100%', label: 'Tanzanian-focused' },
] as const;

export function LandingPage() {
  return (
    <main className="bg-ks-paper text-on-surface">

      {/* ── Nav ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex h-topbar-height items-center justify-between border-b border-ks-line bg-white/80 px-5 backdrop-blur-md lg:px-margin-page">
        <Link to="/" className="flex items-center gap-3">
          <KilimanjaroMark />
          <span className="font-display text-xl font-bold text-ks-navy">Kilimanjaro Schools</span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-bold md:flex">
          <a className="text-ks-blue border-b-2 border-ks-blue pb-1" href="#top">Portal</a>
          <a className="text-ks-muted transition hover:text-ks-blue" href="#roles">Workspaces</a>
          <a className="text-ks-muted transition hover:text-ks-blue" href="#modules">Modules</a>
          <a className="text-ks-muted transition hover:text-ks-blue" href="#security">Security</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button className="flex items-center gap-2">
              Staff Login <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────── */}
      <section id="top" className="relative overflow-hidden px-5 py-20 lg:px-margin-page lg:py-28">
        {/* Full-bleed student photo */}
        <img
          src="/landingpageimage.jpg"
          alt="Kilimanjaro school students"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        {/* Dark navy overlay — strong left, lighter right so photo shows through */}
        <div className="absolute inset-0 bg-gradient-to-r from-ks-navy/90 via-ks-navy/75 to-ks-navy/50" />
        {/* Extra bottom fade for mountain motif */}
        <div className="absolute inset-0 bg-gradient-to-t from-ks-navy/60 via-transparent to-transparent" />
        {/* dot grid texture on top of overlay */}
        <div className="hero-pattern absolute inset-0 opacity-[0.06]" />
        {/* mountain motif */}
        <div className="pointer-events-none absolute bottom-0 left-0 w-full opacity-30">
          <svg viewBox="0 0 1440 200" className="h-auto w-full" fill="none">
            <path d="M0 160L120 145C240 130 480 100 720 110C960 120 1200 170 1320 195L1440 220V220H0V160Z" fill="#0C4A6E" />
            <path d="M0 150L250 80L500 120L750 40L1000 100L1250 20L1440 80" stroke="#F4B740" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          {/* Left copy */}
          <div>
            <h1 className="font-display text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl">
              Kilimanjaro Schools{' '}
              <span className="text-ks-gold">Staff Portal</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/70">
              Everything your team needs, in one place. Manage classes, grades, fees, announcements and more — built around the way your school actually works.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/login">
                <Button className="flex items-center gap-2 bg-ks-gold px-8 py-3.5 text-base text-ks-slate hover:shadow-lg hover:shadow-ks-gold/30">
                  Sign in to your workspace <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right floating cards */}
          <div className="relative hidden h-[500px] lg:block">

            {/* Academics card */}
            <Card className="glass-card absolute right-0 top-0 z-30 w-72 rounded-xl p-6 shadow-xl transition hover:-translate-y-1">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-ks-blue">Academics</span>
                <School className="h-5 w-5 text-ks-blue" />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ks-mist">
                <div className="h-full w-3/4 bg-ks-blue" />
              </div>
              <p className="mt-2 text-xs font-bold text-ks-muted">Syllabus coverage · 75% complete</p>
              <div className="mt-4 flex gap-2">
                {['MR', 'JK', 'AS'].map((initials) => (
                  <div key={initials} className="flex h-8 w-8 items-center justify-center rounded-full bg-ks-mist text-[10px] font-black text-ks-blue ring-2 ring-white">
                    {initials}
                  </div>
                ))}
              </div>
            </Card>

            {/* Finance card */}
            <Card className="absolute bottom-10 right-20 z-40 w-80 rounded-xl border-ks-navy bg-ks-navy p-6 text-white shadow-2xl transition hover:scale-[1.02]">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-ks-mist">Finance</span>
                <WalletCards className="h-5 w-5 text-ks-gold" />
              </div>
              <div className="font-display text-3xl font-bold">TZS 14.2M</div>
              <p className="text-xs font-bold text-ks-mist/70">Collected this week</p>
              <div className="mt-4 flex items-end gap-1" style={{ height: 48 }}>
                {[50, 75, 100, 66, 84].map((h) => (
                  <div key={h} style={{ height: `${h}%` }} className="w-full rounded-t bg-ks-gold" />
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-ks-emerald">
                <TrendingUp className="h-3.5 w-3.5" /> Up 8.4% from last week
              </div>
            </Card>

            {/* Staff performance card */}
            <Card className="glass-card absolute left-10 top-1/4 z-20 w-64 rounded-xl border-l-4 border-l-ks-gold p-5 shadow-lg">
              <div className="mb-4 flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-ks-gold" />
                <span className="text-xs font-black uppercase tracking-wider">Staff Performance</span>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ks-muted">Punctuality</span>
                  <b className="text-ks-emerald">98%</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ks-mist">
                  <div className="h-full w-[98%] bg-ks-emerald" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ks-muted">Entry Efficiency</span>
                  <b className="text-ks-blue">92%</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ks-mist">
                  <div className="h-full w-[92%] bg-ks-blue" />
                </div>
              </div>
            </Card>

            {/* AQA alert pill — new decorative element */}
            <div className="absolute left-16 bottom-28 z-50 flex items-center gap-2 rounded-full border border-ks-rose/20 bg-white px-4 py-2 shadow-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ks-rose" />
              <span className="text-xs font-black text-ks-rose">2 alerts need review</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────── */}
      <section className="border-y border-ks-line bg-white px-5 lg:px-margin-page">
        <div className="mx-auto grid max-w-7xl divide-y divide-ks-line md:grid-cols-4 md:divide-x md:divide-y-0">
          {stats.map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center py-6 text-center">
              <p className="font-display text-4xl font-black text-ks-navy">{value}</p>
              <p className="mt-1 text-sm font-semibold text-ks-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Roles ────────────────────────────────────────── */}
      <section id="roles" className="bg-ks-paper px-5 py-24 lg:px-margin-page">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <span className="inline-block rounded-full bg-ks-blue/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-ks-blue">Workspaces</span>
            <h2 className="mt-4 font-display text-4xl font-bold text-ks-navy">Role-Specific Workspaces</h2>
            <p className="mt-4 text-ks-muted">Tailored desktop environments for high-density school operations across every department.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {roles.map(({ title, description, Icon }) => (
              <div
                key={title}
                className="group rounded-2xl border border-ks-line bg-white p-8 transition-all hover:border-ks-blue hover:shadow-xl"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ks-mist text-ks-blue transition-colors group-hover:bg-ks-blue group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-6 font-display text-2xl font-bold text-ks-navy">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ks-muted">{description}</p>
                <div className="mt-5 h-1 w-12 rounded-full bg-ks-gold" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules ──────────────────────────────────────── */}
      <section id="modules" className="relative overflow-hidden bg-ks-navy px-5 py-24 text-white lg:px-margin-page">
        {/* decorative glow */}
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-ks-blue/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-ks-gold/5 blur-[80px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
          {/* Left copy */}
          <div>
            <span className="inline-block rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-ks-gold">
              Modular architecture
            </span>
            <h2 className="mt-4 font-display text-4xl font-bold">Industrial Grade Modules</h2>
            <p className="mt-5 text-lg leading-8 text-ks-mist/70">
              Modular architecture connects all school functions while maintaining strict data integrity and regulatory compliance.
            </p>
            <div className="mt-8 space-y-3">
              {modules.map(({ title, description, Icon }) => (
                <div
                  key={title}
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ks-gold/20">
                    <Icon className="h-4 w-4 text-ks-gold" />
                  </div>
                  <div>
                    <p className="font-bold">{title}</p>
                    <p className="text-sm text-ks-mist/60">{description}</p>
                  </div>
                  <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-ks-emerald" />
                </div>
              ))}
            </div>
          </div>

          {/* Right: live data panel */}
          <Card className="overflow-hidden rounded-2xl bg-white/95 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-ks-line px-6 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Live dashboard</p>
                <h3 className="font-display text-xl font-black text-ks-navy">Operations overview</h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-ks-emerald/10 px-3 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ks-emerald" />
                <span className="text-[10px] font-black uppercase text-ks-emerald">Live</span>
              </div>
            </div>

            {/* Mini bar chart */}
            <div className="border-b border-ks-line px-6 py-5">
              <p className="mb-3 text-xs font-black uppercase tracking-wider text-ks-muted">Weekly collection (TZS M)</p>
              <div className="flex items-end gap-1.5" style={{ height: 64 }}>
                {[40, 66, 52, 88, 73, 96, 64, 82, 91, 75].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t transition-all ${i === 5 ? 'bg-ks-gold' : 'bg-ks-blue/70'}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-bold text-ks-muted">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'].map((d, i) => <span key={i}>{d}</span>)}
              </div>
            </div>

            {/* Status items */}
            <div className="space-y-2 p-5">
              {[
                { label: 'Marks approval queue', count: '03', tone: 'bg-ks-amber' },
                { label: 'Finance collections', count: 'TZS 14.2M', tone: 'bg-ks-emerald' },
                { label: 'AQA performance alerts', count: '02', tone: 'bg-ks-rose' },
                { label: 'Report card publishing', count: 'Ready', tone: 'bg-ks-blue' },
              ].map(({ label, count, tone }) => (
                <div key={label} className="flex items-center justify-between rounded-xl border border-ks-line bg-ks-paper px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${tone}`} />
                    <span className="text-sm font-bold text-ks-navy">{label}</span>
                  </div>
                  <span className="text-sm font-black text-ks-slate">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* ── Security ─────────────────────────────────────── */}
      <section id="security" className="bg-ks-paper px-5 py-24 text-center lg:px-margin-page">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-ks-blue/10">
            <Lock className="h-8 w-8 text-ks-blue" />
          </div>
          <span className="inline-block rounded-full bg-ks-blue/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-ks-blue">Security</span>
          <h2 className="mt-4 font-display text-4xl font-bold text-ks-navy">Uncompromising Security Architecture</h2>
          <p className="mx-auto mt-4 max-w-xl text-ks-muted">
            Every interaction is secured, logged, and governed by strict access controls designed for educational institutions.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Secure API Gateway',
                Icon: Shield,
                description: 'Bank-grade encryption for every data transaction within the portal.',
                tone: 'bg-ks-blue/10 text-ks-blue',
              },
              {
                title: 'Audit Trails',
                Icon: Zap,
                description: 'Immutable logs of every staff action for complete accountability and governance.',
                tone: 'bg-ks-amber/10 text-ks-amber',
              },
              {
                title: 'RBAC Control',
                Icon: Lock,
                description: 'Granular role-based access to protect sensitive student and financial information.',
                tone: 'bg-ks-emerald/10 text-ks-emerald',
              },
            ].map(({ title, Icon, description, tone }) => (
              <Card key={title} className="rounded-2xl p-7 text-left transition hover:shadow-layer">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold text-ks-navy">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ks-muted">{description}</p>
              </Card>
            ))}
          </div>

        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="bg-ks-navy px-5 py-20 text-center text-white lg:px-margin-page">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-ks-gold">Get started</p>
          <h2 className="mt-4 font-display text-4xl font-bold">Your workspace is ready.</h2>
          <p className="mt-5 text-lg leading-8 text-ks-mist/70">
            Sign in with your staff credentials and pick up right where your school day needs you.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/login">
              <Button className="flex items-center gap-2 bg-ks-gold px-10 py-4 text-base text-ks-slate hover:shadow-lg hover:shadow-ks-gold/30">
                Sign in <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="bg-[#061f33] text-ks-mist/80">
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-margin-page">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <KilimanjaroMark className="h-9 w-9" />
                <span className="font-display text-xl font-bold text-white">Kilimanjaro Schools</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-7 text-ks-mist/60">
                A practical tool for Tanzanian schools — helping teachers, administrators and finance teams do their work with less friction every day.
              </p>
              <div className="mt-6 flex flex-col gap-2.5 text-sm">
                <div className="flex items-center gap-2.5"><MapPin className="h-4 w-4 shrink-0 text-ks-gold" /><span>Kilimanjaro Region, Tanzania</span></div>
                <div className="flex items-center gap-2.5"><Mail className="h-4 w-4 shrink-0 text-ks-gold" /><span>admin@ks.ac.tz</span></div>
                <div className="flex items-center gap-2.5"><Phone className="h-4 w-4 shrink-0 text-ks-gold" /><span>+255 27 000 0000</span></div>
              </div>
            </div>

            {/* Staff portal links */}
            <div>
              <h4 className="mb-5 text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">Staff Portal</h4>
              <ul className="space-y-3 text-sm">
                {[
                  ['Staff Login', '/login'],
                  ['Help & Support', '/app/help'],
                  ['About the Platform', '/app/about'],
                ].map(([label, href]) => (
                  <li key={label}>
                    <Link to={href} className="transition hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Workspaces */}
            <div>
              <h4 className="mb-5 text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">Workspaces</h4>
              <ul className="space-y-3 text-sm">
                {['Teacher Desk', 'HOD Affairs', 'Finance Hub', 'AQA Engine', 'Principal Command', 'Admin Panel'].map((label) => (
                  <li key={label} className="flex items-center gap-2 text-ks-mist/50">
                    <ExternalLink className="h-3 w-3 shrink-0" />{label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-ks-mist/10 pt-8 text-xs text-ks-mist/40 md:flex-row">
            <span>© 2026 Kilimanjaro Schools Group. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <a href="#" className="transition hover:text-ks-mist/70">Privacy Policy</a>
              <a href="#" className="transition hover:text-ks-mist/70">Terms of Service</a>
              <a href="#" className="transition hover:text-ks-mist/70">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

