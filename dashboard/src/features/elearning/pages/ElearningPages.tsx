import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { toast } from '../../../lib/toast';
import {
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  FileText,
  Filter,
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
  X,
} from 'lucide-react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  type CourseDisplay,
  type ElearningAnnouncement,
  type ElearningAssignment,
  type ElearningDiscussion,
  type ElearningLesson,
  type ElearningMaterial,
  type ElearningQuizQuestion,
  mapApiCourse,
  useAddDiscussionReply,
  useAddQuizQuestion,
  useAdminRepairOrphans,
  useAdminSyncCourses,
  useAdminSyncEnrollments,
  useArchiveCourse,
  useAssignmentSubmissions,
  useActiveAttempt,
  useAttemptDetail,
  useCloneCourseMutation,
  useCloseAssignment,
  useCloseQuiz,
  useCreateAnnouncement,
  useCreateAssignment,
  useCreateCourseMutation,
  useCreateLesson,
  useCreateMaterial,
  useCreateQuiz,
  useCourseEngagement,
  useDeleteQuestion,
  useElearningAnnouncements,
  useElearningAssignment,
  useElearningAssignments,
  useElearningCourse,
  useElearningCourses,
  useElearningDiscussions,
  useElearningLessons,
  useElearningMaterials,
  useElearningQuiz,
  useElearningQuizzes,
  useGradeShortAnswer,
  useGradeSubmission,
  useHodOverview,
  useMarkMaterialViewedMutation,
  useMissingStudents,
  useMyProgress,
  useMyQuizAttempts,
  useMySubmission,
  useParentLearningSummary,
  usePrincipalOverview,
  usePublishAnnouncement,
  usePublishAssignment,
  usePublishCourse,
  usePublishLesson,
  usePublishQuiz,
  useQuizResults,
  useResolveDiscussion,
  useReturnSubmission,
  useSaveAnswerMutation,
  useStartAttemptMutation,
  useSubmission,
  useSubmissionSummary,
  useSubmitAttemptMutation,
  useSubmitSubmissionMutation,
  useStudentLearningSummary,
  useUpsertSubmissionMutation,
  useTeacherAnalytics,
  useTeacherTeachingLoad,
  useTeacherToday,
  useUpdateLesson,
  useUpdateMaterial,
  useUpdateQuizMutation,
  useUploadFile,
} from '../api/elearning.hooks';
import { useAcademicYears, useTerms } from '../../admin/api/admin.hooks';
import { useTeacherClasses } from '../../teacher/api/teacher.hooks';
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
  const navigate = useNavigate();
  const [filterYear, setFilterYear] = useState('');
  const [filterTerm, setFilterTerm] = useState('');
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [cloneYear, setCloneYear] = useState('');
  const [cloneTerm, setCloneTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filterParams = Object.fromEntries(
    Object.entries({ academicYearId: filterYear, termId: filterTerm }).filter(([, v]) => Boolean(v)),
  ) as Record<string, string>;
  const hasFilter = Object.keys(filterParams).length > 0;

  const { data: analytics } = useTeacherAnalytics(hasFilter ? filterParams : undefined);
  const { data: courses = [], isLoading, isError } = useElearningCourses(hasFilter ? filterParams : undefined);
  const { data: teachingLoad, isLoading: loadLoading } = useTeacherTeachingLoad(hasFilter ? filterParams : undefined);
  const { data: today } = useTeacherToday(hasFilter ? filterParams : undefined);
  const { data: rawYears = [] } = useAcademicYears();
  const { data: rawTerms = [] } = useTerms();
  const cloneMut = useCloneCourseMutation();
  const createCourseMut = useCreateCourseMutation();

  const years = rawYears as { id: string; name: string }[];
  const terms = rawTerms as { id: string; name: string; academicYearId?: string }[];
  const termOptions = filterYear ? terms.filter((t) => !t.academicYearId || t.academicYearId === filterYear) : terms;

  async function doClone() {
    if (!cloningId || !cloneYear || !cloneTerm) return;
    try {
      await cloneMut.mutateAsync({ id: cloningId, targetAcademicYearId: cloneYear, targetTermId: cloneTerm });
      toast('Course copied to new term successfully!', 'success');
      setCloningId(null); setCloneYear(''); setCloneTerm('');
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      toast(err?.response?.data?.message ?? err?.message ?? 'Failed to copy course', 'error');
    }
  }

  const cloningCourse = cloningId ? courses.find((c) => c.id === cloningId) : null;
  const loadItems = teachingLoad?.classSubjects ?? [];

  function setupCourse(classSubjectId: string) {
    createCourseMut.mutate(
      { classSubjectId, termId: filterTerm || undefined, academicYearId: filterYear || undefined },
      {
        onSuccess: (data) => {
          const id = (data as Record<string, unknown>)?.id as string | undefined;
          toast('Course workspace ready', 'success');
          if (id) navigate(`/teacher/elearning/courses/${id}`);
        },
        onError: (e: unknown) => {
          const err = e as { response?: { data?: { message?: string } }; message?: string };
          toast(err?.response?.data?.message ?? err?.message ?? 'Failed to set up course', 'error');
        },
      },
    );
  }

  return (
    <ElearningShell
      title="Teaching Today"
      eyebrow="Teacher e-learning workspace"
      action={<ElButton to="/teacher/elearning/courses/new"><Plus className="mr-2 inline h-4 w-4" />Set up course</ElButton>}
    >
      <div className="grid gap-5 md:grid-cols-4">
        <ElStat label="Review now" value={analytics?.submissionsPending != null ? `${analytics.submissionsPending}` : '—'} detail="Submissions and short answers" />
        <ElStat label="Active courses" value={analytics?.activeCourses != null ? `${analytics.activeCourses}` : '—'} detail="Published course spaces" />
        <ElStat label="Total enrolled" value={courses.reduce((n, c) => n + c.enrolledCount, 0).toString()} detail="Across all courses" />
        <ElStat label="Engagement" value="—" detail="Run engagement report per course" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Today's Teaching Schedule" icon={<Clock />}>
          {loadLoading && <LoadingPlaceholder />}
          <div className="space-y-3">
            {(today?.schedule ?? []).map((slot, index) => {
              const subject = String(slot.subjectName ?? (slot.subject as Record<string, unknown> | undefined)?.name ?? slot.subject ?? 'Subject');
              const klass = String(slot.className ?? (slot.class as Record<string, unknown> | undefined)?.name ?? slot.class ?? 'Class');
              const start = String(slot.startTime ?? slot.time ?? '');
              const end = String(slot.endTime ?? '');
              const room = String(slot.room ?? slot.venue ?? slot.location ?? '');
              return (
                <div key={String(slot.id ?? index)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-black text-ks-slate">{subject} - {klass}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-ks-muted">{start}{end ? `-${end}` : ''}{room ? ` - ${room}` : ''}</p>
                </div>
              );
            })}
            {!loadLoading && (today?.schedule ?? []).length === 0 && (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-ks-muted">No timetable lessons are scheduled for today.</p>
            )}
          </div>
        </Panel>

        <Panel title="Needs Attention" icon={<Bell />}>
          <div className="space-y-3">
            {(today?.warnings ?? []).slice(0, 5).map((warning) => (
              <div key={`${warning.classSubjectId}-${warning.message}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-800">{warning.subjectName} - {warning.className}</p>
                <p className="mt-1 text-sm font-semibold text-amber-700">{warning.message}</p>
                {warning.courseId ? (
                  <NavLink className="mt-3 inline-block text-xs font-black uppercase tracking-widest text-amber-800 underline" to={`/teacher/elearning/courses/${warning.courseId}/lessons`}>Add lesson material</NavLink>
                ) : (
                  <button className="mt-3 text-xs font-black uppercase tracking-widest text-amber-800 underline" onClick={() => setupCourse(warning.classSubjectId)}>Set up course</button>
                )}
              </div>
            ))}
            {(today?.warnings ?? []).length === 0 && (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-ks-muted">No urgent e-learning gaps found.</p>
            )}
          </div>
        </Panel>
      </div>

      {/* Year/Term context filters */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowFilters((p) => !p)}
          className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition ${hasFilter ? 'border-[#6C63FF] bg-[#EEEDFF] text-[#6C63FF]' : 'border-slate-200 bg-white text-ks-muted hover:border-slate-300'}`}
        >
          <Filter className="h-4 w-4" />
          {hasFilter ? `Filtered: ${years.find((y) => y.id === filterYear)?.name ?? ''} ${terms.find((t) => t.id === filterTerm)?.name ?? ''}`.trim() : 'Filter by Year / Term'}
        </button>
        {hasFilter && (
          <button onClick={() => { setFilterYear(''); setFilterTerm(''); }} className="flex items-center gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100">
            <X className="h-3 w-3" /> Clear filter
          </button>
        )}
      </div>

      {showFilters && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-sm font-black text-ks-slate">Show courses from a specific academic period</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-ks-muted">Academic Year</label>
              <select value={filterYear} onChange={(e) => { setFilterYear(e.target.value); setFilterTerm(''); }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ks-slate focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30">
                <option value="">All years</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-ks-muted">Term</label>
              <select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ks-slate focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/30">
                <option value="">All terms</option>
                {termOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowFilters(false)} className="self-end rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-ks-muted hover:border-slate-300">Done</button>
          </div>
        </div>
      )}

      {/* Clone dialog */}
      {cloningId && (
        <div className="rounded-3xl border-2 border-[#6C63FF] bg-[#EEEDFF] p-6">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="font-display text-lg font-black text-ks-slate">Copy Course to New Term</p>
              <p className="text-sm font-semibold text-ks-muted">
                Copying: <span className="font-bold text-[#6C63FF]">{cloningCourse ? `${cloningCourse.subjectName} — ${cloningCourse.className}` : '...'}</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-ks-muted">Lessons, materials, assignments, and quizzes will be copied. Student data and submissions will NOT be copied.</p>
            </div>
            <button onClick={() => { setCloningId(null); setCloneYear(''); setCloneTerm(''); }} className="rounded-xl p-2 text-ks-muted hover:bg-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-ks-muted">Target Academic Year</label>
              <select value={cloneYear} onChange={(e) => { setCloneYear(e.target.value); setCloneTerm(''); }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ks-slate focus:outline-none">
                <option value="">Select year</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-black text-ks-muted">Target Term</label>
              <select value={cloneTerm} onChange={(e) => setCloneTerm(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ks-slate focus:outline-none">
                <option value="">Select term</option>
                {(cloneYear ? terms.filter((t) => !t.academicYearId || t.academicYearId === cloneYear) : terms).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <button
              onClick={doClone}
              disabled={!cloneYear || !cloneTerm || cloneMut.isPending}
              className="rounded-xl bg-[#6C63FF] px-5 py-2 text-sm font-black text-white shadow disabled:opacity-50 hover:bg-[#5b52e8]"
            >
              {cloneMut.isPending ? 'Copying…' : 'Copy Course'}
            </button>
          </div>
        </div>
      )}

      <Panel title="My Teaching Load" icon={<BookOpen />}>
        {loadLoading && <LoadingPlaceholder />}
        <div className="grid gap-4 xl:grid-cols-3">
          {loadItems.map((item) => (
            <div key={item.classSubjectId} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-[#6C63FF]">{item.educationStage ?? 'Class subject'}</p>
                  <h3 className="mt-1 font-display text-xl font-black text-ks-slate">{item.subjectName}</h3>
                  <p className="text-sm font-semibold text-ks-muted">{item.className}</p>
                </div>
                <PublishBadge status={item.courseStatus} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-ks-muted">
                <span>{item.publishedLessons}/{item.lessons} lessons</span>
                <span>{item.pendingGrading} to mark</span>
                <span>{item.course?.enrolledCount ?? 0} students</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.course ? (
                  <>
                    <NavLink className="rounded-2xl bg-[#6C63FF] px-4 py-2 text-xs font-black uppercase tracking-widest text-white" to={`/teacher/elearning/courses/${item.course.id}`}>
                      Open course
                    </NavLink>
                    <NavLink className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-ks-slate" to={`/teacher/elearning/courses/${item.course.id}/assignments`}>
                      Review
                    </NavLink>
                  </>
                ) : (
                  <ButtonLike disabled={createCourseMut.isPending} onClick={() => setupCourse(item.classSubjectId)} tone="primary">
                    {createCourseMut.isPending ? 'Setting up...' : 'Set up course'}
                  </ButtonLike>
                )}
              </div>
            </div>
          ))}
          {!loadLoading && loadItems.length === 0 && (
            <p className="col-span-3 py-8 text-center text-sm font-semibold text-ks-muted">No assigned class-subjects found for this teacher.</p>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
        <Panel title="My Course Spaces" icon={<Layers3 />}>
          {isLoading && <LoadingPlaceholder />}
          {isError && <ErrorPlaceholder message="Could not load courses. Check network." />}
          <div className="grid gap-4 xl:grid-cols-2">
            {courses.map((c) => <CourseCard key={c.id} course={mapApiCourse(c)} onClone={() => { setCloningId(c.id); setCloneYear(''); setCloneTerm(''); }} />)}
            {!isLoading && courses.length === 0 && (
              <p className="col-span-2 py-8 text-center text-sm font-semibold text-ks-muted">
                {hasFilter ? 'No courses found for this period. Try clearing the filter.' : 'No courses yet. Create your first course space.'}
              </p>
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
  const navigate = useNavigate();
  const { data: course, isLoading } = useElearningCourse(courseId);
  const display = course ? mapApiCourse(course) : null;
  const publishCourseMut = usePublishCourse();
  const archiveMut = useArchiveCourse();
  const createMut = useCreateCourseMutation();

  // Dropdown data for create mode
  const { data: apiClasses = [] } = useTeacherClasses();
  const { data: rawYears = [] } = useAcademicYears();
  const { data: rawTerms = [] } = useTerms();
  const years = rawYears as { id: string; name: string }[];
  const allTerms = rawTerms as { id: string; name: string; academicYearId?: string }[];
  const classSubjectOptions = apiClasses as { id: string; className: string; subject: string }[];

  const [form, setForm] = useState({ classSubjectId: '', academicYearId: '', termId: '' });
  const selectedCS = classSubjectOptions.find((c) => c.id === form.classSubjectId);
  const filteredTerms = form.academicYearId
    ? allTerms.filter((t) => !t.academicYearId || t.academicYearId === form.academicYearId)
    : allTerms;

  function handleCreate() {
    if (!form.classSubjectId) { toast('Select a class-subject', 'warning'); return; }
    createMut.mutate(
      { classSubjectId: form.classSubjectId, termId: form.termId || undefined, academicYearId: form.academicYearId || undefined },
      {
        onSuccess: (data) => {
          toast('Course space created', 'success');
          const id = (data as unknown as Record<string, unknown>)?.id as string | undefined;
          navigate(id ? `/teacher/elearning/courses/${id}` : '/teacher/elearning');
        },
        onError: () => toast('Failed to create course space', 'error'),
      },
    );
  }

  if (isLoading) {
    return <ElearningShell title="Course Workspace" eyebrow="Loading…"><LoadingPlaceholder /></ElearningShell>;
  }

  const title = display ? `${display.subjectName} Course Workspace` : 'Create Course Space';
  const eyebrow = display ? `${display.className} — ${display.term}` : 'New course space';

  return (
    <ElearningShell title={title} eyebrow={eyebrow}>
      {display && <CourseTabs courseId={display.id} active="overview" />}
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Panel title="Course Identity and Ownership" icon={<ShieldCheck />}>
          {display ? (
            <InfoList rows={[
              ['Class-subject ID', display.classSubjectId],
              ['Subject', display.subjectName],
              ['Class', display.className],
              ['Term', display.term],
              ['Academic year', display.academicYear],
              ['Status', display.status],
            ]} />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Class-subject *</span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                    value={form.classSubjectId}
                    onChange={(e) => setForm((p) => ({ ...p, classSubjectId: e.target.value }))}
                  >
                    <option value="">Select your class-subject…</option>
                    {classSubjectOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.className} — {c.subject}</option>
                    ))}
                  </select>
                </label>
                {selectedCS && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Class name</p>
                      <p className="rounded-2xl border border-slate-100 bg-slate-100 px-4 py-3 text-sm font-semibold text-ks-slate">{selectedCS.className}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Subject name</p>
                      <p className="rounded-2xl border border-slate-100 bg-slate-100 px-4 py-3 text-sm font-semibold text-ks-slate">{selectedCS.subject}</p>
                    </div>
                  </>
                )}
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Academic year</span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                    value={form.academicYearId}
                    onChange={(e) => setForm((p) => ({ ...p, academicYearId: e.target.value, termId: '' }))}
                  >
                    <option value="">Select year…</option>
                    {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Term</span>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                    value={form.termId}
                    onChange={(e) => setForm((p) => ({ ...p, termId: e.target.value }))}
                  >
                    <option value="">Select term…</option>
                    {filteredTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-ks-muted">
                Only your assigned class-subjects appear above. Publishing is blocked until at least one lesson and one material are published.
              </div>
              <div className="mt-4">
                <ButtonLike tone="primary" onClick={handleCreate} disabled={createMut.isPending || !form.classSubjectId}>
                  {createMut.isPending ? 'Creating…' : 'Create Course Space'}
                </ButtonLike>
              </div>
            </>
          )}
        </Panel>
        <Panel title="Publishing Readiness" icon={<CheckCircle2 />}>
          {display ? (
            <>
              {[
                'Class-subject linked',
                `${display.publishedLessons} of ${display.lessonCount} lessons published`,
                `${display.enrolledCount} students enrolled`,
              ].map((item) => <CheckRow key={item} label={item} />)}
              <div className="mt-4 flex flex-wrap gap-3">
                <ButtonLike tone="primary" disabled={publishCourseMut.isPending} onClick={() => publishCourseMut.mutate(courseId!, { onSuccess: () => toast('Course published successfully', 'success'), onError: () => toast('Failed to publish course', 'error') })}>Publish course</ButtonLike>
                <ButtonLike tone="danger" disabled={archiveMut.isPending} onClick={() => archiveMut.mutate(courseId!, { onSuccess: () => toast('Course archived', 'warning'), onError: () => toast('Failed to archive course', 'error') })}>Archive</ButtonLike>
              </div>
            </>
          ) : (
            <p className="py-4 text-sm font-semibold text-ks-muted">Publishing readiness will show after the course space is created.</p>
          )}
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
  const navigate = useNavigate();
  const { data: course } = useElearningCourse(courseId);
  const { data: lessons = [] } = useElearningLessons(courseId);
  const { data: materials = [], isLoading: loadingMaterials } = useElearningMaterials(courseId, lessonId);
  const lesson = lessons.find((l) => l.id === lessonId) ?? (lessonId ? undefined : lessons[0]);
  const activeLessonId = lessonId ?? lesson?.id;
  const display = course ? mapApiCourse(course) : null;
  const createMut = useCreateLesson();
  const updateMut = useUpdateLesson();
  const publishMut = usePublishLesson();

  const [form, setForm] = useState({ title: '', topic: '', week: '', estimatedMinutes: '' });
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (lesson) {
      setForm({ title: lesson.title, topic: lesson.topic ?? '', week: String(lesson.week ?? ''), estimatedMinutes: String(lesson.estimatedMinutes ?? '') });
      setDescription(lesson.description ?? lesson.topic ?? '');
    }
  }, [lesson?.id]);

  function handleSave() {
    const body = { title: form.title, topic: form.topic || undefined, week: form.week ? Number(form.week) : undefined, estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined, description: description || undefined };
    if (lessonId) {
      updateMut.mutate({ courseId: courseId!, lessonId, body }, { onSuccess: () => toast('Lesson saved', 'success'), onError: () => toast('Failed to save lesson', 'error') });
    } else {
      createMut.mutate({
        courseId: courseId!,
        body,
      }, {
        onSuccess: (created) => {
          const createdLessonId = created.id;
          toast('Lesson created', 'success');
          navigate(createdLessonId ? `/teacher/elearning/courses/${courseId}/lessons/${createdLessonId}` : `/teacher/elearning/courses/${courseId}/lessons`);
        },
        onError: () => toast('Failed to create lesson', 'error'),
      });
    }
  }

  function handlePublish() {
    if (!lessonId) { toast('Save the lesson first', 'warning'); return; }
    publishMut.mutate({ courseId: courseId!, lessonId }, { onSuccess: () => toast('Lesson published', 'success'), onError: () => toast('Failed to publish lesson', 'error') });
  }

  return (
    <ElearningShell
      title={lessonId ? (lesson?.title ?? 'Lesson Workspace') : 'Create Lesson'}
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
    >
      {display && <CourseTabs courseId={display.id} active="lessons" />}
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Lesson Details" icon={<PenLine />}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Lesson title</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Lesson title" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Topic / syllabus unit</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={form.topic} onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))} placeholder="Topic / syllabus unit" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Week number</span>
              <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={form.week} onChange={(e) => setForm((p) => ({ ...p, week: e.target.value }))} placeholder="Week number" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Estimated minutes</span>
              <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={form.estimatedMinutes} onChange={(e) => setForm((p) => ({ ...p, estimatedMinutes: e.target.value }))} placeholder="Estimated minutes" />
            </label>
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Description and teacher guide</span>
            <textarea className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}><Save className="h-4 w-4" />{createMut.isPending || updateMut.isPending ? 'Saving…' : 'Save draft'}</ButtonLike>
            <ButtonLike tone="primary" onClick={handlePublish} disabled={publishMut.isPending}>Publish lesson</ButtonLike>
            <ButtonLike onClick={() => toast('Opening student preview…', 'info')}><MonitorCheck className="h-4 w-4" />Preview as student</ButtonLike>
          </div>
        </Panel>
        <Panel title="Lesson Build Blocks" icon={<Layers3 />}>
          <ActionRow title="Add text-first note" detail={activeLessonId ? 'Create low-bandwidth reading material' : 'Save this lesson first to attach material'} to={`/teacher/elearning/courses/${courseId}/lessons/${activeLessonId}/materials/new`} disabled={!activeLessonId} />
          <ActionRow title="Attach worksheet or slides" detail={activeLessonId ? 'Upload-ready file material workflow' : 'Save this lesson first to attach files'} to={`/teacher/elearning/courses/${courseId}/lessons/${activeLessonId}/materials/new`} disabled={!activeLessonId} />
          <ActionRow title="Create linked homework" detail="Instructions, due date, late policy, max score" to={`/teacher/elearning/courses/${courseId}/assignments/new`} />
          <ActionRow title="Build lesson quiz" detail="MCQ, true/false and short answer" to={`/teacher/elearning/courses/${courseId}/quizzes/new`} />
        </Panel>
      </div>
      <Panel title="Materials in this Lesson" icon={<FileText />}>
        {loadingMaterials && <LoadingPlaceholder />}
        <div className="grid gap-4 lg:grid-cols-3">
          {materials.map((item) => <MaterialCard key={item.id} item={item} courseId={courseId ?? ''} lessonId={activeLessonId ?? ''} />)}
          {!activeLessonId && (
            <p className="col-span-3 py-4 text-sm font-semibold text-ks-muted">Save the lesson to unlock material uploads and student resources.</p>
          )}
          {activeLessonId && !loadingMaterials && materials.length === 0 && (
            <p className="col-span-3 py-4 text-sm font-semibold text-ks-muted">No materials yet for this lesson.</p>
          )}
        </div>
      </Panel>
    </ElearningShell>
  );
}

const MATERIAL_TYPES = ['NOTE', 'PDF', 'SLIDES', 'IMAGE', 'VIDEO', 'LINK', 'FILE'] as const;
type MaterialKind = typeof MATERIAL_TYPES[number];

export function MaterialStudioPage() {
  const { courseId, lessonId, materialId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(materialId);

  const { data: allMaterials } = useElearningMaterials(courseId, lessonId);
  const existingMaterial = allMaterials?.find((m) => m.id === materialId);

  const [mType, setMType] = useState<MaterialKind>('NOTE');
  const [title, setTitle] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [isDownloadable, setIsDownloadable] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileMimeType, setFileMimeType] = useState('');
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isEdit && existingMaterial && !initialized) {
      setMType((existingMaterial.type as MaterialKind) ?? 'NOTE');
      setTitle(existingMaterial.title ?? '');
      setEstimatedMinutes((existingMaterial as unknown as Record<string, unknown>).estimatedMinutes ? String((existingMaterial as unknown as Record<string, unknown>).estimatedMinutes) : '');
      setIsDownloadable(existingMaterial.downloadable ?? false);
      setNoteBody((existingMaterial as unknown as Record<string, unknown>).body as string ?? '');
      setExternalUrl(existingMaterial.externalUrl ?? '');
      setFileKey(existingMaterial.fileKey ?? '');
      setFileName(existingMaterial.fileKey ? 'Existing file' : '');
      setFileMimeType((existingMaterial as unknown as Record<string, unknown>).fileMimeType as string ?? '');
      setFileSizeBytes(Number((existingMaterial as unknown as Record<string, unknown>).fileSizeBytes ?? 0) || null);
      setInitialized(true);
    }
  }, [isEdit, existingMaterial, initialized]);

  const uploadMut = useUploadFile();
  const createMut = useCreateMaterial();
  const updateMut = useUpdateMaterial();

  const needsFile = ['PDF', 'SLIDES', 'IMAGE', 'FILE'].includes(mType);
  const needsUrl = mType === 'LINK';
  const needsVideo = mType === 'VIDEO';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const maxFileBytes = 50 * 1024 * 1024;
    if (file.size > maxFileBytes) {
      toast('File exceeds 50 MB limit', 'error');
      e.target.value = '';
      return;
    }
    setFileName(file.name);
    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const contentBase64 = dataUrl.split(',')[1];
      uploadMut.mutate(
        { fileName: file.name, contentBase64, mimeType: file.type, domain: 'materials' },
        {
          onSuccess: (data) => {
            const d = data as { fileKey?: string; fileMimeType?: string; fileSizeBytes?: number; data?: { fileKey?: string; fileMimeType?: string; fileSizeBytes?: number } };
            setFileKey(d.fileKey ?? d.data?.fileKey ?? '');
            setFileMimeType(d.fileMimeType ?? d.data?.fileMimeType ?? file.type ?? '');
            setFileSizeBytes(d.fileSizeBytes ?? d.data?.fileSizeBytes ?? file.size);
            setUploading(false);
            toast('File uploaded — ready to save', 'success');
          },
          onError: () => { setUploading(false); toast('Upload failed. Check file size.', 'error'); },
        },
      );
    };
    reader.onerror = () => { setUploading(false); toast('Could not read file', 'error'); };
  }

  function handleSave(publish: boolean) {
    if (!courseId || !lessonId) { toast('Open a saved lesson before adding materials', 'warning'); return; }
    if (!title.trim()) { toast('Enter a material title', 'warning'); return; }
    if (mType === 'NOTE' && !noteBody.trim()) { toast('Write content for the text note', 'warning'); return; }
    if (needsFile && !fileKey) { toast('Upload a file first', 'warning'); return; }
    if (needsUrl && !externalUrl.trim()) { toast('Paste an external URL', 'warning'); return; }
    if (needsVideo && !fileKey && !externalUrl.trim()) { toast('Upload a video file or paste a URL', 'warning'); return; }

    const body: Record<string, unknown> = {
      title: title.trim(),
      type: mType,
      downloadable: isDownloadable,
      status: publish ? 'PUBLISHED' : 'DRAFT',
    };
    if (estimatedMinutes) body.estimatedMinutes = Number(estimatedMinutes);
    if (mType === 'NOTE') body.body = noteBody;
    if (needsFile) {
      body.fileKey = fileKey;
      body.fileOriginalName = fileName || undefined;
      body.fileMimeType = fileMimeType || undefined;
      body.fileSizeBytes = fileSizeBytes ?? undefined;
    }
    if (needsVideo) {
      if (fileKey) {
        body.fileKey = fileKey;
        body.fileOriginalName = fileName || undefined;
        body.fileMimeType = fileMimeType || undefined;
        body.fileSizeBytes = fileSizeBytes ?? undefined;
      } else body.externalUrl = externalUrl;
    }
    if (needsUrl) body.externalUrl = externalUrl;

    if (isEdit && materialId) {
      updateMut.mutate(
        { courseId: courseId!, lessonId: lessonId!, materialId, body },
        {
          onSuccess: () => {
            toast(publish ? 'Material updated and published' : 'Material updated', 'success');
            navigate(`/teacher/elearning/courses/${courseId}/lessons/${lessonId}`);
          },
          onError: () => toast('Failed to update material', 'error'),
        },
      );
    } else {
      createMut.mutate(
        { courseId: courseId!, lessonId: lessonId!, body },
        {
          onSuccess: () => {
            toast(publish ? 'Material published to students' : 'Draft saved', 'success');
            navigate(`/teacher/elearning/courses/${courseId}/lessons/${lessonId}`);
          },
          onError: () => toast('Failed to save material', 'error'),
        },
      );
    }
  }

  const ready = [
    Boolean(title.trim()),
    mType !== 'NOTE' || Boolean(noteBody.trim()),
    !needsFile || Boolean(fileKey),
    !needsUrl || Boolean(externalUrl.trim()),
    !needsVideo || Boolean(fileKey) || Boolean(externalUrl.trim()),
  ];

  const typeHint: Record<MaterialKind, string> = {
    NOTE: 'Text-first reading material — works offline on low bandwidth',
    PDF: 'PDF document — students can download and read offline',
    SLIDES: 'Presentation slides — PDF or PPTX',
    IMAGE: 'Image or diagram — PNG, JPG, GIF',
    VIDEO: 'Video file or external URL (YouTube, Vimeo)',
    LINK: 'External resource or web page link',
    FILE: 'Any other file type — worksheets, spreadsheets, etc.',
  };

  return (
    <ElearningShell title={isEdit ? 'Edit Material' : 'Material Studio'} eyebrow={isEdit ? 'Update content, then republish to push changes to students' : 'Create a text note, file, image, video or link'}>
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Material Details" icon={<FileText />}>
          <p className="mb-4 rounded-2xl bg-[#EEEDFF] px-4 py-3 text-sm font-semibold text-[#3D35CC]">{typeHint[mType]}</p>
          <div className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-4">
            {MATERIAL_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => { setMType(t); setFileKey(''); setFileName(''); setExternalUrl(''); }}
                className={`rounded-2xl border px-3 py-2 text-xs font-black transition ${mType === t ? 'border-[#6C63FF] bg-[#EEEDFF] text-[#3D35CC]' : 'border-slate-200 bg-white text-ks-muted hover:bg-slate-50'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Title</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Material title"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Estimated minutes</span>
              <input
                type="number"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="—"
                min={1}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={isDownloadable}
                onChange={(e) => setIsDownloadable(e.target.checked)}
                className="h-4 w-4 accent-[#6C63FF]"
              />
              <span className="text-sm font-semibold text-ks-slate">Allow student download</span>
            </label>
          </div>
          {mType === 'NOTE' && (
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Note content</span>
              <textarea
                className="min-h-52 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#6C63FF]"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write lesson note, equations, definitions, examples…"
              />
              <span className="block text-right text-xs text-ks-muted">{noteBody.length} characters</span>
            </label>
          )}
          {(needsUrl || needsVideo) && (
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">{mType === 'VIDEO' ? 'External video URL (optional if uploading)' : 'External URL'}</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder={mType === 'VIDEO' ? 'https://youtube.com/watch?v=…' : 'https://…'}
              />
            </label>
          )}
        </Panel>

        <Panel title="Upload and Publish" icon={<UploadCloud />}>
          {(needsFile || needsVideo) && (
            <div className="mb-5">
              <label
                className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition ${
                  fileKey ? 'border-emerald-400 bg-emerald-50' : uploading ? 'border-[#6C63FF] bg-[#EEEDFF]' : 'border-[#b9b3ff] bg-[#fbfbff] hover:bg-[#f5f4ff]'
                }`}
              >
                <UploadCloud className={`h-10 w-10 ${fileKey ? 'text-emerald-500' : 'text-[#6C63FF]'}`} />
                <p className="mt-3 font-black text-ks-slate">
                  {fileKey ? `✓ ${fileName}` : uploading ? 'Uploading…' : 'Click to select file'}
                </p>
                <p className="mt-1 text-xs font-semibold text-ks-muted">
                  {mType === 'PDF' ? 'PDF files' : mType === 'IMAGE' ? 'PNG, JPG, GIF, WebP' : mType === 'SLIDES' ? 'PDF or PPTX' : 'Any file — max 50 MB'}
                </p>
                <input type="file" className="sr-only" onChange={handleFileChange} disabled={uploading || createMut.isPending} />
              </label>
            </div>
          )}

          {mType === 'NOTE' && noteBody && (
            <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="mb-3 text-xs font-black uppercase tracking-widest text-ks-muted">Preview</p>
              <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-ks-slate">{noteBody.slice(0, 400)}{noteBody.length > 400 ? '…' : ''}</p>
            </div>
          )}

          {(mType === 'LINK' || (mType === 'VIDEO' && externalUrl)) && externalUrl && (
            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Link</p>
              <p className="mt-1 break-all text-sm font-semibold text-[#6C63FF]">{externalUrl}</p>
            </div>
          )}

          <div className="mb-5 rounded-3xl border border-slate-200 p-5">
            <p className="mb-4 text-xs font-black uppercase tracking-widest text-ks-muted">Publish checklist</p>
            {[
              [ready[0], 'Title entered'],
              [ready[1], 'Content / note body added'],
              [ready[2], 'File uploaded (or not required)'],
              [ready[3], 'URL provided (or not required)'],
              [ready[4], 'Video source provided (or not required)'],
            ].filter((_, i) => {
              if (i === 1 && mType !== 'NOTE') return false;
              if (i === 2 && !needsFile) return false;
              if (i === 3 && !needsUrl) return false;
              if (i === 4 && !needsVideo) return false;
              return true;
            }).map(([ok, label]) => (
              <div key={label as string} className="mb-2 flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${ok ? 'text-emerald-500' : 'text-slate-300'}`} />
                <span className={`text-sm font-semibold ${ok ? 'text-ks-slate' : 'text-ks-muted'}`}>{label as string}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <ButtonLike onClick={() => handleSave(false)} disabled={createMut.isPending || updateMut.isPending || uploading}>
              <Save className="h-4 w-4" />{createMut.isPending || updateMut.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save draft'}
            </ButtonLike>
            <ButtonLike tone="primary" onClick={() => handleSave(true)} disabled={createMut.isPending || updateMut.isPending || uploading || !ready.every(Boolean)}>
              {uploading ? 'Uploading…' : createMut.isPending || updateMut.isPending ? 'Publishing…' : isEdit ? 'Save and republish' : 'Publish to students'}
            </ButtonLike>
            <ButtonLike onClick={() => navigate(-1)}>Cancel</ButtonLike>
          </div>
        </Panel>
      </div>
    </ElearningShell>
  );
}

export function AssignmentsPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data: course } = useElearningCourse(courseId);
  const { data: assignments = [], isLoading } = useElearningAssignments(courseId);
  const display = course ? mapApiCourse(course) : null;

  const createMut = useCreateAssignment();
  const publishMut = usePublishAssignment();

  const [form, setForm] = useState({
    title: '',
    type: 'BOTH' as 'TEXT' | 'FILE_UPLOAD' | 'BOTH',
    dueAt: '',
    maxScore: '',
    allowLateSubmission: true,
    latePenaltyPercent: '0',
    instructions: '',
  });
  const [showForm, setShowForm] = useState(false);

  function handleCreate(publish: boolean) {
    if (!form.title.trim()) { toast('Enter an assignment title', 'warning'); return; }
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      type: form.type,
      allowLateSubmission: form.allowLateSubmission,
      latePenaltyPercent: Number(form.latePenaltyPercent) || 0,
    };
    if (form.dueAt) body.dueAt = new Date(form.dueAt).toISOString();
    if (form.maxScore) body.maxScore = Number(form.maxScore);
    if (form.instructions.trim()) body.instructions = form.instructions.trim();

    createMut.mutate(
      { courseId: courseId!, body },
      {
        onSuccess: (data) => {
          const newId = (data as { id?: string; data?: { id?: string } })?.id ?? (data as { id?: string; data?: { id?: string } })?.data?.id;
          if (publish && newId) {
            publishMut.mutate({ courseId: courseId!, assignmentId: newId }, {
              onSuccess: () => toast('Assignment published — students notified', 'success'),
              onError: () => toast('Created but failed to publish', 'warning'),
            });
          } else {
            toast('Assignment draft saved', 'success');
          }
          setForm({ title: '', type: 'BOTH', dueAt: '', maxScore: '', allowLateSubmission: true, latePenaltyPercent: '0', instructions: '' });
          setShowForm(false);
          if (newId) navigate(`/teacher/elearning/courses/${courseId}/assignments/${newId}`);
        },
        onError: () => toast('Failed to save assignment', 'error'),
      },
    );
  }

  return (
    <ElearningShell
      title="Assignment Builder"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
      action={<button onClick={() => setShowForm((p) => !p)} className="rounded-2xl bg-[#6C63FF] px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-[#3D35CC]"><Plus className="mr-2 inline h-4 w-4" />{showForm ? 'Close form' : 'New assignment'}</button>}
    >
      {display && <CourseTabs courseId={display.id} active="assignments" />}
      {isLoading && <LoadingPlaceholder />}
      <div className="grid gap-5 lg:grid-cols-3">
        {assignments.map((item) => <AssignmentCard key={item.id} item={item} courseId={courseId ?? ''} />)}
        {!isLoading && assignments.length === 0 && (
          <p className="col-span-3 py-6 text-sm font-semibold text-ks-muted">No assignments yet. Click "New assignment" to create one.</p>
        )}
      </div>
      {showForm && (
        <Panel title="Create Assignment" icon={<ClipboardCheck />}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Title</span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Assignment title"
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Submission mode</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as 'TEXT' | 'FILE_UPLOAD' | 'BOTH' }))}
              >
                <option value="BOTH">Text + File upload</option>
                <option value="TEXT">Text only</option>
                <option value="FILE_UPLOAD">File upload only</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Due date and time</span>
              <input
                type="datetime-local"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={form.dueAt}
                onChange={(e) => setForm((p) => ({ ...p, dueAt: e.target.value }))}
              />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Max score</span>
              <input
                type="number"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                value={form.maxScore}
                onChange={(e) => setForm((p) => ({ ...p, maxScore: e.target.value }))}
                placeholder="100"
                min={1}
              />
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.allowLateSubmission}
                onChange={(e) => setForm((p) => ({ ...p, allowLateSubmission: e.target.checked }))}
                className="h-4 w-4 accent-[#6C63FF]"
              />
              <span className="text-sm font-semibold text-ks-slate">Allow late submission</span>
            </label>
            {form.allowLateSubmission && (
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Late penalty (%)</span>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                  value={form.latePenaltyPercent}
                  onChange={(e) => setForm((p) => ({ ...p, latePenaltyPercent: e.target.value }))}
                  placeholder="0"
                  min={0}
                  max={100}
                />
              </label>
            )}
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Instructions for students</span>
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#6C63FF]"
              value={form.instructions}
              onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
              placeholder="Solve all questions showing full working. Upload a clear photo of your answer sheet."
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={() => handleCreate(false)} disabled={createMut.isPending}>
              <Save className="h-4 w-4" />{createMut.isPending ? 'Saving…' : 'Save draft'}
            </ButtonLike>
            <ButtonLike tone="primary" onClick={() => handleCreate(true)} disabled={createMut.isPending || publishMut.isPending}>
              {createMut.isPending ? 'Creating…' : publishMut.isPending ? 'Publishing…' : 'Publish and notify students'}
            </ButtonLike>
            <ButtonLike onClick={() => setShowForm(false)}>Cancel</ButtonLike>
          </div>
        </Panel>
      )}
    </ElearningShell>
  );
}

