import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, ChevronRight,
  Globe2, LayoutGrid, Table2, TrendingDown, TrendingUp, UserCheck,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import {
  formatTZS,
  SCHOOL_GENDER_LABELS,
  SCHOOL_TYPE_LABELS,
  useAdminUsers,
  useAppointHeadOfFinanceMutation,
  useGroupFinance,
  useGroupOverview,
  useMemberships,
  useSchools,
  type SchoolScorecard,
} from '../api/manager.hooks';
import { useGenerateReportMutation, downloadReportWhenReady } from '../../operations/api/operations.hooks';
import { useReportsList } from '../../analytics/api/analytics.hooks';
import { SchoolGallery } from '../components/SchoolGallery';
import { FundRequestBoard, FundRequestDetailView } from '../../finance/components/FundRequestBoard';

// ─── Shared shell (mirrors the finance design language) ──────────────────────

export function ManagerWorkspaceShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name ?? 'Group Manager';
  const { data: overview } = useGroupOverview();
  const totals = overview?.totals;

  return (
    <div className="min-h-[calc(100vh-80px)] space-y-gutter bg-[#f7f9fb]">
      <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-[#d5dde6]">
          <div className="absolute inset-0 bg-[linear-gradient(105deg,#f7f9fb_0%,#eef5f8_40%,#dce9f0_100%)]" />
          <div className="relative grid gap-6 p-7 xl:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-full w-1 self-stretch rounded-full bg-[#00334f]" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">{eyebrow}</p>
                <h1 className="mt-1 font-display text-[38px] font-black leading-tight tracking-[-0.025em] text-[#00334f]">{title}</h1>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">{userName} · Group Command</p>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-2 xl:pt-1">
              <HeaderStat label="Schools" value={String(totals?.schools ?? '—')} />
              <HeaderStat label="Students" value={String(totals?.students ?? '—')} />
              <HeaderStat label="Collection" value={totals?.collectionRate != null ? `${totals.collectionRate}%` : '—'} danger={(totals?.collectionRate ?? 100) < 70} />
              <HeaderStat label="Acad. Mean" value={totals?.academicMean != null ? `${totals.academicMean}%` : '—'} />
            </div>
          </div>
        </div>
        {action && <div className="flex items-center justify-end gap-2 bg-[#f7f9fb] px-5 py-3">{action}</div>}
      </section>
      {children}
    </div>
  );
}

function HeaderStat({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="min-w-[104px] rounded border border-[#d5dde6] bg-white px-4 py-3 text-center">
      <p className="text-[9px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black tabular-nums ${danger ? 'text-[#e11d48]' : 'text-[#00334f]'}`}>{value}</p>
    </div>
  );
}

