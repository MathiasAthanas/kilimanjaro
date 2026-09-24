import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, NavLink } from 'react-router-dom';
import { Download, KeyRound, UserPlus, X } from 'lucide-react';
import { AdminShell } from '../components/AdminConsole';
import { Button } from '../../../components/common/Button';
import { toast } from '../../../lib/toast';
import { api } from '../../../lib/api/client';
import { payloadOf, arrayFromApi } from '../../../lib/api/response';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { StudentManageDrawer, type ManageStudent } from '../components/StudentManageDrawer';
import {
  useClassStudents,
  useAddGuardianMutation,
  useUnlinkGuardianMutation,
  useResetUserPwMutation,
} from '../api/admin.hooks';

interface GuardianSummary { name: string; phoneNumber: string; isPrimary: boolean; hasLoginAccount: boolean }
interface ClassStudentRow {
  id: string; registrationNumber: string; legacyAdmissionNumber?: string | null;
  fullName: string; gender?: string | null; dateOfBirth?: string | null; status?: string;
  authUserId?: string; hasAuthAccount: boolean; guardians: GuardianSummary[];
  primaryGuardian?: GuardianSummary | null; guardianStatus: string; profileComplete: boolean;
  missing: string[]; statusLabel: string;
}

const STATUS_TONE: Record<string, string> = {
  Complete: 'bg-emerald-100 text-emerald-700',
  Incomplete: 'bg-amber-100 text-amber-700',
  'Missing DOB': 'bg-amber-100 text-amber-700',
  'Missing Gender': 'bg-rose-100 text-rose-700',
  'No Guardian': 'bg-rose-100 text-rose-700',
  'Guardian Missing Phone': 'bg-amber-100 text-amber-700',
  'No Login Account': 'bg-rose-100 text-rose-700',
  Inactive: 'bg-slate-200 text-slate-600',
  Transferred: 'bg-slate-200 text-slate-600',
  Graduated: 'bg-indigo-100 text-indigo-700',
};

function Stat({ label, value, tone = 'slate' }: { label: string; value: number; tone?: string }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900', indigo: 'text-indigo-600', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${tones[tone]}`}>{value}</p>
    </div>
  );
}

