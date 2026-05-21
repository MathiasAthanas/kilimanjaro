import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  Play,
  Plus,
  Save,
  Send,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { aqaAlerts, heatmap, interventions, pairings, reports, thresholds } from '../api/aqaApi';
import {
  AlertCard,
  AqaMetricStrip,
  AqaTable,
  AqaWorkspaceShell,
  EngineStatusCard,
  InterventionCard,
  PairingFunnel,
  PairingTable,
  SchoolHeatmap,
  ThresholdEditor,
} from '../components/AqaWorkspaceShell';
import { hasUnsavedThresholdChanges, validateThresholdOrder } from '../utils/aqaEngine';

const criticalAlerts = aqaAlerts.filter((a) => a.severity === 'CRITICAL');

// ─── Home ────────────────────────────────────────────────────────────────────

export function AqaHomePage() {
  return (
    <AqaWorkspaceShell
      title="Academic QA Command Center"
      eyebrow="School-wide academic intelligence"
      action={
        <NavLink to="/aqa/performance/engine">
          <Button className="rounded-xl bg-ks-gold text-ks-navy hover:shadow-md hover:shadow-ks-gold/30">
            <Play className="h-4 w-4" /> Run Engine
          </Button>
        </NavLink>
      }
    >
      {/* Page title row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-ks-navy">Institutional Overview</h2>
          <p className="mt-1 text-sm font-semibold text-ks-muted">Academic Term: Phase 2 · Week 12</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="rounded-xl">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
          <Button className="rounded-xl">
            <Plus className="h-4 w-4" /> New Intervention
          </Button>
        </div>
      </div>

      <div className="grid gap-gutter xl:grid-cols-[320px_minmax(0,1fr)_320px]">
        {/* Left: Engine + Critical */}
        <section className="space-y-gutter">
          <EngineStatusCard />
          <CriticalBanner />
        </section>

        {/* Center: Heatmap + Insights */}
        <section className="space-y-gutter">
          <SchoolHeatmap cells={heatmap} />
          <div className="grid gap-gutter md:grid-cols-2">
            {[
              { text: 'Chemistry Form 3B has 5 critical heat cells across all classes.', tone: 'rose' as const },
              { text: 'John Mwangi requires Mathematics escalation to principal.', tone: 'rose' as const },
              { text: 'Pairing effectiveness is at 62% — above last term benchmark.', tone: 'emerald' as const },
              { text: 'At-risk queue has 4 high-priority students needing HOD follow-up.', tone: 'blue' as const },
            ].map(({ text, tone }) => (
              <InsightCard key={text} text={text} tone={tone} />
            ))}
          </div>
        </section>

        {/* Right: Pairing funnel + Reports preview */}
        <section className="space-y-gutter">
          <PairingFunnel />
          <ReportsPreview />
        </section>
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Performance command center ──────────────────────────────────────────────

export function PerformanceCommandCenterPage() {
  return (
    <AqaWorkspaceShell title="Performance Command Center" eyebrow="Alert triage and investigation">
      <AqaMetricStrip items={[
        { label: 'Critical',  value: '02', detail: '↑ 1 since yesterday',    tone: 'bg-ks-rose',    trend: 'up'      },
        { label: 'High',      value: '01', detail: 'Needs intervention',      tone: 'bg-ks-amber',   trend: 'neutral' },
        { label: 'Medium',    value: '01', detail: 'Monitor closely',         tone: 'bg-ks-blue',    trend: 'neutral' },
        { label: 'Recovery',  value: '01', detail: '↓ resolved today',        tone: 'bg-ks-emerald', trend: 'down', inverted: true },
      ]} />

      <FilterBar items={['Severity', 'Alert type', 'Subject', 'Class', 'Teacher / HOD', 'Escalated', 'Has pairing']} />

      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="grid gap-gutter md:grid-cols-2">
          {aqaAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
        </section>
        <InvestigationPanel alert={aqaAlerts[0]} />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Alert detail ─────────────────────────────────────────────────────────────

export function AqaAlertDetailPage() {
  const alert = useAlert();
  return (
    <AqaWorkspaceShell title={alert.student} eyebrow={`${alert.type} investigation`}>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-gutter">
          <AlertCard alert={alert} />
          <TrendBoard student={alert.student} subject={alert.subject} />
          <EvidenceTable />
        </section>
        <InvestigationPanel alert={alert} />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Pairings overview ────────────────────────────────────────────────────────

export function PairingsOverviewPage() {
  return (
    <AqaWorkspaceShell title="Peer Pairings Overview" eyebrow="Effectiveness and actions">
      <div className="grid gap-gutter xl:grid-cols-[320px_minmax(0,1fr)]">
        <PairingFunnel />
        <PairingTable pairings={pairings} />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Engine control ───────────────────────────────────────────────────────────

export function EngineControlPage() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleRun = () => {
    setRunning(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) { clearInterval(interval); setRunning(false); return 100; }
        return p + 11;
      });
    }, 120);
  };

  return (
    <AqaWorkspaceShell title="Performance Engine Control" eyebrow="Run and monitor analysis">
      <div className="grid gap-gutter xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <EngineStatusCard />

        {/* Run panel */}
        <Card className="rounded-xl p-6">
          <h2 className="font-display text-2xl font-black text-ks-navy">Run Engine</h2>
          <p className="mt-2 text-sm font-semibold text-ks-muted">
            Select scope and trigger a fresh academic analysis pass.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {['Whole school', 'Selected classes', 'Selected subjects'].map((scope) => (
              <button
                key={scope}
                className="rounded-xl border border-ks-line bg-ks-paper px-4 py-3 text-sm font-bold text-ks-navy transition hover:border-ks-blue hover:bg-ks-mist"
              >
                {scope}
              </button>
            ))}
          </div>

          {running && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs font-bold text-ks-muted">
                <span>Analysing student {Math.round(progress * 3.12)} of 312...</span>
                <span>{progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ks-mist">
                <div className="h-full rounded-full bg-ks-blue transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <Button
            className="mt-5 w-full rounded-xl"
            loading={running}
            onClick={handleRun}
          >
            <Play className="h-4 w-4" />
            {running ? 'Analysis in progress...' : 'Run engine now'}
          </Button>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[
              { label: 'Last run duration', value: '4m 18s' },
              { label: 'Students in scope', value: '312'    },
              { label: 'Thresholds active', value: '3'      },
              { label: 'Next scheduled',    value: '02:00 AM'},
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-ks-line bg-ks-paper p-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-ks-muted">{label}</p>
                <p className="mt-1 font-display text-lg font-black text-ks-navy">{value}</p>
              </div>
            ))}
          </div>
        </Card>

        <EngineTimeline />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Engine config ────────────────────────────────────────────────────────────

export function EngineConfigPage() {
  const [values, setValues] = useState(
    Object.fromEntries(thresholds.map((t) => [t.id, t.value])) as Record<string, number>
  );
  const unsaved = hasUnsavedThresholdChanges(thresholds, values);
  const valid   = validateThresholdOrder(values);

  return (
    <AqaWorkspaceShell title="Engine Configuration" eyebrow="Threshold rails and safety controls">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-gutter">
          {thresholds.map((t) => (
            <ThresholdEditor
              key={t.id}
              item={t}
              value={values[t.id]}
              onChange={(v) => setValues((cur) => ({ ...cur, [t.id]: v }))}
            />
          ))}
        </section>

        <div className="sticky top-24 h-fit rounded-xl bg-ks-navy p-6 text-white shadow-sm">
          <h2 className="font-display text-2xl font-black">Impact Preview</h2>
          <p className="mt-2 text-sm font-semibold text-white/70">
            Future engine runs will use these thresholds after deployment.
          </p>
          <div className="mt-5 space-y-3">
            {['failure', 'atrisk', 'excellence'].map((key) => (
              <div key={key} className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3">
                <span className="text-sm font-bold capitalize text-white/80">{key}</span>
                <span className="font-display text-lg font-black text-white">{values[key]}%</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2">
            <Button
              disabled={!unsaved || !valid}
              className="w-full rounded-xl bg-ks-gold text-ks-navy hover:shadow-lg hover:shadow-ks-gold/30"
            >
              <Save className="h-4 w-4" /> Deploy to Production
            </Button>
            {!valid && (
              <p className="text-center text-xs font-bold text-ks-rose">Threshold ordering is invalid.</p>
            )}
          </div>
        </div>
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export function AcademicAnalyticsPage() {
  return (
    <AqaWorkspaceShell title="Academic Radar" eyebrow="School-wide analytics dashboard">
      <AqaMetricStrip items={[
        { label: 'School mean',       value: '74.2%', detail: '+2.4% term trend', tone: 'bg-ks-blue',    trend: 'down' },
        { label: 'Interventions',     value: '128',   detail: 'Currently active',  tone: 'bg-ks-amber',   trend: 'up'   },
        { label: 'Critical alerts',   value: '12',    detail: 'Needs attention',   tone: 'bg-ks-rose',    trend: 'up'   },
        { label: 'Attendance rate',   value: '93%',   detail: 'Stable context',    tone: 'bg-ks-emerald', inverted: true},
      ]} />
      <SchoolHeatmap cells={heatmap} />
      <div className="grid gap-gutter xl:grid-cols-3">
        <TrendBoard student="School Average" subject="All subjects" />
        <RankingsCard title="Most improved" students={['Zahara Mushi', 'Joel Komba', 'Amina Baraka Juma']} gains={[18, 15, 12]} />
        <RankingsCard title="Top performers" students={['Salma Kitwana', 'David Kapinga', 'Fatuma Juma']}  gains={[94, 91, 88]} isAbsolute />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Class analytics ──────────────────────────────────────────────────────────

export function AqaClassAnalyticsPage() {
  const { classId } = useParams();
  return (
    <AqaWorkspaceShell title={`${classId ?? 'Form 3B'} Analytics`} eyebrow="Class academic health">
      <AqaMetricStrip items={[
        { label: 'Class average',  value: '68%',  detail: 'Chemistry drag detected', tone: 'bg-ks-amber',   trend: 'up'   },
        { label: 'Subject alerts', value: '07',   detail: '3 critical flags',         tone: 'bg-ks-rose',    trend: 'up'   },
        { label: 'Interventions',  value: '11',   detail: '5 pending follow-up',      tone: 'bg-ks-blue',    trend: 'neutral'},
        { label: 'Top performers', value: '14',   detail: '80%+ threshold',           tone: 'bg-ks-emerald', inverted: true},
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <TrendBoard student={classId ?? 'Form 3B'} subject="All subjects" />
        <AtRiskTable compact />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Student profile ──────────────────────────────────────────────────────────

export function AqaStudentProfilePage() {
  const alert = useStudentAlert();
  return (
    <AqaWorkspaceShell title={alert.student} eyebrow="Student profile — AQA view">
      <AqaMetricStrip items={[
        { label: 'Current score', value: `${alert.currentScore}%`, detail: alert.subject,        tone: alert.currentScore < 50 ? 'bg-ks-rose' : 'bg-ks-blue',    trend: alert.change < 0 ? 'up' : 'down' },
        { label: 'Score change',  value: `${alert.change}%`,       detail: alert.type,           tone: alert.change < 0 ? 'bg-ks-rose' : 'bg-ks-emerald',        trend: alert.change < 0 ? 'up' : 'down' },
        { label: 'Pairing',       value: alert.pairingStatus,      detail: 'Academic support',   tone: 'bg-ks-blue'                                                                                         },
        { label: 'Finance context', value: 'Read-only',            detail: 'Authorized by admin',tone: 'bg-ks-gold', inverted: true                                                                         },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <TrendBoard student={alert.student} subject={alert.subject} />
        <InvestigationPanel alert={alert} />
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── At-risk students ────────────────────────────────────────────────────────

export function AtRiskStudentsPage() {
  return (
    <AqaWorkspaceShell title="Academic Risk Management" eyebrow="School-wide risk queue">
      <AqaMetricStrip items={[
        { label: 'Critical risk', value: '03', detail: '↑ 2 since last session', tone: 'bg-ks-rose',    trend: 'up'      },
        { label: 'High risk',     value: '12', detail: '↓ 4 resolved today',     tone: 'bg-ks-amber',   trend: 'down'    },
        { label: 'Medium risk',   value: '24', detail: 'Steady trend detected',  tone: 'bg-ks-sky',     trend: 'neutral' },
        { label: 'Success rate',  value: '88%', detail: 'AQA target exceeded',   tone: 'bg-ks-emerald', inverted: true   },
      ]} />
      <FilterBar items={['Severity', 'Subject', 'Class', 'Pairing status', 'Intervention status', 'HOD']} />
      <AtRiskTable />
    </AqaWorkspaceShell>
  );
}

// ─── Interventions ────────────────────────────────────────────────────────────

export function AqaInterventionsPage() {
  return (
    <AqaWorkspaceShell title="School-Wide Interventions" eyebrow="Academic support operations">
      <AqaMetricStrip items={[
        { label: 'Open interventions', value: '18', detail: 'Pending follow-up', tone: 'bg-ks-amber',   trend: 'neutral' },
        { label: 'Completed',          value: '9',  detail: 'This week',         tone: 'bg-ks-emerald', trend: 'down'    },
        { label: 'Overdue',            value: '3',  detail: 'Needs escalation',  tone: 'bg-ks-rose',    trend: 'up'      },
        { label: 'Avg. response',      value: '4.2h', detail: 'Target < 6.0h',   tone: 'bg-ks-blue', inverted: true     },
      ]} />
      <FilterBar items={['Pending follow-up', 'Type', 'Staff role', 'Subject', 'Class', 'Severity']} />
      <div className="grid gap-gutter xl:grid-cols-3">
        {interventions.map((item) => <InterventionCard key={item.id} item={item} />)}
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export function AqaReportsPage() {
  return (
    <AqaWorkspaceShell title="AQA Reports" eyebrow="Generate and download academic QA reports">
      <div className="grid gap-gutter xl:grid-cols-[380px_minmax(0,1fr)]">
        <ReportGenerator />
        <div className="grid gap-gutter md:grid-cols-2">
          {reports.map((r) => <ReportTile key={r.id} report={r} />)}
        </div>
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Announcements ────────────────────────────────────────────────────────────

export function AqaAnnouncementsPage() {
  return (
    <AqaWorkspaceShell title="AQA Announcements" eyebrow="School-wide academic communication">
      <Card className="overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-black text-ks-navy">Academic Announcements</h2>
            <p className="text-sm font-semibold text-ks-muted">Active school-wide academic communications</p>
          </div>
          <NavLink to="/aqa/announcements/create">
            <Button className="rounded-xl"><Plus className="h-4 w-4" /> New Announcement</Button>
          </NavLink>
        </div>
        <AnnouncementsTable />
      </Card>
    </AqaWorkspaceShell>
  );
}

export function CreateAqaAnnouncementPage() {
  return (
    <AqaFormPage
      title="Create Academic Announcement"
      eyebrow="Academic staff and class targets"
      fields={['Title', 'Body', 'Priority', 'Audience', 'Class targets', 'Subject targets', 'Schedule']}
      preview="Academic announcement preview for teachers, HODs, students, parents, and academic staff."
    />
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function AqaExportsPage() {
  const exportItems = [
    { title: 'Alert list',           type: 'CSV', icon: AlertTriangle },
    { title: 'At-risk students',     type: 'CSV', icon: XCircle       },
    { title: 'Engine configuration', type: 'PDF', icon: Settings      },
    { title: 'Engine run history',   type: 'CSV', icon: Zap           },
    { title: 'School heatmap',       type: 'PDF', icon: BookOpen      },
    { title: 'Pairing effectiveness',type: 'PDF', icon: TrendingUp    },
    { title: 'Intervention log',     type: 'CSV', icon: CheckCircle2  },
    { title: 'Class analytics',      type: 'PDF', icon: ShieldCheck   },
  ];
  return (
    <AqaWorkspaceShell title="AQA Export Center" eyebrow="Operational academic QA data">
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
        {exportItems.map(({ title, type, icon: Icon }) => (
          <Card key={title} className="group rounded-xl p-6 transition hover:shadow-layer">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-ks-blue/10 text-ks-blue transition group-hover:bg-ks-blue group-hover:text-white">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-display text-lg font-black text-ks-navy">{title}</h3>
            <p className="mt-1 text-sm font-semibold text-ks-muted">AQA export · {type} format</p>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="secondary" className="flex-1 rounded-xl text-xs">
                <Download className="h-3.5 w-3.5" /> Generate {type}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AqaWorkspaceShell>
  );
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export function AqaAuditPage() {
  const events = [
    { label: 'Engine run completed',                       severity: 'success', day: 0 },
    { label: 'Engine configuration changed',               severity: 'info',    day: 0 },
    { label: 'Alert escalated — Jabir Hassan',             severity: 'critical',day: 1 },
    { label: 'Pairing activated — Pendo Shayo',            severity: 'success', day: 1 },
    { label: 'Report generated: At-Risk Students',         severity: 'info',    day: 2 },
    { label: 'Announcement published',                     severity: 'info',    day: 2 },
  ];
  return (
    <AqaWorkspaceShell title="Academic Quality Audit Trail" eyebrow="Important AQA actions">
      <Card className="overflow-hidden rounded-xl">
        <div className="border-b border-ks-line bg-ks-paper/60 px-6 py-4">
          <h2 className="font-display text-xl font-black text-ks-navy">Audit Log</h2>
          <p className="text-sm font-semibold text-ks-muted">Chronological record of all AQA actions and decisions</p>
        </div>
        <div className="bg-ks-navy p-6">
          <div className="relative border-l-2 border-white/20 pl-8 space-y-6">
            {events.map((event, i) => (
              <AuditEvent key={event.label} event={event.label} severity={event.severity} day={event.day} index={i} />
            ))}
          </div>
        </div>
      </Card>
    </AqaWorkspaceShell>
  );
}

// ─── Private components ───────────────────────────────────────────────────────

function CriticalBanner() {
  return (
    <Card className="overflow-hidden rounded-xl border border-ks-rose/20 bg-ks-rose/5">
      <div className="flex items-center gap-3 border-b border-ks-rose/10 px-5 py-4">
        <AlertTriangle className="h-5 w-5 text-ks-rose" />
        <h3 className="font-display text-base font-black text-ks-navy">Critical Alerts</h3>
        <span className="ml-auto rounded-full bg-ks-rose px-2 py-0.5 text-[10px] font-black text-white">{criticalAlerts.length}</span>
      </div>
      <p className="px-5 pt-4 text-sm font-semibold text-ks-navy">
        <span className="font-black">{criticalAlerts.length} students</span> require immediate intervention.
      </p>
      <div className="space-y-2 p-4">
        {criticalAlerts.map((alert) => {
          const initials = alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
          return (
            <NavLink
              key={alert.id}
              to={`/aqa/performance/alerts/${alert.id}`}
              className="flex items-center gap-3 rounded-lg border border-ks-rose/10 bg-white/60 p-3 transition hover:bg-white"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ks-mist text-xs font-black text-ks-navy">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ks-navy">{alert.student}</p>
                <p className="text-[11px] text-ks-muted">{alert.className} · {alert.subject} · {alert.currentScore}%</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-ks-muted" />
            </NavLink>
          );
        })}
      </div>
      <div className="px-5 pb-5">
        <NavLink to="/aqa/performance?severity=critical">
          <Button variant="danger" className="w-full rounded-xl">Escalate Critical to Principal</Button>
        </NavLink>
      </div>
    </Card>
  );
}

function InvestigationPanel({ alert }: { alert: (typeof aqaAlerts)[number] }) {
  const initials = alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Card className="sticky top-24 h-fit overflow-hidden rounded-xl">
      <div className="border-b border-ks-line bg-ks-paper/60 px-5 py-4">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Investigation panel</p>
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ks-rose text-sm font-black text-white">
            {initials}
          </div>
          <div>
            <h3 className="font-display text-xl font-black text-ks-navy">{alert.student}</h3>
            <p className="text-xs font-semibold text-ks-muted">{alert.className} · {alert.subject}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-ks-line bg-ks-paper p-4">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Evidence</p>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ks-navy">{alert.evidence}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-ks-line bg-ks-paper p-3 text-center">
            <p className="text-[10px] font-black uppercase text-ks-muted">Score</p>
            <p className="mt-1 font-display text-xl font-black text-ks-rose">{alert.currentScore}%</p>
          </div>
          <div className="rounded-xl border border-ks-line bg-ks-paper p-3 text-center">
            <p className="text-[10px] font-black uppercase text-ks-muted">Change</p>
            <p className={`mt-1 font-display text-xl font-black ${alert.change < 0 ? 'text-ks-rose' : 'text-ks-emerald'}`}>{alert.change}%</p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Button variant="danger"     className="w-full rounded-xl">Escalate</Button>
          <Button variant="success"    className="w-full rounded-xl">Resolve with note</Button>
          <Button variant="secondary"  className="w-full rounded-xl">Assign pairing</Button>
          <Button variant="quiet"      className="w-full rounded-xl">Create intervention</Button>
        </div>
      </div>
    </Card>
  );
}

function AtRiskTable({ compact = false }: { compact?: boolean }) {
  const alerts = aqaAlerts.filter((a) => a.severity !== 'POSITIVE');
  const criticals = alerts.filter((a) => a.severity === 'CRITICAL');
  const highs     = alerts.filter((a) => a.severity === 'HIGH');
  const others    = alerts.filter((a) => a.severity !== 'CRITICAL' && a.severity !== 'HIGH');

  return (
    <AqaTable columns={['Student', 'Class', 'Subject', 'Alert type', 'Severity', 'Score', 'Change', 'Pairing', 'Owner', 'Actions']}>
      {/* Critical group */}
      {criticals.length > 0 && (
        <tr className="bg-ks-rose/5">
          <td colSpan={10} className="px-5 py-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-ks-rose">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ks-rose" />
              Critical risk group ({criticals.length})
            </span>
          </td>
        </tr>
      )}
      {criticals.map((a) => <RiskRow key={a.id} alert={a} compact={compact} />)}

      {/* High group */}
      {highs.length > 0 && (
        <tr className="bg-ks-amber/5">
          <td colSpan={10} className="px-5 py-2">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-ks-amber">
              <span className="h-1.5 w-1.5 rounded-full bg-ks-amber" />
              High risk group ({highs.length})
            </span>
          </td>
        </tr>
      )}
      {highs.map((a) => <RiskRow key={a.id} alert={a} compact={compact} />)}

      {others.map((a) => <RiskRow key={a.id} alert={a} compact={compact} />)}
    </AqaTable>
  );
}

function RiskRow({ alert, compact }: { alert: (typeof aqaAlerts)[number]; compact: boolean }) {
  const isCritical = alert.severity === 'CRITICAL';
  const initials = alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <tr className={`transition hover:bg-ks-mist/10 ${isCritical ? 'bg-ks-rose/5' : ''}`}>
      <Td>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ks-line bg-ks-paper text-[11px] font-black text-ks-navy">
            {initials}
          </div>
          <span className="font-bold text-ks-navy">{alert.student}</span>
        </div>
      </Td>
      <Td>{alert.className}</Td>
      <Td>{alert.subject}</Td>
      <Td>
        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
          isCritical ? 'border-ks-rose/20 bg-ks-rose/10 text-ks-rose' : 'border-ks-amber/20 bg-ks-amber/10 text-ks-amber'
        }`}>{alert.type}</span>
      </Td>
      <Td>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${isCritical ? 'bg-ks-rose' : 'bg-ks-amber'}`} />
          <Badge tone={isCritical ? 'rose' : 'amber'}>{alert.severity}</Badge>
        </div>
      </Td>
      <Td>
        <span className={`font-black ${isCritical ? 'text-ks-rose' : alert.currentScore >= 65 ? 'text-ks-emerald' : 'text-ks-amber'}`}>
          {alert.currentScore}%
        </span>
      </Td>
      <Td>
        <span className={`flex items-center gap-0.5 font-bold text-sm ${alert.change < 0 ? 'text-ks-rose' : 'text-ks-emerald'}`}>
          {alert.change < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          {alert.change}%
        </span>
      </Td>
      <Td>{alert.pairingStatus}</Td>
      <Td className="text-ks-muted">{compact ? alert.teacher : `${alert.teacher} / ${alert.hod}`}</Td>
      <Td>
        <NavLink to={`/aqa/students/${alert.studentId}`} className="font-black text-ks-blue hover:underline">
          Open →
        </NavLink>
      </Td>
    </tr>
  );
}

function TrendBoard({ student, subject }: { student: string; subject: string }) {
  const scores = [82, 76, 71, 58, 39, 44, 51];
  const W = 500; const H = 160;
  const pad = 8;
  const points = scores.map((v, i) => {
    const x = pad + (i / (scores.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - 30) / 70) * (H - pad * 2);
    return [x, y] as [number, number];
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `M${points[0][0]},${points[0][1]} L${points.slice(1).map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} L${points[points.length-1][0]},${H} L${points[0][0]},${H} Z`;
  const isDown = scores[scores.length - 1] < scores[0];
  const lineColor = isDown ? '#F43F5E' : '#10B981';

  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-ks-line px-6 py-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{subject}</p>
          <h2 className="font-display text-xl font-black text-ks-navy">{student} — Score history</h2>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${isDown ? 'bg-ks-rose/10 text-ks-rose' : 'bg-ks-emerald/10 text-ks-emerald'}`}>
          {isDown ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          {isDown ? 'Declining' : 'Improving'}
        </div>
      </div>
      <div className="p-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[30, 50, 65, 80].map((v) => {
            const y = H - pad - ((v - 30) / 70) * (H - pad * 2);
            return <line key={v} x1={pad} x2={W - pad} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray="4 3" strokeWidth="1" />;
          })}
          <path d={area} fill="url(#trendGrad)" />
          <polyline points={line} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i === points.length - 1 ? 5 : 3.5} fill={lineColor} stroke="white" strokeWidth="1.5" />
          ))}
        </svg>
        <div className="mt-2 flex justify-between text-[10px] font-bold text-ks-muted">
          {['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6', 'Now'].map((l) => <span key={l}>{l}</span>)}
        </div>
        {isDown && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-ks-rose/20 bg-ks-rose/5 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-ks-rose" />
            <p className="text-xs font-bold text-ks-rose">Performance has declined {Math.abs(scores[scores.length-1] - scores[0])} points since Week 1</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function EvidenceTable() {
  return (
    <AqaTable columns={['Evidence', 'Value', 'Source', 'Action']}>
      {['Score history', 'Attendance context', 'Engine raw data', 'Intervention history'].map((item) => (
        <tr key={item} className="transition hover:bg-ks-paper">
          <Td><span className="font-bold text-ks-navy">{item}</span></Td>
          <Td>Available</Td>
          <Td>Academic gateway</Td>
          <Td><Button variant="secondary" className="rounded-xl py-1.5 text-xs">Inspect</Button></Td>
        </tr>
      ))}
    </AqaTable>
  );
}

function EngineTimeline() {
  const runs = [
    { label: 'Today 02:03 AM',               status: 'success', note: '312 students · 4m 18s'       },
    { label: 'Yesterday 02:00 AM',            status: 'success', note: '310 students · 4m 01s'       },
    { label: 'Config change — thresholds',    status: 'gold',    note: 'Ms. Fatuma Ally · AQA-2001'  },
    { label: '2 days ago',                    status: 'success', note: '308 students · 3m 55s'       },
  ];
  return (
    <div className="sticky top-24 h-fit overflow-hidden rounded-xl bg-ks-navy text-white shadow-sm">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="font-display text-xl font-black text-white">Run History</h2>
        <p className="text-sm font-semibold text-white/60">Last 4 engine executions</p>
      </div>
      <div className="relative p-6">
        <div className="relative border-l-2 border-white/20 pl-6 space-y-5">
          {runs.map(({ label, status, note }) => (
            <div key={label} className="relative">
              <span className={`absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-ks-navy ${
                status === 'success' ? 'bg-ks-emerald' : status === 'gold' ? 'bg-ks-gold' : 'bg-ks-sky'
              }`} />
              <p className="text-sm font-bold text-white">{label}</p>
              <p className="text-xs font-semibold text-white/65">{note}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportsPreview() {
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-ks-line px-5 py-4">
        <h2 className="font-display text-base font-black text-ks-navy">Report Readiness</h2>
        <NavLink to="/aqa/reports" className="text-xs font-black text-ks-blue hover:underline">View all →</NavLink>
      </div>
      <div className="divide-y divide-ks-line">
        {reports.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-5 py-3 transition hover:bg-ks-paper">
            <span className="text-sm font-bold text-ks-navy">{r.title}</span>
            <Badge tone={r.status === 'READY' ? 'emerald' : 'amber'}>{r.status}</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReportGenerator() {
  return (
    <Card className="sticky top-24 h-fit overflow-hidden rounded-xl">
      <div className="border-b border-ks-line bg-ks-paper/60 px-6 py-4">
        <h2 className="font-display text-xl font-black text-ks-navy">Report Generator</h2>
        <p className="text-sm font-semibold text-ks-muted">Select a template and generate</p>
      </div>
      <div className="p-6">
        <div className="space-y-2">
          {['School Overview', 'Class Academic', 'Student Profile', 'Performance Engine', 'At-Risk Students'].map((item) => (
            <button key={item} className="w-full rounded-xl border border-ks-line bg-ks-paper px-4 py-3 text-left text-sm font-bold text-ks-navy transition hover:border-ks-blue hover:bg-ks-mist">
              {item}
            </button>
          ))}
        </div>
        <Button className="mt-5 w-full rounded-xl">
          <Send className="h-4 w-4" /> Generate report
        </Button>
      </div>
    </Card>
  );
}

function ReportTile({ report }: { report: (typeof reports)[number] }) {
  return (
    <Card className="rounded-xl p-5 transition hover:shadow-layer">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ks-blue/10">
          <FileText className="h-5 w-5 text-ks-blue" />
        </div>
        <Badge tone={report.status === 'READY' ? 'emerald' : 'amber'}>{report.status}</Badge>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-wider text-ks-muted">{report.type}</p>
      <h3 className="mt-1 font-display text-lg font-black text-ks-navy">{report.title}</h3>
      <p className="mt-1 text-xs font-semibold text-ks-muted">{report.generatedAt}</p>
      <Button variant="secondary" className="mt-4 w-full rounded-xl text-xs">
        <Download className="h-3.5 w-3.5" /> Download
      </Button>
    </Card>
  );
}

function RankingsCard({
  title, students, gains, isAbsolute = false,
}: { title: string; students: string[]; gains: number[]; isAbsolute?: boolean }) {
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="border-b border-ks-line px-5 py-4">
        <h2 className="font-display text-base font-black text-ks-navy">{title}</h2>
      </div>
      <div className="divide-y divide-ks-line">
        {students.map((name, i) => (
          <div key={name} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-ks-paper">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${
              i === 0 ? 'bg-ks-gold' : i === 1 ? 'bg-ks-muted' : 'bg-ks-amber/60'
            }`}>{i + 1}</span>
            <span className="flex-1 font-bold text-ks-navy">{name}</span>
            <span className={`font-black ${isAbsolute ? 'text-ks-blue' : 'text-ks-emerald'}`}>
              {isAbsolute ? `${gains[i]}%` : `+${gains[i]}%`}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnnouncementsTable() {
  const rows = [
    { title: 'Engine run scheduled tonight',      status: 'ACTIVE', audience: 'Academic staff', priority: 'High'   },
    { title: 'Chemistry interventions due Friday', status: 'ACTIVE', audience: 'Science HOD',   priority: 'High'   },
    { title: 'At-risk register published',         status: 'ACTIVE', audience: 'All staff',     priority: 'Medium' },
  ];
  return (
    <AqaTable columns={['Title', 'Status', 'Audience', 'Priority', 'Schedule', 'Published by', 'Actions']}>
      {rows.map(({ title, status, audience, priority }) => (
        <tr key={title} className="transition hover:bg-ks-paper">
          <Td><span className="font-bold text-ks-navy">{title}</span></Td>
          <Td><Badge tone="emerald">{status}</Badge></Td>
          <Td>{audience}</Td>
          <Td>
            <span className={`text-xs font-black ${priority === 'High' ? 'text-ks-rose' : 'text-ks-amber'}`}>{priority}</span>
          </Td>
          <Td>Now</Td>
          <Td>Fatuma Ally</Td>
          <Td><Button variant="secondary" className="rounded-xl py-1.5 text-xs">Preview</Button></Td>
        </tr>
      ))}
    </AqaTable>
  );
}

function AqaFormPage({ title, eyebrow, fields, preview }: { title: string; eyebrow: string; fields: string[]; preview: string }) {
  return (
    <AqaWorkspaceShell title={title} eyebrow={eyebrow}>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-ks-blue" />
            <h2 className="font-display text-xl font-black text-ks-navy">{title}</h2>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="block">
                <span className="text-xs font-black uppercase tracking-wider text-ks-muted">{field}</span>
                <input className="mt-2 h-11 w-full rounded-xl border border-ks-line px-4 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" />
              </label>
            ))}
          </div>
          <Button className="mt-5 rounded-xl"><Send className="h-4 w-4" /> Publish</Button>
        </Card>
        <Card className="sticky top-24 h-fit rounded-xl p-5">
          <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Preview</p>
          <div className="mt-3 rounded-xl border border-ks-line bg-ks-paper p-4">
            <p className="text-sm font-semibold leading-relaxed text-ks-slate">{preview}</p>
          </div>
        </Card>
      </div>
    </AqaWorkspaceShell>
  );
}

function FilterBar({ items }: { items: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ks-line/60 bg-ks-mist/20 px-5 py-3">
      <div className="flex items-center gap-2 text-ks-muted">
        <Filter className="h-4 w-4" />
        <span className="text-xs font-black uppercase tracking-wider text-ks-navy">Filters</span>
      </div>
      {items.map((item) => (
        <button
          key={item}
          onClick={() => setActive(active === item ? null : item)}
          className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            active === item
              ? 'border-ks-blue bg-ks-blue text-white'
              : 'border-ks-line bg-white text-ks-navy hover:border-ks-blue/40 hover:text-ks-blue'
          }`}
        >
          {item}
        </button>
      ))}
      {active && (
        <button onClick={() => setActive(null)} className="ml-auto text-xs font-bold text-ks-muted hover:text-ks-navy">
          Clear
        </button>
      )}
    </div>
  );
}

function InsightCard({ text, tone }: { text: string; tone: 'rose' | 'blue' | 'emerald' }) {
  const border = tone === 'rose' ? 'border-l-ks-rose bg-ks-rose/5' : tone === 'emerald' ? 'border-l-ks-emerald bg-ks-emerald/5' : 'border-l-ks-blue';
  const badgeTone = tone;
  return (
    <Card className={`rounded-xl border-l-4 p-5 ${border}`}>
      <Badge tone={badgeTone}>{tone === 'rose' ? 'URGENT' : 'ACTIONABLE'}</Badge>
      <p className="mt-3 text-sm font-bold leading-relaxed text-ks-navy">{text}</p>
      <p className="mt-2 text-xs font-semibold text-ks-muted">Derived from latest engine run · Term II</p>
    </Card>
  );
}

function AuditEvent({
  event, severity, day, index,
}: { event: string; severity: string; day: number; index: number }) {
  const dotColor = severity === 'critical' ? 'bg-ks-rose' : severity === 'gold' ? 'bg-ks-gold' : 'bg-ks-sky';
  return (
    <div className="relative">
      <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-ks-navy ${dotColor}`} />
      <p className="text-[10px] font-black uppercase tracking-wider text-ks-gold">
        May {21 - day}, 2026
      </p>
      <p className="mt-1 font-semibold text-white/90">{event}</p>
      <p className="mt-0.5 text-xs text-white/50">
        Actor: Ms. Fatuma Ally · Correlation ID: AQA-{2000 + index}
      </p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 font-semibold text-ks-slate ${className ?? ''}`}>{children}</td>;
}

function useAlert() {
  const { id } = useParams();
  return useMemo(() => aqaAlerts.find((a) => a.id === id) ?? aqaAlerts[0], [id]);
}

function useStudentAlert() {
  const { studentId } = useParams();
  return useMemo(() => aqaAlerts.find((a) => a.studentId === studentId) ?? aqaAlerts[0], [studentId]);
}
