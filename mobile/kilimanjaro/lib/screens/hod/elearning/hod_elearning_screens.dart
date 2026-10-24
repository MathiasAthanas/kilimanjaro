import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/elearning_models.dart';
import '../../../widgets/common/ks_error_view.dart';

final _hodRosterProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, courseId) {
  return ref.watch(elearningApiServiceProvider).courseRoster(courseId);
});

String _status(String s) => switch (s) {
      'ACTIVE' => 'Active',
      'DRAFT' => 'Draft',
      'PUBLISHED' => 'Published',
      'CLOSED' => 'Closed',
      'ARCHIVED' => 'Archived',
      _ => s,
    };

class HodCoursesOverviewScreen extends ConsumerStatefulWidget {
  const HodCoursesOverviewScreen({super.key});

  @override
  ConsumerState<HodCoursesOverviewScreen> createState() => _HodCoursesOverviewScreenState();
}

class _HodCoursesOverviewScreenState extends ConsumerState<HodCoursesOverviewScreen> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final coursesAsync = ref.watch(elearningCoursesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('E-Learning courses'),
        backgroundColor: AppColors.eLearningPrimary,
        foregroundColor: Colors.white,
      ),
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(elearningCoursesProvider)),
        data: (all) {
          final q = _query.trim().toLowerCase();
          final courses = q.isEmpty
              ? all
              : all
                  .where((c) => '${c.subjectName} ${c.className} ${c.teacherName}'.toLowerCase().contains(q))
                  .toList();
          final active = all.where((c) => c.isActive).length;
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(elearningCoursesProvider);
              await ref.read(elearningCoursesProvider.future);
            },
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
              children: [
                _MetricRow(items: [
                  ('${all.length}', 'Courses'),
                  ('$active', 'Live'),
                  ('${all.fold<int>(0, (a, c) => a + c.enrolledCount)}', 'Learners'),
                ]),
                const SizedBox(height: 12),
                TextField(
                  onChanged: (v) => setState(() => _query = v),
                  decoration: InputDecoration(
                    hintText: 'Search subject, class or teacher',
                    prefixIcon: const Icon(Icons.search_rounded),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
                const SizedBox(height: 12),
                for (final c in courses)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      margin: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                      child: ListTile(
                        onTap: () => context.push('/hod/courses/${c.id}'),
                        leading: const CircleAvatar(
                          backgroundColor: AppColors.eLearningLight,
                          child: Icon(Icons.school_rounded, color: AppColors.eLearningPrimary),
                        ),
                        title: Text('${c.subjectName} · ${c.className}', style: const TextStyle(fontWeight: FontWeight.w900)),
                        subtitle: Text(
                          '${c.teacherName.isNotEmpty ? '${c.teacherName} · ' : ''}${c.lessons.length} lessons · ${c.enrolledCount} students · ${_status(c.status)}',
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                      ),
                    ),
                  ),
                if (courses.isEmpty)
                  const Card(
                    child: ListTile(
                      title: Text('No courses found', style: TextStyle(fontWeight: FontWeight.w900)),
                      subtitle: Text('Courses appear once teachers set up e-learning for their classes.'),
                    ),
                  ),
              ],
            ),
          );
        },
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
    final lessonsAsync = ref.watch(elearningLessonsProvider(courseId));
    final assignmentsAsync = ref.watch(elearningAssignmentsProvider(courseId));
    final quizzesAsync = ref.watch(elearningQuizzesProvider(courseId));
    final rosterAsync = ref.watch(_hodRosterProvider(courseId));

    Future<void> refresh() async {
      ref.invalidate(elearningCourseProvider(courseId));
      ref.invalidate(elearningLessonsProvider(courseId));
      ref.invalidate(elearningAssignmentsProvider(courseId));
      ref.invalidate(elearningQuizzesProvider(courseId));
      ref.invalidate(_hodRosterProvider(courseId));
      await ref.read(elearningCourseProvider(courseId).future);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(courseAsync.valueOrNull == null ? 'Course review' : '${courseAsync.value!.subjectName} · ${courseAsync.value!.className}', maxLines: 1, overflow: TextOverflow.ellipsis),
        backgroundColor: AppColors.eLearningPrimary,
        foregroundColor: Colors.white,
      ),
      body: courseAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => KSErrorView(error: e, onRetry: refresh),
        data: (course) {
          final lessons = lessonsAsync.valueOrNull ?? const <ElearningLessonModel>[];
          final assignments = assignmentsAsync.valueOrNull ?? const <ElearningAssignmentModel>[];
          final quizzes = quizzesAsync.valueOrNull ?? const <ElearningQuizModel>[];
          final roster = (rosterAsync.valueOrNull ?? const <Map<String, dynamic>>[])
              .where((r) => r['status'] != 'INACTIVE')
              .map((r) {
                final p = (r['progress'] as Map?) ?? const {};
                return (
                  name: (r['studentName'] as String?)?.isNotEmpty == true ? r['studentName'] as String : 'Student',
                  pct: (p['completionPercent'] as num?)?.toInt() ?? 0,
                );
              })
              .toList()
            ..sort((a, b) => a.pct.compareTo(b.pct));
          final avg = roster.isEmpty ? 0 : roster.fold<int>(0, (a, r) => a + r.pct) ~/ roster.length;
          final atRisk = roster.where((r) => r.pct < 40).toList();
          final toGrade = assignments.fold<int>(0, (a, i) => a + i.toGradeCount);
          final publishedLessons = lessons.where((l) => l.isPublished).length;

          return RefreshIndicator(
            onRefresh: refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
              children: [
                if (course.teacherName.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text('Teacher: ${course.teacherName} · ${_status(course.status)}',
                        style: TextStyle(color: Colors.grey.shade600)),
                  ),
                _MetricRow(items: [
                  ('${course.enrolledCount}', 'Students'),
                  (rosterAsync.hasValue ? '$avg%' : '—', 'Avg completion'),
                  ('${atRisk.length}', 'Need follow-up'),
                ]),
                const SizedBox(height: 12),
                _InfoCard(
                  'Content coverage',
                  '$publishedLessons of ${lessons.length} lessons published · ${lessons.fold<int>(0, (a, l) => a + l.materials.length)} materials',
                  Icons.menu_book_rounded,
                ),
                const SizedBox(height: 12),
                _InfoCard(
                  'Assignments',
                  '${assignments.length} set${toGrade > 0 ? ' · $toGrade waiting to be graded' : ''}',
                  Icons.assignment_rounded,
                  warn: toGrade > 5,
                ),
                const SizedBox(height: 12),
                _InfoCard(
                  'Quizzes',
                  '${quizzes.length} quiz${quizzes.length == 1 ? '' : 'zes'} · ${quizzes.fold<int>(0, (a, q) => a + q.attempts.length)} attempts',
                  Icons.quiz_rounded,
                ),
                if (lessons.isNotEmpty) ...[
                  const _Heading('Lessons'),
                  for (final l in lessons)
                    _InfoCard(l.title, '${l.weekNumber != null ? 'Week ${l.weekNumber} · ' : ''}${_status(l.status)} · ${l.materials.length} materials', Icons.menu_book_rounded),
                ],
                if (assignments.isNotEmpty) ...[
                  const _Heading('Assignments'),
                  for (final a in assignments)
                    _InfoCard(
                      a.title,
                      '${_status(a.status)}${a.dueAt != null ? ' · due ${DateFormat('d MMM').format(a.dueAt!.toLocal())}' : ''} · ${a.submissionCount} handed in${a.toGradeCount > 0 ? ' · ${a.toGradeCount} to grade' : ''}',
                      Icons.assignment_rounded,
                    ),
                ],
                if (quizzes.isNotEmpty) ...[
                  const _Heading('Quizzes'),
                  for (final q in quizzes)
                    _InfoCard(q.title, '${_status(q.status)} · ${q.questions.length} questions · ${q.attempts.length} attempts', Icons.quiz_rounded),
                ],
                if (atRisk.isNotEmpty) ...[
                  const _Heading('Students needing follow-up'),
                  for (final r in atRisk.take(10))
                    _InfoCard(r.name, 'Only ${r.pct}% of the course completed', Icons.warning_rounded, warn: true),
                ],
              ],
            ),
          );
        },
      ),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 8),
        child: Text(text.toUpperCase(), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.8, color: AppColors.eLearningPrimary)),
      );
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.items});
  final List<(String, String)> items;

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        color: AppColors.eLearningLight,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (final i in items)
                Column(children: [
                  Text(i.$1, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.eLearningPrimary)),
                  Text(i.$2, style: const TextStyle(fontSize: 11)),
                ]),
            ],
          ),
        ),
      );
}

class _InfoCard extends StatelessWidget {
  const _InfoCard(this.title, this.subtitle, this.icon, {this.warn = false});
  final String title;
  final String subtitle;
  final IconData icon;
  final bool warn;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Card(
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: warn ? BorderSide(color: Colors.red.shade200) : BorderSide.none,
          ),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: warn ? Colors.red.shade50 : AppColors.eLearningLight,
              child: Icon(icon, color: warn ? Colors.red.shade400 : AppColors.eLearningPrimary),
            ),
            title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            subtitle: Text(subtitle),
          ),
        ),
      );
}
