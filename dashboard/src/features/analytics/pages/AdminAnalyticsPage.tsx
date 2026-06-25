import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { AdminShell, AdminMetricStrip } from '../../admin/components/AdminConsole';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import {
  useSchoolOverview,
  useBoardDashboard,
  useAtRiskStudents,
  useReportsList,
  useGenerateReportMutation,
  useReportDetail,
  useFinanceAnalyticsOverview,
  useAcademicOverview,
} from '../api/analytics.hooks';
import { BarChart, LineChart, DoughnutChart, ChartSkeleton, StatSkeleton } from '../components/Charts';

// ─── Year / Term selector ─────────────────────────────────────────────────────

function YearTermBar({ yearId, termId, onYear, onTerm }: { yearId: string; termId: string; onYear(v: string): void; onTerm(v: string): void }) {
  const { data: years = [] } = useAcademicYears();
  const { data: allTerms = [] } = useTerms();
  const terms = (allTerms as any[]).filter((t: any) => !yearId || t.academicYearId === yearId);
  const yearName = (years as any[]).find((y: any) => y.id === yearId)?.name || 'Current Year';
  const termName = (terms as any[]).find((t: any) => t.id === termId)?.name || 'All Terms';

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-line bg-white px-4 py-3 shadow-sm">
      <BarChart3 className="h-4 w-4 text-ks-muted" />
      <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Viewing:</span>
      <select
        className="rounded-lg border border-ks-line bg-ks-paper px-3 py-1.5 text-sm font-bold text-ks-navy outline-none"
        value={yearId}
        onChange={(e) => { onYear(e.target.value); onTerm(''); }}
      >
        <option value="">Current Year</option>
        {(years as any[]).map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
      </select>
      <select
        className="rounded-lg border border-ks-line bg-ks-paper px-3 py-1.5 text-sm font-bold text-ks-navy outline-none"
        value={termId}
        onChange={(e) => onTerm(e.target.value)}
      >
        <option value="">All Terms</option>
        {(terms as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <Badge tone="blue">{`${yearName} · ${termName}`}</Badge>
    </div>
  );
}

// ─── Institutional health ring ────────────────────────────────────────────────

function HealthScore({ score, trend }: { score: number; trend: string }) {
  const color = score >= 75 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const r = 64; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="flex items-center gap-8 rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <motion.circle
          cx="80" cy="80" r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.4, ease: 'easeInOut' }}
          transform="rotate(-90 80 80)"
        />
        <text x="80" y="74" textAnchor="middle" fontSize="28" fontWeight="900" fill="#0f172a">{Math.round(score)}</text>
        <text x="80" y="94" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">/ 100</text>
      </svg>
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Institutional Health Score</p>
        <p className="mt-1 font-display text-4xl font-black text-ks-navy">{Math.round(score)}<span className="text-lg text-ks-muted">/100</span></p>
        <Badge tone={trend === 'IMPROVING' ? 'emerald' : trend === 'DECLINING' ? 'rose' : 'slate'}>
          {`${trend === 'IMPROVING' ? '▲' : trend === 'DECLINING' ? '▼' : '→'} ${trend}`}
        </Badge>
        <p className="mt-2 text-xs text-ks-muted">Weighted: Academic 30% · Finance 25% · Attendance 25% · E-Learning 20%</p>
      </div>
    </div>
  );
}

// ─── At-Risk table ────────────────────────────────────────────────────────────

