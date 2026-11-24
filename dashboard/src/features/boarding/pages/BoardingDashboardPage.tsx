import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BedDouble, Building2, CalendarCheck, ClipboardCheck, Plus, UserPlus, Users, type LucideIcon } from 'lucide-react';
import { AwaitingPlacementPanel } from '../components/AwaitingPlacementPanel';
import { BoardingRollCallTrend } from '../components/BoardingRollCallTrend';
import { StatusToggle } from '../components/StatusToggle';
import { Badge } from '../../../components/common/Badge';
import { MixedHistogram } from '../../analytics/components/Charts';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { toast } from '../../../lib/toast';
import {
  useAssignDormitoryStaff,
  useBoardingDashboard,
  useBoardingStaff,
  useBoardingTerms,
  useCreateDormitory,
  useCreateHostelLeave,
  useDormitory,
  useHostelLeaves,
  useRecordHostelRollCall,
  useTransitionHostelLeave,
  useUnassignDormitoryStaff,
  useUnassignDormitoryStudent,
  useUpdateDormitory,
  useUpdateDormitoryBed,
} from '../api/boarding.hooks';

const field = 'h-10 w-full rounded-xl border border-[#d5dde6] bg-white px-3 text-sm font-semibold outline-none focus:border-[#00334f]';
const today = () => new Date().toISOString().slice(0, 10);
const errorMessage = (error: unknown) => (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message || (error as { message?: string })?.message || 'Action failed';

export function BoardingDashboardPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  const activeSchoolId = useSchoolStore((state) => state.activeSchool?.id ?? '__group__');
  const canAdmin = ['ADMIN', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN'].includes(role ?? '');
  const dashboard = useBoardingDashboard();
  const dorms = useMemo(() => dashboard.data?.dormitories ?? [], [dashboard.data?.dormitories]);
  const [selectedDormId, setSelectedDormId] = useState('');
  const selectedDormIsInScope = dorms.some((dorm) => dorm.id === selectedDormId);
  const detail = useDormitory(selectedDormIsInScope ? selectedDormId : undefined);
  const { data: staff = [] } = useBoardingStaff(canAdmin);
  const { data: terms = [] } = useBoardingTerms();
  const { data: leaves = [] } = useHostelLeaves();
  const createDorm = useCreateDormitory();
  const assignStaff = useAssignDormitoryStaff();
  const recordRollCall = useRecordHostelRollCall();
  const createLeave = useCreateHostelLeave();
  const transitionLeave = useTransitionHostelLeave();
  const updateDorm = useUpdateDormitory();
  const updateBed = useUpdateDormitoryBed();
  const unassignStudent = useUnassignDormitoryStudent();
  const unassignStaff = useUnassignDormitoryStaff();
  const [showCreate, setShowCreate] = useState(false);
  const [dormForm, setDormForm] = useState({ name: '', gender: '' as '' | 'MALE' | 'FEMALE', totalBeds: '20', notes: '', staff: [] as string[] });
  const [capacity, setCapacity] = useState('');
  const [staffForm, setStaffForm] = useState({ staffUserId: '', staffRole: 'MATRON' });
  const [rollSession, setRollSession] = useState('EVENING');
  const [rollStatuses, setRollStatuses] = useState<Record<string, string>>({});
  const [leaveForm, setLeaveForm] = useState({ studentId: '', termId: '', leaveType: 'HOME', reason: '', departureAt: '', expectedReturnAt: '' });

  const selected = detail.data;
  const selectedAssignments = selected?.studentAssignments;
  useEffect(() => {
    if (!selectedDormId && dorms[0]?.id) setSelectedDormId(dorms[0].id);
  }, [dorms, selectedDormId]);
  useEffect(() => {
    // Do not carry a selected dormitory across a school switch. The next
    // render waits for the new, scoped directory before loading its detail.
    setSelectedDormId('');
  }, [activeSchoolId]);
  useEffect(() => {
    if (selectedAssignments) {
      setRollStatuses(Object.fromEntries(selectedAssignments.map((assignment) => [assignment.studentId, 'PRESENT'])));
    }
  }, [selectedAssignments]);
  useEffect(() => setCapacity(selected ? String(selected.totalBeds) : ''), [selected]);

  const activeLeaves = leaves.filter((leave) => !['RETURNED', 'REJECTED', 'CANCELLED'].includes(leave.status));
  const leaveEligibleStudents = selected?.studentAssignments.filter((assignment) => !activeLeaves.some((leave) => leave.student.id === assignment.studentId)) ?? [];

  const submitDorm = () => createDorm.mutate(
    {
      name: dormForm.name.trim(),
      gender: dormForm.gender as 'MALE' | 'FEMALE',
      totalBeds: Number(dormForm.totalBeds),
      notes: dormForm.notes.trim() || undefined,
      staff: dormForm.staff.map((id) => ({ staffUserId: id, staffRole: (staff.find((row) => row.id === id)?.role ?? 'MATRON') as 'MATRON' | 'PATRON' })),
    },
    { onSuccess: () => { toast(dormForm.staff.length ? 'Dormitory created with its beds and staff' : 'Dormitory created with its beds', 'success'); setShowCreate(false); setDormForm({ name: '', gender: '', totalBeds: '20', notes: '', staff: [] }); }, onError: (error) => toast(errorMessage(error), 'error') },
  );

  const submitRollCall = () => {
    if (!selected) return;
    recordRollCall.mutate({
      dormitoryId: selected.id,
      date: today(),
      session: rollSession,
      records: selected.studentAssignments.map((assignment) => ({ studentId: assignment.studentId, status: rollStatuses[assignment.studentId] ?? 'PRESENT' })),
    }, { onSuccess: () => toast(`${rollSession.toLowerCase()} roll call saved`, 'success'), onError: (error) => toast(errorMessage(error), 'error') });
  };

  if (dashboard.isLoading) return <main className="p-6"><SkeletonTable cols={4} /></main>;
  if (dashboard.isError) return <main className="p-6"><DataError onRetry={() => dashboard.refetch()} /></main>;

  const totals = dashboard.data?.totals ?? {};
  return (
    <main className="space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#64748b]">Student welfare</p><h1 className="mt-1 text-2xl font-black text-[#00334f]">Boarding & Hostel Dashboard</h1><p className="mt-1 text-sm font-semibold text-[#64748b]">Dormitory rosters, beds, roll call, leave and return tracking.</p></div>
        <div className="flex flex-wrap gap-2"><NavLink to="/boarding/roll-call-report"><Button variant="secondary" className="rounded-xl"><ClipboardCheck className="h-4 w-4" /> Roll call report</Button></NavLink>{canAdmin && <Button className="rounded-xl" onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" /> Add Dormitory</Button>}</div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {([
          ['Waiting for a bed', totals.awaitingPlacement ?? 0, UserPlus], ['Dormitories', totals.dormitories ?? 0, Building2], ['Beds', totals.beds ?? 0, BedDouble], ['Missing Roll Calls', totals.missingRollCalls ?? 0, ClipboardCheck], ['Students Away', totals.studentsAway ?? 0, CalendarCheck], ['Expected Today', totals.expectedReturnsToday ?? 0, Users],
        ] satisfies Array<[string, number, LucideIcon]>).map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-[#4338CA]" /><p className="mt-3 text-2xl font-black text-[#00334f]">{value}</p><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p></div>)}
      </section>

      <div className="grid gap-4 xl:grid-cols-2"><MixedHistogram title="Dormitory occupancy" subtitle="Beds, occupied places and remaining capacity by dormitory" rows={dorms.map((dorm) => ({ label: dorm.name, total: dorm.totalBeds, occupied: dorm.occupiedBeds }))} /><BoardingRollCallTrend /></div>

      {showCreate && canAdmin && <section className="rounded-2xl border border-[#00334f]/30 bg-white p-5 shadow-sm" aria-label="Add dormitory">
        <h2 className="font-display text-lg font-black text-[#00334f]">Add a dormitory</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Name it, say how many beds it has and who looks after it. The beds are created for you.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label><span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Name *</span><input className={`${field} mt-1`} placeholder="For example: Kilimanjaro House" value={dormForm.name} onChange={(e) => setDormForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label><span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Students accommodated *</span><select className={`${field} mt-1`} value={dormForm.gender} onChange={(e) => setDormForm((f) => ({ ...f, gender: e.target.value as '' | 'MALE' | 'FEMALE' }))}><option value="">Choose boys or girls…</option><option value="MALE">Boys</option><option value="FEMALE">Girls</option></select></label>
          <label><span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Number of beds *</span><input className={`${field} mt-1`} type="number" min="1" value={dormForm.totalBeds} onChange={(e) => setDormForm((f) => ({ ...f, totalBeds: e.target.value }))} /></label>
          <label><span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Notes (optional)</span><input className={`${field} mt-1`} placeholder="For example: Form 1 boys wing" value={dormForm.notes} onChange={(e) => setDormForm((f) => ({ ...f, notes: e.target.value }))} /></label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-[11px] font-black uppercase tracking-widest text-slate-500">Matron or patron in charge</legend>
          {staff.length === 0 ? <p className="mt-2 text-sm font-semibold text-slate-500">No matron or patron accounts exist for this school yet. Create them under Users (role Matron or Patron), then come back to assign them. You can also add the dormitory now and assign staff later.</p> : (
            <div className="mt-2 flex flex-wrap gap-2">{staff.map((member) => { const on = dormForm.staff.includes(member.id); const label = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.name || member.email || member.id; return <button key={member.id} type="button" aria-pressed={on} onClick={() => setDormForm((f) => ({ ...f, staff: on ? f.staff.filter((x) => x !== member.id) : [...f.staff, member.id] }))} className={`rounded-full border px-3 py-1.5 text-sm font-bold ${on ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-slate-200 text-slate-600 hover:border-[#00334f]/50'}`}>{label} <span className="text-[10px] uppercase opacity-70">{member.role === 'PATRON' ? 'Patron' : 'Matron'}</span></button>; })}</div>
          )}
        </fieldset>
        <div className="mt-5 flex gap-2"><Button className="rounded-xl bg-[#00334f]" disabled={!dormForm.name.trim() || !dormForm.gender || !(Number(dormForm.totalBeds) > 0) || createDorm.isPending} loading={createDorm.isPending} onClick={submitDorm}>Create dormitory</Button><Button variant="secondary" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button></div>
      </section>}

      <AwaitingPlacementPanel canCreateDormitory={canAdmin} />

      <section className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="text-xs font-black uppercase tracking-widest text-[#00334f]">Dormitories</h2><div className="mt-3 space-y-2">{dorms.length === 0 ? <EmptyState title="No dormitories" description={canAdmin ? 'Create the first dormitory to begin.' : 'No dormitory has been assigned to you.'} /> : dorms.map((dorm) => <button key={dorm.id} onClick={() => setSelectedDormId(dorm.id)} className={`w-full rounded-xl border p-3 text-left ${selectedDormId === dorm.id ? 'border-[#4338CA] bg-[#eef2ff]' : 'border-slate-200 hover:bg-slate-50'}`}><div className="flex justify-between gap-2"><span className="font-black text-slate-900">{dorm.name}</span><Badge tone={dorm.availableBeds ? 'emerald' : 'rose'}>{dorm.occupiedBeds}/{dorm.totalBeds}</Badge></div><p className="mt-1 text-xs font-semibold text-slate-500">{dorm.code} · {dorm.gender === 'MALE' ? 'Boys' : dorm.gender === 'FEMALE' ? 'Girls' : 'Gender not set'} · {dorm.availableBeds} beds available</p></button>)}</div></aside>

        <div className="space-y-5">{!selectedDormId ? <EmptyState title="Select a dormitory" description="Choose a dormitory to manage its roster." /> : detail.isLoading ? <SkeletonTable cols={4} /> : !selected ? <DataError onRetry={() => detail.refetch()} /> : <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-slate-500">{selected.code} · {selected.gender === 'MALE' ? 'Boys' : selected.gender === 'FEMALE' ? 'Girls' : 'Gender not set'}</p><h2 className="text-xl font-black text-[#00334f]">{selected.name}</h2>{selected.eligibilityNotes && <p className="mt-1 text-sm font-semibold text-slate-500">Eligibility: {selected.eligibilityNotes}</p>}</div><div className="flex gap-2"><Badge tone="blue">{selected.totalBeds} beds</Badge><Badge tone="emerald">{selected.studentAssignments.length} students</Badge></div></div>
            {!selected.gender && <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">This existing dormitory has no boys/girls designation. Review the roster below, move any students who do not belong together, then set its designation. New placements are blocked until then.</p>}
            {canAdmin && <div className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-[180px] text-xs font-bold text-slate-600"><span>Students accommodated</span><select className={`${field} mt-1`} value={selected.gender ?? ''} disabled={updateDorm.isPending} onChange={(event) => { const gender = event.target.value as 'MALE' | 'FEMALE'; if (gender) updateDorm.mutate({ id: selected.id, gender }, { onSuccess: () => toast('Dormitory designation updated', 'success'), onError: (error) => toast(errorMessage(error), 'error') }); }}><option value="">Not set — select</option><option value="MALE">Boys</option><option value="FEMALE">Girls</option></select></label><p className="pb-2 text-xs text-slate-500">Staff assignments are independent of this choice. A change is blocked if the current roster includes the other gender.</p></div>}
            {canAdmin && <div className="mt-4 flex max-w-sm gap-2"><input aria-label="Total dormitory beds" className={field} type="number" min={selected.studentAssignments.length} value={capacity} onChange={(event) => setCapacity(event.target.value)} /><Button variant="secondary" className="rounded-xl" disabled={!capacity || Number(capacity) === selected.totalBeds || updateDorm.isPending} onClick={() => updateDorm.mutate({ id: selected.id, totalBeds: Number(capacity) }, { onSuccess: () => toast('Bed capacity updated', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}>Update beds</Button></div>}
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {canAdmin && <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-black text-slate-900">Assign Matron / Patron</h3><div className="mt-3 flex flex-col gap-2 sm:flex-row"><select className={field} value={staffForm.staffUserId} onChange={(e) => { const user = staff.find((row) => row.id === e.target.value); setStaffForm({ staffUserId: e.target.value, staffRole: String(user?.role ?? 'MATRON') }); }}><option value="">Select staff…</option>{staff.map((user) => <option key={user.id} value={user.id}>{`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.name || user.email} · {user.role === 'PATRON' ? 'Patron' : 'Matron'}</option>)}</select><Button className="rounded-xl" disabled={!staffForm.staffUserId} onClick={() => assignStaff.mutate({ dormitoryId: selected.id, ...staffForm }, { onSuccess: () => toast('Staff assigned to dormitory', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}>Assign</Button></div><div className="mt-3 flex flex-wrap gap-2">{selected.staffAssignments.map((assignment) => <button key={assignment.id} title="Remove staff assignment" className="rounded-full" onClick={() => unassignStaff.mutate({ dormitoryId: selected.id, staffUserId: assignment.staffUserId }, { onSuccess: () => toast('Staff assignment ended', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}><Badge tone="blue">{assignment.staffRole} · remove</Badge></button>)}</div></div>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-[#00334f]">Today&apos;s Roll Call</h2><p className="text-sm font-semibold text-slate-500">{today()} · idempotent per student and session</p></div><div className="flex gap-2"><select className={field} value={rollSession} onChange={(e) => setRollSession(e.target.value)}><option value="MORNING">Morning</option><option value="EVENING">Evening</option></select><Button className="rounded-xl" disabled={selected.studentAssignments.length === 0 || recordRollCall.isPending} onClick={submitRollCall}>Save Roll Call</Button></div></div><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="py-2">Student</th><th>Gender</th><th>Class</th><th>Bed</th><th>Status</th><th>Roster</th></tr></thead><tbody>{selected.studentAssignments.map((assignment) => <tr key={assignment.id} className="border-b border-slate-100"><td className="py-3 font-bold">{assignment.student.firstName} {assignment.student.lastName}<span className="ml-2 font-mono text-xs text-slate-400">{assignment.student.registrationNumber}</span></td><td>{assignment.student.gender === 'MALE' ? 'Boy' : assignment.student.gender === 'FEMALE' ? 'Girl' : '—'}</td><td>{assignment.student.enrolments?.[0]?.class?.name ?? '—'}</td><td>{assignment.bed?.label ?? '—'}</td><td><StatusToggle name={`${assignment.student.firstName} ${assignment.student.lastName}`} value={rollStatuses[assignment.studentId] ?? 'PRESENT'} onChange={(value) => setRollStatuses((current) => ({ ...current, [assignment.studentId]: value }))} /></td><td><Button variant="secondary" className="rounded-xl" disabled={unassignStudent.isPending} onClick={() => unassignStudent.mutate({ dormitoryId: selected.id, studentId: assignment.studentId }, { onSuccess: () => toast('Student removed from dormitory roster', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}>Remove</Button></td></tr>)}</tbody></table>{selected.studentAssignments.length === 0 && <p className="py-6 text-center text-sm font-semibold text-slate-500">No students assigned yet.</p>}</div></section>

          {canAdmin && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-[#00334f]">Bed Inventory</h2><p className="mt-1 text-sm font-semibold text-slate-500">Occupied beds are protected; available beds may be placed in maintenance or made inactive.</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{selected.beds.map((bed) => <label key={bed.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><span className="font-bold text-slate-900">{bed.label}</span><select aria-label={`${bed.label} status`} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold" value={bed.status} disabled={bed.status === 'OCCUPIED' || updateBed.isPending} onChange={(event) => updateBed.mutate({ dormitoryId: selected.id, bedId: bed.id, status: event.target.value }, { onSuccess: () => toast('Bed status updated', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}><option value="AVAILABLE">Available</option><option value="MAINTENANCE">Maintenance</option><option value="INACTIVE">Inactive</option>{bed.status === 'OCCUPIED' && <option value="OCCUPIED">Occupied</option>}</select></label>)}</div></section>}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-[#00334f]">Record Student Leave</h2><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><select className={field} value={leaveForm.studentId} onChange={(e) => setLeaveForm((f) => ({ ...f, studentId: e.target.value }))}><option value="">Select roster student…</option>{leaveEligibleStudents.map((assignment) => <option key={assignment.studentId} value={assignment.studentId}>{assignment.student.firstName} {assignment.student.lastName}</option>)}</select><select className={field} value={leaveForm.termId} onChange={(e) => setLeaveForm((f) => ({ ...f, termId: e.target.value }))}><option value="">Active term…</option>{terms.map((row) => { const term = row as Record<string, unknown>; return <option key={String(term.id)} value={String(term.id)}>{String(term.name)}</option>; })}</select><select className={field} value={leaveForm.leaveType} onChange={(e) => setLeaveForm((f) => ({ ...f, leaveType: e.target.value }))}><option value="HOME">Permission to go home</option><option value="TEMPORARY">Temporary leave</option></select><label className="space-y-1 text-xs font-bold text-slate-600"><span>From — departure date &amp; time</span><input aria-label="From departure date and time" className={field} type="datetime-local" value={leaveForm.departureAt} onChange={(e) => setLeaveForm((f) => ({ ...f, departureAt: e.target.value }))} /></label><label className="space-y-1 text-xs font-bold text-slate-600"><span>To — expected return date &amp; time</span><input aria-label="To expected return date and time" className={field} type="datetime-local" value={leaveForm.expectedReturnAt} onChange={(e) => setLeaveForm((f) => ({ ...f, expectedReturnAt: e.target.value }))} /></label><input className={field} placeholder="Leave reason" value={leaveForm.reason} onChange={(e) => setLeaveForm((f) => ({ ...f, reason: e.target.value }))} /></div><Button className="mt-3 rounded-xl" disabled={!leaveForm.studentId || !leaveForm.termId || !leaveForm.reason || !leaveForm.departureAt || !leaveForm.expectedReturnAt} onClick={() => createLeave.mutate({ dormitoryId: selected.id, ...leaveForm }, { onSuccess: () => { toast('Leave request recorded', 'success'); setLeaveForm({ studentId: '', termId: '', leaveType: 'HOME', reason: '', departureAt: '', expectedReturnAt: '' }); }, onError: (error) => toast(errorMessage(error), 'error') })}>Record Leave Request</Button></section>
        </>}</div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-black text-[#00334f]">Leave & Return Queue</h2><div className="mt-4 space-y-3">{activeLeaves.length === 0 ? <EmptyState title="No active leave records" description="Requests and students currently away appear here." /> : activeLeaves.map((leave) => <div key={leave.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><p className="font-black text-slate-900">{leave.student.firstName} {leave.student.lastName} <Badge tone="amber">{leave.status}</Badge></p><p className="mt-1 text-xs font-semibold text-slate-500">{leave.dormitory.name} · {leave.leaveType.replace('_', ' ')} · Return {new Date(leave.expectedReturnAt).toLocaleString()}</p><p className="mt-1 text-sm text-slate-700">{leave.reason}</p></div><div className="flex flex-wrap gap-2">{leave.status === 'REQUESTED' && <><Button className="rounded-xl" onClick={() => transitionLeave.mutate({ id: leave.id, status: 'APPROVED' }, { onSuccess: () => toast('Leave approved', 'success'), onError: (error) => toast(errorMessage(error), 'error') })}>Approve</Button><Button variant="secondary" className="rounded-xl" onClick={() => transitionLeave.mutate({ id: leave.id, status: 'REJECTED' })}>Reject</Button></>}{leave.status === 'APPROVED' && <Button className="rounded-xl" onClick={() => transitionLeave.mutate({ id: leave.id, status: 'DEPARTED' })}>Mark Departed</Button>}{leave.status === 'DEPARTED' && <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => transitionLeave.mutate({ id: leave.id, status: 'RETURNED', actualReturnAt: new Date().toISOString() })}>Mark Returned</Button>}</div></div>)}</div></section>
    </main>
  );
}
