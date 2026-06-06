import { ArrowRight, BookOpen, CheckCircle2, Download, Filter, MessageSquarePlus, Send, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
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
  useHodAlerts,
  useHodAnnouncements,
  useHodApprovalHistory,
  useHodAudit,
  useHodClassSubjects,
  useHodInterventions,
  useHodPairings,
  useHodPendingApprovals,
  useHodTeachersList,
  useMarksApprovalReview,
  useApproveAssessmentMutation,
  useRejectAssessmentMutation,
  useActivateHodPairingMutation,
  useCreateHodAnnouncementMutation,
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

// ─── Home ──────────────────────────────────────────────────────────────────

export function HodHomePage() {
  const { data: apiApprovals = [] } = useHodPendingApprovals();
  const { data: apiAlerts = [] } = useHodAlerts();
  const { data: apiTeachers = [] } = useHodTeachersList();
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const sortedApprovals = sortOldestApprovalsFirst(apiApprovals as unknown as Parameters<typeof sortOldestApprovalsFirst>[0]);
  const firstApproval = sortedApprovals[0] ?? null;
  return (
    <HodWorkspaceShell
      title="Department Command Center"
      eyebrow="HOD academic control room"
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
  if (loading) return <HodWorkspaceShell title="Loading…" eyebrow="Teacher department profile"><SkeletonTable cols={5} /></HodWorkspaceShell>;
  if (!teacher) return <HodWorkspaceShell title="Not Found" eyebrow="Teacher department profile"><EmptyState title="Teacher not found" description="This teacher profile could not be loaded." /></HodWorkspaceShell>;
  return (
    <HodWorkspaceShell title={teacher.name} eyebrow="Teacher department profile">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-gutter">
          <TeacherRiskCard teacher={teacher} />
          <SubmissionTimeline />
          <DepartmentMatrixTable />
        </section>
        <section className="space-y-stack-lg">
          <ActionPanel title="Teacher actions" actions={['Open class analytics', 'Create support record', 'Export teacher report']} />
          <NavyInsightPanel />
        </section>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Department alerts ──────────────────────────────────────────────────────

export function DepartmentAlertsPage() {
  const { data: apiAlerts = [] as typeof hodAlerts, isLoading, isError, refetch } = useHodAlerts() as unknown as { data: typeof hodAlerts; isLoading: boolean; isError: boolean; refetch: () => void };
  const critical = apiAlerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH');
  const watch = apiAlerts.filter((a) => a.severity === 'MEDIUM');
  const improving = apiAlerts.filter((a) => a.severity === 'LOW' || a.severity === 'POSITIVE');
  return (
    <HodWorkspaceShell title="Department Performance Alerts" eyebrow="Escalation and resolution">
      <HodMetricStrip items={[
        { label: 'Critical / High', value: String(critical.length).padStart(2, '0'), detail: critical[0] ? `${critical[0].student} · ${critical[0].subject}` : 'None flagged', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Medium', value: String(watch.length).padStart(2, '0'), detail: watch[0] ? `${watch[0].student} · ${watch[0].subject}` : 'None flagged', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Low / Positive', value: String(improving.length).padStart(2, '0'), detail: 'Monitoring or improving', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Total alerts', value: String(apiAlerts.length).padStart(2, '0'), detail: 'Across department subjects', inverted: true, icon: ShieldCheck },
      ]} />
      {isLoading && <SkeletonTable cols={3} />}
      {isError && <DataError onRetry={refetch} />}
      {!isLoading && !isError && apiAlerts.length === 0 && (
        <EmptyState title="No active alerts" description="Performance alerts for your department subjects will appear here." />
      )}
      <div className="grid gap-gutter xl:grid-cols-3">
        {apiAlerts.map((alert) => <DepartmentAlertCard key={alert.id} alert={alert} />)}
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Peer pairings ──────────────────────────────────────────────────────────

export function DepartmentPairingsPage() {
  const { data: apiPairings = [] as typeof hodPairings } = useHodPairings() as unknown as { data: typeof hodPairings };
  const activateMutation = useActivateHodPairingMutation();
  const suggestedPairings = apiPairings.filter((p) => p.status === 'SUGGESTED');

  const handleActivateAll = () => {
    if (suggestedPairings.length === 0) { toast('No suggested pairings to activate', 'info'); return; }
    Promise.all(suggestedPairings.map((p) => activateMutation.mutateAsync({ id: p.id })))
      .then(() => toast(`${suggestedPairings.length} pairings activated`, 'success'))
      .catch(() => toast('Some activations failed. Please retry.', 'error'));
  };

  return (
    <HodWorkspaceShell title="Department Peer Pairings" eyebrow="Bulk activation surface">
      <HodMetricStrip items={[
        { label: 'Suggested', value: String(suggestedPairings.length), detail: 'Awaiting action', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Active', value: String(apiPairings.filter((p) => p.status === 'ACTIVE').length), detail: 'Current support', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Completed', value: String(apiPairings.filter((p) => p.status === 'COMPLETED').length), detail: 'This term', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'Total pairings', value: String(apiPairings.length), detail: 'Across department', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-gutter">
          {apiPairings.map((pairing) => <PairingReviewCard key={pairing.id} pairing={pairing} />)}
        </section>
        <Card className="sticky top-24 h-fit rounded-xl border-l-4 border-l-ks-blue p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Bulk action</p>
          <div className="mt-4 space-y-2">
            <Button className="w-full justify-between rounded-xl" onClick={handleActivateAll} disabled={activateMutation.isPending}>
              Activate all suggested ({suggestedPairings.length}) <ArrowRight className="h-4 w-4" />
            </Button>
            <NavLink to="/hod/exports">
              <Button variant="secondary" className="w-full justify-between rounded-xl">
                Go to Export Center <ArrowRight className="h-4 w-4" />
              </Button>
            </NavLink>
          </div>
        </Card>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Student performance (HOD view) ─────────────────────────────────────────

export function HodStudentPerformancePage() {
  const { studentId } = useParams();
  const { data: apiAlerts = [], isLoading } = useHodAlerts();
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as unknown as { data: typeof hodSubjects };
  const studentAlerts = (apiAlerts as Array<{ studentId: string; student: string; subject: string; currentScore: number | null }>).filter((item) => item.studentId === studentId);
  const alert = studentAlerts[0] ?? null;

  if (isLoading) return <HodWorkspaceShell title="Loading…" eyebrow="Department student profile"><SkeletonTable cols={4} /></HodWorkspaceShell>;
  if (!alert) return <HodWorkspaceShell title="Student Not Found" eyebrow="Department student profile"><EmptyState title="Student not found" description="No alert record for this student." /></HodWorkspaceShell>;

  // Build a per-subject score series from this student's real alert scores.
  const scoreBySubject = new Map<string, number>();
  studentAlerts.forEach((a) => { if (a.currentScore != null) scoreBySubject.set(a.subject, a.currentScore); });

  return (
    <HodWorkspaceShell title={(alert as { student: string }).student} eyebrow="Department student profile">
      <HodMetricStrip items={apiSubjects.slice(0, 4).map((subject) => {
        const studentScore = scoreBySubject.get(subject.name);
        return {
          label: subject.name,
          value: studentScore != null ? `${Math.round(studentScore)}%` : `${subject.average}%`,
          detail: studentScore != null ? 'Student score (flagged)' : 'Subject average',
          tone: (studentScore ?? subject.average) < 50 ? 'bg-ks-rose' : 'bg-ks-blue',
          valueColor: (studentScore ?? subject.average) < 50 ? 'text-ks-rose' : (studentScore ?? subject.average) >= 75 ? 'text-ks-emerald' : 'text-ks-amber',
        };
      })} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <StudentSubjectScores scores={studentAlerts} />
        <div className="space-y-gutter">
          {studentAlerts.map((a) => <DepartmentAlertCard key={(a as { id?: string }).id ?? a.subject} alert={a as unknown as Parameters<typeof DepartmentAlertCard>[0]['alert']} />)}
        </div>
      </div>
    </HodWorkspaceShell>
  );
}

// Real per-subject score bars for a flagged student.
function StudentSubjectScores({ scores }: { scores: Array<{ subject: string; currentScore: number | null }> }) {
  const rows = scores.filter((s) => s.currentScore != null);
  return (
    <Card className="overflow-hidden rounded-xl p-5">
      <SectionTitle title="Subject scores" />
      {rows.length === 0 ? (
        <p className="mt-4 text-sm font-semibold text-ks-muted">No recorded subject scores for this student.</p>
      ) : (
        <div className="mt-5 space-y-4">
          {rows.map((s) => {
            const score = Math.round(s.currentScore as number);
            const tone = score < 50 ? 'bg-ks-rose' : score < 65 ? 'bg-ks-amber' : 'bg-ks-emerald';
            return (
              <div key={s.subject} className="flex items-center gap-4">
                <span className="w-28 shrink-0 truncate text-sm font-bold text-ks-navy">{s.subject}</span>
                <div className="flex-1"><ProgressBar value={score} tone={tone} /></div>
                <span className="w-10 shrink-0 text-right text-xs font-black text-ks-muted">{score}%</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Interventions ──────────────────────────────────────────────────────────

export function HodInterventionsPage() {
  const { data: apiInterventions = [] as typeof hodInterventions } = useHodInterventions() as unknown as { data: typeof hodInterventions };
  const uniqueSubjects = [...new Set(apiInterventions.map((i) => i.subject))].length;
  return (
    <HodWorkspaceShell title="Department Interventions" eyebrow="Follow-up tracking">
      <HodMetricStrip items={[
        { label: 'Open follow-ups', value: String(apiInterventions.filter((i) => i.status === 'FOLLOW_UP_REQUIRED' || i.status === 'OPEN' || i.status === 'IN_PROGRESS').length), detail: 'Need action', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Completed', value: String(apiInterventions.filter((i) => i.status === 'COMPLETED').length), detail: 'This term', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Subjects affected', value: String(uniqueSubjects), detail: 'Dept-wide', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Total interventions', value: String(apiInterventions.length), detail: 'All statuses', inverted: true, icon: ShieldCheck },
      ]} />
      <FilterBar items={['All', 'Pending Follow-Up', 'Completed', 'Subject', 'Teacher']} />
      <div className="grid gap-gutter xl:grid-cols-3">
        {apiInterventions.map((item) => <InterventionCard key={item.id} item={item} />)}
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

function useApproval() {
  const { assessmentId } = useParams();
  const { data: apiApprovals = [] as typeof hodApprovals, isLoading } = useHodPendingApprovals() as unknown as { data: typeof hodApprovals; isLoading: boolean };
  return useMemo(
    () => ({ loading: isLoading, approval: isLoading ? null : (apiApprovals.find((a) => a.id === assessmentId) ?? null) }),
    [assessmentId, apiApprovals, isLoading],
  );
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
