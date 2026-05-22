import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/elearning_models.dart';

class TeacherCoursesHomeScreen extends ConsumerWidget {
  const TeacherCoursesHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(elearningCoursesProvider);
    return _TeacherElScaffold(
      title: 'E-Learning Command',
      subtitle: 'Create, publish, grade and follow learner progress.',
      children: [
        const _MetricGrid(
          values: [('To grade', '—'), ('Active', '—'), ('Enrolled', '—')],
        ),
        coursesAsync.when(
          data: (courses) => courses.isEmpty
              ? const _ActionCard(
                  'No courses yet',
                  'Create your first course to get started.',
                  Icons.school_rounded,
                  null,
                )
              : Column(
                  children: courses
                      .map((course) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _TeacherCourseCard(
                              course: course,
                              onTap: () => context
                                  .push('/teacher/courses/${course.id}'),
                            ),
                          ))
                      .toList(),
                ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ActionCard('Error loading courses', e.toString(),
              Icons.error_rounded, null),
        ),
      ],
    );
  }
}

class TeacherCourseDetailScreen extends StatelessWidget {
  const TeacherCourseDetailScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context) => _TeacherElScaffold(
    title: 'Course Workspace',
    subtitle: 'Lessons, materials, assignments, quizzes and communication.',
    children: [
      const _ReadinessCard(),
      _ActionCard(
        'Lesson planner',
        'Reorder weekly units, publish lessons and attach content.',
        Icons.view_timeline_rounded,
        () => context.push('/teacher/courses/$courseId/lesson/lesson-linear'),
      ),
      _ActionCard(
        'Material studio',
        'Text notes, PDF, image, video, link and low-bandwidth downloads.',
        Icons.upload_file_rounded,
        () => context.push(
          '/teacher/courses/$courseId/lesson/lesson-linear/material/new',
        ),
      ),
      _ActionCard(
        'Assignments and grading',
        'Create tasks, review missing work, score and return feedback.',
        Icons.assignment_turned_in_rounded,
        () => context.push('/teacher/courses/$courseId/assignments'),
      ),
      _ActionCard(
        'Quiz builder',
        'MCQ, true/false, short answer, auto-marking and manual queue.',
        Icons.quiz_rounded,
        () => context.push('/teacher/courses/$courseId/quizzes/quiz-linear'),
      ),
      _ActionCard(
        'Engagement analytics',
        'Completion heatmap, struggling students and late submissions.',
        Icons.analytics_rounded,
        () => context.push('/teacher/courses/$courseId/engagement'),
      ),
    ],
  );
}

class TeacherLessonDetailScreen extends StatelessWidget {
  const TeacherLessonDetailScreen({
    super.key,
    required this.courseId,
    required this.lessonId,
  });
  final String courseId;
  final String lessonId;

  @override
  Widget build(BuildContext context) => _TeacherElScaffold(
    title: 'Linear Equations',
    subtitle: 'Week 4 unit with content, tasks and Q&A.',
    children: [
      const _LessonStatusCard(),
      _ActionCard(
        'Text-first teacher note',
        'Published. 39 views, optimized for low bandwidth.',
        Icons.notes_rounded,
        () {},
      ),
      _ActionCard(
        'Worksheet PDF',
        '420 KB. Downloadable. 28 downloads.',
        Icons.picture_as_pdf_rounded,
        () {},
      ),
      _ActionCard(
        'Add material',
        'Create a note, upload a file, or add a video/link.',
        Icons.add_circle_rounded,
        () => context.push(
          '/teacher/courses/$courseId/lesson/$lessonId/material/new',
        ),
      ),
      _ActionCard(
        'Lesson Q&A',
        '3 questions, 1 unresolved.',
        Icons.forum_rounded,
        () {},
      ),
    ],
  );
}

class TeacherAddMaterialScreen extends StatelessWidget {
  const TeacherAddMaterialScreen({super.key});

  @override
  Widget build(BuildContext context) => _TeacherElScaffold(
    title: 'Material Studio',
    subtitle: 'Text note, file upload, video, image or external link.',
    children: const [
      _ChoiceWrap(
        title: 'Material type',
        values: ['Text note', 'PDF', 'Slides', 'Image', 'Video', 'Link'],
      ),
      _FormCard(
        fields: [
          'Title',
          'Status: draft / published',
          'Downloadable',
          'Estimated minutes',
        ],
      ),
      _LongInputCard(
        title: 'Text note body',
        text:
            'Move constants to one side, then divide by the coefficient of x. Always show each inverse operation.',
      ),
      _UploadTargetCard(),
    ],
  );
}

