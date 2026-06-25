import React, { useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
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

      <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

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
                  <td className="px-4 py-3"><Badge tone="emerald">{s.grade || 'A'}</Badge></td>
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
