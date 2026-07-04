import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, FileDown } from 'lucide-react';
import { getLogoBase64 } from '../../finance/components/FinanceWorkspaceShell';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { PrincipalWorkspaceShell, PrincipalBreadcrumb } from '../../principal/components/PrincipalWorkspaceShell';
import {
  useSchoolOverview,
  useAcademicOverview,
  useAtRiskStudents,
  useTopPerformers,
  useFinanceAnalyticsOverview,
} from '../api/analytics.hooks';
import { BarChart, LineChart, StatCard, ChartSkeleton, StatSkeleton, DoughnutChart } from '../components/Charts';

function YearTermBar({ yearId, termId, onYear, onTerm, onDownload }: { yearId: string; termId: string; onYear(v: string): void; onTerm(v: string): void; onDownload?(): void }) {
  const { data: years = [] } = useAcademicYears();
  const { data: allTerms = [] } = useTerms();
  const terms = (allTerms as any[]).filter((t: any) => !yearId || t.academicYearId === yearId);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-ks-line bg-white px-4 py-3 shadow-sm">
      <BarChart3 className="h-4 w-4 text-ks-muted" />
      <select className="rounded-lg border border-ks-line bg-ks-paper px-3 py-1.5 text-sm font-bold text-ks-navy outline-none" value={yearId} onChange={(e) => { onYear(e.target.value); onTerm(''); }}>
        <option value="">Current Year</option>
        {(years as any[]).map((y: any) => <option key={y.id} value={y.id}>{y.name}</option>)}
      </select>
      <select className="rounded-lg border border-ks-line bg-ks-paper px-3 py-1.5 text-sm font-bold text-ks-navy outline-none" value={termId} onChange={(e) => onTerm(e.target.value)}>
        <option value="">All Terms</option>
        {(terms as any[]).map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      {onDownload && (
        <button onClick={onDownload} className="ml-auto flex items-center gap-1.5 rounded-lg bg-ks-navy px-3 py-1.5 text-xs font-black text-white hover:opacity-90">
          <FileDown className="h-3.5 w-3.5" /> Download Report
        </button>
      )}
    </div>
  );
}

const NAVY = '#00334f';
const GOLD = '#d59a1b';

