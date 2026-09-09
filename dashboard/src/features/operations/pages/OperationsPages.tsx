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
  useClassAnalytics,
  useClassReportCards,
  useGenerateReportMutation,
  useStudentAnalyticsProfile,
  useSubjectAnalytics,
  useTeacherAnalyticsDetail,
  downloadReportWhenReady,
} from '../api/operations.hooks';
import { AnalyticsInsightPanel, BulkMarksGrid, ChartCard, ExportCenterDrawer, OperationsShell, OperationsTable, ReportBuilderCanvas, ReportTile, Td, TimetableMatrix } from '../components/OperationsWorkspace';

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
        <div className="rounded-2xl border border-ks-line bg-white p-8">
          <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Report job</p>
          <h2 className="mt-3 font-display text-3xl font-black text-ks-navy">{String(job.name ?? 'Report')}</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {([['Status', String(job.status ?? '—')], ['Requested By', String(job.requestedBy ?? '—')], ['Scope', String(job.scope ?? '—')], ['Format', String(job.format ?? 'PDF')], ['Created', String(job.created ?? '').slice(0, 16).replace('T', ' ')]] as Array<[string, string]>).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-ks-line bg-ks-paper p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-ks-muted">{label}</p>
                <p className="mt-1 font-black text-ks-navy">{value}</p>
              </div>
            ))}
          </div>
        </div>
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
  const { assessmentId } = useParams();
  const { data: rawAssessments = [] } = useAllAssessments() as { data: Record<string, unknown>[] };
  const { data: marks = [], isLoading, isError, refetch } = useAssessmentMarksSheet(assessmentId) as { data: Array<Record<string, unknown>>; isLoading: boolean; isError: boolean; refetch: () => void };
  const assessment = rawAssessments.find((item) => String(item.id) === assessmentId) ?? null;

  const scores = marks.map((m) => Number(m.score ?? 0)).filter((v) => Number.isFinite(v));
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const buckets = [0, 0, 0, 0, 0];
  scores.forEach((s) => { buckets[Math.min(4, Math.floor(s / 20))] += 1; });

  return (
    <OperationsShell title={String(assessment?.title ?? assessment?.assessment ?? 'Marks Review')} eyebrow="Approval and validation">
      {isLoading ? <SkeletonTable cols={5} /> : isError ? <DataError onRetry={refetch} /> : marks.length === 0 ? (
        <EmptyState title="No marks to review" description="Marks appear here once the teacher submits this assessment." />
      ) : (
        <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-gutter">
            <ChartCard title="Mark Distribution" values={buckets} labels={['0–20', '21–40', '41–60', '61–80', '81–100']} />
            <OperationsTable columns={['Student', 'Score', 'vs Class Mean', 'Flag']} minWidth={720}>
              {marks.map((mark) => {
                const score = Number(mark.score ?? 0);
                const diff = Math.round(score - mean);
                const flag = score < 40 ? 'Below pass mark' : diff <= -25 ? 'Outlier (low)' : diff >= 25 ? 'Top performer' : '—';
                return (
                  <tr key={String(mark.id)} className={score < 40 ? 'bg-ks-rose/5' : undefined}>
                    <Td>{String(mark.student ?? '')}</Td>
                    <Td>{score}%</Td>
                    <Td>{diff > 0 ? `+${diff}` : diff}</Td>
                    <Td>{flag === '—' ? <span className="text-ks-muted">—</span> : <Badge tone={flag === 'Top performer' ? 'emerald' : 'rose'}>{flag}</Badge>}</Td>
                  </tr>
                );
              })}
            </OperationsTable>
          </div>
          <div className="sticky top-24 h-fit rounded-2xl border border-ks-line bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl font-black text-ks-navy">Decision Panel</h2>
            <p className="mt-3 text-sm font-semibold text-ks-muted">
              Class mean is <span className="font-black text-ks-navy">{mean.toFixed(1)}%</span> across {scores.length} students.
              Approving or rejecting this submission is done in the department approval queue, which records the decision with an audit trail.
            </p>
            <div className="mt-4 grid gap-2">
              <NavLink to={`/hod/approvals/${assessmentId}`}>
                <Button className="w-full rounded-xl">Open Approval Review</Button>
              </NavLink>
              <NavLink to="/academics/marks/bulk">
                <Button variant="secondary" className="w-full rounded-xl">Back to Bulk Marks</Button>
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </OperationsShell>
  );
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
  const { classId } = useParams();
  const { data, isLoading } = useClassAnalytics(classId) as { data: Record<string, unknown> | undefined; isLoading: boolean };
  const subjects = (data?.subjectSummaries ?? []) as Array<Record<string, unknown>>;
  const className = data?.className ? `${String(data.className)}${data?.stream ? ` ${String(data.stream)}` : ''}` : 'Class';
  return (
    <OperationsShell title={`${className} Results`} eyebrow="Term results review">
      {isLoading ? <SkeletonTable cols={4} /> : subjects.length > 0 ? (
        <OperationsTable columns={['Subject', 'Average', 'Pass Rate', 'Highest', 'Lowest']}>
          {subjects.map((subject) => (
            <tr key={String(subject.subjectId ?? subject.subjectName)}>
              <Td>{String(subject.subjectName ?? '')}</Td>
              <Td>{Number(subject.average ?? subject.classAverage ?? 0).toFixed(1)}%</Td>
              <Td>{subject.passRate != null ? `${Number(subject.passRate).toFixed(1)}%` : '—'}</Td>
              <Td>{String(subject.highestScore ?? '—')}</Td>
              <Td>{String(subject.lowestScore ?? '—')}</Td>
            </tr>
          ))}
        </OperationsTable>
      ) : (
        <EmptyState title="No published results" description="Subject results appear here once marks are locked and published for this class." />
      )}
      <ResultsTable />
    </OperationsShell>
  );
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
  const { classId, termId } = useParams();
  const { data: cards = [], isLoading, isError, refetch } = useClassReportCards(classId, termId) as { data: Array<Record<string, unknown>>; isLoading: boolean; isError: boolean; refetch: () => void };
  const generateReport = useGenerateReportMutation();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (card: Record<string, unknown>) => {
    const studentId = String(card.studentId ?? '');
    const studentName = String(card.studentName ?? 'student');
    setDownloadingId(studentId);
    try {
      const result = (await generateReport.mutateAsync({
        reportType: 'REPORT_CARD',
        scope: 'student',
        scopeId: studentId,
        termId,
        academicYearId: card.academicYearId ? String(card.academicYearId) : undefined,
      })) as Record<string, unknown>;
      await downloadReportWhenReady(String(result.reportId), `Report_Card_${studentName.replace(/\s+/g, '_')}.pdf`);
      toast('Report card PDF downloaded', 'success');
    } catch {
      toast('Report card generation failed. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <OperationsShell title="Class Report Cards" eyebrow="Preview and download official PDFs">
      {isLoading ? <SkeletonTable cols={7} /> : isError ? <DataError onRetry={refetch} /> : cards.length === 0 ? (
        <EmptyState title="No report cards yet" description="Generate report cards for this class and term first (Principal → Report Cards → Generate), then download the official PDFs here." />
      ) : (
        <OperationsTable columns={['Student', 'Reg No.', 'Average', 'Grade', 'Rank', 'Status', 'Official PDF']}>
          {cards.map((card) => {
            const studentId = String(card.studentId ?? '');
            const published = Boolean(card.isPublished);
            return (
              <tr key={String(card.id)}>
                <Td>{String(card.studentName ?? studentId)}</Td>
                <Td>{String(card.registrationNumber ?? '—')}</Td>
                <Td>{Number(card.overallAverage ?? 0).toFixed(1)}%</Td>
                <Td><Badge tone={String(card.overallGrade ?? '').startsWith('A') ? 'emerald' : String(card.overallGrade ?? '').startsWith('F') ? 'rose' : 'blue'}>{String(card.overallGrade ?? '—')}</Badge></Td>
                <Td>{card.rank != null ? `${card.rank} / ${card.totalStudentsInClass ?? '—'}` : '—'}</Td>
                <Td><Badge tone={published ? 'emerald' : 'amber'}>{published ? 'PUBLISHED' : 'PROVISIONAL'}</Badge></Td>
                <Td>
                  <Button
                    variant="secondary"
                    className="rounded-lg py-1.5 text-xs"
                    disabled={downloadingId === studentId}
                    onClick={() => handleDownload(card)}
                  >
                    {downloadingId === studentId ? 'Preparing…' : 'Download PDF'}
                  </Button>
                </Td>
              </tr>
            );
          })}
        </OperationsTable>
      )}
    </OperationsShell>
  );
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
  const { data, isLoading, isError, refetch } = useAcademicOverview() as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const rankings = (data?.subjectRankings ?? []) as Array<Record<string, unknown>>;
  const top = rankings.slice(0, 8);
  return (
    <OperationsShell title="Academic Analytics" eyebrow="Academic overview and engine">
      {isLoading ? <SkeletonTable cols={2} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          {top.length > 0
            ? <ChartCard title="Subject Averages" values={top.map((s) => Math.round(Number(s.average ?? 0)))} labels={top.map((s) => String(s.subjectName ?? ''))} />
            : <EmptyState title="No subject data" description="Subject averages appear once marks are published for the term." />}
          <AnalyticsInsightPanel
            title={`School Average: ${data?.schoolAverage != null ? Number(data.schoolAverage).toFixed(1) : '—'}%`}
            insight={`Pass rate is ${data?.passRate != null ? Number(data.passRate).toFixed(1) : '—'}% across ${rankings.length} ranked subjects. Open AQA for engine controls and interventions.`}
          />
        </div>
      )}
    </OperationsShell>
  );
}

export function ClassAnalyticsDetailPage() {
  const { classId } = useParams();
  const { data, isLoading, isError, refetch } = useClassAnalytics(classId) as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const subjects = (data?.subjectSummaries ?? []) as Array<Record<string, unknown>>;
  const className = data?.className ? `${String(data.className)}${data?.stream ? ` ${String(data.stream)}` : ''}` : 'Class';
  return (
    <OperationsShell title={`${className} Analytics`} eyebrow="Class drilldown">
      {isLoading ? <SkeletonTable cols={2} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          {subjects.length > 0
            ? <ChartCard title="Subject Averages" values={subjects.slice(0, 10).map((s) => Math.round(Number(s.average ?? s.classAverage ?? 0)))} labels={subjects.slice(0, 10).map((s) => String(s.subjectName ?? ''))} />
            : <EmptyState title="No published results" description="Class analytics appear once term results are published." />}
          <AnalyticsInsightPanel
            title={`Pass Rate: ${data?.passRate != null ? Number(data.passRate).toFixed(1) : '—'}%`}
            insight={`${String(data?.studentCount ?? '—')} students | ${String(data?.atRiskCount ?? 0)} at risk, ${String(data?.criticalCount ?? 0)} critical. ${String(data?.activePairings ?? 0)} active peer pairings.`}
          />
        </div>
      )}
    </OperationsShell>
  );
}

export function SubjectAnalyticsDetailPage() {
  const { subjectId } = useParams();
  const { data, isLoading, isError, refetch } = useSubjectAnalytics(subjectId) as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const byClass = (data?.byClass ?? []) as Array<Record<string, unknown>>;
  return (
    <OperationsShell title={`${String(data?.subjectName ?? 'Subject')} Analytics`} eyebrow="Subject drilldown">
      {isLoading ? <SkeletonTable cols={2} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          {byClass.length > 0
            ? <ChartCard title="Average by Class" values={byClass.slice(0, 10).map((c) => Math.round(Number(c.average ?? 0)))} labels={byClass.slice(0, 10).map((c) => String(c.className ?? ''))} />
            : <EmptyState title="No class data" description="Class-level subject analytics appear once marks are published." />}
          <AnalyticsInsightPanel
            title={`Overall: ${data?.overallAverage != null ? Number(data.overallAverage).toFixed(1) : '—'}%`}
            insight={`Pass rate ${data?.passRate != null ? Number(data.passRate).toFixed(1) : '—'}%. ${(data?.needsAttention as unknown[] | undefined)?.length ?? 0} students flagged as needing attention in this subject.`}
          />
        </div>
      )}
    </OperationsShell>
  );
}

