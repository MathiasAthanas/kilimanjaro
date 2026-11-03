import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, ClipboardCheck, Download, Edit2, FileSpreadsheet, MessageSquarePlus, Plus, Save, Search, Send, ShieldCheck, UserPlus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from '../../../lib/toast';
import { errorMessage } from '../../../lib/api/errors';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import {
  assessmentMarksPath,
  useTeacherClasses,
  useTeacherRegisters,
  useTeacherAssessments,
  useTeacherTimetable,
  usePerformanceAlerts,
  usePerfPairings,
  useClassStudents,
  useRegisterStudents,
  useMarksSheet,
  useAttendanceList,
  useStudentPerformance,
  useClassAnalytics,
  useTeacherAnnouncements,
  useMyInterventions,
  useStudentBasic,
  useSubmitAssessmentMutation,
  useSubmitMarksBulkMutation,
  useMarkAttendanceMutation,
  useCreateAnnouncementMutation,
  useCreateInterventionMutation,
  useResolveAlertMutation,
  useUpdateSyllabusMutation,
  useCreatePairingMutation,
  useUpdatePairingStatusMutation,
  useCurrentTerm,
  useStudentReportCards,
  useUpdateReportCardCommentsMutation,
} from '../api/teacher.hooks';
import type { Alert, Assessment, ClassSubject, MarkRow, Student } from '../types/teacher.types';
import {
  AlertStaffCard,
  AlertTypeBadge,
  AssessmentStatusBadge,
  AttendanceGrid,
  ClassSubjectCard,
  MarksGrid,
  marksProgress,
  PairingCard,
  ProgressBar,
  TeacherMetricStrip,
  TeacherTable,
  TeacherWorkspaceShell,
  TimetableBoard,
} from '../components/TeacherWorkspaceShell';
import type { MarkEdit } from '../components/TeacherWorkspaceShell';
import { groupBySchool, SchoolBadge, SchoolHeading, useTeacherSchools } from '../components/TeacherBits';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { SkeletonCards } from '../../../components/common/SkeletonCards';