export function ClassStudentsAdminPage() {
  const { classId } = useParams<{ classId: string }>();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const { data, isLoading, isError } = useClassStudents(classId, { ...filters, search: search || undefined, limit: 200 });
  const addGuardian = useAddGuardianMutation();
  const unlinkGuardian = useUnlinkGuardianMutation();
  const resetPw = useResetUserPwMutation();

  const [guardianFor, setGuardianFor] = useState<ClassStudentRow | null>(null);
  const [gForm, setGForm] = useState({ firstName: '', lastName: '', phoneNumber: '', relationship: 'GUARDIAN' });
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);
  const [manageStudent, setManageStudent] = useState<ClassStudentRow | null>(null);

  // Classes in scope, for the transfer control inside the manage drawer.
  const activeSchoolKey = useSchoolStore((s) => s.activeSchool?.id ?? '__group__');
  const { data: allClasses = [] as any[] } = useQuery({
    queryKey: ['import', 'classes', activeSchoolKey],
    queryFn: () => api.get('/students/classes').then((r) => arrayFromApi(payloadOf(r), ['classes']) as any[]),
    staleTime: 30_000,
  });

  const report = data as {
    class?: { name: string; stream?: string; educationStage?: string; combinationCode?: string | null; academicYearName?: string | null };
    school?: { name?: string | null; gender?: string | null };
    overview?: Record<string, number>;
    students?: ClassStudentRow[];
  } | undefined;

  const students = report?.students ?? [];
  const ov = report?.overview ?? {};

  const setFilter = (key: string, value: string) => setFilters((f) => { const n = { ...f }; if (value) n[key] = value; else delete n[key]; return n; });

  function submitGuardian() {
    if (!guardianFor) return;
    if (!gForm.firstName.trim() || !gForm.phoneNumber.trim()) { toast('Guardian first name and phone are required.', 'warning'); return; }
    addGuardian.mutate({
      studentId: guardianFor.id,
      body: {
        firstName: gForm.firstName.trim(),
        lastName: gForm.lastName.trim() || guardianFor.fullName.split(' ').slice(-1)[0],
        phoneNumber: gForm.phoneNumber.trim(),
        relationship: gForm.relationship,
        isPrimary: guardianFor.guardians.length === 0,
      },
    }, {
      onSuccess: () => { toast('Guardian added.', 'success'); setGuardianFor(null); setGForm({ firstName: '', lastName: '', phoneNumber: '', relationship: 'GUARDIAN' }); },
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to add guardian', 'error'),
    });
  }

  function handleReset(row: ClassStudentRow) {
    if (!row.authUserId) { toast('This student has no login account to reset.', 'warning'); return; }
    resetPw.mutate(row.authUserId, {
      onSuccess: (res: any) => setResetResult({ name: row.fullName, password: String(res?.temporaryPassword ?? '') }),
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to reset password', 'error'),
    });
  }

  function exportCsv(missingOnly: boolean) {
    const rows = missingOnly ? students.filter((s) => !s.profileComplete) : students;
    const headers = ['Registration', 'Admission', 'Name', 'Gender', 'DOB', 'Guardian', 'Guardian Phone', 'Login', 'Status', 'Missing'];
    const lines = [headers.join(',')];
    for (const s of rows) {
      const cells = [
        s.registrationNumber, s.legacyAdmissionNumber ?? '', s.fullName, s.gender ?? '', s.dateOfBirth ? String(s.dateOfBirth).slice(0, 10) : '',
        s.primaryGuardian?.name ?? '', s.primaryGuardian?.phoneNumber ?? '', s.hasAuthAccount ? 'yes' : 'no', s.statusLabel, s.missing.join(' '),
      ].map((v) => (String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : String(v)));
      lines.push(cells.join(','));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${report?.class?.name ?? 'class'}_${missingOnly ? 'missing_data' : 'students'}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  const title = report?.class ? `${report.class.name}${report.class.stream ? ` · ${report.class.stream}` : ''}` : 'Class Students';
  const subtitle = report?.class
    ? `${report.school?.name ?? ''} · ${String(report.class.educationStage ?? '').replace('_', '-')}${report.class.combinationCode ? ` · ${report.class.combinationCode}` : ''} · ${report.class.academicYearName ?? ''}`
    : 'Students in this class';

  return (
    <AdminShell eyebrow="Class Student Management" title={title} subtitle={subtitle}>
      <div className="space-y-6">
        <NavLink to="/admin/classes" className="text-xs font-black text-[#4338CA] hover:underline">← Back to Classes</NavLink>

        {isError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">Failed to load class students (or class is outside your school scope).</div>}

        {/* Overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Total" value={ov.total ?? 0} tone="indigo" />
          <Stat label="Active" value={ov.active ?? 0} tone="emerald" />
          <Stat label="Complete" value={ov.completeProfiles ?? 0} tone="emerald" />
          <Stat label="Incomplete" value={ov.incompleteProfiles ?? 0} tone="amber" />
          <Stat label="No Guardian" value={ov.withoutGuardian ?? 0} tone="rose" />
          <Stat label="No Login" value={ov.noLogin ?? 0} tone="rose" />
          <Stat label="Male" value={ov.male ?? 0} />
          <Stat label="Female" value={ov.female ?? 0} />
          <Stat label="Missing Gender" value={ov.missingGender ?? 0} tone="rose" />
          <Stat label="Missing DOB" value={ov.missingDob ?? 0} tone="amber" />
          <Stat label="Missing Contact" value={ov.missingContact ?? 0} tone="amber" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, registration, admission…"
            className="h-9 min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white"
          />
          <FilterSelect value={filters.gender ?? ''} onChange={(v) => setFilter('gender', v)} options={[['', 'All genders'], ['MALE', 'Male'], ['FEMALE', 'Female']]} />
          <FilterSelect value={filters.completeness ?? ''} onChange={(v) => setFilter('completeness', v)} options={[['', 'All profiles'], ['COMPLETE', 'Complete'], ['INCOMPLETE', 'Incomplete']]} />
          <FilterSelect value={filters.guardian ?? ''} onChange={(v) => setFilter('guardian', v)} options={[['', 'All guardians'], ['WITH', 'Has guardian'], ['WITHOUT', 'No guardian']]} />
          <FilterSelect value={filters.missing ?? ''} onChange={(v) => setFilter('missing', v)} options={[['', 'Any data'], ['DOB', 'Missing DOB'], ['GENDER', 'Missing gender'], ['GUARDIAN', 'No guardian'], ['LOGIN', 'No login']]} />
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" className="rounded-lg px-3 py-2 text-xs" onClick={() => exportCsv(false)}><Download className="h-3.5 w-3.5" /> Export</Button>
            <Button variant="secondary" className="rounded-lg px-3 py-2 text-xs" onClick={() => exportCsv(true)}><Download className="h-3.5 w-3.5" /> Missing report</Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" style={{ minWidth: 1000 }}>
              <thead className="bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
                <tr>
                  {['Reg / Admission', 'Name', 'Gender', 'Guardian', 'Login', 'Status', 'Actions'].map((h) => <th key={h} className="px-4 py-3">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>}
                {!isLoading && students.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No students match.</td></tr>}
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs font-black text-slate-700">{s.registrationNumber}</p>
                      {s.legacyAdmissionNumber && <p className="text-[11px] text-slate-400">Adm {s.legacyAdmissionNumber}</p>}
                    </td>
                    <td className="px-4 py-3 font-black text-slate-900">{s.fullName}</td>
                    <td className="px-4 py-3">{s.gender ?? <span className="text-rose-500">—</span>}</td>
                    <td className="px-4 py-3">
                      {s.primaryGuardian
                        ? <div><p className="font-semibold text-slate-700">{s.primaryGuardian.name}</p><p className="text-[11px] text-slate-400">{s.primaryGuardian.phoneNumber || 'no phone'}</p></div>
                        : <span className="text-xs font-bold text-rose-500">None</span>}
                    </td>
                    <td className="px-4 py-3">{s.hasAuthAccount ? <span className="text-emerald-600">✓</span> : <span className="text-rose-500">✗</span>}</td>
                    <td className="px-4 py-3"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${STATUS_TONE[s.statusLabel] ?? 'bg-slate-100 text-slate-600'}`}>{s.statusLabel}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 text-xs font-black">
                        <button onClick={() => setManageStudent(s)} className="text-[#4338CA] hover:underline">Manage</button>
                        <button onClick={() => setGuardianFor(s)} className="text-slate-500 hover:text-slate-900">+ Guardian</button>
                        <button onClick={() => handleReset(s)} disabled={!s.authUserId || resetPw.isPending} className="text-slate-400 hover:text-slate-700 disabled:opacity-40">Reset PW</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Full management drawer */}
      {manageStudent && (
        <StudentManageDrawer
          student={manageStudent as unknown as ManageStudent}
          classes={allClasses}
          academicYearId={(report?.class as any)?.academicYearId ?? ''}
          onClose={() => setManageStudent(null)}
        />
      )}

      {/* Reset PW result */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setResetResult(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-amber-600" /><p className="font-black text-slate-900">Password reset — {resetResult.name}</p></div>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Temporary Password</p>
              <p className="mt-0.5 font-mono text-lg font-black text-slate-800">{resetResult.password}</p>
            </div>
            <Button className="mt-4 w-full rounded-xl py-2" onClick={() => setResetResult(null)}>Done</Button>
          </div>
        </div>
      )}

      {/* Add guardian modal */}
      {guardianFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setGuardianFor(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-indigo-600" /><p className="font-black text-slate-900">Add guardian — {guardianFor.fullName}</p></div>
              <button onClick={() => setGuardianFor(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            {guardianFor.guardians.length > 0 && (
              <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
                <p className="font-black uppercase tracking-widest text-slate-400">Current guardians</p>
                {guardianFor.guardians.map((g, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="font-semibold text-slate-600">{g.name} · {g.phoneNumber}{g.isPrimary ? ' (primary)' : ''}</span>
                    <button className="text-rose-500 hover:underline" onClick={() => unlinkGuardian.mutate({ studentId: guardianFor.id, guardianId: (g as any).id }, { onSuccess: () => toast('Guardian unlinked.', 'success'), onError: (e: any) => toast(e?.response?.data?.message ?? 'Cannot unlink', 'error') })}>Unlink</button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-3">
              <input value={gForm.firstName} onChange={(e) => setGForm({ ...gForm, firstName: e.target.value })} placeholder="Guardian first name" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white" />
              <input value={gForm.lastName} onChange={(e) => setGForm({ ...gForm, lastName: e.target.value })} placeholder="Guardian last name (optional)" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white" />
              <input value={gForm.phoneNumber} onChange={(e) => setGForm({ ...gForm, phoneNumber: e.target.value })} placeholder="Phone e.g. +255712345678" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white" />
              <select value={gForm.relationship} onChange={(e) => setGForm({ ...gForm, relationship: e.target.value })} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:bg-white">
                {['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <Button className="w-full rounded-xl py-2.5" disabled={addGuardian.isPending} onClick={submitGuardian}>{addGuardian.isPending ? 'Adding…' : 'Add guardian'}</Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}
