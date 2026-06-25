import { ArrowRight, CheckCircle2, ClipboardCheck, Download, Edit2, Filter, MessageSquarePlus, Plus, Save, Search, Send, ShieldCheck, UserPlus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import React, { useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { assessments, alerts, marksRows, pairings, students, teacherClasses, timetable } from '../api/teacherApi';
import {
  useTeacherClasses,
  useTeacherAssessments,
  useTeacherTimetable,
  usePerformanceAlerts,
  usePerfPairings,
  useClassStudents,
  useMarksSheet,
  useMarksReview,
  useAttendanceList,
  useStudentPerformance,
  useClassAnalytics,
  useTeacherAnnouncements,
  useSubmitAssessmentMutation,
  useSubmitMarksBulkMutation,
  useMarkAttendanceMutation,
  useCreateAnnouncementMutation,
  useCreateInterventionMutation,
  useResolveAlertMutation,
  useUpdateSyllabusMutation,
  useCreatePairingMutation,
  useTeacherSyllabus,
} from '../api/teacher.hooks';
import { downloadReportWhenReady, useGenerateReportMutation } from '../../operations/api/operations.hooks';
import {
  AlertStaffCard,
  AlertTypeBadge,
  AssessmentStatusBadge,
  AttendanceGrid,
  ClassSubjectCard,
  MarksGrid,
  PairingCard,
  ProgressBar,
  TeacherMetricStrip,
  TeacherTable,
  TeacherWorkspaceShell,
  TimetableBoard,
} from '../components/TeacherWorkspaceShell';
import { canSubmitMarks } from '../utils/marks';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { SkeletonCards } from '../../../components/common/SkeletonCards';


export function TeacherHomePage() {
  const { data: apiClasses = [] } = useTeacherClasses();
  const { data: apiAssessments = [] } = useTeacherAssessments();
  const { data: apiTimetable = [] } = useTeacherTimetable();

  const gradedClasses = apiClasses.filter((c) => c.syllabus > 0);
  const avgSyllabus = gradedClasses.length
    ? Math.round(gradedClasses.reduce((s, c) => s + c.syllabus, 0) / gradedClasses.length)
    : 0;
  const liveEntry = apiTimetable.find((e) => e.current);
  const pendingAssessments = apiAssessments.filter((a) => ['DRAFT', 'OPEN', 'IN_PROGRESS', 'REJECTED'].includes(a.status));
  const openMarks = pendingAssessments.length;
  const submittedCount = apiAssessments.filter((a) => a.status === 'SUBMITTED').length;

  return (
    <TeacherWorkspaceShell title="Teacher Dashboard" eyebrow="Teacher operations desk" action={<NavLink to="/teacher/attendance"><Button className="bg-ks-gold text-ks-slate hover:shadow-md hover:shadow-ks-gold/30">Mark Attendance</Button></NavLink>}>
      <TeacherMetricStrip
        items={[
          { label: 'Assigned classes', value: String(apiClasses.length), detail: 'Active this term', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
          { label: 'Open marks', value: String(openMarks), detail: openMarks > 0 ? 'Awaiting entry' : `${submittedCount} submitted`, tone: 'bg-ks-amber', valueColor: openMarks > 0 ? 'text-ks-amber' : 'text-ks-emerald' },
          { label: 'Timetable slots', value: String(apiTimetable.length), detail: 'This week', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
          { label: 'Syllabus coverage', value: gradedClasses.length ? `${avgSyllabus}%` : '—', detail: 'Average across classes', inverted: true, icon: ShieldCheck },
        ]}
      />
      <div className="grid gap-gutter xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Today timeline</p>
              <h2 className="font-display text-2xl font-black text-ks-slate">Priority teaching flow</h2>
            </div>
            <Badge tone="gold">Live schedule</Badge>
          </div>
          {apiTimetable.length === 0 ? (
            <p className="mt-5 text-sm font-semibold text-ks-muted">No timetable slots loaded yet.</p>
          ) : (
            <div className="mt-5 space-y-2.5">
              {apiTimetable.slice(0, 4).map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between rounded-xl border p-3.5 transition ${
                    entry.current ? 'border-ks-gold bg-ks-gold/10 shadow-sm' : 'border-ks-line bg-ks-paper/70 hover:border-ks-blue/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg px-3 py-2 text-sm font-black ${entry.current ? 'bg-ks-gold text-ks-slate' : 'bg-ks-navy text-white'}`}>
                      {entry.time}
                    </div>
                    <div>
                      <p className="font-black text-ks-slate">{entry.subject} · {entry.className}</p>
                      <p className="text-xs font-semibold text-ks-muted">{entry.room}</p>
                    </div>
                    {entry.current && <span className="rounded-full bg-ks-gold/20 px-2 py-0.5 text-[10px] font-black text-ks-gold">LIVE</span>}
                  </div>
                  <NavLink to="/teacher/attendance" className="text-sm font-black text-ks-blue hover:underline">Open →</NavLink>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-gutter">
          {liveEntry && (
            <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-rose p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-rose">Live class</p>
              <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">{liveEntry.className} · {liveEntry.subject}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">Currently in session · {liveEntry.room}</p>
              <NavLink to="/teacher/attendance"><Button className="mt-4 w-full">Mark attendance</Button></NavLink>
            </Card>
          )}
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Open marks queue</p>
            {pendingAssessments.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-ks-emerald">All marks are up to date.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {pendingAssessments.map((item) => (
                  <NavLink key={item.id} to={`/teacher/assessments/${item.id}/marks`} className="block rounded-xl border border-ks-line p-3 transition hover:border-ks-blue/30 hover:bg-ks-paper">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-ks-slate">{item.title}</p>
                      <AssessmentStatusBadge status={item.status} />
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-ks-muted">{item.subject} · {item.className}</p>
                  </NavLink>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      {apiClasses.length > 0 && (
        <div className="grid gap-gutter xl:grid-cols-3">
          {apiClasses.map((item) => <ClassSubjectCard key={item.id} item={item} />)}
        </div>
      )}
    </TeacherWorkspaceShell>
  );
}

export function TeacherClassesPage() {
  const { data: apiClasses = [] as typeof teacherClasses, isLoading, isError, refetch } = useTeacherClasses() as { data: typeof teacherClasses; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <TeacherWorkspaceShell title="My Classes" eyebrow="Assigned class-subjects">
      <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
        <Filter className="h-4 w-4 text-ks-muted" />
        <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Filter:</span>
        {['All subjects', 'All forms', 'Operational status', 'Syllabus risk'].map((item) => (
          <button key={item} className="rounded-full border border-ks-line bg-ks-paper px-3 py-1 text-xs font-bold text-ks-muted transition hover:border-ks-blue hover:text-ks-blue">{item}</button>
        ))}
      </Card>
      {isLoading ? (
        <SkeletonCards count={3} cols="xl:grid-cols-3" />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !apiClasses.length ? (
        <EmptyState title="No classes assigned" description="Class-subject assignments will appear here once configured by the administrator." />
      ) : (
        <div className="grid gap-gutter xl:grid-cols-3">
          {apiClasses.map((item: typeof teacherClasses[number]) => <ClassSubjectCard key={item.id} item={item} />)}
        </div>
      )}
      <ClassSubjectsTable />
    </TeacherWorkspaceShell>
  );
}

export function ClassWorkspacePage() {
  const { loading, klass } = useClassSubject();
  const { data: apiAlerts = [] as typeof alerts } = usePerformanceAlerts() as unknown as { data: typeof alerts };
  const { data: apiAssessments = [] } = useTeacherAssessments();
  const firstAss = apiAssessments[0];

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Class command workspace"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (!klass) return (
    <TeacherWorkspaceShell title="Class Not Found" eyebrow="Class command workspace">
      <EmptyState title="Class not found" description="This class assignment no longer exists or you are not assigned to it." />
    </TeacherWorkspaceShell>
  );

  return (
    <TeacherWorkspaceShell title={`${klass.subject} · ${klass.className}`} eyebrow="Class command workspace">
      <WorkspaceTabs id={klass.id} />
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="space-y-gutter">
          <TeacherMetricStrip items={[
            { label: 'Syllabus', value: `${klass.syllabus}%`, detail: `${100 - klass.syllabus}% remaining`, tone: 'bg-ks-gold', valueColor: klass.syllabus >= 70 ? 'text-ks-emerald' : 'text-ks-amber' },
            { label: 'Assessments', value: String(klass.assessmentCount), detail: 'This term', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
            { label: 'Open marks', value: String(klass.openAssessments), detail: 'Need completion', tone: 'bg-ks-amber', valueColor: klass.openAssessments > 0 ? 'text-ks-amber' : 'text-ks-emerald' },
            { label: 'Risk level', value: klass.risk, detail: 'Based on syllabus pace', inverted: true, icon: ShieldCheck },
          ]} />
          <Card className="rounded-xl p-5">
            <SectionTitle title="Students needing attention" action="/teacher/performance/alerts" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {apiAlerts.slice(0, 2).map((alert) => <AlertStaffCard key={alert.id} alert={alert} />)}
              {apiAlerts.length === 0 && <p className="text-sm font-semibold text-ks-emerald col-span-2">No active alerts for this class.</p>}
            </div>
          </Card>
          <AssessmentMiniTable />
        </div>
        <Card className="sticky top-24 h-fit overflow-hidden rounded-xl border-l-4 border-l-ks-gold p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Next action</p>
          {firstAss ? (
            <>
              <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">{firstAss.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">{firstAss.total - firstAss.entered} rows remaining · due {firstAss.due}</p>
              <div className="mt-4 space-y-2.5 [&_a]:block">
                <NavLink to={`/teacher/assessments/${firstAss.id}/marks`}><Button className="w-full">Enter marks</Button></NavLink>
                <NavLink to={`/teacher/classes/${klass.id}/analytics`}><Button variant="secondary" className="w-full">View analytics</Button></NavLink>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">All marks complete</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">No open assessments for this class.</p>
              <NavLink to={`/teacher/classes/${klass.id}/analytics`} className="block mt-4"><Button variant="secondary" className="w-full">View analytics</Button></NavLink>
            </>
          )}
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function ClassStudentsPage() {
  const { loading, klass } = useClassSubject();
  const [searchQuery, setSearchQuery] = useState('');
  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Student directory"><SkeletonTable cols={8} /></TeacherWorkspaceShell>;
  if (!klass) return (
    <TeacherWorkspaceShell title="Class Not Found" eyebrow="Student directory">
      <EmptyState title="Class not found" description="This class assignment no longer exists or you are not assigned to it." />
    </TeacherWorkspaceShell>
  );
  return (
    <TeacherWorkspaceShell title={`${klass.className} Student Directory`} eyebrow={klass.subject}>
      <SearchPanel query={searchQuery} onChange={setSearchQuery} />
      <StudentsTable classId={klass.id} query={searchQuery} />
    </TeacherWorkspaceShell>
  );
}

export function ClassAnalyticsPage() {
  const { loading, klass } = useClassSubject();
  const { data: analytics } = useClassAnalytics(klass?.id ?? '');
  const an = analytics as Record<string, unknown> | undefined;

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Class analytics"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (!klass) return (
    <TeacherWorkspaceShell title="Class Not Found" eyebrow="Class analytics">
      <EmptyState title="Class not found" description="This class assignment no longer exists or you are not assigned to it." />
    </TeacherWorkspaceShell>
  );

  const median = an?.median ?? an?.medianScore ?? klass.average;
  const topImprovers = an?.topImprovers ?? an?.improvedCount ?? '—';
  const atRisk = an?.atRisk ?? an?.atRiskCount ?? '—';

  return (
    <TeacherWorkspaceShell title={`${klass.className} Analytics`} eyebrow={klass.subject}>
      <TeacherMetricStrip items={[
        { label: 'Class average', value: `${klass.average}%`, detail: 'Current term', tone: 'bg-ks-blue', valueColor: klass.average >= 75 ? 'text-ks-emerald' : 'text-ks-amber' },
        { label: 'Median score', value: `${median}%`, detail: 'Assessment median', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'At risk', value: String(atRisk), detail: 'Need intervention', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Top improvers', value: String(topImprovers), detail: 'Gained 10+ pts', inverted: true, icon: ShieldCheck },
      ]} />
      <AnalyticsGrid classId={klass.id} analytics={an} />
    </TeacherWorkspaceShell>
  );
}

export function AssessmentListPage() {
  return (
    <TeacherWorkspaceShell title="Assessment Management" eyebrow="Marks operations">
      <AssessmentMiniTable detailed />
    </TeacherWorkspaceShell>
  );
}

export function MarksEntryPage() {
  const { loading, assessment } = useAssessment();
  const { data: apiMarks = [] as typeof marksRows } = useMarksSheet(assessment?.id ?? '') as { data: typeof marksRows };
  const bulkSaveMutation = useSubmitMarksBulkMutation();

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Desktop marks entry"><SkeletonTable cols={6} /></TeacherWorkspaceShell>;
  if (!assessment) return (
    <TeacherWorkspaceShell title="Assessment Not Found" eyebrow="Desktop marks entry">
      <EmptyState title="Assessment not found" description="This assessment may not exist or has already been archived." />
    </TeacherWorkspaceShell>
  );

  const completion = assessment.total > 0 ? Math.round((assessment.entered / assessment.total) * 100) : 0;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (completion / 100) * circumference;
  const readinessItems = [
    { label: 'No over-max scores', ok: apiMarks.every((r) => Number(r.score) <= assessment.maxScore || r.absent) },
    { label: 'Absent rows excluded', ok: true },
    { label: `${assessment.total - assessment.entered} rows still missing`, ok: assessment.entered >= assessment.total },
    { label: 'Save before submitting', ok: apiMarks.every((r) => r.state === 'saved') },
  ];

  const handleBulkSave = () => {
    const payload = apiMarks.map((r) => ({ studentId: r.id, score: r.absent ? null : r.score, absent: r.absent, note: r.note }));
    bulkSaveMutation.mutate({ id: assessment.id, marks: payload }, {
      onSuccess: () => toast('Marks saved', 'success'),
      onError: () => toast('Failed to save marks. Please try again.', 'error'),
    });
  };

  return (
    <TeacherWorkspaceShell title={assessment.title} eyebrow="Desktop marks entry" action={<Badge tone="gold">Enter · Tab · Ctrl+S</Badge>}>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden rounded-xl">
          <div className="sticky top-0 z-10 border-b border-ks-line bg-white/95 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-ks-muted">{assessment.className} · Max {assessment.maxScore} pts</p>
                <h2 className="font-display text-2xl font-black text-ks-slate">Spreadsheet score grid</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleBulkSave} disabled={bulkSaveMutation.isPending}>
                  <Save className="h-4 w-4" /> {bulkSaveMutation.isPending ? 'Saving…' : 'Bulk save'}
                </Button>
                <NavLink to={`/teacher/assessments/${assessment.id}/submit`}><Button>Review & submit</Button></NavLink>
              </div>
            </div>
            <ProgressBar value={completion} tone="bg-ks-blue" className="mt-3" />
          </div>
          <MarksGrid rows={apiMarks} maxScore={assessment.maxScore} />
        </Card>
        <div className="sticky top-24 space-y-gutter">
          <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-blue p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Live readiness</p>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative">
                <svg width="140" height="140" className="-rotate-90">
                  <circle cx="70" cy="70" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
                  <circle
                    cx="70" cy="70" r={radius}
                    fill="none" stroke="#0284C7" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-display text-3xl font-black text-ks-slate">{completion}%</p>
                  <p className="text-[11px] font-bold text-ks-muted">Complete</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-lg bg-ks-paper p-3">
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${item.ok ? 'text-ks-emerald' : 'text-ks-amber'}`} />
                  <span className="text-sm font-semibold text-ks-slate">{item.label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function AssessmentSubmitPage() {
  const { loading, assessment } = useAssessment();
  const navigate = useNavigate();
  const { data: apiMarks = [] as typeof marksRows } = useMarksSheet(assessment?.id ?? '') as { data: typeof marksRows };
  const [confirmed, setConfirmed] = useState(false);
  const submitMutation = useSubmitAssessmentMutation();

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Assessment submit"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (!assessment) return (
    <TeacherWorkspaceShell title="Assessment Not Found" eyebrow="Assessment submit">
      <EmptyState title="Assessment not found" description="This assessment may not exist or has already been archived." />
    </TeacherWorkspaceShell>
  );

  const ready = canSubmitMarks(apiMarks.map((row) => ({ ...row, state: row.state === 'dirty' ? 'saved' : row.state })), assessment.maxScore);

  const handleSubmit = () => {
    submitMutation.mutate(assessment.id, {
      onSuccess: () => { toast('Assessment submitted to HOD for review', 'success'); navigate('/teacher/assessments'); },
      onError: () => toast('Failed to submit. Please try again.', 'error'),
    });
  };
  const checklist = [
    { label: 'All students accounted for', done: true },
    { label: 'Outliers reviewed', done: true },
    { label: 'Absent students confirmed', done: true },
    { label: 'Teacher declaration required', done: confirmed },
  ];
  return (
    <TeacherWorkspaceShell title="Submit Assessment Review" eyebrow={assessment.title}>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-xl p-5">
          <SectionTitle title="Completion checklist" />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {checklist.map((item) => (
              <div key={item.label} className={`flex items-center gap-3 rounded-xl border p-4 transition ${item.done ? 'border-ks-emerald/30 bg-ks-emerald/5' : 'border-ks-line bg-ks-paper'}`}>
                <CheckCircle2 className={`h-5 w-5 shrink-0 ${item.done ? 'text-ks-emerald' : 'text-ks-muted/40'}`} />
                <span className="text-sm font-bold text-ks-slate">{item.label}</span>
              </div>
            ))}
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-ks-blue/20 bg-ks-blue/5 p-4">
            <input
              className="h-4 w-4 rounded border-ks-line text-ks-blue focus:ring-ks-blue"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span className="text-sm font-bold text-ks-slate">I confirm these marks are accurate and ready for HOD review.</span>
          </label>
        </Card>
        <Card className="sticky top-24 h-fit overflow-hidden rounded-xl border-l-4 border-l-ks-emerald p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Submit guard</p>
          <h3 className={`mt-2 font-display text-2xl font-black ${ready && confirmed ? 'text-ks-emerald' : 'text-ks-slate'}`}>
            {ready && confirmed ? 'Ready to submit' : confirmed ? 'Resolve issues first' : 'Declaration required'}
          </h3>
          <p className="mt-2 text-sm font-semibold text-ks-muted">
            {ready ? 'All marks validated. Submit to HOD for review and approval.' : 'Ensure all marks are valid before submitting.'}
          </p>
          <Button disabled={!confirmed || !ready || submitMutation.isPending} className="mt-5 w-full" onClick={handleSubmit}>
            <Send className="h-4 w-4" /> {submitMutation.isPending ? 'Submitting…' : 'Submit to HOD'}
          </Button>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function MarksReviewPage() {
  const { loading, assessment } = useAssessment();
  const { data: apiMarks = [] as typeof marksRows } = useMarksSheet(assessment?.id ?? '') as { data: typeof marksRows };

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Marks review"><SkeletonTable cols={6} /></TeacherWorkspaceShell>;
  if (!assessment) return (
    <TeacherWorkspaceShell title="Assessment Not Found" eyebrow="Marks review">
      <EmptyState title="Assessment not found" description="This assessment may not exist or has already been archived." />
    </TeacherWorkspaceShell>
  );
  return (
    <TeacherWorkspaceShell title="Marks Review" eyebrow={assessment.title}>
      <Card className="rounded-xl p-5">
        <SectionTitle title="Approval timeline" />
        <div className="relative mt-5 grid gap-3 md:grid-cols-3">
          <div className="absolute left-0 right-0 top-5 hidden h-0.5 bg-ks-line md:block" />
          {['Submitted by teacher', 'Pending HOD review', 'Publish after approval'].map((item, index) => (
            <TimelineStep key={item} label={item} active={index < 2} step={index + 1} />
          ))}
        </div>
      </Card>
      <MarksGrid rows={apiMarks.map((row) => ({ ...row, state: 'saved' }))} maxScore={assessment.maxScore} />
    </TeacherWorkspaceShell>
  );
}

export function AttendancePage() {
  const { data: apiClasses = [] as typeof teacherClasses } = useTeacherClasses() as { data: typeof teacherClasses };
  const [selectedClassId, setSelectedClassId] = useState('');
  const activeClassId = selectedClassId || apiClasses[0]?.id || '';
  const { data: apiStudents = [] as typeof students } = useClassStudents(activeClassId) as { data: typeof students };
  const attendanceMutation = useMarkAttendanceMutation();
  const [submitted, setSubmitted] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const currentClass = apiClasses.find((c) => c.id === activeClassId) ?? apiClasses[0];

  const handleStatusChange = (studentId: string, status: string) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  };

  const statusValues = Object.values(statuses);
  const presentCount = statusValues.filter((s) => s === 'PRESENT').length;
  const absentCount  = statusValues.filter((s) => s === 'ABSENT').length;
  const lateCount    = statusValues.filter((s) => s === 'LATE').length;
  const markedCount  = statusValues.filter(Boolean).length;
  const unmarkedCount = apiStudents.length - markedCount;
  const totalCount = apiStudents.length;

  const handleSubmit = () => {
    attendanceMutation.mutate({
      classId: currentClass?.id ?? '',
      date: new Date().toISOString().split('T')[0],
      records: apiStudents.map((s) => ({ studentId: s.id, status: statuses[s.id] || 'ABSENT' })),
    }, {
      onSuccess: () => { setSubmitted(true); toast('Attendance submitted successfully', 'success'); },
      onError: () => toast('Failed to submit attendance. Please try again.', 'error'),
    });
  };

  return (
    <TeacherWorkspaceShell title="Attendance Marking" eyebrow="Today sessions">
      {/* Class selector */}
      {apiClasses.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ks-line bg-ks-paper p-3">
          <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Select class:</span>
          {apiClasses.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedClassId(c.id); setStatuses({}); setSubmitted(false); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-black transition ${
                c.id === activeClassId ? 'bg-ks-navy text-white shadow-sm' : 'border border-ks-line bg-white text-ks-muted hover:border-ks-blue hover:text-ks-blue'
              }`}
            >
              {c.className} · {c.subject}
            </button>
          ))}
        </div>
      )}
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <AttendanceGrid students={apiStudents} statuses={statuses} onStatusChange={handleStatusChange} />
        <div className="sticky top-24 space-y-gutter">
          <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-emerald p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Session summary</p>
            <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">
              {currentClass ? `${currentClass.className} · ${currentClass.subject}` : '—'}
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AttendanceStat label="Present"  value={String(presentCount)}  color="text-ks-emerald" bg="bg-ks-emerald/10" />
              <AttendanceStat label="Absent"   value={String(absentCount)}   color="text-ks-rose"    bg="bg-ks-rose/10" />
              <AttendanceStat label="Late"     value={String(lateCount)}     color="text-ks-amber"   bg="bg-ks-amber/10" />
              <AttendanceStat label="Unmarked" value={String(unmarkedCount)} color="text-ks-muted"   bg="bg-ks-paper" />
            </div>
            {totalCount > 0 && (
              <div className="mt-4">
                <ProgressBar value={(presentCount / totalCount) * 100} tone="bg-ks-emerald" />
                <p className="mt-1 text-center text-xs font-bold text-ks-muted">
                  {Math.round((presentCount / totalCount) * 100)}% present rate
                </p>
              </div>
            )}
            {submitted ? (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-ks-emerald/10 p-3 text-sm font-bold text-ks-emerald">
                <CheckCircle2 className="h-4 w-4" /> Attendance submitted
              </div>
            ) : (
              <Button className="mt-4 w-full" onClick={handleSubmit} disabled={attendanceMutation.isPending}>
                {attendanceMutation.isPending ? 'Submitting…' : 'Submit attendance'}
              </Button>
            )}
          </Card>
        </div>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function AttendanceHistoryPage() {
  const { data: apiRecords = [], isLoading, isError, refetch } = useAttendanceList() as { data: Array<{ id: string; student: string; className: string; subject: string; date: string; status: string }>; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <TeacherWorkspaceShell title="Attendance History" eyebrow="Submitted records">
      {isLoading ? (
        <SkeletonTable cols={5} />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : apiRecords.length === 0 ? (
        <EmptyState title="No attendance records" description="Submitted attendance records will appear here." />
      ) : (
        <TeacherTable columns={['Date', 'Class', 'Subject', 'Student', 'Status']}>
          {apiRecords.map((record) => (
            <tr key={record.id} className="hover:bg-ks-paper">
              <Td>{record.date ? new Date(record.date).toLocaleDateString() : '—'}</Td>
              <Td>{record.className}</Td>
              <Td>{record.subject}</Td>
              <Td><span className="font-bold text-ks-slate">{record.student}</span></Td>
              <Td>
                <Badge tone={record.status === 'PRESENT' ? 'emerald' : record.status === 'LATE' ? 'amber' : 'rose'}>
                  {record.status}
                </Badge>
              </Td>
            </tr>
          ))}
        </TeacherTable>
      )}
    </TeacherWorkspaceShell>
  );
}

export function PerformanceAlertsPage() {
  const navigate = useNavigate();
  const { data: apiClasses = [], isLoading: classesLoading } = useTeacherClasses();
  const classIds = classesLoading
    ? undefined
    : (apiClasses as { classId: string }[]).map((c) => c.classId).filter((id): id is string => Boolean(id));
  const { data: apiPairings = [] as typeof pairings } = usePerfPairings(classIds) as { data: typeof pairings };
  const { data: apiAlerts = [] as typeof alerts } = usePerformanceAlerts() as unknown as { data: typeof alerts };
  const criticalCount = apiAlerts.filter((a) => a.severity === 'CRITICAL').length;
  const atRiskCount = apiAlerts.filter((a) => a.severity === 'AT_RISK').length;
  const suggestedPairings = apiPairings.filter((p) => p.status === 'SUGGESTED').length;
  const noClasses = !classesLoading && classIds?.length === 0;
  return (
    <TeacherWorkspaceShell title="Performance Alerts" eyebrow="Actionable student risks">
      <TeacherMetricStrip items={[
        { label: 'Critical alerts', value: String(criticalCount).padStart(2, '0'), detail: 'Immediate action required', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'At risk', value: String(atRiskCount).padStart(2, '0'), detail: 'Sliding grade trends', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Peer pairings', value: String(suggestedPairings).padStart(2, '0'), detail: 'Pending activation', tone: 'bg-ks-sky', valueColor: 'text-ks-sky' },
        { label: 'Total alerts', value: String(apiAlerts.length), detail: 'This term', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid grid-cols-12 gap-gutter">
        <section className="col-span-12 space-y-stack-lg xl:col-span-8">
          <AlertsOperationalTable />
          <PredictionPanel />
        </section>
        <section className="col-span-12 space-y-stack-lg xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black text-ks-navy">Peer Pairings</h2>
            <span className="rounded-full bg-ks-sky px-2.5 py-1 text-[10px] font-black text-white">{suggestedPairings} PENDING</span>
          </div>
          {noClasses ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No classes assigned yet. Pairings will appear once you are assigned to a class.</p>
          ) : apiPairings.length === 0 ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No peer pairings for your classes yet.</p>
          ) : (
            apiPairings.map((pairing) => (
              <NavLink key={pairing.id} to={`/teacher/performance/pairings/${pairing.id}`} className="block">
                <PairingCard pairing={pairing} />
              </NavLink>
            ))
          )}
          <AcademicSpotlight />
        </section>
      </div>
      {/* FAB for manual pairing */}
      <button
        onClick={() => navigate('/teacher/performance/pairings/create')}
        className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ks-gold shadow-2xl shadow-ks-gold/30 transition-all hover:scale-110 hover:shadow-ks-gold/40 active:scale-95 group"
      >
        <UserPlus className="h-6 w-6 text-ks-slate" />
        <span className="absolute right-full mr-3 whitespace-nowrap rounded-lg bg-ks-navy px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
          Manual Pair
        </span>
      </button>
    </TeacherWorkspaceShell>
  );
}

export function AlertDetailPage() {
  const { id } = useParams();
  const { data: apiAlerts = [] as typeof alerts, isLoading } = usePerformanceAlerts() as unknown as { data: typeof alerts; isLoading: boolean };
  if (isLoading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Performance alert"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  const alert = apiAlerts.find((item) => item.id === id) ?? null;
  if (!alert) return (
    <TeacherWorkspaceShell title="Alert Not Found" eyebrow="Performance alert">
      <EmptyState title="Alert not found" description="This alert may have already been resolved or the link is invalid." />
    </TeacherWorkspaceShell>
  );
  return (
    <TeacherWorkspaceShell title={alert.student} eyebrow={alert.type}>
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <AlertStaffCard alert={alert} />
        <ActionPanel title="Recommended intervention" actions={['Resolve alert', 'Create intervention']} alertId={id} />
      </div>
      <AnalyticsGrid classId="" analytics={undefined} />
    </TeacherWorkspaceShell>
  );
}

export function PeerPairingsPage() {
  const { data: apiClasses = [], isLoading: classesLoading } = useTeacherClasses();
  const classIds = classesLoading
    ? undefined
    : (apiClasses as { classId: string }[]).map((c) => c.classId).filter((id): id is string => Boolean(id));
  const { data: apiPairings = [] as typeof pairings } = usePerfPairings(classIds) as { data: typeof pairings };
  const noClasses = !classesLoading && classIds?.length === 0;
  const suggested = apiPairings.filter((p) => p.status === 'SUGGESTED').length;
  const active = apiPairings.filter((p) => p.status === 'ACTIVE').length;
  const completed = apiPairings.filter((p) => p.status === 'COMPLETED').length;
  return (
    <TeacherWorkspaceShell title="Peer Pairings" eyebrow="Student support suggestions">
      <TeacherMetricStrip items={[
        { label: 'Suggested', value: String(suggested), detail: 'Awaiting action', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Active', value: String(active), detail: 'Current support', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Completed', value: String(completed), detail: 'This term', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'Total pairings', value: String(apiPairings.length), detail: 'All statuses', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="grid gap-gutter">
          {noClasses ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No classes assigned yet. Pairings will appear once you are assigned to a class.</p>
          ) : apiPairings.length === 0 ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No peer pairings for your classes yet.</p>
          ) : (
            apiPairings.map((pairing) => (
              <NavLink key={pairing.id} to={`/teacher/performance/pairings/${pairing.id}`}>
                <PairingCard pairing={pairing} />
              </NavLink>
            ))
          )}
        </div>
        <AcademicSpotlight />
      </div>
    </TeacherWorkspaceShell>
  );
}

export function PairingDetailPage() {
  const { id } = useParams();
  const { data: apiPairings = [] as typeof pairings, isLoading } = usePerfPairings() as { data: typeof pairings; isLoading: boolean };
  if (isLoading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Pairing detail"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  const pairing = apiPairings.find((item) => item.id === id) ?? null;
  if (!pairing) return (
    <TeacherWorkspaceShell title="Pairing Not Found" eyebrow="Pairing detail">
      <EmptyState title="Pairing not found" description="This pairing may no longer be active or the link is invalid." />
    </TeacherWorkspaceShell>
  );
  return (
    <TeacherWorkspaceShell title={`${pairing.mentor} + ${pairing.support}`} eyebrow="Pairing detail">
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <PairingCard pairing={pairing} />
        <ActionPanel title="Record outcome" actions={['Create intervention']} />
      </div>
    </TeacherWorkspaceShell>
  );
}

export function StudentPerformancePage() {
  const { studentId } = useParams();
  const { data: perf, isLoading, isError } = useStudentPerformance(studentId ?? '');
  const p = perf as Record<string, unknown> | undefined;

  if (isLoading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Student performance profile"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (isError || !p) return (
    <TeacherWorkspaceShell title="Student Not Found" eyebrow="Student performance profile">
      <EmptyState title="Student not found" description="This student record does not exist or is no longer accessible." />
    </TeacherWorkspaceShell>
  );

  const name = String(p.name ?? p.fullName ?? p.studentName ?? studentId ?? 'Student');
  const avg = Number(p.average ?? p.averageScore ?? 0);
  const attendance = Number(p.attendance ?? p.attendanceRate ?? 0);
  const lastScore = String(p.lastScore ?? p.lastAssessment ?? '—');
  const alertLabel = String(p.alert ?? p.riskLevel ?? '—');
  const interventions = Number(p.interventionCount ?? p.interventions ?? 0);
  const avgColor = avg >= 75 ? 'text-ks-emerald' : avg >= 60 ? 'text-ks-amber' : 'text-ks-rose';
  const avgTone = avg >= 75 ? 'bg-ks-emerald' : avg >= 60 ? 'bg-ks-amber' : 'bg-ks-rose';

  return (
    <TeacherWorkspaceShell title={name} eyebrow="Student performance profile">
      <TeacherMetricStrip items={[
        { label: 'Average', value: `${avg}%`, detail: alertLabel, tone: avgTone, valueColor: avgColor },
        { label: 'Attendance', value: `${attendance}%`, detail: 'Current term', tone: 'bg-ks-emerald', valueColor: attendance >= 85 ? 'text-ks-emerald' : 'text-ks-amber' },
        { label: 'Last score', value: lastScore, detail: 'Most recent assessment', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'Interventions', value: String(interventions), detail: interventions > 0 ? 'Review in progress' : 'None recorded', inverted: true, icon: ShieldCheck },
      ]} />
      <AnalyticsGrid classId="" analytics={p} />
    </TeacherWorkspaceShell>
  );
}

export function TimetablePage() {
  const { data: apiTimetable = [] as typeof timetable } = useTeacherTimetable() as { data: typeof timetable };
  return (
    <TeacherWorkspaceShell title="Weekly Timetable" eyebrow="Teaching periods">
      <TimetableBoard entries={apiTimetable} />
    </TeacherWorkspaceShell>
  );
}

export function SyllabusPage() {
  const { data: apiClasses = [] as typeof teacherClasses } = useTeacherClasses() as { data: typeof teacherClasses };
  const { data: syllabusItems = [] } = useTeacherSyllabus() as { data: Array<{ id: string; classSubjectId: string; totalTopics: number; coveredTopics: number; completion: number; notes: string }> };
  const updateMutation = useUpdateSyllabusMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ covered: string; total: string; notes: string }>({ covered: '', total: '', notes: '' });

  const openEdit = (klass: typeof apiClasses[number]) => {
    const syl = syllabusItems.find((s) => s.classSubjectId === klass.id);
    const covered = syl ? syl.coveredTopics : Math.round((klass.syllabus / 100) * 24);
    const total = syl ? syl.totalTopics : 24;
    setEditValues({ covered: String(covered), total: String(total), notes: syl?.notes ?? '' });
    setEditingId(klass.id);
  };

  const handleSave = (klass: typeof apiClasses[number]) => {
    const syl = syllabusItems.find((s) => s.classSubjectId === klass.id);
    const sylId = syl?.id ?? klass.id;
    const covered = Math.max(0, Number(editValues.covered) || 0);
    const total = Math.max(1, Number(editValues.total) || 24);
    if (covered > total) { toast('Covered topics cannot exceed total topics', 'warning'); return; }
    updateMutation.mutate({ id: sylId, coveredTopics: covered, notes: editValues.notes }, {
      onSuccess: () => { toast('Syllabus updated', 'success'); setEditingId(null); },
      onError: () => toast('Failed to update syllabus', 'error'),
    });
  };

  return (
    <TeacherWorkspaceShell title="Syllabus Tracker" eyebrow="Coverage editor">
      <TeacherTable columns={['Class', 'Subject', 'Covered', 'Total', 'Progress', 'Risk', 'Action']}>
        {apiClasses.map((klass) => {
          const syl = syllabusItems.find((s) => s.classSubjectId === klass.id);
          const covered = syl ? syl.coveredTopics : Math.round((klass.syllabus / 100) * 24);
          const total = syl ? syl.totalTopics : 24;
          const pct = total > 0 ? Math.round((covered / total) * 100) : klass.syllabus;
          const barTone = klass.risk === 'HIGH' ? 'bg-ks-rose' : klass.risk === 'MEDIUM' ? 'bg-ks-amber' : 'bg-ks-emerald';
          const isEditing = editingId === klass.id;
          return (
            <React.Fragment key={klass.id}>
              <tr className="hover:bg-ks-paper">
                <Td>{klass.className}</Td>
                <Td>{klass.subject}</Td>
                <Td><span className="font-black text-ks-slate">{covered}</span></Td>
                <Td>{total}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={pct} tone={barTone} className="w-24" />
                    <span className="text-xs font-bold text-ks-muted">{pct}%</span>
                  </div>
                </Td>
                <Td><Badge tone={klass.risk === 'HIGH' ? 'rose' : klass.risk === 'MEDIUM' ? 'amber' : 'emerald'}>{klass.risk}</Badge></Td>
                <Td>
                  {isEditing ? (
                    <button onClick={() => setEditingId(null)} className="p-1 text-ks-muted hover:text-ks-rose"><X className="h-4 w-4" /></button>
                  ) : (
                    <Button variant="secondary" className="py-1.5 text-xs" onClick={() => openEdit(klass)}>
                      <Edit2 className="h-3.5 w-3.5" /> Update
                    </Button>
                  )}
                </Td>
              </tr>
              {isEditing && (
                <tr className="bg-ks-paper/70">
                  <td colSpan={7} className="px-4 py-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Topics Covered</span>
                        <input
                          type="number" min={0} max={editValues.total}
                          value={editValues.covered}
                          onChange={(e) => setEditValues((v) => ({ ...v, covered: e.target.value }))}
                          className="mt-1 h-9 w-24 rounded-lg border border-ks-line px-2 font-black text-ks-slate outline-none focus:border-ks-blue"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Total Topics</span>
                        <input
                          type="number" min={1}
                          value={editValues.total}
                          onChange={(e) => setEditValues((v) => ({ ...v, total: e.target.value }))}
                          className="mt-1 h-9 w-24 rounded-lg border border-ks-line px-2 font-black text-ks-slate outline-none focus:border-ks-blue"
                        />
                      </label>
                      <label className="block flex-1 min-w-[160px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Notes</span>
                        <input
                          value={editValues.notes}
                          onChange={(e) => setEditValues((v) => ({ ...v, notes: e.target.value }))}
                          placeholder="Optional progress note…"
                          className="mt-1 h-9 w-full rounded-lg border border-ks-line px-2 font-semibold text-ks-slate outline-none focus:border-ks-blue"
                        />
                      </label>
                      <Button className="mb-0.5" disabled={updateMutation.isPending} onClick={() => handleSave(klass)}>
                        {updateMutation.isPending ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="secondary" className="mb-0.5" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </TeacherTable>
      <Card className="rounded-xl p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-ks-emerald" />
          <p className="font-bold text-ks-slate">All covered topic counts are validated against totals on save.</p>
        </div>
      </Card>
    </TeacherWorkspaceShell>
  );
}

export function TeacherAnnouncementsPage() {
  const { data: rawAnnouncements, isLoading, isError, refetch } = useTeacherAnnouncements() as { data: Array<{ id?: string; body?: string; title?: string; audience?: string; targetRoles?: string[] }> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const announcementItems = (rawAnnouncements ?? []).map((a) => ({
    id: a.id ?? a.title ?? String(Math.random()),
    body: a.body ?? a.title ?? '',
    audience: a.audience ?? ((a.targetRoles ?? []).join(', ') || 'All classes'),
  }));
  return (
    <TeacherWorkspaceShell title="Teacher Announcements" eyebrow="Class communication">
      <Card className="rounded-xl p-5">
        <SectionTitle title="Active announcements" action="/teacher/announcements/create" />
        {isLoading ? (
          <div className="mt-4"><SkeletonTable cols={2} /></div>
        ) : isError ? (
          <div className="mt-4"><DataError onRetry={refetch} /></div>
        ) : announcementItems.length === 0 ? (
          <div className="mt-4"><EmptyState title="No announcements yet" description="Create an announcement to communicate with your students and parents." /></div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {announcementItems.map((item) => (
              <Card key={item.id} className="flex flex-col gap-3 rounded-xl p-4">
                <p className="flex-1 text-sm font-semibold leading-6 text-ks-slate">{item.body}</p>
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="blue">{item.audience}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </TeacherWorkspaceShell>
  );
}

export function CreateTeacherAnnouncementPage() {
  const navigate = useNavigate();
  const createMutation = useCreateAnnouncementMutation();
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL', audience: 'Students', scheduledAt: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { toast('Title and body are required', 'error'); return; }
    createMutation.mutate({ title: form.title, body: form.body, priority: form.priority, audience: form.audience, scheduledAt: form.scheduledAt || undefined }, {
      onSuccess: () => { toast('Announcement published', 'success'); navigate('/teacher/announcements'); },
      onError: () => toast('Failed to publish. Please try again.', 'error'),
    });
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <TeacherWorkspaceShell title="Create Announcement" eyebrow="Teacher communication">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-3">
              <MessageSquarePlus className="h-5 w-5 text-ks-blue" />
              <SectionTitle title="New Announcement" />
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Title *</span>
                <input required value={form.title} onChange={set('title')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="e.g. Physics lab report due Friday" />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Body *</span>
                <textarea required value={form.body} onChange={set('body')} rows={4} className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="Write your announcement…" />
              </label>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Priority</span>
                  <select value={form.priority} onChange={set('priority')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue">
                    <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Audience</span>
                  <select value={form.audience} onChange={set('audience')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue">
                    <option>Students</option><option>Parents</option><option>Students + Parents</option><option>All classes</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Schedule</span>
                  <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue" />
                </label>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                <Send className="h-4 w-4" /> {createMutation.isPending ? 'Publishing…' : 'Publish'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/teacher/announcements')}>Cancel</Button>
            </div>
          </Card>
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Live Preview</p>
            <div className="mt-3 rounded-xl border border-ks-line bg-ks-paper p-4">
              <p className="font-bold text-ks-slate">{form.title || 'Announcement title…'}</p>
              <p className="mt-2 text-sm leading-relaxed text-ks-muted">{form.body || 'Body text will appear here…'}</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-full bg-ks-blue/10 px-2 py-0.5 text-[10px] font-black text-ks-blue">{form.audience}</span>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </TeacherWorkspaceShell>
  );
}

export function CreateInterventionPage() {
  const navigate = useNavigate();
  const { data: apiClasses = [] as typeof teacherClasses } = useTeacherClasses() as { data: typeof teacherClasses };
  const createMutation = useCreateInterventionMutation();
  const [form, setForm] = useState({ classId: '', studentId: '', subject: '', type: 'ACADEMIC_SUPPORT', notes: '', followUpDate: '', relatedAlert: '' });
  const { data: classStudents = [] as typeof students } = useClassStudents(form.classId) as { data: typeof students };

  const selectedStudent = classStudents.find((s) => s.id === form.studentId);
  const selectedClass = apiClasses.find((c) => c.id === form.classId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.notes.trim()) { toast('Select a student and enter notes', 'error'); return; }
    createMutation.mutate({
      studentId: form.studentId,
      student: selectedStudent?.name ?? '',
      classId: form.classId,
      subject: form.subject || selectedClass?.subject || '',
      type: form.type,
      note: form.notes,
      followUpDate: form.followUpDate || undefined,
      relatedAlert: form.relatedAlert || undefined,
    }, {
      onSuccess: () => { toast('Intervention created successfully', 'success'); navigate('/teacher/performance/alerts'); },
      onError: () => toast('Failed to create intervention. Please try again.', 'error'),
    });
  };

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <TeacherWorkspaceShell title="Create Intervention" eyebrow="Student support">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-ks-blue" />
              <SectionTitle title="New Intervention Record" />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Class *</span>
                <select
                  value={form.classId}
                  onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, studentId: '', subject: apiClasses.find((c) => c.id === e.target.value)?.subject ?? '' }))}
                  className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue"
                >
                  <option value="">Select class…</option>
                  {apiClasses.map((c) => <option key={c.id} value={c.id}>{c.className} · {c.subject}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Student *</span>
                <select
                  required
                  value={form.studentId}
                  onChange={(e) => setForm((p) => ({ ...p, studentId: e.target.value }))}
                  disabled={!form.classId}
                  className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue disabled:opacity-50"
                >
                  <option value="">{form.classId ? 'Select student…' : 'Select class first'}</option>
                  {classStudents.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.registration})</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Intervention type</span>
                <select value={form.type} onChange={set('type')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue">
                  <option value="ACADEMIC_SUPPORT">Academic Support</option>
                  <option value="PEER_PAIRING">Peer Pairing</option>
                  <option value="PARENT_MEETING">Parent Meeting</option>
                  <option value="REMEDIAL_CLASS">Remedial Class</option>
                  <option value="COUNSELING">Counseling</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Follow-up date</span>
                <input type="date" value={form.followUpDate} onChange={set('followUpDate')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Notes & action plan *</span>
                <textarea required value={form.notes} onChange={set('notes')} rows={4} className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="Describe the support plan and expected outcomes…" />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                <Save className="h-4 w-4" /> {createMutation.isPending ? 'Creating…' : 'Create Intervention'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </Card>
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Preview</p>
            <div className="mt-3 space-y-3 rounded-xl bg-ks-paper p-4">
              <div><p className="text-[10px] font-black text-ks-muted">STUDENT</p><p className="font-bold text-ks-slate">{selectedStudent?.name || '—'}</p></div>
              <div><p className="text-[10px] font-black text-ks-muted">TYPE</p><p className="font-bold text-ks-slate">{form.type.replace(/_/g, ' ')}</p></div>
              <div><p className="text-[10px] font-black text-ks-muted">NOTES</p><p className="text-sm font-semibold leading-relaxed text-ks-slate">{form.notes || '—'}</p></div>
              {form.followUpDate && <div><p className="text-[10px] font-black text-ks-muted">FOLLOW-UP</p><p className="font-bold text-ks-slate">{form.followUpDate}</p></div>}
            </div>
          </Card>
        </div>
      </form>
    </TeacherWorkspaceShell>
  );
}

const exportItems: Array<{ title: string; description: string; format: string; reportType: string }> = [
  { title: 'Class list', description: 'All students in your assigned classes with registration numbers.', format: 'CSV', reportType: 'teacher-class-list' },
  { title: 'Attendance history', description: 'All submitted attendance records for the current term.', format: 'PDF', reportType: 'teacher-attendance-history' },
  { title: 'Blank marks sheet', description: 'Pre-filled student list ready for offline marks entry.', format: 'CSV', reportType: 'teacher-blank-marks-sheet' },
  { title: 'Submitted marks', description: 'Approved assessment marks with HOD sign-off record.', format: 'PDF', reportType: 'teacher-submitted-marks' },
  { title: 'Syllabus coverage', description: 'Topic-by-topic coverage with completion status and risks.', format: 'PDF', reportType: 'teacher-syllabus-coverage' },
  { title: 'Student snapshot', description: 'Performance, attendance and intervention summary per student.', format: 'PDF', reportType: 'teacher-student-snapshot' },
];

export function TeacherExportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);
  const generateMutation = useGenerateReportMutation();

  const handleGenerate = async (item: typeof exportItems[0]) => {
    setGenerating(item.title);
    toast(`Generating "${item.title}"…`, 'info');
    try {
      const result = await generateMutation.mutateAsync({ type: item.reportType, format: item.format.toLowerCase() }) as Record<string, unknown> | undefined;
      const jobId = String(result?.id ?? result?.jobId ?? '');
      if (!jobId) throw new Error('No job id returned');
      await downloadReportWhenReady(jobId, `${item.title}.${item.format.toLowerCase()}`);
      toast(`"${item.title}" downloaded`, 'success');
    } catch {
      toast(`Failed to generate "${item.title}". Please try again.`, 'error');
    } finally {
      setGenerating(null);
    }
  };

  return (
    <TeacherWorkspaceShell title="Teacher Export Center" eyebrow="Reports and files">
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {exportItems.map((item) => (
          <Card key={item.title} className="group flex flex-col rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-layer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ks-blue/10">
                <Download className="h-5 w-5 text-ks-blue" />
              </div>
              <span className="rounded-full border border-ks-slate/15 bg-ks-slate/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-slate">{item.format}</span>
            </div>
            <h3 className="mt-4 font-display text-xl font-black text-ks-slate">{item.title}</h3>
            <p className="mt-1 flex-1 text-sm font-semibold text-ks-muted">{item.description}</p>
            <Button variant="secondary" className="mt-4 w-full" disabled={generating === item.title || generating !== null} onClick={() => handleGenerate(item)}>
              {generating === item.title ? 'Generating…' : 'Generate'}
            </Button>
          </Card>
        ))}
      </div>
    </TeacherWorkspaceShell>
  );
}

export function CreatePairingPage() {
  const navigate = useNavigate();
  const { data: apiClasses = [] as typeof teacherClasses } = useTeacherClasses() as { data: typeof teacherClasses };
  const createMutation = useCreatePairingMutation();
  const [classId, setClassId] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [supportId, setSupportId] = useState('');
  const [reason, setReason] = useState('');
  const { data: classStudents = [] as typeof students } = useClassStudents(classId) as { data: typeof students };

  const mentorOptions = classStudents.filter((s) => s.id !== supportId);
  const supportOptions = classStudents.filter((s) => s.id !== mentorId);
  const mentor = classStudents.find((s) => s.id === mentorId);
  const support = classStudents.find((s) => s.id === supportId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorId || !supportId || !reason.trim()) { toast('Select both students and provide a reason', 'warning'); return; }
    if (mentorId === supportId) { toast('Mentor and student to support cannot be the same person', 'error'); return; }
    createMutation.mutate({
      classId,
      peerId: mentorId,
      studentId: supportId,
      subject: apiClasses.find((c) => c.id === classId)?.subject ?? '',
      reason,
    }, {
      onSuccess: () => { toast('Peer pairing created', 'success'); navigate('/teacher/performance/pairings'); },
      onError: () => toast('Failed to create pairing', 'error'),
    });
  };

  return (
    <TeacherWorkspaceShell title="Create Peer Pairing" eyebrow="Manual student support">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-xl p-5">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-ks-blue" />
              <SectionTitle title="New Peer Pairing" />
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Class</span>
                <select
                  value={classId}
                  onChange={(e) => { setClassId(e.target.value); setMentorId(''); setSupportId(''); }}
                  className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue"
                >
                  <option value="">Select class…</option>
                  {apiClasses.map((c) => <option key={c.id} value={c.id}>{c.className} · {c.subject}</option>)}
                </select>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Mentor (high performer) *</span>
                  <select
                    required
                    value={mentorId}
                    onChange={(e) => setMentorId(e.target.value)}
                    disabled={!classId}
                    className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue disabled:opacity-50"
                  >
                    <option value="">{classId ? 'Select mentor…' : 'Select class first'}</option>
                    {mentorOptions.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.average}%</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Student needing support *</span>
                  <select
                    required
                    value={supportId}
                    onChange={(e) => setSupportId(e.target.value)}
                    disabled={!classId}
                    className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue disabled:opacity-50"
                  >
                    <option value="">{classId ? 'Select student…' : 'Select class first'}</option>
                    {supportOptions.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.average}%</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Reason for pairing *</span>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why this pairing is recommended…"
                  className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="submit" disabled={createMutation.isPending}>
                <Plus className="h-4 w-4" /> {createMutation.isPending ? 'Creating…' : 'Create Pairing'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/teacher/performance/pairings')}>Cancel</Button>
            </div>
          </Card>

          {/* Preview */}
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Pairing Preview</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-ks-emerald/30 bg-ks-emerald/5 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Mentor</p>
                <p className="mt-1 font-display text-lg font-black text-ks-slate">{mentor?.name || '—'}</p>
                {mentor && <p className="text-xs font-semibold text-ks-emerald">{mentor.average}% average</p>}
              </div>
              <div className="flex justify-center text-ks-muted text-2xl font-black">↓</div>
              <div className="rounded-xl border border-ks-rose/30 bg-ks-rose/5 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Needs Support</p>
                <p className="mt-1 font-display text-lg font-black text-ks-slate">{support?.name || '—'}</p>
                {support && <p className="text-xs font-semibold text-ks-rose">{support.average}% average</p>}
              </div>
              {mentor && support && (
                <div className="rounded-xl bg-ks-mist p-3 text-center">
                  <p className="text-xs font-semibold text-ks-muted">Score gap</p>
                  <p className="font-display text-2xl font-black text-ks-navy">{Math.abs(mentor.average - support.average)}pts</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </form>
    </TeacherWorkspaceShell>
  );
}

// ─── Internal sub-components ────────────────────────────────────────────────

function ClassSubjectsTable() {
  const { data: apiClasses = [] as typeof teacherClasses, isLoading, isError } = useTeacherClasses() as { data: typeof teacherClasses; isLoading: boolean; isError: boolean };
  if (isLoading) return <SkeletonTable cols={9} />;
  if (isError || !apiClasses.length) return null;
  return (
    <TeacherTable columns={['Class', 'Subject', 'Students', 'Average', 'Attendance', 'Syllabus', 'Open marks', 'Next lesson', 'Actions']}>
      {apiClasses.map((item) => (
        <tr key={item.id} className="hover:bg-ks-paper">
          <Td>{item.className}</Td>
          <Td>{item.subject}</Td>
          <Td>{item.students}</Td>
          <Td><span className={item.average >= 75 ? 'font-bold text-ks-emerald' : item.average >= 60 ? 'font-bold text-ks-amber' : 'font-bold text-ks-rose'}>{item.average}%</span></Td>
          <Td>{item.attendance}%</Td>
          <Td>
            <div className="flex items-center gap-2">
              <ProgressBar value={item.syllabus} tone={item.risk === 'HIGH' ? 'bg-ks-rose' : item.risk === 'MEDIUM' ? 'bg-ks-amber' : 'bg-ks-emerald'} className="w-16" />
              <span className="text-xs text-ks-muted">{item.syllabus}%</span>
            </div>
          </Td>
          <Td>{item.openAssessments}</Td>
          <Td>{item.nextLesson}</Td>
          <Td><NavLink to={`/teacher/classes/${item.id}`} className="font-black text-ks-blue hover:underline">Open</NavLink></Td>
        </tr>
      ))}
    </TeacherTable>
  );
}

function AlertsOperationalTable() {
  const { data: apiAlerts = [] as typeof alerts } = usePerformanceAlerts() as unknown as { data: typeof alerts };
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line bg-ks-paper/50 px-gutter py-4">
        <h2 className="font-display text-2xl font-black text-ks-navy">Active Alerts</h2>
        <div className="flex gap-2">
          <Button variant="secondary" className="py-1.5 text-xs"><Filter className="h-3.5 w-3.5" /> Filter</Button>
          <Button className="py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</Button>
        </div>
      </div>
      <TeacherTable columns={['Student', 'Class / Subject', 'Alert Type', 'Recommended Action']}>
        {apiAlerts.map((alert) => (
          <tr key={alert.id} className="group cursor-pointer hover:bg-ks-paper">
            <Td>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">
                  {alert.student.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-black text-ks-navy">{alert.student}</p>
                  <p className="text-xs font-semibold text-ks-muted">ID: {alert.studentId.slice(-6).toUpperCase()}</p>
                </div>
              </div>
            </Td>
            <Td>
              <p className="font-bold text-ks-navy">{alert.className}</p>
              <p className="text-xs font-semibold text-ks-muted">{alert.subject}</p>
            </Td>
            <Td><AlertTypeBadge type={alert.type} severity={alert.severity} /></Td>
            <Td>
              <NavLink to={`/teacher/performance/alerts/${alert.id}`} className="font-black text-ks-blue hover:underline">
                {alert.action} →
              </NavLink>
            </Td>
          </tr>
        ))}
      </TeacherTable>
      <div className="border-t border-ks-line bg-ks-paper/30 px-gutter py-3 text-center">
        <NavLink to="/teacher/classes/cs-form3a-math/students" className="text-sm font-black text-ks-muted transition hover:text-ks-navy">
          View all student records
        </NavLink>
      </div>
    </Card>
  );
}

function PredictionPanel() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-ks-navy p-stack-lg text-white shadow-layer">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-ks-blue/10" />
      <div className="relative flex flex-col gap-stack-lg md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">System Prediction</p>
          <h3 className="mt-2 font-display text-2xl font-black">11% improvement projected</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-ks-mist/75">
            Based on the last 3 assessments — activate peer pairings before Friday and review the critical alert to unlock this outcome.
          </p>
        </div>
        <div className="flex shrink-0 gap-6">
          <div className="text-center">
            <p className="font-display text-3xl font-black text-ks-gold">A+</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-ks-mist/50">Efficiency</p>
          </div>
          <div className="h-12 w-px bg-white/20" />
          <div className="text-center">
            <p className="font-display text-3xl font-black text-ks-sky">85%</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-ks-mist/50">Engagement</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AcademicSpotlight() {
  const items = [
    { icon: '★', label: 'Physics top mover', sub: 'Joel Komba +18% this month', subColor: 'text-ks-emerald', iconColor: 'text-ks-gold' },
    { icon: '↓', label: 'Form 3B average', sub: '-4% drop detected', subColor: 'text-ks-rose', iconColor: 'text-ks-rose' },
    { icon: '↑', label: 'Amina Baraka', sub: 'Improving streak · +9%', subColor: 'text-ks-blue', iconColor: 'text-ks-blue' },
  ];
  return (
    <Card className="rounded-xl p-stack-lg">
      <h4 className="border-b border-ks-line pb-2 text-[11px] font-black uppercase tracking-[0.22em] text-ks-navy">Academic Spotlight</h4>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-lg bg-ks-paper p-3">
            <div className={`w-6 shrink-0 text-center text-lg font-black ${item.iconColor}`}>{item.icon}</div>
            <div>
              <p className="text-sm font-black text-ks-navy">{item.label}</p>
              <p className={`text-xs font-bold ${item.subColor}`}>{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AssessmentMiniTable({ detailed = false }: { detailed?: boolean }) {
  const { data: apiAssessments = [] as typeof assessments, isLoading, isError, refetch } = useTeacherAssessments() as { data: typeof assessments; isLoading: boolean; isError: boolean; refetch: () => void };
  if (isLoading) return <SkeletonTable cols={9} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (!apiAssessments.length) return <EmptyState title="No assessments yet" description="Assessments will appear here once they are created for your classes." />;
  return (
    <TeacherTable columns={['Assessment', 'Class', 'Subject', 'Type', 'Max', 'Status', 'Progress', 'Due', 'Actions']}>
      {apiAssessments.map((item) => (
        <tr key={item.id} className="hover:bg-ks-paper">
          <Td>{item.title}</Td>
          <Td>{item.className}</Td>
          <Td>{item.subject}</Td>
          <Td>{item.type}</Td>
          <Td>{item.maxScore}</Td>
          <Td><AssessmentStatusBadge status={item.status} /></Td>
          <Td>
            <div className="flex items-center gap-2">
              <ProgressBar value={(item.entered / item.total) * 100} tone="bg-ks-blue" className="w-16" />
              <span className="text-xs text-ks-muted">{item.entered}/{item.total}</span>
            </div>
          </Td>
          <Td>{item.due}</Td>
          <Td>
            <div className="flex gap-3">
              <NavLink to={`/teacher/assessments/${item.id}/marks`} className="font-black text-ks-blue hover:underline">Marks</NavLink>
              {detailed ? <NavLink to={`/teacher/assessments/${item.id}/review`} className="font-black text-ks-muted hover:text-ks-navy">Review</NavLink> : null}
            </div>
          </Td>
        </tr>
      ))}
    </TeacherTable>
  );
}

function StudentsTable({ classId = '', query = '' }: { classId?: string; query?: string }) {
  const { data: apiStudents = [] as typeof students } = useClassStudents(classId) as { data: typeof students };
  const q = query.trim().toLowerCase();
  const visible = q.length > 0
    ? apiStudents.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.roll.toLowerCase().includes(q) ||
        s.registration.toLowerCase().includes(q),
      )
    : apiStudents;
  return (
    <TeacherTable columns={['Roll', 'Student', 'Registration', 'Average', 'Attendance', 'Alert', 'Last score', 'Actions']}>
      {visible.map((student) => (
        <tr key={student.id} className="hover:bg-ks-paper">
          <Td><span className="font-mono text-xs text-ks-muted">{student.roll}</span></Td>
          <Td>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">
                {student.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <span className="font-bold text-ks-slate">{student.name}</span>
            </div>
          </Td>
          <Td><span className="font-mono text-xs">{student.registration}</span></Td>
          <Td>
            <span className={`font-bold ${student.average >= 75 ? 'text-ks-emerald' : student.average >= 60 ? 'text-ks-amber' : 'text-ks-rose'}`}>
              {student.average}%
            </span>
          </Td>
          <Td>{student.attendance}%</Td>
          <Td>
            <Badge tone={student.alert === 'Critical' ? 'rose' : student.alert === 'At Risk' ? 'amber' : student.alert === 'Improving' ? 'emerald' : 'slate'}>
              {student.alert}
            </Badge>
          </Td>
          <Td>{student.lastAssessment}</Td>
          <Td>
            <NavLink to={`/teacher/students/${student.id}/performance`} className="font-black text-ks-blue hover:underline">Profile</NavLink>
          </Td>
        </tr>
      ))}
    </TeacherTable>
  );
}

// Real class analytics computed from the class's latest assessment marks-review
// and the live performance-alerts feed.
function AnalyticsGrid({ classId }: { classId: string; analytics?: Record<string, unknown> | undefined }) {
  const { data: apiAssessments = [] } = useTeacherAssessments();
  const { data: apiAlerts = [] as typeof alerts } = usePerformanceAlerts() as unknown as { data: typeof alerts };
  const classAssessments = apiAssessments.filter((a) => a.classSubjectId === classId);
  const latest = classAssessments[0];
  const subjectName = latest?.subject ?? apiAssessments[0]?.subject ?? '';
  const { data: review } = useMarksReview(latest?.id ?? '') as { data: Record<string, unknown> | undefined };

  const stats = (review?.statistics as { count?: number; mean?: number; highest?: number; lowest?: number } | undefined) ?? {};
  const gd = (review?.gradeDistributionPreview as Record<string, number> | undefined) ?? {};
  const grades = ['A', 'B', 'C', 'D', 'E'];
  const gradeTotal = grades.reduce((s, g) => s + Number(gd[g] ?? 0), 0);
  const toneFor = (g: string) => g === 'A' ? 'bg-ks-emerald' : g === 'B' ? 'bg-ks-blue' : g === 'C' ? 'bg-ks-amber' : 'bg-ks-rose';
  const subjectAlerts = (apiAlerts as Array<{ id: string; student: string; subject: string; severity: string; reason: string }>)
    .filter((a) => !subjectName || a.subject === subjectName);

  return (
    <div className="grid gap-gutter xl:grid-cols-3">
      {/* Class average from real marks */}
      <Card className="overflow-hidden rounded-xl p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Class average</p>
        <p className="mt-1 font-display text-4xl font-black text-ks-slate">{stats.mean != null ? `${Math.round(stats.mean)}%` : '—'}</p>
        <p className="text-xs font-semibold text-ks-muted">{latest ? latest.title : 'No assessment data'}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-ks-paper p-3 text-center"><p className="text-[10px] font-black uppercase text-ks-muted">Highest</p><p className="mt-1 font-display text-lg font-black text-ks-emerald">{stats.highest ?? '—'}</p></div>
          <div className="rounded-lg bg-ks-paper p-3 text-center"><p className="text-[10px] font-black uppercase text-ks-muted">Lowest</p><p className="mt-1 font-display text-lg font-black text-ks-rose">{stats.lowest ?? '—'}</p></div>
          <div className="rounded-lg bg-ks-paper p-3 text-center"><p className="text-[10px] font-black uppercase text-ks-muted">Students</p><p className="mt-1 font-display text-lg font-black text-ks-slate">{stats.count ?? 0}</p></div>
        </div>
      </Card>

      {/* Real grade distribution */}
      <Card className="overflow-hidden rounded-xl p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Grade distribution</p>
        <p className="mt-1 font-display text-2xl font-black text-ks-slate">{gradeTotal} graded</p>
        <p className="text-xs font-semibold text-ks-muted">{latest ? latest.title : 'Latest assessment'}</p>
        {gradeTotal === 0 ? (
          <p className="mt-4 text-sm font-semibold text-ks-muted">No graded marks yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {grades.map((g) => {
              const count = Number(gd[g] ?? 0);
              const pct = Math.round((count / gradeTotal) * 100);
              return (
                <div key={g}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-bold text-ks-slate">{g}</span>
                    <span className="font-black text-ks-muted">{count} students</span>
                  </div>
                  <div className="h-6 overflow-hidden rounded-md bg-ks-line">
                    <div className={`h-full rounded-md transition-all duration-500 ${toneFor(g)}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Real at-risk students from alerts */}
      <Card className="overflow-hidden rounded-xl p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Students needing attention</p>
        <p className="mt-1 font-display text-2xl font-black text-ks-slate">{subjectAlerts.length} flagged</p>
        <p className="text-xs font-semibold text-ks-muted">From the performance engine</p>
        <div className="mt-4 space-y-3">
          {subjectAlerts.length === 0 && <p className="text-sm font-semibold text-ks-emerald">No flagged students.</p>}
          {subjectAlerts.slice(0, 4).map((item) => {
            const high = item.severity === 'CRITICAL' || item.severity === 'HIGH';
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-ks-line bg-ks-paper p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-ks-slate">{item.student}</p>
                  <p className="truncate text-xs font-semibold text-ks-muted">{item.reason}</p>
                </div>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-black ${high ? 'bg-ks-rose/10 text-ks-rose' : 'bg-ks-amber/10 text-ks-amber'}`}>{item.severity}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function WorkspaceTabs({ id }: { id: string }) {
  const tabs: [string, string, boolean?][] = [
    ['Overview', `/teacher/classes/${id}`, true],
    ['Students', `/teacher/classes/${id}/students`],
    ['Assessments', '/teacher/assessments'],
    ['Attendance', '/teacher/attendance'],
    ['Analytics', `/teacher/classes/${id}/analytics`],
    ['Syllabus', '/teacher/syllabus'],
  ];
  return (
    <Card className="flex flex-wrap gap-1 rounded-xl p-2">
      {tabs.map(([label, to, end]) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          className={({ isActive }) =>
            `rounded-lg px-4 py-2 text-sm font-black transition ${
              isActive ? 'bg-ks-navy text-white shadow-sm' : 'text-ks-muted hover:bg-ks-mist hover:text-ks-navy'
            }`
          }
        >
          {label}
        </NavLink>
      ))}
    </Card>
  );
}

function SearchPanel({ query, onChange }: { query: string; onChange: (q: string) => void }) {
  return (
    <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
      <Search className="h-5 w-5 shrink-0 text-ks-muted" />
      <input
        className="min-w-64 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-ks-muted"
        placeholder="Search by name, roll number, registration..."
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Badge tone="rose">At risk</Badge>
        <Badge tone="amber">Attendance low</Badge>
        <Badge tone="blue">Missing marks</Badge>
      </div>
    </Card>
  );
}


function ActionPanel({ title, actions, alertId }: { title: string; actions: string[]; alertId?: string }) {
  const navigate = useNavigate();
  const resolveMutation = useResolveAlertMutation();

  const handleAction = (action: string) => {
    const key = action.toLowerCase();
    if (key === 'resolve alert' && alertId) {
      resolveMutation.mutate(alertId, {
        onSuccess: () => toast('Alert resolved', 'success'),
        onError: () => toast('Failed to resolve alert', 'error'),
      });
      return;
    }
    if (key === 'create intervention') { navigate('/teacher/interventions/create'); return; }
    // No-op for actions without a wired backend (button is still rendered for UX completeness)
  };

  return (
    <Card className="sticky top-24 h-fit rounded-xl border-l-4 border-l-ks-blue p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">{title}</p>
      <div className="mt-4 space-y-2">
        {actions.map((action) => (
          <Button
            key={action}
            variant={action.toLowerCase().includes('reject') ? 'danger' : 'secondary'}
            className="w-full justify-between"
            onClick={() => handleAction(action)}
            disabled={resolveMutation.isPending && action.toLowerCase() === 'resolve alert'}
          >
            {action === 'Resolve alert' && resolveMutation.isPending ? 'Resolving…' : action}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </Card>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex flex-1 items-center justify-between gap-3">
      <h2 className="font-display text-2xl font-black text-ks-slate">{title}</h2>
      {action ? <NavLink to={action} className="text-sm font-black text-ks-blue hover:underline">Open →</NavLink> : null}
    </div>
  );
}

function TimelineStep({ label, active, step }: { label: string; active: boolean; step: number }) {
  return (
    <div className={`relative rounded-xl border p-4 text-center ${active ? 'border-ks-emerald bg-ks-emerald/5' : 'border-ks-line bg-ks-paper'}`}>
      <div className={`mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${active ? 'bg-ks-emerald text-white' : 'bg-ks-line text-ks-muted'}`}>
        {active ? <CheckCircle2 className="h-4 w-4" /> : step}
      </div>
      <p className="text-sm font-bold text-ks-slate">{label}</p>
    </div>
  );
}

function AttendanceStat({ label, value, color, bg }: { label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${bg}`}>
      <p className={`font-display text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs font-bold text-ks-muted">{label}</p>
    </div>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 font-semibold text-ks-slate">{children}</td>;
}

function useClassSubject() {
  const { classSubjectId } = useParams();
  const { data: apiClasses = [], isLoading } = useTeacherClasses();
  return useMemo(() => {
    if (isLoading) return { loading: true, klass: null };
    const klass = apiClasses.find((item) => item.id === classSubjectId) ?? null;
    return { loading: false, klass };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classSubjectId, apiClasses, isLoading]);
}

function useAssessment() {
  const { assessmentId } = useParams();
  const { data: apiAssessments = [], isLoading } = useTeacherAssessments();
  return useMemo(() => {
    if (isLoading) return { loading: true, assessment: null };
    const assessment = apiAssessments.find((item) => item.id === assessmentId) ?? null;
    return { loading: false, assessment };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, apiAssessments, isLoading]);
}
