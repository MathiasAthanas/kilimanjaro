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
  type ElearningAttemptDetail,
  type ElearningDiscussion,
  type ElearningLesson,
  type ElearningMaterial,
  type ElearningQuizQuestion,
  mapApiCourse,
  useAddDiscussionReply,
  useAddQuizQuestion,
  useArchiveCourse,
  useAssignmentSubmissions,
  useAttemptDetail,
  useCloneCourseMutation,
  useCloseAssignment,
  useCloseQuiz,
  useCreateAnnouncement,
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
  useGradeShortAnswer,
  useGradeSubmission,
  useHodOverview,
  useMissingStudents,
  usePrincipalOverview,
  usePublishAnnouncement,
  usePublishAssignment,
  usePublishCourse,
  usePublishLesson,
  usePublishQuiz,
  useQuizResults,
  useResolveDiscussion,
  useReturnSubmission,
  useSubmission,
  useSubmissionSummary,
  useTeacherAnalytics,
  useUpdateAssignment,
  useUpdateLesson,
  useUpdateMaterial,
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
  const { data: rawYears = [] } = useAcademicYears();
  const { data: rawTerms = [] } = useTerms();
  const cloneMut = useCloneCourseMutation();

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
      createMut.mutate({ courseId: courseId!, body }, { onSuccess: () => { toast('Lesson created', 'success'); navigate(`/teacher/elearning/courses/${courseId}/lessons`); }, onError: () => toast('Failed to create lesson', 'error') });
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
          <ActionRow title="Add text-first note" detail="Create low-bandwidth reading material" to={`/teacher/elearning/courses/${courseId}/lessons/${lessonId}/materials/new`} />
          <ActionRow title="Attach worksheet or slides" detail="Upload-ready file material workflow" to={`/teacher/elearning/courses/${courseId}/lessons/${lessonId}/materials/new`} />
          <ActionRow title="Create linked homework" detail="Instructions, due date, late policy, max score" to={`/teacher/elearning/courses/${courseId}/assignments/new`} />
          <ActionRow title="Build lesson quiz" detail="MCQ, true/false and short answer" to={`/teacher/elearning/courses/${courseId}/quizzes/new`} />
        </Panel>
      </div>
      <Panel title="Materials in this Lesson" icon={<FileText />}>
        {loadingMaterials && <LoadingPlaceholder />}
        <div className="grid gap-4 lg:grid-cols-3">
          {materials.map((item) => <MaterialCard key={item.id} item={item} courseId={courseId ?? ''} lessonId={lessonId ?? ''} />)}
          {!loadingMaterials && materials.length === 0 && (
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
  const [uploading, setUploading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isEdit && existingMaterial && !initialized) {
      setMType((existingMaterial.type as MaterialKind) ?? 'NOTE');
      setTitle(existingMaterial.title ?? '');
      setEstimatedMinutes(existingMaterial.estimatedMinutes ? String(existingMaterial.estimatedMinutes) : '');
      setIsDownloadable(existingMaterial.isDownloadable ?? false);
      setNoteBody((existingMaterial as Record<string, unknown>).body as string ?? '');
      setExternalUrl(existingMaterial.externalUrl ?? '');
      setFileKey(existingMaterial.fileKey ?? '');
      setFileName(existingMaterial.fileKey ? 'Existing file' : '');
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
            const d = data as { fileKey?: string; data?: { fileKey?: string } };
            setFileKey(d.fileKey ?? d.data?.fileKey ?? '');
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
    if (!title.trim()) { toast('Enter a material title', 'warning'); return; }
    if (mType === 'NOTE' && !noteBody.trim()) { toast('Write content for the text note', 'warning'); return; }
    if (needsFile && !fileKey) { toast('Upload a file first', 'warning'); return; }
    if (needsUrl && !externalUrl.trim()) { toast('Paste an external URL', 'warning'); return; }
    if (needsVideo && !fileKey && !externalUrl.trim()) { toast('Upload a video file or paste a URL', 'warning'); return; }

    const body: Record<string, unknown> = {
      title: title.trim(),
      type: mType,
      isDownloadable,
      status: publish ? 'PUBLISHED' : 'DRAFT',
    };
    if (estimatedMinutes) body.estimatedMinutes = Number(estimatedMinutes);
    if (mType === 'NOTE') body.body = noteBody;
    if (needsFile) body.fileKey = fileKey;
    if (needsVideo) { if (fileKey) body.fileKey = fileKey; else body.externalUrl = externalUrl; }
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
    submissionMode: 'BOTH' as 'TEXT' | 'FILE_UPLOAD' | 'BOTH',
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
      submissionMode: form.submissionMode,
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
          setForm({ title: '', submissionMode: 'BOTH', dueAt: '', maxScore: '', allowLateSubmission: true, latePenaltyPercent: '0', instructions: '' });
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
      action={<ElButton onClick={() => setShowForm((p) => !p)}><Plus className="mr-2 inline h-4 w-4" />{showForm ? 'Close form' : 'New assignment'}</ElButton>}
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
                value={form.submissionMode}
                onChange={(e) => setForm((p) => ({ ...p, submissionMode: e.target.value as 'TEXT' | 'FILE_UPLOAD' | 'BOTH' }))}
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
              ['Mode', assignment.submissionMode],
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
      toast('Quiz settings saved', 'success');
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
    const body: Record<string, unknown> = { type: qType, prompt: qForm.prompt, points: Number(qForm.points) || 1, correctAnswer: qForm.correctAnswer || undefined, explanation: qForm.explanation || undefined };
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
      { attemptId: attempt.id, questionId, score, feedback: feedbacks[answerId] || undefined },
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
