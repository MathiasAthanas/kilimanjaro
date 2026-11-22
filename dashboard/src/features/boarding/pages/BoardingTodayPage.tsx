import { BedDouble, CalendarCheck, ClipboardCheck, Home, LogIn, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { MixedHistogram } from '../../analytics/components/Charts';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { ConfirmDialog } from '../../../components/feedback/ConfirmDialog';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { errorMessage } from '../../../lib/api/errors';
import { useAuthStore } from '../../../lib/auth/authStore';
import { toast } from '../../../lib/toast';
import { useBoardingDashboard, useDormitory, useUnassignDormitoryStudent } from '../api/boarding.hooks';
import { AwaitingPlacementPanel } from '../components/AwaitingPlacementPanel';
import { BoardingRollCallTrend } from '../components/BoardingRollCallTrend';

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

function Task({ to, icon: Icon, count, title, hint, tone }: { to: string; icon: LucideIcon; count: number; title: string; hint: string; tone: 'amber' | 'blue' | 'green' }) {
  const attention = count > 0;
  const ring = !attention ? 'border-slate-200' : tone === 'amber' ? 'border-amber-300 bg-amber-50' : tone === 'blue' ? 'border-sky-300 bg-sky-50' : 'border-emerald-300 bg-emerald-50';
  const isHash = to.startsWith('#');
  const body = (
    <div className={`h-full rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${ring} bg-white`}>
      <div className="flex items-center justify-between">
        <Icon className="h-5 w-5 text-[#00334f]" />
        <span className={`font-display text-3xl font-black ${attention ? 'text-[#00334f]' : 'text-slate-300'}`}>{count}</span>
      </div>
      <p className="mt-2 font-black text-[#00334f]">{title}</p>
      <p className="text-xs font-semibold text-slate-500">{attention ? hint : 'Nothing to do'}</p>
    </div>
  );
  return isHash ? <a href={to} className="block focus:outline-none focus:ring-2 focus:ring-[#00334f] rounded-2xl">{body}</a> : <NavLink to={to} className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#00334f]">{body}</NavLink>;
}

/** What the matron or patron sees first: today's tasks, the students waiting for a bed, then their dormitories. */
export function BoardingTodayPage() {
  const name = useAuthStore((s) => s.session?.user.name) ?? '';
  const dashboard = useBoardingDashboard();
  const dorms = useMemo(() => dashboard.data?.dormitories ?? [], [dashboard.data?.dormitories]);
  const totals = dashboard.data?.totals ?? {};
  const [openId, setOpenId] = useState('');
  useEffect(() => { if (!openId && dorms[0]?.id) setOpenId(dorms[0].id); }, [openId, dorms]);
  const detail = useDormitory(openId || undefined);
  const unassign = useUnassignDormitoryStudent();
  const [removing, setRemoving] = useState<{ studentId: string; name: string } | null>(null);

  if (dashboard.isLoading) return <main className="p-6"><SkeletonTable cols={4} /></main>;
  if (dashboard.isError) return <main className="p-6"><DataError onRetry={() => dashboard.refetch()} /></main>;

  const session = new Date().getHours() < 12 ? 'morning' : 'evening';
  const selected = detail.data;

  return (
    <main className="space-y-5">
      <header className="rounded-2xl border border-[#00334f]/10 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">Boarding welfare</p>
        <h1 className="mt-1 font-display text-2xl font-black text-[#00334f]">{greeting()}{name ? `, ${name.split(' ')[0]}` : ''}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {dorms.length ? `${dorms.length} dormitor${dorms.length === 1 ? 'y' : 'ies'}, ${totals.occupied ?? 0} students` : 'no dormitory assigned yet'}
        </p>
      </header>

      <section aria-label="Today" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Task to="#placement" icon={UserPlus} count={totals.awaitingPlacement ?? 0} title="Waiting for a bed" hint="New boarders to place" tone="amber" />
        <Task to="/boarding/roll-calls" icon={ClipboardCheck} count={totals.missingRollCalls ?? 0} title={`Roll call (${session})`} hint="Students not marked yet" tone="blue" />
        <Task to="/boarding/leaves" icon={CalendarCheck} count={totals.pendingLeaves ?? 0} title="Leave requests" hint="Waiting for a decision" tone="amber" />
        <Task to="/boarding/leaves" icon={LogIn} count={totals.expectedReturnsToday ?? 0} title="Returning today" hint={`${totals.studentsAway ?? 0} away in total`} tone="green" />
      </section>

      <div className="grid gap-4 xl:grid-cols-2"><MixedHistogram title="My dormitory capacity" subtitle="Live bed availability across your assigned dormitories" rows={dorms.map((dorm) => ({ label: dorm.name, total: dorm.totalBeds, occupied: dorm.occupiedBeds }))} /><BoardingRollCallTrend /></div>

      <AwaitingPlacementPanel />

      <section aria-labelledby="my-dorms" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 id="my-dorms" className="font-display text-lg font-black text-[#00334f]">My dormitories</h2>
        {dorms.length === 0 ? (
          <div className="mt-3"><EmptyState title="No dormitory assigned yet" description="Ask the administrator to assign you to a dormitory. Your students will then appear here." /></div>
        ) : (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dorms.map((d) => {
                const pct = d.totalBeds ? Math.round((d.occupiedBeds / d.totalBeds) * 100) : 0;
                return (
                  <button key={d.id} onClick={() => setOpenId(d.id)} aria-pressed={openId === d.id} className={`rounded-xl border-2 p-4 text-left transition ${openId === d.id ? 'border-[#00334f] bg-[#eef5f8]' : 'border-slate-200 hover:border-[#00334f]/40'}`}>
                    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-black text-slate-900"><Home className="h-4 w-4 text-[#00334f]" /> {d.name}</span><Badge tone={d.availableBeds ? 'emerald' : 'rose'}>{d.occupiedBeds}/{d.totalBeds}</Badge></div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#00334f]" style={{ width: `${pct}%` }} /></div>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{d.gender === 'MALE' ? 'Boys' : d.gender === 'FEMALE' ? 'Girls' : 'Gender not set'} · {d.availableBeds} free bed{d.availableBeds === 1 ? '' : 's'}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5">
              {detail.isLoading ? <SkeletonTable cols={4} /> : !selected ? null : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-black text-[#00334f]">{selected.name} · {selected.gender === 'MALE' ? 'Boys' : selected.gender === 'FEMALE' ? 'Girls' : 'Gender not set'} · who sleeps here</h3>
                    <span className="inline-flex gap-2">
                      <NavLink to="/boarding/roll-calls"><Button variant="secondary" className="!px-3 !py-1.5 text-xs"><ClipboardCheck className="h-3.5 w-3.5" /> Roll call</Button></NavLink>
                      <NavLink to="/boarding/leaves"><Button variant="secondary" className="!px-3 !py-1.5 text-xs"><CalendarCheck className="h-3.5 w-3.5" /> Leave</Button></NavLink>
                    </span>
                  </div>
                  {selected.studentAssignments.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm font-semibold text-slate-500">No one is in this dormitory yet. Place students from the list above.</p>
                  ) : (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500"><tr><th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Gender</th><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Bed</th><th className="px-4 py-2 text-right" /></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                          {selected.studentAssignments.map((a) => (
                            <tr key={a.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5"><span className="font-bold text-slate-800">{a.student.firstName} {a.student.lastName}</span><span className="block font-mono text-xs text-slate-500">{a.student.registrationNumber}</span></td>
                              <td className="px-4 py-2.5 font-semibold text-slate-600">{a.student.gender ? a.student.gender.charAt(0) + a.student.gender.slice(1).toLowerCase() : '—'}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-600">{a.student.enrolments?.[0]?.class?.name ?? '-'}</td>
                              <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 font-semibold text-slate-700"><BedDouble className="h-3.5 w-3.5 text-slate-400" /> {a.bed?.label ?? 'No bed'}</span></td>
                              <td className="px-4 py-2.5 text-right"><button className="text-xs font-black uppercase text-rose-600 hover:underline" onClick={() => setRemoving({ studentId: a.studentId, name: `${a.student.firstName} ${a.student.lastName}` })}>Remove</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-400"><Users className="h-3.5 w-3.5" /> {selected.studentAssignments.length} of {selected.totalBeds} beds in use</p>
                </>
              )}
            </div>
          </>
        )}
      </section>

      {removing && selected && (
        <ConfirmDialog
          title={`Remove ${removing.name}?`}
          message="The student leaves this dormitory and the bed becomes free. They will appear in the waiting list again so they can be placed elsewhere."
          onCancel={() => setRemoving(null)}
          onConfirm={() => unassign.mutate({ dormitoryId: selected.id, studentId: removing.studentId }, { onSuccess: () => { toast('Student removed from the dormitory', 'success'); setRemoving(null); }, onError: (e) => { toast(errorMessage(e, 'Could not remove the student'), 'error'); setRemoving(null); } })}
        />
      )}
    </main>
  );
}
