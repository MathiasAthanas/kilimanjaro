import type { LucideIcon } from 'lucide-react';
import { CalendarX, ChevronRight, Link2, TrendingDown, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import type { Alert, Assessment, ClassSubject, MarkRow, Pairing, Student, TimetableEntry } from '../types/teacher.types';
import { validateScore } from '../utils/marks';
import { useAuthStore } from '../../../lib/auth/authStore';

export function TeacherWorkspaceShell({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const teacherName = session?.user?.name ?? 'Teacher';
  return (
    <div className="space-y-gutter">
      <section className="overflow-hidden rounded-xl border border-ks-navy/15 bg-[linear-gradient(135deg,#00334f,#0c4a6e_58%,#083855)] p-8 text-white shadow-layer">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[44px] font-bold leading-[52px] tracking-[-0.02em]">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-ks-mist/70">{teacherName} · Teacher Portal</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="gold">Term II · 2026</Badge>
            <Badge tone="blue">Autosave on</Badge>
            {action}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

type MetricItem = {
  label: string;
  value: string;
  detail: string;
  tone?: string;
  valueColor?: string;
  inverted?: boolean;
  icon?: LucideIcon;
};

export function TeacherMetricStrip({ items }: { items: MetricItem[] }) {
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
            <div className={`absolute left-0 top-0 h-full w-1.5 ${item.tone ?? 'bg-ks-sky'}`} />
            <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{item.label}</p>
            <p className={`mt-1 font-display text-[42px] font-bold leading-[50px] ${item.valueColor ?? 'text-ks-slate'}`}>{item.value}</p>
            <p className="text-sm font-semibold text-ks-muted">{item.detail}</p>
          </Card>
        );
      })}
    </div>
  );
}

export function ClassSubjectCard({ item }: { item: ClassSubject }) {
  const riskTone = item.risk === 'HIGH' ? 'bg-ks-rose' : item.risk === 'MEDIUM' ? 'bg-ks-amber' : 'bg-ks-emerald';
  const badgeTone = item.risk === 'HIGH' ? 'rose' : item.risk === 'MEDIUM' ? 'amber' : 'emerald';
  return (
    <Card className="group overflow-hidden rounded-xl transition hover:-translate-y-0.5 hover:shadow-layer">
      <div className={`h-1.5 ${riskTone}`} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-ks-muted">{item.subject}</p>
            <h3 className="mt-1 font-display text-2xl font-black text-ks-slate">{item.className}</h3>
          </div>
          <Badge tone={badgeTone}>{`${item.risk} RISK`}</Badge>
        </div>
        <div className="mt-stack-md grid grid-cols-2 gap-2.5 text-sm">
          <MiniStat label="Assessments" value={String(item.assessmentCount)} />
          <MiniStat label="Open marks" value={String(item.openAssessments)} color={item.openAssessments > 0 ? 'text-ks-amber' : 'text-ks-emerald'} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ks-muted">
            <span>Syllabus coverage</span><span>{item.syllabus}%</span>
          </div>
          <ProgressBar value={item.syllabus} tone={item.syllabus >= 70 ? 'bg-ks-emerald' : item.syllabus >= 50 ? 'bg-ks-amber' : 'bg-ks-rose'} />
        </div>
        <NavLink to={`/teacher/classes/${item.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-black text-ks-blue hover:underline">
          Open workspace <ChevronRight className="h-4 w-4" />
        </NavLink>
      </div>
    </Card>
  );
}

export function AssessmentStatusBadge({ status }: { status: Assessment['status'] }) {
  const map: Record<Assessment['status'], { tone: 'blue' | 'amber' | 'emerald' | 'rose' | 'slate'; label: string }> = {
    OPEN: { tone: 'blue', label: 'Open' },
    SUBMITTED: { tone: 'amber', label: 'Submitted' },
    APPROVED: { tone: 'emerald', label: 'Approved' },
    REJECTED: { tone: 'rose', label: 'Rejected' },
    DRAFT: { tone: 'slate', label: 'Draft' },
    LOCKED: { tone: 'slate', label: 'Locked' },
  };
  const { tone, label } = map[status] ?? { tone: 'slate', label: status };
  return <Badge tone={tone}>{label}</Badge>;
}

export function AlertTypeBadge({ type, severity }: { type: string; severity: Alert['severity'] }) {
  const map = {
    CRITICAL: { icon: TrendingDown, bg: 'bg-ks-rose/10', text: 'text-ks-rose', border: 'border-ks-rose/25' },
    AT_RISK: { icon: CalendarX, bg: 'bg-ks-amber/10', text: 'text-ks-amber', border: 'border-ks-amber/25' },
    INFO: { icon: Zap, bg: 'bg-ks-sky/10', text: 'text-ks-sky', border: 'border-ks-sky/25' },
  };
  const { icon: Icon, bg, text, border } = map[severity] ?? map.INFO;
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-bold ${bg} ${text} ${border}`}>
      <Icon className="h-3 w-3" />
      {type}
    </span>
  );
}