export function TeacherAnalyticsDetailPage() {
  const { teacherId } = useParams();
  const { data, isLoading, isError, refetch } = useTeacherAnalyticsDetail(teacherId) as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const trend = (data?.termTrend ?? []) as Array<Record<string, unknown>>;
  const subjects = (data?.subjects ?? []) as Array<Record<string, unknown>>;
  return (
    <OperationsShell title={`${String(data?.teacherName ?? 'Teacher')} Analytics`} eyebrow="Teacher performance pack">
      {isLoading ? <SkeletonTable cols={2} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          {trend.length > 0
            ? <ChartCard title="Term Trend (Class Average)" values={trend.map((t) => Math.round(Number(t.average ?? t.classAverage ?? 0)))} labels={trend.map((t) => String(t.termName ?? t.period ?? ''))} />
            : subjects.length > 0
              ? <ChartCard title="Subject Averages" values={subjects.slice(0, 8).map((s) => Math.round(Number(s.average ?? s.classAverage ?? 0)))} labels={subjects.slice(0, 8).map((s) => String(s.subjectName ?? ''))} />
              : <EmptyState title="No performance data" description="Teacher analytics appear once their assessments are approved and published." />}
          <AnalyticsInsightPanel
            title={`Class Average: ${data?.overallClassAverage != null ? Number(data.overallClassAverage).toFixed(1) : '—'}%`}
            insight={`Overall pass rate ${data?.overallPassRate != null ? Number(data.overallPassRate).toFixed(1) : '—'}% across ${subjects.length} subject assignment(s).`}
          />
        </div>
      )}
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
  const { data, isLoading, isError, refetch } = useStudentAnalyticsProfile(studentId) as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const student = (data?.student ?? {}) as Record<string, unknown>;
  const academic = (data?.academic ?? {}) as Record<string, unknown>;
  const termHistory = (academic.termHistory ?? []) as Array<Record<string, unknown>>;
  const summary = (academic.currentTermSummary ?? {}) as Record<string, unknown>;
  return (
    <OperationsShell title={`${String(student.fullName ?? 'Student')} Analytics`} eyebrow="Student drilldown">
      {isLoading ? <SkeletonTable cols={2} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          {termHistory.length > 0
            ? <ChartCard title="Term Average History" values={termHistory.map((t) => Math.round(Number(t.overallAverage ?? t.average ?? 0)))} labels={termHistory.map((t) => String(t.termName ?? t.term ?? ''))} />
            : <EmptyState title="No term history yet" description="Term averages appear once results are published for this student." />}
          <AnalyticsInsightPanel
            title={`Current Average: ${summary.overallAverage != null ? Number(summary.overallAverage).toFixed(1) : '—'}%`}
            insight={`Grade ${String(summary.overallGrade ?? '—')} | Best subject: ${String((academic.bestSubject as Record<string, unknown> | undefined)?.subjectName ?? '—')} | Projected grade: ${String(academic.projectedGrade ?? '—')}.`}
          />
        </div>
      )}
    </OperationsShell>
  );
}

