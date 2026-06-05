import React, { useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import {
  useAllAssessments,
  useAllTimetables,
  useAssessmentMarksSheet,
  usePublishReadiness,
  useReportCatalog,
  useReportJobs,
  useCreateTimetableMutation,
  useAnalyticsOverview,
  useAcademicOverview,
  useOperationsFinanceOverview,
  useAttendanceOverview,
  useEnrolmentAnalytics,
} from '../api/operations.hooks';
import { AnalyticsInsightPanel, BulkMarksGrid, ChartCard, ExportCenterDrawer, MarksReviewPanel, OperationsShell, OperationsTable, ReportBuilderCanvas, ReportPreviewFrame, ReportTile, Td, TimetableMatrix } from '../components/OperationsWorkspace';

export function ReportsHomePage() {
  const { data: apiCatalog = [], isLoading: catLoading } = useReportCatalog() as { data: Array<Record<string, unknown>>; isLoading: boolean };
  const { data: apiJobs = [], isLoading: jobsLoading } = useReportJobs() as { data: Array<Record<string, unknown>>; isLoading: boolean };
  return (
    <OperationsShell title="Reports Home" eyebrow="Cross-role reports catalog">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">
          {catLoading && <SkeletonTable cols={3} />}
          {!catLoading && apiCatalog.length === 0 && <EmptyState title="No report catalog" description="Reports will appear here once generated." />}
          {apiCatalog.map((report) => (
            <ReportTile key={String(report.id)} title={String(report.title ?? '')} detail={`${String(report.domain ?? '')} / ${(Array.isArray(report.roles) ? report.roles : []).join(', ')}`} to="/reports/builder" />
          ))}
        </div>
        <ExportCenterDrawer jobs={jobsLoading ? [] : apiJobs as Parameters<typeof ExportCenterDrawer>[0]['jobs']} />
      </div>
    </OperationsShell>
  );
}

export function ReportBuilderPage() {
  return <OperationsShell title="Report Builder" eyebrow="Guided audited generation"><ReportBuilderCanvas /></OperationsShell>;
}

export function ReportJobsPage() {
  return <OperationsShell title="Report Jobs" eyebrow="Generation queue"><JobsTable /></OperationsShell>;
}

function JobsTable() {
  const { data: apiJobs = [], isLoading, isError, refetch } = useReportJobs() as { data: Array<Record<string, unknown>>; isLoading: boolean; isError: boolean; refetch: () => void };
  if (isLoading) return <SkeletonTable cols={8} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (apiJobs.length === 0) return <EmptyState title="No report jobs" description="Report generation jobs will appear here." />;
  return (
    <OperationsTable columns={['Job', 'Status', 'Requested By', 'Role', 'Scope', 'Format', 'Created', 'Actions']}>
      {apiJobs.map((job) => {
        const status = String(job.status ?? '');
        return (
          <tr key={String(job.id)}>
            <Td>{String(job.name ?? '')}</Td>
            <Td><Badge tone={status === 'COMPLETED' ? 'emerald' : status === 'FAILED' ? 'rose' : 'amber'}>{status}</Badge></Td>
            <Td>{String(job.requestedBy ?? '—')}</Td>
            <Td>{String(job.role ?? '—')}</Td>
            <Td>{String(job.scope ?? '—')}</Td>
            <Td>{String(job.format ?? '—')}</Td>
            <Td>{String(job.created ?? job.createdAt ?? '').slice(0, 10)}</Td>
            <Td><NavLink className="font-black text-ks-blue" to={`/reports/jobs/${String(job.id)}`}>Open</NavLink></Td>
          </tr>
        );
      })}
    </OperationsTable>
  );
}

export function ReportJobDetailPage() {
  const { id } = useParams();
  const { data: apiJobs = [], isLoading } = useReportJobs() as { data: Array<Record<string, unknown>>; isLoading: boolean };
  if (isLoading) return <OperationsShell title="Loading…" eyebrow="Report job detail"><SkeletonTable cols={4} /></OperationsShell>;
  const job = apiJobs.find((item) => String(item.id) === id) ?? null;
  if (!job) return <OperationsShell title="Not Found" eyebrow="Report job detail"><EmptyState title="Report job not found" description="This report job no longer exists." /></OperationsShell>;
  return (
    <OperationsShell title={String(job.name ?? 'Report')} eyebrow="Report job detail">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <ReportPreviewFrame title={String(job.name ?? 'Report')} />
        <ExportCenterDrawer jobs={[job] as Parameters<typeof ExportCenterDrawer>[0]['jobs']} />
      </div>
    </OperationsShell>
  );
}

export function DownloadCenterPage() {
  const { data: apiJobs = [] } = useReportJobs() as { data: Array<Record<string, unknown>> };
  return <OperationsShell title="Download Center" eyebrow="Completed files and expiries"><ExportCenterDrawer jobs={apiJobs as Parameters<typeof ExportCenterDrawer>[0]['jobs']} /></OperationsShell>;
}

export function ScheduledReportsPage() {
  return (
    <OperationsShell title="Scheduled Reports" eyebrow="Recurring report automation">
      <EmptyState title="Scheduled reports not yet configured" description="Recurring report schedules will be managed here once the scheduling service is enabled." />
      <JobsTable />
    </OperationsShell>
  );
}

export function ReportTemplatesPage() {
  const { data: apiCatalog = [], isLoading } = useReportCatalog() as { data: Array<Record<string, unknown>>; isLoading: boolean };
  return (
    <OperationsShell title="Report Templates" eyebrow="Reusable report definitions">
      {isLoading ? <SkeletonTable cols={3} /> : apiCatalog.length === 0 ? (
        <EmptyState title="No templates" description="Report templates will appear here once configured." />
      ) : (
        <div className="grid gap-gutter xl:grid-cols-3">
          {apiCatalog.map((report) => (
            <ReportTile key={String(report.id)} title={String(report.title ?? '')} detail="Template-ready report definition." to="/reports/builder" />
          ))}
        </div>
      )}
    </OperationsShell>
  );
}

export function ReportAccessAuditPage() {
  return (
    <OperationsShell title="Report Access Audit" eyebrow="Sensitive export audit">
      <JobsTable />
    </OperationsShell>
  );
}

export function BulkMarksWorkspacePage() {
  const { data: rawAssessments = [], isLoading, isError, refetch } = useAllAssessments() as { data: Record<string, unknown>[]; isLoading: boolean; isError: boolean; refetch: () => void };
  return (
    <OperationsShell title="Bulk Marks Workspace" eyebrow="Spreadsheet-grade entry">
      {isLoading ? <SkeletonTable cols={9} /> : isError ? <DataError onRetry={refetch} /> : rawAssessments.length === 0 ? <EmptyState title="No assessments" description="Assessments will appear here once submitted by teachers." /> : (
      <OperationsTable columns={['Assessment', 'Class', 'Subject', 'Type', 'Max', 'Status', 'Teacher', 'Last Edited', 'Actions']}>
        {rawAssessments.map((item) => {
          const id = String(item.id ?? '');
          return (
            <tr key={id}>
              <Td>{String(item.assessment ?? item.name ?? item.title ?? '')}</Td>
              <Td>{String(item.className ?? item.classId ?? '')}</Td>
              <Td>{String(item.subject ?? item.subjectId ?? '')}</Td>
              <Td>{String(item.type ?? '')}</Td>
              <Td>{String(item.max ?? item.maxScore ?? '')}</Td>
              <Td>{String(item.status ?? '')}</Td>
              <Td>{String(item.teacher ?? item.teacherName ?? '')}</Td>
              <Td>{String(item.lastEdited ?? item.updatedAt ?? '').slice(0, 10)}</Td>
              <Td><NavLink className="font-black text-ks-blue" to={`/academics/marks/bulk/${id}`}>Open Sheet</NavLink></Td>
            </tr>
          );
        })}
      </OperationsTable>
      )}
    </OperationsShell>
  );
}

export function BulkMarksSheetPage() {
  const { assessmentId } = useParams();
  const { data: rawAssessments = [], isLoading: assLoading } = useAllAssessments() as { data: Record<string, unknown>[]; isLoading: boolean };
  const { data: apiMarks = [], isLoading: marksLoading } = useAssessmentMarksSheet(assessmentId) as { data: Record<string, unknown>[]; isLoading: boolean };
  const assessment = rawAssessments.find((item) => String(item.id) === assessmentId) ?? null;
  const title = String(assessment?.assessment ?? assessment?.name ?? assessment?.title ?? 'Marks Sheet');
  if (assLoading || marksLoading) return <OperationsShell title="Loading…" eyebrow="Bulk marks sheet"><SkeletonTable cols={6} /></OperationsShell>;
  return (
    <OperationsShell title={title} eyebrow="Bulk marks sheet">
      {apiMarks.length === 0
        ? <EmptyState title="No marks data" description="Marks will appear here once the assessment is opened for entry." />
        : <BulkMarksGrid rows={apiMarks as Parameters<typeof BulkMarksGrid>[0]['rows']} />}
    </OperationsShell>
  );
}

export function MarksReviewWorkspacePage() {
  return <OperationsShell title="Marks Review Workspace" eyebrow="Approval and validation"><MarksReviewPanel /></OperationsShell>;
}

export function ResultsWorkspacePage() {
  return <OperationsShell title="Results Workspace" eyebrow="Class and term readiness"><ResultsTable /></OperationsShell>;
}

function ResultsTable() {
  const { data: readiness, isLoading, isError, refetch } = usePublishReadiness() as { data: { classes?: Array<Record<string, unknown>> } | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const apiResultClasses = (readiness?.classes ?? []) as Array<Record<string, unknown>>;
  if (isLoading) return <SkeletonTable cols={6} />;
  if (isError) return <DataError onRetry={refetch} />;
  if (apiResultClasses.length === 0) return <EmptyState title="No results data" description="Class results will appear here once marks are locked and finalised." />;
  return (
    <OperationsTable columns={['Class', 'Students', 'Status', 'Blockers', 'Readiness', 'Actions']}>
      {apiResultClasses.map((item) => {
        const classId = String(item.classId ?? item.id ?? '');
        const termId = String(item.termId ?? 'current');
        const status = String(item.status ?? item.readinessStatus ?? '—');
        return (
          <tr key={classId}>
            <Td>{String(item.className ?? item.class ?? classId)}</Td>
            <Td>{String(item.students ?? item.studentCount ?? '—')}</Td>
            <Td><Badge tone={status === 'READY' ? 'emerald' : 'rose'}>{status}</Badge></Td>
            <Td>{String(item.blockers ?? item.missingItems ?? '0')}</Td>
            <Td>{String(item.readiness ?? item.reportCardReadiness ?? '0')}%</Td>
            <Td><NavLink className="font-black text-ks-blue" to={`/academics/results/class/${classId}/${termId}`}>Review</NavLink></Td>
          </tr>
        );
      })}
    </OperationsTable>
  );
}

export function ClassResultsReviewPage() {
  const { classId, termId } = useParams();
  return <OperationsShell title={`${classId ?? 'Class'} Results`} eyebrow={`Term ${termId ?? 'review'}`}><ReportPreviewFrame title="Class Results Review" /><ResultsTable /></OperationsShell>;
}

export function ResultsPublishingSupportPage() {
  return <OperationsShell title="Results Publishing Support" eyebrow="Readiness checks and blockers"><ResultsTable /></OperationsShell>;
}

export function ReportCardGenerationCenterPage() {
  const { data: readiness, isLoading } = usePublishReadiness() as { data: { classes?: Array<Record<string, unknown>> } | undefined; isLoading: boolean };
  const apiResultClasses = (readiness?.classes ?? []) as Array<Record<string, unknown>>;
  return (
    <OperationsShell title="Report Card Generation Center" eyebrow="Generate, preview, download">
      {isLoading ? <SkeletonTable cols={3} /> : apiResultClasses.length === 0 ? (
        <EmptyState title="No classes ready" description="Classes will appear here once marks are finalised." />
      ) : (
        <div className="grid gap-gutter xl:grid-cols-3">
          {apiResultClasses.map((item) => {
            const classId = String(item.classId ?? item.id ?? '');
            const termId = String(item.termId ?? 'current');
            return (
              <ReportTile key={classId} title={String(item.className ?? classId)} detail={`${String(item.students ?? '—')} cards / ${String(item.readiness ?? item.reportCardReadiness ?? '—')}% ready`} to={`/academics/report-cards/${classId}/${termId}`} />
            );
          })}
        </div>
      )}
    </OperationsShell>
  );
}

export function ReportCardPreviewPage() {
  return <OperationsShell title="Report Card Preview" eyebrow="PDF-style report card"><ReportPreviewFrame title="Student Report Card" /></OperationsShell>;
}

export function AnalyticsWorkspacePage() {
  return <OperationsShell title="Analytics Workspace" eyebrow="Unified analytics landing"><AnalyticsGrid /></OperationsShell>;
}

function AnalyticsGrid() {
  const { data: overview }  = useAnalyticsOverview()   as { data: Record<string, unknown> | undefined };
  const { data: academic }  = useAcademicOverview()    as { data: Record<string, unknown> | undefined };
  const { data: finance }   = useOperationsFinanceOverview() as { data: Record<string, unknown> | undefined };
  const { data: attendance }= useAttendanceOverview()  as { data: Record<string, unknown> | undefined };
  const { data: enrolment } = useEnrolmentAnalytics()  as { data: Record<string, unknown> | undefined };

  const academicMean  = academic?.schoolAverage  ?? academic?.mean  ?? academic?.average  ?? overview?.academicMean  ?? '—';
  const financeRate   = (finance as Record<string,unknown>)?.billing
    ? `${Math.round(Number(((finance as Record<string,unknown>).billing as Record<string,unknown>)?.collectionRate ?? 0))}%`
    : finance?.collectionRate != null ? `${Math.round(Number(finance.collectionRate))}%` : '—';
  const attendanceRate= attendance?.overallRate   ?? attendance?.average  ?? '—';
  const totalStudents = enrolment?.totalStudents  ?? enrolment?.total     ?? '—';

  const metrics = [
    { label: 'Academic Mean',         value: academicMean  != null ? String(academicMean)   : '—', insight: 'School-wide academic average for current term.' },
    { label: 'Finance Collection',    value: financeRate,                                           insight: 'Fee collection rate against total invoiced.'  },
    { label: 'Attendance Rate',       value: attendanceRate != null ? String(attendanceRate) : '—', insight: 'Overall student attendance rate this term.'    },
    { label: 'Enrolled Students',     value: totalStudents  != null ? String(totalStudents)  : '—', insight: 'Total active student enrolment.'               },
  ];
  return (
    <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <AnalyticsInsightPanel key={metric.label} title={`${metric.label}: ${metric.value}`} insight={metric.insight} />
      ))}
    </div>
  );
}