// Lists below are empty-until-loaded; keep the original local type names readable.
type Row = Record<string, any>;
// A stable empty list: a fresh `[]` default on every render would re-trigger effects that depend on it.
const NO_STUDENTS: Student[] = [];
const dueLabel = (iso: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');


export function TeacherHomePage() {
  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const { data: allAssessments = [] } = useTeacherAssessments();
  const { data: timetable = [] } = useTeacherTimetable();
  const { data: registers = [] } = useTeacherRegisters();
  const { data: alerts = [] } = usePerformanceAlerts();
  const { multi, visible } = useTeacherSchools();

  const myClasses = visible(classes);
  const assessments = visible(allAssessments);
  const todo = assessments.filter((a) => ['DRAFT', 'OPEN', 'REJECTED'].includes(a.status) && (!a.examWindow || ['OPEN', 'REOPENED'].includes(a.examWindow.status)));
  const waiting = assessments.filter((a) => a.status === 'SUBMITTED').length;
  const withSyllabus = myClasses.filter((c) => c.syllabusTotal > 0);
  const avgSyllabus = withSyllabus.length ? Math.round(withSyllabus.reduce((t, c) => t + c.syllabus, 0) / withSyllabus.length) : 0;
  const todaySlots = visible(timetable).filter((e) => e.day.slice(0, 3) === ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]);
  const myAlerts = visible(alerts as unknown as Array<Alert & { schoolId?: string }>);
  const criticalAlerts = myAlerts.filter((a) => a.severity === 'CRITICAL').length;
  const homeroom = visible(registers).filter((r) => r.isClassTeacher);

  return (
    <TeacherWorkspaceShell
      title="Teacher Dashboard"
      eyebrow="Your day at a glance"
      action={<NavLink to="/teacher/attendance"><Button className="bg-ks-gold text-ks-slate hover:shadow-md hover:shadow-ks-gold/30">Take attendance</Button></NavLink>}
    >
      {!classesLoading && myClasses.length === 0 && homeroom.length === 0 && (
        <Card className="rounded-xl border-l-4 border-l-ks-blue p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-blue">Welcome</p>
          <h2 className="font-display text-2xl font-black text-ks-slate">You have no classes yet</h2>
          <p className="mt-1 text-sm font-semibold text-ks-muted">Your classes, timetable and marks appear here once the administrator assigns you to teach. You can still use E-Learning and announcements in the meantime.</p>
        </Card>
      )}
      <TeacherMetricStrip
        items={[
          { label: 'My classes', value: String(myClasses.length), detail: myClasses.length === 0 ? 'None assigned yet' : multi ? `in ${new Set(myClasses.map((c) => c.schoolId)).size} school${new Set(myClasses.map((c) => c.schoolId)).size === 1 ? '' : 's'}` : 'Subjects you teach', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
          { label: 'Marks to finish', value: String(todo.length), detail: todo.length > 0 ? 'Open now' : waiting > 0 ? `${waiting} waiting for approval` : myClasses.length ? 'All up to date' : 'Nothing assigned', tone: 'bg-ks-amber', valueColor: todo.length > 0 ? 'text-ks-amber' : 'text-ks-emerald' },
          { label: 'Lessons today', value: String(todaySlots.length), detail: `${timetable.length} this week`, tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
          { label: 'Syllabus covered', value: withSyllabus.length ? `${avgSyllabus}%` : '—', detail: 'Average across your classes', inverted: true, icon: ShieldCheck },
        ]}
      />

      {todo.length > 0 && (
        <Card className="rounded-xl border-l-4 border-l-ks-amber p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-amber">Needs your marks</p>
              <h2 className="font-display text-2xl font-black text-ks-slate">{todo.length} subject{todo.length === 1 ? '' : 's'} waiting for results</h2>
            </div>
            <NavLink to="/teacher/exams"><Button variant="secondary">See all exam work</Button></NavLink>
          </div>
          <div className="mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {todo.slice(0, 6).map((item) => (
              <NavLink key={item.id} to={assessmentMarksPath(item)} className="block rounded-xl border border-ks-line p-3 transition hover:border-ks-blue/40 hover:bg-ks-paper">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-black text-ks-slate">{item.subject} · {item.className}</p>
                  <SchoolBadge schoolId={item.schoolId} />
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold text-ks-muted">{item.examWindow?.name ?? item.title}{item.due ? ` · due ${dueLabel(item.due)}` : ''}</p>
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={item.total ? (item.entered / item.total) * 100 : 0} tone="bg-ks-blue" className="flex-1" />
                  <span className="text-[11px] font-bold text-ks-muted">{item.entered}/{item.total}</span>
                </div>
              </NavLink>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-gutter xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Today</p>
              <h2 className="font-display text-2xl font-black text-ks-slate">Your lessons</h2>
            </div>
            <NavLink to="/teacher/timetable" className="text-sm font-black text-ks-blue hover:underline">Full timetable →</NavLink>
          </div>
          {todaySlots.length === 0 ? (
            <p className="mt-5 text-sm font-semibold text-ks-muted">{timetable.length === 0 ? 'Your timetable has not been set up yet.' : 'No lessons today.'}</p>
          ) : (
            <div className="mt-5 space-y-2.5">
              {todaySlots.map((entry) => (
                <div key={entry.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 transition ${entry.current ? 'border-ks-gold bg-ks-gold/10 shadow-sm' : 'border-ks-line bg-ks-paper/70'}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${entry.current ? 'bg-ks-gold text-ks-slate' : 'bg-ks-navy text-white'}`}>{entry.time}</div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-ks-slate">{entry.subject} · {entry.className}</p>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-ks-muted">{entry.room}<SchoolBadge schoolId={entry.schoolId} /></p>
                    </div>
                    {entry.current && <span className="rounded-full bg-ks-gold/20 px-2 py-0.5 text-[10px] font-black text-ks-slate">NOW</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-gutter">
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Quick actions</p>
            <div className="mt-3 grid gap-2">
              <NavLink to="/teacher/attendance" className="flex items-center gap-2 rounded-lg border border-ks-line px-3 py-2 text-sm font-black text-ks-navy hover:bg-ks-paper"><CalendarCheck className="h-4 w-4 text-ks-blue" /> Take attendance{homeroom.length ? ` (${homeroom.length} class${homeroom.length === 1 ? '' : 'es'} are yours)` : ''}</NavLink>
              <NavLink to="/teacher/exams" className="flex items-center gap-2 rounded-lg border border-ks-line px-3 py-2 text-sm font-black text-ks-navy hover:bg-ks-paper"><FileSpreadsheet className="h-4 w-4 text-ks-blue" /> Enter exam marks</NavLink>
              <NavLink to="/teacher/syllabus" className="flex items-center gap-2 rounded-lg border border-ks-line px-3 py-2 text-sm font-black text-ks-navy hover:bg-ks-paper"><ClipboardCheck className="h-4 w-4 text-ks-blue" /> Update syllabus progress</NavLink>
              <NavLink to="/teacher/announcements/create" className="flex items-center gap-2 rounded-lg border border-ks-line px-3 py-2 text-sm font-black text-ks-navy hover:bg-ks-paper"><MessageSquarePlus className="h-4 w-4 text-ks-blue" /> Tell my class something</NavLink>
            </div>
          </Card>
          <Card className="rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Students needing help</p>
              <NavLink to="/teacher/performance/alerts" className="text-xs font-black text-ks-blue hover:underline">All →</NavLink>
            </div>
            {myAlerts.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-ks-emerald">No students flagged right now.</p>
            ) : (
              <>
                <p className="mt-2 text-sm font-semibold text-ks-muted">{criticalAlerts} critical · {myAlerts.length} flagged</p>
                <div className="mt-3 space-y-2">
                  {myAlerts.slice(0, 3).map((a) => (
                    <NavLink key={a.id} to={`/teacher/performance/alerts/${a.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-ks-line p-2.5 text-sm hover:bg-ks-paper">
                      <span className="min-w-0 truncate font-bold text-ks-slate">{a.student}<span className="font-semibold text-ks-muted"> · {a.subject}</span></span>
                      <Badge tone={a.severity === 'CRITICAL' ? 'rose' : 'amber'}>{a.severity === 'CRITICAL' ? 'Critical' : 'At risk'}</Badge>
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl font-black text-ks-slate">My classes</h2>
          <NavLink to="/teacher/classes" className="text-sm font-black text-ks-blue hover:underline">Manage →</NavLink>
        </div>
        {classesLoading ? <SkeletonCards count={3} cols="xl:grid-cols-3" /> : myClasses.length === 0 ? (
          <EmptyState title="No classes assigned yet" description="Your class and subject assignments appear here once the administrator sets them up." />
        ) : (
          <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
            {myClasses.map((item) => <ClassSubjectCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </TeacherWorkspaceShell>
  );
}

export function TeacherClassesPage() {
  const { data: allClasses = [], isLoading, isError, refetch } = useTeacherClasses();
  const { multi, visible, nameOf } = useTeacherSchools();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [school, setSchool] = useState('');
  const [attention, setAttention] = useState(false);

  const scoped = visible(allClasses);
  const stages = [...new Set(scoped.map((c) => c.stage).filter(Boolean))];
  const schools = [...new Set(scoped.map((c) => c.schoolId).filter(Boolean))];
  const q = query.trim().toLowerCase();
  const filtered = scoped.filter((c) =>
    (!q || `${c.subject} ${c.className}`.toLowerCase().includes(q)) &&
    (!stage || c.stage === stage) &&
    (!school || c.schoolId === school) &&
    (!attention || c.risk === 'HIGH' || c.openAssessments > 0),
  );
  const groups = multi && !school ? groupBySchool(filtered) : [{ schoolId: school, rows: filtered }];

  return (
    <TeacherWorkspaceShell title="My Classes" eyebrow="Everything you teach">
      <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
        <div className="flex min-w-56 flex-1 items-center gap-2 rounded-lg border border-ks-line bg-white px-3">
          <Search className="h-4 w-4 text-ks-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject or class…" aria-label="Search classes" className="h-10 w-full bg-transparent text-sm font-semibold outline-none" />
        </div>
        {stages.length > 1 && (
          <select value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by level" className="h-10 rounded-lg border border-ks-line bg-white px-3 text-sm font-bold text-ks-navy">
            <option value="">All levels</option>
            {stages.map((st) => <option key={st} value={st}>{st.replace('_', '-')}</option>)}
          </select>
        )}
        {multi && schools.length > 1 && (
          <select value={school} onChange={(e) => setSchool(e.target.value)} aria-label="Filter by school" className="h-10 rounded-lg border border-ks-line bg-white px-3 text-sm font-bold text-ks-navy">
            <option value="">All my schools</option>
            {schools.map((id) => <option key={id} value={id}>{nameOf(id) || id}</option>)}
          </select>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ks-navy">
          <input type="checkbox" checked={attention} onChange={(e) => setAttention(e.target.checked)} /> Needs attention
        </label>
        <span className="ml-auto text-xs font-bold text-ks-muted">{filtered.length} of {scoped.length}</span>
      </Card>
      {isLoading ? (
        <SkeletonCards count={3} cols="xl:grid-cols-3" />
      ) : isError ? (
        <DataError onRetry={refetch} />
      ) : !scoped.length ? (
        <EmptyState title="No classes assigned" description="Class-subject assignments will appear here once configured by the administrator." />
      ) : filtered.length === 0 ? (
        <EmptyState title="Nothing matches" description="Clear the search or filters to see all your classes." />
      ) : (
        groups.map((g) => (
          <div key={g.schoolId || 'all'}>
            {multi && !school && <SchoolHeading schoolId={g.schoolId} />}
            <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
              {g.rows.map((item) => <ClassSubjectCard key={item.id} item={item} />)}
            </div>
          </div>
        ))
      )}
    </TeacherWorkspaceShell>
  );
}

export function ClassWorkspacePage() {
  const { loading, klass } = useClassSubject();
  const { data: alerts = [] } = usePerformanceAlerts();
  const { data: assessments = [] } = useTeacherAssessments();
  const { data: roster = [] } = useClassStudents(klass?.id ?? '');
  const { nameOf, multi } = useTeacherSchools();

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Class workspace"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (!klass) return (
    <TeacherWorkspaceShell title="Class not found" eyebrow="Class workspace">
      <EmptyState title="Class not found" description="This class assignment no longer exists or you are not assigned to it." />
    </TeacherWorkspaceShell>
  );

  const mine = assessments.filter((a) => a.classSubjectId === klass.id);
  const toEnter = mine.filter((a) => ['DRAFT', 'OPEN', 'REJECTED'].includes(a.status) && (!a.examWindow || ['OPEN', 'REOPENED'].includes(a.examWindow.status)));
  const rosterIds = new Set(roster.map((st) => st.id));
  const classAlerts = alerts.filter((a: any) => rosterIds.has(String(a.studentId)) && (!a.subject || a.subject === klass.subject));
  const next = toEnter[0];

  return (
    <TeacherWorkspaceShell
      title={`${klass.subject} · ${klass.className}`}
      eyebrow={multi ? `${nameOf(klass.schoolId) || 'Class workspace'}` : 'Class workspace'}
    >
      <WorkspaceTabs id={klass.id} classId={klass.classId} />
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="space-y-gutter">
          <TeacherMetricStrip items={[
            { label: 'Students', value: String(klass.students), detail: klass.classSize !== klass.students ? `of ${klass.classSize} in the class` : klass.combination ? `Combination ${klass.combination}` : 'Take this subject', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
            { label: 'Class average', value: klass.average > 0 ? `${klass.average}%` : '—', detail: 'Across your assessments', tone: 'bg-ks-emerald', valueColor: klass.average >= 60 ? 'text-ks-emerald' : 'text-ks-amber' },
            { label: 'Marks to finish', value: String(toEnter.length), detail: toEnter.length ? 'Enter or submit' : 'Nothing waiting', tone: 'bg-ks-amber', valueColor: toEnter.length > 0 ? 'text-ks-amber' : 'text-ks-emerald' },
            { label: 'Syllabus', value: klass.syllabusTotal ? `${klass.syllabus}%` : '—', detail: klass.syllabusTotal ? `${klass.syllabusCovered} of ${klass.syllabusTotal} topics` : 'Not started yet', inverted: true, icon: ShieldCheck },
          ]} />
          <Card className="rounded-xl p-5">
            <SectionTitle title="Students needing attention" action="/teacher/performance/alerts" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {classAlerts.slice(0, 4).map((alert: any) => <AlertStaffCard key={alert.id} alert={alert} />)}
              {classAlerts.length === 0 && <p className="col-span-2 text-sm font-semibold text-ks-emerald">No students are flagged in this class.</p>}
            </div>
          </Card>
          <Card className="rounded-xl p-5">
            <SectionTitle title="Assessments" action={`/teacher/assessments?class=${klass.id}`} />
            {mine.length === 0 ? (
              <p className="mt-3 text-sm font-semibold text-ks-muted">No assessments have been set up for this class yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-ks-line">
                {mine.slice(0, 6).map((a) => (
                  <NavLink key={a.id} to={assessmentMarksPath(a)} className="flex flex-wrap items-center justify-between gap-2 py-2.5 hover:bg-ks-paper">
                    <span className="min-w-0 truncate text-sm font-bold text-ks-slate">{a.examWindow?.name ?? a.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-ks-muted">{a.entered}/{a.total}</span>
                      <AssessmentStatusBadge status={a.status} />
                    </span>
                  </NavLink>
                ))}
              </div>
            )}
          </Card>
        </div>
        <Card className="sticky top-24 h-fit overflow-hidden rounded-xl border-l-4 border-l-ks-gold p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Next step</p>
          {next ? (
            <>
              <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">{next.examWindow?.name ?? next.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">
                {next.entered >= next.total && next.total > 0
                  ? `All ${next.total} marks are entered. Check them and submit${next.due ? ` before ${dueLabel(next.due)}` : ''}.`
                  : `${Math.max(next.total - next.entered, 0)} of ${next.total} students still need a result${next.due ? ` · due ${dueLabel(next.due)}` : ''}.`}
              </p>
              <div className="mt-4 space-y-2.5 [&_a]:block">
                <NavLink to={assessmentMarksPath(next)}><Button className="w-full">{next.entered >= next.total && next.total > 0 ? 'Review & submit' : 'Enter marks'}</Button></NavLink>
                <NavLink to={`/teacher/classes/${klass.id}/analytics`}><Button variant="secondary" className="w-full">View analytics</Button></NavLink>
              </div>
            </>
          ) : (
            <>
              <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">All marks are in</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">Nothing is waiting for you in this class.</p>
              <div className="mt-4 space-y-2.5 [&_a]:block">
                <NavLink to={`/teacher/attendance?class=${klass.classId}`}><Button className="w-full">Take attendance</Button></NavLink>
                <NavLink to={`/teacher/classes/${klass.id}/analytics`}><Button variant="secondary" className="w-full">View analytics</Button></NavLink>
              </div>
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
  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Students"><SkeletonTable cols={6} /></TeacherWorkspaceShell>;
  if (!klass) return (
    <TeacherWorkspaceShell title="Class not found" eyebrow="Students">
      <EmptyState title="Class not found" description="This class assignment no longer exists or you are not assigned to it." />
    </TeacherWorkspaceShell>
  );
  return (
    <TeacherWorkspaceShell title={`${klass.className} · ${klass.subject}`} eyebrow="Students who take this subject">
      <WorkspaceTabs id={klass.id} classId={klass.classId} />
      <SearchPanel query={searchQuery} onChange={setSearchQuery} />
      <StudentsTable classSubjectId={klass.id} query={searchQuery} classSize={klass.classSize} />
    </TeacherWorkspaceShell>
  );
}

export function ClassAnalyticsPage() {
  const { loading, klass } = useClassSubject();
  const { data: an, isLoading, isError, refetch } = useClassAnalytics(klass?.id ?? '');

  if (loading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Class analytics"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (!klass) return (
    <TeacherWorkspaceShell title="Class not found" eyebrow="Class analytics">
      <EmptyState title="Class not found" description="This class assignment no longer exists or you are not assigned to it." />
    </TeacherWorkspaceShell>
  );
  const o = an?.overall;
  const hasData = (an?.assessments?.length ?? 0) > 0;
  return (
    <TeacherWorkspaceShell title={`${klass.className} · ${klass.subject}`} eyebrow="How the class is doing">
      <WorkspaceTabs id={klass.id} classId={klass.classId} />
      {isLoading ? <SkeletonCards count={4} cols="xl:grid-cols-4" /> : isError ? <DataError onRetry={refetch} /> : !hasData ? (
        <EmptyState title="No results yet" description="Analytics appear once you have entered marks for an assessment in this class." />
      ) : (
        <>
          <TeacherMetricStrip items={[
            { label: 'Class average', value: `${o?.average ?? 0}%`, detail: `Median ${o?.median ?? 0}%`, tone: 'bg-ks-blue', valueColor: (o?.average ?? 0) >= 60 ? 'text-ks-emerald' : 'text-ks-amber' },
            { label: 'Pass rate', value: `${o?.passRate ?? 0}%`, detail: `Pass mark ${an?.passMark ?? 40}%`, tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
            { label: 'At risk', value: String(o?.atRisk ?? 0), detail: 'Average below the pass mark', tone: 'bg-ks-rose', valueColor: (o?.atRisk ?? 0) > 0 ? 'text-ks-rose' : 'text-ks-emerald' },
            { label: 'Improving', value: String(o?.improving ?? 0), detail: 'Up 10+ points since last test', inverted: true, icon: ShieldCheck },
          ]} />
          <AnalyticsGrid analytics={an} />
        </>
      )}
    </TeacherWorkspaceShell>
  );
}

export function AssessmentListPage() {
  return (
    <TeacherWorkspaceShell title="Assessments & marks" eyebrow="Every assessment you are responsible for">
      <AssessmentMiniTable detailed />
    </TeacherWorkspaceShell>
  );
}

/** Fills the grid from the downloaded template (CSV / Excel). Nothing is saved until the teacher saves. */
function parseMarksFile(rows: Array<{ id: string; registration: string }>, grid: any[][]) {
  const hi = grid.findIndex((row) => row.some((c) => /^registration[_ ]?number$|^admno$|^adm\.? ?no$|^registration$/i.test(String(c).trim())));
  if (hi < 0) return { error: 'Could not find a "registration_number" column. Use the downloaded template.' as const };
  const head = grid[hi].map((c) => String(c).trim().toLowerCase().replace(/\s+/g, '_'));
  const col = (re: RegExp) => head.findIndex((h) => re.test(h));
  const ci = { reg: col(/^(registration_number|registration|admno|adm\.?_?no)$/), score: col(/^(score|marks?)$/), abs: col(/^(is_absent|absent)$/), ns: col(/^(not_sat|notsat)$/) };
  const yes = (v: unknown) => ['yes', 'y', 'true', '1', 'x'].includes(String(v ?? '').trim().toLowerCase());
  const byReg = new Map(rows.map((r) => [r.registration.toUpperCase(), r.id]));
  const out: Record<string, MarkEdit> = {};
  const unknown: string[] = [];
  for (const row of grid.slice(hi + 1)) {
    const reg = String(row[ci.reg] ?? '').trim();
    if (!reg) continue;
    const id = byReg.get(reg.toUpperCase());
    if (!id) { unknown.push(reg); continue; }
    const status = ci.ns >= 0 && yes(row[ci.ns]) ? 'NOT_SAT' : ci.abs >= 0 && yes(row[ci.abs]) ? 'ABSENT' : 'SCORED';
    out[id] = { status, score: status === 'SCORED' && ci.score >= 0 ? String(row[ci.score] ?? '').trim() : '' };
  }
  return { out, unknown };
}

export function MarksEntryPage() {
  const { loading, assessment } = useAssessment();
  const sheet = useMarksSheet(assessment?.id ?? '');
  const save = useSubmitMarksBulkMutation();
  const submit = useSubmitAssessmentMutation();
  const navigate = useNavigate();
  const rows: MarkRow[] = sheet.data?.rows ?? [];
  const [edits, setEdits] = useState<Record<string, MarkEdit>>({});
  const [dirty, setDirty] = useState(false);
  const [fileMsg, setFileMsg] = useState('');
  const seeded = useRef('');

  // Seed the grid once per assessment; re-fetches must never wipe what the teacher is typing.
  useEffect(() => {
    if (!assessment || !sheet.data || seeded.current === assessment.id) return;
    seeded.current = assessment.id;
    const next: Record<string, MarkEdit> = {};
    for (const r of sheet.data.rows) next[r.id] = { status: r.notSat ? 'NOT_SAT' : r.absent ? 'ABSENT' : 'SCORED', score: r.score === '' ? '' : String(r.score) };
    setEdits(next);
    setDirty(false);
  }, [assessment, sheet.data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (loading || (assessment && sheet.isLoading)) return <TeacherWorkspaceShell title="Loading…" eyebrow="Marks entry"><SkeletonTable cols={6} /></TeacherWorkspaceShell>;
  if (!assessment) return (
    <TeacherWorkspaceShell title="Assessment not found" eyebrow="Marks entry">
      <EmptyState title="Assessment not found" description="This assessment may not exist, or it is not one of your classes." />
    </TeacherWorkspaceShell>
  );
  // Exam-window assessments have their own screen (deadline, edit permission, template).
  if (assessment.examWindow) return <Navigate to={`/teacher/exams/marks/${assessment.id}`} replace />;

  const editable = ['OPEN', 'DRAFT', 'REJECTED'].includes(assessment.status);
  const prog = marksProgress(rows, edits, assessment.maxScore);
  const completion = prog.required > 0 ? Math.round((prog.complete / prog.required) * 100) : 100;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  const payload = (): Array<{ studentId: string; score?: number; isAbsent?: boolean; notSat?: boolean }> =>
    rows
      .filter((r) => !r.exempt)
      .flatMap((r): Array<{ studentId: string; score?: number; isAbsent?: boolean; notSat?: boolean }> => {
        const e = edits[r.id];
        if (!e) return [];
        if (e.status === 'ABSENT') return [{ studentId: r.id, isAbsent: true }];
        if (e.status === 'NOT_SAT') return [{ studentId: r.id, isAbsent: true, notSat: true }];
        if (e.score.trim() === '') return [];
        return [{ studentId: r.id, score: Number(e.score) }];
      });

  const persist = async (): Promise<boolean> => {
    if (prog.invalid > 0) { toast(`${prog.invalid} score${prog.invalid === 1 ? ' is' : 's are'} not valid. Scores must be between 0 and ${assessment.maxScore}.`, 'error'); return false; }
    const marks = payload();
    if (marks.length === 0) { toast('Nothing to save yet. Enter at least one score.', 'warning'); return false; }
    try {
      await save.mutateAsync({ id: assessment.id, marks });
      setDirty(false);
      return true;
    } catch (err) {
      toast(errorMessage(err, 'Could not save the marks. Please try again.'), 'error');
      return false;
    }
  };

  const onSave = async () => { if (await persist()) toast(`Saved ${payload().length} mark(s)`, 'success'); };
  const onSaveAndSubmit = async () => {
    if (prog.blank > 0) { toast(`${prog.blank} student${prog.blank === 1 ? ' still has' : 's still have'} no result. Enter a score, or choose Absent / Not sat.`, 'error'); return; }
    if (!(await persist())) return;
    try {
      await submit.mutateAsync(assessment.id);
      toast('Submitted. Your Head of Department will review these marks.', 'success');
      navigate('/teacher/assessments');
    } catch (err) {
      toast(errorMessage(err, 'Could not submit.'), 'error');
    }
  };

  const downloadTemplate = () => {
    const header = ['registration_number', 'student_name', 'score', 'is_absent', 'not_sat'];
    const lines = [header.join(',')].concat(rows.filter((r) => !r.exempt).map((r) => [r.registration, `"${r.name.replace(/"/g, '""')}"`, edits[r.id]?.status === 'SCORED' ? edits[r.id].score : '', edits[r.id]?.status === 'ABSENT' ? 'yes' : '', edits[r.id]?.status === 'NOT_SAT' ? 'yes' : ''].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${assessment.subject}-${assessment.className}-marks.csv`.replace(/\s+/g, '-');
    a.click(); URL.revokeObjectURL(url);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setFileMsg('');
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      const parsed = parseMarksFile(rows, grid);
      if ('error' in parsed) { setFileMsg(parsed.error ?? ''); return; }
      setEdits((cur) => ({ ...cur, ...parsed.out }));
      setDirty(true);
      setFileMsg(`Loaded ${Object.keys(parsed.out).length} row(s) from ${file.name}.${parsed.unknown.length ? ` ${parsed.unknown.length} registration number(s) are not in this class and were ignored.` : ''} Check the marks below, then save.`);
    } catch (e) {
      setFileMsg(`Could not read that file: ${errorMessage(e, 'unknown error')}`);
    }
  };

  const statusNote = assessment.status === 'SUBMITTED' ? 'Submitted: waiting for your Head of Department. Marks are locked while they review.'
    : assessment.status === 'HOD_APPROVED' || assessment.status === 'APPROVED' ? 'Approved. These marks are final.'
    : assessment.status === 'LOCKED' ? 'Locked. To change these marks ask your Head of Department or an administrator.'
    : '';

  return (
    <TeacherWorkspaceShell title={assessment.title} eyebrow={`${assessment.subject} · ${assessment.className}`} action={<AssessmentStatusBadge status={assessment.status} />}>
      <NavLink to="/teacher/assessments" className="inline-flex items-center gap-1 text-sm font-bold text-ks-blue">← All assessments</NavLink>
      {assessment.status === 'REJECTED' && (
        <Card className="rounded-xl border-l-4 border-l-ks-rose p-4">
          <p className="flex items-center gap-2 text-sm font-black text-ks-rose"><AlertTriangle className="h-4 w-4" /> Sent back for correction</p>
          <p className="mt-1 text-sm font-semibold text-ks-slate">{assessment.rejectionReason || 'Your Head of Department asked for changes. Fix the marks and submit again.'}</p>
        </Card>
      )}
      {statusNote && <Card className="rounded-xl border-l-4 border-l-ks-amber p-4 text-sm font-bold text-ks-slate">{statusNote}</Card>}
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden rounded-xl">
          <div className="sticky top-0 z-10 border-b border-ks-line bg-white/95 p-4 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wider text-ks-muted">Out of {assessment.maxScore} · {prog.required} student{prog.required === 1 ? '' : 's'}</p>
                <h2 className="font-display text-xl font-black text-ks-slate">Enter the marks</h2>
              </div>
              {editable && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={downloadTemplate}><Download className="h-4 w-4" /> Template</Button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ks-line bg-white px-4 py-2.5 text-sm font-bold text-ks-navy hover:bg-ks-paper">
                    <FileSpreadsheet className="h-4 w-4" /> Upload file
                    <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  <Button variant="secondary" onClick={onSave} loading={save.isPending}><Save className="h-4 w-4" /> Save{dirty ? ' •' : ''}</Button>
                  <Button onClick={onSaveAndSubmit} loading={submit.isPending}><Send className="h-4 w-4" /> Save & submit</Button>
                </div>
              )}
            </div>
            <ProgressBar value={completion} tone={completion === 100 ? 'bg-ks-emerald' : 'bg-ks-blue'} className="mt-3" />
            {editable && <p className="mt-2 text-xs font-semibold text-ks-muted">Type a score and press Enter to go to the next student. Use the Status column for Absent or Not sat (both count as 0).</p>}
            {fileMsg && <p className={`mt-2 text-xs font-bold ${fileMsg.startsWith('Could not') ? 'text-ks-rose' : 'text-ks-emerald'}`} role="status">{fileMsg}</p>}
          </div>
          {rows.length === 0 ? (
            <div className="p-6"><EmptyState title="No students" description="No students are enrolled for this subject in this class." /></div>
          ) : (
            <MarksGrid rows={rows} edits={edits} maxScore={assessment.maxScore} readOnly={!editable} onChange={(id, next) => { setEdits((cur) => ({ ...cur, [id]: next })); setDirty(true); }} />
          )}
        </Card>
        <div className="space-y-gutter xl:sticky xl:top-24 xl:h-fit">
          <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-blue p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Progress</p>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative">
                <svg width="140" height="140" className="-rotate-90" role="img" aria-label={`${completion}% complete`}>
                  <circle cx="70" cy="70" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
                  <circle cx="70" cy="70" r={radius} fill="none" stroke={completion === 100 ? '#10B981' : '#0284C7'} strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - (completion / 100) * circumference} className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="font-display text-3xl font-black text-ks-slate">{completion}%</p>
                  <p className="text-[11px] font-bold text-ks-muted">{prog.complete}/{prog.required} done</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[
                { label: prog.blank ? `${prog.blank} student${prog.blank === 1 ? '' : 's'} without a result` : 'Every student has a result', ok: prog.blank === 0 },
                { label: prog.invalid ? `${prog.invalid} invalid score${prog.invalid === 1 ? '' : 's'}` : 'All scores are valid', ok: prog.invalid === 0 },
                { label: dirty ? 'You have unsaved changes' : 'Everything is saved', ok: !dirty },
                ...(prog.exempt ? [{ label: `${prog.exempt} exempt (no mark needed)`, ok: true }] : []),
              ].map((item) => (
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
  const sheet = useMarksSheet(assessment?.id ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const submitMutation = useSubmitAssessmentMutation();

  if (loading || (assessment && sheet.isLoading)) return <TeacherWorkspaceShell title="Loading…" eyebrow="Submit marks"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (!assessment) return (
    <TeacherWorkspaceShell title="Assessment not found" eyebrow="Submit marks">
      <EmptyState title="Assessment not found" description="This assessment may not exist, or it is not one of your classes." />
    </TeacherWorkspaceShell>
  );
  if (assessment.examWindow) return <Navigate to={`/teacher/exams/marks/${assessment.id}`} replace />;

  const rows = sheet.data?.rows ?? [];
  const edits: Record<string, MarkEdit> = {};
  for (const r of rows) edits[r.id] = { status: r.notSat ? 'NOT_SAT' : r.absent ? 'ABSENT' : 'SCORED', score: r.score === '' ? '' : String(r.score) };
  const prog = marksProgress(rows, edits, assessment.maxScore);
  const submittable = ['OPEN', 'DRAFT', 'REJECTED'].includes(assessment.status);
  const ready = submittable && prog.blank === 0 && prog.invalid === 0 && rows.length > 0;

  const checklist = [
    { label: 'Every student has a saved result', done: prog.blank === 0 && rows.length > 0 },
    { label: 'No scores outside 0–' + assessment.maxScore, done: prog.invalid === 0 },
    { label: 'Absent and not-sat students are marked', done: true },
    { label: 'I confirm these marks are accurate', done: confirmed },
  ];

  const handleSubmit = () => {
    submitMutation.mutate(assessment.id, {
      onSuccess: () => { toast('Submitted. Your Head of Department will review these marks.', 'success'); navigate('/teacher/assessments'); },
      onError: (err) => toast(errorMessage(err, 'Could not submit.'), 'error'),
    });
  };
  return (
    <TeacherWorkspaceShell title="Submit for approval" eyebrow={`${assessment.title} · ${assessment.className}`}>
      <NavLink to={`/teacher/assessments/${assessment.id}/marks`} className="inline-flex items-center gap-1 text-sm font-bold text-ks-blue">← Back to the marks</NavLink>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="rounded-xl p-5">
          <SectionTitle title="Before you submit" />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {checklist.map((item) => (
              <div key={item.label} className={`flex items-center gap-3 rounded-xl border p-4 transition ${item.done ? 'border-ks-emerald/30 bg-ks-emerald/5' : 'border-ks-line bg-ks-paper'}`}>
                <CheckCircle2 className={`h-5 w-5 shrink-0 ${item.done ? 'text-ks-emerald' : 'text-ks-muted/40'}`} />
                <span className="text-sm font-bold text-ks-slate">{item.label}</span>
              </div>
            ))}
          </div>
          <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-xl border border-ks-blue/20 bg-ks-blue/5 p-4">
            <input className="h-4 w-4 rounded border-ks-line text-ks-blue focus:ring-ks-blue" type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span className="text-sm font-bold text-ks-slate">I confirm these marks are accurate and ready for review.</span>
          </label>
        </Card>
        <Card className="sticky top-24 h-fit overflow-hidden rounded-xl border-l-4 border-l-ks-emerald p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Status</p>
          <h3 className={`mt-2 font-display text-2xl font-black ${ready && confirmed ? 'text-ks-emerald' : 'text-ks-slate'}`}>
            {!submittable ? 'Already submitted' : ready && confirmed ? 'Ready to submit' : ready ? 'Tick the confirmation' : 'Finish the marks first'}
          </h3>
          <p className="mt-2 text-sm font-semibold text-ks-muted">
            {!submittable ? 'These marks are with your Head of Department or already approved.' : ready ? 'Your Head of Department will review and approve these marks.' : 'Every student needs a score, Absent or Not sat before you can submit.'}
          </p>
          <Button disabled={!confirmed || !ready || submitMutation.isPending} className="mt-5 w-full" onClick={handleSubmit}>
            <Send className="h-4 w-4" /> {submitMutation.isPending ? 'Submitting…' : 'Submit for approval'}
          </Button>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function MarksReviewPage() {
  const { loading, assessment } = useAssessment();
  const sheet = useMarksSheet(assessment?.id ?? '');

  if (loading || (assessment && sheet.isLoading)) return <TeacherWorkspaceShell title="Loading…" eyebrow="Marks review"><SkeletonTable cols={6} /></TeacherWorkspaceShell>;
  if (!assessment) return (
    <TeacherWorkspaceShell title="Assessment not found" eyebrow="Marks review">
      <EmptyState title="Assessment not found" description="This assessment may not exist, or it is not one of your classes." />
    </TeacherWorkspaceShell>
  );
  const rows = sheet.data?.rows ?? [];
  const edits: Record<string, MarkEdit> = {};
  for (const r of rows) edits[r.id] = { status: r.notSat ? 'NOT_SAT' : r.absent ? 'ABSENT' : 'SCORED', score: r.score === '' ? '' : String(r.score) };
  const st = assessment.status;
  const step = st === 'SUBMITTED' ? 2 : st === 'HOD_APPROVED' || st === 'APPROVED' ? 3 : st === 'LOCKED' ? 4 : 1;
  const steps = ['Marks entered', 'Waiting for your Head of Department', 'Approved', 'Locked for reports'];
  return (
    <TeacherWorkspaceShell title={assessment.title} eyebrow={`${assessment.subject} · ${assessment.className}`} action={<AssessmentStatusBadge status={assessment.status} />}>
      <NavLink to="/teacher/assessments" className="inline-flex items-center gap-1 text-sm font-bold text-ks-blue">← All assessments</NavLink>
      <Card className="rounded-xl p-5">
        <SectionTitle title="Where these marks are" />
        <div className="relative mt-5 grid gap-3 md:grid-cols-4">
          <div className="absolute left-0 right-0 top-5 hidden h-0.5 bg-ks-line md:block" />
          {steps.map((item, index) => <TimelineStep key={item} label={item} active={index + 1 <= step} step={index + 1} />)}
        </div>
        {st === 'REJECTED' && <p className="mt-4 rounded-lg bg-ks-rose/5 p-3 text-sm font-bold text-ks-rose">Sent back: {assessment.rejectionReason || 'changes requested'}. <NavLink to={`/teacher/assessments/${assessment.id}/marks`} className="underline">Fix the marks</NavLink></p>}
      </Card>
      <MarksGrid rows={rows} edits={edits} maxScore={assessment.maxScore} readOnly />
    </TeacherWorkspaceShell>
  );
}

export function AttendancePage() {
  const { data: allRegisters = [], isLoading: registersLoading } = useTeacherRegisters();
  const { visible, multi, nameOf } = useTeacherSchools();
  const registers = visible(allRegisters);
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(params.get('class') ?? '');
  const classId = registers.some((r) => r.classId === selected) ? selected : (registers.find((r) => r.isClassTeacher) ?? registers[0])?.classId ?? '';
  const { data: registerStudents, isLoading: studentsLoading, isError, refetch } = useRegisterStudents(classId);
  const students = registerStudents ?? NO_STUDENTS;
  const attendance = useMarkAttendanceMutation();
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<{ at: string; present: number; absent: number; late: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const current = registers.find((r) => r.classId === classId);

  // Load today's register into the grid (a register taken earlier today reopens as it was).
  // Keyed on what was actually taken, not on array identity, so unrelated re-renders never reset the grid.
  const takenKey = students.map((st) => `${st.id}:${st.todayStatus ?? ''}`).join('|');
  useEffect(() => {
    const next: Record<string, string> = {};
    let any = false;
    for (const st of students) { if (st.todayStatus) { next[st.id] = st.todayStatus; any = true; } }
    setStatuses(next);
    setTouched(false);
    setSaved(any ? { at: 'earlier today', present: Object.values(next).filter((v) => v === 'PRESENT').length, absent: Object.values(next).filter((v) => v === 'ABSENT').length, late: Object.values(next).filter((v) => v === 'LATE').length } : null);
  }, [classId, takenKey]);

  const choose = (id: string) => { setSelected(id); setParams(id ? { class: id } : {}, { replace: true }); };
  const counts = (status: string) => students.filter((st) => statuses[st.id] === status).length;
  const present = counts('PRESENT'), absent = counts('ABSENT'), late = counts('LATE'), excused = counts('EXCUSED');
  const unmarked = students.filter((st) => !statuses[st.id]).length;
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  const markAllPresent = () => {
    setStatuses((cur) => { const next = { ...cur }; for (const st of students) if (!next[st.id]) next[st.id] = 'PRESENT'; return next; });
    setTouched(true);
  };
  const handleSubmit = () => {
    if (unmarked > 0) { toast(`${unmarked} student${unmarked === 1 ? ' is' : 's are'} not marked yet. Mark everyone, or press "Mark rest present".`, 'warning'); return; }
    attendance.mutate(
      { classId, date: new Date().toISOString().slice(0, 10), records: students.map((st) => ({ studentId: st.id, status: statuses[st.id] })) },
      {
        onSuccess: () => { setSaved({ at: 'just now', present, absent, late }); setTouched(false); toast('Attendance saved', 'success'); },
        onError: (err) => toast(errorMessage(err, 'Could not save attendance. Please try again.'), 'error'),
      },
    );
  };

  const grouped = multi ? groupBySchool(registers) : [{ schoolId: '', rows: registers }];
  return (
    <TeacherWorkspaceShell title="Class register" eyebrow={today}>
      {registersLoading ? <SkeletonTable cols={5} /> : registers.length === 0 ? (
        <EmptyState title="No classes to take attendance for" description="You will see your classes here once you are assigned to teach, or made class teacher of, a class." />
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
            <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Class</span>
            <select value={classId} onChange={(e) => choose(e.target.value)} aria-label="Choose class" className="h-10 min-w-64 rounded-lg border border-ks-line bg-white px-3 text-sm font-black text-ks-navy">
              {grouped.map((g) => (
                <optgroup key={g.schoolId || 'x'} label={multi ? (nameOf(g.schoolId) || 'School') : 'My classes'}>
                  {g.rows.map((r) => <option key={r.classId} value={r.classId}>{r.label}{r.isClassTeacher ? ' · my class' : ''} ({r.studentCount})</option>)}
                </optgroup>
              ))}
            </select>
            {current && <SchoolBadge schoolId={current.schoolId} />}
            <NavLink to="/teacher/attendance/history" className="ml-auto text-sm font-black text-ks-blue hover:underline">Past registers →</NavLink>
          </Card>
          {isError ? <DataError onRetry={refetch} /> : (
            <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
              {studentsLoading ? <SkeletonTable cols={6} /> : <div className="space-y-2"><p className="text-xs font-bold text-ks-muted"><b>P</b> present · <b>A</b> absent · <b>L</b> late · <b>E</b> excused. Tap a letter again to clear it.</p><AttendanceGrid students={students} statuses={statuses} onStatusChange={(id, status) => { setStatuses((cur) => ({ ...cur, [id]: status })); setTouched(true); }} /></div>}
              <div className="space-y-gutter xl:sticky xl:top-24 xl:h-fit">
                <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-emerald p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Today's register</p>
                  <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">{current?.label ?? '—'}</h3>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <AttendanceStat label="Present" value={String(present)} color="text-ks-emerald" bg="bg-ks-emerald/10" />
                    <AttendanceStat label="Absent" value={String(absent)} color="text-ks-rose" bg="bg-ks-rose/10" />
                    <AttendanceStat label="Late" value={String(late)} color="text-ks-amber" bg="bg-ks-amber/10" />
                    <AttendanceStat label="Not marked" value={String(unmarked)} color="text-ks-muted" bg="bg-ks-paper" />
                  </div>
                  {excused > 0 && <p className="mt-2 text-xs font-semibold text-ks-muted">{excused} excused</p>}
                  {students.length > 0 && (
                    <div className="mt-4">
                      <ProgressBar value={((students.length - unmarked) / students.length) * 100} tone="bg-ks-emerald" />
                      <p className="mt-1 text-center text-xs font-bold text-ks-muted">{students.length - unmarked} of {students.length} marked</p>
                    </div>
                  )}
                  <div className="mt-4 grid gap-2">
                    <Button variant="secondary" onClick={markAllPresent} disabled={unmarked === 0}>Mark rest present</Button>
                    <Button onClick={handleSubmit} loading={attendance.isPending} disabled={students.length === 0 || (!touched && !!saved)}>
                      {saved && !touched ? 'Saved' : 'Save register'}
                    </Button>
                  </div>
                  {saved && !touched && (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-ks-emerald/10 p-3 text-sm font-bold text-ks-emerald">
                      <CheckCircle2 className="h-4 w-4" /> Saved {saved.at}: {saved.present} present, {saved.absent} absent{saved.late ? `, ${saved.late} late` : ''}
                    </div>
                  )}
                  {touched && saved && <p className="mt-3 text-center text-xs font-bold text-ks-amber">You changed today's register. Save to update it.</p>}
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </TeacherWorkspaceShell>
  );
}

export function AttendanceHistoryPage() {
  const { data: records = [], isLoading, isError, refetch } = useAttendanceList();
  const { data: allRegisters = [] } = useTeacherRegisters();
  const { visible } = useTeacherSchools();
  const registers = visible(allRegisters);
  const [classFilter, setClassFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const mine = new Map(registers.map((r) => [r.classId, r]));

  // Only the teacher's own classes, grouped into one line per class per day.
  const sessions = useMemo(() => {
    const map = new Map<string, { key: string; classId: string; date: string; present: number; absent: number; late: number; excused: number; total: number }>();
    for (const r of records as Row[]) {
      if (!mine.has(r.classId)) continue;
      if (classFilter && r.classId !== classFilter) continue;
      const date = String(r.date).slice(0, 10);
      const key = `${date}|${r.classId}`;
      const cur = map.get(key) ?? { key, classId: r.classId, date, present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      cur.total += 1;
      if (r.status === 'PRESENT') cur.present += 1; else if (r.status === 'ABSENT') cur.absent += 1; else if (r.status === 'LATE') cur.late += 1; else if (r.status === 'EXCUSED') cur.excused += 1;
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [records, registers, classFilter]);

  return (
    <TeacherWorkspaceShell title="Past registers" eyebrow="Attendance you can look back on" action={<NavLink to="/teacher/attendance"><Button className="bg-ks-gold text-ks-slate">Take today's register</Button></NavLink>}>
      <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
        <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Class</span>
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} aria-label="Filter by class" className="h-10 rounded-lg border border-ks-line bg-white px-3 text-sm font-bold text-ks-navy">
          <option value="">All my classes</option>
          {registers.map((r) => <option key={r.classId} value={r.classId}>{r.label}</option>)}
        </select>
      </Card>
      {isLoading ? <SkeletonTable cols={6} /> : isError ? <DataError onRetry={refetch} /> : sessions.length === 0 ? (
        <EmptyState title="No registers yet" description="Registers you take appear here, one line per class per day." />
      ) : (
        <TeacherTable columns={['Date', 'Class', 'Present', 'Absent', 'Late', 'Rate', '']}>
          {sessions.map((sn) => {
            const reg = mine.get(sn.classId);
            const rate = sn.total ? Math.round(((sn.present + sn.late) / sn.total) * 100) : 0;
            return (
              <React.Fragment key={sn.key}>
                <tr className="hover:bg-ks-paper">
                  <Td>{new Date(sn.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Td>
                  <Td><span className="inline-flex items-center gap-2">{reg?.label ?? 'Class'}<SchoolBadge schoolId={reg?.schoolId} /></span></Td>
                  <Td><span className="font-black text-ks-emerald">{sn.present}</span></Td>
                  <Td><span className="font-black text-ks-rose">{sn.absent}</span></Td>
                  <Td>{sn.late}</Td>
                  <Td>{rate}%</Td>
                  <Td><button type="button" onClick={() => setOpen(open === sn.key ? null : sn.key)} className="font-black text-ks-blue hover:underline">{open === sn.key ? 'Hide' : 'Students'}</button></Td>
                </tr>
                {open === sn.key && (
                  <tr className="bg-ks-paper/60"><td colSpan={7} className="px-4 py-3"><SessionStudents classId={sn.classId} records={(records as Row[]).filter((r) => r.classId === sn.classId && String(r.date).slice(0, 10) === sn.date)} /></td></tr>
                )}
              </React.Fragment>
            );
          })}
        </TeacherTable>
      )}
    </TeacherWorkspaceShell>
  );
}

function SessionStudents({ classId, records }: { classId: string; records: Row[] }) {
  const { data: roster = [] } = useRegisterStudents(classId);
  const nameOf = new Map(roster.map((st) => [st.id, st.name]));
  return (
    <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-2 border-b border-ks-line/60 py-1">
          <span className="truncate font-semibold text-ks-slate">{nameOf.get(r.studentId) ?? 'Student'}</span>
          <Badge tone={r.status === 'PRESENT' ? 'emerald' : r.status === 'LATE' ? 'amber' : r.status === 'EXCUSED' ? 'blue' : 'rose'}>{r.status.toLowerCase()}</Badge>
        </div>
      ))}
    </div>
  );
}

export function PerformanceAlertsPage() {
  const { data: allClasses = [], isLoading: classesLoading } = useTeacherClasses();
  const { visible, multi } = useTeacherSchools();
  const classes = visible(allClasses);
  const classIds = classesLoading ? undefined : [...new Set(classes.map((c) => c.classId).filter(Boolean))];
  const { data: rawPairings = [] } = usePerfPairings(classIds);
  const classLabelOf = new Map(classes.map((c) => [c.classId, c.className]));
  const pairings = rawPairings.map((pr) => ({ ...pr, className: pr.className || classLabelOf.get(pr.classId ?? '') || '' }));
  const { data: alerts = [] } = usePerformanceAlerts();
  const mine = visible(alerts as unknown as Alert[]);
  const critical = mine.filter((a) => a.severity === 'CRITICAL').length;
  const atRisk = mine.filter((a) => a.severity === 'AT_RISK').length;
  const suggested = pairings.filter((p) => p.status === 'SUGGESTED').length;
  const noClasses = !classesLoading && classIds?.length === 0;
  return (
    <TeacherWorkspaceShell title="Student support" eyebrow="Who needs help, and what you are doing about it">
      <TeacherMetricStrip items={[
        { label: 'Critical', value: String(critical), detail: 'Needs action now', tone: 'bg-ks-rose', valueColor: critical > 0 ? 'text-ks-rose' : 'text-ks-emerald' },
        { label: 'At risk', value: String(atRisk), detail: 'Results are slipping', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Peer pairings', value: String(suggested), detail: 'Suggested, awaiting you', tone: 'bg-ks-sky', valueColor: 'text-ks-sky' },
        { label: 'Flagged students', value: String(mine.length), detail: multi ? 'Across your schools' : 'This term', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid grid-cols-12 gap-gutter">
        <section className="col-span-12 space-y-stack-lg xl:col-span-8">
          <AlertsOperationalTable alerts={mine} />
          <PredictionPanel criticalCount={critical} suggestedPairings={suggested} />
          <MyInterventions />
        </section>
        <section className="col-span-12 space-y-stack-lg xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black text-ks-navy">Peer pairings</h2>
            <span className="rounded-full bg-ks-sky px-2.5 py-1 text-[10px] font-black text-white">{suggested} SUGGESTED</span>
          </div>
          {noClasses ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No classes assigned yet. Pairings will appear once you are assigned to a class.</p>
          ) : !pairings.some((pr) => pr.status === 'SUGGESTED' || pr.status === 'ACTIVE') ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No open pairings. Pair a strong student with one who needs help.</p>
          ) : (
            pairings.filter((p) => p.status === 'SUGGESTED' || p.status === 'ACTIVE').slice(0, 6).map((pairing) => (
              <NavLink key={pairing.id} to={`/teacher/performance/pairings/${pairing.id}`} className="block">
                <PairingCard pairing={pairing} />
              </NavLink>
            ))
          )}
          <NavLink to="/teacher/performance/pairings/create"><Button variant="secondary" className="w-full"><UserPlus className="h-4 w-4" /> Pair two students</Button></NavLink>
          <AcademicSpotlight alerts={mine} />
        </section>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function AlertDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: alerts = [], isLoading } = usePerformanceAlerts();
  const resolve = useResolveAlertMutation();
  const [note, setNote] = useState('');
  if (isLoading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Student alert"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  const alert = (alerts as Row[]).find((item) => item.id === id) ?? null;
  if (!alert) return (
    <TeacherWorkspaceShell title="Alert not found" eyebrow="Student alert">
      <EmptyState title="Alert not found" description="This alert may already have been resolved, or the link is no longer valid." />
      <NavLink to="/teacher/performance/alerts" className="inline-block text-sm font-black text-ks-blue hover:underline">← Back to student support</NavLink>
    </TeacherWorkspaceShell>
  );
  const onResolve = () => {
    resolve.mutate({ id: String(id), note }, {
      onSuccess: () => { toast('Alert resolved', 'success'); navigate('/teacher/performance/alerts'); },
      onError: (err) => toast(errorMessage(err, 'Could not resolve the alert.'), 'error'),
    });
  };
  return (
    <TeacherWorkspaceShell title={alert.student} eyebrow={String(alert.type).replaceAll('_', ' ').toLowerCase()}>
      <NavLink to="/teacher/performance/alerts" className="inline-flex items-center gap-1 text-sm font-bold text-ks-blue">← Student support</NavLink>
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="space-y-gutter">
          <AlertStaffCard alert={alert as Alert} hideActions />
          <TeacherMetricStrip items={[
            { label: 'Current score', value: `${Math.round(Number(alert.score))}%`, detail: alert.subject || 'Subject', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
            { label: 'Threshold', value: alert.thresholdValue != null ? `${Math.round(Number(alert.thresholdValue))}%` : '—', detail: 'What triggered this alert', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
            { label: 'Raised', value: alert.createdAt ? new Date(alert.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '—', detail: 'By the performance engine', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
            { label: 'Registration', value: String(alert.student && (alert.registration || '—')), detail: 'Student number', inverted: true, icon: ShieldCheck },
          ]} />
        </div>
        <Card className="sticky top-24 h-fit rounded-xl border-l-4 border-l-ks-blue p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">What would you like to do?</p>
          <div className="mt-4 space-y-2">
            <NavLink to={`/teacher/interventions/create?student=${alert.studentId}&alert=${alert.id}`} className="block"><Button className="w-full justify-between">Plan support <ArrowRight className="h-4 w-4" /></Button></NavLink>
            <NavLink to={`/teacher/students/${alert.studentId}/performance`} className="block"><Button variant="secondary" className="w-full justify-between">See the student's profile <ArrowRight className="h-4 w-4" /></Button></NavLink>
          </div>
          <div className="mt-5 border-t border-ks-line pt-4">
            <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted" htmlFor="resolve-note">Close this alert</label>
            <textarea id="resolve-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done? (optional)" className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 text-sm font-semibold outline-none focus:border-ks-blue" />
            <Button variant="success" className="mt-2 w-full" onClick={onResolve} loading={resolve.isPending}>Mark as resolved</Button>
          </div>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function PeerPairingsPage() {
  const { data: allClasses = [], isLoading: classesLoading } = useTeacherClasses();
  const { visible } = useTeacherSchools();
  const classes = visible(allClasses);
  const classIds = classesLoading ? undefined : [...new Set(classes.map((c) => c.classId).filter(Boolean))];
  const { data: rawPairings = [] } = usePerfPairings(classIds);
  const { data: alerts = [] } = usePerformanceAlerts();
  const [view, setView] = useState<'open' | 'done' | 'old'>('open');
  const classLabel = new Map(classes.map((c) => [c.classId, c.className]));
  const pairings = rawPairings.map((p) => ({ ...p, className: p.className || classLabel.get(p.classId ?? '') || '' }));
  const noClasses = !classesLoading && classIds?.length === 0;
  const count = (st: string) => pairings.filter((p) => p.status === st).length;
  const shown = pairings.filter((p) => (view === 'open' ? p.status === 'SUGGESTED' || p.status === 'ACTIVE' : view === 'done' ? p.status === 'COMPLETED' : p.status === 'EXPIRED' || p.status === 'REJECTED'));
  const chips: Array<[typeof view, string, number]> = [['open', 'Open', count('SUGGESTED') + count('ACTIVE')], ['done', 'Completed', count('COMPLETED')], ['old', 'Expired or declined', count('EXPIRED') + count('REJECTED')]];
  return (
    <TeacherWorkspaceShell title="Peer pairings" eyebrow="Strong students helping classmates" action={<NavLink to="/teacher/performance/pairings/create"><Button className="bg-ks-gold text-ks-slate"><UserPlus className="h-4 w-4" /> New pairing</Button></NavLink>}>
      <TeacherMetricStrip items={[
        { label: 'Suggested', value: String(count('SUGGESTED')), detail: 'Waiting for you', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Active', value: String(count('ACTIVE')), detail: 'Running now', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Completed', value: String(count('COMPLETED')), detail: 'Finished', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'All pairings', value: String(pairings.length), detail: 'Every status', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="flex flex-wrap gap-2">
        {chips.map(([key, label, n]) => (
          <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${view === key ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line bg-white text-ks-muted hover:border-ks-blue hover:text-ks-blue'}`}>
            {label} <span className="opacity-70">{n}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-gutter md:grid-cols-2">
          {noClasses ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">No classes assigned yet. Pairings will appear once you are assigned to a class.</p>
          ) : shown.length === 0 ? (
            <p className="py-4 text-sm font-semibold text-ks-muted">{view === 'open' ? 'No open pairings. Use New pairing to match a strong student with a classmate who needs help.' : 'Nothing here.'}</p>
          ) : (
            shown.map((pairing) => (
              <NavLink key={pairing.id} to={`/teacher/performance/pairings/${pairing.id}`}>
                <PairingCard pairing={pairing} />
              </NavLink>
            ))
          )}
        </div>
        <AcademicSpotlight alerts={visible(alerts as unknown as Alert[])} />
      </div>
    </TeacherWorkspaceShell>
  );
}

export function PairingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: classes = [], isLoading: classesLoading } = useTeacherClasses();
  const classIds = classesLoading ? undefined : [...new Set(classes.map((c) => c.classId).filter(Boolean))];
  const { data: pairings = [], isLoading } = usePerfPairings(classIds);
  const statusMutation = useUpdatePairingStatusMutation();
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (classesLoading || isLoading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Pairing"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  const pairing = pairings.find((item) => item.id === id) ?? null;
  if (!pairing) return (
    <TeacherWorkspaceShell title="Pairing not found" eyebrow="Pairing">
      <EmptyState title="Pairing not found" description="This pairing may no longer be active, or it is not in one of your classes." />
      <NavLink to="/teacher/performance/pairings" className="inline-block text-sm font-black text-ks-blue hover:underline">← All pairings</NavLink>
    </TeacherWorkspaceShell>
  );

  const status = String(pairing.status ?? 'SUGGESTED').toUpperCase();
  const handleStatus = (newStatus: string, reason?: string) => {
    statusMutation.mutate(
      { id: pairing.id, status: newStatus, rejectionReason: reason },
      {
        onSuccess: () => {
          toast(newStatus === 'ACTIVE' ? 'Pairing activated' : newStatus === 'COMPLETED' ? 'Pairing marked as completed' : 'Pairing declined', 'success');
          setShowRejectForm(false);
          if (newStatus === 'REJECTED') navigate('/teacher/performance/pairings');
        },
        onError: (err) => toast(errorMessage(err, 'Could not update the pairing.'), 'error'),
      },
    );
  };
  const busy = statusMutation.isPending;
  return (
    <TeacherWorkspaceShell title={`${pairing.mentor} + ${pairing.support}`} eyebrow="Peer pairing">
      <NavLink to="/teacher/performance/pairings" className="inline-flex items-center gap-1 text-sm font-bold text-ks-blue">← All pairings</NavLink>
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="space-y-gutter">
          <PairingCard pairing={pairing} />
          {(pairing.mentorScore != null || pairing.supportScore != null) && (
            <TeacherMetricStrip items={[
              { label: 'Mentor score', value: pairing.mentorScore != null ? `${Math.round(pairing.mentorScore)}%` : '—', detail: pairing.mentor, tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
              { label: 'Student score', value: pairing.supportScore != null ? `${Math.round(pairing.supportScore)}%` : '—', detail: pairing.support, tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
              { label: 'Gap', value: pairing.mentorScore != null && pairing.supportScore != null ? `${Math.round(pairing.mentorScore - pairing.supportScore)} pts` : '—', detail: 'The mentor can close', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
              { label: 'Subject', value: pairing.subject || '—', detail: pairing.className || 'Class', inverted: true, icon: ShieldCheck },
            ]} />
          )}
        </div>
        <Card className="rounded-xl p-5">
          <SectionTitle title="What now?" />
          <div className="mt-4 space-y-2">
            {status === 'SUGGESTED' && (
              <>
                <Button className="w-full" loading={busy} onClick={() => handleStatus('ACTIVE')}>Activate this pairing</Button>
                <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setShowRejectForm((v) => !v)}>Decline</Button>
                {showRejectForm && (
                  <div className="mt-2 space-y-2">
                    <textarea rows={3} placeholder="Why are you declining?" aria-label="Reason for declining" value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="w-full rounded-xl border border-ks-line px-3 py-2 text-sm outline-none focus:border-ks-blue" />
                    <Button variant="danger" className="w-full" disabled={busy || !rejectionReason.trim()} onClick={() => handleStatus('REJECTED', rejectionReason)}>Confirm decline</Button>
                  </div>
                )}
              </>
            )}
            {status === 'ACTIVE' && <Button variant="success" className="w-full" loading={busy} onClick={() => handleStatus('COMPLETED')}>Mark as completed</Button>}
            {!['SUGGESTED', 'ACTIVE'].includes(status) && <p className="text-center text-sm text-ks-muted">This pairing is {status.toLowerCase()}.</p>}
          </div>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function StudentPerformancePage() {
  const { studentId } = useParams();
  const { data: perf, isLoading, isError } = useStudentPerformance(studentId ?? '');
  const { data: who } = useStudentBasic(studentId ?? '');
  const p = perf as { trends?: Row[]; alerts?: Row[]; pairings?: Row[] } | undefined;

  if (isLoading) return <TeacherWorkspaceShell title="Loading…" eyebrow="Student profile"><SkeletonTable cols={4} /></TeacherWorkspaceShell>;
  if (isError || !p) return (
    <TeacherWorkspaceShell title="Student not found" eyebrow="Student profile">
      <EmptyState title="Student not found" description="This student record does not exist or is no longer accessible." />
    </TeacherWorkspaceShell>
  );
  const trends = p.trends ?? [];
  const alerts = (p.alerts ?? []).filter((a) => !a.isResolved);
  const avg = trends.length ? trends.reduce((t, x) => t + Number(x.currentScore ?? 0), 0) / trends.length : 0;
  const tone = (n: number) => (n >= 60 ? 'text-ks-emerald' : n >= 40 ? 'text-ks-amber' : 'text-ks-rose');
  const dir = (d: string) => (d === 'IMPROVING' ? { t: 'Improving', c: 'emerald' as const } : d === 'DECLINING' ? { t: 'Declining', c: 'rose' as const } : { t: 'Steady', c: 'slate' as const });
  return (
    <TeacherWorkspaceShell title={who?.name || 'Student'} eyebrow={who?.registration ? `Student profile · ${who.registration}` : 'Student profile'}>
      <TeacherMetricStrip items={[
        { label: 'Current average', value: trends.length ? `${Math.round(avg)}%` : '—', detail: `Across ${trends.length} subject${trends.length === 1 ? '' : 's'}`, tone: 'bg-ks-blue', valueColor: tone(avg) },
        { label: 'Open alerts', value: String(alerts.length), detail: alerts.length ? 'Needs support' : 'None', tone: 'bg-ks-rose', valueColor: alerts.length ? 'text-ks-rose' : 'text-ks-emerald' },
        { label: 'Pairings', value: String((p.pairings ?? []).length), detail: 'Peer support', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Support plan', value: 'Plan', detail: 'Record what you will do', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="flex flex-wrap gap-2">
        <NavLink to={`/teacher/interventions/create?student=${studentId}`}><Button><MessageSquarePlus className="h-4 w-4" /> Plan support for this student</Button></NavLink>
      </div>
      <Card className="rounded-xl p-5">
        <SectionTitle title="Subject by subject" />
        {trends.length === 0 ? <p className="mt-3 text-sm font-semibold text-ks-muted">No results have been analysed for this student yet.</p> : (
          <div className="mt-4 space-y-3">
            {trends.map((t) => (
              <div key={String(t.id)}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-ks-slate">{t.subjectName}</span>
                  <span className="flex items-center gap-2 text-xs font-semibold text-ks-muted">now <b className={tone(Number(t.currentScore))}>{Math.round(Number(t.currentScore))}%</b>{t.previousScore != null ? ` · before ${Math.round(Number(t.previousScore))}%` : ''}<Badge tone={dir(String(t.trendDirection)).c}>{dir(String(t.trendDirection)).t}</Badge></span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-ks-line"><div className={`h-full rounded-full ${Number(t.currentScore) >= 60 ? 'bg-ks-emerald' : Number(t.currentScore) >= 40 ? 'bg-ks-amber' : 'bg-ks-rose'}`} style={{ width: `${Math.min(Number(t.currentScore), 100)}%` }} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {alerts.map((a) => <AlertStaffCard key={String(a.id)} alert={{ id: String(a.id), studentId: String(studentId), student: who?.name || 'Student', className: '', subject: String(a.subjectName ?? ''), type: String(a.alertType ?? ''), severity: String(a.severity).toUpperCase() === 'CRITICAL' ? 'CRITICAL' : 'AT_RISK', reason: String(a.message ?? ''), action: 'Review' }} />)}
        </div>
      )}
    </TeacherWorkspaceShell>
  );
}

export function TimetablePage() {
  const { data: timetable = [], isLoading, isError, refetch } = useTeacherTimetable();
  const { visible } = useTeacherSchools();
  return (
    <TeacherWorkspaceShell title="My timetable" eyebrow="Your teaching week">
      {isLoading ? <SkeletonTable cols={6} /> : isError ? <DataError onRetry={refetch} /> : <TimetableBoard entries={visible(timetable)} />}
    </TeacherWorkspaceShell>
  );
}

export function SyllabusPage() {
  const { data: allClasses = [], isLoading, isError, refetch } = useTeacherClasses();
  const { data: currentTerm } = useCurrentTerm() as { data: { id: string } | null | undefined };
  const { visible, multi } = useTeacherSchools();
  const classes = visible(allClasses);
  const updateMutation = useUpdateSyllabusMutation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<{ covered: string; total: string; notes: string }>({ covered: '', total: '', notes: '' });

  const openEdit = (k: ClassSubject) => {
    setValues({ covered: String(k.syllabusCovered), total: String(k.syllabusTotal || 20), notes: k.syllabusNotes });
    setEditingId(k.id);
  };
  const handleSave = (k: ClassSubject) => {
    const covered = Math.max(0, Math.round(Number(values.covered) || 0));
    const total = Math.max(1, Math.round(Number(values.total) || 0));
    if (covered > total) { toast('Topics covered cannot be more than the total topics', 'warning'); return; }
    const termId = k.syllabusTermId || currentTerm?.id || '';
    if (!termId) { toast('No current term is set up yet. Ask the administrator.', 'error'); return; }
    updateMutation.mutate(
      { classSubjectId: k.id, termId, totalTopics: total, coveredTopics: covered, notes: values.notes },
      {
        onSuccess: () => { toast('Syllabus progress saved', 'success'); setEditingId(null); },
        onError: (err) => toast(errorMessage(err, 'Could not save the syllabus progress.'), 'error'),
      },
    );
  };

  if (isLoading) return <TeacherWorkspaceShell title="Syllabus tracker" eyebrow="How far you have taught"><SkeletonTable cols={6} /></TeacherWorkspaceShell>;
  if (isError) return <TeacherWorkspaceShell title="Syllabus tracker" eyebrow="How far you have taught"><DataError onRetry={refetch} /></TeacherWorkspaceShell>;
  return (
    <TeacherWorkspaceShell title="Syllabus tracker" eyebrow="How far you have taught">
      {classes.length === 0 ? <EmptyState title="No classes yet" description="Your classes appear here once you are assigned to teach." /> : (
        <TeacherTable columns={['Subject', 'Class', ...(multi ? ['School'] : []), 'Covered', 'Progress', 'Notes', '']}>
          {classes.map((k) => {
            const barTone = k.syllabus >= 70 ? 'bg-ks-emerald' : k.syllabus >= 50 ? 'bg-ks-amber' : 'bg-ks-rose';
            const isEditing = editingId === k.id;
            return (
              <React.Fragment key={k.id}>
                <tr className="hover:bg-ks-paper">
                  <Td><span className="font-bold">{k.subject}</span></Td>
                  <Td>{k.className}</Td>
                  {multi && <Td><SchoolBadge schoolId={k.schoolId} /></Td>}
                  <Td>{k.syllabusTotal ? <span><b className="text-ks-slate">{k.syllabusCovered}</b> / {k.syllabusTotal} topics</span> : <span className="text-ks-muted">Not started</span>}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={k.syllabus} tone={barTone} className="w-24" />
                      <span className="text-xs font-bold text-ks-muted">{k.syllabus}%</span>
                    </div>
                  </Td>
                  <Td><span className="line-clamp-1 max-w-[14rem] text-xs font-semibold text-ks-muted">{k.syllabusNotes || '—'}</span></Td>
                  <Td>
                    {isEditing ? (
                      <button type="button" aria-label="Cancel" onClick={() => setEditingId(null)} className="p-1 text-ks-muted hover:text-ks-rose"><X className="h-4 w-4" /></button>
                    ) : (
                      <Button variant="secondary" className="py-1.5 text-xs" onClick={() => openEdit(k)}><Edit2 className="h-3.5 w-3.5" /> Update</Button>
                    )}
                  </Td>
                </tr>
                {isEditing && (
                  <tr className="bg-ks-paper/70">
                    <td colSpan={multi ? 7 : 6} className="px-4 py-4">
                      <div className="flex flex-wrap items-end gap-4">
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Topics covered</span>
                          <input type="number" min={0} value={values.covered} onChange={(e) => setValues((v) => ({ ...v, covered: e.target.value }))} className="mt-1 block h-9 w-24 rounded-lg border border-ks-line px-2 font-black text-ks-slate outline-none focus:border-ks-blue" />
                        </label>
                        <label className="block">
                          <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Total topics</span>
                          <input type="number" min={1} value={values.total} onChange={(e) => setValues((v) => ({ ...v, total: e.target.value }))} className="mt-1 block h-9 w-24 rounded-lg border border-ks-line px-2 font-black text-ks-slate outline-none focus:border-ks-blue" />
                        </label>
                        <label className="block min-w-[200px] flex-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Note (optional)</span>
                          <input value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} placeholder="e.g. Finished quadratic equations" className="mt-1 block h-9 w-full rounded-lg border border-ks-line px-2 font-semibold text-ks-slate outline-none focus:border-ks-blue" />
                        </label>
                        <Button className="mb-0.5" loading={updateMutation.isPending} onClick={() => handleSave(k)}>Save</Button>
                        <Button variant="secondary" className="mb-0.5" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </TeacherTable>
      )}
    </TeacherWorkspaceShell>
  );
}

const ANN_STATUS: Record<string, { tone: 'emerald' | 'blue' | 'slate' | 'rose'; label: string }> = {
  PUBLISHED: { tone: 'emerald', label: 'Sent' },
  SCHEDULED: { tone: 'blue', label: 'Scheduled' },
  DRAFT: { tone: 'slate', label: 'Draft' },
  CANCELLED: { tone: 'rose', label: 'Cancelled' },
  EXPIRED: { tone: 'slate', label: 'Expired' },
};

export function TeacherAnnouncementsPage() {
  const { data: items = [], isLoading, isError, refetch } = useTeacherAnnouncements();
  const { data: registers = [] } = useTeacherRegisters();
  const classLabel = new Map(registers.map((r) => [r.classId, r.label]));
  const roleLabel = (roles: string[]) => (roles?.length ? roles.map((r) => (r === 'STUDENT' ? 'Students' : r === 'PARENT' ? 'Parents' : r)).join(' + ') : 'Everyone');
  return (
    <TeacherWorkspaceShell title="Announcements" eyebrow="What you have told your classes" action={<NavLink to="/teacher/announcements/create"><Button className="bg-ks-gold text-ks-slate"><MessageSquarePlus className="h-4 w-4" /> New announcement</Button></NavLink>}>
      {isLoading ? <SkeletonTable cols={3} /> : isError ? <DataError onRetry={refetch} /> : items.length === 0 ? (
        <EmptyState title="No announcements yet" description="Write one to tell your students and parents about homework, tests or changes." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((a: Row) => {
            const st = ANN_STATUS[String(a.status)] ?? ANN_STATUS.DRAFT;
            const targets = (a.targetClassIds as string[] | undefined) ?? [];
            return (
              <Card key={String(a.id)} className="flex flex-col gap-3 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-black text-ks-slate">{String(a.title)}</h3>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                <p className="flex-1 whitespace-pre-line text-sm font-semibold leading-6 text-ks-muted">{String(a.body)}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-ks-muted">
                  <Badge tone="blue">{roleLabel(a.targetRoles as string[])}</Badge>
                  <span>{targets.length ? targets.map((id) => classLabel.get(id) ?? 'Class').join(', ') : 'All classes'}</span>
                  <span className="ml-auto">{a.publishedAt || a.scheduledAt ? new Date(String(a.publishedAt ?? a.scheduledAt)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </TeacherWorkspaceShell>
  );
}

export function CreateTeacherAnnouncementPage() {
  const navigate = useNavigate();
  const createMutation = useCreateAnnouncementMutation();
  const { data: allRegisters = [] } = useTeacherRegisters();
  const { visible, multi, nameOf } = useTeacherSchools();
  const registers = visible(allRegisters);
  const [form, setForm] = useState({ title: '', body: '', priority: 'NORMAL', students: true, parents: true, scheduledAt: '', expiresAt: '' });
  const [classIds, setClassIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const toggle = (id: string) => setClassIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allSelected = registers.length > 0 && classIds.length === registers.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.body.trim()) { setError('Write a title and a message.'); return; }
    if (classIds.length === 0) { setError('Choose at least one class to send it to.'); return; }
    if (!form.students && !form.parents) { setError('Choose who should receive it: students, parents or both.'); return; }
    if (form.scheduledAt && form.expiresAt && new Date(form.expiresAt) <= new Date(form.scheduledAt)) { setError('The end date must be after the send date.'); return; }
    createMutation.mutate(
      {
        title: form.title.trim(),
        body: form.body.trim(),
        priority: form.priority,
        targetRoles: [...(form.students ? ['STUDENT'] : []), ...(form.parents ? ['PARENT'] : [])],
        targetClassIds: classIds,
        channels: ['IN_APP'],
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      },
      {
        onSuccess: () => { toast(form.scheduledAt ? 'Announcement scheduled' : 'Announcement sent', 'success'); navigate('/teacher/announcements'); },
        onError: (err) => setError(errorMessage(err, 'Could not send the announcement. Please try again.')),
      },
    );
  };

  const set = (field: 'title' | 'body' | 'priority' | 'scheduledAt' | 'expiresAt') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const grouped = multi ? groupBySchool(registers) : [{ schoolId: '', rows: registers }];
  const audience = [form.students ? 'Students' : '', form.parents ? 'Parents' : ''].filter(Boolean).join(' + ') || 'Nobody';

  return (
    <TeacherWorkspaceShell title="New announcement" eyebrow="Tell your students and parents">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-xl p-5">
            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Title *</span>
                <input required maxLength={120} value={form.title} onChange={set('title')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="e.g. Physics lab report due Friday" />
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Message *</span>
                <textarea required value={form.body} onChange={set('body')} rows={5} className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="Write your message…" />
              </label>
              <fieldset>
                <legend className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Send to *</legend>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ks-navy"><input type="checkbox" checked={form.students} onChange={(e) => setForm((f) => ({ ...f, students: e.target.checked }))} /> Students</label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ks-navy"><input type="checkbox" checked={form.parents} onChange={(e) => setForm((f) => ({ ...f, parents: e.target.checked }))} /> Parents</label>
                </div>
              </fieldset>
              <fieldset>
                <legend className="flex w-full items-center justify-between text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">
                  <span>Classes *</span>
                  <button type="button" className="text-ks-blue normal-case tracking-normal hover:underline" onClick={() => setClassIds(allSelected ? [] : registers.map((r) => r.classId))}>{allSelected ? 'Clear all' : 'Select all my classes'}</button>
                </legend>
                {registers.length === 0 ? <p className="mt-2 text-sm font-semibold text-ks-muted">You are not assigned to any class yet.</p> : grouped.map((g) => (
                  <div key={g.schoolId || 'x'} className="mt-2">
                    {multi && <p className="mb-1 text-xs font-black text-ks-navy">{nameOf(g.schoolId) || 'School'}</p>}
                    <div className="flex flex-wrap gap-2">
                      {g.rows.map((r) => (
                        <label key={r.classId} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-black transition ${classIds.includes(r.classId) ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line bg-white text-ks-muted hover:border-ks-blue'}`}>
                          <input type="checkbox" className="sr-only" checked={classIds.includes(r.classId)} onChange={() => toggle(r.classId)} />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Priority</span>
                  <select value={form.priority} onChange={set('priority')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue">
                    <option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Send later (optional)</span>
                  <input type="datetime-local" value={form.scheduledAt} onChange={set('scheduledAt')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Hide after (optional)</span>
                  <input type="datetime-local" value={form.expiresAt} onChange={set('expiresAt')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue" />
                </label>
              </div>
            </div>
            {error && <p className="mt-4 rounded-lg bg-ks-rose/10 p-3 text-sm font-bold text-ks-rose" role="alert">{error}</p>}
            <div className="mt-5 flex gap-3">
              <Button type="submit" loading={createMutation.isPending}><Send className="h-4 w-4" /> {form.scheduledAt ? 'Schedule' : 'Send now'}</Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/teacher/announcements')}>Cancel</Button>
            </div>
          </Card>
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Preview</p>
            <div className="mt-3 rounded-xl border border-ks-line bg-ks-paper p-4">
              <p className="font-bold text-ks-slate">{form.title || 'Announcement title…'}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ks-muted">{form.body || 'Your message will appear here…'}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black">
                <span className="rounded-full bg-ks-blue/10 px-2 py-0.5 text-ks-blue">{audience}</span>
                <span className="rounded-full bg-ks-navy/10 px-2 py-0.5 text-ks-navy">{classIds.length} class{classIds.length === 1 ? '' : 'es'}</span>
              </div>
            </div>
          </Card>
        </div>
      </form>
    </TeacherWorkspaceShell>
  );
}

const INTERVENTION_TYPES: Array<[string, string]> = [
  ['TEACHER_SUPPORT_GIVEN', 'Extra support given'],
  ['ADDITIONAL_LESSONS_ASSIGNED', 'Extra lessons assigned'],
  ['PARENT_MEETING_SCHEDULED', 'Parent meeting'],
  ['OTHER', 'Something else'],
];

export function CreateInterventionPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: allClasses = [] } = useTeacherClasses();
  const { visible, multi, nameOf } = useTeacherSchools();
  const classes = visible(allClasses);
  const createMutation = useCreateInterventionMutation();
  const { data: alerts = [] } = usePerformanceAlerts();
  const [form, setForm] = useState({ classId: '', studentId: params.get('student') ?? '', type: 'TEACHER_SUPPORT_GIVEN', notes: '', followUpDate: '' });
  const alertId = params.get('alert') ?? '';
  const { data: classStudents = [] } = useClassStudents(form.classId);

  // Arriving from an alert or a student profile: pick the class that student is in.
  useEffect(() => {
    if (form.classId || classes.length === 0) return;
    const fromAlert = (alerts as Row[]).find((a) => a.id === alertId);
    const guess = fromAlert ? classes.find((c) => c.subject === fromAlert.subject && c.schoolId === fromAlert.schoolId) : undefined;
    if (guess) setForm((f) => ({ ...f, classId: guess.id }));
  }, [classes, alerts, alertId, form.classId]);

  const selectedClass = classes.find((c) => c.id === form.classId);
  const selectedStudent = classStudents.find((st) => st.id === form.studentId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !form.studentId) { toast('Choose the class and the student first', 'error'); return; }
    if (!form.notes.trim()) { toast('Describe the support you will give', 'error'); return; }
    createMutation.mutate({
      studentId: form.studentId,
      schoolId: selectedClass.schoolId || undefined,
      subjectName: selectedClass.subject,
      type: form.type,
      note: form.notes.trim(),
      followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : undefined,
      alertId: alertId || undefined,
    }, {
      onSuccess: () => { toast('Support plan saved', 'success'); navigate('/teacher/performance/alerts'); },
      onError: (err) => toast(errorMessage(err, 'Could not save the support plan.'), 'error'),
    });
  };

  const set = (field: 'type' | 'notes' | 'followUpDate') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <TeacherWorkspaceShell title="Plan support for a student" eyebrow="Record what you will do to help">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card className="rounded-xl p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Class *</span>
                <select
                  value={form.classId}
                  onChange={(e) => setForm((p) => ({ ...p, classId: e.target.value, studentId: '' }))}
                  className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue"
                >
                  <option value="">Select class…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.subject} · {c.className}{multi ? ` (${nameOf(c.schoolId)})` : ''}</option>)}
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
                  <option value="">{form.classId ? 'Select student…' : 'Choose a class first'}</option>
                  {classStudents.map((st) => <option key={st.id} value={st.id}>{st.name} ({st.registration})</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">What kind of support</span>
                <select value={form.type} onChange={set('type')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue">
                  {INTERVENTION_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Check back on</span>
                <input type="date" value={form.followUpDate} onChange={set('followUpDate')} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue" />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">What you will do *</span>
                <textarea required value={form.notes} onChange={set('notes')} rows={4} className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" placeholder="Describe the support and what you expect to change…" />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="submit" loading={createMutation.isPending}><Save className="h-4 w-4" /> Save support plan</Button>
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </Card>
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Summary</p>
            <div className="mt-3 space-y-3 rounded-xl bg-ks-paper p-4">
              <div><p className="text-[10px] font-black text-ks-muted">STUDENT</p><p className="font-bold text-ks-slate">{selectedStudent?.name || '—'}</p></div>
              <div><p className="text-[10px] font-black text-ks-muted">SUBJECT</p><p className="font-bold text-ks-slate">{selectedClass ? `${selectedClass.subject} · ${selectedClass.className}` : '—'}</p></div>
              <div><p className="text-[10px] font-black text-ks-muted">SUPPORT</p><p className="font-bold text-ks-slate">{INTERVENTION_TYPES.find(([v]) => v === form.type)?.[1]}</p></div>
              <div><p className="text-[10px] font-black text-ks-muted">PLAN</p><p className="text-sm font-semibold leading-relaxed text-ks-slate">{form.notes || '—'}</p></div>
              {form.followUpDate && <div><p className="text-[10px] font-black text-ks-muted">CHECK BACK</p><p className="font-bold text-ks-slate">{form.followUpDate}</p></div>}
            </div>
          </Card>
        </div>
      </form>
    </TeacherWorkspaceShell>
  );
}

const TYPE_LABEL: Record<string, string> = Object.fromEntries(INTERVENTION_TYPES);

function StudentName({ id }: { id: string }) {
  const { data } = useStudentBasic(id);
  return <>{data?.name || 'Student'}</>;
}

/** The support plans this teacher has recorded, so follow-ups are not forgotten. */
function MyInterventions() {
  const { data: items = [], isLoading } = useMyInterventions();
  if (isLoading || items.length === 0) return null;
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="border-b border-ks-line bg-ks-paper/50 px-gutter py-4"><h2 className="font-display text-2xl font-black text-ks-navy">My support plans</h2></div>
      <div className="divide-y divide-ks-line">
        {items.slice(0, 8).map((i) => (
          <NavLink key={String(i.id)} to={`/teacher/students/${i.studentId}/performance`} className="flex flex-wrap items-center justify-between gap-2 px-gutter py-3 hover:bg-ks-paper">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-ks-slate"><StudentName id={String(i.studentId)} /> <span className="font-semibold text-ks-muted">· {TYPE_LABEL[String(i.type)] ?? String(i.type).replaceAll('_', ' ').toLowerCase()}{i.subjectName ? ` · ${i.subjectName}` : ''}</span></p>
              <p className="truncate text-xs font-semibold text-ks-muted">{String(i.note)}</p>
            </div>
            <span className="flex items-center gap-2 text-xs font-bold text-ks-muted">
              {i.followUpDate ? `check ${new Date(String(i.followUpDate)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : new Date(String(i.createdAt)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              {i.isFollowedUp ? <Badge tone="emerald">Done</Badge> : <Badge tone="amber">Open</Badge>}
            </span>
          </NavLink>
        ))}
      </div>
    </Card>
  );
}

type ExportKey = 'class-list' | 'attendance' | 'marks-blank' | 'marks-results' | 'syllabus' | 'support';

function saveWorkbook(filename: string, sheets: Array<{ name: string; rows: Array<Array<string | number>> }>) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const sh of sheets) {
    let name = sh.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Sheet';
    let n = 2;
    while (used.has(name)) name = `${name.slice(0, 25)} ${n++}`;
    used.add(name);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sh.rows), name);
  }
  XLSX.writeFile(wb, filename);
}

export function TeacherExportsPage() {
  const { data: allClasses = [] } = useTeacherClasses();
  const { data: allAssessments = [] } = useTeacherAssessments();
  const { data: allRegisters = [] } = useTeacherRegisters();
  const { data: alerts = [] } = usePerformanceAlerts();
  const { visible, multi, nameOf } = useTeacherSchools();
  const classes = visible(allClasses);
  const registers = visible(allRegisters);
  const assessments = visible(allAssessments);
  const [busy, setBusy] = useState<ExportKey | null>(null);
  const [assessmentId, setAssessmentId] = useState('');
  const chosen = assessments.find((a) => a.id === assessmentId) ?? assessments[0];
  const { data: sheet } = useMarksSheet(chosen?.id ?? '');
  const attendance = useAttendanceList();
  const stamp = new Date().toISOString().slice(0, 10);
  const school = (id: string) => (multi ? nameOf(id) : '');

  const run = (key: ExportKey, work: () => Promise<string | void>) => async () => {
    setBusy(key);
    try {
      const done = await work();
      toast(done || 'Downloaded', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not create the file. Please try again.'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const fetchRegister = async (classId: string) => {
    const { api } = await import('../../../lib/api/client');
    const r = await api.get(`/teacher/class-subjects/${classId}/students`);
    const d = (r.data?.data ?? r.data) as { items?: Row[] };
    return (d.items ?? []) as Row[];
  };

  const items: Array<{ key: ExportKey; title: string; description: string; format: string; disabled?: boolean; extra?: ReactNode; go: () => Promise<string | void> }> = [
    {
      key: 'class-list', title: 'Class lists', format: 'Excel', disabled: registers.length === 0,
      description: 'Every student in each of your classes, one sheet per class, with registration numbers.',
      go: async () => {
        const sheets = [];
        for (const r of registers) {
          const students = await fetchRegister(r.classId);
          sheets.push({ name: r.label, rows: [[`${r.label}${school(r.schoolId) ? ` · ${school(r.schoolId)}` : ''}`], ['#', 'Registration number', 'Student'], ...students.map((st, i): Array<string | number> => [i + 1, String(st.registrationNumber ?? ''), String(st.name ?? '')])] });
        }
        saveWorkbook(`class-lists-${stamp}.xlsx`, sheets);
        return `${registers.length} class list${registers.length === 1 ? '' : 's'} downloaded`;
      },
    },
    {
      key: 'attendance', title: 'Attendance history', format: 'Excel', disabled: registers.length === 0 || attendance.isLoading,
      description: 'Every register you have taken: date, class, student and status.',
      go: async () => {
        const mine = new Map(registers.map((r) => [r.classId, r]));
        const names = new Map<string, { name: string; reg: string }>();
        for (const r of registers) for (const st of await fetchRegister(r.classId)) names.set(String(st.id), { name: String(st.name ?? ''), reg: String(st.registrationNumber ?? '') });
        const rows: Array<Array<string | number>> = [['Date', 'Class', ...(multi ? ['School'] : []), 'Registration', 'Student', 'Status']];
        const recs = ((attendance.data ?? []) as Row[]).filter((x) => mine.has(x.classId)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        for (const x of recs) rows.push([String(x.date).slice(0, 10), mine.get(x.classId)!.label, ...(multi ? [school(x.schoolId)] : []), names.get(x.studentId)?.reg ?? '', names.get(x.studentId)?.name ?? '', String(x.status)]);
        saveWorkbook(`attendance-${stamp}.xlsx`, [{ name: 'Attendance', rows }]);
        return `${recs.length} attendance record${recs.length === 1 ? '' : 's'} downloaded`;
      },
    },
    {
      key: 'marks-blank', title: 'Blank marks sheet', format: 'Excel', disabled: !chosen || !sheet,
      description: 'The student list for one assessment with an empty score column, ready for offline entry.',
      extra: (
        <select value={chosen?.id ?? ''} onChange={(e) => setAssessmentId(e.target.value)} aria-label="Choose assessment" className="mt-3 h-10 w-full rounded-lg border border-ks-line bg-white px-2 text-xs font-bold text-ks-navy">
          {assessments.map((a) => <option key={a.id} value={a.id}>{a.subject} · {a.className} · {a.examWindow?.name ?? a.title}</option>)}
        </select>
      ),
      go: async () => {
        const rows: Array<Array<string | number>> = [['registration_number', 'student_name', 'score', 'is_absent', 'not_sat'], ...(sheet?.rows ?? []).filter((r) => !r.exempt).map((r): Array<string | number> => [r.registration, r.name, '', '', ''])];
        saveWorkbook(`marks-sheet-${chosen!.subject}-${chosen!.className}.xlsx`.replace(/\s+/g, '-'), [{ name: 'Marks', rows }]);
      },
    },
    {
      key: 'marks-results', title: 'Marks entered', format: 'Excel', disabled: !chosen || !sheet,
      description: 'The scores you entered for the assessment chosen above, with absent and not-sat marked.',
      go: async () => {
        const rows: Array<Array<string | number>> = [[`${chosen!.subject} · ${chosen!.className} · ${chosen!.examWindow?.name ?? chosen!.title} (out of ${chosen!.maxScore})`], ['Registration', 'Student', 'Score', 'Percent', 'Status'], ...(sheet?.rows ?? []).map((r): Array<string | number> => [
          r.registration, r.name,
          r.exempt || r.absent || r.notSat || r.score === '' ? '' : Number(r.score),
          r.exempt || r.absent || r.notSat || r.score === '' ? '' : Math.round((Number(r.score) / chosen!.maxScore) * 1000) / 10,
          r.exempt ? 'Exempt' : r.notSat ? 'Not sat' : r.absent ? 'Absent' : r.score === '' ? 'No result' : 'Scored',
        ])];
        saveWorkbook(`marks-${chosen!.subject}-${chosen!.className}.xlsx`.replace(/\s+/g, '-'), [{ name: 'Marks', rows }]);
      },
    },
    {
      key: 'syllabus', title: 'Syllabus coverage', format: 'Excel', disabled: classes.length === 0,
      description: 'Topics covered against the total for every class you teach.',
      go: async () => {
        const rows: Array<Array<string | number>> = [['Subject', 'Class', ...(multi ? ['School'] : []), 'Topics covered', 'Total topics', 'Percent', 'Note'], ...classes.map((c): Array<string | number> => [c.subject, c.className, ...(multi ? [school(c.schoolId)] : []), c.syllabusCovered, c.syllabusTotal, c.syllabus, c.syllabusNotes])];
        saveWorkbook(`syllabus-${stamp}.xlsx`, [{ name: 'Syllabus', rows }]);
      },
    },
    {
      key: 'support', title: 'Students needing support', format: 'Excel', disabled: (alerts as Row[]).length === 0,
      description: 'The students currently flagged in your subjects, with the reason and score.',
      go: async () => {
        const rows: Array<Array<string | number>> = [['Student', 'Subject', ...(multi ? ['School'] : []), 'Severity', 'Score', 'Reason'], ...visible(alerts as unknown as Alert[]).map((a): Array<string | number> => [a.student, a.subject, ...(multi ? [school(a.schoolId ?? '')] : []), a.severity, Math.round(Number((a as Row).score ?? 0)), a.reason])];
        saveWorkbook(`students-needing-support-${stamp}.xlsx`, [{ name: 'Support', rows }]);
      },
    },
  ];

  return (
    <TeacherWorkspaceShell title="Downloads" eyebrow="Lists and sheets you can take away">
      <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Card key={item.key} className="group flex flex-col rounded-xl p-5 transition hover:-translate-y-0.5 hover:shadow-layer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ks-blue/10"><Download className="h-5 w-5 text-ks-blue" /></div>
              <span className="rounded-full border border-ks-slate/15 bg-ks-slate/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-ks-slate">{item.format}</span>
            </div>
            <h3 className="mt-4 font-display text-xl font-black text-ks-slate">{item.title}</h3>
            <p className="mt-1 flex-1 text-sm font-semibold text-ks-muted">{item.description}</p>
            {item.extra}
            <Button variant="secondary" className="mt-4 w-full" disabled={item.disabled || busy !== null} loading={busy === item.key} onClick={run(item.key, item.go)}>
              {busy === item.key ? 'Preparing…' : 'Download'}
            </Button>
          </Card>
        ))}
      </div>
    </TeacherWorkspaceShell>
  );
}

export function CreatePairingPage() {
  const navigate = useNavigate();
  const { data: allClasses = [] } = useTeacherClasses();
  const { visible, multi, nameOf } = useTeacherSchools();
  const classes = visible(allClasses);
  const { data: currentTerm } = useCurrentTerm() as { data: { id: string } | null | undefined };
  const createMutation = useCreatePairingMutation();
  const [classId, setClassId] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [supportId, setSupportId] = useState('');
  const [reason, setReason] = useState('');
  const { data: classStudents = [] } = useClassStudents(classId);
  const { data: an } = useClassAnalytics(classId);
  const avgOf = new Map((an?.students ?? []).map((st) => [st.id, st.average]));

  const selectedClass = classes.find((c) => c.id === classId);
  const mentorOptions = classStudents.filter((st) => st.id !== supportId).sort((a, b) => (avgOf.get(b.id) ?? 0) - (avgOf.get(a.id) ?? 0));
  const supportOptions = classStudents.filter((st) => st.id !== mentorId).sort((a, b) => (avgOf.get(a.id) ?? 999) - (avgOf.get(b.id) ?? 999));
  const mentor = classStudents.find((st) => st.id === mentorId);
  const support = classStudents.find((st) => st.id === supportId);
  const label = (st: Student) => `${st.name}${avgOf.has(st.id) ? ` — ${avgOf.get(st.id)}%` : ''}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mentorId || !supportId || !reason.trim()) { toast('Choose both students and say why', 'warning'); return; }
    if (mentorId === supportId) { toast('The mentor and the student to support must be different people', 'error'); return; }
    const termId = String(currentTerm?.id ?? '');
    if (!termId) { toast('No current term is set up yet. Ask the administrator.', 'error'); return; }
    if (!selectedClass) return;
    createMutation.mutate({
      peerId: mentorId,
      studentId: supportId,
      subjectId: selectedClass.subjectId,
      subjectName: selectedClass.subject,
      termId,
      reason: reason.trim(),
    }, {
      onSuccess: () => { toast('Pairing created', 'success'); navigate('/teacher/performance/pairings'); },
      onError: (err) => toast(errorMessage(err, 'Could not create the pairing.'), 'error'),
    });
  };

  return (
    <TeacherWorkspaceShell title="Pair two students" eyebrow="A strong student helps a classmate">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="rounded-xl p-5">
            <div className="space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Class and subject</span>
                <select value={classId} onChange={(e) => { setClassId(e.target.value); setMentorId(''); setSupportId(''); }} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue">
                  <option value="">Select class…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.subject} · {c.className}{multi ? ` (${nameOf(c.schoolId)})` : ''}</option>)}
                </select>
              </label>
              <p className="rounded-lg bg-ks-mist/50 p-3 text-xs font-semibold text-ks-navy">The mentor must be doing well in this subject (75% or more). Averages shown are from your own assessments.</p>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Mentor (doing well) *</span>
                  <select required value={mentorId} onChange={(e) => setMentorId(e.target.value)} disabled={!classId} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue disabled:opacity-50">
                    <option value="">{classId ? 'Select mentor…' : 'Choose a class first'}</option>
                    {mentorOptions.map((st) => <option key={st.id} value={st.id}>{label(st)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Student to support *</span>
                  <select required value={supportId} onChange={(e) => setSupportId(e.target.value)} disabled={!classId} className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue disabled:opacity-50">
                    <option value="">{classId ? 'Select student…' : 'Choose a class first'}</option>
                    {supportOptions.map((st) => <option key={st.id} value={st.id}>{label(st)}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Why this pairing? *</span>
                <textarea required rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Strong in algebra, sits near the student who is struggling" className="mt-2 w-full resize-none rounded-xl border border-ks-line p-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <Button type="submit" loading={createMutation.isPending}><Plus className="h-4 w-4" /> Create pairing</Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/teacher/performance/pairings')}>Cancel</Button>
            </div>
          </Card>
          <Card className="sticky top-24 h-fit rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Preview</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-ks-emerald/30 bg-ks-emerald/5 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Mentor</p>
                <p className="mt-1 font-display text-lg font-black text-ks-slate">{mentor?.name || '—'}</p>
                {mentor && avgOf.has(mentor.id) && <p className="text-xs font-semibold text-ks-emerald">{avgOf.get(mentor.id)}% average</p>}
              </div>
              <div className="flex justify-center text-2xl font-black text-ks-muted">↓</div>
              <div className="rounded-xl border border-ks-rose/30 bg-ks-rose/5 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">Needs support</p>
                <p className="mt-1 font-display text-lg font-black text-ks-slate">{support?.name || '—'}</p>
                {support && avgOf.has(support.id) && <p className="text-xs font-semibold text-ks-rose">{avgOf.get(support.id)}% average</p>}
              </div>
            </div>
          </Card>
        </div>
      </form>
    </TeacherWorkspaceShell>
  );
}

function AlertsOperationalTable({ alerts }: { alerts: Alert[] }) {
  const [severity, setSeverity] = useState<'' | 'CRITICAL' | 'AT_RISK'>('');
  const [subject, setSubject] = useState('');
  const { multi } = useTeacherSchools();
  const subjects = [...new Set(alerts.map((a) => a.subject).filter(Boolean))];
  const rows = alerts.filter((a) => (!severity || a.severity === severity) && (!subject || a.subject === subject));
  const download = () => {
    const head = ['Student', 'Subject', 'Severity', 'Reason'];
    const lines = [head.join(',')].concat(rows.map((a) => [a.student, a.subject, a.severity, a.reason].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    const el = document.createElement('a'); el.href = url; el.download = 'students-needing-support.csv'; el.click(); URL.revokeObjectURL(url);
  };
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ks-line bg-ks-paper/50 px-gutter py-4">
        <h2 className="font-display text-2xl font-black text-ks-navy">Students flagged</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} aria-label="Filter by severity" className="h-9 rounded-lg border border-ks-line bg-white px-2 text-xs font-bold text-ks-navy">
            <option value="">All severities</option><option value="CRITICAL">Critical</option><option value="AT_RISK">At risk</option>
          </select>
          {subjects.length > 1 && (
            <select value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject" className="h-9 rounded-lg border border-ks-line bg-white px-2 text-xs font-bold text-ks-navy">
              <option value="">All subjects</option>{subjects.map((sj) => <option key={sj} value={sj}>{sj}</option>)}
            </select>
          )}
          <Button variant="secondary" className="py-1.5 text-xs" onClick={download} disabled={rows.length === 0}><Download className="h-3.5 w-3.5" /> Download</Button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm font-semibold text-ks-emerald">{alerts.length === 0 ? 'No students are flagged right now. Keep entering marks so the system can keep watching.' : 'No alerts match these filters.'}</p>
      ) : (
        <TeacherTable columns={['Student', 'Subject', 'Why', '']}>
          {rows.map((alert) => (
            <tr key={alert.id} className="hover:bg-ks-paper">
              <Td>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">{alert.student.split(' ').map((pt) => pt[0]).join('').slice(0, 2).toUpperCase()}</div>
                  <div><p className="font-black text-ks-navy">{alert.student}</p>{multi && <SchoolBadge schoolId={alert.schoolId} />}</div>
                </div>
              </Td>
              <Td><p className="font-bold text-ks-navy">{alert.subject}</p></Td>
              <Td><AlertTypeBadge type={String(alert.type).replaceAll('_', ' ').toLowerCase()} severity={alert.severity} /><p className="mt-1 max-w-[18rem] text-xs font-semibold text-ks-muted">{alert.reason}</p></Td>
              <Td><NavLink to={`/teacher/performance/alerts/${alert.id}`} className="font-black text-ks-blue hover:underline">Open →</NavLink></Td>
            </tr>
          ))}
        </TeacherTable>
      )}
    </Card>
  );
}

function PredictionPanel({ criticalCount, suggestedPairings }: { criticalCount: number; suggestedPairings: number }) {
  const headline =
    suggestedPairings > 0
      ? `${suggestedPairings} pairing${suggestedPairings === 1 ? '' : 's'} ready to activate`
      : criticalCount > 0
        ? `${criticalCount} critical alert${criticalCount === 1 ? '' : 's'} need attention`
        : 'All performance signals clear';
  const detail =
    suggestedPairings > 0
      ? 'The engine has matched struggling students with strong peers in your classes — activating pairings early in the week gives the best improvement odds.'
      : criticalCount > 0
        ? 'Review the critical alerts above and open an intervention or guardian conversation before the next assessment cycle.'
        : 'No open critical alerts or pending pairings for your classes — keep marks entry current so the engine can keep watching.';
  return (
    <div className="relative overflow-hidden rounded-xl bg-ks-navy p-stack-lg text-white shadow-layer">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 left-1/3 h-32 w-32 rounded-full bg-ks-blue/10" />
      <div className="relative flex flex-col gap-stack-lg md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-gold">Performance Engine</p>
          <h3 className="mt-2 font-display text-2xl font-black">{headline}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-ks-mist/75">{detail}</p>
        </div>
        <div className="flex shrink-0 gap-6">
          <div className="text-center">
            <p className="font-display text-3xl font-black text-ks-gold">{String(criticalCount).padStart(2, '0')}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-ks-mist/50">Critical</p>
          </div>
          <div className="h-12 w-px bg-white/20" />
          <div className="text-center">
            <p className="font-display text-3xl font-black text-ks-sky">{String(suggestedPairings).padStart(2, '0')}</p>
            <p className="text-[10px] font-black uppercase tracking-wider text-ks-mist/50">Pairings</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AcademicSpotlight({ alerts }: { alerts: Alert[] }) {
  const spotlightFor = (alert: Alert) => {
    const positive = ['RAPID_IMPROVEMENT', 'CONSISTENT_EXCELLENCE', 'RECOVERED'].includes(alert.type);
    const declining = ['SUDDEN_DECLINE', 'CONSECUTIVE_DECLINE', 'CHRONIC_UNDERPERFORMER', 'FAILURE_RISK', 'AT_RISK'].includes(alert.type);
    return {
      key: alert.id,
      icon: positive ? '★' : declining ? '↓' : '↑',
      iconColor: positive ? 'text-ks-gold' : declining ? 'text-ks-rose' : 'text-ks-blue',
      subColor: positive ? 'text-ks-emerald' : declining ? 'text-ks-rose' : 'text-ks-blue',
      label: `${alert.student}${alert.subject ? ` · ${alert.subject}` : ''}`,
      sub: alert.reason || alert.type.replaceAll('_', ' ').toLowerCase(),
    };
  };
  const items = alerts.slice(0, 3).map(spotlightFor);
  return (
    <Card className="rounded-xl p-stack-lg">
      <h4 className="border-b border-ks-line pb-2 text-[11px] font-black uppercase tracking-[0.22em] text-ks-navy">Spotlight</h4>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm font-semibold text-ks-muted">Nothing to highlight yet. Movers and risks appear here as results come in.</p>
        ) : (
          items.map((item) => (
            <div key={item.key} className="flex items-center gap-3 rounded-lg bg-ks-paper p-3">
              <div className={`w-6 shrink-0 text-center text-lg font-black ${item.iconColor}`}>{item.icon}</div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ks-navy">{item.label}</p>
                <p className={`line-clamp-2 text-xs font-bold ${item.subColor}`}>{item.sub}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function AssessmentMiniTable({ detailed = false }: { detailed?: boolean }) {
  const { data: all = [], isLoading, isError, refetch } = useTeacherAssessments();
  const { visible, multi } = useTeacherSchools();
  const [params] = useSearchParams();
  const classFilter = params.get('class') ?? '';
  const [status, setStatus] = useState<'' | 'todo' | 'waiting' | 'approved' | 'sentback'>('');
  if (isLoading) return <SkeletonTable cols={8} />;
  if (isError) return <DataError onRetry={refetch} />;
  const scoped = visible(all).filter((a) => !classFilter || a.classSubjectId === classFilter);
  if (!scoped.length) return <EmptyState title="No assessments yet" description="Assessments appear here once they are set up for your classes." />;
  const isTodo = (a: Assessment) => ['DRAFT', 'OPEN'].includes(a.status);
  const rows = scoped.filter((a) =>
    status === 'todo' ? isTodo(a) :
    status === 'waiting' ? a.status === 'SUBMITTED' :
    status === 'approved' ? ['HOD_APPROVED', 'APPROVED', 'LOCKED'].includes(a.status) :
    status === 'sentback' ? a.status === 'REJECTED' : true);
  const count = (f: (a: Assessment) => boolean) => scoped.filter(f).length;
  const chips: Array<[typeof status, string, number]> = [
    ['', 'All', scoped.length],
    ['todo', 'To enter', count(isTodo)],
    ['sentback', 'Sent back', count((a) => a.status === 'REJECTED')],
    ['waiting', 'Waiting for approval', count((a) => a.status === 'SUBMITTED')],
    ['approved', 'Approved / locked', count((a) => ['HOD_APPROVED', 'APPROVED', 'LOCKED'].includes(a.status))],
  ];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(([key, label, n]) => (
          <button key={label} type="button" onClick={() => setStatus(key)} aria-pressed={status === key}
            className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${status === key ? 'border-ks-navy bg-ks-navy text-white' : 'border-ks-line bg-white text-ks-muted hover:border-ks-blue hover:text-ks-blue'}`}>
            {label} <span className="opacity-70">{n}</span>
          </button>
        ))}
        {classFilter && <NavLink to="/teacher/assessments" className="ml-2 text-xs font-black text-ks-blue hover:underline">Show all classes ×</NavLink>}
      </div>
      {rows.length === 0 ? <EmptyState title="Nothing here" description="No assessments match this filter." /> : (
        <TeacherTable columns={['Assessment', 'Class', ...(multi ? ['School'] : []), 'Out of', 'Status', 'Marks entered', 'Due', '']}>
          {rows.map((item) => {
            const windowClosed = item.examWindow && !['OPEN', 'REOPENED'].includes(item.examWindow.status);
            const editable = ['DRAFT', 'OPEN', 'REJECTED'].includes(item.status) && !windowClosed;
            return (
              <tr key={item.id} className="hover:bg-ks-paper">
                <Td>
                  <span className="font-bold">{item.subject}</span>
                  <span className="block text-xs font-semibold text-ks-muted">{item.examWindow?.name ?? item.title}</span>
                </Td>
                <Td>{item.className}</Td>
                {multi && <Td><SchoolBadge schoolId={item.schoolId} /></Td>}
                <Td>{item.maxScore}</Td>
                <Td><AssessmentStatusBadge status={item.status} /></Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={item.total ? (item.entered / item.total) * 100 : 0} tone={item.entered >= item.total && item.total > 0 ? 'bg-ks-emerald' : 'bg-ks-blue'} className="w-20" />
                    <span className="text-xs text-ks-muted">{item.entered}/{item.total}</span>
                  </div>
                </Td>
                <Td>{item.due ? dueLabel(item.due) : '—'}</Td>
                <Td>
                  <div className="flex items-center gap-3">
                    <NavLink to={assessmentMarksPath(item)} className={`rounded-lg px-3 py-1.5 text-xs font-black ${editable ? 'bg-ks-blue text-white hover:opacity-90' : 'border border-ks-line text-ks-navy hover:bg-ks-paper'}`}>{editable ? 'Enter marks' : 'View'}</NavLink>
                    {detailed && !item.examWindow && <NavLink to={`/teacher/assessments/${item.id}/review`} className="text-xs font-black text-ks-muted hover:text-ks-navy">Status</NavLink>}
                  </div>
                </Td>
              </tr>
            );
          })}
        </TeacherTable>
      )}
    </>
  );
}

function StudentsTable({ classSubjectId = '', query = '', classSize = 0 }: { classSubjectId?: string; query?: string; classSize?: number }) {
  const { data: students = [], isLoading, isError, refetch } = useClassStudents(classSubjectId);
  const { data: an } = useClassAnalytics(classSubjectId);
  const stats = new Map((an?.students ?? []).map((st) => [st.id, st]));
  const q = query.trim().toLowerCase();
  const visibleRows = q ? students.filter((st) => st.name.toLowerCase().includes(q) || st.registration.toLowerCase().includes(q)) : students;
  if (isLoading) return <SkeletonTable cols={6} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (!students.length) return <EmptyState title="No students" description="No students take this subject in this class yet." />;
  const flagTone = (flag?: string) => flag === 'AT_RISK' || flag === 'DECLINING' ? 'rose' : flag === 'IMPROVING' ? 'emerald' : 'slate';
  const flagLabel = (flag?: string) => flag === 'AT_RISK' ? 'At risk' : flag === 'DECLINING' ? 'Declining' : flag === 'IMPROVING' ? 'Improving' : flag === 'OK' ? 'On track' : 'No results';
  return (
    <>
      {classSize > students.length && <p className="text-xs font-semibold text-ks-muted">Showing the {students.length} students who take this subject (the class has {classSize}).</p>}
      <TeacherTable columns={['#', 'Student', 'Registration', 'Average', 'Last score', 'Absences', 'Standing', '']}>
        {visibleRows.map((student, index) => {
          const st = stats.get(student.id);
          return (
            <tr key={student.id} className="hover:bg-ks-paper">
              <Td><span className="font-mono text-xs text-ks-muted">{index + 1}</span></Td>
              <Td>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ks-mist text-xs font-black text-ks-blue">{student.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</div>
                  <span className="font-bold text-ks-slate">{student.name}</span>
                </div>
              </Td>
              <Td><span className="font-mono text-xs">{student.registration}</span></Td>
              <Td>{st && st.taken > 0 ? <span className={`font-bold ${st.average >= 60 ? 'text-ks-emerald' : st.average >= 40 ? 'text-ks-amber' : 'text-ks-rose'}`}>{st.average}%</span> : <span className="text-ks-muted">—</span>}</Td>
              <Td>{st?.last != null ? `${st.last}%` : '—'}</Td>
              <Td>{st?.absent ?? 0}</Td>
              <Td><Badge tone={flagTone(st?.flag)}>{flagLabel(st?.flag)}</Badge></Td>
              <Td><NavLink to={`/teacher/students/${student.id}/performance`} className="font-black text-ks-blue hover:underline">Profile</NavLink></Td>
            </tr>
          );
        })}
      </TeacherTable>
      {visibleRows.length === 0 && <p className="py-4 text-center text-sm font-semibold text-ks-muted">No student matches “{query}”.</p>}
    </>
  );
}

type ClassAnalytics = NonNullable<ReturnType<typeof useClassAnalytics>['data']>;

function AnalyticsGrid({ analytics }: { analytics: ClassAnalytics | undefined }) {
  const assessments = analytics?.assessments ?? [];
  const students = analytics?.students ?? [];
  const latest = assessments[assessments.length - 1];
  const grades = analytics?.gradeOrder?.length ? analytics.gradeOrder : ['A', 'B', 'C', 'D', 'F'];
  const dist = latest?.distribution ?? {};
  const distTotal = grades.reduce((t, g) => t + Number(dist[g] ?? 0), 0);
  // Best grades green, the middle amber, the lowest red, whatever the school's scale is called.
  const toneFor = (g: string) => {
    const pos = grades.indexOf(g) / Math.max(grades.length - 1, 1);
    return pos <= 0.25 ? 'bg-ks-emerald' : pos <= 0.5 ? 'bg-ks-blue' : pos <= 0.75 ? 'bg-ks-amber' : 'bg-ks-rose';
  };
  const flagged = students.filter((st) => st.flag === 'AT_RISK' || st.flag === 'DECLINING');
  const top = students.slice(0, 3);
  return (
    <div className="space-y-gutter">
      <div className="grid gap-gutter xl:grid-cols-3">
        <Card className="overflow-hidden rounded-xl p-5 xl:col-span-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Assessment by assessment</p>
          <div className="mt-4 space-y-3">
            {assessments.map((a) => (
              <div key={a.id}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate font-bold text-ks-slate">{a.name}</span>
                  <span className="text-xs font-semibold text-ks-muted">avg <b className="text-ks-slate">{a.average}%</b> · pass {a.passRate}% · best {a.highest}% · lowest {a.lowest}%{a.absent ? ` · ${a.absent} absent` : ''}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-ks-line"><div className={`h-full rounded-full ${a.average >= 60 ? 'bg-ks-emerald' : a.average >= 40 ? 'bg-ks-amber' : 'bg-ks-rose'}`} style={{ width: `${Math.min(a.average, 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden rounded-xl p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Grades · latest assessment</p>
          <p className="mt-1 text-xs font-semibold text-ks-muted">{latest?.name ?? ''}</p>
          {distTotal === 0 ? <p className="mt-4 text-sm font-semibold text-ks-muted">No graded marks yet.</p> : (
            <div className="mt-4 space-y-2.5">
              {grades.map((g) => {
                const count = Number(dist[g] ?? 0);
                return (
                  <div key={g}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="font-black text-ks-slate">{g}</span><span className="font-bold text-ks-muted">{count} student{count === 1 ? '' : 's'}</span></div>
                    <div className="h-4 overflow-hidden rounded-md bg-ks-line"><div className={`h-full rounded-md ${toneFor(g)}`} style={{ width: `${Math.round((count / distTotal) * 100)}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
      <div className="grid gap-gutter xl:grid-cols-2">
        <Card className="overflow-hidden rounded-xl p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Students needing attention</p>
          <p className="mt-1 font-display text-2xl font-black text-ks-slate">{flagged.length} flagged</p>
          <div className="mt-3 space-y-2">
            {flagged.length === 0 && <p className="text-sm font-semibold text-ks-emerald">Nobody is below the pass mark or sliding.</p>}
            {flagged.slice(0, 6).map((st) => (
              <NavLink key={st.id} to={`/teacher/students/${st.id}/performance`} className="flex items-center justify-between gap-3 rounded-xl border border-ks-line bg-ks-paper p-3 hover:border-ks-blue/40">
                <div className="min-w-0"><p className="truncate text-sm font-black text-ks-slate">{st.name}</p><p className="text-xs font-semibold text-ks-muted">average {st.average}%{st.delta != null ? ` · ${st.delta > 0 ? '+' : ''}${st.delta} since last test` : ''}</p></div>
                <Badge tone="rose">{st.flag === 'AT_RISK' ? 'At risk' : 'Declining'}</Badge>
              </NavLink>
            ))}
          </div>
        </Card>
        <Card className="overflow-hidden rounded-xl p-5">
          <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Top of the class</p>
          <div className="mt-3 space-y-2">
            {top.map((st, i) => (
              <div key={st.id} className="flex items-center justify-between gap-3 rounded-xl border border-ks-line bg-ks-paper p-3">
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-ks-gold/30 text-xs font-black text-ks-slate">{i + 1}</span><span className="truncate text-sm font-black text-ks-slate">{st.name}</span></div>
                <span className="font-display text-lg font-black text-ks-emerald">{st.average}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function WorkspaceTabs({ id, classId }: { id: string; classId: string }) {
  const tabs: [string, string, boolean?][] = [
    ['Overview', `/teacher/classes/${id}`, true],
    ['Students', `/teacher/classes/${id}/students`],
    ['Assessments', `/teacher/assessments?class=${id}`, true],
    ['Attendance', `/teacher/attendance?class=${classId}`, true],
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
              isActive && (label === 'Overview' || label === 'Students' || label === 'Analytics') ? 'bg-ks-navy text-white shadow-sm' : 'text-ks-muted hover:bg-ks-mist hover:text-ks-navy'
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
        placeholder="Search by name or registration number…"
        aria-label="Search students"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
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

// ─── Report Card Remarks page ─────────────────────────────────────────────────

function RemarkRow({ student, currentTermId }: { student: Student; currentTermId: string }) {
  const { data: cards = [], isLoading } = useStudentReportCards(student.id);
  const mutation = useUpdateReportCardCommentsMutation();
  const card = (cards as Row[]).find((c) => c.termId === currentTermId || c.term?.id === currentTermId) ?? (cards as Row[])[0];
  const [remark, setRemark] = useState('');
  const [saved, setSaved] = useState(false);
  const original = String(card?.teacherComment ?? '');
  useEffect(() => { setRemark(original); }, [original]);

  const cardId = String(card?.id ?? '');
  const changed = remark.trim() !== original.trim();
  const handleSave = () => {
    if (!cardId) return;
    mutation.mutate({ id: cardId, teacherComment: remark.trim() }, {
      onSuccess: () => { setSaved(true); toast(`Remark saved for ${student.name}`, 'success'); setTimeout(() => setSaved(false), 2500); },
      onError: (err) => toast(errorMessage(err, 'Could not save the remark.'), 'error'),
    });
  };
  return (
    <tr className="border-t border-ks-line align-top">
      <td className="px-4 py-3"><p className="font-black text-ks-navy">{student.name}</p><p className="font-mono text-[11px] text-ks-muted">{student.registration}</p></td>
      <td className="px-4 py-3 text-xs text-ks-muted">
        {isLoading ? 'Loading…' : !card ? <Badge tone="slate">No report card yet</Badge> : <Badge tone={card.isPublished ? 'emerald' : 'blue'}>{card.isPublished ? 'Published' : 'Draft'}</Badge>}
      </td>
      <td className="px-4 py-3">
        {card ? (
          <>
            <textarea className="w-full resize-none rounded-lg border border-ks-line bg-ks-paper px-3 py-2 text-sm font-semibold text-ks-slate outline-none focus:border-ks-navy disabled:bg-ks-mist/20 disabled:text-ks-muted" rows={2} maxLength={600} disabled={Boolean(card.isPublished)} aria-label={`Remark for ${student.name}`} placeholder="Write a short, specific, constructive remark…" value={remark} onChange={(e) => { setRemark(e.target.value); setSaved(false); }} />
            <p className="mt-0.5 text-right text-[10px] font-semibold text-ks-muted">{card.isPublished ? 'Published: ask an administrator to unpublish this report card before changing the remark.' : `${remark.length}/600`}</p>
          </>
        ) : <p className="text-xs italic text-ks-muted">The report card is created by the administrator after the exam results are composed.</p>}
      </td>
      <td className="px-4 py-3">
        {card && !card.isPublished && (
          <Button variant={saved ? 'success' : 'secondary'} className="px-3 py-1.5 text-xs" disabled={!changed || mutation.isPending} loading={mutation.isPending} onClick={handleSave}>
            {saved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : <><Save className="h-3.5 w-3.5" /> Save</>}
          </Button>
        )}
      </td>
    </tr>
  );
}

function ClassRemarks({ classId, currentTermId }: { classId: string; currentTermId: string }) {
  const { data: students = [], isLoading } = useRegisterStudents(classId);
  if (isLoading) return <SkeletonTable cols={4} />;
  if (!students.length) return <p className="py-8 text-center text-sm text-ks-muted">No students found for this class.</p>;
  return (
    <div className="overflow-hidden rounded-2xl border border-ks-line bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-ks-paper">
            <tr>{['Student', 'Report card', 'Your remark', ''].map((h) => <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-wider text-ks-muted">{h}</th>)}</tr>
          </thead>
          <tbody>{students.map((st) => <RemarkRow key={st.id} student={st} currentTermId={currentTermId} />)}</tbody>
        </table>
      </div>
    </div>
  );
}

export function TeacherReportRemarksPage() {
  const { data: allRegisters = [], isLoading } = useTeacherRegisters();
  const { data: currentTerm } = useCurrentTerm();
  const { visible, multi, nameOf } = useTeacherSchools();
  // The report-card remark is the class teacher's. Subject-only teachers are told so, not shown a form that fails.
  const mine = visible(allRegisters).filter((r) => r.isClassTeacher);
  const [selected, setSelected] = useState('');
  const classId = mine.some((r) => r.classId === selected) ? selected : mine[0]?.classId ?? '';
  const termId = String((currentTerm as Row | null | undefined)?.id ?? '');
  const grouped = multi ? groupBySchool(mine) : [{ schoolId: '', rows: mine }];

  return (
    <TeacherWorkspaceShell title="Report card remarks" eyebrow="Your words on each student's report card">
      {isLoading ? <SkeletonTable cols={4} /> : mine.length === 0 ? (
        <EmptyState title="You are not a class teacher" description="The remark on a student's report card is written by that class's class teacher. When you are made class teacher of a class, it appears here." />
      ) : (
        <>
          <Card className="rounded-xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <MessageSquarePlus className="h-4 w-4 text-ks-muted" />
              <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Your class</p>
              <select className="h-10 rounded-lg border border-ks-line bg-ks-paper px-3 text-sm font-bold text-ks-navy outline-none" value={classId} onChange={(e) => setSelected(e.target.value)} aria-label="Choose class">
                {grouped.map((g) => (
                  <optgroup key={g.schoolId || 'x'} label={multi ? (nameOf(g.schoolId) || 'School') : 'My classes'}>
                    {g.rows.map((r) => <option key={r.classId} value={r.classId}>{r.label}</option>)}
                  </optgroup>
                ))}
              </select>
              {currentTerm && <span className="rounded-full bg-ks-navy/10 px-3 py-1 text-xs font-black text-ks-navy">{String((currentTerm as Row).name ?? 'Current term')}</span>}
            </div>
            <p className="mt-2 text-xs font-semibold text-ks-muted">Your remark appears on the official report card. Be specific and constructive. Save each student when you finish.</p>
          </Card>
          {!termId ? <Card className="rounded-xl p-8 text-center text-sm text-ks-muted">No current term is set up yet. Ask the administrator.</Card> : <ClassRemarks classId={classId} currentTermId={termId} />}
        </>
      )}
    </TeacherWorkspaceShell>
  );
}
