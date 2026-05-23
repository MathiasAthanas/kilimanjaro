import { ArrowRight, BookOpen, CheckCircle2, Download, Filter, MessageSquarePlus, Save, Send, ShieldCheck, TrendingUp, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { hodAlerts, hodApprovals, hodInterventions, hodMarks, hodPairings, hodSubjects, hodTeachers } from '../api/hodApi';
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
  const { data: apiApprovals = [] as typeof hodApprovals } = useHodPendingApprovals() as { data: typeof hodApprovals };
  const { data: apiAlerts = [] as typeof hodAlerts } = useHodAlerts() as { data: typeof hodAlerts };
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as { data: typeof hodTeachers };
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  const sortedApprovals = sortOldestApprovalsFirst(apiApprovals);
  const firstApproval = sortedApprovals[0] ?? sortOldestApprovalsFirst(hodApprovals)[0];
  return (
    <HodWorkspaceShell
      title="Sciences Command Center"
      eyebrow="HOD academic control room"
      action={
        <NavLink to={`/hod/approvals/${firstApproval.id}`}>
          <Button className="bg-ks-gold text-ks-navy hover:shadow-md hover:shadow-ks-gold/30">
            Review Oldest Approval
          </Button>
        </NavLink>
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
                <p className="font-display text-3xl font-black text-ks-gold">+12.4%</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-mist/40">Aggregated delta</p>
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
          <TeacherRiskCard teacher={apiTeachers[0] ?? hodTeachers[0]} />
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
  const { data: apiApprovals = [] as typeof hodApprovals } = useHodPendingApprovals() as { data: typeof hodApprovals };
  const sorted = sortOldestApprovalsFirst(apiApprovals);
  const oldest = sorted[0] ?? hodApprovals[0];
  return (
    <HodWorkspaceShell title="Pending Approvals" eyebrow="Oldest submissions first">
      <HodMetricStrip items={[
        { label: 'Total pending', value: String(apiApprovals.length).padStart(2, '0'), detail: '-2 from yesterday', tone: 'bg-ks-navy', valueColor: 'text-ks-navy' },
        { label: 'Oldest submission', value: `${oldest.submittedHoursAgo}h`, detail: `${oldest.subject} ${oldest.className}`, tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Risk alerts', value: String(apiApprovals.filter((a) => a.average < 60).length).padStart(2, '0'), detail: 'Requires manual review', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Avg. grade', value: `${Math.round(apiApprovals.reduce((s, a) => s + a.average, 0) / Math.max(apiApprovals.length, 1))}%`, detail: '↑ 4% positive trend', inverted: true, icon: ShieldCheck },
      ]} />
      <Card className="overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line bg-ks-paper/50 px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-black text-ks-navy">Approval Queue</h2>
            <p className="text-sm font-semibold text-ks-muted">Review and authorise assessments submitted in the last 72 hours.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="rounded-xl py-2 text-xs">
              <Filter className="h-3.5 w-3.5" /> Filter
            </Button>
            <Button className="rounded-xl py-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" /> Quick Approve All
            </Button>
          </div>
        </div>
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
        <div className="flex items-center justify-between border-t border-ks-line bg-ks-paper/30 px-5 py-3">
          <p className="text-xs font-bold italic text-ks-muted">Sorted by submission age · oldest first</p>
          <div className="flex gap-1">
            <button className="rounded-lg border border-ks-line px-2 py-1 text-xs font-bold text-ks-muted hover:bg-ks-paper">‹</button>
            <button className="rounded-lg border border-ks-line px-2 py-1 text-xs font-bold text-ks-muted hover:bg-ks-paper">›</button>
          </div>
        </div>
      </Card>
    </HodWorkspaceShell>
  );
}

// ─── Approval review ────────────────────────────────────────────────────────

export function MarksApprovalReviewPage() {
  const approval = useApproval();
  const { data: apiMarks = [] as typeof hodMarks } = useMarksApprovalReview(approval.id) as { data: typeof hodMarks };
  const [reason, setReason] = useState('');
  const teacherInitials = approval.teacher.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
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
              <StatCell label="Outliers" value="2" tone="text-ks-amber" />
              <StatCell label="Absent" value="1" />
              <StatCell label="Std dev" value="18.4" />
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
              disabled={!rejectReasonIsValid(reason)}
              className="mt-3 rounded-xl"
            >
              Confirm Rejection
            </Button>
          </Card>
        </section>

        {/* Right pane: marks table + sticky decision bar */}
        <section className="min-w-0 space-y-stack-lg">
          <MarksReviewTable marks={apiMarks} average={approval.average} />
          <Card className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border-ks-navy bg-white p-4 shadow-layer">
            <p className="text-sm font-semibold text-ks-muted">
              <b className="text-ks-navy">Decision:</b> Dr. James Kileo will update student academic records after approval.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" className="rounded-xl">
                <XCircle className="h-4 w-4" /> Reject
              </Button>
              <Button variant="success" className="rounded-xl">
                <CheckCircle2 className="h-4 w-4" /> Approve & Finalise
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
  const { data: apiApprovals = [] as typeof hodApprovals } = useHodApprovalHistory() as { data: typeof hodApprovals };
  return (
    <HodWorkspaceShell title="Approval History" eyebrow="Academic decision audit">
      <FilterBar items={['Date range', 'Subject', 'Teacher', 'Approved', 'Rejected']} />
      <HodTable columns={['Decision date', 'Assessment', 'Subject', 'Class', 'Teacher', 'Decision', 'Reason', 'Decided by', 'Average', 'Export']}>
        {[...apiApprovals].reverse().map((approval, index) => (
          <tr key={approval.id} className="hover:bg-ks-paper">
            <Td>May {18 - index}</Td>
            <Td>{approval.assessment}</Td>
            <Td>{approval.subject}</Td>
            <Td>{approval.className}</Td>
            <Td>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-[10px] font-black text-ks-blue">
                  {approval.teacher.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <span>{approval.teacher}</span>
              </div>
            </Td>
            <Td>
              <Badge tone={index === 0 ? 'rose' : 'emerald'}>{index === 0 ? 'REJECTED' : 'APPROVED'}</Badge>
            </Td>
            <Td>{index === 0 ? 'Outlier correction required' : 'Clean distribution'}</Td>
            <Td>Dr. Kileo</Td>
            <Td>
              <span className={`font-black ${approval.average >= 75 ? 'text-ks-emerald' : approval.average >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>
                {approval.average}%
              </span>
            </Td>
            <Td>
              <Button variant="secondary" className="rounded-xl py-1.5 text-xs">Export</Button>
            </Td>
          </tr>
        ))}
      </HodTable>
    </HodWorkspaceShell>
  );
}

// ─── Department overview ────────────────────────────────────────────────────

export function DepartmentOverviewPage() {
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  const riskSubject = apiSubjects.find((s) => s.tone === 'rose') ?? apiSubjects[0] ?? hodSubjects[0];
  return (
    <HodWorkspaceShell title="Department Overview" eyebrow="Biology, Chemistry, Physics">
      <SubjectTabs active={riskSubject.id} />
      <HodMetricStrip items={[
        { label: `${riskSubject.name} risk`, value: `${riskSubject.average}%`, detail: 'Weakest subject', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'At-risk students', value: String(apiSubjects.reduce((s, sub) => s + sub.atRisk, 0)), detail: 'Department total', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Syllabus coverage', value: `${Math.round(apiSubjects.reduce((s, sub) => s + sub.syllabus, 0) / Math.max(apiSubjects.length, 1))}%`, detail: 'Dept average', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Physics improvement', value: '+6.5%', detail: 'Strong trend', inverted: true, icon: ShieldCheck },
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
  const subject = useSubject();
  const { data: apiAlerts = [] as typeof hodAlerts } = useHodAlerts() as { data: typeof hodAlerts };
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as { data: typeof hodTeachers };
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
          <TeacherRiskCard teacher={apiTeachers.find((teacher) => teacher.name === subject.teacher) ?? apiTeachers[0] ?? hodTeachers[0]} />
          <Card className="rounded-xl p-5">
            <SectionTitle title="At-risk students" />
            <div className="mt-4 space-y-3">
              {apiAlerts.filter((alert) => alert.subject === subject.name).map((alert) => (
                <DepartmentAlertCard key={alert.id} alert={alert} />
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
  return (
    <HodWorkspaceShell title="Teacher Performance Matrix" eyebrow="Respectful accountability">
      <HodMetricStrip items={[
        { label: 'On-time rate', value: `${Math.round(apiTeachers.reduce((s, t) => s + t.onTime, 0) / Math.max(apiTeachers.length, 1))}%`, detail: 'Dept avg submissions', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Below target', value: String(apiTeachers.filter((t) => t.average < 60).length).padStart(2, '0'), detail: 'Below 60% avg', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Pending review', value: String(apiTeachers.reduce((sum, t) => sum + t.pending, 0)).padStart(2, '0'), detail: 'Across dept', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Top performer', value: '+18%', detail: 'Physics improvement', inverted: true, icon: TrendingUp },
      ]} />
      <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-rose bg-ks-rose/5 p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-rose">Attention required</p>
        <h2 className="mt-2 font-display text-2xl font-black text-ks-navy">Amina Rashidi requires Chemistry support review</h2>
        <p className="mt-2 text-sm font-semibold text-ks-muted">Chemistry Form 3B is below target and submission punctuality is 42%.</p>
      </Card>
      <TeachersTable />
    </HodWorkspaceShell>
  );
}

// ─── Teacher detail ─────────────────────────────────────────────────────────

export function TeacherDetailPage() {
  const teacher = useTeacher();
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
  return (
    <HodWorkspaceShell title="Department Peer Pairings" eyebrow="Bulk activation surface">
      <HodMetricStrip items={[
        { label: 'Suggested', value: String(apiPairings.filter((p) => p.status === 'SUGGESTED').length), detail: 'Awaiting action', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Active', value: String(apiPairings.filter((p) => p.status === 'ACTIVE').length), detail: 'Current support', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Completed', value: String(apiPairings.filter((p) => p.status === 'COMPLETED').length), detail: 'This term', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'Effectiveness', value: '78%', detail: 'Avg grade lift', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-gutter">
          {apiPairings.map((pairing) => <PairingReviewCard key={pairing.id} pairing={pairing} />)}
        </section>
        <ActionPanel title="Bulk action" actions={['Activate all Chemistry Form 3B', 'Reject selected pairings', 'Export pairing review']} />
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Student performance (HOD view) ─────────────────────────────────────────

export function HodStudentPerformancePage() {
  const { studentId } = useParams();
  const { data: apiAlerts = [] as typeof hodAlerts } = useHodAlerts() as { data: typeof hodAlerts };
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  const alert = apiAlerts.find((item) => item.studentId === studentId) ?? apiAlerts[0] ?? hodAlerts[0];
  const trendData = [72, 68, 64, 58, 55, 52];
  return (
    <HodWorkspaceShell title={alert.student} eyebrow="Department student profile">
      <HodMetricStrip items={apiSubjects.map((subject) => ({
        label: subject.name,
        value: `${subject.average}%`,
        detail: subject.name === alert.subject ? 'Linked alert subject' : 'Department subject',
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
  const { data: apiAnnouncements = [] } = useHodAnnouncements() as { data: Array<{ id: string; body?: string; title?: string; audience?: string; targetRoles?: string[] }> };
  const fallbackAnnouncements = [
    { id: 'f1', body: 'Chemistry record book audit is scheduled for this Friday. All Chemistry teachers must submit their records by Thursday 5 PM.', audience: 'Teachers + Classes', tone: 'blue' as const },
    { id: 'f2', body: 'Physics syllabus completion review has been moved to Monday. Please ensure all coverage entries are updated before then.', audience: 'Physics Teachers', tone: 'amber' as const },
    { id: 'f3', body: 'Biology practical moderation starts next week. HOD will conduct observations during lessons.', audience: 'Biology Teachers', tone: 'emerald' as const },
  ];
  const displayAnnouncements = apiAnnouncements.length > 0
    ? apiAnnouncements.map((a) => ({ id: a.id, body: a.body ?? a.title ?? '', audience: a.audience ?? (a.targetRoles ?? []).join(', ') ?? 'All staff', tone: 'blue' as const }))
    : fallbackAnnouncements;
  return (
    <HodWorkspaceShell title="HOD Announcements" eyebrow="Department communication">
      <Card className="rounded-xl p-5">
        <SectionTitle title="Department announcements" action="/hod/announcements/create" />
        <div className="mt-4 grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {displayAnnouncements.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 rounded-xl p-4 transition hover:-translate-y-0.5 hover:shadow-layer">
              <p className="flex-1 text-sm font-semibold leading-6 text-ks-slate">{item.body}</p>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={item.tone}>{item.audience}</Badge>
                <button className="text-xs font-black text-ks-blue hover:underline">Edit</button>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </HodWorkspaceShell>
  );
}

export function CreateHodAnnouncementPage() {
  return (
    <HodFormPage
      title="Create Department Announcement"
      eyebrow="Teacher and class audience"
      fields={['Title', 'Body', 'Priority', 'Audience roles', 'Department classes', 'Subject targets', 'Schedule']}
      preview="Department announcement preview for science teachers and selected classes. Recipients: All Sciences teachers + selected form classes."
    />
  );
}

// ─── Exports ────────────────────────────────────────────────────────────────

const exportItems = [
  { title: 'Pending approval queue', description: 'All submissions awaiting HOD review, sorted by age.', format: 'CSV' },
  { title: 'Approval history', description: 'Complete decision audit with approvals and rejections.', format: 'PDF' },
  { title: 'Subject analytics', description: 'Per-subject averages, trends, and syllabus coverage.', format: 'PDF' },
  { title: 'Teacher performance', description: 'On-time submission rates and class averages per teacher.', format: 'PDF' },
  { title: 'At-risk students', description: 'Students flagged by the AQA engine across all subjects.', format: 'CSV' },
  { title: 'Intervention log', description: 'All interventions with follow-up status and outcomes.', format: 'CSV' },
  { title: 'Academic audit report', description: 'Complete departmental audit trail for governance review.', format: 'PDF' },
];

export function HodExportsPage() {
  return (
    <HodWorkspaceShell title="HOD Export Center" eyebrow="Department reports">
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {exportItems.map((item) => (
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
            <Button variant="secondary" className="mt-4 w-full rounded-xl">
              <Save className="h-4 w-4" /> Generate
            </Button>
          </Card>
        ))}
      </div>
    </HodWorkspaceShell>
  );
}

// ─── Audit trail ───────────────────────────────────────────────────────────

export function HodAuditPage() {
  const { data: auditData = [] } = useHodAudit() as { data: Array<{ id: string; date?: string; createdAt?: string; actor?: string; decision?: string; entity?: string; reason?: string; action?: string }> };
  const toneMap = ['bg-ks-sky', 'bg-ks-rose', 'bg-ks-amber', 'bg-ks-gold', 'bg-ks-emerald'];
  const events = auditData.length > 0
    ? auditData.map((e, i) => ({
        text: `${e.decision ?? e.action ?? 'Action'} — ${e.entity ?? ''}${e.reason ? `: ${e.reason}` : ''}`,
        tone: toneMap[i % toneMap.length],
        date: e.date ?? e.createdAt ?? '',
        actor: e.actor ?? 'System',
        id: e.id,
      }))
    : [
        { id: '1', text: 'Assessment submitted by Amina Rashidi — Chemistry Form 3B Mid-Term', tone: 'bg-ks-sky', date: 'May 20, 2026', actor: 'Dr. James Kileo' },
        { id: '2', text: 'HOD reviewed Chemistry Mid-Term outliers and flagged 2 students', tone: 'bg-ks-rose', date: 'May 19, 2026', actor: 'Dr. James Kileo' },
        { id: '3', text: 'Intervention created for Jabir Hassan — Chemistry catch-up plan', tone: 'bg-ks-amber', date: 'May 18, 2026', actor: 'Dr. James Kileo' },
        { id: '4', text: 'Peer pairing activated for Chemistry Form 3B — Joel mentoring Said', tone: 'bg-ks-gold', date: 'May 17, 2026', actor: 'Dr. James Kileo' },
        { id: '5', text: 'Department announcement published to Sciences teachers', tone: 'bg-ks-emerald', date: 'May 16, 2026', actor: 'Dr. James Kileo' },
      ];
  return (
    <HodWorkspaceShell title="Department Academic Audit Trail" eyebrow="Decision history">
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

function ActionPanel({ title, actions }: { title: string; actions: string[] }) {
  return (
    <Card className="sticky top-24 h-fit rounded-xl border-l-4 border-l-ks-blue p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">{title}</p>
      <div className="mt-4 space-y-2">
        {actions.map((action) => (
          <Button
            key={action}
            variant={action.toLowerCase().includes('reject') ? 'danger' : 'secondary'}
            className="w-full justify-between rounded-xl"
          >
            {action}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ))}
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
  const { data: apiApprovals = [] as typeof hodApprovals } = useHodPendingApprovals() as { data: typeof hodApprovals };
  return useMemo(
    () => apiApprovals.find((approval) => approval.id === assessmentId) ?? apiApprovals[0] ?? hodApprovals[0],
    [assessmentId, apiApprovals],
  );
}

function useSubject() {
  const { subjectId } = useParams();
  const { data: apiSubjects = [] as typeof hodSubjects } = useHodClassSubjects() as { data: typeof hodSubjects };
  return useMemo(
    () => apiSubjects.find((subject) => subject.id === subjectId) ?? apiSubjects[0] ?? hodSubjects[0],
    [subjectId, apiSubjects],
  );
}

function useTeacher() {
  const { teacherId } = useParams();
  const { data: apiTeachers = [] as typeof hodTeachers } = useHodTeachersList() as { data: typeof hodTeachers };
  return useMemo(
    () => apiTeachers.find((teacher) => teacher.id === teacherId) ?? apiTeachers[0] ?? hodTeachers[0],
    [teacherId, apiTeachers],
  );
}
