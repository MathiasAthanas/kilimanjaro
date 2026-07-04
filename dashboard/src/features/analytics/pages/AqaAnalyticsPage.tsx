import { useState } from 'react';
import { BarChart3, FileDown } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { AqaWorkspaceShell } from '../../aqa/components/AqaWorkspaceShell';
import {
  useAcademicOverview,
  useAtRiskStudents,
} from '../api/analytics.hooks';
import { BarChart, StatCard, ChartSkeleton, StatSkeleton } from '../components/Charts';
import { getLogoBase64 } from '../../finance/components/FinanceWorkspaceShell';

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

async function generateAqaPdf(subjects: any[], teachers: any[], atRisk: any[], ac: any) {
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

  addHeader('Academic Quality Intelligence Report');
  let y = 48;

  const avgCoverage = subjects.length
    ? Math.round(subjects.reduce((s: number, x: any) => s + Math.min(100, ((x.topicsCovered || 0) / Math.max(x.totalTopics || 1, 1)) * 100), 0) / subjects.length) : 0;

  // KPI row
  const kpis = [
    { label: 'School Pass Rate', value: `${(ac?.summary?.averagePassRate ?? 0).toFixed(1)}%` },
    { label: 'Subjects Tracked', value: String(subjects.length) },
    { label: 'Avg Coverage', value: `${avgCoverage}%` },
    { label: 'At-Risk Students', value: String(atRisk.length) },
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

  // Syllabus coverage table
  y = sectionTitle('Syllabus Coverage by Subject', y);
  const scHdrs = ['Subject', 'Topics Covered', 'Total Topics', 'Coverage %', 'Status'];
  const scW = [55, 30, 30, 28, 30];
  doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
  let cx = M;
  scHdrs.forEach((h, i) => { doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(h, cx + 2, y + 5); cx += scW[i]; });
  y += rowH;
  subjects.forEach((s: any, idx: number) => {
    const pct = Math.min(100, Math.round(((s.topicsCovered || 0) / Math.max(s.totalTopics || 1, 1)) * 100));
    const status = pct >= 80 ? 'On Track' : pct >= 50 ? 'In Progress' : 'Behind';
    doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc'); doc.rect(M, y, W - M * 2, rowH, 'F');
    doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const cells = [s.subjectName || '—', String(s.topicsCovered ?? '—'), String(s.totalTopics ?? '—'), `${pct}%`, status];
    cx = M; cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += scW[i]; });
    y += rowH;
    if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('AQA Report (cont.)'); y = 48; }
  });
  y += 6;

  // Teacher delivery scorecard
  y = sectionTitle('Teacher Delivery Scorecard', y);
  const tdHdrs = ['Teacher', 'Subject · Class', 'Coverage', 'Pass Rate', 'Assessments', 'Status'];
  const tdW = [38, 44, 22, 22, 24, 22];
  doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
  cx = M;
  tdHdrs.forEach((h, i) => { doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(h, cx + 2, y + 5); cx += tdW[i]; });
  y += rowH;
  teachers.forEach((t: any, idx: number) => {
    const cov = Math.min(100, Math.round(((t.topicsCovered || 0) / Math.max(t.totalTopics || 1, 1)) * 100));
    const isOk = t.passRate >= 60 && cov >= 70;
    doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc'); doc.rect(M, y, W - M * 2, rowH, 'F');
    doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const cells = [t.teacherName || '—', `${t.subjectName || '—'} · ${t.className || '—'}`, `${cov}%`,
      `${(t.passRate || 0).toFixed(1)}%`, String(t.assessmentCount ?? '—'), isOk ? 'On Track' : 'Needs Review'];
    cx = M; cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += tdW[i]; });
    y += rowH;
    if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('AQA Report (cont.)'); y = 48; }
  });
  y += 6;

  // At-risk
  if (atRisk.length > 0) {
    y = sectionTitle('At-Risk Student Summary', y);
    const aHdrs = ['Student', 'Class', 'Alert Type', 'Subject'];
    const aW = [55, 35, 50, 42];
    doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
    cx = M;
    aHdrs.forEach((h, i) => { doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.text(h, cx + 2, y + 5); cx += aW[i]; });
    y += rowH;
    atRisk.slice(0, 20).forEach((s: any, idx: number) => {
      doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc'); doc.rect(M, y, W - M * 2, rowH, 'F');
      doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      const cells = [s.studentName || '—', s.className || '—', (s.alertType || '').replace(/_/g, ' '), s.subject || s.subjectName || '—'];
      cx = M; cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += aW[i]; });
      y += rowH;
      if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('AQA Report (cont.)'); y = 48; }
    });
  }

  addFooter(doc.getNumberOfPages());
  doc.save(`AQA_Analytics_Report_${now.toISOString().slice(0, 10)}.pdf`);
}

