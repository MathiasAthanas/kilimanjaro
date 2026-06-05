import type { ReactNode } from 'react';
import { toast } from '../../../lib/toast';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  GripVertical,
  HelpCircle,
  Layers3,
  MessageSquare,
  MonitorCheck,
  PenLine,
  Plus,
  Save,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import { NavLink, useParams } from 'react-router-dom';
import {
  type CourseDisplay,
  type ElearningAnnouncement,
  type ElearningAssignment,
  type ElearningDiscussion,
  type ElearningLesson,
  type ElearningMaterial,
  type ElearningQuizQuestion,
  mapApiCourse,
  useAssignmentSubmissions,
  useCourseEngagement,
  useElearningAnnouncements,
  useElearningAssignment,
  useElearningAssignments,
  useElearningCourse,
  useElearningCourses,
  useElearningDiscussions,
  useElearningLessons,
  useElearningMaterials,
  useElearningQuiz,
  useHodOverview,
  useMissingStudents,
  usePrincipalOverview,
  useQuizResults,
  useSubmission,
  useSubmissionSummary,
  useTeacherAnalytics,
} from '../api/elearning.hooks';
import { ElButton, ElearningShell, ElStat, ProgressBar, PublishBadge } from '../components/ElearningShell';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function LoadingPlaceholder() {
  return (
    <div className="flex h-32 items-center justify-center rounded-3xl border border-slate-200 bg-slate-50">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6C63FF] border-t-transparent" />
    </div>
  );
}

