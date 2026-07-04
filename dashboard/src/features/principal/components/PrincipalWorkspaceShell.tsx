import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Lock,
  Megaphone,
  PieChart,
  Plus,
  Scale,
  Settings,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { toast } from '../../../lib/toast';
import type { DisciplineIncident, PrincipalAssessment, PrincipalMetric, PrincipalPaymentApproval, SchoolHealth, Urgency } from '../types/principal.types';
import { canApprovePayment, canLockMarks, canPublishResults, selectedClassLabel } from '../utils/principalDecision';
import { useAuthStore } from '../../../lib/auth/authStore';
import {
  useApprovePaymentMutation,
  useLockMarksMutation,
  usePublishResultsMutation,
  useRejectPaymentMutation,
  useResolveDisciplineMutation,
  useReturnMarksMutation,
  usePrincipalSchoolHealth,
  usePendingMarkApprovals,
} from '../api/principal.hooks';

// ─── Shell ────────────────────────────────────────────────────────────────────

export function PrincipalWorkspaceShell({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name ?? 'Principal';
  const { data: health } = usePrincipalSchoolHealth() as { data: Record<string, number> | undefined };
  const { data: approvals = [] } = usePendingMarkApprovals() as unknown as { data: unknown[] };
  return (
    <div className="space-y-gutter">
      <section className="relative overflow-hidden rounded-2xl border border-[#d9b75e]/30 bg-[radial-gradient(circle_at_15%_20%,rgba(213,154,27,0.28),transparent_24%),radial-gradient(circle_at_90%_10%,rgba(14,165,233,0.20),transparent_28%),linear-gradient(135deg,#020617_0%,#08243a_44%,#00334f_100%)] shadow-layer">
        {/* Decorative ring */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
        {/* Gold bottom border line */}
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#d9b75e] to-transparent" />

        {/* Title + stats row */}
        <div className="relative grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#f4c96b]">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[44px] font-black leading-tight tracking-[-0.04em] text-white">{title}</h1>
            <p className="mt-1.5 text-sm font-semibold text-white/60">{userName} · Head master / Head of School · Executive decision authority</p>
          </div>
          <div className="flex shrink-0 items-start gap-3 xl:pt-2">
            <HeaderPill label="Health"   value={`${health?.score ?? '—'} / 100`}        tone="green" />
            <HeaderPill label="Critical" value={`${health?.critical ?? 0} alerts`}       tone="red"   />
            <HeaderPill label="Pending"  value={`${approvals.length} approvals`}          tone="gold"  />
          </div>
        </div>

        {/* Action strip — only rendered when an action is passed */}
        {action && (
          <div className="relative flex items-center justify-end gap-2 border-t border-white/10 bg-white/5 px-4 py-2.5">
            {action}
          </div>
        )}
      </section>

      {children}
    </div>
  );
}

function HeaderPill({ label, value, tone }: { label: string; value: string; tone: 'green' | 'red' | 'gold' }) {
  const color = tone === 'green' ? 'text-[#34d399]' : tone === 'red' ? 'text-[#fb7185]' : 'text-[#f4c96b]';
  return (
    <div className="min-w-[110px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/50">{label}</p>
      <p className={`mt-1 font-mono text-base font-black ${color}`}>{value}</p>
    </div>
  );
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────

export function PrincipalBreadcrumb({ crumbs }: { crumbs: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
      {crumbs.map((crumb, i) => (
        <span key={crumb.label} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3 w-3 text-ks-muted" />}
          {crumb.to ? (
            <NavLink to={crumb.to} className="text-ks-muted transition hover:text-ks-navy">{crumb.label}</NavLink>
          ) : (
            <span className="text-ks-navy">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

export function PrincipalActionCard({
  title,
  count,
  detail,
  urgency,
  to,
  meta,
}: {
  title: string;
  count: string;
  detail: string;
  urgency: Urgency;
  to: string;
  meta: string[];
}) {
  const railBorder = urgencyClass(urgency, 'border');
  const bg        = urgencyClass(urgency, 'bg');
  return (
    <NavLink to={to} className={`group relative overflow-hidden rounded-2xl border border-ks-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-layer ${railBorder}`}>
      <div className={`absolute right-3 top-3 h-16 w-16 rounded-full ${bg} opacity-10 blur-xl`} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Decision queue</p>
          <h3 className="mt-1 font-display text-lg font-black text-ks-navy">{title}</h3>
        </div>
        <span className={`rounded-xl px-3 py-1.5 font-mono text-2xl font-black text-white ${bg}`}>{count}</span>
      </div>
      <p className="relative mt-2 text-sm font-semibold leading-relaxed text-ks-muted">{detail}</p>
      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {meta.map((item) => (
          <Badge key={item} tone={urgency === 'critical' ? 'rose' : urgency === 'high' ? 'amber' : urgency === 'medium' ? 'blue' : 'slate'}>
            {item}
          </Badge>
        ))}
      </div>
      <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-ks-blue">
        Review now <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </span>
    </NavLink>
  );
}

// ─── School health score ──────────────────────────────────────────────────────

export function SchoolHealthScore({ health }: { health: SchoolHealth }) {
  const weakAreas = [
    health.academic < 60 ? 'academic performance' : '',
    health.finance < 60 ? 'finance collection' : '',
    health.operations < 60 ? 'operations' : '',
  ].filter(Boolean);
  const advisory = weakAreas.length
    ? `${weakAreas.join(', ')} require executive attention.`
    : 'No critical school health areas are currently flagged by the backend aggregates.';

  return (
    <div className="rounded-2xl border border-ks-navy/10 bg-white p-8 shadow-sm">
      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex justify-center">
          <ScoreRing value={health.score} label="School Health" />
        </div>
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Executive health score</p>
              <h2 className="mt-1 font-display text-3xl font-black text-ks-navy">Institutional Readiness</h2>
            </div>
            <Badge tone="emerald">{`+${health.trend} trend`}</Badge>
          </div>
          <div className="mt-6 space-y-5">
            <HealthBar label="Academic"   value={health.academic}    tone="bg-ks-blue" />
            <HealthBar label="Finance"    value={health.finance}     tone="bg-ks-gold" />
            <HealthBar label="Operations" value={health.operations}  tone="bg-ks-emerald" />
          </div>
          <div className="mt-6 rounded-xl border border-ks-navy/10 bg-ks-paper p-5 text-sm font-semibold leading-relaxed text-ks-muted">
            <span className="font-black text-ks-navy">Advisory:</span> {advisory}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 72;
  const circumference = 2 * Math.PI * r;
  const filled = (value / 100) * circumference;
  const grade = value >= 90 ? 'Excellent' : value >= 75 ? 'Good' : value >= 60 ? 'Fair' : 'At Risk';
  const gradeColor = value >= 90 ? 'text-ks-emerald' : value >= 75 ? 'text-ks-blue' : value >= 60 ? 'text-ks-amber' : 'text-ks-rose';
  const hint = value >= 90 ? 'Top performance tier' : value >= 75 ? 'Above school average' : value >= 60 ? 'Monitoring required' : 'Immediate intervention';
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex h-64 w-64 cursor-default items-center justify-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
        <circle cx="90" cy="90" r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
        <motion.circle
          cx="90" cy="90" r={r} fill="none"
          stroke="#d9b75e" strokeWidth="14"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${filled} ${circumference - filled}` }}
          transition={{ duration: 1.6, ease: [0.34, 1.2, 0.64, 1], delay: 0.3 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {!hovered ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center"
            >
              <motion.p
                className="font-display text-6xl font-black text-ks-navy"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, delay: 1.0, ease: 'backOut' }}
              >
                {value}
              </motion.p>
              <p className={`text-xs font-black uppercase tracking-widest ${gradeColor}`}>{grade}</p>
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-ks-muted">{label}</p>
            </motion.div>
          ) : (
            <motion.div
              key="hov"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col items-center gap-1 px-6 text-center"
            >
              <p className="font-display text-5xl font-black text-ks-navy">
                {value}<span className="text-2xl font-bold text-ks-muted">/100</span>
              </p>
              <p className={`text-[10px] font-black uppercase tracking-widest ${gradeColor}`}>{grade}</p>
              <p className="mt-1 text-[9px] font-semibold leading-snug text-ks-muted">{hint}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function HealthBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div>
      <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-wider">
        <span className="text-ks-muted">{label}</span>
        <motion.span
          className="font-mono text-ks-navy"
          animate={{ color: hovered ? '#d9b75e' : '#061f33' }}
          transition={{ duration: 0.2 }}
        >
          {value}%
        </motion.span>
      </div>
      <div
        className="relative h-4 overflow-hidden rounded-full bg-ks-mist cursor-pointer"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <motion.div
          className={`h-full rounded-full ${tone}`}
          initial={{ width: '0%' }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
        />
        <AnimatePresence>
          {hovered && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-[9px] font-black text-white drop-shadow"
            >
              {value}% — {label}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Metric grid ──────────────────────────────────────────────────────────────

export function ExecutiveMetricGrid({ items }: { items: PrincipalMetric[] }) {
  return (
    <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const rail = urgencyClass(item.tone, 'border');
        const valueColor =
          item.tone === 'critical' ? 'text-ks-rose' :
          item.tone === 'high'     ? 'text-ks-amber' :
                                     'text-ks-navy';
        const TrendIcon = item.tone === 'critical' || item.tone === 'high' ? TrendingDown : TrendingUp;
        const trendColor = item.tone === 'critical' ? 'text-ks-rose' : item.tone === 'high' ? 'text-ks-amber' : 'text-ks-emerald';
        return (
          <div key={item.label} className={`rounded-2xl border border-ks-line bg-white p-6 shadow-sm ${rail}`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">{item.label}</p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <p className={`font-display text-5xl font-black leading-none ${valueColor}`}>{item.value}</p>
              <TrendIcon className={`mb-1 h-5 w-5 shrink-0 ${trendColor}`} />
            </div>
            <p className="mt-2 text-sm font-semibold leading-snug text-ks-muted">{item.detail}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Intelligence panel ───────────────────────────────────────────────────────

export function IntelligencePanel({ context }: { context: string }) {
  const { data: health } = usePrincipalSchoolHealth() as { data: Record<string, number> | undefined };
  const stats: Array<[string, string]> = [
    [String(health?.critical ?? 0), 'critical alerts need intervention'],
    [String(health?.atRisk ?? 0), 'at-risk students flagged'],
    [`${health?.passRate ?? 0}%`, 'school-wide pass rate'],
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#d9b75e]/40 bg-[linear-gradient(135deg,#071c2e,#0f3b5f)] p-8 text-white shadow-layer">
      <Sparkles className="pointer-events-none absolute right-10 top-10 h-28 w-28 text-[#f4c96b]/10" />
      <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#f4c96b]">Institutional intelligence</p>
      <h2 className="mt-2 font-display text-3xl font-black">Decision Consequence View</h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-white/70">{context}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {stats.map(([value, label]) => (
          <div key={label} className="rounded-xl border border-white/10 bg-white/10 p-5">
            <p className="font-display text-4xl font-black text-[#f4c96b]">{value}</p>
            <p className="mt-1 text-sm font-bold text-white/70">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <NavLink to="/principal/performance">
          <Button className="rounded-xl bg-[#f4c96b] text-[#061f33] hover:bg-[#f0c050]">View All Alerts</Button>
        </NavLink>
        <Button variant="outline-white" className="rounded-xl">Done</Button>
        <NavLink to="/principal/results/publish">
          <Button variant="outline-white" className="rounded-xl">Open Results Publishing</Button>
        </NavLink>
      </div>
    </div>
  );
}

// ─── Marks approval table ─────────────────────────────────────────────────────

export function MarksFinalApprovalTable({ assessments }: { assessments: PrincipalAssessment[] }) {
  return (
    <ExecutiveTable columns={['Assessment', 'Subject', 'Class', 'Teacher', 'HOD', 'Average', 'Alerts', 'Age', 'Status', 'Actions']}>
      {assessments.map((item) => {
        const urgency = item.criticalAlerts > 2 ? 'border-l-ks-rose' : item.criticalAlerts > 0 ? 'border-l-ks-amber' : 'border-l-ks-emerald';
        return (
          <tr key={item.id} className={`border-l-4 transition hover:bg-ks-paper ${urgency}`}>
            <Td>
              <NavLink className="font-black text-ks-navy hover:underline" to={`/principal/approvals/marks/${item.id}`}>
                {item.assessment}
              </NavLink>
            </Td>
            <Td>{item.subject}</Td>
            <Td>{item.className}</Td>
            <Td>{item.teacher}</Td>
            <Td><Badge tone="emerald">{item.hodStatus}</Badge></Td>
            <Td>
              <span className={item.average < 60 ? 'font-black text-ks-rose' : 'font-black text-ks-emerald'}>
                {item.average}%
              </span>
            </Td>
            <Td>
              <Badge tone={item.criticalAlerts > 0 ? 'rose' : 'emerald'}>{String(item.criticalAlerts)}</Badge>
            </Td>
            <Td className="text-xs">{item.age}</Td>
            <Td><Badge tone="amber">{item.principalStatus}</Badge></Td>
            <Td>
              <div className="flex items-center gap-2">
                <NavLink className="text-xs font-black text-ks-blue hover:underline" to={`/principal/approvals/marks/${item.id}`}>
                  Review
                </NavLink>
                <span className="text-ks-mist">·</span>
                <button className="text-xs font-black text-ks-rose hover:underline">Return</button>
              </div>
            </Td>
          </tr>
        );
      })}
    </ExecutiveTable>
  );
}

// ─── Executive table ──────────────────────────────────────────────────────────

export function ExecutiveTable({ columns, children, minWidth = 1000 }: { columns: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="bg-ks-navy text-[10px] font-black uppercase tracking-widest text-white">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-5 py-4">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ks-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 font-semibold text-ks-slate ${className}`}>{children}</td>;
}

// ─── Final lock panel ─────────────────────────────────────────────────────────

export function FinalLockPanel({ assessmentId }: { assessmentId?: string }) {
  const navigate = useNavigate();
  const [reviewed, setReviewed] = useState(false);
  const [understands, setUnderstands] = useState(false);
  const lockMutation = useLockMarksMutation();
  const returnMutation = useReturnMarksMutation();
  const canLock = canLockMarks(reviewed, understands);

  const handleLock = () => {
    if (!assessmentId) return;
    lockMutation.mutate({ assessmentId }, {
      onSuccess: () => { toast('Marks locked and audit record created', 'success'); navigate('/principal/approvals'); },
      onError: () => toast('Failed to lock marks. Please try again.', 'error'),
    });
  };

  const handleReturn = () => {
    if (!assessmentId) return;
    returnMutation.mutate({ assessmentId, reason: 'Returned for correction by Principal' }, {
      onSuccess: () => { toast('Assessment returned for correction', 'info'); navigate('/principal/approvals'); },
      onError: () => toast('Failed to return assessment. Please try again.', 'error'),
    });
  };

  return (
    <div className="sticky top-24 rounded-2xl border border-ks-line bg-white p-5 shadow-layer">
      <div className="flex items-center gap-2 border-b border-ks-line pb-4">
        <Lock className="h-5 w-5 text-ks-navy" />
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Final lock authority</p>
          <h2 className="mt-0.5 font-display text-xl font-black text-ks-navy">Principal Decision</h2>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer gap-2 text-sm font-bold text-ks-slate">
          <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1 h-4 w-4 accent-ks-navy" />
          I have reviewed the marks summary and critical alerts.
        </label>
        <label className="flex cursor-pointer gap-2 text-sm font-bold text-ks-slate">
          <input type="checkbox" checked={understands} onChange={(e) => setUnderstands(e.target.checked)} className="mt-1 h-4 w-4 accent-ks-navy" />
          I understand locking makes these marks eligible for publishing.
        </label>
      </div>
      {!canLock && (
        <p className="mt-3 rounded-xl border border-ks-amber/30 bg-ks-amber/5 px-3 py-2 text-xs font-black text-ks-amber">
          Both acknowledgments required before final lock.
        </p>
      )}
      <Button
        disabled={!canLock || lockMutation.isPending}
        onClick={handleLock}
        className="mt-5 w-full rounded-xl bg-ks-navy disabled:opacity-40"
      >
        <Lock className="h-4 w-4" /> {lockMutation.isPending ? 'Locking…' : 'Lock Marks'}
      </Button>
      <Button
        variant="danger"
        disabled={returnMutation.isPending}
        onClick={handleReturn}
        className="mt-2 w-full rounded-xl"
      >
        {returnMutation.isPending ? 'Returning…' : 'Return for Correction'}
      </Button>
    </div>
  );
}

// ─── Publish results flow ─────────────────────────────────────────────────────

export function PublishResultsFlow({ classes }: { classes: Array<{ id: string; className: string; students: number; lockedAssessments: number; missingItems: number; reportCardReadiness: number }> }) {
  const [selected, setSelected] = useState<string[]>(classes.slice(0, 2).map((c) => c.id));
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [visibilityConfirmed, setVisibilityConfirmed] = useState(false);
  const [published, setPublished] = useState(false);
  const publishMutation = usePublishResultsMutation();
  const canPublish = canPublishResults(finalConfirmed, visibilityConfirmed, selected.length);

  const handlePublish = () => {
    publishMutation.mutate({ classIds: selected }, {
      onSuccess: () => { setPublished(true); toast('Results published successfully', 'success'); },
      onError: () => toast('Failed to publish results. Please try again.', 'error'),
    });
  };
  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
      {/* Class cards */}
      <div className="space-y-gutter">
        <div className="grid gap-gutter md:grid-cols-3">
          {classes.map((item) => {
            const active = selected.includes(item.id);
            const hasMissing = item.missingItems > 0;
            return (
              <button
                key={item.id}
                onClick={() => setSelected((cur) => active ? cur.filter((id) => id !== item.id) : [...cur, item.id])}
                className={`rounded-2xl border p-5 text-left transition ${
                  active ? 'border-ks-gold bg-ks-gold/10 shadow-layer' : 'border-ks-line bg-white hover:border-ks-blue/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <p className="font-display text-xl font-black text-ks-navy">{item.className}</p>
                  {active && <CheckCircle2 className="h-5 w-5 text-ks-gold" />}
                </div>
                <p className="mt-1 text-sm font-bold text-ks-muted">{item.students} students · {item.lockedAssessments} locked</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs font-black text-ks-muted">
                    <span>Report card readiness</span>
                    <span className="text-ks-navy">{item.reportCardReadiness}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-ks-mist">
                    <div className="h-full rounded-full bg-ks-emerald transition-all" style={{ width: `${item.reportCardReadiness}%` }} />
                  </div>
                </div>
                {hasMissing && (
                  <p className="mt-2 text-xs font-black text-ks-amber">{item.missingItems} missing item{item.missingItems > 1 ? 's' : ''}</p>
                )}
              </button>
            );
          })}
        </div>
        {published && (
          <IntelligencePanel context="Results published for selected classes. Students and parents can now view them. Report card sign-off queue has been updated." />
        )}
      </div>

      {/* Sticky publish panel */}
      <div className="sticky top-24 h-fit rounded-2xl border border-ks-line bg-white p-5 shadow-layer">
        <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Publishing flow</p>
        <h2 className="mt-1 font-display text-2xl font-black text-ks-navy">{selectedClassLabel(selected.length)}</h2>
        <div className="mt-4 space-y-3">
          <Step label="1. Select term" done />
          <Step label="2. Select ready classes" done={selected.length > 0} />
          <Step label="3. Review completeness" done />
          <div className="space-y-3 border-t border-ks-line pt-3">
            <label className="flex cursor-pointer gap-2 text-sm font-bold text-ks-slate">
              <input type="checkbox" checked={finalConfirmed} onChange={(e) => setFinalConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-ks-navy" />
              I confirm these results are final for selected classes.
            </label>
            <label className="flex cursor-pointer gap-2 text-sm font-bold text-ks-slate">
              <input type="checkbox" checked={visibilityConfirmed} onChange={(e) => setVisibilityConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-ks-navy" />
              I understand students and parents will be able to view them.
            </label>
          </div>
        </div>
        <Button
          disabled={!canPublish || publishMutation.isPending}
          onClick={handlePublish}
          className="mt-5 w-full rounded-xl bg-ks-navy disabled:opacity-40"
        >
          {publishMutation.isPending ? 'Publishing…' : 'Publish Results'}
        </Button>
        {!canPublish && (
          <p className="mt-2 text-center text-xs font-bold text-ks-muted">Select classes and confirm both acknowledgments</p>
        )}
      </div>
    </div>
  );
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm font-bold text-ks-slate">
      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ks-emerald" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-ks-line" />}
      {label}
    </div>
  );
}

// ─── Payment approval card ────────────────────────────────────────────────────

export function PaymentApprovalCard({ approval }: { approval: PrincipalPaymentApproval }) {
  const approveMutation = useApprovePaymentMutation();
  const rejectMutation = useRejectPaymentMutation();
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('Bank evidence verified against reference.');
  const [removed, setRemoved] = useState(false);
  if (removed) return null;
  const allowed = canApprovePayment(confirmed, reason);
  const busy = approveMutation.isPending || rejectMutation.isPending;

  const handleApprove = () => {
    approveMutation.mutate({ id: approval.id, notes: reason }, {
      onSuccess: () => { setRemoved(true); toast('Payment approved', 'success'); },
      onError: () => toast('Failed to approve payment. Please try again.', 'error'),
    });
  };

  const handleReject = () => {
    if (!reason.trim()) { toast('Reason required to reject', 'warning'); return; }
    rejectMutation.mutate({ id: approval.id, reason }, {
      onSuccess: () => { setRemoved(true); toast('Payment rejected', 'info'); },
      onError: () => toast('Failed to reject payment. Please try again.', 'error'),
    });
  };

  return (
    <div className={`rounded-2xl border border-ks-line bg-white p-5 shadow-sm transition ${urgencyClass(approval.risk, 'border')}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">
            {approval.paymentId} · {approval.method} · {approval.age} ago
          </p>
          <h3 className="mt-1 font-display text-xl font-black text-ks-navy">{approval.student}</h3>
          <p className="text-sm font-semibold text-ks-muted">{approval.invoice} · ref: {approval.reference}</p>
        </div>
        <p className="shrink-0 font-mono text-xl font-black text-ks-navy">TZS {approval.amount.toLocaleString('en-US')}</p>
      </div>
      <p className="mt-2 text-xs font-bold text-ks-muted">Entered by: {approval.enteredBy}</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-4 h-20 w-full rounded-xl border border-ks-line p-3 text-sm font-semibold outline-none focus:border-ks-blue"
        placeholder="Approval reason (required)..."
      />
      <label className="mt-3 flex cursor-pointer gap-2 text-sm font-bold text-ks-slate">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-ks-navy" />
        I have reviewed the evidence and invoice context.
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!allowed || busy} onClick={handleApprove} className="rounded-xl bg-ks-emerald disabled:opacity-40">
          <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? 'Approving…' : 'Approve'}
        </Button>
        <Button variant="danger" disabled={busy} onClick={handleReject} className="rounded-xl">
          {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
        </Button>
        <NavLink to={`/principal/finance/approvals/${approval.id}`}>
          <Button variant="secondary" className="rounded-xl">Full Detail</Button>
        </NavLink>
      </div>
    </div>
  );
}

// ─── Discipline severity bar ──────────────────────────────────────────────────

export function DisciplineSeverityBar({ incidents }: { incidents: DisciplineIncident[] }) {
  const critical = incidents.filter((i) => i.severity === 'critical').length;
  const high     = incidents.filter((i) => i.severity === 'high').length;
  const medium   = incidents.filter((i) => i.severity === 'medium').length;
  const total    = incidents.length || 1;
  const [hov, setHov] = useState<string | null>(null);
  const segments = [
    { key: 'critical', count: critical, pct: (critical / total) * 100, bg: 'bg-ks-rose',  label: 'Critical' },
    { key: 'high',     count: high,     pct: (high / total) * 100,     bg: 'bg-ks-amber', label: 'High'     },
    { key: 'medium',   count: medium,   pct: (medium / total) * 100,   bg: 'bg-ks-blue',  label: 'Medium'   },
  ];
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl font-black text-ks-navy">Discipline Severity</h2>
      <div className="relative mt-5">
        <div className="flex h-8 overflow-hidden rounded-full bg-ks-mist">
          {segments.map(({ key, pct, bg }, idx) => (
            <motion.div
              key={key}
              className={`${bg} relative cursor-pointer brightness-100 hover:brightness-110`}
              initial={{ width: '0%' }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.85, ease: 'easeOut', delay: idx * 0.14 }}
              onMouseEnter={() => setHov(key)}
              onMouseLeave={() => setHov(null)}
            />
          ))}
        </div>
        <AnimatePresence>
          {hov && (() => {
            const seg = segments.find((s) => s.key === hov)!;
            return (
              <motion.div
                key={hov}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none absolute -top-14 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ks-navy px-4 py-2 text-center shadow-xl"
              >
                <p className="font-black text-white">{seg.count} {seg.label}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">{Math.round(seg.pct)}% of all incidents</p>
                <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ks-navy" />
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-black uppercase text-ks-muted">
        {segments.map(({ key, count, bg, label }) => (
          <span
            key={key}
            className={`flex cursor-pointer items-center gap-1 transition-opacity ${hov && hov !== key ? 'opacity-35' : ''}`}
            onMouseEnter={() => setHov(key)}
            onMouseLeave={() => setHov(null)}
          >
            <span className={`h-3 w-3 rounded-sm ${bg}`} /> {label} {count}
          </span>
        ))}
        <span className="ml-auto font-mono">{incidents.filter((i) => i.status === 'OPEN').length} open</span>
      </div>
    </div>
  );
}

// ─── Charts ───────────────────────────────────────────────────────────────────

export function ExecutiveBarChart({ title, subtitle, values }: { title: string; subtitle?: string; values: Array<{ label: string; value: number; tone: string }> }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  const total = values.reduce((s, v) => s + v.value, 0);
  const [hov, setHov] = useState<number | null>(null);
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <h2 className="font-display text-xl font-black text-ks-navy">{title}</h2>
      {subtitle && <p className="mt-1 text-xs font-semibold text-ks-muted">{subtitle}</p>}
      <div className="mt-6 space-y-5">
        {values.length === 0 && (
          <p className="rounded-xl border border-dashed border-ks-line bg-ks-paper px-4 py-6 text-center text-sm font-semibold text-ks-muted">
            No data available yet.
          </p>
        )}
        {values.map((item, i) => {
          const pct = Math.round((item.value / max) * 100);
          const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isHov = hov === i;
          return (
            <div
              key={item.label}
              className="cursor-pointer"
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            >
              <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-wider">
                <span className={`transition-colors duration-150 ${isHov ? 'text-ks-navy' : 'text-ks-muted'}`}>{item.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-ks-navy">{item.value}</span>
                  <motion.span
                    animate={{ backgroundColor: isHov ? '#061f33' : '#f1f5f9', color: isHov ? '#ffffff' : '#94a3b8' }}
                    transition={{ duration: 0.2 }}
                    className="rounded px-1.5 py-0.5 text-[9px] font-black"
                  >
                    {share}%
                  </motion.span>
                </span>
              </div>
              <div className="relative h-9 overflow-hidden rounded-lg bg-ks-mist">
                <motion.div
                  className={`h-full rounded-lg ${item.tone}`}
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%`, opacity: isHov ? 1 : 0.82 }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.08 }}
                />
                <AnimatePresence>
                  {isHov && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pointer-events-none absolute inset-0 flex items-center px-3 text-[11px] font-black text-white drop-shadow"
                    >
                      {item.value} · {share}% share · {pct}% of leader
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-right text-[10px] font-black uppercase tracking-widest text-ks-muted">Total: {total}</p>
    </div>
  );
}

export function ExecutiveLineChart({ title, subtitle, values }: { title: string; subtitle?: string; values: number[] }) {
  const w = 560; const h = 220; const pad = 28;
  const series = values.length >= 2 ? values : values.length === 1 ? [values[0], values[0]] : [0, 0];
  const max = Math.max(...series); const min = Math.min(...series);
  const current = series[series.length - 1];
  const prev    = values[values.length - 2] ?? current;
  const delta   = current - prev;
  const points = series.map((v, i) => {
    const x = pad + (i / (series.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = `M${points[0][0]},${points[0][1]} ${points.slice(1).map(([x, y]) => `L${x},${y}`).join(' ')}`;
  const area     = `${linePath} L${w - pad},${h} L${pad},${h} Z`;
  const gradId   = `lg-${title.replace(/\s+/g, '')}`;

  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * w;
    let best = 0;
    points.forEach(([px], i) => { if (Math.abs(px - svgX) < Math.abs(points[best][0] - svgX)) best = i; });
    setHovIdx(best);
  };

  const hp = hovIdx !== null ? points[hovIdx] : null;

  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-black text-ks-navy">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-ks-muted">{subtitle}</p>}
        </div>
        <div className="shrink-0 text-right">
          <motion.p
            className="font-display text-2xl font-black"
            animate={{ color: hovIdx !== null ? '#d9b75e' : '#061f33' }}
            transition={{ duration: 0.2 }}
          >
            {hovIdx !== null ? series[hovIdx] : current}
          </motion.p>
          <p className={`text-[10px] font-black uppercase tracking-widest ${delta >= 0 ? 'text-ks-emerald' : 'text-ks-rose'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs prev
          </p>
        </div>
      </div>
      <div className="relative mt-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${w} ${h}`}
          className="h-72 w-full cursor-crosshair"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovIdx(null)}
        >
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="#d9b75e" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d9b75e" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((l) => {
            const gy  = pad + l * ((h - pad * 2) / 4);
            const val = Math.round(max - (l / 4) * (max - min));
            return (
              <g key={l}>
                <line x1={pad} x2={w - pad} y1={gy} y2={gy} stroke="#e2e8f0" strokeDasharray="4 6" />
                <text x={pad - 6} y={gy + 4} textAnchor="end" fontSize="9" fill="#94a3b8" fontWeight="700">{val}</text>
              </g>
            );
          })}
          <path d={area} fill={`url(#${gradId})`} />
          {hp && (
            <line x1={hp[0]} x2={hp[0]} y1={pad} y2={h - pad} stroke="#061f33" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.35" />
          )}
          <motion.path
            d={linePath}
            fill="none" stroke="#061f33" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.2 }}
          />
          {points.map(([x, y], i) => {
            const isHov  = hovIdx === i;
            const isLast = i === points.length - 1;
            return (
              <motion.circle
                key={i}
                cx={x} cy={y}
                r={isHov ? 9 : isLast ? 7 : 5}
                fill={isHov || isLast ? '#d9b75e' : '#fff'}
                stroke="#061f33" strokeWidth={isHov ? 3 : 2.5}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.7 + i * 0.07, ease: 'backOut' }}
              />
            );
          })}
        </svg>
        <AnimatePresence>
          {hovIdx !== null && hp && (
            <motion.div
              key={hovIdx}
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute z-50 -translate-x-1/2 rounded-xl bg-ks-navy px-4 py-3 shadow-2xl"
              style={{ left: `${(hp[0] / w) * 100}%`, top: `${(hp[1] / h) * 100}%`, marginTop: '-60px' }}
            >
              <p className="font-display text-2xl font-black text-ks-gold">{series[hovIdx]}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">
                Point {hovIdx + 1} / {series.length}
                {hovIdx > 0 && (
                  <> &nbsp;·&nbsp; {series[hovIdx] > series[hovIdx - 1] ? '▲' : '▼'} {Math.abs(series[hovIdx] - series[hovIdx - 1])}</>
                )}
              </p>
              <div className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-ks-navy" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── School settings section ──────────────────────────────────────────────────

export function SchoolSettingsSection() {
  const [weights, setWeights] = useState([40, 30, 30]);
  const total = weights.reduce((s, w) => s + w, 0);
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Assessment weights</p>
          <h2 className="font-display text-2xl font-black text-ks-navy">Live Total: {total}%</h2>
        </div>
        <Badge tone={total === 100 ? 'emerald' : 'rose'}>{total === 100 ? 'Valid' : `${total}% ≠ 100`}</Badge>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {(['CAT', 'Midterm', 'Final'] as const).map((label, i) => (
          <label key={label}>
            <span className="text-xs font-black uppercase tracking-widest text-ks-muted">{label}</span>
            <input
              type="number"
              value={weights[i]}
              onChange={(e) => setWeights((cur) => cur.map((v, j) => j === i ? Number(e.target.value) : v))}
              className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-mono font-black outline-none focus:border-ks-blue"
            />
          </label>
        ))}
      </div>
      <Button disabled={total !== 100} className="mt-5 rounded-xl bg-ks-navy disabled:opacity-40">
        <Settings className="h-4 w-4" /> Save Assessment Weights
      </Button>
    </div>
  );
}

// ─── Decision audit timeline ──────────────────────────────────────────────────

export function DecisionAuditTimeline({ rows }: { rows: Array<{ id: string; date: string; actor: string; decision: string; entity: string; reason: string; correlationId: string }> }) {
  return (
    <div className="rounded-2xl bg-ks-navy p-8 text-white shadow-layer">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl font-black">Decision Audit Trail</h2>
          <p className="mt-1 text-sm font-semibold text-white/60">Immutable. Every executive action recorded.</p>
        </div>
        <Badge tone="gold">{`${rows.length} entries`}</Badge>
      </div>
      <div className="mt-7 space-y-6 border-l-2 border-white/20 pl-6">
        {rows.map((row) => (
          <div key={row.id} className="relative">
            <span className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-ks-navy bg-ks-gold" />
            <p className="text-[10px] font-black uppercase tracking-widest text-ks-gold">{row.date} · {row.correlationId}</p>
            <h3 className="mt-0.5 font-display text-base font-black">{row.decision}</h3>
            <p className="text-sm font-semibold text-white/65">{row.entity} · {row.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Report tile ──────────────────────────────────────────────────────────────

export function FancyReportTile({ title, detail, onGenerate, loading = false, loadingLabel }: { title: string; detail: string; onGenerate: () => void; loading?: boolean; loadingLabel?: string }) {
  return (
    <button
      onClick={onGenerate}
      disabled={loading}
      className="group relative w-full overflow-hidden rounded-2xl border border-ks-line bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-layer disabled:cursor-wait disabled:opacity-60"
    >
      <PieChart className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-ks-gold/10" />
      <Download className="h-6 w-6 text-ks-gold" />
      <h3 className="mt-4 font-display text-lg font-black text-ks-navy">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-ks-muted">{detail}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-ks-blue transition group-hover:gap-2">
        {loading ? (loadingLabel ?? 'Queuing…') : 'Generate'} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </span>
    </button>
  );
}

// ─── Expandable incident ──────────────────────────────────────────────────────

export function ExpandableIncident({ incident }: { incident: DisciplineIncident }) {
  const resolveMutation = useResolveDisciplineMutation();
  const [open, setOpen] = useState(false);
  const [resolvedLocally, setResolvedLocally] = useState(false);

  const handleResolve = () => {
    resolveMutation.mutate({ id: incident.id, resolution: 'Resolved by Principal' }, {
      onSuccess: () => { setResolvedLocally(true); toast('Incident marked as resolved', 'success'); },
      onError: () => toast('Failed to resolve incident. Please try again.', 'error'),
    });
  };

  const isOpen = !resolvedLocally && incident.status === 'OPEN';

  return (
    <div className={`overflow-hidden rounded-2xl border border-ks-line bg-white transition ${urgencyClass(incident.severity, 'border')}`}>
      <button className="flex w-full items-start justify-between gap-4 p-5 text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">{incident.category} · {incident.date}</p>
            <Badge tone={isOpen ? (incident.severity === 'critical' ? 'rose' : 'amber') : 'slate'}>
              {resolvedLocally ? 'RESOLVED' : incident.status}
            </Badge>
          </div>
          <h3 className="mt-1 font-display text-xl font-black text-ks-navy">{incident.student}</h3>
          <p className="text-sm font-semibold text-ks-muted">{incident.className} · Severity: {incident.severity}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-ks-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-ks-line bg-ks-paper p-5">
          <p className="text-sm font-semibold text-ks-slate">{incident.description}</p>
          {isOpen && (
            <div className="mt-4 flex gap-2">
              <Button
                disabled={resolveMutation.isPending}
                onClick={handleResolve}
                className="rounded-xl bg-ks-navy py-2 text-xs"
              >
                {resolveMutation.isPending ? 'Resolving…' : 'Mark Resolved'}
              </Button>
              <Button variant="secondary" className="rounded-xl py-2 text-xs">Escalate</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Announcement card ────────────────────────────────────────────────────────

export function AnnouncementCard({
  title,
  detail,
  priority,
  audience,
  date,
  status,
}: {
  title: string;
  detail: string;
  priority: 'urgent' | 'normal' | 'draft';
  audience: string;
  date: string;
  status: 'published' | 'draft' | 'scheduled';
}) {
  const pillTone = priority === 'urgent' ? 'rose' : priority === 'draft' ? 'slate' : 'blue';
  const statusTone = status === 'published' ? 'emerald' : status === 'draft' ? 'slate' : 'amber';
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-ks-gold" />
          <Badge tone={pillTone}>{priority}</Badge>
          <Badge tone={statusTone}>{status}</Badge>
        </div>
        <p className="text-xs font-bold text-ks-muted">{date}</p>
      </div>
      <h3 className="mt-3 font-display text-xl font-black text-ks-navy">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-ks-muted">{detail}</p>
      <p className="mt-3 text-xs font-black uppercase tracking-wider text-ks-muted">Audience: {audience}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="rounded-xl py-1.5 text-xs">Preview</Button>
        {status === 'draft' && <Button className="rounded-xl bg-ks-navy py-1.5 text-xs">Publish</Button>}
      </div>
    </div>
  );
}

// ─── Icon panel ───────────────────────────────────────────────────────────────

export function IconPanel({ title, detail, icon }: { title: string; detail: string; icon: 'megaphone' | 'scale' | 'chart' | 'plus' }) {
  const Icon = icon === 'megaphone' ? Megaphone : icon === 'scale' ? Scale : icon === 'plus' ? Plus : BarChart3;
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <Icon className="h-7 w-7 text-ks-gold" />
      <h3 className="mt-4 font-display text-xl font-black text-ks-navy">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-ks-muted">{detail}</p>
    </div>
  );
}

// ─── Trend indicator ──────────────────────────────────────────────────────────

export function TrendChip({ value, positive }: { value: string; positive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-black ${positive ? 'text-ks-emerald' : 'text-ks-rose'}`}>
      {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {value}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function urgencyClass(urgency: Urgency, target: 'border' | 'bg') {
  if (target === 'bg') {
    return urgency === 'critical' ? 'bg-ks-rose'
      : urgency === 'high' ? 'bg-ks-amber'
      : urgency === 'medium' ? 'bg-ks-blue'
      : 'bg-ks-emerald';
  }
  return urgency === 'critical' ? 'border-l-4 border-l-ks-rose'
    : urgency === 'high' ? 'border-l-4 border-l-ks-amber'
    : urgency === 'medium' ? 'border-l-4 border-l-ks-blue'
    : 'border-l-4 border-l-ks-emerald';
}
