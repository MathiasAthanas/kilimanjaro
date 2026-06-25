import { useState } from 'react';
import { BarChart3, CheckCircle2 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { TeacherWorkspaceShell } from '../../teacher/components/TeacherWorkspaceShell';
import { useTeacherMyDashboard } from '../api/analytics.hooks';
import { BarChart, LineChart, StatCard, ChartSkeleton, StatSkeleton } from '../components/Charts';

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
      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

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
