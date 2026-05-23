import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BookOpen,
  Download,
  GraduationCap,
  Lock,
  Megaphone,
  Plus,
  Send,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  disciplineIncidents,
  markRows,
  paymentApprovals,
  principalAssessments,
  principalAudit,
  principalStudents,
  publishClasses,
  schoolHealth,
  staffMembers,
} from '../api/principalApi';
import {
  usePendingMarkApprovals,
  useMarksForApproval,
  usePublishReadiness,
  usePrincipalPendingPayments,
  usePrincipalDiscipline,
  usePrincipalStudents,
  usePrincipalStaff,
  usePrincipalAudit,
  usePrincipalAnnouncements,
  usePrincipalSchoolHealth,
  usePrincipalSchoolSettings,
} from '../api/principal.hooks';
import {
  AnnouncementCard,
  DecisionAuditTimeline,
  DisciplineSeverityBar,
  ExecutiveBarChart,
  ExecutiveLineChart,
  ExecutiveMetricGrid,
  ExecutiveTable,
  ExpandableIncident,
  FancyReportTile,
  FinalLockPanel,
  IconPanel,
  IntelligencePanel,
  MarksFinalApprovalTable,
  PaymentApprovalCard,
  PrincipalActionCard,
  PrincipalBreadcrumb,
  PrincipalWorkspaceShell,
  PublishResultsFlow,
  SchoolHealthScore,
  SchoolSettingsSection,
  Td,
} from '../components/PrincipalWorkspaceShell';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';

const money = (n: number) => `TZS ${n.toLocaleString('en-US')}`;

// Zero-value school health — shown before data loads (no fake scores)
const EMPTY_HEALTH: typeof schoolHealth = { score: 0, academic: 0, finance: 0, operations: 0, trend: 0 };

// ─── Home dashboard ───────────────────────────────────────────────────────────

export function PrincipalHomePage() {
  const { data: apiHealth = EMPTY_HEALTH } = usePrincipalSchoolHealth() as { data: typeof schoolHealth };
  const { data: apiAudit = [] as typeof principalAudit } = usePrincipalAudit() as { data: typeof principalAudit };
  return (
    <PrincipalWorkspaceShell title="Executive Decision Room" eyebrow="Principal command center">
      {/* Critical alert banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-rose/30 bg-ks-rose/8 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-ks-rose" />
        <p className="font-black text-ks-rose">
          40 unresolved performance alerts · Chemistry Form 3B is the top institutional risk this week.
        </p>
        <NavLink to="/principal/performance" className="ml-auto">
          <Button className="rounded-xl bg-ks-rose py-2 text-xs hover:bg-ks-rose/90">Review Alerts</Button>
        </NavLink>
      </div>

      {/* Decision action cards */}
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        <PrincipalActionCard
          title="Marks Approvals"
          count="3"
          detail="HOD-approved assessments waiting for final principal lock."
          urgency="high"
          to="/principal/approvals"
          meta={['Final lock', 'Audited']}
        />
        <PrincipalActionCard
          title="Payment Approvals"
          count="3"
          detail="Manual finance entries requiring executive authorization."
          urgency="critical"
          to="/principal/finance/approvals"
          meta={['Cash / Bank', 'Evidence required']}
        />
        <PrincipalActionCard
          title="Results Ready"
          count="2"
          detail="Classes with locked results ready for student and parent publishing."
          urgency="medium"
          to="/principal/results/publish"
          meta={['Term II', 'Publish now']}
        />
        <PrincipalActionCard
          title="Report Cards"
          count="78"
          detail="Generated report cards waiting for principal comment and sign-off."
          urgency="high"
          to="/principal/report-cards"
          meta={['Comments', 'PDF export']}
        />
      </div>

      {/* Main grid: health + audit / charts */}
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-gutter">
          {/* School health score */}
          <SchoolHealthScore health={apiHealth} />

          {/* 3-panel snapshot */}
          <div className="grid gap-gutter xl:grid-cols-3">
            <ExecutiveBarChart
              title="Academic Risk"
              subtitle="Critical alerts by subject"
              values={[
                { label: 'Chemistry', value: 40, tone: 'bg-ks-rose' },
                { label: 'Mathematics', value: 28, tone: 'bg-ks-amber' },
                { label: 'Physics',   value: 14, tone: 'bg-ks-blue' },
                { label: 'Biology',   value: 8,  tone: 'bg-ks-emerald' },
              ]}
            />
            <ExecutiveLineChart
              title="Finance Collection"
              subtitle="Term II trend (%)"
              values={[42, 48, 52, 61, 68, 73.7]}
            />
            <ExecutiveBarChart
              title="Operations Pulse"
              subtitle="Current health indicators"
              values={[
                { label: 'Attendance',   value: 94, tone: 'bg-ks-emerald' },
                { label: 'Submissions',  value: 82, tone: 'bg-ks-gold' },
                { label: 'Syllabus',     value: 71, tone: 'bg-ks-blue' },
              ]}
            />
          </div>
        </div>

        {/* Right: audit trail */}
        <DecisionAuditTimeline rows={apiAudit} />
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Marks final approval ─────────────────────────────────────────────────────

export function MarksFinalApprovalPage() {
  const { data: apiAssessments = [] as typeof principalAssessments } = usePendingMarkApprovals() as { data: typeof principalAssessments };
  return (
    <PrincipalWorkspaceShell title="Marks Final Approval" eyebrow="Final academic lock">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Approvals' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Ready for Lock',    value: String(apiAssessments.length || 3), detail: 'HOD-approved assessments',    tone: 'high' },
        { label: 'Critical Students', value: String(apiAssessments.reduce((s, a) => s + (a.criticalAlerts ?? 0), 0) || 4), detail: 'Visible before you decide', tone: 'critical' },
        { label: 'Lowest Average',    value: `${Math.min(...apiAssessments.map((a) => a.average ?? 100), 54.1)}%`, detail: 'Chemistry Form 3B', tone: 'critical' },
        { label: 'Audit Mode',        value: 'ON',    detail: 'Every decision traced',       tone: 'stable' },
      ]} />
      <div className="rounded-2xl border border-ks-amber/30 bg-ks-amber/5 p-4">
        <p className="text-sm font-black text-ks-amber">
          Final lock requires both acknowledgment checkboxes on each assessment detail page. Locked marks become eligible for results publishing.
        </p>
      </div>
      <MarksFinalApprovalTable assessments={apiAssessments} />
    </PrincipalWorkspaceShell>
  );
}

// ─── Marks review detail ──────────────────────────────────────────────────────

export function PrincipalMarksReviewPage() {
  const assessment = useAssessment();
  const { data: apiMarkRows = [] as typeof markRows } = useMarksForApproval(assessment.id) as { data: typeof markRows };
  return (
    <PrincipalWorkspaceShell title={assessment.assessment} eyebrow="Assessment approval dossier">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Approvals', to: '/principal/approvals' },
        { label: assessment.assessment },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Class',     value: assessment.className,           detail: assessment.subject,                            tone: 'medium' },
            { label: 'Average',   value: `${assessment.average}%`,       detail: 'Assessment mean',                             tone: assessment.average < 60 ? 'critical' : 'stable' },
            { label: 'Alerts',    value: String(assessment.criticalAlerts), detail: 'Critical students in this assessment',     tone: assessment.criticalAlerts ? 'critical' : 'stable' },
            { label: 'HOD',       value: assessment.hodStatus,           detail: assessment.age,                                tone: 'high' },
          ]} />

          {/* Marks table */}
          <ExecutiveTable columns={['Student', 'Registration', 'Score', 'Previous', 'Δ Delta', 'Alert']} minWidth={840}>
            {apiMarkRows.map((row) => {
              const delta = row.score - row.previous;
              return (
                <tr key={row.registration} className="transition hover:bg-ks-paper">
                  <Td><span className="font-black text-ks-navy">{row.student}</span></Td>
                  <Td className="text-xs">{row.registration}</Td>
                  <Td>
                    <span className={row.score < 40 ? 'font-black text-ks-rose' : row.score >= 75 ? 'font-black text-ks-emerald' : 'font-black text-ks-navy'}>
                      {row.score}%
                    </span>
                  </Td>
                  <Td>{row.previous}%</Td>
                  <Td>
                    <span className={delta < 0 ? 'font-black text-ks-rose' : 'font-black text-ks-emerald'}>
                      {delta > 0 ? '+' : ''}{delta}
                    </span>
                  </Td>
                  <Td>
                    <Badge tone={row.alert.startsWith('Critical') || row.alert.startsWith('Below') || row.alert.startsWith('At-risk') ? 'rose' : 'emerald'}>
                      {row.alert}
                    </Badge>
                  </Td>
                </tr>
              );
            })}
          </ExecutiveTable>

          {/* Intelligence panel always visible for context */}
          <IntelligencePanel context="Chemistry Form 3B has three critical students: Hassan Mwamba, Zainab Kilio, and Rehema Juma. Locking marks makes this assessment eligible for publishing; interventions remain visible to AQA." />
        </div>

        {/* Sticky lock panel */}
        <FinalLockPanel />
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Results publishing ───────────────────────────────────────────────────────