class TeacherAssignmentsScreen extends ConsumerWidget {
  const TeacherAssignmentsScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) => _TeacherElScaffold(
    title: 'Assignments',
    subtitle: 'Build homework, publish, close and grade.',
    children: [
      const _FormCard(
        fields: [
          'Title',
          'Submission mode',
          'Due date and time',
          'Max score',
          'Late penalty',
        ],
      ),
      const _LongInputCard(
        title: 'Instructions',
        text:
            'Solve all questions and show workings. Type answers or upload a clear photo.',
      ),
      Consumer(builder: (context, ref, _) {
        final assignmentsAsync =
            ref.watch(elearningAssignmentsProvider(courseId));
        return assignmentsAsync.when(
          data: (assignments) => Column(
            children: assignments
                .map((a) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _ActionCard(
                        a.title,
                        '${a.status}${a.dueAt != null ? " · due ${a.dueAt!.toLocal().toString().substring(0, 10)}" : ""}',
                        Icons.assignment_rounded,
                        () => context.push(
                            '/teacher/courses/$courseId/assignments/${a.id}'),
                      ),
                    ))
                .toList(),
          ),
          loading: () =>
              const Center(child: CircularProgressIndicator()),
          error: (e, _) => Text('Error: $e'),
        );
      }),
    ],
  );
}

class TeacherAssignmentDetailScreen extends StatelessWidget {
  const TeacherAssignmentDetailScreen({
    super.key,
    required this.courseId,
    required this.assignmentId,
  });
  final String courseId;
  final String assignmentId;

  @override
  Widget build(BuildContext context) => _TeacherElScaffold(
    title: 'Assignment Detail',
    subtitle: 'Submissions, missing students, late work and feedback.',
    children: [
      const _MetricGrid(
        values: [('Submitted', '30'), ('Missing', '12'), ('Late', '2')],
      ),
      _ActionCard(
        'Amina Baraka Juma',
        'Submitted text and photo. Awaiting score.',
        Icons.rate_review_rounded,
        () => context.push(
          '/teacher/courses/$courseId/assignments/$assignmentId/grade/sub-1',
        ),
      ),
      const _ActionCard(
        'Brian Mwangi',
        'Missing. Last opened 3 days ago.',
        Icons.warning_rounded,
        null,
      ),
    ],
  );
}

class TeacherGradeSubmissionScreen extends StatelessWidget {
  const TeacherGradeSubmissionScreen({super.key, required this.submissionId});
  final String submissionId;

  @override
  Widget build(BuildContext context) => const _TeacherElScaffold(
    title: 'Grading Desk',
    subtitle: 'Review answer, score, comment, return or grade next.',
    children: [
      _LongInputCard(
        title: 'Student answer',
        text:
            'Question 1: x = 3. I moved 4 to the right side then divided by 2.',
      ),
      _ActionCard(
        'Attached file',
        'amina-linear-workings.jpg - preview and download ready',
        Icons.attach_file_rounded,
        null,
      ),
      _FormCard(fields: ['Score', 'Max score', 'Feedback comment']),
      _ChoiceWrap(
        title: 'Actions',
        values: ['Save grade', 'Return for correction', 'Grade next'],
      ),
    ],
  );
}

class TeacherQuizDetailScreen extends StatelessWidget {
  const TeacherQuizDetailScreen({
    super.key,
    required this.courseId,
    required this.quizId,
  });
  final String courseId;
  final String quizId;

  @override
  Widget build(BuildContext context) => _TeacherElScaffold(
    title: 'Quiz Workspace',
    subtitle: 'Build, preview, publish, see results and mark short answers.',
    children: [
      _ActionCard(
        'Question builder',
        'MCQ, true/false, short answer, points and explanations.',
        Icons.edit_note_rounded,
        () =>
            context.push('/teacher/courses/$courseId/quizzes/$quizId/builder'),
      ),
      const _ActionCard(
        'Results',
        '42 attempts, 69% average, 9 manual marks pending.',
        Icons.bar_chart_rounded,
        null,
      ),
      const _ActionCard(
        'Manual short-answer marking',
        'Jabir Hassan has 2 responses awaiting marks.',
        Icons.rate_review_rounded,
        null,
      ),
    ],
  );
}

class TeacherQuizBuilderScreen extends StatelessWidget {
  const TeacherQuizBuilderScreen({super.key});

  @override
  Widget build(BuildContext context) => const _TeacherElScaffold(
    title: 'Question Builder',
    subtitle: 'Validate answer keys before publishing.',
    children: [
      _ChoiceWrap(
        title: 'Question type',
        values: ['Multiple choice', 'True / false', 'Short answer'],
      ),
      _FormCard(
        fields: ['Question prompt', 'Points', 'Correct answer', 'Explanation'],
      ),
      _FormCard(
        fields: ['Option A', 'Option B - correct', 'Option C', 'Option D'],
      ),
      _ActionCard(
        'Existing short answer',
        'Explain what a gradient represents. Manual marking required.',
        Icons.short_text_rounded,
        null,
      ),
    ],
  );
}

class TeacherCourseEngagementScreen extends StatelessWidget {
  const TeacherCourseEngagementScreen({super.key});

