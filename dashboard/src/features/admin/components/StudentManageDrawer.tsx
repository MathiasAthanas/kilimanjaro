import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { toast } from '../../../lib/toast';
import {
  useUpdateStudentMutation,
  useChangeStudentStatusMutation,
  usePromoteStudentMutation,
  useAddGuardianMutation,
  useUpdateGuardianMutation,
  useUnlinkGuardianMutation,
  lookupGuardians,
} from '../api/admin.hooks';

interface GuardianRow { id: string; name: string; phoneNumber: string; isPrimary: boolean; hasLoginAccount: boolean }
export interface ManageStudent {
  id: string; fullName: string; firstName?: string; middleName?: string; lastName?: string;
  gender?: string | null; dateOfBirth?: string | null; nationality?: string | null;
  legacyAdmissionNumber?: string | null; status?: string; registrationNumber?: string;
  guardians: GuardianRow[];
}
interface ClassOption { id: string; name: string; stream?: string | null; educationStage?: string }

const REL = ['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'];

export function StudentManageDrawer({
  student, classes, academicYearId, onClose,
}: {
  student: ManageStudent; classes: ClassOption[]; academicYearId: string; onClose: () => void;
}) {
  const updateStudent = useUpdateStudentMutation();
  const changeStatus = useChangeStudentStatusMutation();
  const promote = usePromoteStudentMutation();
  const addGuardian = useAddGuardianMutation();
  const updateGuardian = useUpdateGuardianMutation();
  const unlinkGuardian = useUnlinkGuardianMutation();

  const [form, setForm] = useState({
    firstName: student.firstName ?? '', middleName: student.middleName ?? '', lastName: student.lastName ?? '',
    gender: student.gender ?? '', dateOfBirth: student.dateOfBirth ? String(student.dateOfBirth).slice(0, 10) : '',
    nationality: student.nationality ?? '', legacyAdmissionNumber: student.legacyAdmissionNumber ?? '',
  });
  const [transferTo, setTransferTo] = useState('');
  const [newG, setNewG] = useState({ firstName: '', lastName: '', phoneNumber: '', relationship: 'GUARDIAN' });
  const [lookupPhone, setLookupPhone] = useState('');
  const [matches, setMatches] = useState<any[] | null>(null);

  const saveDetails = () => {
    const body: Record<string, unknown> = {
      firstName: form.firstName.trim(), middleName: form.middleName.trim() || undefined, lastName: form.lastName.trim(),
      nationality: form.nationality.trim() || undefined,
      legacyAdmissionNumber: form.legacyAdmissionNumber.trim() || undefined,
    };
    if (form.gender) body.gender = form.gender;
    if (form.dateOfBirth) body.dateOfBirth = form.dateOfBirth;
    updateStudent.mutate({ id: student.id, body }, {
      onSuccess: () => toast('Student details saved.', 'success'),
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to save', 'error'),
    });
  };

  const doStatus = (status: string, label: string) => {
    changeStatus.mutate({ id: student.id, body: { status } }, {
      onSuccess: () => { toast(`Student ${label}.`, 'success'); if (status !== 'ACTIVE') onClose(); },
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed', 'error'),
    });
  };

  const doTransfer = () => {
    if (!transferTo) return;
    promote.mutate({ id: student.id, body: { toClassId: transferTo, academicYearId } }, {
      onSuccess: () => { toast('Student transferred.', 'success'); onClose(); },
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Transfer failed', 'error'),
    });
  };

  const addNewGuardian = () => {
    if (!newG.firstName.trim() || !newG.phoneNumber.trim()) { toast('Guardian name and phone required.', 'warning'); return; }
    addGuardian.mutate({ studentId: student.id, body: { ...newG, lastName: newG.lastName.trim() || student.lastName || '', isPrimary: student.guardians.length === 0 } }, {
      onSuccess: () => { toast('Guardian added.', 'success'); setNewG({ firstName: '', lastName: '', phoneNumber: '', relationship: 'GUARDIAN' }); },
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to add', 'error'),
    });
  };

  const runLookup = async () => {
    try {
      const res = await lookupGuardians({ phone: lookupPhone });
      setMatches(res);
      if (!res.length) toast('No existing guardian found for that phone.', 'info');
    } catch { toast('Lookup failed', 'error'); }
  };

  const linkExisting = (g: any) => {
    addGuardian.mutate({ studentId: student.id, body: {
      authUserId: g.authUserId, firstName: g.firstName, lastName: g.lastName,
      phoneNumber: g.phoneNumber, relationship: g.relationship ?? 'GUARDIAN', email: g.email,
      isPrimary: student.guardians.length === 0,
    } }, {
      onSuccess: () => { toast('Existing guardian linked.', 'success'); setMatches(null); setLookupPhone(''); },
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to link', 'error'),
    });
  };

  const setPrimary = (g: GuardianRow) => updateGuardian.mutate(
    { studentId: student.id, guardianId: g.id, body: { firstName: g.name.split(' ')[0], lastName: g.name.split(' ').slice(1).join(' ') || g.name, phoneNumber: g.phoneNumber, relationship: 'GUARDIAN', isPrimary: true } },
    { onSuccess: () => toast('Primary guardian updated.', 'success'), onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed', 'error') },
  );
  const unlink = (g: GuardianRow) => unlinkGuardian.mutate({ studentId: student.id, guardianId: g.id }, {
    onSuccess: () => toast('Guardian unlinked.', 'success'), onError: (e: any) => toast(e?.response?.data?.message ?? 'Cannot unlink', 'error'),
  });

  const input = 'h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white';
  const label = 'text-[10px] font-black uppercase tracking-widest text-slate-500';
  const isActive = (student.status ?? 'ACTIVE') === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Manage student</p>
            <h2 className="font-display text-lg font-black text-slate-900">{student.fullName}</h2>
            <p className="text-xs font-semibold text-slate-400">{student.registrationNumber} · {student.status}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-6 p-6">
          {/* Details */}
          <section>
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div><span className={label}>First name</span><input className={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><span className={label}>Middle name</span><input className={input} value={form.middleName} onChange={(e) => setForm({ ...form, middleName: e.target.value })} /></div>
              <div><span className={label}>Last name</span><input className={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><span className={label}>Gender</span>
                <select className={input} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">—</option><option value="MALE">MALE</option><option value="FEMALE">FEMALE</option>
                </select>
              </div>
              <div><span className={label}>Date of birth</span><input type="date" className={input} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} /></div>
              <div><span className={label}>Nationality</span><input className={input} value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} /></div>
              <div className="col-span-2"><span className={label}>Admission number (legacy)</span><input className={input} value={form.legacyAdmissionNumber} onChange={(e) => setForm({ ...form, legacyAdmissionNumber: e.target.value })} /></div>
            </div>
            <Button className="mt-3 rounded-xl px-4 py-2 text-sm" disabled={updateStudent.isPending} onClick={saveDetails}>{updateStudent.isPending ? 'Saving…' : 'Save details'}</Button>
          </section>

          {/* Status */}
          <section className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Status</p>
            <div className="flex flex-wrap gap-2">
              {isActive
                ? <button onClick={() => doStatus('SUSPENDED', 'deactivated')} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-white hover:bg-amber-600">Deactivate</button>
                : <button onClick={() => doStatus('ACTIVE', 'reactivated')} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white hover:bg-emerald-600">Reactivate</button>}
              <button onClick={() => doStatus('GRADUATED', 'graduated')} className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-black text-white hover:bg-indigo-600">Graduate</button>
              <button onClick={() => doStatus('TRANSFERRED', 'marked transferred')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Mark Transferred</button>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">Deactivate/graduate are reversible via status; records are preserved (no hard delete).</p>
          </section>

          {/* Transfer */}
          <section className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Transfer to class</p>
            <div className="flex gap-2">
              <select className={input} value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                <option value="">— Choose destination class —</option>
                {classes.filter((c) => c.id !== undefined).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.stream ? ` · ${c.stream}` : ''} ({String(c.educationStage ?? '').replace('_', '-')})</option>
                ))}
              </select>
              <Button className="rounded-xl px-4 py-2 text-sm" disabled={!transferTo || promote.isPending} onClick={doTransfer}>{promote.isPending ? '…' : 'Transfer'}</Button>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-slate-400">Moves the active enrolment; a cross-school class also moves the student's school. Cross-stage needs a configured pathway.</p>
          </section>

          {/* Guardians */}
          <section className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-500">Guardians</p>
            <div className="space-y-2">
              {student.guardians.length === 0 && <p className="text-xs font-semibold text-rose-500">No guardians linked.</p>}
              {student.guardians.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">{g.name}{g.isPrimary && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-black text-indigo-700">PRIMARY</span>}</p>
                    <p className="text-[11px] text-slate-400">{g.phoneNumber || 'no phone'} · {g.hasLoginAccount ? 'has login' : 'no login'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-black">
                    {!g.isPrimary && <button onClick={() => setPrimary(g)} className="text-indigo-600 hover:underline">Make primary</button>}
                    <button onClick={() => unlink(g)} className="text-rose-500 hover:underline">Unlink</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Link existing */}
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className={label}>Link existing guardian (by phone)</p>
              <div className="mt-2 flex gap-2">
                <input className={input} placeholder="+255…" value={lookupPhone} onChange={(e) => setLookupPhone(e.target.value)} />
                <Button variant="secondary" className="rounded-xl px-3 py-2 text-xs" onClick={runLookup}>Search</Button>
              </div>
              {matches && matches.map((m) => (
                <div key={m.id} className="mt-2 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">{m.firstName} {m.lastName} · {m.phoneNumber} · linked to {m.linkedStudents}</span>
                  <button onClick={() => linkExisting(m)} className="font-black text-indigo-600 hover:underline">Link</button>
                </div>
              ))}
            </div>

            {/* Add new */}
            <div className="mt-3 rounded-xl bg-slate-50 p-3">
              <p className={label}>Add new guardian</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input className={input} placeholder="First name" value={newG.firstName} onChange={(e) => setNewG({ ...newG, firstName: e.target.value })} />
                <input className={input} placeholder="Last name" value={newG.lastName} onChange={(e) => setNewG({ ...newG, lastName: e.target.value })} />
                <input className={input} placeholder="Phone +255…" value={newG.phoneNumber} onChange={(e) => setNewG({ ...newG, phoneNumber: e.target.value })} />
                <select className={input} value={newG.relationship} onChange={(e) => setNewG({ ...newG, relationship: e.target.value })}>
                  {REL.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <Button className="mt-2 rounded-xl px-4 py-2 text-xs" disabled={addGuardian.isPending} onClick={addNewGuardian}>Add guardian</Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
