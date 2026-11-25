import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Banknote, ChevronRight,
  LayoutGrid, Table2, TrendingDown, TrendingUp, UserCheck,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { ClientDataTable, type DataColumn } from '../../../components/common/table';
import { DataError } from '../../../components/feedback/DataError';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { canSelectSchool } from '../../../components/layout/schoolScope';
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
import {
  EXECUTIVE_COLORS,
  ExecutiveChartCard,
  ExecutiveChartFrame,
  ExecutiveDonut,
  ExecutiveLegend,
  ExecutiveTooltip,
} from '../../../components/charts/ExecutiveCharts';
import { ReportWorkflow } from '../../../components/reports/ReportWorkflowDialog';

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
                <h1 className="mt-1 break-words font-display text-2xl font-black leading-tight tracking-[-0.025em] text-[#00334f] sm:text-[38px]">{title}</h1>
                <p className="mt-1 text-sm font-semibold text-[#64748b]">{userName} · Group Command</p>
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2 xl:pt-1">
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
export function useEnterSchool(destination = '/principal') {
  const navigate = useNavigate();
  const setActiveSchool = useSchoolStore((s) => s.setActiveSchool);
  return (school: Pick<SchoolScorecard, 'id' | 'name' | 'code' | 'type' | 'gender'>) => {
    setActiveSchool({ id: school.id, name: school.name, code: school.code, type: school.type, gender: school.gender });
    toast(`Now viewing ${school.name}`, 'success');
    navigate(destination);
  };
}

// ─── Landing: School Gallery ──────────────────────────────────────────────────