export function AssignmentDetailPage() {
  const { courseId, assignmentId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: assignment, isLoading } = useElearningAssignment(courseId, assignmentId);
  const { data: summary } = useSubmissionSummary(courseId, assignmentId);
  const publishMut = usePublishAssignment();
  const closeMut = useCloseAssignment();
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
              ['Mode', assignment.type],
              ['Due', fmtDate(assignment.dueAt)],
              ['Max score', `${assignment.maxScore ?? '—'}`],
              ['Late allowed', assignment.allowLateSubmission ? 'Yes' : 'No'],
              ['Late penalty', assignment.latePenaltyPercent ? `${assignment.latePenaltyPercent}%` : '0%'],
            ]} />
            <div className="mt-4 flex flex-wrap gap-2">
              {assignment.status === 'DRAFT' && (
                <ButtonLike
                  tone="primary"
                  onClick={() => publishMut.mutate({ courseId: courseId!, assignmentId: assignmentId! }, { onSuccess: () => toast('Assignment published — students notified', 'success'), onError: () => toast('Failed to publish', 'error') })}
                  disabled={publishMut.isPending}
                >
                  {publishMut.isPending ? 'Publishing…' : 'Publish and notify'}
                </ButtonLike>
              )}
              {assignment.status === 'PUBLISHED' && (
                <ButtonLike
                  tone="danger"
                  onClick={() => closeMut.mutate({ courseId: courseId!, assignmentId: assignmentId! }, { onSuccess: () => toast('Assignment closed — no new submissions', 'warning'), onError: () => toast('Failed to close', 'error') })}
                  disabled={closeMut.isPending}
                >
                  {closeMut.isPending ? 'Closing…' : 'Close submissions'}
                </ButtonLike>
              )}
            </div>
          </Panel>
          <Panel title="Submission Health" icon={<Users />}>
            <div className="grid gap-3 md:grid-cols-4">
              <MetricPill label="Submitted" value={`${summary?.submitted ?? '—'}`} />
              <MetricPill label="Missing" value={`${summary?.missing ?? '—'}`} />
              <MetricPill label="Late" value={`${summary?.late ?? '—'}`} />
              <MetricPill label="Graded" value={`${summary?.graded ?? '—'}`} />
            </div>
            {summary && (
              <div className="mt-4">
                <ProgressBar value={summary.total > 0 ? Math.round((summary.graded / summary.total) * 100) : 0} />
                <p className="mt-2 text-xs font-semibold text-ks-muted">{summary.graded}/{summary.total} graded</p>
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-3">
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
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = submissions.filter((s) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Submitted') return s.status === 'SUBMITTED';
    if (activeFilter === 'Ungraded') return s.status === 'SUBMITTED' && s.score == null;
    if (activeFilter === 'Late') return s.isLate;
    if (activeFilter === 'Returned') return s.status === 'RETURNED';
    if (activeFilter === 'Graded') return s.status === 'GRADED';
    return true;
  });

  return (
    <ElearningShell title="Submissions Queue" eyebrow="Grading desk">
      <Panel title="Filters" icon={<Users />}>
        <div className="flex flex-wrap gap-2">{['All', 'Submitted', 'Ungraded', 'Late', 'Returned', 'Graded'].map((label) => (
          <FilterChip key={label} active={activeFilter === label} onClick={() => setActiveFilter(label)}>{label}</FilterChip>
        ))}</div>
      </Panel>
      <Panel title="Ready for Review" icon={<FileText />}>
        {isLoading && <LoadingPlaceholder />}
        <Table columns={['Student', 'Status', 'Submitted', 'File', 'Score', 'Action']}>
          {filtered.map((item) => (
            <tr key={item.id} className="even:bg-slate-50">
              <Td>{item.studentName ?? item.studentId}</Td>
              <Td><PublishBadge status={item.status} />{item.isLate && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">Late</span>}</Td>
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
  const { courseId, assignmentId, submissionId } = useParams();
  const navigate = useNavigate();
  const { data: submission, isLoading } = useSubmission(submissionId);
  const gradeMut = useGradeSubmission();
  const returnMut = useReturnSubmission();

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (submission) {
      setScore(submission.score != null ? String(submission.score) : '');
      setFeedback(submission.feedback ?? '');
    }
  }, [submission?.id]);

  function handleSave() {
    if (!submissionId || score === '') { toast('Enter a score', 'warning'); return; }
    gradeMut.mutate({ submissionId, score: Number(score), feedback: feedback || undefined }, {
      onSuccess: () => toast('Grade saved successfully', 'success'),
      onError: () => toast('Failed to save grade', 'error'),
    });
  }

  function handleReturn() {
    if (!submissionId) return;
    returnMut.mutate({ submissionId, feedback: feedback || undefined }, {
      onSuccess: () => toast('Submission returned to student for correction', 'warning'),
      onError: () => toast('Failed to return submission', 'error'),
    });
  }

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
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Score</span>
                <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={score} onChange={(e) => setScore(e.target.value)} placeholder="Score" min={0} max={submission.maxScore} />
              </label>
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Max score</span>
                <input type="number" readOnly className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none" value={submission.maxScore ?? ''} placeholder="Max score" />
              </label>
            </div>
            <label className="mt-4 block space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Feedback comment</span>
              <textarea className="min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLike tone="primary" onClick={handleSave} disabled={gradeMut.isPending}>{gradeMut.isPending ? 'Saving…' : 'Save grade'}</ButtonLike>
              <ButtonLike onClick={handleReturn} disabled={returnMut.isPending}>Return for correction</ButtonLike>
              <ButtonLike onClick={() => navigate(`/teacher/elearning/courses/${courseId}/assignments/${assignmentId}/submissions`)}>Grade next</ButtonLike>
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
  const createQuizMut = useCreateQuiz();
  const updateQuizMut = useUpdateQuizMutation();
  const publishMut = usePublishQuiz();
  const closeMut = useCloseQuiz();
  const addQuestionMut = useAddQuizQuestion();

  const [settings, setSettings] = useState({ title: '', timeLimitMinutes: '', maxAttempts: '3', passingScore: '' });
  const [resolvedQuizId, setResolvedQuizId] = useState<string | undefined>(quizId);
  const [qType, setQType] = useState<'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER'>('MCQ');
  const [qForm, setQForm] = useState({ prompt: '', points: '1', correctAnswer: '', explanation: '' });
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);

  useEffect(() => {
    if (quiz) {
      setSettings({ title: quiz.title, timeLimitMinutes: String(quiz.timeLimitMinutes ?? ''), maxAttempts: String(quiz.maxAttempts), passingScore: String(quiz.passingScore ?? '') });
      setResolvedQuizId(quiz.id);
    }
  }, [quiz?.id]);

  function handleSaveSettings() {
    if (!settings.title.trim()) { toast('Enter a quiz title', 'warning'); return; }
    const body: Record<string, unknown> = { title: settings.title, timeLimitMinutes: settings.timeLimitMinutes ? Number(settings.timeLimitMinutes) : undefined, maxAttempts: settings.maxAttempts ? Number(settings.maxAttempts) : undefined, passingScore: settings.passingScore ? Number(settings.passingScore) : undefined };
    if (resolvedQuizId) {
      updateQuizMut.mutate({ courseId: courseId!, quizId: resolvedQuizId, body }, {
        onSuccess: () => toast('Quiz settings updated', 'success'),
        onError: () => toast('Failed to update quiz', 'error'),
      });
    } else {
      createQuizMut.mutate({ courseId: courseId!, body }, {
        onSuccess: (data) => { const id = (data as unknown as Record<string, unknown>)?.id as string | undefined; toast('Quiz created', 'success'); if (id) setResolvedQuizId(id); },
        onError: () => toast('Failed to create quiz', 'error'),
      });
    }
  }

  function handlePublish() {
    const id = resolvedQuizId;
    if (!id) { toast('Save the quiz first', 'warning'); return; }
    publishMut.mutate({ courseId: courseId!, quizId: id }, { onSuccess: () => toast('Quiz published — students can now attempt', 'success'), onError: () => toast('Failed to publish quiz', 'error') });
  }

  function handleAddQuestion() {
    const id = resolvedQuizId;
    if (!id) { toast('Save the quiz settings first', 'warning'); return; }
    if (!qForm.prompt.trim()) { toast('Enter a question prompt', 'warning'); return; }
    const apiType = qType === 'MCQ' ? 'MULTIPLE_CHOICE' : qType;
    const body: Record<string, unknown> = { type: apiType, prompt: qForm.prompt, points: Number(qForm.points) || 1, correctAnswer: qForm.correctAnswer || undefined, explanation: qForm.explanation || undefined };
    if (qType === 'MCQ') {
      body.options = options.filter(Boolean).map((text, i) => ({ text, isCorrect: i === correctOption }));
    }
    addQuestionMut.mutate({ quizId: id, courseId: courseId!, body }, {
      onSuccess: () => { toast('Question added', 'success'); setQForm({ prompt: '', points: '1', correctAnswer: '', explanation: '' }); setOptions(['', '', '', '']); setCorrectOption(0); },
      onError: () => toast('Failed to add question', 'error'),
    });
  }

  const typeLabels: Record<string, string> = { MCQ: 'Multiple choice', TRUE_FALSE: 'True / false', SHORT_ANSWER: 'Short answer' };

  return (
    <ElearningShell title="Quiz Builder" eyebrow="Validate answer keys before publishing">
      {isLoading && <LoadingPlaceholder />}
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Quiz Settings" icon={<HelpCircle />}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Title</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={settings.title} onChange={(e) => setSettings((p) => ({ ...p, title: e.target.value }))} placeholder="Quiz title" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Time limit (minutes)</span>
              <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={settings.timeLimitMinutes} onChange={(e) => setSettings((p) => ({ ...p, timeLimitMinutes: e.target.value }))} placeholder="No limit" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Max attempts</span>
              <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={settings.maxAttempts} onChange={(e) => setSettings((p) => ({ ...p, maxAttempts: e.target.value }))} placeholder="3" />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Passing score (%)</span>
              <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={settings.passingScore} onChange={(e) => setSettings((p) => ({ ...p, passingScore: e.target.value }))} placeholder="50" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={handleSaveSettings} disabled={createQuizMut.isPending}>{createQuizMut.isPending ? 'Saving…' : 'Save draft'}</ButtonLike>
            {quiz?.status !== 'PUBLISHED' && quiz?.status !== 'CLOSED' && (
              <ButtonLike tone="primary" onClick={handlePublish} disabled={publishMut.isPending}>{publishMut.isPending ? 'Publishing…' : 'Publish quiz'}</ButtonLike>
            )}
            {quiz?.status === 'PUBLISHED' && resolvedQuizId && (
              <ButtonLike tone="danger" disabled={closeMut.isPending} onClick={() => closeMut.mutate({ courseId: courseId!, quizId: resolvedQuizId }, { onSuccess: () => toast('Quiz closed — no new attempts allowed', 'warning'), onError: () => toast('Failed to close quiz', 'error') })}>
                {closeMut.isPending ? 'Closing…' : 'Close quiz'}
              </ButtonLike>
            )}
            <ButtonLike onClick={() => toast('Opening quiz preview…', 'info')}>Preview attempt</ButtonLike>
          </div>
        </Panel>
        <Panel title="Question Builder" icon={<PenLine />}>
          <div className="mb-5 flex gap-2">
            {(['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER'] as const).map((t) => (
              <button key={t} onClick={() => setQType(t)} className={`rounded-2xl border px-4 py-2 text-xs font-black ${qType === t ? 'border-[#6C63FF] bg-[#EEEDFF] text-[#3D35CC]' : 'border-slate-200 bg-white text-ks-muted'}`}>{typeLabels[t]}</button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Question prompt</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={qForm.prompt} onChange={(e) => setQForm((p) => ({ ...p, prompt: e.target.value }))} placeholder="Question prompt" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Points</span>
              <input type="number" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={qForm.points} onChange={(e) => setQForm((p) => ({ ...p, points: e.target.value }))} placeholder="1" />
            </label>
            {qType !== 'MCQ' && (
              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Correct answer</span>
                <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={qForm.correctAnswer} onChange={(e) => setQForm((p) => ({ ...p, correctAnswer: e.target.value }))} placeholder={qType === 'TRUE_FALSE' ? 'true or false' : 'Model answer'} />
              </label>
            )}
            <label className="space-y-2 md:col-span-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Explanation</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={qForm.explanation} onChange={(e) => setQForm((p) => ({ ...p, explanation: e.target.value }))} placeholder="Why is this the correct answer?" />
            </label>
          </div>
          {qType === 'MCQ' && (
            <div className="mt-4 rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-ks-muted">MCQ options — click radio to mark correct</p>
              {options.map((opt, i) => (
                <div key={i} className="mt-3 flex items-center gap-2">
                  <input type="radio" name="correctOption" checked={correctOption === i} onChange={() => setCorrectOption(i)} className="h-4 w-4 accent-[#6C63FF]" />
                  <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold" value={opt} onChange={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); }} placeholder={`Option ${['A', 'B', 'C', 'D'][i]}`} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-4">
            <ButtonLike tone="primary" onClick={handleAddQuestion} disabled={addQuestionMut.isPending}>{addQuestionMut.isPending ? 'Adding…' : 'Add question'}</ButtonLike>
          </div>
        </Panel>
      </div>
      <Panel title="Question List and Validation" icon={<ShieldCheck />}>
        <div className="space-y-4">
          {quiz?.questions.map((q, index) => <QuestionCard key={q.id} question={q} index={index} quizId={resolvedQuizId ?? ''} courseId={courseId ?? ''} />)}
          {!isLoading && (quiz?.questions.length ?? 0) === 0 && (
            <p className="py-4 text-sm font-semibold text-ks-muted">No questions yet. Use the builder above to add questions.</p>
          )}
        </div>
        {(quiz?.questions.length ?? 0) > 0 && (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-ks-slate">{quiz?.questions.length} questions · {quiz?.questions.reduce((n, q) => n + q.points, 0)} total points</p>
            {quiz?.timeLimitMinutes && <p className="mt-1 text-sm font-semibold text-ks-muted">Time limit: {quiz.timeLimitMinutes} minutes</p>}
            {quiz?.passingScore && <p className="text-sm font-semibold text-ks-muted">Pass mark: {quiz.passingScore}%</p>}
          </div>
        )}
      </Panel>
    </ElearningShell>
  );
}

export function QuizResultsPage() {
  const { courseId, quizId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: attempts = [], isLoading } = useQuizResults(courseId, quizId);
  const display = course ? mapApiCourse(course) : null;
  const pendingCount = attempts.filter((a) => (a.manualMarksPending ?? 0) > 0).length;

  return (
    <ElearningShell
      title="Quiz Results"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Attempt results and scoring'}
      action={pendingCount > 0 ? <ElButton to={`/teacher/elearning/courses/${courseId}/quizzes/${quizId}/manual-marking`}><PenLine className="mr-2 inline h-4 w-4" />Mark {pendingCount} short answers</ElButton> : undefined}
    >
      {display && <CourseTabs courseId={display.id} active="quizzes" />}
      {isLoading && <LoadingPlaceholder />}
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <MetricPill label="Total attempts" value={`${attempts.length}`} />
        <MetricPill label="Submitted" value={`${attempts.filter((a) => a.status !== 'IN_PROGRESS').length}`} />
        <MetricPill label="Passed" value={`${attempts.filter((a) => a.isPassed === true).length}`} />
        <MetricPill label="Manual pending" value={`${pendingCount}`} />
      </div>
      <Panel title="Attempt Results" icon={<BarChart3 />}>
        <Table columns={['Student', 'Status', 'Score', 'Time', 'Manual pending', 'Actions']}>
          {attempts.map((item) => (
            <tr key={item.id} className="even:bg-slate-50">
              <Td>{item.studentName ?? item.studentId}</Td>
              <Td><PublishBadge status={item.status} /></Td>
              <Td>{item.percentScore != null ? `${Math.round(item.percentScore)}%` : '—'}</Td>
              <Td>{item.startedAt ? new Date(item.startedAt).toLocaleDateString() : '—'}</Td>
              <Td>
                {(item.manualMarksPending ?? 0) > 0
                  ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-black text-amber-700">{item.manualMarksPending} pending</span>
                  : <span className="text-xs text-ks-muted">—</span>}
              </Td>
              <Td>
                {(item.manualMarksPending ?? 0) > 0 && (
                  <NavLink className="font-black text-[#6C63FF] text-xs" to={`/teacher/elearning/courses/${courseId}/quizzes/${quizId}/manual-marking`}>Mark</NavLink>
                )}
              </Td>
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

function AttemptMarkingCard({ attempt }: { attempt: { id: string; studentName?: string; studentId: string; manualMarksPending?: number } }) {
  const { data: detail, isLoading } = useAttemptDetail(attempt.id);
  const gradeMut = useGradeShortAnswer();
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const shortAnswers = detail?.answers?.filter((a) => a.questionType === 'SHORT_ANSWER' && a.score == null) ?? [];

  function handleGrade(answerId: string, questionId: string) {
    const score = Number(scores[answerId]);
    if (isNaN(score)) { toast('Enter a numeric score', 'warning'); return; }
    gradeMut.mutate(
      { attemptId: attempt.id, questionId, scoreAwarded: score, feedback: feedbacks[answerId] || undefined },
      {
        onSuccess: () => { setSaved((p) => ({ ...p, [answerId]: true })); toast('Answer marked', 'success'); },
        onError: () => toast('Failed to save mark', 'error'),
      },
    );
  }

  return (
    <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-black text-ks-slate">{attempt.studentName ?? attempt.studentId}</p>
          <p className="text-sm font-semibold text-ks-muted">{attempt.manualMarksPending ?? shortAnswers.length} short-answer responses pending marks</p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">Manual marking needed</span>
      </div>
      {isLoading && <LoadingPlaceholder />}
      {!isLoading && shortAnswers.length === 0 && (
        <p className="py-3 text-sm font-semibold text-ks-muted">No ungraded short-answer responses in this attempt.</p>
      )}
      {shortAnswers.map((answer) => (
        <div key={answer.id} className={`mb-4 rounded-2xl border p-4 ${saved[answer.id] ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
          {answer.prompt && (
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-ks-muted">Question</p>
          )}
          {answer.prompt && <p className="mb-3 font-semibold text-ks-slate">{answer.prompt}</p>}
          <p className="mb-1 text-xs font-black uppercase tracking-widest text-ks-muted">Student's answer</p>
          <div className="mb-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-ks-slate">
            {answer.textAnswer?.trim() || <span className="text-ks-muted italic">No text submitted</span>}
          </div>
          {saved[answer.id] ? (
            <p className="font-black text-emerald-600">✓ Marked — score: {scores[answer.id]}</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-[120px_1fr_auto]">
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Score</span>
                <input
                  type="number"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                  value={scores[answer.id] ?? ''}
                  onChange={(e) => setScores((p) => ({ ...p, [answer.id]: e.target.value }))}
                  placeholder="0"
                  min={0}
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Feedback (optional)</span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#6C63FF]"
                  value={feedbacks[answer.id] ?? ''}
                  onChange={(e) => setFeedbacks((p) => ({ ...p, [answer.id]: e.target.value }))}
                  placeholder="Good explanation of…"
                />
              </label>
              <div className="flex items-end">
                <ButtonLike tone="primary" onClick={() => handleGrade(answer.id, answer.questionId)} disabled={gradeMut.isPending}>
                  {gradeMut.isPending ? 'Saving…' : 'Save mark'}
                </ButtonLike>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ManualMarkingPage() {
  const { courseId, quizId } = useParams();
  const { data: course } = useElearningCourse(courseId);
  const { data: attempts = [], isLoading } = useQuizResults(courseId, quizId);
  const display = course ? mapApiCourse(course) : null;
  const pending = attempts.filter((a) => (a.manualMarksPending ?? 0) > 0);

  return (
    <ElearningShell title="Short Answer Marking" eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Manual marking queue'}>
      {display && <CourseTabs courseId={display.id} active="quizzes" />}
      {isLoading && <LoadingPlaceholder />}
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <MetricPill label="Pending" value={`${pending.length}`} />
        <MetricPill label="Completed" value={`${attempts.length - pending.length}`} />
        <MetricPill label="Total attempts" value={`${attempts.length}`} />
      </div>
      <Panel title="Manual Marking Queue" icon={<PenLine />}>
        {pending.map((attempt) => (
          <AttemptMarkingCard key={attempt.id} attempt={attempt} />
        ))}
        {!isLoading && pending.length === 0 && (
          <p className="py-6 text-center text-sm font-semibold text-ks-muted">No manual marks pending. All short answers have been graded.</p>
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
  const createAnnMut = useCreateAnnouncement();
  const publishAnnMut = usePublishAnnouncement();
  const replyMut = useAddDiscussionReply();
  const resolveMut = useResolveDiscussion();

  const [annForm, setAnnForm] = useState({ title: '', body: '', audience: 'STUDENTS' });
  const [createdAnnId, setCreatedAnnId] = useState<string | undefined>(undefined);
  const [selectedThread, setSelectedThread] = useState<string | undefined>(undefined);
  const [replyBody, setReplyBody] = useState('');

  function handleSaveAnn() {
    if (!annForm.title.trim()) { toast('Enter a title', 'warning'); return; }
    createAnnMut.mutate({ courseId: courseId!, body: { title: annForm.title, body: annForm.body, audience: annForm.audience } }, {
      onSuccess: (data) => { const id = (data as Record<string, unknown>)?.id as string | undefined; toast('Announcement draft saved', 'success'); if (id) setCreatedAnnId(id); },
      onError: () => toast('Failed to save announcement', 'error'),
    });
  }

  function handlePublishAnn() {
    if (!createdAnnId) { toast('Save the announcement draft first', 'warning'); return; }
    publishAnnMut.mutate({ courseId: courseId!, announcementId: createdAnnId }, {
      onSuccess: () => { toast('Announcement published — students notified', 'success'); setAnnForm({ title: '', body: '', audience: 'STUDENTS' }); setCreatedAnnId(undefined); },
      onError: () => toast('Failed to publish announcement', 'error'),
    });
  }

  function handleReply() {
    if (!selectedThread) { toast('Select a thread to reply to', 'warning'); return; }
    if (!replyBody.trim()) { toast('Enter a reply', 'warning'); return; }
    replyMut.mutate({ threadId: selectedThread, body: replyBody }, {
      onSuccess: () => { toast('Reply posted', 'success'); setReplyBody(''); },
      onError: () => toast('Failed to post reply', 'error'),
    });
  }

  function handleResolve() {
    if (!selectedThread) { toast('Select a thread to resolve', 'warning'); return; }
    resolveMut.mutate(selectedThread, {
      onSuccess: () => toast('Thread marked as resolved', 'success'),
      onError: () => toast('Failed to resolve thread', 'error'),
    });
  }

  return (
    <ElearningShell
      title="Announcements and Discussions"
      eyebrow={display ? `${display.subjectName} — ${display.className}` : 'Course'}
    >
      {display && <CourseTabs courseId={display.id} active="communication" />}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Course Announcements" icon={<Bell />}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Title</span>
              <input className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={annForm.title} onChange={(e) => setAnnForm((p) => ({ ...p, title: e.target.value }))} placeholder="Title" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Audience</span>
              <select className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={annForm.audience} onChange={(e) => setAnnForm((p) => ({ ...p, audience: e.target.value }))}>
                <option value="STUDENTS">Students</option>
                <option value="ALL">All</option>
              </select>
            </label>
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-ks-muted">Announcement body</span>
            <textarea className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF]" value={annForm.body} onChange={(e) => setAnnForm((p) => ({ ...p, body: e.target.value }))} placeholder="Write announcement..." />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike onClick={handleSaveAnn} disabled={createAnnMut.isPending}>Save draft</ButtonLike>
            <ButtonLike tone="primary" onClick={handlePublishAnn} disabled={publishAnnMut.isPending || !createdAnnId}>Publish and notify</ButtonLike>
          </div>
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
              <button
                key={item.id}
                onClick={() => setSelectedThread((prev) => prev === item.id ? undefined : item.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${selectedThread === item.id ? 'border-[#6C63FF] bg-[#EEEDFF]' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <p className="font-black text-ks-slate">{item.title}</p>
                <p className="mt-1 text-sm font-semibold text-ks-muted">{item.replies.length} replies · {item.isResolved ? 'Resolved' : 'Open'}</p>
              </button>
            ))}
            {!loadingDisc && discussions.length === 0 && (
              <p className="py-2 text-sm font-semibold text-ks-muted">No discussion threads yet.</p>
            )}
          </div>
          <label className="mt-4 block space-y-2">
            <span className="text-xs font-black uppercase tracking-widest text-ks-muted">{selectedThread ? 'Teacher reply' : 'Teacher reply — select a thread above'}</span>
            <textarea className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#6C63FF] disabled:opacity-50" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} disabled={!selectedThread} placeholder={selectedThread ? 'Type your reply...' : 'Select a thread first'} />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <ButtonLike tone="primary" onClick={handleReply} disabled={replyMut.isPending || !selectedThread}>Reply</ButtonLike>
            <ButtonLike onClick={handleResolve} disabled={resolveMut.isPending || !selectedThread}>Resolve thread</ButtonLike>
            <ButtonLike onClick={() => toast('Thread pinned', 'info')}>Pin</ButtonLike>
          </div>
        </Panel>
      </div>
    </ElearningShell>
  );
}

// ─── Leadership pages ─────────────────────────────────────────────────────────

export function StudentElearningPage() {
  const { data, isLoading, isError } = useStudentLearningSummary();
  const enrollments = data?.courses ?? [];
  return (
    <ElearningShell title="My Learning" eyebrow="Student learning desk">
      <div className="grid gap-5 md:grid-cols-4">
        <ElStat label="My subjects" value={`${enrollments.length}`} detail="Enrolled e-learning courses" />
        <ElStat label="Assignments" value={`${data?.pendingAssignments ?? 0}`} detail="Pending or due" />
        <ElStat label="Open quizzes" value={`${data?.availableQuizzes ?? 0}`} detail="Ready to attempt" />
        <ElStat label="Unread materials" value={`${data?.unviewedMaterials ?? 0}`} detail="Notes and files to read" />
      </div>
      <Panel title="My Subjects" icon={<BookOpen />}>
        {isLoading && <LoadingPlaceholder />}
        {isError && <ErrorPlaceholder message="Could not load your learning summary." />}
        <div className="grid gap-4 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const course = enrollment.courseSpace;
            if (!course) return null;
            return (
              <NavLink to={`/student/elearning/courses/${course.id}`} key={course.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg hover:border-[#6C63FF]">
                <PublishBadge status={course.status} />
                <h3 className="mt-4 font-display text-xl font-black text-ks-slate">{course.subjectName}</h3>
                <p className="text-sm font-semibold text-ks-muted">{course.className}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-black text-ks-muted">
                  <span>{course.lessons?.length ?? 0} lessons</span>
                  <span>{course.enrolledCount} learners</span>
                </div>
              </NavLink>
            );
          })}
          {!isLoading && enrollments.length === 0 && <p className="col-span-3 py-6 text-sm font-semibold text-ks-muted">No e-learning courses are available yet.</p>}
        </div>
      </Panel>
    </ElearningShell>
  );
}

export function ParentElearningPage() {
  const { childId } = useParams();
  const { data, isLoading, isError } = useParentLearningSummary(childId);
  const enrollments = data?.enrollments ?? [];

  if (!childId) {
    return (
      <ElearningShell title="Child Learning Summary" eyebrow="Parent learning desk">
        <Panel title="Select a Child" icon={<Users />}>
          <p className="text-sm font-semibold text-ks-muted">Open this page from a child profile so the learning summary can be scoped correctly.</p>
        </Panel>
      </ElearningShell>
    );
  }

  return (
    <ElearningShell title="Child Learning Summary" eyebrow={`Student ${childId}`}>
      <div className="grid gap-5 md:grid-cols-4">
        <ElStat label="Overall progress" value={`${data?.overallCompletion ?? 0}%`} detail="Across enrolled courses" />
        <ElStat label="Missing or pending" value={`${data?.pendingAssignments ?? 0}`} detail="Assignments needing action" />
        <ElStat label="Open quizzes" value={`${data?.availableQuizzes ?? 0}`} detail="Quiz attempts available" />
        <ElStat label="Unread materials" value={`${data?.unviewedMaterials ?? 0}`} detail="Materials not yet viewed" />
      </div>
      <Panel title="Subject Progress" icon={<BarChart3 />}>
        {isLoading && <LoadingPlaceholder />}
        {isError && <ErrorPlaceholder message="Could not load child learning summary." />}
        <div className="grid gap-4 lg:grid-cols-3">
          {enrollments.map((enrollment) => {
            const course = enrollment.courseSpace;
            const progress = data?.progresses?.find((item) => item.courseId === enrollment.courseSpaceId || item.courseId === course?.id);
            if (!course) return null;
            return (
              <div key={course.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-display text-xl font-black text-ks-slate">{course.subjectName}</h3>
                <p className="text-sm font-semibold text-ks-muted">{course.className}</p>
                <div className="mt-4">
                  <ProgressBar value={progress?.completionPercent ?? 0} />
                  <p className="mt-2 text-xs font-black uppercase tracking-widest text-ks-muted">{progress?.completionPercent ?? 0}% complete</p>
                </div>
              </div>
            );
          })}
          {!isLoading && enrollments.length === 0 && <p className="col-span-3 py-6 text-sm font-semibold text-ks-muted">No e-learning courses are linked to this child yet.</p>}
        </div>
      </Panel>
    </ElearningShell>
  );
}

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
  const syncCourses = useAdminSyncCourses();
  const syncEnrollments = useAdminSyncEnrollments();
  const repairOrphans = useAdminRepairOrphans();

  function runAdminAction(label: string, action: () => Promise<unknown>) {
    action()
      .then(() => toast(`${label} completed`, 'success'))
      .catch((e: unknown) => {
        const err = e as { response?: { data?: { message?: string } }; message?: string };
        toast(err?.response?.data?.message ?? err?.message ?? `${label} failed`, 'error');
      });
  }

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
      <Panel title="Course Generation and Repair" icon={<MonitorCheck />}>
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => runAdminAction('Course generation', () => syncCourses.mutateAsync({}))}
            disabled={syncCourses.isPending}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#6C63FF] disabled:opacity-50"
          >
            <p className="font-black text-ks-slate">Generate missing courses</p>
            <p className="mt-1 text-sm font-semibold text-ks-muted">Create course spaces from official class-subject assignments.</p>
          </button>
          <button
            onClick={() => runAdminAction('Enrollment sync', () => syncEnrollments.mutateAsync({}))}
            disabled={syncEnrollments.isPending}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#6C63FF] disabled:opacity-50"
          >
            <p className="font-black text-ks-slate">Sync enrollments</p>
            <p className="mt-1 text-sm font-semibold text-ks-muted">Pull students from class rosters and A-Level subject enrollments.</p>
          </button>
          <button
            onClick={() => runAdminAction('Orphan repair', () => repairOrphans.mutateAsync({}))}
            disabled={repairOrphans.isPending}
            className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#6C63FF] disabled:opacity-50"
          >
            <p className="font-black text-ks-slate">Repair orphaned courses</p>
            <p className="mt-1 text-sm font-semibold text-ks-muted">Archive courses without assignments and update teacher ownership.</p>
          </button>
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

function CourseCard({ course: item, readOnly = false, onClone }: { course: CourseDisplay; readOnly?: boolean; onClone?: () => void }) {
  const to = readOnly ? `/hod/elearning/courses/${item.id}` : `/teacher/elearning/courses/${item.id}`;
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      {onClone && (
        <button
          onClick={onClone}
          className="absolute right-3 top-3 z-10 rounded-xl bg-white/20 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-white/30"
          title="Copy to new term"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
      <NavLink to={to} className="block">
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
          <div className="flex items-center justify-between">
            <p className="text-sm font-black text-[#6C63FF]">{readOnly ? 'Review course' : 'Manage workspace'}</p>
            {item.term && <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-ks-muted">{item.term}</span>}
          </div>
        </div>
      </NavLink>
    </div>
  );
}

function LessonUnit({ lesson, courseId, index }: { lesson: ElearningLesson; courseId: string; index: number }) {
  const publishMut = usePublishLesson();
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
          <ButtonLike
            disabled={publishMut.isPending || lesson.status === 'PUBLISHED'}
            onClick={() => publishMut.mutate({ courseId, lessonId: lesson.id }, { onSuccess: () => toast('Lesson published', 'success'), onError: () => toast('Failed to publish lesson', 'error') })}
          >
            {lesson.status === 'PUBLISHED' ? 'Published' : publishMut.isPending ? 'Publishing…' : 'Publish'}
          </ButtonLike>
        </div>
      </div>
    </div>
  );
}

function MaterialCard({ item, courseId, lessonId }: { item: ElearningMaterial; courseId: string; lessonId: string }) {
  return (
    <NavLink to={`/teacher/elearning/courses/${courseId}/lessons/${lessonId}/materials/${item.id}/edit`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg">
      <div className="flex justify-between gap-3"><FileText className="h-6 w-6 text-[#6C63FF]" /><PublishBadge status={item.status} /></div>
      <h3 className="mt-4 font-display text-lg font-black text-ks-slate">{item.title}</h3>
      <p className="mt-2 text-sm font-semibold text-ks-muted">{item.type} · {item.downloadable ? 'Downloadable' : 'View only'}</p>
      <div className="mt-4 text-xs font-black text-ks-muted">
        <span>{item.viewCount} views</span>
      </div>
    </NavLink>
  );
}

function AssignmentCard({ item, courseId }: { item: ElearningAssignment; courseId: string }) {
  return (
    <NavLink to={`/teacher/elearning/courses/${courseId}/assignments/${item.id}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-lg">
      <div className="flex justify-between"><ClipboardCheck className="h-6 w-6 text-[#6C63FF]" /><PublishBadge status={item.status} /></div>
      <h3 className="mt-5 font-display text-xl font-black text-ks-slate">{item.title}</h3>
      <p className="mt-2 text-sm font-semibold text-ks-muted">Due {fmtDate(item.dueAt)} · {item.type}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs font-black">
        <span>Max score: {item.maxScore ?? '—'}</span>
        <span>{item.allowLateSubmission ? 'Late allowed' : 'No late'}</span>
      </div>
    </NavLink>
  );
}

function QuestionCard({ question, index, quizId, courseId }: { question: ElearningQuizQuestion; index: number; quizId: string; courseId: string }) {
  const deleteMut = useDeleteQuestion();
  return (
    <div className="rounded-3xl border border-slate-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Question {index + 1}</p>
          <h3 className="font-black text-ks-slate">{question.prompt}</h3>
        </div>
        <div className="flex items-center gap-2">
          <PublishBadge status={question.type} />
          <button
            onClick={() => deleteMut.mutate({ quizId, questionId: question.id, courseId }, { onSuccess: () => toast('Question removed', 'success'), onError: () => toast('Failed to remove', 'error') })}
            disabled={deleteMut.isPending}
            className="rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-40"
          >
            {deleteMut.isPending ? '…' : 'Remove'}
          </button>
        </div>
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

function ActionRow({ title, detail, to, disabled = false }: { title: string; detail: string; to: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-70">
        <div><p className="font-black text-ks-slate">{title}</p><p className="text-sm font-semibold text-ks-muted">{detail}</p></div>
        <span className="text-sm font-black text-slate-400">Save first</span>
      </div>
    );
  }
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

void FormGrid;
void TextArea;
void TypeGrid;

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

function FilterChip({ children, active, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-black transition ${active ? 'bg-[#6C63FF] text-white' : 'bg-slate-100 text-ks-muted hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );
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

// ─── Student Journey Pages ────────────────────────────────────────────────────

export function StudentCourseViewPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data: course, isLoading: courseLoading } = useElearningCourse(courseId);
  const { data: lessons = [], isLoading: lessonsLoading } = useElearningLessons(courseId);
  const { data: assignments = [] } = useElearningAssignments(courseId);
  const { data: quizzes = [] } = useElearningQuizzes(courseId);
  const { data: announcements = [] } = useElearningAnnouncements(courseId);
  const { data: progress } = useMyProgress(courseId);
  const display = course ? mapApiCourse(course) : null;

  const progressPct = (progress as Record<string, unknown> | undefined)?.completionPercent as number | undefined ?? 0;
  const publishedLessons = lessons.filter((l) => l.status === 'PUBLISHED');
  const publishedAssignments = assignments.filter((a) => a.status === 'PUBLISHED');
  const publishedQuizzes = quizzes.filter((q) => q.status === 'PUBLISHED');
  const pinnedAnnouncements = announcements.filter((a) => (a as unknown as Record<string, unknown>).isPinned);
  const latestAnnouncements = [...pinnedAnnouncements, ...announcements.filter((a) => !(a as unknown as Record<string, unknown>).isPinned)].slice(0, 3);

  return (
    <ElearningShell
      title={display?.subjectName ?? 'Course'}
      eyebrow={display ? `${display.className} · ${display.term}` : 'Loading…'}
    >
      {(courseLoading || lessonsLoading) && <LoadingPlaceholder />}
      <div className="grid gap-5 md:grid-cols-4">
        <ElStat label="Lessons" value={`${publishedLessons.length}`} detail="Published lessons" />
        <ElStat label="Assignments" value={`${publishedAssignments.length}`} detail="Open assignments" />
        <ElStat label="Quizzes" value={`${publishedQuizzes.length}`} detail="Available quizzes" />
        <ElStat label="Progress" value={`${Math.round(progressPct)}%`} detail="Course completion" />
      </div>
      {progressPct > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <ProgressBar value={Math.round(progressPct)} />
          <p className="mt-2 text-xs font-black uppercase tracking-widest text-ks-muted">{Math.round(progressPct)}% complete</p>
        </div>
      )}
      {latestAnnouncements.length > 0 && (
        <Panel title="Announcements" icon={<Bell />}>
          <div className="space-y-3">
            {latestAnnouncements.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-black text-ks-slate">{a.title}</p>
                <p className="mt-1 text-sm text-ks-muted">{a.body}</p>
                <p className="mt-2 text-xs text-ks-muted">{fmtDate(a.createdAt)}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <Panel title="Lessons" icon={<BookOpen />}>
        {publishedLessons.length === 0 && !lessonsLoading && (
          <p className="py-4 text-sm font-semibold text-ks-muted">No lessons published yet.</p>
        )}
        <div className="space-y-3">
          {publishedLessons.map((lesson, idx) => (
            <button
              key={lesson.id}
              onClick={() => navigate(`/student/elearning/courses/${courseId}/lessons/${lesson.id}`)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#6C63FF] hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEEDFF] text-xs font-black text-[#3D35CC]">{idx + 1}</span>
                <div>
                  <p className="font-black text-ks-slate">{lesson.title}</p>
                  {lesson.description && <p className="text-xs text-ks-muted">{lesson.description}</p>}
                </div>
              </div>
              <span className="text-xs font-semibold text-[#6C63FF]">Open &rarr;</span>
            </button>
          ))}
        </div>
      </Panel>
      {publishedAssignments.length > 0 && (
        <Panel title="Assignments" icon={<ClipboardCheck />}>
          <div className="space-y-3">
            {publishedAssignments.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/student/elearning/courses/${courseId}/assignments/${a.id}`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#6C63FF] hover:shadow-md"
              >
                <div>
                  <p className="font-black text-ks-slate">{a.title}</p>
                  <p className="text-xs text-ks-muted">Due {fmtDate(a.dueAt)} · Max {a.maxScore ?? '—'} marks</p>
                </div>
                <span className="text-xs font-semibold text-[#6C63FF]">Submit &rarr;</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
      {publishedQuizzes.length > 0 && (
        <Panel title="Quizzes" icon={<HelpCircle />}>
          <div className="space-y-3">
            {publishedQuizzes.map((q) => (
              <button
                key={q.id}
                onClick={() => navigate(`/student/elearning/courses/${courseId}/quizzes/${q.id}/attempt`)}
                className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#6C63FF] hover:shadow-md"
              >
                <div>
                  <p className="font-black text-ks-slate">{q.title}</p>
                  <p className="text-xs text-ks-muted">{q.questions.length} questions · {q.timeLimitMinutes ? `${q.timeLimitMinutes} min` : 'No time limit'} · Max {q.maxAttempts} attempt{q.maxAttempts !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-xs font-semibold text-[#6C63FF]">Attempt &rarr;</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
    </ElearningShell>
  );
}

export function StudentLessonViewPage() {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();
  const { data: allMaterials = [], isLoading } = useElearningMaterials(courseId, lessonId);
  const { data: lessons = [] } = useElearningLessons(courseId);
  const { data: assignments = [] } = useElearningAssignments(courseId);
  const markViewedMut = useMarkMaterialViewedMutation();

  const lesson = lessons.find((l) => l.id === lessonId);
  const lessonAssignments = assignments.filter((a) => a.lessonId === lessonId && a.status === 'PUBLISHED');
  const published = allMaterials.filter((m) => m.status === 'PUBLISHED').sort((a, b) => a.orderIndex - b.orderIndex);

  function handleOpenMaterial(m: ElearningMaterial) {
    markViewedMut.mutate(m.id);
  }

  function fileUrl(fileKey: string) {
    const slash = fileKey.indexOf('/');
    if (slash < 0) return `/api/v1/elearning/files/materials/${encodeURIComponent(fileKey)}`;
    const domain = fileKey.substring(0, slash);
    const filename = fileKey.substring(slash + 1);
    return `/api/v1/elearning/files/${encodeURIComponent(domain)}/${encodeURIComponent(filename)}`;
  }

  function renderMaterial(m: ElearningMaterial) {
    const type = m.type.toUpperCase();
    if (type === 'NOTE') {
      return (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-ks-slate">{m.body ?? '—'}</pre>
        </div>
      );
    }
    if (type === 'VIDEO') {
      if (m.externalUrl) {
        return (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-black p-2">
            <iframe src={m.externalUrl} className="h-64 w-full rounded-xl" allow="autoplay; encrypted-media" allowFullScreen title={m.title} />
          </div>
        );
      }
      if (m.fileKey) {
        return (
          <div className="mt-3">
            <a href={fileUrl(m.fileKey)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl bg-[#6C63FF] px-5 py-3 text-sm font-black text-white hover:bg-[#3D35CC]">
              <FileText className="h-4 w-4" /> Watch video
            </a>
          </div>
        );
      }
    }
    if (type === 'LINK') {
      return (
        <div className="mt-3">
          <a href={m.externalUrl ?? '#'} target="_blank" rel="noopener noreferrer" onClick={() => handleOpenMaterial(m)} className="inline-flex items-center gap-2 rounded-2xl bg-[#6C63FF] px-5 py-3 text-sm font-black text-white hover:bg-[#3D35CC]">
            Open resource &rarr;
          </a>
        </div>
      );
    }
    if (m.fileKey) {
      return (
        <div className="mt-3">
          <a href={fileUrl(m.fileKey)} target="_blank" rel="noopener noreferrer" onClick={() => handleOpenMaterial(m)} download={m.fileOriginalName ?? true} className="inline-flex items-center gap-2 rounded-2xl border border-[#6C63FF] px-5 py-3 text-sm font-black text-[#6C63FF] hover:bg-[#EEEDFF]">
            <FileText className="h-4 w-4" /> {m.downloadable ? `Download ${m.fileOriginalName ?? 'file'}` : 'View file'}
            {m.fileSizeBytes && <span className="font-normal text-xs">({(Number(m.fileSizeBytes) / 1024 / 1024).toFixed(1)} MB)</span>}
          </a>
        </div>
      );
    }
    return null;
  }

  return (
    <ElearningShell title={lesson?.title ?? 'Lesson'} eyebrow="Study materials">
      {isLoading && <LoadingPlaceholder />}
      {lesson?.description && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-ks-muted">{lesson.description}</p>
          {lesson.estimatedMinutes && <p className="mt-2 text-xs text-ks-muted">Estimated time: {lesson.estimatedMinutes} minutes</p>}
        </div>
      )}
      {published.length === 0 && !isLoading && (
        <Panel title="Materials" icon={<FileText />}>
          <p className="py-4 text-sm font-semibold text-ks-muted">No materials are available yet for this lesson.</p>
        </Panel>
      )}
      {published.map((m, idx) => (
        <Panel key={m.id} title={`${idx + 1}. ${m.title}`} icon={<FileText />}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-ks-muted">{m.type}</span>
            {m.downloadable && <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-black text-green-700">Downloadable</span>}
          </div>
          {renderMaterial(m)}
        </Panel>
      ))}
      {lessonAssignments.length > 0 && (
        <Panel title="Assignments for this lesson" icon={<ClipboardCheck />}>
          <div className="space-y-2">
            {lessonAssignments.map((a) => (
              <button key={a.id} onClick={() => navigate(`/student/elearning/courses/${courseId}/assignments/${a.id}`)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left hover:border-[#6C63FF]">
                <div>
                  <p className="font-black text-ks-slate">{a.title}</p>
                  <p className="text-xs text-ks-muted">Due {fmtDate(a.dueAt)}</p>
                </div>
                <span className="text-xs font-semibold text-[#6C63FF]">Open &rarr;</span>
              </button>
            ))}
          </div>
        </Panel>
      )}
      <div className="flex gap-3">
        <ButtonLike onClick={() => navigate(`/student/elearning/courses/${courseId}`)}>Back to course</ButtonLike>
      </div>
    </ElearningShell>
  );
}

export function StudentAssignmentPage() {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const { data: assignment, isLoading: assignLoading } = useElearningAssignment(courseId, assignmentId);
  const { data: existingSubmission, isLoading: subLoading } = useMySubmission(assignmentId);
  const upsertMut = useUpsertSubmissionMutation();
  const submitMut = useSubmitSubmissionMutation();
  const uploadMut = useUploadFile();

  const [text, setText] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (existingSubmission && !initialized) {
      setText(existingSubmission.textAnswer ?? '');
      setFileKey(existingSubmission.fileKey ?? '');
      setFileName(existingSubmission.fileKey ? 'Existing file' : '');
      setInitialized(true);
    }
  }, [existingSubmission, initialized]);

  const isSubmitted = existingSubmission?.status === 'SUBMITTED' || existingSubmission?.status === 'GRADED' || existingSubmission?.status === 'RETURNED';
  const isGraded = existingSubmission?.status === 'GRADED' || existingSubmission?.status === 'RETURNED';
  const needsFile = assignment?.type === 'FILE_UPLOAD' || assignment?.type === 'BOTH';
  const needsText = assignment?.type === 'TEXT' || assignment?.type === 'BOTH';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { toast('File exceeds 50 MB', 'error'); return; }
    setFileName(file.name);
    setUploading(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const contentBase64 = (reader.result as string).split(',')[1];
      uploadMut.mutate(
        { fileName: file.name, contentBase64, mimeType: file.type, domain: 'submissions' },
        {
          onSuccess: (data) => {
            const d = data as { fileKey?: string; data?: { fileKey?: string } };
            setFileKey(d.fileKey ?? d.data?.fileKey ?? '');
            setUploading(false);
            toast('File uploaded', 'success');
          },
          onError: () => { setUploading(false); toast('Upload failed', 'error'); },
        },
      );
    };
    reader.onerror = () => { setUploading(false); toast('Could not read file', 'error'); };
  }

  function handleSaveDraft() {
    if (!assignmentId) return;
    const body: Record<string, unknown> = {};
    if (needsText) body.textContent = text;
    if (needsFile && fileKey) body.fileKey = fileKey;
    upsertMut.mutate({ assignmentId, body }, {
      onSuccess: () => toast('Draft saved', 'success'),
      onError: () => toast('Failed to save draft', 'error'),
    });
  }

  function handleSubmit() {
    if (!assignmentId) return;
    if (needsText && !text.trim()) { toast('Write your answer before submitting', 'warning'); return; }
    if (needsFile && !fileKey) { toast('Upload a file before submitting', 'warning'); return; }
    const body: Record<string, unknown> = {};
    if (needsText) body.textContent = text;
    if (needsFile && fileKey) body.fileKey = fileKey;

    upsertMut.mutate({ assignmentId, body }, {
      onSuccess: (saved) => {
        const id = (saved as { id?: string })?.id ?? existingSubmission?.id;
        if (!id) { toast('Submission saved but could not confirm ID', 'warning'); return; }
        submitMut.mutate({ assignmentId, submissionId: id }, {
          onSuccess: () => { toast('Assignment submitted!', 'success'); },
          onError: () => toast('Submitted saved but final submit failed', 'warning'),
        });
      },
      onError: () => toast('Failed to submit', 'error'),
    });
  }

  if (assignLoading || subLoading) return <ElearningShell title="Assignment" eyebrow="Loading…"><LoadingPlaceholder /></ElearningShell>;
  if (!assignment) return <ElearningShell title="Assignment" eyebrow="Not found"><p className="text-sm text-ks-muted">Assignment not found.</p></ElearningShell>;

  return (
    <ElearningShell title={assignment.title} eyebrow="Student submission">
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Assignment Details" icon={<ClipboardCheck />}>
          <InfoList rows={[
            ['Mode', assignment.type],
            ['Due', fmtDate(assignment.dueAt)],
            ['Max score', `${assignment.maxScore ?? '—'} marks`],
            ['Late allowed', assignment.allowLateSubmission ? 'Yes' : 'No'],
            ['Late penalty', assignment.latePenaltyPercent ? `${assignment.latePenaltyPercent}%` : '—'],
          ]} />
          {assignment.instructions && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-ks-muted">Instructions</p>
              <p className="mt-2 text-sm leading-6 text-ks-slate">{assignment.instructions}</p>
            </div>
          )}
          {assignment.attachmentKey && (
            <div className="mt-4">
              <a href={(() => { const k = assignment.attachmentKey ?? ''; const s = k.indexOf('/'); return s < 0 ? `/api/v1/elearning/files/materials/${encodeURIComponent(k)}` : `/api/v1/elearning/files/${encodeURIComponent(k.substring(0,s))}/${encodeURIComponent(k.substring(s+1))}`; })()} target="_blank" rel="noopener noreferrer" download={assignment.attachmentName ?? true} className="inline-flex items-center gap-2 text-sm font-black text-[#6C63FF] hover:underline">
                <FileText className="h-4 w-4" />Download assignment file{assignment.attachmentName ? `: ${assignment.attachmentName}` : ''}
              </a>
            </div>
          )}
        </Panel>
        <div className="space-y-5">
          {isGraded && (
            <Panel title="Your Grade" icon={<CheckCircle2 />}>
              <div className="grid grid-cols-2 gap-4">
                <MetricPill label="Score" value={`${existingSubmission?.score ?? '—'}/${existingSubmission?.maxScore ?? '—'}`} />
                <MetricPill label="Status" value={existingSubmission?.status ?? '—'} />
              </div>
              {existingSubmission?.feedback && (
                <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-green-700">Teacher Feedback</p>
                  <p className="mt-2 text-sm text-ks-slate">{existingSubmission.feedback}</p>
                </div>
              )}
            </Panel>
          )}
          <Panel title={isSubmitted ? 'Your Submission' : 'Submit Your Work'} icon={<FileText />}>
            {isSubmitted && !isGraded && (
              <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <p className="text-sm font-black text-blue-700">Submitted — awaiting grading</p>
              </div>
            )}
            {needsText && (
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-ks-muted">Your answer</label>
                <textarea
                  className="min-h-48 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#6C63FF] disabled:opacity-60"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={isSubmitted}
                  placeholder="Write your answer here…"
                />
              </div>
            )}
            {needsFile && (
              <div className="mt-4 space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-ks-muted">File upload</label>
                {fileKey ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-semibold text-green-700">{fileName || 'File attached'}</span>
                    {!isSubmitted && <button onClick={() => { setFileKey(''); setFileName(''); }} className="ml-auto text-xs text-red-500 hover:underline">Remove</button>}
                  </div>
                ) : !isSubmitted ? (
                  <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-[#6C63FF]">
                    <UploadCloud className="mx-auto h-8 w-8 text-ks-muted" />
                    <p className="mt-2 text-sm font-semibold text-ks-muted">{uploading ? 'Uploading…' : 'Click to upload (max 50 MB)'}</p>
                    <input type="file" className="hidden" onChange={handleFileChange} disabled={uploading} />
                  </label>
                ) : (
                  <p className="text-sm text-ks-muted">No file submitted.</p>
                )}
              </div>
            )}
            {!isSubmitted && (
              <div className="mt-5 flex flex-wrap gap-3">
                <ButtonLike onClick={handleSaveDraft} disabled={upsertMut.isPending || uploading}>
                  <Save className="h-4 w-4" />{upsertMut.isPending ? 'Saving…' : 'Save draft'}
                </ButtonLike>
                <ButtonLike tone="primary" onClick={handleSubmit} disabled={upsertMut.isPending || submitMut.isPending || uploading}>
                  {submitMut.isPending ? 'Submitting…' : 'Submit assignment'}
                </ButtonLike>
              </div>
            )}
          </Panel>
        </div>
      </div>
      <ButtonLike onClick={() => navigate(`/student/elearning/courses/${courseId}`)}>Back to course</ButtonLike>
    </ElearningShell>
  );
}

export function StudentQuizPage() {
  const { courseId, quizId } = useParams();
  const navigate = useNavigate();
  const { data: quiz, isLoading } = useElearningQuiz(courseId, quizId);
  const { data: existingAttempts = [] } = useMyQuizAttempts(quizId);
  const { data: activeAttempt, isLoading: activeLoading } = useActiveAttempt(quizId);
  const startMut = useStartAttemptMutation();
  const saveAnswerMut = useSaveAnswerMutation();
  const submitMut = useSubmitAttemptMutation();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { selectedOptionId?: string; textAnswer?: string }>>({});
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | undefined>(activeAttempt?.id);

  useEffect(() => {
    if (activeAttempt?.id) {
      setAttemptId(activeAttempt.id);
      setStarted(true);
      if (activeAttempt.answers) {
        const saved: Record<string, { selectedOptionId?: string; textAnswer?: string }> = {};
        for (const a of activeAttempt.answers) {
          saved[a.questionId] = { selectedOptionId: a.selectedOptionId, textAnswer: a.textAnswer };
        }
        setAnswers(saved);
      }
    }
  }, [activeAttempt?.id]);

  useEffect(() => {
    if (!started || !quiz?.timeLimitMinutes || !activeAttempt?.startedAt) return;
    const elapsed = Math.round((Date.now() - new Date(activeAttempt.startedAt).getTime()) / 1000);
    const remaining = quiz.timeLimitMinutes * 60 - elapsed;
    setTimeLeft(Math.max(0, remaining));
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev == null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [started, quiz?.timeLimitMinutes, activeAttempt?.startedAt]);

  useEffect(() => {
    if (timeLeft === 0 && attemptId) {
      toast('Time is up! Submitting…', 'warning');
      submitMut.mutate(attemptId, {
        onSuccess: (result) => { const id = (result as { id?: string })?.id ?? attemptId; navigate(`/student/elearning/courses/${courseId}/quizzes/${quizId}/result/${id}`); },
        onError: () => toast('Failed to auto-submit — please submit manually', 'error'),
      });
    }
  }, [timeLeft]);

  const submittedCount = existingAttempts.filter((a) => a.status !== 'IN_PROGRESS').length;
  const attemptsLeft = (quiz?.maxAttempts ?? 1) - submittedCount;
  const questions = quiz?.questions ?? [];
  const currentQuestion = questions[currentIndex];

  function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleStart() {
    if (!quizId) return;
    startMut.mutate(quizId, {
      onSuccess: (attempt) => {
        setAttemptId(attempt.id);
        setStarted(true);
        toast('Quiz started — good luck!', 'success');
      },
      onError: () => toast('Could not start the quiz. Try again.', 'error'),
    });
  }

  function handleAnswer(field: 'selectedOptionId' | 'textAnswer', value: string) {
    if (!currentQuestion || !attemptId) return;
    const updated = { ...answers[currentQuestion.id], [field]: value };
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: updated }));
    saveAnswerMut.mutate({ attemptId, questionId: currentQuestion.id, ...updated });
  }

  function handleSubmitQuiz() {
    if (!attemptId) return;
    submitMut.mutate(attemptId, {
      onSuccess: (result) => {
        const id = (result as { id?: string })?.id ?? attemptId;
        toast('Quiz submitted!', 'success');
        navigate(`/student/elearning/courses/${courseId}/quizzes/${quizId}/result/${id}`);
      },
      onError: () => toast('Failed to submit quiz', 'error'),
    });
  }

  if (isLoading || activeLoading) return <ElearningShell title="Quiz" eyebrow="Loading…"><LoadingPlaceholder /></ElearningShell>;
  if (!quiz) return <ElearningShell title="Quiz" eyebrow="Not found"><p className="text-sm text-ks-muted">Quiz not found.</p></ElearningShell>;

  if (!started) {
    return (
      <ElearningShell title={quiz.title} eyebrow="Quiz briefing">
        <Panel title="Quiz Rules" icon={<HelpCircle />}>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricPill label="Questions" value={`${questions.length}`} />
            <MetricPill label="Time limit" value={quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : 'No limit'} />
            <MetricPill label="Max attempts" value={`${quiz.maxAttempts}`} />
          </div>
          {quiz.instructions && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-6 text-ks-slate">{quiz.instructions}</p>
            </div>
          )}
          <div className="mt-4">
            <InfoList rows={[
              ['Passing score', quiz.passingScore ? `${quiz.passingScore}%` : 'No pass mark'],
              ['Attempts used', `${submittedCount} of ${quiz.maxAttempts}`],
              ['Attempts remaining', `${attemptsLeft}`],
            ]} />
          </div>
          {attemptsLeft <= 0 ? (
            <div className="mt-5">
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
                You have used all available attempts for this quiz.
              </p>
              {existingAttempts.length > 0 && (
                <div className="mt-3"><ButtonLike tone="primary" onClick={() => navigate(`/student/elearning/courses/${courseId}/quizzes/${quizId}/result/${existingAttempts[existingAttempts.length - 1].id}`)}>View last result</ButtonLike></div>
              )}
            </div>
          ) : (
            <div className="mt-5">
              <ButtonLike tone="primary" onClick={handleStart} disabled={startMut.isPending}>
                {startMut.isPending ? 'Starting…' : `Start attempt ${submittedCount + 1} of ${quiz.maxAttempts}`}
              </ButtonLike>
            </div>
          )}
        </Panel>
        {existingAttempts.length > 0 && (
          <Panel title="My Previous Attempts" icon={<BarChart3 />}>
            <Table columns={['Attempt', 'Status', 'Score', 'Passed', 'Date']}>
              {existingAttempts.map((a, i) => (
                <tr key={a.id} className="even:bg-slate-50">
                  <Td>{i + 1}</Td>
                  <Td><PublishBadge status={a.status} /></Td>
                  <Td>{a.percentScore != null ? `${Math.round(a.percentScore)}%` : '—'}</Td>
                  <Td>{a.isPassed === true ? <span className="text-green-600 font-black">Yes</span> : a.isPassed === false ? <span className="text-red-500 font-black">No</span> : '—'}</Td>
                  <Td>{fmtDate(a.submittedAt ?? a.startedAt)}</Td>
                </tr>
              ))}
            </Table>
          </Panel>
        )}
      </ElearningShell>
    );
  }

  if (!currentQuestion) {
    return (
      <ElearningShell title={quiz.title} eyebrow="No questions">
        <p className="text-sm text-ks-muted">This quiz has no questions yet.</p>
      </ElearningShell>
    );
  }

  const isAnswered = (qId: string) => Boolean(answers[qId]?.selectedOptionId || answers[qId]?.textAnswer);
  const totalAnswered = questions.filter((q) => isAnswered(q.id)).length;
  const currentAnswer = answers[currentQuestion.id] ?? {};
  const qType = currentQuestion.type;

  return (
    <ElearningShell title={quiz.title} eyebrow={`Question ${currentIndex + 1} of ${questions.length}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(i)}
              className={`h-8 w-8 rounded-full text-xs font-black transition ${isAnswered(q.id) ? 'bg-[#6C63FF] text-white' : i === currentIndex ? 'border-2 border-[#6C63FF] text-[#6C63FF]' : 'bg-slate-100 text-ks-muted'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {timeLeft != null && (
            <span className={`rounded-2xl px-4 py-2 text-sm font-black ${timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-ks-slate'}`}>
              <Clock className="inline h-4 w-4" /> {formatTime(timeLeft)}
            </span>
          )}
          <span className="text-xs font-semibold text-ks-muted">{totalAnswered}/{questions.length} answered</span>
        </div>
      </div>
      <Panel title={`Q${currentIndex + 1} · ${currentQuestion.points} point${currentQuestion.points !== 1 ? 's' : ''}`} icon={<HelpCircle />}>
        <p className="text-base font-black text-ks-slate leading-7">{currentQuestion.prompt}</p>
        <div className="mt-5 space-y-3">
          {(qType === 'MULTIPLE_CHOICE' || qType === 'MCQ') && currentQuestion.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handleAnswer('selectedOptionId', opt.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ${currentAnswer.selectedOptionId === opt.id ? 'border-[#6C63FF] bg-[#EEEDFF]' : 'border-slate-200 bg-white hover:border-slate-400'}`}
            >
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black ${currentAnswer.selectedOptionId === opt.id ? 'border-[#6C63FF] bg-[#6C63FF] text-white' : 'border-slate-300 text-ks-muted'}`}>
                {['A', 'B', 'C', 'D', 'E'][opt.orderIndex] ?? opt.orderIndex + 1}
              </span>
              <span className="text-sm font-semibold text-ks-slate">{opt.text}</span>
            </button>
          ))}
          {qType === 'TRUE_FALSE' && ['true', 'false'].map((val) => (
            <button
              key={val}
              onClick={() => handleAnswer('textAnswer', val)}
              className={`w-full rounded-2xl border p-4 text-center text-sm font-black transition ${currentAnswer.textAnswer === val ? 'border-[#6C63FF] bg-[#EEEDFF] text-[#3D35CC]' : 'border-slate-200 bg-white text-ks-muted hover:border-slate-400'}`}
            >
              {val.charAt(0).toUpperCase() + val.slice(1)}
            </button>
          ))}
          {qType === 'SHORT_ANSWER' && (
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 outline-none focus:border-[#6C63FF]"
              value={currentAnswer.textAnswer ?? ''}
              onChange={(e) => handleAnswer('textAnswer', e.target.value)}
              placeholder="Type your answer here…"
            />
          )}
        </div>
      </Panel>
      <div className="flex flex-wrap justify-between gap-3">
        <div className="flex gap-2">
          {currentIndex > 0 && <ButtonLike onClick={() => setCurrentIndex((p) => p - 1)}>Previous</ButtonLike>}
          {currentIndex < questions.length - 1 && <ButtonLike tone="primary" onClick={() => setCurrentIndex((p) => p + 1)}>Next question</ButtonLike>}
        </div>
        <ButtonLike
          tone="danger"
          onClick={handleSubmitQuiz}
          disabled={submitMut.isPending || totalAnswered === 0}
        >
          {submitMut.isPending ? 'Submitting…' : `Submit quiz (${totalAnswered}/${questions.length} answered)`}
        </ButtonLike>
      </div>
    </ElearningShell>
  );
}

export function StudentQuizResultPage() {
  const { courseId, quizId, attemptId } = useParams();
  const navigate = useNavigate();
  const { data: attempt, isLoading } = useAttemptDetail(attemptId);
  const { data: quiz } = useElearningQuiz(courseId, quizId);

  if (isLoading) return <ElearningShell title="Quiz Result" eyebrow="Loading…"><LoadingPlaceholder /></ElearningShell>;
  if (!attempt) return <ElearningShell title="Quiz Result" eyebrow="Not found"><p className="text-sm text-ks-muted">Result not found.</p></ElearningShell>;

  const totalScore = attempt.score ?? 0;
  const maxScore = attempt.maxScore ?? 0;
  const pct = attempt.percentScore != null ? Math.round(attempt.percentScore) : maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const timeTaken = (attempt as unknown as Record<string, unknown>).timeTakenSeconds as number | undefined;

  return (
    <ElearningShell title="Quiz Result" eyebrow={quiz?.title ?? 'Your score'}>
      <div className={`rounded-3xl p-8 text-center ${attempt.isPassed ? 'bg-green-50 border border-green-200' : attempt.isPassed === false ? 'bg-red-50 border border-red-200' : 'bg-slate-50 border border-slate-200'}`}>
        <p className="font-display text-6xl font-black" style={{ color: attempt.isPassed ? '#16a34a' : attempt.isPassed === false ? '#dc2626' : '#334155' }}>
          {pct}%
        </p>
        <p className="mt-2 text-xl font-black text-ks-slate">{totalScore} / {maxScore} marks</p>
        {attempt.isPassed != null && (
          <p className={`mt-3 text-lg font-black ${attempt.isPassed ? 'text-green-700' : 'text-red-600'}`}>
            {attempt.isPassed ? 'PASSED' : 'DID NOT PASS'}
          </p>
        )}
        {timeTaken != null && (
          <p className="mt-2 text-sm text-ks-muted">Completed in {Math.floor(timeTaken / 60)}m {timeTaken % 60}s</p>
        )}
      </div>
      {attempt.answers && attempt.answers.length > 0 && (
        <Panel title="Question Breakdown" icon={<ShieldCheck />}>
          <div className="space-y-4">
            {attempt.answers.map((a, i) => {
              const q = quiz?.questions.find((q) => q.id === a.questionId);
              const correct = a.isCorrect;
              return (
                <div key={a.id} className={`rounded-2xl border p-4 ${correct === true ? 'border-green-200 bg-green-50' : correct === false ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-white'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-ks-slate">{i + 1}. {q?.prompt ?? a.prompt ?? `Question ${i + 1}`}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-black ${correct === true ? 'bg-green-100 text-green-700' : correct === false ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-ks-muted'}`}>
                      {a.score != null ? `${a.score}/${q?.points ?? '?'} pts` : correct === true ? 'Correct' : correct === false ? 'Wrong' : 'Pending'}
                    </span>
                  </div>
                  {a.textAnswer && <p className="mt-2 text-xs text-ks-muted">Your answer: <span className="font-semibold text-ks-slate">{a.textAnswer}</span></p>}
                  {q?.correctAnswer && correct === false && <p className="mt-1 text-xs text-green-700">Correct: <span className="font-semibold">{q.correctAnswer}</span></p>}
                  {a.feedback && <p className="mt-2 text-xs text-[#6C63FF] font-semibold">Feedback: {a.feedback}</p>}
                  {q?.explanation && <p className="mt-1 text-xs text-ks-muted italic">{q.explanation}</p>}
                </div>
              );
            })}
          </div>
        </Panel>
      )}
      <div className="flex flex-wrap gap-3">
        <ButtonLike onClick={() => navigate(`/student/elearning/courses/${courseId}/quizzes/${quizId}/attempt`)}>Try again</ButtonLike>
        <ButtonLike tone="primary" onClick={() => navigate(`/student/elearning/courses/${courseId}`)}>Back to course</ButtonLike>
      </div>
    </ElearningShell>
  );
}
