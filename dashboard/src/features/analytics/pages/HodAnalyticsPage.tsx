import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { HodWorkspaceShell } from '../../hod/components/HodWorkspaceShell';
import {
  useAcademicOverview,
  useAtRiskStudents,
  useDepartmentSubject,
} from '../api/analytics.hooks';
import { BarChart, StatCard, ChartSkeleton, StatSkeleton } from '../components/Charts';

function YearTermBar({ yearId, termId, onYear, onTerm }: { yearId: string; termId: string; onYear(v: string): void; onTerm(v: string): void }) {
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
    </div>
  );
}

function TeacherCards({ teachers }: { teachers: any[] }) {
  if (!teachers.length) return (
    <div className="rounded-2xl border border-ks-line bg-white p-8 text-center text-sm text-ks-muted">
      No teacher data available for the selected period.
    </div>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {teachers.map((t: any, i) => {
        const passRate = t.passRate || 0;
        const tone = passRate >= 70 ? 'emerald' : passRate >= 50 ? 'amber' : 'rose';
        return (
          <div key={i} className="rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-black text-ks-navy">{t.teacherName || t.name || 'Teacher'}</p>
                <p className="mt-0.5 text-xs text-ks-muted">{t.subjectName} · {t.className}</p>
              </div>
              <Badge tone={tone}>{`${passRate.toFixed(1)}%`}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-ks-line pt-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Students</p>
                <p className="mt-1 font-mono text-sm font-black text-ks-navy">{t.totalStudents ?? '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Coverage</p>
                <p className="mt-1 font-mono text-sm font-black text-ks-navy">
                  {t.topicsCovered != null ? `${Math.round((t.topicsCovered / Math.max(t.totalTopics || 1, 1)) * 100)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Assessments</p>
                <p className="mt-1 font-mono text-sm font-black text-ks-navy">{t.assessmentCount ?? '—'}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScoreHistogram({ distribution }: { distribution: Record<string, number> }) {
  const bands = ['0-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];
  const values = bands.map((b) => distribution?.[b] ?? 0);
  const max = Math.max(...values, 1);
  const colors = ['#ef4444', '#ef4444', '#f59e0b', '#f59e0b', '#94a3b8', '#10b981', '#10b981', '#10b981'];
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <h3 className="font-display text-lg font-black text-ks-navy">Score Distribution Histogram</h3>
      <p className="mt-0.5 text-xs font-semibold text-ks-muted">Number of students per score band</p>
      <div className="mt-5 flex items-end gap-2" style={{ height: 140 }}>
        {bands.map((band, i) => {
          const h = Math.round((values[i] / max) * 120);
          return (
            <div key={band} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[9px] font-bold text-ks-muted">{values[i]}</span>
              <div className="w-full rounded-t" style={{ height: h, background: colors[i], minHeight: values[i] > 0 ? 4 : 0 }} />
              <span className="text-[8px] font-bold text-ks-muted leading-tight text-center">{band}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectDeepDive({ subjects, params }: { subjects: any[]; params: Record<string, string> }) {
  const [selectedId, setSelectedId] = useState('');
  const { data: detail, isLoading } = useDepartmentSubject(selectedId, params);
  const d = detail as any;

  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">Subject Deep-Dive</h3>
        <select
          className="rounded-lg border border-ks-line bg-ks-paper px-3 py-1.5 text-sm font-bold text-ks-navy outline-none"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a subject…</option>
          {subjects.map((s: any) => (
            <option key={s.subjectId || s.subjectName} value={s.subjectId || s.subjectName}>
              {s.subjectName}
            </option>
          ))}
        </select>
      </div>
      {!selectedId ? (
        <p className="p-8 text-center text-sm text-ks-muted">Select a subject above to view detailed analytics.</p>
      ) : isLoading ? (
        <div className="p-6"><ChartSkeleton /></div>
      ) : !d ? (
        <p className="p-8 text-center text-sm text-ks-muted">No data found for the selected subject.</p>
      ) : (
        <div className="space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Pass Rate" value={`${(d.passRate || d.summary?.passRate || 0).toFixed(1)}%`} tone={d.passRate >= 70 ? 'green' : 'amber'} />
            <StatCard label="Average Score" value={`${(d.averageScore || d.summary?.averageScore || 0).toFixed(1)}%`} tone="blue" />
            <StatCard label="Total Students" value={(d.totalStudents || d.summary?.totalStudents || 0).toLocaleString()} tone="blue" />
          </div>
          {d.scoreDistribution && <ScoreHistogram distribution={d.scoreDistribution} />}
          {d.classBreakdown?.length > 0 && (
            <BarChart
              title="Class Breakdown"
              subtitle={`${d.subjectName || 'Subject'} pass rate by class`}
              values={(d.classBreakdown || []).map((c: any) => ({ label: c.className, value: Math.round(c.passRate || 0) }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function HodAnalyticsPage() {
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const params = { academicYearId: yearId, termId };

  const { data: academic, isLoading: acLoading } = useAcademicOverview(params);
  const { data: atRisk = [], isLoading: riskLoading } = useAtRiskStudents(params);

  const ac = academic as any;
  const teachers: any[] = ac?.teacherPerformanceSummary || [];
  const subjects: any[] = ac?.subjectRankings || [];

  const avgPass = teachers.length ? teachers.reduce((s, t) => s + (t.passRate || 0), 0) / teachers.length : 0;
  const avgCoverage = subjects.length
    ? Math.round(subjects.reduce((s: number, x: any) => s + Math.min(100, ((x.topicsCovered || 0) / Math.max(x.totalTopics || 1, 1)) * 100), 0) / subjects.length)
    : 0;

  return (
    <HodWorkspaceShell title="Department Analytics" eyebrow="Department Intelligence Hub">
      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

      {/* Department health stats */}
      {acLoading ? (
        <div className="grid gap-4 sm:grid-cols-4">{Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Dept Avg Pass Rate" value={`${avgPass.toFixed(1)}%`} detail="Across all assignments" tone={avgPass >= 70 ? 'green' : 'amber'} />
          <StatCard label="Teachers Active" value={teachers.length.toLocaleString()} detail="With published marks" tone="blue" />
          <StatCard label="Avg Syllabus Coverage" value={`${avgCoverage}%`} detail="Topics covered vs planned" tone={avgCoverage >= 80 ? 'green' : 'amber'} />
          <StatCard label="At-Risk Students" value={(atRisk as any[]).length.toLocaleString()} detail="Unresolved alerts in dept" tone="rose" />
        </div>
      )}

      {/* Teacher performance cards */}
      {acLoading ? <ChartSkeleton height="h-56" /> : <TeacherCards teachers={teachers} />}

      {/* Subject rankings */}
      {acLoading ? <ChartSkeleton /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          <BarChart
            title="Subject Pass Rates"
            subtitle="Ranked by term pass rate"
            values={[...subjects].sort((a, b) => (b.passRate || 0) - (a.passRate || 0)).slice(0, 8).map((s: any) => ({
              label: s.subjectName,
              value: Math.round(s.passRate || 0),
            }))}
          />
          <BarChart
            title="Assessment Volume"
            subtitle="Number of assessments submitted per subject"
            values={subjects.slice(0, 8).map((s: any) => ({
              label: s.subjectName,
              value: s.assessmentCount || 0,
            }))}
          />
        </div>
      )}

      {/* Subject deep-dive */}
      {acLoading ? <ChartSkeleton height="h-56" /> : (
        <SubjectDeepDive subjects={subjects} params={params} />
      )}

      {/* At-risk in dept */}
      {riskLoading ? <ChartSkeleton height="h-52" /> : (
        <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
          <div className="border-b border-ks-line p-4">
            <h3 className="font-display text-lg font-black text-ks-navy">Department At-Risk Students</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-ks-paper">
              <tr>
                {['Student', 'Class', 'Alert', 'Subject'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(atRisk as any[]).length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ks-muted">No at-risk students found. Department is performing well!</td></tr>
              ) : (atRisk as any[]).slice(0, 12).map((s: any, i) => (
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
    </HodWorkspaceShell>
  );
}