export function AcademicAnalyticsOpsPage() {
  return (
    <OperationsShell title="Academic Analytics" eyebrow="Academic overview and engine">
      <div className="grid gap-gutter xl:grid-cols-2">
        <ChartCard title="Subject Ranking" values={[54, 66, 78, 82]} />
        <AnalyticsInsightPanel title="Academic Insight" insight="Navigate to AQA for full school-wide analytics and engine controls." />
      </div>
    </OperationsShell>
  );
}

export function ClassAnalyticsDetailPage() {
  const { classId } = useParams();
  return (
    <OperationsShell title={`${classId ?? 'Class'} Analytics`} eyebrow="Class drilldown">
      <div className="grid gap-gutter xl:grid-cols-2">
        <ChartCard title="Performance Trend" values={[60, 64, 67, 71, 74]} />
        <AnalyticsInsightPanel title="Next action" insight="Review at-risk students and check teacher submission timeliness." />
      </div>
    </OperationsShell>
  );
}

export function SubjectAnalyticsDetailPage() {
  const { subjectId } = useParams();
  return (
    <OperationsShell title={`${subjectId ?? 'Subject'} Analytics`} eyebrow="Subject drilldown">
      <div className="grid gap-gutter xl:grid-cols-2">
        <ChartCard title="Subject Trend" values={[55, 58, 61, 59, 64]} />
        <AnalyticsInsightPanel title="Next action" insight="Compare class sections and teacher assignments." />
      </div>
    </OperationsShell>
  );
}

