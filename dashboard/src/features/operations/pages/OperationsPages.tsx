import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { analyticsMetrics, bulkAssessments, bulkMarks, reportCatalog, reportJobs, resultClasses, timetableEntries } from '../api/operationsApi';
import { AnalyticsInsightPanel, BulkMarksGrid, ChartCard, ExportCenterDrawer, MarksReviewPanel, OperationsShell, OperationsTable, PendingIntegration, ReportBuilderCanvas, ReportPreviewFrame, ReportTile, Td, TimetableMatrix } from '../components/OperationsWorkspace';

export function ReportsHomePage() {
  return <OperationsShell title="Reports Home" eyebrow="Cross-role reports catalog"><div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]"><div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-3">{reportCatalog.map((report) => <ReportTile key={report.id} title={report.title} detail={`${report.domain} / ${report.roles.join(', ')}`} to="/reports/builder" />)}</div><ExportCenterDrawer jobs={reportJobs} /></div></OperationsShell>;
}

export function ReportBuilderPage() {
  return <OperationsShell title="Report Builder" eyebrow="Guided audited generation"><ReportBuilderCanvas /></OperationsShell>;
}

export function ReportJobsPage() {
  return <OperationsShell title="Report Jobs" eyebrow="Generation queue"><JobsTable /></OperationsShell>;
}

function JobsTable() {
  return <OperationsTable columns={['Job', 'Status', 'Requested By', 'Role', 'Scope', 'Format', 'Created', 'Actions']}>{reportJobs.map((job) => <tr key={job.id}><Td>{job.name}</Td><Td><Badge tone={job.status === 'COMPLETED' ? 'emerald' : job.status === 'FAILED' ? 'rose' : 'amber'}>{job.status}</Badge></Td><Td>{job.requestedBy}</Td><Td>{job.role}</Td><Td>{job.scope}</Td><Td>{job.format}</Td><Td>{job.created}</Td><Td><NavLink className="font-black text-ks-blue" to={`/reports/jobs/${job.id}`}>Open</NavLink></Td></tr>)}</OperationsTable>;
}

export function ReportJobDetailPage() {
  const { id } = useParams();
  const job = reportJobs.find((item) => item.id === id) ?? reportJobs[0];
  return <OperationsShell title={job.name} eyebrow="Report job detail"><div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]"><ReportPreviewFrame title={job.name} /><ExportCenterDrawer jobs={[job]} /></div></OperationsShell>;
}

export function DownloadCenterPage() {
  return <OperationsShell title="Download Center" eyebrow="Completed files and expiries"><ExportCenterDrawer jobs={reportJobs} /></OperationsShell>;
}

export function ScheduledReportsPage() {
  return <OperationsShell title="Scheduled Reports" eyebrow="Recurring report automation"><PendingIntegration feature="Scheduled reports endpoint" /><JobsTable /></OperationsShell>;
}

export function ReportTemplatesPage() {
  return <OperationsShell title="Report Templates" eyebrow="Reusable report definitions"><PendingIntegration feature="Report templates endpoint" /><div className="grid gap-gutter xl:grid-cols-3">{reportCatalog.map((report) => <ReportTile key={report.id} title={report.title} detail="Template-ready report definition." to="/reports/builder" />)}</div></OperationsShell>;
}

export function ReportAccessAuditPage() {
  return <OperationsShell title="Report Access Audit" eyebrow="Sensitive export audit"><PendingIntegration feature="Report access audit endpoint" /><JobsTable /></OperationsShell>;
}

export function BulkMarksWorkspacePage() {
  return <OperationsShell title="Bulk Marks Workspace" eyebrow="Spreadsheet-grade entry"><OperationsTable columns={['Assessment', 'Class', 'Subject', 'Type', 'Max', 'Status', 'Teacher', 'Last Edited', 'Actions']}>{bulkAssessments.map((item) => <tr key={item.id}><Td>{item.assessment}</Td><Td>{item.className}</Td><Td>{item.subject}</Td><Td>{item.type}</Td><Td>{item.max}</Td><Td>{item.status}</Td><Td>{item.teacher}</Td><Td>{item.lastEdited}</Td><Td><NavLink className="font-black text-ks-blue" to={`/academics/marks/bulk/${item.id}`}>Open Sheet</NavLink></Td></tr>)}</OperationsTable></OperationsShell>;
}