function AtRiskTable({ students }: { students: any[] }) {
  const [filter, setFilter] = useState('');
  const filtered = students.filter((s) => !filter || s.alertType === filter || s.className === filter);
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">At-Risk Students</h3>
        <select className="rounded-lg border border-ks-line bg-ks-paper px-3 py-1.5 text-xs font-bold text-ks-navy" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All types</option>
          {[...new Set(students.map((s) => s.alertType))].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper">
            <tr>
              {['Student', 'Class', 'Alert', 'Subject', 'Days'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ks-muted">
                No at-risk students found for the selected filters. That's great news!
              </td></tr>
            ) : filtered.slice(0, 20).map((s, i) => (
              <tr key={i} className="border-t border-ks-line hover:bg-ks-paper">
                <td className="px-4 py-3 font-bold text-ks-navy">
                  <NavLink to={`/analytics/students/${s.studentId || ''}`} className="hover:underline">{s.studentName}</NavLink>
                </td>
                <td className="px-4 py-3 text-ks-muted">{s.className}</td>
                <td className="px-4 py-3"><Badge tone="rose">{(s.alertType || '').replace(/_/g, ' ')}</Badge></td>
                <td className="px-4 py-3 text-ks-muted">{s.subject || s.subjectName || '—'}</td>
                <td className="px-4 py-3 font-mono text-ks-muted">{s.daysSinceAlert ?? s.daysSince ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Report launcher ──────────────────────────────────────────────────────────

const REPORT_TYPES = [
  { type: 'SCHOOL_OVERVIEW', label: 'School Overview', tone: 'blue' },
  { type: 'CLASS_ACADEMIC', label: 'Class Academic', tone: 'emerald' },
  { type: 'TEACHER_PERFORMANCE', label: 'Teacher Performance', tone: 'amber' },
  { type: 'FINANCE_COLLECTION', label: 'Finance Collection', tone: 'gold' },
  { type: 'OUTSTANDING_BALANCES', label: 'Outstanding Balances', tone: 'rose' },
  { type: 'ATTENDANCE_SUMMARY', label: 'Attendance Summary', tone: 'slate' },
  { type: 'BOARD_EXECUTIVE', label: 'Board Executive', tone: 'blue' },
  { type: 'PERFORMANCE_ENGINE', label: 'Performance Engine', tone: 'emerald' },
] as const;

function ReportLauncher({ yearId, termId }: { yearId: string; termId: string }) {
  const [activeId, setActiveId] = useState('');
  useReportDetail(activeId);
  const gen = useGenerateReportMutation();
  const { data: reports = [] } = useReportsList();

  const launch = async (reportType: string) => {
    try {
      const result: any = await gen.mutateAsync({ reportType, academicYearId: yearId || undefined, termId: termId || undefined, scope: 'school' });
      const id = result?.id || result?.data?.id;
      if (id) setActiveId(id);
    } catch { toast('Failed to generate report', 'error'); }
  };

  const handleDownload = async (id: string) => {
    try {
      const a = document.createElement('a');
      a.href = `/api/analytics/reports/${id}/download`;
      a.download = `report-${id}.pdf`;
      a.click();
    } catch { toast('Download failed', 'error'); }
  };

  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-display text-lg font-black text-ks-navy">Generate Reports</h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORT_TYPES.map(({ type, label, tone }) => {
          const existing = (reports as any[]).find((r: any) => r.reportType === type);
          const isReady = existing?.status === 'READY';
          const isGenerating = existing?.status === 'GENERATING' || (gen.isPending && gen.variables?.reportType === type);
          return (
            <div key={type} className="rounded-xl border border-ks-line p-4 space-y-2">
              <Badge tone={tone as any}>{label}</Badge>
              {isReady ? (
                <Button variant="success" className="w-full" onClick={() => handleDownload(existing.id)}>
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </Button>
              ) : (
                <Button variant="secondary" className="w-full" loading={isGenerating} onClick={() => launch(type)}>
                  {isGenerating ? 'Generating…' : 'Generate'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const params = { academicYearId: yearId, termId };

  const { data: overview, isLoading: overviewLoading } = useSchoolOverview(params);
  const { data: board, isLoading: boardLoading } = useBoardDashboard(params);
  const { data: atRisk = [], isLoading: riskLoading } = useAtRiskStudents();
  const { data: finance, isLoading: financeLoading } = useFinanceAnalyticsOverview(params);
  const { data: academic, isLoading: academicLoading } = useAcademicOverview(params);

  const ov = overview as any;
  const bd = board as any;
  const fin = finance as any;
  const ac = academic as any;

  const healthScore = bd?.institutionalHealth?.overallScore ?? ((ov?.academic?.overallPassRate ?? 0) + (ov?.finance?.collectionRateThisTerm ?? 0) + (ov?.attendance?.schoolAttendanceRate ?? 0)) / 3;
  const healthTrend = bd?.institutionalHealth?.trend ?? 'STABLE';

  return (
    <AdminShell title="School Command Center" eyebrow="Full Analytics Access">
      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

      {/* Institutional Health */}
      {boardLoading ? <ChartSkeleton height="h-40" /> : <HealthScore score={healthScore} trend={healthTrend} />}

      {/* 4-stat strip */}
      {overviewLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : (
        <AdminMetricStrip items={[
          { label: 'Active Students', value: (ov?.enrolment?.activeStudents ?? 0).toLocaleString(), detail: `of ${(ov?.enrolment?.totalStudents ?? 0).toLocaleString()} enrolled`, tone: 'blue' },
          { label: 'Pass Rate', value: `${(ov?.academic?.overallPassRate ?? 0).toFixed(1)}%`, detail: 'Published results this term', tone: 'green' },
          { label: 'Collection Rate', value: `${(ov?.finance?.collectionRateThisTerm ?? 0).toFixed(1)}%`, detail: `TZS ${Number(ov?.finance?.totalCollectedThisTerm ?? 0).toLocaleString()} collected`, tone: ov?.finance?.collectionRateThisTerm < 70 ? 'rose' : 'green' },
          { label: 'At-Risk Alerts', value: ((atRisk as any[]).length).toLocaleString(), detail: 'Unresolved performance alerts', tone: 'rose' },
        ]} />
      )}

      {/* Academic + Finance side by side */}
      <div className="grid gap-gutter xl:grid-cols-2">
        {academicLoading ? <ChartSkeleton /> : (
          <BarChart
            title="Class Performance"
            subtitle="Average score by class this term"
            values={(ac?.classRankings || []).slice(0, 8).map((c: any) => ({ label: c.className, value: Math.round(c.average || 0) }))}
          />
        )}
        {financeLoading ? <ChartSkeleton /> : (
          <DoughnutChart
            title="Fee Collection Status"
            segments={[
              { label: 'Collected', value: Math.round(Number(fin?.billing?.totalCollected ?? ov?.finance?.totalCollectedThisTerm ?? 0)), color: '#10b981' },
              { label: 'Outstanding', value: Math.round(Number(fin?.billing?.totalOutstanding ?? ov?.finance?.totalOutstanding ?? 0)), color: '#ef4444' },
            ]}
          />
        )}
      </div>

      {/* Subject rankings */}
      {academicLoading ? <ChartSkeleton /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          <BarChart
            title="Top Subjects by Pass Rate"
            subtitle="Best performing subjects this term"
            values={(ac?.subjectRankings || []).slice(0, 6).map((s: any) => ({ label: s.subjectName, value: Math.round(s.passRate || 0) }))}
          />
          <BarChart
            title="Subjects Needing Attention"
            subtitle="Lowest pass rates this term"
            values={(ac?.subjectRankings || []).reverse().slice(0, 6).map((s: any) => ({ label: s.subjectName, value: Math.round(s.passRate || 0), tone: 'bg-ks-rose' }))}
          />
        </div>
      )}

      {/* Attendance trend */}
      {overviewLoading ? <ChartSkeleton /> : (
        <LineChart
          title="Attendance Rate Trend"
          subtitle="School-wide attendance by term"
          values={(ov?.kpiTrends?.attendanceRateByTerm || []).map((t: any) => t.rate)}
          labels={(ov?.kpiTrends?.attendanceRateByTerm || []).map((t: any) => t.period)}
        />
      )}

      {/* At-Risk table */}
      {riskLoading ? <ChartSkeleton height="h-64" /> : <AtRiskTable students={atRisk as any[]} />}

      {/* Report launcher */}
      <ReportLauncher yearId={yearId} termId={termId} />
    </AdminShell>
  );
}