export function TeacherAnalyticsDetailPage() {
  const { teacherId } = useParams();
  return (
    <OperationsShell title={`${teacherId ?? 'Teacher'} Analytics`} eyebrow="Teacher performance pack">
      <div className="grid gap-gutter xl:grid-cols-2">
        <ChartCard title="Submission and performance" values={[42, 58, 76, 84]} />
        <AnalyticsInsightPanel title="Next action" insight="Review timeliness and syllabus completion." />
      </div>
    </OperationsShell>
  );
}

export function StudentAnalyticsDirectoryPage() {
  return (
    <OperationsShell title="Student Analytics Directory" eyebrow="At-risk, improved, top performers">
      <EmptyState
        title="Student analytics"
        description="Navigate to the AQA Performance Command Center for the full at-risk student registry with real-time engine data."
        action={{ label: 'Open AQA Performance', href: '/aqa/performance' }}
      />
    </OperationsShell>
  );
}

export function StudentAnalyticsProfilePage() {
  const { studentId } = useParams();
  return (
    <OperationsShell title={`Student ${studentId ?? ''} Analytics`} eyebrow="Student drilldown">
      <div className="grid gap-gutter xl:grid-cols-2">
        <ChartCard title="Performance Trend" values={[48, 51, 44, 58, 62]} />
        <AnalyticsInsightPanel title="Student Insight" insight="Finance signals are shown only for roles with finance read access." />
      </div>
    </OperationsShell>
  );
}

