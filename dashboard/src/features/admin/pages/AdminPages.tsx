import { AlertTriangle, CheckCircle2, Download, Play, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  adminAuditEvents, adminClasses, adminStudents, adminSubjects,
  adminUsers, assessmentTypes, gradingScales, notificationLogs,
  notificationTemplates, reportJobs, serviceHealth,
} from '../api/adminApi';
import {
  AdminDataTable, AdminFormSection, AdminMetricStrip, AdminQuickCard,
  AdminShell, AdminStatusIndicator, AssessmentTypeEditor, CsvImportZone,
  DangerActionDialog, FeatureToggle, Field, GradingBoundaryEditor,
  JsonInspector, NotificationTemplateEditor, PendingIntegration,
  SelectField, Td,
} from '../components/AdminConsole';
import { assessmentWeightsTotal, roleRisk } from '../utils/adminValidation';

// ─── Home ─────────────────────────────────────────────────────────────────────

export function AdminHomePage() {
  return (
    <AdminShell title="System Control Center" eyebrow="Admin operations console">
      <AdminMetricStrip items={[
        { label: 'Users',      value: '350+', detail: '4 loaded in mock',    tone: 'blue'  },
        { label: 'Students',   value: '312',  detail: 'Active registry',      tone: 'green' },
        { label: 'Locked',     value: '1',    detail: 'Needs unlock',         tone: 'amber' },
        { label: 'Classes',    value: '18',   detail: 'Active academic year', tone: 'blue'  },
        { label: 'Audit',      value: '24',   detail: 'Open events',          tone: 'rose'  },
        { label: 'Failed SMS', value: '7',    detail: 'Notification logs',    tone: 'rose'  },
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
            <AdminQuickCard title="System Settings"        detail="Providers, versions, feature flags."              to="/admin/settings/system"                       />
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">Service Health</p>
          <div className="space-y-2.5">
            {serviceHealth.map((item) => <AdminStatusIndicator key={item.service} {...item} />)}
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
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(adminUsers.map((u) => [u.id, u.status as string])),
  );
  const toggle = (id: string) =>
    setStatuses((prev) => ({ ...prev, [id]: prev[id] === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' }));

  return (
    <AdminDataTable columns={['Name', 'Email', 'Role', 'Status', 'Linked Entity', 'Last Login', 'Actions']}>
      {adminUsers.map((user) => (
        <tr key={user.id} className="hover:bg-slate-50">
          <Td>
            <p className="font-black text-slate-900">{user.name}</p>
          </Td>
          <Td className="text-slate-500">{user.email}</Td>
          <Td>
            <Badge tone={user.role === 'ADMIN' ? 'rose' : 'blue'}>{user.role}</Badge>
          </Td>
          <Td>
            <Badge tone={statuses[user.id] === 'ACTIVE' ? 'emerald' : statuses[user.id] === 'LOCKED' ? 'amber' : 'slate'}>
              {statuses[user.id]}
            </Badge>
          </Td>
          <Td className="text-slate-500">{user.linked}</Td>
          <Td className="text-xs text-slate-400">{user.lastLogin.slice(0, 10)}</Td>
          <Td>
            <div className="flex items-center gap-3">
              <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/users/${user.id}`}>Edit</NavLink>
              <button onClick={() => toggle(user.id)} className="text-xs font-black text-slate-500 transition hover:text-slate-900">
                {statuses[user.id] === 'LOCKED' ? 'Unlock' : 'Lock'}
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
  const cards: [string, string][] = [
    ['Academic Years',   '/admin/academic/setup'],
    ['Terms',            '/admin/academic/setup'],
    ['Classes',          '/admin/classes'],
    ['Subjects',         '/admin/subjects'],
    ['Class Subjects',   '/admin/academic/setup'],
    ['Grading Scales',   '/admin/grading'],
    ['Assessment Types', '/admin/assessment-types'],
  ];
  return (
    <AdminShell title="Academic Setup Hub" eyebrow="School academic structure">
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
  return (
    <AdminShell title="Class Management" eyebrow="Classes, rosters, assigned subjects">
      <AdminDataTable columns={['Class', 'Level', 'Students', 'Class Teacher', 'Year', 'Status', 'Actions']}>
        {adminClasses.map((item) => (
          <tr key={item.id} className="hover:bg-slate-50">
            <Td><p className="font-black text-slate-900">{item.name}</p></Td>
            <Td>{item.level}</Td>
            <Td>{item.students}</Td>
            <Td>{item.teacher}</Td>
            <Td>{item.year}</Td>
            <Td><Badge tone="emerald">{item.status}</Badge></Td>
            <Td>
              <NavLink className="text-xs font-black text-[#4338CA] hover:underline" to={`/admin/classes/${item.id}`}>Open</NavLink>
            </Td>
          </tr>
        ))}
      </AdminDataTable>
    </AdminShell>
  );
}

export function ClassDetailPage() {
  const { classId } = useParams();
  const klass = adminClasses.find((c) => c.id === classId) ?? adminClasses[0];
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
  return (
    <AdminDataTable columns={['Subject', 'Code', 'Department', 'Status', 'Classes', 'Teachers', 'Actions']}>
      {adminSubjects.map((item) => (
        <tr key={item.id} className="hover:bg-slate-50">
          <Td><p className="font-black text-slate-900">{item.name}</p></Td>
          <Td className="font-mono text-xs text-slate-500">{item.code}</Td>
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
  const subject = adminSubjects.find((s) => s.id === subjectId) ?? adminSubjects[0];
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
  return (
    <AdminShell title="Grading Scales" eyebrow="Grade boundaries and activation">
      {gradingScales.map((scale) => <GradingBoundaryEditor key={scale.id} scale={scale} />)}
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
  const total = assessmentWeightsTotal(assessmentTypes.map((t) => t.weight));
  return (
    <AdminShell title="Assessment Types" eyebrow="Weight distribution">
      <AdminMetricStrip items={[{
        label: 'Total Weight',
        value: `${total}%`,
        detail: total === 100 ? 'Distribution valid' : 'Must equal 100%',
        tone: total === 100 ? 'green' : 'rose',
      }]} />
      <AssessmentTypeEditor types={assessmentTypes} />
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
  return (
    <AdminDataTable columns={['Reg. No.', 'Name', 'Class', 'Status', 'Guardians', 'Balance', 'Risk', 'Actions']}>
      {adminStudents.map((student) => (
        <tr key={student.id} className="hover:bg-slate-50">
          <Td className="font-mono text-xs text-slate-500">{student.registration}</Td>
          <Td><p className="font-black text-slate-900">{student.name}</p></Td>
          <Td>{student.className}</Td>
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
            <SelectField label="Class Section" options={adminClasses.map((c) => ({ value: c.id, label: c.name }))} />
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
  const student = adminStudents.find((s) => s.id === id) ?? adminStudents[0];
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

export function AdminFeeCategoriesPage() {
  const categories = [
    { code: 'TUI', name: 'Tuition',  type: 'Mandatory', amount: 120000, used: 4 },
    { code: 'BRD', name: 'Boarding', type: 'Optional',  amount: 340000, used: 2 },
    { code: 'MLS', name: 'Meals',    type: 'Optional',  amount: 220000, used: 3 },
    { code: 'ICT', name: 'ICT',      type: 'Optional',  amount: 80000,  used: 2 },
  ];
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
  return (
    <AdminShell title="Notification Templates" eyebrow="SMS, email, push, in-app">
      <AdminDataTable columns={['Name', 'Channel', 'Event Type', 'Status', 'Last Edited', 'Editor', 'Actions']}>
        {notificationTemplates.map((tpl) => (
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
  const tpl = notificationTemplates.find((t) => t.id === id) ?? notificationTemplates[0];
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
  return (
    <AdminShell title="Notification Logs" eyebrow="Delivery inspection">
      <AdminDataTable columns={['Time', 'Channel', 'Recipient', 'Event', 'Status', 'Attempts', 'Provider', 'Payload']}>
        {notificationLogs.map((log) => (
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
  return (
    <AdminShell title="Generate Any Report" eyebrow="Report jobs and downloads">
      <AdminDataTable columns={['Report', 'Status', 'Requested By', 'Role', 'Scope', 'Format', 'Created', 'Actions']}>
        {reportJobs.map((job) => (
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
  const job = reportJobs.find((r) => r.id === id) ?? reportJobs[0];
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
  return (
    <div className="space-y-3">
      {adminAuditEvents.map((event) => (
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

export function AdminAnnouncementsPage() {
  const items = [
    { title: 'Results publishing window', author: 'Principal', audience: 'All roles', status: 'ACTIVE', priority: 'High' },
    { title: 'Parent meeting — Term II',  author: 'Admin',     audience: 'Parents',   status: 'ACTIVE', priority: 'Normal' },
    { title: 'Fee reminder — May 2026',   author: 'Admin',     audience: 'Guardians', status: 'ACTIVE', priority: 'High' },
  ];
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

// ─── Util ─────────────────────────────────────────────────────────────────────

function useUser() {
  const { id } = useParams();
  return adminUsers.find((u) => u.id === id) ?? adminUsers[0];
}
