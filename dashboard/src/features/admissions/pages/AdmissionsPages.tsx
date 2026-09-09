import { useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  BadgeCheck, CalendarPlus, Check, ClipboardList, GraduationCap,
  Pencil, Phone, Search, Send, UserPlus, X,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { toast } from '../../../lib/toast';
import {
  useAdmissionsAnalytics,
  useAdmissionsClasses,
  useApplicant,
  useApplicants,
  useConvertApplicantMutation,
  useCreateApplicantMutation,
  useIssueOfferMutation,
  useOfferDecisionMutation,
  useRecordAssessmentMutation,
  useScheduleAssessmentMutation,
  useTransitionStageMutation,
  useUpdateApplicantMutation,
  type AdmissionStage,
  type ApplicantRow,
} from '../api/admissions.hooks';
import {
  AdmissionsBreadcrumb,
  AdmissionsMetricStrip,
  AdmissionsTable,
  AdmissionsWorkspaceShell,
  applicantFullName,
  formatAdmissionsDate,
  SOURCE_CHANNEL_LABELS,
  STAGE_META,
  StageBadge,
  Td,
} from '../components/AdmissionsWorkspaceShell';
import { AdmissionsPipelineBoard } from '../components/AdmissionsPipelineBoard';
import {
  EnrolStudentPage as AdminEnrolStudentPage,
  StudentAdminProfilePage as AdminStudentProfilePage,
  StudentsPage as AdminStudentsPage,
} from '../../admin/pages/AdminPages';

const formatTZS = (value: number) => `TZS ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// ─── Home: overview + pipeline board ─────────────────────────────────────────

export function AdmissionsHomePage() {
  const { data: analytics } = useAdmissionsAnalytics();
  const totals = analytics?.totals;
  const funnel = analytics?.funnel ?? [];
  const inquiryCount = funnel.find((f) => f.stage === 'INQUIRY')?.count ?? 0;
  const offerCount = funnel.find((f) => f.stage === 'OFFER')?.count ?? 0;
  const acceptedCount = funnel.find((f) => f.stage === 'ACCEPTED')?.count ?? 0;

  return (
    <AdmissionsWorkspaceShell title="Admissions Pipeline" eyebrow="From first inquiry to enrolled student">
      <AdmissionsBreadcrumb crumbs={[{ label: 'Admissions' }, { label: 'Pipeline' }]} />
      <AdmissionsMetricStrip
        items={[
          { label: 'Active Applicants', value: String(totals?.active ?? 0), detail: `${inquiryCount} new inquiries`, tone: 'navy', trend: 'up' },
          { label: 'Offers Awaiting Reply', value: String(offerCount), detail: 'Follow up with guardians', tone: 'gold' },
          { label: 'Ready to Enrol', value: String(acceptedCount), detail: 'Accepted — convert to students', tone: 'green', trend: 'up' },
          { label: 'Conversion Rate', value: `${totals?.conversionRate ?? 0}%`, detail: `${totals?.enrolled ?? 0} enrolled of ${totals?.total ?? 0} applicants`, tone: (totals?.conversionRate ?? 0) >= 30 ? 'green' : 'slate', progress: totals?.conversionRate ?? 0 },
        ]}
      />
      <AdmissionsPipelineBoard />
    </AdmissionsWorkspaceShell>
  );
}

// ─── Applicants directory ─────────────────────────────────────────────────────

const STAGE_FILTERS: Array<AdmissionStage | 'ALL'> = ['ALL', 'INQUIRY', 'APPLICATION', 'ASSESSMENT', 'OFFER', 'ACCEPTED', 'ENROLLED', 'REJECTED', 'WITHDRAWN'];

export function AdmissionsApplicantsPage() {
  const [stageFilter, setStageFilter] = useState<AdmissionStage | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const { data: applicants = [], isLoading, isError, refetch } = useApplicants(
    stageFilter === 'ALL' ? undefined : { stage: stageFilter },
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return applicants;
    return applicants.filter((a) =>
      [applicantFullName(a), a.guardianFirstName, a.guardianLastName, a.guardianPhone]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [applicants, search]);

  return (
    <AdmissionsWorkspaceShell title="Applicant Directory" eyebrow="Search and manage every applicant">
      <AdmissionsBreadcrumb crumbs={[{ label: 'Admissions', to: '/admissions' }, { label: 'Applicants' }]} />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#d5dde6] bg-white px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {STAGE_FILTERS.map((stage) => (
            <button
              key={stage}
              onClick={() => setStageFilter(stage)}
              className={`rounded-full border px-3 py-1 text-[11px] font-black transition-all ${
                stageFilter === stage
                  ? 'border-[#00334f] bg-[#00334f] text-white'
                  : 'border-[#d5dde6] bg-[#f7f9fb] text-[#334155] hover:border-[#00334f]/40 hover:bg-white hover:text-[#00334f]'
              }`}
            >
              {stage === 'ALL' ? 'All' : STAGE_META[stage].label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded border border-[#d5dde6] bg-[#f7f9fb] px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-[#64748b]" />
          <input
            type="text"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 bg-transparent text-sm font-semibold text-[#334155] outline-none placeholder:text-[#94a3b8]"
          />
        </div>
      </div>

      {isLoading ? <SkeletonTable cols={7} /> : isError ? <DataError onRetry={refetch} /> : filtered.length === 0 ? (
        <EmptyState title="No applicants match" description="Adjust the stage filter or search, or capture a new inquiry." action={{ label: 'New Inquiry', href: '/admissions/intake' }} />
      ) : (
        <AdmissionsTable columns={['Applicant', 'Target Class', 'Guardian', 'Source', 'Stage', 'Captured', '']}>
          {filtered.map((applicant) => (
            <tr key={applicant.id} className="group bg-white transition even:bg-[#f7f9fb] hover:bg-[#eef5f8]">
              <Td>
                <NavLink className="font-black text-[#00334f] hover:underline" to={`/admissions/applicants/${applicant.id}`}>
                  {applicantFullName(applicant)}
                </NavLink>
              </Td>
              <Td>{applicant.prospectiveClass ? `${applicant.prospectiveClass.name}${applicant.prospectiveClass.stream ? ` ${applicant.prospectiveClass.stream}` : ''}` : '—'}</Td>
              <Td>
                <div className="font-black text-[#0f172a]">{applicant.guardianFirstName} {applicant.guardianLastName}</div>
                <div className="text-[11px] text-[#64748b]">{applicant.guardianPhone}</div>
              </Td>
              <Td>{SOURCE_CHANNEL_LABELS[applicant.sourceChannel] ?? applicant.sourceChannel}</Td>
              <Td><StageBadge stage={applicant.stage} /></Td>
              <Td>{formatAdmissionsDate(applicant.createdAt)}</Td>
              <Td>
                <NavLink
                  className="text-xs font-black text-[#00334f] opacity-0 transition group-hover:opacity-100 hover:underline"
                  to={`/admissions/applicants/${applicant.id}`}
                >
                  Open →
                </NavLink>
              </Td>
            </tr>
          ))}
        </AdmissionsTable>
      )}
    </AdmissionsWorkspaceShell>
  );
}

// ─── Applicant 360° profile ───────────────────────────────────────────────────

export function AdmissionsApplicantProfilePage() {
  const { applicantId } = useParams();
  const { data: applicant, isLoading, isError, refetch } = useApplicant(applicantId);

  return (
    <AdmissionsWorkspaceShell
      title={applicant ? applicantFullName(applicant) : 'Applicant Profile'}
      eyebrow="Applicant 360°"
    >
      <AdmissionsBreadcrumb crumbs={[{ label: 'Admissions', to: '/admissions' }, { label: 'Applicants', to: '/admissions/applicants' }, { label: applicant ? applicantFullName(applicant) : '…' }]} />
      {isLoading ? <SkeletonTable cols={4} /> : isError || !applicant ? <DataError onRetry={refetch} /> : (
        <ApplicantProfileBody applicant={applicant} />
      )}
    </AdmissionsWorkspaceShell>
  );
}

function ApplicantProfileBody({ applicant }: { applicant: ApplicantRow }) {
  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-gutter">
        <IdentityCard applicant={applicant} />
        <AssessmentCard applicant={applicant} />
        <OfferCard applicant={applicant} />
      </div>
      <div className="space-y-gutter">
        <NextStepCard applicant={applicant} />
        <TimelineCard applicant={applicant} />
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children, action }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#d5dde6] bg-white">
      <div className="flex items-center justify-between border-b border-[#eef2f6] px-5 py-3.5">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]">{icon}{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#f1f5f9] py-2 last:border-0">
      <span className="text-[11px] font-black uppercase tracking-wide text-[#64748b]">{label}</span>
      <span className="text-right text-sm font-bold text-[#0f172a]">{value}</span>
    </div>
  );
}

// ── Identity + guardian (with inline edit for enrolment prerequisites) ────────

function IdentityCard({ applicant }: { applicant: ApplicantRow }) {
  const [editing, setEditing] = useState(false);
  const updateMutation = useUpdateApplicantMutation();
  const { data: classes = [] } = useAdmissionsClasses();
  const [form, setForm] = useState({
    dateOfBirth: applicant.dateOfBirth ? applicant.dateOfBirth.slice(0, 10) : '',
    gender: applicant.gender ?? '',
    prospectiveClassId: applicant.prospectiveClassId ?? '',
    previousSchool: applicant.previousSchool ?? '',
    guardianEmail: applicant.guardianEmail ?? '',
    notes: applicant.notes ?? '',
  });

  const locked = applicant.stage === 'ENROLLED';

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: applicant.id,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        prospectiveClassId: form.prospectiveClassId || undefined,
        previousSchool: form.previousSchool || undefined,
        guardianEmail: form.guardianEmail || undefined,
        notes: form.notes || undefined,
      },
      {
        onSuccess: () => { toast('Applicant details saved', 'success'); setEditing(false); },
        onError: () => toast('Could not save changes. Please try again.', 'error'),
      },
    );
  };

  const classLabel = applicant.prospectiveClass
    ? `${applicant.prospectiveClass.name}${applicant.prospectiveClass.stream ? ` ${applicant.prospectiveClass.stream}` : ''}`
    : '—';

  return (
    <SectionCard
      title="Applicant & Guardian"
      icon={<ClipboardList className="h-3.5 w-3.5" />}
      action={!locked && (
        <button onClick={() => setEditing((v) => !v)} className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#00334f] hover:underline">
          <Pencil className="h-3 w-3" /> {editing ? 'Close' : 'Edit'}
        </button>
      )}
    >
      {!editing ? (
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <DetailRow label="Stage" value={<StageBadge stage={applicant.stage} />} />
            <DetailRow label="Date of Birth" value={formatAdmissionsDate(applicant.dateOfBirth)} />
            <DetailRow label="Gender" value={applicant.gender === 'MALE' ? 'Male' : applicant.gender === 'FEMALE' ? 'Female' : '—'} />
            <DetailRow label="Nationality" value={applicant.nationality ?? 'Tanzanian'} />
            <DetailRow label="Previous School" value={applicant.previousSchool || '—'} />
            <DetailRow label="Target Class" value={classLabel} />
          </div>
          <div>
            <DetailRow label="Guardian" value={`${applicant.guardianFirstName} ${applicant.guardianLastName}`} />
            <DetailRow label="Relationship" value={String(applicant.guardianRelationship ?? 'GUARDIAN').replace(/_/g, ' ')} />
            <DetailRow label="Phone" value={<span className="flex items-center justify-end gap-1"><Phone className="h-3 w-3 text-[#64748b]" />{applicant.guardianPhone}</span>} />
            <DetailRow label="Email" value={applicant.guardianEmail || '—'} />
            <DetailRow label="Source" value={SOURCE_CHANNEL_LABELS[applicant.sourceChannel] ?? applicant.sourceChannel} />
            <DetailRow label="Captured" value={formatAdmissionsDate(applicant.createdAt)} />
          </div>
          {applicant.notes && (
            <p className="mt-3 rounded-xl bg-[#f7f9fb] p-3 text-sm font-semibold text-[#475569] md:col-span-2">{applicant.notes}</p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Date of Birth *</span>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Gender *</span>
            <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f]">
              <option value="">Select…</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Target Class</span>
            <select value={form.prospectiveClassId} onChange={(e) => setForm((f) => ({ ...f, prospectiveClassId: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f]">
              <option value="">Select…</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Previous School</span>
            <input value={form.previousSchool} onChange={(e) => setForm((f) => ({ ...f, previousSchool: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Guardian Email</span>
            <input type="email" value={form.guardianEmail} onChange={(e) => setForm((f) => ({ ...f, guardianEmail: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <label className="md:col-span-2">
            <span className="text-xs font-black uppercase text-[#64748b]">Notes</span>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-2 h-20 w-full rounded-xl border border-[#d5dde6] p-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <div className="md:col-span-2 flex justify-end gap-2">
            <Button variant="secondary" className="rounded-xl" onClick={() => setEditing(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving…' : 'Save Details'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Assessments ───────────────────────────────────────────────────────────────

function AssessmentCard({ applicant }: { applicant: ApplicantRow }) {
  const scheduleMutation = useScheduleAssessmentMutation();
  const recordMutation = useRecordAssessmentMutation();
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ scheduledAt: '', subjectFocus: '', notes: '' });
  const [recording, setRecording] = useState<string | null>(null);
  const [recordForm, setRecordForm] = useState({ score: '', outcome: 'PASSED', notes: '' });

  const assessments = applicant.assessments ?? [];
  const canSchedule = ['APPLICATION', 'ASSESSMENT'].includes(applicant.stage);

  const handleSchedule = () => {
    if (!scheduleForm.scheduledAt) { toast('Pick a date and time for the assessment', 'warning'); return; }
    scheduleMutation.mutate(
      { id: applicant.id, scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(), subjectFocus: scheduleForm.subjectFocus || undefined, notes: scheduleForm.notes || undefined },
      {
        onSuccess: () => { toast('Assessment scheduled', 'success'); setShowSchedule(false); setScheduleForm({ scheduledAt: '', subjectFocus: '', notes: '' }); },
        onError: () => toast('Could not schedule assessment', 'error'),
      },
    );
  };

  const handleRecord = (assessmentId: string) => {
    recordMutation.mutate(
      { assessmentId, applicantId: applicant.id, score: recordForm.score ? Number(recordForm.score) : undefined, outcome: recordForm.outcome, notes: recordForm.notes || undefined },
      {
        onSuccess: () => { toast('Assessment outcome recorded', 'success'); setRecording(null); },
        onError: () => toast('Could not record outcome', 'error'),
      },
    );
  };

  return (
    <SectionCard
      title="Entrance Assessment"
      icon={<BadgeCheck className="h-3.5 w-3.5" />}
      action={canSchedule && (
        <button onClick={() => setShowSchedule((v) => !v)} className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#00334f] hover:underline">
          <CalendarPlus className="h-3 w-3" /> {showSchedule ? 'Close' : 'Schedule'}
        </button>
      )}
    >
      {showSchedule && (
        <div className="mb-4 grid gap-4 rounded-xl border border-[#d5dde6] bg-[#f7f9fb] p-4 md:grid-cols-3">
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Date & Time *</span>
            <input type="datetime-local" value={scheduleForm.scheduledAt} onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledAt: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Focus</span>
            <input value={scheduleForm.subjectFocus} placeholder="e.g. Mathematics & English" onChange={(e) => setScheduleForm((f) => ({ ...f, subjectFocus: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <div className="flex items-end">
            <Button className="w-full rounded-xl" onClick={handleSchedule} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? 'Scheduling…' : 'Schedule Assessment'}
            </Button>
          </div>
        </div>
      )}

      {assessments.length === 0 ? (
        <p className="text-sm font-semibold text-[#64748b]">
          {canSchedule
            ? 'No assessment yet. Scheduling one moves the applicant into the Assessment stage automatically.'
            : 'No entrance assessment was recorded for this applicant.'}
        </p>
      ) : (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <div key={assessment.id} className="rounded-xl border border-[#e2e8f0] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-[#0f172a]">{assessment.subjectFocus || 'Entrance interview'}</p>
                  <p className="text-[11px] font-semibold text-[#64748b]">Scheduled {formatAdmissionsDate(assessment.scheduledAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {assessment.score != null && (
                    <span className="font-mono text-lg font-black text-[#00334f]">{assessment.score}<span className="text-xs text-[#64748b]">/{assessment.maxScore ?? 100}</span></span>
                  )}
                  <Badge tone={assessment.outcome === 'PASSED' ? 'emerald' : assessment.outcome === 'FAILED' ? 'rose' : assessment.outcome === 'WAIVED' ? 'slate' : 'amber'}>
                    {assessment.outcome}
                  </Badge>
                  {assessment.outcome === 'PENDING' && (
                    <button onClick={() => { setRecording(recording === assessment.id ? null : assessment.id); setRecordForm({ score: '', outcome: 'PASSED', notes: '' }); }}
                      className="text-[11px] font-black uppercase tracking-wide text-[#00334f] hover:underline">
                      {recording === assessment.id ? 'Close' : 'Record Result'}
                    </button>
                  )}
                </div>
              </div>
              {assessment.notes && <p className="mt-2 text-[12px] font-semibold text-[#64748b]">{assessment.notes}</p>}
              {recording === assessment.id && (
                <div className="mt-3 grid gap-3 rounded-xl bg-[#f7f9fb] p-3 md:grid-cols-4">
                  <label>
                    <span className="text-xs font-black uppercase text-[#64748b]">Score</span>
                    <input type="number" min={0} max={assessment.maxScore ?? 100} value={recordForm.score} onChange={(e) => setRecordForm((f) => ({ ...f, score: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
                  </label>
                  <label>
                    <span className="text-xs font-black uppercase text-[#64748b]">Outcome</span>
                    <select value={recordForm.outcome} onChange={(e) => setRecordForm((f) => ({ ...f, outcome: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f]">
                      <option value="PASSED">Passed</option>
                      <option value="FAILED">Failed</option>
                      <option value="WAIVED">Waived</option>
                    </select>
                  </label>
                  <label className="md:col-span-2">
                    <span className="text-xs font-black uppercase text-[#64748b]">Notes</span>
                    <input value={recordForm.notes} onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                      className="mt-1 h-10 w-full rounded-lg border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
                  </label>
                  <div className="md:col-span-4 flex justify-end">
                    <Button className="rounded-xl py-2 text-xs" onClick={() => handleRecord(assessment.id)} disabled={recordMutation.isPending}>
                      {recordMutation.isPending ? 'Saving…' : 'Save Outcome'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Offer ─────────────────────────────────────────────────────────────────────

function OfferCard({ applicant }: { applicant: ApplicantRow }) {
  const issueMutation = useIssueOfferMutation();
  const decisionMutation = useOfferDecisionMutation();
  const { data: classes = [] } = useAdmissionsClasses();
  const [showIssue, setShowIssue] = useState(false);
  const [form, setForm] = useState({
    classId: applicant.prospectiveClassId ?? '',
    feeExpectation: '',
    expiresAt: '',
    note: '',
  });

  const offer = applicant.offer;
  const canIssue = ['APPLICATION', 'ASSESSMENT', 'OFFER'].includes(applicant.stage);
  const canDecide = applicant.stage === 'OFFER' && offer?.decision === 'PENDING';

  const handleIssue = () => {
    if (!form.classId) { toast('Choose the class being offered', 'warning'); return; }
    issueMutation.mutate(
      {
        id: applicant.id,
        classId: form.classId,
        feeExpectation: form.feeExpectation ? Number(form.feeExpectation) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        note: form.note || undefined,
      },
      {
        onSuccess: () => { toast('Admission offer issued', 'success'); setShowIssue(false); },
        onError: () => toast('Could not issue offer', 'error'),
      },
    );
  };

  const handleDecision = (decision: 'ACCEPTED' | 'DECLINED') => {
    decisionMutation.mutate(
      { id: applicant.id, decision },
      {
        onSuccess: () => toast(`Offer marked ${decision.toLowerCase()}`, 'success'),
        onError: () => toast('Could not record decision', 'error'),
      },
    );
  };

  return (
    <SectionCard
      title="Admission Offer"
      icon={<Send className="h-3.5 w-3.5" />}
      action={canIssue && (
        <button onClick={() => setShowIssue((v) => !v)} className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-[#00334f] hover:underline">
          <Send className="h-3 w-3" /> {showIssue ? 'Close' : offer ? 'Re-issue' : 'Issue Offer'}
        </button>
      )}
    >
      {showIssue && (
        <div className="mb-4 grid gap-4 rounded-xl border border-[#d5dde6] bg-[#f7f9fb] p-4 md:grid-cols-2">
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Offered Class *</span>
            <select value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] bg-white px-3 font-semibold outline-none focus:border-[#00334f]">
              <option value="">Select…</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Expected Fees (TZS / year)</span>
            <input type="number" min={0} value={form.feeExpectation} onChange={(e) => setForm((f) => ({ ...f, feeExpectation: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Offer Valid Until</span>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-[#64748b]">Note</span>
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <Button className="rounded-xl" onClick={handleIssue} disabled={issueMutation.isPending}>
              {issueMutation.isPending ? 'Issuing…' : 'Issue Offer'}
            </Button>
          </div>
        </div>
      )}

      {!offer ? (
        <p className="text-sm font-semibold text-[#64748b]">
          {canIssue
            ? 'No offer issued yet. Issuing an offer moves the applicant into the Offer stage and records the offered class and fees.'
            : 'No offer exists for this applicant.'}
        </p>
      ) : (
        <div className="grid gap-x-8 md:grid-cols-2">
          <div>
            <DetailRow label="Decision" value={<Badge tone={offer.decision === 'ACCEPTED' ? 'emerald' : offer.decision === 'DECLINED' ? 'rose' : 'amber'}>{offer.decision}</Badge>} />
            <DetailRow label="Issued" value={formatAdmissionsDate(offer.issuedAt)} />
            <DetailRow label="Valid Until" value={formatAdmissionsDate(offer.expiresAt)} />
          </div>
          <div>
            <DetailRow label="Expected Fees" value={offer.feeExpectation != null ? formatTZS(offer.feeExpectation) : '—'} />
            <DetailRow label="Admission No." value={offer.admissionNumber || 'Assigned at enrolment'} />
            <DetailRow label="Responded" value={formatAdmissionsDate(offer.respondedAt)} />
          </div>
          {offer.note && <p className="mt-3 rounded-xl bg-[#f7f9fb] p-3 text-sm font-semibold text-[#475569] md:col-span-2">{offer.note}</p>}
          {canDecide && (
            <div className="mt-4 flex gap-2 md:col-span-2">
              <Button className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => handleDecision('ACCEPTED')} disabled={decisionMutation.isPending}>
                <Check className="h-4 w-4" /> Guardian Accepted
              </Button>
              <Button variant="secondary" className="rounded-xl text-red-600" onClick={() => handleDecision('DECLINED')} disabled={decisionMutation.isPending}>
                <X className="h-4 w-4" /> Guardian Declined
              </Button>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ── Convert / next step ───────────────────────────────────────────────────────

function NextStepCard({ applicant }: { applicant: ApplicantRow }) {
  const navigate = useNavigate();
  const convertMutation = useConvertApplicantMutation();
  const transition = useTransitionStageMutation();
  const [confirming, setConfirming] = useState(false);
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 10));

  const missing: string[] = [];
  if (!applicant.dateOfBirth) missing.push('date of birth');
  if (!applicant.gender) missing.push('gender');
  if (!applicant.offer?.classId && !applicant.prospectiveClassId) missing.push('target class');

  const handleConvert = () => {
    convertMutation.mutate(
      { id: applicant.id, admissionDate },
      {
        onSuccess: (data) => {
          toast(`Enrolled as ${data.student.registrationNumber}. Parent account linked by phone.`, 'success');
          setConfirming(false);
        },
        onError: (error: unknown) => {
          const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast(message || 'Enrolment failed. Please try again.', 'error');
        },
      },
    );
  };

  if (applicant.stage === 'ENROLLED') {
    return (
      <SectionCard title="Enrolled Student" icon={<GraduationCap className="h-3.5 w-3.5" />}>
        <p className="text-sm font-semibold text-[#475569]">
          This applicant is now an active student{applicant.offer?.admissionNumber ? <> with admission number <span className="font-black text-[#00334f]">{applicant.offer.admissionNumber}</span></> : null}.
          The guardian&apos;s parent account was created (or reused) automatically using their phone number.
        </p>
        {applicant.studentId && (
          <Button variant="secondary" className="mt-4 w-full rounded-xl" onClick={() => navigate(`/admin/students/${applicant.studentId}`)}>
            Open Student Profile
          </Button>
        )}
      </SectionCard>
    );
  }

  if (['REJECTED', 'WITHDRAWN'].includes(applicant.stage)) {
    return (
      <SectionCard title="Pipeline Closed" icon={<X className="h-3.5 w-3.5" />}>
        <p className="text-sm font-semibold text-[#64748b]">
          This applicant is {applicant.stage.toLowerCase()}. {applicant.stage === 'WITHDRAWN' ? 'You can reopen the file as a fresh inquiry if the family returns.' : 'Rejected applications stay on record for reporting.'}
        </p>
        {applicant.stage === 'WITHDRAWN' && (
          <Button
            variant="secondary"
            className="mt-4 w-full rounded-xl"
            disabled={transition.isPending}
            onClick={() => transition.mutate(
              { id: applicant.id, toStage: 'INQUIRY', note: 'File reopened by admissions office' },
              { onSuccess: () => toast('Reopened as a new inquiry', 'success'), onError: () => toast('Could not reopen file', 'error') },
            )}
          >
            Reopen as Inquiry
          </Button>
        )}
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Convert to Enrolled Student" icon={<GraduationCap className="h-3.5 w-3.5" />}>
      {applicant.stage !== 'ACCEPTED' ? (
        <p className="text-sm font-semibold text-[#64748b]">
          Enrolment unlocks once the guardian <span className="font-black text-[#00334f]">accepts an offer</span>. Current stage: {STAGE_META[applicant.stage].label}.
        </p>
      ) : missing.length > 0 ? (
        <div className="rounded-xl border border-[#d59a1b]/40 bg-[#fffbeb] p-4">
          <p className="text-sm font-bold text-[#7a5200]">Before enrolling, complete the applicant&apos;s {missing.join(', ')} using the Edit button above.</p>
        </div>
      ) : !confirming ? (
        <>
          <p className="text-sm font-semibold text-[#475569]">
            This creates the student record, assigns <span className="font-black">{applicant.prospectiveClass ? `${applicant.prospectiveClass.name}${applicant.prospectiveClass.stream ? ` ${applicant.prospectiveClass.stream}` : ''}` : 'the offered class'}</span>, creates or reuses the parent account by phone, and triggers the admission invoice and welcome message automatically.
          </p>
          <Button className="mt-4 w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirming(true)}>
            <GraduationCap className="h-4 w-4" /> Convert to Enrolled Student
          </Button>
        </>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-black uppercase text-[#64748b]">Admission Date</span>
            <input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]" />
          </label>
          <div className="rounded-xl bg-[#f0fdf9] border border-emerald-200 p-3 text-[12px] font-semibold text-emerald-800">
            One click enrols {applicantFullName(applicant)}, generates the registration number, links the guardian ({applicant.guardianPhone}), and notifies finance. This cannot be undone.
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 rounded-xl" onClick={() => setConfirming(false)} disabled={convertMutation.isPending}>Back</Button>
            <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={handleConvert} disabled={convertMutation.isPending}>
              {convertMutation.isPending ? 'Enrolling…' : 'Confirm Enrolment'}
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function TimelineCard({ applicant }: { applicant: ApplicantRow }) {
  const events = applicant.stageEvents ?? [];
  return (
    <SectionCard title="Stage Timeline" icon={<ClipboardList className="h-3.5 w-3.5" />}>
      {events.length === 0 ? (
        <p className="text-sm font-semibold text-[#64748b]">No events recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {events.map((event) => {
            const meta = STAGE_META[event.toStage];
            return (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta?.dot ?? '#64748b' }} />
                <div>
                  <p className="text-sm font-black text-[#0f172a]">{meta?.label ?? event.toStage}</p>
                  {event.note && <p className="text-[12px] font-semibold text-[#64748b]">{event.note}</p>}
                  <p className="text-[11px] text-[#94a3b8]">{formatAdmissionsDate(event.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function AdmissionsAnalyticsPage() {
  const { data, isLoading, isError, refetch } = useAdmissionsAnalytics();
  const funnel = data?.funnel ?? [];
  const activeFunnel = funnel.filter((f) => !['REJECTED', 'WITHDRAWN'].includes(f.stage));
  const maxFunnel = Math.max(1, ...activeFunnel.map((f) => f.count));
  const sources = data?.sourceChannels ?? [];
  const maxSource = Math.max(1, ...sources.map((s) => s.count));
  const capacity = data?.capacity ?? [];

  return (
    <AdmissionsWorkspaceShell title="Admissions Analytics" eyebrow={`Funnel, sources & capacity${data?.academicYear ? ` · ${data.academicYear.name}` : ''}`}>
      <AdmissionsBreadcrumb crumbs={[{ label: 'Admissions', to: '/admissions' }, { label: 'Analytics' }]} />
      {isLoading ? <SkeletonTable cols={4} /> : isError || !data ? <DataError onRetry={refetch} /> : (
        <>
          <AdmissionsMetricStrip
            items={[
              { label: 'Total Applicants', value: String(data.totals.total), detail: 'All time, every stage', tone: 'navy' },
              { label: 'Active Pipeline', value: String(data.totals.active), detail: 'Currently progressing', tone: 'gold' },
              { label: 'Enrolled', value: String(data.totals.enrolled), detail: 'Converted to students', tone: 'green', trend: 'up' },
              { label: 'Conversion Rate', value: `${data.totals.conversionRate}%`, detail: `${data.totals.rejected} rejected · ${data.totals.withdrawn} withdrawn`, tone: data.totals.conversionRate >= 30 ? 'green' : 'slate', progress: data.totals.conversionRate },
            ]}
          />

          <div className="grid gap-gutter xl:grid-cols-2">
            <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Pipeline Funnel</p>
              <div className="mt-5 space-y-3">
                {activeFunnel.map((item) => {
                  const meta = STAGE_META[item.stage];
                  return (
                    <div key={item.stage}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black uppercase tracking-wide" style={{ color: meta.color }}>{meta.label}</span>
                        <span className="font-mono font-black text-[#00334f]">{item.count}</span>
                      </div>
                      <div className="mt-1 h-2.5 rounded-full bg-[#eef2f6]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${(item.count / maxFunnel) * 100}%`, background: meta.dot }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Where Families Hear About Us</p>
              {sources.length === 0 ? (
                <p className="mt-5 text-sm font-semibold text-[#64748b]">Source data appears as inquiries are captured.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {[...sources].sort((a, b) => b.count - a.count).map((source) => (
                    <div key={source.channel}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black uppercase tracking-wide text-[#475569]">{SOURCE_CHANNEL_LABELS[source.channel] ?? source.channel}</span>
                        <span className="font-mono font-black text-[#00334f]">{source.count}</span>
                      </div>
                      <div className="mt-1 h-2.5 rounded-full bg-[#eef2f6]">
                        <div className="h-full rounded-full bg-[#00334f] transition-all" style={{ width: `${(source.count / maxSource) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-lg border border-[#d5dde6] bg-white">
            <div className="border-b border-[#eef2f6] px-5 py-3.5">
              <h2 className="text-xs font-black uppercase tracking-widest text-[#00334f]">Seat Capacity vs Filled</h2>
            </div>
            {capacity.length === 0 ? (
              <div className="p-6"><EmptyState title="No classes found" description="Class capacity appears once classes exist for the current academic year." /></div>
            ) : (
              <AdmissionsTable columns={['Class', 'Capacity', 'Filled', 'Available', 'In Pipeline', 'Fill Level']}>
                {capacity.map((row) => {
                  const fillPct = row.capacity > 0 ? Math.min(100, Math.round((row.filled / row.capacity) * 100)) : 0;
                  const full = row.available === 0;
                  return (
                    <tr key={row.classId} className="bg-white even:bg-[#f7f9fb]">
                      <Td><span className="font-black text-[#00334f]">{row.className}</span></Td>
                      <Td>{row.capacity}</Td>
                      <Td>{row.filled}</Td>
                      <Td><span className={full ? 'font-black text-[#e11d48]' : 'font-black text-[#10b981]'}>{row.available}</span></Td>
                      <Td>{row.pipeline > 0 ? <Badge tone="amber">{row.pipeline} prospective</Badge> : <span className="text-[#94a3b8]">—</span>}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 rounded-full bg-[#eef2f6]">
                            <div className={`h-full rounded-full ${full ? 'bg-[#e11d48]' : fillPct >= 85 ? 'bg-[#d59a1b]' : 'bg-[#10b981]'}`} style={{ width: `${fillPct}%` }} />
                          </div>
                          <span className="font-mono text-xs font-black text-[#475569]">{fillPct}%</span>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </AdmissionsTable>
            )}
          </section>
        </>
      )}
    </AdmissionsWorkspaceShell>
  );
}

// ─── Intake form ──────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = Object.entries(SOURCE_CHANNEL_LABELS);
const RELATIONSHIP_OPTIONS = ['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'];

export function AdmissionsIntakePage() {
  const navigate = useNavigate();
  const createMutation = useCreateApplicantMutation();
  const { data: classes = [] } = useAdmissionsClasses();
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '',
    dateOfBirth: '', gender: '',
    prospectiveClassId: '', previousSchool: '',
    guardianFirstName: '', guardianLastName: '', guardianPhone: '', guardianEmail: '',
    guardianRelationship: 'GUARDIAN', sourceChannel: 'WALK_IN', notes: '',
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) { toast('Applicant first and last name are required', 'warning'); return; }
    if (!form.guardianFirstName.trim() || !form.guardianPhone.trim()) { toast('Guardian name and phone are required', 'warning'); return; }
    createMutation.mutate(
      {
        firstName: form.firstName.trim(),
        middleName: form.middleName.trim() || undefined,
        lastName: form.lastName.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        prospectiveClassId: form.prospectiveClassId || undefined,
        previousSchool: form.previousSchool.trim() || undefined,
        guardianFirstName: form.guardianFirstName.trim(),
        guardianLastName: form.guardianLastName.trim() || form.lastName.trim(),
        guardianPhone: form.guardianPhone.trim(),
        guardianEmail: form.guardianEmail.trim() || undefined,
        guardianRelationship: form.guardianRelationship,
        sourceChannel: form.sourceChannel,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: (created) => {
          toast('Inquiry captured — applicant added to the pipeline', 'success');
          navigate(`/admissions/applicants/${created.id}`);
        },
        onError: (error: unknown) => {
          const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast(message || 'Could not save the inquiry. Please try again.', 'error');
        },
      },
    );
  };

  const field = 'mt-2 h-11 w-full rounded-xl border border-[#d5dde6] px-3 font-semibold outline-none focus:border-[#00334f]';
  const selectField = `${field} bg-white`;

  return (
    <AdmissionsWorkspaceShell title="New Inquiry" eyebrow="Capture a prospective student" action={<span />}>
      <AdmissionsBreadcrumb crumbs={[{ label: 'Admissions', to: '/admissions' }, { label: 'New Inquiry' }]} />
      <form onSubmit={handleSubmit} className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-gutter">
          <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]">
              <UserPlus className="h-3.5 w-3.5" /> Prospective Student
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label><span className="text-xs font-black uppercase text-[#64748b]">First Name *</span>
                <input value={form.firstName} onChange={set('firstName')} placeholder="e.g. Neema" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Middle Name</span>
                <input value={form.middleName} onChange={set('middleName')} placeholder="Optional" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Last Name *</span>
                <input value={form.lastName} onChange={set('lastName')} placeholder="e.g. Mushi" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Date of Birth</span>
                <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Gender</span>
                <select value={form.gender} onChange={set('gender')} className={selectField}>
                  <option value="">Select…</option><option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Interested Class</span>
                <select value={form.prospectiveClassId} onChange={set('prospectiveClassId')} className={selectField}>
                  <option value="">Not decided yet</option>
                  {classes.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}{cls.stream ? ` ${cls.stream}` : ''}</option>)}
                </select></label>
              <label className="md:col-span-3"><span className="text-xs font-black uppercase text-[#64748b]">Previous School</span>
                <input value={form.previousSchool} onChange={set('previousSchool')} placeholder="e.g. Moshi Primary School" className={field} /></label>
            </div>
          </section>

          <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
            <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#00334f]">
              <Phone className="h-3.5 w-3.5" /> Guardian Contact
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label><span className="text-xs font-black uppercase text-[#64748b]">Guardian First Name *</span>
                <input value={form.guardianFirstName} onChange={set('guardianFirstName')} placeholder="e.g. Joseph" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Guardian Last Name</span>
                <input value={form.guardianLastName} onChange={set('guardianLastName')} placeholder="Defaults to applicant surname" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Phone Number *</span>
                <input type="tel" value={form.guardianPhone} onChange={set('guardianPhone')} placeholder="+255 7XX XXX XXX — any format works" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Email</span>
                <input type="email" value={form.guardianEmail} onChange={set('guardianEmail')} placeholder="Optional" className={field} /></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">Relationship</span>
                <select value={form.guardianRelationship} onChange={set('guardianRelationship')} className={selectField}>
                  {RELATIONSHIP_OPTIONS.map((rel) => <option key={rel} value={rel}>{rel.charAt(0) + rel.slice(1).toLowerCase()}</option>)}
                </select></label>
              <label><span className="text-xs font-black uppercase text-[#64748b]">How did they hear about us?</span>
                <select value={form.sourceChannel} onChange={set('sourceChannel')} className={selectField}>
                  {SOURCE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select></label>
              <label className="md:col-span-2"><span className="text-xs font-black uppercase text-[#64748b]">Notes</span>
                <textarea value={form.notes} onChange={set('notes')} placeholder="Anything worth remembering about this family…"
                  className="mt-2 h-24 w-full rounded-xl border border-[#d5dde6] p-3 font-semibold outline-none focus:border-[#00334f]" /></label>
            </div>
          </section>
        </div>

        <div className="space-y-gutter">
          <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">What happens next</p>
            <ol className="mt-3 space-y-2 text-sm font-semibold text-[#475569]">
              <li>1 · The applicant lands in the <span className="font-black text-[#00334f]">Inquiry</span> column.</li>
              <li>2 · Advance them to Application, schedule an assessment, then issue an offer.</li>
              <li>3 · When the guardian accepts, one click enrols the student and links the parent account by phone.</li>
            </ol>
            <Button type="submit" className="mt-5 w-full rounded-xl" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Capture Inquiry'}
            </Button>
            <Button type="button" variant="secondary" className="mt-2 w-full rounded-xl" onClick={() => navigate('/admissions')}>
              Cancel
            </Button>
          </section>
          <section className="rounded-lg border border-[#d5dde6] bg-white p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#64748b]">Phone deduplication</p>
            <p className="mt-2 text-sm font-semibold text-[#64748b]">
              Guardian phone numbers are normalised automatically (0712…, 255712…, +255712… are the same). Siblings enrolled later will share one parent account.
            </p>
          </section>
        </div>
      </form>
    </AdmissionsWorkspaceShell>
  );
}

// ─── Student registry (full CRUD, same console admin uses) ──────────────────

export function AdmissionsStudentsPage() {
  return <AdminStudentsPage basePath="/admissions" />;
}

export function AdmissionsEnrolStudentPage() {
  return <AdminEnrolStudentPage />;
}

export function AdmissionsStudentProfilePage() {
  return <AdminStudentProfilePage basePath="/admissions" />;
}
