import { AlertTriangle, CheckCircle2, Download, Play, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  adminAuditEvents, adminClasses, adminStudents, adminSubjects,
  adminUsers, assessmentTypes, classPathways, gradingScales, notificationLogs,
  mixedSchoolApiContracts, notificationTemplates, reportJobs, serviceHealth,
  subjectCombinations,
} from '../api/adminApi';
import {
  useAdminAuditEvents,
  useAdminClasses,
  useAdminReportJobs,
  useAdminStudents,
  useAdminSubjects,
  useAdminUsers,
  useAssessmentTypes,
  useClassPathways,
  useGradingScales,
  useNotificationLogs,
  useNotificationTemplates,
  useServiceHealth,
  useSubjectCombinations,
} from '../api/admin.hooks';
import { useFeeCategories } from '../../finance/api/finance.hooks';
import { useAnnouncements } from '../../common/common.hooks';
import {
  AdminDataTable, AdminFormSection, AdminMetricStrip, AdminQuickCard,
  AdminShell, AdminStatusIndicator, AssessmentTypeEditor, CsvImportZone,
  DangerActionDialog, FeatureToggle, Field, GradingBoundaryEditor,
  JsonInspector, NotificationTemplateEditor, PendingIntegration,
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
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const getStatus = (user: { id: string; status: string }) => statuses[user.id] ?? user.status;
  const toggle = (id: string, current: string) =>
    setStatuses((prev) => ({ ...prev, [id]: current === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' }));

  if (isLoading) return <SkeletonTable cols={7} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (!apiUsers.length) return <EmptyState title="No users found" description="Create the first user account to get started." />;
  return (
    <AdminDataTable columns={['Name', 'Email', 'Role', 'Status', 'Linked Entity', 'Last Login', 'Actions']}>
      {apiUsers.map((user) => (
        <tr key={user.id} className="hover:bg-slate-50">
          <Td>
            <p className="font-black text-slate-900">{user.name}</p>
          </Td>
          <Td className="text-slate-500">{user.email}</Td>
          <Td>
            <Badge tone={user.role === 'ADMIN' ? 'rose' : 'blue'}>{user.role}</Badge>
          </Td>
          <Td>
            <Badge tone={getStatus(user) === 'ACTIVE' ? 'emerald' : getStatus(user) === 'LOCKED' ? 'amber' : 'slate'}>
              {getStatus(user)}
            </Badge>
          </Td>
          <Td className="text-slate-500">{user.linked}</Td>
          <Td className="text-xs text-slate-400">{String(user.lastLogin ?? '').slice(0, 10)}</Td>
          <Td>
            <div className="flex items-center gap-3">
              <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/users/${user.id}`}>Edit</NavLink>
              <button onClick={() => toggle(user.id, getStatus(user))} className="text-xs font-black text-slate-500 transition hover:text-slate-900">
                {getStatus(user) === 'LOCKED' ? 'Unlock' : 'Lock'}
              </button>
              <button className="text-xs font-black text-slate-400 transition hover:text-slate-700">Reset PW</button>
            </div>
          </Td>
        </tr>
      ))}
    </AdminDataTable>
  );
}

// ─── Create / Edit user ───────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'TEACHER',   label: 'Teacher'            },
  { value: 'HOD',       label: 'Head of Department' },
  { value: 'AQA',       label: 'AQA Officer'        },
  { value: 'FINANCE',   label: 'Finance Officer'    },
  { value: 'PRINCIPAL', label: 'Principal'          },
  { value: 'ADMIN',     label: 'System Admin'       },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE',   label: 'Active — can log in'             },
  { value: 'INACTIVE', label: 'Inactive — no access'            },
  { value: 'PENDING',  label: 'Pending — first login required'  },
];

function rolePermissions(role: string): string[] {
  const map: Record<string, string[]> = {
    TEACHER:   ['Marks entry and attendance', 'Class analytics', 'Announcements inbox'],
    HOD:       ['Marks approval queue', 'Department analytics', 'Teacher performance view'],
    AQA:       ['Performance engine access', 'Academic alerts', 'Exam & moderation tools'],
    FINANCE:   ['Invoice management', 'Payment recording', 'Fee structure management'],
    PRINCIPAL: ['School health dashboard', 'Executive approvals', 'Full analytics read'],
    ADMIN:     ['User management', 'System settings', 'All modules — read / write'],
  };
  return map[role] ?? ['Standard workspace access'];
}

export function CreateUserPage() {
  const [role, setRole] = useState('TEACHER');
  const isPrivileged = roleRisk(role) === 'high';

  return (
    <AdminShell title="Create User" eyebrow="Identity and role provisioning">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <AdminFormSection title="Identity" subtitle="Staff name, email address, and contact number">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Full Name" placeholder="e.g. Amina Rashidi" />
              <Field label="Email Address" type="email" placeholder="name@school.ac.tz" />
              <Field label="Phone Number" type="tel" placeholder="+255 7XX XXX XXX" />
            </div>
          </AdminFormSection>

          <AdminFormSection title="Role & Access" subtitle="Role determines the workspace and permission set assigned">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="Role" options={ROLE_OPTIONS} value={role} onChange={setRole} />
              <Field label="Linked Entity / Department" placeholder="e.g. Science Department" />
              <SelectField label="Account Status" options={STATUS_OPTIONS} />
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

          <Button className="rounded-xl bg-[#4338CA]">
            <UserPlus className="h-4 w-4" /> Create User
          </Button>
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
    </AdminShell>
  );
}

export function UserDetailPage() {
  const user = useUser();
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
  const user = useUser();
  const [role, setRole] = useState(user.role);
  const isPrivileged = roleRisk(role) === 'high';
  return (
    <AdminShell title={`Edit ${user.name}`} eyebrow="Account update">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          <AdminFormSection title="Identity" subtitle="Name, email, and contact details">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Full Name" value={user.name} />
              <Field label="Email Address" type="email" value={user.email} />
              <Field label="Phone Number" type="tel" placeholder="+255 7XX XXX XXX" />
            </div>
          </AdminFormSection>
          <AdminFormSection title="Role & Access" subtitle="Role and linked entity assignment">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="Role" options={ROLE_OPTIONS} value={role} onChange={setRole} />
              <Field label="Linked Entity" value={user.linked} />
              <SelectField label="Account Status" options={STATUS_OPTIONS} value={user.status} />
            </div>
            {isPrivileged && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">
                  <span className="font-black">{role}</span> is a privileged role. Confirm authorisation before saving.
                </p>
              </div>
            )}
          </AdminFormSection>
          <Button className="rounded-xl bg-[#4338CA]">Save User</Button>
        </div>
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

export function ClassesPage() {
  const { data: apiClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };
  const { data: apiPathways = [] as typeof classPathways } = useClassPathways() as { data: typeof classPathways };
  const { data: apiCombinations = [] as typeof subjectCombinations } = useSubjectCombinations() as { data: typeof subjectCombinations };

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
        subtitle="Production-ready contract for Primary, O-Level and A-Level class creation."
        badge={<Badge tone="emerald">API ready</Badge>}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Education Stage" value="O_LEVEL" options={[
            { value: 'PRIMARY', label: 'Primary' },
            { value: 'O_LEVEL', label: 'O-Level' },
            { value: 'A_LEVEL', label: 'A-Level' },
          ]} />
          <Field label="Class/Form Level" value="4" type="number" />
          <Field label="Display Name" value="Form 4A" />
          <Field label="Stream or Combination" value="A / PCM" />
          <Field label="Academic Year ID" placeholder="active-academic-year-id" />
          <Field label="Class Teacher ID" placeholder="teacher-user-id" />
          <Field label="Capacity" value="40" type="number" />
          <Field label="Curriculum Code" value="NECTA_OLEVEL" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <FeatureToggle label="Terminal year" description="Required for Form 4, Form 6 and final primary year." enabled />
          <FeatureToggle label="Validate stage range" description="Blocks Class/Form level collisions before submit." enabled />
          <FeatureToggle label="Create pathway next" description="Immediately opens pathway setup after class save." enabled />
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
        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Promotion Pathways</p>
            <div className="mt-4 grid gap-3">
              <SelectField label="From Class" value="form-4a" options={apiClasses.map((item) => ({ value: item.id, label: item.name }))} />
              <SelectField label="Transition Type" value="CROSS_STAGE" options={[
                { value: 'PROMOTION', label: 'Promotion' },
                { value: 'CROSS_STAGE', label: 'Cross-stage' },
                { value: 'GRADUATION', label: 'Graduation' },
                { value: 'TRANSFER', label: 'Transfer' },
              ]} />
              <SelectField label="To Class" value="form-5-pcm" options={[{ value: '', label: 'No class / graduation' }, ...apiClasses.map((item) => ({ value: item.id, label: item.name }))]} />
            </div>
            <div className="mt-4 space-y-3">
              {apiPathways.map((pathway) => (
                <div key={pathway.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-900">{pathway.from} {'->'} {pathway.to}</p>
                    <Badge tone={pathway.type === 'Graduation' ? 'emerald' : 'blue'}>{pathway.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{pathway.rule}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] border border-amber-100 bg-amber-50 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-700">A-Level Combinations</p>
            <div className="mt-4 grid gap-3 rounded-2xl bg-white p-3 shadow-sm">
              <Field label="Combination Code" value="PCM" />
              <Field label="Principal Subjects" value="Physics, Chemistry, Mathematics" />
              <Field label="Bulk Assign Class" value="Form 5 PCM" />
            </div>
            <div className="mt-4 space-y-3">
              {apiCombinations.map((combo) => (
                <div key={combo.id} className="rounded-2xl bg-white p-3 shadow-sm">
                  <p className="font-black text-slate-900">{combo.code} <span className="text-xs text-slate-400">({combo.students} students)</span></p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{combo.subjects}</p>
                  <p className="mt-1 text-[11px] font-bold text-amber-700">Principal: {combo.principal}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <AdminDataTable columns={['Method', 'Endpoint', 'Purpose', 'Status']} minWidth={980}>
        {mixedSchoolApiContracts.map((contract) => (
          <tr key={contract.path} className="hover:bg-slate-50">
            <Td><Badge tone="slate">{contract.method}</Badge></Td>
            <Td className="font-mono text-xs text-slate-500">{contract.path}</Td>
            <Td>{contract.purpose}</Td>
            <Td><Badge tone="emerald">Ready for integration</Badge></Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

export function ClassDetailPage() {
  const { classId } = useParams();
  const { data: apiClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };
  const klass = apiClasses.find((c) => c.id === classId) ?? apiClasses[0] ?? adminClasses[0];
  return (
    <AdminShell title={klass.name} eyebrow="Class detail">
      <StudentsTable />
      <AdminQuickCard title="Assign Subjects" detail="Class-subject assignment matrix." to="/admin/academic/setup" />
    </AdminShell>
  );
}

// ─── Subjects ─────────────────────────────────────────────────────────────────

export function SubjectsPage() {
  return <AdminShell title="Subject Management" eyebrow="Subjects, departments, assignments"><SubjectsTable /></AdminShell>;
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
  const { data: apiSubjects = [] as typeof adminSubjects } = useAdminSubjects() as { data: typeof adminSubjects };
  const subject = apiSubjects.find((s) => s.id === subjectId) ?? apiSubjects[0] ?? adminSubjects[0];
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
  return (
    <AdminShell title="Grading Scales" eyebrow="Grade boundaries and activation">
      {apiGradingScales.map((scale) => (
        <div key={scale.id} className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">{scale.scope}</p>
            <Badge tone={scale.active ? 'emerald' : 'amber'}>{scale.active ? 'Active' : 'Draft'}</Badge>
          </div>
          <GradingBoundaryEditor scale={scale} />
        </div>
      ))}
      <NavLink to="/admin/grading/create">
        <Button variant="secondary" className="rounded-xl">+ Create New Scale</Button>
      </NavLink>
      <DangerActionDialog title="Activate Grading Scale" entity="Kilimanjaro Standard 2026" confirmation="ACTIVATE" />
    </AdminShell>
  );
}

export function CreateGradingScalePage() {
  return (
    <AdminShell title="Create Grading Scale" eyebrow="Boundary validation">
      <GradingBoundaryEditor scale={{ id: 'new', name: 'New Scale', active: false, boundaries: [{ label: 'A', min: 80, max: 100 }, { label: 'B', min: 65, max: 79 }, { label: 'C', min: 50, max: 64 }, { label: 'D', min: 35, max: 49 }, { label: 'F', min: 0, max: 34 }] }} />
    </AdminShell>
  );
}

// ─── Assessment types ─────────────────────────────────────────────────────────

export function AssessmentTypesPage() {
  const { data: apiAssessmentTypes = [] as typeof assessmentTypes } = useAssessmentTypes() as { data: typeof assessmentTypes };
  const oLevelTypes = apiAssessmentTypes.filter((type) => type.scope === 'O-Level');
  const total = assessmentWeightsTotal(oLevelTypes.map((t) => t.weight));
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
      <AssessmentTypeEditor types={apiAssessmentTypes} />
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
          <Td className="font-mono text-xs">TZS {student.balance.toLocaleString('en-US')}</Td>
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

export function EnrolStudentPage() {
  const { data: enrolClasses = [] as typeof adminClasses } = useAdminClasses() as { data: typeof adminClasses };
  const [step, setStep] = useState(0);
  const prev = () => setStep((s) => Math.max(0, s - 1));
  const next = () => setStep((s) => Math.min(ENROL_STEPS.length - 1, s + 1));

  return (
    <AdminShell title="Enrol Student" eyebrow="Admission workflow">
      {/* Step progress bar */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex min-w-max items-center gap-0">
          {ENROL_STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <button onClick={() => setStep(i)} className="flex items-center gap-2">
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
            <Field label="First Name"          placeholder="e.g. Amina" />
            <Field label="Middle Name"         placeholder="Optional" />
            <Field label="Last Name"           placeholder="e.g. Baraka" />
            <Field label="Date of Birth"       type="date" />
            <SelectField label="Gender" options={[{ value: 'F', label: 'Female' }, { value: 'M', label: 'Male' }]} />
            <Field label="National ID / Birth Cert No." placeholder="e.g. 19XXXXXXXXXXXXXXXXX" />
          </div>
        </AdminFormSection>
      )}

      {step === 1 && (
        <AdminFormSection title="Admission Details" subtitle="School admission and intake records">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Admission Date"   type="date" />
            <Field label="Admission Number" placeholder="e.g. KS-2026-00120" />
            <SelectField label="Intake Stream" options={[
              { value: 'science',     label: 'Science'    },
              { value: 'arts',        label: 'Arts'       },
              { value: 'commercial',  label: 'Commercial' },
            ]} />
            <Field label="Previous School"  placeholder="e.g. Moshi Primary School" />
            <Field label="PSLE Score"       type="number" placeholder="e.g. 320" />
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
            <SelectField label="Academic Year" options={[{ value: '2026', label: '2026' }, { value: '2027', label: '2027' }]} />
            <SelectField label="Form Level" options={[
              { value: 'Form 1', label: 'Form 1' },
              { value: 'Form 2', label: 'Form 2' },
              { value: 'Form 3', label: 'Form 3' },
              { value: 'Form 4', label: 'Form 4' },
            ]} />
            <SelectField label="Class Section" options={enrolClasses.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))} />
          </div>
        </AdminFormSection>
      )}

      {step === 3 && (
        <AdminFormSection title="Guardian Records" subtitle="Primary and secondary contact persons">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Guardian 1 Full Name" placeholder="e.g. Baraka Juma" />
            <Field label="Phone Number"         type="tel" placeholder="+255 7XX XXX XXX" />
            <SelectField label="Relationship" options={[
              { value: 'father',   label: 'Father'         },
              { value: 'mother',   label: 'Mother'         },
              { value: 'guardian', label: 'Legal Guardian' },
              { value: 'sibling',  label: 'Sibling'        },
              { value: 'other',    label: 'Other'          },
            ]} />
            <Field label="Guardian 2 Full Name" placeholder="Optional" />
            <Field label="Guardian 2 Phone"     type="tel" placeholder="Optional" />
            <Field label="Email (for reports)"  type="email" placeholder="Optional" />
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
              <Field label="Username (auto-generated)" value="amina.baraka.2026" readOnly />
              <Field label="Temporary Password" type="password" placeholder="Sent via SMS to guardian on creation" />
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
              ['Student', 'Amina Baraka Juma'],
              ['Date of Birth', '2010-03-15'],
              ['Gender', 'Female'],
              ['Class', 'Form 2A'],
              ['Admission No.', 'KS-2026-00120'],
              ['Guardian', 'Baraka Juma · +255712…'],
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
          <Button variant="secondary" className="rounded-xl" onClick={prev}>← Back</Button>
        )}
        {step < ENROL_STEPS.length - 1 ? (
          <Button className="rounded-xl bg-[#4338CA]" onClick={next}>Next →</Button>
        ) : (
          <Button className="rounded-xl bg-[#4338CA]">
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
  const { data: apiStudents = [] as typeof adminStudents } = useAdminStudents() as { data: typeof adminStudents };
  const student = apiStudents.find((s) => s.id === id) ?? apiStudents[0] ?? adminStudents[0];
  return (
    <AdminShell title={student.name} eyebrow="Admin student profile">
      {/* Quick stats */}
      <AdminMetricStrip items={[
        { label: 'Registration', value: student.registration, detail: student.className, tone: 'blue' },
        { label: 'Status',       value: student.status,       detail: 'Active registry',  tone: 'green' },
        { label: 'Guardians',    value: String(student.guardians), detail: 'on record', tone: 'blue' },
        { label: 'Balance',      value: `TZS ${student.balance.toLocaleString('en-US')}`, detail: 'Outstanding', tone: student.balance > 0 ? 'amber' : 'green' },
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

const FALLBACK_FEE_CATEGORIES = [
  { code: 'TUI', name: 'Tuition',  type: 'Mandatory', amount: 120000, used: 4 },
  { code: 'BRD', name: 'Boarding', type: 'Optional',  amount: 340000, used: 2 },
  { code: 'MLS', name: 'Meals',    type: 'Optional',  amount: 220000, used: 3 },
  { code: 'ICT', name: 'ICT',      type: 'Optional',  amount: 80000,  used: 2 },
];

export function AdminFeeCategoriesPage() {
  const { data: rawCategories } = useFeeCategories() as { data: Array<{ id?: string; code?: string; name?: string; type?: string; category?: string; amount?: number; defaultAmount?: number; usedByStructures?: number }> | undefined };
  const categories = rawCategories && rawCategories.length > 0
    ? rawCategories.map((c) => ({
        code: c.code ?? c.id ?? '',
        name: c.name ?? '',
        type: c.type ?? c.category ?? 'Optional',
        amount: c.amount ?? c.defaultAmount ?? 0,
        used: c.usedByStructures ?? 0,
      }))
    : FALLBACK_FEE_CATEGORIES;
  return (
    <AdminShell title="Fee Categories" eyebrow="Finance setup with dependency safety">
      <AdminDataTable columns={['Code', 'Name', 'Type', 'Amount', 'Used By', 'Actions']}>
        {categories.map((cat) => (
          <tr key={cat.code} className="hover:bg-slate-50">
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
  return (
    <AdminShell title="Performance Engine" eyebrow="Thresholds, pairing rules, manual run">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-gutter">
          <AdminFormSection title="Risk Thresholds" subtitle="Score boundaries that trigger at-risk classification">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Failure Boundary (%)"   type="number" value="35" />
              <Field label="At-Risk Boundary (%)"   type="number" value="48" />
              <Field label="Excellence Boundary (%)" type="number" value="85" />
            </div>
          </AdminFormSection>
          <AdminFormSection title="Pairing Rules" subtitle="Conditions for peer-pairing and intervention matching">
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Pairing Strategy" options={[
                { value: 'buddy', label: 'Peer buddy (same class)' },
                { value: 'mentor', label: 'Cross-class mentor'     },
              ]} />
              <Field label="Max Pairs Per Run" type="number" value="20" />
            </div>
          </AdminFormSection>
        </div>
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Manual Trigger</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">Last run: today 06:00 · 312 students processed</p>
          <Button className="mt-4 w-full rounded-xl bg-[#4338CA]">
            <Play className="h-4 w-4" /> Run Engine Now
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
  const { data: apiTemplates = [] as typeof notificationTemplates } = useNotificationTemplates() as { data: typeof notificationTemplates };
  const tpl = apiTemplates.find((t) => t.id === id) ?? apiTemplates[0] ?? notificationTemplates[0];
  return <AdminShell title={tpl.name} eyebrow="Template editor"><NotificationTemplateEditor template={tpl} /></AdminShell>;
}

export function SendManualNotificationPage() {
  return (
    <AdminShell title="Send Manual Notification" eyebrow="Controlled communication">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <AdminFormSection title="Message" subtitle="Audience, channel, body, and schedule">
          <div className="grid gap-4 md:grid-cols-2">
            <SelectField label="Audience" options={[
              { value: 'all',      label: 'All staff and guardians' },
              { value: 'parents',  label: 'Parents / guardians only' },
              { value: 'teachers', label: 'Teachers only'           },
              { value: 'class',    label: 'Specific class'          },
            ]} value="Parents" />
            <SelectField label="Channel" options={[
              { value: 'SMS',   label: 'SMS'            },
              { value: 'Email', label: 'Email'          },
              { value: 'Push',  label: 'Push (app)'     },
              { value: 'All',   label: 'All channels'   },
            ]} />
            <SelectField label="Priority" options={[
              { value: 'normal', label: 'Normal'  },
              { value: 'high',   label: 'High'    },
              { value: 'urgent', label: 'Urgent'  },
            ]} />
            <SelectField label="Schedule" options={[
              { value: 'now',    label: 'Send now'        },
              { value: 'later',  label: 'Schedule later'  },
            ]} />
          </div>
          <textarea className="mt-4 h-36 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white" placeholder="Message body…" />
        </AdminFormSection>
        <DangerActionDialog title="Send Manual Notification" entity="All selected audience" confirmation="SEND" />
      </div>
    </AdminShell>
  );
}

export function NotificationLogsPage() {
  const { data: apiLogs = [] as typeof notificationLogs } = useNotificationLogs() as { data: typeof notificationLogs };
  return (
    <AdminShell title="Notification Logs" eyebrow="Delivery inspection">
      <AdminDataTable columns={['Time', 'Channel', 'Recipient', 'Event', 'Status', 'Attempts', 'Provider', 'Payload']}>
        {apiLogs.map((log) => (
          <tr key={log.id} className="hover:bg-slate-50">
            <Td className="text-xs text-slate-400">{log.time.slice(0, 16).replace('T', ' ')}</Td>
            <Td><Badge tone="blue">{log.channel}</Badge></Td>
            <Td className="font-mono text-xs text-slate-500">{log.recipient}</Td>
            <Td className="text-xs">{log.eventType}</Td>
            <Td><Badge tone={log.status === 'FAILED' ? 'rose' : 'emerald'}>{log.status}</Badge></Td>
            <Td>{log.attempts}</Td>
            <Td className="text-xs text-slate-500">{log.provider}</Td>
            <Td><JsonInspector value={log} /></Td>
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
  const { data: apiReportJobs = [] as typeof reportJobs } = useAdminReportJobs() as { data: typeof reportJobs };
  const job = apiReportJobs.find((r) => r.id === id) ?? apiReportJobs[0] ?? reportJobs[0];
  return (
    <AdminShell title={job.name} eyebrow="Report detail">
      <AdminMetricStrip items={[
        { label: 'Status',    value: job.status,       detail: job.format  },
        { label: 'Scope',     value: job.scope,        detail: job.role    },
        { label: 'Requested', value: job.requestedBy,  detail: job.created.slice(0, 10) },
      ]} />
      <Button className="rounded-xl bg-[#4338CA]"><Download className="h-4 w-4" /> Download</Button>
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
      <PendingIntegration endpoint="GET /admin/audit/system" />
      <AuditPanel />
    </AdminShell>
  );
}

function AuditPanel() {
  const { data: apiAudit = [] as typeof adminAuditEvents } = useAdminAuditEvents() as { data: typeof adminAuditEvents };
  return (
    <div className="space-y-3">
      {apiAudit.map((event) => (
        <div key={event.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-widest text-slate-500">
            {event.time.slice(0, 16).replace('T', ' ')} · {event.actor}
          </p>
          <h3 className="mt-1 font-display text-xl font-black text-slate-950">{event.action}</h3>
          <p className="text-sm font-semibold text-slate-500">{event.entity}</p>
          <div className="mt-3">
            <JsonInspector value={event.payload} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── System settings ──────────────────────────────────────────────────────────

export function SystemSettingsPage() {
  return (
    <AdminShell title="System Settings" eyebrow="Infrastructure, providers, security">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          <AdminFormSection title="School Identity" subtitle="Official name, contact details, and branding">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="School Name"        value="Kilimanjaro Schools" />
              <Field label="Official Email"     type="email" value="info@ks.ac.tz" />
              <Field label="Contact Phone"      type="tel"   value="+255 27 275 xxxx" />
              <Field label="Physical Location"  value="Moshi, Kilimanjaro, Tanzania" />
            </div>
          </AdminFormSection>

          <AdminFormSection title="Security Policy" subtitle="Password rules, session management, and access controls">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Min Password Length"        type="number" value="8" />
              <Field label="Session Timeout (min)"      type="number" value="60" />
              <Field label="Login Lockout (attempts)"   type="number" value="5" />
            </div>
            <div className="mt-4 space-y-2">
              <FeatureToggle label="Two-Factor Authentication"       description="Require 2FA for admin and principal roles" enabled />
              <FeatureToggle label="Force Password Reset First Login" description="New accounts must change password immediately" enabled />
            </div>
          </AdminFormSection>

          <AdminFormSection title="Notification Providers" subtitle="SMS, email, and push gateway configuration">
            <div className="grid gap-4 md:grid-cols-3">
              <SelectField label="SMS Provider" value="beem" options={[
                { value: 'beem',            label: 'Beem Africa'       },
                { value: 'africastalking',  label: "Africa's Talking"  },
                { value: 'nexmo',           label: 'Vonage / Nexmo'    },
              ]} />
              <SelectField label="Email Provider" options={[
                { value: 'sendgrid', label: 'SendGrid'    },
                { value: 'ses',      label: 'Amazon SES'  },
                { value: 'smtp',     label: 'Custom SMTP' },
              ]} />
              <SelectField label="Push Provider" value="fcm" options={[
                { value: 'fcm',  label: 'Firebase FCM' },
                { value: 'apns', label: 'Apple APNS'   },
              ]} />
            </div>
          </AdminFormSection>

          <AdminFormSection title="Feature Flags" subtitle="Enable or disable system-wide capabilities">
            <div className="space-y-2">
              <FeatureToggle label="Automatic AQA Alerts"        description="Performance engine triggers real-time risk alerts" enabled />
              <FeatureToggle label="Parent Portal Access"        description="Allow guardians to view student progress online" />
              <FeatureToggle label="Online Payments (M-Pesa)"    description="Enable mobile money and bank payment channels" enabled />
              <FeatureToggle label="Bulk SMS Campaigns"          description="Allow batch notifications to all guardians" />
              <FeatureToggle label="PDF Report Card Generation"  description="Auto-generate PDF report cards each term end" enabled />
              <FeatureToggle label="Maintenance Mode"            description="Block all non-admin logins during maintenance" />
            </div>
          </AdminFormSection>
        </div>

        <DangerActionDialog title="Reset All Sessions" entity="All active users" confirmation="RESET" />
      </div>
    </AdminShell>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────

const FALLBACK_ADMIN_ANNOUNCEMENTS = [
  { title: 'Results publishing window', author: 'Principal', audience: 'All roles', status: 'ACTIVE', priority: 'High' },
  { title: 'Parent meeting — Term II',  author: 'Admin',     audience: 'Parents',   status: 'ACTIVE', priority: 'Normal' },
  { title: 'Fee reminder — May 2026',   author: 'Admin',     audience: 'Guardians', status: 'ACTIVE', priority: 'High' },
];

export function AdminAnnouncementsPage() {
  const { data: rawAnnouncements } = useAnnouncements() as { data: Array<{ id?: string; title?: string; author?: string; createdBy?: string; audience?: string; targetRoles?: string[]; status?: string; priority?: string }> | undefined };
  const items = rawAnnouncements && rawAnnouncements.length > 0
    ? rawAnnouncements.map((a) => ({
        title: a.title ?? '',
        author: a.author ?? a.createdBy ?? 'Admin',
        audience: a.audience ?? ((a.targetRoles ?? []).join(', ') || 'All roles'),
        status: a.status?.toUpperCase() ?? 'ACTIVE',
        priority: a.priority ?? 'Normal',
      }))
    : FALLBACK_ADMIN_ANNOUNCEMENTS;
  return (
    <AdminShell title="Announcements Admin" eyebrow="Create, edit, cancel with reason">
      <AdminDataTable columns={['Title', 'Author', 'Audience', 'Status', 'Priority', 'Actions']}>
        {items.map((item) => (
          <tr key={item.title} className="hover:bg-slate-50">
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

export function StageConfigPage() {
  const [terminalPrimary, setTerminalPrimary] = useState('7');
  const [saved, setSaved] = useState(false);

  return (
    <AdminShell title="Stage Range Configuration" eyebrow="Primary · O-Level · A-Level school structure">
      <AdminMetricStrip items={[
        { label: 'Primary',  value: `Class 1–${terminalPrimary}`, detail: 'Configurable terminal year', tone: 'green'  },
        { label: 'O-Level',  value: 'Form 1–4',                   detail: 'CSEE at Form 4',              tone: 'blue'  },
        { label: 'A-Level',  value: 'Form 5–6',                   detail: 'ACSEE at Form 6',             tone: 'amber' },
        { label: 'Reg. Prefix', value: 'KS-P / KS-S / KS-A',     detail: 'Stage-prefixed numbers',      tone: 'blue'  },
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
            value={terminalPrimary}
            options={[
              { value: '6', label: 'Class 6 (6-year primary)' },
              { value: '7', label: 'Class 7 (7-year primary — Tanzania standard)' },
            ]}
            onChange={setTerminalPrimary}
          />
          <Field label="Primary Pass Mark (%)" type="number" value="50" readOnly />
          <Field label="Primary Registration Prefix" value="KS-P" readOnly />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FeatureToggle label="PSLE national exam registration" description="Enable PSLE index number field for Standard 7 students" enabled />
          <FeatureToggle label="Holistic assessment fields" description="Show behaviour, reading, writing, numeracy on Primary report cards" enabled />
        </div>
      </AdminFormSection>

      {/* O-Level */}
      <AdminFormSection title="O-Level Stage" subtitle="Form 1–4 configuration. CSEE readiness template activates at Form 4.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Entry Form Level" value="Form 1" readOnly />
          <Field label="Terminal Form Level" value="Form 4" readOnly />
          <Field label="O-Level Registration Prefix" value="KS-S" readOnly />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Failure Threshold (%)" type="number" value="40" />
          <Field label="At-Risk Threshold (%)" type="number" value="50" />
          <Field label="CSEE Division bands" value="I (7-17 pts)  II (18-21)  III (22-25)  IV (26-33)  0 (≥34)" readOnly />
        </div>
        <div className="mt-4">
          <FeatureToggle label="NECTA candidate number field" description="Show CSEE candidate number field when CSEE registration opens" enabled />
        </div>
      </AdminFormSection>

      {/* A-Level */}
      <AdminFormSection title="A-Level Stage" subtitle="Form 5–6. Combination-based subjects. ACSEE readiness template at Form 6.">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Entry Form Level" value="Form 5" readOnly />
          <Field label="Terminal Form Level" value="Form 6" readOnly />
          <Field label="A-Level Registration Prefix" value="KS-A" readOnly />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Failure Threshold (%)" type="number" value="25" />
          <Field label="At-Risk Threshold (%)" type="number" value="35" />
          <Field label="ACSEE Division bands" value="I (13-15 pts)  II (10-12)  III (7-9)  IV (4-6)  0 (≤3)" readOnly />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <FeatureToggle label="Require min. 2 principal subjects per combination" description="Block combination creation unless ≥2 principal subjects present" enabled />
          <FeatureToggle label="Require compulsory subsidiary (General Studies)" description="Block combination creation unless COMPULSORY_SUBSIDIARY subject included" enabled />
        </div>
      </AdminFormSection>

      <div className="flex items-center gap-3">
        <Button className="rounded-xl bg-[#4338CA]" onClick={() => setSaved(true)}>Save Stage Config</Button>
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
  const [selectedFlow, setSelectedFlow] = useState(CROSS_STAGE_FLOWS[0].id);
  const flow = CROSS_STAGE_FLOWS.find((f) => f.id === selectedFlow) ?? CROSS_STAGE_FLOWS[0];

  return (
    <AdminShell title="Cross-Stage Promotion Workflow" eyebrow="Primary → O-Level · O-Level → A-Level · Graduation">
      <AdminMetricStrip items={[
        { label: 'Std 7 → Form 1', value: 'CROSS_STAGE', detail: 'New KS-S reg. number',  tone: 'green' },
        { label: 'Form 4 → Form 5', value: 'CROSS_STAGE', detail: 'New KS-A reg. number', tone: 'amber' },
        { label: 'Form 6 → Graduate', value: 'GRADUATION', detail: 'Status = GRADUATED',  tone: 'blue'  },
      ]} />

      {/* Flow selector */}
      <div className="grid gap-3 md:grid-cols-3">
        {CROSS_STAGE_FLOWS.map((f) => (
          <button
            key={f.id}
            onClick={() => setSelectedFlow(f.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              selectedFlow === f.id
                ? 'border-[#4338CA] bg-[#EEF2FF] ring-2 ring-[#4338CA]/30'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <Badge tone={f.tone === 'emerald' ? 'emerald' : f.tone === 'amber' ? 'amber' : 'blue'}>{f.badge}</Badge>
            <p className="mt-2 text-sm font-black text-slate-900">{f.from} {'→'} {f.to}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{f.type}</p>
          </button>
        ))}
      </div>

      {/* Workflow panel */}
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          {flow.id === 'std7-form1' && (
            <>
              <AdminFormSection title="Standard 7 → Form 1 Transition" subtitle="Promote PSLE graduates into Form 1 O-Level">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Academic Year" value="2026" />
                  <SelectField label="Source Class" options={[
                    { value: 'std7a', label: 'Standard 7A' },
                    { value: 'std7b', label: 'Standard 7B' },
                  ]} />
                  <SelectField label="Destination Class" options={[
                    { value: 'form1a', label: 'Form 1A' },
                    { value: 'form1b', label: 'Form 1B' },
                  ]} />
                  <Field label="PSLE Minimum Score" type="number" value="100" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FeatureToggle label="Issue new O-Level registration (KS-S-YYYY-NNNNN)" description="Auto-generates stage-prefixed registration number for each promoted student" enabled />
                  <FeatureToggle label="Require PSLE index number on record" description="Block promotion if psleIndexNumber is not set" enabled />
                </div>
              </AdminFormSection>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">What happens</p>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> Primary enrolment deactivated (isActive=false)</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> New enrolment created in Form 1 class</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> New registration number generated: KS-S-2026-NNNNN</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> ClassPathway record created (CROSS_STAGE)</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /> Student history and performance data carried forward</li>
                </ul>
              </div>
            </>
          )}

          {flow.id === 'form4-form5' && (
            <>
              <AdminFormSection title="Form 4 → Form 5 Transition" subtitle="Promote O-Level graduates into A-Level with combination selection">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Academic Year" value="2026" />
                  <SelectField label="Source Class" options={[
                    { value: 'form4a', label: 'Form 4A' },
                    { value: 'form4b', label: 'Form 4B' },
                  ]} />
                  <SelectField label="A-Level Combination" options={[
                    { value: 'pcm',  label: 'PCM — Physics, Chemistry, Mathematics' },
                    { value: 'pce',  label: 'PCE — Physics, Chemistry, Economics' },
                    { value: 'hgl',  label: 'HGL — History, Geography, Kiswahili' },
                    { value: 'ega',  label: 'EGA — Economics, Geography, Accountancy' },
                  ]} />
                  <SelectField label="Destination Class" options={[
                    { value: 'form5pcm', label: 'Form 5 PCM' },
                    { value: 'form5pce', label: 'Form 5 PCE' },
                    { value: 'form5hgl', label: 'Form 5 HGL' },
                  ]} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FeatureToggle label="Issue new A-Level registration (KS-A-YYYY-NNNNN)" description="Auto-generates A-Level prefix for each promoted student" enabled />
                  <FeatureToggle label="Require CSEE division ≥ IV to qualify" description="Block Form 5 entry for Division 0 students without manual override" enabled />
                </div>
              </AdminFormSection>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">What happens</p>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> O-Level enrolment deactivated</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> New enrolment created in Form 5 combination class</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> New registration number generated: KS-A-2026-NNNNN</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> StudentSubjectEnrollment records created for all combination subjects</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> ClassPathway record created (CROSS_STAGE)</li>
                </ul>
              </div>
            </>
          )}

          {flow.id === 'form6-graduation' && (
            <>
              <AdminFormSection title="Form 6 → Graduation" subtitle="Mark Form 6 completers as graduated after ACSEE">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Academic Year" value="2026" />
                  <SelectField label="Source Class" options={[
                    { value: 'form6pcm', label: 'Form 6 PCM' },
                    { value: 'form6hgl', label: 'Form 6 HGL' },
                  ]} />
                  <Field label="Graduation Date" type="date" />
                  <Field label="ACSEE Year" type="number" value="2026" />
                </div>
                <div className="mt-4">
                  <FeatureToggle label="Generate final ACSEE report cards before graduation" description="Trigger report-card generation for Form 6 before updating status" enabled />
                </div>
              </AdminFormSection>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-600">What happens</p>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> Student status set to GRADUATED</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> graduationDate field populated</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> A-Level enrolment deactivated</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> ClassPathway record created (GRADUATION)</li>
                  <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /> Final ACSEE report card PDF generated and published</li>
                </ul>
              </div>
            </>
          )}
        </div>

        {/* Summary card */}
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Selected Flow</p>
          <h3 className="mt-2 font-display text-xl font-black text-slate-950">{flow.from} → {flow.to}</h3>
          <p className="mt-1 text-sm font-semibold text-slate-500">{flow.rule}</p>
          <div className="mt-4 space-y-2">
            <Badge tone={flow.tone === 'emerald' ? 'emerald' : flow.tone === 'amber' ? 'amber' : 'blue'}>{flow.type}</Badge>
          </div>
          <Button className="mt-6 w-full rounded-xl bg-[#4338CA]">
            <Play className="h-4 w-4" /> Run Promotion Workflow
          </Button>
          <p className="mt-3 text-center text-xs font-semibold text-slate-400">
            Dry-run mode — no data is committed until you confirm.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}

// ─── Util ─────────────────────────────────────────────────────────────────────

function useUser() {
  const { id } = useParams();
  const { data: apiUsers = [] as typeof adminUsers } = useAdminUsers() as { data: typeof adminUsers };
  return apiUsers.find((u) => u.id === id) ?? apiUsers[0] ?? adminUsers[0];
}
