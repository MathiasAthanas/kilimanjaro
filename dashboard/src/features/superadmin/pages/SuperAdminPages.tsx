import { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { Building2, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import {
  SCHOOL_GENDER_LABELS,
  SCHOOL_TYPE_LABELS,
  useAdminUsers,
  useAssignMembershipMutation,
  useAssignWithUserMutation,
  useCreateSchoolMutation,
  useGroupOverview,
  useMemberships,
  useSchools,
  useSetSchoolStatusMutation,
  useUpdateSchoolMutation,
  type SchoolRow,
} from '../../manager/api/manager.hooks';
import { ManagerBreadcrumb, ManagerWorkspaceShell, useEnterSchool } from '../../manager/pages/ManagerPages';
import { SchoolGallery } from '../../manager/components/SchoolGallery';

// ─── Landing: gallery + New School ───────────────────────────────────────────

export function SuperAdminHomePage() {
  const navigate = useNavigate();
  const enterSchool = useEnterSchool();
  const { data, isLoading, isError, refetch } = useGroupOverview();

  return (
    <ManagerWorkspaceShell
      title="Group Structure"
      eyebrow="Define schools, assign their heads"
      action={
        <NavLink to="/superadmin/schools/new">
          <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30]"><Plus className="h-3.5 w-3.5" /> New School</Button>
        </NavLink>
      }
    >
      <ManagerBreadcrumb crumbs={[{ label: 'Super Admin' }, { label: 'Schools' }]} />
      <SystemAdministratorsPanel />
      {isLoading ? <SkeletonTable cols={4} /> : isError || !data ? <DataError onRetry={refetch} /> : data.schools.length === 0 ? (
        <EmptyState title="Create your first school" description="Schools are the foundation of the group — every student, class and invoice lives inside one." action={{ label: 'New School', href: '/superadmin/schools/new' }} />
      ) : (
        <>
          <SchoolGallery
            schools={data.schools}
            groupStats={{ students: data.totals.students, collectionRate: data.totals.collectionRate, academicMean: data.totals.academicMean }}
            onOpenSchool={enterSchool}
          />
          <SchoolAdminTable />
        </>
      )}
    </ManagerWorkspaceShell>
  );
}

function SystemAdministratorsPanel() {
  const { data: admins = [], refetch } = useMemberships({ role: 'SYSTEM_ADMIN' });
  const create = useAssignWithUserMutation();
  const [open, setOpen] = useState(false);
  const [createdPassword, setCreatedPassword] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const field = 'h-10 rounded-xl border border-[#d5dde6] px-3 text-sm font-semibold outline-none focus:border-[#00334f]';

  const submit = () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast('First name, last name and email are required', 'warning');
      return;
    }
    create.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      role: 'SYSTEM_ADMIN',
    }, {
      onSuccess: (result: unknown) => {
        const temp = (result as { user?: { temporaryPassword?: string } })?.user?.temporaryPassword ?? '';
        setCreatedPassword(temp);
        setForm({ firstName: '', lastName: '', email: '' });
        setOpen(false);
        refetch();
        toast(temp ? `Administrator created. First password: ${temp}` : 'Administrator created', 'success');
      },
      onError: (error: unknown) => {
        const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast(message || 'Could not create administrator', 'error');
      },
    });
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eef2f6] px-5 py-3.5">
        <div>
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]">
            <ShieldCheck className="h-3.5 w-3.5" /> System Administrators
          </h2>
          <p className="mt-1 text-xs font-semibold text-[#64748b]">Create the accounts that manage daily system setup and school operations.</p>
        </div>
        <Button className="rounded bg-[#00334f] py-2 text-xs hover:bg-[#001e30]" onClick={() => setOpen((value) => !value)}>
          <UserPlus className="h-3.5 w-3.5" /> New Administrator
        </Button>
      </div>

      {open && (
        <div className="grid gap-3 border-b border-[#eef2f6] bg-[#f8fafc] px-5 py-4 md:grid-cols-[1fr_1fr_1.4fr_auto]">
          <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className={field} />
          <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className={field} />
          <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email address" type="email" className={field} />
          <Button className="rounded-xl py-2 text-xs" disabled={create.isPending} onClick={submit}>
            {create.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      )}

      {createdPassword && (
        <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-800">
          First login password: <span className="font-mono font-black">{createdPassword}</span>
        </div>
      )}

      <div className="divide-y divide-[#e2e8f0]">
        {admins.length === 0 ? (
          <p className="px-5 py-4 text-sm font-semibold text-[#64748b]">No system administrators have been created yet.</p>
        ) : admins.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div>
              <p className="font-black text-[#00334f]">{m.user.firstName} {m.user.lastName}</p>
              <p className="text-xs font-semibold text-[#64748b]">{m.user.email}</p>
            </div>
            <Badge tone={m.user.isActive ? 'emerald' : 'slate'}>{m.user.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
          </div>
        ))}
      </div>
    </section>
  );
}