export function TeacherTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-ks-line bg-ks-mist/30 text-[11px] font-black uppercase tracking-wider text-ks-navy">
            <tr>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ks-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function MarksGrid({ rows, maxScore }: { rows: MarkRow[]; maxScore: number }) {
  return (
    <TeacherTable columns={['#', 'Student', 'Registration', 'Score', 'Absent', 'Note', 'Status']}>
      {rows.map((row, index) => {
        const validation = validateScore(row.score, maxScore, row.absent);
        return (
          <tr key={row.id} className="group transition hover:bg-ks-paper">
            <td className="px-4 py-3 font-black text-ks-muted">{index + 1}</td>
            <td className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ks-mist text-xs font-black text-ks-blue">
                  {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-ks-slate">{row.name}</span>
              </div>
            </td>
            <td className="px-4 py-3 font-mono text-xs text-ks-muted">{row.registration}</td>
            <td className="px-4 py-3">
              <input
                className={`h-9 w-24 rounded-md border px-3 font-black outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/15 ${
                  validation.valid ? 'border-ks-line bg-white' : 'border-ks-rose bg-ks-rose/5'
                }`}
                defaultValue={row.score}
                disabled={row.absent}
                aria-label={`Score for ${row.name}`}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') event.preventDefault();
                }}
              />
            </td>
            <td className="px-4 py-3">
              <input className="h-4 w-4 rounded border-ks-line text-ks-blue focus:ring-ks-blue" type="checkbox" defaultChecked={row.absent} aria-label={`Absent for ${row.name}`} />
            </td>
            <td className="px-4 py-3 text-ks-muted">{row.note || <span className="text-ks-line">—</span>}</td>
            <td className="px-4 py-3"><Badge tone={validation.tone}>{validation.message}</Badge></td>
          </tr>
        );
      })}
    </TeacherTable>
  );
}

