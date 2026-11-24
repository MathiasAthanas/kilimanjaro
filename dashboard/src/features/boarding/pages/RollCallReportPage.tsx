import { AlertTriangle, BellRing, CheckCircle2, ClipboardCheck, Clock, UserX } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { errorMessage } from '../../../lib/api/errors';
import { useAuthStore } from '../../../lib/auth/authStore';
import { toast } from '../../../lib/toast';
import { useCheckRollCalls, useRollCallReport } from '../api/boarding.hooks';

const pct = (v: number | null | undefined) => (v == null ? 'n/a' : `${v}%`);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

function Tile({ label, value, hint, tone = 'navy' }: { label: string; value: string; hint?: string; tone?: 'navy' | 'amber' | 'rose' | 'green' }) {
  const color = { navy: 'text-[#00334f]', amber: 'text-amber-700', rose: 'text-rose-700', green: 'text-emerald-700' }[tone];
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${tone === 'amber' || tone === 'rose' ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-3xl font-black ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs font-semibold text-slate-500">{hint}</p>}
    </div>
  );
}

function Trend({ points }: { points: Array<{ date: string; presentRate: number | null; absent: number; recorded: number; expected: number }> }) {
  const w = 720;
  const h = 170;
  const pad = 26;
  const bar = (w - pad * 2) / Math.max(points.length, 1);
  const summary = points.filter((p) => p.presentRate != null).map((p) => `${day(p.date)} ${p.presentRate}%`).join(', ');
  return (
    <svg viewBox={`0 0 ${w} ${h + 28}`} role="img" aria-label={`Share of students present each day. ${summary}`} className="w-full">
      {[0, 50, 100].map((g) => (
        <g key={g}>
          <line x1={pad} x2={w - pad} y1={h - (g / 100) * (h - 16)} y2={h - (g / 100) * (h - 16)} stroke="#e2e8f0" strokeDasharray="4 4" />
          <text x={4} y={h - (g / 100) * (h - 16) + 4} fontSize="10" fill="#94a3b8">{g}%</text>
        </g>
      ))}
      {points.map((p, i) => {
        const x = pad + i * bar + bar * 0.15;
        const bw = bar * 0.7;
        const rate = p.presentRate;
        const bh = rate == null ? 4 : Math.max(3, (rate / 100) * (h - 16));
        const missed = p.expected > p.recorded;
        return (
          <g key={p.date}>
            <title>{`${day(p.date)}: ${rate == null ? 'no roll call recorded' : `${rate}% present, ${p.absent} absent`}; ${p.recorded} of ${p.expected} roll calls done`}</title>
            <rect x={x} y={h - bh} width={bw} height={bh} rx={3} fill={rate == null ? '#cbd5e1' : rate >= 95 ? '#059669' : rate >= 85 ? '#d59a1b' : '#e11d48'} />
            {missed && <circle cx={x + bw / 2} cy={h + 12} r={3} fill="#f59e0b" />}
            {(points.length <= 14 || i % 2 === 0) && <text x={x + bw / 2} y={h + 24} fontSize="9" textAnchor="middle" fill="#64748b">{day(p.date)}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** For Head of School, Principal and Manager: has every roll call been done, who is absent, and how attendance is trending. */
export function RollCallReportPage() {
  const role = useAuthStore((s) => s.session?.user.role);
  const canRun = ['ADMIN', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN'].includes(String(role));
  const [days, setDays] = useState(14);
  const { data, isLoading, isError, refetch } = useRollCallReport(days);
  const check = useCheckRollCalls();

  if (isLoading) return <main className="p-6"><SkeletonTable cols={4} /></main>;
  if (isError || !data) return <main className="p-6"><DataError message="Could not load the roll call report." onRetry={() => refetch()} /></main>;

  const t = data.totals;
  return (
    <main className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#00334f]/10 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">Boarding welfare</p>
          <h1 className="mt-1 font-display text-2xl font-black text-[#00334f]">Roll call report</h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-500">
            Morning roll call is due by {data.deadlines.MORNING} and evening by {data.deadlines.EVENING}. If one is missed, the Head of School and the Manager get an alert, and a summary of the day arrives at 21:30.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-200" role="group" aria-label="Period">
            {[7, 14, 30].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`px-3 py-1.5 text-xs font-black ${days === d ? 'bg-[#00334f] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{d} days</button>
            ))}
          </div>
          <NavLink to="/boarding/roll-calls"><Button variant="secondary" className="rounded-xl"><ClipboardCheck className="h-4 w-4" /> History</Button></NavLink>
          {canRun && (
            <Button variant="secondary" className="rounded-xl" loading={check.isPending} onClick={() => check.mutate({ summary: true }, {
              onSuccess: (r) => {
                const n = r.alerts.alerts.length;
                toast(n ? `${n} alert${n === 1 ? '' : 's'} sent about overdue roll calls` : 'Nothing overdue right now', 'success');
              },
              onError: (e) => toast(errorMessage(e, 'Could not run the check'), 'error'),
            })}><BellRing className="h-4 w-4" /> Check and alert now</Button>
          )}
        </div>
      </header>

      {data.sessionsToday.length === 0 ? (
        <EmptyState title="No dormitories to report on" description="Roll calls appear here once a dormitory has students." />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Summary">
            <Tile label="Roll calls missing now" value={String(t.missingNow)} tone={t.missingNow ? 'amber' : 'green'} hint={t.missingNow ? 'Past the deadline, not recorded' : 'Everything due has been done'} />
            <Tile label="Absent today" value={String(t.absentToday)} tone={t.absentToday ? 'rose' : 'green'} hint="Students marked absent" />
            <Tile label={`Roll calls done (${data.range.days} days)`} value={pct(t.completionRate)} hint="Of those that were due" />
            <Tile label={`Present (${data.range.days} days)`} value={pct(t.presentRate)} hint="Share of students marked present" />
          </section>

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Today">
            {data.sessionsToday.map((s) => (
              <div key={s.session} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-black text-[#00334f]">{s.session === 'MORNING' ? 'Morning' : 'Evening'} roll call today</h2>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500"><Clock className="h-3.5 w-3.5" /> due {s.deadline}</span>
                </div>
                <ul className="mt-3 divide-y divide-slate-100">
                  {s.dormitories.map((d) => (
                    <li key={d.dormitoryId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="font-bold text-slate-800">{d.dormitory}</p>
                        <p className="text-xs font-semibold text-slate-500">{d.rosterSize} student{d.rosterSize === 1 ? '' : 's'}{d.status === 'DONE' ? ` · ${d.present} present${d.absent ? `, ${d.absent} absent` : ''}${d.onLeave ? `, ${d.onLeave} on leave` : ''}${d.excused ? `, ${d.excused} excused` : ''}` : ''}</p>
                      </div>
                      {d.status === 'DONE' ? <Badge tone="emerald"><CheckCircle2 className="mr-1 inline h-3 w-3" />Done</Badge> : d.status === 'MISSING' ? (d.rosterSize ? <Badge tone="rose"><AlertTriangle className="mr-1 inline h-3 w-3" />Missing</Badge> : <Badge tone="slate">Empty</Badge>) : <Badge tone="slate">Not due yet</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="absent-today">
            <h2 id="absent-today" className="flex items-center gap-2 font-display text-lg font-black text-[#00334f]"><UserX className="h-5 w-5" /> Absent today</h2>
            {data.absentToday.length === 0 ? <p className="mt-2 text-sm font-semibold text-slate-500">No student has been marked absent today.</p> : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] font-black uppercase tracking-widest text-slate-500"><tr><th className="py-2 text-left">Student</th><th className="py-2 text-left">Class</th><th className="py-2 text-left">Dormitory</th><th className="py-2 text-left">Session</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.absentToday.map((a, i) => (
                      <tr key={`${a.studentId}-${a.session}-${i}`}><td className="py-2"><span className="font-bold text-slate-800">{a.name}</span><span className="block font-mono text-xs text-slate-500">{a.registrationNumber}</span></td><td className="py-2 font-semibold text-slate-600">{a.className ?? '-'}</td><td className="py-2 font-semibold text-slate-600">{a.dormitory}</td><td className="py-2"><Badge tone={a.session === 'MORNING' ? 'blue' : 'amber'}>{a.session === 'MORNING' ? 'Morning' : 'Evening'}</Badge></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="trend">
            <h2 id="trend" className="font-display text-lg font-black text-[#00334f]">Attendance trend</h2>
            <p className="text-sm font-semibold text-slate-500">Share of students marked present each day. An amber dot under a bar means a roll call that was due was not recorded.</p>
            <div className="mt-3"><Trend points={data.trend} /></div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-black text-[#00334f]">By dormitory</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] font-black uppercase tracking-widest text-slate-500"><tr><th className="py-2 text-left">Dormitory</th><th className="py-2 text-right">Done</th><th className="py-2 text-right">Present</th><th className="py-2 text-right">Absences</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.dormitories.map((d) => (
                      <tr key={d.dormitoryId}>
                        <td className="py-2 font-bold text-slate-800">{d.name}<span className="block text-xs font-semibold text-slate-500">{d.rosterSize} students</span></td>
                        <td className={`py-2 text-right font-semibold ${d.completionRate != null && d.completionRate < 80 ? 'text-rose-700' : 'text-slate-700'}`}>{pct(d.completionRate)}<span className="block text-xs text-slate-400">{d.recorded}/{d.expected}</span></td>
                        <td className="py-2 text-right font-semibold text-slate-700">{pct(d.presentRate)}</td>
                        <td className="py-2 text-right font-semibold text-slate-700">{d.absent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-black text-[#00334f]">Most absent students</h2>
              {data.topAbsent.length === 0 ? <p className="mt-2 text-sm font-semibold text-slate-500">No absences in this period.</p> : (
                <ol className="mt-3 divide-y divide-slate-100">
                  {data.topAbsent.map((s) => (
                    <li key={s.studentId} className="flex items-center justify-between py-2">
                      <div><p className="font-bold text-slate-800">{s.name}</p><p className="text-xs font-semibold text-slate-500">{s.className ?? '-'} · {s.registrationNumber}</p></div>
                      <Badge tone={s.absences >= 5 ? 'rose' : 'amber'}>{s.absences} absence{s.absences === 1 ? '' : 's'}</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
