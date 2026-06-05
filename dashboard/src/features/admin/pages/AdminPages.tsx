import { AlertTriangle, CheckCircle2, ChevronDown, Download, Play, Plus, Shield, Trash2, UserPlus } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { downloadReportWhenReady } from '../../operations/api/operations.hooks';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  adminAuditEvents, adminClasses, adminStudents, adminSubjects,
  adminUsers, assessmentTypes, classPathways, gradingScales, notificationLogs,
  notificationTemplates, reportJobs, serviceHealth,
  subjectCombinations,
} from '../api/adminApi';
import {
  useAdminAuditEvents,
  useAdminClasses,
  useAdminReportJobs,
  useAdminStudents,
  useAdminSubjects,
  useAdminUsers,
  useAcademicYears,
  useAssessmentTypes,
  useClassPathways,
  useGradingScales,
  useNotificationLogs,
  useNotificationTemplates,
  useServiceHealth,
  useSystemSettings,
  useUpdateSystemSettingsMutation,
  useSubjectCombinations,
  useDeactivateUserMutation,
  useActivateUserMutation,
  useResetUserPwMutation,
  useCreateUserMutation,
  useCreateStudentMutation,
  useCreateClassMutation,
  useCreateClassPathwayMutation,
  useCreateGradingScaleMutation,
  useActivateGradingScaleMutation,
  useSaveAssessmentTypesMutation,
  useBulkPromoteMutation,
  useCreateCombinationMutation,
  useDeleteCombinationMutation,
  useCreateSubjectMutation,
  useUpdateUserMutation,
  useChangeUserRoleMutation,
  useRunEngineAdminMutation,
  useSendManualNotificationMutation,
} from '../api/admin.hooks';
import { useFeeCategories } from '../../finance/api/finance.hooks';
import { useAnnouncements } from '../../common/common.hooks';
import {
  AdminDataTable, AdminFormSection, AdminMetricStrip, AdminQuickCard,
  AdminShell, AdminStatusIndicator, AssessmentTypeEditor, CsvImportZone,
  DangerActionDialog, FeatureToggle, Field, GradingBoundaryEditor,
  JsonInspector, NotificationTemplateEditor,
  SelectField, Td,
} from '../components/AdminConsole';
import { assessmentWeightsTotal, roleRisk } from '../utils/adminValidation';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';

// ─── Home ─────────────────────────────────────────────────────────────────────

