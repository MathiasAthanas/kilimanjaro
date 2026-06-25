import { AlertTriangle, ArrowRight, Award, BarChart2, BookOpen, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Copy, Download, FileText, Filter, GraduationCap, MessageSquarePlus, Scale, Search, Send, ShieldCheck, Star, TrendingDown, TrendingUp, Users, X, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { hodAlerts, hodApprovals, hodInterventions, hodMarks, hodPairings, hodSubjects, hodTeachers } from '../api/hodApi';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { downloadReportWhenReady, useGenerateReportMutation } from '../../operations/api/operations.hooks';
import {
  useAssessmentById,
  useEscalateAlertMutation,
  useHodAlerts,
  useHodAnnouncements,
  useHodApprovalHistory,
  useHodAudit,
  useHodClassSubjects,
  useHodInterventions,
  useHodPairings,
  useHodPendingApprovals,
  useHodStudentPerformance,
  useHodTeachersList,
  useMarksApprovalReview,
  useApproveAssessmentMutation,
  useRejectAssessmentMutation,
  useActivateHodPairingMutation,
  useCreateHodAnnouncementMutation,
  useCreateHodInterventionMutation,
  useStudentInterventionHistory,
  useTeacherAssessmentHistory,
  useRejectPairingMutation,
  useCompletePairingMutation,
  useResolveHodAlertMutation,
  useUpdateInterventionMutation,
} from '../api/hod.hooks';
import {
  ApprovalQueueCard,
  DepartmentAlertCard,
  HodMetricStrip,
  HodTable,
  HodWorkspaceShell,
  InterventionCard,
  PairingReviewCard,
  ProgressBar,
  RiskFlagBadge,
  SubjectHealthCard,
  TeacherRiskCard,
} from '../components/HodWorkspaceShell';
import { isOutlier, rejectReasonIsValid, sortOldestApprovalsFirst } from '../utils/hodReview';
import { useDepartmentByUser, useAllDisciplineRecords, useResolveDisciplineMutation } from '../../admin/api/admin.hooks';
import { useAuthStore } from '../../../lib/auth/authStore';

// ─── Home ──────────────────────────────────────────────────────────────────

export function HodHomePage() {
  const session = useAuthStore((state) => state.session);
  const currentUserId = session?.user?.id;
  const { data: myDept } = useDepartmentByUser(currentUserId);

  if ((myDept as any)?.code === 'DISC') {
    return <DisciplineHodPage />;
  }

  return <AcademicHodHome deptName={(myDept as any)?.name} />;
}

function AcademicHodHome({ deptName }: { deptName?: string }) {
  const { data: apiApprovals = [] } = useHodPendingApprovals();
  const { data: apiAlerts = [] } = useHodAlerts();
  const { data: apiTeachers = [] } = useHodTeachersList();
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const sortedApprovals = sortOldestApprovalsFirst(apiApprovals as unknown as Parameters<typeof sortOldestApprovalsFirst>[0]);
  const firstApproval = sortedApprovals[0] ?? null;
  return (
    <HodWorkspaceShell
      title="Department Command Center"
      eyebrow={deptName ? `${deptName} Department · HOD control room` : 'HOD academic control room'}
      action={
        firstApproval ? (
          <NavLink to={`/hod/approvals/${firstApproval.id}`}>
            <Button className="bg-ks-gold text-ks-navy hover:shadow-md hover:shadow-ks-gold/30">
              Review Oldest Approval
            </Button>
          </NavLink>
        ) : undefined
      }
    >
      {/* Priority band: Biology / Chemistry / Physics */}
      <div className="grid gap-gutter md:grid-cols-3">
        {apiSubjects.map((subject) => {
          const isRisk = subject.tone === 'rose';
          const isWatch = subject.tone === 'amber';
          return (
            <NavLink key={subject.id} to={`/hod/department/subjects/${subject.id}`}>
              <Card className={`group flex items-center justify-between rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-layer ${isRisk ? 'border-2 border-ks-rose bg-ks-rose/5 ring-1 ring-ks-rose/20 shadow-ks-rose/5' : ''}`}>
                <div>
                  <p className={`text-xs font-black uppercase tracking-wider ${isRisk ? 'text-ks-rose' : 'text-ks-muted'}`}>
                    {subject.name}
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-ks-navy">
                    {subject.average}% <span className="text-base font-bold text-ks-muted">avg</span>
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                    {isRisk ? (
                      <span className="text-ks-rose">⚠ {subject.atRisk} at-risk · action required</span>
                    ) : subject.pending > 0 ? (
                      <span className="text-ks-amber">{subject.pending} pending approval{subject.pending > 1 ? 's' : ''}</span>
                    ) : (
                      <span className="text-ks-emerald">✓ {subject.studentsAssessed} students assessed</span>
                    )}
                  </div>
                </div>
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition group-hover:scale-110 ${isRisk ? 'bg-ks-rose text-white' : isWatch ? 'bg-ks-amber/20 text-ks-amber group-hover:bg-ks-amber group-hover:text-white' : 'bg-ks-mist/50 text-ks-blue group-hover:bg-ks-blue group-hover:text-white'}`}>
                  <BookOpen className="h-6 w-6" />
                </div>
              </Card>
            </NavLink>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-gutter">
        {/* Left: Approvals queue */}
        <section className="col-span-12 xl:col-span-3 space-y-stack-md">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-black text-ks-navy">Pending Approvals</h3>
            <span className="rounded-full bg-ks-navy px-2 py-0.5 text-[10px] font-black text-white">
              {apiApprovals.length.toString().padStart(2, '0')}
            </span>
          </div>
          {sortedApprovals.map((approval) => (
            <ApprovalQueueCard key={approval.id} approval={approval} compact />
          ))}
        </section>

        {/* Center: Department health matrix + syllabus chart */}
        <section className="col-span-12 xl:col-span-6 space-y-gutter">
          <SectionTitle title="Department Health Matrix" action="/hod/department" />
          <Card className="overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-left text-sm">
                <thead className="bg-ks-paper text-[11px] font-black uppercase tracking-wider text-ks-navy">
                  <tr>
                    <th className="border-b border-ks-line px-5 py-3.5">Subject block</th>
                    <th className="border-b border-ks-line px-5 py-3.5">Class avg</th>
                    <th className="border-b border-ks-line px-5 py-3.5">Assessed</th>
                    <th className="border-b border-ks-line px-5 py-3.5">Alert level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ks-line">
                  {apiSubjects.map((subject) => (
                    <tr key={subject.id} className={`transition hover:bg-ks-paper ${subject.tone === 'rose' ? 'bg-ks-rose/5' : ''}`}>
                      <Td><span className="font-bold text-ks-navy">{subject.name}</span></Td>
                      <Td>
                        <span className={`font-black ${subject.average >= 75 ? 'text-ks-emerald' : subject.average >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>
                          {subject.average}%
                        </span>
                      </Td>
                      <Td>
                        <span className="text-sm font-bold text-ks-slate">{subject.studentsAssessed}</span>
                        <span className="ml-1 text-[10px] font-bold text-ks-muted">students</span>
                      </Td>
                      <Td>
                        {subject.tone === 'rose' ? (
                          <span className="rounded bg-ks-rose px-2 py-0.5 text-[10px] font-black text-white">CRITICAL</span>
                        ) : subject.tone === 'amber' ? (
                          <span className="rounded bg-ks-amber/20 px-2 py-0.5 text-[10px] font-black text-ks-amber">WATCH</span>
                        ) : (
                          <span className="rounded bg-ks-mist px-2 py-0.5 text-[10px] font-black text-ks-blue">STABLE</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Department grade distribution (real, summed across assessed subjects) */}
          <DepartmentGradeChart subjects={apiSubjects} />
        </section>

        {/* Right: Teacher risks + alert digest */}
        <section className="col-span-12 xl:col-span-3 space-y-gutter">
          <SectionTitle title="Teacher Risks" />
          {apiTeachers.length > 0 ? <TeacherRiskCard teacher={apiTeachers[0] as unknown as Parameters<typeof TeacherRiskCard>[0]['teacher']} /> : <p className="text-sm font-semibold text-ks-muted">No teacher data yet.</p>}
          <Card className="rounded-xl border-2 border-dashed border-ks-line p-5">
            <h4 className="flex items-center gap-2 font-display text-base font-black text-ks-navy">
              <span className="text-ks-amber">⚡</span> Alert Digest
            </h4>
            {apiAlerts.length === 0 && <p className="mt-4 text-sm font-semibold text-ks-emerald">No active performance alerts.</p>}
            <ul className="mt-4 space-y-4">
              {apiAlerts.slice(0, 6).map((alert) => {
                const sev = alert.severity;
                const dot = sev === 'CRITICAL' || sev === 'HIGH' ? 'bg-ks-rose' : sev === 'MEDIUM' ? 'bg-ks-amber' : 'bg-ks-emerald';
                return (
                  <li key={alert.id} className="flex gap-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ks-navy">{alert.student} <span className="font-semibold text-ks-muted">· {alert.subject}</span></p>
                      <p className="text-xs font-semibold text-ks-muted">{alert.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Approvals ─────────────────────────────────────────────────────────────

export function PendingApprovalsPage() {
  const { data: apiApprovals = [] as typeof hodApprovals, isLoading, isError, refetch } = useHodPendingApprovals() as unknown as { data: typeof hodApprovals; isLoading: boolean; isError: boolean; refetch: () => void };
  const sorted = sortOldestApprovalsFirst(apiApprovals);
  const oldest = sorted[0] ?? null;
  const avgGrade = apiApprovals.length ? Math.round(apiApprovals.reduce((s, a) => s + a.average, 0) / apiApprovals.length) : 0;
  return (
    <HodWorkspaceShell title="Pending Approvals" eyebrow="Oldest submissions first">
      <HodMetricStrip items={[
        { label: 'Total pending', value: isLoading ? '—' : String(apiApprovals.length).padStart(2, '0'), detail: 'Awaiting review', tone: 'bg-ks-navy', valueColor: 'text-ks-navy' },
        { label: 'Oldest submission', value: oldest ? `${oldest.submittedHoursAgo}h` : '—', detail: oldest ? `${oldest.subject} ${oldest.className}` : 'None pending', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Risk alerts', value: isLoading ? '—' : String(apiApprovals.filter((a) => a.average < 60).length).padStart(2, '0'), detail: 'Below 60% average', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Avg. grade', value: isLoading ? '—' : `${avgGrade}%`, detail: 'Department mean', inverted: true, icon: ShieldCheck },
      ]} />
      <Card className="overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line bg-ks-paper/50 px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-black text-ks-navy">Approval Queue</h2>
            <p className="text-sm font-semibold text-ks-muted">Review and authorise assessments submitted in the last 72 hours.</p>
          </div>
          <Button variant="secondary" className="rounded-xl py-2 text-xs">
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
        </div>
        {isLoading && <SkeletonTable cols={7} />}
        {isError && <DataError onRetry={refetch} />}
        {!isLoading && !isError && sorted.length === 0 && (
          <EmptyState title="No pending approvals" description="All assessments have been reviewed. New submissions will appear here." />
        )}
        {!isLoading && !isError && sorted.length > 0 && (
        <HodTable columns={['Age', 'Subject & Class', 'Instructor', 'Students', 'Avg %', 'Risk flag', 'Actions']}>
          {sorted.map((approval) => {
            const isRisk = approval.average < 60;
            return (
              <tr key={approval.id} className={`cursor-pointer transition hover:bg-ks-mist/10 ${isRisk ? 'bg-ks-rose/5' : ''}`}>
                <Td>
                  <span className={`font-black ${isRisk ? 'text-ks-rose' : 'text-ks-muted'}`}>
                    {approval.submittedHoursAgo}h
                  </span>
                </Td>
                <Td>
                  <p className="font-bold text-ks-navy">{approval.subject}</p>
                  <p className="text-xs text-ks-muted">{approval.className} · {approval.type}</p>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-[10px] font-black text-ks-blue">
                      {approval.teacher.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-ks-muted">{approval.teacher}</span>
                  </div>
                </Td>
                <Td>{approval.marked}/{approval.students}</Td>
                <Td>
                  <span className={`font-black ${isRisk ? 'text-ks-rose' : approval.average >= 75 ? 'text-ks-emerald' : 'text-ks-amber'}`}>
                    {approval.average}%
                  </span>
                </Td>
                <Td>
                  {approval.riskFlags.length > 0
                    ? <RiskFlagBadge flag={approval.riskFlags[0]} />
                    : <span className="rounded border border-ks-line bg-ks-mist/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-muted">Nominal</span>
                  }
                </Td>
                <Td>
                  <NavLink to={`/hod/approvals/${approval.id}`} className="font-black text-ks-blue hover:underline">
                    Review →
                  </NavLink>
                </Td>
              </tr>
            );
          })}
        </HodTable>
        )}
        {!isLoading && !isError && sorted.length > 0 && (
          <div className="border-t border-ks-line bg-ks-paper/30 px-5 py-3">
            <p className="text-xs font-bold italic text-ks-muted">Sorted by submission age · oldest first</p>
          </div>
        )}
      </Card>
    </HodWorkspaceShell>
  );
}

// ─── Approval review ────────────────────────────────────────────────────────

export function MarksApprovalReviewPage() {
  const { loading, approval } = useApproval();
  const navigate = useNavigate();
  const { data: apiMarks = [] as typeof hodMarks } = useMarksApprovalReview(approval?.id ?? '') as unknown as { data: typeof hodMarks };
  const [reason, setReason] = useState('');
  const approveMutation = useApproveAssessmentMutation();
  const rejectMutation = useRejectAssessmentMutation();

  if (loading) return <HodWorkspaceShell title="Loading…" eyebrow="Marks review"><SkeletonTable cols={6} /></HodWorkspaceShell>;
  if (!approval) return (
    <HodWorkspaceShell title="Not Found" eyebrow="Marks review">
      <EmptyState title="Assessment not found" description="This assessment may have already been processed or the link is invalid." />
    </HodWorkspaceShell>
  );

  const teacherInitials = approval.teacher.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const absentCount = apiMarks.filter((r) => r.absent).length;
  const scoredMarks = apiMarks.filter((r) => !r.absent && r.score !== null);
  const outlierCount = apiMarks.filter((r) => isOutlier(r, approval.average, 18)).length;
  const stdDev = scoredMarks.length > 1
    ? Math.round(Math.sqrt(scoredMarks.reduce((s, r) => s + Math.pow((r.score as number) - approval.average, 2), 0) / scoredMarks.length) * 10) / 10
    : 0;

  const handleApprove = () => {
    approveMutation.mutate({ id: approval.id }, {
      onSuccess: () => { toast('Assessment approved successfully', 'success'); navigate('/hod/approvals'); },
      onError: () => toast('Failed to approve assessment. Please try again.', 'error'),
    });
  };

  const handleReject = () => {
    if (!rejectReasonIsValid(reason)) return;
    rejectMutation.mutate({ id: approval.id, body: { reason } }, {
      onSuccess: () => { toast('Assessment returned to teacher for correction', 'warning'); navigate('/hod/approvals'); },
      onError: () => toast('Failed to reject assessment. Please try again.', 'error'),
    });
  };
  return (
    <HodWorkspaceShell title={approval.assessment} eyebrow="Marks review for approval">
      <div className="grid gap-gutter xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Left pane: stats */}
        <section className="space-y-stack-lg">
          <Card className="rounded-xl p-5">
            <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-black uppercase tracking-wider ${approval.average < 60 ? 'bg-ks-mist text-ks-navy' : 'bg-ks-mist text-ks-navy'}`}>
              Subject Review
            </span>
            <h2 className="mt-2 font-display text-2xl font-black text-ks-navy">{approval.subject} · {approval.className}</h2>

            {/* Teacher metadata */}
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-ks-line bg-ks-paper p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ks-blue text-sm font-black text-white">
                {teacherInitials}
              </div>
              <div>
                <p className="font-black text-ks-navy">{approval.teacher}</p>
                <p className="text-xs font-semibold text-ks-muted">Submitted {approval.submittedHoursAgo}h ago · {approval.type}</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatCell label="Average" value={`${approval.average}%`} tone={approval.average < 60 ? 'text-ks-rose' : 'text-ks-emerald'} />
              <StatCell label="Highest" value={String(approval.highest)} />
              <StatCell label="Lowest" value={String(approval.lowest)} tone="text-ks-rose" />
              <StatCell label="Outliers" value={String(outlierCount)} tone="text-ks-amber" />
              <StatCell label="Absent" value={String(absentCount)} />
              <StatCell label="Std dev" value={String(stdDev)} />
            </div>
          </Card>

          {/* Grade distribution visual — computed from real marks */}
          <MarksGradeDistribution marks={apiMarks} />

          {/* Statistical outliers */}
          <Card className="rounded-xl p-5">
            <h3 className="font-display text-xl font-black text-ks-navy">Statistical Outliers</h3>
            <div className="mt-4 space-y-3">
              {apiMarks.filter((row) => isOutlier(row, approval.average, 18)).slice(0, 3).map((row) => (
                <div key={row.registration} className="flex items-center justify-between rounded-xl border border-ks-line p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">
                      {row.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ks-navy">{row.student}</p>
                      <p className="text-[11px] text-ks-muted">{row.note || 'Score anomaly detected'}</p>
                    </div>
                  </div>
                  <span className={`font-black ${row.score !== null && row.score / row.maxScore < 0.4 ? 'text-ks-rose' : 'text-ks-emerald'}`}>
                    {row.score !== null ? `${Math.round((row.score / row.maxScore) * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Reject drawer */}
          <Card className="rounded-xl p-5">
            <SectionTitle title="Reject & Return" />
            {approval.average < 60 && (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-ks-rose/20 bg-ks-rose/5 p-3">
                <span className="text-ks-rose">⚠</span>
                <p className="text-sm font-semibold text-ks-rose">Class average is {Math.round(60 - approval.average)}% below the department benchmark. Multiple students below threshold.</p>
              </div>
            )}
            <textarea
              className="mt-4 h-28 w-full resize-none rounded-xl border border-ks-line p-3 text-sm font-semibold outline-none transition focus:border-ks-rose focus:ring-2 focus:ring-ks-rose/10"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Detail the reason for rejection. Minimum 20 characters."
            />
            <Button
              variant={rejectReasonIsValid(reason) ? 'danger' : 'secondary'}
              disabled={!rejectReasonIsValid(reason) || rejectMutation.isPending}
              className="mt-3 rounded-xl"
              onClick={handleReject}
            >
              {rejectMutation.isPending ? 'Sending…' : 'Confirm Rejection'}
            </Button>
          </Card>
        </section>

        {/* Right pane: marks table + sticky decision bar */}
        <section className="min-w-0 space-y-stack-lg">
          <MarksReviewTable marks={apiMarks} average={approval.average} />
          <Card className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border-ks-navy bg-white p-4 shadow-layer">
            <p className="text-sm font-semibold text-ks-muted">
              <b className="text-ks-navy">Decision:</b> Approving will update student academic records in the system.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" className="rounded-xl" onClick={handleReject} disabled={!rejectReasonIsValid(reason) || rejectMutation.isPending}>
                <XCircle className="h-4 w-4" /> {rejectMutation.isPending ? 'Sending…' : 'Reject'}
              </Button>
              <Button variant="success" className="rounded-xl" onClick={handleApprove} disabled={approveMutation.isPending}>
                <CheckCircle2 className="h-4 w-4" /> {approveMutation.isPending ? 'Approving…' : 'Approve & Finalise'}
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Approval history ───────────────────────────────────────────────────────

export function ApprovalHistoryPage() {
  const { data: apiApprovals = [], isLoading, isError, refetch } = useHodApprovalHistory() as { data: Array<Record<string, unknown>>; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <HodWorkspaceShell title="Approval History" eyebrow="Academic decision audit">
      <FilterBar items={['Date range', 'Subject', 'Teacher', 'Approved', 'Rejected']} />
      {isLoading && <SkeletonTable cols={8} />}
      {isError && <DataError onRetry={refetch} />}
      {!isLoading && !isError && apiApprovals.length === 0 && (
        <EmptyState title="No approval history" description="Approved and rejected assessments will appear here." />
      )}
      {!isLoading && !isError && apiApprovals.length > 0 && (
        <HodTable columns={['Date', 'Assessment', 'Subject', 'Class', 'Teacher', 'Decision', 'Reason', 'Average']}>
          {apiApprovals.map((approval) => {
            const decision = String(approval.decision ?? approval.status ?? '');
            const isApproved = decision.toUpperCase().includes('APPROV');
            const date = String(approval.decidedAt ?? approval.date ?? approval.createdAt ?? '—');
            const displayDate = date !== '—' && !isNaN(Date.parse(date)) ? new Date(date).toLocaleDateString() : date;
            const reason = String(approval.reason ?? approval.rejectionReason ?? '—');
            const teacher = String(approval.teacher ?? approval.teacherName ?? '—');
            const avg = Number(approval.average ?? approval.classAverage ?? 0);
            return (
              <tr key={String(approval.id)} className="hover:bg-ks-paper">
                <Td>{displayDate}</Td>
                <Td>{String(approval.assessment ?? approval.title ?? '—')}</Td>
                <Td>{String(approval.subject ?? '—')}</Td>
                <Td>{String(approval.className ?? '—')}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-[10px] font-black text-ks-blue">
                      {teacher.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <span>{teacher}</span>
                  </div>
                </Td>
                <Td>
                  <Badge tone={isApproved ? 'emerald' : 'rose'}>{isApproved ? 'APPROVED' : 'REJECTED'}</Badge>
                </Td>
                <Td>{reason}</Td>
                <Td>
                  <span className={`font-black ${avg >= 75 ? 'text-ks-emerald' : avg >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>
                    {avg}%
                  </span>
                </Td>
              </tr>
            );
          })}
        </HodTable>
      )}
    </HodWorkspaceShell>
  );
}

// ─── Department overview ────────────────────────────────────────────────────

export function DepartmentOverviewPage() {
  const { data: apiSubjects = [] as typeof hodSubjects, isLoading } = useHodClassSubjects() as unknown as { data: typeof hodSubjects; isLoading: boolean };
  const riskSubject = apiSubjects.find((s) => s.tone === 'rose') ?? apiSubjects[0] ?? null;
  const totalAtRisk = apiSubjects.reduce((s, sub) => s + sub.atRisk, 0);
  const totalAssessed = apiSubjects.reduce((s, sub) => s + sub.studentsAssessed, 0);
  const totalPending = apiSubjects.reduce((s, sub) => s + sub.pending, 0);
  const topSubject = [...apiSubjects].filter((s) => s.studentsAssessed > 0).sort((a, b) => b.average - a.average)[0] ?? null;
  return (
    <HodWorkspaceShell title="Department Overview" eyebrow="Subjects performance overview">
      {riskSubject && <SubjectTabs active={riskSubject.id} />}
      <HodMetricStrip items={[
        { label: riskSubject ? `${riskSubject.name} avg` : 'Lowest subject', value: riskSubject ? `${riskSubject.average}%` : '—', detail: riskSubject ? 'Weakest subject' : 'No data yet', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'At-risk students', value: isLoading ? '—' : String(totalAtRisk), detail: 'Critical / high alerts', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Students assessed', value: isLoading ? '—' : String(totalAssessed), detail: `${totalPending} pending approval${totalPending === 1 ? '' : 's'}`, tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Top subject', value: topSubject ? `${topSubject.average}%` : '—', detail: topSubject?.name ?? 'N/A', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-3">
        {apiSubjects.map((subject) => <SubjectHealthCard key={subject.id} subject={subject} />)}
      </div>
      <DepartmentMatrixTable />
      <div className="grid gap-gutter xl:grid-cols-2">
        <TeacherSubmissionMatrix />
        <NavyInsightPanel />
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Subject detail ─────────────────────────────────────────────────────────

export function SubjectDetailPage() {
  const { loading, subject } = useSubject();
  const { data: apiAlerts = [] } = useHodAlerts();
  const { data: apiTeachers = [] } = useHodTeachersList();

  if (loading) return <HodWorkspaceShell title="Loading…" eyebrow="Subject drilldown"><SkeletonTable cols={6} /></HodWorkspaceShell>;
  if (!subject) return <HodWorkspaceShell title="Not Found" eyebrow="Subject drilldown"><EmptyState title="Subject not found" description="This subject could not be found in your department." /></HodWorkspaceShell>;

  const subjectAlerts = (apiAlerts as Array<{ id: string; subject: string }>).filter((a) => a.subject === subject.name);
  const subjectTeacher = (apiTeachers as unknown as Array<Parameters<typeof TeacherRiskCard>[0]['teacher']>).find((t) => t.name === subject.teacher) ?? null;

  return (
    <HodWorkspaceShell title={`${subject.name} Analytics`} eyebrow="Subject drilldown">
      <SubjectTabs active={subject.id} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-gutter">
          <SubjectHealthCard subject={subject} />
          <DepartmentMatrixTable subjectId={subject.id} />
          <TrendBoard subject={subject} />
        </section>
        <section className="space-y-stack-lg">
          {subjectTeacher && <TeacherRiskCard teacher={subjectTeacher} />}
          <Card className="rounded-xl p-5">
            <SectionTitle title="At-risk students" />
            <div className="mt-4 space-y-3">
              {subjectAlerts.length === 0 && <p className="text-sm font-semibold text-ks-emerald">No at-risk students for this subject.</p>}
              {(subjectAlerts as typeof apiAlerts extends Array<infer T> ? T[] : never[]).map((alert: { id: string }) => (
                <DepartmentAlertCard key={alert.id} alert={alert as Parameters<typeof DepartmentAlertCard>[0]['alert']} />
              ))}
            </div>
          </Card>
        </section>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Teacher performance list ───────────────────────────────────────────────

export function TeacherPerformanceListPage() {
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as unknown as { data: typeof hodTeachers };
  const riskTeacher = [...apiTeachers].sort((a, b) => a.onTime - b.onTime)[0] ?? null;
  const topTeacher = [...apiTeachers].sort((a, b) => b.average - a.average)[0] ?? null;
  return (
    <HodWorkspaceShell title="Teacher Performance Matrix" eyebrow="Respectful accountability">
      <HodMetricStrip items={[
        { label: 'On-time rate', value: apiTeachers.length ? `${Math.round(apiTeachers.reduce((s, t) => s + t.onTime, 0) / apiTeachers.length)}%` : '—', detail: 'Dept avg submissions', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Below target', value: String(apiTeachers.filter((t) => t.average < 60).length).padStart(2, '0'), detail: 'Below 60% avg', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Pending review', value: String(apiTeachers.reduce((sum, t) => sum + (t.pending ?? 0), 0)).padStart(2, '0'), detail: 'Across dept', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Top performer', value: topTeacher ? `${topTeacher.average}%` : '—', detail: topTeacher?.name ?? 'N/A', inverted: true, icon: TrendingUp },
      ]} />
      {riskTeacher && riskTeacher.onTime < 70 && (
        <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-rose bg-ks-rose/5 p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-rose">Attention required</p>
          <h2 className="mt-2 font-display text-2xl font-black text-ks-navy">{riskTeacher.name} — timeliness below target</h2>
          <p className="mt-2 text-sm font-semibold text-ks-muted">On-time submission rate is {riskTeacher.onTime}%. Consider a support review.</p>
        </Card>
      )}
      <TeachersTable />
    </HodWorkspaceShell>
  );
}

// ─── Teacher detail ─────────────────────────────────────────────────────────

export function TeacherDetailPage() {
  const { loading, teacher } = useTeacher();
  const { teacherId } = useParams();
  const navigate = useNavigate();

  const { data: allAlerts = [] } = useHodAlerts();
  const { data: teacherAssessments = [], isLoading: histLoading } = useTeacherAssessmentHistory(teacherId ?? '');
  const generateMutation = useGenerateReportMutation();
  const announcementMutation = useCreateHodAnnouncementMutation();

  const [supportExpanded, setSupportExpanded] = useState(false);
  const [supportNote, setSupportNote] = useState('');
  const [supportPriority, setSupportPriority] = useState('NORMAL');
  const [generating, setGenerating] = useState(false);

  const teacherAlerts = (allAlerts as any[]).filter(
    (a: any) => teacher && (a.teacherId === teacherId || a.teacher === teacher.name),
  );
  const criticalAlerts = teacherAlerts.filter((a: any) => a.severity === 'CRITICAL' || a.severity === 'HIGH');

  // Per-subject breakdown from assessment history
  const subjectMap = new Map<string, { count: number; scoreSum: number; students: number; latest: string }>();
  for (const a of teacherAssessments as any[]) {
    const key = a.subject || 'Unknown';
    const prev = subjectMap.get(key) ?? { count: 0, scoreSum: 0, students: 0, latest: '' };
    subjectMap.set(key, {
      count: prev.count + 1,
      scoreSum: prev.scoreSum + (a.average ?? 0),
      students: Math.max(prev.students, a.students ?? 0),
      latest: a.submittedAt || prev.latest,
    });
  }
  const subjectBreakdown = Array.from(subjectMap.entries()).map(([name, v]) => ({
    name,
    avg: v.count > 0 ? Math.round(v.scoreSum / v.count) : 0,
    assessments: v.count,
    students: v.students,
  })).sort((a, b) => b.avg - a.avg);

  const totalAssessments = (teacherAssessments as any[]).length;
  const avgScore = totalAssessments > 0
    ? Math.round((teacherAssessments as any[]).reduce((s, a: any) => s + (a.average ?? 0), 0) / totalAssessments)
    : teacher?.average ?? 0;

  const handleExport = async () => {
    setGenerating(true);
    try {
      const result = await generateMutation.mutateAsync({
        reportType: 'TEACHER_PERFORMANCE',
        scope: 'teacher',
        filters: { teacherId },
      }) as any;
      const jobId = String(result?.id ?? result?.reportId ?? result?.jobId ?? '');
      if (jobId) {
        await downloadReportWhenReady(jobId, `${teacher?.name ?? 'Teacher'}-performance-report.pdf`);
        toast('Report downloaded successfully', 'success');
      } else {
        throw new Error('No job ID returned');
      }
    } catch {
      toast('Report generation failed. Please retry.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleSupportRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportNote.trim()) { toast('Please write a support note before sending', 'warning'); return; }
    announcementMutation.mutate(
      {
        title: `HOD Support Note — ${teacher?.name ?? 'Teacher'}`,
        body: supportNote.trim(),
        priority: supportPriority,
        targetAudience: 'TEACHER',
        recipientId: teacherId,
      },
      {
        onSuccess: () => {
          toast('Support record created and sent to teacher', 'success');
          setSupportNote('');
          setSupportExpanded(false);
        },
        onError: () => toast('Failed to send support record. Please retry.', 'error'),
      },
    );
  };

  if (loading) return <HodWorkspaceShell title="Loading…" eyebrow="Teacher department profile"><SkeletonTable cols={5} /></HodWorkspaceShell>;
  if (!teacher) return <HodWorkspaceShell title="Not Found" eyebrow="Teacher department profile"><EmptyState title="Teacher not found" description="This teacher profile could not be loaded." /></HodWorkspaceShell>;

  return (
    <HodWorkspaceShell title={teacher.name} eyebrow="Teacher department profile — HOD workspace">
      <HodMetricStrip items={[
        { label: 'Class average', value: `${avgScore}%`, detail: totalAssessments > 0 ? `${totalAssessments} assessments` : 'No data', tone: avgScore >= 65 ? 'bg-ks-emerald' : avgScore >= 50 ? 'bg-ks-amber' : 'bg-ks-rose', valueColor: avgScore >= 65 ? 'text-ks-emerald' : avgScore >= 50 ? 'text-ks-amber' : 'text-ks-rose' },
        { label: 'On-time rate', value: `${teacher.onTime ?? 100}%`, detail: 'Submission timeliness', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Pending approvals', value: String(teacher.pending ?? 0).padStart(2, '0'), detail: 'Awaiting HOD review', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Student alerts', value: String(teacherAlerts.length).padStart(2, '0'), detail: criticalAlerts.length > 0 ? `${criticalAlerts.length} critical` : 'In teacher\'s classes', tone: criticalAlerts.length > 0 ? 'bg-ks-rose' : 'bg-ks-gold', valueColor: criticalAlerts.length > 0 ? 'text-ks-rose' : 'text-ks-amber', icon: ShieldCheck },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Left column: profile + data ─────────────────── */}
        <section className="space-y-gutter">
          <TeacherRiskCard teacher={teacher} />

          {/* Per-subject breakdown */}
          {subjectBreakdown.length > 0 && (
            <Card className="rounded-xl p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Subject performance breakdown</p>
              <div className="mt-4 space-y-3">
                {subjectBreakdown.map((s) => {
                  const bar = Math.max(4, s.avg);
                  const color = s.avg >= 65 ? 'bg-ks-emerald' : s.avg >= 50 ? 'bg-ks-amber' : 'bg-ks-rose';
                  const textColor = s.avg >= 65 ? 'text-ks-emerald' : s.avg >= 50 ? 'text-ks-amber' : 'text-ks-rose';
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-ks-slate">{s.name}</span>
                        <div className="flex items-center gap-3 text-xs text-ks-muted">
                          <span>{s.assessments} assessment{s.assessments !== 1 ? 's' : ''}</span>
                          <span className={`font-black ${textColor}`}>{s.avg > 0 ? `${s.avg}%` : '—'}</span>
                        </div>
                      </div>
                      <div className="mt-1.5 h-2 w-full rounded-full bg-ks-paper">
                        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${bar}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Recent assessment submissions */}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Recent assessment submissions</p>
            {histLoading && <SkeletonTable cols={4} />}
            {!histLoading && (teacherAssessments as any[]).length === 0 && (
              <EmptyState title="No submissions yet" description="Assessments submitted by this teacher will appear here." />
            )}
            {!histLoading && (teacherAssessments as any[]).length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ks-border">
                      <th className="pb-2 text-left text-[11px] font-black uppercase tracking-widest text-ks-muted">Assessment</th>
                      <th className="pb-2 text-left text-[11px] font-black uppercase tracking-widest text-ks-muted">Subject</th>
                      <th className="pb-2 text-left text-[11px] font-black uppercase tracking-widest text-ks-muted">Class</th>
                      <th className="pb-2 text-right text-[11px] font-black uppercase tracking-widest text-ks-muted">Avg</th>
                      <th className="pb-2 text-right text-[11px] font-black uppercase tracking-widest text-ks-muted">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(teacherAssessments as any[]).slice(0, 10).map((a: any) => {
                      const statusColor = a.status === 'HOD_APPROVED' ? 'text-ks-emerald' : a.status === 'REJECTED' ? 'text-ks-rose' : a.status === 'SUBMITTED' ? 'text-ks-blue' : 'text-ks-muted';
                      const statusLabel = a.status === 'HOD_APPROVED' ? 'Approved' : a.status === 'SUBMITTED' ? 'Pending' : a.status === 'REJECTED' ? 'Rejected' : a.status;
                      return (
                        <tr key={a.id} className="border-b border-ks-border/50 last:border-0">
                          <td className="py-2.5 font-semibold text-ks-navy">{a.assessment}</td>
                          <td className="py-2.5 text-ks-slate">{a.subject}</td>
                          <td className="py-2.5 text-ks-slate">{a.className}</td>
                          <td className="py-2.5 text-right font-black text-ks-navy">{a.average > 0 ? `${a.average}%` : '—'}</td>
                          <td className={`py-2.5 text-right text-xs font-black ${statusColor}`}>{statusLabel}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Student alerts from teacher's classes */}
          {teacherAlerts.length > 0 && (
            <div className="space-y-3">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">
                Student alerts in this teacher's classes ({teacherAlerts.length})
              </p>
              {teacherAlerts.map((alert: any) => (
                <DepartmentAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </section>

        {/* ── Right column: working actions + insights ─────── */}
        <section className="space-y-stack-lg">
          {/* Action 1: Open class analytics */}
          <Card className="rounded-xl border-l-4 border-l-ks-blue p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Class analytics</p>
            <p className="mt-1 text-sm text-ks-slate">Deep analytics dashboard for this teacher's classes — score trends, grade distribution, cohort comparison.</p>
            <Button
              className="mt-4 w-full justify-between rounded-xl"
              onClick={() => navigate(`/analytics/academic/teachers/${teacherId}`)}
            >
              <span className="flex items-center gap-2"><BarChart2 className="h-4 w-4" /> Open class analytics</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Card>

          {/* Action 2: Create support record */}
          <Card className="rounded-xl border-l-4 border-l-ks-amber p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Support record</p>
            <p className="mt-1 text-sm text-ks-slate">Send a coaching note or formal support instruction directly to this teacher.</p>
            {!supportExpanded ? (
              <Button
                variant="secondary"
                className="mt-4 w-full justify-between rounded-xl"
                onClick={() => setSupportExpanded(true)}
              >
                <span className="flex items-center gap-2"><MessageSquarePlus className="h-4 w-4" /> Create support record</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            ) : (
              <form onSubmit={handleSupportRecord} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-ks-muted">Priority</label>
                  <select
                    value={supportPriority}
                    onChange={(e) => setSupportPriority(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-ks-border bg-ks-paper px-3 py-2 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-ks-muted">Note to teacher</label>
                  <textarea
                    value={supportNote}
                    onChange={(e) => setSupportNote(e.target.value)}
                    rows={4}
                    placeholder={`Write your support note or instruction to ${teacher.name}…`}
                    className="mt-1 w-full rounded-lg border border-ks-border bg-ks-paper px-3 py-2 text-sm text-ks-navy placeholder:text-ks-muted/60 focus:border-ks-blue focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 justify-center rounded-xl" disabled={announcementMutation.isPending}>
                    <Send className="mr-2 h-4 w-4" /> {announcementMutation.isPending ? 'Sending…' : 'Send to Teacher'}
                  </Button>
                  <Button type="button" variant="secondary" className="rounded-xl px-3" onClick={() => setSupportExpanded(false)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            )}
          </Card>

          {/* Action 3: Export teacher report */}
          <Card className="rounded-xl border-l-4 border-l-ks-navy p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Branded report</p>
            <p className="mt-1 text-sm text-ks-slate">Generate a detailed PDF performance report — includes assessment history, averages, class comparisons, and risk summary.</p>
            <Button
              className="mt-4 w-full justify-between rounded-xl bg-ks-navy text-white hover:bg-ks-navy/90"
              onClick={handleExport}
              disabled={generating}
            >
              <span className="flex items-center gap-2"><Download className="h-4 w-4" /> {generating ? 'Generating report…' : 'Export teacher report'}</span>
              {!generating && <ArrowRight className="h-4 w-4" />}
            </Button>
            {generating && (
              <p className="mt-2 text-center text-xs text-ks-muted">Building branded PDF — this may take a few seconds…</p>
            )}
          </Card>

          {/* Dept comparison insights */}
          <NavyInsightPanel />
        </section>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Student Performance Hub ─────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { type: 'TEACHER_SUPPORT_GIVEN',       label: 'Note to Teacher',      color: 'text-ks-blue',    bg: 'bg-ks-blue/10'    },
  { type: 'ALERT_ESCALATED',             label: 'Escalate to Principal', color: 'text-ks-rose',    bg: 'bg-ks-rose/10'    },
  { type: 'PARENT_MEETING_SCHEDULED',    label: 'Parent Meeting',        color: 'text-ks-amber',   bg: 'bg-ks-amber/10'   },
  { type: 'ADDITIONAL_LESSONS_ASSIGNED', label: 'Extra Lessons',         color: 'text-ks-emerald', bg: 'bg-ks-emerald/10' },
] as const;

const ALERT_PAGE_SIZE = 10;

export function DepartmentAlertsPage() {
  const { data: rawAlerts = [], isLoading, isError, refetch } = useHodAlerts();
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const createMutation = useCreateHodInterventionMutation();
  const escalateMutation = useEscalateAlertMutation();
  const resolveAlert = useResolveHodAlertMutation();
  const generateMutation = useGenerateReportMutation();

  const [tab, setTab] = useState<'risk' | 'monitoring' | 'improving'>('risk');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [actionPanelId, setActionPanelId] = useState<string | null>(null);
  const [actionType, setActionType] = useState('TEACHER_SUPPORT_GIVEN');
  const [actionNote, setActionNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [generating, setGenerating] = useState(false);

  const allAlerts = rawAlerts as any[];
  const critical  = allAlerts.filter((a: any) => a.severity === 'CRITICAL' || a.severity === 'HIGH');
  const monitoring = allAlerts.filter((a: any) => a.severity === 'MEDIUM');
  const improving  = allAlerts.filter((a: any) => a.severity === 'LOW' || a.severity === 'POSITIVE');
  const baseList   = tab === 'risk' ? critical : tab === 'monitoring' ? monitoring : improving;
  const subjects   = Array.from(new Set(allAlerts.map((a: any) => a.subject))).filter(Boolean) as string[];

  const filtered = baseList.filter((a: any) => {
    const q = search.toLowerCase();
    return (!search || a.student.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q) || a.className.toLowerCase().includes(q))
      && (subjectFilter === 'ALL' || a.subject === subjectFilter);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / ALERT_PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * ALERT_PAGE_SIZE, page * ALERT_PAGE_SIZE);
  const topSubjects = [...(apiSubjects as any[])].filter((s: any) => s.average > 0).sort((a: any, b: any) => b.average - a.average);

  const openPanel = (id: string) => {
    setActionPanelId((prev) => (prev === id ? null : id));
    setActionNote(''); setFollowUpDate(''); setActionType('TEACHER_SUPPORT_GIVEN');
  };

  const submitAction = (alert: any) => {
    if (!actionNote.trim()) { toast('Please write a note', 'warning'); return; }
    if (actionType === 'ALERT_ESCALATED') {
      escalateMutation.mutate(
        { alertId: alert.id, body: { studentId: alert.studentId, note: actionNote } },
        { onSuccess: () => { toast('Escalated to principal', 'success'); setActionPanelId(null); setActionNote(''); }, onError: () => toast('Escalation failed', 'error') },
      );
    } else {
      createMutation.mutate(
        { studentId: alert.studentId, type: actionType, note: actionNote, subjectName: alert.subject, followUpDate: followUpDate || undefined },
        { onSuccess: () => { toast('Action recorded successfully', 'success'); setActionPanelId(null); setActionNote(''); }, onError: () => toast('Failed to save action', 'error') },
      );
    }
  };

  const handleResolve = (alert: any) => {
    resolveAlert.mutate(
      { id: alert.id, body: { note: 'Resolved by HOD', studentId: alert.studentId } },
      { onSuccess: () => toast('Alert resolved', 'success'), onError: () => toast('Could not resolve', 'error') },
    );
  };

  const handleExport = async () => {
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({ reportType: 'PERFORMANCE_REPORT', scope: 'department' }) as any;
      const jobId = String(res?.id ?? res?.reportId ?? res?.jobId ?? '');
      if (jobId) { await downloadReportWhenReady(jobId, 'Department-Performance-Report.pdf'); toast('Report downloaded', 'success'); }
      else throw new Error();
    } catch { toast('Report generation failed', 'error'); } finally { setGenerating(false); }
  };

  return (
    <HodWorkspaceShell
      title="Student Performance Hub"
      eyebrow="Department risk management, recognition and interventions"
      action={
        <Button className="bg-ks-gold text-ks-navy hover:shadow-md" onClick={handleExport} disabled={generating}>
          <Download className="mr-1.5 h-4 w-4" />{generating ? 'Generating…' : 'Export Report'}
        </Button>
      }
    >
      <HodMetricStrip items={[
        { label: 'At risk', value: String(critical.length).padStart(2, '0'), detail: critical[0] ? `Highest: ${critical[0].student}` : 'None flagged', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Monitoring', value: String(monitoring.length).padStart(2, '0'), detail: monitoring[0] ? `Latest: ${monitoring[0].subject}` : 'None flagged', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Improving', value: String(improving.length).padStart(2, '0'), detail: 'Positive trend', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Total tracked', value: String(allAlerts.length).padStart(2, '0'), detail: `${subjects.length} subject${subjects.length !== 1 ? 's' : ''}`, inverted: true, icon: ShieldCheck },
      ]} />

      {isLoading && <SkeletonTable cols={3} />}
      {isError && <DataError onRetry={refetch} />}

      {!isLoading && !isError && (
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_280px]">

          {/* ── Left: alert list ─────────────────────────── */}
          <div className="space-y-4">

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-ks-border bg-ks-paper p-1">
              {([['risk','At Risk',critical.length],['monitoring','Monitoring',monitoring.length],['improving','Improving',improving.length]] as const).map(([key,label,count]) => (
                <button key={key} onClick={() => { setTab(key); setPage(1); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition ${tab === key ? 'bg-ks-navy text-white shadow-sm' : 'text-ks-muted hover:text-ks-navy'}`}>
                  {label}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${tab === key ? 'bg-white/20 text-white' : 'bg-ks-mist text-ks-slate'}`}>{count}</span>
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ks-muted" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search student, subject, class…"
                  className="h-10 w-full rounded-xl border border-ks-border bg-white pl-10 pr-8 text-sm font-semibold text-ks-navy placeholder:text-ks-muted focus:border-ks-blue focus:outline-none" />
                {search && (
                  <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ks-muted hover:text-ks-navy">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
                className="h-10 rounded-xl border border-ks-border bg-white px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none">
                <option value="ALL">All Subjects</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Result count */}
            {filtered.length > 0 && (
              <p className="text-xs font-semibold text-ks-muted">
                {Math.min(filtered.length, (page-1)*ALERT_PAGE_SIZE+1)}–{Math.min(filtered.length, page*ALERT_PAGE_SIZE)} of {filtered.length} student{filtered.length!==1?'s':''}
              </p>
            )}

            {filtered.length === 0 && (
              <EmptyState
                title={search ? 'No results' : `No ${tab === 'risk' ? 'at-risk' : tab} students`}
                description={search ? `No students match "${search}"` : 'This category is currently empty.'}
              />
            )}

            {/* Alert cards with inline action panel */}
            <div className="space-y-3">
              {paginated.map((alert: any) => {
                const high   = alert.severity === 'CRITICAL' || alert.severity === 'HIGH';
                const med    = alert.severity === 'MEDIUM';
                const tone   = high ? 'rose' : med ? 'amber' : 'emerald';
                const border = tone === 'rose' ? 'border-l-ks-rose' : tone === 'amber' ? 'border-l-ks-amber' : 'border-l-ks-emerald';
                const bgTone = tone === 'rose' ? 'bg-ks-rose' : tone === 'amber' ? 'bg-ks-amber' : 'bg-ks-emerald';
                const textTone = tone === 'rose' ? 'text-ks-rose' : tone === 'amber' ? 'text-ks-amber' : 'text-ks-emerald';
                const badgeBg  = tone === 'rose' ? 'border-ks-rose/25 bg-ks-rose/10 text-ks-rose' : tone === 'amber' ? 'border-ks-amber/25 bg-ks-amber/10 text-ks-amber' : 'border-ks-emerald/25 bg-ks-emerald/10 text-ks-emerald';
                const isOpen   = actionPanelId === alert.id;
                return (
                  <Card key={alert.id} className={`overflow-hidden rounded-xl border-l-4 ${border}`}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-black text-white ${bgTone}`}>
                          {alert.student.split(' ').map((p: string) => p[0]).join('').slice(0,2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="text-xs font-black uppercase tracking-wider text-ks-muted">{alert.subject} · {alert.className}</p>
                              <h3 className="font-display text-xl font-black text-ks-navy">{alert.student}</h3>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {alert.currentScore != null && (
                                <span className={`rounded border px-2 py-0.5 text-[11px] font-black ${badgeBg}`}>{Math.round(alert.currentScore)}%</span>
                              )}
                              <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${badgeBg}`}>{alert.severity}</span>
                            </div>
                          </div>
                          <p className="mt-1.5 text-sm font-semibold text-ks-muted">{alert.reason}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <NavLink to={`/hod/students/${alert.studentId}`}>
                          <Button variant="secondary" className="rounded-lg py-1.5 text-xs">View Profile</Button>
                        </NavLink>
                        <Button variant={isOpen ? 'quiet' : 'secondary'}
                          className={`rounded-lg py-1.5 text-xs ${isOpen ? 'bg-ks-navy text-white' : ''}`}
                          onClick={() => openPanel(alert.id)}>
                          {isOpen ? 'Close' : 'Take Action'}
                          {isOpen ? <ChevronUp className="ml-1 h-3 w-3 inline" /> : <ChevronDown className="ml-1 h-3 w-3 inline" />}
                        </Button>
                        {tone !== 'rose' && (
                          <Button variant="quiet" className="rounded-lg py-1.5 text-xs text-ks-muted" onClick={() => handleResolve(alert)}>
                            Mark Resolved
                          </Button>
                        )}
                      </div>

                      {/* Inline action panel */}
                      {isOpen && (
                        <div className="mt-4 rounded-xl border border-ks-border bg-ks-paper p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-ks-muted">HOD Action — {alert.student}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {QUICK_ACTIONS.map((a) => (
                              <button key={a.type} type="button" onClick={() => setActionType(a.type)}
                                className={`rounded-full border px-3 py-1 text-xs font-black transition ${actionType === a.type ? `${a.bg} ${a.color} border-current` : 'border-ks-border text-ks-muted hover:border-ks-navy hover:text-ks-navy'}`}>
                                {a.label}
                              </button>
                            ))}
                          </div>
                          <textarea value={actionNote} onChange={(e) => setActionNote(e.target.value)} rows={3}
                            placeholder={actionType === 'ALERT_ESCALATED' ? 'Escalation reason…' : actionType === 'TEACHER_SUPPORT_GIVEN' ? 'Note to teacher…' : 'Action details…'}
                            className="mt-3 w-full resize-none rounded-xl border border-ks-border bg-white p-3 text-sm font-semibold text-ks-navy placeholder:text-ks-muted/60 focus:border-ks-blue focus:outline-none" />
                          {actionType !== 'ALERT_ESCALATED' && (
                            <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                              className="mt-2 h-9 w-full rounded-xl border border-ks-border bg-white px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none" />
                          )}
                          <div className="mt-3 flex gap-2">
                            <Button className={`flex-1 rounded-xl ${actionType === 'ALERT_ESCALATED' ? 'bg-ks-rose text-white hover:bg-ks-rose/90' : ''}`}
                              onClick={() => submitAction(alert)}
                              disabled={createMutation.isPending || escalateMutation.isPending}>
                              <Send className="mr-2 h-3.5 w-3.5" />
                              {createMutation.isPending || escalateMutation.isPending ? 'Saving…' : actionType === 'ALERT_ESCALATED' ? 'Escalate' : 'Record Action'}
                            </Button>
                            <Button variant="secondary" className="rounded-xl px-3" onClick={() => setActionPanelId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ks-muted">Page {page} of {pageCount}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => setPage((p) => Math.max(1, p-1))} disabled={page===1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                    const n = pageCount <= 5 ? i+1 : page <= 3 ? i+1 : page >= pageCount-2 ? pageCount-4+i : page-2+i;
                    return (
                      <Button key={n} variant={page===n?'primary':'secondary'} className="rounded-lg px-3 py-1.5 text-sm" onClick={() => setPage(n)}>{n}</Button>
                    );
                  })}
                  <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => setPage((p) => Math.min(pageCount, p+1))} disabled={page===pageCount}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: subject leaderboard ───────────────── */}
          <div>
            <Card className="sticky top-24 h-fit rounded-xl p-5">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-ks-gold" />
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Subject leaderboard</p>
              </div>
              <div className="mt-4 space-y-3">
                {topSubjects.slice(0, 8).map((s: any, i: number) => {
                  const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
                  const barColor = s.average>=65?'bg-ks-emerald':s.average>=50?'bg-ks-amber':'bg-ks-rose';
                  const tc = s.average>=65?'text-ks-emerald':s.average>=50?'text-ks-amber':'text-ks-rose';
                  return (
                    <div key={s.id} className="flex items-center gap-3">
                      <span className="w-6 shrink-0 text-center text-sm">{medal}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm font-semibold text-ks-navy">{s.name}</p>
                          <p className={`ml-2 shrink-0 text-xs font-black ${tc}`}>{s.average}%</p>
                        </div>
                        <div className="mt-1 h-1.5 w-full rounded-full bg-ks-paper">
                          <div className={`h-1.5 rounded-full ${barColor}`} style={{ width:`${s.average}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {topSubjects.length === 0 && <p className="text-xs text-ks-muted">No subject data yet.</p>}
              </div>
              <NavLink to="/hod/department" className="mt-4 flex items-center justify-between rounded-xl border border-ks-border bg-ks-paper px-3 py-2 text-xs font-black text-ks-navy hover:bg-ks-mist">
                Full department overview <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            </Card>
          </div>
        </div>
      )}
    </HodWorkspaceShell>
  );
}

// ─── Peer Pairings Hub ───────────────────────────────────────────────────────

const PAIRING_PAGE_SIZE = 8;

export function DepartmentPairingsPage() {
  const { data: rawPairings = [], isLoading, isError, refetch } = useHodPairings();
  const allPairings = rawPairings as any[];
  const activateMutation = useActivateHodPairingMutation();
  const rejectMutation   = useRejectPairingMutation();
  const generateMutation = useGenerateReportMutation();

  const [tab, setTab] = useState<'SUGGESTED'|'ACTIVE'|'COMPLETED'>('SUGGESTED');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [generating, setGenerating] = useState(false);

  const tabCounts = { SUGGESTED: 0, ACTIVE: 0, COMPLETED: 0 };
  for (const p of allPairings) { const s = (p.status??'').toUpperCase(); if (s in tabCounts) tabCounts[s as keyof typeof tabCounts]++; }
  const subjects = Array.from(new Set(allPairings.map((p: any) => p.subject))).filter(Boolean) as string[];

  const filtered = allPairings.filter((p: any) => {
    const q = search.toLowerCase();
    return (p.status??'').toUpperCase()===tab
      && (!search || p.mentor.toLowerCase().includes(q) || p.support.toLowerCase().includes(q) || p.subject.toLowerCase().includes(q))
      && (subjectFilter==='ALL' || p.subject===subjectFilter);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAIRING_PAGE_SIZE));
  const paginated = filtered.slice((page-1)*PAIRING_PAGE_SIZE, page*PAIRING_PAGE_SIZE);

  const handleActivate = (id: string) => {
    activateMutation.mutate({ id }, { onSuccess: () => toast('Pairing activated', 'success'), onError: () => toast('Activation failed', 'error') });
  };
  const handleReject = (id: string) => {
    rejectMutation.mutate({ id }, { onSuccess: () => toast('Pairing rejected', 'success'), onError: () => toast('Rejection failed', 'error') });
  };
  const handleActivateAll = () => {
    const suggested = allPairings.filter((p: any) => (p.status??'').toUpperCase()==='SUGGESTED');
    if (!suggested.length) { toast('No suggested pairings', 'info'); return; }
    Promise.all(suggested.map((p: any) => activateMutation.mutateAsync({ id: p.id })))
      .then(() => toast(`${suggested.length} pairings activated`, 'success'))
      .catch(() => toast('Some activations failed', 'error'));
  };
  const handleExport = async () => {
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({ reportType: 'PEER_PAIRINGS', scope: 'department' }) as any;
      const jobId = String(res?.id??res?.reportId??res?.jobId??'');
      if (jobId) { await downloadReportWhenReady(jobId, 'Department-Pairings-Report.pdf'); toast('Report downloaded', 'success'); }
      else throw new Error();
    } catch { toast('Report generation failed', 'error'); } finally { setGenerating(false); }
  };

  return (
    <HodWorkspaceShell
      title="Peer Pairings Hub"
      eyebrow="Academic peer support — activation, monitoring and progress"
      action={
        <Button className="bg-ks-gold text-ks-navy hover:shadow-md" onClick={handleExport} disabled={generating}>
          <Download className="mr-1.5 h-4 w-4" />{generating?'Generating…':'Export Report'}
        </Button>
      }
    >
      <HodMetricStrip items={[
        { label: 'Suggested', value: String(tabCounts.SUGGESTED).padStart(2,'0'), detail: 'Awaiting HOD activation', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Active', value: String(tabCounts.ACTIVE).padStart(2,'0'), detail: 'In progress now', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Completed', value: String(tabCounts.COMPLETED).padStart(2,'0'), detail: 'This academic term', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Total pairings', value: String(allPairings.length).padStart(2,'0'), detail: `${subjects.length} subject${subjects.length!==1?'s':''}`, inverted: true, icon: Users },
      ]} />

      {isLoading && <SkeletonTable cols={4} />}
      {isError && <DataError onRetry={refetch} />}

      {!isLoading && !isError && (
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-ks-border bg-ks-paper p-1">
              {(['SUGGESTED','ACTIVE','COMPLETED'] as const).map((key) => (
                <button key={key} onClick={() => { setTab(key); setPage(1); }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition ${tab===key?'bg-ks-navy text-white shadow-sm':'text-ks-muted hover:text-ks-navy'}`}>
                  {key.charAt(0)+key.slice(1).toLowerCase()}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${tab===key?'bg-white/20 text-white':'bg-ks-mist text-ks-slate'}`}>{tabCounts[key]}</span>
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ks-muted" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search mentor, support student or subject…"
                  className="h-10 w-full rounded-xl border border-ks-border bg-white pl-10 pr-8 text-sm font-semibold text-ks-navy placeholder:text-ks-muted focus:border-ks-blue focus:outline-none" />
                {search && (
                  <button onClick={() => { setSearch(''); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ks-muted"><X className="h-4 w-4" /></button>
                )}
              </div>
              <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
                className="h-10 rounded-xl border border-ks-border bg-white px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none">
                <option value="ALL">All Subjects</option>
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {filtered.length === 0 && (
              <EmptyState title={`No ${tab.toLowerCase()} pairings`} description={search?`No pairings match "${search}"`:'This category is currently empty.'} />
            )}

            {/* Pairing cards */}
            <div className="space-y-3">
              {paginated.map((pairing: any) => {
                const mInit = pairing.mentor.split(' ').map((p: string)=>p[0]).join('').slice(0,2).toUpperCase();
                const sInit = pairing.support.split(' ').map((p: string)=>p[0]).join('').slice(0,2).toUpperCase();
                const gap   = pairing.mentorScore!=null && pairing.supportScore!=null ? pairing.mentorScore - pairing.supportScore : null;
                const isActive = (pairing.status??'').toUpperCase()==='ACTIVE';
                const isSuggested = (pairing.status??'').toUpperCase()==='SUGGESTED';
                const border = isActive ? 'border-l-ks-emerald' : isSuggested ? 'border-l-ks-blue' : 'border-l-ks-slate/40';
                return (
                  <Card key={pairing.id} className={`overflow-hidden rounded-xl border-l-4 ${border}`}>
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="flex shrink-0 -space-x-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ks-blue text-sm font-black text-white ring-2 ring-white">{mInit}</div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ks-emerald text-sm font-black text-white ring-2 ring-white">{sInit}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">{pairing.subject} · {pairing.className}</p>
                          <h3 className="font-display text-lg font-black text-ks-navy">{pairing.mentor} → {pairing.support}</h3>
                          <p className="mt-1 text-sm font-semibold text-ks-muted line-clamp-2">{pairing.benefit || pairing.reason}</p>
                        </div>
                        <Badge tone={isActive?'emerald':isSuggested?'blue':'slate'}>{pairing.status}</Badge>
                      </div>

                      {(pairing.mentorScore!=null || pairing.supportScore!=null) && (
                        <div className="mt-3 flex flex-wrap gap-6 rounded-xl bg-ks-paper px-4 py-2.5">
                          <div><p className="text-[10px] font-black uppercase text-ks-muted">Mentor</p><p className="font-black text-ks-blue">{pairing.mentorScore!=null?`${pairing.mentorScore}%`:'—'}</p></div>
                          <div><p className="text-[10px] font-black uppercase text-ks-muted">Support</p><p className="font-black text-ks-rose">{pairing.supportScore!=null?`${pairing.supportScore}%`:'—'}</p></div>
                          {gap!=null&&<div><p className="text-[10px] font-black uppercase text-ks-muted">Gap</p><p className="font-black text-ks-amber">{gap>0?`+${gap}%`:`${gap}%`}</p></div>}
                          {pairing.outcome&&<div className="ml-auto"><p className="text-[10px] font-black uppercase text-ks-muted">Outcome</p><p className="text-xs font-semibold text-ks-navy">{pairing.outcome}</p></div>}
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <NavLink to={`/hod/performance/pairings/${pairing.id}`}>
                          <Button variant="secondary" className="rounded-lg py-1.5 text-xs">View Progress</Button>
                        </NavLink>
                        {isSuggested && (
                          <>
                            <Button variant="success" className="rounded-lg py-1.5 text-xs" onClick={() => handleActivate(pairing.id)} disabled={activateMutation.isPending}>Activate</Button>
                            <Button variant="danger" className="rounded-lg py-1.5 text-xs" onClick={() => handleReject(pairing.id)} disabled={rejectMutation.isPending}>Reject</Button>
                          </>
                        )}
                        {isActive && String((pairing as any).studentId||(pairing as any).supportId||'') && (
                          <NavLink to={`/hod/students/${(pairing as any).studentId||(pairing as any).supportId}`}>
                            <Button variant="quiet" className="rounded-lg py-1.5 text-xs">Student Profile</Button>
                          </NavLink>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-ks-muted">Page {page} of {pageCount}</p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => setPage((p)=>Math.max(1,p-1))} disabled={page===1}><ChevronLeft className="h-4 w-4" /></Button>
                  {Array.from({length:Math.min(pageCount,5)},(_,i)=>{
                    const n = pageCount<=5?i+1:page<=3?i+1:page>=pageCount-2?pageCount-4+i:page-2+i;
                    return <Button key={n} variant={page===n?'primary':'secondary'} className="rounded-lg px-3 py-1.5 text-sm" onClick={()=>setPage(n)}>{n}</Button>;
                  })}
                  <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => setPage((p)=>Math.min(pageCount,p+1))} disabled={page===pageCount}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            )}
          </div>

          {/* Right: bulk + subject breakdown */}
          <div>
            <Card className="sticky top-24 h-fit rounded-xl p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Bulk actions</p>
              <div className="mt-4 space-y-2">
                {tabCounts.SUGGESTED > 0 && (
                  <Button className="w-full justify-between rounded-xl" onClick={handleActivateAll} disabled={activateMutation.isPending}>
                    Activate all {tabCounts.SUGGESTED} suggested <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <NavLink to="/hod/exports">
                  <Button variant="secondary" className="w-full justify-between rounded-xl">Export Center <ArrowRight className="h-4 w-4" /></Button>
                </NavLink>
              </div>
              {subjects.length > 0 && (
                <div className="mt-6">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Active by subject</p>
                  <div className="mt-3 space-y-2">
                    {subjects.slice(0,6).map((subj) => {
                      const total  = allPairings.filter((p: any) => p.subject===subj).length;
                      const active = allPairings.filter((p: any) => p.subject===subj && (p.status??'').toUpperCase()==='ACTIVE').length;
                      return (
                        <div key={subj} className="flex items-center justify-between rounded-lg bg-ks-paper px-3 py-2">
                          <span className="truncate text-xs font-semibold text-ks-navy">{subj}</span>
                          <span className="shrink-0 text-[11px] font-black text-ks-muted">{active}/{total}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </HodWorkspaceShell>
  );
}

// ─── Pairing detail ──────────────────────────────────────────────────────────

export function HodPairingDetailPage() {
  const { pairingId } = useParams();
  const navigate = useNavigate();
  const { data: rawPairings = [], isLoading: pairingLoading } = useHodPairings();
  const pairing = (rawPairings as any[]).find((p: any) => p.id === pairingId) ?? null;

  const supportStudentId = String((pairing as any)?.studentId ?? (pairing as any)?.supportId ?? (pairing as any)?.supportStudentId ?? '');
  const mentorStudentId  = String((pairing as any)?.mentorId  ?? (pairing as any)?.mentorStudentId  ?? '');

  const { data: supportProfile } = useHodStudentPerformance(supportStudentId);
  const { data: mentorProfile }  = useHodStudentPerformance(mentorStudentId);
  const { data: supportHistory = [] } = useStudentInterventionHistory(supportStudentId);
  const createMutation   = useCreateHodInterventionMutation();
  const completeMutation = useCompletePairingMutation();
  const generateMutation = useGenerateReportMutation();

  const [sessionNote, setSessionNote] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [generating, setGenerating] = useState(false);

  const calcAvg = (history: any[]) => {
    const scores = history.map((r: any) => Number(r.weightedTotal ?? r.finalScore ?? 0)).filter((s) => s > 0);
    return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  };

  const supportHistory_acc: any[] = (supportProfile as any)?.academicHistory ?? [];
  const mentorHistory_acc: any[]  = (mentorProfile  as any)?.academicHistory ?? [];
  const supportCurrentAvg = calcAvg(supportHistory_acc) || (pairing?.supportScore ?? 0);
  const mentorCurrentAvg  = calcAvg(mentorHistory_acc)  || (pairing?.mentorScore  ?? 0);
  const initialGap   = Math.max(0, (pairing?.mentorScore ?? 0) - (pairing?.supportScore ?? 0));
  const currentGap   = Math.max(0, mentorCurrentAvg - supportCurrentAvg);
  const gapReduction = initialGap > 0 ? Math.round(((initialGap - currentGap) / initialGap) * 100) : 0;

  const sessionLogs = (supportHistory as any[]).filter((i: any) => String(i.note ?? '').startsWith('[PAIRING SESSION]'));

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionNote.trim()) { toast('Please write a session note', 'warning'); return; }
    if (!supportStudentId) { toast('Support student ID unavailable', 'error'); return; }
    createMutation.mutate(
      { studentId: supportStudentId, type: 'OTHER', note: `[PAIRING SESSION] ${sessionNote}`, subjectName: pairing?.subject, followUpDate: sessionDate || undefined },
      { onSuccess: () => { toast('Session note recorded', 'success'); setSessionNote(''); setSessionDate(''); }, onError: () => toast('Failed to save', 'error') },
    );
  };

  const handleComplete = () => {
    if (!pairingId) return;
    completeMutation.mutate(
      { id: pairingId },
      { onSuccess: () => { toast('Pairing completed', 'success'); navigate('/hod/performance/pairings'); }, onError: () => toast('Could not complete pairing', 'error') },
    );
  };

  const handleExport = async () => {
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({ reportType: 'PEER_PAIRINGS', scope: 'pairing', filters: { pairingId } }) as any;
      const jobId = String(res?.id??res?.reportId??res?.jobId??'');
      if (jobId) { await downloadReportWhenReady(jobId, `Pairing-Progress-Report.pdf`); toast('Report downloaded', 'success'); }
      else throw new Error();
    } catch { toast('Report generation failed', 'error'); } finally { setGenerating(false); }
  };

  if (pairingLoading) return <HodWorkspaceShell title="Loading…" eyebrow="Pairing progress"><SkeletonTable cols={4} /></HodWorkspaceShell>;
  if (!pairing) return (
    <HodWorkspaceShell title="Not Found" eyebrow="Pairing progress">
      <EmptyState title="Pairing not found" description="This peer pairing could not be loaded." />
      <div className="mt-4">
        <Button variant="secondary" onClick={() => navigate('/hod/performance/pairings')}>← Back to Pairings</Button>
      </div>
    </HodWorkspaceShell>
  );

  const isActive    = (pairing.status ?? '').toUpperCase() === 'ACTIVE';
  const mentorInit  = pairing.mentor.split(' ').map((p: string) => p[0]).join('').slice(0,2).toUpperCase();
  const supportInit = pairing.support.split(' ').map((p: string) => p[0]).join('').slice(0,2).toUpperCase();
  const suppColor   = supportCurrentAvg >= 50 ? 'bg-ks-emerald' : 'bg-ks-rose';
  const suppText    = supportCurrentAvg >= 50 ? 'text-ks-emerald' : 'text-ks-rose';

  return (
    <HodWorkspaceShell
      title={`${pairing.mentor} → ${pairing.support}`}
      eyebrow={`Peer pairing · ${pairing.subject} · ${pairing.className}`}
      action={
        <Button className="bg-ks-gold text-ks-navy hover:shadow-md" onClick={handleExport} disabled={generating}>
          <Download className="mr-1.5 h-4 w-4" />{generating?'Generating…':'Export Report'}
        </Button>
      }
    >
      <HodMetricStrip items={[
        { label: 'Mentor score', value: mentorCurrentAvg>0?`${mentorCurrentAvg}%`:(pairing.mentorScore!=null?`${pairing.mentorScore}%`:'—'), detail: pairing.mentor, tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Support score', value: supportCurrentAvg>0?`${supportCurrentAvg}%`:(pairing.supportScore!=null?`${pairing.supportScore}%`:'—'), detail: pairing.support, tone: supportCurrentAvg>=50?'bg-ks-emerald':'bg-ks-rose', valueColor: supportCurrentAvg>=50?'text-ks-emerald':'text-ks-rose' },
        { label: 'Current gap', value: currentGap>0?`${currentGap}%`:'Closed', detail: `Started at ${initialGap}%`, tone: currentGap<initialGap?'bg-ks-emerald':'bg-ks-amber', valueColor: currentGap<initialGap?'text-ks-emerald':'text-ks-amber' },
        { label: 'Gap reduced', value: `${Math.max(0,gapReduction)}%`, detail: 'Progress toward parity', inverted: true, icon: TrendingUp },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">

        {/* ── Left: comparison + context + sessions ──── */}
        <div className="space-y-gutter">

          {/* Student comparison cards */}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Student comparison</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-ks-border bg-ks-paper p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ks-blue text-sm font-black text-white">{mentorInit}</div>
                  <div><p className="text-[10px] font-black uppercase text-ks-muted">Mentor</p><p className="font-display text-base font-black text-ks-navy">{pairing.mentor}</p></div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-ks-muted">At pairing</span><span className="font-black text-ks-navy">{pairing.mentorScore!=null?`${pairing.mentorScore}%`:'—'}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-ks-muted">Current avg</span><span className="font-black text-ks-blue">{mentorCurrentAvg>0?`${mentorCurrentAvg}%`:'—'}</span></div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white">
                  <div className="h-2 rounded-full bg-ks-blue" style={{ width:`${Math.max(4,mentorCurrentAvg||pairing.mentorScore||0)}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-ks-border bg-ks-paper p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white ${suppColor}`}>{supportInit}</div>
                  <div><p className="text-[10px] font-black uppercase text-ks-muted">Support</p><p className="font-display text-base font-black text-ks-navy">{pairing.support}</p></div>
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs"><span className="text-ks-muted">At pairing</span><span className="font-black text-ks-navy">{pairing.supportScore!=null?`${pairing.supportScore}%`:'—'}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-ks-muted">Current avg</span><span className={`font-black ${suppText}`}>{supportCurrentAvg>0?`${supportCurrentAvg}%`:'—'}</span></div>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white">
                  <div className={`h-2 rounded-full ${suppColor}`} style={{ width:`${Math.max(4,supportCurrentAvg||pairing.supportScore||0)}%` }} />
                </div>
              </div>
            </div>

            {/* Gap reduction bar */}
            {initialGap > 0 && (
              <div className="mt-4 rounded-xl border border-ks-border bg-ks-mist/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Gap reduction progress</p>
                  <span className={`text-sm font-black ${gapReduction>=50?'text-ks-emerald':'text-ks-amber'}`}>{Math.max(0,gapReduction)}%</span>
                </div>
                <div className="mt-2 h-3 w-full rounded-full bg-ks-border">
                  <div className={`h-3 rounded-full transition-all ${gapReduction>=50?'bg-ks-emerald':gapReduction>0?'bg-ks-amber':'bg-ks-rose'}`} style={{ width:`${Math.max(2,Math.min(100,gapReduction))}%` }} />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-ks-muted">Initial gap: {initialGap}% → Current gap: {currentGap > 0 ? `${currentGap}%` : 'Closed'}</p>
              </div>
            )}
          </Card>

          {/* Pairing context */}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Pairing context</p>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div><p className="font-semibold text-ks-muted">Subject</p><p className="font-black text-ks-navy">{pairing.subject}</p></div>
              <div><p className="font-semibold text-ks-muted">Class</p><p className="font-black text-ks-navy">{pairing.className}</p></div>
              <div><p className="font-semibold text-ks-muted">Status</p>
                <Badge tone={isActive?'emerald':(pairing.status??'').toUpperCase()==='SUGGESTED'?'blue':'slate'}>{pairing.status}</Badge>
              </div>
              {pairing.outcome && <div><p className="font-semibold text-ks-muted">Outcome</p><p className="text-ks-slate">{pairing.outcome}</p></div>}
              {(pairing.reason||pairing.benefit) && <div className="col-span-2"><p className="font-semibold text-ks-muted">Reason for pairing</p><p className="font-semibold text-ks-slate">{pairing.reason||pairing.benefit}</p></div>}
            </div>
            {supportStudentId && (
              <NavLink to={`/hod/students/${supportStudentId}`} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-ks-blue hover:underline">
                View {pairing.support}'s full profile <ArrowRight className="h-3.5 w-3.5" />
              </NavLink>
            )}
          </Card>

          {/* Session log */}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Session log ({sessionLogs.length})</p>
            {sessionLogs.length === 0 && <p className="mt-3 text-sm font-semibold text-ks-muted">No session notes yet. Use the panel on the right to record the first session.</p>}
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {sessionLogs.map((item: any) => (
                <div key={item.id} className="rounded-xl border border-ks-border bg-ks-paper p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-ks-blue">Session Note</span>
                    <span className="text-[10px] font-semibold text-ks-muted">{item.createdAt?new Date(item.createdAt).toLocaleDateString():'—'}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-ks-slate">{String(item.note).replace('[PAIRING SESSION] ','')}</p>
                  {item.followUpDate && <p className="mt-1 text-[10px] font-bold text-ks-amber">Follow-up: {new Date(item.followUpDate).toLocaleDateString()}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ── Right: HOD actions panel ──────────────── */}
        <div className="space-y-gutter">
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Record session note</p>
            <form onSubmit={handleAddNote} className="mt-4 space-y-3">
              <textarea value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} rows={4}
                placeholder={`e.g. Both students attended session. ${pairing.support} showed improvement in problem-solving…`}
                className="w-full resize-none rounded-xl border border-ks-border bg-ks-paper p-3 text-sm font-semibold text-ks-navy placeholder:text-ks-muted/60 focus:border-ks-blue focus:outline-none" />
              <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)}
                className="h-9 w-full rounded-xl border border-ks-border bg-ks-paper px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none" />
              <Button type="submit" className="w-full justify-center rounded-xl" disabled={createMutation.isPending || !supportStudentId}>
                <Send className="mr-2 h-4 w-4" />{createMutation.isPending?'Saving…':'Save Session Note'}
              </Button>
              {!supportStudentId && <p className="text-center text-[10px] text-ks-muted">Student ID not available for this pairing</p>}
            </form>

            <div className="mt-6 space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Pairing actions</p>
              <NavLink to="/hod/performance/pairings">
                <Button variant="secondary" className="w-full justify-between rounded-xl">← Back to all pairings</Button>
              </NavLink>
              {isActive && (
                <Button className="w-full justify-between rounded-xl bg-ks-emerald text-white hover:bg-ks-emerald/90"
                  onClick={handleComplete} disabled={completeMutation.isPending}>
                  <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{completeMutation.isPending?'Completing…':'Mark as Completed'}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <Button className="w-full justify-between rounded-xl bg-ks-navy text-white hover:bg-ks-navy/90"
                onClick={handleExport} disabled={generating}>
                <span className="flex items-center gap-2"><Download className="h-4 w-4" />{generating?'Generating…':'Export Pairing Report'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Student performance (HOD view) ─────────────────────────────────────────

const INTERVENTION_ACTIONS = [
  { type: 'TEACHER_SUPPORT_GIVEN',        label: 'Note to Teacher',       desc: 'Write a note / instruction to the subject teacher' },
  { type: 'ALERT_ESCALATED',              label: 'Escalate to Principal',  desc: 'Flag this student for principal-level attention' },
  { type: 'PARENT_MEETING_SCHEDULED',     label: 'Parent Meeting',         desc: 'Schedule a meeting with the parent / guardian' },
  { type: 'ADDITIONAL_LESSONS_ASSIGNED',  label: 'Extra Lessons',          desc: 'Assign the student to remedial or extra lessons' },
  { type: 'OTHER',                        label: 'Other Action',           desc: 'Record any other HOD-level action taken' },
] as const;

// Grade helpers
function gradeLabel(score: number): string {
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}
function gradeTone(score: number): string {
  if (score >= 65) return 'text-ks-emerald';
  if (score >= 50) return 'text-ks-amber';
  return 'text-ks-rose';
}
function barTone(score: number): string {
  if (score >= 65) return 'bg-ks-emerald';
  if (score >= 50) return 'bg-ks-amber';
  return 'bg-ks-rose';
}

export function HodStudentPerformancePage() {
  const { studentId } = useParams();

  const { data: allAlerts = [], isLoading: alertsLoading } = useHodAlerts();
  const { data: profile, isLoading: profileLoading } = useHodStudentPerformance(studentId ?? '');
  const { data: interventionHistory = [], isLoading: intLoading } = useStudentInterventionHistory(studentId ?? '');
  const { data: deptSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const generateMutation = useGenerateReportMutation();
  const createMutation   = useCreateHodInterventionMutation();
  const escalateMutation = useEscalateAlertMutation();

  const [actionType, setActionType]     = useState<string>('TEACHER_SUPPORT_GIVEN');
  const [actionNote, setActionNote]     = useState('');
  const [actionSubject, setActionSubject] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [rightTab, setRightTab]         = useState<'perf'|'history'|'pairings'>('perf');
  const [generating, setGenerating]     = useState(false);
  const [copiedId, setCopiedId]         = useState(false);

  const studentAlerts = (allAlerts as any[]).filter((a: any) => a.studentId === studentId);
  const criticalAlert = studentAlerts.find((a: any) => a.severity === 'CRITICAL') ?? studentAlerts[0] ?? null;

  const profileData    = (profile as any) ?? {};
  const studentInfo    = profileData.student ?? {};
  const termResults: any[] = profileData.academicHistory ?? [];
  const activePairings: any[] = profileData.activePairings ?? [];
  const overallSummary: any = profileData.overallSummary ?? {};

  const studentName = studentInfo.firstName
    ? `${studentInfo.firstName} ${studentInfo.lastName ?? ''}`.trim()
    : (criticalAlert?.student ?? 'Student');

  // Build per-subject data
  const subjectTrends = new Map<string, { scores: number[]; dates: string[] }>();
  const termLabels: string[] = [];
  const termSet = new Set<string>();
  const sorted = [...termResults].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const r of sorted) {
    const label = r.termName ?? r.termId?.slice(-6) ?? '—';
    if (!termSet.has(label)) { termSet.add(label); termLabels.push(label); }
    const subj = r.subjectName ?? 'Unknown';
    if (!subjectTrends.has(subj)) subjectTrends.set(subj, { scores: [], dates: [] });
    subjectTrends.get(subj)!.scores.push(Math.round(Number(r.weightedTotal ?? r.finalScore ?? 0)));
    subjectTrends.get(subj)!.dates.push(label);
  }

  // Current score per subject (latest)
  const currentBySubject = new Map<string, number>();
  for (const r of sorted) {
    const subj = r.subjectName ?? 'Unknown';
    const score = Number(r.weightedTotal ?? r.finalScore ?? 0);
    if (score > 0) currentBySubject.set(subj, score);
  }
  for (const a of studentAlerts) {
    if (a.currentScore != null && !currentBySubject.has(a.subject))
      currentBySubject.set(a.subject, Math.round(a.currentScore));
  }

  // Dept averages per subject
  const deptAvgBySubject = new Map<string, number>();
  for (const s of deptSubjects as any[]) deptAvgBySubject.set(s.name, s.average ?? 0);

  const allSubjectNames = Array.from(new Set([
    ...Array.from(currentBySubject.keys()),
    ...studentAlerts.map((a: any) => a.subject),
  ])).filter(Boolean);

  const overallAvg = currentBySubject.size > 0
    ? Math.round(Array.from(currentBySubject.values()).reduce((s, v) => s + v, 0) / currentBySubject.size)
    : 0;

  const bestSubject  = Array.from(currentBySubject.entries()).sort((a, b) => b[1] - a[1])[0];
  const worstSubject = Array.from(currentBySubject.entries()).sort((a, b) => a[1] - b[1])[0];
  const trend = overallSummary.trend as string | undefined;
  const isLoading = alertsLoading || profileLoading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionNote.trim()) { toast('Please write a note or description', 'warning'); return; }
    if (actionType === 'ALERT_ESCALATED' && criticalAlert?.id) {
      escalateMutation.mutate(
        { alertId: criticalAlert.id, body: { studentId: studentId!, subjectName: actionSubject || criticalAlert.subject, note: actionNote } },
        {
          onSuccess: () => { toast('Alert escalated to Principal', 'success'); setActionNote(''); setFollowUpDate(''); },
          onError: () => toast('Escalation failed', 'error'),
        },
      );
    } else {
      createMutation.mutate(
        { studentId: studentId!, subjectName: actionSubject || undefined, type: actionType as any, note: actionNote, followUpDate: followUpDate || undefined },
        {
          onSuccess: () => { toast('Action recorded successfully', 'success'); setActionNote(''); setFollowUpDate(''); },
          onError: () => toast('Failed to record action', 'error'),
        },
      );
    }
  };

  const handleExport = async () => {
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({ reportType: 'STUDENT_PERFORMANCE', scope: 'student', filters: { studentId } }) as any;
      const jobId = String(res?.id ?? res?.reportId ?? res?.jobId ?? '');
      if (jobId) { await downloadReportWhenReady(jobId, `${studentName}-performance-report.pdf`); toast('Report downloaded', 'success'); }
      else throw new Error();
    } catch { toast('Report generation failed', 'error'); } finally { setGenerating(false); }
  };

  const copyId = () => {
    if (studentId) { navigator.clipboard.writeText(studentId); setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); }
  };

  if (isLoading) return <HodWorkspaceShell title="Loading…" eyebrow="Student deep profile"><SkeletonTable cols={4} /></HodWorkspaceShell>;

  const riskLevel = criticalAlert?.severity === 'CRITICAL' ? 'rose' : criticalAlert?.severity === 'HIGH' ? 'amber' : overallAvg < 50 ? 'amber' : null;

  return (
    <HodWorkspaceShell
      title={studentName}
      eyebrow="Student deep profile · HOD review"
      action={
        <Button className="bg-ks-gold text-ks-navy hover:shadow-md" onClick={handleExport} disabled={generating}>
          <Download className="mr-1.5 h-4 w-4" />{generating ? 'Generating…' : 'Export Student Report'}
        </Button>
      }
    >
      <HodMetricStrip items={[
        { label: 'Overall avg', value: overallAvg > 0 ? `${overallAvg}%` : '—', detail: `Grade ${gradeLabel(overallAvg)} · ${currentBySubject.size} subjects`, tone: barTone(overallAvg).replace('bg-', 'bg-'), valueColor: gradeTone(overallAvg) },
        { label: 'Active alerts', value: String(studentAlerts.length).padStart(2,'0'), detail: criticalAlert ? `Highest: ${criticalAlert.severity}` : 'None flagged', tone: studentAlerts.length > 0 ? 'bg-ks-rose' : 'bg-ks-emerald', valueColor: studentAlerts.length > 0 ? 'text-ks-rose' : 'text-ks-emerald' },
        { label: 'HOD actions', value: String((interventionHistory as any[]).length).padStart(2,'0'), detail: (interventionHistory as any[]).length > 0 ? 'On record' : 'None yet', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Terms tracked', value: String(termLabels.length).padStart(2,'0'), detail: termLabels[termLabels.length-1] ?? 'No history', inverted: true, icon: ShieldCheck },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[360px_minmax(0,1fr)]">

        {/* ── LEFT: identity + actions ── */}
        <div className="space-y-gutter">

          {/* Identity card */}
          <Card className={`rounded-xl p-5 ${riskLevel === 'rose' ? 'border-2 border-ks-rose bg-ks-rose/5' : riskLevel === 'amber' ? 'border-2 border-ks-amber bg-ks-amber/5' : 'border border-ks-border'}`}>
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-black text-white ${overallAvg >= 65 ? 'bg-ks-emerald' : overallAvg >= 50 ? 'bg-ks-amber' : overallAvg > 0 ? 'bg-ks-rose' : 'bg-ks-navy'}`}>
                {studentName.split(' ').map((p) => p[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${riskLevel === 'rose' ? 'text-ks-rose' : riskLevel === 'amber' ? 'text-ks-amber' : 'text-ks-muted'}`}>
                  {riskLevel === 'rose' ? '⚠ Critical Risk' : riskLevel === 'amber' ? '⚡ At Risk' : overallAvg >= 65 ? '✓ On Track' : 'Under Review'}
                </p>
                <h2 className="mt-0.5 font-display text-2xl font-black text-ks-navy leading-tight">{studentName}</h2>
                {(studentInfo.class || studentInfo.className) && <p className="text-sm font-semibold text-ks-muted">{studentInfo.class ?? studentInfo.className}</p>}
                {(studentInfo.admissionNumber || studentInfo.registrationNumber) && (
                  <p className="text-xs font-semibold text-ks-muted">Reg: {studentInfo.admissionNumber ?? studentInfo.registrationNumber}</p>
                )}
              </div>
            </div>

            {/* Quick stats row */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: 'Overall', value: overallAvg > 0 ? `${overallAvg}%` : '—', sub: gradeLabel(overallAvg) },
                { label: 'Best', value: bestSubject ? `${bestSubject[1]}%` : '—', sub: bestSubject?.[0]?.split(' ')[0] ?? '—' },
                { label: 'Weakest', value: worstSubject ? `${worstSubject[1]}%` : '—', sub: worstSubject?.[0]?.split(' ')[0] ?? '—' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-ks-paper p-2.5 text-center">
                  <p className="text-[10px] font-black uppercase text-ks-muted">{s.label}</p>
                  <p className="font-display text-lg font-black text-ks-navy">{s.value}</p>
                  <p className="text-[10px] font-semibold text-ks-muted truncate">{s.sub}</p>
                </div>
              ))}
            </div>

            {trend && (
              <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 ${trend === 'IMPROVING' ? 'bg-ks-emerald/10' : trend === 'DECLINING' ? 'bg-ks-rose/10' : 'bg-ks-amber/10'}`}>
                {trend === 'IMPROVING' ? <TrendingUp className="h-4 w-4 text-ks-emerald" /> : <TrendingDown className="h-4 w-4 text-ks-rose" />}
                <span className={`text-xs font-black ${trend === 'IMPROVING' ? 'text-ks-emerald' : trend === 'DECLINING' ? 'text-ks-rose' : 'text-ks-amber'}`}>{trend} trend</span>
              </div>
            )}

            {criticalAlert && (
              <div className="mt-3 rounded-lg bg-ks-rose/10 p-3">
                <p className="text-xs font-bold text-ks-rose">⚠ {criticalAlert.subject}: {criticalAlert.reason}</p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button onClick={copyId} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-ks-border bg-ks-paper px-3 py-1.5 text-xs font-black text-ks-muted hover:text-ks-navy">
                <Copy className="h-3.5 w-3.5" />{copiedId ? 'Copied!' : 'Copy Student ID'}
              </button>
              <NavLink to="/hod/performance" className="flex items-center gap-1.5 rounded-lg border border-ks-border bg-ks-paper px-3 py-1.5 text-xs font-black text-ks-muted hover:text-ks-navy">
                ← All Students
              </NavLink>
            </div>
          </Card>

          {/* HOD Action Panel */}
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ks-navy text-white"><CheckCircle2 className="h-4 w-4" /></div>
              <h3 className="font-display text-lg font-black text-ks-navy">Record HOD Action</h3>
            </div>
            <p className="mt-1 text-xs font-semibold text-ks-muted">All actions are saved to this student's permanent record.</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-1.5">
                {INTERVENTION_ACTIONS.map((action) => (
                  <button key={action.type} type="button" onClick={() => setActionType(action.type)}
                    className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-left transition ${actionType === action.type ? 'border-ks-blue bg-ks-blue/5 ring-1 ring-ks-blue/30' : 'border-ks-border hover:border-ks-blue/40 hover:bg-ks-mist/30'}`}>
                    <span className={`mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${actionType === action.type ? 'border-ks-blue bg-ks-blue' : 'border-ks-muted'}`} />
                    <div>
                      <p className={`text-xs font-black ${actionType === action.type ? 'text-ks-blue' : 'text-ks-navy'}`}>{action.label}</p>
                      <p className="text-[10px] font-semibold text-ks-muted">{action.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <select value={actionSubject} onChange={(e) => setActionSubject(e.target.value)}
                className="h-10 w-full rounded-xl border border-ks-border px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none">
                <option value="">All subjects / General</option>
                {allSubjectNames.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>

              <textarea required value={actionNote} onChange={(e) => setActionNote(e.target.value)} rows={4}
                className="w-full resize-none rounded-xl border border-ks-border p-3 text-sm font-semibold text-ks-navy placeholder:text-ks-muted/60 focus:border-ks-blue focus:outline-none"
                placeholder={actionType === 'TEACHER_SUPPORT_GIVEN' ? 'Note to teacher…' : actionType === 'ALERT_ESCALATED' ? 'Escalation reason…' : actionType === 'PARENT_MEETING_SCHEDULED' ? 'Meeting details and date…' : actionType === 'ADDITIONAL_LESSONS_ASSIGNED' ? 'Lesson schedule and subject details…' : 'Action details…'} />

              {actionType !== 'ALERT_ESCALATED' && (
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Follow-up date</label>
                  <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-ks-border px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none" />
                </div>
              )}

              <Button type="submit"
                className={`w-full rounded-xl ${actionType === 'ALERT_ESCALATED' ? 'bg-ks-rose text-white hover:bg-ks-rose/90' : ''}`}
                disabled={createMutation.isPending || escalateMutation.isPending}>
                <Send className="mr-2 h-4 w-4" />
                {createMutation.isPending || escalateMutation.isPending ? 'Saving…'
                  : actionType === 'ALERT_ESCALATED' ? 'Escalate to Principal'
                  : actionType === 'TEACHER_SUPPORT_GIVEN' ? 'Send Note to Teacher'
                  : actionType === 'PARENT_MEETING_SCHEDULED' ? 'Schedule Parent Meeting'
                  : actionType === 'ADDITIONAL_LESSONS_ASSIGNED' ? 'Assign Extra Lessons'
                  : 'Record Action'}
              </Button>
            </form>
          </Card>

          {/* Action history */}
          <Card className="rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Action history ({(interventionHistory as any[]).length})</p>
            </div>
            {intLoading && <div className="mt-3"><SkeletonTable cols={2} /></div>}
            {!intLoading && (interventionHistory as any[]).length === 0 && (
              <p className="mt-3 text-sm font-semibold text-ks-muted">No HOD actions recorded yet. Use the panel above to start.</p>
            )}
            {!intLoading && (interventionHistory as any[]).length > 0 && (
              <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
                {[...(interventionHistory as any[])].reverse().map((item: any) => {
                  const label = INTERVENTION_ACTIONS.find((a) => a.type === item.type)?.label ?? item.type?.replace(/_/g, ' ') ?? 'Action';
                  const date  = item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' }) : '—';
                  const isEsc = item.type === 'ALERT_ESCALATED';
                  const borderC = isEsc ? 'border-ks-rose/30 bg-ks-rose/5' : 'border-ks-border bg-ks-paper/50';
                  const today = new Date();
                  const overdue = item.followUpDate && new Date(item.followUpDate) < today && item.status !== 'COMPLETED';
                  return (
                    <div key={item.id} className={`rounded-xl border p-3 ${borderC}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isEsc ? 'text-ks-rose' : 'text-ks-blue'}`}>{label}</span>
                        <span className="text-[10px] font-semibold text-ks-muted">{date}</span>
                      </div>
                      {item.subjectName && <p className="mt-0.5 text-[10px] font-semibold text-ks-muted">{item.subjectName}</p>}
                      <p className="mt-1 text-xs font-semibold text-ks-slate line-clamp-3">{item.note}</p>
                      {item.followUpDate && (
                        <p className={`mt-1 text-[10px] font-bold ${overdue ? 'text-ks-rose' : 'text-ks-amber'}`}>
                          {overdue ? '⚠ Overdue: ' : 'Follow-up: '}{new Date(item.followUpDate).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── RIGHT: analytics tabs ── */}
        <div className="space-y-gutter">

          {/* Tab bar */}
          <div className="flex gap-1 rounded-xl border border-ks-border bg-ks-paper p-1">
            {([['perf','Subject Performance'],['history','Term History'],['pairings',`Pairings${activePairings.length>0?' ('+activePairings.length+')':''}`]] as const).map(([key,label]) => (
              <button key={key} onClick={() => setRightTab(key)}
                className={`flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-black transition ${rightTab===key?'bg-ks-navy text-white shadow-sm':'text-ks-muted hover:text-ks-navy'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* TAB: Subject Performance */}
          {rightTab === 'perf' && (
            <div className="space-y-gutter">
              {currentBySubject.size === 0 && (
                <EmptyState title="No subject scores yet" description="Scores appear once assessments are entered, submitted and approved." />
              )}

              {/* Active alerts for this student */}
              {studentAlerts.length > 0 && (
                <Card className="rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-ks-rose" />
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Active alerts ({studentAlerts.length})</p>
                  </div>
                  <div className="space-y-2">
                    {studentAlerts.map((a: any) => {
                      const high = a.severity === 'CRITICAL' || a.severity === 'HIGH';
                      const med  = a.severity === 'MEDIUM';
                      const bdr  = high ? 'border-ks-rose/30 bg-ks-rose/5' : med ? 'border-ks-amber/30 bg-ks-amber/5' : 'border-ks-emerald/30 bg-ks-emerald/5';
                      const tc   = high ? 'text-ks-rose' : med ? 'text-ks-amber' : 'text-ks-emerald';
                      return (
                        <div key={a.id ?? a.subject} className={`rounded-xl border p-3 ${bdr}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-ks-navy">{a.subject}</span>
                            <span className={`text-[10px] font-black ${tc}`}>{a.severity}{a.currentScore != null ? ` · ${Math.round(a.currentScore)}%` : ''}</span>
                          </div>
                          <p className="mt-0.5 text-xs font-semibold text-ks-muted">{a.reason}</p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* Subject breakdown with class avg comparison */}
              {currentBySubject.size > 0 && (
                <Card className="rounded-xl p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Subject scores vs class average</p>
                  <div className="mt-4 space-y-4">
                    {Array.from(currentBySubject.entries())
                      .sort((a, b) => b[1] - a[1])
                      .map(([subj, score]) => {
                        const deptAvg  = deptAvgBySubject.get(subj) ?? 0;
                        const alert    = studentAlerts.find((a: any) => a.subject === subj);
                        const trend    = subjectTrends.get(subj);
                        const prevScore = (trend?.scores.length ?? 0) >= 2 ? trend!.scores[trend!.scores.length - 2] : null;
                        const change   = prevScore != null ? score - prevScore : null;
                        const grade    = gradeLabel(score);
                        const toneT    = gradeTone(score);
                        const toneB    = barTone(score);
                        return (
                          <div key={subj}>
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-ks-navy truncate">{subj}</p>
                                  {alert && <span className="shrink-0 rounded border border-ks-rose/30 bg-ks-rose/10 px-1.5 py-0.5 text-[9px] font-black text-ks-rose">ALERT</span>}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3">
                                {change != null && (
                                  <span className={`flex items-center gap-0.5 text-xs font-black ${change >= 0 ? 'text-ks-emerald' : 'text-ks-rose'}`}>
                                    {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(change)}%
                                  </span>
                                )}
                                <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white ${toneB}`}>{grade}</div>
                                <span className={`font-display text-xl font-black ${toneT}`}>{score}%</span>
                              </div>
                            </div>
                            {/* Dual bar: student vs class */}
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="w-14 shrink-0 text-right text-[9px] font-semibold text-ks-muted">Student</span>
                                <div className="flex-1 h-2 rounded-full bg-ks-paper">
                                  <div className={`h-2 rounded-full ${toneB}`} style={{ width: `${Math.max(2,score)}%` }} />
                                </div>
                              </div>
                              {deptAvg > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="w-14 shrink-0 text-right text-[9px] font-semibold text-ks-muted">Class avg</span>
                                  <div className="flex-1 h-2 rounded-full bg-ks-paper">
                                    <div className="h-2 rounded-full bg-ks-slate/40" style={{ width: `${Math.max(2,deptAvg)}%` }} />
                                  </div>
                                  <span className="text-[9px] font-semibold text-ks-muted">{deptAvg}%</span>
                                </div>
                              )}
                            </div>
                            {alert && <p className="mt-1 text-[10px] font-semibold text-ks-rose">{alert.reason}</p>}
                          </div>
                        );
                      })}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TAB: Term History */}
          {rightTab === 'history' && (
            <div className="space-y-gutter">
              {termResults.length === 0 ? (
                <EmptyState title="No term results yet" description="Term results appear once assessments are approved and results are published." />
              ) : (
                <>
                  {/* Mini trend charts per subject */}
                  {subjectTrends.size > 0 && (
                    <Card className="rounded-xl p-5">
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Performance trend by subject</p>
                      <div className="mt-4 space-y-5">
                        {Array.from(subjectTrends.entries()).map(([subj, { scores, dates }]) => {
                          const latest  = scores[scores.length - 1] ?? 0;
                          const first   = scores[0] ?? 0;
                          const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                          const maxScore = Math.max(...scores, 1);
                          const toneB   = barTone(latest);
                          const toneT   = gradeTone(latest);
                          return (
                            <div key={subj}>
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-black text-ks-navy">{subj}</p>
                                <div className="flex items-center gap-3">
                                  {scores.length >= 2 && (
                                    <span className={`text-xs font-black ${latest >= first ? 'text-ks-emerald' : 'text-ks-rose'}`}>
                                      {latest >= first ? '↑' : '↓'}{Math.abs(latest - first)}% since start
                                    </span>
                                  )}
                                  <span className={`font-black ${toneT}`}>{latest}%</span>
                                </div>
                              </div>
                              {/* SVG bar chart */}
                              <div className="flex items-end gap-1" style={{ height: 56 }}>
                                {scores.map((s, i) => {
                                  const h = Math.max(4, Math.round((s / maxScore) * 52));
                                  const isLast = i === scores.length - 1;
                                  return (
                                    <div key={i} className="group relative flex flex-1 flex-col items-center justify-end">
                                      <div className={`w-full rounded-t transition-all ${toneB} ${isLast ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`} style={{ height: h }} />
                                      <div className="absolute -top-5 hidden rounded bg-ks-navy px-1.5 py-0.5 text-[9px] font-black text-white group-hover:block">{s}%</div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-1 flex gap-1">
                                {dates.map((l, i) => (
                                  <span key={i} className="flex-1 text-center text-[8px] font-semibold text-ks-muted truncate">{l}</span>
                                ))}
                              </div>
                              <div className="mt-1 flex justify-between text-[10px] text-ks-muted">
                                <span>Avg: {overall}%</span>
                                <span>Grade: {gradeLabel(latest)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Results table */}
                  <Card className="rounded-xl p-5">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Full assessment record</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-ks-border">
                            {['Term','Subject','Score','Grade','Type'].map((h) => (
                              <th key={h} className="pb-2 text-left text-[10px] font-black uppercase tracking-widest text-ks-muted">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...termResults].reverse().map((r: any, i: number) => {
                            const score = Math.round(Number(r.weightedTotal ?? r.finalScore ?? 0));
                            const toneT = gradeTone(score);
                            return (
                              <tr key={i} className="border-b border-ks-border/50 last:border-0 hover:bg-ks-paper/50">
                                <td className="py-2.5 text-xs font-semibold text-ks-muted">{r.termName ?? '—'}</td>
                                <td className="py-2.5 font-semibold text-ks-navy">{r.subjectName ?? '—'}</td>
                                <td className={`py-2.5 font-black ${toneT}`}>{score > 0 ? `${score}%` : '—'}</td>
                                <td className={`py-2.5 font-black ${toneT}`}>{score > 0 ? gradeLabel(score) : '—'}</td>
                                <td className="py-2.5 text-xs text-ks-muted">{r.assessmentType ?? r.type ?? 'Result'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
            </div>
          )}

          {/* TAB: Pairings */}
          {rightTab === 'pairings' && (
            <div className="space-y-gutter">
              {activePairings.length === 0 ? (
                <EmptyState title="No active pairings" description="Peer pairings for this student will appear here once activated." />
              ) : (
                activePairings.map((p: any) => {
                  const peerInit = String(p.peerName ?? p.peer ?? '').split(' ').map((x: string) => x[0]).join('').slice(0,2).toUpperCase() || 'P';
                  return (
                    <Card key={p.id ?? p.peerName} className="overflow-hidden rounded-xl border-l-4 border-l-ks-blue p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ks-blue text-sm font-black text-white">{peerInit}</div>
                        <div className="flex-1">
                          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Peer Mentor{p.subjectName ? ` · ${p.subjectName}` : ''}</p>
                          <p className="font-display text-lg font-black text-ks-navy">{p.peerName ?? p.peer ?? 'Mentor'}</p>
                        </div>
                        <Badge tone="blue">Active</Badge>
                      </div>
                      {(p.reason ?? p.benefit) && (
                        <p className="mt-3 rounded-xl border border-ks-border bg-ks-paper p-3 text-sm font-semibold italic text-ks-navy">{p.reason ?? p.benefit}</p>
                      )}
                      {(p.mentorScore != null || p.peerScore != null) && (
                        <div className="mt-3 flex gap-6 text-xs">
                          {(p.peerScore ?? p.mentorScore) != null && <div><p className="text-ks-muted">Mentor score</p><p className="font-black text-ks-blue">{p.peerScore ?? p.mentorScore}%</p></div>}
                          {p.studentScoreAtPairing != null && <div><p className="text-ks-muted">Your score at start</p><p className="font-black text-ks-rose">{p.studentScoreAtPairing}%</p></div>}
                        </div>
                      )}
                      {p.pairingId && (
                        <NavLink to={`/hod/performance/pairings/${p.pairingId}`} className="mt-3 inline-flex items-center gap-2 text-xs font-black text-ks-blue hover:underline">
                          View pairing detail <ArrowRight className="h-3 w-3" />
                        </NavLink>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Interventions ──────────────────────────────────────────────────────────

const INT_PAGE_SIZE = 10;

type IntTab = 'open' | 'followup' | 'completed' | 'all';

export function HodInterventionsPage() {
  const { data: raw = [] as typeof hodInterventions, isLoading, isError, refetch } = useHodInterventions() as unknown as { data: typeof hodInterventions; isLoading: boolean; isError: boolean; refetch: () => void };
  const { data: deptSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const createMutation    = useCreateHodInterventionMutation();
  const updateMutation    = useUpdateInterventionMutation();
  const generateMutation  = useGenerateReportMutation();

  const [activeTab, setActiveTab]   = useState<IntTab>('open');
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [newForm, setNewForm] = useState({
    studentId: '', type: 'TEACHER_SUPPORT_GIVEN', subjectName: '', note: '', followUpDate: '',
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Derived data
  const open      = raw.filter((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS');
  const followup  = raw.filter((i) => i.status === 'FOLLOW_UP_REQUIRED');
  const completed = raw.filter((i) => i.status === 'COMPLETED');
  const overdue   = raw.filter((i) => {
    if (i.status === 'COMPLETED') return false;
    const fd = (i as any).followUpDate;
    return fd && new Date(fd) < today;
  });

  const tabSource: Record<IntTab, typeof raw> = { open, followup, completed, all: raw };

  // Filter
  const filtered = tabSource[activeTab].filter((i) => {
    const q = search.toLowerCase();
    const matchQ = !q || String((i as any).studentName ?? (i as any).student ?? '').toLowerCase().includes(q)
      || String(i.subject ?? (i as any).subjectName ?? '').toLowerCase().includes(q)
      || String(i.note ?? '').toLowerCase().includes(q);
    const matchType = !typeFilter || i.type === typeFilter;
    return matchQ && matchType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / INT_PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * INT_PAGE_SIZE, page * INT_PAGE_SIZE);

  const resetPage = () => setPage(1);

  // Type breakdown for sidebar
  const typeCounts = INTERVENTION_ACTIONS.map((a) => ({
    ...a,
    count: raw.filter((i) => i.type === a.type).length,
  })).filter((a) => a.count > 0).sort((a, b) => b.count - a.count);
  const maxTypeCount = typeCounts[0]?.count ?? 1;

  // Subject breakdown
  const subjectCounts = new Map<string, number>();
  for (const i of raw) {
    const s = i.subject ?? (i as any).subjectName ?? 'General';
    subjectCounts.set(s, (subjectCounts.get(s) ?? 0) + 1);
  }
  const subjectEntries = Array.from(subjectCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.studentId.trim()) { toast('Student ID is required', 'warning'); return; }
    if (!newForm.note.trim()) { toast('Please add a note', 'warning'); return; }
    setCreating(true);
    try {
      await createMutation.mutateAsync({
        studentId: newForm.studentId.trim(),
        subjectName: newForm.subjectName || undefined,
        type: newForm.type as any,
        note: newForm.note,
        followUpDate: newForm.followUpDate || undefined,
      });
      toast('Intervention recorded successfully', 'success');
      setNewForm({ studentId: '', type: 'TEACHER_SUPPORT_GIVEN', subjectName: '', note: '', followUpDate: '' });
      setShowCreate(false);
    } catch { toast('Failed to record intervention', 'error'); } finally { setCreating(false); }
  };

  const handleMarkComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await updateMutation.mutateAsync({ id, body: { status: 'COMPLETED' } });
      toast('Intervention marked as complete', 'success');
    } catch { toast('Failed to update status', 'error'); } finally { setCompletingId(null); }
  };

  const handleExport = async () => {
    setGenerating(true);
    try {
      const res = await generateMutation.mutateAsync({ reportType: 'INTERVENTION_SUMMARY', scope: 'department' }) as any;
      const jobId = String(res?.id ?? res?.reportId ?? res?.jobId ?? '');
      if (jobId) { await downloadReportWhenReady(jobId, 'department-interventions-report.pdf'); toast('Report downloaded', 'success'); }
      else throw new Error();
    } catch { toast('Report generation failed', 'error'); } finally { setGenerating(false); }
  };

  const tabs: [IntTab, string, number][] = [
    ['open', 'Open', open.length],
    ['followup', 'Follow-up Needed', followup.length],
    ['completed', 'Completed', completed.length],
    ['all', 'All', raw.length],
  ];

  return (
    <HodWorkspaceShell
      title="Department Interventions"
      eyebrow="Track, manage and act on student support"
      action={
        <div className="flex gap-2">
          <Button onClick={() => setShowCreate((v) => !v)} className={showCreate ? 'bg-ks-rose text-white hover:bg-ks-rose/90' : ''}>
            {showCreate ? <><X className="mr-1.5 h-4 w-4" /> Cancel</> : <><MessageSquarePlus className="mr-1.5 h-4 w-4" /> New Intervention</>}
          </Button>
          <Button className="bg-ks-gold text-ks-navy hover:shadow-md" onClick={handleExport} disabled={generating}>
            <Download className="mr-1.5 h-4 w-4" />{generating ? 'Generating…' : 'Export Report'}
          </Button>
        </div>
      }
    >
      {/* Metric strip */}
      <HodMetricStrip items={[
        { label: 'Open', value: String(open.length).padStart(2,'0'), detail: 'Needs action', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Follow-up due', value: String(followup.length).padStart(2,'0'), detail: 'Pending follow-up', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Completed', value: String(completed.length).padStart(2,'0'), detail: 'This term', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Overdue', value: String(overdue.length).padStart(2,'0'), detail: 'Past follow-up date', inverted: true, icon: AlertTriangle },
      ]} />

      {/* Overdue banner */}
      {overdue.length > 0 && (
        <div className="rounded-xl border border-ks-rose/30 bg-ks-rose/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-ks-rose" />
            <p className="font-black text-ks-rose">{overdue.length} intervention{overdue.length !== 1 ? 's are' : ' is'} overdue</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {overdue.slice(0, 5).map((i) => {
              const name = (i as any).studentName ?? (i as any).student ?? (i as any).studentId ?? 'Unknown';
              const subj = i.subject ?? (i as any).subjectName ?? '';
              const fd   = (i as any).followUpDate;
              return (
                <NavLink key={i.id} to={`/hod/students/${(i as any).studentId ?? i.id}`}
                  className="flex items-center gap-2 rounded-lg border border-ks-rose/30 bg-white px-3 py-1.5 text-xs font-semibold text-ks-navy hover:bg-ks-rose/10">
                  <span className="font-black">{name}</span>
                  {subj && <span className="text-ks-muted">· {subj}</span>}
                  <span className="font-bold text-ks-rose">Due {fd ? new Date(fd).toLocaleDateString('en-GB',{day:'numeric',month:'short'}) : 'unknown'}</span>
                </NavLink>
              );
            })}
            {overdue.length > 5 && <span className="flex items-center rounded-lg bg-ks-rose/10 px-3 py-1.5 text-xs font-black text-ks-rose">+{overdue.length-5} more</span>}
          </div>
        </div>
      )}

      {/* Create intervention form */}
      {showCreate && (
        <Card className="rounded-xl border-2 border-ks-blue/30 bg-ks-blue/5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ks-blue text-white"><MessageSquarePlus className="h-5 w-5" /></div>
            <div>
              <h3 className="font-display text-lg font-black text-ks-navy">Create New Intervention</h3>
              <p className="text-xs font-semibold text-ks-muted">This will be added to the student's permanent HOD record.</p>
            </div>
          </div>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Student ID *</label>
                <input required value={newForm.studentId} onChange={(e) => setNewForm((p) => ({...p, studentId: e.target.value}))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-ks-border px-3 text-sm font-semibold focus:border-ks-blue focus:outline-none"
                  placeholder="Paste or type student ID…" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Intervention type *</label>
                <select value={newForm.type} onChange={(e) => setNewForm((p) => ({...p, type: e.target.value}))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-ks-border px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none">
                  {INTERVENTION_ACTIONS.map((a) => <option key={a.type} value={a.type}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Subject</label>
                <select value={newForm.subjectName} onChange={(e) => setNewForm((p) => ({...p, subjectName: e.target.value}))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-ks-border px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none">
                  <option value="">General / All subjects</option>
                  {(deptSubjects as any[]).map((s) => <option key={s.id ?? s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Note / Details *</label>
                <textarea required value={newForm.note} onChange={(e) => setNewForm((p) => ({...p, note: e.target.value}))} rows={3}
                  className="mt-1.5 w-full resize-none rounded-xl border border-ks-border p-3 text-sm font-semibold focus:border-ks-blue focus:outline-none"
                  placeholder="Describe the intervention, reason, and any observations…" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Follow-up date</label>
                <input type="date" value={newForm.followUpDate} onChange={(e) => setNewForm((p) => ({...p, followUpDate: e.target.value}))}
                  className="mt-1.5 h-10 w-full rounded-xl border border-ks-border px-3 text-sm font-semibold focus:border-ks-blue focus:outline-none" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Button type="submit" className="rounded-xl" disabled={creating}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" />{creating ? 'Saving…' : 'Record Intervention'}
              </Button>
              <button type="button" onClick={() => setShowCreate(false)} className="text-sm font-bold text-ks-muted hover:text-ks-navy">Cancel</button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* ── Main list ── */}
        <div className="space-y-gutter">
          {/* Tabs */}
          <div className="flex gap-1 rounded-xl border border-ks-border bg-ks-paper p-1">
            {tabs.map(([key, label, count]) => (
              <button key={key} onClick={() => { setActiveTab(key); resetPage(); }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-black transition ${activeTab===key?'bg-ks-navy text-white shadow-sm':'text-ks-muted hover:text-ks-navy'}`}>
                {label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab===key?'bg-white/20':'bg-ks-border'}`}>{count}</span>
              </button>
            ))}
          </div>

          {/* Search + type filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ks-muted" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                placeholder="Search student, subject or note…"
                className="h-10 w-full rounded-xl border border-ks-border pl-9 pr-3 text-sm font-semibold focus:border-ks-blue focus:outline-none" />
              {search && <button onClick={() => { setSearch(''); resetPage(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-ks-muted hover:text-ks-navy"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); resetPage(); }}
              className="h-10 rounded-xl border border-ks-border px-3 text-sm font-semibold text-ks-navy focus:border-ks-blue focus:outline-none">
              <option value="">All types</option>
              {INTERVENTION_ACTIONS.map((a) => <option key={a.type} value={a.type}>{a.label}</option>)}
            </select>
          </div>

          {/* Results */}
          {isLoading && <SkeletonTable cols={4} />}
          {isError && <DataError onRetry={refetch} />}
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState title="No interventions found" description={search || typeFilter ? 'Try adjusting your search or filter.' : activeTab === 'completed' ? 'No completed interventions yet.' : activeTab === 'followup' ? 'No follow-up items pending.' : 'No open interventions at this time.'} />
          )}
          {!isLoading && !isError && paginated.length > 0 && (
            <div className="space-y-3">
              {paginated.map((item) => {
                const actionDef = INTERVENTION_ACTIONS.find((a) => a.type === item.type);
                const name      = (item as any).studentName ?? (item as any).student ?? 'Unknown student';
                const subject   = item.subject ?? (item as any).subjectName ?? '';
                const fd        = (item as any).followUpDate;
                const fdDate    = fd ? new Date(fd) : null;
                const isOverdue = fdDate && fdDate < today && item.status !== 'COMPLETED';
                const isDone    = item.status === 'COMPLETED';
                const isBusy    = completingId === item.id;
                const borderC   = isDone ? 'border-ks-emerald/30' : isOverdue ? 'border-l-4 border-l-ks-rose' : item.status === 'FOLLOW_UP_REQUIRED' ? 'border-l-4 border-l-ks-amber' : 'border-ks-border';
                return (
                  <Card key={item.id} className={`rounded-xl p-4 ${borderC}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white ${isDone ? 'bg-ks-emerald' : isOverdue ? 'bg-ks-rose' : 'bg-ks-navy'}`}>
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <NavLink to={`/hod/students/${(item as any).studentId ?? item.id}`}
                            className="font-black text-ks-navy hover:text-ks-blue hover:underline">
                            {name}
                          </NavLink>
                          {subject && <Badge tone="blue">{subject}</Badge>}
                          {actionDef && (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${isDone ? 'border-ks-emerald/30 text-ks-emerald' : 'border-ks-blue/30 text-ks-blue'}`}>
                              {actionDef.label}
                            </span>
                          )}
                          {isOverdue && <span className="rounded-full bg-ks-rose/10 px-2 py-0.5 text-[10px] font-black text-ks-rose">OVERDUE</span>}
                          {isDone && <span className="rounded-full bg-ks-emerald/10 px-2 py-0.5 text-[10px] font-black text-ks-emerald">COMPLETED</span>}
                        </div>
                        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-ks-slate line-clamp-3">{item.note ?? (item as any).details ?? '—'}</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-semibold text-ks-muted">
                          {(item as any).createdAt && (
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />
                              {new Date((item as any).createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'2-digit'})}
                            </span>
                          )}
                          {fdDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'font-black text-ks-rose' : 'text-ks-amber'}`}>
                              <Calendar className="h-3 w-3" />
                              Follow-up: {fdDate.toLocaleDateString('en-GB',{day:'numeric',month:'short'})}
                              {isOverdue ? ' (overdue)' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      {!isDone && (
                        <button onClick={() => handleMarkComplete(item.id)}
                          disabled={isBusy}
                          className="shrink-0 flex items-center gap-1.5 rounded-xl border border-ks-emerald/40 bg-ks-emerald/5 px-3 py-1.5 text-xs font-black text-ks-emerald transition hover:bg-ks-emerald hover:text-white disabled:opacity-50">
                          <CheckCircle2 className="h-3.5 w-3.5" />{isBusy ? '…' : 'Complete'}
                        </button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs font-semibold text-ks-muted">
                Showing {(page-1)*INT_PAGE_SIZE+1}–{Math.min(page*INT_PAGE_SIZE,filtered.length)} of {filtered.length}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1,p-1))} disabled={page===1}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ks-border text-ks-muted hover:bg-ks-paper disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({length:totalPages},(_,i)=>i+1).filter((n)=>n===1||n===totalPages||Math.abs(n-page)<=1).map((n,i,arr)=>(
                  <React.Fragment key={n}>
                    {i>0&&arr[i-1]!==n-1&&<span className="flex h-8 items-center px-1 text-ks-muted text-xs">…</span>}
                    <button onClick={()=>setPage(n)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-black ${page===n?'border-ks-navy bg-ks-navy text-white':'border-ks-border text-ks-muted hover:bg-ks-paper'}`}>
                      {n}
                    </button>
                  </React.Fragment>
                ))}
                <button onClick={() => setPage((p) => Math.min(totalPages,p+1))} disabled={page===totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-ks-border text-ks-muted hover:bg-ks-paper disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-gutter">
          {/* Intervention type breakdown */}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Breakdown by type</p>
            {typeCounts.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-ks-muted">No interventions recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {typeCounts.map((a) => (
                  <div key={a.type}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-ks-navy truncate pr-2">{a.label}</span>
                      <span className="font-black text-ks-navy shrink-0">{a.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-ks-paper">
                      <div className="h-1.5 rounded-full bg-ks-blue" style={{width:`${(a.count/maxTypeCount)*100}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Subject breakdown */}
          {subjectEntries.length > 0 && (
            <Card className="rounded-xl p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Most-affected subjects</p>
              <div className="mt-4 space-y-3">
                {subjectEntries.map(([subj, count]) => {
                  const pct = (count / raw.length) * 100;
                  return (
                    <div key={subj}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ks-navy truncate pr-2">{subj}</span>
                        <span className="font-black text-ks-navy shrink-0">{count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-ks-paper">
                        <div className="h-1.5 rounded-full bg-ks-amber" style={{width:`${pct}%`}} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Status breakdown */}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Status overview</p>
            <div className="mt-4 space-y-2">
              {[
                { label: 'Open / In Progress', count: open.length, tone: 'bg-ks-amber', tc: 'text-ks-amber' },
                { label: 'Follow-up Required', count: followup.length, tone: 'bg-ks-rose', tc: 'text-ks-rose' },
                { label: 'Overdue', count: overdue.length, tone: 'bg-ks-rose', tc: 'text-ks-rose' },
                { label: 'Completed', count: completed.length, tone: 'bg-ks-emerald', tc: 'text-ks-emerald' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.tone}`} />
                  <span className="flex-1 text-xs font-semibold text-ks-slate">{s.label}</span>
                  <span className={`text-sm font-black ${s.tc}`}>{s.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick tips */}
          <Card className="rounded-xl bg-ks-navy/3 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">HOD Quick Actions</p>
            <div className="mt-3 space-y-2">
              {[
                { label: 'View at-risk students', path: '/hod/performance' },
                { label: 'Manage peer pairings', path: '/hod/performance/pairings' },
                { label: 'Department announcements', path: '/hod/announcements' },
              ].map((link) => (
                <NavLink key={link.path} to={link.path}
                  className="flex items-center gap-2 rounded-xl border border-ks-border bg-white px-3 py-2 text-xs font-black text-ks-navy hover:border-ks-blue hover:text-ks-blue">
                  {link.label} <ArrowRight className="ml-auto h-3.5 w-3.5" />
                </NavLink>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Announcements ──────────────────────────────────────────────────────────

export function HodAnnouncementsPage() {
  const { data: apiAnnouncements = [], isLoading, isError, refetch } = useHodAnnouncements() as { data: Array<{ id: string; body?: string; title?: string; audience?: string; targetRoles?: string[] }>; isLoading: boolean; isError: boolean; refetch: () => void };
  const items = apiAnnouncements.map((a) => ({ id: a.id, body: a.body ?? a.title ?? '', audience: (a.audience ?? (a.targetRoles ?? []).join(', ')) || 'All staff' }));
  return (
    <HodWorkspaceShell title="HOD Announcements" eyebrow="Department communication">
      <Card className="rounded-xl p-5">
        <SectionTitle title="Department announcements" action="/hod/announcements/create" />
        {isLoading && <div className="mt-4"><SkeletonTable cols={2} /></div>}
        {isError && <div className="mt-4"><DataError onRetry={refetch} /></div>}
        {!isLoading && !isError && items.length === 0 && (
          <div className="mt-4"><EmptyState title="No announcements" description="Create an announcement to communicate with your department." /></div>
        )}
        {!isLoading && !isError && items.length > 0 && (
          <div className="mt-4 grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col gap-3 rounded-xl p-4 transition hover:-translate-y-0.5 hover:shadow-layer">
                <p className="flex-1 text-sm font-semibold leading-6 text-ks-slate">{item.body}</p>
                <Badge tone="blue">{item.audience}</Badge>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </HodWorkspaceShell>
  );
}

export function CreateHodAnnouncementPage() {
  const navigate = useNavigate();
  const createMutation = useCreateHodAnnouncementMutation();
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL', audience: 'All Sciences teachers', scheduledAt: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { toast('Title and body are required', 'error'); return; }
    createMutation.mutate({ title: form.title, body: form.body, priority: form.priority, audience: form.audience, scheduledAt: form.scheduledAt || undefined }, {
      onSuccess: () => { toast('Announcement published', 'success'); navigate('/hod/announcements'); },
      onError: () => toast('Failed to publish announcement', 'error'),
    });
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <HodWorkspaceShell title="Create Department Announcement" eyebrow="Teacher and class audience">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-3">
              <MessageSquarePlus className="h-5 w-5 text-ks-blue" />
              <h2 className="font-display text-2xl font-black text-ks-navy">Create Department Announcement</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Title *</span>
                <input required value={form.title} onChange={set('title')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="e.g. Chemistry record book audit Friday" />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Body *</span>
                <textarea required value={form.body} onChange={set('body')} rows={5} className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="Announcement details for your department…" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Priority</span>
                  <select value={form.priority} onChange={set('priority')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue">
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Audience</span>
                  <input value={form.audience} onChange={set('audience')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="All Sciences teachers" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Schedule (optional)</span>
                  <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" />
                </label>
              </div>
            </div>
            <Button type="submit" className="mt-5 rounded-xl" disabled={createMutation.isPending}>
              <Send className="h-4 w-4" /> {createMutation.isPending ? 'Publishing…' : 'Publish announcement'}
            </Button>
          </Card>
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Live Preview</p>
            <div className="mt-3 rounded-xl border border-ks-line bg-ks-paper p-4">
              <p className="font-black text-ks-navy">{form.title || 'Announcement title…'}</p>
              <p className="mt-2 text-sm font-semibold leading-relaxed text-ks-slate">{form.body || 'Announcement body will appear here for recipients.'}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-ks-blue/10 px-2 py-0.5 text-[10px] font-black text-ks-blue">{form.audience}</span>
                <span className="rounded-full bg-ks-amber/10 px-2 py-0.5 text-[10px] font-black text-ks-amber">{form.priority}</span>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </HodWorkspaceShell>
  );
}

// ─── Exports ────────────────────────────────────────────────────────────────

// reportType values map to the backend ReportType enum.
const hodExportItems: Array<{ title: string; description: string; format: string; reportType: string }> = [
  { title: 'Class academic report', description: 'Per-class academic performance across the department.', format: 'PDF', reportType: 'CLASS_ACADEMIC' },
  { title: 'Teacher performance', description: 'Class averages and submission timeliness per teacher.', format: 'PDF', reportType: 'TEACHER_PERFORMANCE' },
  { title: 'Student profiles', description: 'At-risk and flagged students across all subjects.', format: 'CSV', reportType: 'STUDENT_PROFILE' },
  { title: 'Attendance summary', description: 'Department attendance trends for the current term.', format: 'PDF', reportType: 'ATTENDANCE_SUMMARY' },
  { title: 'Performance engine', description: 'Alerts and intervention outcomes from the engine.', format: 'PDF', reportType: 'PERFORMANCE_ENGINE' },
  { title: 'Term summary', description: 'Complete departmental term summary for governance.', format: 'PDF', reportType: 'TERM_SUMMARY' },
  { title: 'Department report', description: 'Subject averages, teacher submission rates, at-risk count, approval turnaround.', format: 'PDF', reportType: 'DEPARTMENT_SUMMARY' },
];

export function HodExportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const generateMutation = useGenerateReportMutation();

  const handleGenerate = async (item: typeof hodExportItems[0]) => {
    setGenerating(item.title);
    toast(`Generating "${item.title}"…`, 'info');
    try {
      const result = await generateMutation.mutateAsync({ reportType: item.reportType, scope: 'school' }) as Record<string, unknown> | undefined;
      const jobId = String(result?.id ?? result?.reportId ?? result?.jobId ?? '');
      if (!jobId) throw new Error('No job id returned');
      await downloadReportWhenReady(jobId, `${item.title}.${item.format.toLowerCase()}`);
      toast(`"${item.title}" downloaded`, 'success');
    } catch {
      toast(`Failed to generate "${item.title}". Please try again.`, 'error');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <HodWorkspaceShell title="HOD Export Center" eyebrow="Department reports">
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {hodExportItems.map((item) => (
          <Card key={item.title} className="group flex flex-col rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-layer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ks-blue/10">
                <Download className="h-5 w-5 text-ks-blue" />
              </div>
              <span className="rounded-full border border-ks-slate/15 bg-ks-slate/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-slate">
                {item.format}
              </span>
            </div>
            <h3 className="mt-4 font-display text-xl font-black text-ks-navy">{item.title}</h3>
            <p className="mt-1 flex-1 text-sm font-semibold text-ks-muted">{item.description}</p>
            <Button
              variant="secondary"
              className="mt-4 w-full rounded-xl"
              disabled={generating !== null}
              onClick={() => handleGenerate(item)}
            >
              <Download className="h-4 w-4" /> {generating === item.title ? 'Generating…' : 'Generate'}
            </Button>
          </Card>
        ))}
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Audit trail ───────────────────────────────────────────────────────────

export function HodAuditPage() {
  const { data: auditData = [], isLoading, isError, refetch } = useHodAudit() as { data: Array<{ id: string; date?: string; createdAt?: string; actor?: string; decision?: string; entity?: string; reason?: string; action?: string }>; isLoading: boolean; isError: boolean; refetch: () => void };
  const toneMap = ['bg-ks-sky', 'bg-ks-rose', 'bg-ks-amber', 'bg-ks-gold', 'bg-ks-emerald'];
  const events = auditData.map((e, i) => ({
    text: `${e.decision ?? e.action ?? 'Action'} — ${e.entity ?? ''}${e.reason ? `: ${e.reason}` : ''}`,
    tone: toneMap[i % toneMap.length],
    date: e.date ?? e.createdAt ?? '',
    actor: e.actor ?? 'System',
    id: e.id,
  }));
  return (
    <HodWorkspaceShell title="Department Academic Audit Trail" eyebrow="Decision history">
      {isLoading && <SkeletonTable cols={3} />}
      {isError && <DataError onRetry={refetch} />}
      {!isLoading && !isError && events.length === 0 && (
        <EmptyState title="No audit events" description="HOD decisions and actions will appear here once recorded." />
      )}
      {!isLoading && !isError && events.length > 0 && (
      <Card className="overflow-hidden rounded-xl bg-ks-navy p-6 text-white shadow-layer">
        <div className="relative border-l border-ks-mist/20 pl-6">
          {events.map((event, index) => (
            <div key={event.id} className={`relative ${index < events.length - 1 ? 'mb-8' : ''}`}>
              <span className={`absolute -left-[31px] top-0 h-4 w-4 rounded-full border-4 border-ks-navy ${event.tone}`} />
              <p className="text-[10px] font-black uppercase tracking-wider text-ks-gold">{event.date}</p>
              <p className="mt-1 font-semibold text-ks-mist/80">{event.text}</p>
              <p className="mt-0.5 text-xs text-ks-mist/45">
                Actor: {event.actor} · Correlation ID: HOD-{1000 + index}
              </p>
            </div>
          ))}
        </div>
      </Card>
      )}
    </HodWorkspaceShell>
  );
}

// ─── Internal sub-components ──────────────────────────────────────────────

// Real department grade distribution, summed from every assessed subject.
function DepartmentGradeChart({ subjects }: { subjects: typeof hodSubjects }) {
  const grades = ['A', 'B', 'C', 'D', 'E', 'F'];
  const totals: Record<string, number> = {};
  let total = 0;
  for (const s of subjects as unknown as Array<{ gradeDistribution?: Record<string, number> }>) {
    for (const [g, n] of Object.entries(s.gradeDistribution ?? {})) {
      const key = g.toUpperCase();
      totals[key] = (totals[key] ?? 0) + Number(n);
      total += Number(n);
    }
  }
  const max = Math.max(1, ...grades.map((g) => totals[g] ?? 0));
  const toneFor = (g: string) => g === 'A' ? 'bg-ks-emerald' : g === 'B' ? 'bg-ks-blue' : g === 'C' ? 'bg-ks-sky' : g === 'D' ? 'bg-ks-amber' : 'bg-ks-rose';
  return (
    <div className="relative overflow-hidden rounded-xl bg-ks-navy p-6 text-white shadow-layer">
      <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
      <div className="relative flex items-start justify-between">
        <div>
          <h4 className="font-display text-xl font-black">Department Grade Distribution</h4>
          <p className="text-sm font-semibold text-ks-mist/60">Across all assessed subjects this term</p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-black text-ks-gold">{total}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-ks-mist/40">Graded marks</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="relative mt-6 text-sm font-semibold text-ks-mist/50">No grades recorded yet for submitted assessments.</p>
      ) : (
        <>
          <div className="mt-6 flex items-end gap-3" style={{ height: 96 }}>
            {grades.map((g) => (
              <div key={g} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                <span className="text-[10px] font-black text-ks-mist/70">{totals[g] ?? 0}</span>
                <div className={`w-full rounded-t ${toneFor(g)} transition-all duration-700`} style={{ height: `${((totals[g] ?? 0) / max) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-center text-[10px] font-bold text-ks-mist/50">
            {grades.map((g) => <span key={g} className="flex-1">{g}</span>)}
          </div>
        </>
      )}
    </div>
  );
}

function DepartmentMatrixTable({ subjectId }: { subjectId?: string } = {}) {
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const rows = subjectId ? apiSubjects.filter((subject) => subject.id === subjectId) : apiSubjects;
  return (
    <HodTable columns={['Subject', 'Teacher', 'Average', 'Students', 'At-risk', 'Pending', 'Alerts', 'Actions']}>
      {rows.map((subject) => (
        <tr key={subject.id} className={`transition ${subject.tone === 'rose' ? 'bg-ks-rose/5 hover:bg-ks-rose/10' : 'hover:bg-ks-paper'}`}>
          <Td><span className="font-bold text-ks-navy">{subject.name}</span></Td>
          <Td>{subject.teacher}</Td>
          <Td>
            <span className={`font-black ${subject.average >= 75 ? 'text-ks-emerald' : subject.average >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>
              {subject.average}%
            </span>
          </Td>
          <Td>
            <span className="font-bold text-ks-slate">{subject.studentsAssessed}</span>
          </Td>
          <Td>
            <span className={`font-bold ${subject.atRisk > 3 ? 'text-ks-rose' : 'text-ks-slate'}`}>{subject.atRisk}</span>
          </Td>
          <Td>
            <span className={`font-bold ${subject.pending > 0 ? 'text-ks-amber' : 'text-ks-slate'}`}>{subject.pending}</span>
          </Td>
          <Td>
            <span className={`font-bold ${subject.alerts > 0 ? 'text-ks-amber' : 'text-ks-slate'}`}>{subject.alerts}</span>
          </Td>
          <Td>
            <NavLink to={`/hod/department/subjects/${subject.id}`} className="font-black text-ks-blue hover:underline">
              Open →
            </NavLink>
          </Td>
        </tr>
      ))}
    </HodTable>
  );
}

function TeachersTable() {
  const { data: apiTeachers = [] as typeof hodTeachers, isLoading, isError, refetch } = useHodTeachersList() as unknown as { data: typeof hodTeachers; isLoading: boolean; isError: boolean; refetch: () => void };
  if (isLoading) return <SkeletonTable cols={5} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (apiTeachers.length === 0) return <EmptyState title="No teacher data" description="Teacher performance appears here once assessments are submitted for the department." />;
  return (
    <HodTable columns={['Teacher', 'Subjects', 'Class average', 'On-time', 'Pending', 'Actions']}>
      {apiTeachers.map((teacher) => {
        const risk = teacher.average > 0 && teacher.average < 60;
        return (
          <tr key={teacher.id} className={`transition ${risk ? 'bg-ks-rose/5 hover:bg-ks-rose/10' : 'hover:bg-ks-paper'}`}>
            <Td>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${risk ? 'bg-ks-rose' : 'bg-ks-emerald'}`}>
                  {teacher.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-ks-navy">{teacher.name}</span>
              </div>
            </Td>
            <Td>{teacher.subjects || '—'}</Td>
            <Td><span className={`font-black ${teacher.average >= 75 ? 'text-ks-emerald' : teacher.average >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>{teacher.average}%</span></Td>
            <Td><span className={`font-black ${teacher.onTime < 60 ? 'text-ks-rose' : 'text-ks-emerald'}`}>{teacher.onTime}%</span></Td>
            <Td><span className={teacher.pending > 0 ? 'font-bold text-ks-amber' : 'text-ks-slate'}>{teacher.pending}</span></Td>
            <Td>
              <NavLink to={`/hod/teachers/${teacher.id}`} className="font-black text-ks-blue hover:underline">Detail →</NavLink>
            </Td>
          </tr>
        );
      })}
    </HodTable>
  );
}

function MarksReviewTable({ marks = hodMarks, average }: { marks?: typeof hodMarks; average: number }) {
  return (
    <HodTable columns={['Student', 'Registration', 'Score', 'Percentage', 'Grade', 'Absent', 'Outlier', 'Notes']}>
      {marks.map((row) => {
        const outlier = isOutlier(row, average, 18);
        const percent = row.score === null ? 0 : Math.round((row.score / row.maxScore) * 100);
        return (
          <tr key={row.registration} className={`transition ${outlier ? 'bg-ks-rose/5 hover:bg-ks-rose/10' : 'hover:bg-ks-paper'}`}>
            <Td>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-[10px] font-black text-ks-blue">
                  {row.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span className="font-bold text-ks-navy">{row.student}</span>
              </div>
            </Td>
            <Td><span className="font-mono text-xs">{row.registration}</span></Td>
            <Td><span className="font-black text-ks-slate">{row.score ?? '—'}</span></Td>
            <Td>
              {row.absent ? '—' : (
                <span className={`font-black ${percent >= 75 ? 'text-ks-emerald' : percent >= 50 ? 'text-ks-amber' : 'text-ks-rose'}`}>
                  {percent}%
                </span>
              )}
            </Td>
            <Td>{row.absent ? '—' : percent >= 80 ? 'A' : percent >= 60 ? 'B' : 'D'}</Td>
            <Td>{row.absent ? <span className="font-bold text-ks-amber">Yes</span> : 'No'}</Td>
            <Td>
              {outlier
                ? <span className="inline-flex items-center gap-1 rounded border border-ks-rose/25 bg-ks-rose/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-ks-rose">Outlier</span>
                : <span className="inline-flex items-center gap-1 rounded border border-ks-emerald/25 bg-ks-emerald/10 px-2 py-0.5 text-[10px] font-extrabold uppercase text-ks-emerald">Clear</span>
              }
            </Td>
            <Td>{row.note}</Td>
          </tr>
        );
      })}
    </HodTable>
  );
}

function TeacherSubmissionMatrix() {
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as unknown as { data: typeof hodTeachers };
  return (
    <Card className="rounded-xl p-5">
      <SectionTitle title="Class Averages by Teacher" />
      {apiTeachers.length === 0 && <p className="mt-4 text-sm font-semibold text-ks-muted">No teacher data yet.</p>}
      <div className="mt-4 space-y-4">
        {apiTeachers.map((teacher) => (
          <div key={teacher.id} className="flex items-center gap-4">
            <span className="w-36 shrink-0 truncate text-sm font-bold text-ks-navy">
              {teacher.name}
            </span>
            <div className="flex-1">
              <ProgressBar value={teacher.average} tone={teacher.average < 60 ? 'bg-ks-rose' : teacher.average < 75 ? 'bg-ks-amber' : 'bg-ks-emerald'} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-black text-ks-muted">{teacher.average}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Real data-driven insight panel computed from department subject health.
function NavyInsightPanel() {
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const sorted = [...apiSubjects].filter((s) => s.studentsAssessed > 0).sort((a, b) => b.average - a.average);
  const top = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const totalPending = apiSubjects.reduce((s, sub) => s + sub.pending, 0);
  const totalAtRisk = apiSubjects.reduce((s, sub) => s + sub.atRisk, 0);
  const insights: Array<{ tone: string; label: string; text: string }> = [];
  if (top) insights.push({ tone: 'bg-ks-emerald', label: 'Strongest subject', text: `${top.name} leads the department at ${top.average}% across ${top.studentsAssessed} assessed students.` });
  if (weakest && weakest.id !== top?.id) insights.push({ tone: 'bg-ks-rose', label: 'Needs attention', text: `${weakest.name} is the weakest at ${weakest.average}%${weakest.atRisk > 0 ? ` with ${weakest.atRisk} at-risk students` : ''}.` });
  if (totalPending > 0) insights.push({ tone: 'bg-ks-amber', label: 'Approvals', text: `${totalPending} assessment${totalPending > 1 ? 's' : ''} awaiting your review.` });
  if (totalAtRisk > 0) insights.push({ tone: 'bg-ks-gold', label: 'Risk', text: `${totalAtRisk} critical/high performance alert${totalAtRisk > 1 ? 's' : ''} flagged across the department.` });
  if (insights.length === 0) insights.push({ tone: 'bg-ks-sky', label: 'All clear', text: 'No submitted assessments or alerts to summarise yet.' });
  return (
    <Card className="overflow-hidden rounded-xl bg-ks-navy p-6 text-white">
      <h3 className="font-display text-xl font-black">Department Insights</h3>
      <div className="mt-5 space-y-5 border-l border-ks-mist/20 pl-5">
        {insights.map((insight) => (
          <div key={insight.label} className="relative">
            <span className={`absolute -left-[27px] top-0 h-4 w-4 rounded-full border-4 border-ks-navy ${insight.tone}`} />
            <p className="text-[10px] font-black uppercase tracking-wider text-ks-gold">{insight.label}</p>
            <p className="mt-1 text-sm font-semibold text-ks-mist/75">{insight.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Real grade-distribution bars for one subject (replaces fabricated trend line).
function TrendBoard({ subject }: { subject: typeof hodSubjects[number] }) {
  const grades = ['A', 'B', 'C', 'D', 'E', 'F'];
  const gd = (subject as unknown as { gradeDistribution?: Record<string, number> }).gradeDistribution ?? {};
  const counts = grades.map((g) => Number(gd[g] ?? gd[g.toLowerCase()] ?? 0));
  const total = counts.reduce((s, n) => s + n, 0);
  const max = Math.max(1, ...counts);
  const toneFor = (g: string) => g === 'A' ? 'bg-ks-emerald' : g === 'B' ? 'bg-ks-blue' : g === 'C' ? 'bg-ks-sky' : g === 'D' ? 'bg-ks-amber' : 'bg-ks-rose';
  return (
    <Card className="overflow-hidden rounded-xl p-5">
      <SectionTitle title="Grade distribution" />
      {total === 0 ? (
        <p className="mt-4 text-sm font-semibold text-ks-muted">No graded marks recorded for this subject yet.</p>
      ) : (
        <div className="mt-5 rounded-xl bg-ks-paper p-4">
          <div className="flex items-end gap-3" style={{ height: 96 }}>
            {grades.map((g, i) => (
              <div key={g} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
                <span className="text-[10px] font-black text-ks-muted">{counts[i]}</span>
                <div className={`w-full rounded-t ${toneFor(g)}`} style={{ height: `${(counts[i] / max) * 100}%`, minHeight: counts[i] > 0 ? 4 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-center text-[10px] font-black text-ks-muted">
            {grades.map((g) => <span key={g} className="flex-1">{g}</span>)}
          </div>
        </div>
      )}
    </Card>
  );
}

// Grade distribution bars computed from real per-student marks.
function MarksGradeDistribution({ marks }: { marks: typeof hodMarks }) {
  const buckets = [
    { grade: 'A', min: 75, tone: 'bg-ks-emerald' },
    { grade: 'B', min: 65, tone: 'bg-ks-blue' },
    { grade: 'C', min: 50, tone: 'bg-ks-sky' },
    { grade: 'D', min: 40, tone: 'bg-ks-amber' },
    { grade: 'F', min: 0, tone: 'bg-ks-rose' },
  ];
  const scored = marks.filter((m) => !m.absent && m.score !== null);
  const counts = buckets.map((b, i) => {
    const upper = i === 0 ? Infinity : buckets[i - 1].min;
    return scored.filter((m) => {
      const pct = (m.score as number) / m.maxScore * 100;
      return pct >= b.min && pct < upper;
    }).length;
  });
  const total = scored.length || 1;
  const max = Math.max(1, ...counts);
  return (
    <Card className="rounded-xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl font-black text-ks-navy">Grade Distribution</h3>
        <span className="text-xs font-semibold text-ks-muted">{scored.length} marked</span>
      </div>
      <div className="mt-5 flex items-end gap-2" style={{ height: 90 }}>
        {buckets.map((b, i) => (
          <div key={b.grade} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
            <span className="text-[10px] font-black text-ks-muted">{counts[i]}</span>
            <div className={`w-full rounded-t ${b.tone}`} style={{ height: `${(counts[i] / max) * 100}%`, minHeight: counts[i] > 0 ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 text-center text-[10px] font-black text-ks-muted">
        {buckets.map((b) => <span key={b.grade} className="flex-1">{b.grade}</span>)}
      </div>
      <div className="mt-4 space-y-2">
        {buckets.map((b, i) => (
          <div key={b.grade}>
            <div className="mb-1 flex justify-between text-xs font-black text-ks-muted">
              <span>{b.grade}</span><span>{Math.round((counts[i] / total) * 100)}%</span>
            </div>
            <ProgressBar value={Math.round((counts[i] / total) * 100)} tone={b.tone} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function SubmissionTimeline() {
  const { data: apiApprovals = [] } = useHodPendingApprovals();
  const nodes = (apiApprovals as Array<{ id: string; assessment: string; submittedHoursAgo: number }>).slice(0, 6);
  return (
    <Card className="rounded-xl p-5">
      <SectionTitle title="Recent submissions" />
      {nodes.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-ks-muted">No recent submissions.</p>
      ) : (
        <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2">
          {nodes.map((node) => {
            const overdue = node.submittedHoursAgo >= 48;
            return (
              <div key={node.id} className="flex min-w-28 flex-col items-center">
                <div className={`h-5 w-5 rounded-full border-4 border-white shadow ${overdue ? 'bg-ks-rose' : 'bg-ks-emerald'}`} />
                <p className="mt-2 line-clamp-2 text-center text-xs font-bold text-ks-navy">{node.assessment}</p>
                <p className="text-[10px] font-black uppercase text-ks-muted">{node.submittedHoursAgo}h ago</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SubjectTabs({ active }: { active: string }) {
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  if (apiSubjects.length === 0) return null;
  return (
    <Card className="flex w-fit flex-wrap gap-1 rounded-xl bg-ks-line/30 p-1">
      {apiSubjects.map((subject) => {
        const isActive = active === subject.id;
        const isRisk = subject.tone === 'rose';
        return (
          <NavLink
            key={subject.id}
            to={`/hod/department/subjects/${subject.id}`}
            className={`rounded-lg px-5 py-2 text-sm font-black transition ${
              isActive
                ? isRisk ? 'bg-ks-rose text-white shadow-md' : 'bg-white text-ks-navy shadow-sm'
                : 'text-ks-muted hover:bg-white'
            }`}
          >
            {subject.name}{isRisk ? ' (Risk)' : ''}
          </NavLink>
        );
      })}
    </Card>
  );
}

function FilterBar({ items }: { items: string[] }) {
  return (
    <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
      <Filter className="h-4 w-4 shrink-0 text-ks-muted" />
      <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Filter:</span>
      {items.map((item) => (
        <button key={item} className="rounded-full border border-ks-line bg-ks-paper px-3 py-1 text-xs font-bold text-ks-muted transition hover:border-ks-blue hover:text-ks-blue">
          {item}
        </button>
      ))}
    </Card>
  );
}

// Action-to-route map for ActionPanel navigation
const ACTION_ROUTES: Record<string, string> = {
  'open class analytics':  '/hod/department',
  'create support record': '/hod/interventions',
  'export teacher report': '/hod/exports',
};

function ActionPanel({ title, actions }: { title: string; actions: string[] }) {
  const navigate = useNavigate();
  return (
    <Card className="sticky top-24 h-fit rounded-xl border-l-4 border-l-ks-blue p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">{title}</p>
      <div className="mt-4 space-y-2">
        {actions.map((action) => {
          const route = ACTION_ROUTES[action.toLowerCase()];
          if (!route) return null;
          return (
            <Button
              key={action}
              variant={action.toLowerCase().includes('reject') ? 'danger' : 'secondary'}
              className="w-full justify-between rounded-xl"
              onClick={() => navigate(route)}
            >
              {action}
              <ArrowRight className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
    </Card>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-black text-ks-navy">{title}</h2>
      {action
        ? <NavLink to={action} className="text-sm font-black text-ks-blue hover:underline">Open →</NavLink>
        : null
      }
    </div>
  );
}

function StatCell({ label, value, tone = 'text-ks-navy' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-ks-paper p-3">
      <p className="text-[10px] font-black uppercase text-ks-muted">{label}</p>
      <p className={`mt-1 font-display text-xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-5 py-3 font-semibold text-ks-slate">{children}</td>;
}

// ─── Discipline HOD ───────────────────────────────────────────────────────────

export function DisciplineHodPage() {
  const { data: records = [], isLoading } = useAllDisciplineRecords();
  const resolveMutation = useResolveDisciplineMutation();
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  const allRecords = records as any[];
  const open = allRecords.filter((r: any) => !r.resolvedAt);
  const severe = allRecords.filter((r: any) => r.severity === 'SEVERE');
  const pendingNotif = allRecords.filter((r: any) => r.requiresParentNotification && !r.resolvedAt);

  const filtered = allRecords.filter((r: any) => {
    const catOk = categoryFilter === 'ALL' || r.category === categoryFilter;
    const sevOk = severityFilter === 'ALL' || r.severity === severityFilter;
    return catOk && sevOk;
  });

  const categories = ['ALL', 'MISCONDUCT', 'BULLYING', 'CHEATING', 'ABSENTEEISM', 'VIOLENCE', 'PROPERTY_DAMAGE', 'DISRESPECT', 'OTHER'];
  const severities = ['ALL', 'MINOR', 'MODERATE', 'SEVERE'];

  const severityTone = (s: string) => s === 'SEVERE' ? 'rose' : s === 'MODERATE' ? 'amber' : 'blue';

  const submitResolve = (recordId: string) => {
    if (!resolveNote.trim()) { toast('Resolution note is required', 'warning'); return; }
    resolveMutation.mutate({ recordId, note: resolveNote }, {
      onSuccess: () => { toast('Incident resolved', 'success'); setResolvingId(null); setResolveNote(''); },
      onError: (e: any) => toast(e?.response?.data?.message ?? 'Failed to resolve', 'error'),
    });
  };

  return (
    <HodWorkspaceShell
      title="Discipline Command Center"
      eyebrow="Discipline Department · Incident management"
      action={
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5">
          <Scale className="h-4 w-4 text-amber-600" />
          <span className="text-xs font-black text-amber-700">System Default Department</span>
        </div>
      }
    >
      {/* Metric strip */}
      <HodMetricStrip items={[
        { label: 'Open Incidents',  value: String(open.length),         detail: 'Unresolved',       tone: open.length > 0 ? 'rose' : 'blue' },
        { label: 'Severe Cases',    value: String(severe.length),       detail: 'High priority',    tone: severe.length > 0 ? 'rose' : 'blue' },
        { label: 'Parent Notify',   value: String(pendingNotif.length), detail: 'Pending action',   tone: pendingNotif.length > 0 ? 'amber' : 'blue' },
        { label: 'Total This Term', value: String(allRecords.length),   detail: 'All incidents',    tone: 'blue' },
      ]} />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-ks-muted self-center">Category:</span>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${categoryFilter === c ? 'bg-ks-navy text-white' : 'border border-ks-line bg-ks-paper text-ks-muted hover:border-ks-blue hover:text-ks-blue'}`}>
            {c === 'ALL' ? 'All' : c.replace(/_/g, ' ')}
          </button>
        ))}
        <span className="text-[11px] font-black uppercase tracking-wider text-ks-muted self-center ml-2">Severity:</span>
        {severities.map((s) => (
          <button key={s} onClick={() => setSeverityFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${severityFilter === s ? 'bg-ks-navy text-white' : 'border border-ks-line bg-ks-paper text-ks-muted hover:border-ks-blue hover:text-ks-blue'}`}>
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Incident table */}
      <Card className="overflow-hidden rounded-2xl">
        {isLoading ? <SkeletonTable cols={7} /> : filtered.length === 0 ? (
          <EmptyState title="No incidents" description="No discipline records match the current filters." />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-ks-line bg-ks-paper">
              <tr>
                {['Student', 'Class', 'Category', 'Severity', 'Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-ks-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((record: any) => {
                const isResolved = Boolean(record.resolvedAt);
                const isResolvingThis = resolvingId === record.id;
                return (
                  <React.Fragment key={record.id}>
                    <tr className={`border-b border-ks-line ${isResolvingThis ? 'bg-indigo-50' : 'hover:bg-ks-paper/60'}`}>
                      <Td>{record.studentId}</Td>
                      <Td>{record.classId ?? '—'}</Td>
                      <Td><span className="font-mono text-xs">{String(record.category ?? '').replace(/_/g, ' ')}</span></Td>
                      <Td><Badge tone={severityTone(record.severity) as any}>{record.severity}</Badge></Td>
                      <Td>{record.incidentDate ? new Date(record.incidentDate).toLocaleDateString() : '—'}</Td>
                      <Td>
                        {isResolved
                          ? <Badge tone="emerald">Resolved</Badge>
                          : <Badge tone="rose">Open</Badge>}
                      </Td>
                      <Td>
                        {!isResolved && (
                          <button onClick={() => { setResolvingId(isResolvingThis ? null : record.id); setResolveNote(''); }}
                            className="rounded-lg bg-ks-navy px-3 py-1 text-xs font-black text-white hover:bg-ks-navy/80">
                            {isResolvingThis ? 'Cancel' : 'Resolve'}
                          </button>
                        )}
                      </Td>
                    </tr>
                    {isResolvingThis && (
                      <tr className="bg-indigo-50">
                        <td colSpan={7} className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <input
                              value={resolveNote}
                              onChange={(e) => setResolveNote(e.target.value)}
                              placeholder="Resolution note (required)…"
                              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold focus:border-[#4338CA] focus:outline-none"
                            />
                            <button onClick={() => submitResolve(record.id)} disabled={resolveMutation.isPending}
                              className="rounded-xl bg-ks-emerald px-4 py-2 text-xs font-black text-white hover:opacity-90 disabled:opacity-50">
                              {resolveMutation.isPending ? 'Saving…' : 'Confirm'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </HodWorkspaceShell>
  );
}

function useApproval() {
  const { assessmentId } = useParams();
  const { data: apiApprovals = [] as typeof hodApprovals, isLoading: pendingLoading } = useHodPendingApprovals() as unknown as { data: typeof hodApprovals; isLoading: boolean };
  const fromPending = pendingLoading ? null : (apiApprovals.find((a) => a.id === assessmentId) ?? null);
  const { data: directData, isLoading: directLoading } = useAssessmentById(
    assessmentId ?? '',
    !pendingLoading && !fromPending,
  );
  const loading = pendingLoading || (!fromPending && directLoading);
  const approval = fromPending ?? (directData as typeof hodApprovals[number] | undefined ?? null);
  return useMemo(() => ({ loading, approval }), [loading, approval]);
}

function useSubject() {
  const { subjectId } = useParams();
  const { data: apiSubjects = [] as typeof hodSubjects, isLoading } = useHodClassSubjects() as unknown as { data: typeof hodSubjects; isLoading: boolean };
  return useMemo(
    () => ({ loading: isLoading, subject: isLoading ? null : (apiSubjects.find((s) => s.id === subjectId) ?? null) }),
    [subjectId, apiSubjects, isLoading],
  );
}

function useTeacher() {
  const { teacherId } = useParams();
  const { data: apiTeachers = [] as typeof hodTeachers, isLoading } = useHodTeachersList() as unknown as { data: typeof hodTeachers; isLoading: boolean };
  return useMemo(
    () => ({ loading: isLoading, teacher: isLoading ? null : (apiTeachers.find((t) => t.id === teacherId) ?? null) }),
    [teacherId, apiTeachers, isLoading],
  );
}
