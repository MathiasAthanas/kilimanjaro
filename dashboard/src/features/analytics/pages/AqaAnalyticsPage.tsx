import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { AqaWorkspaceShell } from '../../aqa/components/AqaWorkspaceShell';
import {
  useAcademicOverview,
  useAtRiskStudents,
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
      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

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