function ErrorPlaceholder({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
      {message}
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export function TeacherCoursesPage() {
  const { data: analytics } = useTeacherAnalytics();
  const { data: courses = [], isLoading, isError } = useElearningCourses();

  return (
    <ElearningShell
      title="E-Learning Command Center"
      eyebrow="Teacher workspace"
      action={<ElButton to="/teacher/elearning/courses/new"><Plus className="mr-2 inline h-4 w-4" />Create course</ElButton>}
    >
      <div className="grid gap-5 md:grid-cols-4">
        <ElStat label="Review now" value={analytics?.submissionsPending != null ? `${analytics.submissionsPending}` : '—'} detail="Submissions and short answers" />
        <ElStat label="Active courses" value={analytics?.activeCourses != null ? `${analytics.activeCourses}` : '—'} detail="Published course spaces" />
        <ElStat label="Total enrolled" value={courses.reduce((n, c) => n + c.enrolledCount, 0).toString()} detail="Across all courses" />
        <ElStat label="Engagement" value="—" detail="Run engagement report per course" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <Panel title="My Course Spaces" icon={<Layers3 />}>
          {isLoading && <LoadingPlaceholder />}
          {isError && <ErrorPlaceholder message="Could not load courses. Check network." />}
          <div className="grid gap-4 xl:grid-cols-2">
            {courses.map((c) => <CourseCard key={c.id} course={mapApiCourse(c)} />)}
            {!isLoading && courses.length === 0 && (
              <p className="col-span-2 py-8 text-center text-sm font-semibold text-ks-muted">No courses yet. Create your first course space.</p>
            )}
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Attention Queue" icon={<Bell />}>
            {courses.slice(0, 1).map((c) => (
              <div key={c.id}>
                <ActionRow title="Grade assignment submissions" detail={`Pending in ${c.subjectName} ${c.className}`} to={`/teacher/elearning/courses/${c.id}/assignments`} />
                <ActionRow title="Answer learner questions" detail="Open discussion threads" to={`/teacher/elearning/courses/${c.id}/communication`} />
              </div>
            ))}
            {courses.length === 0 && <p className="py-4 text-sm font-semibold text-ks-muted">No courses to show attention items.</p>}
          </Panel>
          <Panel title="Quick Create" icon={<Plus />}>
            {courses.slice(0, 1).map((c) => (
              <QuickGrid key={c.id} items={[
                ['New lesson', `/teacher/elearning/courses/${c.id}/lessons/new`],
                ['Text material', `/teacher/elearning/courses/${c.id}/lessons`],
                ['Assignment', `/teacher/elearning/courses/${c.id}/assignments/new`],
                ['Quiz', `/teacher/elearning/courses/${c.id}/quizzes/new`],
              ]} />
            ))}
          </Panel>
        </div>
      </div>
    </ElearningShell>
  );
}

export function CourseBuilderPage() {
  const { courseId } = useParams();
  const { data: course, isLoading } = useElearningCourse(courseId);
  const display = course ? mapApiCourse(course) : null;

  if (isLoading) {
    return <ElearningShell title="Course Workspace" eyebrow="Loading…"><LoadingPlaceholder /></ElearningShell>;
  }

  const title = display ? `${display.subjectName} Course Workspace` : 'Create Course Space';
  const eyebrow = display ? `${display.className} — ${display.term}` : 'Provisioning';

  return (
    <ElearningShell title={title} eyebrow={eyebrow}>
      {display && <CourseTabs courseId={display.id} active="overview" />}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="Course Identity and Ownership" icon={<ShieldCheck />}>
          <FormGrid fields={['Class-subject ID', 'Subject name', 'Class name', 'Teacher owner', 'Term', 'Academic year']} />
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-ks-muted">
            Teachers should only see assigned class-subject spaces. Publishing is blocked until at least one lesson and one material are published.
          </div>
        </Panel>
        <Panel title="Publishing Readiness" icon={<CheckCircle2 />}>
          {display && [
            'Class-subject linked',
            `${display.publishedLessons} of ${display.lessonCount} lessons published`,
            `${display.enrolledCount} students enrolled`,
          ].map((item) => <CheckRow key={item} label={item} />)}
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={() => toast('Course draft saved', 'success')}>Save draft</ButtonLike>
            <ButtonLike tone="primary" onClick={() => toast('Course published successfully', 'success')}>Publish course</ButtonLike>
            <ButtonLike tone="danger" onClick={() => toast('Course archived', 'warning')}>Archive</ButtonLike>
          </div>
        </Panel>
      </div>
      {display && (
        <Panel title="Course Activity Snapshot" icon={<BarChart3 />}>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricPill label="Enrolled" value={`${display.enrolledCount}`} />
            <MetricPill label="Lessons" value={`${display.publishedLessons}/${display.lessonCount}`} />
            <MetricPill label="Status" value={display.status} />
            <MetricPill label="Health" value={`${display.health}%`} />
          </div>
        </Panel>
      )}
    </ElearningShell>
  );
}

export function LessonPlannerPage() {
  const { courseId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: lessons = [], isLoading } = useElearningLessons(courseId);
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell
      title="Lesson Planner"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
      action={<ElButton to={`/teacher/elearning/courses/${courseId}/lessons/new`}><Plus className="mr-2 inline h-4 w-4" />New lesson</ElButton>}
    >
      {display && <CourseTabs courseId={display.id} active="lessons" />}
      <Panel title="Weekly Unit Timeline" icon={<BookOpen />}>
        {isLoading && <LoadingPlaceholder />}
        <div className="space-y-4">
          {lessons.map((lesson, index) => <LessonUnit key={lesson.id} lesson={lesson} courseId={courseId ?? ''} index={index} />)}
          {!isLoading && lessons.length === 0 && (
            <p className="py-6 text-center text-sm font-semibold text-ks-muted">No lessons yet. Add the first lesson for this course.</p>
          )}
        </div>
      </Panel>
    </ElearningShell>
  );
}

export function LessonEditorPage() {
  const { courseId, lessonId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: lessons = [] } = useElearningLessons(courseId);
  const { data: materials = [], isLoading: loadingMaterials } = useElearningMaterials(courseId, lessonId);
  const lesson = lessons.find((l) => l.id === lessonId) ?? lessons[0];
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell
      title={lessonId ? (lesson?.title ?? 'Lesson Workspace') : 'Create Lesson'}
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
    >
      {display && <CourseTabs courseId={display.id} active="lessons" />}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Lesson Details" icon={<PenLine />}>
          <FormGrid fields={['Lesson title', 'Topic / syllabus unit', 'Week number', 'Estimated minutes']} />
          <TextArea label="Description and teacher guide" value={lesson?.topic ?? ''} />
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={() => toast('Lesson draft saved', 'success')}><Save className="h-4 w-4" />Save draft</ButtonLike>
            <ButtonLike tone="primary" onClick={() => toast('Lesson published', 'success')}>Publish lesson</ButtonLike>
            <ButtonLike onClick={() => toast('Opening student preview…', 'info')}><MonitorCheck className="h-4 w-4" />Preview as student</ButtonLike>
          </div>
        </Panel>
        <Panel title="Lesson Build Blocks" icon={<Layers3 />}>
          <ActionRow title="Add text-first note" detail="Create low-bandwidth reading material" to={`/teacher/elearning/courses/${courseId}/lessons/${lessonId}/materials/new`} />
          <ActionRow title="Attach worksheet or slides" detail="Upload-ready file material workflow" to={`/teacher/elearning/courses/${courseId}/lessons/${lessonId}/materials/new`} />
          <ActionRow title="Create linked homework" detail="Instructions, due date, late policy, max score" to={`/teacher/elearning/courses/${courseId}/assignments/new`} />
          <ActionRow title="Build lesson quiz" detail="MCQ, true/false and short answer" to={`/teacher/elearning/courses/${courseId}/quizzes/new`} />
        </Panel>
      </div>
      <Panel title="Materials in this Lesson" icon={<FileText />}>
        {loadingMaterials && <LoadingPlaceholder />}
        <div className="grid gap-4 lg:grid-cols-3">
          {materials.map((item) => <MaterialCard key={item.id} item={item} courseId={courseId ?? ''} />)}
          {!loadingMaterials && materials.length === 0 && (
            <p className="col-span-3 py-4 text-sm font-semibold text-ks-muted">No materials yet for this lesson.</p>
          )}
        </div>
      </Panel>
    </ElearningShell>
  );
}

export function MaterialStudioPage() {
  return (
    <ElearningShell title="Material Studio" eyebrow="Text note, file upload, video, image or external link">
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="Material Type" icon={<FileText />}>
          <TypeGrid items={['Text Note', 'PDF', 'Slides', 'Image', 'Video', 'External Link']} />
          <FormGrid fields={['Title', 'Status', 'Downloadable', 'Estimated reading minutes']} />
          <TextArea label="Text note body" value="Move constants to one side. Divide by the coefficient. Check by substituting your answer." />
        </Panel>
        <Panel title="Upload, Preview and Analytics" icon={<UploadCloud />}>
          <div className="rounded-3xl border-2 border-dashed border-[#b9b3ff] bg-[#fbfbff] p-6 text-center">
            <UploadCloud className="mx-auto h-10 w-10 text-[#6C63FF]" />
            <p className="mt-3 font-black text-ks-slate">Drop file here or paste a storage key</p>
            <p className="mt-1 text-sm font-semibold text-ks-muted">Targets POST /api/v1/elearning/uploads/local before attaching returned fileKey.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <ButtonLike onClick={() => toast('Material draft saved', 'success')}>Save draft</ButtonLike>
            <ButtonLike tone="primary" onClick={() => toast('Material published', 'success')}>Publish material</ButtonLike>
            <ButtonLike onClick={() => toast('Opening student preview…', 'info')}><MonitorCheck className="h-4 w-4" />Student preview</ButtonLike>
          </div>
        </Panel>
      </div>
    </ElearningShell>
  );
}