async function generatePrincipalPdf(ov: any, ac: any, fin: any, atRisk: any[], topPerf: any[]) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
  const W = 210, M = 14, now = new Date();
  const rowH = 7;

  const addHeader = (title: string) => {
    doc.setFillColor(NAVY); doc.rect(0, 0, W, 38, 'F');
    if (logo) doc.addImage(logo, 'PNG', M, 5, 26, 26, undefined, 'FAST');
    doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('Kilimanjaro Schools', M + 30, 16);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(title, M + 30, 24);
    doc.setFontSize(8); doc.text(`Generated: ${now.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`, M + 30, 31);
    doc.setFillColor(GOLD); doc.rect(0, 38, W, 2.5, 'F');
  };
  const addFooter = (pg: number) => {
    doc.setFillColor(NAVY); doc.rect(0, 285, W, 12, 'F');
    doc.setTextColor('#ffffff'); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Kilimanjaro Schools Management System — Confidential', M, 292);
    doc.text(`Page ${pg}`, W - M, 292, { align: 'right' });
  };
  const sectionTitle = (text: string, y: number) => {
    doc.setFillColor('#f1f5f9'); doc.rect(M, y, W - M * 2, 7, 'F');
    doc.setTextColor(NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    doc.text(text, M + 2, y + 5); return y + 10;
  };

  addHeader('Principal Executive Analytics Summary');
  let y = 48;

  // KPI row
  const totalCollected = Number(fin?.billing?.totalCollected ?? ov?.finance?.totalCollectedThisTerm ?? 0);
  const totalOutstanding = Number(fin?.billing?.totalOutstanding ?? ov?.finance?.totalOutstanding ?? 0);
  const collectionRate = ov?.finance?.collectionRateThisTerm ?? 0;
  const kpis = [
    { label: 'Overall Pass Rate', value: `${(ov?.academic?.overallPassRate ?? 0).toFixed(1)}%` },
    { label: 'At-Risk Students', value: String((atRisk as any[]).length) },
    { label: 'Collection Rate', value: `${collectionRate.toFixed(1)}%` },
    { label: 'Total Classes', value: String((ac?.classRankings || []).length) },
  ];
  const cw = (W - M * 2) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * cw;
    doc.setFillColor('#f8fafc'); doc.roundedRect(x, y, cw - 2, 18, 2, 2, 'F');
    doc.setDrawColor('#e2e8f0'); doc.roundedRect(x, y, cw - 2, 18, 2, 2, 'S');
    doc.setTextColor(NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(k.value, x + (cw - 2) / 2, y + 10, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor('#64748b');
    doc.text(k.label, x + (cw - 2) / 2, y + 15.5, { align: 'center' });
  });
  y += 24;

  // Class league table
  const classes: any[] = ac?.classRankings || [];
  y = sectionTitle('Class Performance League', y);
  const clHdrs = ['Rank', 'Class', 'Stream', 'Avg Score', 'Pass Rate'];
  const clW = [18, 55, 35, 28, 28];
  doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
  let cx = M;
  clHdrs.forEach((h, i) => { doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(h, cx + 2, y + 5); cx += clW[i]; });
  y += rowH;
  classes.forEach((cls: any, idx: number) => {
    doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc'); doc.rect(M, y, W - M * 2, rowH, 'F');
    doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const cells = [`#${cls.rank || idx + 1}`, cls.className || '—', cls.stream || '—',
      `${(cls.average || 0).toFixed(1)}%`, `${(cls.passRate || 0).toFixed(1)}%`];
    cx = M; cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += clW[i]; });
    y += rowH;
    if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('Principal Report (cont.)'); y = 48; }
  });
  y += 6;

  // Finance summary
  y = sectionTitle('Financial Overview', y);
  const fRows = [
    ['Total Collected This Term', `TZS ${totalCollected.toLocaleString()}`],
    ['Total Outstanding', `TZS ${totalOutstanding.toLocaleString()}`],
    ['Collection Rate', `${collectionRate.toFixed(1)}%`],
  ];
  fRows.forEach(([label, val], idx) => {
    doc.setFillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff'); doc.rect(M, y, W - M * 2, rowH, 'F');
    doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(label, M + 4, y + 5);
    doc.setFont('helvetica', 'normal'); doc.text(val, W - M - 4, y + 5, { align: 'right' });
    y += rowH;
  });
  y += 6;

  // Top performers
  if (topPerf.length > 0) {
    y = sectionTitle('Top Performing Students This Term', y);
    const tpHdrs = ['Rank', 'Student Name', 'Class', 'Average', 'Grade', 'Trend'];
    const tpW = [15, 55, 35, 22, 20, 25];
    doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
    cx = M;
    tpHdrs.forEach((h, i) => { doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(h, cx + 2, y + 5); cx += tpW[i]; });
    y += rowH;
    topPerf.slice(0, 15).forEach((s: any, idx: number) => {
      doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc'); doc.rect(M, y, W - M * 2, rowH, 'F');
      doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      const trend = s.improvementDelta > 0 ? `+${s.improvementDelta.toFixed(1)}` : '—';
      const cells = [`#${s.rank || idx + 1}`, s.studentName || '—', s.className || '—',
        `${(s.average || 0).toFixed(1)}%`, s.grade || '—', trend];
      cx = M; cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += tpW[i]; });
      y += rowH;
      if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('Principal Report (cont.)'); y = 48; }
    });
    y += 6;
  }

  // At-risk summary
  if (atRisk.length > 0) {
    if (y > 220) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('Principal Report (cont.)'); y = 48; }
    y = sectionTitle('At-Risk Student Alerts', y);
    const aHdrs = ['Student', 'Class', 'Alert Type', 'Subject'];
    const aW = [55, 35, 50, 42];
    doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
    cx = M;
    aHdrs.forEach((h, i) => { doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(h, cx + 2, y + 5); cx += aW[i]; });
    y += rowH;
    (atRisk as any[]).slice(0, 20).forEach((s: any, idx: number) => {
      doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc'); doc.rect(M, y, W - M * 2, rowH, 'F');
      doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      const cells = [s.studentName || '—', s.className || '—', (s.alertType || '').replace(/_/g, ' '), s.subject || s.subjectName || '—'];
      cx = M; cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += aW[i]; });
      y += rowH;
      if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('Principal Report (cont.)'); y = 48; }
    });
  }

  addFooter(doc.getNumberOfPages());
  doc.save(`Principal_Analytics_Report_${now.toISOString().slice(0, 10)}.pdf`);
}

