import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  Gauge,
  Radar,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import type { AqaAlert, AqaIntervention, AqaPairing, HeatmapCell, Threshold } from '../types/aqa.types';
import { heatTone } from '../utils/aqaEngine';
import { useAuthStore } from '../../../lib/auth/authStore';

// ─── Shell ───────────────────────────────────────────────────────────────────

export function AqaWorkspaceShell({
  title, eyebrow, children, action,
}: {
  title: string; eyebrow: string; children: ReactNode; action?: ReactNode;
}) {
  const session = useAuthStore((state) => state.session);
  const userName = session?.user?.name ?? 'AQA Officer';
  return (
    <div className="space-y-gutter">
      {/* Header banner */}
      <section className="relative overflow-hidden rounded-xl border border-ks-navy/15 bg-[radial-gradient(circle_at_80%_10%,rgba(14,165,233,0.22),transparent_28%),linear-gradient(135deg,#061f33,#0c4a6e_55%,#00334f)] p-8 text-white shadow-layer">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ks-blue/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-ks-gold">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[44px] font-bold leading-[52px] tracking-[-0.02em]">{title}</h1>
            <p className="mt-1.5 text-sm font-semibold text-white/70">{userName} · Academic Quality Assurance</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="gold">Term II</Badge>
            <Badge tone="emerald">Engine Active</Badge>
            <Badge tone="rose">3 Critical</Badge>
            {action}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

// ─── Metric strip ────────────────────────────────────────────────────────────

type MetricItem = {
  label: string;
  value: string;
  detail: string;
  tone: string;
  trend?: 'up' | 'down' | 'neutral';
  inverted?: boolean;
};

const TONE_ICON: Record<string, LucideIcon> = {
  'bg-ks-rose':    AlertTriangle,
  'bg-ks-amber':   Zap,
  'bg-ks-blue':    BarChart3,
  'bg-ks-emerald': CheckCircle2,
  'bg-ks-gold':    Bell,
  'bg-ks-sky':     Activity,
  'bg-ks-navy':    Radar,
};

const TONE_TEXT: Record<string, string> = {
  'bg-ks-rose':    'text-ks-rose',
  'bg-ks-amber':   'text-ks-amber',
  'bg-ks-blue':    'text-ks-blue',
  'bg-ks-emerald': 'text-ks-emerald',
  'bg-ks-gold':    'text-ks-gold',
  'bg-ks-sky':     'text-ks-sky',
  'bg-ks-navy':    'text-ks-navy',
};

const TONE_ICON_BG: Record<string, string> = {
  'bg-ks-rose':    'bg-ks-rose/10',
  'bg-ks-amber':   'bg-ks-amber/10',
  'bg-ks-blue':    'bg-ks-blue/10',
  'bg-ks-emerald': 'bg-ks-emerald/10',
  'bg-ks-gold':    'bg-ks-gold/10',
  'bg-ks-sky':     'bg-ks-sky/10',
  'bg-ks-navy':    'bg-ks-navy/10',
};

const TONE_BORDER: Record<string, string> = {
  'bg-ks-rose':    'border-ks-rose',
  'bg-ks-amber':   'border-ks-amber',
  'bg-ks-blue':    'border-ks-blue',
  'bg-ks-emerald': 'border-ks-emerald',
  'bg-ks-gold':    'border-ks-gold',
  'bg-ks-sky':     'border-ks-sky',
  'bg-ks-navy':    'border-ks-navy',
};

export function AqaMetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = TONE_ICON[item.tone] ?? BarChart3;
        const textTone = TONE_TEXT[item.tone] ?? 'text-ks-navy';
        const iconBg = TONE_ICON_BG[item.tone] ?? 'bg-ks-mist';
        const border = TONE_BORDER[item.tone] ?? 'border-ks-navy';

        // Last card inverted (navy)
        if (item.inverted) {
          return (
            <div key={item.label} className="relative overflow-hidden rounded-xl bg-ks-navy p-7 text-white shadow-sm">
              <div className="pointer-events-none absolute -right-4 -bottom-4 opacity-10">
                <Icon className="h-28 w-28" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-ks-gold">{item.label}</p>
              <p className="mt-3 font-display text-[42px] font-bold leading-tight text-white">{item.value}</p>
              <p className="mt-2 text-sm font-semibold text-white/70">{item.detail}</p>
            </div>
          );
        }

        return (
          <Card key={item.label} className={`relative overflow-hidden rounded-xl border-l-4 p-7 ${border}`}>
            <div className="flex items-start justify-between">
              <p className={`text-[11px] font-black uppercase tracking-wider ${textTone}`}>{item.label}</p>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className={`h-5 w-5 ${textTone}`} />
              </div>
            </div>
            <p className="mt-3 font-display text-[42px] font-bold leading-tight text-ks-slate">{item.value}</p>
            <p className={`mt-2 flex items-center gap-1.5 text-sm font-semibold ${
              item.trend === 'up'   ? 'text-ks-rose'    :
              item.trend === 'down' ? 'text-ks-emerald' :
              'text-ks-muted'
            }`}>
              {item.trend === 'up'   && <TrendingUp   className="h-4 w-4" />}
              {item.trend === 'down' && <TrendingDown  className="h-4 w-4" />}
              {item.detail}
            </p>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

export function AqaTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-ks-paper/80 text-[11px] font-black uppercase tracking-widest text-ks-navy">
            <tr>
              {columns.map((col) => (
                <th key={col} className="border-b border-ks-line px-5 py-4">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ks-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Engine status ───────────────────────────────────────────────────────────

export function EngineStatusCard() {
  return (
    <Card className="relative overflow-hidden rounded-xl p-6">
      {/* Watermark icon */}
      <div className="pointer-events-none absolute right-4 top-4 opacity-[0.04]">
        <Gauge className="h-20 w-20" />
      </div>
      <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">AQA Engine Status</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-[36px] font-bold leading-[44px] text-ks-navy">98.2%</span>
        <span className="flex items-center gap-1 text-xs font-bold text-ks-emerald">
          <TrendingUp className="h-3 w-3" /> +0.4
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-ks-muted">Process integrity healthy</p>

      <div className="mt-5 space-y-3 border-t border-ks-line pt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ks-muted">Last run</span>
          <span className="font-black text-ks-navy">Today 02:03 AM</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ks-muted">Students processed</span>
          <span className="font-black text-ks-navy">312</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ks-muted">Alerts created</span>
          <span className="font-black text-ks-rose">17</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ks-muted">Resolved</span>
          <span className="font-black text-ks-emerald">9</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-ks-muted">Duration</span>
          <span className="font-black text-ks-navy">4m 18s</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ks-mist">
        <div className="h-full w-full bg-ks-blue" />
      </div>
      <Button className="mt-5 w-full rounded-xl">
        <Zap className="h-4 w-4" /> Run Engine
      </Button>
    </Card>
  );
}

// ─── Heatmap ─────────────────────────────────────────────────────────────────

export function SchoolHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const subjects = [...new Set(cells.map((c) => c.subject))];
  const classes  = [...new Set(cells.map((c) => c.className))];
  const [hovKey, setHovKey] = useState<string | null>(null);

  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line px-6 py-4">
        <div>
          <h2 className="font-display text-xl font-black text-ks-navy">Whole-School Academic Health</h2>
          <p className="text-sm font-semibold text-ks-muted">Current phase average against benchmark</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-black uppercase text-ks-muted">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ks-rose/60" />Weak</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ks-amber/50" />Watch</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ks-sky/60" />Stable</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-ks-emerald/80" />Strong</span>
        </div>
      </div>
      <div className="p-6">
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            <div
              className="grid gap-1.5 text-center text-[10px] font-black uppercase tracking-wider text-ks-muted"
              style={{ gridTemplateColumns: `140px repeat(${classes.length}, 1fr)` }}
            >
              <div />
              {classes.map((cn) => <div key={cn}>{cn}</div>)}
            </div>
            <div className="mt-2 space-y-1.5">
              {subjects.map((subject) => (
                <div
                  key={subject}
                  style={{ gridTemplateColumns: `140px repeat(${classes.length}, 1fr)` }}
                  className="grid gap-1.5"
                >
                  <div className={`flex items-center rounded-lg px-3 py-3 text-sm font-black ${
                    subject === 'Chemistry' ? 'bg-ks-rose text-white' : 'bg-ks-paper text-ks-navy'
                  }`}>
                    {subject}
                  </div>
                  {classes.map((cn) => {
                    const cell = cells.find((c) => c.subject === subject && c.className === cn);
                    const key  = `${subject}-${cn}`;
                    const isHov = hovKey === key;
                    return (
                      <div
                        key={key}
                        className="relative"
                        onMouseEnter={() => setHovKey(key)}
                        onMouseLeave={() => setHovKey(null)}
                      >
                        <NavLink
                          to={`/aqa/analytics/classes/${cell?.classId ?? 'form-3b'}`}
                          className={`relative flex h-14 items-center justify-center rounded-lg transition hover:scale-[1.05] hover:z-10 hover:shadow-md ${heatTone(cell?.average ?? 0)}`}
                        >
                          <span className="text-sm font-black text-ks-navy">{cell?.average}%</span>
                          {cell?.alerts ? (
                            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ks-rose shadow shadow-ks-rose/40" />
                          ) : null}
                        </NavLink>
                        <AnimatePresence>
                          {isHov && cell && (
                            <motion.div
                              initial={{ opacity: 0, y: 6, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 6, scale: 0.9 }}
                              transition={{ duration: 0.15 }}
                              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-xl bg-ks-navy px-3 py-2.5 text-center shadow-2xl"
                            >
                              <p className="text-[9px] font-black uppercase tracking-widest text-ks-gold">{subject}</p>
                              <p className="font-display text-xl font-black text-white">{cn}</p>
                              <p className="font-mono text-lg font-black text-ks-gold">{cell.average}%</p>
                              {cell.alerts ? (
                                <p className="text-[9px] font-bold text-ks-rose">{cell.alerts} alert{cell.alerts > 1 ? 's' : ''}</p>
                              ) : (
                                <p className="text-[9px] font-bold text-ks-emerald">No alerts</p>
                              )}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-ks-navy" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Alert card ──────────────────────────────────────────────────────────────

export function AlertCard({ alert }: { alert: AqaAlert }) {
  const isCritical = alert.severity === 'CRITICAL';
  const isHigh     = alert.severity === 'HIGH';
  const isPos      = alert.severity === 'POSITIVE';
  const tone       = isCritical ? 'rose' : isHigh ? 'amber' : isPos ? 'emerald' : 'blue';

  const borderCls  = isCritical ? 'border-l-ks-rose bg-ks-rose/5'
                   : isHigh     ? 'border-l-ks-amber bg-ks-amber/5'
                   : isPos      ? 'border-l-ks-emerald bg-ks-emerald/5'
                   : 'border-l-ks-blue';

  const initials = alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Card className={`rounded-xl border border-ks-line border-l-4 p-5 transition hover:shadow-layer ${borderCls} ${isCritical ? 'shadow-ks-rose/10' : ''}`}
      style={isCritical ? { boxShadow: '0 0 15px -3px rgba(244,63,94,0.25)' } : {}}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${
            isCritical ? 'bg-ks-rose' : isHigh ? 'bg-ks-amber' : isPos ? 'bg-ks-emerald' : 'bg-ks-blue'
          }`}>
            {initials}
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{alert.type} · {alert.subject}</p>
            <h3 className="mt-0.5 font-display text-xl font-black text-ks-navy">{alert.student}</h3>
            <p className="text-xs font-semibold text-ks-muted">{alert.className}</p>
          </div>
        </div>
        <Badge tone={tone}>{alert.severity}</Badge>
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-ks-muted">{alert.evidence}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <NavLink to={`/aqa/performance/alerts/${alert.id}`}>
          <Button variant="secondary" className="rounded-xl py-2 text-xs">Investigate</Button>
        </NavLink>
        <NavLink to={`/aqa/students/${alert.studentId}`}>
          <Button variant="quiet" className="rounded-xl py-2 text-xs">Student profile</Button>
        </NavLink>
        {isCritical && (
          <span className="ml-auto text-[11px] font-black uppercase tracking-wide text-ks-rose">Action required</span>
        )}
      </div>
    </Card>
  );
}

// ─── Pairing funnel ──────────────────────────────────────────────────────────

export function PairingFunnel() {
  const rows = [
    { label: 'Suggested',        value: 42, pct: 100, tone: 'bg-ks-navy'    },
    { label: 'Activated',        value: 30, pct: 71,  tone: 'bg-ks-sky'     },
    { label: 'Positive outcome', value: 26, pct: 62,  tone: 'bg-ks-emerald' },
  ];
  const [hov, setHov] = useState<number | null>(null);
  return (
    <Card className="rounded-xl p-6">
      <h2 className="font-display text-xl font-black text-ks-navy">Pairing Effectiveness</h2>
      <p className="mt-1 text-sm font-semibold text-ks-muted">Measurable score lift after activation</p>
      <div className="mt-6 space-y-5">
        {rows.map(({ label, value, pct, tone }, i) => (
          <div
            key={label}
            className="cursor-pointer"
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
          >
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className={`font-bold transition-colors ${hov === i ? 'text-ks-navy' : 'text-ks-navy/70'}`}>{label}</span>
              <div className="flex items-center gap-3">
                <span className="font-black text-ks-navy">{value}</span>
                <motion.span
                  animate={{ color: hov === i ? '#061f33' : '#94a3b8' }}
                  transition={{ duration: 0.2 }}
                  className="w-10 text-right text-[11px] font-bold"
                >
                  {pct}%
                </motion.span>
              </div>
            </div>
            <div className="relative h-9 overflow-hidden rounded-lg bg-ks-mist">
              <motion.div
                className={`h-full rounded-lg ${tone}`}
                initial={{ width: '0%' }}
                animate={{ width: `${pct}%`, opacity: hov === i ? 1 : 0.82 }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.12 }}
              />
              <AnimatePresence>
                {hov === i && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="pointer-events-none absolute inset-0 flex items-center px-3 text-[11px] font-black text-white drop-shadow"
                  >
                    {value} students · {pct}% conversion rate
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between rounded-lg bg-ks-emerald/10 px-4 py-3">
        <span className="text-sm font-bold text-ks-emerald">Overall effectiveness</span>
        <span className="font-display text-xl font-black text-ks-emerald">62%</span>
      </div>
    </Card>
  );
}

// ─── Threshold editor ────────────────────────────────────────────────────────

export function ThresholdEditor({ item, value, onChange }: { item: Threshold; value: number; onChange: (v: number) => void }) {
  const bar  = item.tone === 'rose' ? 'bg-ks-rose' : item.tone === 'amber' ? 'bg-ks-amber' : item.tone === 'emerald' ? 'bg-ks-emerald' : 'bg-ks-blue';
  const text = item.tone === 'rose' ? 'text-ks-rose' : item.tone === 'amber' ? 'text-ks-amber' : item.tone === 'emerald' ? 'text-ks-emerald' : 'text-ks-blue';
  return (
    <Card className="rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Threshold rail</p>
          <h3 className={`mt-1 font-display text-xl font-black ${text}`}>{item.label}</h3>
          <p className="mt-1 text-sm font-semibold text-ks-muted">{item.description}</p>
        </div>
        <div className={`rounded-lg border px-4 py-1.5 font-mono text-lg font-black ${text} border-current/20 bg-current/5`}
          style={{ color: 'inherit' }}>
          <span className={text}>{value}%</span>
        </div>
      </div>
      <div className="mt-5">
        <div className="relative h-2 rounded-full bg-ks-line">
          <div className={`h-full rounded-full transition-all duration-300 ${bar}`} style={{ width: `${(value / item.max) * 100}%` }} />
          <div className="absolute -top-8 rounded bg-ks-navy px-2 py-1 text-[10px] font-black text-white"
            style={{ left: `calc(${(value / item.max) * 100}% - 18px)` }}>
            {value}%
          </div>
        </div>
        <input className="mt-4 w-full accent-ks-blue" min={item.min} max={item.max} value={value} type="range"
          onChange={(e) => onChange(Number(e.target.value))} />
        <div className="flex justify-between text-[10px] font-black uppercase text-ks-muted">
          <span>{item.min}%</span><span>{item.max}%</span>
        </div>
      </div>
    </Card>
  );
}

// ─── Pairing table ───────────────────────────────────────────────────────────

export function PairingTable({ pairings }: { pairings: AqaPairing[] }) {
  return (
    <AqaTable columns={['Support', 'Mentor', 'Class', 'Subject', 'Gap', 'Reason', 'Status', 'Teacher', 'Outcome', 'Actions']}>
      {pairings.map((p) => (
        <tr key={p.id} className="transition hover:bg-ks-paper">
          <Td><span className="font-bold text-ks-navy">{p.support}</span></Td>
          <Td>{p.mentor}</Td>
          <Td>{p.className}</Td>
          <Td>{p.subject}</Td>
          <Td><span className="font-black text-ks-rose">{p.scoreGap}</span></Td>
          <Td>{p.reason}</Td>
          <Td><Badge tone={p.status === 'ACTIVE' ? 'emerald' : 'blue'}>{p.status}</Badge></Td>
          <Td>{p.teacher}</Td>
          <Td>{p.outcome}</Td>
          <Td>
            <Button variant="secondary" className="rounded-lg py-1.5 text-xs">Open</Button>
          </Td>
        </tr>
      ))}
    </AqaTable>
  );
}

// ─── Intervention card ───────────────────────────────────────────────────────

export function InterventionCard({ item }: { item: AqaIntervention }) {
  const open = item.status !== 'COMPLETED';
  const initials = item.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className={`rounded-xl border-l-4 p-5 ${open ? 'border-l-ks-amber bg-ks-amber/5' : 'border-l-ks-emerald bg-ks-emerald/5'}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${open ? 'bg-ks-amber' : 'bg-ks-emerald'}`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{item.week} · {item.roleOwner}</p>
          <h3 className="mt-0.5 font-display text-xl font-black text-ks-navy">{item.student}</h3>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ks-muted">{item.note}</p>
          <div className="mt-4 flex items-center justify-between">
            <Badge tone={open ? 'amber' : 'emerald'}>{item.status}</Badge>
            <Button variant={open ? 'success' : 'secondary'} className="rounded-xl py-2 text-xs">Follow up</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function Td({ children }: { children: ReactNode }) {
  return <td className="px-5 py-3.5 font-semibold text-ks-slate">{children}</td>;
}