function SyllabusCoverageGrid({ subjects }: { subjects: any[] }) {
  if (!subjects.length) return (
    <div className="rounded-2xl border border-ks-line bg-white p-8 text-center text-sm text-ks-muted">
      No syllabus data available. Coverage will appear once teachers log progress.
    </div>
  );
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">Syllabus Coverage Grid</h3>
        <p className="mt-0.5 text-xs font-semibold text-ks-muted">Topics covered vs planned per subject</p>
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-4">
        {subjects.map((s: any, i) => {
          const pct = Math.min(100, Math.round(((s.topicsCovered || 0) / Math.max(s.totalTopics || 1, 1)) * 100));
          const tone = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';
          return (
            <div key={i} className="rounded-xl border border-ks-line p-3">
              <p className="truncate text-xs font-black text-ks-navy">{s.subjectName}</p>
              <p className="mt-0.5 text-[10px] text-ks-muted">{s.topicsCovered ?? '—'} / {s.totalTopics ?? '—'} topics</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ks-mist">
                <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 font-mono text-[10px] font-bold text-ks-muted">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeacherDeliveryScorecard({ teachers }: { teachers: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">Teacher Delivery Scorecard</h3>
        <p className="mt-0.5 text-xs font-semibold text-ks-muted">AQA-verified delivery metrics per assignment</p>
      </div>
      {teachers.length === 0 ? (
        <p className="p-8 text-center text-sm text-ks-muted">Scorecard data will populate after AQA engine runs.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-ks-paper">
            <tr>
              {['Teacher', 'Subject · Class', 'Coverage', 'Pass Rate', 'Assessments', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.map((t: any, i) => {
              const cov = Math.min(100, Math.round(((t.topicsCovered || 0) / Math.max(t.totalTopics || 1, 1)) * 100));
              const isOk = t.passRate >= 60 && cov >= 70;
              return (
                <>
                  <tr key={i} className="cursor-pointer border-t border-ks-line hover:bg-ks-paper" onClick={() => setExpanded(expanded === t.teacherName + i ? null : t.teacherName + i)}>
                    <td className="px-4 py-3 font-black text-ks-navy">{t.teacherName}</td>
                    <td className="px-4 py-3 text-ks-muted">{t.subjectName} · {t.className}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ks-mist">
                          <div className={`h-full rounded-full ${cov >= 80 ? 'bg-emerald-500' : cov >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${cov}%` }} />
                        </div>
                        <span className="font-mono text-xs font-bold">{cov}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={t.passRate >= 70 ? 'emerald' : t.passRate >= 50 ? 'amber' : 'rose'}>{`${(t.passRate || 0).toFixed(1)}%`}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ks-muted">{t.assessmentCount ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge tone={isOk ? 'emerald' : 'rose'}>{isOk ? 'On Track' : 'Needs Review'}</Badge>
                    </td>
                  </tr>
                  {expanded === t.teacherName + i && (
                    <tr className="border-t border-ks-line bg-slate-50">
                      <td colSpan={6} className="px-6 py-3">
                        <p className="text-xs text-ks-muted">
                          <strong>Students:</strong> {t.totalStudents ?? '—'} &nbsp;|&nbsp;
                          <strong>Pass:</strong> {t.passingStudents ?? '—'} &nbsp;|&nbsp;
                          <strong>Fail:</strong> {(t.totalStudents || 0) - (t.passingStudents || 0)} &nbsp;|&nbsp;
                          <strong>Attendance:</strong> {t.attendanceRate != null ? `${t.attendanceRate.toFixed(1)}%` : '—'}
                        </p>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AqaAnalyticsPage() {
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const params = { academicYearId: yearId, termId };

  const { data: academic, isLoading: acLoading } = useAcademicOverview(params);
  const { data: atRisk = [], isLoading: riskLoading } = useAtRiskStudents(params);

  const ac = academic as any;

  const subjects: any[] = ac?.subjectRankings || [];
  const teachers: any[] = ac?.teacherPerformanceSummary || [];

  const avgCoverage = subjects.length
    ? Math.round(subjects.reduce((s: number, x: any) => s + Math.min(100, ((x.topicsCovered || 0) / Math.max(x.totalTopics || 1, 1)) * 100), 0) / subjects.length)
    : 0;

  return (
    <AqaWorkspaceShell title="Analytics Intelligence" eyebrow="Academic Quality Intelligence">
      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId}
        onDownload={() => generateAqaPdf(subjects, teachers, atRisk as any[], ac)} />

      {/* Summary stats */}
      {acLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">{Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="School Pass Rate" value={`${(ac?.summary?.averagePassRate ?? 0).toFixed(1)}%`} detail="Published results this period" tone={ac?.summary?.averagePassRate >= 70 ? 'green' : 'amber'} />
          <StatCard label="Subjects Tracked" value={(subjects.length).toLocaleString()} detail="With published marks data" tone="blue" />
          <StatCard label="Avg Syllabus Coverage" value={`${avgCoverage}%`} detail="Across all subject assignments" tone={avgCoverage >= 80 ? 'green' : 'amber'} />
          <StatCard label="At-Risk Students" value={((atRisk as any[]).length).toLocaleString()} detail="Unresolved performance alerts" tone="rose" />
        </div>
      )}

      {/* Syllabus coverage grid */}
      {acLoading ? <ChartSkeleton height="h-64" /> : <SyllabusCoverageGrid subjects={subjects} />}

      {/* Assessment distribution + cross-year comparison */}
      <div className="grid gap-gutter xl:grid-cols-2">
        {acLoading ? <ChartSkeleton /> : (
          <BarChart
            title="Assessment Distribution"
            subtitle="Number of assessments submitted per subject"
            values={subjects.slice(0, 8).map((s: any) => ({
              label: s.subjectName,
              value: s.assessmentCount || 0,
            }))}
          />
        )}
        {acLoading ? <ChartSkeleton /> : (
          <BarChart
            title="Subject Pass Rate Ranking"
            subtitle="Pass rate % ordered by performance"
            values={[...subjects].sort((a, b) => (b.passRate || 0) - (a.passRate || 0)).slice(0, 8).map((s: any) => ({
              label: s.subjectName,
              value: Math.round(s.passRate || 0),
            }))}
          />
        )}
      </div>

      {/* Class performance trend */}
      {acLoading ? <ChartSkeleton /> : (
        <BarChart
          title="Class Performance Overview"
          subtitle="Average score by class — ordered from highest to lowest"
          values={(ac?.classRankings || []).slice(0, 10).map((c: any) => ({
            label: c.className,
            value: Math.round(c.average || 0),
          }))}
        />
      )}

      {/* Teacher delivery scorecard */}
      {acLoading ? <ChartSkeleton height="h-64" /> : <TeacherDeliveryScorecard teachers={teachers} />}

      {/* At-risk breakdown */}
      {riskLoading ? <ChartSkeleton height="h-52" /> : (
        <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
          <div className="border-b border-ks-line p-4">
            <h3 className="font-display text-lg font-black text-ks-navy">At-Risk Alert Summary</h3>
            <p className="mt-0.5 text-xs font-semibold text-ks-muted">Students flagged for academic or attendance concerns</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-ks-paper">
              <tr>
                {['Student', 'Class', 'Alert Type', 'Subject'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(atRisk as any[]).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ks-muted">No at-risk students for the selected period.</td></tr>
              ) : (atRisk as any[]).slice(0, 15).map((s: any, i) => (
                <tr key={i} className="border-t border-ks-line hover:bg-ks-paper">
                  <td className="px-4 py-3 font-bold text-ks-navy">{s.studentName}</td>
                  <td className="px-4 py-3 text-ks-muted">{s.className}</td>
                  <td className="px-4 py-3"><Badge tone="rose">{(s.alertType || '').replace(/_/g, ' ')}</Badge></td>
                  <td className="px-4 py-3 text-ks-muted">{s.subject || s.subjectName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AqaWorkspaceShell>
  );
}