export function ResultsPublishingPage() {
  const { data: apiPublishClasses = [] as typeof publishClasses } = usePublishReadiness() as { data: typeof publishClasses };
  return (
    <PrincipalWorkspaceShell title="Results Publishing" eyebrow="Final visibility authority">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Publish Results' }]} />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-navy/20 bg-ks-navy/5 p-4">
        <Lock className="h-5 w-5 text-ks-navy" />
        <p className="text-sm font-black text-ks-navy">
          Publishing results is irreversible for the selected term and classes. Students and parents will immediately gain view access.
        </p>
      </div>
      <PublishResultsFlow classes={Array.isArray(apiPublishClasses) ? apiPublishClasses : publishClasses} />
    </PrincipalWorkspaceShell>
  );
}

// ─── Report cards management ──────────────────────────────────────────────────

export function ReportCardsManagementPage() {
  const [batchMode, setBatchMode] = useState(false);
  const { data: apiPublishClasses = [] as typeof publishClasses } = usePublishReadiness() as { data: typeof publishClasses };
  const safeClasses = Array.isArray(apiPublishClasses) ? apiPublishClasses : publishClasses;
  return (
    <PrincipalWorkspaceShell title="Report Cards Management" eyebrow="Comments and sign-off">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Report Cards' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Generated Cards',   value: '312',  detail: 'Term II, all classes',       tone: 'stable' },
        { label: 'Missing Comments',  value: '78',   detail: 'Principal sign-off queue',   tone: 'high' },
        { label: 'Ready Classes',     value: '6',    detail: 'Batch export possible',      tone: 'medium' },
        { label: 'PDF Queue',         value: '18',   detail: 'Currently generating',       tone: 'stable' },
      ]} />

      {/* Batch comment toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
        <div>
          <p className="font-display text-base font-black text-ks-navy">Batch Principal Comment</p>
          <p className="text-sm font-semibold text-ks-muted">
            {batchMode ? 'Batch mode ON — comment will apply to all selected class cards after confirmation.' : 'Apply the same comment to all report cards in a selected class.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ks-slate">
            <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} className="h-4 w-4 accent-ks-navy" />
            Enable batch mode
          </label>
          <Button className="rounded-xl bg-ks-gold py-2 text-xs text-ks-navy">
            <Download className="h-3.5 w-3.5" /> Export All PDF
          </Button>
        </div>
      </div>

      {/* Class cards */}
      <div className="grid gap-gutter xl:grid-cols-3">
        {safeClasses.map((item) => (
          <NavLink
            key={item.id}
            to={`/principal/report-cards/${item.id}`}
            className="group rounded-2xl border border-ks-line bg-white p-5 shadow-sm transition hover:border-ks-gold/50 hover:shadow-layer"
          >
            <div className="flex items-start justify-between">
              <p className="font-display text-2xl font-black text-ks-navy">{item.className}</p>
              <Badge tone={item.reportCardReadiness >= 90 ? 'emerald' : 'amber'}>
                {`${item.reportCardReadiness}% ready`}
              </Badge>
            </div>
            <p className="mt-1 text-sm font-bold text-ks-muted">{item.students} cards</p>
            <div className="mt-4 h-2 rounded-full bg-ks-mist">
              <div className="h-full rounded-full bg-ks-gold transition-all" style={{ width: `${item.reportCardReadiness}%` }} />
            </div>
            <p className="mt-3 text-xs font-black text-ks-muted">
              {item.missingItems > 0 ? `${item.missingItems} missing items` : 'All items complete'}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-ks-blue">
              Open class <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </NavLink>
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Report card detail ───────────────────────────────────────────────────────

export function PrincipalReportCardDetailPage() {
  const { id } = useParams();
  return (
    <PrincipalWorkspaceShell title={`Report Card · ${id ?? 'Form 3B'}`} eyebrow="Principal sign-off preview">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Report Cards', to: '/principal/report-cards' },
        { label: id ?? 'Detail' },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Card preview */}
        <div className="space-y-gutter">
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between border-b border-ks-line pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Student report card</p>
                <h2 className="mt-1 font-display text-3xl font-black text-ks-navy">Amina Baraka Juma</h2>
                <p className="text-sm font-bold text-ks-muted">Form 2A · Term II 2026 · KS-2026-00017</p>
              </div>
              <Badge tone="emerald">Preview</Badge>
            </div>
            <ExecutiveLineChart title="Term Performance Trajectory" values={[66, 69, 72, 74, 78, 81]} />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[['Overall Average', '72%'], ['Attendance', '96%'], ['Conduct', 'Excellent']].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-ks-paper p-3 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">{label}</p>
                  <p className="mt-1 font-display text-2xl font-black text-ks-navy">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Comment editor */}
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Principal comment</p>
            <textarea
              className="mt-3 h-32 w-full rounded-xl border border-ks-line p-4 font-semibold text-ks-slate outline-none focus:border-ks-blue"
              defaultValue="Amina has shown consistent growth this term. Maintain focus in science practical work and continue the excellent attendance record."
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="rounded-xl bg-ks-navy">Save Principal Comment</Button>
              <Button variant="secondary" className="rounded-xl">Clear</Button>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-gutter">
          <IconPanel
            icon="scale"
            title="Batch Comment Mode"
            detail="Enable batch mode on the Report Cards list page to apply the same principal comment to all selected class cards after confirmation."
          />
          <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Export</p>
            <Button className="mt-3 w-full rounded-xl bg-ks-gold text-ks-navy">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
          <IntelligencePanel context="Report card comment saved creates an immutable audit record with actor, entity, and timestamp. No auto-navigation." />
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Finance oversight ────────────────────────────────────────────────────────

export function FinanceOversightPage() {
  return (
    <PrincipalWorkspaceShell title="Finance Oversight" eyebrow="Executive financial control">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Finance' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Collection Rate',    value: '73.7%',             detail: 'Term II · target 100%',       tone: 'medium' },
        { label: 'Outstanding',        value: money(32_059_000),   detail: '47 overdue invoices',         tone: 'critical' },
        { label: "Today's Collection", value: money(1_840_000),    detail: 'Cash and bank receipts',      tone: 'stable' },
        { label: 'Pending Approval',   value: '3',                  detail: 'Manual entries awaiting you', tone: 'high' },
      ]} />

      {/* Quick action to approvals */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ks-rose/30 bg-ks-rose/5 p-4">
        <div className="flex items-center gap-3">
          <WalletCards className="h-5 w-5 text-ks-rose" />
          <p className="font-black text-ks-rose">3 payment approvals pending your authorization.</p>
        </div>
        <NavLink to="/principal/finance/approvals">
          <Button className="rounded-xl bg-ks-rose py-2 text-xs">Approve Payments</Button>
        </NavLink>
      </div>

      <div className="grid gap-gutter xl:grid-cols-2">
        <ExecutiveLineChart
          title="Revenue Forecast"
          subtitle="Collection trajectory this term (%)"
          values={[54, 59, 66, 71, 73.7, 78, 84]}
        />
        <ExecutiveBarChart
          title="Outstanding by Class"
          subtitle="Unpaid balance (students)"
          values={[
            { label: 'Form 3', value: 118, tone: 'bg-ks-rose' },
            { label: 'Form 2', value: 86,  tone: 'bg-ks-amber' },
            { label: 'Form 4', value: 62,  tone: 'bg-ks-blue' },
            { label: 'Form 1', value: 45,  tone: 'bg-ks-emerald' },
          ]}
        />
      </div>

      {/* Quick links */}
      <div className="grid gap-gutter md:grid-cols-3">
        {(
          [
            ['Payment Approvals', '/principal/finance/approvals', WalletCards],
            ['Invoice Management', '/principal/finance/invoices', BookOpen],
            ['Finance Detail', '/finance', TrendingUp],
          ] as Array<[string, string, LucideIcon]>
        ).map(([label, to, Icon]) => (
          <NavLink
            key={String(to)}
            to={String(to)}
            className="flex items-center gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm transition hover:border-ks-gold/50 hover:shadow-layer"
          >
            <Icon className="h-6 w-6 text-ks-gold" />
            <p className="font-display text-base font-black text-ks-navy">{label}</p>
          </NavLink>
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Payment approvals ────────────────────────────────────────────────────────

export function PaymentApprovalsPage() {
  const { data: apiApprovals = [] as typeof paymentApprovals } = usePrincipalPendingPayments() as { data: typeof paymentApprovals };
  return (
    <PrincipalWorkspaceShell title="Payment Approval" eyebrow="Manual payment authority">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Finance', to: '/principal/finance' },
        { label: 'Payment Approvals' },
      ]} />
      <ExecutiveMetricGrid items={[
        { label: 'Pending',      value: String(apiApprovals.length || 3), detail: 'Awaiting authorization', tone: 'high' },
        { label: 'Highest Risk', value: money(Math.max(...apiApprovals.map((a) => a.amount), 1_100_000)), detail: 'Highest pending value', tone: 'critical' },
        { label: 'Oldest',       value: '7h 40m',          detail: 'Requires urgent review',         tone: 'high' },
        { label: 'Today Total',  value: money(apiApprovals.reduce((s, a) => s + a.amount, 0) || 2_350_000), detail: 'Combined pending value', tone: 'medium' },
      ]} />
      <div className="rounded-2xl border border-ks-navy/20 bg-ks-navy/5 p-4">
        <p className="text-sm font-black text-ks-navy">
          Approve or reject after reviewing bank evidence. Confirmation required. Approved cards are removed from this queue and a receipt is issued automatically.
        </p>
      </div>
      <div className="grid gap-gutter xl:grid-cols-3">
        {apiApprovals.map((approval) => (
          <PaymentApprovalCard key={approval.id} approval={approval} />
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Payment approval detail ──────────────────────────────────────────────────

export function PaymentApprovalDetailPage() {
  const approval = usePaymentApproval();
  return (
    <PrincipalWorkspaceShell title={approval.paymentId} eyebrow="Payment approval dossier">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Finance', to: '/principal/finance' },
        { label: 'Payment Approvals', to: '/principal/finance/approvals' },
        { label: approval.paymentId },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Amount',     value: money(approval.amount),  detail: approval.method.replaceAll('_', ' '),  tone: approval.risk },
            { label: 'Invoice',    value: approval.invoice,        detail: approval.student,                      tone: 'medium' },
            { label: 'Reference',  value: approval.reference,      detail: `Queued ${approval.age} ago`,          tone: 'high' },
            { label: 'Entered By', value: approval.enteredBy,      detail: 'Finance office',                      tone: 'stable' },
          ]} />
          {/* Bank slip preview */}
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Bank slip / evidence preview</p>
            <div className="mt-4 grid h-72 place-items-center rounded-xl border border-dashed border-ks-line bg-ks-paper">
              <div className="text-center">
                <p className="font-display text-3xl font-black text-ks-navy">{approval.reference}</p>
                <p className="mt-2 text-sm font-bold text-ks-muted">Slip image placeholder · {approval.method}</p>
              </div>
            </div>
          </div>
        </div>
        <PaymentApprovalCard approval={approval} />
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Invoice management ───────────────────────────────────────────────────────

export function PrincipalInvoiceManagementPage() {
  const { data: apiStudents = [] as typeof principalStudents } = usePrincipalStudents() as { data: typeof principalStudents };
  return (
    <PrincipalWorkspaceShell title="Invoice Management" eyebrow="Read-only executive finance view">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Finance', to: '/principal/finance' },
        { label: 'Invoices' },
      ]} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ks-navy/15 bg-ks-navy/5 p-3">
        <p className="text-sm font-black text-ks-navy">Read-only view. Changes must be made by Finance Office.</p>
        <NavLink to="/finance/invoices"><Button variant="secondary" className="rounded-xl py-1.5 text-xs">Open Finance Office</Button></NavLink>
      </div>
      <ExecutiveTable columns={['Invoice', 'Student', 'Class', 'Total', 'Paid', 'Outstanding', 'Status', 'Link']}>
        {apiStudents.map((student, i) => (
          <tr key={student.id} className="transition hover:bg-ks-paper">
            <Td><span className="font-black text-ks-navy">INV-2026-00{String(i + 1).padStart(2, '0')}</span></Td>
            <Td>{student.name}</Td>
            <Td>{student.className}</Td>
            <Td>{money(1_200_000)}</Td>
            <Td>{money(1_200_000 - student.financeBalance)}</Td>
            <Td>
              <span className={student.financeBalance > 0 ? 'font-black text-ks-rose' : 'font-black text-ks-emerald'}>
                {money(student.financeBalance)}
              </span>
            </Td>
            <Td>
              <Badge tone={student.financeBalance > 0 ? 'amber' : 'emerald'}>
                {student.financeBalance > 0 ? 'partial' : 'paid'}
              </Badge>
            </Td>
            <Td>
              <NavLink to="/principal/finance" className="text-xs font-black text-ks-blue hover:underline">Oversight →</NavLink>
            </Td>
          </tr>
        ))}
      </ExecutiveTable>
    </PrincipalWorkspaceShell>
  );
}

// ─── Performance overview ─────────────────────────────────────────────────────

export function PrincipalPerformanceOverviewPage() {
  return (
    <PrincipalWorkspaceShell title="Performance Overview" eyebrow="Institutional academic intelligence">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Performance' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Critical Alerts',       value: '40',   detail: 'Unresolved school-wide',       tone: 'critical' },
        { label: 'At-Risk Students',       value: '128',  detail: 'Across all classes',           tone: 'high' },
        { label: 'Pairing Effectiveness',  value: '62%',  detail: 'Active AQA support pairs',     tone: 'medium' },
        { label: 'AQA Actions This Week',  value: '17',   detail: 'Interventions logged',         tone: 'stable' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-3">
        <ExecutiveBarChart
          title="Severity Distribution"
          subtitle="Alerts by severity level"
          values={[
            { label: 'Critical', value: 40, tone: 'bg-ks-rose' },
            { label: 'High',     value: 52, tone: 'bg-ks-amber' },
            { label: 'Medium',   value: 36, tone: 'bg-ks-blue' },
          ]}
        />
        <ExecutiveLineChart
          title="At-Risk Trend"
          subtitle="Students flagged over 7 weeks"
          values={[91, 108, 104, 119, 128, 121, 116]}
        />
        <ExecutiveBarChart
          title="Subject Risk"
          subtitle="Critical alerts by subject"
          values={[
            { label: 'Chemistry',   value: 40, tone: 'bg-ks-rose' },
            { label: 'Mathematics', value: 28, tone: 'bg-ks-amber' },
            { label: 'Biology',     value: 18, tone: 'bg-ks-blue' },
            { label: 'Physics',     value: 12, tone: 'bg-ks-emerald' },
          ]}
        />
      </div>

      {/* At-risk students */}
      <PrincipalCriticalStudentsTable />

      {/* AQA link */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
        <div>
          <p className="font-display text-base font-black text-ks-navy">AQA Engine Actions</p>
          <p className="text-sm font-semibold text-ks-muted">17 interventions logged this week. View AQA command center for pairings and alerts.</p>
        </div>
        <NavLink to="/aqa"><Button variant="secondary" className="rounded-xl py-2 text-xs">Open AQA Center</Button></NavLink>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Student profile ──────────────────────────────────────────────────────────

export function PrincipalStudentProfilePage() {
  const student = useStudent();
  const { data: apiIncidents = [] as typeof disciplineIncidents } = usePrincipalDiscipline() as { data: typeof disciplineIncidents };
  return (
    <PrincipalWorkspaceShell title={student.name} eyebrow="Executive student profile">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Students', to: '/principal/students' },
        { label: student.name },
      ]} />
      <ExecutiveMetricGrid items={[
        { label: 'Academic',    value: `${student.academicAverage}%`,   detail: student.alertStatus,                                        tone: student.academicAverage < 50 ? 'critical' : 'stable' },
        { label: 'Attendance',  value: `${student.attendance}%`,        detail: 'Current term',                                             tone: 'stable' },
        { label: 'Finance',     value: money(student.financeBalance),   detail: student.financeBalance > 0 ? 'Balance due' : 'Account clear', tone: student.financeBalance > 0 ? 'high' : 'stable' },
        { label: 'Discipline',  value: student.disciplineStatus,        detail: `Guardian: ${student.guardian}`,                            tone: student.disciplineStatus === 'Open' ? 'high' : 'stable' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          {/* Academic */}
          <ExecutiveLineChart
            title="Academic Performance"
            subtitle="Score trajectory this term"
            values={[51, 49, 46, student.academicAverage, 55, 61]}
          />
          <ExecutiveBarChart
            title="Student 360 Context"
            values={[
              { label: 'Attendance',   value: student.attendance,                           tone: 'bg-ks-emerald' },
              { label: 'Academic',     value: student.academicAverage,                      tone: 'bg-ks-blue' },
              { label: 'Finance Risk', value: student.financeBalance > 0 ? 70 : 8,          tone: 'bg-ks-gold' },
            ]}
          />
          {/* Discipline incidents for this student */}
          {apiIncidents.filter((d) => d.student === student.name).map((incident) => (
            <ExpandableIncident key={incident.id} incident={incident} />
          ))}
        </div>

        {/* Right: actions */}
        <div className="space-y-gutter">
          <div className="sticky top-24 space-y-gutter">
            <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Executive actions</p>
              <div className="mt-4 space-y-2">
                {[
                  'Schedule guardian meeting',
                  'Flag for AQA intervention',
                  'Create urgent announcement',
                  'Open report card',
                  'Export student dossier',
                ].map((action) => (
                  <button key={action} className="flex w-full items-center justify-between rounded-xl border border-transparent px-4 py-3 text-left text-sm font-bold text-ks-slate transition hover:border-ks-line hover:bg-ks-paper hover:text-ks-navy">
                    {action}
                  </button>
                ))}
              </div>
            </div>
            <NavLink to="/principal/announcements/create">
              <Button className="w-full rounded-xl bg-ks-navy">
                <Megaphone className="h-4 w-4" /> Create Announcement
              </Button>
            </NavLink>
          </div>
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── All students ─────────────────────────────────────────────────────────────

export function PrincipalStudentsPage() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'finance'>('all');
  const { data: apiStudents = [] as typeof principalStudents, isLoading, isError, refetch } = usePrincipalStudents() as { data: typeof principalStudents; isLoading: boolean; isError: boolean; refetch: () => void };
  const filtered = filter === 'critical'
    ? apiStudents.filter((s) => s.alertStatus === 'Critical' || s.alertStatus === 'Watch')
    : filter === 'finance'
    ? apiStudents.filter((s) => s.financeBalance > 0)
    : apiStudents;

  return (
    <PrincipalWorkspaceShell title="All Students" eyebrow="Executive student browser">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Students' }]} />

      {/* Quick filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ks-line bg-white p-3 shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">View:</span>
        {[['all', 'All Students'], ['critical', 'Critical Only'], ['finance', 'Finance Risk']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key as 'all' | 'critical' | 'finance')}
            className={`rounded-xl border px-3 py-1.5 text-xs font-black transition ${
              filter === key ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line text-ks-muted hover:border-ks-navy/40 hover:text-ks-navy'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs font-bold text-ks-muted">{filtered.length} student{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <SkeletonTable cols={9} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !filtered.length ? (
        <EmptyState title={filter === 'all' ? 'No students enrolled' : 'No students match this filter'} description={filter === 'all' ? 'Students will appear here once they are enrolled.' : 'Try adjusting the filter above.'} />
      ) : (
      <ExecutiveTable columns={['Student', 'Class', 'Average', 'Attendance', 'Finance', 'Alert', 'Discipline', 'Guardian', 'Actions']}>
        {filtered.map((student) => (
          <tr key={student.id} className={`transition hover:bg-ks-paper ${student.alertStatus === 'Critical' ? 'border-l-4 border-l-ks-rose' : ''}`}>
            <Td><span className="font-black text-ks-navy">{student.name}</span></Td>
            <Td>{student.className}</Td>
            <Td>
              <span className={student.academicAverage < 50 ? 'font-black text-ks-rose' : student.academicAverage >= 75 ? 'font-black text-ks-emerald' : ''}>
                {student.academicAverage}%
              </span>
            </Td>
            <Td>{student.attendance}%</Td>
            <Td>
              <span className={student.financeBalance > 0 ? 'font-black text-ks-rose' : 'font-black text-ks-emerald'}>
                {money(student.financeBalance)}
              </span>
            </Td>
            <Td><Badge tone={student.alertStatus === 'Critical' ? 'rose' : student.alertStatus === 'Watch' ? 'amber' : 'emerald'}>{student.alertStatus}</Badge></Td>
            <Td><Badge tone={student.disciplineStatus === 'Open' ? 'amber' : 'slate'}>{student.disciplineStatus}</Badge></Td>
            <Td className="text-xs">{student.guardian}</Td>
            <Td>
              <NavLink className="text-xs font-black text-ks-blue hover:underline" to={`/principal/students/${student.id}`}>
                Profile →
              </NavLink>
            </Td>
          </tr>
        ))}
      </ExecutiveTable>
      )}
    </PrincipalWorkspaceShell>
  );
}

// ─── Discipline overview ──────────────────────────────────────────────────────

export function DisciplineOverviewPage() {
  const { data: apiIncidents = [] as typeof disciplineIncidents } = usePrincipalDiscipline() as { data: typeof disciplineIncidents };
  const { data: apiStudents = [] as typeof principalStudents } = usePrincipalStudents() as { data: typeof principalStudents };
  const open = apiIncidents.filter((i) => i.status === 'OPEN').length;
  const categories = ['Repeated absence', 'Conduct', 'Late arrival', 'Academic dishonesty'];
  return (
    <PrincipalWorkspaceShell title="Discipline Overview" eyebrow="Student conduct command">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Discipline' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Open Cases',    value: String(open),                                   detail: 'Unresolved incidents',     tone: 'high' },
        { label: 'Critical',      value: String(apiIncidents.filter((i) => i.severity === 'critical').length), detail: 'Require guardian conference', tone: 'critical' },
        { label: 'Resolved',      value: String(apiIncidents.filter((i) => i.status === 'RESOLVED').length),  detail: 'This term',                   tone: 'stable' },
        { label: 'Students',      value: String(new Set(apiIncidents.map((i) => i.student)).size),            detail: 'Unique students flagged',     tone: 'medium' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-gutter">
          <DisciplineSeverityBar incidents={apiIncidents} />
          {/* Category breakdown */}
          <ExecutiveBarChart
            title="Category Breakdown"
            subtitle="Incidents by type this term"
            values={categories.map((cat) => ({
              label: cat,
              value: apiIncidents.filter((i) => i.category === cat).length || 1,
              tone: 'bg-ks-blue',
            }))}
          />
          <div className="space-y-gutter">
            {apiIncidents.map((incident) => (
              <ExpandableIncident key={incident.id} incident={incident} />
            ))}
          </div>
        </div>

        {/* Right: summary */}
        <div className="sticky top-24 h-fit space-y-gutter">
          <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Recurrence</p>
            <h3 className="mt-2 font-display text-xl font-black text-ks-navy">Student Patterns</h3>
            <div className="mt-4 space-y-3">
              {apiStudents.filter((s) => s.disciplineStatus === 'Open').map((s) => (
                <div key={s.id} className="flex items-center justify-between">
                  <span className="text-sm font-bold text-ks-slate">{s.name}</span>
                  <Badge tone="amber">2× this term</Badge>
                </div>
              ))}
            </div>
          </div>
          <NavLink to="/principal/announcements/create">
            <Button className="w-full rounded-xl bg-ks-navy">
              <Megaphone className="h-4 w-4" /> Discipline Notice
            </Button>
          </NavLink>
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Staff overview ───────────────────────────────────────────────────────────

export function StaffOverviewPage() {
  const { data: apiStaff = [] as typeof staffMembers } = usePrincipalStaff() as { data: typeof staffMembers };
  const departments = [...new Set(apiStaff.map((s) => s.department))];
  return (
    <PrincipalWorkspaceShell title="Staff Overview" eyebrow="Operational performance">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Staff' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Total Staff',     value: String(apiStaff.length), detail: 'All departments',        tone: 'stable' },
        { label: 'On-Time Risk',    value: String(apiStaff.filter((s) => s.onTime < 80).length || 2), detail: 'Below 80% threshold', tone: 'high' },
        { label: 'Syllabus Risk',   value: String(apiStaff.filter((s) => s.syllabus > 0 && s.syllabus < 60).length || 1), detail: 'Below 60% threshold', tone: 'critical' },
        { label: 'Departments',     value: String(departments.length),  detail: 'Grouped view',           tone: 'medium' },
      ]} />

      {/* Per-department grouping */}
      {departments.map((dept) => {
        const deptStaff = apiStaff.filter((s) => s.department === dept);
        return (
          <div key={dept} className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
            <div className="border-b border-ks-line bg-ks-navy/5 px-5 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-black text-ks-navy">{dept} Department</h3>
                <Badge tone="slate">{`${deptStaff.length} member${deptStaff.length !== 1 ? 's' : ''}`}</Badge>
              </div>
            </div>
            <ExecutiveTable columns={['Name', 'Role', 'On-Time %', 'Syllabus %', 'Classes', 'Status']} minWidth={700}>
              {deptStaff.map((staff) => {
                const concern = staff.onTime < 80 || (staff.syllabus > 0 && staff.syllabus < 60);
                return (
                  <tr key={staff.id} className={`transition hover:bg-ks-paper ${concern ? 'border-l-4 border-l-ks-rose' : ''}`}>
                    <Td><span className="font-black text-ks-navy">{staff.name}</span></Td>
                    <Td>{staff.role}</Td>
                    <Td>
                      <span className={staff.onTime < 80 ? 'font-black text-ks-rose' : 'font-black text-ks-emerald'}>
                        {staff.onTime}%
                      </span>
                    </Td>
                    <Td>
                      {staff.syllabus > 0 ? (
                        <span className={staff.syllabus < 60 ? 'font-black text-ks-rose' : staff.syllabus < 80 ? 'font-black text-ks-amber' : 'font-black text-ks-emerald'}>
                          {staff.syllabus}%
                        </span>
                      ) : <span className="text-ks-muted">N/A</span>}
                    </Td>
                    <Td>{staff.classes}</Td>
                    <Td><Badge tone={concern ? 'rose' : 'emerald'}>{concern ? 'Review' : 'Clear'}</Badge></Td>
                  </tr>
                );
              })}
            </ExecutiveTable>
          </div>
        );
      })}
    </PrincipalWorkspaceShell>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────

const FALLBACK_ANNOUNCEMENTS = [
  { id: 'fa1', title: 'Parent Meeting Notice', detail: 'School-wide parent conference scheduled for Friday 23 May. All guardians must confirm attendance.', priority: 'urgent' as const, audience: 'All parents and guardians', date: 'May 21, 2026', status: 'published' as const },
  { id: 'fa2', title: 'Results Publishing Window', detail: 'Term II results will be published after final marks lock. Students will be notified via portal and SMS.', priority: 'normal' as const, audience: 'Students, Parents, Teachers', date: 'May 20, 2026', status: 'scheduled' as const },
  { id: 'fa3', title: 'Discipline Policy Reminder', detail: 'Reminder to all students on conduct standards following recent dormitory incident.', priority: 'draft' as const, audience: 'Students, Teachers', date: 'May 19, 2026', status: 'draft' as const },
];

export function PrincipalAnnouncementsPage() {
  const { data: rawAnnouncements } = usePrincipalAnnouncements() as {
    data: Array<{ id?: string; title?: string; body?: string; message?: string; priority?: string; audience?: string; targetRoles?: string[]; createdAt?: string; status?: string }> | undefined;
  };
  const displayAnnouncements = rawAnnouncements && rawAnnouncements.length > 0
    ? rawAnnouncements.map((a) => ({
        id: a.id ?? a.title ?? Math.random().toString(),
        title: a.title ?? 'Announcement',
        detail: a.body ?? a.message ?? '',
        priority: ((['urgent', 'normal', 'draft'].includes(a.priority?.toLowerCase() ?? '')) ? a.priority!.toLowerCase() : 'normal') as 'urgent' | 'normal' | 'draft',
        audience: a.audience ?? ((a.targetRoles ?? []).join(', ') || 'All'),
        date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        status: ((['published', 'scheduled', 'draft'].includes(a.status?.toLowerCase() ?? '')) ? a.status!.toLowerCase() : 'published') as 'published' | 'scheduled' | 'draft',
      }))
    : FALLBACK_ANNOUNCEMENTS;

  const publishedCount = displayAnnouncements.filter((a) => a.status === 'published').length;
  const draftCount = displayAnnouncements.filter((a) => a.status === 'draft').length;
  const scheduledCount = displayAnnouncements.filter((a) => a.status === 'scheduled').length;
  const urgentCount = displayAnnouncements.filter((a) => a.priority === 'urgent').length;

  return (
    <PrincipalWorkspaceShell
      title="Announcements"
      eyebrow="Principal communication authority"
      action={
        <NavLink to="/principal/announcements/create">
          <Button className="rounded-xl bg-[#f4c96b] py-2 text-xs text-[#061f33]">
            <Plus className="h-3.5 w-3.5" /> New Announcement
          </Button>
        </NavLink>
      }
    >
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Announcements' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Published',  value: String(publishedCount),  detail: 'Active announcements',   tone: 'stable' },
        { label: 'Drafts',     value: String(draftCount),      detail: 'Awaiting review',        tone: 'medium' },
        { label: 'Scheduled',  value: String(scheduledCount),  detail: 'Upcoming',               tone: 'high' },
        { label: 'Urgent',     value: String(urgentCount),     detail: 'Priority notifications', tone: 'critical' },
      ]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {displayAnnouncements.map((item) => (
          <AnnouncementCard
            key={item.id}
            title={item.title}
            detail={item.detail}
            priority={item.priority}
            audience={item.audience}
            date={item.date}
            status={item.status}
          />
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Create announcement ──────────────────────────────────────────────────────

export function CreatePrincipalAnnouncementPage() {
  const [urgent, setUrgent] = useState(false);
  const allAudiences = ['All Staff', 'Teachers', 'HODs', 'Finance Office', 'AQA Officers', 'Parents', 'Students'];
  const [audiences, setAudiences] = useState<string[]>(['Teachers', 'Parents']);

  const toggleAudience = (a: string) =>
    setAudiences((cur) => cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);

  return (
    <PrincipalWorkspaceShell title="Create Announcement" eyebrow="Authoritative publishing">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Announcements', to: '/principal/announcements' },
        { label: 'Create' },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-gutter">
          {/* Main form */}
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-ks-line pb-4">
              <Megaphone className="h-5 w-5 text-ks-gold" />
              <h2 className="font-display text-xl font-black text-ks-navy">New Announcement</h2>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2 block">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Title</span>
                <input className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none focus:border-ks-blue" placeholder="Announcement title..." />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Priority</span>
                <select className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none focus:border-ks-blue">
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Schedule (optional)</span>
                <input type="datetime-local" className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none focus:border-ks-blue" />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Message</span>
              <textarea className="mt-2 h-40 w-full rounded-xl border border-ks-line p-4 font-semibold text-ks-slate outline-none focus:border-ks-blue" placeholder="Principal message body..." />
            </label>
            {urgent && (
              <div className="mt-4 rounded-xl border border-ks-rose/30 bg-ks-rose/5 p-4">
                <p className="text-sm font-black text-ks-rose">
                  Urgent announcements trigger immediate push notifications to all selected audiences. Please confirm audience before publishing.
                </p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button className="rounded-xl bg-ks-navy">
                <Send className="h-4 w-4" /> Preview and Publish
              </Button>
              <Button variant="secondary" className="rounded-xl">Save Draft</Button>
            </div>
          </div>

          {/* Urgent toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
            <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="h-5 w-5 accent-ks-rose" />
            <div>
              <p className="font-black text-ks-navy">Mark as Urgent</p>
              <p className="text-sm font-semibold text-ks-muted">Sends immediate push notification to all selected roles.</p>
            </div>
          </label>
        </div>

        {/* Right: audience + preview */}
        <div className="space-y-gutter">
          <div className="sticky top-24 space-y-gutter">
            {/* Audience targeting */}
            <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Target Audience</p>
              <h3 className="mt-1 font-display text-xl font-black text-ks-navy">Select Recipients</h3>
              <div className="mt-4 space-y-2">
                {allAudiences.map((a) => (
                  <label key={a} className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={audiences.includes(a)}
                      onChange={() => toggleAudience(a)}
                      className="h-4 w-4 accent-ks-navy"
                    />
                    <span className="text-sm font-bold text-ks-slate">{a}</span>
                  </label>
                ))}
              </div>
              {audiences.length > 0 && (
                <div className="mt-4 rounded-xl bg-ks-paper p-3">
                  <p className="text-xs font-black text-ks-navy">
                    Sending to: {audiences.join(', ')}
                  </p>
                </div>
              )}
            </div>

            <IconPanel
              icon="megaphone"
              title="Preview Before Publish"
              detail="The announcement preview shows exactly what recipients will see. Urgent priority requires final confirmation."
            />
          </div>
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Analytics heatmap ────────────────────────────────────────────────────────

const HEATMAP_FORMS    = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5'];
const HEATMAP_SUBJECTS = ['Chemistry', 'Mathematics', 'Physics', 'Biology', 'English'];
// Stable scores: row = form, col = subject
const HEATMAP_SCORES: number[][] = [
  [62, 71, 83, 77, 88],
  [55, 65, 79, 72, 85],
  [48, 60, 75, 68, 82],
  [58, 68, 81, 74, 87],
  [67, 74, 86, 80, 91],
];

function heatColor(score: number): { bg: string; text: string; label: string } {
  if (score < 55) return { bg: 'bg-ks-rose/30 hover:bg-ks-rose/50',      text: 'text-rose-700',   label: 'Critical' };
  if (score < 65) return { bg: 'bg-amber-100 hover:bg-amber-200',         text: 'text-amber-800',  label: 'Below avg' };
  if (score < 75) return { bg: 'bg-sky-100 hover:bg-sky-200',             text: 'text-sky-800',    label: 'Satisfactory' };
  if (score < 85) return { bg: 'bg-emerald-100 hover:bg-emerald-200',     text: 'text-emerald-800',label: 'Good' };
  return              { bg: 'bg-emerald-200 hover:bg-emerald-300',         text: 'text-emerald-900',label: 'Excellent' };
}

function SchoolHeatmap() {
  const [hovKey, setHovKey] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.28em] text-ks-muted">Performance Matrix</p>
          <h2 className="mt-1 font-display text-2xl font-black text-ks-navy">School Performance Heatmap</h2>
          <p className="mt-1 text-sm font-semibold text-ks-muted">Class × Subject average score — hover a cell for detail</p>
        </div>
        {/* Legend */}
        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-ks-line bg-ks-paper px-4 py-2.5">
          {([
            ['bg-ks-rose/30', 'Critical'],
            ['bg-amber-100',  '< 65'],
            ['bg-sky-100',    '65-74'],
            ['bg-emerald-100','75-84'],
            ['bg-emerald-200','85+'],
          ] as const).map(([bg, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`h-3 w-3 rounded ${bg}`} />
              <span className="text-[10px] font-black text-ks-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-separate" style={{ borderSpacing: '6px' }}>
          <thead>
            <tr>
              <th className="w-24 text-left" />
              {HEATMAP_SUBJECTS.map((s) => (
                <th key={s} className="pb-1 text-center text-[10px] font-black uppercase tracking-widest text-ks-muted">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEATMAP_FORMS.map((form, ri) => (
              <tr key={form}>
                <td className="pr-3 text-right text-xs font-black uppercase tracking-widest text-ks-slate">
                  {form}
                </td>
                {HEATMAP_SCORES[ri].map((score, ci) => {
                  const key = `${ri}-${ci}`;
                  const { bg, text, label } = heatColor(score);
                  const isHov = hovKey === key;
                  return (
                    <td key={key} className="relative p-0">
                      <motion.div
                        className={`relative cursor-pointer rounded-xl px-3 py-4 text-center transition-colors duration-150 ${bg}`}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3, delay: (ri * 5 + ci) * 0.018, ease: 'easeOut' }}
                        onMouseEnter={() => setHovKey(key)}
                        onMouseLeave={() => setHovKey(null)}
                      >
                        <p className={`text-sm font-black ${text}`}>{score}%</p>
                        <AnimatePresence>
                          {isHov && (
                            <motion.div
                              key="tip"
                              initial={{ opacity: 0, y: -8, scale: 0.92 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.92 }}
                              transition={{ duration: 0.18 }}
                              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-ks-navy px-4 py-3 shadow-2xl"
                            >
                              <p className="font-display text-xl font-black text-ks-gold">{score}%</p>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-white/70">
                                {form} · {HEATMAP_SUBJECTS[ci]}
                              </p>
                              <p className={`mt-0.5 text-[9px] font-black uppercase tracking-wider ${
                                score < 55 ? 'text-rose-400' :
                                score < 65 ? 'text-amber-400' :
                                score < 75 ? 'text-sky-400' :
                                'text-emerald-400'
                              }`}>{label}</p>
                              <div className="absolute left-1/2 top-full -translate-x-1/2 border-[5px] border-transparent border-t-ks-navy" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Analytics dashboard ──────────────────────────────────────────────────────

export function PrincipalAnalyticsPage() {
  const [tab, setTab] = useState<'academic' | 'finance' | 'operations'>('academic');
  return (
    <PrincipalWorkspaceShell title="Analytics Dashboard" eyebrow="Board-ready executive analytics">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Analytics' }]} />

      {/* Tab bar */}
      <div className="flex gap-2 rounded-2xl border border-ks-line bg-white p-2 shadow-sm">
        {[
          { key: 'academic',    label: 'Academic',    icon: GraduationCap },
          { key: 'finance',     label: 'Finance',     icon: WalletCards },
          { key: 'operations',  label: 'Operations',  icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              tab === key
                ? 'bg-ks-navy text-white shadow-sm'
                : 'text-ks-muted hover:bg-ks-paper hover:text-ks-navy'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'academic' && (
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'School Average',  value: '68.4%', detail: 'Across all subjects',         tone: 'medium' },
            { label: 'Pass Rate',       value: '82%',   detail: 'Above failure threshold',     tone: 'stable' },
            { label: 'At-Risk',         value: '128',   detail: 'Performance alerts active',   tone: 'high' },
            { label: 'Improving',       value: '47',    detail: 'Positive trajectory',         tone: 'stable' },
          ]} />
          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveLineChart title="School Average Trend" subtitle="Weekly academic score" values={[68, 70, 73, 71, 76, 78]} />
            <ExecutiveBarChart
              title="Subject Ranking"
              subtitle="Average score by subject"
              values={[
                { label: 'Physics',     value: 82, tone: 'bg-ks-emerald' },
                { label: 'Biology',     value: 78, tone: 'bg-ks-blue' },
                { label: 'Mathematics', value: 66, tone: 'bg-ks-gold' },
                { label: 'Chemistry',   value: 54, tone: 'bg-ks-rose' },
              ]}
            />
          </div>
          <ExecutiveLineChart title="At-Risk Student Trend" subtitle="Students flagged weekly — hover to compare" values={[91, 108, 104, 119, 128, 121, 116]} />
          <SchoolHeatmap />
        </div>
      )}

      {tab === 'finance' && (
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Collection Rate',   value: '73.7%',           detail: 'Term II',          tone: 'medium' },
            { label: 'Outstanding',       value: money(32_059_000), detail: '47 overdue',       tone: 'critical' },
            { label: 'Revenue This Month',value: money(8_400_000),  detail: 'vs. target 10.2M', tone: 'high' },
            { label: 'Forecast',          value: '84%',             detail: 'End of term',      tone: 'stable' },
          ]} />
          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveLineChart title="Collection Trend" subtitle="Term II weekly % collected" values={[54, 59, 64, 69, 73.7, 79]} />
            <ExecutiveBarChart
              title="Outstanding by Class"
              subtitle="Unpaid students per class"
              values={[
                { label: 'Form 3', value: 118, tone: 'bg-ks-rose' },
                { label: 'Form 2', value: 86,  tone: 'bg-ks-gold' },
                { label: 'Form 4', value: 62,  tone: 'bg-ks-blue' },
                { label: 'Form 1', value: 45,  tone: 'bg-ks-emerald' },
              ]}
            />
          </div>
          <ExecutiveBarChart
            title="Revenue by Fee Category"
            subtitle="Breakdown of collected amounts"
            values={[
              { label: 'Tuition',  value: 58_200, tone: 'bg-ks-navy' },
              { label: 'Boarding', value: 14_900, tone: 'bg-ks-gold' },
              { label: 'Meals',    value: 9_400,  tone: 'bg-ks-emerald' },
              { label: 'ICT',      value: 7_121,  tone: 'bg-ks-blue' },
            ]}
          />
        </div>
      )}

      {tab === 'operations' && (
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Attendance',          value: '94.1%', detail: 'School-wide average',  tone: 'stable' },
            { label: 'Syllabus Done',       value: '71%',   detail: 'Average completion',   tone: 'medium' },
            { label: 'On-Time Submissions', value: '82%',   detail: 'Staff timeliness',     tone: 'high' },
            { label: 'Open Discipline', value: '3', detail: 'Unresolved cases', tone: 'high' },
          ]} />
          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveLineChart title="Attendance Trend" subtitle="Daily school attendance %" values={[94, 93, 95, 92, 96, 94]} />
            <ExecutiveBarChart
              title="Submission Timeliness"
              subtitle="On-time % by department"
              values={[
                { label: 'Science',     value: 88, tone: 'bg-ks-emerald' },
                { label: 'Mathematics', value: 76, tone: 'bg-ks-amber' },
                { label: 'Finance',     value: 95, tone: 'bg-ks-blue' },
              ]}
            />
          </div>
          <ExecutiveBarChart
            title="Discipline Incidents by Month"
            subtitle="Monthly incident count — current term"
            values={[
              { label: 'March',  value: 5, tone: 'bg-ks-emerald' },
              { label: 'April',  value: 8, tone: 'bg-ks-amber' },
              { label: 'May',    value: 3, tone: 'bg-ks-blue' },
            ]}
          />
        </div>
      )}
    </PrincipalWorkspaceShell>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function PrincipalReportsPage() {
  const reports = [
    ['School Overview',       'Full institutional health across academic, finance, and operations.'],
    ['Academic Performance',  'Subject rankings, class averages, at-risk and improving students.'],
    ['Finance Overview',      'Collection rate, outstanding balances, daily and term trends.'],
    ['Attendance Summary',    'School-wide and class-level attendance for the reporting period.'],
    ['Discipline Summary',    'Incidents by category, severity, and resolution status.'],
    ['Staff Performance',     'Submission timeliness, syllabus completion, and concern indicators.'],
    ['Board Executive',       'High-level board-ready report with health scores and key metrics.'],
    ['Student Profile',       'Individual student dossier with academic, finance, and discipline.'],
  ] as const;
  return (
    <PrincipalWorkspaceShell title="Generate Reports" eyebrow="Executive report generator">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Reports' }]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {reports.map(([title, detail]) => (
          <FancyReportTile key={title} title={title} detail={detail} to="/principal/reports" />
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── School settings ──────────────────────────────────────────────────────────

export function SchoolSettingsPage() {
  const { data: schoolSettings } = usePrincipalSchoolSettings() as { data: { gradingScale?: Array<{ grade: string; minScore: number; maxScore: number; label: string }> } | undefined };
  const gradingScale = schoolSettings?.gradingScale ?? null;
  return (
    <PrincipalWorkspaceShell title="School Settings" eyebrow="High-level school configuration">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Settings' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          {/* School identity */}
          <SettingsBlock title="School Identity" subtitle="Name, motto, and contact details">
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField label="School Name" defaultValue="Kilimanjaro Schools" />
              <SettingsField label="School Code" defaultValue="KS-ARU-001" />
              <SettingsField label="Motto" defaultValue="Excellence Through Discipline" />
              <SettingsField label="Contact Email" defaultValue="admin@ks.ac.tz" />
              <SettingsField label="Phone" defaultValue="+255 27 254 0001" />
              <SettingsField label="Location" defaultValue="Arusha, Tanzania" />
            </div>
            <Button variant="secondary" className="mt-4 rounded-xl">Save Identity</Button>
          </SettingsBlock>

          {/* Academic year + term */}
          <SettingsBlock title="Academic Year & Term" subtitle="Current academic calendar configuration">
            <div className="grid gap-4 md:grid-cols-2">
              <SettingsField label="Academic Year" defaultValue="2026" />
              <SettingsField label="Current Term" defaultValue="Term II" />
              <SettingsField label="Term Start" defaultValue="April 7, 2026" />
              <SettingsField label="Term End" defaultValue="July 4, 2026" />
            </div>
            <Button variant="secondary" className="mt-4 rounded-xl">Save Calendar</Button>
          </SettingsBlock>

          {/* Grading scale */}
          <SettingsBlock title="Grading Scale" subtitle="Grade boundaries and labels">
            <div className="overflow-hidden rounded-xl border border-ks-line">
              {gradingScale
                ? gradingScale.map((g) => (
                    <div key={g.grade} className="flex items-center justify-between border-b border-ks-line px-4 py-3 last:border-0">
                      <span className="font-display text-xl font-black text-ks-navy">{g.grade}</span>
                      <span className="font-mono font-bold text-ks-muted">{g.minScore}–{g.maxScore}%</span>
                      <span className="text-sm font-bold text-ks-slate">{g.label}</span>
                    </div>
                  ))
                : ([
                    ['A', '≥ 80%', 'Distinction'],
                    ['B', '70-79%', 'Credit'],
                    ['C', '55-69%', 'Pass'],
                    ['D', '40-54%', 'Below average'],
                    ['F', '< 40%', 'Fail'],
                  ] as const).map(([grade, range, label]) => (
                    <div key={grade} className="flex items-center justify-between border-b border-ks-line px-4 py-3 last:border-0">
                      <span className="font-display text-xl font-black text-ks-navy">{grade}</span>
                      <span className="font-mono font-bold text-ks-muted">{range}</span>
                      <span className="text-sm font-bold text-ks-slate">{label}</span>
                    </div>
                  ))
              }
            </div>
          </SettingsBlock>

          {/* Assessment weights */}
          <SchoolSettingsSection />

          {/* Performance engine */}
          <ExecutiveBarChart
            title="Performance Engine Rails"
            subtitle="Current threshold configuration"
            values={[
              { label: 'Failure rail',    value: 35, tone: 'bg-ks-rose' },
              { label: 'At-risk rail',    value: 48, tone: 'bg-ks-gold' },
              { label: 'Excellence rail', value: 85, tone: 'bg-ks-emerald' },
            ]}
          />
        </div>

        {/* Right: links + advisory */}
        <div className="sticky top-24 h-fit space-y-gutter">
          <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Quick links</p>
            <div className="mt-4 space-y-2">
              {[
                ['Performance Engine Config', '/aqa/engine'],
                ['Fee Categories', '/finance/fee-structures'],
                ['Grading Scale Detail', '/principal/settings/school'],
              ].map(([label, to]) => (
                <NavLink
                  key={String(label)}
                  to={String(to)}
                  className="flex items-center justify-between rounded-xl border border-ks-line px-4 py-3 text-sm font-bold text-ks-slate transition hover:border-ks-gold/50 hover:text-ks-navy"
                >
                  {label} <span className="text-ks-muted">→</span>
                </NavLink>
              ))}
            </div>
          </div>
          <IconPanel
            icon="scale"
            title="Settings Audit"
            detail="All settings changes create an immutable audit record with actor, old value, new value, and timestamp."
          />
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Audit trail ──────────────────────────────────────────────────────────────

export function PrincipalAuditPage() {
  const [filter, setFilter] = useState<string>('All');
  const { data: apiAudit = [] as typeof principalAudit } = usePrincipalAudit() as { data: typeof principalAudit };
  const eventTypes = ['All', 'Marks locked', 'Payment approved', 'Announcement published'];
  const filtered = filter === 'All' ? apiAudit : apiAudit.filter((e) => e.decision.toLowerCase().includes(filter.toLowerCase()));

  return (
    <PrincipalWorkspaceShell title="Principal Decision Audit Trail" eyebrow="Audited executive decisions">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Audit Trail' }]} />

      {/* Immutable banner */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-navy bg-ks-navy px-5 py-4 text-white">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
          <ShieldCheck className="h-5 w-5 text-ks-gold" />
        </div>
        <div>
          <p className="font-display text-base font-black">Immutable Principal Decision Audit</p>
          <p className="text-sm font-semibold text-white/70">Every executive action is recorded, timestamped, and cannot be deleted or modified.</p>
        </div>
        <div className="ml-auto rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white/80">
          Read-only
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ks-line bg-white p-3 shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Filter:</span>
        {eventTypes.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-black transition ${
              filter === type ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line text-ks-muted hover:border-ks-navy/40 hover:text-ks-navy'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <DecisionAuditTimeline rows={filtered} />

      {/* Detailed table view */}
      <ExecutiveTable columns={['Date', 'Decision', 'Entity', 'Reason', 'Correlation ID']} minWidth={900}>
        {filtered.map((row) => (
          <tr key={row.id} className="transition hover:bg-ks-paper">
            <Td className="text-xs">{row.date}</Td>
            <Td><span className="font-black text-ks-navy">{row.decision}</span></Td>
            <Td>{row.entity}</Td>
            <Td className="max-w-sm text-xs">{row.reason}</Td>
            <Td className="text-xs font-mono">{row.correlationId}</Td>
          </tr>
        ))}
      </ExecutiveTable>
    </PrincipalWorkspaceShell>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function PrincipalExportsPage() {
  const items = [
    ['Decision Audit CSV',             'All principal decisions with timestamps, reasons, and correlation IDs.',     'audit'],
    ['School Health PDF',               'Full institutional health score with academic, finance, and ops scores.',    'health'],
    ['Finance Overview PDF',            'Collection rate, outstanding balances, and payment approval history.',       'finance'],
    ['Academic Overview PDF',           'Subject rankings, class averages, pass rates, and at-risk summary.',        'academic'],
    ['Performance Alerts CSV',          'All active and resolved alerts with student, subject, and AQA data.',       'alerts'],
    ['Discipline Report PDF',           'Incidents by severity, category, resolution, and recurrence.',              'discipline'],
    ['Staff Overview CSV',              'Submission timeliness, syllabus completion, and concern flags.',             'staff'],
    ['Published Results Summary PDF',   'Class-level results summary for published terms.',                          'results'],
  ] as const;

  return (
    <PrincipalWorkspaceShell title="Executive Export Center" eyebrow="Board and stakeholder packets">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Exports' }]} />
      <div className="rounded-2xl border border-ks-navy/15 bg-ks-navy/5 p-4">
        <p className="text-sm font-black text-ks-navy">
          Every export creates an immutable audit record with actor, filters applied, timestamp, and file hash.
        </p>
      </div>
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {items.map(([title, detail]) => (
          <FancyReportTile key={title} title={title} detail={detail} to="/principal/exports" />
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SettingsBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">{subtitle}</p>
      <h2 className="mt-0.5 font-display text-2xl font-black text-ks-navy">{title}</h2>
      <div className="mt-5 border-t border-ks-line pt-4">{children}</div>
    </div>
  );
}

function SettingsField({ label, defaultValue }: { label: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">{label}</span>
      <input
        defaultValue={defaultValue}
        className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white"
      />
    </label>
  );
}

// ─── Private components ───────────────────────────────────────────────────────

function PrincipalCriticalStudentsTable() {
  const { data: apiStudents = [] as typeof principalStudents } = usePrincipalStudents() as { data: typeof principalStudents };
  const atRisk = apiStudents.filter((s) => s.alertStatus === 'Critical' || s.alertStatus === 'Watch');
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line bg-ks-navy px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-white/60">Critical students</p>
        <h2 className="mt-0.5 font-display text-xl font-black text-white">Immediate Attention Required</h2>
      </div>
      <ExecutiveTable columns={['Student', 'Class', 'Average', 'Alert', 'Attendance', 'Actions']} minWidth={840}>
        {atRisk.map((student) => (
          <tr key={student.id} className={`transition hover:bg-ks-paper ${student.alertStatus === 'Critical' ? 'border-l-4 border-l-ks-rose' : 'border-l-4 border-l-ks-amber'}`}>
            <Td><span className="font-black text-ks-navy">{student.name}</span></Td>
            <Td>{student.className}</Td>
            <Td>
              <span className={student.academicAverage < 50 ? 'font-black text-ks-rose' : 'font-black text-ks-amber'}>
                {student.academicAverage}%
              </span>
            </Td>
            <Td><Badge tone={student.alertStatus === 'Critical' ? 'rose' : 'amber'}>{student.alertStatus}</Badge></Td>
            <Td>{student.attendance}%</Td>
            <Td>
              <div className="flex items-center gap-2">
                <NavLink to={`/principal/students/${student.id}`} className="text-xs font-black text-ks-blue hover:underline">Profile</NavLink>
                <span className="text-ks-mist">·</span>
                <button className="text-xs font-black text-ks-rose hover:underline">Escalate</button>
              </div>
            </Td>
          </tr>
        ))}
      </ExecutiveTable>
    </div>
  );
}

// ─── Param hooks ──────────────────────────────────────────────────────────────

function useAssessment() {
  const { assessmentId } = useParams();
  const { data: apiAssessments = [] as typeof principalAssessments } = usePendingMarkApprovals() as { data: typeof principalAssessments };
  return apiAssessments.find((a) => a.id === assessmentId) ?? apiAssessments[0] ?? principalAssessments[0];
}

function usePaymentApproval() {
  const { id } = useParams();
  const { data: apiApprovals = [] as typeof paymentApprovals } = usePrincipalPendingPayments() as { data: typeof paymentApprovals };
  return apiApprovals.find((a) => a.id === id) ?? apiApprovals[0] ?? paymentApprovals[0];
}

function useStudent() {
  const { studentId } = useParams();
  const { data: apiStudents = [] as typeof principalStudents } = usePrincipalStudents() as { data: typeof principalStudents };
  return apiStudents.find((s) => s.id === studentId) ?? apiStudents[0] ?? principalStudents[0];
}
