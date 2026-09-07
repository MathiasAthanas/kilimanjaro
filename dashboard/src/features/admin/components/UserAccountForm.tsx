import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api/client';
import { payloadOf, arrayFromApi } from '../../../lib/api/response';
import { useAuthStore } from '../../../lib/auth/authStore';
import { Button } from '../../../components/common/Button';
import { adminKeys } from '../api/admin.hooks';

export function useSchools() {
  return useQuery({ queryKey: ['admin', 'schools'], queryFn: async () => arrayFromApi(await api.get('/auth/users/schools').then(payloadOf)) as { id: string; name: string }[] });
}
export function SchoolSelect({ value, onChange, allowGlobal = false }: { value: string; onChange: (id: string) => void; allowGlobal?: boolean }) {
  const user = useAuthStore(s => s.session?.user);
  const schools = useSchools();
  const changeRef = useRef(onChange); changeRef.current = onChange;
  useEffect(() => { if (user?.schoolId) changeRef.current(user.schoolId); }, [user?.schoolId]);
  return <label className="grid gap-2 text-sm font-semibold">School
    <select required={!allowGlobal} aria-label="School" className="rounded-lg border p-3" value={user?.schoolId || value} disabled={!!user?.schoolId || schools.isLoading} onChange={e => onChange(e.target.value)}>
      <option value="">{allowGlobal ? 'Global account (no school)' : 'Select a school'}</option>
      {(schools.data ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
    {schools.isError && <span role="alert">Unable to load schools.</span>}
  </label>;
}
const roleOptions = ['TEACHER', 'HEAD_OF_DEPARTMENT', 'ACADEMIC_QA', 'FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN', 'PARENT', 'STUDENT'];
const empty = { firstName: '', lastName: '', email: '', phoneNumber: '', registrationNumber: '', department: '' };
export function UserAccountForm({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const actor = useAuthStore(state => state.session?.user);
  const qc = useQueryClient();
  const [fields, setFields] = useState(empty);
  const [schoolId, setSchoolId] = useState('');
  const [roles, setRoles] = useState<string[]>(['TEACHER']);
  const [primaryRole, setPrimaryRole] = useState('TEACHER');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const detail = useQuery({ queryKey: ['admin', 'user', userId], enabled: !!userId, queryFn: () => api.get(`/auth/users/${userId}`).then(payloadOf) });
  useEffect(() => {
    if (!detail.data) return;
    const u = detail.data as Record<string, any>;
    setFields(Object.fromEntries(Object.keys(empty).map(k => [k, u[k] ?? ''])) as typeof empty);
    setSchoolId(u.schoolId ?? ''); setRoles(u.roles ?? [u.role]); setPrimaryRole(u.primaryRole ?? u.role);
  }, [detail.data]);
  const globalTarget = !!userId && (detail.data as { schoolId?: string | null })?.schoolId === null && !actor?.schoolId;
  const availableRoles = [...new Set([...roleOptions, ...(!actor?.schoolId ? ['BOARD_DIRECTOR', 'MANAGING_DIRECTOR'] : []), ...roles])];
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if ((!schoolId && !globalTarget) || !roles.length || !roles.includes(primaryRole)) { setError('Select a school, at least one role, and a primary role from the selected roles.'); return; }
    const old = detail.data as Record<string, any> | undefined;
    const schoolChanged = !!userId && (schoolId || null) !== old?.schoolId;
    const privilegedAdded = roles.some(r => ['SYSTEM_ADMIN', 'PRINCIPAL', 'HEAD_OF_DEPARTMENT', 'ACADEMIC_QA', 'FINANCE'].includes(r) && !(old?.roles ?? []).includes(r));
    if ((schoolChanged || privilegedAdded) && !window.confirm('Confirm the selected school and privileged roles for this account.')) return;
    setSaving(true);
    try {
      const payload = { ...fields, email: fields.email.trim() || null, phoneNumber: fields.phoneNumber || null, registrationNumber: fields.registrationNumber || null, ...(schoolId ? { schoolId } : {}), roles, primaryRole, ...(schoolChanged ? { schoolChangeReason: reason } : {}) };
      const result = await (userId ? api.patch(`/auth/users/${userId}`, payload) : api.post('/auth/users', { ...payload, email: payload.email ?? undefined, phoneNumber: payload.phoneNumber ?? undefined, registrationNumber: payload.registrationNumber ?? undefined })).then(payloadOf);
      await qc.invalidateQueries({ queryKey: adminKeys.users() });
      await qc.invalidateQueries({ queryKey: ['admin', 'user', userId] });
      if (!userId && (result as { temporaryPassword?: string }).temporaryPassword) setCreatedPassword((result as { temporaryPassword: string }).temporaryPassword);
      else navigate('/admin/users');
    } catch (err) {
      const message = (err as { message?: string | string[] })?.message;
      setError(Array.isArray(message) ? message.join('; ') : message || 'Unable to save user');
    }
    finally { setSaving(false); }
  }
  if (userId && detail.isLoading) return <p>Loading user…</p>;
  if (userId && detail.isError) return <p role="alert">Unable to load this user.</p>;
  if (createdPassword) return <div className="space-y-4 rounded-xl border bg-white p-6"><p>User created. Share this temporary password securely:</p><code>{createdPassword}</code><p>The user must change it on first login.</p><Button onClick={() => navigate('/admin/users')}>Return to users</Button></div>;
  return <form onSubmit={save} className="space-y-5 rounded-xl border bg-white p-6">
    <SchoolSelect value={schoolId} onChange={setSchoolId} allowGlobal={globalTarget} />
    <div className="grid gap-4 md:grid-cols-2">{Object.entries(fields).map(([key, value]) => <label className="grid gap-2 text-sm font-semibold" key={key}>{({ firstName: 'First name', lastName: 'Last name', email: 'Email', phoneNumber: 'Phone number', registrationNumber: 'Registration number', department: 'Department' } as Record<string, string>)[key]}
      <input className="rounded-lg border p-3" required={['firstName', 'lastName'].includes(key)} type={key === 'email' ? 'email' : 'text'} value={value} onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))} />
    </label>)}</div>
    <fieldset><legend className="mb-3 font-semibold">Roles</legend><div className="flex flex-wrap gap-4">{availableRoles.map(role => <label key={role} className="flex items-center gap-2"><input type="checkbox" checked={roles.includes(role)} onChange={e => setRoles(current => e.target.checked ? [...current, role] : current.filter(r => r !== role))} />{role.replaceAll('_', ' ')}</label>)}</div></fieldset>
    <label className="grid gap-2 font-semibold">Primary role<select className="rounded-lg border p-3" value={primaryRole} onChange={e => setPrimaryRole(e.target.value)}><option value="">Select primary role</option>{roles.map(r => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}</select></label>
    {!!userId && (schoolId || null) !== (detail.data as any)?.schoolId && <label className="grid gap-2">Reason for changing school<input required className="rounded-lg border p-3" value={reason} onChange={e => setReason(e.target.value)} /></label>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <Button type="submit" disabled={saving || !roles.length || !roles.includes(primaryRole) || (!schoolId && !globalTarget)}>{saving ? 'Saving…' : userId ? 'Save user' : 'Create user'}</Button>
  </form>;
}
