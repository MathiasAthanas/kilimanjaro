import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';

class HodCoursesOverviewScreen extends ConsumerWidget {
  const HodCoursesOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(elearningCoursesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Department Courses'),
        backgroundColor: AppColors.eLearningPrimary,
        foregroundColor: Colors.white,
      ),
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (courses) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
          children: [
            const _HodMetric(),
            const SizedBox(height: 12),
            ...courses.map(
              (c) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: ListTile(
                    onTap: () => context.push('/hod/courses/${c.id}'),
                    leading: const Icon(
                      Icons.school_rounded,
                      color: AppColors.eLearningPrimary,
                    ),
                    title: Text(
                      '${c.subjectName} · ${c.className}',
                      style: const TextStyle(fontWeight: FontWeight.w900),
                    ),
                    subtitle: Text(
                      '${c.lessons.length} lessons · ${c.enrolledCount} students · ${c.status}',
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                  ),
                ),
              ),
            ),
            if (courses.isEmpty)
              const Card(
                child: ListTile(
                  title: Text(
                    'No courses',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: Text('No courses have been set up yet.'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class HodCourseDetailScreen extends ConsumerWidget {
  const HodCourseDetailScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseAsync = ref.watch(elearningCourseProvider(courseId));
    final progressAsync = ref.watch(elearningProgressProvider(courseId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Course Review'),
        backgroundColor: AppColors.eLearningPrimary,
        foregroundColor: Colors.white,
      ),
      body: courseAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (course) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
          children: [
            const _HodMetric(),
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                title: const Text(
                  'Content coverage',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text(
                  '${course.lessons.length} lessons · ${course.enrolledCount} students · ${course.status}',
                ),
              ),
            ),
            const SizedBox(height: 12),
            progressAsync.when(
              data: (p) => Card(
                child: ListTile(
                  title: const Text(
                    'Learning progress',
                    style: TextStyle(fontWeight: FontWeight.w900),
                  ),
                  subtitle: Text(
                    '${p.completionPercent}% complete · ${p.viewed}/${p.materials} materials viewed',
                  ),
                ),
              ),
              loading: () => const Card(child: ListTile(title: Text('Loading progress…'))),
              error: (_, __) => const SizedBox.shrink(),
            ),
            const SizedBox(height: 12),
            const Card(
              child: ListTile(
                title: Text(
                  'Risk notes',
                  style: TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text('Review engagement tab for inactive students needing follow-up.'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HodMetric extends StatelessWidget {
  const _HodMetric();

  @override
  Widget build(BuildContext context) => Card(
    color: AppColors.eLearningLight,
    child: const Padding(
      padding: EdgeInsets.all(18),
      child: Row(
        children: [
          Icon(Icons.analytics_rounded, color: AppColors.eLearningPrimary),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Department e-learning — review lesson coverage, student progress and risk flags.',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
        ],
      ),
    ),
  );
}