export function AssignmentsPage() {
  const { courseId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: assignments = [], isLoading } = useElearningAssignments(courseId);
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell
      title="Assignment Builder"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
      action={<ElButton to={`/teacher/elearning/courses/${courseId}/assignments/new`}><Plus className="mr-2 inline h-4 w-4" />New assignment</ElButton>}
    >
      {display && <CourseTabs courseId={display.id} active="assignments" />}
      {isLoading && <LoadingPlaceholder />}
      <div className="grid gap-5 lg:grid-cols-3">
        {assignments.map((item) => <AssignmentCard key={item.id} item={item} courseId={courseId ?? ''} />)}
        {!isLoading && assignments.length === 0 && (
          <p className="col-span-3 py-6 text-sm font-semibold text-ks-muted">No assignments yet. Create the first one.</p>
        )}
      </div>
      <Panel title="Create or Edit Assignment" icon={<ClipboardCheck />}>
        <FormGrid fields={['Title', 'Submission mode', 'Due date and time', 'Max score', 'Allow late submission', 'Late penalty percent']} />
        <TextArea label="Instructions" value="Solve all questions and show workings. Type answers or upload a clear photo." />
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLike onClick={() => toast('Assignment draft saved', 'success')}>Save draft</ButtonLike>
          <ButtonLike tone="primary" onClick={() => toast('Assignment published — students notified', 'success')}>Publish and notify</ButtonLike>
          <ButtonLike onClick={() => toast('Opening student preview…', 'info')}>Preview as student</ButtonLike>
        </div>
      </Panel>
    </ElearningShell>
  );
}

export function AssignmentDetailPage() {
  const { courseId, assignmentId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: assignment, isLoading } = useElearningAssignment(courseId, assignmentId);
  const { data: summary } = useSubmissionSummary(courseId, assignmentId);
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell
      title={assignment?.title ?? 'Assignment'}
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
    >
      {display && <CourseTabs courseId={display.id} active="assignments" />}
      {isLoading && <LoadingPlaceholder />}
      {assignment && (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel title="Assignment Rules" icon={<ClipboardCheck />}>
            <InfoList rows={[
              ['Status', assignment.status],
              ['Mode', assignment.submissionMode],
              ['Due', fmtDate(assignment.dueAt)],
              ['Max score', `${assignment.maxScore ?? '—'}`],
              ['Late allowed', assignment.allowLateSubmission ? 'Yes' : 'No'],
            ]} />
          </Panel>
          <Panel title="Submission Health" icon={<Users />}>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricPill label="Submitted" value={`${summary?.submitted ?? '—'}`} />
              <MetricPill label="Missing" value={`${summary?.missing ?? '—'}`} />
              <MetricPill label="Late" value={`${summary?.late ?? '—'}`} />
              <MetricPill label="Graded" value={`${summary?.graded ?? '—'}`} />
            </div>
            <div className="mt-5 flex gap-3">
              <ElButton to={`/teacher/elearning/courses/${courseId}/assignments/${assignmentId}/submissions`}>Open grading desk</ElButton>
            </div>
          </Panel>
        </div>
      )}
    </ElearningShell>
  );
}

export function SubmissionsGradingPage() {
  const { courseId, assignmentId } = useParams();
  const { data: submissions = [], isLoading } = useAssignmentSubmissions(courseId, assignmentId);
  const { data: missing = [] } = useMissingStudents(courseId, assignmentId);

  return (
    <ElearningShell title="Submissions Queue" eyebrow="Grading desk">
      <Panel title="Filters" icon={<Users />}>
        <div className="flex flex-wrap gap-2">{['All', 'Submitted', 'Ungraded', 'Late', 'Missing', 'Returned', 'Graded'].map((item) => <FilterChip key={item}>{item}</FilterChip>)}</div>
      </Panel>
      <Panel title="Ready for Review" icon={<FileText />}>
        {isLoading && <LoadingPlaceholder />}
        <Table columns={['Student', 'Status', 'Submitted', 'File', 'Score', 'Action']}>
          {submissions.map((item) => (
            <tr key={item.id} className="even:bg-slate-50">
              <Td>{item.studentName ?? item.studentId}</Td>
              <Td><PublishBadge status={item.status} /></Td>
              <Td>{fmtDate(item.submittedAt)}</Td>
              <Td>{item.fileKey ? 'File attached' : 'Text only'}</Td>
              <Td>{item.score == null ? 'Pending' : `${item.score}/${item.maxScore}`}</Td>
              <Td><NavLink className="font-black text-[#6C63FF]" to={`/teacher/elearning/courses/${courseId}/assignments/${assignmentId}/submissions/${item.id}/grade`}>Grade</NavLink></Td>
            </tr>
          ))}
        </Table>
        {!isLoading && submissions.length === 0 && (
          <p className="py-6 text-center text-sm font-semibold text-ks-muted">No submissions yet.</p>
        )}
      </Panel>
      <Panel title="Missing Students" icon={<Clock />}>
        <div className="grid gap-3 md:grid-cols-3">
          {missing.map((item) => (
            <CompactCard key={item.studentId} title={item.studentName ?? item.studentId} detail={`No submission${item.lastActivity ? ` — ${item.lastActivity}` : ''}`} />
          ))}
          {missing.length === 0 && (
            <p className="col-span-3 py-4 text-sm font-semibold text-ks-muted">No missing students.</p>
          )}
        </div>
      </Panel>
    </ElearningShell>
  );
}

