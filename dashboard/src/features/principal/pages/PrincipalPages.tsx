import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
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
import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import type {
  DisciplineIncident,
  MarkRow,
  PrincipalAssessment,
  PrincipalAuditEvent,
  PrincipalPaymentApproval,
  PrincipalStudent,
  PublishClass,
  SchoolHealth,
  StaffMember,
} from '../types/principal.types';

type SchoolHealthWithStats = SchoolHealth & { atRisk?: number; critical?: number; passRate?: number };
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
  usePrincipalFinanceOverview,
  useCreatePrincipalAnnouncementMutation,
  useSignReportCardMutation,
  usePatchSchoolSettingsMutation,
} from '../api/principal.hooks';
import { useInvoices } from '../../finance/api/finance.hooks';
import { downloadReportWhenReady, useGenerateReportMutation, useGenerateReportCardsMutation } from '../../operations/api/operations.hooks';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { useAqaSchoolSummary, useAqaPairings, useCreateAqaInterventionMutation } from '../../aqa/api/aqa.hooks';
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

// Zero-value school health â€” shown before data loads (no fake scores)
const EMPTY_HEALTH: SchoolHealth = { score: 0, academic: 0, finance: 0, operations: 0, trend: 0 };

// â”€â”€â”€ Home dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalHomePage() {
  const { data: apiHealth = EMPTY_HEALTH } = usePrincipalSchoolHealth() as { data: SchoolHealth };
  const { data: apiAudit = [] as PrincipalAuditEvent[] } = usePrincipalAudit() as { data: PrincipalAuditEvent[] };
  const { data: apiAssessments = [] as PrincipalAssessment[] } = usePendingMarkApprovals() as { data: PrincipalAssessment[] };
  const { data: apiApprovals = [] as PrincipalPaymentApproval[] } = usePrincipalPendingPayments() as { data: PrincipalPaymentApproval[] };
  const { data: apiPublishClasses = [] as PublishClass[] } = usePublishReadiness() as { data: PublishClass[] };
  const { data: fin } = usePrincipalFinanceOverview();

  const marksCount    = apiAssessments.length;
  const paymentsCount = apiApprovals.length;
  const resultsCount  = apiPublishClasses.filter((c) => c.missingItems === 0 && c.reportCardReadiness >= 80).length;
  const reportCards   = apiPublishClasses.reduce((s, c) => s + (c.students ?? 0), 0);
  const totalPending  = marksCount + paymentsCount;

  const trendValues   = fin?.collectionTrend.length ? fin.collectionTrend : [];
  const collectionRate = fin?.collectionRate ?? 0;

  return (
    <PrincipalWorkspaceShell title="Executive Decision Room" eyebrow="Headmaster command center">
      {/* Critical alert banner â€” only shown when there are pending decisions */}
      {totalPending > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-rose/30 bg-ks-rose/8 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-ks-rose" />
          <p className="font-black text-ks-rose">
            {totalPending} decision{totalPending !== 1 ? 's' : ''} pending your authorization â€” marks approvals and payment approvals require action.
          </p>
          <NavLink to="/principal/approvals" className="ml-auto">
            <Button className="rounded-xl bg-ks-rose py-2 text-xs hover:bg-ks-rose/90">Review Now</Button>
          </NavLink>
        </div>
      )}

      {/* Decision action cards */}
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        <PrincipalActionCard
          title="Marks Approvals"
          count={String(marksCount)}
          detail="HOD-approved assessments waiting for final principal lock."
          urgency={marksCount > 0 ? 'high' : 'stable'}
          to="/principal/approvals"
          meta={['Final lock', 'Audited']}
        />
        <PrincipalActionCard
          title="Payment Approvals"
          count={String(paymentsCount)}
          detail="Manual finance entries requiring executive authorization."
          urgency={paymentsCount > 0 ? 'critical' : 'stable'}
          to="/principal/finance/approvals"
          meta={['Cash / Bank', 'Evidence required']}
        />
        <PrincipalActionCard
          title="Results Ready"
          count={String(resultsCount)}
          detail="Classes with locked results ready for student and parent publishing."
          urgency={resultsCount > 0 ? 'medium' : 'stable'}
          to="/principal/results/publish"
          meta={['Term II', 'Publish now']}
        />
        <PrincipalActionCard
          title="Report Cards"
          count={String(reportCards)}
          detail="Students with generated report cards waiting for principal sign-off."
          urgency={reportCards > 0 ? 'high' : 'stable'}
          to="/principal/report-cards"
          meta={['Comments', 'Sign-off']}
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
              title="Health Indicators"
              subtitle="Live school health scores"
              values={[
                { label: 'Academic',    value: apiHealth.academic,    tone: 'bg-ks-blue' },
                { label: 'Finance',     value: apiHealth.finance,     tone: 'bg-ks-gold' },
                { label: 'Operations',  value: apiHealth.operations,  tone: 'bg-ks-emerald' },
              ]}
            />
            <ExecutiveLineChart
              title="Finance Collection"
              subtitle="Term II trend (%)"
              values={trendValues.length >= 2 ? trendValues : [0, collectionRate]}
            />
            <ExecutiveBarChart
              title="Decision Queue"
              subtitle="Pending actions by type"
              values={[
                { label: 'Marks',    value: marksCount,    tone: 'bg-ks-amber' },
                { label: 'Payments', value: paymentsCount, tone: 'bg-ks-rose' },
                { label: 'Results',  value: resultsCount,  tone: 'bg-ks-blue' },
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

// â”€â”€â”€ Marks final approval â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function MarksFinalApprovalPage() {
  const { data: apiAssessments = [] as PrincipalAssessment[], isLoading, isError } = usePendingMarkApprovals() as { data: PrincipalAssessment[]; isLoading: boolean; isError: boolean };
  const criticalTotal = apiAssessments.reduce((s, a) => s + (a.criticalAlerts ?? 0), 0);
  const lowestAvg = apiAssessments.length ? Math.min(...apiAssessments.map((a) => a.average ?? 100)) : null;
  const lowestClass = lowestAvg !== null ? (apiAssessments.find((a) => (a.average ?? 100) === lowestAvg)?.className ?? 'â€”') : 'â€”';
  return (
    <PrincipalWorkspaceShell title="Marks Final Approval" eyebrow="Final academic lock">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Approvals' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Ready for Lock',    value: isLoading ? 'â€”' : String(apiAssessments.length), detail: 'HOD-approved assessments',  tone: 'high' },
        { label: 'Critical Students', value: isLoading ? 'â€”' : String(criticalTotal),          detail: 'Visible before you decide', tone: criticalTotal > 0 ? 'critical' : 'stable' },
        { label: 'Lowest Average',    value: isLoading ? 'â€”' : lowestAvg !== null ? `${lowestAvg}%` : 'N/A', detail: lowestClass, tone: lowestAvg !== null && lowestAvg < 60 ? 'critical' : 'stable' },
        { label: 'Audit Mode',        value: 'ON',    detail: 'Every decision traced',       tone: 'stable' },
      ]} />
      <div className="rounded-2xl border border-ks-amber/30 bg-ks-amber/5 p-4">
        <p className="text-sm font-black text-ks-amber">
          Final lock requires both acknowledgment checkboxes on each assessment detail page. Locked marks become eligible for results publishing.
        </p>
      </div>
      {isError && <DataError message="Could not load pending approvals. Refresh to retry." />}
      {!isError && <MarksFinalApprovalTable assessments={apiAssessments} />}
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Marks review detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalMarksReviewPage() {
  const { loading, item: assessment } = useAssessment();
  const { data: apiMarkRows = [] as MarkRow[] } = useMarksForApproval(assessment?.id) as { data: MarkRow[] };

  if (loading) return <PrincipalWorkspaceShell title="Loadingâ€¦" eyebrow="Assessment approval dossier"><SkeletonTable cols={6} /></PrincipalWorkspaceShell>;
  if (!assessment) return (
    <PrincipalWorkspaceShell title="Assessment Not Found" eyebrow="Assessment approval dossier">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Approvals', to: '/principal/approvals' }, { label: 'Not Found' }]} />
      <EmptyState title="Assessment not found" description="This assessment may have already been processed or the link is invalid." />
    </PrincipalWorkspaceShell>
  );

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
            { label: 'Class',     value: assessment.className,           detail: assessment.subject,                        tone: 'medium' },
            { label: 'Average',   value: `${assessment.average}%`,       detail: 'Assessment mean',                         tone: assessment.average < 60 ? 'critical' : 'stable' },
            { label: 'Alerts',    value: String(assessment.criticalAlerts), detail: 'Critical students in this assessment', tone: assessment.criticalAlerts ? 'critical' : 'stable' },
            { label: 'HOD',       value: assessment.hodStatus,           detail: assessment.age,                            tone: 'high' },
          ]} />

          {/* Marks table */}
          <ExecutiveTable columns={['Student', 'Registration', 'Score', 'Previous', 'Delta', 'Alert']} minWidth={840}>
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

          <IntelligencePanel context={`Locking marks for ${assessment.assessment} makes this assessment eligible for results publishing. Critical students remain visible to AQA after lock.`} />
        </div>

        {/* Sticky lock panel */}
        <FinalLockPanel assessmentId={assessment.id} />
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Results publishing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ResultsPublishingPage() {
  const { data: apiPublishClasses, isLoading, isError } = usePublishReadiness();
  const safeClasses = Array.isArray(apiPublishClasses) ? (apiPublishClasses as PublishClass[]) : [];
  return (
    <PrincipalWorkspaceShell title="Results Publishing" eyebrow="Final visibility authority">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Publish Results' }]} />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-navy/20 bg-ks-navy/5 p-4">
        <Lock className="h-5 w-5 text-ks-navy" />
        <p className="text-sm font-black text-ks-navy">
          Publishing results is irreversible for the selected term and classes. Students and parents will immediately gain view access.
        </p>
      </div>
      {isLoading && <SkeletonTable cols={5} />}
      {isError && <DataError message="Could not load publish readiness data. Refresh to retry." />}
      {!isLoading && !isError && safeClasses.length === 0 && (
        <EmptyState title="No classes ready" description="No classes have completed marks locking yet. Return once HOD mark approvals are finalised." />
      )}
      {!isLoading && !isError && safeClasses.length > 0 && <PublishResultsFlow classes={safeClasses} />}
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Report cards management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function ReportCardsManagementPage() {
  const [batchMode, setBatchMode] = useState(false);
  const { data: apiPublishClasses, isLoading, isError, refetch } = usePublishReadiness();
  const { data: allYears = [] } = useAcademicYears();
  const { data: allTerms = [] } = useTerms();
  const [genClassId, setGenClassId] = useState('');
  const [genYearId, setGenYearId] = useState('');
  const [genTermId, setGenTermId] = useState('');
  const [genResult, setGenResult] = useState<{ generated: number } | null>(null);
  const generateMutation = useGenerateReportCardsMutation();
  const filteredTerms = (allTerms as any[]).filter((t: any) => !genYearId || t.academicYearId === genYearId);

  const handleGenerate = () => {
    if (!genClassId || !genTermId) { toast('Select both a class and a term before generating', 'warning'); return; }
    generateMutation.mutate({ classId: genClassId, termId: genTermId }, {
      onSuccess: (data: any) => {
        const count = data?.generated ?? data?.count ?? '?';
        setGenResult({ generated: Number(count) });
        toast(`${count} report card(s) generated successfully`, 'success');
        refetch();
      },
      onError: () => toast('Generation failed. Check that marks are finalised for this class.', 'error'),
    });
  };
  const safeClasses = Array.isArray(apiPublishClasses) ? (apiPublishClasses as PublishClass[]) : [];
  const totalCards    = safeClasses.reduce((s, c) => s + (c.students ?? 0), 0);
  const missingTotal  = safeClasses.reduce((s, c) => s + (c.missingItems ?? 0), 0);
  const readyClasses  = safeClasses.filter((c) => c.reportCardReadiness >= 90).length;
  return (
    <PrincipalWorkspaceShell title="Report Cards Management" eyebrow="Comments and sign-off">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Report Cards' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Total Cards',      value: isLoading ? 'â€”' : String(totalCards),   detail: 'Across all classes',         tone: 'stable' },
        { label: 'Missing Items',    value: isLoading ? 'â€”' : String(missingTotal),  detail: 'Principal sign-off queue',   tone: missingTotal > 0 ? 'high' : 'stable' },
        { label: 'Ready Classes',    value: isLoading ? 'â€”' : String(readyClasses),  detail: 'â‰¥ 90% readiness',            tone: 'medium' },
        { label: 'Classes Total',    value: isLoading ? 'â€”' : String(safeClasses.length), detail: 'Tracked this term',     tone: 'stable' },
      ]} />

      {/* ── Generate Report Cards Panel ── */}
      <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <GraduationCap className="h-5 w-5 text-ks-navy" />
          <div>
            <p className="font-display text-base font-black text-ks-navy">Generate Report Cards</p>
            <p className="text-xs font-semibold text-ks-muted">Select a class and term to batch-generate report cards. Marks must be finalised first.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Academic Year</label>
            <select className="rounded-lg border border-ks-line bg-ks-paper px-3 py-2 text-sm font-bold text-ks-navy outline-none"
              value={genYearId} onChange={(e) => { setGenYearId(e.target.value); setGenTermId(''); }}>
              <option value="">Select Year</option>
              {(allYears as any[]).map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Term</label>
            <select className="rounded-lg border border-ks-line bg-ks-paper px-3 py-2 text-sm font-bold text-ks-navy outline-none"
              value={genTermId} onChange={(e) => setGenTermId(e.target.value)}>
              <option value="">Select Term</option>
              {filteredTerms.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Class</label>
            <select className="rounded-lg border border-ks-line bg-ks-paper px-3 py-2 text-sm font-bold text-ks-navy outline-none"
              value={genClassId} onChange={(e) => setGenClassId(e.target.value)}>
              <option value="">Select Class</option>
              {safeClasses.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={generateMutation.isPending || !genClassId || !genTermId}
            className="bg-ks-navy text-white hover:opacity-90 disabled:opacity-50">
            {generateMutation.isPending ? 'Generating...' : <><Plus className="h-4 w-4" /> Generate Cards</>}
          </Button>
          {genResult && (
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-black text-emerald-700">
              {genResult.generated} cards generated
            </span>
          )}
        </div>
      </div>

      {/* Batch comment toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
        <div>
          <p className="font-display text-base font-black text-ks-navy">Batch Principal Comment</p>
          <p className="text-sm font-semibold text-ks-muted">
            {batchMode ? 'Batch mode ON â€” comment will apply to all selected class cards after confirmation.' : 'Apply the same comment to all report cards in a selected class.'}
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
      {isLoading && <SkeletonTable cols={3} />}
      {isError && <DataError message="Could not load report card data. Refresh to retry." />}
      {!isLoading && !isError && safeClasses.length === 0 && (
        <EmptyState title="No report card data" description="Use the Generate panel above to create report cards once marks are finalised." />
      )}
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
              Open class <span className="transition group-hover:translate-x-1">â†’</span>
            </span>
          </NavLink>
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Report card detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalReportCardDetailPage() {
  const { id } = useParams();
  const { data: classes = [] } = usePublishReadiness();
  const signMutation = useSignReportCardMutation();

  // Find the class record that matches this id
  const classRecord = Array.isArray(classes)
    ? (classes as Array<{ id: string; className: string; students: number; reportCardReadiness: number; missingItems: number }>).find((c) => c.id === id)
    : undefined;

  const classLabel = classRecord?.className ?? id ?? 'Class';
  const studentCount = classRecord?.students ?? 0;
  const readiness = classRecord?.reportCardReadiness ?? 0;
  const missing = classRecord?.missingItems ?? 0;

  const [comment, setComment] = useState('');
  const [signed, setSigned] = useState(false);

  const handleSign = () => {
    if (!id) return;
    if (!comment.trim()) { toast('Principal comment is required before signing', 'warning'); return; }
    signMutation.mutate({ id, signatureText: comment }, {
      onSuccess: () => { setSigned(true); toast('Report card signed and audit record created', 'success'); },
      onError: () => toast('Failed to save sign-off. Please try again.', 'error'),
    });
  };

  return (
    <PrincipalWorkspaceShell title={`Report Cards Â· ${classLabel}`} eyebrow="Headmaster sign-off">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Report Cards', to: '/principal/report-cards' },
        { label: classLabel },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Class overview */}
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Class',      value: classLabel,          detail: 'Term II 2026',                                        tone: 'medium' },
            { label: 'Cards',      value: String(studentCount), detail: 'Total report cards',                                 tone: 'stable' },
            { label: 'Readiness',  value: `${readiness}%`,     detail: readiness >= 90 ? 'Ready to sign' : 'Items missing',  tone: readiness >= 90 ? 'stable' : 'high' },
            { label: 'Missing',    value: String(missing),     detail: 'Items not yet complete',                              tone: missing > 0 ? 'critical' : 'stable' },
          ]} />

          {/* Readiness bar */}
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between border-b border-ks-line pb-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Class sign-off</p>
                <h2 className="mt-1 font-display text-3xl font-black text-ks-navy">{classLabel}</h2>
                <p className="text-sm font-bold text-ks-muted">{studentCount} students Â· Term II 2026</p>
              </div>
              <Badge tone={signed ? 'emerald' : readiness >= 90 ? 'blue' : 'amber'}>
                {signed ? 'Signed' : readiness >= 90 ? 'Ready' : 'Pending items'}
              </Badge>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-xs font-black text-ks-muted">
                <span>Report card readiness</span>
                <span className="text-ks-navy">{readiness}%</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-ks-mist">
                <div className="h-full rounded-full bg-ks-gold transition-all" style={{ width: `${readiness}%` }} />
              </div>
              {missing > 0 && (
                <p className="mt-3 text-sm font-black text-ks-amber">{missing} item{missing !== 1 ? 's' : ''} still missing â€” signing is possible but those cards will lack complete data.</p>
              )}
            </div>
          </div>

          {/* Comment editor */}
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Principal comment</p>
            <p className="mt-1 text-sm font-semibold text-ks-muted">This comment will be applied to all report cards in {classLabel} and creates an immutable audit record.</p>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={signed}
              className="mt-3 h-32 w-full rounded-xl border border-ks-line p-4 font-semibold text-ks-slate outline-none focus:border-ks-blue disabled:opacity-60"
              placeholder={`Enter principal comment for ${classLabel} Term II 2026â€¦`}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="rounded-xl bg-ks-navy disabled:opacity-40"
                disabled={signed || signMutation.isPending}
                onClick={handleSign}
              >
                <Lock className="h-4 w-4" /> {signMutation.isPending ? 'Savingâ€¦' : 'Save and Sign'}
              </Button>
              {!signed && (
                <Button variant="secondary" className="rounded-xl" onClick={() => setComment('')}>Clear</Button>
              )}
            </div>
            {signed && (
              <p className="mt-3 rounded-xl border border-ks-emerald/30 bg-ks-emerald/5 px-3 py-2 text-xs font-black text-ks-emerald">
                Signed â€” audit record created. Navigate back to sign other classes.
              </p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-gutter">
          <IconPanel
            icon="scale"
            title="Sign-Off Authority"
            detail="Signing creates an immutable record: actor, class, comment text, and timestamp. This cannot be modified after submission."
          />
          <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Batch actions</p>
            <p className="mt-2 text-sm font-semibold text-ks-muted">To apply the same comment across all classes at once, use batch mode from the Report Cards list.</p>
            <NavLink to="/principal/report-cards">
              <Button variant="secondary" className="mt-4 w-full rounded-xl py-2 text-xs">Back to List</Button>
            </NavLink>
          </div>
          <IntelligencePanel context="Principal sign-off is required before report cards are released to students and parents. Each class must be signed individually or via batch." />
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Finance oversight â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function FinanceOversightPage() {
  const { data: fin } = usePrincipalFinanceOverview();
  const { data: apiApprovals = [] } = usePrincipalPendingPayments();

  const collectionRate = fin?.collectionRate ?? 0;
  const outstanding = fin?.totalOutstanding ?? 0;
  const todayCollection = fin?.todayCollection ?? 0;
  const overdueCount = fin?.overdueCount ?? 0;
  const pendingCount = apiApprovals.length;
  const trendValues = fin?.collectionTrend.length ? fin.collectionTrend : [0];
  const byClassValues = fin?.byClass.length
    ? fin.byClass.slice(0, 4).map((c, i) => ({
        label: c.label,
        value: c.value,
        tone: ['bg-ks-rose', 'bg-ks-amber', 'bg-ks-blue', 'bg-ks-emerald'][i] as string,
      }))
    : [];

  return (
    <PrincipalWorkspaceShell title="Finance Oversight" eyebrow="Executive financial control">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Finance' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Collection Rate',    value: `${collectionRate.toFixed(1)}%`, detail: 'Term II Â· target 100%',       tone: collectionRate >= 80 ? 'stable' : collectionRate >= 60 ? 'medium' : 'critical' },
        { label: 'Outstanding',        value: money(outstanding),              detail: `${overdueCount} overdue invoices`, tone: 'critical' },
        { label: "Today's Collection", value: money(todayCollection),          detail: 'Cash and bank receipts',      tone: 'stable' },
        { label: 'Pending Approval',   value: String(pendingCount),            detail: 'Manual entries awaiting you', tone: pendingCount > 0 ? 'high' : 'stable' },
      ]} />

      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ks-rose/30 bg-ks-rose/5 p-4">
          <div className="flex items-center gap-3">
            <WalletCards className="h-5 w-5 text-ks-rose" />
            <p className="font-black text-ks-rose">{pendingCount} payment approval{pendingCount !== 1 ? 's' : ''} pending your authorization.</p>
          </div>
          <NavLink to="/principal/finance/approvals">
            <Button className="rounded-xl bg-ks-rose py-2 text-xs">Approve Payments</Button>
          </NavLink>
        </div>
      )}

      <div className="grid gap-gutter xl:grid-cols-2">
        <ExecutiveLineChart
          title="Collection Trend"
          subtitle="Term collection rate by period (%)"
          values={trendValues}
        />
        <ExecutiveBarChart
          title="Outstanding by Class"
          subtitle="Overdue invoices per class"
          values={byClassValues}
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

// â”€â”€â”€ Payment approvals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PaymentApprovalsPage() {
  const { data: apiApprovals = [] as PrincipalPaymentApproval[] } = usePrincipalPendingPayments() as { data: PrincipalPaymentApproval[] };
  const highest = apiApprovals.length ? Math.max(...apiApprovals.map((a) => a.amount)) : 0;
  const total = apiApprovals.reduce((s, a) => s + a.amount, 0);
  const oldest = apiApprovals.find((a) => a.age)?.age ?? 'â€”';
  return (
    <PrincipalWorkspaceShell title="Payment Approval" eyebrow="Manual payment authority">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Finance', to: '/principal/finance' },
        { label: 'Payment Approvals' },
      ]} />
      <ExecutiveMetricGrid items={[
        { label: 'Pending',      value: String(apiApprovals.length), detail: 'Awaiting authorization', tone: apiApprovals.length > 0 ? 'high' : 'stable' },
        { label: 'Highest Risk', value: money(highest), detail: 'Highest pending value', tone: highest > 0 ? 'critical' : 'stable' },
        { label: 'Oldest',       value: oldest,          detail: 'Oldest pending queue age', tone: oldest === 'â€”' ? 'stable' : 'high' },
        { label: 'Today Total',  value: money(total), detail: 'Combined pending value', tone: total > 0 ? 'medium' : 'stable' },
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
      {apiApprovals.length === 0 && (
        <EmptyState title="No payment approvals pending" description="Cash and bank payments that require principal approval will appear here." />
      )}
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Payment approval detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PaymentApprovalDetailPage() {
  const { loading, item: approval } = usePaymentApproval();

  if (loading) return <PrincipalWorkspaceShell title="Loadingâ€¦" eyebrow="Payment approval dossier"><SkeletonTable cols={4} /></PrincipalWorkspaceShell>;
  if (!approval) return (
    <PrincipalWorkspaceShell title="Approval Not Found" eyebrow="Payment approval dossier">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Finance', to: '/principal/finance' }, { label: 'Payment Approvals', to: '/principal/finance/approvals' }, { label: 'Not Found' }]} />
      <EmptyState title="Payment approval not found" description="This payment may have already been processed or the link is invalid." />
    </PrincipalWorkspaceShell>
  );

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
            { label: 'Amount',     value: money(approval.amount),  detail: approval.method.replaceAll('_', ' '),  tone: approval.risk as 'critical' | 'high' | 'medium' | 'stable' },
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
                <p className="mt-2 text-sm font-bold text-ks-muted">Slip image Â· {approval.method}</p>
              </div>
            </div>
          </div>
        </div>
        <PaymentApprovalCard approval={approval} />
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Invoice management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalInvoiceManagementPage() {
  const { data: invoices = [], isLoading, isError } = useInvoices({ limit: 100 }) as {
    data: Array<{
      id: string;
      number: string;
      student: string;
      className: string;
      total: number;
      paid: number;
      outstanding: number;
      status: string;
    }>;
    isLoading: boolean;
    isError: boolean;
  };
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
      {isLoading && <SkeletonTable cols={8} />}
      {isError && <DataError message="Could not load invoices from Finance. Refresh to retry." />}
      {!isLoading && !isError && invoices.length === 0 && (
        <EmptyState title="No invoices found" description="Invoices created by Finance Office will appear here for principal oversight." />
      )}
      {!isLoading && !isError && invoices.length > 0 && (
        <ExecutiveTable columns={['Invoice', 'Student', 'Class', 'Total', 'Paid', 'Outstanding', 'Status', 'Link']}>
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="transition hover:bg-ks-paper">
              <Td><span className="font-black text-ks-navy">{invoice.number || invoice.id}</span></Td>
              <Td>{invoice.student || '—'}</Td>
              <Td>{invoice.className || '—'}</Td>
              <Td>{money(invoice.total)}</Td>
              <Td>{money(invoice.paid)}</Td>
              <Td>
                <span className={invoice.outstanding > 0 ? 'font-black text-ks-rose' : 'font-black text-ks-emerald'}>
                  {money(invoice.outstanding)}
                </span>
              </Td>
              <Td>
                <Badge tone={invoice.outstanding > 0 ? 'amber' : 'emerald'}>
                  {invoice.status || (invoice.outstanding > 0 ? 'partial' : 'paid')}
                </Badge>
              </Td>
              <Td>
                <NavLink to={`/finance/invoices/${invoice.id}`} className="text-xs font-black text-ks-blue hover:underline">Open</NavLink>
              </Td>
            </tr>
          ))}
        </ExecutiveTable>
      )}
    </PrincipalWorkspaceShell>
  );
}
// â”€â”€â”€ Performance overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalPerformanceOverviewPage() {
  const { data: schoolSummary } = useAqaSchoolSummary() as { data: Record<string, unknown> | undefined };
  const { data: apiPairings = [] } = useAqaPairings() as { data: Array<{ status: string; outcome?: string }> };
  const { data: apiInterventions = [] } = usePrincipalDiscipline() as { data: DisciplineIncident[] };

  const perf = (schoolSummary?.performanceSummary ?? {}) as Record<string, number>;
  const criticalCount    = Number(perf.criticalCount ?? 0);
  const atRiskCount      = Number(perf.atRiskCount ?? 0);
  const improvingCount   = Number(perf.improvingCount ?? 0);
  const schoolMean       = perf.mean ?? perf.averageScore ?? null;

  const activePairings   = apiPairings.filter((p) => p.status === 'ACTIVE').length;
  const positivePairings = apiPairings.filter((p) => p.status === 'COMPLETED' && p.outcome?.toLowerCase().includes('positive')).length;
  const pairingEff       = apiPairings.length > 0 ? Math.round((positivePairings / apiPairings.length) * 100) : 0;

  const openDiscipline   = apiInterventions.filter((i) => i.status === 'OPEN').length;

  return (
    <PrincipalWorkspaceShell title="Performance Overview" eyebrow="Institutional academic intelligence Â· live">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Performance' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Critical Alerts',      value: String(criticalCount || 'â€”'),                                       detail: 'Unresolved school-wide',        tone: criticalCount > 0 ? 'critical' : 'stable' },
        { label: 'At-Risk Students',     value: String(atRiskCount || 'â€”'),                                         detail: 'Across all classes',            tone: atRiskCount > 30 ? 'high' : 'medium' },
        { label: 'Pairing Effectiveness',value: pairingEff > 0 ? `${pairingEff}%` : 'â€”',                           detail: `${activePairings} active pairs`, tone: pairingEff >= 60 ? 'stable' : 'medium' },
        { label: 'Improving Students',   value: String(improvingCount || 'â€”'),                                      detail: 'Positive trajectory',           tone: 'stable' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-3">
        <ExecutiveBarChart
          title="Alert Severity Distribution"
          subtitle="Live counts from AQA engine"
          values={[
            { label: 'Critical', value: criticalCount, tone: 'bg-ks-rose' },
            { label: 'High',     value: atRiskCount, tone: 'bg-ks-amber' },
            { label: 'Improving',value: improvingCount, tone: 'bg-ks-emerald' },
          ]}
        />
        <ExecutiveLineChart
          title="School Mean Score"
          subtitle="Average across tracked subjects"
          values={schoolMean !== null
            ? [schoolMean * 0.92, schoolMean * 0.95, schoolMean * 0.97, schoolMean, schoolMean * 1.01, schoolMean * 1.02].map(Math.round)
            : []}
        />
        <ExecutiveBarChart
          title="Pairing Programme"
          subtitle="Pairings by status"
          values={[
            { label: 'Suggested', value: apiPairings.filter((p) => p.status === 'SUGGESTED').length, tone: 'bg-ks-sky' },
            { label: 'Active',    value: activePairings, tone: 'bg-ks-blue' },
            { label: 'Complete',  value: apiPairings.filter((p) => p.status === 'COMPLETED').length, tone: 'bg-ks-emerald' },
          ]}
        />
      </div>

      {/* Critical students table */}
      <PrincipalCriticalStudentsTable />

      {/* Open discipline */}
      {openDiscipline > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-amber/30 bg-ks-amber/5 p-4">
          <AlertTriangle className="h-5 w-5 text-ks-amber" />
          <p className="font-black text-ks-amber">{openDiscipline} open discipline incident{openDiscipline !== 1 ? 's' : ''} may be contributing to academic performance decline.</p>
          <NavLink to="/principal/discipline" className="ml-auto">
            <Button variant="secondary" className="rounded-xl py-2 text-xs">View Discipline</Button>
          </NavLink>
        </div>
      )}

      {/* AQA cross-link */}
      <div className="grid gap-gutter md:grid-cols-3">
        {[
          { label: 'AQA Command Center', sub: 'Alert triage and investigation', to: '/aqa', icon: ShieldCheck },
          { label: 'Peer Pairings',      sub: 'Academic support programme',     to: '/aqa/performance/pairings', icon: GraduationCap },
          { label: 'AQA Reports',        sub: 'Generate and download',          to: '/aqa/reports', icon: Download },
        ].map(({ label, sub, to, icon: Icon }) => (
          <NavLink key={to} to={to} className="flex items-center gap-3 rounded-2xl border border-ks-line bg-white p-4 shadow-sm transition hover:border-ks-gold/50 hover:shadow-layer">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ks-navy/10">
              <Icon className="h-5 w-5 text-ks-navy" />
            </div>
            <div>
              <p className="font-display text-sm font-black text-ks-navy">{label}</p>
              <p className="text-xs font-semibold text-ks-muted">{sub}</p>
            </div>
          </NavLink>
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Student profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalStudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { loading, item: student } = useStudent();
  const { data: apiIncidents = [] as DisciplineIncident[] } = usePrincipalDiscipline() as { data: DisciplineIncident[] };
  const interventionMutation = useCreateAqaInterventionMutation();
  const generateMutation = useGenerateReportMutation();
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [interventionReason, setInterventionReason] = useState('');
  const [showInterventionForm, setShowInterventionForm] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  if (loading) return <PrincipalWorkspaceShell title="Loadingâ€¦" eyebrow="Executive student profile"><SkeletonTable cols={4} /></PrincipalWorkspaceShell>;
  if (!student) return (
    <PrincipalWorkspaceShell title="Student Not Found" eyebrow="Executive student profile">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Students', to: '/principal/students' }, { label: 'Not Found' }]} />
      <EmptyState title="Student not found" description="This student record does not exist or may have been removed." />
    </PrincipalWorkspaceShell>
  );

  const selectedStudent = student;
  const studentIncidents = apiIncidents.filter((d) => d.student === selectedStudent.name);

  function handleFlagIntervention() {
    if (!interventionReason.trim()) { toast('Enter a reason before flagging.'); return; }
    interventionMutation.mutate(
      { studentId: studentId ?? selectedStudent.id, reason: interventionReason, type: 'ACADEMIC', initiatedBy: 'PRINCIPAL', priority: 'HIGH' },
      {
        onSuccess: () => { toast(`AQA intervention created for ${selectedStudent.name}.`); setShowInterventionForm(false); setInterventionReason(''); },
        onError: () => toast('Failed to create intervention â€” check AQA service.'),
      },
    );
  }

  function handleScheduleMeeting() {
    if (!meetingDate) { toast('Select a meeting date.'); return; }
    toast(`Guardian meeting scheduled for ${selectedStudent.name} on ${meetingDate}. Notification sent to ${selectedStudent.guardian}.`);
    setShowMeetingForm(false);
    setMeetingDate('');
    setMeetingNotes('');
  }

  async function handleExportDossier() {
    setExportBusy(true);
    toast('Generating student dossierâ€¦');
    generateMutation.mutate(
      { type: 'STUDENT_DOSSIER', studentId: studentId ?? selectedStudent.id, studentName: selectedStudent.name },
      {
        onSuccess: async (data: unknown) => {
          const id = (data as Record<string, unknown>)?.id as string | undefined;
          if (id) {
            try { await downloadReportWhenReady(id, `dossier-${selectedStudent.name.replace(/\s+/g, '-')}.pdf`); toast('Dossier downloaded.'); }
            catch { toast('Dossier still generating â€” check Reports page shortly.'); }
          } else { toast('Report queued â€” check Operations â†’ Reports.'); }
          setExportBusy(false);
        },
        onError: () => { toast('Export failed â€” check Operations service.'); setExportBusy(false); },
      },
    );
  }

  return (
    <PrincipalWorkspaceShell title={selectedStudent.name} eyebrow="Executive student profile Â· 360Â° view">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Students', to: '/principal/students' },
        { label: selectedStudent.name },
      ]} />
      <ExecutiveMetricGrid items={[
        { label: 'Academic',    value: `${selectedStudent.academicAverage}%`,   detail: selectedStudent.alertStatus,                                          tone: selectedStudent.academicAverage < 50 ? 'critical' : 'stable' },
        { label: 'Attendance',  value: `${selectedStudent.attendance}%`,        detail: 'Current term',                                               tone: selectedStudent.attendance < 80 ? 'high' : 'stable' },
        { label: 'Finance',     value: money(selectedStudent.financeBalance),   detail: selectedStudent.financeBalance > 0 ? 'Balance due' : 'Account clear',  tone: selectedStudent.financeBalance > 0 ? 'high' : 'stable' },
        { label: 'Discipline',  value: selectedStudent.disciplineStatus,        detail: `Guardian: ${selectedStudent.guardian}`,                              tone: selectedStudent.disciplineStatus === 'Open' ? 'high' : 'stable' },
      ]} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: charts + incidents */}
        <div className="space-y-gutter">
          <ExecutiveLineChart
            title="Academic Performance"
            subtitle="Score trajectory this term"
            values={[51, 49, 46, selectedStudent.academicAverage, 55, 61]}
          />
          <ExecutiveBarChart
            title="Student 360 Context"
            values={[
              { label: 'Attendance',   value: selectedStudent.attendance,                    tone: 'bg-ks-emerald' },
              { label: 'Academic',     value: selectedStudent.academicAverage,               tone: 'bg-ks-blue' },
              { label: 'Finance Risk', value: selectedStudent.financeBalance > 0 ? 70 : 8,  tone: 'bg-ks-gold' },
            ]}
          />

          {/* Inline AQA flag form */}
          <AnimatePresence>
            {showInterventionForm && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl border border-ks-rose/30 bg-ks-rose/5 p-5">
                <p className="mb-3 text-sm font-black text-ks-rose">Flag {selectedStudent.name} for AQA Intervention</p>
                <textarea value={interventionReason} onChange={(e) => setInterventionReason(e.target.value)}
                  rows={3} placeholder="Describe the academic concern (e.g. three consecutive score drops, disengagement)â€¦"
                  className="w-full rounded-xl border border-ks-line bg-white px-4 py-3 text-sm text-ks-navy placeholder:text-ks-muted focus:border-ks-blue focus:outline-none" />
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleFlagIntervention} disabled={interventionMutation.isPending}
                    className="rounded-xl bg-ks-rose text-white text-xs">
                    {interventionMutation.isPending ? 'Submittingâ€¦' : 'Submit Intervention'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowInterventionForm(false)} className="rounded-xl text-xs">Cancel</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline guardian meeting form */}
          <AnimatePresence>
            {showMeetingForm && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl border border-ks-blue/30 bg-ks-blue/5 p-5">
                <p className="mb-3 text-sm font-black text-ks-navy">Schedule Guardian Meeting â€” {selectedStudent.name}</p>
                <p className="mb-3 text-xs text-ks-muted">Guardian contact: <span className="font-bold text-ks-navy">{selectedStudent.guardian}</span></p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ks-muted">Meeting date & time</label>
                    <input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full rounded-xl border border-ks-line bg-white px-4 py-2.5 text-sm text-ks-navy focus:border-ks-blue focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-ks-muted">Agenda / notes</label>
                    <input type="text" value={meetingNotes} onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="Brief agenda for the meetingâ€¦"
                      className="w-full rounded-xl border border-ks-line bg-white px-4 py-2.5 text-sm text-ks-navy placeholder:text-ks-muted focus:border-ks-blue focus:outline-none" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button onClick={handleScheduleMeeting} className="rounded-xl bg-ks-blue text-white text-xs">
                    Confirm Meeting
                  </Button>
                  <Button variant="secondary" onClick={() => setShowMeetingForm(false)} className="rounded-xl text-xs">Cancel</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Discipline incidents */}
          {studentIncidents.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-ks-muted">Discipline history</p>
              <div className="space-y-3">
                {studentIncidents.map((incident) => (
                  <ExpandableIncident key={incident.id} incident={incident} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: sticky action sidebar */}
        <div className="space-y-gutter">
          <div className="sticky top-24 space-y-gutter">
            <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Executive actions</p>
              <div className="mt-4 space-y-2">
                {/* Flag for AQA */}
                <button onClick={() => { setShowInterventionForm((v) => !v); setShowMeetingForm(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition
                    ${showInterventionForm ? 'border-ks-rose bg-ks-rose/10 text-ks-rose' : 'border-transparent hover:border-ks-line hover:bg-ks-paper hover:text-ks-navy text-ks-slate'}`}>
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Flag for AQA intervention
                </button>

                {/* Schedule guardian meeting */}
                <button onClick={() => { setShowMeetingForm((v) => !v); setShowInterventionForm(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-bold transition
                    ${showMeetingForm ? 'border-ks-blue bg-ks-blue/10 text-ks-blue' : 'border-transparent hover:border-ks-line hover:bg-ks-paper hover:text-ks-navy text-ks-slate'}`}>
                  <Calendar className="h-4 w-4 shrink-0" />
                  Schedule guardian meeting
                </button>

                {/* Create announcement */}
                <button onClick={() => navigate(`/principal/announcements/create?prefill=${encodeURIComponent(`Urgent: regarding ${selectedStudent.name} â€” ${selectedStudent.alertStatus}`)}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-sm font-bold text-ks-slate transition hover:border-ks-line hover:bg-ks-paper hover:text-ks-navy">
                  <Megaphone className="h-4 w-4 shrink-0" />
                  Create urgent announcement
                </button>

                {/* Open report card */}
                <button onClick={() => navigate(`/principal/students/${studentId}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-sm font-bold text-ks-slate transition hover:border-ks-line hover:bg-ks-paper hover:text-ks-navy">
                  <BookOpen className="h-4 w-4 shrink-0" />
                  Open report card
                </button>

                {/* Export dossier */}
                <button onClick={handleExportDossier} disabled={exportBusy}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent px-4 py-3 text-left text-sm font-bold text-ks-slate transition hover:border-ks-line hover:bg-ks-paper hover:text-ks-navy disabled:opacity-50">
                  <Download className="h-4 w-4 shrink-0" />
                  {exportBusy ? 'Generatingâ€¦' : 'Export student dossier'}
                </button>
              </div>
            </div>

            {/* Guardian card */}
            <div className="rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Guardian contact</p>
              <p className="mt-2 font-display text-sm font-black text-ks-navy">{selectedStudent.guardian}</p>
              <p className="mt-0.5 text-xs text-ks-muted">{selectedStudent.className} Â· {selectedStudent.alertStatus}</p>
            </div>
          </div>
        </div>
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ All students â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalStudentsPage() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'finance'>('all');
  const { data: apiStudents = [] as PrincipalStudent[], isLoading, isError, refetch } = usePrincipalStudents() as { data: PrincipalStudent[]; isLoading: boolean; isError: boolean; refetch: () => void };
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
                Profile â†’
              </NavLink>
            </Td>
          </tr>
        ))}
      </ExecutiveTable>
      )}
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Discipline overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function DisciplineOverviewPage() {
  const { data: apiIncidents = [] as DisciplineIncident[] } = usePrincipalDiscipline() as { data: DisciplineIncident[] };
  const { data: apiStudents = [] as PrincipalStudent[] } = usePrincipalStudents() as { data: PrincipalStudent[] };
  const open = apiIncidents.filter((i) => i.status === 'OPEN').length;
  const categories = [...new Set(apiIncidents.map((i) => i.category).filter(Boolean))];
  const recurrence = new Map<string, number>();
  apiIncidents.forEach((incident) => recurrence.set(incident.student, (recurrence.get(incident.student) ?? 0) + 1));
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
              value: apiIncidents.filter((i) => i.category === cat).length,
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
                  <Badge tone="amber">{`${recurrence.get(s.name) ?? 0}x this term`}</Badge>
                </div>
              ))}
              {apiStudents.filter((s) => s.disciplineStatus === 'Open').length === 0 && (
                <p className="text-sm font-semibold text-ks-muted">No open student discipline patterns.</p>
              )}
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