function SchoolAdminTable() {
  const { data: schools = [], isLoading } = useSchools();
  const setStatus = useSetSchoolStatusMutation();
  if (isLoading) return <SkeletonTable cols={6} />;
  return (
    <section className="overflow-hidden rounded-lg border border-[#d5dde6] bg-white">
      <div className="border-b border-[#eef2f6] px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]"><Building2 className="h-3.5 w-3.5" /> School Administration</h2>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-[#eef5f8]">
          <tr>
            {['School', 'Code', 'Type', 'Gender', 'Status', 'Actions'].map((h) => (
              <th key={h} className="border-b border-[#d5dde6] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#00334f]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2e8f0]">
          {schools.map((s) => (
            <tr key={s.id} className="bg-white even:bg-[#f7f9fb]">
              <td className="px-4 py-3 font-black text-[#00334f]">{s.name}</td>
              <td className="px-4 py-3 font-mono">{s.code}</td>
              <td className="px-4 py-3">{SCHOOL_TYPE_LABELS[s.type]}</td>
              <td className="px-4 py-3">{SCHOOL_GENDER_LABELS[s.gender]}</td>
              <td className="px-4 py-3"><Badge tone={s.isActive ? 'emerald' : 'slate'}>{s.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
              <td className="px-4 py-3">
                <div className="flex gap-3">
                  <NavLink to={`/superadmin/schools/${s.id}/edit`} className="text-xs font-black text-[#00334f] hover:underline">Edit</NavLink>
                  <button
                    onClick={() =>
                      setStatus.mutate({ id: s.id, isActive: !s.isActive }, {
                        onSuccess: () => toast(`${s.name} ${s.isActive ? 'deactivated' : 'activated'}`, 'success'),
                        onError: () => toast('Status change failed', 'error'),
                      })
                    }
                    className={`text-xs font-black hover:underline ${s.isActive ? 'text-[#e11d48]' : 'text-[#10b981]'}`}
                  >
                    {s.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ─── Create / Edit school ─────────────────────────────────────────────────────

export function SchoolFormPage() {
  const { schoolId } = useParams();
  const navigate = useNavigate();
  const { data: schools = [] } = useSchools();
  const existing = schools.find((s) => s.id === schoolId);
  const createMutation = useCreateSchoolMutation();
  const updateMutation = useUpdateSchoolMutation();

  const [form, setForm] = useState({
    name: existing?.name ?? '',
    code: existing?.code ?? '',
    type: existing?.type ?? 'PRIMARY',
    gender: existing?.gender ?? 'BOTH',
    motto: existing?.motto ?? '',
    address: existing?.address ?? '',
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
  });
  const [loadedId, setLoadedId] = useState<string | undefined>(existing?.id);
  if (existing && loadedId !== existing.id) {
    setForm({
      name: existing.name, code: existing.code, type: existing.type, gender: existing.gender,
      motto: existing.motto ?? '', address: existing.address ?? '', phone: existing.phone ?? '', email: existing.email ?? '',
    });
    setLoadedId(existing.id);
  }

  const isEdit = Boolean(schoolId);
  const busy = createMutation.isPending || updateMutation.isPending;

  const submit = (acknowledgeNarrowing = false) => {
    if (!form.name.trim()) { toast('Give the school a name', 'warning'); return; }
    const body = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      type: form.type as SchoolRow['type'],
      gender: form.gender as SchoolRow['gender'],
      motto: form.motto || undefined,
      address: form.address || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
    };
    const onError = (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      if (message.includes('acknowledgeNarrowing')) {
        if (window.confirm(`${message}\n\nProceed anyway?`)) submit(true);
        return;
      }
      toast(message || 'Save failed. Check the details and retry.', 'error');
    };
    if (isEdit && schoolId) {
      updateMutation.mutate({ id: schoolId, ...body, acknowledgeNarrowing }, {
        onSuccess: () => { toast('School updated', 'success'); navigate('/superadmin'); },
        onError,
      });
    } else {
      createMutation.mutate(body, {
        onSuccess: (created) => { toast(`${created.name} created`, 'success'); navigate(`/superadmin/schools/${created.id}/edit`); },
        onError,
      });
    }
  };

  const field = 'mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]';

  return (
    <ManagerWorkspaceShell title={isEdit ? `Edit ${existing?.name ?? 'School'}` : 'Open a New School'} eyebrow="School definition" action={<span />}>
      <ManagerBreadcrumb crumbs={[{ label: 'Super Admin', to: '/superadmin' }, { label: isEdit ? 'Edit School' : 'New School' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2"><span className="text-xs font-black uppercase text-[#64748b]">School Name *</span>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Kilimanjaro Schools Boys" className={field} /></label>
            <label><span className="text-xs font-black uppercase text-[#64748b]">Code</span>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="Auto-generated if blank" className={field} disabled={isEdit} /></label>
            <label><span className="text-xs font-black uppercase text-[#64748b]">Type *</span>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))} className={`${field} bg-white`}>
                <option value="NURSERY">Nursery</option>
                <option value="PRIMARY">Primary</option>
                <option value="SECONDARY">Secondary</option>
              </select></label>
            <div className="md:col-span-2">
              <span className="text-xs font-black uppercase text-[#64748b]">Gender *</span>
              <div className="mt-2 flex gap-2">
                {(['MALE', 'FEMALE', 'BOTH'] as const).map((g) => (
                  <button key={g} type="button" onClick={() => setForm((f) => ({ ...f, gender: g }))}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition ${form.gender === g ? 'border-[#00334f] bg-[#00334f] text-white' : 'border-[#d5dde6] bg-[#f7f9fb] text-[#334155] hover:border-[#00334f]/40'}`}>
                    {SCHOOL_GENDER_LABELS[g]}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-semibold text-[#94a3b8]">Gender can be changed later — widening is instant; narrowing warns if students of the excluded gender are enrolled.</p>
            </div>
            <label><span className="text-xs font-black uppercase text-[#64748b]">Motto</span>
              <input value={form.motto} onChange={(e) => setForm((f) => ({ ...f, motto: e.target.value }))} className={field} /></label>
            <label><span className="text-xs font-black uppercase text-[#64748b]">Phone</span>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={field} /></label>
            <label><span className="text-xs font-black uppercase text-[#64748b]">Email</span>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={field} /></label>
            <label><span className="text-xs font-black uppercase text-[#64748b]">Address</span>
              <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className={field} /></label>
          </div>
          <div className="mt-6 flex gap-2">
            <Button className="rounded-xl" disabled={busy} onClick={() => submit()}>
              {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create School'}
            </Button>
            <Button variant="secondary" className="rounded-xl" onClick={() => navigate('/superadmin')}>Cancel</Button>
          </div>
        </section>

        <div className="space-y-gutter">
          {isEdit && schoolId ? <HeadOfSchoolPanel schoolId={schoolId} /> : (
            <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Next step</p>
              <p className="mt-2 text-sm font-semibold text-[#64748b]">After creating the school you can assign its Head of School — pick an existing user or create a new account in one step.</p>
            </section>
          )}
        </div>
      </div>
    </ManagerWorkspaceShell>
  );
}

// ─── Head of School assignment ────────────────────────────────────────────────

function HeadOfSchoolPanel({ schoolId }: { schoolId: string }) {
  const { data: memberships = [], refetch } = useMemberships({ schoolId, role: 'HEAD_OF_SCHOOL' });
  const assign = useAssignMembershipMutation();
  const assignWithUser = useAssignWithUserMutation();
  const [mode, setMode] = useState<'existing' | 'new' | null>(null);
  const [search, setSearch] = useState('');
  const { data: users = [] } = useAdminUsers(search || undefined);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '' });
  const heads = memberships.filter((m) => m.role === 'HEAD_OF_SCHOOL');

  const field = 'mt-2 h-10 w-full rounded-xl border border-[#d5dde6] px-3 text-sm font-semibold outline-none focus:border-[#00334f]';

  return (
    <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#00334f]" />
        <h2 className="text-xs font-black uppercase tracking-widest text-[#00334f]">Head of School</h2>
      </div>
      {heads.length === 0 ? (
        <p className="mt-2 rounded-xl border border-[#d59a1b]/40 bg-[#fffbeb] p-3 text-sm font-bold text-[#7a5200]">No head assigned yet — the school appears in the gallery flagged until one is set.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {heads.map((m) => (
            <div key={m.id} className="rounded-xl border border-emerald-200 bg-[#f0fdf9] px-4 py-3">
              <p className="font-black text-[#00334f]">{m.user.firstName} {m.user.lastName}</p>
              <p className="text-xs font-semibold text-[#64748b]">{m.user.email}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant={mode === 'existing' ? 'primary' : 'secondary'} className="flex-1 rounded-xl py-2 text-xs" onClick={() => setMode(mode === 'existing' ? null : 'existing')}>Pick Existing</Button>
        <Button variant={mode === 'new' ? 'primary' : 'secondary'} className="flex-1 rounded-xl py-2 text-xs" onClick={() => setMode(mode === 'new' ? null : 'new')}><UserPlus className="h-3.5 w-3.5" /> Create New</Button>
      </div>

      {mode === 'existing' && (
        <div className="mt-3">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className={field} />
          <div className="mt-2 space-y-1.5">
            {users.slice(0, 5).map((u) => (
              <button key={u.id} disabled={assign.isPending}
                onClick={() => assign.mutate({ authUserId: u.id, schoolId, role: 'HEAD_OF_SCHOOL' }, {
                  onSuccess: () => { toast(`${u.firstName} ${u.lastName} is now Head of this school`, 'success'); setMode(null); setSearch(''); refetch(); },
                  onError: () => toast('Assignment failed', 'error'),
                })}
                className="flex w-full items-center justify-between rounded-lg border border-[#d5dde6] bg-[#f7f9fb] px-3 py-2 text-left text-sm transition hover:border-[#00334f]">
                <span className="font-bold text-[#00334f]">{u.firstName} {u.lastName}</span>
                <span className="text-xs text-[#64748b]">{u.role}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] font-semibold text-[#94a3b8]">The same person can head more than one school — just assign them here on each school.</p>
        </div>
      )}

      {mode === 'new' && (
        <div className="mt-3 space-y-2">
          <input value={newUser.firstName} onChange={(e) => setNewUser((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className={field} />
          <input value={newUser.lastName} onChange={(e) => setNewUser((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className={field} />
          <input value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className={field} />
          <Button
            className="w-full rounded-xl py-2 text-xs"
            disabled={assignWithUser.isPending || !newUser.firstName || !newUser.lastName || !newUser.email}
            onClick={() =>
              assignWithUser.mutate({ ...newUser, role: 'HEAD_OF_SCHOOL', schoolId }, {
                onSuccess: (result: unknown) => {
                  const temp = (result as { user?: { temporaryPassword?: string } })?.user?.temporaryPassword;
                  toast(temp ? `Head created — temporary password: ${temp}` : 'Head of School created and assigned', 'success');
                  setMode(null); setNewUser({ firstName: '', lastName: '', email: '' }); refetch();
                },
                onError: () => toast('Could not create the user', 'error'),
              })
            }
          >
            {assignWithUser.isPending ? 'Creating…' : 'Create & Assign'}
          </Button>
        </div>
      )}
    </section>
  );
}