export function ManagerBreadcrumb({ crumbs }: { crumbs: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
      {crumbs.map((crumb, i) => (
        <span key={crumb.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-[#c1c7cf]" />}
          {crumb.to ? (
            <NavLink to={crumb.to} className="text-[#64748b] transition hover:text-[#00334f]">{crumb.label}</NavLink>
          ) : (
            <span className="text-[#00334f]">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Entering a school = set the active-school scope, then use the Head-of-School portal. */
export function useEnterSchool() {
  const navigate = useNavigate();
  const setActiveSchool = useSchoolStore((s) => s.setActiveSchool);
  return (school: Pick<SchoolScorecard, 'id' | 'name' | 'code' | 'type' | 'gender'>) => {
    setActiveSchool({ id: school.id, name: school.name, code: school.code, type: school.type, gender: school.gender });
    toast(`Now viewing ${school.name}`, 'success');
    navigate('/principal');
  };
}

// ─── Landing: School Gallery ──────────────────────────────────────────────────

export function ManagerGalleryPage() {
  const navigate = useNavigate();
  const enterSchool = useEnterSchool();
  const setActiveSchool = useSchoolStore((s) => s.setActiveSchool);
  const { data, isLoading, isError, refetch } = useGroupOverview();

  return (
    <ManagerWorkspaceShell title="Kilimanjaro Schools Group" eyebrow="Choose where to work today">
      <ManagerBreadcrumb crumbs={[{ label: 'Group' }, { label: 'Schools' }]} />
      {isLoading ? <SkeletonTable cols={4} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <SchoolGallery
          schools={data.schools}
          groupStats={{ students: data.totals.students, collectionRate: data.totals.collectionRate, academicMean: data.totals.academicMean }}
          onOpenGroup={() => { setActiveSchool(null); navigate('/manager/overview'); }}
          onOpenSchool={enterSchool}
        />
      )}
    </ManagerWorkspaceShell>
  );
}

// ─── Group Dashboard (the cockpit) ────────────────────────────────────────────

function MetricCard({ label, value, detail, tone, trend, progress }: {
  label: string; value: string; detail: string;
  tone: 'navy' | 'green' | 'red' | 'gold' | 'slate';
  trend?: 'up' | 'down'; progress?: number;
}) {
  const rail =
    tone === 'green' ? 'border-l-[#10b981]' :
    tone === 'red'   ? 'border-l-[#e11d48]' :
    tone === 'gold'  ? 'border-l-[#d59a1b]' :
    tone === 'slate' ? 'border-l-[#64748b]' : 'border-l-[#00334f]';
  const trendColor = tone === 'red' ? 'text-[#e11d48]' : tone === 'green' ? 'text-[#10b981]' : 'text-[#64748b]';
  return (
    <div className={`rounded-lg border border-[#d5dde6] border-l-4 bg-white p-6 ${rail}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">{label}</p>
      <p className="mt-2 font-mono text-[32px] font-black leading-none tabular-nums text-[#0f172a]">{value}</p>
      <div className="mt-2 flex items-center gap-1">
        {trend === 'up' && <TrendingUp className={`h-3.5 w-3.5 ${trendColor}`} />}
        {trend === 'down' && <TrendingDown className={`h-3.5 w-3.5 ${trendColor}`} />}
        <p className={`text-xs font-bold ${trendColor}`}>{detail}</p>
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 rounded-full bg-[#e2e8f0]">
          <div className={`h-full rounded-full ${tone === 'red' ? 'bg-[#e11d48]' : tone === 'green' ? 'bg-[#10b981]' : 'bg-[#00334f]'}`} style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  );
}

function CompareBars({ schools }: { schools: SchoolScorecard[] }) {
  const [metric, setMetric] = useState<'academicMean' | 'collectionRate' | 'attendanceRate'>('academicMean');
  const labels: Record<string, string> = { academicMean: 'Academic Mean', collectionRate: 'Collection Rate', attendanceRate: 'Attendance' };
  const enterSchool = useEnterSchool();
  const rows = schools.filter((s) => s.isActive);
  const max = Math.max(1, ...rows.map((s) => Number(s[metric] ?? 0)));
  return (
    <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">School Comparison</p>
        <div className="flex gap-1.5">
          {(Object.keys(labels) as Array<typeof metric>).map((key) => (
            <button key={key} onClick={() => setMetric(key)}
              className={`rounded-full border px-3 py-1 text-[11px] font-black transition ${metric === key ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#d5dde6] bg-[#f7f9fb] text-[#334155] hover:border-[#00334f]/40'}`}>
              {labels[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {rows.map((school) => {
          const value = Number(school[metric] ?? 0);
          return (
            <button key={school.id} onClick={() => enterSchool(school)} className="block w-full text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-[#00334f] hover:underline">{school.name}</span>
                <span className="font-mono font-black text-[#0f172a]">{school[metric] != null ? `${value}%` : '—'}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-[#eef2f6]">
                <div className={`h-full rounded-full transition-all ${value >= 75 ? 'bg-[#10b981]' : value >= 55 ? 'bg-[#0284c7]' : 'bg-[#e11d48]'}`} style={{ width: `${(value / max) * 100}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ManagerOverviewPage() {
  const { data, isLoading, isError, refetch } = useGroupOverview();
  const enterSchool = useEnterSchool();

  return (
    <ManagerWorkspaceShell title="Group Dashboard" eyebrow="Every school at a glance"
      action={<NavLink to="/manager"><Button variant="secondary" className="rounded py-2 text-xs"><LayoutGrid className="h-3.5 w-3.5" /> School Gallery</Button></NavLink>}>
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: '/manager' }, { label: 'Dashboard' }]} />
      {isLoading ? <SkeletonTable cols={4} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Enrolment" value={String(data.totals.students)} detail={`across ${data.totals.schools} schools`} tone="navy" trend="up" />
            <MetricCard label="Collection Rate" value={data.totals.collectionRate != null ? `${data.totals.collectionRate}%` : '—'} detail={`${formatTZS(data.totals.collected)} of ${formatTZS(data.totals.invoiced)}`} tone={(data.totals.collectionRate ?? 0) >= 75 ? 'green' : 'gold'} progress={data.totals.collectionRate ?? 0} />
            <MetricCard label="Academic Mean" value={data.totals.academicMean != null ? `${data.totals.academicMean}%` : '—'} detail="enrolment-weighted, published marks" tone="navy" />
            <MetricCard label="Needs Attention" value={String(data.totals.needingAttention)} detail={`${data.totals.atRisk} students flagged at risk`} tone={data.totals.needingAttention > 0 ? 'red' : 'green'} trend={data.totals.needingAttention > 0 ? 'down' : 'up'} />
          </div>

          <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
            <CompareBars schools={data.schools} />
            <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Schools Needing Attention</p>
              {data.attention.length === 0 ? (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-[#f0fdf9] p-4">
                  <BadgeCheck className="h-5 w-5 text-[#10b981]" />
                  <p className="text-sm font-bold text-emerald-800">Every school is healthy. Nothing needs you right now.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.attention.map((item) => {
                    const school = data.schools.find((s) => s.id === item.id);
                    return (
                      <div key={item.id} className="rounded-xl border border-[#e2e8f0] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-black text-[#00334f]">{item.name}</p>
                          <Badge tone={item.health === 'CRITICAL' ? 'rose' : 'amber'}>{item.health}</Badge>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {item.reasons.map((reason) => (
                            <li key={reason} className="flex items-center gap-1.5 text-xs font-semibold text-[#64748b]">
                              <AlertTriangle className="h-3 w-3 text-[#d59a1b]" /> {reason}
                            </li>
                          ))}
                        </ul>
                        {school && (
                          <button onClick={() => enterSchool(school)} className="mt-2 flex items-center gap-1 text-xs font-black text-[#00334f] hover:underline">
                            Open school <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <ScorecardTable schools={data.schools} />
        </>
      )}
    </ManagerWorkspaceShell>
  );
}

// ─── Scorecards ───────────────────────────────────────────────────────────────

function ScorecardTable({ schools }: { schools: SchoolScorecard[] }) {
  const enterSchool = useEnterSchool();
  const [sortKey, setSortKey] = useState<keyof SchoolScorecard>('students');
  const sorted = useMemo(
    () => [...schools].sort((a, b) => Number(b[sortKey] ?? 0) - Number(a[sortKey] ?? 0)),
    [schools, sortKey],
  );
  const headers: Array<[string, keyof SchoolScorecard]> = [
    ['Students', 'students'], ['Capacity Fill', 'capacityFillPct'], ['Acad. Mean', 'academicMean'],
    ['Collection', 'collectionRate'], ['Outstanding', 'outstanding'], ['Attendance', 'attendanceRate'], ['At Risk', 'atRisk'],
  ];
  return (
    <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef2f6] px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]"><Table2 className="h-3.5 w-3.5" /> School Scorecards</h2>
        <p className="text-[11px] font-bold text-[#94a3b8]">Click a column to sort · click a school to enter it</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: 980 }}>
          <thead className="bg-[#eef5f8]">
            <tr>
              <th className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">School</th>
              {headers.map(([label, key]) => (
                <th key={label} className="cursor-pointer border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f] hover:text-[#0284c7]" onClick={() => setSortKey(key)}>
                  {label}{sortKey === key ? ' ↓' : ''}
                </th>
              ))}
              <th className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {sorted.map((s) => (
              <tr key={s.id} className="cursor-pointer bg-white transition even:bg-[#f7f9fb] hover:bg-[#eef5f8]" onClick={() => enterSchool(s)}>
                <td className="px-4 py-3">
                  <p className="font-black text-[#00334f]">{s.name}</p>
                  <p className="text-[11px] font-bold text-[#64748b]">{SCHOOL_TYPE_LABELS[s.type]} · {SCHOOL_GENDER_LABELS[s.gender]}</p>
                </td>
                <td className="px-4 py-3 font-mono font-black tabular-nums">{s.students}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{s.capacityFillPct != null ? `${s.capacityFillPct}%` : '—'}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{s.academicMean != null ? `${s.academicMean}%` : '—'}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{s.collectionRate != null ? `${s.collectionRate}%` : '—'}</td>
                <td className="px-4 py-3 font-mono tabular-nums text-[#d97706]">{formatTZS(s.outstanding)}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{s.attendanceRate != null ? `${s.attendanceRate}%` : '—'}</td>
                <td className="px-4 py-3 font-mono tabular-nums">{s.atRisk}</td>
                <td className="px-4 py-3"><Badge tone={s.health === 'GOOD' ? 'emerald' : s.health === 'WATCH' ? 'amber' : 'rose'}>{s.health}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ManagerSchoolsPage() {
  const { data, isLoading, isError, refetch } = useGroupOverview();
  return (
    <ManagerWorkspaceShell title="School Scorecards" eyebrow="Compare every school side by side">
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: '/manager' }, { label: 'Scorecards' }]} />
      {isLoading ? <SkeletonTable cols={8} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <ScorecardTable schools={data.schools} />
      )}
    </ManagerWorkspaceShell>
  );
}

// ─── Group Finance (shared with Head of Finances) ─────────────────────────────

export function GroupFinancePage() {
  const { data, isLoading, isError, refetch } = useGroupFinance();
  const session = useAuthStore((s) => s.session);
  const isManager = session?.user.role === 'MANAGER' || session?.user.role === 'SUPER_ADMIN';

  return (
    <ManagerWorkspaceShell title="Group Finance" eyebrow="Every shilling, every school">
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: isManager ? '/manager' : '/finance-group' }, { label: 'Finance' }]} />
      {isLoading ? <SkeletonTable cols={5} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Invoiced" value={formatTZS(data.totals.invoiced)} detail="all schools, all terms" tone="navy" />
            <MetricCard label="Collected" value={formatTZS(data.totals.collected)} detail="confirmed payments" tone="green" trend="up" />
            <MetricCard label="Outstanding" value={formatTZS(data.totals.outstanding)} detail="awaiting payment" tone="red" trend="down" />
            <MetricCard label="Collection Rate" value={data.totals.collectionRate != null ? `${data.totals.collectionRate}%` : '—'} detail="group-wide" tone={(data.totals.collectionRate ?? 0) >= 75 ? 'green' : 'gold'} progress={data.totals.collectionRate ?? 0} />
          </div>

          <div className="grid gap-gutter xl:grid-cols-2">
            <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Collection by Term</p>
              <div className="mt-5 space-y-3">
                {data.trend.map((t) => (
                  <div key={t.termId}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-[#475569]">{t.period}</span>
                      <span className="font-mono font-black text-[#0f172a]">{t.rate}% · {formatTZS(t.collected)}</span>
                    </div>
                    <div className="mt-1 h-2.5 rounded-full bg-[#eef2f6]">
                      <div className="h-full rounded-full bg-[#10b981]" style={{ width: `${t.rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
              <div className="border-b border-[#eef2f6] px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]"><Banknote className="h-3.5 w-3.5" /> Per-School Finance</h2>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-[#eef5f8]">
                  <tr>
                    {['School', 'Invoiced', 'Collected', 'Outstanding', 'Rate'].map((h) => (
                      <th key={h} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0]">
                  {data.bySchool.map((s) => (
                    <tr key={s.id} className="bg-white even:bg-[#f7f9fb]">
                      <td className="px-4 py-3 font-black text-[#00334f]">{s.name}</td>
                      <td className="px-4 py-3 font-mono tabular-nums">{formatTZS(s.invoiced)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#10b981]">{formatTZS(s.collected)}</td>
                      <td className="px-4 py-3 font-mono tabular-nums text-[#d97706]">{formatTZS(s.outstanding)}</td>
                      <td className="px-4 py-3 font-mono font-black tabular-nums">{s.collectionRate != null ? `${s.collectionRate}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          {isManager && <AppointHeadOfFinance />}
        </>
      )}
    </ManagerWorkspaceShell>
  );
}

function AppointHeadOfFinance() {
  const [search, setSearch] = useState('');
  const { data: users = [] } = useAdminUsers(search || undefined);
  const { data: current = [] } = useMemberships({ role: 'HEAD_OF_FINANCE' });
  const appoint = useAppointHeadOfFinanceMutation();
  const activeHof = current.find((m) => m.role === 'HEAD_OF_FINANCE');

  return (
    <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
      <div className="flex items-center gap-2">
        <UserCheck className="h-4 w-4 text-[#00334f]" />
        <h2 className="text-xs font-black uppercase tracking-widest text-[#00334f]">Head of Finances</h2>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#64748b]">
        {activeHof
          ? <>Currently appointed: <span className="font-black text-[#00334f]">{activeHof.user.firstName} {activeHof.user.lastName}</span> — oversees finances across every school.</>
          : 'No Head of Finances appointed yet. Appoint one to give a single person consolidated oversight of all schools’ money.'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a user by name..."
          className="h-11 w-72 rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]"
        />
      </div>
      {search && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {users.slice(0, 6).map((u) => (
            <button
              key={u.id}
              disabled={appoint.isPending}
              onClick={() =>
                appoint.mutate(u.id, {
                  onSuccess: () => { toast(`${u.firstName} ${u.lastName} appointed Head of Finances`, 'success'); setSearch(''); },
                  onError: () => toast('Appointment failed. Try again.', 'error'),
                })
              }
              className="flex items-center justify-between rounded-xl border border-[#d5dde6] bg-[#f7f9fb] px-4 py-3 text-left transition hover:border-[#00334f]"
            >
              <span className="font-bold text-[#00334f]">{u.firstName} {u.lastName}</span>
              <span className="text-xs text-[#64748b]">{u.email ?? u.role}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Report Studio ────────────────────────────────────────────────────────────

const MANAGER_REPORTS: Array<{ type: string; title: string; desc: string; scope: string; perSchool: boolean }> = [
  { type: 'BOARD_EXECUTIVE',     title: 'Group Executive Report', desc: 'Whole-group leadership snapshot — enrolment, academics and finance.', scope: 'group',  perSchool: false },
  { type: 'SCHOOL_OVERVIEW',     title: 'School Overview',        desc: 'A single school’s complete operational picture.',                    scope: 'school', perSchool: true },
  { type: 'FINANCE_COLLECTION',  title: 'Finance Collection',     desc: 'Collection performance and payment methods.',                        scope: 'school', perSchool: true },
  { type: 'OUTSTANDING_BALANCES',title: 'Outstanding Balances',   desc: 'Aging analysis of unpaid fees and defaulters.',                      scope: 'school', perSchool: true },
  { type: 'ATTENDANCE_SUMMARY',  title: 'Attendance Summary',     desc: 'Attendance rates and patterns.',                                     scope: 'school', perSchool: true },
  { type: 'PERFORMANCE_ENGINE',  title: 'Performance Engine',     desc: 'At-risk detection, trends and intervention signals.',                scope: 'school', perSchool: true },
];

function ReportRow({ report, schools }: { report: (typeof MANAGER_REPORTS)[number]; schools: Array<{ id: string; name: string }> }) {
  const generate = useGenerateReportMutation();
  const [schoolId, setSchoolId] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    setBusy(true);
    try {
      const result = (await generate.mutateAsync({
        reportType: report.type,
        scope: report.scope,
        schoolId: report.perSchool && schoolId ? schoolId : undefined,
      })) as Record<string, unknown>;
      await downloadReportWhenReady(String(result.reportId), `${report.title.replace(/\s+/g, '_')}.pdf`);
      toast('Report downloaded', 'success');
    } catch {
      toast('Report generation failed. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e2e8f0] p-4">
      <div className="min-w-[220px]">
        <p className="font-black text-[#00334f]">{report.title}</p>
        <p className="text-xs font-semibold text-[#64748b]">{report.desc}</p>
      </div>
      <div className="flex items-center gap-2">
        {report.perSchool && (
          <select
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="h-10 rounded-xl border border-[#d5dde6] bg-white px-3 text-sm font-semibold outline-none focus:border-[#00334f]"
          >
            <option value="">All schools (group)</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        <Button className="rounded-xl" disabled={busy} onClick={handle}>
          {busy ? 'Generating...' : 'Generate & Download'}
        </Button>
      </div>
    </div>
  );
}

const REPORT_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  GENERATING: { label: 'Generating...', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  READY:      { label: 'Ready',       cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED:     { label: 'Failed',      cls: 'bg-red-50 text-red-700 border-red-200' },
};

function ReportHistoryRow({ r }: { r: { id: string; reportType: string; title: string; status: string; createdAt: string; completedAt?: string } }) {
  const [downloading, setDownloading] = useState(false);
  const cfg = REPORT_STATUS_CONFIG[r.status] ?? { label: r.status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  const createdAt = new Date(r.createdAt).toLocaleString();

  const handleDownload = async () => {
    if (r.status !== 'READY') return;
    setDownloading(true);
    try {
      await downloadReportWhenReady(r.id, `${r.title.replace(/\s+/g, '_')}.pdf`);
    } catch {
      toast('Download failed. The report file may not be available.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3 last:border-0">
      <div className="min-w-[180px]">
        <p className="text-sm font-bold text-[#00334f]">{r.title || r.reportType}</p>
        <p className="text-xs text-[#64748b]">{createdAt}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${cfg.cls}`}>{cfg.label}</span>
        {r.status === 'READY' && (
          <button
            disabled={downloading}
            onClick={handleDownload}
            className="rounded-xl bg-[#00334f] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        )}
      </div>
    </div>
  );
}

export function ManagerReportsPage() {
  const { data: schools = [] } = useSchools() as { data: Array<{ id: string; name: string }> };
  const { data: historyRaw = [], isLoading: histLoading } = useReportsList() as {
    data: Array<{ id: string; reportType: string; title: string; status: string; createdAt: string; completedAt?: string }>;
    isLoading: boolean;
  };
  return (
    <ManagerWorkspaceShell title="Report Studio" eyebrow="Branded PDFs — group or per school">
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: '/manager' }, { label: 'Report Studio' }]} />
      <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Generate a report</p>
        <p className="mt-1 text-sm font-semibold text-[#64748b]">
          Every report is generated live from current data and downloaded as a branded PDF. Leave the school selector on
          "All schools" for a group-wide report, or pick one school to scope it.
        </p>
        <div className="mt-5 space-y-3">
          {MANAGER_REPORTS.map((r) => <ReportRow key={r.type} report={r} schools={schools} />)}
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-[#d5dde6] bg-white">
        <div className="border-b border-[#e2e8f0] px-6 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Report history</p>
          <p className="mt-0.5 text-xs font-semibold text-[#64748b]">All reports you have generated — click Download to retrieve a ready PDF.</p>
        </div>
        {histLoading ? (
          <SkeletonTable cols={3} />
        ) : historyRaw.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-[#64748b]">No reports generated yet.</div>
        ) : (
          <div>
            {historyRaw.map((r) => <ReportHistoryRow key={r.id} r={r} />)}
          </div>
        )}
      </section>
    </ManagerWorkspaceShell>
  );
}

// ─── Manager Fund Approvals (final authority in the approval chain) ───────────

export function ManagerFundApprovalsPage() {
  const session = useAuthStore((s) => s.session);
  const userName = session?.user.name ?? 'Manager';
  return (
    <ManagerWorkspaceShell title="Fund Approvals" eyebrow="Final approval authority — every school">
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: '/manager' }, { label: 'Fund Approvals' }]} />
      <FundRequestBoard role="manager" userName={userName} basePath="/manager/fund-approvals" />
    </ManagerWorkspaceShell>
  );
}

export function ManagerFundApprovalDetailPage() {
  const session = useAuthStore((s) => s.session);
  const userName = session?.user.name ?? 'Manager';
  return (
    <ManagerWorkspaceShell title="Fund Approval" eyebrow="Final approval authority — every school">
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: '/manager' }, { label: 'Fund Approvals', to: '/manager/fund-approvals' }, { label: 'Detail' }]} />
      <FundRequestDetailView role="manager" userName={userName} basePath="/manager/fund-approvals" />
    </ManagerWorkspaceShell>
  );
}
