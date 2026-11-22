import { BedDouble, CheckCircle2, Search, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { DataError } from '../../../components/feedback/DataError';
import { errorMessage } from '../../../lib/api/errors';
import { toast } from '../../../lib/toast';
import { useAssignDormitoryStudent, useBoardingAwaiting, useDormitory } from '../api/boarding.hooks';

/**
 * Boarders who still need a dormitory. Pick a dormitory once, tick the students, and press one button:
 * each student gets the next free bed automatically.
 */
export function AwaitingPlacementPanel({ canCreateDormitory = false }: { canCreateDormitory?: boolean }) {
  const { data, isLoading, isError, refetch } = useBoardingAwaiting();
  const assign = useAssignDormitoryStudent();
  const [dormId, setDormId] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const dorms = useMemo(() => data?.dormitories ?? [], [data?.dormitories]);
  useEffect(() => {
    if (dormId && dorms.some((d) => d.id === dormId)) return;
    setDormId((dorms.find((d) => d.availableBeds > 0) ?? dorms[0])?.id ?? '');
  }, [dorms, dormId]);

  const detail = useDormitory(dormId || undefined);
  const freeBeds = useMemo(
    () => (detail.data?.beds ?? []).filter((b) => b.status === 'AVAILABLE').sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [detail.data?.beds],
  );
  const dorm = dorms.find((d) => d.id === dormId);
  const eligibleCount = (data?.students ?? []).filter((student) => dorm?.gender && student.gender === dorm.gender).length;

  const students = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = (data?.students ?? []).filter((student) => dorm?.gender && student.gender === dorm.gender);
    return q ? all.filter((s) => `${s.firstName} ${s.lastName} ${s.registrationNumber}`.toLowerCase().includes(q)) : all;
  }, [data?.students, dorm?.gender, search]);

  const place = async (ids: string[]) => {
    if (!dormId || !ids.length) return;
    if (!dorm?.gender || ids.some((id) => !students.some((student) => student.id === id))) {
      toast('Select a boys’ or girls’ dormitory and matching students first.', 'warning');
      return;
    }
    if (ids.length > freeBeds.length) {
      toast(`${dorm?.name ?? 'This dormitory'} has only ${freeBeds.length} free bed${freeBeds.length === 1 ? '' : 's'}. Select fewer students or choose another dormitory.`, 'warning');
      return;
    }
    setBusy(true);
    let done = 0;
    try {
      for (const [index, studentId] of ids.entries()) {
        await assign.mutateAsync({ dormitoryId: dormId, studentId, bedId: freeBeds[index].id });
        done++;
      }
      toast(`${done} student${done === 1 ? '' : 's'} placed in ${dorm?.name ?? 'the dormitory'}`, 'success');
      setPicked(new Set());
    } catch (error) {
      toast(`${done ? `${done} placed, then stopped: ` : ''}${errorMessage(error, 'Could not place the student')}`, 'error');
    } finally {
      setBusy(false);
      void refetch();
    }
  };

  if (isLoading) return <SkeletonTable cols={4} />;
  if (isError || !data) return <DataError message="Could not load the students waiting for a dormitory." onRetry={refetch} />;

  const allVisiblePicked = students.length > 0 && students.every((s) => picked.has(s.id));

  return (
    <section id="placement" className="rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="awaiting-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 id="awaiting-heading" className="font-display text-lg font-black text-[#00334f]">Waiting for a dormitory</h2>
          <p className="text-sm font-semibold text-slate-500">In-campus students who have not been given a bed yet.</p>
        </div>
        <Badge tone={eligibleCount ? 'amber' : 'emerald'}>{dorm ? `${eligibleCount} matching · ${data.total} school-wide` : `${data.total} waiting`}</Badge>
      </div>

      {data.total === 0 ? (
        <div className="flex items-center gap-3 px-5 py-8 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Everyone who stays on campus has a bed. New boarders appear here as soon as they are admitted.</div>
      ) : dorms.length === 0 ? (
        <div className="px-5 py-6 text-sm font-semibold text-slate-600">
          {canCreateDormitory ? 'There is no dormitory yet. Use "Add dormitory" above to create one, then place these students.' : 'You are not assigned to a dormitory yet. Ask the administrator to assign you to one.'}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
            <label className="min-w-[220px]">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Place into</span>
              <select value={dormId} onChange={(e) => { setDormId(e.target.value); setPicked(new Set()); }} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#00334f]">
                {dorms.map((d) => <option key={d.id} value={d.id}>{d.name} · {d.gender === 'MALE' ? 'Boys' : d.gender === 'FEMALE' ? 'Girls' : 'Gender not set'} · {d.availableBeds} free bed{d.availableBeds === 1 ? '' : 's'}</option>)}
              </select>
            </label>
            <span className="inline-flex items-center gap-1 pb-2 text-sm font-semibold text-slate-600"><BedDouble className="h-4 w-4" /> {detail.isLoading ? '…' : freeBeds.length} free</span>
            <label className="relative ml-auto">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or reg. number" aria-label="Search waiting students" className="h-10 w-64 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm font-semibold outline-none focus:border-[#00334f]" />
            </label>
            <Button className="rounded-xl bg-[#00334f]" disabled={!picked.size || busy || !dormId || !dorm?.gender} loading={busy} onClick={() => place([...picked])}>
              <UserPlus className="h-4 w-4" /> Place {picked.size || ''} selected
            </Button>
          </div>
          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-[11px] font-black uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="w-10 px-5 py-2"><input type="checkbox" aria-label="Select all shown" checked={allVisiblePicked} onChange={() => setPicked(allVisiblePicked ? new Set() : new Set(students.map((s) => s.id)))} className="accent-[#00334f]" /></th>
                  <th className="px-2 py-2 text-left">Student</th><th className="px-2 py-2 text-left">Gender</th><th className="px-2 py-2 text-left">Class</th><th className="px-5 py-2 text-right">Quick place</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5"><input type="checkbox" aria-label={`Select ${s.firstName} ${s.lastName}`} checked={picked.has(s.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })} className="accent-[#00334f]" /></td>
                    <td className="px-2 py-2.5"><span className="font-bold text-slate-800">{s.firstName} {s.lastName}</span><span className="block font-mono text-xs text-slate-500">{s.registrationNumber}</span></td>
                    <td className="px-2 py-2.5 font-semibold text-slate-600">{s.gender ? s.gender.charAt(0) + s.gender.slice(1).toLowerCase() : '—'}</td>
                    <td className="px-2 py-2.5 font-semibold text-slate-600">{s.className ?? '-'}</td>
                    <td className="px-5 py-2.5 text-right"><Button variant="secondary" className="!px-3 !py-1.5 text-xs" disabled={busy || !freeBeds.length} onClick={() => place([s.id])}>Place</Button></td>
                  </tr>
                ))}
                {students.length === 0 && <tr><td colSpan={5} className="px-5 py-6 text-center text-sm font-semibold text-slate-500">{dorm?.gender ? 'No matching students are waiting for this dormitory.' : 'Ask an administrator to set this dormitory to Boys or Girls before placing students.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
