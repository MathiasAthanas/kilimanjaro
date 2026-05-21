import { AlertTriangle, ArrowRight, CheckCircle2, Download, FileText, Grid3X3, Printer, Save, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { exportReasonIsValid, markIsValid, reportBuilderIsValid, timetableHasConflict } from '../utils/operationsValidation';

export function OperationsShell({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <div className="space-y-gutter">
      <section className="relative overflow-hidden rounded-2xl border border-ks-line bg-[radial-gradient(circle_at_85%_15%,rgba(14,165,233,0.22),transparent_28%),radial-gradient(circle_at_10%_80%,rgba(217,183,94,0.14),transparent_30%),linear-gradient(135deg,#0f172a_0%,#052033_50%,#00334f_100%)] shadow-layer">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-ks-gold/50 to-transparent" />
        <div className="relative p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-ks-gold">{eyebrow}</p>
          <h1 className="mt-2 font-display text-[44px] font-black leading-tight tracking-[-0.04em] text-white">{title}</h1>
          <p className="mt-1.5 text-sm font-semibold text-white/60">Shared productivity layer · reports, exports, marks, analytics, timetables</p>
        </div>
      </section>
      {children}
    </div>
  );
}

export function OperationsTable({ columns, children, minWidth = 980 }: { columns: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="bg-ks-navy text-[11px] font-black uppercase tracking-widest text-white">
            <tr>{columns.map((column) => <th key={column} className="px-5 py-4">{column}</th>)}</tr>
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

export function ExportCenterDrawer({ jobs }: { jobs: Array<{ id: string; name: string; status: string; format: string; requestedBy: string; expiry: string }> }) {
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <h2 className="font-display text-xl font-black text-ks-navy">Export Center</h2>
      <div className="mt-4 space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-ks-line bg-ks-paper p-4">
            <div className="flex items-center justify-between gap-3"><p className="font-black text-ks-navy">{job.name}</p><Badge tone={job.status === 'COMPLETED' ? 'emerald' : job.status === 'FAILED' ? 'rose' : 'amber'}>{job.status}</Badge></div>
            <p className="mt-1 text-xs font-bold text-ks-muted">{job.format} / {job.requestedBy} / expires {job.expiry}</p>
            <Button disabled={job.status !== 'COMPLETED'} variant="secondary" className="mt-3 rounded-lg py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Download</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportBuilderCanvas() {
  const [domain, setDomain] = useState('academic');
  const [reason, setReason] = useState('Board review packet');
  const valid = reportBuilderIsValid({ domain, type: 'overview', scope: 'school', format: 'PDF' }) && exportReasonIsValid(reason);
  return (
    <div className="grid gap-gutter xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-ks-line bg-white p-5">
        <h2 className="font-display text-xl font-black text-ks-navy">Configuration</h2>
        {['academic', 'finance', 'attendance', 'enrolment', 'notification', 'audit'].map((item) => (
          <button key={item} onClick={() => setDomain(item)} className={`mt-2 block w-full rounded-xl border px-4 py-3 text-left text-sm font-black ${domain === item ? 'border-ks-blue bg-ks-blue text-white' : 'border-ks-line bg-ks-paper text-ks-navy'}`}>{item}</button>
        ))}
      </div>
      <div className="rounded-2xl border border-ks-line bg-white p-6">
        <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Preview canvas</p>
        <h2 className="mt-2 font-display text-3xl font-black text-ks-navy">{domain} overview report</h2>
        <div className="mt-6 grid gap-3 md:grid-cols-3">{['Scope', 'Columns', 'Grouping'].map((item) => <div key={item} className="rounded-xl border border-ks-line bg-ks-paper p-4"><p className="font-black text-ks-navy">{item}</p><p className="text-sm font-semibold text-ks-muted">Configured</p></div>)}</div>
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-5 h-24 w-full rounded-xl border border-ks-line p-3 font-semibold outline-none focus:border-ks-blue" />
        <Button disabled={!valid} className="mt-4 rounded-xl"><Send className="h-4 w-4" /> Generate Report</Button>
      </div>
      <AnalyticsInsightPanel title="Validation" insight={valid ? 'Report can be generated. Sensitive export reason is captured.' : 'Complete scope, format, and audit reason before generating.'} />
    </div>
  );
}

export function BulkMarksGrid({ rows }: { rows: Array<{ id: string; student: string; registration: string; score: number; status: string; error: string }> }) {
  const [dirty, setDirty] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-ks-line bg-ks-paper px-4 py-3">
        <Button onClick={() => setDirty(false)} disabled={!dirty} className="rounded-lg py-2 text-xs"><Save className="h-3.5 w-3.5" /> Save Changes</Button>
        <Button variant="secondary" className="rounded-lg py-2 text-xs">Validate Sheet</Button>
        <Button variant="secondary" className="rounded-lg py-2 text-xs">Undo Paste</Button>
        <Button variant="success" className="rounded-lg py-2 text-xs"><Send className="h-3.5 w-3.5" /> Submit</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-ks-navy text-[11px] font-black uppercase tracking-widest text-white"><tr><th className="px-5 py-4">Student</th><th>Registration</th><th>Score</th><th>Status</th><th>Error</th></tr></thead>
          <tbody className="divide-y divide-ks-line">
            {rows.map((row) => (
              <tr key={row.id} className={row.error ? 'bg-ks-rose/5' : 'hover:bg-ks-paper'}>
                <Td>{row.student}</Td><Td>{row.registration}</Td>
                <Td><input defaultValue={row.score} onChange={() => setDirty(true)} className={`h-9 w-24 rounded-lg border px-3 font-mono font-black ${markIsValid(row.score, 100) ? 'border-ks-line' : 'border-ks-rose'}`} /></Td>
                <Td><Badge tone={row.status === 'INVALID' ? 'rose' : row.status === 'SAVED' ? 'emerald' : 'blue'}>{row.status}</Badge></Td>
                <Td>{row.error || 'Clear'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MarksReviewPanel() {
  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-gutter">
        <ChartCard title="Mark Distribution" values={[12, 22, 38, 72, 94]} />
        <OperationsTable columns={['Student', 'Score', 'Diff', 'Flag', 'Decision']} minWidth={720}>
          {['Hassan Mwamba', 'Zainab Kilio', 'Joel Komba'].map((student, index) => <tr key={student}><Td>{student}</Td><Td>{[28, 34, 94][index]}%</Td><Td>{[-33, -20, 6][index]}</Td><Td>{index < 2 ? 'Outlier' : 'Top performer'}</Td><Td>Review</Td></tr>)}
        </OperationsTable>
      </div>
      <div className="sticky top-24 h-fit rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
        <h2 className="font-display text-xl font-black text-ks-navy">Decision Panel</h2>
        <textarea className="mt-4 h-28 w-full rounded-xl border border-ks-line p-3 font-semibold outline-none focus:border-ks-blue" placeholder="Reject requires comment..." />
        <div className="mt-4 grid gap-2"><Button variant="success" className="rounded-xl">Approve</Button><Button variant="danger" className="rounded-xl">Reject</Button><Button variant="secondary" className="rounded-xl">Export Review Pack</Button></div>
      </div>
    </div>
  );
}

export function ReportPreviewFrame({ title }: { title: string }) {
  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-2xl border border-ks-line bg-slate-200 p-8">
        <div className="mx-auto min-h-[680px] max-w-[760px] rounded bg-white p-10 shadow-layer">
          <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">PDF Preview</p>
          <h2 className="mt-3 font-display text-3xl font-black text-ks-navy">{title}</h2>
          <div className="mt-8 space-y-3">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-8 rounded bg-ks-paper" />)}</div>
        </div>
      </div>
      <div className="space-y-2"><Button className="w-full rounded-xl"><Download className="h-4 w-4" /> Download</Button><Button variant="secondary" className="w-full rounded-xl"><Printer className="h-4 w-4" /> Print</Button><Button variant="secondary" className="w-full rounded-xl">Zoom 100%</Button></div>
    </div>
  );
}

export function TimetableMatrix({ entries }: { entries: Array<{ id: string; className: string; teacher: string; subject: string; day: string; start: string; end: string; room: string }> }) {
  const conflict = timetableHasConflict(entries);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const times = ['08:00', '09:00', '10:00', '11:00'];
  return (
    <div className="space-y-gutter">
      {conflict ? <div className="rounded-xl border border-ks-rose bg-ks-rose/10 p-4 font-black text-ks-rose"><AlertTriangle className="mr-2 inline h-4 w-4" /> Timetable conflict detected.</div> : null}
      <div className="overflow-x-auto rounded-2xl border border-ks-line bg-white">
        <div className="min-w-[860px]">
          <div className="grid border-b border-ks-line bg-ks-navy text-white" style={{ gridTemplateColumns: `100px repeat(${days.length},1fr)` }}><div className="p-4 font-black">Time</div>{days.map((day) => <div key={day} className="border-l border-white/10 p-4 font-black">{day}</div>)}</div>
          {times.map((time) => <div key={time} className="grid border-b border-ks-line" style={{ gridTemplateColumns: `100px repeat(${days.length},1fr)` }}><div className="p-4 font-mono font-black text-ks-navy">{time}</div>{days.map((day) => { const entry = entries.find((item) => item.day === day && item.start === time); return <div key={day} className="min-h-24 border-l border-ks-line p-3">{entry ? <div className="rounded-xl bg-ks-blue/10 p-3"><p className="font-black text-ks-navy">{entry.subject}</p><p className="text-xs font-bold text-ks-muted">{entry.className} / {entry.teacher} / {entry.room}</p></div> : <span className="text-xs font-bold text-ks-muted">Free</span>}</div>; })}</div>)}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsInsightPanel({ title, insight }: { title: string; insight: string }) {
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
        <CheckCircle2 className="h-5 w-5 text-ks-emerald" />
      </div>
      <h3 className="mt-4 font-display text-xl font-black text-ks-navy">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-relaxed text-ks-muted">{insight}</p>
      <NavLink
        to="/reports/builder"
        className="mt-5 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-ks-blue transition hover:text-ks-navy"
      >
        Related report <ArrowRight className="h-3.5 w-3.5 transition hover:translate-x-0.5" />
      </NavLink>
    </div>
  );
}

const CHART_BAR_H = 180; // pixel height of the tallest bar

export function ChartCard({ title, values, labels }: { title: string; values: number[]; labels?: string[] }) {
  const max   = Math.max(...values);
  const total = values.reduce((s, v) => s + v, 0);
  const [hov, setHov] = useState<number | null>(null);
  const current = values[values.length - 1];
  const prev    = values[values.length - 2] ?? current;
  const delta   = current - prev;

  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-xl font-black text-ks-navy">{title}</h2>
        <div className="shrink-0 text-right">
          <motion.p
            className="font-display text-2xl font-black"
            animate={{ color: hov !== null ? '#d9b75e' : '#061f33' }}
            transition={{ duration: 0.2 }}
          >
            {hov !== null ? values[hov] : current}
          </motion.p>
          <p className={`text-[10px] font-black uppercase tracking-widest ${delta >= 0 ? 'text-ks-emerald' : 'text-ks-rose'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs prev
          </p>
        </div>
      </div>

      {/* Bars — pixel heights so animation works reliably in flex-end containers */}
      <div className="mt-5 flex items-end gap-2.5 border-b border-ks-line/60 pb-1" style={{ height: `${CHART_BAR_H + 4}px` }}>
        {values.map((value, i) => {
          const barPx = Math.round((value / max) * CHART_BAR_H);
          const share = total > 0 ? Math.round((value / total) * 100) : 0;
          const isHov = hov === i;
          return (
            <div
              key={i}
              className="relative flex flex-1 cursor-pointer items-end justify-center"
              style={{ height: `${CHART_BAR_H}px` }}
              onMouseEnter={() => setHov(i)}
              onMouseLeave={() => setHov(null)}
            >
              {/* Floating tooltip */}
              <AnimatePresence>
                {isHov && (
                  <motion.div
                    key="tip"
                    initial={{ opacity: 0, y: 6, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.9 }}
                    transition={{ duration: 0.16 }}
                    className="pointer-events-none absolute bottom-full mb-2 whitespace-nowrap rounded-xl bg-ks-navy px-3 py-2 shadow-2xl"
                  >
                    <p className="font-display text-lg font-black text-ks-gold">{value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/60">{share}% of total</p>
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-[4px] border-transparent border-t-ks-navy" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated bar — pixel height, anchored at bottom via flex items-end */}
              <motion.div
                className={`w-full rounded-t-xl ${isHov ? 'bg-ks-gold' : 'bg-ks-blue'}`}
                style={{ opacity: isHov ? 1 : 0.85 }}
                initial={{ height: 0 }}
                animate={{ height: barPx }}
                transition={{ duration: 0.85, ease: 'easeOut', delay: i * 0.07 }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="mt-2 flex gap-2.5">
        {values.map((_, i) => (
          <span key={i} className="flex-1 text-center text-[10px] font-black text-ks-muted">
            {labels?.[i] ?? i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ReportTile({ title, detail, to }: { title: string; detail: string; to: string }) {
  return (
    <NavLink
      to={to}
      className="group rounded-2xl border border-ks-line bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-ks-blue/30 hover:shadow-layer"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 transition group-hover:bg-sky-100">
        <FileText className="h-5 w-5 text-ks-blue" />
      </div>
      <h3 className="mt-4 font-display text-xl font-black text-ks-navy">{title}</h3>
      <p className="mt-1.5 text-sm font-semibold text-ks-muted">{detail}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-ks-blue">
        Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </span>
    </NavLink>
  );
}

export function PendingIntegration({ feature }: { feature: string }) {
  return <div className="rounded-2xl border border-dashed border-ks-amber bg-ks-amber/10 p-5 font-bold text-ks-amber"><Grid3X3 className="mr-2 inline h-5 w-5" /> Pending backend integration: {feature}</div>;
}