export function FinanceAnalyticsOpsPage() {
  return (
    <OperationsShell title="Finance Analytics" eyebrow="Collection, assets, forecast">
      <div className="grid gap-gutter xl:grid-cols-3">
        <ChartCard title="Collection" values={[54, 61, 69, 73]} />
        <ChartCard title="Outstanding" values={[118, 86, 62, 45]} />
        <AnalyticsInsightPanel title="Finance Insight" insight="Navigate to the Finance module for live invoice, payment, and collection data." />
      </div>
    </OperationsShell>
  );
}

export function EnrolmentAnalyticsPage() {
  return (
    <OperationsShell title="Enrolment Analytics" eyebrow="Trends and capacity">
      <div className="grid gap-gutter xl:grid-cols-2">
        <ChartCard title="Enrolment Trend" values={[280, 292, 301, 312]} />
        <AnalyticsInsightPanel title="Enrolment Insight" insight="Navigate to Admin → Students for detailed enrolment and class assignment data." />
      </div>
    </OperationsShell>
  );
}

export function TimetableWorkspacePage() {
  const { data: apiTimetables = [], isLoading, isError, refetch } = useAllTimetables() as { data: Array<Record<string, unknown>>; isLoading: boolean; isError: boolean; refetch: () => void };
  if (isLoading) return <OperationsShell title="Timetable Workspace" eyebrow="Search, create, print"><SkeletonTable cols={6} /></OperationsShell>;
  if (isError) return <OperationsShell title="Timetable Workspace" eyebrow="Search, create, print"><DataError onRetry={refetch} /></OperationsShell>;
  return <OperationsShell title="Timetable Workspace" eyebrow="Search, create, print"><TimetableMatrix entries={apiTimetables as Parameters<typeof TimetableMatrix>[0]['entries']} /></OperationsShell>;
}

