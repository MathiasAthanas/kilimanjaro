import { useState } from 'react';
import { BarChart3, Bell, Users } from 'lucide-react';
import { Badge } from '../../../components/common/Badge';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { useParentChildDashboard } from '../api/analytics.hooks';
import { ProgressRing, AttendanceHeatmap, BarChart, StatCard, ChartSkeleton, StatSkeleton } from '../components/Charts';

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

function ChildSwitcher({ children, selected, onSelect }: { children: any[]; selected: string; onSelect(id: string): void }) {
  if (!children.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {children.map((c: any) => (
        <button
          key={c.id || c.studentId}
          onClick={() => onSelect(c.id || c.studentId)}
          className={`rounded-full border px-4 py-2 text-sm font-black transition-all ${
            selected === (c.id || c.studentId)
              ? 'border-ks-navy bg-ks-navy text-white'
              : 'border-ks-line bg-white text-ks-navy hover:border-ks-navy/40'
          }`}
        >
          {c.name || c.studentName}
          {c.className && <span className="ml-1.5 font-normal opacity-60">· {c.className}</span>}
        </button>
      ))}
    </div>
  );
}

function SubjectReportTable({ subjects }: { subjects: any[] }) {
  if (!subjects.length) return (
    <div className="rounded-2xl border border-ks-line bg-white p-8 text-center text-sm text-ks-muted">
      No subject results available. Results appear once marks are published.
    </div>
  );
  return (
    <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="border-b border-ks-line p-4">
        <h3 className="font-display text-lg font-black text-ks-navy">Subject Performance Report</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-ks-paper">
          <tr>
            {['Subject', 'Score', 'Grade', 'Pass/Fail', 'Teacher'].map((h) => (
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

function FeeStatus({ invoices }: { invoices: any[] }) {
  if (!invoices.length) return null;
  const total = invoices.reduce((s, inv) => s + Number(inv.totalAmount || 0), 0);
  const paid = invoices.reduce((s, inv) => s + Number(inv.paidAmount || 0), 0);
  const outstanding = total - paid;
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <h3 className="font-display text-lg font-black text-ks-navy">Fee Status</h3>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-ks-line p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Total Fees</p>
          <p className="mt-1 font-mono text-sm font-black text-ks-navy">TZS {total.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Paid</p>
          <p className="mt-1 font-mono text-sm font-black text-emerald-700">TZS {paid.toLocaleString()}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${outstanding > 0 ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Outstanding</p>
          <p className={`mt-1 font-mono text-sm font-black ${outstanding > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
            TZS {outstanding.toLocaleString()}
          </p>
        </div>
      </div>
      {outstanding > 0 && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-xs font-bold text-rose-700">
            Outstanding balance of TZS {outstanding.toLocaleString()} is due. Please visit the school finance office to clear the balance.
          </p>
        </div>
      )}
    </div>
  );
}

export function ParentAnalyticsPage() {
  const session = useAuthStore((s) => s.session);
  const [yearId, setYearId] = useState('');
  const [termId, setTermId] = useState('');

  // Get linked children from session metadata
  const linkedChildren: any[] = (session?.user as any)?.guardianStudents || (session?.user as any)?.children || [];
  const [selectedChildId, setSelectedChildId] = useState<string>(linkedChildren[0]?.id || linkedChildren[0]?.studentId || '');

  const params = { academicYearId: yearId, termId };
  const { data: dashboard, isLoading } = useParentChildDashboard(selectedChildId, params);
  const d = dashboard as any;

  const student = d?.student || {};
  const summary = d?.summary || {};
  const subjectResults: any[] = d?.subjectResults || [];
  const attendance = d?.attendance || {};
  const attendanceCalendar: any[] = attendance?.calendar || d?.attendanceCalendar || [];
  const invoices: any[] = d?.invoices || [];
  const activeAlerts: any[] = d?.activeAlerts || [];
  const recentNotifications: any[] = d?.recentNotifications || [];

  return (
    <div className="space-y-gutter">
      {/* Header */}
      <section className="relative overflow-hidden rounded-xl border border-ks-navy/15 bg-[linear-gradient(135deg,#061f33,#0c4a6e_55%,#00334f)] p-8 text-white shadow-layer">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ks-blue/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-ks-gold">Parent Portal</p>
            <h1 className="mt-2 font-display text-[44px] font-bold leading-[52px] tracking-[-0.02em]">Child Progress</h1>
            <p className="mt-1.5 text-sm font-semibold text-white/70">
              {student.name || student.fullName
                ? `Viewing ${student.name || student.fullName}`
                : 'Select a child to view their progress'}
            </p>
          </div>
          {(student.className || d?.termName) && (
            <div className="flex flex-wrap items-center gap-3">
              {student.className && <Badge tone="blue">{student.className}</Badge>}
              {d?.termName && <Badge tone="gold">{d.termName}</Badge>}
            </div>
          )}
        </div>
      </section>

      {/* Child switcher */}
      {linkedChildren.length > 1 && (
        <div className="rounded-2xl border border-ks-line bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-black uppercase tracking-widest text-ks-muted">Select Child</p>
          <ChildSwitcher children={linkedChildren} selected={selectedChildId} onSelect={setSelectedChildId} />
        </div>
      )}

      {!selectedChildId ? (
        <div className="rounded-2xl border border-ks-line bg-white p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-ks-muted" />
          <p className="font-bold text-ks-navy">No child linked to your account</p>
          <p className="mt-1 text-sm text-ks-muted">Please contact the school administration to link your child(ren) to your account.</p>
        </div>
      ) : (
        <>
          <YearTermBar yearId={yearId} termId={termId} onYear={setYearId} onTerm={setTermId} />

          {/* Summary stats */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">{Array(3).fill(0).map((_, i) => <StatSkeleton key={i} />)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                label="Average Score"
                value={`${(summary.averageScore ?? 0).toFixed(1)}%`}
                detail="Published results this term"
                tone={summary.averageScore >= 70 ? 'green' : 'amber'}
              />
              <StatCard
                label="Pass Rate"
                value={`${(summary.passRate ?? 0).toFixed(1)}%`}
                detail={`${subjectResults.filter((s) => s.passed).length} of ${subjectResults.length} subjects passed`}
                tone={summary.passRate >= 70 ? 'green' : 'amber'}
              />
              <StatCard
                label="Attendance Rate"
                value={`${(summary.attendanceRate ?? attendance?.rate ?? 0).toFixed(1)}%`}
                detail="School days present"
                tone={summary.attendanceRate >= 85 || attendance?.rate >= 85 ? 'green' : 'amber'}
              />
            </div>
          )}

          {/* Progress rings */}
          {isLoading ? <ChartSkeleton height="h-44" /> : (
            <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
              <h3 className="font-display text-lg font-black text-ks-navy">Performance Overview</h3>
              <div className="mt-4 flex flex-wrap items-center justify-around gap-6">
                <ProgressRing value={summary.averageScore ?? 0} max={100} label="Avg Score" size={120} color={summary.averageScore >= 70 ? '#10b981' : '#f59e0b'} />
                <ProgressRing value={summary.passRate ?? 0} max={100} label="Pass Rate" size={120} color="#6C63FF" />
                <ProgressRing value={summary.attendanceRate ?? attendance?.rate ?? 0} max={100} label="Attendance" size={120} color={(summary.attendanceRate ?? attendance?.rate ?? 0) >= 85 ? '#10b981' : '#f59e0b'} />
              </div>
            </div>
          )}

          {/* Subject report table */}
          {isLoading ? <ChartSkeleton height="h-64" /> : <SubjectReportTable subjects={subjectResults} />}

          {/* Subject scores bar */}
          {isLoading ? <ChartSkeleton /> : subjectResults.length > 0 && (
            <BarChart
              title="Subject Scores"
              subtitle="Score per subject this term"
              values={subjectResults.map((s: any) => ({ label: s.subjectName, value: Math.round(s.score || 0) }))}
            />
          )}

          {/* Attendance calendar */}
          {isLoading ? <ChartSkeleton height="h-40" /> : attendanceCalendar.length > 0 && (
            <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
              <h3 className="font-display text-lg font-black text-ks-navy">Attendance Calendar</h3>
              <p className="mt-0.5 mb-4 text-xs font-semibold text-ks-muted">Recent 20 school days</p>
              <AttendanceHeatmap records={attendanceCalendar} />
            </div>
          )}

          {/* Fee status */}
          {!isLoading && <FeeStatus invoices={invoices} />}

          {/* Alerts */}
          {!isLoading && activeAlerts.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm">
              <h3 className="mb-3 font-display text-lg font-black text-rose-800">Academic Alerts</h3>
              <div className="space-y-2">
                {activeAlerts.map((a: any, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-rose-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-black text-ks-navy">{(a.type || a.alertType || '').replace(/_/g, ' ')}</p>
                      <p className="text-xs text-ks-muted">{a.subjectName || a.description || '—'}</p>
                    </div>
                    <Badge tone="rose">{a.severity || 'MEDIUM'}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent notifications */}
          {!isLoading && recentNotifications.length > 0 && (
            <div className="rounded-2xl border border-ks-line bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-ks-line p-4">
                <Bell className="h-4 w-4 text-ks-muted" />
                <h3 className="font-display text-lg font-black text-ks-navy">Recent Notifications</h3>
              </div>
              <div className="divide-y divide-ks-line">
                {recentNotifications.slice(0, 8).map((n: any, i) => (
                  <div key={i} className="px-4 py-3">
                    <p className="text-sm font-bold text-ks-navy">{n.title || n.subject || '—'}</p>
                    <p className="mt-0.5 text-xs text-ks-muted">{n.body || n.message || '—'}</p>
                    {n.createdAt && (
                      <p className="mt-1 text-[10px] font-bold text-ks-muted">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