export function BulkMarksSheetPage() {
  const { assessmentId } = useParams();
  const assessment = bulkAssessments.find((item) => item.id === assessmentId) ?? bulkAssessments[0];
  return <OperationsShell title={assessment.assessment} eyebrow="Bulk marks sheet"><BulkMarksGrid rows={bulkMarks} /></OperationsShell>;
}

export function MarksReviewWorkspacePage() {
  return <OperationsShell title="Marks Review Workspace" eyebrow="Approval and validation"><MarksReviewPanel /></OperationsShell>;
}

export function ResultsWorkspacePage() {
  return <OperationsShell title="Results Workspace" eyebrow="Class and term readiness"><ResultsTable /></OperationsShell>;
}

function ResultsTable() {
  return <OperationsTable columns={['Class', 'Students', 'Status', 'Blockers', 'Readiness', 'Actions']}>{resultClasses.map((item) => <tr key={item.classId}><Td>{item.className}</Td><Td>{item.students}</Td><Td><Badge tone={item.status === 'READY' ? 'emerald' : 'rose'}>{item.status}</Badge></Td><Td>{item.blockers}</Td><Td>{item.readiness}%</Td><Td><NavLink className="font-black text-ks-blue" to={`/academics/results/class/${item.classId}/${item.termId}`}>Review</NavLink></Td></tr>)}</OperationsTable>;
}

export function ClassResultsReviewPage() {
  const { classId, termId } = useParams();
  return <OperationsShell title={`${classId ?? 'Class'} Results`} eyebrow={`Term ${termId ?? 'review'}`}><ReportPreviewFrame title="Class Results Review" /><ResultsTable /></OperationsShell>;
}

export function ResultsPublishingSupportPage() {
  return <OperationsShell title="Results Publishing Support" eyebrow="Readiness checks and blockers"><ResultsTable /><PendingIntegration feature="Backend publish validation blockers endpoint" /></OperationsShell>;
}

export function ReportCardGenerationCenterPage() {
  return <OperationsShell title="Report Card Generation Center" eyebrow="Generate, preview, download"><div className="grid gap-gutter xl:grid-cols-3">{resultClasses.map((item) => <ReportTile key={item.classId} title={item.className} detail={`${item.students} cards / ${item.readiness}% ready`} to={`/academics/report-cards/stu-amina/${item.termId}`} />)}</div></OperationsShell>;
}

export function ReportCardPreviewPage() {
  return <OperationsShell title="Report Card Preview" eyebrow="PDF-style report card"><ReportPreviewFrame title="Student Report Card" /></OperationsShell>;
}

export function AnalyticsWorkspacePage() {
  return <OperationsShell title="Analytics Workspace" eyebrow="Unified analytics landing"><AnalyticsGrid /></OperationsShell>;
}

function AnalyticsGrid() {
  return <div className="grid gap-gutter md:grid-cols-2 xl:grid-cols-4">{analyticsMetrics.map((metric) => <AnalyticsInsightPanel key={metric.label} title={`${metric.label}: ${metric.value}`} insight={`${metric.insight} Source: ${metric.source}`} />)}</div>;
}

export function AcademicAnalyticsOpsPage() {
  return <OperationsShell title="Academic Analytics" eyebrow="Academic overview and engine"><div className="grid gap-gutter xl:grid-cols-2"><ChartCard title="Subject Ranking" values={[54, 66, 78, 82]} /><AnalyticsInsightPanel title="Academic Insight" insight="Chemistry remains below target and should stay linked to AQA interventions." /></div></OperationsShell>;
}

export function ClassAnalyticsDetailPage() {
  return <OperationsShell title="Class Analytics Detail" eyebrow="Class drilldown"><ChartCard title="Class Trend" values={[62, 65, 68, 71, 74]} /><AnalyticsInsightPanel title="Next action" insight="Export class report and review at-risk students." /></OperationsShell>;
}

export function SubjectAnalyticsDetailPage() {
  return <OperationsShell title="Subject Analytics Detail" eyebrow="Subject drilldown"><ChartCard title="Subject Trend" values={[54, 58, 61, 59, 64]} /><AnalyticsInsightPanel title="Next action" insight="Compare class sections and teacher assignments." /></OperationsShell>;
}