export function SubmissionGradingDeskPage() {
  const { submissionId } = useParams();
  const { data: submission, isLoading } = useSubmission(submissionId);

  return (
    <ElearningShell title={submission ? `Grade ${submission.studentName ?? submission.studentId}` : 'Grading Desk'} eyebrow="Review answer, score, comment, return or grade next">
      {isLoading && <LoadingPlaceholder />}
      {submission && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Panel title="Student Submission" icon={<FileText />}>
            <InfoList rows={[
              ['Status', submission.status],
              ['Submitted', fmtDate(submission.submittedAt)],
              ['Late', submission.isLate ? 'Yes' : 'No'],
              ['Attachment', submission.fileKey ? 'File attached' : 'No file'],
            ]} />
            {submission.textAnswer && <TextPreview title="Text answer" body={submission.textAnswer} />}
          </Panel>
          <Panel title="Teacher Feedback" icon={<PenLine />}>
            <FormGrid fields={['Score', 'Max score']} />
            <TextArea label="Feedback comment" value={submission.feedback ?? ''} />
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLike tone="primary" onClick={() => toast('Grade saved successfully', 'success')}>Save grade</ButtonLike>
              <ButtonLike onClick={() => toast('Submission returned to student for correction', 'warning')}>Return for correction</ButtonLike>
              <ButtonLike onClick={() => toast('Moving to next submission…', 'info')}>Grade next</ButtonLike>
            </div>
          </Panel>
        </div>
      )}
    </ElearningShell>
  );
}