export function ManagerGalleryPage() {
  const navigate = useNavigate();
  const enterSchool = useEnterSchool();
  const setActiveSchool = useSchoolStore((s) => s.setActiveSchool);
  const { data, isLoading, isError, refetch } = useGroupOverview();
  const session = useAuthStore((s) => s.session);
  const visibleSchools = data?.schools.filter((school) => canSelectSchool(session?.user.scope, session?.user.schoolIds ?? [], school.id)) ?? [];

  return (
    <ManagerWorkspaceShell title="Kilimanjaro Schools Group" eyebrow="Choose where to work today">
      <ManagerBreadcrumb crumbs={[{ label: 'Group' }, { label: 'Schools' }]} />
      {isLoading ? <SkeletonTable cols={4} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <SchoolGallery
          schools={visibleSchools}
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
  const { data: groupFinance } = useGroupFinance();
  const enterSchool = useEnterSchool();
  const session = useAuthStore((s) => s.session);
  const visibleSchools = useMemo(
    () => data?.schools.filter((school) => canSelectSchool(session?.user.scope, session?.user.schoolIds ?? [], school.id)) ?? [],
    [data?.schools, session?.user.scope, session?.user.schoolIds],
  );
  const visibleAttention = useMemo(
    () => data?.attention.filter((item) => visibleSchools.some((school) => school.id === item.id)) ?? [],
    [data?.attention, visibleSchools],
  );
  const comparisonData = useMemo(() => visibleSchools.filter((school) => school.isActive).map((school) => ({
    name: school.code || school.name,
    academic: school.academicMean ?? 0,
    attendance: school.attendanceRate ?? 0,
    collection: school.collectionRate ?? 0,
  })), [visibleSchools]);
  const populationData = useMemo(() => visibleSchools.filter((school) => school.isActive).map((school) => ({
    name: school.code || school.name,
    students: school.students,
    atRisk: school.atRisk,
  })), [visibleSchools]);
  const healthData = useMemo(() => {
    const states = [
      { name: 'Good', value: 0, color: EXECUTIVE_COLORS.emerald },
      { name: 'Watch', value: 0, color: EXECUTIVE_COLORS.amber },
      { name: 'Critical', value: 0, color: EXECUTIVE_COLORS.rose },
    ];
    visibleSchools.forEach((school) => {
      const item = states.find((state) => state.name.toUpperCase() === school.health);
      if (item) item.value += 1;
    });
    return states;
  }, [visibleSchools]);
  const financeTrend = useMemo(() => (groupFinance?.trend ?? []).map((entry) => ({
    period: entry.period,
    invoiced: entry.invoiced,
    collected: entry.collected,
    rate: entry.rate,
  })), [groupFinance]);

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

          <div className="grid gap-gutter xl:grid-cols-3">
            <ExecutiveChartCard title="School health distribution" subtitle="Schools currently healthy, watched or critical">
              <ExecutiveDonut data={healthData} centerLabel="Schools" />
              <ExecutiveLegend data={healthData} />
            </ExecutiveChartCard>

            <ExecutiveChartCard title="Academic, attendance & collection" subtitle="Comparable rates across active schools" className="xl:col-span-2">
              <ExecutiveChartFrame height={300} empty={comparisonData.length === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: 800 }} />
                    <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip content={<ExecutiveTooltip suffix="%" />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar dataKey="academic" name="Academic" fill={EXECUTIVE_COLORS.indigo} radius={[6, 6, 0, 0]} maxBarSize={34} />
                    <Bar dataKey="collection" name="Collection" fill={EXECUTIVE_COLORS.emerald} radius={[6, 6, 0, 0]} maxBarSize={34} />
                    <Line type="monotone" dataKey="attendance" name="Attendance" stroke={EXECUTIVE_COLORS.amber} strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </ExecutiveChartFrame>
            </ExecutiveChartCard>
          </div>

          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveChartCard title="Enrolment and student risk" subtitle="Population scale with at-risk students by school">
              <ExecutiveChartFrame height={310} empty={populationData.length === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={populationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569', fontWeight: 800 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip content={<ExecutiveTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar dataKey="students" name="Students" fill={EXECUTIVE_COLORS.blue} radius={[7, 7, 0, 0]} />
                    <Bar dataKey="atRisk" name="At risk" fill={EXECUTIVE_COLORS.rose} radius={[7, 7, 0, 0]} />
                  </RBarChart>
                </ResponsiveContainer>
              </ExecutiveChartFrame>
            </ExecutiveChartCard>

            <ExecutiveChartCard title="Group collection trend" subtitle="Actual invoiced and collected values by term">
              <ExecutiveChartFrame height={310} empty={financeTrend.length === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={financeTrend}>
                    <defs>
                      <linearGradient id="manager-collected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={EXECUTIVE_COLORS.emerald} stopOpacity={0.5} />
                        <stop offset="100%" stopColor={EXECUTIVE_COLORS.emerald} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#475569', fontWeight: 800 }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <Tooltip content={<ExecutiveTooltip valueFormatter={(value) => formatTZS(Number(value))} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Area type="monotone" dataKey="collected" name="Collected" stroke={EXECUTIVE_COLORS.emerald} fill="url(#manager-collected)" strokeWidth={3} />
                    <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke={EXECUTIVE_COLORS.navy} strokeWidth={2.5} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ExecutiveChartFrame>
            </ExecutiveChartCard>
          </div>

          <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
            <CompareBars schools={visibleSchools} />
            <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Schools Needing Attention</p>
              {visibleAttention.length === 0 ? (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-[#f0fdf9] p-4">
                  <BadgeCheck className="h-5 w-5 text-[#10b981]" />
                  <p className="text-sm font-bold text-emerald-800">Every school is healthy. Nothing needs you right now.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleAttention.map((item) => {
                    const school = visibleSchools.find((s) => s.id === item.id);
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

          <ScorecardTable schools={visibleSchools} />
        </>
      )}
    </ManagerWorkspaceShell>
  );
}

// ─── Scorecards ───────────────────────────────────────────────────────────────

function ScorecardTable({ schools }: { schools: SchoolScorecard[] }) {
  const enterSchool = useEnterSchool();
  const pct = (v: number | null | undefined) => (v != null ? `${v}%` : '—');
  const columns: Array<DataColumn<SchoolScorecard>> = [
    {
      key: 'name', label: 'School', sort: (s) => s.name,
      render: (s) => (
        <>
          <button type="button" onClick={() => enterSchool(s)} className="text-left font-black text-[#00334f] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0284c7]">{s.name}</button>
          <p className="text-[11px] font-bold text-[#64748b]">{SCHOOL_TYPE_LABELS[s.type]} · {SCHOOL_GENDER_LABELS[s.gender]}</p>
        </>
      ),
    },
    { key: 'students', label: 'Students', sort: (s) => s.students, align: 'right', render: (s) => <span className="font-mono font-black tabular-nums">{s.students}</span> },
    { key: 'capacityFillPct', label: 'Capacity fill', sort: (s) => s.capacityFillPct ?? -1, align: 'right', render: (s) => <span className="font-mono tabular-nums">{pct(s.capacityFillPct)}</span> },
    { key: 'academicMean', label: 'Acad. mean', sort: (s) => s.academicMean ?? -1, align: 'right', render: (s) => <span className="font-mono tabular-nums">{pct(s.academicMean)}</span> },
    { key: 'collectionRate', label: 'Collection', sort: (s) => s.collectionRate ?? -1, align: 'right', render: (s) => <span className="font-mono tabular-nums">{pct(s.collectionRate)}</span> },
    { key: 'outstanding', label: 'Outstanding', sort: (s) => s.outstanding, align: 'right', render: (s) => <span className="whitespace-nowrap font-mono tabular-nums text-[#d97706]">{formatTZS(s.outstanding)}</span> },
    { key: 'attendanceRate', label: 'Attendance', sort: (s) => s.attendanceRate ?? -1, align: 'right', render: (s) => <span className="font-mono tabular-nums">{pct(s.attendanceRate)}</span> },
    { key: 'atRisk', label: 'At risk', sort: (s) => s.atRisk, align: 'right', render: (s) => <span className="font-mono tabular-nums">{s.atRisk}</span> },
    { key: 'health', label: 'Health', sort: (s) => s.health, render: (s) => <Badge tone={s.health === 'GOOD' ? 'emerald' : s.health === 'WATCH' ? 'amber' : 'rose'}>{s.health}</Badge> },
  ];
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]"><Table2 className="h-3.5 w-3.5" /> School Scorecards</h2>
        <p className="text-[11px] font-bold text-[#94a3b8]">Click a column to sort · click a school to enter it</p>
      </div>
      <ClientDataTable
        rows={schools}
        columns={columns}
        rowKey={(s) => s.id}
        unit="schools"
        searchText={(s) => s.name}
        searchPlaceholder="Search schools…"
        initialSortBy="students"
        initialSortDir="desc"
        storageKey="manager-scorecards"
        minWidth={980}
      />
    </section>
  );
}

export function ManagerSchoolsPage() {
  const { data, isLoading, isError, refetch } = useGroupOverview();
  const session = useAuthStore((s) => s.session);
  return (
    <ManagerWorkspaceShell title="School Scorecards" eyebrow="Compare every school side by side">
      <ManagerBreadcrumb crumbs={[{ label: 'Group', to: '/manager' }, { label: 'Scorecards' }]} />
      {isLoading ? <SkeletonTable cols={8} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <ScorecardTable schools={data.schools.filter((school) => canSelectSchool(session?.user.scope, session?.user.schoolIds ?? [], school.id))} />
      )}
    </ManagerWorkspaceShell>
  );
}

// ─── Group Finance (shared with Head of Finances) ─────────────────────────────

export function GroupFinancePage() {
  const { data, isLoading, isError, refetch } = useGroupFinance();
  const { data: schools = [] } = useSchools();
  const enterSchoolFinance = useEnterSchool('/finance/invoices');
  const session = useAuthStore((s) => s.session);
  const isManager = session?.user.role === 'MANAGER' || session?.user.role === 'SUPER_ADMIN';
  const visibleSchoolFinance = useMemo(
    () => data?.bySchool.filter((school) => canSelectSchool(session?.user.scope, session?.user.schoolIds ?? [], school.id)) ?? [],
    [data?.bySchool, session?.user.scope, session?.user.schoolIds],
  );
  const outstandingDistribution = useMemo(() => visibleSchoolFinance.map((school, index) => ({
    name: school.code || school.name,
    value: school.outstanding,
    color: [EXECUTIVE_COLORS.rose, EXECUTIVE_COLORS.amber, EXECUTIVE_COLORS.indigo, EXECUTIVE_COLORS.blue, EXECUTIVE_COLORS.violet][index % 5],
  })), [visibleSchoolFinance]);

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

          <div className="grid gap-gutter xl:grid-cols-3">
            <ExecutiveChartCard title="Outstanding distribution" subtitle="Share of receivables by school">
              <ExecutiveDonut data={outstandingDistribution} centerLabel="Outstanding" />
              <ExecutiveLegend data={outstandingDistribution} />
            </ExecutiveChartCard>

            <ExecutiveChartCard title="Invoiced, collected and outstanding" subtitle="Consolidated position for every visible school" className="xl:col-span-2">
              <ExecutiveChartFrame height={310} empty={visibleSchoolFinance.length === 0}>
                <ResponsiveContainer width="100%" height="100%">
                  <RBarChart data={visibleSchoolFinance} layout="vertical" margin={{ left: 12, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis type="category" dataKey="code" width={90} tick={{ fontSize: 10, fill: '#475569', fontWeight: 800 }} />
                    <Tooltip content={<ExecutiveTooltip valueFormatter={(value) => formatTZS(Number(value))} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                    <Bar dataKey="collected" name="Collected" stackId="position" fill={EXECUTIVE_COLORS.emerald} radius={[6, 0, 0, 6]} />
                    <Bar dataKey="outstanding" name="Outstanding" stackId="position" fill={EXECUTIVE_COLORS.rose} radius={[0, 6, 6, 0]} />
                  </RBarChart>
                </ResponsiveContainer>
              </ExecutiveChartFrame>
            </ExecutiveChartCard>
          </div>

          <ExecutiveChartCard title="Collection performance by term" subtitle="Amount trend with the collection-rate line">
            <ExecutiveChartFrame height={330} empty={data.trend.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#475569', fontWeight: 800 }} />
                  <YAxis yAxisId="amount" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <YAxis yAxisId="rate" orientation="right" domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                  <Tooltip content={<ExecutiveTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                  <Bar yAxisId="amount" dataKey="invoiced" name="Invoiced" fill={EXECUTIVE_COLORS.navy} radius={[7, 7, 0, 0]} maxBarSize={48} />
                  <Bar yAxisId="amount" dataKey="collected" name="Collected" fill={EXECUTIVE_COLORS.emerald} radius={[7, 7, 0, 0]} maxBarSize={48} />
                  <Line yAxisId="rate" type="monotone" dataKey="rate" name="Collection rate" stroke={EXECUTIVE_COLORS.amber} strokeWidth={3} dot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </ExecutiveChartFrame>
          </ExecutiveChartCard>

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
              <div className="p-3">
                <ClientDataTable
                  rows={visibleSchoolFinance}
                  columns={[
                    { key: 'name', label: 'School', sort: (s) => s.name, render: (s) => <span className="font-black text-[#00334f]">{s.name}</span> },
                    { key: 'invoiced', label: 'Invoiced', sort: (s) => s.invoiced, align: 'right', render: (s) => <span className="whitespace-nowrap font-mono tabular-nums">{formatTZS(s.invoiced)}</span> },
                    { key: 'collected', label: 'Collected', sort: (s) => s.collected, align: 'right', render: (s) => <span className="whitespace-nowrap font-mono tabular-nums text-[#10b981]">{formatTZS(s.collected)}</span> },
                    { key: 'outstanding', label: 'Outstanding', sort: (s) => s.outstanding, align: 'right', render: (s) => <span className="whitespace-nowrap font-mono tabular-nums text-[#d97706]">{formatTZS(s.outstanding)}</span> },
                    { key: 'collectionRate', label: 'Rate', sort: (s) => s.collectionRate ?? -1, align: 'right', render: (s) => <span className="font-mono font-black tabular-nums">{s.collectionRate != null ? `${s.collectionRate}%` : '—'}</span> },
                    {
                      key: 'next', label: 'Next step',
                      render: (s) => schools.find((school) => school.id === s.id) ? (
                        <button type="button" onClick={() => enterSchoolFinance(schools.find((school) => school.id === s.id)!)}
                          className="whitespace-nowrap text-xs font-black text-[#00334f] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0284c7]">
                          Open school finance →
                        </button>
                      ) : <span className="text-xs font-semibold text-[#64748b]">Select school above</span>,
                    },
                  ]}
                  rowKey={(s) => s.id}
                  unit="schools"
                  initialSortBy="outstanding"
                  initialSortDir="desc"
                  storageKey="manager-school-finance"
                  minWidth={680}
                />
              </div>
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
  const [busy, setBusy] = useState(false);

  const handle = async (filters: Record<string, string>) => {
    setBusy(true);
    try {
      const result = (await generate.mutateAsync({
        reportType: report.type,
        scope: report.scope,
        schoolId: report.perSchool && filters.schoolId ? filters.schoolId : undefined,
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
      <div className="min-w-[260px]">
        <ReportWorkflow
          title={report.title}
          description={report.desc}
          rows={schools.map((school) => ({ id: school.id, schoolId: school.id, school: school.name, scope: report.scope, report: report.title }))}
          fields={report.perSchool ? [{ key: 'schoolId', label: 'School', type: 'select', options: schools.map((school) => ({ value: school.id, label: school.name })), placeholder: 'All schools (group)' }] : []}
          busy={busy}
          onDownload={handle}
          compact
        />
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
        {r.status === 'READY' && <ReportWorkflow title={r.title || r.reportType} description="Previously generated report file." format="PDF" rows={[{ id: r.id, report: r.title || r.reportType, status: r.status, createdAt: r.createdAt, completedAt: r.completedAt ?? '' }]} busy={downloading} onDownload={handleDownload} compact />}
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