export function TeacherAnalyticsDetailPage() {
  return <OperationsShell title="Teacher Analytics Detail" eyebrow="Teacher performance pack"><ChartCard title="Submission and performance" values={[42, 58, 76, 84]} /><AnalyticsInsightPanel title="Next action" insight="Review timeliness and syllabus completion." /></OperationsShell>;
}

export function StudentAnalyticsDirectoryPage() {
  return <OperationsShell title="Student Analytics Directory" eyebrow="At-risk, improved, top performers"><OperationsTable columns={['Student', 'Segment', 'Average', 'Trend', 'Actions']}>{['Hassan Mwamba', 'Zahara Mushi', 'Amina Baraka Juma'].map((name, index) => <tr key={name}><Td>{name}</Td><Td>{['At-risk', 'Most improved', 'Top performer'][index]}</Td><Td>{[44, 84, 72][index]}%</Td><Td>{[-18, 12, 6][index]}</Td><Td><NavLink className="font-black text-ks-blue" to={`/analytics/students/stu-${index}`}>Open</NavLink></Td></tr>)}</OperationsTable></OperationsShell>;
}

export function StudentAnalyticsProfilePage() {
  return <OperationsShell title="Student Analytics Profile" eyebrow="Student drilldown"><div className="grid gap-gutter xl:grid-cols-2"><ChartCard title="Performance Trend" values={[48, 51, 44, 58, 62]} /><AnalyticsInsightPanel title="Student Insight" insight="Finance signal is shown only for permitted roles." /></div></OperationsShell>;
}

export function FinanceAnalyticsOpsPage() {
  return <OperationsShell title="Finance Analytics" eyebrow="Collection, assets, forecast"><div className="grid gap-gutter xl:grid-cols-3"><ChartCard title="Collection" values={[54, 61, 69, 73]} /><ChartCard title="Outstanding" values={[118, 86, 62, 45]} /><AnalyticsInsightPanel title="Finance Insight" insight="Outstanding balance risk is concentrated in Form 3." /></div></OperationsShell>;
}

export function EnrolmentAnalyticsPage() {
  return <OperationsShell title="Enrolment Analytics" eyebrow="Trends and capacity"><div className="grid gap-gutter xl:grid-cols-2"><ChartCard title="Enrolment Trend" values={[280, 292, 301, 312]} /><AnalyticsInsightPanel title="Enrolment Insight" insight="Form 1 intake is above last year, capacity planning should be reviewed." /></div></OperationsShell>;
}

export function TimetableWorkspacePage() {
  return <OperationsShell title="Timetable Workspace" eyebrow="Search, create, print"><TimetableMatrix entries={timetableEntries} /></OperationsShell>;
}

export function ClassTimetablePage() {
  return <OperationsShell title="Class Timetable" eyebrow="Class weekly matrix"><TimetableMatrix entries={timetableEntries} /></OperationsShell>;
}

export function TeacherTimetablePage() {
  return <OperationsShell title="Teacher Timetable" eyebrow="Teacher weekly matrix"><TimetableMatrix entries={timetableEntries} /></OperationsShell>;
}

export function CreateTimetableEntryPage() {
  return <OperationsShell title="Create Timetable Entry" eyebrow="Conflict-safe scheduling"><div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]"><div className="rounded-2xl border border-ks-line bg-white p-5"><div className="grid gap-4 md:grid-cols-2">{['Class', 'Subject', 'Teacher', 'Day', 'Start Time', 'End Time', 'Room', 'Term'].map((field) => <label key={field}><span className="text-xs font-black uppercase text-ks-muted">{field}</span><input className="mt-2 h-11 w-full rounded-xl border border-ks-line px-3" /></label>)}</div><Button className="mt-5 rounded-xl">Create Entry</Button></div><AnalyticsInsightPanel title="Conflict Rules" insight="Teacher and class overlap checks are shown before save." /></div></OperationsShell>;
}

export function FinanceReportPage({ type }: { type: string }) {
  return <OperationsShell title={type} eyebrow="Finance report"><div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_320px]"><ReportPreviewFrame title={type} /><AnalyticsInsightPanel title="Audit Context" insight="Sensitive finance downloads require a reason and immutable audit record." /></div></OperationsShell>;
}

export function StudentStatementReportPage() {
  return <FinanceReportPage type="Student Statement Report" />;
}
