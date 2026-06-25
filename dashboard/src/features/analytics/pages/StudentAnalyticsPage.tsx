import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { useStudentMyDashboard } from '../api/analytics.hooks';
import { ProgressRing, RadarChart, LineChart, AttendanceHeatmap, ChartSkeleton } from '../components/Charts';

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

function SubjectResultsTable({ subjects }: { subjects: any[] }) {
  if (!subjects.length) return (
    <div className="rounded-2xl border border-ks-line bg-white p-8 text-center text-sm text-ks-muted">
      No subject results yet. Results will appear once marks are published.
    </div>
  );
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">My Subject Results</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-ks-paper">
          <tr>
            {['Subject', 'Score', 'Grade', 'Status', 'Teacher'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s: any, i) => (
            <tr key={i} className="border-t border-ks-line hover:bg-ks-paper">
              <td className="px-4 py-3 font-black text-ks-navy">{s.subjectName}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-ks-mist">
                    <div
                      className={`h-full rounded-full ${s.score >= 70 ? 'bg-emerald-500' : s.score >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${Math.min(s.score || 0, 100)}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-ks-navy">{(s.score || 0).toFixed(1)}%</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.score >= 70 ? 'emerald' : s.score >= 50 ? 'amber' : 'rose'}>{s.grade || '—'}</Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={s.passed ? 'emerald' : 'rose'}>{s.passed ? 'Pass' : 'Fail'}</Badge>
              </td>
              <td className="px-4 py-3 text-ks-muted">{s.teacherName || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StudentAnalyticsPage() {
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');
  const params = { academicYearId: yearId, termId };

  const { data: dashboard, isLoading } = useStudentMyDashboard(params);
  const d = dashboard as any;

  const summary = d?.summary || {};
  const subjectResults: any[] = d?.subjectResults || [];
  const scoreJourney: any[] = d?.scoreJourney || [];
  const subjectRadar: any = d?.subjectRadar || {};
  const attendanceCalendar: any[] = d?.attendanceCalendar || [];
  const activeAlerts: any[] = d?.activeAlerts || [];

  const radarAxes: string[] = subjectRadar?.axes || subjectResults.map((s: any) => s.subjectName?.slice(0, 6) || '');
  const radarValues: number[] = subjectRadar?.values || subjectResults.map((s: any) => s.score || 0);

  const overallScore = summary.averageScore ?? 0;
  const passRate = summary.passRate ?? 0;
  const attendanceRate = summary.attendanceRate ?? 0;

  return (
    <div className="space-y-gutter">
      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-ks-navy/15 bg-[linear-gradient(135deg,#061f33,#0c4a6e_55%,#00334f)] p-8 text-white shadow-layer">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ks-blue/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-ks-gold">My Progress</p>
            <h1 className="mt-2 font-display text-[44px] font-bold leading-[52px] tracking-[-0.02em]">My Analytics</h1>
            <p className="mt-1.5 text-sm font-semibold text-white/70">Personal academic performance dashboard</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={passRate >= 70 ? 'emerald' : passRate >= 50 ? 'amber' : 'rose'}>{`Pass Rate ${passRate.toFixed(1)}%`}</Badge>
            <Badge tone={attendanceRate >= 85 ? 'emerald' : 'amber'}>{`Attendance ${attendanceRate.toFixed(1)}%`}</Badge>
          </div>
        </div>
      </section>

      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

      {/* Progress ring hero */}
      {isLoading ? (
        <ChartSkeleton height="h-48" />
      ) : (
        <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ProgressRing value={overallScore} max={100} label="Overall Score" size={140} color={overallScore >= 70 ? '#10b981' : overallScore >= 50 ? '#f59e0b' : '#ef4444'} />
              <ProgressRing value={passRate} max={100} label="Pass Rate" size={120} color="#6C63FF" />
              <ProgressRing value={attendanceRate} max={100} label="Attendance" size={120} color={attendanceRate >= 85 ? '#10b981' : '#f59e0b'} />
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-ks-muted">This Term Summary</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-ks-line p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Subjects</p>
                  <p className="mt-1 font-mono text-2xl font-black text-ks-navy">{subjectResults.length}</p>
                </div>
                <div className="rounded-xl border border-ks-line p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Passed</p>
                  <p className="mt-1 font-mono text-2xl font-black text-ks-emerald">{subjectResults.filter((s) => s.passed).length}</p>
                </div>
                <div className="rounded-xl border border-ks-line p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Alerts</p>
                  <p className="mt-1 font-mono text-2xl font-black text-ks-rose">{activeAlerts.length}</p>
                </div>
                <div className="rounded-xl border border-ks-line p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Best Subject</p>
                  <p className="mt-1 text-sm font-black text-ks-navy">
                    {subjectResults.length ? [...subjectResults].sort((a, b) => (b.score || 0) - (a.score || 0))[0]?.subjectName?.slice(0, 12) || '—' : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subject results table */}
      {isLoading ? <ChartSkeleton height="h-64" /> : <SubjectResultsTable subjects={subjectResults} />}

      {/* Score journey + Radar */}
      <div className="grid gap-gutter xl:grid-cols-2">
        {isLoading ? <ChartSkeleton /> : scoreJourney.length > 0 ? (
          <LineChart
            title="My Score Journey"
            subtitle="Average score across terms"
            values={scoreJourney.map((j: any) => j.averageScore || j.score || 0)}
            labels={scoreJourney.map((j: any) => j.termName || j.period || '')}
          />
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-ks-line bg-white p-8">
            <p className="text-sm text-ks-muted">Score journey data will appear after multiple terms.</p>
          </div>
        )}
        {isLoading ? <ChartSkeleton /> : radarAxes.length >= 3 ? (
          <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
            <h3 className="font-display text-lg font-black text-ks-navy">Subject Radar</h3>
            <p className="mt-0.5 text-xs font-semibold text-ks-muted">Relative performance across all subjects</p>
            <div className="mt-4 flex justify-center">
              <div className="w-full max-w-xs">
                <RadarChart axes={radarAxes} values={radarValues} size={240} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-2xl border border-ks-line bg-white p-8">
            <p className="text-sm text-ks-muted">Radar chart available with 3+ subjects.</p>
          </div>
        )}
      </div>

      {/* Attendance heatmap */}
      {isLoading ? <ChartSkeleton height="h-40" /> : attendanceCalendar.length > 0 && (
        <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
          <h3 className="font-display text-lg font-black text-ks-navy">Attendance Calendar</h3>
          <p className="mt-0.5 mb-4 text-xs font-semibold text-ks-muted">Recent 20 school days</p>
          <AttendanceHeatmap records={attendanceCalendar} />
        </div>
      )}

      {/* Active alerts */}
      {isLoading ? <ChartSkeleton height="h-32" /> : activeAlerts.length > 0 && (
        <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
          <div className="border-b border-ks-line p-4">
            <h3 className="font-display text-lg font-black text-ks-navy">Active Alerts</h3>
          </div>
          <div className="divide-y divide-ks-line">
            {activeAlerts.map((a: any, i) => (
              <div key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-black text-ks-navy">{(a.type || a.alertType || '').replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ks-muted">{a.subjectName || a.description || '—'}</p>
                </div>
                <Badge tone={a.severity === 'HIGH' ? 'rose' : 'amber'}>{a.severity || 'MEDIUM'}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
