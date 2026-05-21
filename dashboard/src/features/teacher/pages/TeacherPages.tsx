import { ArrowRight, CheckCircle2, ClipboardCheck, Download, Filter, MessageSquarePlus, Save, Search, Send, ShieldCheck, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { assessments, alerts, marksRows, pairings, students, teacherClasses, timetable } from '../api/teacherApi';
import {
  AlertStaffCard,
  AlertTypeBadge,
  AssessmentStatusBadge,
  AttendanceGrid,
  ClassSubjectCard,
  MarksGrid,
  PairingCard,
  ProgressBar,
  SparkLine,
  TeacherMetricStrip,
  TeacherTable,
  TeacherWorkspaceShell,
  TimetableBoard,
} from '../components/TeacherWorkspaceShell';
import { canSubmitMarks, validateSyllabusProgress } from '../utils/marks';

const firstClass = teacherClasses[0];
const firstAssessment = assessments[0];

export function TeacherHomePage() {
  return (
    <TeacherWorkspaceShell title="Good morning, Mwalimu Rose" eyebrow="Teacher operations desk" action={<Button className="bg-ks-gold text-ks-slate hover:shadow-md hover:shadow-ks-gold/30">Mark Attendance</Button>}>
      <TeacherMetricStrip
        items={[
          { label: 'Lessons today', value: '4', detail: '2 Mathematics, 2 Physics', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
          { label: 'Open marks', value: '3', detail: '90 rows pending', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
          { label: 'Attendance due', value: '1', detail: 'Form 2A Physics', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
          { label: 'Class average', value: '75%', detail: '+4% from last term', inverted: true, icon: ShieldCheck },
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
          <div className="mt-5 space-y-2.5">
            {timetable.slice(0, 4).map((entry) => (
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
        </Card>
        <div className="space-y-gutter">
          <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-rose p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-rose">Urgent task</p>
            <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">Form 2A attendance due</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">Class started 12 minutes ago. Mark present/absent before next period.</p>
            <NavLink to="/teacher/attendance"><Button className="mt-4 w-full">Mark now</Button></NavLink>
          </Card>
          <Card className="rounded-xl p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Open marks queue</p>
            <div className="mt-3 space-y-2.5">
              {assessments.filter((item) => item.status !== 'APPROVED').map((item) => (
                <NavLink key={item.id} to={`/teacher/assessments/${item.id}/marks`} className="block rounded-xl border border-ks-line p-3 transition hover:border-ks-blue/30 hover:bg-ks-paper">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-ks-slate">{item.title}</p>
                    <AssessmentStatusBadge status={item.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={(item.entered / item.total) * 100} tone="bg-ks-amber" className="flex-1" />
                    <span className="shrink-0 text-[11px] font-bold text-ks-muted">{item.entered}/{item.total}</span>
                  </div>
                </NavLink>
              ))}
            </div>
          </Card>
        </div>
      </div>
      <div className="grid gap-gutter xl:grid-cols-3">
        {teacherClasses.map((item) => <ClassSubjectCard key={item.id} item={item} />)}
      </div>
    </TeacherWorkspaceShell>
  );
}

export function TeacherClassesPage() {
  return (
    <TeacherWorkspaceShell title="My Classes" eyebrow="Assigned class-subjects">
      <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
        <Filter className="h-4 w-4 text-ks-muted" />
        <span className="text-xs font-black uppercase tracking-wider text-ks-muted">Filter:</span>
        {['All subjects', 'All forms', 'Operational status', 'Syllabus risk'].map((item) => (
          <button key={item} className="rounded-full border border-ks-line bg-ks-paper px-3 py-1 text-xs font-bold text-ks-muted transition hover:border-ks-blue hover:text-ks-blue">{item}</button>
        ))}
      </Card>
      <div className="grid gap-gutter xl:grid-cols-3">
        {teacherClasses.map((item) => <ClassSubjectCard key={item.id} item={item} />)}
      </div>
      <ClassSubjectsTable />
    </TeacherWorkspaceShell>
  );
}

export function ClassWorkspacePage() {
  const klass = useClassSubject();
  return (
    <TeacherWorkspaceShell title={`${klass.subject} · ${klass.className}`} eyebrow="Class command workspace">
      <WorkspaceTabs id={klass.id} />
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="space-y-gutter">
          <TeacherMetricStrip items={[
            { label: 'Class average', value: `${klass.average}%`, detail: 'Trend is stable', tone: 'bg-ks-blue', valueColor: klass.average >= 75 ? 'text-ks-emerald' : klass.average >= 60 ? 'text-ks-amber' : 'text-ks-rose' },
            { label: 'Attendance', value: `${klass.attendance}%`, detail: 'Above target', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
            { label: 'Syllabus', value: `${klass.syllabus}%`, detail: `${100 - klass.syllabus}% remaining`, tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
            { label: 'Open marks', value: String(klass.openAssessments), detail: 'Need completion', inverted: true, icon: ShieldCheck },
          ]} />
          <Card className="rounded-xl p-5">
            <SectionTitle title="Students needing attention" action="/teacher/performance/alerts" />
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {alerts.slice(0, 2).map((alert) => <AlertStaffCard key={alert.id} alert={alert} />)}
            </div>
          </Card>
          <AssessmentMiniTable />
        </div>
        <Card className="sticky top-24 h-fit overflow-hidden rounded-xl border-l-4 border-l-ks-gold p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Next action</p>
          <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">Complete marks before HOD review</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-ks-muted">Six rows remain in Midterm Mathematics. Finish and submit to HOD.</p>
          <div className="mt-4 space-y-2.5 [&_a]:block">
            <NavLink to={`/teacher/assessments/${firstAssessment.id}/marks`}><Button className="w-full">Enter marks</Button></NavLink>
            <NavLink to={`/teacher/classes/${klass.id}/analytics`}><Button variant="secondary" className="w-full">View analytics</Button></NavLink>
          </div>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function ClassStudentsPage() {
  const klass = useClassSubject();
  return (
    <TeacherWorkspaceShell title={`${klass.className} Student Directory`} eyebrow={klass.subject}>
      <SearchPanel />
      <StudentsTable />
    </TeacherWorkspaceShell>
  );
}

export function ClassAnalyticsPage() {
  const klass = useClassSubject();
  return (
    <TeacherWorkspaceShell title={`${klass.className} Analytics`} eyebrow={klass.subject}>
      <TeacherMetricStrip items={[
        { label: 'Median score', value: '74%', detail: 'Healthy distribution', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Top improvers', value: '6', detail: 'Gained 10+ points', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'At risk', value: '3', detail: 'Need intervention', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'Attendance correlation', value: '0.68', detail: 'Strong positive link', inverted: true, icon: ShieldCheck },
      ]} />
      <AnalyticsGrid />
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
  const assessment = useAssessment();
  const completion = Math.round((assessment.entered / assessment.total) * 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (completion / 100) * circumference;
  const readinessItems = [
    { label: 'No over-max scores', ok: true },
    { label: 'Absent rows excluded', ok: true },
    { label: `${assessment.total - assessment.entered} rows still missing`, ok: false },
    { label: 'Autosave pulse ready', ok: true },
  ];
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
                <Button variant="secondary"><Save className="h-4 w-4" /> Bulk save</Button>
                <NavLink to={`/teacher/assessments/${assessment.id}/submit`}><Button>Review & submit</Button></NavLink>
              </div>
            </div>
            <ProgressBar value={completion} tone="bg-ks-blue" className="mt-3" />
          </div>
          <MarksGrid rows={marksRows} maxScore={assessment.maxScore} />
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
  const assessment = useAssessment();
  const [confirmed, setConfirmed] = useState(false);
  const ready = canSubmitMarks(marksRows.map((row) => ({ ...row, state: row.state === 'dirty' ? 'saved' : row.state })), assessment.maxScore);
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
          <Button disabled={!confirmed || !ready} className="mt-5 w-full">
            <Send className="h-4 w-4" /> Submit to HOD
          </Button>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function MarksReviewPage() {
  const assessment = useAssessment();
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
      <MarksGrid rows={marksRows.map((row) => ({ ...row, state: 'saved' }))} maxScore={assessment.maxScore} />
    </TeacherWorkspaceShell>
  );
}

export function AttendancePage() {
  return (
    <TeacherWorkspaceShell title="Attendance Marking" eyebrow="Today sessions">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <AttendanceGrid students={students} />
        <div className="sticky top-24 space-y-gutter">
          <Card className="overflow-hidden rounded-xl border-l-4 border-l-ks-emerald p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Session summary</p>
            <h3 className="mt-2 font-display text-2xl font-black text-ks-slate">Form 2A · Physics</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <AttendanceStat label="Present" value="34" color="text-ks-emerald" bg="bg-ks-emerald/10" />
              <AttendanceStat label="Absent" value="2" color="text-ks-rose" bg="bg-ks-rose/10" />
              <AttendanceStat label="Late" value="1" color="text-ks-amber" bg="bg-ks-amber/10" />
              <AttendanceStat label="Unmarked" value="1" color="text-ks-muted" bg="bg-ks-paper" />
            </div>
            <div className="mt-4">
              <ProgressBar value={(34 / 38) * 100} tone="bg-ks-emerald" />
              <p className="mt-1 text-center text-xs font-bold text-ks-muted">89% present rate</p>
            </div>
            <Button className="mt-4 w-full">Submit attendance</Button>
          </Card>
        </div>
      </div>
    </TeacherWorkspaceShell>
  );
}

export function AttendanceHistoryPage() {
  return (
    <TeacherWorkspaceShell title="Attendance History" eyebrow="Submitted sessions">
      <TeacherTable columns={['Date', 'Time', 'Class', 'Subject', 'Present', 'Absent', 'Late', 'Submitted', 'Actions']}>
        {timetable.map((entry) => (
          <tr key={entry.id} className="hover:bg-ks-paper">
            <Td>May 20</Td>
            <Td>{entry.time}</Td>
            <Td>{entry.className}</Td>
            <Td>{entry.subject}</Td>
            <Td><span className="font-bold text-ks-emerald">36</span></Td>
            <Td><span className="font-bold text-ks-rose">2</span></Td>
            <Td><span className="font-bold text-ks-amber">1</span></Td>
            <Td>Today</Td>
            <Td><Button variant="secondary" className="py-1.5 text-xs">Export</Button></Td>
          </tr>
        ))}
      </TeacherTable>
    </TeacherWorkspaceShell>
  );
}

export function PerformanceAlertsPage() {
  return (
    <TeacherWorkspaceShell title="Performance Alerts" eyebrow="Actionable student risks">
      <TeacherMetricStrip items={[
        { label: 'Critical alerts', value: '01', detail: 'Immediate action required', tone: 'bg-ks-rose', valueColor: 'text-ks-rose' },
        { label: 'At risk', value: '01', detail: 'Sliding grade trends', tone: 'bg-ks-amber', valueColor: 'text-ks-amber' },
        { label: 'Peer pairings', value: '02', detail: 'Pending activation', tone: 'bg-ks-sky', valueColor: 'text-ks-sky' },
        { label: 'Workspace health', value: '92%', detail: 'Teacher action readiness', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid grid-cols-12 gap-gutter">
        <section className="col-span-12 space-y-stack-lg xl:col-span-8">
          <AlertsOperationalTable />
          <PredictionPanel />
        </section>
        <section className="col-span-12 space-y-stack-lg xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-black text-ks-navy">Peer Pairings</h2>
            <span className="rounded-full bg-ks-sky px-2.5 py-1 text-[10px] font-black text-white">2 PENDING</span>
          </div>
          {pairings.map((pairing) => (
            <NavLink key={pairing.id} to={`/teacher/performance/pairings/${pairing.id}`} className="block">
              <PairingCard pairing={pairing} />
            </NavLink>
          ))}
          <AcademicSpotlight />
        </section>
      </div>
      {/* FAB for manual pairing */}
      <button className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ks-gold shadow-2xl shadow-ks-gold/30 transition-all hover:scale-110 hover:shadow-ks-gold/40 active:scale-95 group">
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
  const alert = alerts.find((item) => item.id === id) ?? alerts[0];
  return (
    <TeacherWorkspaceShell title={alert.student} eyebrow={alert.type}>
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <AlertStaffCard alert={alert} />
        <ActionPanel title="Recommended intervention" actions={['Resolve alert', 'Create intervention', 'Open profile']} />
      </div>
      <AnalyticsGrid />
    </TeacherWorkspaceShell>
  );
}

export function PeerPairingsPage() {
  return (
    <TeacherWorkspaceShell title="Peer Pairings" eyebrow="Student support suggestions">
      <TeacherMetricStrip items={[
        { label: 'Suggested', value: '2', detail: 'Awaiting action', tone: 'bg-ks-blue', valueColor: 'text-ks-blue' },
        { label: 'Active', value: '4', detail: 'Current support', tone: 'bg-ks-emerald', valueColor: 'text-ks-emerald' },
        { label: 'Completed', value: '11', detail: 'This term', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'Effectiveness', value: '78%', detail: 'Average grade lift', inverted: true, icon: ShieldCheck },
      ]} />
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <div className="grid gap-gutter">
          {pairings.map((pairing) => (
            <NavLink key={pairing.id} to={`/teacher/performance/pairings/${pairing.id}`}>
              <PairingCard pairing={pairing} />
            </NavLink>
          ))}
        </div>
        <AcademicSpotlight />
      </div>
    </TeacherWorkspaceShell>
  );
}

export function PairingDetailPage() {
  const { id } = useParams();
  const pairing = pairings.find((item) => item.id === id) ?? pairings[0];
  return (
    <TeacherWorkspaceShell title={`${pairing.mentor} + ${pairing.support}`} eyebrow="Pairing detail">
      <div className="grid gap-gutter xl:grid-cols-[1fr_360px]">
        <PairingCard pairing={pairing} />
        <ActionPanel title="Record outcome" actions={['Activate', 'Reject', 'Complete pairing', 'Create intervention']} />
      </div>
    </TeacherWorkspaceShell>
  );
}

export function StudentPerformancePage() {
  const { studentId } = useParams();
  const student = students.find((item) => item.id === studentId) ?? students[0];
  const avgColor = student.average >= 75 ? 'text-ks-emerald' : student.average >= 60 ? 'text-ks-amber' : 'text-ks-rose';
  const avgTone = student.average >= 75 ? 'bg-ks-emerald' : student.average >= 60 ? 'bg-ks-amber' : 'bg-ks-rose';
  return (
    <TeacherWorkspaceShell title={student.name} eyebrow="Student performance profile">
      <TeacherMetricStrip items={[
        { label: 'Average', value: `${student.average}%`, detail: student.alert, tone: avgTone, valueColor: avgColor },
        { label: 'Attendance', value: `${student.attendance}%`, detail: 'Current term', tone: 'bg-ks-emerald', valueColor: student.attendance >= 85 ? 'text-ks-emerald' : 'text-ks-amber' },
        { label: 'Last score', value: student.lastAssessment, detail: 'Most recent assessment', tone: 'bg-ks-gold', valueColor: 'text-ks-amber' },
        { label: 'Interventions', value: '2', detail: 'One open follow-up', inverted: true, icon: ShieldCheck },
      ]} />
      <AnalyticsGrid />
    </TeacherWorkspaceShell>
  );
}

export function TimetablePage() {
  return (
    <TeacherWorkspaceShell title="Weekly Timetable" eyebrow="Teaching periods">
      <TimetableBoard entries={timetable} />
    </TeacherWorkspaceShell>
  );
}

export function SyllabusPage() {
  const valid = validateSyllabusProgress(17, 24);
  return (
    <TeacherWorkspaceShell title="Syllabus Tracker" eyebrow="Coverage editor">
      <TeacherTable columns={['Class', 'Subject', 'Covered', 'Total', 'Progress', 'Risk', 'Action']}>
        {teacherClasses.map((klass) => {
          const covered = Math.round((klass.syllabus / 100) * 24);
          const barTone = klass.risk === 'HIGH' ? 'bg-ks-rose' : klass.risk === 'MEDIUM' ? 'bg-ks-amber' : 'bg-ks-emerald';
          return (
            <tr key={klass.id} className="hover:bg-ks-paper">
              <Td>{klass.className}</Td>
              <Td>{klass.subject}</Td>
              <Td><span className="font-black text-ks-slate">{covered}</span></Td>
              <Td>24</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <ProgressBar value={klass.syllabus} tone={barTone} className="w-24" />
                  <span className="text-xs font-bold text-ks-muted">{klass.syllabus}%</span>
                </div>
              </Td>
              <Td><Badge tone={klass.risk === 'HIGH' ? 'rose' : klass.risk === 'MEDIUM' ? 'amber' : 'emerald'}>{klass.risk}</Badge></Td>
              <Td><Button variant="secondary" className="py-1.5 text-xs">Update</Button></Td>
            </tr>
          );
        })}
      </TeacherTable>
      <Card className="rounded-xl p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className={`h-5 w-5 ${valid ? 'text-ks-emerald' : 'text-ks-rose'}`} />
          <p className="font-bold text-ks-slate">
            Validation: {valid ? 'All covered topics are within total topic counts.' : 'Invalid progress detected — review entries.'}
          </p>
        </div>
      </Card>
    </TeacherWorkspaceShell>
  );
}

const announcementItems = [
  { body: 'Form 3A Mathematics revision set is now available on the portal. Students should complete exercises 1–12 before Friday.', audience: 'Students + Parents', tone: 'blue' as const },
  { body: 'Physics lab report is due this Friday. Remind students to follow the standard format for the cover page and data section.', audience: 'Students', tone: 'amber' as const },
];

export function TeacherAnnouncementsPage() {
  return (
    <TeacherWorkspaceShell title="Teacher Announcements" eyebrow="Class communication">
      <Card className="rounded-xl p-5">
        <SectionTitle title="Active announcements" action="/teacher/announcements/create" />
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {announcementItems.map((item) => (
            <Card key={item.body} className="flex flex-col gap-3 rounded-xl p-4">
              <p className="flex-1 text-sm font-semibold leading-6 text-ks-slate">{item.body}</p>
              <div className="flex items-center justify-between gap-2">
                <Badge tone={item.tone}>{item.audience}</Badge>
                <button className="text-xs font-black text-ks-blue hover:underline">Edit</button>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </TeacherWorkspaceShell>
  );
}

export function CreateTeacherAnnouncementPage() {
  return <FormPage title="Create Announcement" eyebrow="Teacher communication" icon={<MessageSquarePlus className="h-5 w-5" />} fields={['Title', 'Body', 'Priority', 'Audience roles', 'Class targets', 'Publish time']} preview="Live announcement preview appears here for parents and students." />;
}

export function CreateInterventionPage() {
  return <FormPage title="Create Intervention" eyebrow="Student support" icon={<ClipboardCheck className="h-5 w-5" />} fields={['Student', 'Subject', 'Intervention type', 'Notes', 'Follow-up date', 'Related alert']} preview="Intervention record preview with follow-up accountability." />;
}

const exportItems: Array<{ title: string; description: string; format: string }> = [
  { title: 'Class list', description: 'All students in your assigned classes with registration numbers.', format: 'CSV' },
  { title: 'Attendance history', description: 'All submitted attendance sessions for the current term.', format: 'PDF' },
  { title: 'Blank marks sheet', description: 'Pre-filled student list ready for offline marks entry.', format: 'CSV' },
  { title: 'Submitted marks', description: 'Approved assessment marks with HOD sign-off record.', format: 'PDF' },
  { title: 'Syllabus coverage', description: 'Topic-by-topic coverage with completion status and risks.', format: 'PDF' },
  { title: 'Student snapshot', description: 'Performance, attendance and intervention summary per student.', format: 'PDF' },
];

export function TeacherExportsPage() {
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
            <Button variant="secondary" className="mt-4 w-full">Generate</Button>
          </Card>
        ))}
      </div>
    </TeacherWorkspaceShell>
  );
}

// ─── Internal sub-components ────────────────────────────────────────────────

function ClassSubjectsTable() {
  return (
    <TeacherTable columns={['Class', 'Subject', 'Students', 'Average', 'Attendance', 'Syllabus', 'Open marks', 'Next lesson', 'Actions']}>
      {teacherClasses.map((item) => (
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
        {alerts.map((alert) => (
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
  return (
    <TeacherTable columns={['Assessment', 'Class', 'Subject', 'Type', 'Max', 'Status', 'Progress', 'Due', 'Actions']}>
      {assessments.map((item) => (
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

function StudentsTable() {
  return (
    <TeacherTable columns={['Roll', 'Student', 'Registration', 'Average', 'Attendance', 'Alert', 'Last score', 'Actions']}>
      {students.map((student) => (
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

// Average score trend data (6 assessments)
const trendData = [58, 63, 61, 68, 71, 74];
// Grade band distribution
const gradeBands = [
  { label: 'A (80–100)', count: 8, pct: 19, color: 'bg-ks-emerald' },
  { label: 'B (65–79)', count: 14, pct: 33, color: 'bg-ks-blue' },
  { label: 'C (50–64)', count: 12, pct: 29, color: 'bg-ks-amber' },
  { label: 'D (<50)', count: 8, pct: 19, color: 'bg-ks-rose' },
];

function AnalyticsGrid() {
  return (
    <div className="grid gap-gutter xl:grid-cols-3">
      {/* Chart 1: Average score trend line chart */}
      <Card className="overflow-hidden rounded-xl p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Average trend</p>
        <p className="mt-1 font-display text-2xl font-black text-ks-slate">+16 pts</p>
        <p className="text-xs font-semibold text-ks-emerald">↑ Steady recovery over 6 assessments</p>
        <div className="mt-4 rounded-xl bg-[linear-gradient(180deg,#f0f9ff,#e0f2fe)] p-4">
          <svg viewBox="0 0 200 80" className="w-full overflow-visible">
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0284C7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284C7" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 25, 50, 75].map((y) => (
              <line key={y} x1="0" y1={y} x2="200" y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="4 4" />
            ))}
            {(() => {
              const max = 100; const min = 40; const range = max - min;
              const pts = trendData.map((v, i) => `${(i / (trendData.length - 1)) * 200},${75 - ((v - min) / range) * 70}`);
              const area = `${pts.join(' ')} 200,75 0,75`;
              return (
                <>
                  <polygon points={area} fill="url(#trendFill)" />
                  <polyline points={pts.join(' ')} fill="none" stroke="#0284C7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {trendData.map((v, i) => {
                    const x = (i / (trendData.length - 1)) * 200;
                    const y = 75 - ((v - min) / range) * 70;
                    return <circle key={i} cx={x} cy={y} r="3.5" fill="#0284C7" stroke="white" strokeWidth="1.5" />;
                  })}
                  <text x="196" y={75 - ((trendData[trendData.length - 1] - min) / range) * 70 - 7} textAnchor="end" fontSize="9" fontWeight="700" fill="#0284C7">{trendData[trendData.length - 1]}%</text>
                </>
              );
            })()}
          </svg>
          <div className="mt-1 flex justify-between text-[10px] font-bold text-ks-muted">
            {['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'].map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>
      </Card>

      {/* Chart 2: Grade distribution horizontal bars */}
      <Card className="overflow-hidden rounded-xl p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Grade distribution</p>
        <p className="mt-1 font-display text-2xl font-black text-ks-slate">42 students</p>
        <p className="text-xs font-semibold text-ks-muted">Most sit between B and C</p>
        <div className="mt-4 space-y-3">
          {gradeBands.map((band) => (
            <div key={band.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-bold text-ks-slate">{band.label}</span>
                <span className="font-black text-ks-muted">{band.count} students</span>
              </div>
              <div className="h-6 overflow-hidden rounded-md bg-ks-line">
                <div className={`h-full rounded-md transition-all duration-500 ${band.color}`} style={{ width: `${band.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-ks-rose/20 bg-ks-rose/5 p-2.5 text-center text-xs font-bold text-ks-rose">
          8 students in D band need intervention
        </div>
      </Card>

      {/* Chart 3: Next action insight with sparklines */}
      <Card className="overflow-hidden rounded-xl p-5">
        <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">Next action insight</p>
        <p className="mt-1 font-display text-2xl font-black text-ks-slate">3 actions</p>
        <p className="text-xs font-semibold text-ks-muted">AI-recommended interventions</p>
        <div className="mt-4 space-y-3">
          {[
            { name: 'Kassim Majaliwa', action: 'Schedule review session', trend: [72, 68, 58, 52, 44, 38], color: '#F43F5E' },
            { name: 'Sarah Peter', action: 'Pair with Joel Komba', trend: [60, 58, 61, 57, 59, 57], color: '#F59E0B' },
            { name: 'Emmanuel John', action: 'Lab report coaching', trend: [60, 58, 55, 54, 52, 51], color: '#F59E0B' },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-ks-line bg-ks-paper p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-ks-slate">{item.name}</p>
                <p className="truncate text-xs font-semibold text-ks-muted">{item.action}</p>
              </div>
              <SparkLine data={item.trend} color={item.color} />
            </div>
          ))}
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

function SearchPanel() {
  return (
    <Card className="flex flex-wrap items-center gap-3 rounded-xl p-4">
      <Search className="h-5 w-5 shrink-0 text-ks-muted" />
      <input className="min-w-64 flex-1 bg-transparent font-semibold outline-none placeholder:font-normal placeholder:text-ks-muted" placeholder="Search by name, roll number, registration..." />
      <div className="flex flex-wrap gap-2">
        <Badge tone="rose">At risk</Badge>
        <Badge tone="amber">Attendance low</Badge>
        <Badge tone="blue">Missing marks</Badge>
      </div>
    </Card>
  );
}

function FormPage({ title, eyebrow, icon, fields, preview }: { title: string; eyebrow: string; icon: ReactNode; fields: string[]; preview: string }) {
  return (
    <TeacherWorkspaceShell title={title} eyebrow={eyebrow}>
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="rounded-xl p-5">
          <div className="flex items-center gap-3">
            {icon}
            <SectionTitle title={title} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <label key={field} className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">{field}</span>
                <input className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" />
              </label>
            ))}
          </div>
          <Button className="mt-5">Save draft</Button>
        </Card>
        <Card className="sticky top-24 h-fit rounded-xl p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">Preview</p>
          <p className="mt-3 rounded-xl bg-ks-paper p-4 text-sm font-semibold leading-7 text-ks-slate">{preview}</p>
        </Card>
      </div>
    </TeacherWorkspaceShell>
  );
}

function ActionPanel({ title, actions }: { title: string; actions: string[] }) {
  return (
    <Card className="sticky top-24 h-fit rounded-xl border-l-4 border-l-ks-blue p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-ks-muted">{title}</p>
      <div className="mt-4 space-y-2">
        {actions.map((action) => (
          <Button
            key={action}
            variant={action.toLowerCase().includes('reject') ? 'danger' : 'secondary'}
            className="w-full justify-between"
          >
            {action}
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
  return useMemo(() => teacherClasses.find((item) => item.id === classSubjectId) ?? firstClass, [classSubjectId]);
}

function useAssessment() {
  const { assessmentId } = useParams();
  return useMemo(() => assessments.find((item) => item.id === assessmentId) ?? firstAssessment, [assessmentId]);
}