export function AttendanceGrid({ students }: { students: Student[] }) {
  return (
    <TeacherTable columns={['Roll', 'Student', 'Present', 'Absent', 'Late', 'Excused', 'Note']}>
      {students.map((student, index) => (
        <tr key={student.id} className="hover:bg-ks-paper">
          <td className="px-4 py-3 font-mono text-xs text-ks-muted">{student.roll}</td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ks-mist text-xs font-black text-ks-blue">
                {student.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="font-bold text-ks-slate">{student.name}</span>
            </div>
          </td>
          {['P', 'A', 'L', 'E'].map((status) => (
            <td key={status} className="px-4 py-3">
              <button
                className={`h-8 w-8 rounded-md border text-xs font-black transition active:scale-95 ${
                  index % 5 === 0 && status === 'A'
                    ? 'border-ks-rose bg-ks-rose text-white shadow-sm'
                    : status === 'P'
                    ? 'border-ks-emerald bg-ks-emerald/10 text-ks-emerald'
                    : 'border-ks-line text-ks-muted hover:bg-ks-mist/40'
                }`}
              >
                {status}
              </button>
            </td>
          ))}
          <td className="px-4 py-3 text-ks-muted">—</td>
        </tr>
      ))}
    </TeacherTable>
  );
}

export function TimetableBoard({ entries }: { entries: TimetableEntry[] }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const times = ['08:00', '09:10', '10:20', '12:10'];
  const subjectColors: Record<string, string> = {
    Mathematics: 'text-ks-blue',
    Physics: 'text-ks-emerald',
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-ks-line bg-white shadow-sm">
      <div className="grid min-w-[980px] grid-cols-[80px_repeat(5,1fr)] gap-2 p-4">
        <div />
        {days.map((day) => (
          <div key={day} className="rounded-lg bg-ks-navy px-3 py-2 text-center text-xs font-black uppercase tracking-wider text-white">{day}</div>
        ))}
        {times.map((time) => (
          <div key={time} className="contents">
            <div className="flex items-center py-1 text-xs font-black text-ks-muted">{time}</div>
            {days.map((day) => {
              const period = entries.find((e) => e.day === day && e.time === time);
              return (
                <div
                  key={`${day}-${time}`}
                  className={`min-h-[88px] rounded-lg border p-3 transition ${
                    period?.current
                      ? 'border-ks-gold bg-ks-gold/10 shadow-md shadow-ks-gold/10'
                      : period
                      ? 'border-ks-line bg-ks-paper/80 hover:border-ks-blue/30 hover:bg-ks-mist/20'
                      : 'border-dashed border-ks-line/60 bg-ks-paper/30'
                  }`}
                >
                  {period ? (
                    <>
                      {period.current && <span className="mb-1.5 inline-block rounded-full bg-ks-gold px-2 py-0.5 text-[9px] font-black uppercase text-ks-slate">Live now</span>}
                      <p className={`text-xs font-black uppercase tracking-wide ${subjectColors[period.subject] ?? 'text-ks-blue'}`}>{period.subject}</p>
                      <p className="mt-0.5 font-bold text-ks-slate">{period.className}</p>
                      <p className="text-[11px] text-ks-muted">{period.room}</p>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertStaffCard({ alert }: { alert: Alert }) {
  const styles = {
    CRITICAL: 'border-l-ks-rose bg-ks-rose/5',
    AT_RISK: 'border-l-ks-amber bg-ks-amber/5',
    INFO: 'border-l-ks-sky bg-ks-sky/5',
  };
  return (
    <Card className={`rounded-xl border-l-4 p-4 transition hover:shadow-layer ${styles[alert.severity]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <AlertTypeBadge type={alert.type} severity={alert.severity} />
          <h3 className="mt-2 font-display text-xl font-black text-ks-slate">{alert.student}</h3>
          <p className="mt-0.5 text-sm font-semibold text-ks-muted">{alert.className} · {alert.subject}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">
          {alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      </div>
      <p className="mt-3 text-sm leading-5 text-ks-muted">{alert.reason}</p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="py-1.5 text-xs">View detail</Button>
        <Button variant="quiet" className="py-1.5 text-xs">{alert.action}</Button>
      </div>
    </Card>
  );
}

export function PairingCard({ pairing }: { pairing: Pairing }) {
  const initials = (name: string | undefined) =>
    (name ?? '??').split(' ').map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '??';
  return (
    <Card className="rounded-xl p-4 shadow-sm transition hover:shadow-layer">
      <div className="flex items-center justify-between">
        <div className="flex -space-x-3 overflow-hidden">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ks-blue/15 ring-2 ring-white font-bold text-sm text-ks-blue">
            {initials(pairing.mentor)}
          </div>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ks-emerald/15 ring-2 ring-white font-bold text-sm text-ks-emerald">
            {initials(pairing.support)}
          </div>
        </div>
        <Link2 className="h-5 w-5 text-ks-emerald" />
      </div>
      <div className="mt-3">
        <p className="font-bold text-ks-navy">
          {pairing.mentor} <span className="font-semibold text-ks-muted">& {pairing.support}</span>
        </p>
        <p className="text-xs text-ks-muted">{pairing.className} · {pairing.subject}</p>
      </div>
      <p className="mt-3 rounded-lg border border-ks-sky/15 bg-ks-mist/50 p-2.5 text-xs italic leading-5 text-ks-navy">
        "{pairing.reason}"
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge tone={pairing.status === 'SUGGESTED' ? 'blue' : pairing.status === 'ACTIVE' ? 'emerald' : 'slate'}>
          {pairing.status}
        </Badge>
        <div className="flex gap-2">
          <Button variant="success" className="py-1.5 text-xs">Activate</Button>
          <Button variant="secondary" className="py-1.5 text-xs">Decline</Button>
        </div>
      </div>
    </Card>
  );
}

export function ProgressBar({ value, tone = 'bg-ks-blue', className = '' }: { value: number; tone?: string; className?: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className={`relative h-2.5 overflow-visible rounded-full bg-ks-line ${className}`}
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

export function SparkLine({ data, color = '#0284C7' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 84; const h = 34;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * (h - 6) - 3,
    v,
  }));
  const pointStr = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const last = pts[pts.length - 1];
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
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
        <circle cx={last.x} cy={last.y} r="3" fill={hovIdx === pts.length - 1 ? 'white' : color} stroke={color} strokeWidth="1.5" />
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

function MiniStat({ label, value, color = 'text-ks-slate' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg bg-ks-paper p-2.5">
      <p className="text-[10px] font-black uppercase tracking-wide text-ks-muted">{label}</p>
      <p className={`mt-0.5 font-display text-lg font-black ${color}`}>{value}</p>
    </div>
  );
}
