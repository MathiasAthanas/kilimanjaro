import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';

class ParentLearningHomeScreen extends ConsumerWidget {
  const ParentLearningHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(studentElearingSummaryProvider);
    final coursesAsync = ref.watch(elearningCoursesProvider);

    return _ParentElScaffold(
      title: 'Learning Overview',
      children: [
        summaryAsync.when(
          data: (s) => _ParentSummaryCard(
            pendingAssignments: s.pendingAssignments,
            availableQuizzes: s.availableQuizzes,
            unviewedMaterials: s.unviewedMaterials,
          ),
          loading: () => const _ParentLoadingCard(),
          error: (_, __) => const _ParentCard(
            'Learning summary',
            'Tap a course below to see progress details.',
            null,
          ),
        ),
        const _ParentCard(
          'How to support learning',
          'Ask your child to show you their latest quiz result or assignment feedback.',
          null,
        ),
        const Padding(
          padding: EdgeInsets.only(top: 4, bottom: 4),
          child: Text(
            'Enrolled Courses',
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
          ),
        ),
        coursesAsync.when(
          data: (courses) => courses.isEmpty
              ? const _ParentCard(
                  'No courses enrolled',
                  'Your child has not been enrolled in any courses yet.',
                  null,
                )
              : Column(
                  children: courses
                      .map((c) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _ParentCard(
                              '${c.subjectName} · ${c.className}',
                              '${c.lessons.length} lessons · ${c.enrolledCount} students',
                              () => context
                                  .push('/parent/learning/courses/${c.id}'),
                            ),
                          ))
                      .toList(),
                ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ParentCard('Error', e.toString(), null),
        ),
      ],
    );
  }
}

class ParentCourseViewScreen extends ConsumerWidget {
  const ParentCourseViewScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseAsync = ref.watch(elearningCourseProvider(courseId));
    final progressAsync = ref.watch(elearningProgressProvider(courseId));

    return courseAsync.when(
      loading: () => _ParentElScaffold(
          title: 'Course', children: const [_ParentLoadingCard()]),
      error: (e, _) =>
          _ParentElScaffold(title: 'Error', children: [_ParentCard('Error', e.toString(), null)]),
      data: (course) => _ParentElScaffold(
        title: '${course.subjectName} · ${course.className}',
        children: [
          progressAsync.when(
            data: (p) => _ParentProgressCard(progress: p.completionPercent),
            loading: () => const _ParentLoadingCard(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          progressAsync.when(
            data: (p) => Column(children: [
              _ParentCard(
                  'Materials', '${p.viewed} of ${p.materials} viewed', null),
              const SizedBox(height: 12),
              _ParentCard('Assignments',
                  '${p.submissions} of ${p.assignments} submitted', null),
              const SizedBox(height: 12),
              _ParentCard(
                  'Quizzes', '${p.attempts} of ${p.quizzes} attempted', null),
            ]),
            loading: () => const _ParentLoadingCard(),
            error: (_, __) => const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}

class ParentAssignmentViewScreen extends StatelessWidget {
  const ParentAssignmentViewScreen({super.key, required this.assignmentId});
  final String assignmentId;
  @override
  Widget build(BuildContext context) => const _ParentElScaffold(
    title: 'Assignment',
    children: [
      _ParentCard('Status', 'Ask your child for their submission status', null),
      _ParentCard(
          'How to help',
          'Encourage your child to re-read the instructions and ask the teacher on the discussion board.',
          null),
    ],
  );
}

class ParentQuizScoreScreen extends ConsumerWidget {
  const ParentQuizScoreScreen({super.key, required this.quizId});
  final String quizId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attemptsAsync = ref.watch(myAttemptsProvider(quizId));
    return attemptsAsync.when(
      loading: () => _ParentElScaffold(
          title: 'Quiz', children: const [_ParentLoadingCard()]),
      error: (e, _) => _ParentElScaffold(
          title: 'Quiz', children: [_ParentCard('Error', e.toString(), null)]),
      data: (attempts) {
        if (attempts.isEmpty) {
          return const _ParentElScaffold(
              title: 'Quiz',
              children: [_ParentCard('No attempts yet', 'Quiz not started', null)]);
        }
        final best = attempts.reduce((a, b) =>
            (a.percentScore ?? 0) > (b.percentScore ?? 0) ? a : b);
        return _ParentElScaffold(
          title: 'Quiz Result',
          children: [
            _ParentCard(
              'Best score',
              '${best.percentScore?.toStringAsFixed(0) ?? "—"}% · ${best.isPassed == true ? "Passed ✓" : best.isPassed == false ? "Not passed" : "Awaiting grade"}',
              null,
            ),
            _ParentCard(
              'Attempts',
              '${attempts.length} attempt(s)',
              null,
            ),
            const _ParentCard(
              'Support suggestion',
              'Ask your child to review any missed questions before the next quiz.',
              null,
            ),
          ],
        );
      },
    );
  }
}

// ─── Shared Widgets ───────────────────────────────────────────────────────────

class _ParentElScaffold extends StatelessWidget {
  const _ParentElScaffold({required this.title, required this.children});
  final String title;
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

class _ParentSummaryCard extends StatelessWidget {
  const _ParentSummaryCard({
    required this.pendingAssignments,
    required this.availableQuizzes,
    required this.unviewedMaterials,
  });
  final int pendingAssignments;
  final int availableQuizzes;
  final int unviewedMaterials;

  @override
  Widget build(BuildContext context) => Card(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    color: AppColors.eLearningLight,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _Metric('$pendingAssignments', 'Pending'),
          _Metric('$availableQuizzes', 'Quizzes'),
          _Metric('$unviewedMaterials', 'Unviewed'),
        ],
      ),
    ),
  );
}

class _Metric extends StatelessWidget {
  const _Metric(this.value, this.label);
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) => Column(children: [
    Text(value,
        style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: AppColors.eLearningPrimary)),
    Text(label, style: const TextStyle(fontSize: 12)),
  ]);
}

class _ParentProgressCard extends StatelessWidget {
  const _ParentProgressCard({required this.progress});
  final int progress;

  @override
  Widget build(BuildContext context) => Card(
    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    color: AppColors.eLearningLight,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$progress% complete',
              style: const TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  color: AppColors.eLearningPrimary)),
          const SizedBox(height: 10),
          LinearProgressIndicator(
            value: progress / 100,
            color: AppColors.eLearningPrimary,
            backgroundColor: Colors.white,
            minHeight: 8,
            borderRadius: BorderRadius.circular(999),
          ),
        ],
      ),
    ),
  );
}

class _ParentLoadingCard extends StatelessWidget {
  const _ParentLoadingCard();
  @override
  Widget build(BuildContext context) =>
      const Center(child: Padding(
        padding: EdgeInsets.all(24),
        child: CircularProgressIndicator(),
      ));
}

class _ParentCard extends StatelessWidget {
  const _ParentCard(this.title, this.subtitle, this.onTap);
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      onTap: onTap,
      title: Text(title,
          style: const TextStyle(fontWeight: FontWeight.w900)),
      subtitle: Text(subtitle),
      trailing:
          onTap != null ? const Icon(Icons.chevron_right_rounded) : null,
    ),
  );
}
