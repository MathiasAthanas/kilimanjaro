import { useState } from 'react';
import { BarChart3, CheckCircle2, FileDown } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { TeacherWorkspaceShell } from '../../teacher/components/TeacherWorkspaceShell';
import { useTeacherMyDashboard } from '../api/analytics.hooks';
import { BarChart, LineChart, StatCard, ChartSkeleton, StatSkeleton } from '../components/Charts';
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

function CourseCards({ courses }: { courses: any[] }) {
  if (!courses.length) return (
    <div className="rounded-2xl border border-ks-line bg-white p-8 text-center text-sm text-ks-muted">
      No course data for the selected period. Marks will appear once published.
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {courses.map((c: any, i) => {
        const passRate = c.passRate || 0;
        const coverage = c.topicsCovered != null && c.totalTopics
          ? Math.round((c.topicsCovered / c.totalTopics) * 100) : null;
        return (
          <div key={i} className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-ks-navy">{c.subjectName}</p>
                <p className="mt-0.5 text-xs text-ks-muted">{c.className} · {c.totalStudents ?? '—'} students</p>
              </div>
              <Badge tone={passRate >= 70 ? 'emerald' : passRate >= 50 ? 'amber' : 'rose'}>{`${passRate.toFixed(1)}%`}</Badge>
            </div>
            {coverage !== null && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-ks-muted">
                  <span>Syllabus Progress</span>
                  <span>{coverage}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ks-mist">
                  <div
                    className={`h-full rounded-full transition-all ${coverage >= 80 ? 'bg-emerald-500' : coverage >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                    style={{ width: `${coverage}%` }}
                  />
                </div>
                <p className="mt-1 text-[9px] text-ks-muted">{c.topicsCovered} of {c.totalTopics} topics covered</p>
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-ks-line pt-4 text-center">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-ks-muted">Avg Score</p>
                <p className="mt-0.5 font-mono text-sm font-black text-ks-navy">{(c.averageScore || 0).toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-ks-muted">Pass</p>
                <p className="mt-0.5 font-mono text-sm font-black text-ks-emerald">{c.passingStudents ?? '—'}</p>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-ks-muted">Fail</p>
                <p className="mt-0.5 font-mono text-sm font-black text-ks-rose">
                  {c.totalStudents != null && c.passingStudents != null ? c.totalStudents - c.passingStudents : '—'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttentionQueue({ queue }: { queue: any[] }) {
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">Student Attention Queue</h3>
        <p className="mt-0.5 text-xs font-semibold text-ks-muted">Students in your classes who need follow-up</p>
      </div>
      {queue.length === 0 ? (
        <div className="flex items-center gap-3 p-6 text-sm text-ks-emerald">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="font-bold">All students in your classes are on track. No immediate attention required.</span>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-ks-paper">
            <tr>
              {['Student', 'Class', 'Subject', 'Alert', 'Priority'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.slice(0, 15).map((s: any, i) => (
              <tr key={i} className="border-t border-ks-line hover:bg-ks-paper">
                <td className="px-4 py-3 font-bold text-ks-navy">{s.studentName}</td>
                <td className="px-4 py-3 text-ks-muted">{s.className}</td>
                <td className="px-4 py-3 text-ks-muted">{s.subjectName || '—'}</td>
                <td className="px-4 py-3"><Badge tone="rose">{(s.alertType || s.type || '').replace(/_/g, ' ')}</Badge></td>
                <td className="px-4 py-3">
                  <Badge tone={s.severity === 'HIGH' || s.priority === 'HIGH' ? 'rose' : 'amber'}>
                    {s.severity || s.priority || 'MEDIUM'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const NAVY = '#00334f';
const GOLD = '#d59a1b';

async function generateTeacherPdf(summary: any, courses: any[], attentionQueue: any[]) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), getLogoBase64()]);
  const doc = new (jsPDF as any)({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as any;
  const W = 210, M = 14, now = new Date();

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
    doc.text(text, M + 2, y + 5);
    return y + 10;
  };

  // ── Page 1 ──
  addHeader('Teaching Performance Report');
  let y = 48;

  // KPI row
  const kpis = [
    { label: 'Overall Pass Rate', value: `${(summary.overallPassRate ?? 0).toFixed(1)}%` },
    { label: 'Classes Assigned', value: String(summary.totalClasses ?? courses.length) },
    { label: 'Total Students', value: String(summary.totalStudents ?? 0) },
    { label: 'Attention Needed', value: String(attentionQueue.length) },
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

  // Courses table
  y = sectionTitle('My Course Performance', y);
  const courseHdrs = ['Subject', 'Class', 'Students', 'Avg Score', 'Pass Rate', 'Coverage'];
  const colW = [50, 35, 22, 22, 22, 22];
  const rowH = 7;
  doc.setFillColor(NAVY);
  doc.rect(M, y, W - M * 2, rowH, 'F');
  let cx = M;
  courseHdrs.forEach((h, i) => {
    doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    doc.text(h, cx + 2, y + 5); cx += colW[i];
  });
  y += rowH;
  courses.forEach((c: any, idx: number) => {
    const cov = c.topicsCovered != null && c.totalTopics ? Math.round((c.topicsCovered / c.totalTopics) * 100) : null;
    doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc');
    doc.rect(M, y, W - M * 2, rowH, 'F');
    doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    const cells = [c.subjectName || '—', c.className || '—', String(c.totalStudents ?? '—'),
      `${(c.averageScore || 0).toFixed(1)}`, `${(c.passRate || 0).toFixed(1)}%`, cov !== null ? `${cov}%` : '—'];
    cx = M;
    cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += colW[i]; });
    y += rowH;
    if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('Teaching Performance Report (cont.)'); y = 48; }
  });
  y += 6;

  // Attention queue
  if (attentionQueue.length > 0) {
    y = sectionTitle('Student Attention Queue', y);
    const aqHdrs = ['Student Name', 'Class', 'Subject', 'Alert Type', 'Priority'];
    const aqW = [52, 30, 36, 40, 24];
    doc.setFillColor(NAVY); doc.rect(M, y, W - M * 2, rowH, 'F');
    cx = M;
    aqHdrs.forEach((h, i) => {
      doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
      doc.text(h, cx + 2, y + 5); cx += aqW[i];
    });
    y += rowH;
    attentionQueue.slice(0, 20).forEach((s: any, idx: number) => {
      doc.setFillColor(idx % 2 === 0 ? '#ffffff' : '#f8fafc');
      doc.rect(M, y, W - M * 2, rowH, 'F');
      doc.setTextColor('#1e293b'); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      const cells = [s.studentName || '—', s.className || '—', s.subjectName || '—',
        (s.alertType || s.type || '').replace(/_/g, ' '), s.severity || s.priority || 'MEDIUM'];
      cx = M;
      cells.forEach((v, i) => { doc.text(v, cx + 2, y + 5); cx += aqW[i]; });
      y += rowH;
      if (y > 268) { addFooter(doc.getNumberOfPages()); doc.addPage(); addHeader('Teaching Performance Report (cont.)'); y = 48; }
    });
  }

  addFooter(doc.getNumberOfPages());
  doc.save(`Teacher_Analytics_Report_${now.toISOString().slice(0, 10)}.pdf`);
}

export function TeacherAnalyticsPage() {
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const params = { academicYearId: yearId, termId };

  const { data: dashboard, isLoading } = useTeacherMyDashboard(params);
  const d = dashboard as any;

  const summary = d?.summary || {};
  const courses: any[] = d?.courses || [];
  const attentionQueue: any[] = d?.attentionQueue || [];
  const termTrend: any[] = d?.termTrend || [];

  return (
    <TeacherWorkspaceShell title="My Teaching Analytics" eyebrow="Teaching Performance Overview">
      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId}
        onDownload={() => generateTeacherPdf(summary, courses, attentionQueue)} />

      {/* Summary stats */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">{Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Overall Pass Rate"
            value={`${(summary.overallPassRate ?? 0).toFixed(1)}%`}
            detail="Across all my classes"
            tone={summary.overallPassRate >= 70 ? 'green' : 'amber'}
          />
          <StatCard
            label="Classes Assigned"
            value={(summary.totalClasses ?? courses.length).toLocaleString()}
            detail="Active this term"
            tone="blue"
          />
          <StatCard
            label="Total Students"
            value={(summary.totalStudents ?? 0).toLocaleString()}
            detail="Across all my classes"
            tone="blue"
          />
          <StatCard
            label="Attention Needed"
            value={attentionQueue.length.toLocaleString()}
            detail="Students flagged in my classes"
            tone={attentionQueue.length > 0 ? 'rose' : 'green'}
          />
        </div>
      )}

      {/* Course cards */}
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-ks-muted">My Course Performance</p>
        {isLoading ? <ChartSkeleton height="h-56" /> : <CourseCards courses={courses} />}
      </div>

      {/* Term trend */}
      {isLoading ? <ChartSkeleton /> : termTrend.length > 0 && (
        <LineChart
          title="My Pass Rate Trend"
          subtitle="Term-over-term pass rate across all assignments"
          values={termTrend.map((t: any) => t.passRate || t.averageScore || 0)}
          labels={termTrend.map((t: any) => t.termName || t.period || '')}
        />
      )}

      {/* Course comparison bar */}
      {isLoading ? <ChartSkeleton /> : courses.length > 0 && (
        <div className="grid gap-gutter xl:grid-cols-2">
          <BarChart
            title="Pass Rate by Course"
            subtitle="Comparison across my active class assignments"
            values={courses.map((c: any) => ({ label: `${c.subjectName} · ${c.className}`, value: Math.round(c.passRate || 0) }))}
          />
          <BarChart
            title="Average Score by Course"
            subtitle="Mean score of published results"
            values={courses.map((c: any) => ({ label: `${c.subjectName} · ${c.className}`, value: Math.round(c.averageScore || 0) }))}
          />
        </div>
      )}

      {/* Attention queue */}
      {isLoading ? <ChartSkeleton height="h-52" /> : <AttentionQueue queue={attentionQueue} />}
    </TeacherWorkspaceShell>
  );
}
