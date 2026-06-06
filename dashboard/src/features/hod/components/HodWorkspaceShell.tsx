import type { LucideIcon } from 'lucide-react';
import { CalendarX, TrendingDown, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import type { HodAlert, HodApproval, HodIntervention, HodPairing, HodSubject, HodTeacher } from '../types/hod.types';
import { useAuthStore } from '../../../lib/auth/authStore';

export function HodWorkspaceShell({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name ?? 'Head of Department';
  return (
    <div className="space-y-gutter">
      <section className="overflow-hidden rounded-xl border border-ks-navy/15 bg-[linear-gradient(135deg,#061f33,#0c4a6e_56%,#00334f)] p-8 text-white shadow-layer">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-ks-gold">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[44px] font-bold leading-[52px] tracking-[-0.02em]">{title}</h1>
            <p className="mt-1 text-sm font-semibold text-ks-mist/75">{userName} · Head of Department</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">Term II · 2026</Badge>
            <Badge tone="rose">3 Pending</Badge>
            <Badge tone="blue">Synced 2m ago</Badge>
            {action}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

// ─── Metric Strip ────────────────────────────────────────────────────────────

type HodMetricItem = {
  label: string;
  value: string;
  detail: string;
  tone?: string;
  valueColor?: string;
  inverted?: boolean;
  icon?: LucideIcon;
};

export function HodMetricStrip({ items }: { items: HodMetricItem[] }) {
  return (
    <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        if (item.inverted) {
          const Icon = item.icon;
          return (
            <div key={item.label} className="relative flex items-center justify-between overflow-hidden rounded-xl bg-ks-navy p-7 shadow-lg">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/5" />
              <div className="relative">
                <p className="text-[11px] font-black uppercase tracking-wider text-ks-mist/60">{item.label}</p>
                <p className="mt-1 font-display text-[42px] font-bold leading-[50px] text-white">{item.value}</p>
                <p className="text-sm font-semibold text-ks-mist/60">{item.detail}</p>
              </div>
              {Icon && <Icon className="relative h-10 w-10 shrink-0 text-ks-gold" />}
            </div>
          );
        }
        return (
          <Card key={item.label} className="relative overflow-hidden rounded-xl p-7 shadow-sm">
            <div className={`absolute left-0 top-0 h-full w-1.5 rounded-l-xl ${item.tone ?? 'bg-ks-sky'}`} />
            <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{item.label}</p>
            <p className={`mt-1 font-display text-[42px] font-bold leading-[50px] ${item.valueColor ?? 'text-ks-slate'}`}>{item.value}</p>
            <p className="text-sm font-semibold text-ks-muted">{item.detail}</p>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function HodTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ks-paper text-[11px] font-black uppercase tracking-wider text-ks-navy">
            <tr>{columns.map((column) => <th key={column} className="border-b border-ks-line px-5 py-3.5">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ks-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Risk flag badge ─────────────────────────────────────────────────────────

export function RiskFlagBadge({ flag }: { flag: string }) {
  const isHigh = flag.toLowerCase().includes('low') || flag.toLowerCase().includes('critical') || flag.toLowerCase().includes('outlier');
  const isMed = flag.toLowerCase().includes('watch') || flag.toLowerCase().includes('nominal');
  if (isHigh) {
    return <span className="inline-flex items-center gap-1 rounded border border-ks-rose/25 bg-ks-rose/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-rose"><TrendingDown className="h-3 w-3" />{flag}</span>;
  }
  if (isMed) {
    return <span className="inline-flex items-center gap-1 rounded border border-ks-amber/25 bg-ks-amber/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-amber"><Zap className="h-3 w-3" />{flag}</span>;
  }
  return <span className="rounded border border-ks-line bg-ks-mist/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-muted">Nominal</span>;
}

// ─── ApprovalQueueCard ───────────────────────────────────────────────────────

export function ApprovalQueueCard({ approval, compact = false }: { approval: HodApproval; compact?: boolean }) {
  const overdue = approval.submittedHoursAgo >= 48;
  const initials = approval.teacher.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className={`relative overflow-hidden rounded-xl transition hover:-translate-y-0.5 ${overdue ? 'border-2 border-ks-rose bg-ks-rose/5 shadow-md shadow-ks-rose/10 ring-1 ring-ks-rose/20' : 'hover:border-ks-blue/30 hover:shadow-layer'}`}>
      {overdue && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-ks-rose px-3 py-1 text-[10px] font-black text-white">
          48H+ OVERDUE
        </div>
      )}
      <div className="p-4">
        <p className={`text-[11px] font-black uppercase tracking-wider ${overdue ? 'text-ks-rose' : 'text-ks-muted'}`}>
          {approval.subject} · {approval.className}
        </p>
        <h3 className="mt-1 font-display text-xl font-black leading-tight text-ks-navy">{approval.assessment}</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">
            {initials}
          </div>
          <p className="text-sm font-semibold text-ks-muted">{approval.teacher} · {approval.submittedHoursAgo}h ago</p>
        </div>
        {!compact && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Average" value={`${approval.average}%`} tone={approval.average < 60 ? 'text-ks-rose' : 'text-ks-emerald'} />
            <MiniStat label="Marked" value={`${approval.marked}/${approval.students}`} />
            <MiniStat label="Risks" value={String(approval.riskFlags.length)} tone={approval.riskFlags.length > 1 ? 'text-ks-rose' : 'text-ks-amber'} />
          </div>
        )}
        <NavLink to={`/hod/approvals/${approval.id}`}>
          <Button variant={overdue ? 'danger' : 'secondary'} className="mt-4 w-full rounded-xl">
            Review Submission
          </Button>
        </NavLink>
      </div>
    </Card>
  );
}

// ─── SubjectHealthCard ───────────────────────────────────────────────────────

export function SubjectHealthCard({ subject }: { subject: HodSubject }) {
  const isRisk = subject.tone === 'rose';
  const barTone = isRisk ? 'bg-ks-rose' : subject.tone === 'emerald' ? 'bg-ks-emerald' : subject.tone === 'amber' ? 'bg-ks-amber' : 'bg-ks-blue';
  const avgColor = isRisk ? 'text-ks-rose' : subject.average >= 75 ? 'text-ks-emerald' : 'text-ks-amber';
  return (
    <NavLink to={`/hod/department/subjects/${subject.id}`} className="block">
      <Card className={`group overflow-hidden rounded-xl transition hover:-translate-y-0.5 hover:shadow-layer ${isRisk ? 'ring-1 ring-ks-rose/20' : ''}`}>
        <div className={`h-1.5 ${barTone}`} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Department subject</p>
              <h3 className="mt-1 font-display text-2xl font-black text-ks-navy">{subject.name}</h3>
            </div>
            <Badge tone={isRisk ? 'rose' : subject.tone === 'emerald' ? 'emerald' : 'amber'}>
              {isRisk ? 'CRITICAL' : subject.tone === 'emerald' ? 'STABLE' : 'WATCH'}
            </Badge>
          </div>
          <p className={`mt-4 font-display text-4xl font-black ${avgColor}`}>{subject.average}%</p>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-ks-muted">
            <span>{subject.studentsAssessed} students assessed · {subject.assessments} assessment{subject.assessments === 1 ? '' : 's'}</span>
          </div>
          <ProgressBar value={subject.average} tone={barTone} className="mt-3" />
          <p className="mt-1 text-xs font-bold text-ks-muted">{subject.teacher}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="At risk" value={String(subject.atRisk)} tone={isRisk ? 'text-ks-rose' : 'text-ks-slate'} />
            <MiniStat label="Alerts" value={String(subject.alerts)} tone={subject.alerts > 0 ? 'text-ks-amber' : 'text-ks-slate'} />
            <MiniStat label="Pending" value={String(subject.pending)} tone={subject.pending > 0 ? 'text-ks-amber' : 'text-ks-slate'} />
          </div>
        </div>
      </Card>
    </NavLink>
  );
}

// ─── TeacherRiskCard ─────────────────────────────────────────────────────────

export function TeacherRiskCard({ teacher }: { teacher: HodTeacher }) {
  const risk = teacher.onTime < 60 || teacher.average < 60;
  const initials = teacher.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className={`overflow-hidden rounded-xl ${risk ? 'ring-1 ring-ks-rose/20' : ''}`}>
      <div className={`h-1 ${risk ? 'bg-ks-rose' : 'bg-ks-emerald'}`} />
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${risk ? 'bg-ks-rose border-2 border-ks-rose/30' : 'bg-ks-emerald'}`}>
            {initials}
          </div>
          <div>
            <h3 className="font-display text-xl font-black text-ks-navy">{teacher.name}</h3>
            <p className={`text-xs font-bold ${risk ? 'text-ks-rose' : 'text-ks-muted'}`}>{teacher.subjects}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-bold text-ks-muted">Class average</span>
              <span className={`font-black ${teacher.average < 60 ? 'text-ks-rose' : 'text-ks-emerald'}`}>{teacher.average}%</span>
            </div>
            <ProgressBar value={teacher.average} tone={teacher.average < 60 ? 'bg-ks-rose' : 'bg-ks-emerald'} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-bold text-ks-muted">On-time submissions</span>
              <span className={`font-black ${teacher.onTime < 60 ? 'text-ks-rose' : 'text-ks-emerald'}`}>{teacher.onTime}%</span>
            </div>
            <ProgressBar value={teacher.onTime} tone={teacher.onTime < 60 ? 'bg-ks-rose' : 'bg-ks-emerald'} />
          </div>
          <MiniLine label="Pending approvals" value={String(teacher.pending)} />
        </div>
        <NavLink to={`/hod/teachers/${teacher.id}`}>
          <Button variant="secondary" className="mt-4 w-full rounded-xl">Open Teacher Detail</Button>
        </NavLink>
      </div>
    </Card>
  );
}

// ─── DepartmentAlertCard ─────────────────────────────────────────────────────

export function DepartmentAlertCard({ alert }: { alert: HodAlert }) {
  const high = alert.severity === 'CRITICAL' || alert.severity === 'HIGH';
  const medium = alert.severity === 'MEDIUM';
  const tone = high ? 'rose' : medium ? 'amber' : 'emerald';
  const SeverityIcon = high ? TrendingDown : medium ? CalendarX : Zap;
  const borderColor = tone === 'rose' ? 'border-l-ks-rose' : tone === 'amber' ? 'border-l-ks-amber' : 'border-l-ks-emerald';
  const bgColor = tone === 'rose' ? 'bg-ks-rose/5' : tone === 'amber' ? 'bg-ks-amber/5' : 'bg-ks-emerald/5';
  const initials = alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className={`overflow-hidden rounded-xl border-l-4 ${borderColor} ${bgColor}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${tone === 'rose' ? 'bg-ks-rose' : tone === 'amber' ? 'bg-ks-amber' : 'bg-ks-emerald'}`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-ks-muted">{alert.subject} · {alert.className}</p>
                <h3 className="font-display text-xl font-black text-ks-navy">{alert.student}</h3>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${tone === 'rose' ? 'border-ks-rose/25 bg-ks-rose/10 text-ks-rose' : tone === 'amber' ? 'border-ks-amber/25 bg-ks-amber/10 text-ks-amber' : 'border-ks-emerald/25 bg-ks-emerald/10 text-ks-emerald'}`}>
                <SeverityIcon className="h-3 w-3" />
                {alert.severity}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-ks-muted">{alert.reason}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <NavLink to={`/hod/students/${alert.studentId}`}>
            <Button variant="secondary" className="rounded-lg py-2 text-xs">View Student</Button>
          </NavLink>
          <Button variant={tone === 'rose' ? 'danger' : 'quiet'} className="rounded-lg py-2 text-xs">{alert.action}</Button>
        </div>
      </div>
    </Card>
  );
}

// ─── PairingReviewCard ────────────────────────────────────────────────────────

export function PairingReviewCard({ pairing }: { pairing: HodPairing }) {
  const mentorInitials = pairing.mentor.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const supportInitials = pairing.support.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className="overflow-hidden rounded-xl transition hover:-translate-y-0.5 hover:shadow-layer">
      <div className="p-5">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-3 overflow-hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ks-blue text-xs font-black text-white ring-2 ring-white">
              {mentorInitials}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ks-emerald text-xs font-black text-white ring-2 ring-white">
              {supportInitials}
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Peer pairing · {pairing.subject}</p>
            <p className="font-display text-lg font-black text-ks-navy">{pairing.mentor} → {pairing.support}</p>
          </div>
        </div>
        {(pairing.mentorScore != null || pairing.supportScore != null) && (
          <div className="mt-3 flex items-center gap-4 text-xs font-bold">
            <span className="text-ks-emerald">Mentor: {pairing.mentorScore ?? '—'}%</span>
            <span className="text-ks-muted">·</span>
            <span className="text-ks-rose">Support: {pairing.supportScore ?? '—'}%</span>
            {pairing.mentorScore != null && pairing.supportScore != null && (
              <span className="ml-auto rounded bg-ks-mist px-2 py-0.5 font-black text-ks-navy">Gap {pairing.mentorScore - pairing.supportScore}%</span>
            )}
          </div>
        )}
        <p className="mt-4 rounded-xl border border-ks-sky/15 bg-ks-mist/50 p-3 text-sm font-semibold italic text-ks-navy">{pairing.benefit}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Badge tone={pairing.status === 'ACTIVE' ? 'emerald' : pairing.status === 'COMPLETED' ? 'slate' : 'blue'}>
            {pairing.status}
          </Badge>
          <div className="flex gap-2">
            <Button variant="success" className="rounded-xl py-2 text-xs">Activate</Button>
            <Button variant="secondary" className="rounded-xl py-2 text-xs">Reject</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── InterventionCard ─────────────────────────────────────────────────────────

export function InterventionCard({ item }: { item: HodIntervention }) {
  const open = item.status !== 'COMPLETED';
  const borderColor = open ? 'border-l-ks-amber' : 'border-l-ks-emerald';
  const bg = open ? 'bg-ks-amber/5' : 'bg-ks-emerald/5';
  const initials = item.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className={`overflow-hidden rounded-xl border-l-4 ${borderColor} ${bg}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${open ? 'bg-ks-amber' : 'bg-ks-emerald'}`}>
            {initials}
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{item.subject} · {item.className} · {item.age}</p>
            <h3 className="font-display text-xl font-black text-ks-navy">{item.student}</h3>
            <p className="mt-1 text-xs font-bold text-ks-muted">{item.type}</p>
          </div>
        </div>
        <p className="mt-3 text-sm font-semibold text-ks-muted">{item.note}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Badge tone={open ? 'amber' : 'emerald'}>{open ? 'FOLLOW UP' : 'COMPLETED'}</Badge>
          <Button variant={open ? 'success' : 'secondary'} className="rounded-xl py-2 text-xs">
            {open ? 'Mark Followed Up' : 'View Record'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

export function ProgressBar({ value, tone = 'bg-ks-blue', className }: { value: number; tone?: string; className?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className={`relative h-2.5 overflow-visible rounded-full bg-ks-line ${className ?? ''}`}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <motion.div
        className={`h-full rounded-full ${tone}`}
        initial={{ width: '0%' }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 1.0, ease: 'easeOut' }}
      />
      <AnimatePresence>
        {hov && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute -top-8 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ks-navy px-2 py-1 text-center shadow-lg"
          >
            <span className="text-[10px] font-black text-white">{value}%</span>
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ks-navy" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MiniStat({ label, value, tone = 'text-ks-slate' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-ks-paper p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-ks-muted">{label}</p>
      <p className={`mt-1 font-display text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}

export function MiniLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-ks-paper p-3">
      <span className="text-sm font-bold text-ks-muted">{label}</span>
      <span className="font-display text-lg font-black text-ks-navy">{value}</span>
    </div>
  );
}

// ─── SparkLine ────────────────────────────────────────────────────────────────

export function HodSparkLine({ data, color = '#0284C7' }: { data: number[]; color?: string }) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 64; const h = 28;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 6) - 3,
    v,
  }));
  const pointStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const hp = hovIdx !== null ? pts[hovIdx] : null;

  const handleMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = ((e.clientX - rect.left) / rect.width) * w;
    let best = 0;
    pts.forEach((p, i) => { if (Math.abs(p.x - mx) < Math.abs(pts[best].x - mx)) best = i; });
    setHovIdx(best);
  };

  return (
    <div className="relative shrink-0">
      <svg
        ref={svgRef}
        width={w} height={h}
        className="overflow-visible cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHovIdx(null)}
      >
        <polyline points={pointStr} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {hp && hp.x !== last.x && (
          <>
            <line x1={hp.x} x2={hp.x} y1={0} y2={h} stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6" />
            <circle cx={hp.x} cy={hp.y} r="2.5" fill="white" stroke={color} strokeWidth="1.5" />
          </>
        )}
        <circle cx={last.x} cy={last.y} r="2.5" fill={hovIdx === pts.length - 1 ? 'white' : color} stroke={color} strokeWidth="1.5" />
      </svg>
      <AnimatePresence>
        {hovIdx !== null && hp && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute -top-9 left-1/2 z-50 -translate-x-1/2 rounded-md bg-ks-navy px-2 py-1 text-center shadow-lg"
          >
            <span className="text-[10px] font-black text-white">{hp.v}</span>
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-[3px] border-transparent border-t-ks-navy" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
