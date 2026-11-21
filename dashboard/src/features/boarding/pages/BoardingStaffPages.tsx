import { ArrowLeft, CalendarCheck, ClipboardCheck, Eye, Home } from 'lucide-react';
import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { StatusToggle } from '../components/StatusToggle';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import { useAuthStore } from '../../../lib/auth/authStore';
import {
  useBoardingDashboard,
  useBoardingTerms,
  useCreateHostelLeave,
  useDormitory,
  useHostelLeaves,
  useRecordHostelRollCall,
  useRollCallDetail,
  useRollCallHistory,
  useTransitionHostelLeave,
} from '../api/boarding.hooks';

const field = 'h-10 w-full rounded-xl border border-[#d5dde6] bg-white px-3 text-sm font-semibold outline-none focus:border-[#00334f]';
const today = () => new Date().toISOString().slice(0, 10);
const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (error as { message?: string })?.message || 'Action failed';

/** Staff enter the focused boarding workspace; management roles retain the full Admin dashboard. */
export function BoardingEntryPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  return role === 'MATRON' || role === 'PATRON' ? <Navigate to="/boarding/overview" replace /> : <Navigate to="/boarding/admin" replace />;
}

function StaffHeader({ title, detail }: { title: string; detail: string }) {
  return <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-[#00334f]/10 bg-white p-5 shadow-sm">
    <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#64748b]">Boarding welfare</p><h1 className="mt-1 text-2xl font-black text-[#00334f]">{title}</h1><p className="mt-1 text-sm font-semibold text-[#64748b]">{detail}</p></div>
    <nav aria-label="Boarding tasks" className="flex flex-wrap gap-2">
      <NavLink to="/boarding/overview"><Button variant="secondary" className="rounded-xl"><Home className="h-4 w-4" /> Today</Button></NavLink>
      <NavLink to="/boarding/roll-calls"><Button variant="secondary" className="rounded-xl"><ClipboardCheck className="h-4 w-4" /> Roll Call</Button></NavLink>
      <NavLink to="/boarding/leaves"><Button variant="secondary" className="rounded-xl"><CalendarCheck className="h-4 w-4" /> Leave &amp; Returns</Button></NavLink>
    </nav>
  </header>;
}

function useSelectedDormitory() {
  const dashboard = useBoardingDashboard();
  const [dormitoryId, setDormitoryId] = useState('');
  const dorms = dashboard.data?.dormitories ?? [];
  useEffect(() => { if (!dormitoryId && dorms[0]?.id) setDormitoryId(dorms[0].id); }, [dormitoryId, dorms]);
  const detail = useDormitory(dormitoryId);
  return { dashboard, dorms, dormitoryId, setDormitoryId, detail };
}

function DormPicker({ dorms, value, onChange }: { dorms: Array<{ id: string; name: string; code: string }>; value: string; onChange: (id: string) => void }) {
  return <select aria-label="Dormitory" className={field} value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select dormitory…</option>{dorms.map((dorm) => <option key={dorm.id} value={dorm.id}>{dorm.name} · {dorm.code}</option>)}</select>;
}

export function BoardingRollCallsPage() {
  const { dashboard, dorms, dormitoryId, setDormitoryId, detail } = useSelectedDormitory();
  const history = useRollCallHistory(dormitoryId || undefined);
  const { data: leaves = [] } = useHostelLeaves();
  const record = useRecordHostelRollCall();
  const [session, setSession] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const selected = detail.data;
  // A student remains editable, but an active leave queue entry starts as Absent
  // rather than Present. Returned/rejected/cancelled leave records do not affect roll call.
  const studentsOnLeave = useMemo(() => new Set(leaves
    .filter((leave) => ['REQUESTED', 'APPROVED', 'DEPARTED'].includes(leave.status))
    .filter((leave) => !dormitoryId || leave.dormitory.id === dormitoryId)
    .map((leave) => leave.student.id)), [leaves, dormitoryId]);
  const defaultStatus = (studentId: string) => studentsOnLeave.has(studentId) ? 'ABSENT' : 'PRESENT';
  useEffect(() => { setStatuses({}); }, [selected?.id, session]);
  const alreadyRecorded = history.data?.some((item) => item.session === session && String(item.date).slice(0, 10) === today());
  if (dashboard.isLoading) return <main className="p-6"><SkeletonTable cols={4} /></main>;
  return <main className="space-y-5"><StaffHeader title="Daily Roll Call" detail="Record or edit the Morning and Evening roll calls for today only." /><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3 md:grid-cols-3"><DormPicker dorms={dorms} value={dormitoryId} onChange={setDormitoryId} /><select aria-label="Roll-call session" className={field} value={session} onChange={(event) => setSession(event.target.value as 'MORNING' | 'EVENING')}><option value="MORNING">Morning roll call</option><option value="EVENING">Evening roll call</option></select><div className="flex items-center rounded-xl bg-slate-50 px-3 text-sm font-bold text-slate-600">{today()} · {alreadyRecorded ? 'Edit today’s saved session' : 'New session'}</div></div>{detail.isLoading ? <SkeletonTable cols={4} /> : selected ? <><div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600"><span><b className="text-emerald-700">{selected.studentAssignments.filter((a) => (statuses[a.studentId] ?? defaultStatus(a.studentId)) === 'PRESENT').length} present</b> · <b className="text-rose-700">{selected.studentAssignments.filter((a) => (statuses[a.studentId] ?? defaultStatus(a.studentId)) !== 'PRESENT').length} not present</b> · everyone starts as present, so only change the exceptions</span><button type="button" className="text-xs font-black uppercase text-[#00334f] underline" onClick={() => setStatuses({})}>Reset to all present</button></div><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Student</th><th>Registration</th><th>Status</th></tr></thead><tbody>{selected.studentAssignments.map((assignment) => <tr key={assignment.id} className="border-b border-slate-100"><td className="py-3 font-bold">{assignment.student.firstName} {assignment.student.lastName}</td><td className="font-mono text-xs">{assignment.student.registrationNumber}</td><td><StatusToggle name={`${assignment.student.firstName} ${assignment.student.lastName}`} value={statuses[assignment.studentId] ?? defaultStatus(assignment.studentId)} onChange={(value) => setStatuses((current) => ({ ...current, [assignment.studentId]: value }))} /></td></tr>)}</tbody></table></div><Button className="mt-4 rounded-xl" disabled={!selected.studentAssignments.length || record.isPending} onClick={() => record.mutate({ dormitoryId: selected.id, date: today(), session, records: selected.studentAssignments.map((assignment) => ({ studentId: assignment.studentId, status: statuses[assignment.studentId] ?? defaultStatus(assignment.studentId) })) }, { onSuccess: () => toast(alreadyRecorded ? 'Today’s roll call updated' : 'Roll call recorded', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}>{record.isPending ? 'Saving…' : alreadyRecorded ? 'Update current roll call' : 'Save roll call'}</Button></> : <EmptyState title="No dormitory selected" description="Choose an assigned dormitory to record roll call." />}</section><RollCallHistoryList history={history.data ?? []} /></main>;
}

function RollCallHistoryList({ history }: { history: Array<{ dormitoryId: string; dormitory: { name: string; code: string }; date: string; session: string; total: number; present: number; absent: number; onLeave: number; excused: number }> }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-[#00334f]">Roll-call history</h2><p className="mt-1 text-sm font-semibold text-slate-500">Open a session to view the students and dormitory context captured for it.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Date</th><th>Dormitory</th><th>Session</th><th>Present</th><th>Absent / Leave</th><th /></tr></thead><tbody>{history.map((item) => <tr key={`${item.dormitoryId}-${item.date}-${item.session}`} className="border-b border-slate-100"><td className="py-3 font-bold">{String(item.date).slice(0, 10)}</td><td>{item.dormitory.name} <span className="text-xs text-slate-500">· {item.dormitory.code}</span></td><td><Badge tone={item.session === 'MORNING' ? 'blue' : 'amber'}>{item.session}</Badge></td><td>{item.present}/{item.total}</td><td>{item.absent + item.onLeave + item.excused}</td><td><NavLink to={`/boarding/roll-calls/${item.dormitoryId}/${String(item.date).slice(0, 10)}/${item.session}`}><Button variant="secondary" className="rounded-xl"><Eye className="h-4 w-4" /> View</Button></NavLink></td></tr>)}</tbody></table>{!history.length && <p className="py-6 text-center text-sm font-semibold text-slate-500">No roll calls have been recorded for this dormitory.</p>}</div></section>;
}

export function BoardingRollCallDetailPage() {
  const { dormitoryId, date, session } = useParams();
  const detail = useRollCallDetail(dormitoryId, date, session);
  const navigate = useNavigate();
  if (detail.isLoading) return <main className="p-6"><SkeletonTable cols={4} /></main>;
  if (!detail.data) return <main className="space-y-5"><StaffHeader title="Roll-call record" detail="Historical dormitory attendance record." /><DataError onRetry={() => detail.refetch()} /></main>;
  const call = detail.data;
  return <main className="space-y-5"><StaffHeader title="Roll-call record" detail="Historical student attendance for this dormitory session." /><Button variant="secondary" className="rounded-xl" onClick={() => navigate('/boarding/roll-calls')}><ArrowLeft className="h-4 w-4" /> Back to history</Button><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-slate-500">{call.dormitory.code}</p><h2 className="text-xl font-black text-[#00334f]">{call.dormitory.name}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{String(call.date).slice(0, 10)} · {call.session}</p></div><Badge tone="blue">{call.dormitory.totalBeds} beds</Badge></div><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Student</th><th>Registration</th><th>Status</th><th>Note</th><th>Recorded</th></tr></thead><tbody>{call.records.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="py-3 font-bold">{row.student.firstName} {row.student.lastName}</td><td className="font-mono text-xs">{row.student.registrationNumber}</td><td><Badge tone={row.status === 'PRESENT' ? 'emerald' : row.status === 'ABSENT' ? 'rose' : 'amber'}>{row.status.replace('_', ' ')}</Badge></td><td>{row.note || '—'}</td><td>{new Date(row.markedAt).toLocaleString()}</td></tr>)}</tbody></table></div></section></main>;
}

export function BoardingLeavesPage() {
  const { dashboard, dorms, dormitoryId, setDormitoryId, detail } = useSelectedDormitory();
  const { data: terms = [] } = useBoardingTerms();
  const { data: leaves = [] } = useHostelLeaves();
  const createLeave = useCreateHostelLeave(); const transition = useTransitionHostelLeave();
  const [filter, setFilter] = useState<'ACTION' | 'AWAY' | 'ALL'>('ACTION');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ studentId: '', termId: '', leaveType: 'HOME', reason: '', departureAt: '', expectedReturnAt: '' });
  const selected = detail.data;
  const open = leaves.filter((leave) => !['RETURNED', 'REJECTED', 'CANCELLED'].includes(leave.status));
  const leaveEligibleStudents = selected?.studentAssignments.filter((assignment) => !open.some((leave) => leave.student.id === assignment.studentId)) ?? [];
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
  const shown = filter === 'ACTION'
    ? open.filter((l) => l.status === 'REQUESTED' || l.status === 'APPROVED' || (l.status === 'DEPARTED' && new Date(l.expectedReturnAt) <= endOfToday))
    : filter === 'AWAY' ? open.filter((l) => l.status === 'DEPARTED') : leaves;
  const tone = (status: string) => (status === 'DEPARTED' ? 'blue' : status === 'REQUESTED' ? 'amber' : status === 'APPROVED' ? 'emerald' : 'slate');
  useEffect(() => { if (!form.termId && terms[0]) setForm((current) => ({ ...current, termId: (terms[0] as { id: string }).id })); }, [terms, form.termId]);
  if (dashboard.isLoading) return <main className="p-6"><SkeletonTable cols={4} /></main>;
  const act = (id: string, status: string, extra: Record<string, unknown> = {}, message?: string) => transition.mutate({ id, status, ...extra }, { onSuccess: () => message && toast(message, 'success'), onError: (error) => toast(errorMessage(error), 'error') });
  return <main className="space-y-5"><StaffHeader title="Leave and returns" detail="Approve requests, see who is away, and welcome students back." />
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Leave filter">{([['ACTION', `Needs action (${open.filter((l) => l.status !== 'DEPARTED' || new Date(l.expectedReturnAt) <= endOfToday).length})`], ['AWAY', `Away now (${open.filter((l) => l.status === 'DEPARTED').length})`], ['ALL', 'All records']] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={filter === key} onClick={() => setFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${filter === key ? 'bg-[#00334f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{label}</button>)}</div>
        <Button className="rounded-xl" onClick={() => setShowForm((v) => !v)}>{showForm ? 'Close' : 'Record a leave'}</Button>
      </div>
      <div className="mt-4 space-y-3">{shown.length ? shown.map((leave) => <div key={leave.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-black text-slate-900">{leave.student.firstName} {leave.student.lastName} <Badge tone={tone(leave.status)}>{leave.status === 'DEPARTED' ? 'AWAY' : leave.status}</Badge></p><p className="mt-1 text-xs font-semibold text-slate-500">{leave.dormitory.name} · {leave.leaveType === 'HOME' ? 'Home' : 'Temporary'} · returns {new Date(leave.expectedReturnAt).toLocaleString()}</p><p className="mt-1 text-sm text-slate-700">{leave.reason}</p></div><div className="flex gap-2">{leave.status === 'REQUESTED' && <><Button className="rounded-xl" onClick={() => act(leave.id, 'APPROVED', {}, 'Leave approved')}>Approve</Button><Button variant="secondary" className="rounded-xl" onClick={() => act(leave.id, 'REJECTED', {}, 'Leave declined')}>Decline</Button></>}{leave.status === 'APPROVED' && <Button className="rounded-xl" onClick={() => act(leave.id, 'DEPARTED', {}, 'Marked as left')}>Student has left</Button>}{leave.status === 'DEPARTED' && <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => act(leave.id, 'RETURNED', { actualReturnAt: new Date().toISOString() }, 'Welcome back recorded')}>Student is back</Button>}</div></div>) : <EmptyState title={filter === 'ACTION' ? 'Nothing needs your action' : 'No leave records'} description="Requests and returns will appear here." />}</div>
    </section>
    {showForm && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><DormPicker dorms={dorms} value={dormitoryId} onChange={setDormitoryId} />{selected && <><h2 className="mt-5 font-black text-[#00334f]">Record leave · {selected.name}</h2><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><select aria-label="Student" className={field} value={form.studentId} onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}><option value="">Select roster student…</option>{leaveEligibleStudents.map((assignment) => <option key={assignment.studentId} value={assignment.studentId}>{assignment.student.firstName} {assignment.student.lastName}</option>)}</select><select aria-label="Leave type" className={field} value={form.leaveType} onChange={(event) => setForm((current) => ({ ...current, leaveType: event.target.value }))}><option value="HOME">Permission to go home</option><option value="TEMPORARY">Temporary leave</option></select><input className={field} aria-label="Reason" placeholder="Reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /><label className="space-y-1 text-xs font-bold text-slate-600"><span>Leaves on</span><input aria-label="Departure date and time" className={field} type="datetime-local" value={form.departureAt} onChange={(event) => setForm((current) => ({ ...current, departureAt: event.target.value }))} /></label><label className="space-y-1 text-xs font-bold text-slate-600"><span>Expected back on</span><input aria-label="Expected return date and time" className={field} type="datetime-local" value={form.expectedReturnAt} onChange={(event) => setForm((current) => ({ ...current, expectedReturnAt: event.target.value }))} /></label></div>{!form.termId && <p className="mt-2 text-sm font-semibold text-amber-700">There is no current term, so leave cannot be recorded yet.</p>}<Button className="mt-3 rounded-xl" disabled={!form.studentId || !form.termId || !form.reason || !form.departureAt || !form.expectedReturnAt || createLeave.isPending} onClick={() => createLeave.mutate({ dormitoryId: selected.id, ...form }, { onSuccess: () => { toast('Leave request recorded', 'success'); setShowForm(false); setForm((current) => ({ studentId: '', termId: current.termId, leaveType: 'HOME', reason: '', departureAt: '', expectedReturnAt: '' })); }, onError: (error) => toast(errorMessage(error), 'error') })}>Save leave request</Button></>}</section>}
  </main>;
}