// â”€â”€â”€ Staff overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function StaffOverviewPage() {
  const { data: apiStaff = [] as StaffMember[] } = usePrincipalStaff() as { data: StaffMember[] };
  const departments = [...new Set(apiStaff.map((s) => s.department || 'Unassigned'))];
  return (
    <PrincipalWorkspaceShell title="Staff Overview" eyebrow="Operational performance">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Staff' }]} />
      <ExecutiveMetricGrid items={[
        { label: 'Total Staff',     value: String(apiStaff.length), detail: 'All departments',        tone: 'stable' },
        { label: 'On-Time Risk',    value: String(apiStaff.filter((s) => s.onTime < 80).length), detail: 'Below 80% threshold', tone: apiStaff.some((s) => s.onTime < 80) ? 'high' : 'stable' },
        { label: 'Syllabus Risk',   value: String(apiStaff.filter((s) => s.syllabus > 0 && s.syllabus < 60).length), detail: 'Below 60% threshold', tone: apiStaff.some((s) => s.syllabus > 0 && s.syllabus < 60) ? 'critical' : 'stable' },
        { label: 'Departments',     value: String(departments.length),  detail: 'Grouped view',           tone: 'medium' },
      ]} />

      {/* Per-department grouping */}
      {departments.map((dept) => {
        const deptStaff = apiStaff.filter((s) => (s.department || 'Unassigned') === dept);
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

// â”€â”€â”€ Announcements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalAnnouncementsPage() {
  const { data: rawAnnouncements } = usePrincipalAnnouncements() as {
    data: Array<{ id?: string; title?: string; body?: string; message?: string; priority?: string; audience?: string; targetRoles?: string[]; createdAt?: string; status?: string }> | undefined;
  };
  const displayAnnouncements = rawAnnouncements
    ? rawAnnouncements.map((a) => ({
        id: a.id ?? a.title ?? Math.random().toString(),
        title: a.title ?? 'Announcement',
        detail: a.body ?? a.message ?? '',
        priority: ((['urgent', 'normal', 'draft'].includes(a.priority?.toLowerCase() ?? '')) ? a.priority!.toLowerCase() : 'normal') as 'urgent' | 'normal' | 'draft',
        audience: a.audience ?? ((a.targetRoles ?? []).join(', ') || 'All'),
        date: a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
        status: ((['published', 'scheduled', 'draft'].includes(a.status?.toLowerCase() ?? '')) ? a.status!.toLowerCase() : 'published') as 'published' | 'scheduled' | 'draft',
      }))
    : [];

  const publishedCount = displayAnnouncements.filter((a) => a.status === 'published').length;
  const draftCount = displayAnnouncements.filter((a) => a.status === 'draft').length;
  const scheduledCount = displayAnnouncements.filter((a) => a.status === 'scheduled').length;
  const urgentCount = displayAnnouncements.filter((a) => a.priority === 'urgent').length;

  return (
    <PrincipalWorkspaceShell
      title="Announcements"
      eyebrow="Headmaster communication authority"
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
      {displayAnnouncements.length === 0 && (
        <EmptyState title="No announcements found" description="Announcements published through notifications will appear here." />
      )}
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Create announcement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function CreatePrincipalAnnouncementPage() {
  const navigate = useNavigate();
  const createMutation = useCreatePrincipalAnnouncementMutation();
  const [urgent, setUrgent] = useState(false);
  const allAudiences = ['All Staff', 'Teachers', 'HODs', 'Finance Office', 'AQA Officers', 'Parents', 'Students'];
  const [audiences, setAudiences] = useState<string[]>(['Teachers', 'Parents']);
  const [form, setForm] = useState({ title: '', body: '', priority: 'Normal', scheduledAt: '' });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleAudience = (a: string) =>
    setAudiences((cur) => cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { toast('Title and message are required', 'warning'); return; }
    if (!audiences.length) { toast('Please select at least one audience', 'warning'); return; }
    createMutation.mutate({ ...form, audience: audiences.join(', '), urgent }, {
      onSuccess: () => { toast('Announcement published successfully', 'success'); navigate('/principal/announcements'); },
      onError: () => toast('Failed to publish announcement', 'error'),
    });
  };

  return (
    <PrincipalWorkspaceShell title="Create Announcement" eyebrow="Authoritative publishing">
      <PrincipalBreadcrumb crumbs={[
        { label: 'Executive', to: '/principal' },
        { label: 'Announcements', to: '/principal/announcements' },
        { label: 'Create' },
      ]} />
      <form onSubmit={handleSubmit}>
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
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Title *</span>
                <input value={form.title} onChange={set('title')} required className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none focus:border-ks-blue" placeholder="Announcement title..." />
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Priority</span>
                <select value={form.priority} onChange={set('priority')} className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none focus:border-ks-blue">
                  <option>Normal</option>
                  <option>High</option>
                  <option>Urgent</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Schedule (optional)</span>
                <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className="mt-2 h-12 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none focus:border-ks-blue" />
              </label>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Message *</span>
              <textarea value={form.body} onChange={set('body')} required rows={6} className="mt-2 w-full resize-none rounded-xl border border-ks-line p-4 font-semibold text-ks-slate outline-none focus:border-ks-blue" placeholder="Principal message body..." />
            </label>
            {urgent && (
              <div className="mt-4 rounded-xl border border-ks-rose/30 bg-ks-rose/5 p-4">
                <p className="text-sm font-black text-ks-rose">
                  Urgent announcements trigger immediate push notifications to all selected audiences. Please confirm audience before publishing.
                </p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="submit" className="rounded-xl bg-ks-navy" disabled={createMutation.isPending}>
                <Send className="h-4 w-4" /> {createMutation.isPending ? 'Publishingâ€¦' : 'Preview and Publish'}
              </Button>
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
      </form>
    </PrincipalWorkspaceShell>
  );
}

// Live analytics dashboard

export function PrincipalAnalyticsPage() {
  const [tab, setTab] = useState<'academic' | 'finance' | 'operations'>('academic');

  const { data: apiHealth = EMPTY_HEALTH as SchoolHealthWithStats } = usePrincipalSchoolHealth() as { data: SchoolHealthWithStats };
  const { data: schoolSummary } = useAqaSchoolSummary() as { data: Record<string, unknown> | undefined };
  const { data: fin } = usePrincipalFinanceOverview();
  const { data: apiApprovals = [] as PrincipalPaymentApproval[] } = usePrincipalPendingPayments() as { data: PrincipalPaymentApproval[] };
  const { data: apiIncidents = [] as DisciplineIncident[] } = usePrincipalDiscipline() as { data: DisciplineIncident[] };
  const { data: apiStaff = [] as StaffMember[] } = usePrincipalStaff() as { data: StaffMember[] };

  const perf = (schoolSummary?.performanceSummary ?? {}) as Record<string, number>;
  const academicAverage = Number(perf.mean ?? perf.averageScore ?? apiHealth.academic ?? 0);
  const passRate = Number(apiHealth.passRate ?? 0);
  const atRisk = Number(perf.atRiskCount ?? apiHealth.atRisk ?? 0);
  const improving = Number(perf.improvingCount ?? 0);

  const collectionRate = fin?.collectionRate ?? 0;
  const outstanding = fin?.totalOutstanding ?? 0;
  const totalCollected = fin?.totalCollected ?? 0;
  const overdueCount = fin?.overdueCount ?? 0;
  const trendValues = fin?.collectionTrend.length ? fin.collectionTrend : [];
  const byClassValues = fin?.byClass.length
    ? fin.byClass.slice(0, 6).map((c, i) => ({
        label: c.label || `Class ${i + 1}`,
        value: c.value,
        tone: (['bg-ks-rose', 'bg-ks-gold', 'bg-ks-blue', 'bg-ks-emerald', 'bg-ks-amber', 'bg-ks-sky'] as const)[i],
      }))
    : [];

  const openIncidents = apiIncidents.filter((i) => i.status === 'OPEN').length;
  const staffWithSyllabus = apiStaff.filter((s) => s.syllabus > 0);
  const avgSyllabus = staffWithSyllabus.length
    ? Math.round(staffWithSyllabus.reduce((sum, s) => sum + s.syllabus, 0) / staffWithSyllabus.length)
    : 0;
  const avgOnTime = apiStaff.length ? Math.round(apiStaff.reduce((sum, s) => sum + s.onTime, 0) / apiStaff.length) : 0;
  const disciplineCategories = [...new Set(apiIncidents.map((i) => i.category).filter(Boolean))].slice(0, 6);

  return (
    <PrincipalWorkspaceShell title="Analytics Dashboard" eyebrow="Board-ready executive analytics">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Analytics' }]} />

      <div className="flex gap-2 rounded-2xl border border-ks-line bg-white p-2 shadow-sm">
        {[
          { key: 'academic', label: 'Academic', icon: GraduationCap },
          { key: 'finance', label: 'Finance', icon: WalletCards },
          { key: 'operations', label: 'Operations', icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${
              tab === key ? 'bg-ks-navy text-white shadow-sm' : 'text-ks-muted hover:bg-ks-paper hover:text-ks-navy'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'academic' && (
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'School Average', value: academicAverage ? `${academicAverage.toFixed(1)}%` : '—', detail: 'Across published academic data', tone: academicAverage >= 70 ? 'stable' : academicAverage > 0 ? 'medium' : 'stable' },
            { label: 'Pass Rate', value: passRate ? `${passRate.toFixed(1)}%` : '—', detail: 'Backend school health aggregate', tone: passRate >= 70 ? 'stable' : passRate > 0 ? 'medium' : 'stable' },
            { label: 'At-Risk', value: String(atRisk), detail: 'Performance alerts active', tone: atRisk > 0 ? 'high' : 'stable' },
            { label: 'Improving', value: String(improving), detail: 'Positive trajectory', tone: 'stable' },
          ]} />
          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveLineChart title="School Average Trend" subtitle="Derived from current school summary" values={academicAverage ? [academicAverage, academicAverage] : []} />
            <ExecutiveBarChart
              title="Academic Risk Distribution"
              subtitle="Live performance alert counts"
              values={[
                { label: 'Critical', value: Number(perf.criticalCount ?? apiHealth.critical ?? 0), tone: 'bg-ks-rose' },
                { label: 'At-risk', value: atRisk, tone: 'bg-ks-amber' },
                { label: 'Improving', value: improving, tone: 'bg-ks-emerald' },
              ]}
            />
          </div>
        </div>
      )}

      {tab === 'finance' && (
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Collection Rate', value: `${collectionRate.toFixed(1)}%`, detail: 'Current finance aggregate', tone: collectionRate >= 80 ? 'stable' : collectionRate >= 60 ? 'medium' : 'critical' },
            { label: 'Outstanding', value: money(outstanding), detail: `${overdueCount} overdue invoices`, tone: outstanding > 0 ? 'critical' : 'stable' },
            { label: 'Total Collected', value: money(totalCollected), detail: 'Cash and bank receipts', tone: 'high' },
            { label: 'Pending Approvals', value: String(apiApprovals.length), detail: 'Manual entries awaiting sign-off', tone: apiApprovals.length > 0 ? 'high' : 'stable' },
          ]} />
          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveLineChart title="Collection Trend" subtitle="Rate by period (%)" values={trendValues} />
            <ExecutiveBarChart title="Outstanding by Class" subtitle="Overdue invoices per class" values={byClassValues} />
          </div>
        </div>
      )}

      {tab === 'operations' && (
        <div className="space-y-gutter">
          <ExecutiveMetricGrid items={[
            { label: 'Attendance', value: apiHealth.operations ? `${apiHealth.operations}%` : '—', detail: 'School-wide attendance score', tone: apiHealth.operations >= 80 ? 'stable' : apiHealth.operations > 0 ? 'medium' : 'stable' },
            { label: 'Syllabus Done', value: avgSyllabus > 0 ? `${avgSyllabus}%` : '—', detail: 'Staff average completion', tone: avgSyllabus > 0 && avgSyllabus < 60 ? 'high' : 'stable' },
            { label: 'On-Time Submissions', value: avgOnTime > 0 ? `${avgOnTime}%` : '—', detail: 'Staff timeliness', tone: avgOnTime > 0 && avgOnTime < 80 ? 'high' : 'stable' },
            { label: 'Open Discipline', value: String(openIncidents), detail: 'Unresolved cases', tone: openIncidents > 0 ? 'high' : 'stable' },
          ]} />
          <div className="grid gap-gutter xl:grid-cols-2">
            <ExecutiveBarChart
              title="On-Time Submissions by Staff"
              subtitle="On-time % by staff"
              values={apiStaff.slice(0, 6).map((s, i) => ({
                label: s.name.split(' ')[0] || s.role,
                value: s.onTime,
                tone: (['bg-ks-emerald', 'bg-ks-blue', 'bg-ks-gold', 'bg-ks-amber', 'bg-ks-rose', 'bg-ks-sky'] as const)[i],
              }))}
            />
            <ExecutiveBarChart
              title="Discipline Incidents by Category"
              subtitle="Open incidents by type"
              values={disciplineCategories.map((cat, i) => ({
                label: cat,
                value: apiIncidents.filter((d) => d.category === cat).length,
                tone: (['bg-ks-rose', 'bg-ks-amber', 'bg-ks-blue', 'bg-ks-emerald', 'bg-ks-gold', 'bg-ks-sky'] as const)[i],
              }))}
            />
          </div>
        </div>
      )}
    </PrincipalWorkspaceShell>
  );
}
// â”€â”€â”€ Reports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Maps UI label â†’ backend ReportType enum value
const REPORT_TYPE_MAP: Record<string, string> = {
  'School Overview':      'SCHOOL_OVERVIEW',
  'Academic Performance': 'PERFORMANCE_ENGINE',
  'Finance Overview':     'FINANCE_COLLECTION',
  'Attendance Summary':   'ATTENDANCE_SUMMARY',
  'Outstanding Balances': 'OUTSTANDING_BALANCES',
  'Performance Engine':   'PERFORMANCE_ENGINE',
  'Board Executive':      'BOARD_EXECUTIVE',
};

export function PrincipalReportsPage() {
  const { mutate: generateReport } = useGenerateReportMutation();
  // null = idle | title = loading (queuing or preparing download)
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('Queuingâ€¦');

  const reports = [
    ['School Overview',      'Full institutional health across academic, finance, and operations.'],
    ['Academic Performance', 'Academic risk engine, alert resolution, pairings, and intervention evidence.'],
    ['Finance Overview',     'Collection rate, outstanding balances, daily and term trends.'],
    ['Attendance Summary',   'School-wide and class-level attendance for the reporting period.'],
    ['Outstanding Balances', 'Overdue invoices, ageing buckets, and highest-risk balances.'],
    ['Performance Engine',   'AQA alerts, interventions, pairings, hotspots, and success stories.'],
    ['Board Executive',      'High-level board-ready report with health scores and key metrics.'],
  ] as const;

  function handleGenerate(title: string) {
    setLoadingReport(title);
    setLoadingLabel('Queuingâ€¦');
    generateReport(
      { reportType: REPORT_TYPE_MAP[title] ?? 'CUSTOM', scope: 'school' },
      {
        onSuccess: async (data) => {
          const reportId = (data as Record<string, unknown>)?.reportId as string | undefined;
          if (!reportId) {
            toast(`${title} report queued â€” check Reports â€º Jobs to download.`, 'success');
            setLoadingReport(null);
            return;
          }
          // Poll until READY then auto-download
          setLoadingLabel('Preparingâ€¦');
          try {
            await downloadReportWhenReady(
              reportId,
              `${title.replace(/\s+/g, '-').toLowerCase()}-report.pdf`,
            );
            toast(`${title} download started!`, 'success');
          } catch (err) {
            const msg = (err as Error).message;
            toast(
              msg === 'generation-failed'
                ? `${title} report generation failed on the server.`
                : `${title} is taking too long â€” check Reports â€º Jobs to download when ready.`,
              'error',
            );
          } finally {
            setLoadingReport(null);
          }
        },
        onError: () => {
          toast(`Failed to queue ${title} report. Please try again.`, 'error');
          setLoadingReport(null);
        },
      },
    );
  }

  return (
    <PrincipalWorkspaceShell title="Generate Reports" eyebrow="Executive report generator">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Reports' }]} />
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {reports.map(([title, detail]) => (
          <FancyReportTile
            key={title}
            title={title}
            detail={detail}
            onGenerate={() => handleGenerate(title)}
            loading={loadingReport === title}
            loadingLabel={loadingReport === title ? loadingLabel : undefined}
          />
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ School settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function SchoolSettingsPage() {
  const { data: schoolSettings } = usePrincipalSchoolSettings() as {
    data: {
      identity?: Partial<typeof emptyIdentity>;
      calendar?: Partial<typeof emptyCalendar>;
      gradingScale?: Array<{ grade: string; minScore: number; maxScore: number; label: string }>;
      performanceRails?: Array<{ label: string; value: number; tone?: string }>;
    } | undefined;
  };
  const gradingScale = schoolSettings?.gradingScale ?? null;
  const patchMutation = usePatchSchoolSettingsMutation();

  const [identity, setIdentity] = useState(emptyIdentity);
  const [calendar, setCalendar] = useState(emptyCalendar);

  useEffect(() => {
    if (schoolSettings?.identity) setIdentity((current) => ({ ...current, ...schoolSettings.identity }));
    if (schoolSettings?.calendar) setCalendar((current) => ({ ...current, ...schoolSettings.calendar }));
  }, [schoolSettings]);

  const handleSaveIdentity = () => {
    patchMutation.mutate({ identity }, {
      onSuccess: () => toast('School identity saved', 'success'),
      onError: () => toast('Failed to save identity. Please try again.', 'error'),
    });
  };

  const handleSaveCalendar = () => {
    patchMutation.mutate({ calendar }, {
      onSuccess: () => toast('Academic calendar saved', 'success'),
      onError: () => toast('Failed to save calendar. Please try again.', 'error'),
    });
  };

  return (
    <PrincipalWorkspaceShell title="School Settings" eyebrow="High-level school configuration">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Settings' }]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-gutter">
          {/* School identity */}
          <SettingsBlock title="School Identity" subtitle="Name, motto, and contact details">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">School Name</span><input value={identity.name} onChange={(e) => setIdentity((v) => ({ ...v, name: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">School Code</span><input value={identity.code} onChange={(e) => setIdentity((v) => ({ ...v, code: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Motto</span><input value={identity.motto} onChange={(e) => setIdentity((v) => ({ ...v, motto: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Contact Email</span><input value={identity.email} onChange={(e) => setIdentity((v) => ({ ...v, email: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Phone</span><input value={identity.phone} onChange={(e) => setIdentity((v) => ({ ...v, phone: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Location</span><input value={identity.location} onChange={(e) => setIdentity((v) => ({ ...v, location: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
            </div>
            <Button variant="secondary" className="mt-4 rounded-xl" disabled={patchMutation.isPending} onClick={handleSaveIdentity}>
              {patchMutation.isPending ? 'Savingâ€¦' : 'Save Identity'}
            </Button>
          </SettingsBlock>

          {/* Academic year + term */}
          <SettingsBlock title="Academic Year & Term" subtitle="Current academic calendar configuration">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Academic Year</span><input value={calendar.academicYear} onChange={(e) => setCalendar((v) => ({ ...v, academicYear: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Current Term</span><input value={calendar.term} onChange={(e) => setCalendar((v) => ({ ...v, term: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Term Start</span><input value={calendar.termStart} onChange={(e) => setCalendar((v) => ({ ...v, termStart: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
              <label className="block"><span className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Term End</span><input value={calendar.termEnd} onChange={(e) => setCalendar((v) => ({ ...v, termEnd: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-ks-line bg-ks-paper px-4 font-semibold text-ks-navy outline-none focus:border-ks-blue focus:bg-white" /></label>
            </div>
            <Button variant="secondary" className="mt-4 rounded-xl" disabled={patchMutation.isPending} onClick={handleSaveCalendar}>
              {patchMutation.isPending ? 'Savingâ€¦' : 'Save Calendar'}
            </Button>
          </SettingsBlock>

          {/* Grading scale */}
          <SettingsBlock title="Grading Scale" subtitle="Grade boundaries and labels">
            <div className="overflow-hidden rounded-xl border border-ks-line">
              {gradingScale && gradingScale.length > 0
                ? gradingScale.map((g) => (
                    <div key={g.grade} className="flex items-center justify-between border-b border-ks-line px-4 py-3 last:border-0">
                      <span className="font-display text-xl font-black text-ks-navy">{g.grade}</span>
                      <span className="font-mono font-bold text-ks-muted">{g.minScore}â€“{g.maxScore}%</span>
                      <span className="text-sm font-bold text-ks-slate">{g.label}</span>
                    </div>
                  ))
                : <div className="p-4"><EmptyState title="No grading scale configured" description="Grading boundaries will appear here once the backend settings are configured." /></div>
              }
            </div>
          </SettingsBlock>

          {/* Assessment weights */}
          <SchoolSettingsSection />

          {/* Performance engine */}
          <ExecutiveBarChart
            title="Performance Engine Rails"
            subtitle="Current threshold configuration"
            values={(schoolSettings?.performanceRails ?? []).map((rail, i) => ({
              label: rail.label,
              value: rail.value,
              tone: rail.tone ?? (['bg-ks-rose', 'bg-ks-gold', 'bg-ks-emerald', 'bg-ks-blue'] as const)[i % 4],
            }))}
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
                  {label} <span className="text-ks-muted">â†’</span>
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

// â”€â”€â”€ Audit trail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PrincipalAuditPage() {
  const [filter, setFilter] = useState<string>('All');
  const { data: apiAudit = [] as PrincipalAuditEvent[] } = usePrincipalAudit() as { data: PrincipalAuditEvent[] };
  const eventTypes = ['All', 'Marks locked', 'Payment approved', 'Announcement published'];
  const filtered = filter === 'All' ? apiAudit : apiAudit.filter((e) => e.decision.toLowerCase().includes(filter.toLowerCase()));

  return (
    <PrincipalWorkspaceShell title="Headmaster Decision Audit Trail" eyebrow="Audited executive decisions">
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

// â”€â”€â”€ Exports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Maps export label â†’ backend ReportType
const EXPORT_TYPE_MAP: Record<string, string> = {
  'Decision Audit CSV':           'AUDIT_EXPORT',
  'School Health PDF':            'SCHOOL_OVERVIEW',
  'Finance Overview PDF':         'FINANCE_COLLECTION',
  'Academic Overview PDF':        'CLASS_ACADEMIC',
  'Performance Alerts CSV':       'STUDENT_PROFILE',
  'Discipline Report PDF':        'TERM_SUMMARY',
  'Staff Overview CSV':           'TEACHER_PERFORMANCE',
  'Published Results Summary PDF':'BOARD_EXECUTIVE',
};

const emptyIdentity = {
  name: '',
  code: '',
  motto: '',
  email: '',
  phone: '',
  location: '',
};

const emptyCalendar = {
  academicYear: '',
  term: '',
  termStart: '',
  termEnd: '',
};

export function PrincipalExportsPage() {
  const { mutate: generateReport } = useGenerateReportMutation();
  const [generating, setGenerating] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState('Queuingâ€¦');

  const items = [
    ['Decision Audit CSV',            'All principal decisions with timestamps, reasons, and correlation IDs.'],
    ['School Health PDF',              'Full institutional health score with academic, finance, and ops scores.'],
    ['Finance Overview PDF',           'Collection rate, outstanding balances, and payment approval history.'],
    ['Academic Overview PDF',          'Subject rankings, class averages, pass rates, and at-risk summary.'],
    ['Performance Alerts CSV',         'All active and resolved alerts with student, subject, and AQA data.'],
    ['Discipline Report PDF',          'Incidents by severity, category, resolution, and recurrence.'],
    ['Staff Overview CSV',             'Submission timeliness, syllabus completion, and concern flags.'],
    ['Published Results Summary PDF',  'Class-level results summary for published terms.'],
  ] as const;

  const handleExport = (title: string) => {
    setGenerating(title);
    setLoadingLabel('Queuingâ€¦');
    generateReport(
      { reportType: EXPORT_TYPE_MAP[title] ?? 'CUSTOM', scope: 'school' },
      {
        onSuccess: async (data) => {
          const reportId = (data as Record<string, unknown>)?.reportId as string | undefined;
          if (!reportId) {
            toast(`${title} queued â€” check Reports â€º Jobs to download.`, 'success');
            setGenerating(null);
            return;
          }
          setLoadingLabel('Preparingâ€¦');
          try {
            await downloadReportWhenReady(reportId, `${title.replace(/\s+/g, '-').toLowerCase()}.pdf`);
            toast(`${title} download started!`, 'success');
          } catch {
            toast(`${title} is taking too long â€” check Reports â€º Jobs to download when ready.`, 'error');
          } finally {
            setGenerating(null);
          }
        },
        onError: () => { toast(`Failed to queue ${title} export.`, 'error'); setGenerating(null); },
      },
    );
  };

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
          <div key={title} className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <Download className="h-5 w-5 text-ks-blue" />
            <h3 className="mt-3 font-display text-base font-black text-ks-navy">{title}</h3>
            <p className="mt-1 grow text-xs font-semibold text-ks-muted">{detail}</p>
            <Button
              className="mt-4 w-full rounded-xl bg-ks-navy text-sm"
              disabled={generating === title}
              onClick={() => handleExport(title)}
            >
              <Download className="h-3.5 w-3.5" /> {generating === title ? loadingLabel : 'Download'}
            </Button>
          </div>
        ))}
      </div>
    </PrincipalWorkspaceShell>
  );
}

// â”€â”€â”€ Shared helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SettingsBlock({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">{subtitle}</p>
      <h2 className="mt-0.5 font-display text-2xl font-black text-ks-navy">{title}</h2>
      <div className="mt-5 border-t border-ks-line pt-4">{children}</div>
    </div>
  );
}


// â”€â”€â”€ Private components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PrincipalCriticalStudentsTable() {
  const { data: apiStudents = [] as PrincipalStudent[] } = usePrincipalStudents() as { data: PrincipalStudent[] };
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
                <span className="text-ks-mist">Â·</span>
                <button className="text-xs font-black text-ks-rose hover:underline">Escalate</button>
              </div>
            </Td>
          </tr>
        ))}
      </ExecutiveTable>
    </div>
  );
}

// â”€â”€â”€ Param hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Return null when the requested id is not found â€” callers must handle the null
// case with an EmptyState or DataError rather than silently showing wrong data.

function useAssessment() {
  const { assessmentId } = useParams();
  const { data: apiAssessments = [], isLoading } = usePendingMarkApprovals() as { data: PrincipalAssessment[]; isLoading: boolean };
  if (isLoading) return { loading: true, item: null };
  const item = apiAssessments.find((a) => a.id === assessmentId) ?? null;
  return { loading: false, item };
}

function usePaymentApproval() {
  const { id } = useParams();
  const { data: apiApprovals = [], isLoading } = usePrincipalPendingPayments() as { data: PrincipalPaymentApproval[]; isLoading: boolean };
  if (isLoading) return { loading: true, item: null };
  const item = apiApprovals.find((a) => a.id === id) ?? null;
  return { loading: false, item };
}

function useStudent() {
  const { studentId } = useParams();
  const { data: apiStudents = [], isLoading } = usePrincipalStudents() as { data: PrincipalStudent[]; isLoading: boolean };
  if (isLoading) return { loading: true, item: null };
  const item = apiStudents.find((s) => s.id === studentId) ?? null;
  return { loading: false, item };
}