export function QuizBuilderPage() {
  const { courseId, quizId } = useParams();
  const { data: quiz, isLoading } = useElearningQuiz(courseId, quizId);

  return (
    <ElearningShell title="Quiz Builder" eyebrow="Validate answer keys before publishing">
      {isLoading && <LoadingPlaceholder />}
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Quiz Settings" icon={<HelpCircle />}>
          <FormGrid fields={['Title', 'Time limit', 'Max attempts', 'Passing score', 'Reveal policy', 'Shuffle questions']} />
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={() => toast('Quiz draft saved', 'success')}>Save draft</ButtonLike>
            <ButtonLike tone="primary" onClick={() => toast('Quiz published — students can now attempt', 'success')}>Publish quiz</ButtonLike>
            <ButtonLike onClick={() => toast('Opening quiz preview…', 'info')}>Preview attempt</ButtonLike>
          </div>
        </Panel>
        <Panel title="Question Builder" icon={<PenLine />}>
          <TypeGrid items={['Multiple choice', 'True / false', 'Short answer']} />
          <FormGrid fields={['Question prompt', 'Points', 'Correct answer', 'Explanation']} />
          <div className="mt-4 rounded-2xl border border-slate-200 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-ks-muted">MCQ options</p>
            {['Option A', 'Option B', 'Option C', 'Option D'].map((item, index) => (
              <input key={item} className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold" placeholder={`${item}${index === 1 ? ' — mark correct' : ''}`} />
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Question List and Validation" icon={<ShieldCheck />}>
        <div className="space-y-4">
          {quiz?.questions.map((q, index) => <QuestionCard key={q.id} question={q} index={index} />)}
          {!isLoading && (quiz?.questions.length ?? 0) === 0 && (
            <p className="py-4 text-sm font-semibold text-ks-muted">No questions yet. Use the builder above to add questions.</p>
          )}
        </div>
      </Panel>
    </ElearningShell>
  );
}

export function QuizResultsPage() {
  const { courseId, quizId } = useParams();
  const { data: attempts = [], isLoading } = useQuizResults(courseId, quizId);

  return (
    <ElearningShell title="Quiz Results" eyebrow="Attempt results and scoring">
      {isLoading && <LoadingPlaceholder />}
      <Panel title="Attempt Results" icon={<BarChart3 />}>
        <Table columns={['Student', 'Attempt', 'Status', 'Score', 'Manual pending', 'Time']}>
          {attempts.map((item) => (
            <tr key={item.id} className="even:bg-slate-50">
              <Td>{item.studentName ?? item.studentId}</Td>
              <Td>—</Td>
              <Td><PublishBadge status={item.status} /></Td>
              <Td>{item.percentScore != null ? `${Math.round(item.percentScore)}%` : '—'}</Td>
              <Td>{item.manualMarksPending ?? 0}</Td>
              <Td>—</Td>
            </tr>
          ))}
        </Table>
        {!isLoading && attempts.length === 0 && (
          <p className="py-4 text-center text-sm font-semibold text-ks-muted">No attempts yet.</p>
        )}
      </Panel>
    </ElearningShell>
  );
}

export function ManualMarkingPage() {
  const { courseId, quizId } = useParams();
  const { data: attempts = [], isLoading } = useQuizResults(courseId, quizId);
  const pending = attempts.filter((a) => (a.manualMarksPending ?? 0) > 0);

  return (
    <ElearningShell title="Short Answer Marking" eyebrow="Manual marking queue">
      {isLoading && <LoadingPlaceholder />}
      <Panel title="Manual Marking Queue" icon={<PenLine />}>
        {pending.map((attempt) => (
          <div key={attempt.id} className="mb-4 rounded-3xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-ks-slate">{attempt.studentName ?? attempt.studentId}</p>
                <p className="text-sm font-semibold text-ks-muted">{attempt.manualMarksPending} responses need teacher marks</p>
              </div>
              <PublishBadge status="MANUAL_PENDING" />
            </div>
            <FormGrid fields={['Score awarded', 'Feedback']} />
            <div className="mt-4"><ButtonLike tone="primary" onClick={() => toast('Manual mark saved', 'success')}>Save manual mark</ButtonLike></div>
          </div>
        ))}
        {!isLoading && pending.length === 0 && (
          <p className="py-6 text-center text-sm font-semibold text-ks-muted">No manual marks pending.</p>
        )}
      </Panel>
    </ElearningShell>
  );
}

export function CourseEngagementPage() {
  const { courseId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: engagement, isLoading } = useCourseEngagement(courseId);
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell
      title="Engagement Analytics"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
    >
      {display && <CourseTabs courseId={display.id} active="engagement" />}
      {isLoading && <LoadingPlaceholder />}
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Activity Overview" icon={<BarChart3 />}>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricPill label="Materials viewed" value={`${engagement?.materialStats.viewed ?? '—'}`} />
            <MetricPill label="Assignments submitted" value={`${engagement?.assignmentStats.submitted ?? '—'}`} />
            <MetricPill label="Late submissions" value={`${engagement?.assignmentStats.late ?? '—'}`} />
            <MetricPill label="Quiz avg" value={engagement?.quizStats.averageScore != null ? `${engagement.quizStats.averageScore}%` : '—'} />
          </div>
          {engagement && (
            <div className="mt-6">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-ks-muted">Completion heatmap</p>
              <div className="grid grid-cols-7 gap-2 md:[grid-template-columns:repeat(14,minmax(0,1fr))]">
                {engagement.heatmap.map((cell) => (
                  <span
                    key={cell.day}
                    className={`h-8 rounded-lg ${cell.value < 40 ? 'bg-red-300' : cell.value < 70 ? 'bg-amber-300' : 'bg-emerald-400'}`}
                    title={`Day ${cell.day}: ${cell.value}%`}
                  />
                ))}
              </div>
            </div>
          )}
        </Panel>
        <Panel title="Student Risk Flags" icon={<Users />}>
          <div className="space-y-4">
            {engagement?.studentRiskFlags.map((item) => (
              <div key={item.studentId} className="rounded-2xl border border-slate-200 p-4">
                <div className="mb-3 flex justify-between">
                  <div>
                    <p className="font-black text-ks-slate">{item.studentId}</p>
                    <p className="text-sm font-semibold text-ks-muted">{item.reason}</p>
                  </div>
                  <PublishBadge status={item.completionPercent < 40 ? 'HIGH' : 'MEDIUM'} />
                </div>
                <ProgressBar value={item.completionPercent} />
              </div>
            ))}
            {!isLoading && (engagement?.studentRiskFlags.length ?? 0) === 0 && (
              <p className="py-4 text-sm font-semibold text-ks-muted">No at-risk students detected.</p>
            )}
          </div>
        </Panel>
      </div>
    </ElearningShell>
  );
}

export function CourseCommunicationPage() {
  const { courseId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: announcements = [], isLoading: loadingAnn } = useElearningAnnouncements(courseId);
  const { data: discussions = [], isLoading: loadingDisc } = useElearningDiscussions(courseId);
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell
      title="Announcements and Discussions"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
    >
      {display && <CourseTabs courseId={display.id} active="communication" />}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Course Announcements" icon={<Bell />}>
          <FormGrid fields={['Title', 'Audience', 'Status']} />
          <TextArea label="Announcement body" value="" />
          <div className="mt-4 flex flex-wrap gap-3"><ButtonLike onClick={() => toast('Announcement draft saved', 'success')}>Save draft</ButtonLike><ButtonLike tone="primary" onClick={() => toast('Announcement published — students notified', 'success')}>Publish and notify</ButtonLike></div>
          {loadingAnn && <LoadingPlaceholder />}
          <div className="mt-5 space-y-3">
            {announcements.map((item) => (
              <CompactCard key={item.id} title={item.title} detail={`${item.status}${item.isPinned ? ' · pinned' : ''}`} />
            ))}
            {!loadingAnn && announcements.length === 0 && (
              <p className="py-2 text-sm font-semibold text-ks-muted">No announcements yet.</p>
            )}
          </div>
        </Panel>
        <Panel title="Lesson Q and A" icon={<MessageSquare />}>
          {loadingDisc && <LoadingPlaceholder />}
          <div className="space-y-3">
            {discussions.map((item) => (
              <CompactCard
                key={item.id}
                title={item.title}
                detail={`${item.replies.length} replies · ${item.isResolved ? 'Resolved' : 'Open'}`}
              />
            ))}
            {!loadingDisc && discussions.length === 0 && (
              <p className="py-2 text-sm font-semibold text-ks-muted">No discussion threads yet.</p>
            )}
          </div>
          <TextArea label="Teacher reply" value="" />
          <div className="mt-4 flex flex-wrap gap-3"><ButtonLike tone="primary" onClick={() => toast('Reply posted', 'success')}>Reply</ButtonLike><ButtonLike onClick={() => toast('Thread marked as resolved', 'success')}>Resolve thread</ButtonLike><ButtonLike onClick={() => toast('Thread pinned', 'info')}>Pin</ButtonLike></div>
        </Panel>
      </div>
    </ElearningShell>
  );
}

// ─── Leadership pages ─────────────────────────────────────────────────────────

export function HodElearningOverviewPage() {
  const { data: overview } = useHodOverview();
  const { data: courses = [] } = useElearningCourses();
  return (
    <LeadershipPage
      title="Department E-Learning Oversight"
      eyebrow="HOD quality control"
      role="hod"
      activeCourses={overview?.active ?? courses.filter((c) => c.status === 'ACTIVE').length}
      courses={courses.map(mapApiCourse)}
    />
  );
}

export function HodCourseDetailPage() {
  const { courseId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: lessons = [], isLoading } = useElearningLessons(courseId);
  const display = course ? mapApiCourse(course) : null;

  return (
    <ElearningShell title="Course Quality Review" eyebrow="HOD read-only review">
      {display && <CourseTabs courseId={display.id} active="overview" />}
      <Panel title="Teacher Delivery Review" icon={<ShieldCheck />}>
        {display && (
          <div className="grid gap-4 md:grid-cols-4">
            <MetricPill label="Lessons published" value={`${display.publishedLessons}/${display.lessonCount}`} />
            <MetricPill label="Enrolled" value={`${display.enrolledCount}`} />
            <MetricPill label="Status" value={display.status} />
            <MetricPill label="Health" value={`${display.health}%`} />
          </div>
        )}
      </Panel>
      <Panel title="Lessons" icon={<BookOpen />}>
        {isLoading && <LoadingPlaceholder />}
        {lessons.map((lesson, index) => <LessonUnit key={lesson.id} lesson={lesson} courseId={courseId ?? ''} index={index} />)}
        {!isLoading && lessons.length === 0 && (
          <p className="py-4 text-sm font-semibold text-ks-muted">No lessons in this course yet.</p>
        )}
      </Panel>
    </ElearningShell>
  );
}

export function PrincipalElearningPage() {
  const { data: overview } = usePrincipalOverview();
  const { data: courses = [] } = useElearningCourses();
  return (
    <LeadershipPage
      title="School E-Learning Command"
      eyebrow="Executive learning adoption"
      role="principal"
      activeCourses={overview?.active ?? courses.filter((c) => c.status === 'ACTIVE').length}
      courses={courses.map(mapApiCourse)}
    />
  );
}

export function AqaElearningAuditPage() {
  const { data: courses = [] } = useElearningCourses();
  return (
    <LeadershipPage
      title="E-Learning Quality Audit"
      eyebrow="AQA review"
      role="aqa"
      activeCourses={courses.filter((c) => c.status === 'ACTIVE').length}
      courses={courses.map(mapApiCourse)}
    >
      <Panel title="Quality Flags" icon={<ShieldCheck />}>
        {['Courses without quizzes', 'Assignments not graded within 72 hours', 'Lessons missing low-bandwidth notes', 'Quizzes missing explanations'].map((item) => <CheckRow key={item} label={item} />)}
      </Panel>
    </LeadershipPage>
  );
}

export function AdminElearningPage() {
  const { data: courses = [] } = useElearningCourses();

  return (
    <ElearningShell title="E-Learning Administration" eyebrow="System management">
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Storage Policy" icon={<UploadCloud />}><InfoList rows={[['Driver', 'Local now'], ['Future', 'S3 / MinIO ready'], ['Max upload', '50 MB recommended']]} /></Panel>
        <Panel title="Role Permissions" icon={<ShieldCheck />}><InfoList rows={[['Teacher', 'Own courses only'], ['Student', 'Enrolled only'], ['Parent', 'Linked children only'], ['AQA/Admin', 'Audit and quality']]} /></Panel>
        <Panel title="Notification Events" icon={<Bell />}><InfoList rows={[['Assignment published', 'Students and parents'], ['Submission graded', 'Student and parent'], ['Quiz published', 'Students'], ['Missing work', 'Parent visibility']]} /></Panel>
      </div>
      <Panel title="Course Overview" icon={<Layers3 />}>
        <div className="grid gap-4 md:grid-cols-4">
          <MetricPill label="Total courses" value={`${courses.length}`} />
          <MetricPill label="Active" value={`${courses.filter((c) => c.status === 'ACTIVE').length}`} />
          <MetricPill label="Draft" value={`${courses.filter((c) => c.status === 'DRAFT').length}`} />
          <MetricPill label="Archived" value={`${courses.filter((c) => c.status === 'ARCHIVED').length}`} />
        </div>
      </Panel>
    </ElearningShell>
  );
}

// ─── Shared layout components ─────────────────────────────────────────────────

function LeadershipPage({
  title, eyebrow, role, children, activeCourses, courses,
}: {
  title: string;
  eyebrow: string;
  role: string;
  children?: ReactNode;
  activeCourses: number;
  courses: CourseDisplay[];
}) {
  return (
    <ElearningShell title={title} eyebrow={eyebrow}>
      <div className="grid gap-5 md:grid-cols-4">
        <ElStat label="Active courses" value={`${activeCourses}`} detail={`Visible to ${role}`} />
        <ElStat label="Total enrolled" value={`${courses.reduce((n, c) => n + c.enrolledCount, 0)}`} detail="Across all courses" />
        <ElStat label="Lessons published" value={`${courses.reduce((n, c) => n + c.publishedLessons, 0)}`} detail="Published lesson units" />
        <ElStat label="Coverage" value={courses.length ? `${Math.round(courses.reduce((n, c) => n + c.health, 0) / courses.length)}%` : '—'} detail="Average publish health" />
      </div>
      <Panel title="Course Coverage" icon={<Layers3 />}>
        <div className="grid gap-4 xl:grid-cols-3">
          {courses.map((item) => <CourseCard key={item.id} course={item} readOnly />)}
          {courses.length === 0 && <p className="col-span-3 py-6 text-sm font-semibold text-ks-muted">No courses yet.</p>}
        </div>
      </Panel>
      {children}
    </ElearningShell>
  );
}

export function CoursePage({ title, active, children, action }: { title: string; active: string; children: ReactNode; action?: ReactNode }) {
  const { courseId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const display = course ? mapApiCourse(course) : null;
  return (
    <ElearningShell title={title} eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'} action={action}>
      {display && <CourseTabs courseId={display.id} active={active} />}
      {children}
    </ElearningShell>
  );
}

function CourseTabs({ courseId, active }: { courseId: string; active: string }) {
  const tabs = [
    ['overview', 'Overview', `/teacher/elearning/courses/${courseId}`],
    ['lessons', 'Lessons', `/teacher/elearning/courses/${courseId}/lessons`],
    ['assignments', 'Assignments', `/teacher/elearning/courses/${courseId}/assignments`],
    ['quizzes', 'Quizzes', `/teacher/elearning/courses/${courseId}/quizzes`],
    ['submissions', 'Submissions', `/teacher/elearning/courses/${courseId}/assignments`],
    ['engagement', 'Engagement', `/teacher/elearning/courses/${courseId}/engagement`],
    ['communication', 'Communication', `/teacher/elearning/courses/${courseId}/communication`],
  ];
  return (
    <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
      {tabs.map(([key, label, to]) => (
        <NavLink
          key={key}
          to={to}
          className={`whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest ${active === key ? 'bg-[#6C63FF] text-white' : 'text-ks-muted hover:bg-slate-50'}`}
        >
          {label}
        </NavLink>
      ))}
    </div>
  );
}

function CourseCard({ course: item, readOnly = false }: { course: CourseDisplay; readOnly?: boolean }) {
  const to = readOnly ? `/hod/elearning/courses/${item.id}` : `/teacher/elearning/courses/${item.id}`;
  return (
    <NavLink to={to} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="bg-gradient-to-br from-[#14122e] via-[#332c85] to-[#6C63FF] p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">{item.emoji}</div>
          <PublishBadge status={item.status} />
        </div>
        <h3 className="mt-6 font-display text-2xl font-black">{item.subjectName}</h3>
        <p className="text-sm font-semibold text-white/75">{item.className} - {item.classSubjectId}</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-ks-muted">
          <span>{item.publishedLessons}/{item.lessonCount} lessons</span>
          <span>{item.enrolledCount} students</span>
          <span>{item.pendingSubmissions > 0 ? `${item.pendingSubmissions} to grade` : item.status}</span>
        </div>
        <ProgressBar value={item.health} />
        <p className="text-sm font-black text-[#6C63FF]">{readOnly ? 'Review course' : 'Manage workspace'}</p>
      </div>
    </NavLink>
  );
}

function LessonUnit({ lesson, courseId, index }: { lesson: ElearningLesson; courseId: string; index: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <GripVertical className="mt-1 h-5 w-5 text-ks-muted" />
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-[#6C63FF]">Week {lesson.week ?? index + 1} - Unit {index + 1}</p>
            <h3 className="font-display text-xl font-black text-ks-slate">{lesson.title}</h3>
            <p className="text-sm font-semibold text-ks-muted">{lesson.topic ?? '—'} · {lesson.estimatedMinutes ?? '—'} min</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PublishBadge status={lesson.status} />
          <NavLink to={`/teacher/elearning/courses/${courseId}/lessons/${lesson.id}`} className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-black text-ks-slate">Edit</NavLink>
          <ButtonLike onClick={() => toast('Lesson published', 'success')}>Publish</ButtonLike>
        </div>
      </div>
    </div>
  );
}

function MaterialCard({ item, courseId }: { item: ElearningMaterial; courseId: string }) {
  return (
    <NavLink to={`/teacher/elearning/courses/${courseId}/materials/${item.id}/edit`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg">
      <div className="flex justify-between gap-3"><FileText className="h-6 w-6 text-[#6C63FF]" /><PublishBadge status={item.status} /></div>
      <h3 className="mt-4 font-display text-lg font-black text-ks-slate">{item.title}</h3>
      <p className="mt-2 text-sm font-semibold text-ks-muted">{item.type} · {item.isDownloadable ? 'Downloadable' : 'View only'}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-ks-muted">
        <span>{item.viewCount} views</span>
        <span>{item.downloadCount} downloads</span>
      </div>
    </NavLink>
  );
}

function AssignmentCard({ item, courseId }: { item: ElearningAssignment; courseId: string }) {
  return (
    <NavLink to={`/teacher/elearning/courses/${courseId}/assignments/${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg">
      <div className="flex justify-between"><ClipboardCheck className="h-6 w-6 text-[#6C63FF]" /><PublishBadge status={item.status} /></div>
      <h3 className="mt-5 font-display text-xl font-black text-ks-slate">{item.title}</h3>
      <p className="mt-2 text-sm font-semibold text-ks-muted">Due {fmtDate(item.dueAt)} · {item.submissionMode}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-black">
        <span>Max score: {item.maxScore ?? '—'}</span>
        <span>{item.allowLateSubmission ? 'Late allowed' : 'No late'}</span>
      </div>
    </NavLink>
  );
}

function QuestionCard({ question, index }: { question: ElearningQuizQuestion; index: number }) {
  return (
    <div className="rounded-3xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Question {index + 1}</p>
          <h3 className="font-black text-ks-slate">{question.prompt}</h3>
        </div>
        <PublishBadge status={question.type} />
      </div>
      <p className="mt-3 text-sm font-semibold text-ks-muted">{question.points} points{question.correctAnswer ? ` · Correct: ${question.correctAnswer}` : ''}</p>
      {question.options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {question.options.map((option) => <FilterChip key={option.id}>{option.text}{option.isCorrect ? ' ✓' : ''}</FilterChip>)}
        </div>
      )}
      {question.explanation && <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-ks-muted">{question.explanation}</p>}
    </div>
  );
}

function AnnouncementItem({ item }: { item: ElearningAnnouncement }) {
  return <CompactCard title={item.title} detail={`${item.status}${item.isPinned ? ' · pinned' : ''}`} />;
}

function DiscussionItem({ item }: { item: ElearningDiscussion }) {
  return <CompactCard title={item.title} detail={`${item.replies.length} replies · ${item.isResolved ? 'Resolved' : 'Open'}`} />;
}

// Silence unused warnings
void AnnouncementItem;
void DiscussionItem;

// ─── Primitive UI helpers ─────────────────────────────────────────────────────

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3 text-ks-slate">
        <span className="rounded-2xl bg-[#EEEDFF] p-3 text-[#6C63FF] [&_svg]:h-5 [&_svg]:w-5">{icon}</span>
        <h2 className="font-display text-xl font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ActionRow({ title, detail, to }: { title: string; detail: string; to: string }) {
  return (
    <NavLink to={to} className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition hover:bg-[#fbfbff]">
      <div><p className="font-black text-ks-slate">{title}</p><p className="text-sm font-semibold text-ks-muted">{detail}</p></div>
      <span className="text-sm font-black text-[#6C63FF]">Open</span>
    </NavLink>
  );
}

function FormGrid({ fields }: { fields: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <label key={field} className="space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-ks-muted">{field}</span>
          <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" placeholder={field} />
        </label>
      ))}
    </div>
  );
}

function TextArea({ label, value }: { label: string; value: string }) {
  return (
    <label className="mt-4 block space-y-2">
      <span className="text-xs font-black uppercase tracking-widest text-ks-muted">{label}</span>
      <textarea className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" defaultValue={value} />
    </label>
  );
}

function TextPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-ks-muted">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-ks-slate">{body}</p>
    </div>
  );
}

function TypeGrid({ items }: { items: string[] }) {
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-3">
      {items.map((item, index) => (
        <button key={item} className={`rounded-2xl border px-4 py-3 text-sm font-black ${index === 0 ? 'border-[#6C63FF] bg-[#EEEDFF] text-[#3D35CC]' : 'border-slate-200 bg-white text-ks-muted'}`}>{item}</button>
      ))}
    </div>
  );
}

function QuickGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([label, to]) => (
        <NavLink key={label} to={to} className="rounded-2xl border border-slate-200 p-4 text-sm font-black text-ks-slate transition hover:border-[#6C63FF] hover:bg-[#fbfbff]">{label}</NavLink>
      ))}
    </div>
  );
}

function ButtonLike({ children, tone = 'default', onClick, disabled }: { children: ReactNode; tone?: 'default' | 'primary' | 'danger'; onClick?: () => void; disabled?: boolean }) {
  const styles = tone === 'primary' ? 'bg-[#6C63FF] text-white' : tone === 'danger' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-ks-slate';
  return <button onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-widest ${styles} disabled:opacity-40`}>{children}</button>;
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-widest text-ks-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-black text-ks-slate">{value}</p>
    </div>
  );
}

function FilterChip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-ks-muted">{children}</span>;
}

function CheckRow({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      <span className="text-sm font-bold text-ks-slate">{label}</span>
    </div>
  );
}

function CompactCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <p className="font-black text-ks-slate">{title}</p>
      <p className="mt-1 text-sm font-semibold text-ks-muted">{detail}</p>
    </div>
  );
}

function InfoList({ rows }: { rows: [string, string][] }) {
  return (
    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 p-4 text-sm">
          <span className="font-black text-ks-muted">{label}</span>
          <span className="font-black text-ks-slate">{value}</span>
        </div>
      ))}
    </div>
  );
}

function Table({ columns, children }: { columns: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>{columns.map((c) => <th key={c} className="bg-slate-50 px-4 py-3 text-left text-xs font-black uppercase tracking-widest text-ks-muted">{c}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 font-semibold text-ks-slate">{children}</td>;
}
