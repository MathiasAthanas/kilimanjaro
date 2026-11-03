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
import { useAuthStore } from '../../../lib/auth/authStore';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { SchoolBadge, useTeacherSchools } from './TeacherBits';

export function TeacherWorkspaceShell({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  const activeSchool = useSchoolStore((state) => state.activeSchool);
  const { multi } = useTeacherSchools();
  const teacherName = session?.user?.name ?? 'Teacher';
  // A teacher in several schools always sees which school the page is showing.
  const scopeLabel = multi ? (activeSchool ? activeSchool.name : 'All my schools') : 'Teacher Portal';
  return (
    <div className="space-y-gutter">
      <section className="overflow-hidden rounded-xl border border-ks-navy/15 bg-[linear-gradient(135deg,#00334f,#0c4a6e_58%,#083855)] p-6 text-white shadow-layer sm:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[32px] font-bold leading-[40px] tracking-[-0.02em] sm:text-[44px] sm:leading-[52px]">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold text-ks-mist/70">{teacherName} · {scopeLabel}</p>
          </div>
          {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
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
  return (
    <Card className="group flex flex-col overflow-hidden rounded-xl transition hover:-translate-y-0.5 hover:shadow-layer">
      <div className={`h-1.5 ${riskTone}`} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-black uppercase tracking-wider text-ks-muted">{item.subject}{item.isOptional ? ' · optional' : ''}</p>
            <h3 className="mt-1 font-display text-2xl font-black text-ks-slate">{item.className}</h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <SchoolBadge schoolId={item.schoolId} />
            {item.isClassTeacher && <Badge tone="blue">Class teacher</Badge>}
          </div>
        </div>
        <div className="mt-stack-md grid grid-cols-3 gap-2.5 text-sm">
          <MiniStat label="Students" value={String(item.students)} />
          <MiniStat label="Average" value={item.average > 0 ? `${item.average}%` : '—'} color={item.average >= 60 ? 'text-ks-emerald' : item.average > 0 ? 'text-ks-amber' : 'text-ks-muted'} />
          <MiniStat label="To enter" value={String(item.openAssessments)} color={item.openAssessments > 0 ? 'text-ks-amber' : 'text-ks-emerald'} />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-ks-muted">
            <span>Syllabus covered</span><span>{item.syllabusTotal > 0 ? `${item.syllabusCovered}/${item.syllabusTotal} topics · ${item.syllabus}%` : 'Not started'}</span>
          </div>
          <ProgressBar value={item.syllabus} tone={item.syllabus >= 70 ? 'bg-ks-emerald' : item.syllabus >= 50 ? 'bg-ks-amber' : 'bg-ks-rose'} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm font-black text-ks-blue">
          <NavLink to={`/teacher/classes/${item.id}`} className="inline-flex items-center gap-1 hover:underline">
            Open class <ChevronRight className="h-4 w-4" />
          </NavLink>
          <NavLink to={`/teacher/attendance?class=${item.classId}`} className="hover:underline">Attendance</NavLink>
          <NavLink to={`/teacher/classes/${item.id}/students`} className="hover:underline">Students</NavLink>
        </div>
      </div>
    </Card>
  );
}

export function AssessmentStatusBadge({ status }: { status: Assessment['status'] }) {
  const map: Record<string, { tone: 'blue' | 'amber' | 'emerald' | 'rose' | 'slate'; label: string }> = {
    OPEN: { tone: 'blue', label: 'Open for marks' },
    SUBMITTED: { tone: 'amber', label: 'Waiting for approval' },
    HOD_APPROVED: { tone: 'emerald', label: 'Approved' },
    APPROVED: { tone: 'emerald', label: 'Approved' },
    REJECTED: { tone: 'rose', label: 'Sent back to you' },
    DRAFT: { tone: 'slate', label: 'Draft' },
    LOCKED: { tone: 'slate', label: 'Locked' },
  };
  const { tone, label } = map[status] ?? { tone: 'slate', label: String(status) };
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

export function TeacherTable({ columns, children, minWidth = 900 }: { columns: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-10 border-b border-ks-line bg-ks-mist/30 text-[11px] font-black uppercase tracking-wider text-ks-navy">
            <tr>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-ks-line">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export type MarkEntryStatus = 'SCORED' | 'ABSENT' | 'NOT_SAT';
export type MarkEdit = { score: string; status: MarkEntryStatus };

function cellMessage(row: MarkRow, edit: MarkEdit, maxScore: number): { tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue'; text: string } {
  if (row.exempt) return { tone: 'blue', text: 'Exempt' };
  if (edit.status === 'ABSENT') return { tone: 'slate', text: 'Absent · counts 0' };
  if (edit.status === 'NOT_SAT') return { tone: 'slate', text: 'Not sat · counts 0' };
  if (edit.score.trim() === '') return { tone: 'rose', text: 'Enter a score' };
  const n = Number(edit.score);
  if (!Number.isFinite(n)) return { tone: 'rose', text: 'Not a number' };
  if (n < 0) return { tone: 'rose', text: 'Cannot be negative' };
  if (n > maxScore) return { tone: 'rose', text: `Out of ${maxScore}` };
  return { tone: 'emerald', text: `${Math.round((n / maxScore) * 100)}%` };
}

/** Controlled marks grid. Enter / arrow-down moves to the next student; readOnly shows a finished sheet. */
export function MarksGrid({
  rows, edits, maxScore, readOnly = false, onChange,
}: {
  rows: MarkRow[];
  edits: Record<string, MarkEdit>;
  maxScore: number;
  readOnly?: boolean;
  onChange?: (studentId: string, next: MarkEdit) => void;
}) {
  const focusRow = (index: number) => {
    const el = document.querySelector<HTMLInputElement>(`[data-mark-row="${index}"]`);
    if (el) { el.focus(); el.select(); }
  };
  return (
    <TeacherTable columns={['#', 'Student', 'Registration', 'Score', 'Status', 'Check']} minWidth={680}>
      {rows.map((row, index) => {
        const edit = edits[row.id] ?? { score: '', status: 'SCORED' as MarkEntryStatus };
        const msg = cellMessage(row, edit, maxScore);
        const disabled = readOnly || row.exempt;
        return (
          <tr key={row.id} className={`group transition hover:bg-ks-paper ${msg.tone === 'rose' && !readOnly ? 'bg-ks-rose/5' : ''}`}>
            <td className="px-4 py-2.5 font-black text-ks-muted">{index + 1}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ks-mist text-xs font-black text-ks-blue">
                  {row.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-ks-slate">{row.name}</span>
              </div>
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-ks-muted">{row.registration}</td>
            <td className="px-4 py-2.5">
              <input
                type="number" inputMode="decimal" min={0} max={maxScore} step="any"
                data-mark-row={index}
                className={`h-9 w-24 rounded-md border px-3 font-black outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/15 disabled:bg-ks-paper disabled:text-ks-muted ${msg.tone === 'rose' && edit.score !== '' ? 'border-ks-rose bg-ks-rose/5' : 'border-ks-line bg-white'}`}
                value={edit.status === 'SCORED' ? edit.score : ''}
                disabled={disabled || edit.status !== 'SCORED'}
                aria-label={`Score for ${row.name}`}
                onChange={(e) => onChange?.(row.id, { ...edit, score: e.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); focusRow(index + 1); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); focusRow(index - 1); }
                }}
              />
            </td>
            <td className="px-4 py-2.5">
              <select
                className="h-9 rounded-md border border-ks-line bg-white px-2 text-xs font-bold text-ks-slate disabled:bg-ks-paper"
                value={edit.status}
                disabled={disabled}
                aria-label={`Status for ${row.name}`}
                onChange={(e) => onChange?.(row.id, { score: e.target.value === 'SCORED' ? edit.score : '', status: e.target.value as MarkEntryStatus })}
              >
                <option value="SCORED">Scored</option>
                <option value="ABSENT">Absent</option>
                <option value="NOT_SAT">Not sat</option>
              </select>
            </td>
            <td className="px-4 py-2.5"><Badge tone={msg.tone}>{msg.text}</Badge></td>
          </tr>
        );
      })}
    </TeacherTable>
  );
}

/** How many rows still need a score, and how many are invalid. Exempt rows need nothing. */
export function marksProgress(rows: MarkRow[], edits: Record<string, MarkEdit>, maxScore: number) {
  let complete = 0, blank = 0, invalid = 0, exempt = 0;
  for (const row of rows) {
    if (row.exempt) { exempt += 1; continue; }
    const edit = edits[row.id] ?? { score: '', status: 'SCORED' as MarkEntryStatus };
    if (edit.status !== 'SCORED') { complete += 1; continue; }
    if (edit.score.trim() === '') { blank += 1; continue; }
    const n = Number(edit.score);
    if (!Number.isFinite(n) || n < 0 || n > maxScore) invalid += 1; else complete += 1;
  }
  return { complete, blank, invalid, exempt, required: rows.length - exempt };
}

const ATTENDANCE_STATUS_MAP: Record<string, string> = { P: 'PRESENT', A: 'ABSENT', L: 'LATE', E: 'EXCUSED' };
const ATTENDANCE_ACTIVE_STYLES: Record<string, string> = {
  PRESENT: 'border-ks-emerald bg-ks-emerald text-white shadow-sm',
  ABSENT:  'border-ks-rose bg-ks-rose text-white shadow-sm',
  LATE:    'border-ks-amber bg-ks-amber text-white shadow-sm',
  EXCUSED: 'border-ks-sky bg-ks-sky text-white shadow-sm',
};

export function AttendanceGrid({
  students,
  statuses,
  onStatusChange,
}: {
  students: Student[];
  statuses: Record<string, string>;
  onStatusChange: (studentId: string, status: string) => void;
}) {
  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ks-line bg-ks-paper py-16 text-center">
        <p className="text-sm font-bold text-ks-muted">No students found for this class.</p>
        <p className="mt-1 text-xs text-ks-muted">Students will appear here once they are enrolled.</p>
      </div>
    );
  }
  return (
    <TeacherTable columns={['Student', 'P', 'A', 'L', 'E']} minWidth={320}>
      {students.map((student, index) => {
        const current = statuses[student.id] ?? '';
        return (
          <tr key={student.id} className={`hover:bg-ks-paper ${current === '' ? 'bg-ks-amber/5' : ''}`}>
            <td className="px-3 py-3 sm:px-4">
              <div className="flex items-center gap-2.5">
                <span className="w-5 shrink-0 text-right font-mono text-[11px] text-ks-muted">{index + 1}</span>
                <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ks-mist text-xs font-black text-ks-blue sm:flex">
                  {student.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <span className="font-bold text-ks-slate">{student.name}</span>
                  <span className="block font-mono text-[11px] text-ks-muted">{student.registration}</span>
                </div>
              </div>
            </td>
            {(['P', 'A', 'L', 'E'] as const).map((label) => {
              const value = ATTENDANCE_STATUS_MAP[label];
              const isActive = current === value;
              return (
                <td key={label} className="px-2 py-3 sm:px-4">
                  <button
                    type="button"
                    aria-pressed={isActive}
                    aria-label={`${student.name}: ${value.toLowerCase()}`}
                    onClick={() => onStatusChange(student.id, isActive ? '' : value)}
                    className={`h-8 w-8 rounded-md border text-xs font-black transition active:scale-95 ${
                      isActive ? ATTENDANCE_ACTIVE_STYLES[value] : 'border-ks-line text-ks-muted hover:bg-ks-mist/40'
                    }`}
                  >
                    {label}
                  </button>
                </td>
              );
            })}
          </tr>
        );
      })}
    </TeacherTable>
  );
}

function minutesOf(value: string): number {
  const m = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** The teacher's real week: one column per day taught, one row per period that actually exists. */
export function TimetableBoard({ entries }: { entries: TimetableEntry[] }) {
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const short = (d: string) => d.slice(0, 3);
  const usedDays = new Set(entries.map((e) => short(e.day)));
  const days = dayOrder.filter((d) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(d) || usedDays.has(d));
  const periods = [...new Set(entries.map((e) => e.time))].sort((a, b) => minutesOf(a) - minutesOf(b));
  const todayShort = dayOrder[(new Date().getDay() + 6) % 7];
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ks-line bg-ks-paper py-16 text-center">
        <p className="text-sm font-bold text-ks-muted">No periods on your timetable yet.</p>
        <p className="mt-1 text-xs text-ks-muted">Your timetable appears here once the school schedules your lessons.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-ks-line bg-white shadow-sm">
      <div className="grid min-w-[760px] gap-2 p-4" style={{ gridTemplateColumns: `96px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div />
        {days.map((day) => (
          <div key={day} className={`rounded-lg px-3 py-2 text-center text-xs font-black uppercase tracking-wider ${day === todayShort ? 'bg-ks-gold text-ks-slate' : 'bg-ks-navy text-white'}`}>
            {day}{day === todayShort ? ' · today' : ''}
          </div>
        ))}
        {periods.map((time) => (
          <div key={time} className="contents">
            <div className="flex items-center py-1 text-xs font-black text-ks-muted">{time}</div>
            {days.map((day) => {
              const here = entries.filter((e) => short(e.day) === day && e.time === time);
              return (
                <div
                  key={`${day}-${time}`}
                  className={`min-h-[84px] space-y-1.5 rounded-lg border p-2.5 transition ${here.length ? 'border-ks-line bg-ks-paper/80' : 'border-dashed border-ks-line/60 bg-ks-paper/30'}`}
                >
                  {here.map((period) => (
                    <div key={period.id} className={`rounded-md p-1.5 ${period.current ? 'border border-ks-gold bg-ks-gold/10' : ''}`}>
                      {period.current && <span className="mb-1 inline-block rounded-full bg-ks-gold px-2 py-0.5 text-[9px] font-black uppercase text-ks-slate">Live now</span>}
                      <p className="text-xs font-black uppercase tracking-wide text-ks-blue">{period.subject}</p>
                      <p className="font-bold text-ks-slate">{period.className}</p>
                      <p className="flex flex-wrap items-center gap-1 text-[11px] text-ks-muted">{period.room}<SchoolBadge schoolId={period.schoolId} /></p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertStaffCard({ alert, hideActions = false }: { alert: Alert; hideActions?: boolean }) {
  const styles = {
    CRITICAL: 'border-l-ks-rose bg-ks-rose/5',
    AT_RISK: 'border-l-ks-amber bg-ks-amber/5',
    INFO: 'border-l-ks-sky bg-ks-sky/5',
  };
  return (
    <Card className={`rounded-xl border-l-4 p-4 transition hover:shadow-layer ${styles[alert.severity] ?? styles.INFO}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <AlertTypeBadge type={alert.type.replaceAll('_', ' ').toLowerCase()} severity={alert.severity} />
            <SchoolBadge schoolId={alert.schoolId} />
          </div>
          <h3 className="mt-2 font-display text-xl font-black text-ks-slate">{alert.student}</h3>
          <p className="mt-0.5 text-sm font-semibold text-ks-muted">{[alert.className, alert.subject].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">
          {alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      </div>
      <p className="mt-3 text-sm leading-5 text-ks-muted">{alert.reason}</p>
      {!hideActions && (
        <div className="mt-4 flex flex-wrap gap-2">
          <NavLink to={`/teacher/performance/alerts/${alert.id}`}><Button variant="secondary" className="py-1.5 text-xs">View detail</Button></NavLink>
          <NavLink to={`/teacher/interventions/create?student=${alert.studentId}&alert=${alert.id}`}><Button variant="quiet" className="py-1.5 text-xs">Plan support</Button></NavLink>
        </div>
      )}
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
          {pairing.mentor} <span className="font-semibold text-ks-muted">helps {pairing.support}</span>
        </p>
        <p className="text-xs text-ks-muted">{[pairing.className, pairing.subject].filter(Boolean).join(' · ')}</p>
      </div>
      <p className="mt-3 rounded-lg border border-ks-sky/15 bg-ks-mist/50 p-2.5 text-xs italic leading-5 text-ks-navy">
        "{pairing.reason}"
      </p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge tone={pairing.status === 'SUGGESTED' ? 'blue' : pairing.status === 'ACTIVE' ? 'emerald' : 'slate'}>
          {pairing.status === 'SUGGESTED' ? 'Suggested' : pairing.status === 'ACTIVE' ? 'Active' : pairing.status === 'COMPLETED' ? 'Completed' : pairing.status}
        </Badge>
        <span className="text-xs font-black text-ks-blue">{pairing.status === 'SUGGESTED' ? 'Review & activate →' : 'Open →'}</span>
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