export function AdminHomePage() {
  const { data: apiServiceHealth = [] as typeof serviceHealth } = useServiceHealth() as { data: typeof serviceHealth };
  const { data: apiUsers = [] as typeof adminUsers } = useAdminUsers() as { data: typeof adminUsers };
  const { data: apiStudents = [] as typeof adminStudents } = useAdminStudents() as { data: typeof adminStudents };
  const { data: apiAudit = [] as typeof adminAuditEvents } = useAdminAuditEvents() as { data: typeof adminAuditEvents };
  const { data: apiLogs = [] as typeof notificationLogs } = useNotificationLogs() as { data: typeof notificationLogs };
  const { data: apiClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };

  const lockedCount = apiUsers.filter((u: { status: string }) => u.status === 'LOCKED').length;
  const failedSms = apiLogs.filter((l: { status: string; channel: string }) => l.status === 'FAILED' && l.channel === 'SMS').length;

  return (
    <AdminShell title="System Control Center" eyebrow="Admin operations console">
      <AdminMetricStrip items={[
        { label: 'Users',      value: String(apiUsers.length),    detail: 'All roles',            tone: 'blue'  },
        { label: 'Students',   value: String(apiStudents.length), detail: 'Active registry',       tone: 'green' },
        { label: 'Locked',     value: String(lockedCount),        detail: 'Needs unlock',          tone: 'amber' },
        { label: 'Classes',    value: String(apiClasses.length),  detail: 'Active academic year',  tone: 'blue'  },
        { label: 'Audit',      value: String(apiAudit.length),    detail: 'Recent events',         tone: 'rose'  },
        { label: 'Failed SMS', value: String(failedSms),          detail: 'Notification logs',     tone: 'rose'  },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Quick Access</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminQuickCard title="Create User"            detail="Role-bound account with linked profile."          to="/admin/users/create"            icon="shield" />
            <AdminQuickCard title="Enrol Student"          detail="Multi-field admission form + bulk CSV import."     to="/admin/students/enrol"                        />
            <AdminQuickCard title="Academic Setup"         detail="Years, terms, classes, subjects, grading."        to="/admin/academic/setup"                        />
            <AdminQuickCard title="Notification Templates" detail="Edit and preview SMS / email / push templates."   to="/admin/notifications/templates"               />
            <AdminQuickCard title="Run Engine"             detail="Performance engine thresholds and manual run."    to="/admin/performance/engine"                    />
            <AdminQuickCard title="Generate Report"        detail="Any report across all domains."                   to="/admin/reports"                 icon="file"   />
            <AdminQuickCard title="System Audit"           detail="Security and settings events."                    to="/admin/audit/system"            icon="eye"    />
            <AdminQuickCard title="System Status"          detail="Live service health and incident surface."         to="/admin/system-status"           icon="eye"    />
            <AdminQuickCard title="System Settings"        detail="Providers, versions, feature flags."              to="/admin/settings/system"                       />
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Service Health</p>
          <div className="space-y-2.5">
            {apiServiceHealth.map((item: typeof serviceHealth[number]) => <AdminStatusIndicator key={item.service} {...item} />)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Recent Audit Events</p>
        <AuditPanel />
      </div>
    </AdminShell>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  return (
    <AdminShell title="User Management" eyebrow="Accounts, roles, security">
      <CsvImportZone entity="staff user" />
      <UsersTable />
    </AdminShell>
  );
}

function UsersTable() {
  const { data: apiUsers = [] as typeof adminUsers, isLoading, isError, refetch } = useAdminUsers() as { data: typeof adminUsers; isLoading: boolean; isError: boolean; refetch: () => void };
  const deactivateMutation = useDeactivateUserMutation();
  const activateMutation = useActivateUserMutation();
  const resetPwMutation = useResetUserPwMutation();
  const [pending, setPending] = useState<Record<string, string>>({});
  const [userSearch, setUserSearch] = useState('');

  const handleToggle = (id: string, currentStatus: string) => {
    setPending((p) => ({ ...p, [id]: 'toggle' }));
    if (currentStatus === 'ACTIVE') {
      deactivateMutation.mutate(id, {
        onSuccess: () => { toast('User locked successfully', 'warning'); setPending((p) => { const n = { ...p }; delete n[id]; return n; }); },
        onError: () => { toast('Failed to lock user', 'error'); setPending((p) => { const n = { ...p }; delete n[id]; return n; }); },
      });
    } else {
      activateMutation.mutate(id, {
        onSuccess: () => { toast('User unlocked successfully', 'success'); setPending((p) => { const n = { ...p }; delete n[id]; return n; }); },
        onError: () => { toast('Failed to unlock user', 'error'); setPending((p) => { const n = { ...p }; delete n[id]; return n; }); },
      });
    }
  };

  const handleResetPw = (id: string, name: string) => {
    resetPwMutation.mutate(id, {
      onSuccess: () => toast(`Password reset link sent to ${name}`, 'success'),
      onError: () => toast('Failed to send password reset', 'error'),
    });
  };

  const visibleUsers = userSearch.trim().length > 0
    ? apiUsers.filter((u) => {
        const q = userSearch.toLowerCase();
        return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q);
      })
    : apiUsers;

  if (isLoading) return <SkeletonTable cols={7} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (!apiUsers.length) return <EmptyState title="No users found" description="Create the first user account to get started." />;
  return (
    <AdminDataTable columns={['Name', 'Email', 'Role', 'Status', 'Linked Entity', 'Last Login', 'Actions']} onSearch={setUserSearch}>
      {visibleUsers.map((user) => (
        <tr key={user.id} className="hover:bg-slate-50">
          <Td>
            <p className="font-black text-slate-900">{user.name}</p>
          </Td>
          <Td className="text-slate-500">{user.email}</Td>
          <Td>
            <Badge tone={user.role === 'SYSTEM_ADMIN' || user.role === 'ADMIN' ? 'rose' : 'blue'}>{user.role}</Badge>
          </Td>
          <Td>
            <Badge tone={user.status === 'ACTIVE' ? 'emerald' : user.status === 'LOCKED' ? 'amber' : 'slate'}>
              {user.status}
            </Badge>
          </Td>
          <Td className="text-slate-500">{user.linked}</Td>
          <Td className="text-xs text-slate-400">{String(user.lastLogin ?? '').slice(0, 10)}</Td>
          <Td>
            <div className="flex items-center gap-3">
              <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/users/${user.id}`}>Edit</NavLink>
              <button
                disabled={!!pending[user.id]}
                onClick={() => handleToggle(user.id, user.status)}
                className="text-xs font-black text-slate-500 transition hover:text-slate-900 disabled:opacity-40"
              >
                {pending[user.id] ? '…' : user.status === 'LOCKED' ? 'Unlock' : 'Lock'}
              </button>
              <button
                onClick={() => handleResetPw(user.id, user.name)}
                className="text-xs font-black text-slate-400 transition hover:text-slate-700"
              >
                Reset PW
              </button>
            </div>
          </Td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

// ─── Create / Edit user ───────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'TEACHER',            label: 'Teacher'            },
  { value: 'HEAD_OF_DEPARTMENT', label: 'Head of Department' },
  { value: 'ACADEMIC_QA',        label: 'AQA Officer'        },
  { value: 'FINANCE',            label: 'Finance Officer'    },
  { value: 'PRINCIPAL',          label: 'Principal'          },
  { value: 'SYSTEM_ADMIN',       label: 'System Admin'       },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Active — can log in'             },
  { value: 'INACTIVE', label: 'Inactive — no access'            },
  { value: 'PENDING',  label: 'Pending — first login required'  },
];

const DEPARTMENT_OPTIONS = [
  { value: 'Science Department', label: 'Science Department' },
  { value: 'Mathematics Department', label: 'Mathematics Department' },
  { value: 'Languages Department', label: 'Languages Department' },
  { value: 'Humanities Department', label: 'Humanities Department' },
  { value: 'Business Department', label: 'Business Department' },
  { value: 'ICT Department', label: 'ICT Department' },
  { value: 'Primary Department', label: 'Primary Department' },
  { value: 'Academic Quality Assurance', label: 'Academic Quality Assurance' },
  { value: 'Finance Office', label: 'Finance Office' },
  { value: 'Principal Office', label: 'Principal Office' },
  { value: 'System Administration', label: 'System Administration' },
];

function departmentOptionsForRole(role: string) {
  if (role === 'FINANCE') return DEPARTMENT_OPTIONS.filter((option) => option.value === 'Finance Office');
  if (role === 'PRINCIPAL') return DEPARTMENT_OPTIONS.filter((option) => option.value === 'Principal Office');
  if (role === 'ACADEMIC_QA') return DEPARTMENT_OPTIONS.filter((option) => option.value === 'Academic Quality Assurance');
  if (role === 'SYSTEM_ADMIN') return DEPARTMENT_OPTIONS.filter((option) => option.value === 'System Administration');
  return DEPARTMENT_OPTIONS.filter(
    (option) => !['Finance Office', 'Principal Office', 'System Administration'].includes(option.value),
  );
}

function defaultDepartmentForRole(role: string) {
  return departmentOptionsForRole(role)[0]?.value ?? '';
}

function rolePermissions(role: string): string[] {
  const map: Record<string, string[]> = {
    TEACHER: ['Marks entry and attendance', 'Class analytics', 'Announcements inbox'],
    HEAD_OF_DEPARTMENT: ['Marks approval queue', 'Department analytics', 'Teacher performance view'],
    ACADEMIC_QA: ['Performance engine access', 'Academic alerts', 'Exam & moderation tools'],
    FINANCE: ['Invoice management', 'Payment recording', 'Fee structure management'],
    PRINCIPAL: ['School health dashboard', 'Executive approvals', 'Full analytics read'],
    SYSTEM_ADMIN: ['User management', 'System settings', 'All modules - read / write'],
  };
  return map[role] ?? ['Standard workspace access'];
}

export function CreateUserPage() {
  const navigate = useNavigate();
  const createMutation = useCreateUserMutation();
  const [role, setRole] = useState('TEACHER');
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    linked: defaultDepartmentForRole('TEACHER'),
    status: 'ACTIVE',
  });
  const [createdPassword, setCreatedPassword] = useState('');
  const isPrivileged = roleRisk(role) === 'high';

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    setForm((f) => ({ ...f, linked: defaultDepartmentForRole(nextRole) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) { toast('Name and email are required', 'warning'); return; }

    const names = form.name.trim().split(/\s+/);
    const firstName = names[0] ?? form.name.trim();
    const lastName = names.slice(1).join(' ') || firstName;

    createMutation.mutate({
      email: form.email.trim().toLowerCase(),
      role,
      firstName,
      lastName,
      phoneNumber: form.phone.trim() || undefined,
      department: form.linked,
      isActive: form.status === 'ACTIVE',
    }, {
      onSuccess: (created: any) => {
        const tempPassword = String(created?.temporaryPassword ?? '');
        setCreatedPassword(tempPassword);
        toast(tempPassword ? `User created. First password: ${tempPassword}` : 'User created successfully', 'success');
      },
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to create user.', 'error'),
    });
  };

  return (
    <AdminShell title="Create User" eyebrow="Identity and role provisioning">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-gutter">
            <AdminFormSection title="Identity" subtitle="Staff name, email address, and contact number">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Full Name" value={form.name} onChange={set('name')} placeholder="e.g. Amina Rashidi" />
                <Field label="Email Address" type="email" value={form.email} onChange={set('email')} placeholder="name@school.ac.tz" />
                <Field label="Phone Number" type="tel" value={form.phone} onChange={set('phone')} placeholder="+255 7XX XXX XXX" />
              </div>
            </AdminFormSection>

            <AdminFormSection title="Role & Access" subtitle="Role determines the workspace and permission set assigned">
              <div className="grid gap-4 md:grid-cols-3">
                <SelectField label="Role" options={ROLE_OPTIONS} value={role} onChange={handleRoleChange} />
                <SelectField
                  key={`department-${role}`}
                  label="Linked Entity / Department"
                  options={departmentOptionsForRole(role)}
                  value={form.linked}
                  onChange={(value) => setForm((f) => ({ ...f, linked: value }))}
                />
                <SelectField label="Account Status" options={STATUS_OPTIONS} value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} />
              </div>
              {isPrivileged && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-800">
                    <span className="font-black">{role}</span> is a privileged role with elevated system access.
                    Confirm this assignment is authorised before creating.
                  </p>
                </div>
              )}
            </AdminFormSection>

            <div className="flex gap-3">
              <Button type="submit" className="rounded-xl bg-[#4338CA]" disabled={createMutation.isPending}>
                <UserPlus className="h-4 w-4" /> {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => navigate('/admin/users')}>
                Cancel
              </Button>
            </div>
            {createdPassword && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-900">User created successfully</p>
                <p className="mt-1 text-sm font-semibold text-emerald-800">
                  First login password: <span className="font-mono font-black">{createdPassword}</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">
                  The user must change this password after first login.
                </p>
              </div>
            )}
          </div>

          {/* Permissions preview sidebar */}
          <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Permissions for {role}</p>
            <ul className="mt-4 space-y-2.5">
              {rolePermissions(role).map((perm) => (
                <li key={perm} className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  {perm}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </form>
    </AdminShell>
  );
}

export function UserDetailPage() {
  const { loading, user } = useUser();
  if (loading) return <AdminShell title="Loading…" eyebrow="User detail"><SkeletonTable cols={4} /></AdminShell>;
  if (!user) return <AdminShell title="Not Found" eyebrow="User detail"><EmptyState title="User not found" description="This user account does not exist." /></AdminShell>;
  return (
    <AdminShell title={user.name} eyebrow="User detail and security">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <UsersTable />
        <DangerActionDialog title="Deactivate User" entity={user.email} confirmation="DEACTIVATE" />
      </div>
    </AdminShell>
  );
}

export function EditUserPage() {
  const { loading, user } = useUser();
  const navigate = useNavigate();
  const updateMutation = useUpdateUserMutation();
  const [role, setRole] = useState('');
  const [linked, setLinked] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setLinked(DEPARTMENT_OPTIONS.some((o) => o.value === user.linked) ? user.linked : defaultDepartmentForRole(user.role));
      setName(user.name ?? '');
    }
  }, [user?.id]);

  const isPrivileged = roleRisk(role) === 'high';
  const handleRoleChange = (nextRole: string) => { setRole(nextRole); setLinked(defaultDepartmentForRole(nextRole)); };

  if (loading) return <AdminShell title="Loading…" eyebrow="Account update"><SkeletonTable cols={3} /></AdminShell>;
  if (!user) return <AdminShell title="Not Found" eyebrow="Account update"><EmptyState title="User not found" description="This user account does not exist." /></AdminShell>;

  const handleSave = () => {
    updateMutation.mutate({ id: user.id, body: { name: name || user.name, phone: phone || undefined, role, linked } }, {
      onSuccess: () => { toast('User updated successfully', 'success'); navigate('/admin/users'); },
      onError: () => toast('Failed to update user. Please try again.', 'error'),
    });
  };

  return (
    <AdminShell title={`Edit ${user.name}`} eyebrow="Account update">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <AdminFormSection title="Identity" subtitle="Name, email, and contact details">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Full Name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
              <Field label="Email Address" type="email" value={user.email} readOnly />
              <Field label="Phone Number" type="tel" value={phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} placeholder="+255 7XX XXX XXX" />
            </div>
          </AdminFormSection>
          <AdminFormSection title="Role & Access" subtitle="Role and linked entity assignment">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Role" options={ROLE_OPTIONS} value={role} onChange={handleRoleChange} />
              <SelectField key={`edit-department-${role}`} label="Linked Entity / Department" options={departmentOptionsForRole(role)} value={linked} onChange={setLinked} />
            </div>
            {isPrivileged && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800"><span className="font-black">{role}</span> is a privileged role. Confirm authorisation before saving.</p>
              </div>
            )}
          </AdminFormSection>
          <Button className="rounded-xl bg-[#4338CA]" disabled={updateMutation.isPending} onClick={handleSave}>
            {updateMutation.isPending ? 'Saving…' : 'Save User'}
          </Button>
        </div>
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Permissions for {role}</p>
          <ul className="mt-4 space-y-2.5">
            {rolePermissions(role).map((perm) => (
              <li key={perm} className="flex items-start gap-2 text-sm font-semibold text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />{perm}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Academic setup hub ───────────────────────────────────────────────────────

export function AcademicSetupHubPage() {
  const { data: apiPathways = [] as typeof classPathways } = useClassPathways() as { data: typeof classPathways };
  const cards: [string, string][] = [
    ['Academic Years',         '/admin/academic/setup'],
    ['Terms',                  '/admin/academic/setup'],
    ['Mixed School Classes',   '/admin/classes'],
    ['Stage Subjects',         '/admin/subjects'],
    ['Class Subjects',         '/admin/academic/setup'],
    ['Grading Scales',         '/admin/grading'],
    ['Assessment Types',       '/admin/assessment-types'],
    ['Stage Configuration',    '/admin/academic/stage-config'],
    ['Cross-Stage Promotion',  '/admin/academic/promotion/cross-stage'],
  ];
  return (
    <AdminShell title="Academic Setup Hub" eyebrow="School academic structure">
      <AdminMetricStrip items={[
        { label: 'Primary', value: 'Class 1-6/7', detail: 'Configurable terminal year', tone: 'green' },
        { label: 'O-Level', value: 'Form 1-4', detail: 'Core secondary track', tone: 'blue' },
        { label: 'A-Level', value: 'Form 5-6', detail: 'Combination-based subjects', tone: 'amber' },
        { label: 'Pathways', value: String(apiPathways.length), detail: 'Promotion and graduation map', tone: 'rose' },
      ]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, to]) => (
          <AdminQuickCard key={title} title={title} detail="Setup active · last updated today." to={to} />
        ))}
      </div>
    </AdminShell>
  );
}

// ─── Classes ──────────────────────────────────────────────────────────────────

/**
 * Normalise a subject-combination's subjects field.
 * Mock data sends a plain string; the real API sends an array of enrollment
 * objects: { id, combinationId, subjectId, isPrincipal, subjectRole,
 *            displayOrder, subject: { id, name, code, shortCode } }
 */
function combSubjectsLabel(subjects: unknown): string {
  if (typeof subjects === 'string') return subjects;
  if (!Array.isArray(subjects)) return '';
  return (subjects as Array<Record<string, unknown>>)
    .map((s) => {
      const sub = s.subject as Record<string, unknown> | undefined;
      return (sub?.name ?? sub?.shortCode ?? s.subjectId ?? '') as string;
    })
    .filter(Boolean)
    .join(', ');
}

/** Same as above but only principal subjects (isPrincipal === true). */
function combPrincipalLabel(subjects: unknown): string {
  if (typeof subjects === 'string') return subjects;
  if (!Array.isArray(subjects)) return '';
  return (subjects as Array<Record<string, unknown>>)
    .filter((s) => s.isPrincipal)
    .map((s) => {
      const sub = s.subject as Record<string, unknown> | undefined;
      return (sub?.name ?? sub?.shortCode ?? s.subjectId ?? '') as string;
    })
    .filter(Boolean)
    .join(', ');
}

type ClassWizardState = {
  educationStage: 'PRIMARY' | 'O_LEVEL' | 'A_LEVEL';
  level: string;
  stream: string;
  academicYearId: string;
  classTeacherId: string;
  capacity: string;
  curriculumCode: string;
};

const STANDARD_STREAM_OPTIONS = [
  { value: 'A', label: 'Stream A' },
  { value: 'B', label: 'Stream B' },
  { value: 'C', label: 'Stream C' },
  { value: 'D', label: 'Stream D' },
];

type UniversalLevelKey =
  | 'NURSERY' | 'PRE_UNIT'
  | 'STANDARD_1' | 'STANDARD_2' | 'STANDARD_3' | 'STANDARD_4' | 'STANDARD_5' | 'STANDARD_6' | 'STANDARD_7'
  | 'FORM_1' | 'FORM_2' | 'FORM_3' | 'FORM_4' | 'FORM_5' | 'FORM_6';

type UniversalProgressionRule = {
  from: UniversalLevelKey;
  to?: UniversalLevelKey;
  transitionType: 'PROMOTION' | 'CROSS_STAGE' | 'GRADUATION';
  label: string;
};

type GeneratedPathway = {
  key: string;
  fromClass: any;
  toClass?: any;
  transitionType: 'PROMOTION' | 'CROSS_STAGE' | 'GRADUATION';
  ruleLabel: string;
  status: 'READY' | 'MISSING_TARGET' | 'GRADUATION';
  note: string;
};

const UNIVERSAL_PROGRESSION_RULES: UniversalProgressionRule[] = [
  { from: 'NURSERY', to: 'PRE_UNIT', transitionType: 'PROMOTION', label: 'Nursery to Pre-Unit' },
  { from: 'PRE_UNIT', to: 'STANDARD_1', transitionType: 'PROMOTION', label: 'Pre-Unit to Standard 1' },
  { from: 'STANDARD_1', to: 'STANDARD_2', transitionType: 'PROMOTION', label: 'Standard 1 to Standard 2' },
  { from: 'STANDARD_2', to: 'STANDARD_3', transitionType: 'PROMOTION', label: 'Standard 2 to Standard 3' },
  { from: 'STANDARD_3', to: 'STANDARD_4', transitionType: 'PROMOTION', label: 'Standard 3 to Standard 4' },
  { from: 'STANDARD_4', to: 'STANDARD_5', transitionType: 'PROMOTION', label: 'Standard 4 to Standard 5' },
  { from: 'STANDARD_5', to: 'STANDARD_6', transitionType: 'PROMOTION', label: 'Standard 5 to Standard 6' },
  { from: 'STANDARD_6', to: 'STANDARD_7', transitionType: 'PROMOTION', label: 'Standard 6 to Standard 7' },
  { from: 'STANDARD_7', to: 'FORM_1', transitionType: 'CROSS_STAGE', label: 'Standard 7 to Form 1' },
  { from: 'FORM_1', to: 'FORM_2', transitionType: 'PROMOTION', label: 'Form 1 to Form 2' },
  { from: 'FORM_2', to: 'FORM_3', transitionType: 'PROMOTION', label: 'Form 2 to Form 3' },
  { from: 'FORM_3', to: 'FORM_4', transitionType: 'PROMOTION', label: 'Form 3 to Form 4' },
  { from: 'FORM_4', to: 'FORM_5', transitionType: 'CROSS_STAGE', label: 'Form 4 to Form 5 A-Level placement' },
  { from: 'FORM_5', to: 'FORM_6', transitionType: 'PROMOTION', label: 'Form 5 to Form 6' },
  { from: 'FORM_6', transitionType: 'GRADUATION', label: 'Form 6 graduation' },
];

function universalLevelKey(cls: any): UniversalLevelKey | null {
  const name = String(cls.name ?? '').toLowerCase();
  const stage = String(cls.educationStage ?? cls.stage ?? '').replace('-', '_').toUpperCase();
  const curriculum = String(cls.curriculumCode ?? cls.curriculum ?? '').toUpperCase();
  const level = Number(cls.level ?? cls.numericLevel);
  if (name.includes('nursery') || curriculum.includes('NURSERY')) return 'NURSERY';
  if (name.includes('pre-unit') || name.includes('pre unit') || curriculum.includes('PRE_PRIMARY')) return 'PRE_UNIT';
  if (stage === 'PRIMARY' && level >= 1 && level <= 7) return `STANDARD_${level}` as UniversalLevelKey;
  if (stage === 'O_LEVEL' && level >= 1 && level <= 4) return `FORM_${level}` as UniversalLevelKey;
  if (stage === 'A_LEVEL' && (level === 5 || level === 6)) return `FORM_${level}` as UniversalLevelKey;
  return null;
}

function classStream(cls: any): string {
  return String(cls.stream ?? '').trim().toUpperCase();
}

function classSortValue(cls: any): number {
  const rawSortOrder = cls.sortOrder;
  const sortOrder = rawSortOrder === null || rawSortOrder === undefined || rawSortOrder === '' ? Number.NaN : Number(rawSortOrder);
  const level = Number(cls.level ?? cls.numericLevel ?? 0);
  return Number.isFinite(sortOrder) ? sortOrder : 999 + (Number.isFinite(level) ? level : 0);
}

function findTargetClass(classes: any[], source: any, targetKey: UniversalLevelKey | undefined): any | undefined {
  if (!targetKey) return undefined;
  const candidates = classes
    .filter((cls) => universalLevelKey(cls) === targetKey)
    .sort((a, b) => classSortValue(a) - classSortValue(b) || String(a.name).localeCompare(String(b.name)));
  if (!candidates.length) return undefined;
  const sameStream = candidates.find((cls) => classStream(cls) && classStream(cls) === classStream(source));
  if (sameStream) return sameStream;
  const streamA = candidates.find((cls) => classStream(cls) === 'A');
  return streamA ?? candidates[0];
}

function generateUniversalPathways(classes: any[], academicYearId: string): GeneratedPathway[] {
  const yearClasses = classes.filter((cls) => String(cls.academicYearId ?? '') === academicYearId || !cls.academicYearId);
  return UNIVERSAL_PROGRESSION_RULES.flatMap((rule) => {
    const sources = yearClasses
      .filter((cls) => universalLevelKey(cls) === rule.from)
      .sort((a, b) => classSortValue(a) - classSortValue(b) || classStream(a).localeCompare(classStream(b)));
    return sources.map((fromClass) => {
      const toClass = findTargetClass(yearClasses, fromClass, rule.to);
      const status = rule.transitionType === 'GRADUATION' ? 'GRADUATION' : toClass ? 'READY' : 'MISSING_TARGET';
      return {
        key: `${fromClass.id}-${rule.from}-${rule.to ?? 'END'}`,
        fromClass,
        toClass,
        transitionType: rule.transitionType,
        ruleLabel: rule.label,
        status,
        note: `Universal progression: ${rule.label}`,
      };
    });
  });
}

const STAGE_LEVEL_OPTIONS = {
  PRIMARY: Array.from({ length: 7 }, (_, i) => ({ value: String(i + 1), label: `Class ${i + 1}` })),
  O_LEVEL: Array.from({ length: 4 }, (_, i) => ({ value: String(i + 1), label: `Form ${i + 1}` })),
  A_LEVEL: [
    { value: '5', label: 'Form 5' },
    { value: '6', label: 'Form 6' },
  ],
};

function curriculumForStage(stage: ClassWizardState['educationStage']) {
  if (stage === 'PRIMARY') return 'NECTA_PRIMARY';
  if (stage === 'A_LEVEL') return 'NECTA_ALEVEL';
  return 'NECTA_OLEVEL';
}

function displayNameForClass(stage: ClassWizardState['educationStage'], level: string, stream: string) {
  if (stage === 'PRIMARY') return `Class ${level}${stream}`;
  if (stage === 'A_LEVEL') return `Form ${level} ${stream}`;
  return `Form ${level}${stream}`;
}

function isTerminalClass(stage: ClassWizardState['educationStage'], level: string) {
  return (stage === 'PRIMARY' && level === '7') || (stage === 'O_LEVEL' && level === '4') || (stage === 'A_LEVEL' && level === '6');
}

export function ClassesPage() {
  const { data: apiClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };
  const { data: apiPathways = [] as typeof classPathways } = useClassPathways() as { data: typeof classPathways };
  const { data: apiCombinations = [] as typeof subjectCombinations } = useSubjectCombinations() as { data: typeof subjectCombinations };
  const { data: apiSubjects = [] as typeof adminSubjects } = useAdminSubjects() as { data: typeof adminSubjects };
  const { data: apiUsers = [] as typeof adminUsers } = useAdminUsers() as { data: typeof adminUsers };
  const { data: academicYears = [] } = useAcademicYears();
  const createClassMutation = useCreateClassMutation();
  const createClassPathwayMutation = useCreateClassPathwayMutation();
  const createCombinationMutation = useCreateCombinationMutation();
  const deleteCombinationMutation = useDeleteCombinationMutation();
  const [editingPathwayId, setEditingPathwayId] = useState<string | null>(null);
  const [pathwayEdits, setPathwayEdits] = useState<Record<string, { toClassId: string; transitionType: string; note: string }>>({});

  // ── Streams (O-Level / Primary): frontend-only custom labels ──────────────
  const [customStreams, setCustomStreams] = useState<string[]>([]);
  const [newStreamInput, setNewStreamInput] = useState('');

  const addCustomStream = () => {
    const val = newStreamInput.trim().toUpperCase();
    if (!val) return;
    if ([...STANDARD_STREAM_OPTIONS.map((o) => o.value), ...customStreams].includes(val)) {
      toast(`Stream "${val}" already exists.`, 'warning');
      return;
    }
    setCustomStreams((prev) => [...prev, val]);
    setNewStreamInput('');
  };

  // ── A-Level combinations form ─────────────────────────────────────────────
  const [comboCode, setComboCode] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [principalIds, setPrincipalIds] = useState<string[]>([]);
  const [subjectSearch, setSubjectSearch] = useState('');

  const uniqueSubjects = Array.from(
    new Map((apiSubjects as any[]).map((subject: any) => [String(subject.id), subject])).values(),
  );
  const aLevelSubjects = uniqueSubjects.filter((subject: any) => {
    const stage = String(subject.stage ?? subject.educationStage ?? '').replace('-', '_').toUpperCase();
    return stage === 'A_LEVEL';
  });
  const isCompulsorySubsidiarySubject = (subject: any) => {
    const name = String(subject?.name ?? '').toLowerCase();
    const code = String(subject?.code ?? '').toLowerCase();
    return name.includes('general studies') || name.includes('general paper') || ['gs', 'gp'].includes(code);
  };
  const compulsorySubsidiary = aLevelSubjects.find(isCompulsorySubsidiarySubject);

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) => {
      if (prev.includes(id)) {
        setPrincipalIds((p) => p.filter((x) => x !== id));
        return prev.filter((x) => x !== id);
      }
      const subject = aLevelSubjects.find((s: any) => String(s.id) === id);
      if (subject && !isCompulsorySubsidiarySubject(subject)) {
        setPrincipalIds((p) => Array.from(new Set([...p, id])));
      }
      return [...prev, id];
    });
  };
  const togglePrincipal = (id: string) =>
    setPrincipalIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectedSubjects = aLevelSubjects.filter((s: any) => selectedSubjectIds.includes(String(s.id)));
  const visibleSelectedSubjects = selectedSubjects.filter((s: any) => !isCompulsorySubsidiarySubject(s));
  const autoComboName = visibleSelectedSubjects.map((s: any) => s.name).join(', ');

  const submitCombination = () => {
    const code = comboCode.trim().toUpperCase();
    const academicYearId = classForm.academicYearId || String(currentYear?.id ?? '');
    if (!code) { toast('Combination code is required (e.g. PCM)', 'warning'); return; }
    if (!visibleSelectedSubjects.length) { toast('Select at least one A-Level principal subject for this combination.', 'warning'); return; }
    if (!academicYearId) { toast('Select an Academic Year in the Class Wizard above first.', 'warning'); return; }
    const duplicate = apiCombinations.some((combo: any) =>
      String(combo.code ?? '').toUpperCase() === code &&
      String(combo.academicYearId ?? '') === academicYearId,
    );
    if (duplicate) {
      toast(`Combination ${code} already exists for this academic year.`, 'warning');
      return;
    }
    const payloadSubjectIds = Array.from(new Set([
      ...selectedSubjectIds,
      ...(compulsorySubsidiary ? [String(compulsorySubsidiary.id)] : []),
    ]));
    const subjects = payloadSubjectIds.map((sid, i) => ({
      subjectId: sid,
      subjectRole: compulsorySubsidiary && sid === String(compulsorySubsidiary.id)
        ? 'COMPULSORY_SUBSIDIARY'
        : principalIds.includes(sid) ? 'PRINCIPAL' : 'SUBSIDIARY',
      displayOrder: i + 1,
    }));
    const principalCount = subjects.filter((subject) => subject.subjectRole === 'PRINCIPAL').length;
    if (principalCount < 2) {
      toast('Mark at least two A-Level subjects as Principal (P).', 'warning');
      return;
    }
    if (!subjects.some((subject) => subject.subjectRole === 'COMPULSORY_SUBSIDIARY')) {
      toast('Add General Studies as an A-Level subject first; it is required as the compulsory subsidiary.', 'warning');
      return;
    }
    createCombinationMutation.mutate(
      { code, name: autoComboName || code, educationStage: 'A_LEVEL', academicYearId, subjects },
      {
        onSuccess: () => {
          toast(`Combination ${code} created successfully.`, 'success');
          setComboCode('');
          setSelectedSubjectIds([]);
          setPrincipalIds([]);
          setSubjectSearch('');
        },
        onError: (err: unknown) => {
          const message = err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: unknown }).message)
            : err instanceof Error
              ? err.message
              : 'Failed to create combination';
          toast(message, 'error');
        },
      },
    );
  };

  const teacherOptions = apiUsers
    .filter((user) => ['TEACHER', 'HEAD_OF_DEPARTMENT', 'HOD'].includes(String(user.role)))
    .map((user) => ({ value: user.id, label: `${user.name} - ${user.linked || user.role}` }));
  const currentYear = (academicYears as any[]).find((year) => year.isCurrent) ?? (academicYears as any[])[0];
  const yearOptions = (academicYears as any[]).map((year) => ({ value: String(year.id), label: String(year.name ?? year.year ?? year.id) }));
  const combinationOptions = apiCombinations.map((combo: any) => ({
    value: String(combo.code ?? combo.name ?? combo.id),
    label: `${String(combo.code ?? combo.name ?? combo.id)} - ${String(combo.name ?? combSubjectsLabel(combo.subjects) ?? 'A-Level combination')}`,
  }));
  const [classForm, setClassForm] = useState<ClassWizardState>({
    educationStage: 'O_LEVEL',
    level: '4',
    stream: 'A',
    academicYearId: String(currentYear?.id ?? ''),
    classTeacherId: teacherOptions[0]?.value ?? '',
    capacity: '40',
    curriculumCode: 'NECTA_OLEVEL',
  });
  const activeAcademicYearId = classForm.academicYearId || String(currentYear?.id ?? '');
  const universalPathways = activeAcademicYearId
    ? generateUniversalPathways(apiClasses as any[], activeAcademicYearId)
    : [];
  const readyUniversalPathways = universalPathways.filter((item) => item.status === 'READY' || item.status === 'GRADUATION');
  const missingUniversalPathways = universalPathways.filter((item) => item.status === 'MISSING_TARGET');
  const allStreamOptions = [
    ...STANDARD_STREAM_OPTIONS,
    ...customStreams.map((s) => ({ value: s, label: `Stream ${s}` })),
  ];
  const streamOptions = classForm.educationStage === 'A_LEVEL'
    ? (combinationOptions.length ? combinationOptions : [{ value: '', label: 'No combinations yet — add one below' }])
    : allStreamOptions;
  const classOptions = apiClasses
    .slice()
    .sort((a: any, b: any) => classSortValue(a) - classSortValue(b) || String(a.name).localeCompare(String(b.name)))
    .map((item: any) => ({
      value: String(item.id),
      label: `${String(item.name)}${String(item.stream ?? '').trim() ? ` - ${String(item.stream).trim()}` : ''}`,
    }));
  const transitionOptions = [
    { value: 'PROMOTION', label: 'Promotion' },
    { value: 'CROSS_STAGE', label: 'Cross-stage' },
    { value: 'GRADUATION', label: 'Graduation' },
  ];
  const className = displayNameForClass(classForm.educationStage, classForm.level, classForm.stream);
  const terminalYear = isTerminalClass(classForm.educationStage, classForm.level);

  useEffect(() => {
    setClassForm((current) => ({
      ...current,
      academicYearId: current.academicYearId || String(currentYear?.id ?? ''),
      classTeacherId: current.classTeacherId || teacherOptions[0]?.value || '',
    }));
  }, [currentYear?.id, teacherOptions[0]?.value]);

  const setClassValue = (key: keyof ClassWizardState) => (value: string) => {
    setClassForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'educationStage') {
        const stage = value as ClassWizardState['educationStage'];
        next.level = stage === 'A_LEVEL' ? '5' : '1';
        next.stream = stage === 'A_LEVEL' && combinationOptions[0]?.value ? combinationOptions[0].value : 'A';
        next.curriculumCode = curriculumForStage(stage);
      }
      return next;
    });
  };

  const setClassField = (key: keyof ClassWizardState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setClassForm((current) => ({ ...current, [key]: event.target.value }));

  const submitClass = () => {
    const academicYearId = classForm.academicYearId || String(currentYear?.id ?? '');
    const classTeacherId = classForm.classTeacherId || teacherOptions[0]?.value;
    if (!academicYearId) {
      toast('Create or select an academic year before creating a class.', 'warning');
      return;
    }
    if (!classTeacherId) {
      toast('Create or select a teacher before creating a class.', 'warning');
      return;
    }
    const duplicate = apiClasses.some((item: any) =>
      String(item.stage ?? item.educationStage) === classForm.educationStage &&
      String(item.level ?? item.numericLevel) === classForm.level &&
      String(item.stream ?? '') === classForm.stream &&
      String(item.year ?? item.academicYearId ?? '') === academicYearId,
    );
    if (duplicate) {
      toast('A class with this stage, level, stream, and year already exists.', 'warning');
      return;
    }
    createClassMutation.mutate({
      name: className,
      level: Number(classForm.level),
      stream: classForm.stream,
      educationStage: classForm.educationStage,
      curriculumCode: classForm.curriculumCode,
      terminalYear,
      academicYearId,
      classTeacherId,
      capacity: Number(classForm.capacity || 40),
    }, {
      onSuccess: () => toast(`${className} created successfully.`, 'success'),
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to create class', 'error'),
    });
  };

  const applyUniversalPathways = async () => {
    if (!activeAcademicYearId) {
      toast('Select an academic year before applying universal pathways.', 'warning');
      return;
    }
    if (!readyUniversalPathways.length) {
      toast('No valid universal pathway mappings were found for the selected year.', 'warning');
      return;
    }
    try {
      for (const item of readyUniversalPathways) {
        await createClassPathwayMutation.mutateAsync({
          fromClassId: item.fromClass.id,
          toClassId: item.transitionType === 'GRADUATION' ? null : item.toClass?.id,
          academicYearId: activeAcademicYearId,
          transitionType: item.transitionType,
          note: item.note,
        });
      }
      toast(`Applied ${readyUniversalPathways.length} universal pathway mapping${readyUniversalPathways.length !== 1 ? 's' : ''}.`, 'success');
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : error instanceof Error ? error.message : 'Failed to apply universal pathways';
      toast(message, 'error');
    }
  };

  const startPathwayEdit = (pathway: any) => {
    const id = String(pathway.id);
    setEditingPathwayId(id);
    setPathwayEdits((current) => ({
      ...current,
      [id]: {
        toClassId: String(pathway.toClassId ?? ''),
        transitionType: String(pathway.transitionType ?? pathway.type ?? 'PROMOTION').toUpperCase().replaceAll(' ', '_'),
        note: String(pathway.note ?? pathway.rule ?? ''),
      },
    }));
  };

  const updatePathwayEdit = (pathwayId: string, key: 'toClassId' | 'transitionType' | 'note', value: string) => {
    setPathwayEdits((current) => ({
      ...current,
      [pathwayId]: {
        toClassId: current[pathwayId]?.toClassId ?? '',
        transitionType: current[pathwayId]?.transitionType ?? 'PROMOTION',
        note: current[pathwayId]?.note ?? '',
        [key]: value,
      },
    }));
  };

  const savePathwayEdit = async (pathway: any) => {
    const id = String(pathway.id);
    const edit = pathwayEdits[id];
    const fromClassId = String(pathway.fromClassId ?? '');
    const academicYearId = String(pathway.academicYearId ?? activeAcademicYearId);
    if (!fromClassId || !academicYearId || !edit) {
      toast('This pathway is missing required class details.', 'error');
      return;
    }
    if (edit.transitionType !== 'GRADUATION' && !edit.toClassId) {
      toast('Select the target class, or set the transition type to Graduation.', 'warning');
      return;
    }
    try {
      await createClassPathwayMutation.mutateAsync({
        fromClassId,
        toClassId: edit.transitionType === 'GRADUATION' ? null : edit.toClassId,
        academicYearId,
        transitionType: edit.transitionType,
        note: edit.note || 'Manual pathway update',
      });
      toast('Pathway updated.', 'success');
      setEditingPathwayId(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to update pathway', 'error');
    }
  };

  const byStage = apiClasses.reduce<Record<string, number>>((acc, item) => {
    acc[item.stage] = (acc[item.stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <AdminShell title="Class Management" eyebrow="Classes, rosters, assigned subjects">
      <AdminMetricStrip items={[
        { label: 'Primary Classes', value: String(byStage.Primary ?? 0), detail: 'Class 1 to terminal primary', tone: 'green' },
        { label: 'O-Level Classes', value: String(byStage['O-Level'] ?? 0), detail: 'Form 1 to Form 4', tone: 'blue' },
        { label: 'A-Level Streams', value: String(byStage['A-Level'] ?? 0), detail: 'Form 5/6 combinations', tone: 'amber' },
        { label: 'Terminal Classes', value: String(apiClasses.filter((item) => item.terminal).length), detail: 'Cross-stage or graduation', tone: 'rose' },
      ]} />
      <AdminFormSection
        title="Class Setup Wizard"
        subtitle="Create Primary, O-Level and A-Level classes for the selected academic year."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectField key={`stage-${classForm.educationStage}`} label="Education Stage" value={classForm.educationStage} onChange={setClassValue('educationStage')} options={[
            { value: 'PRIMARY', label: 'Primary' },
            { value: 'O_LEVEL', label: 'O-Level' },
            { value: 'A_LEVEL', label: 'A-Level' },
          ]} />
          <SelectField key={`level-${classForm.educationStage}-${classForm.level}`} label="Class/Form Level" value={classForm.level} onChange={setClassValue('level')} options={STAGE_LEVEL_OPTIONS[classForm.educationStage]} />
          <Field label="Display Name" value={className} readOnly />
          <SelectField key={`stream-${classForm.educationStage}-${classForm.stream}`} label="Stream or Combination" value={classForm.stream} onChange={setClassValue('stream')} options={streamOptions} />
          <SelectField key={`class-year-${classForm.academicYearId}`} label="Academic Year" value={classForm.academicYearId || String(currentYear?.id ?? '')} onChange={setClassValue('academicYearId')} options={yearOptions} />
          <SelectField key={`class-teacher-${classForm.classTeacherId}`} label="Class Teacher" value={classForm.classTeacherId || teacherOptions[0]?.value} onChange={setClassValue('classTeacherId')} options={teacherOptions.length ? teacherOptions : [{ value: '', label: 'Create a teacher first' }]} />
          <Field label="Capacity" value={classForm.capacity} onChange={setClassField('capacity')} type="number" />
          <SelectField key={`curriculum-${classForm.curriculumCode}`} label="Curriculum Code" value={classForm.curriculumCode} onChange={setClassValue('curriculumCode')} options={[
            { value: 'NECTA_PRIMARY', label: 'NECTA Primary' },
            { value: 'NECTA_OLEVEL', label: 'NECTA O-Level' },
            { value: 'NECTA_ALEVEL', label: 'NECTA A-Level' },
            { value: 'NURSERY', label: 'Nursery / Kindergarten' },
          ]} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FeatureToggle label="Terminal year" description="Required for Form 4, Form 6 and final primary year." enabled={terminalYear} />
          <FeatureToggle label="Validate stage range" description="Blocks Class/Form level collisions before submit." enabled />
          <FeatureToggle label="Use universal pathways" description="Classes follow the progression trend defined below." enabled />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button className="rounded-xl bg-[#4338CA]" loading={createClassMutation.isPending} onClick={submitClass}>
            Create Class
          </Button>
          <button
            type="button"
            className="text-sm font-black text-[#4338CA] hover:underline"
            onClick={() => document.getElementById('manage-streams-combinations')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            Manage streams &amp; combinations ↓
          </button>
        </div>
      </AdminFormSection>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <AdminDataTable columns={['Class', 'Stage', 'Level', 'Stream', 'Students', 'Class Teacher', 'Next Pathway', 'Actions']}>
          {apiClasses.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <Td>
                <p className="font-black text-slate-900">{item.name}</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{item.curriculum}</p>
              </Td>
              <Td><Badge tone={item.stage === 'Primary' ? 'emerald' : item.stage === 'A-Level' ? 'amber' : 'blue'}>{item.stage}</Badge></Td>
              <Td>{item.level}</Td>
              <Td>{item.stream}</Td>
              <Td>{item.students}</Td>
              <Td>{item.teacher}</Td>
              <Td>{item.pathway}</Td>
              <Td>
                <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/classes/${item.id}`}>Open</NavLink>
              </Td>
            </tr>
          ))}
        </AdminDataTable>
        <div className="space-y-4" id="manage-streams-combinations">
          {/* ── Promotion Pathways ─────────────────────────────────── */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Universal Promotion Pathways</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Define the school trend once. Applying this writes real backend pathway records used by bulk promotion.
            </p>
            <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-700">General trend</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-black text-indigo-700">
                {UNIVERSAL_PROGRESSION_RULES.map((rule) => (
                  <span key={rule.label} className="rounded-lg bg-white px-2 py-1 shadow-sm">{rule.label}</span>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detected</p>
                <p className="font-display text-2xl font-black text-slate-950">{universalPathways.length}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Ready</p>
                <p className="font-display text-2xl font-black text-emerald-700">{readyUniversalPathways.length}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Missing</p>
                <p className="font-display text-2xl font-black text-amber-700">{missingUniversalPathways.length}</p>
              </div>
            </div>
            <Button
              className="mt-4 w-full rounded-xl bg-[#4338CA]"
              loading={createClassPathwayMutation.isPending}
              onClick={applyUniversalPathways}
              disabled={!readyUniversalPathways.length}
            >
              Apply Universal Pathways
            </Button>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {universalPathways.map((pathway) => (
                <div key={pathway.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-slate-900">{pathway.fromClass.name}</p>
                    <Badge tone={pathway.status === 'MISSING_TARGET' ? 'amber' : pathway.transitionType === 'GRADUATION' ? 'emerald' : 'blue'}>
                      {pathway.transitionType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {pathway.transitionType === 'GRADUATION'
                      ? 'Graduation / completion'
                      : pathway.toClass
                        ? `To ${pathway.toClass.name}${classStream(pathway.toClass) ? ` ${classStream(pathway.toClass)}` : ''}`
                        : 'Create the target class first'}
                  </p>
                </div>
              ))}
              {!universalPathways.length && (
                <p className="rounded-2xl border border-dashed border-slate-200 p-3 text-xs font-semibold text-slate-400">
                  No matching classes found for the selected academic year.
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Saved Pathways</p>
            </div>
            <div className="mt-3 space-y-3">
              {apiPathways.map((pathway: any) => {
                const isEditing = editingPathwayId === String(pathway.id);
                const edit = pathwayEdits[String(pathway.id)] ?? {
                  toClassId: String(pathway.toClassId ?? ''),
                  transitionType: String(pathway.transitionType ?? pathway.type ?? 'PROMOTION').toUpperCase().replaceAll(' ', '_'),
                  note: String(pathway.note ?? pathway.rule ?? ''),
                };
                return (
                <div key={pathway.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  {!isEditing ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-900">{pathway.from} {'→'} {pathway.to}</p>
                        <Badge tone={pathway.type === 'Graduation' ? 'emerald' : 'blue'}>{pathway.type}</Badge>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{pathway.rule}</p>
                      <Button variant="secondary" className="mt-3 rounded-xl py-2 text-xs" onClick={() => startPathwayEdit(pathway)}>
                        Edit Pathway
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <p className="font-black text-slate-900">{pathway.from}</p>
                      <SelectField
                        key={`pathway-type-${pathway.id}-${edit.transitionType}`}
                        label="Transition Type"
                        value={edit.transitionType}
                        onChange={(value) => updatePathwayEdit(String(pathway.id), 'transitionType', value)}
                        options={transitionOptions}
                      />
                      {edit.transitionType !== 'GRADUATION' && (
                        <SelectField
                          key={`pathway-target-${pathway.id}-${edit.toClassId}`}
                          label="To Class"
                          value={edit.toClassId}
                          onChange={(value) => updatePathwayEdit(String(pathway.id), 'toClassId', value)}
                          options={[{ value: '', label: 'Select target class' }, ...classOptions]}
                        />
                      )}
                      <Field
                        label="Note"
                        value={edit.note}
                        onChange={(event) => updatePathwayEdit(String(pathway.id), 'note', event.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          className="rounded-xl bg-[#4338CA] py-2 text-xs"
                          loading={createClassPathwayMutation.isPending}
                          onClick={() => savePathwayEdit(pathway)}
                        >
                          Save
                        </Button>
                        <Button variant="secondary" className="rounded-xl py-2 text-xs" onClick={() => setEditingPathwayId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* ── Streams (O-Level / Primary) ────────────────────────── */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Streams · O-Level &amp; Primary</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Standard streams A–D are always available. Add extras here (e.g. E, STEM).</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STANDARD_STREAM_OPTIONS.map((o) => (
                <span key={o.value} className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-500">
                  {o.label}
                </span>
              ))}
              {customStreams.map((s) => (
                <span key={s} className="flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">
                  Stream {s}
                  <button
                    type="button"
                    onClick={() => setCustomStreams((prev) => prev.filter((x) => x !== s))}
                    className="ml-0.5 rounded p-0.5 hover:bg-indigo-100"
                    title={`Remove Stream ${s}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                value={newStreamInput}
                onChange={(e) => setNewStreamInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && addCustomStream()}
                placeholder="E.g. E or STEM"
                maxLength={8}
                className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-black text-sm uppercase outline-none transition focus:border-[#4338CA] focus:bg-white"
              />
              <Button className="rounded-xl bg-[#4338CA] px-4" onClick={addCustomStream}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {/* ── A-Level Combinations ───────────────────────────────── */}
          <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">A-Level Combinations</p>
            <p className="mt-1 text-xs font-semibold text-amber-700/70">Combinations appear in the Stream dropdown when A-Level is selected.</p>
            <div className="mt-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
              {/* Code */}
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Combination Code</span>
                <input
                  value={comboCode}
                  onChange={(e) => setComboCode(e.target.value.toUpperCase())}
                  placeholder="e.g. PCM"
                  maxLength={10}
                  className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-black uppercase text-sm outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </div>

              {/* Subject picker */}
              <div>
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Select Subjects</span>
                {aLevelSubjects.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-dashed border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                    No A-Level subjects found.{' '}
                    <NavLink to="/admin/subjects" className="font-black underline">Add subjects first →</NavLink>
                  </div>
                ) : (
                  <>
                    <input
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      placeholder="Filter subjects…"
                      className="mt-2 h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                    />
                    <div className="mt-2 max-h-44 overflow-y-auto space-y-1 rounded-xl border border-slate-100 p-2">
                      {aLevelSubjects
                        .filter((s: any) => !subjectSearch || s.name.toLowerCase().includes(subjectSearch.toLowerCase()))
                        .map((s: any) => {
                          const sid = String(s.id);
                          const checked = selectedSubjectIds.includes(sid);
                          const isPrincipal = principalIds.includes(sid);
                          const isCompulsory = isCompulsorySubsidiarySubject(s);
                          return (
                            <div key={sid} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs transition ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                              <input
                                type="checkbox"
                                checked={checked || isCompulsory}
                                onChange={() => toggleSubject(sid)}
                                disabled={isCompulsory}
                                className="h-3.5 w-3.5 cursor-pointer accent-[#4338CA]"
                              />
                              <span className="flex-1 font-semibold text-slate-800">{s.name}</span>
                              <Badge tone="amber">A-LEVEL</Badge>
                              {isCompulsory && <Badge tone="emerald">Required</Badge>}
                              {checked && !isCompulsory && (
                                <button
                                  type="button"
                                  onClick={() => togglePrincipal(sid)}
                                  title={isPrincipal ? 'Mark as Subsidiary' : 'Mark as Principal'}
                                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-black transition ${isPrincipal ? 'bg-[#4338CA] text-white' : 'bg-slate-200 text-slate-500 hover:bg-indigo-100'}`}
                                >
                                  {isPrincipal ? 'P' : 'S'}
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </>
                )}
              </div>

              {/* Preview */}
              {selectedSubjects.length > 0 && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                  <p className="font-black text-slate-500 uppercase tracking-widest mb-1">Preview</p>
                  <p className="font-semibold text-slate-700">{comboCode || '???'} — {autoComboName}</p>
                  {principalIds.length > 0 && (
                    <p className="mt-0.5 text-amber-700 font-semibold">
                      Principal: {selectedSubjects.filter((s: any) => principalIds.includes(String(s.id))).map((s: any) => s.name).join(', ')}
                    </p>
                  )}
                  {compulsorySubsidiary && (
                    <p className="mt-0.5 font-semibold text-emerald-700">
                      Compulsory subsidiary: {compulsorySubsidiary.name}
                    </p>
                  )}
                </div>
              )}

              <Button
                className="w-full rounded-xl bg-[#4338CA]"
                loading={createCombinationMutation.isPending}
                onClick={submitCombination}
              >
                <Plus className="h-4 w-4" /> Add Combination
              </Button>
            </div>

            {/* Existing combinations list */}
            <div className="mt-4 space-y-2">
              {apiCombinations.length === 0 && (
                <p className="text-xs font-semibold italic text-amber-700/60">No combinations yet. Add one above.</p>
              )}
              {apiCombinations.map((combo: any) => (
                <div key={combo.id} className="flex items-start justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900">
                      {combo.code}
                      <span className="ml-2 text-xs font-semibold text-slate-400">({String(combo.students ?? 0)} students)</span>
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{combSubjectsLabel(combo.subjects) || combo.name}</p>
                    <p className="mt-0.5 text-[11px] font-bold text-amber-700">
                      Principal: {typeof combo.principal === 'string' ? combo.principal : combPrincipalLabel(combo.subjects)}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Delete combination"
                    disabled={deleteCombinationMutation.isPending}
                    onClick={() => deleteCombinationMutation.mutate(combo.id, {
                      onSuccess: () => toast(`Combination ${combo.code} deleted.`, 'success'),
                      onError: (err) => toast(err instanceof Error ? err.message : 'Delete failed', 'error'),
                    })}
                    className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

export function ClassDetailPage() {
  const { classId } = useParams();
  const { data: apiClasses = [] as typeof adminClasses, isLoading } = useAdminClasses() as { data: typeof adminClasses; isLoading: boolean };
  if (isLoading) return <AdminShell title="Loading…" eyebrow="Class detail"><SkeletonTable cols={4} /></AdminShell>;
  const klass = apiClasses.find((c) => c.id === classId) ?? null;
  if (!klass) return <AdminShell title="Not Found" eyebrow="Class detail"><EmptyState title="Class not found" description="This class does not exist." /></AdminShell>;
  return (
    <AdminShell title={klass.name} eyebrow="Class detail">
      <StudentsTable />
      <AdminQuickCard title="Assign Subjects" detail="Class-subject assignment matrix." to="/admin/academic/setup" />
    </AdminShell>
  );
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export function SubjectsPage() {
  const createSubjectMutation = useCreateSubjectMutation();
  const [form, setForm] = useState({ name: '', code: '', stage: 'O_LEVEL', department: '' });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === 'code' ? e.target.value.toUpperCase() : e.target.value }));

  const submit = () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast('Subject name and code are required.', 'warning');
      return;
    }
    createSubjectMutation.mutate(form, {
      onSuccess: () => {
        toast(`Subject "${form.name}" created successfully.`, 'success');
        setForm({ name: '', code: '', stage: 'O_LEVEL', department: '' });
      },
      onError: (err) => toast(err instanceof Error ? err.message : 'Failed to create subject', 'error'),
    });
  };

  return (
    <AdminShell title="Subject Management" eyebrow="Subjects, departments, assignments">
      <AdminFormSection
        title="Add Subject"
        subtitle="Subjects can be assigned to classes and selected into A-Level combinations."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Subject Name" value={form.name} onChange={set('name')} placeholder="e.g. Physics" />
          <Field label="Subject Code" value={form.code} onChange={set('code')} placeholder="e.g. PHY" />
          <SelectField
            label="Education Stage"
            value={form.stage}
            onChange={(v) => setForm((f) => ({ ...f, stage: v }))}
            options={[
              { value: 'PRIMARY', label: 'Primary' },
              { value: 'O_LEVEL', label: 'O-Level' },
              { value: 'A_LEVEL', label: 'A-Level' },
            ]}
          />
          <Field label="Department" value={form.department} onChange={set('department')} placeholder="e.g. Sciences" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button className="rounded-xl bg-[#4338CA]" loading={createSubjectMutation.isPending} onClick={submit}>
            <Plus className="h-4 w-4" /> Add Subject
          </Button>
          <NavLink className="text-sm font-black text-[#4338CA] hover:underline" to="/admin/classes">
            ← Back to Classes &amp; Combinations
          </NavLink>
        </div>
      </AdminFormSection>
      <SubjectsTable />
    </AdminShell>
  );
}

function SubjectsTable() {
  const { data: apiSubjects = [] as typeof adminSubjects, isLoading, isError, refetch } = useAdminSubjects() as { data: typeof adminSubjects; isLoading: boolean; isError: boolean; refetch: () => void };
  if (isLoading) return <SkeletonTable cols={8} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (!apiSubjects.length) return <EmptyState title="No subjects configured" description="Add subjects through the academic setup wizard." />;
  return (
    <AdminDataTable columns={['Subject', 'Code', 'Stage', 'Department', 'Status', 'Classes', 'Teachers', 'Actions']}>
      {apiSubjects.map((item) => (
        <tr key={item.id} className="hover:bg-slate-50">
          <Td><p className="font-black text-slate-900">{item.name}</p></Td>
          <Td className="font-mono text-xs text-slate-500">{item.code}</Td>
          <Td><Badge tone={item.stage === 'Primary' ? 'emerald' : item.stage === 'A-Level' ? 'amber' : 'blue'}>{item.stage}</Badge></Td>
          <Td>{item.department}</Td>
          <Td><Badge tone="emerald">{item.status}</Badge></Td>
          <Td>{item.classes}</Td>
          <Td>{item.teachers}</Td>
          <Td>
            <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/subjects/${item.id}`}>Open</NavLink>
          </Td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

export function SubjectDetailPage() {
  const { subjectId } = useParams();
  const { data: apiSubjects = [] as typeof adminSubjects, isLoading } = useAdminSubjects() as { data: typeof adminSubjects; isLoading: boolean };
  if (isLoading) return <AdminShell title="Loading…" eyebrow="Subject detail"><SkeletonTable cols={3} /></AdminShell>;
  const subject = apiSubjects.find((s) => s.id === subjectId) ?? null;
  if (!subject) return <AdminShell title="Not Found" eyebrow="Subject detail"><EmptyState title="Subject not found" description="This subject does not exist." /></AdminShell>;
  return (
    <AdminShell title={subject.name} eyebrow="Subject detail">
      <div className="grid gap-gutter xl:grid-cols-3">
        <AdminQuickCard title="Assigned Classes" detail={`${subject.classes} classes assigned.`} to="/admin/academic/setup" />
        <AdminQuickCard title="Teachers" detail={`${subject.teachers} teachers assigned.`} to="/admin/users" />
        <AdminQuickCard title="Analytics" detail="Open subject analytics." to={`/analytics/academic/subjects/${subject.id}`} />
      </div>
    </AdminShell>
  );
}

// ─── Grading scales ───────────────────────────────────────────────────────────

export function GradingPage() {
  const { data: apiGradingScales = [] as typeof gradingScales } = useGradingScales() as { data: typeof gradingScales };
  const createGradingScaleMutation = useCreateGradingScaleMutation();
  const activateGradingScaleMutation = useActivateGradingScaleMutation();
  const { data: academicYears = [] } = useAcademicYears();
  const currentYear = (academicYears as any[]).find((year) => year.isCurrent) ?? (academicYears as any[])[0];
  const saveScale = (scale: any) => (payload: { name: string; boundaries: Array<{ label: string; min: number; max: number; points: number; remark: string; isPassing: boolean }> }) => {
    const academicYearId = String(scale.academicYearId ?? currentYear?.id ?? '');
    if (!academicYearId) {
      toast('Create or select an academic year before saving a grading scale.', 'warning');
      return;
    }
    createGradingScaleMutation.mutate({
      name: payload.name,
      academicYearId,
      educationStage: scale.educationStage || undefined,
      classLevel: scale.classLevel ? Number(scale.classLevel) : undefined,
      subjectId: scale.subjectId || undefined,
      grades: payload.boundaries.map((boundary) => ({
        grade: boundary.label,
        minScore: boundary.min,
        maxScore: boundary.max,
        points: boundary.points,
        remark: boundary.remark,
        isPassing: boundary.isPassing,
      })),
    }, {
      onSuccess: () => toast('Grading scale saved.', 'success'),
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to save grading scale', 'error'),
    });
  };
  const activateScale = (id: string) => {
    activateGradingScaleMutation.mutate(id, {
      onSuccess: () => toast('Grading scale activated.', 'success'),
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to activate grading scale', 'error'),
    });
  };
  return (
    <AdminShell title="Grading Scales" eyebrow="Grade boundaries and activation">
      {apiGradingScales.map((scale) => (
        <div key={scale.id} className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{scale.scope}</p>
            <Badge tone={scale.active ? 'emerald' : 'amber'}>{scale.active ? 'Active' : 'Draft'}</Badge>
          </div>
          <GradingBoundaryEditor
            scale={scale}
            loading={createGradingScaleMutation.isPending || activateGradingScaleMutation.isPending}
            onSave={saveScale(scale)}
            onActivate={() => activateScale(scale.id)}
          />
        </div>
      ))}
      <NavLink to="/admin/grading/create">
        <Button variant="secondary" className="rounded-xl">+ Create New Scale</Button>
      </NavLink>
    </AdminShell>
  );
}

export function CreateGradingScalePage() {
  const createGradingScaleMutation = useCreateGradingScaleMutation();
  const { data: academicYears = [] } = useAcademicYears();
  const currentYear = (academicYears as any[]).find((year) => year.isCurrent) ?? (academicYears as any[])[0];
  const saveNewScale = (payload: { name: string; boundaries: Array<{ label: string; min: number; max: number; points: number; remark: string; isPassing: boolean }> }) => {
    const academicYearId = String(currentYear?.id ?? '');
    if (!academicYearId) {
      toast('Create or select an academic year before saving a grading scale.', 'warning');
      return;
    }
    createGradingScaleMutation.mutate({
      name: payload.name,
      academicYearId,
      educationStage: 'O_LEVEL',
      grades: payload.boundaries.map((boundary) => ({
        grade: boundary.label,
        minScore: boundary.min,
        maxScore: boundary.max,
        points: boundary.points,
        remark: boundary.remark,
        isPassing: boundary.isPassing,
      })),
    }, {
      onSuccess: () => toast('Grading scale created.', 'success'),
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to create grading scale', 'error'),
    });
  };
  return (
    <AdminShell title="Create Grading Scale" eyebrow="Boundary validation">
      <GradingBoundaryEditor
        scale={{ id: 'new', name: 'New O-Level Scale', active: false, boundaries: [{ label: 'A', min: 75, max: 100, points: 1, remark: 'Distinction' }, { label: 'B', min: 60, max: 74, points: 2, remark: 'Credit' }, { label: 'C', min: 45, max: 59, points: 3, remark: 'Merit' }, { label: 'D', min: 30, max: 44, points: 4, remark: 'Pass' }, { label: 'F', min: 0, max: 29, points: 5, remark: 'Fail', isPassing: false }] }}
        loading={createGradingScaleMutation.isPending}
        onSave={saveNewScale}
      />
    </AdminShell>
  );
}

// ─── Assessment types ─────────────────────────────────────────────────────────

export function AssessmentTypesPage() {
  const { data: apiAssessmentTypes = [] as typeof assessmentTypes } = useAssessmentTypes() as { data: typeof assessmentTypes };
  const saveAssessmentTypesMutation = useSaveAssessmentTypesMutation();
  const oLevelTypes = apiAssessmentTypes.filter((type: any) => String(type.educationStage ?? type.scope).replace('-', '_').toUpperCase() === 'O_LEVEL' && type.isActive !== false);
  const total = assessmentWeightsTotal(oLevelTypes.map((t) => Number(t.weight ?? 0)));
  const saveAssessmentTypes = (payload: { rows: Array<Record<string, unknown>>; deactivateIds: string[] }) => {
    saveAssessmentTypesMutation.mutate(payload, {
      onSuccess: () => toast('Assessment types saved.', 'success'),
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to save assessment types', 'error'),
    });
  };
  return (
    <AdminShell title="Assessment Types" eyebrow="Weight distribution">
      <AdminMetricStrip items={[{
        label: 'O-Level Weight',
        value: `${total}%`,
        detail: total === 100 ? 'O-Level distribution valid' : 'O-Level must equal 100%',
        tone: total === 100 ? 'green' : 'rose',
      }, {
        label: 'Scoped Types',
        value: String(apiAssessmentTypes.length),
        detail: 'Primary, O-Level, A-Level and subject-specific',
        tone: 'blue',
      }]} />
      <AssessmentTypeEditor
        types={oLevelTypes.length ? oLevelTypes : apiAssessmentTypes.filter((type: any) => type.isActive !== false)}
        loading={saveAssessmentTypesMutation.isPending}
        onSave={saveAssessmentTypes}
      />
    </AdminShell>
  );
}

// ─── Students ─────────────────────────────────────────────────────────────────

export function StudentsPage() {
  return (
    <AdminShell title="Student Management" eyebrow="Registry and lifecycle">
      <CsvImportZone entity="student" />
      <StudentsTable />
    </AdminShell>
  );
}

function StudentsTable() {
  const { data: apiStudents = [] as typeof adminStudents, isLoading, isError, refetch } = useAdminStudents() as { data: typeof adminStudents; isLoading: boolean; isError: boolean; refetch: () => void };
  if (isLoading) return <SkeletonTable cols={9} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (!apiStudents.length) return <EmptyState title="No students enrolled" description="Enrol students individually or import a CSV file." />;
  return (
    <AdminDataTable columns={['Reg. No.', 'Name', 'Class', 'Stage', 'Status', 'Guardians', 'Balance', 'Risk', 'Actions']}>
      {apiStudents.map((student) => (
        <tr key={student.id} className="hover:bg-slate-50">
          <Td className="font-mono text-xs text-slate-500">{student.registration}</Td>
          <Td><p className="font-black text-slate-900">{student.name}</p></Td>
          <Td>{student.className}</Td>
          <Td><Badge tone={student.stage === 'Primary' ? 'emerald' : student.stage === 'A-Level' ? 'amber' : 'blue'}>{student.stage}</Badge></Td>
          <Td><Badge tone="emerald">{student.status}</Badge></Td>
          <Td>{student.guardians}</Td>
          <Td className="font-mono text-xs">TZS {Number(student.balance ?? 0).toLocaleString('en-US')}</Td>
          <Td>
            <Badge tone={student.risk === 'CRITICAL' ? 'rose' : student.risk === 'WATCH' ? 'amber' : 'emerald'}>
              {student.risk}
            </Badge>
          </Td>
          <Td>
            <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/students/${student.id}`}>Open</NavLink>
          </Td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

// ─── Enrol student ────────────────────────────────────────────────────────────

const ENROL_STEPS = ['Identity', 'Admission', 'Class', 'Guardians', 'Portal', 'Review'];

type EnrolFormState = {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  nationalId: string;
  admissionDate: string;
  admissionNumber: string;
  intakeStream: string;
  classId: string;
  academicYearId: string;
  guardianFirstName: string;
  guardianLastName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianEmail: string;
};

const RELATIONSHIP_OPTIONS = [
  { value: 'FATHER', label: 'Father' },
  { value: 'MOTHER', label: 'Mother' },
  { value: 'GUARDIAN', label: 'Guardian' },
  { value: 'OTHER', label: 'Other' },
];

function safeDate(value: string, fallback: string) {
  return value || fallback;
}

export function EnrolStudentPage() {
  const { data: enrolClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };
  const { data: academicYears = [] } = useAcademicYears();
  const createStudentMutation = useCreateStudentMutation();
  const [step, setStep] = useState(0);
  const today = new Date().toISOString().slice(0, 10);
  const defaultClassId = String(enrolClasses[0]?.id ?? '');
  const defaultYearId = String((academicYears[0] as any)?.id ?? '');
  const [form, setForm] = useState<EnrolFormState>({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'FEMALE',
    nationalId: '',
    admissionDate: today,
    admissionNumber: '',
    intakeStream: 'science',
    classId: '',
    academicYearId: '',
    guardianFirstName: '',
    guardianLastName: '',
    guardianRelationship: 'GUARDIAN',
    guardianPhone: '',
    guardianEmail: '',
  });
  const activeClassId = form.classId || defaultClassId;
  const activeYearId = form.academicYearId || defaultYearId;
  const selectedClass = enrolClasses.find((item: any) => item.id === activeClassId) ?? enrolClasses[0];

  const setEnrolField = (key: keyof EnrolFormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));
  const setEnrolValue = (key: keyof EnrolFormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(ENROL_STEPS.length - 1, s + 1));

  const submitStudent = () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast('Student first and last name are required', 'warning');
      setStep(0);
      return;
    }
    if (!form.dateOfBirth) {
      toast('Date of birth is required', 'warning');
      setStep(0);
      return;
    }
    if (!activeClassId || !activeYearId) {
      toast('Class and academic year are required', 'warning');
      setStep(2);
      return;
    }
    if (!form.guardianFirstName.trim() || !form.guardianPhone.trim()) {
      toast('Primary guardian name and phone are required', 'warning');
      setStep(3);
      return;
    }

    createStudentMutation.mutate({
      authUserId: `pending-student-${Date.now()}`,
      firstName: form.firstName.trim(),
      middleName: form.middleName.trim() || undefined,
      lastName: form.lastName.trim(),
      dateOfBirth: safeDate(form.dateOfBirth, '2010-01-01'),
      gender: form.gender,
      nationality: 'Tanzanian',
      admissionDate: safeDate(form.admissionDate, today),
      classId: activeClassId,
      academicYearId: activeYearId,
      guardians: [{
        firstName: form.guardianFirstName.trim(),
        lastName: form.guardianLastName.trim() || form.lastName.trim(),
        relationship: form.guardianRelationship,
        phoneNumber: form.guardianPhone.trim(),
        email: form.guardianEmail.trim() || undefined,
        isPrimary: true,
      }],
    }, {
      onSuccess: (student: any) => {
        toast(`Student enrolled: ${student?.registrationNumber ?? 'record created'}`, 'success');
      },
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to enrol student', 'error'),
    });
  };

  return (
    <AdminShell title="Enrol Student" eyebrow="Admission workflow">
      {/* Step progress bar */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex min-w-max items-center gap-0">
          {ENROL_STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <button type="button" onClick={() => setStep(i)} className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition ${
                  i < step  ? 'bg-[#4338CA] text-white'
                : i === step ? 'bg-[#4338CA] text-white ring-4 ring-[#4338CA]/20'
                :              'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                  {i < step ? '✓' : i + 1}
                </span>
                <span className={`text-sm font-black transition ${i === step ? 'text-[#4338CA]' : 'text-slate-400'}`}>
                  {label}
                </span>
              </button>
              {i < ENROL_STEPS.length - 1 && (
                <div className={`mx-3 h-px w-10 transition-colors ${i < step ? 'bg-[#4338CA]' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {step === 0 && (
        <AdminFormSection title="Student Identity" subtitle="Personal details and legal identification">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="First Name" value={form.firstName} onChange={setEnrolField('firstName')} placeholder="e.g. Amina" />
            <Field label="Middle Name" value={form.middleName} onChange={setEnrolField('middleName')} placeholder="Optional" />
            <Field label="Last Name" value={form.lastName} onChange={setEnrolField('lastName')} placeholder="e.g. Baraka" />
            <Field label="Date of Birth" value={form.dateOfBirth} onChange={setEnrolField('dateOfBirth')} type="date" />
            <SelectField label="Gender" value={form.gender} onChange={setEnrolValue('gender')} options={[{ value: 'FEMALE', label: 'Female' }, { value: 'MALE', label: 'Male' }]} />
            <Field label="National ID / Birth Cert No." value={form.nationalId} onChange={setEnrolField('nationalId')} placeholder="e.g. 19XXXXXXXXXXXXXXXXX" />
          </div>
        </AdminFormSection>
      )}

      {step === 1 && (
        <AdminFormSection title="Admission Details" subtitle="School admission and intake records">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Admission Date" value={form.admissionDate} onChange={setEnrolField('admissionDate')} type="date" />
            <Field label="Admission Number" value={form.admissionNumber} onChange={setEnrolField('admissionNumber')} placeholder="Generated by system if blank" />
            <SelectField label="Intake Stream" value={form.intakeStream} onChange={setEnrolValue('intakeStream')} options={[
              { value: 'science',     label: 'Science'    },
              { value: 'arts',        label: 'Arts'       },
              { value: 'commercial',  label: 'Commercial' },
            ]} />
            <Field label="Previous School"  placeholder="e.g. Moshi Primary School" />
            <SelectField label="Entry Level" options={[
              { value: 'form1', label: 'Form 1 (Standard intake)' },
              { value: 'form3', label: 'Form 3 (Transfer)'        },
            ]} />
          </div>
        </AdminFormSection>
      )}

      {step === 2 && (
        <AdminFormSection title="Class Placement" subtitle="Academic year, form level, and class section">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField
              key={`year-${activeYearId}`}
              label="Academic Year"
              value={activeYearId}
              onChange={setEnrolValue('academicYearId')}
              options={(academicYears as any[]).map((year) => ({ value: String(year.id), label: String(year.name ?? year.year ?? year.id) }))}
            />
            <Field label="Resolved Level" value={String((selectedClass as any)?.level ?? (selectedClass as any)?.name ?? 'Select class')} readOnly />
            <SelectField
              key={`class-${activeClassId}`}
              label="Class Section"
              value={activeClassId}
              onChange={setEnrolValue('classId')}
              options={enrolClasses.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))}
            />
          </div>
        </AdminFormSection>
      )}

      {step === 3 && (
        <AdminFormSection title="Guardian Records" subtitle="Primary and secondary contact persons">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Guardian First Name" value={form.guardianFirstName} onChange={setEnrolField('guardianFirstName')} placeholder="e.g. Baraka" />
            <Field label="Guardian Last Name" value={form.guardianLastName} onChange={setEnrolField('guardianLastName')} placeholder="e.g. Juma" />
            <Field label="Phone Number" value={form.guardianPhone} onChange={setEnrolField('guardianPhone')} type="tel" placeholder="+255 7XX XXX XXX" />
            <SelectField label="Relationship" value={form.guardianRelationship} onChange={setEnrolValue('guardianRelationship')} options={RELATIONSHIP_OPTIONS} />
            <Field label="Email (for reports)" value={form.guardianEmail} onChange={setEnrolField('guardianEmail')} type="email" placeholder="Optional" />
          </div>
        </AdminFormSection>
      )}

      {step === 4 && (
        <AdminFormSection title="Portal Account" subtitle="Student portal access and credentials">
          <div className="space-y-4">
            <FeatureToggle
              label="Create portal account"
              description="Student can log in to view results and school notices"
              enabled
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Portal Link Status" value="Created after student auth account is linked" readOnly />
              <Field label="Registration Number" value="Generated on submit" readOnly />
            </div>
          </div>
        </AdminFormSection>
      )}

      {step === 5 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-display text-xl font-black text-slate-950">Review & Submit</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">Verify all details before creating the student record.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {([
              ['First Name', form.firstName],
              ['Middle Name', form.middleName || '—'],
              ['Last Name', form.lastName],
              ['Date of Birth', form.dateOfBirth || '—'],
              ['Gender', form.gender || '—'],
              ['National ID', form.nationalId || '—'],
              ['Admission Date', form.admissionDate || '—'],
              ['Class', (enrolClasses.find((c) => c.id === form.classId)?.name ?? form.classId) || '—'],
              ['Guardian', form.guardianFirstName ? `${form.guardianFirstName} ${form.guardianLastName} · ${form.guardianPhone}` : '—'],
            ] as const).map(([label, val]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-1 font-black text-slate-900">{val}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {step > 0 && (
          <Button variant="secondary" className="rounded-xl" onClick={prev}>Back</Button>
        )}
        {step < ENROL_STEPS.length - 1 ? (
          <Button className="rounded-xl bg-[#4338CA]" onClick={next}>Next</Button>
        ) : (
          <Button className="rounded-xl bg-[#4338CA]" loading={createStudentMutation.isPending} onClick={submitStudent}>
            <UserPlus className="h-4 w-4" /> Submit Enrolment
          </Button>
        )}
      </div>
    </AdminShell>
  );
}

// ─── Student profile ──────────────────────────────────────────────────────────

export function StudentAdminProfilePage() {
  const { id } = useParams();
  const { data: apiStudents = [] as typeof adminStudents, isLoading } = useAdminStudents() as { data: typeof adminStudents; isLoading: boolean };
  if (isLoading) return <AdminShell title="Loading…" eyebrow="Admin student profile"><SkeletonTable cols={4} /></AdminShell>;
  const student = apiStudents.find((s) => s.id === id) ?? null;
  if (!student) return <AdminShell title="Not Found" eyebrow="Admin student profile"><EmptyState title="Student not found" description="This student record does not exist." /></AdminShell>;
  return (
    <AdminShell title={student.name} eyebrow="Admin student profile">
      {/* Quick stats */}
      <AdminMetricStrip items={[
        { label: 'Registration', value: student.registration, detail: student.className, tone: 'blue' },
        { label: 'Status',       value: student.status,       detail: 'Active registry',  tone: 'green' },
        { label: 'Guardians',    value: String(student.guardians), detail: 'on record', tone: 'blue' },
        { label: 'Balance',      value: `TZS ${Number(student.balance ?? 0).toLocaleString('en-US')}`, detail: 'Outstanding', tone: (student.balance ?? 0) > 0 ? 'amber' : 'green' },
        { label: 'Risk',         value: student.risk,          detail: 'Academic risk band', tone: student.risk === 'CRITICAL' ? 'rose' : 'amber' },
        { label: 'Portal',       value: student.linked ? 'Linked' : 'Missing', detail: 'Account status', tone: student.linked ? 'green' : 'rose' },
      ]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {(['Identity', 'Guardians', 'Portal Account', 'Attendance', 'Performance', 'Finance', 'Discipline', 'Audit'] as const).map((title) => (
          <AdminQuickCard key={title} title={title} detail="Linked panel with edit controls." to="/admin/students" />
        ))}
      </div>
    </AdminShell>
  );
}

// ─── Fee categories ───────────────────────────────────────────────────────────

export function AdminFeeCategoriesPage() {
  const { data: rawCategories = [], isLoading, isError, refetch } = useFeeCategories() as { data: Array<{ id?: string; code?: string; name?: string; type?: string; category?: string; amount?: number; defaultAmount?: number; usedByStructures?: number }> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const categories = (rawCategories ?? []).map((c) => ({
        id: c.id ?? '',
        code: c.code ?? c.id ?? '',
        name: c.name ?? '',
        type: c.type ?? c.category ?? 'Optional',
        amount: c.amount ?? c.defaultAmount ?? 0,
        used: c.usedByStructures ?? 0,
      }));
  if (isLoading) return <AdminShell title="Fee Categories" eyebrow="Finance setup"><SkeletonTable cols={5} /></AdminShell>;
  if (isError) return <AdminShell title="Fee Categories" eyebrow="Finance setup"><DataError onRetry={refetch} /></AdminShell>;
  return (
    <AdminShell title="Fee Categories" eyebrow="Finance setup with dependency safety">
      <AdminDataTable columns={['Code', 'Name', 'Type', 'Amount', 'Used By', 'Actions']}>
        {categories.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">No fee categories yet. <NavLink to="/finance/fee-categories/create" className="font-black text-[#4338CA] hover:underline">Create one →</NavLink></td></tr>}
        {categories.map((cat) => (
          <tr key={cat.id || cat.code} className="hover:bg-slate-50">
            <Td className="font-mono text-xs text-slate-500">{cat.code}</Td>
            <Td><p className="font-black text-slate-900">{cat.name}</p></Td>
            <Td><Badge tone={cat.type === 'Mandatory' ? 'rose' : 'blue'}>{cat.type}</Badge></Td>
            <Td className="font-mono text-xs">TZS {cat.amount.toLocaleString('en-US')}</Td>
            <Td>{cat.used} structures</Td>
            <Td>
              <DangerActionDialog title="Delete Category" entity={cat.code} confirmation="DELETE" />
            </Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

// ─── Performance engine ───────────────────────────────────────────────────────

export function PerformanceEngineAdminPage() {
  const runMutation = useRunEngineAdminMutation();
  const [thresholds, setThresholds] = useState({ failure: '35', atRisk: '48', excellence: '85', maxPairs: '20', strategy: 'buddy' });
  const set = (k: keyof typeof thresholds) => (e: React.ChangeEvent<HTMLInputElement>) => setThresholds((p) => ({ ...p, [k]: e.target.value }));

  const handleRun = () => {
    toast('Performance engine started…', 'info');
    runMutation.mutate({ scope: 'WHOLE_SCHOOL', thresholds: { failure: Number(thresholds.failure), atRisk: Number(thresholds.atRisk), excellence: Number(thresholds.excellence), maxPairs: Number(thresholds.maxPairs), strategy: thresholds.strategy } }, {
      onSuccess: (result) => {
        const r = result as Record<string, unknown> | undefined;
        const processed = r?.studentsProcessed ?? r?.count ?? 'all';
        toast(`Engine run complete — ${processed} students processed`, 'success');
      },
      onError: () => toast('Engine run failed. Please check service logs.', 'error'),
    });
  };

  return (
    <AdminShell title="Performance Engine" eyebrow="Thresholds, pairing rules, manual run">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-gutter">
          <AdminFormSection title="Risk Thresholds" subtitle="Score boundaries that trigger at-risk classification">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Failure Boundary (%)" type="number" value={thresholds.failure} onChange={set('failure')} />
              <Field label="At-Risk Boundary (%)" type="number" value={thresholds.atRisk} onChange={set('atRisk')} />
              <Field label="Excellence Boundary (%)" type="number" value={thresholds.excellence} onChange={set('excellence')} />
            </div>
          </AdminFormSection>
          <AdminFormSection title="Pairing Rules" subtitle="Conditions for peer-pairing and intervention matching">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Pairing Strategy" value={thresholds.strategy} onChange={(v) => setThresholds((p) => ({ ...p, strategy: v }))} options={[{ value: 'buddy', label: 'Peer buddy (same class)' }, { value: 'mentor', label: 'Cross-class mentor' }]} />
              <Field label="Max Pairs Per Run" type="number" value={thresholds.maxPairs} onChange={set('maxPairs')} />
            </div>
          </AdminFormSection>
        </div>
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Manual Trigger</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Runs a full analysis pass across all enrolled students.</p>
          {runMutation.isPending && (
            <div className="mt-4 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full animate-pulse rounded-full bg-[#4338CA]" style={{ width: '60%' }} />
              </div>
              <span className="text-xs font-bold text-slate-500">Running…</span>
            </div>
          )}
          <Button className="mt-4 w-full rounded-xl bg-[#4338CA]" loading={runMutation.isPending} onClick={handleRun}>
            <Play className="h-4 w-4" /> {runMutation.isPending ? 'Running…' : 'Run Engine Now'}
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Notification templates ───────────────────────────────────────────────────

export function NotificationTemplatesPage() {
  const { data: apiTemplates = [] as typeof notificationTemplates } = useNotificationTemplates() as { data: typeof notificationTemplates };
  return (
    <AdminShell title="Notification Templates" eyebrow="SMS, email, push, in-app">
      <AdminDataTable columns={['Name', 'Channel', 'Event Type', 'Status', 'Last Edited', 'Editor', 'Actions']}>
        {apiTemplates.map((tpl) => (
          <tr key={tpl.id} className="hover:bg-slate-50">
            <Td><p className="font-black text-slate-900">{tpl.name}</p></Td>
            <Td><Badge tone="blue">{tpl.channel}</Badge></Td>
            <Td className="font-mono text-xs text-slate-500">{tpl.eventType}</Td>
            <Td><Badge tone="emerald">{tpl.status}</Badge></Td>
            <Td className="text-xs text-slate-400">{tpl.lastEdited.slice(0, 10)}</Td>
            <Td>{tpl.editor}</Td>
            <Td>
              <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/notifications/templates/${tpl.id}`}>Edit</NavLink>
            </Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

export function NotificationTemplateDetailPage() {
  const { id } = useParams();
  const { data: apiTemplates = [] as typeof notificationTemplates, isLoading } = useNotificationTemplates() as { data: typeof notificationTemplates; isLoading: boolean };
  if (isLoading) return <AdminShell title="Loading…" eyebrow="Template editor"><SkeletonTable cols={3} /></AdminShell>;
  const tpl = apiTemplates.find((t) => t.id === id) ?? null;
  if (!tpl) return <AdminShell title="Not Found" eyebrow="Template editor"><EmptyState title="Template not found" description="This notification template does not exist." /></AdminShell>;
  return <AdminShell title={tpl.name} eyebrow="Template editor"><NotificationTemplateEditor template={tpl} /></AdminShell>;
}

export function SendManualNotificationPage() {
  const sendMutation = useSendManualNotificationMutation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ audience: 'parents', channel: 'SMS', priority: 'normal', body: '' });
  const setField = (k: keyof typeof form) => (v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSend = () => {
    if (!form.body.trim()) { toast('Message body is required', 'error'); return; }
    sendMutation.mutate({ audience: form.audience, channel: form.channel, priority: form.priority, body: form.body }, {
      onSuccess: () => { toast('Notification sent successfully', 'success'); navigate('/admin/notifications/logs'); },
      onError: () => toast('Failed to send notification. Check notification service logs.', 'error'),
    });
  };

  return (
    <AdminShell title="Send Manual Notification" eyebrow="Controlled communication">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <AdminFormSection title="Message" subtitle="Audience, channel, body, and schedule">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Audience" options={[{ value: 'all', label: 'All staff and guardians' }, { value: 'parents', label: 'Parents / guardians only' }, { value: 'teachers', label: 'Teachers only' }, { value: 'class', label: 'Specific class' }]} value={form.audience} onChange={setField('audience')} />
            <SelectField label="Channel" options={[{ value: 'SMS', label: 'SMS' }, { value: 'Email', label: 'Email' }, { value: 'Push', label: 'Push (app)' }, { value: 'All', label: 'All channels' }]} value={form.channel} onChange={setField('channel')} />
            <SelectField label="Priority" options={[{ value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} value={form.priority} onChange={setField('priority')} />
          </div>
          <textarea className="mt-4 h-36 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white" placeholder="Message body…" value={form.body} onChange={(e) => setField('body')(e.target.value)} />
          <div className="mt-4 flex gap-3">
            <Button className="rounded-xl bg-[#4338CA]" disabled={sendMutation.isPending} onClick={handleSend}>
              {sendMutation.isPending ? 'Sending…' : 'Send Notification'}
            </Button>
            <Button variant="secondary" className="rounded-xl" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </AdminFormSection>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Delivery Preview</p>
          <p className="mt-2 text-sm font-semibold text-slate-700">Audience: <span className="font-black">{form.audience}</span></p>
          <p className="mt-1 text-sm font-semibold text-slate-700">Channel: <span className="font-black">{form.channel}</span></p>
          <p className="mt-1 text-sm font-semibold text-slate-700">Priority: <span className="font-black">{form.priority}</span></p>
          {form.body && <p className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{form.body}</p>}
        </div>
      </div>
    </AdminShell>
  );
}

export function NotificationLogsPage() {
  const { data: apiLogs = [] as typeof notificationLogs } = useNotificationLogs() as { data: typeof notificationLogs };
  return (
    <AdminShell title="Notification Logs" eyebrow="Delivery inspection">
      <AdminDataTable columns={['Time', 'Channel', 'Recipient', 'Event', 'Status', 'Attempts', 'Provider']}>
        {apiLogs.map((log) => (
          <tr key={log.id} className="hover:bg-slate-50">
            <Td className="text-xs text-slate-400">
              {log.time && !log.time.startsWith('[object')
                ? new Date(log.time).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
                : '—'}
            </Td>
            <Td><Badge tone="blue">{log.channel}</Badge></Td>
            <Td className="font-mono text-xs text-slate-500">{log.recipient}</Td>
            <Td className="text-xs">{log.eventType.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}</Td>
            <Td><Badge tone={log.status === 'FAILED' ? 'rose' : 'emerald'}>{log.status}</Badge></Td>
            <Td>{log.attempts}</Td>
            <Td className="text-xs text-slate-500">{log.provider || '—'}</Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

// ─── Analytics & reports ──────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  return (
    <AdminShell title="Analytics Full Access" eyebrow="All school analytics">
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {(['School overview', 'Academic health', 'Finance health', 'Enrolment trends', 'Attendance health', 'Notification health'] as const).map((title) => (
          <AdminQuickCard key={title} title={title} detail="Exportable with source labels." to="/analytics" />
        ))}
      </div>
    </AdminShell>
  );
}

export function AdminReportsPage() {
  const { data: apiReportJobs = [] as typeof reportJobs } = useAdminReportJobs() as { data: typeof reportJobs };
  return (
    <AdminShell title="Generate Any Report" eyebrow="Report jobs and downloads">
      <AdminDataTable columns={['Report', 'Status', 'Requested By', 'Role', 'Scope', 'Format', 'Created', 'Actions']}>
        {apiReportJobs.map((job) => (
          <tr key={job.id} className="hover:bg-slate-50">
            <Td><p className="font-black text-slate-900">{job.name}</p></Td>
            <Td><Badge tone={job.status === 'COMPLETED' ? 'emerald' : 'amber'}>{job.status}</Badge></Td>
            <Td>{job.requestedBy}</Td>
            <Td><Badge tone="blue">{job.role}</Badge></Td>
            <Td className="text-xs">{job.scope}</Td>
            <Td className="font-mono text-xs">{job.format}</Td>
            <Td className="text-xs text-slate-400">{job.created.slice(0, 10)}</Td>
            <Td>
              <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/reports/${job.id}`}>Open</NavLink>
            </Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

export function AdminReportDetailPage() {
  const { id } = useParams();
  const { data: apiReportJobs = [] as typeof reportJobs, isLoading } = useAdminReportJobs() as { data: typeof reportJobs; isLoading: boolean };
  const [downloading, setDownloading] = useState(false);

  if (isLoading) return <AdminShell title="Loading…" eyebrow="Report detail"><SkeletonTable cols={3} /></AdminShell>;
  const job = apiReportJobs.find((r) => r.id === id) ?? null;
  if (!job) return <AdminShell title="Not Found" eyebrow="Report detail"><EmptyState title="Report not found" description="This report job does not exist." /></AdminShell>;

  const handleDownload = async () => {
    if (job.status !== 'COMPLETED') { toast('Report is still processing', 'warning'); return; }
    setDownloading(true);
    try {
      await downloadReportWhenReady(job.id, `${job.name}.${job.format?.toLowerCase() ?? 'pdf'}`);
      toast(`${job.name} downloaded`, 'success');
    } catch {
      toast('Failed to download report', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <AdminShell title={job.name} eyebrow="Report detail">
      <AdminMetricStrip items={[
        { label: 'Status', value: job.status, detail: job.format },
        { label: 'Scope', value: job.scope, detail: job.role },
        { label: 'Requested', value: job.requestedBy, detail: job.created.slice(0, 10) },
      ]} />
      <Button className="rounded-xl bg-[#4338CA]" disabled={downloading} onClick={handleDownload}>
        <Download className="h-4 w-4" /> {downloading ? 'Downloading…' : 'Download'}
      </Button>
    </AdminShell>
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export function FinanceAuditAdminPage() {
  return <AdminShell title="Financial Audit Log" eyebrow="Immutable finance events"><AuditPanel /></AdminShell>;
}

export function SystemAuditPage() {
  return (
    <AdminShell title="System Audit Log" eyebrow="Auth and system events">
      <AuditPanel />
    </AdminShell>
  );
}

function toLabel(s: string): string {
  return s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatAuditTime(raw: string): string {
  if (!raw || raw.startsWith('[object')) return 'Unknown time';
  try {
    return new Date(raw).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return raw.slice(0, 16).replace('T', ' ');
  }
}

function actionTone(action: string): string {
  const a = action.toUpperCase();
  if (a.includes('DELET') || a.includes('REMOV') || a.includes('REVOK')) return 'bg-rose-50 text-rose-700 border-rose-200';
  if (a.includes('CREAT') || a.includes('ADD') || a.includes('PUBLISH')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (a.includes('LOGIN') || a.includes('UNLOCK') || a.includes('ACTIV')) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
}

type AuditEvent = typeof adminAuditEvents[number];

function AuditEventCard({ event }: { event: AuditEvent }) {
  const [open, setOpen] = useState(false);
  const raw = event.payload as Record<string, unknown>;

  const actionLabel    = toLabel(event.action);
  const actorLabel     = toLabel(event.actor);
  const entityLabel    = event.entity && event.entity !== 'System' ? event.entity : '';
  const entityId       = typeof raw?.entityId       === 'string' ? raw.entityId       : '';
  const ipAddress      = typeof raw?.ipAddress       === 'string' ? raw.ipAddress       : '';
  const performedById  = typeof raw?.performedById   === 'string' ? raw.performedById   : '';
  const previousValue  = raw?.previousValue  ?? null;
  const newValue       = raw?.newValue       ?? null;
  const metadata       = raw?.metadata && typeof raw.metadata === 'object'
    ? Object.entries(raw.metadata as Record<string, unknown>)
    : [];
  const hasDetails = previousValue !== null || newValue !== null || metadata.length > 0 || performedById;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-slate-50/60"
        onClick={() => hasDetails && setOpen((v) => !v)}
        style={{ cursor: hasDetails ? 'pointer' : 'default' }}
      >
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
          <Shield className="h-4 w-4 text-[#4338CA]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
            {formatAuditTime(event.time)}
          </p>
          <h3 className="mt-0.5 font-display text-lg font-black text-slate-950">{actionLabel}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-black ${actionTone(event.action)}`}>
              {event.action}
            </span>
            {actorLabel && <span>{actorLabel}</span>}
            {entityLabel && <><span className="text-slate-300">·</span><span>{entityLabel}</span></>}
            {entityId && <span className="font-mono text-xs text-slate-400">{entityId.slice(0, 8)}…</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {ipAddress && (
            <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-400 sm:inline">
              {ipAddress}
            </span>
          )}
          {hasDetails && (
            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          )}
        </div>
      </button>

      {open && hasDetails && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 p-5">
          {(previousValue !== null || newValue !== null) && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Before</p>
                {previousValue !== null
                  ? <pre className="max-h-40 overflow-auto rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs font-mono text-rose-700">
                      {JSON.stringify(previousValue, null, 2)}
                    </pre>
                  : <p className="text-sm font-semibold italic text-slate-400">No prior state</p>}
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">After</p>
                {newValue !== null
                  ? <pre className="max-h-40 overflow-auto rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-mono text-emerald-700">
                      {JSON.stringify(newValue, null, 2)}
                    </pre>
                  : <p className="text-sm font-semibold italic text-slate-400">No new state</p>}
              </div>
            </div>
          )}
          {(metadata.length > 0 || performedById) && (
            <div className="flex flex-wrap gap-4 text-xs">
              {metadata.map(([k, v]) => (
                <div key={k}>
                  <span className="font-black uppercase tracking-widest text-slate-400">{toLabel(k)}: </span>
                  <span className="font-semibold text-slate-700">{String(v)}</span>
                </div>
              ))}
              {performedById && (
                <div>
                  <span className="font-black uppercase tracking-widest text-slate-400">Actor ID: </span>
                  <span className="font-mono font-semibold text-slate-500">{performedById.slice(0, 8)}…</span>
                </div>
              )}
              {ipAddress && (
                <div className="sm:hidden">
                  <span className="font-black uppercase tracking-widest text-slate-400">IP: </span>
                  <span className="font-mono font-semibold text-slate-500">{ipAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AuditPanel() {
  const { data: apiAudit = [] as typeof adminAuditEvents } = useAdminAuditEvents() as { data: typeof adminAuditEvents };
  if (!apiAudit.length) {
    return <p className="text-sm font-semibold text-slate-400">No audit events found.</p>;
  }
  return (
    <div className="space-y-3">
      {apiAudit.map((event) => (
        <AuditEventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

// ─── System settings ──────────────────────────────────────────────────────────

export function SystemSettingsPage() {
  const { data: apiSettings } = useSystemSettings() as { data: Record<string, unknown> | undefined };
  const saveMutation = useUpdateSystemSettingsMutation();
  const s = apiSettings ?? {};

  const [form, setForm] = useState({
    schoolName: String(s.schoolName ?? s.name ?? 'Kilimanjaro Schools'),
    email: String(s.email ?? s.officialEmail ?? 'info@ks.ac.tz'),
    phone: String(s.phone ?? s.contactPhone ?? '+255 27 275 0000'),
    location: String(s.location ?? s.physicalLocation ?? 'Moshi, Kilimanjaro, Tanzania'),
    minPasswordLength: String(s.minPasswordLength ?? '8'),
    sessionTimeout: String(s.sessionTimeout ?? '60'),
    loginLockout: String(s.loginLockout ?? '5'),
    smsProvider: String(s.smsProvider ?? 'beem'),
    emailProvider: String(s.emailProvider ?? 'sendgrid'),
  });

  useEffect(() => {
    if (apiSettings) {
      const s2 = apiSettings as Record<string, unknown>;
      setForm({ schoolName: String(s2.schoolName ?? s2.name ?? form.schoolName), email: String(s2.email ?? s2.officialEmail ?? form.email), phone: String(s2.phone ?? s2.contactPhone ?? form.phone), location: String(s2.location ?? form.location), minPasswordLength: String(s2.minPasswordLength ?? form.minPasswordLength), sessionTimeout: String(s2.sessionTimeout ?? form.sessionTimeout), loginLockout: String(s2.loginLockout ?? form.loginLockout), smsProvider: String(s2.smsProvider ?? form.smsProvider), emailProvider: String(s2.emailProvider ?? form.emailProvider) });
    }
  }, [!!apiSettings]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSave = () => {
    saveMutation.mutate({ ...form, minPasswordLength: Number(form.minPasswordLength), sessionTimeout: Number(form.sessionTimeout), loginLockout: Number(form.loginLockout) }, {
      onSuccess: () => toast('System settings saved', 'success'),
      onError: () => toast('Failed to save settings', 'error'),
    });
  };

  return (
    <AdminShell title="System Settings" eyebrow="Infrastructure, providers, security">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <AdminFormSection title="School Identity" subtitle="Official name, contact details, and branding">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="School Name" value={form.schoolName} onChange={set('schoolName')} />
              <Field label="Official Email" type="email" value={form.email} onChange={set('email')} />
              <Field label="Contact Phone" type="tel" value={form.phone} onChange={set('phone')} />
              <Field label="Physical Location" value={form.location} onChange={set('location')} />
            </div>
          </AdminFormSection>

          <AdminFormSection title="Security Policy" subtitle="Password rules, session management, and access controls">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Min Password Length" type="number" value={form.minPasswordLength} onChange={set('minPasswordLength')} />
              <Field label="Session Timeout (min)" type="number" value={form.sessionTimeout} onChange={set('sessionTimeout')} />
              <Field label="Login Lockout (attempts)" type="number" value={form.loginLockout} onChange={set('loginLockout')} />
            </div>
          </AdminFormSection>

          <AdminFormSection title="Notification Providers" subtitle="SMS, email, and push gateway configuration">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="SMS Provider" value={form.smsProvider} onChange={(v) => setForm((p) => ({ ...p, smsProvider: v }))} options={[{ value: 'beem', label: 'Beem Africa' }, { value: 'africastalking', label: "Africa's Talking" }, { value: 'nexmo', label: 'Vonage / Nexmo' }]} />
              <SelectField label="Email Provider" value={form.emailProvider} onChange={(v) => setForm((p) => ({ ...p, emailProvider: v }))} options={[{ value: 'sendgrid', label: 'SendGrid' }, { value: 'ses', label: 'Amazon SES' }, { value: 'smtp', label: 'Custom SMTP' }]} />
            </div>
          </AdminFormSection>
        </div>

        <div className="space-y-4">
          <DangerActionDialog title="Reset All Sessions" entity="All active users" confirmation="RESET" />
          <Button className="w-full rounded-xl bg-[#4338CA]" disabled={saveMutation.isPending} onClick={handleSave}>
            {saveMutation.isPending ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────

export function AdminAnnouncementsPage() {
  const { data: rawAnnouncements = [], isLoading, isError, refetch } = useAnnouncements() as { data: Array<{ id?: string; title?: string; author?: string; createdBy?: string; audience?: string; targetRoles?: string[]; status?: string; priority?: string }> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const items = (rawAnnouncements ?? []).map((a) => ({
        id: a.id ?? a.title ?? String(Math.random()),
        title: a.title ?? '',
        author: a.author ?? a.createdBy ?? 'Admin',
        audience: a.audience ?? ((a.targetRoles ?? []).join(', ') || 'All roles'),
        status: a.status?.toUpperCase() ?? 'ACTIVE',
        priority: a.priority ?? 'Normal',
      }));
  return (
    <AdminShell title="Announcements Admin" eyebrow="Create, edit, cancel with reason">
      <AdminDataTable columns={['Title', 'Author', 'Audience', 'Status', 'Priority', 'Actions']}>
        {isLoading && <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">Loading…</td></tr>}
        {isError && <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-rose-500">Failed to load. <button onClick={refetch} className="font-black underline">Retry</button></td></tr>}
        {!isLoading && !isError && items.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-sm text-slate-500">No announcements yet.</td></tr>}
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-slate-50">
            <Td><p className="font-black text-slate-900">{item.title}</p></Td>
            <Td>{item.author}</Td>
            <Td>{item.audience}</Td>
            <Td><Badge tone="emerald">{item.status}</Badge></Td>
            <Td><Badge tone={item.priority === 'High' ? 'rose' : 'blue'}>{item.priority}</Badge></Td>
            <Td>
              <DangerActionDialog title="Cancel Announcement" entity={item.title} confirmation="CANCEL" />
            </Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

// ─── Stage Configuration (Gap 10) ────────────────────────────────────────────

const STAGE_DESCRIPTIONS: Record<string, { label: string; note: string; tone: 'emerald' | 'blue' | 'amber' }> = {
  PRIMARY: { label: 'Primary School', note: 'Class 1 up to terminal year (Class 6 or 7). Pass mark: 50 %. PSLE national exam at terminal year.', tone: 'emerald' },
  O_LEVEL: { label: 'Secondary O-Level', note: 'Form 1 to Form 4. CSEE national exam at Form 4. Registration prefix: KS-S-.', tone: 'blue' },
  A_LEVEL: { label: 'Advanced Level', note: 'Form 5 and Form 6. ACSEE national exam at Form 6. Combination-based subjects. Registration prefix: KS-A-.', tone: 'amber' },
};

type StageConfigState = {
  terminalPrimary: string;
  primaryPassMark: string;
  primaryPrefix: string;
  primaryPsleIndex: boolean;
  primaryHolistic: boolean;
  oLevelFailure: string;
  oLevelRisk: string;
  oLevelPrefix: string;
  oLevelCandidateNumber: boolean;
  aLevelFailure: string;
  aLevelRisk: string;
  aLevelPrefix: string;
  requirePrincipalSubjects: boolean;
  requireCompulsorySubsidiary: boolean;
};

const DEFAULT_STAGE_CONFIG: StageConfigState = {
  terminalPrimary: '7',
  primaryPassMark: '50',
  primaryPrefix: 'KS-P',
  primaryPsleIndex: true,
  primaryHolistic: true,
  oLevelFailure: '40',
  oLevelRisk: '50',
  oLevelPrefix: 'KS-S',
  oLevelCandidateNumber: true,
  aLevelFailure: '25',
  aLevelRisk: '35',
  aLevelPrefix: 'KS-A',
  requirePrincipalSubjects: true,
  requireCompulsorySubsidiary: true,
};

function readStageConfig(settings: unknown): StageConfigState {
  const root = settings && typeof settings === 'object' ? settings as Record<string, unknown> : {};
  const settingsObj = root.settings && typeof root.settings === 'object' ? root.settings as Record<string, unknown> : root;
  const stageConfig = settingsObj.stageConfig && typeof settingsObj.stageConfig === 'object'
    ? settingsObj.stageConfig as Partial<StageConfigState>
    : {};
  return { ...DEFAULT_STAGE_CONFIG, ...stageConfig };
}

function StageToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5 transition hover:bg-slate-50/60">
      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA]/40 ${checked ? 'bg-[#4338CA]' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

export function StageConfigPage() {
  const { data: systemSettings } = useSystemSettings();
  const updateSystemSettingsMutation = useUpdateSystemSettingsMutation();
  const [config, setConfig] = useState<StageConfigState>(DEFAULT_STAGE_CONFIG);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setConfig(readStageConfig(systemSettings));
  }, [systemSettings]);
  const setConfigValue = (key: keyof StageConfigState, value: string | boolean) => {
    setSaved(false);
    setConfig((current) => ({ ...current, [key]: value }));
  };
  const saveStageConfig = () => {
    const percentages = [config.primaryPassMark, config.oLevelFailure, config.oLevelRisk, config.aLevelFailure, config.aLevelRisk].map(Number);
    if (!percentages.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
      toast('All percentage thresholds must be between 0 and 100.', 'warning');
      return;
    }
    if (Number(config.oLevelFailure) >= Number(config.oLevelRisk) || Number(config.aLevelFailure) >= Number(config.aLevelRisk)) {
      toast('Failure threshold must be lower than at-risk threshold.', 'warning');
      return;
    }
    updateSystemSettingsMutation.mutate({ stageConfig: config }, {
      onSuccess: () => {
        setSaved(true);
        toast('Stage configuration saved.', 'success');
      },
      onError: (error) => toast(error instanceof Error ? error.message : 'Failed to save stage configuration', 'error'),
    });
  };

  return (
    <AdminShell title="Stage Range Configuration" eyebrow="Primary · O-Level · A-Level school structure">
      <AdminMetricStrip items={[
        { label: 'Primary',  value: `Class 1-${config.terminalPrimary}`, detail: 'Configurable terminal year', tone: 'green'  },
        { label: 'O-Level',  value: 'Form 1–4',                   detail: 'CSEE at Form 4',              tone: 'blue'  },
        { label: 'A-Level',  value: 'Form 5–6',                   detail: 'ACSEE at Form 6',             tone: 'amber' },
        { label: 'Reg. Prefix', value: `${config.primaryPrefix} / ${config.oLevelPrefix} / ${config.aLevelPrefix}`,     detail: 'Stage-prefixed numbers',      tone: 'blue'  },
      ]} />

      {/* Stage overview cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(STAGE_DESCRIPTIONS).map(([key, { label, note, tone }]) => (
          <div key={key} className={`rounded-2xl border p-5 ${
            tone === 'emerald' ? 'border-emerald-200 bg-emerald-50'
          : tone === 'amber'   ? 'border-amber-200 bg-amber-50'
          :                      'border-blue-200 bg-blue-50'
          }`}>
            <p className={`text-[11px] font-black uppercase tracking-[0.24em] ${
              tone === 'emerald' ? 'text-emerald-700'
            : tone === 'amber'   ? 'text-amber-700'
            :                      'text-blue-700'
            }`}>{label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-700">{note}</p>
          </div>
        ))}
      </div>

      {/* Primary terminal year */}
      <AdminFormSection title="Primary Stage" subtitle="Define the terminal (exam) year for the primary stage">
        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="Terminal Primary Year"
            value={config.terminalPrimary}
            options={[
              { value: '6', label: 'Class 6 (6-year primary)' },
              { value: '7', label: 'Class 7 (7-year primary — Tanzania standard)' },
            ]}
            onChange={(value) => setConfigValue('terminalPrimary', value)}
          />
          <Field label="Primary Pass Mark (%)" type="number" value={config.primaryPassMark} onChange={(event) => setConfigValue('primaryPassMark', event.target.value)} />
          <Field label="Primary Registration Prefix" value={config.primaryPrefix} onChange={(event) => setConfigValue('primaryPrefix', event.target.value.toUpperCase())} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <StageToggle label="PSLE national exam registration" description="Enable PSLE index number field for terminal primary students" checked={config.primaryPsleIndex} onChange={(value) => setConfigValue('primaryPsleIndex', value)} />
          <StageToggle label="Holistic assessment fields" description="Show behaviour, reading, writing, numeracy on Primary report cards" checked={config.primaryHolistic} onChange={(value) => setConfigValue('primaryHolistic', value)} />
        </div>
      </AdminFormSection>

      {/* O-Level */}
      <AdminFormSection title="O-Level Stage" subtitle="Form 1–4 configuration. CSEE readiness template activates at Form 4.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Entry Form Level" value="Form 1" readOnly />
          <Field label="Terminal Form Level" value="Form 4" readOnly />
          <Field label="O-Level Registration Prefix" value={config.oLevelPrefix} onChange={(event) => setConfigValue('oLevelPrefix', event.target.value.toUpperCase())} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Failure Threshold (%)" type="number" value={config.oLevelFailure} onChange={(event) => setConfigValue('oLevelFailure', event.target.value)} />
          <Field label="At-Risk Threshold (%)" type="number" value={config.oLevelRisk} onChange={(event) => setConfigValue('oLevelRisk', event.target.value)} />
          <Field label="CSEE Division bands" value="I (7-17 pts)  II (18-21)  III (22-25)  IV (26-33)  0 (≥34)" readOnly />
        </div>
        <div className="mt-4">
          <StageToggle label="NECTA candidate number field" description="Show CSEE candidate number field when CSEE registration opens" checked={config.oLevelCandidateNumber} onChange={(value) => setConfigValue('oLevelCandidateNumber', value)} />
        </div>
      </AdminFormSection>

      {/* A-Level */}
      <AdminFormSection title="A-Level Stage" subtitle="Form 5–6. Combination-based subjects. ACSEE readiness template at Form 6.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Entry Form Level" value="Form 5" readOnly />
          <Field label="Terminal Form Level" value="Form 6" readOnly />
          <Field label="A-Level Registration Prefix" value={config.aLevelPrefix} onChange={(event) => setConfigValue('aLevelPrefix', event.target.value.toUpperCase())} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Failure Threshold (%)" type="number" value={config.aLevelFailure} onChange={(event) => setConfigValue('aLevelFailure', event.target.value)} />
          <Field label="At-Risk Threshold (%)" type="number" value={config.aLevelRisk} onChange={(event) => setConfigValue('aLevelRisk', event.target.value)} />
          <Field label="ACSEE Division bands" value="I (13-15 pts)  II (10-12)  III (7-9)  IV (4-6)  0 (≤3)" readOnly />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <StageToggle label="Require min. 2 principal subjects per combination" description="Block combination creation unless at least 2 principal subjects are present" checked={config.requirePrincipalSubjects} onChange={(value) => setConfigValue('requirePrincipalSubjects', value)} />
          <StageToggle label="Require compulsory subsidiary (General Studies)" description="Block combination creation unless COMPULSORY_SUBSIDIARY subject included" checked={config.requireCompulsorySubsidiary} onChange={(value) => setConfigValue('requireCompulsorySubsidiary', value)} />
        </div>
      </AdminFormSection>

      <div className="flex items-center gap-3">
        <Button className="rounded-xl bg-[#4338CA]" loading={updateSystemSettingsMutation.isPending} onClick={saveStageConfig}>Save Stage Config</Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-black text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </AdminShell>
  );
}

// ─── Cross-Stage Promotion (Gap 11) ───────────────────────────────────────────

const CROSS_STAGE_FLOWS = [
  {
    id: 'std7-form1',
    from: 'Standard 7 (Primary)',
    to: 'Form 1 (O-Level)',
    type: 'CROSS_STAGE',
    rule: 'Student must pass PSLE. New registration number issued: KS-S-YYYY-NNNNN.',
    badge: 'Primary → O-Level',
    tone: 'emerald' as const,
  },
  {
    id: 'form4-form5',
    from: 'Form 4 (O-Level)',
    to: 'Form 5 (A-Level)',
    type: 'CROSS_STAGE',
    rule: 'Student must select an A-Level combination. New registration number: KS-A-YYYY-NNNNN.',
    badge: 'O-Level → A-Level',
    tone: 'amber' as const,
  },
  {
    id: 'form6-graduation',
    from: 'Form 6 (A-Level)',
    to: 'Graduation',
    type: 'GRADUATION',
    rule: 'Student graduates. ACSEE results recorded. Status set to GRADUATED.',
    badge: 'A-Level → Graduate',
    tone: 'blue' as const,
  },
];

export function CrossStagePromotionPage() {
  const { data: apiClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };
  const { data: academicYears = [] } = useAcademicYears();
  const createClassPathwayMutation = useCreateClassPathwayMutation();
  const bulkPromoteMutation = useBulkPromoteMutation();
  const [selectedFlow, setSelectedFlow] = useState(CROSS_STAGE_FLOWS[0].id);
  const flow = CROSS_STAGE_FLOWS.find((f) => f.id === selectedFlow) ?? CROSS_STAGE_FLOWS[0];
  const currentYear = (academicYears as any[]).find((year) => year.isCurrent) ?? (academicYears as any[])[0];
  const [form, setForm] = useState({ academicYearId: '', fromClassId: '', toClassId: '' });

  const activeYearId = form.academicYearId || String(currentYear?.id ?? '');
  const sourceLevel = flow.id === 'std7-form1' ? '7' : flow.id === 'form4-form5' ? '4' : '6';
  const targetLevel = flow.id === 'std7-form1' ? '1' : flow.id === 'form4-form5' ? '5' : '';
  const sourceStage = flow.id === 'std7-form1' ? 'PRIMARY' : flow.id === 'form4-form5' ? 'O_LEVEL' : 'A_LEVEL';
  const targetStage = flow.id === 'std7-form1' ? 'O_LEVEL' : flow.id === 'form4-form5' ? 'A_LEVEL' : '';
  const norm = (value: unknown) => String(value ?? '').replace('-', '_').toUpperCase();
  const yearClasses = (apiClasses as any[]).filter((item) => !activeYearId || String(item.academicYearId ?? item.year ?? '') === activeYearId || !item.academicYearId);
  const sourceOptions = yearClasses
    .filter((item) => norm(item.educationStage ?? item.stage) === sourceStage && String(item.level ?? item.numericLevel) === sourceLevel)
    .map((item) => ({ value: String(item.id), label: String(item.name) }));
  const targetOptions = flow.type === 'GRADUATION' ? [] : yearClasses
    .filter((item) => norm(item.educationStage ?? item.stage) === targetStage && String(item.level ?? item.numericLevel) === targetLevel)
    .map((item) => ({ value: String(item.id), label: String(item.name) }));
  const fromClassId = form.fromClassId || sourceOptions[0]?.value || '';
  const toClassId = form.toClassId || targetOptions[0]?.value || '';
  const selectedFrom = sourceOptions.find((item) => item.value === fromClassId)?.label ?? 'Select source class';
  const selectedTo = flow.type === 'GRADUATION' ? 'Graduation' : targetOptions.find((item) => item.value === toClassId)?.label ?? 'Select destination class';

  useEffect(() => {
    setForm((current) => ({ ...current, fromClassId: '', toClassId: '' }));
  }, [selectedFlow, activeYearId]);

  const savePathway = async () => {
    if (!activeYearId || !fromClassId) {
      toast('Select academic year and source class first.', 'warning');
      return;
    }
    if (flow.type !== 'GRADUATION' && !toClassId) {
      toast('Select a destination class first.', 'warning');
      return;
    }
    await createClassPathwayMutation.mutateAsync({
      fromClassId,
      toClassId: flow.type === 'GRADUATION' ? null : toClassId,
      academicYearId: activeYearId,
      transitionType: flow.type,
      note: flow.rule,
    });
  };

  const runWorkflow = async () => {
    try {
      await savePathway();
      const result = await bulkPromoteMutation.mutateAsync({
        fromClassId,
        academicYearId: activeYearId,
        targetAcademicYearId: activeYearId,
      }) as any;
      const promoted = Number(result?.promoted?.length ?? 0);
      const blocked = Number(result?.blocked?.length ?? 0);
      const terminal = Number(result?.terminal?.length ?? 0);
      toast(terminal ? 'Graduation pathway saved.' : `Promotion completed: ${promoted} promoted, ${blocked} blocked.`, 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Promotion workflow failed', 'error');
    }
  };

  return (
    <AdminShell title="Cross-Stage Promotion Workflow" eyebrow="Primary → O-Level · O-Level → A-Level · Graduation">
      <div className="grid gap-3 lg:grid-cols-3">
        {CROSS_STAGE_FLOWS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFlow(f.id)}
            className={`rounded-2xl border p-5 text-left shadow-sm transition ${
              selectedFlow === f.id
                ? 'border-[#4338CA] bg-[#EEF2FF] ring-2 ring-[#4338CA]/30'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <Badge tone={f.tone === 'emerald' ? 'emerald' : f.tone === 'amber' ? 'amber' : 'blue'}>{f.type}</Badge>
              <span className="text-xs font-black text-slate-400">{f.badge}</span>
            </div>
            <p className="mt-4 font-display text-xl font-black text-slate-950">{f.from}</p>
            <p className="text-sm font-bold text-slate-400">to {f.to}</p>
            <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">{f.rule}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <AdminFormSection title={`${flow.from} to ${flow.to}`} subtitle="Configure the real class pathway, then run bulk promotion for active enrolments.">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="Academic Year" value={activeYearId} onChange={(value) => setForm((p) => ({ ...p, academicYearId: value }))} options={(academicYears as any[]).map((year) => ({ value: String(year.id), label: String(year.name ?? year.year ?? year.id) }))} />
              <SelectField label="Source Class" value={fromClassId} onChange={(value) => setForm((p) => ({ ...p, fromClassId: value }))} options={sourceOptions.length ? sourceOptions : [{ value: '', label: `No ${sourceLevel} source classes found` }]} />
              {flow.type === 'GRADUATION'
                ? <Field label="Destination" value="Graduation" readOnly />
                : <SelectField label="Destination Class" value={toClassId} onChange={(value) => setForm((p) => ({ ...p, toClassId: value }))} options={targetOptions.length ? targetOptions : [{ value: '', label: `No ${targetLevel} target classes found` }]} />}
            </div>
          </AdminFormSection>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Workflow effects</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                flow.type === 'GRADUATION' ? 'Student status becomes GRADUATED' : 'Previous active enrolment is closed',
                flow.type === 'GRADUATION' ? 'Graduation pathway is saved' : `New enrolment is created in ${selectedTo}`,
                flow.id === 'std7-form1' ? 'New KS-S registration is issued' : flow.id === 'form4-form5' ? 'New KS-A registration is issued' : 'Terminal student record is preserved',
                'Promotion audit event is published',
              ].map((item) => (
                <div key={item} className="flex gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4338CA]" /> {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Selected Flow</p>
          <h3 className="mt-2 font-display text-xl font-black text-slate-950">{selectedFrom} to {selectedTo}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{flow.rule}</p>
          <div className="mt-4">
            <Badge tone={flow.tone === 'emerald' ? 'emerald' : flow.tone === 'amber' ? 'amber' : 'blue'}>{flow.type}</Badge>
          </div>
          <Button className="mt-6 w-full rounded-xl bg-[#4338CA]" loading={createClassPathwayMutation.isPending || bulkPromoteMutation.isPending} onClick={runWorkflow}>
            <Play className="h-4 w-4" /> Save and Run
          </Button>
          <Button variant="secondary" className="mt-2 w-full rounded-xl" loading={createClassPathwayMutation.isPending} onClick={() => savePathway().then(() => toast('Pathway saved.', 'success')).catch((error) => toast(error instanceof Error ? error.message : 'Failed to save pathway', 'error'))}>
            Save Pathway Only
          </Button>
          <p className="mt-3 text-center text-xs font-semibold text-slate-400">Uses configured ClassPathway and active enrolments.</p>
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function useUser() {
  const { id } = useParams();
  const { data: apiUsers = [] as typeof adminUsers, isLoading } = useAdminUsers() as { data: typeof adminUsers; isLoading: boolean };
  return useMemo(() => ({
    loading: isLoading,
    user: isLoading ? null : (apiUsers.find((u) => u.id === id) ?? null),
  }), [id, apiUsers, isLoading]);
}