  @override
  Widget build(BuildContext context) => const _TeacherElScaffold(
    title: 'Engagement',
    subtitle: 'Completion, missing work, quiz results and risk flags.',
    children: [
      _MetricGrid(
        values: [('Completion', '74%'), ('Inactive', '5'), ('Quiz avg', '69%')],
      ),
      _HeatmapCard(),
      _ActionCard(
        'Jabir Hassan',
        '38% completion - missed Quiz 2',
        Icons.warning_rounded,
        null,
      ),
      _ActionCard(
        'Zahara Mushi',
        '64% completion - late assignment',
        Icons.warning_amber_rounded,
        null,
      ),
      _ActionCard(
        'Amina Baraka Juma',
        '92% completion - strong progress',
        Icons.check_circle_rounded,
        null,
      ),
    ],
  );
}

class _TeacherElScaffold extends StatelessWidget {
  const _TeacherElScaffold({
    required this.title,
    required this.subtitle,
    required this.children,
  });
  final String title;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(title),
      backgroundColor: AppColors.eLearningPrimary,
      foregroundColor: Colors.white,
    ),
    body: ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
      itemBuilder: (_, i) => children[i],
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemCount: children.length,
    ),
  );
}

class _TeacherCourseCard extends StatelessWidget {
  const _TeacherCourseCard({required this.course, required this.onTap});
  final ElearningCourseModel course;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _ActionCard(
    '${course.subjectName} · ${course.className}',
    '${course.lessons.length} lessons · ${course.enrolledCount} students · ${course.status}',
    Icons.school_rounded,
    onTap,
  );
}

class _ActionCard extends StatelessWidget {
  const _ActionCard(this.title, this.subtitle, this.icon, this.onTap);
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
    child: ListTile(
      onTap: onTap,
      leading: CircleAvatar(
        backgroundColor: AppColors.eLearningLight,
        child: Icon(icon, color: AppColors.eLearningPrimary),
      ),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
      subtitle: Text(subtitle),
      trailing: onTap == null ? null : const Icon(Icons.chevron_right_rounded),
    ),
  );
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.values});
  final List<(String, String)> values;

  @override
  Widget build(BuildContext context) => Row(
    children: values
        .map(
          (value) => Expanded(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    Text(
                      value.$2,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: AppColors.eLearningPrimary,
                      ),
                    ),
                    Text(
                      value.$1,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 11),
                    ),
                  ],
                ),
              ),
            ),
          ),
        )
        .toList(),
  );
}

class _FormCard extends StatelessWidget {
  const _FormCard({required this.fields});
  final List<String> fields;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: fields
            .map(
              (field) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  decoration: InputDecoration(
                    labelText: field,
                    border: const OutlineInputBorder(),
                  ),
                ),
              ),
            )
            .toList(),
      ),
    ),
  );
}

class _LongInputCard extends StatelessWidget {
  const _LongInputCard({required this.title, required this.text});
  final String title;
  final String text;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 10),
          TextField(
            minLines: 4,
            maxLines: 7,
            controller: TextEditingController(text: text),
            decoration: const InputDecoration(border: OutlineInputBorder()),
          ),
        ],
      ),
    ),
  );
}

class _ChoiceWrap extends StatelessWidget {
  const _ChoiceWrap({required this.title, required this.values});
  final String title;
  final List<String> values;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: values
                .map(
                  (value) => Chip(
                    label: Text(value),
                    backgroundColor: AppColors.eLearningLight,
                    labelStyle: const TextStyle(
                      color: AppColors.eLearningPrimary,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                )
                .toList(),
          ),
        ],
      ),
    ),
  );
}

class _ReadinessCard extends StatelessWidget {
  const _ReadinessCard();

  @override
  Widget build(BuildContext context) => const _ChoiceWrap(
    title: 'Publishing readiness',
    values: [
      'Class-subject linked',
      '6 lessons published',
      '18 materials',
      '3 quizzes',
      'Parent visibility',
    ],
  );
}

class _LessonStatusCard extends StatelessWidget {
  const _LessonStatusCard();

  @override
  Widget build(BuildContext context) => const _MetricGrid(
    values: [('Materials', '4'), ('Q&A', '3'), ('Progress', '84%')],
  );
}

class _UploadTargetCard extends StatelessWidget {
  const _UploadTargetCard();

  @override
  Widget build(BuildContext context) => Card(
    color: AppColors.eLearningLight,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        children: const [
          Icon(
            Icons.cloud_upload_rounded,
            size: 36,
            color: AppColors.eLearningPrimary,
          ),
          SizedBox(height: 10),
          Text(
            'Upload-ready target: local storage now, S3-compatible later.',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    ),
  );
}

class _HeatmapCard extends StatelessWidget {
  const _HeatmapCard();

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Engagement heatmap',
            style: TextStyle(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 5,
            runSpacing: 5,
            children: List.generate(
              35,
              (index) => Container(
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  color: index % 7 == 0
                      ? Colors.red.shade300
                      : index % 4 == 0
                      ? Colors.amber.shade300
                      : Colors.green.shade400,
                  borderRadius: BorderRadius.circular(5),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
