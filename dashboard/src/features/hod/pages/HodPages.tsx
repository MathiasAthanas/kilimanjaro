import { ArrowRight, BookOpen, CheckCircle2, Download, Filter, MessageSquarePlus, Save, Send, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { hodMarks, hodSubjects } from '../api/hodApi';
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
  useResolveHodAlertMutation,
  useCreateHodInterventionMutation,
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
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  const sortedApprovals = sortOldestApprovalsFirst(apiApprovals as Parameters<typeof sortOldestApprovalsFirst>[0]);
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
                    {isRisk ? 'Low performing alert' : `${subject.name} Department`}
                  </p>
                  <p className="mt-1 font-display text-2xl font-black text-ks-navy">
                    {subject.average}% {isRisk ? subject.name : 'Average'}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold">
                    {subject.change >= 0 ? (
                      <span className="text-ks-emerald">↑ +{subject.change}% this term</span>
                    ) : isRisk ? (
                      <span className="text-ks-rose">⚠ Action required</span>
                    ) : (
                      <span className="text-ks-amber">≈ Steady performance</span>
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
                    <th className="border-b border-ks-line px-5 py-3.5">Syllabus</th>
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
                        <div className="flex items-center gap-2">
                          <ProgressBar
                            value={subject.syllabus}
                            tone={subject.tone === 'rose' ? 'bg-ks-rose' : subject.tone === 'emerald' ? 'bg-ks-emerald' : 'bg-ks-amber'}
                            className="w-24"
                          />
                          <span className="text-[10px] font-bold text-ks-muted">{subject.syllabus}%</span>
                        </div>
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

          {/* Syllabus Momentum navy chart */}
          <div className="relative overflow-hidden rounded-xl bg-ks-navy p-6 text-white shadow-layer">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
            <div className="relative flex items-start justify-between">
              <div>
                <h4 className="font-display text-xl font-black">Syllabus Momentum</h4>
                <p className="text-sm font-semibold text-ks-mist/60">Completion trajectory — current term</p>
              </div>
              <div className="text-right">
                <p className="font-display text-3xl font-black text-ks-gold">
                  {apiSubjects.length ? `${Math.round(apiSubjects.reduce((s, sub) => s + sub.syllabus, 0) / apiSubjects.length)}%` : '—'}
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-mist/40">Avg syllabus coverage</p>
              </div>
            </div>
            <div className="mt-6 flex items-end gap-1.5" style={{ height: 96 }}>
              {[25, 33, 40, 75, 50, 66, 100].map((height, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t transition-all duration-700 ${i === 3 ? 'bg-ks-gold shadow-lg shadow-ks-gold/20' : 'bg-white/20'}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-bold text-ks-mist/40">
              {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'].map((m) => <span key={m}>{m}</span>)}
            </div>
          </div>
        </section>

        {/* Right: Teacher risks + alert digest */}
        <section className="col-span-12 xl:col-span-3 space-y-gutter">
          <SectionTitle title="Teacher Risks" />
          {apiTeachers.length > 0 ? <TeacherRiskCard teacher={apiTeachers[0] as Parameters<typeof TeacherRiskCard>[0]['teacher']} /> : <p className="text-sm font-semibold text-ks-muted">No teacher data yet.</p>}
          <Card className="rounded-xl border-2 border-dashed border-ks-line p-5">
            <h4 className="flex items-center gap-2 font-display text-base font-black text-ks-navy">
              <span className="text-ks-amber">⚡</span> Alert Digest
            </h4>
            <ul className="mt-4 space-y-4">
              {apiAlerts.map((alert) => (
                <li key={alert.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.severity === 'CRITICAL' ? 'bg-ks-rose' : alert.severity === 'WATCH' ? 'bg-ks-amber' : 'bg-ks-emerald'}`} />
                  <div>
                    <p className="text-sm font-bold text-ks-navy">{alert.student}</p>
                    <p className="text-xs font-semibold text-ks-muted">{alert.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Approvals ─────────────────────────────────────────────────────────────

export function PendingApprovalsPage() {
  const { data: apiApprovals = [] as typeof hodApprovals, isLoading, isError, refetch } = useHodPendingApprovals() as { data: typeof hodApprovals; isLoading: boolean; isError: boolean; refetch: () => void };
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
  const { data: apiMarks = [] as typeof hodMarks } = useMarksApprovalReview(approval?.id ?? '') as { data: typeof hodMarks };
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

          {/* Grade distribution visual */}
          <Card className="rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-black text-ks-navy">Grade Distribution</h3>
              <span className="text-xs font-semibold text-ks-muted">Bell curve mapping</span>
            </div>
            <div className="mt-4 flex items-end gap-1" style={{ height: 80 }}>
              {[
                { grade: 'F', height: 80, color: 'bg-ks-rose/40 hover:bg-ks-rose/60' },
                { grade: 'D', height: 40, color: 'bg-ks-amber/40 hover:bg-ks-amber/60' },
                { grade: 'C', height: 25, color: 'bg-ks-sky/40 hover:bg-ks-sky/60' },
                { grade: 'B', height: 15, color: 'bg-ks-blue/40 hover:bg-ks-blue/60' },
                { grade: 'A', height: 10, color: 'bg-ks-emerald/40 hover:bg-ks-emerald/60' },
              ].map((bar) => (
                <div key={bar.grade} className={`flex-1 cursor-help rounded-t transition-all ${bar.color}`} style={{ height: `${bar.height}%` }} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-black text-ks-muted">
              {['F', 'D', 'C', 'B', 'A'].map((g) => <span key={g}>{g}</span>)}
            </div>
            <div className="mt-4 space-y-2">
              {[['A', 28, 'bg-ks-emerald'], ['B', 42, 'bg-ks-blue'], ['C', 19, 'bg-ks-amber'], ['D/F', 10, 'bg-ks-rose']].map(([grade, value, tone]) => (
                <div key={grade as string}>
                  <div className="mb-1 flex justify-between text-xs font-black text-ks-muted">
                    <span>{grade}</span><span>{value}%</span>
                  </div>
                  <ProgressBar value={value as number} tone={tone as string} />
                </div>
              ))}
            </div>
          </Card>

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
  const { data: apiSubjects = [] as typeof hodSubjects, isLoading } = useHodClassSubjects() as { data: typeof hodSubjects; isLoading: boolean };
  const riskSubject = apiSubjects.find((s) => s.tone === 'rose') ?? apiSubjects[0] ?? null;
  const avgSyllabus = apiSubjects.length ? Math.round(apiSubjects.reduce((s, sub) => s + sub.syllabus, 0) / apiSubjects.length) : 0;
  const totalAtRisk = apiSubjects.reduce((s, sub) => s + sub.atRisk, 0);
  const bestSubject = [...apiSubjects].sort((a, b) => b.change - a.change)[0] ?? null;
  return (
    <HodWorkspaceShell title="Department Overview" eyebrow="Subjects performance overview">
      {riskSubject && <SubjectTabs active={riskSubject.id} />}
      <HodMetricStrip items={[
        { label: riskSubject ? `${riskSubject.name} avg` : 'Lowest subject', value: riskSubject ? `${riskSubject.average}%` : '—', detail: riskSubject ? 'Weakest subject' : 'No data yet', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'At-risk students', value: isLoading ? '—' : String(totalAtRisk), detail: 'Department total', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Syllabus coverage', value: isLoading ? '—' : `${avgSyllabus}%`, detail: 'Dept average', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Best improvement', value: bestSubject ? `${bestSubject.change > 0 ? '+' : ''}${bestSubject.change}%` : '—', detail: bestSubject?.name ?? 'N/A', inverted: true, icon: ShieldCheck },
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
  const subjectTeacher = (apiTeachers as Array<Parameters<typeof TeacherRiskCard>[0]['teacher']>).find((t) => t.name === subject.teacher) ?? null;

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
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as { data: typeof hodTeachers };
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
  const { data: apiAlerts = [] as typeof hodAlerts } = useHodAlerts() as { data: typeof hodAlerts };
  const critical = apiAlerts.filter((a) => a.severity === 'CRITICAL');
  const watch = apiAlerts.filter((a) => a.severity === 'WATCH');
  const improving = apiAlerts.filter((a) => a.severity === 'IMPROVING');
  return (
    <HodWorkspaceShell title="Department Performance Alerts" eyebrow="Escalation and resolution">
      <HodMetricStrip items={[
        { label: 'Critical', value: String(critical.length).padStart(2, '0'), detail: critical[0] ? `${critical[0].student} ${critical[0].subject}` : '—', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Watch', value: String(watch.length).padStart(2, '0'), detail: watch[0] ? `${watch[0].student} practical` : '—', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Improving', value: String(improving.length).padStart(2, '0'), detail: 'Peer support results', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Escalations', value: '00', detail: 'No principal escalations', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-3">
        {apiAlerts.map((alert) => <DepartmentAlertCard key={alert.id} alert={alert} />)}
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Peer pairings ──────────────────────────────────────────────────────────

export function DepartmentPairingsPage() {
  const { data: apiPairings = [] as typeof hodPairings } = useHodPairings() as { data: typeof hodPairings };
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
        { label: 'Effectiveness', value: '78%', detail: 'Avg grade lift', inverted: true, icon: ShieldCheck },
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
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  const alert = (apiAlerts as Array<{ studentId: string; student: string }>).find((item) => item.studentId === studentId) ?? null;
  const trendData = [72, 68, 64, 58, 55, 52];

  if (isLoading) return <HodWorkspaceShell title="Loading…" eyebrow="Department student profile"><SkeletonTable cols={4} /></HodWorkspaceShell>;
  if (!alert) return <HodWorkspaceShell title="Student Not Found" eyebrow="Department student profile"><EmptyState title="Student not found" description="No alert record for this student." /></HodWorkspaceShell>;

  return (
    <HodWorkspaceShell title={(alert as { student: string }).student} eyebrow="Department student profile">
      <HodMetricStrip items={apiSubjects.map((subject) => ({
        label: subject.name,
        value: `${subject.average}%`,
        detail: subject.name === (alert as { subject: string }).subject ? 'Linked alert subject' : 'Department subject',
        tone: subject.tone === 'rose' ? 'bg-ks-rose' : 'bg-ks-blue',
        valueColor: subject.tone === 'rose' ? 'text-ks-rose' : subject.average >= 75 ? 'text-ks-emerald' : 'text-ks-amber',
      }))} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <TrendBoardFull trendData={trendData} />
        <DepartmentAlertCard alert={alert} />
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Interventions ──────────────────────────────────────────────────────────

export function HodInterventionsPage() {
  const { data: apiInterventions = [] as typeof hodInterventions } = useHodInterventions() as { data: typeof hodInterventions };
  const uniqueSubjects = [...new Set(apiInterventions.map((i) => i.subject))].length;
  return (
    <HodWorkspaceShell title="Department Interventions" eyebrow="Follow-up tracking">
      <HodMetricStrip items={[
        { label: 'Open follow-ups', value: String(apiInterventions.filter((i) => i.status === 'FOLLOW_UP_REQUIRED').length), detail: 'Need action', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Completed', value: String(apiInterventions.filter((i) => i.status === 'COMPLETED').length), detail: 'This term', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Subjects affected', value: String(uniqueSubjects), detail: 'Dept-wide', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Success rate', value: '68%', detail: 'Grade improvement', inverted: true, icon: ShieldCheck },
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

const hodExportItems: Array<{ title: string; description: string; format: string; reportType: string }> = [
  { title: 'Pending approval queue', description: 'All submissions awaiting HOD review, sorted by age.', format: 'CSV', reportType: 'hod-pending-approvals' },
  { title: 'Approval history', description: 'Complete decision audit with approvals and rejections.', format: 'PDF', reportType: 'hod-approval-history' },
  { title: 'Subject analytics', description: 'Per-subject averages, trends, and syllabus coverage.', format: 'PDF', reportType: 'hod-subject-analytics' },
  { title: 'Teacher performance', description: 'On-time submission rates and class averages per teacher.', format: 'PDF', reportType: 'hod-teacher-performance' },
  { title: 'At-risk students', description: 'Students flagged by the AQA engine across all subjects.', format: 'CSV', reportType: 'hod-at-risk-students' },
  { title: 'Intervention log', description: 'All interventions with follow-up status and outcomes.', format: 'CSV', reportType: 'hod-interventions' },
  { title: 'Academic audit report', description: 'Complete departmental audit trail for governance review.', format: 'PDF', reportType: 'hod-audit-report' },
];

export function HodExportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const generateMutation = useGenerateReportMutation();

  const handleGenerate = async (item: typeof hodExportItems[0]) => {
    setGenerating(item.title);
    toast(`Generating "${item.title}"…`, 'info');
    try {
      const result = await generateMutation.mutateAsync({ type: item.reportType, format: item.format.toLowerCase() }) as Record<string, unknown> | undefined;
      const jobId = String(result?.id ?? result?.jobId ?? '');
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

function DepartmentMatrixTable({ subjectId }: { subjectId?: string } = {}) {
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  const rows = subjectId ? apiSubjects.filter((subject) => subject.id === subjectId) : apiSubjects;
  return (
    <HodTable columns={['Subject', 'Teacher', 'Average', 'Change', 'At-risk', 'Syllabus', 'Alerts', 'Actions']}>
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
            <span className={`font-bold ${subject.change > 0 ? 'text-ks-emerald' : 'text-ks-rose'}`}>
              {subject.change > 0 ? '+' : ''}{subject.change}%
            </span>
          </Td>
          <Td>
            <span className={`font-bold ${subject.atRisk > 3 ? 'text-ks-rose' : 'text-ks-slate'}`}>{subject.atRisk}</span>
          </Td>
          <Td>
            <div className="flex items-center gap-2">
              <ProgressBar value={subject.syllabus} tone={subject.tone === 'rose' ? 'bg-ks-rose' : 'bg-ks-emerald'} className="w-20" />
              <span className="text-xs font-bold text-ks-muted">{subject.syllabus}%</span>
            </div>
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
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as { data: typeof hodTeachers };
  return (
    <HodTable columns={['Teacher', 'Subjects / Classes', 'Average', 'On-time', 'Syllabus', 'At-risk', 'Pending', 'Rejections', 'Actions']}>
      {apiTeachers.map((teacher) => {
        const risk = teacher.onTime < 60;
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
            <Td>{teacher.subjects}</Td>
            <Td><span className={`font-black ${teacher.average >= 75 ? 'text-ks-emerald' : teacher.average >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>{teacher.average}%</span></Td>
            <Td><span className={`font-black ${risk ? 'text-ks-rose' : 'text-ks-emerald'}`}>{teacher.onTime}%</span></Td>
            <Td>
              <div className="flex items-center gap-2">
                <ProgressBar value={teacher.syllabus} tone={teacher.syllabus < 60 ? 'bg-ks-rose' : 'bg-ks-blue'} className="w-16" />
                <span className="text-xs text-ks-muted">{teacher.syllabus}%</span>
              </div>
            </Td>
            <Td><span className={teacher.atRisk > 3 ? 'font-bold text-ks-rose' : 'text-ks-slate'}>{teacher.atRisk}</span></Td>
            <Td><span className={teacher.pending > 0 ? 'font-bold text-ks-amber' : 'text-ks-slate'}>{teacher.pending}</span></Td>
            <Td>{teacher.rejections}</Td>
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
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as { data: typeof hodTeachers };
  return (
    <Card className="rounded-xl p-5">
      <SectionTitle title="Teacher Submission Matrix" />
      <div className="mt-4 space-y-4">
        {apiTeachers.map((teacher) => (
          <div key={teacher.id} className="flex items-center gap-4">
            <span className={`w-36 shrink-0 text-sm font-bold ${teacher.onTime < 60 ? 'text-ks-rose' : 'text-ks-navy'}`}>
              {teacher.name.split(' ')[1] ?? teacher.name}
            </span>
            <div className="flex-1">
              <ProgressBar value={teacher.onTime} tone={teacher.onTime < 60 ? 'bg-ks-rose' : 'bg-ks-emerald'} />
            </div>
            <span className="w-10 shrink-0 text-right text-xs font-black text-ks-muted">{teacher.onTime}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NavyInsightPanel() {
  const insights = [
    { tone: 'bg-ks-gold', date: 'May 2026', text: 'Physics Form 4 completed syllabus two weeks early — strong teacher-led execution.' },
    { tone: 'bg-ks-sky', date: 'May 2026', text: 'Biology practical moderation remains stable across all form groups.' },
    { tone: 'bg-ks-rose', date: 'April 2026', text: 'Chemistry Form 3B mid-terms showed 15% decrease in mean scores.' },
  ];
  return (
    <Card className="overflow-hidden rounded-xl bg-ks-navy p-6 text-white">
      <h3 className="font-display text-xl font-black">Academic Insight Timeline</h3>
      <div className="mt-5 space-y-5 border-l border-ks-mist/20 pl-5">
        {insights.map((insight) => (
          <div key={insight.text} className="relative">
            <span className={`absolute -left-[27px] top-0 h-4 w-4 rounded-full border-4 border-ks-navy ${insight.tone}`} />
            <p className="text-[10px] font-black uppercase tracking-wider text-ks-gold">{insight.date}</p>
            <p className="mt-1 text-sm font-semibold text-ks-mist/75">{insight.text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TrendBoard({ subject }: { subject: ReturnType<typeof useSubject> }) {
  const tones = { rose: '#F43F5E', emerald: '#10B981', amber: '#F59E0B', blue: '#0284C7' };
  const color = tones[subject.tone] ?? tones.blue;
  const data = [82, 78, 72, 65, 60, subject.average];
  const max = 100; const min = 40; const range = max - min;
  const w = 300; const h = 80;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`);
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`;
  return (
    <Card className="overflow-hidden rounded-xl p-5">
      <SectionTitle title="Performance trend" />
      <div className="mt-5 rounded-xl bg-ks-paper p-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
          <defs>
            <linearGradient id="hodTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.2" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, h / 3, (2 * h) / 3].map((y) => (
            <line key={y} x1="0" y1={y} x2={w} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
          ))}
          <polygon points={area} fill="url(#hodTrendFill)" />
          <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {data.map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 8) - 4;
            return <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="mt-1 flex justify-between text-[10px] font-bold text-ks-muted">
          {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
    </Card>
  );
}

function TrendBoardFull({ trendData }: { trendData: number[] }) {
  const color = '#F43F5E';
  const max = 100; const min = 40; const range = max - min;
  const w = 400; const h = 100;
  const pts = trendData.map((v, i) => `${(i / (trendData.length - 1)) * w},${h - ((v - min) / range) * (h - 8) - 4}`);
  const area = `${pts.join(' ')} ${w},${h} 0,${h}`;
  return (
    <Card className="overflow-hidden rounded-xl p-5">
      <SectionTitle title="Student score trend" />
      <div className="mt-5 rounded-xl bg-[linear-gradient(180deg,#fff5f7,#fff)] p-4">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible">
          <defs>
            <linearGradient id="studentTrendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#studentTrendFill)" />
          <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {trendData.map((v, i) => {
            const x = (i / (trendData.length - 1)) * w;
            const y = h - ((v - min) / range) * (h - 8) - 4;
            return <circle key={i} cx={x} cy={y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-ks-muted">
          {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => <span key={m}>{m}</span>)}
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-ks-rose/20 bg-ks-rose/5 p-3 text-center text-xs font-bold text-ks-rose">
        ↓ Declining trend detected — 20-point drop over 6 assessments
      </div>
    </Card>
  );
}

function SubmissionTimeline() {
  const nodes = ['On time', 'Late', 'Pending', 'Rejected', 'On time', 'Pending'] as const;
  const nodeColor = (node: string) =>
    node === 'Rejected' ? 'bg-ks-rose' : node === 'Pending' ? 'bg-ks-amber' : node === 'Late' ? 'bg-ks-gold' : 'bg-ks-emerald';
  return (
    <Card className="rounded-xl p-5">
      <SectionTitle title="Submission timeline" />
      <div className="mt-6 flex items-center gap-3 overflow-x-auto pb-2">
        {nodes.map((node, index) => (
          <div key={`${node}-${index}`} className="flex min-w-24 flex-col items-center">
            <div className={`h-5 w-5 rounded-full border-4 border-white shadow ${nodeColor(node)}`} />
            <p className="mt-2 text-center text-xs font-black uppercase text-ks-muted">{node}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SubjectTabs({ active }: { active: string }) {
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  return (
    <Card className="flex w-fit flex-wrap gap-1 rounded-xl bg-ks-line/30 p-1">
      {apiSubjects.map((subject) => (
        <NavLink
          key={subject.id}
          to={`/hod/department/subjects/${subject.id}`}
          className={`rounded-lg px-5 py-2 text-sm font-black transition ${
            active === subject.id
              ? subject.id === 'chemistry'
                ? 'bg-ks-rose text-white shadow-md'
                : 'bg-white text-ks-navy shadow-sm'
              : 'text-ks-muted hover:bg-white'
          }`}
        >
          {subject.name}{subject.id === 'chemistry' ? ' (Risk)' : ''}
        </NavLink>
      ))}
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

function HodFormPage({ title, eyebrow, fields, preview }: { title: string; eyebrow: string; fields: string[]; preview: string }) {
  return (
    <HodWorkspaceShell title={title} eyebrow={eyebrow}>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-xl p-5">
          <div className="flex items-center gap-3">
            <MessageSquarePlus className="h-5 w-5 text-ks-blue" />
            <SectionTitle title={title} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">{field}</span>
                <input className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" />
              </label>
            ))}
          </div>
          <Button className="mt-5 rounded-xl">
            <Send className="h-4 w-4" /> Publish announcement
          </Button>
        </Card>
        <Card className="sticky top-24 h-fit rounded-xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Preview</p>
          <p className="mt-3 rounded-xl bg-ks-paper p-4 text-sm font-semibold leading-7 text-ks-slate">{preview}</p>
        </Card>
      </div>
    </HodWorkspaceShell>
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
  const { data: apiApprovals = [] as typeof hodApprovals, isLoading } = useHodPendingApprovals() as { data: typeof hodApprovals; isLoading: boolean };
  return useMemo(
    () => ({ loading: isLoading, approval: isLoading ? null : (apiApprovals.find((a) => a.id === assessmentId) ?? null) }),
    [assessmentId, apiApprovals, isLoading],
  );
}

function useSubject() {
  const { subjectId } = useParams();
  const { data: apiSubjects = [] as typeof hodSubjects, isLoading } = useHodClassSubjects() as { data: typeof hodSubjects; isLoading: boolean };
  return useMemo(
    () => ({ loading: isLoading, subject: isLoading ? null : (apiSubjects.find((s) => s.id === subjectId) ?? null) }),
    [subjectId, apiSubjects, isLoading],
  );
}

function useTeacher() {
  const { teacherId } = useParams();
  const { data: apiTeachers = [] as typeof hodTeachers, isLoading } = useHodTeachersList() as { data: typeof hodTeachers; isLoading: boolean };
  return useMemo(
    () => ({ loading: isLoading, teacher: isLoading ? null : (apiTeachers.find((t) => t.id === teacherId) ?? null) }),
    [teacherId, apiTeachers, isLoading],
  );
}