function ClassLeagueTable({ classes, onSelect }: { classes: any[]; onSelect(id: string): void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!classes.length) return (
    <div className="rounded-2xl border border-ks-line bg-white p-8 text-center text-sm text-ks-muted">
      No class data available for the selected period. Results will populate once marks are published.
    </div>
  );
  const max = Math.max(...classes.map((c) => c.average), 1);
  const q3 = classes.length >= 4 ? classes[Math.floor(classes.length * 0.25)].average : 0;
  const q1 = classes.length >= 4 ? classes[Math.floor(classes.length * 0.75)].average : 100;
  return (
    <div className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line p-4"><h3 className="font-display text-lg font-black text-ks-navy">Class Performance League</h3></div>
      <table className="w-full text-sm">
        <thead className="bg-ks-paper">
          <tr>
            {['Rank', 'Class', 'Avg Score', 'Pass Rate', 'Attendance', 'Actions'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.map((cls: any, i) => {
            const rowColor = cls.average >= q3 ? 'bg-emerald-50' : cls.average <= q1 ? 'bg-rose-50' : '';
            return (
              <React.Fragment key={cls.className + i}>
                <tr className={`border-t border-ks-line cursor-pointer hover:bg-ks-paper ${rowColor}`} onClick={() => setExpanded(expanded === cls.className ? null : cls.className)}>
                  <td className="px-4 py-3 font-mono font-black text-ks-muted">#{cls.rank || i + 1}</td>
                  <td className="px-4 py-3 font-black text-ks-navy">{cls.className} {cls.stream ? <span className="text-ks-muted">· {cls.stream}</span> : ''}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-ks-mist">
                        <div className="h-2 rounded-full bg-[#6C63FF]" style={{ width: `${(cls.average / max) * 100}%` }} />
                      </div>
                      <span className="font-mono font-bold text-ks-navy">{(cls.average || 0).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={cls.passRate >= 70 ? 'emerald' : cls.passRate >= 50 ? 'amber' : 'rose'}>
                      {`${(cls.passRate || 0).toFixed(1)}%`}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-ks-muted">—</td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); onSelect(cls.classId || cls.className); }} className="text-xs font-bold text-[#6C63FF] hover:underline">
                      View detail
                    </button>
                    {expanded === cls.className ? <ChevronDown className="inline h-3 w-3 ml-1" /> : <ChevronRight className="inline h-3 w-3 ml-1" />}
                  </td>
                </tr>
                {expanded === cls.className && (
                  <tr className="border-t border-ks-line bg-slate-50">
                    <td colSpan={6} className="px-6 py-4">
                      <p className="text-xs font-bold text-ks-muted mb-2">Subject Breakdown — {cls.className}</p>
                      <div className="flex flex-wrap gap-3">
                        {(cls.subjectSummaries || []).map((s: any, j: number) => (
                          <div key={j} className="flex items-center gap-2 rounded-lg border border-ks-line bg-white px-3 py-2">
                            <span className="text-xs font-bold text-ks-navy">{s.subjectName}</span>
                            <Badge tone={s.passRate >= 70 ? 'emerald' : s.passRate >= 50 ? 'amber' : 'rose'}>{`${s.passRate.toFixed(0)}%`}</Badge>
                          </div>
                        ))}
                        {!(cls.subjectSummaries?.length) && <p className="text-xs text-ks-muted">No subject data for this class yet.</p>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PrincipalAnalyticsPage() {
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const params = { academicYearId: yearId, termId };

  const { data: overview, isLoading: ovLoading } = useSchoolOverview(params);
  const { data: academic, isLoading: acLoading } = useAcademicOverview(params);
  const { data: atRisk = [] } = useAtRiskStudents();
  const { data: topPerf = [], isLoading: topLoading } = useTopPerformers(params);
  const { data: finance, isLoading: finLoading } = useFinanceAnalyticsOverview(params);

  const ov = overview as any;
  const ac = academic as any;
  const fin = finance as any;

  return (
    <PrincipalWorkspaceShell title="Analytics Dashboard" eyebrow="School performance intelligence">
      <PrincipalBreadcrumb crumbs={[{ label: 'Executive', to: '/principal' }, { label: 'Analytics' }]} />

      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId}
        onDownload={() => generatePrincipalPdf(ov, ac, fin, atRisk as any[], topPerf as any[])} />

      {/* Top stats */}
      {ovLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">{Array(3).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Overall Pass Rate" value={`${(ov?.academic?.overallPassRate ?? 0).toFixed(1)}%`} detail="Published results this term" tone={ov?.academic?.overallPassRate >= 70 ? 'green' : 'amber'} />
          <StatCard label="At-Risk Students" value={((atRisk as any[]).length).toLocaleString()} detail="Unresolved performance alerts" tone="rose" />
          <StatCard label="Collection Rate" value={`${(ov?.finance?.collectionRateThisTerm ?? 0).toFixed(1)}%`} detail={`TZS ${Number(ov?.finance?.totalOutstanding ?? 0).toLocaleString()} outstanding`} tone={ov?.finance?.collectionRateThisTerm >= 80 ? 'green' : 'amber'} />
        </div>
      )}

      {/* Class league */}
      {acLoading ? <ChartSkeleton height="h-72" /> : (
        <ClassLeagueTable classes={ac?.classRankings || []} onSelect={() => {}} />
      )}

      {/* Teacher effectiveness + Trend */}
      <div className="grid gap-gutter xl:grid-cols-2">
        {acLoading ? <ChartSkeleton /> : (
          <BarChart
            title="Teacher Effectiveness"
            subtitle="Average pass rate by teacher assignment"
            values={(ac?.teacherPerformanceSummary || []).slice(0, 8).map((t: any) => ({
              label: `${t.subjectName} · ${t.className}`,
              value: Math.round(t.passRate || 0),
            }))}
          />
        )}
        {ovLoading ? <ChartSkeleton /> : (
          <LineChart
            title="School Average Trend"
            subtitle="Term-over-term average score"
            values={(ov?.kpiTrends?.passRateByTerm || []).map((t: any) => t.rate)}
            labels={(ov?.kpiTrends?.passRateByTerm || []).map((t: any) => t.period)}
          />
        )}
      </div>

      {/* Finance pulse */}
      {finLoading ? <ChartSkeleton /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          <DoughnutChart
            title="Fee Collection Breakdown"
            segments={[
              { label: 'Collected', value: Math.round(Number(fin?.billing?.totalCollected ?? ov?.finance?.totalCollectedThisTerm ?? 0)), color: '#10b981' },
              { label: 'Outstanding', value: Math.round(Number(fin?.billing?.totalOutstanding ?? ov?.finance?.totalOutstanding ?? 0)), color: '#ef4444' },
            ]}
          />
          <LineChart
            title="Attendance Rate Trend"
            subtitle="School-wide attendance by period"
            values={(ov?.kpiTrends?.attendanceRateByTerm || []).map((t: any) => t.rate)}
            labels={(ov?.kpiTrends?.attendanceRateByTerm || []).map((t: any) => t.period)}
          />
        </div>
      )}

      {/* Top performers */}
      {topLoading ? <ChartSkeleton height="h-52" /> : (
        <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
          <div className="border-b border-ks-line p-4"><h3 className="font-display text-lg font-black text-ks-navy">Top Performers This Term</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-ks-paper">
              <tr>{['Rank', 'Student', 'Class', 'Average', 'Grade', 'Trend'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(topPerf as any[]).length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-ks-muted">No published results yet for the selected period.</td></tr>
              ) : (topPerf as any[]).slice(0, 10).map((s: any, i) => (
                <tr key={i} className="border-t border-ks-line hover:bg-ks-paper">
                  <td className="px-4 py-3 font-mono font-black text-ks-gold">#{s.rank || i + 1}</td>
                  <td className="px-4 py-3 font-black text-ks-navy">{s.studentName}</td>
                  <td className="px-4 py-3 text-ks-muted">{s.className}</td>
                  <td className="px-4 py-3 font-mono font-bold text-ks-navy">{(s.average || 0).toFixed(1)}%</td>
                  <td className="px-4 py-3"><Badge tone={s.grade ? 'emerald' : 'slate'}>{s.grade || '—'}</Badge></td>
                  <td className="px-4 py-3 text-xs font-bold text-ks-emerald">{s.improvementDelta > 0 ? `▲ +${s.improvementDelta.toFixed(1)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PrincipalWorkspaceShell>
  );
}