export function ClassTimetablePage() {
  const { data: apiTimetables = [] } = useAllTimetables() as { data: Array<Record<string, unknown>> };
  return <OperationsShell title="Class Timetable" eyebrow="Class weekly matrix"><TimetableMatrix entries={apiTimetables as Parameters<typeof TimetableMatrix>[0]['entries']} /></OperationsShell>;
}

export function TeacherTimetablePage() {
  const { data: apiTimetables = [] } = useAllTimetables() as { data: Array<Record<string, unknown>> };
  return <OperationsShell title="Teacher Timetable" eyebrow="Teacher weekly matrix"><TimetableMatrix entries={apiTimetables as Parameters<typeof TimetableMatrix>[0]['entries']} /></OperationsShell>;
}

export function CreateTimetableEntryPage() {
  const navigate = useNavigate();
  const createMutation = useCreateTimetableMutation();
  const [form, setForm] = useState({ classId: '', subject: '', teacher: '', day: '', startTime: '', endTime: '', room: '', termId: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.classId || !form.subject || !form.day || !form.startTime || !form.endTime) {
      toast('Class, subject, day, and times are required', 'warning');
      return;
    }
    createMutation.mutate({ classId: form.classId, subject: form.subject, teacher: form.teacher || undefined, day: form.day, startTime: form.startTime, endTime: form.endTime, room: form.room || undefined, termId: form.termId || undefined }, {
      onSuccess: () => { toast('Timetable entry created', 'success'); navigate('/timetable'); },
      onError: () => toast('Failed to create timetable entry. Please try again.', 'error'),
    });
  };

  const fields: Array<[string, keyof typeof form, string]> = [
    ['Class ID *', 'classId', 'e.g. class-form3a'],
    ['Subject *', 'subject', 'e.g. Mathematics'],
    ['Teacher', 'teacher', 'e.g. teacher-123'],
    ['Day *', 'day', 'e.g. Monday'],
    ['Start Time *', 'startTime', 'e.g. 08:00'],
    ['End Time *', 'endTime', 'e.g. 09:30'],
    ['Room', 'room', 'e.g. Block A-2'],
    ['Term ID', 'termId', 'e.g. term-2026-ii'],
  ];

  return (
    <OperationsShell title="Create Timetable Entry" eyebrow="Conflict-safe scheduling">
      <form onSubmit={handleSubmit}>
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-ks-line bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map(([label, key, placeholder]) => (
                <label key={key}>
                  <span className="text-xs font-black uppercase text-ks-muted">{label}</span>
                  <input value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3 font-semibold outline-none focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/10" />
                </label>
              ))}
            </div>
            <Button type="submit" className="mt-5 rounded-xl" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create Entry'}
            </Button>
          </div>
          <AnalyticsInsightPanel title="Conflict Rules" insight="Teacher and class overlap are checked server-side before the entry is saved." />
        </div>
      </form>
    </OperationsShell>
  );
}

export function FinanceReportPage({ type }: { type: string }) {
  return (
    <OperationsShell title={type} eyebrow="Finance report">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <ReportPreviewFrame title={type} />
        <AnalyticsInsightPanel title="Audit Context" insight="Sensitive finance downloads require a reason and immutable audit record." />
      </div>
    </OperationsShell>
  );
}

export function StudentStatementReportPage() {
  return <FinanceReportPage type="Student Statement Report" />;
}