export function FinanceAnalyticsOpsPage() {
  const { data, isLoading, isError, refetch } = useOperationsFinanceOverview() as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const trend = (data?.collectionTrend ?? []) as Array<Record<string, unknown>>;
  const billing = (data?.billing ?? {}) as Record<string, unknown>;
  const overdue = (data?.overdueAnalysis ?? {}) as Record<string, unknown>;
  const buckets = (overdue.byDaysOverdue ?? []) as Array<Record<string, unknown>>;
  const fmtTzs = (v: unknown) => `TZS ${Number(v ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return (
    <OperationsShell title="Finance Analytics" eyebrow="Collection, assets, forecast">
      {isLoading ? <SkeletonTable cols={3} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-3">
          {trend.length > 0
            ? <ChartCard title="Collection Rate by Term" values={trend.map((t) => Math.round(Number(t.rate ?? 0)))} labels={trend.map((t) => String(t.period ?? ''))} />
            : <EmptyState title="No collection data" description="Collection trend appears once invoices and payments exist." />}
          {buckets.length > 0
            ? <ChartCard title="Overdue Invoices by Age" values={buckets.map((b) => Number(b.count ?? 0))} labels={buckets.map((b) => String(b.bucket ?? ''))} />
            : <EmptyState title="Nothing overdue" description="Overdue aging buckets appear when invoices pass their due date." />}
          <AnalyticsInsightPanel
            title={`Collection Rate: ${billing.collectionRate != null ? Number(billing.collectionRate).toFixed(1) : '—'}%`}
            insight={`${fmtTzs(billing.totalCollected)} collected of ${fmtTzs(billing.totalInvoiced)} invoiced. Outstanding: ${fmtTzs(billing.totalOutstanding)}.`}
          />
        </div>
      )}
    </OperationsShell>
  );
}

export function EnrolmentAnalyticsPage() {
  const { data, isLoading, isError, refetch } = useEnrolmentAnalytics() as { data: Record<string, unknown> | undefined; isLoading: boolean; isError: boolean; refetch: () => void };
  const summary = (data?.summary ?? {}) as Record<string, unknown>;
  const byClass = (summary.byClass ?? []) as Array<Record<string, unknown>>;
  const byGender = (summary.byGender ?? {}) as Record<string, unknown>;
  return (
    <OperationsShell title="Enrolment Analytics" eyebrow="Trends and capacity">
      {isLoading ? <SkeletonTable cols={2} /> : isError ? <DataError onRetry={refetch} /> : (
        <div className="grid gap-gutter xl:grid-cols-2">
          {byClass.length > 0
            ? <ChartCard title="Enrolment by Class" values={byClass.map((c) => Number(c.count ?? 0))} labels={byClass.map((c) => String(c.className ?? ''))} />
            : <EmptyState title="No enrolment data" description="Class enrolment counts appear once students are enrolled." />}
          <AnalyticsInsightPanel
            title={`Active Students: ${String(summary.active ?? summary.total ?? '—')}`}
            insight={`${String(byGender.MALE ?? 0)} male and ${String(byGender.FEMALE ?? 0)} female students across ${byClass.length} classes. Seat capacity per class is tracked in the Admissions workspace.`}
          />
        </div>
      )}
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

const FINANCE_REPORT_TYPE_MAP: Record<string, string> = {
  'Collection Summary Report': 'FINANCE_COLLECTION',
  'Daily Collections Report': 'FINANCE_COLLECTION',
  'Outstanding Balances Report': 'OUTSTANDING_BALANCES',
  'Fee Defaulters Report': 'OUTSTANDING_BALANCES',
};

export function FinanceReportPage({ type, scopeId }: { type: string; scopeId?: string }) {
  const generateReport = useGenerateReportMutation();
  const [downloading, setDownloading] = useState(false);
  const reportType = scopeId ? 'STUDENT_PROFILE' : FINANCE_REPORT_TYPE_MAP[type] ?? 'FINANCE_COLLECTION';

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const result = (await generateReport.mutateAsync({
        reportType,
        scope: scopeId ? 'student' : 'school',
        scopeId,
      })) as Record<string, unknown>;
      await downloadReportWhenReady(String(result.reportId), `${type.replace(/\s+/g, '_')}.pdf`);
      toast('Report downloaded', 'success');
    } catch {
      toast('Report generation failed. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <OperationsShell title={type} eyebrow="Finance report">
      <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-ks-line bg-white p-8">
          <p className="text-[11px] font-black uppercase tracking-widest text-ks-muted">Official branded PDF</p>
          <h2 className="mt-3 font-display text-3xl font-black text-ks-navy">{type}</h2>
          <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-ks-muted">
            Generates the latest {type.toLowerCase()} from live finance data and downloads it as a branded PDF. Generation is audited under your account.
          </p>
          <Button className="mt-6 rounded-xl" disabled={downloading} onClick={handleDownload}>
            {downloading ? 'Generating…' : 'Generate & Download PDF'}
          </Button>
        </div>
        <AnalyticsInsightPanel title="Audit Context" insight="Sensitive finance downloads are generated per-request and recorded against your user account in the report registry." />
      </div>
    </OperationsShell>
  );
}

export function StudentStatementReportPage() {
  const { studentId } = useParams();
  return <FinanceReportPage type="Student Statement Report" scopeId={studentId} />;
}
