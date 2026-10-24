import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/network/api_failure.dart';
import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/providers/parent_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../widgets/common/ks_error_view.dart';

/// A parent's view of one child's e-learning: progress, work still owed,
/// recent grades. Everything is scoped to the child chosen in the child switcher.
final _parentLearningProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, String>((ref, childId) {
  return ref.watch(elearningApiServiceProvider).parentLearningSummary(childId);
});

List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? v.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
    : <Map<String, dynamic>>[];

int _int(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

double? _dbl(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v');

String _n(double? v) =>
    v == null ? '—' : (v % 1 == 0 ? v.toStringAsFixed(0) : v.toStringAsFixed(1));

DateTime? _date(dynamic v) => v is String ? DateTime.tryParse(v)?.toLocal() : null;

class ParentLearningHomeScreen extends ConsumerWidget {
  const ParentLearningHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(resolvedActiveChildIdProvider);
    final child = ref.watch(activeParentChildProvider).valueOrNull;

    if (childId.isEmpty) {
      return const _ParentElScaffold(
        title: 'Learning',
        children: [
          _ParentCard('No child selected', 'Pick a child from the child switcher to see their learning.', null),
        ],
      );
    }

    final summaryAsync = ref.watch(_parentLearningProvider(childId));

    return _ParentElScaffold(
      title: child == null ? 'Learning' : '${child.name.split(' ').first}\'s learning',
      onRefresh: () async {
        ref.invalidate(_parentLearningProvider(childId));
        await ref.read(_parentLearningProvider(childId).future);
      },
      children: [
        summaryAsync.when(
          loading: () => const _ParentLoadingCard(),
          error: (e, _) => KSErrorView(
            error: e,
            onRetry: () => ref.invalidate(_parentLearningProvider(childId)),
          ),
          data: (data) {
            final tasks = (data['tasks'] as Map?) ?? const {};
            final todo = _list(tasks['assignments']);
            final quizzes = _list(tasks['quizzes']);
            final grades = _list(tasks['recentGrades']);
            final enrollments = _list(data['enrollments']);
            final progresses = _list(data['progresses']);
            final overdue = _int(data['overdueAssignments']);

            Map<String, dynamic>? progressFor(String courseId) {
              for (final p in progresses) {
                if (p['courseId'] == courseId) return p;
              }
              return null;
            }

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MetricCard(items: [
                  ('${_int(data['overallCompletion'])}%', 'Overall'),
                  ('${_int(data['pendingAssignments'])}', 'To do'),
                  ('$overdue', 'Overdue'),
                  ('${_int(data['availableQuizzes'])}', 'Quizzes'),
                ]),
                if (overdue > 0) ...[
                  const SizedBox(height: 12),
                  _ParentCard(
                    '$overdue overdue assignment${overdue == 1 ? '' : 's'}',
                    'Encourage ${child?.name.split(' ').first ?? 'your child'} to talk to the teacher about catching up.',
                    null,
                    warn: true,
                  ),
                ],
                const _Heading('Courses'),
                if (enrollments.isEmpty)
                  const _ParentCard('No courses yet', 'Your child has not been enrolled in any course.', null),
                for (final e in enrollments)
                  Builder(builder: (_) {
                    final course = Map<String, dynamic>.from((e['courseSpace'] as Map?) ?? const {});
                    final id = (e['courseSpaceId'] ?? course['id'] ?? '') as String;
                    final p = progressFor(id);
                    final pct = _int(p?['completionPercent']);
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _ParentCard(
                        '${course['subjectName'] ?? 'Course'} · ${course['className'] ?? ''}',
                        'Completed $pct% · materials ${_int(p?['viewed'])}/${_int(p?['materials'])} · work ${_int(p?['submissions'])}/${_int(p?['assignments'])}',
                        () => context.push('/parent/learning/courses/$id'),
                        progress: pct / 100,
                      ),
                    );
                  }),
                if (todo.isNotEmpty) ...[
                  const _Heading('Work to hand in'),
                  for (final a in todo) _TaskRow(task: a),
                ],
                if (quizzes.isNotEmpty) ...[
                  const _Heading('Quizzes to take'),
                  for (final q in quizzes)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _ParentCard(
                        '${q['title']}',
                        '${q['courseName']} · ${_int(q['attemptsUsed'])} of ${_int(q['maxAttempts'])} attempts used${q['inProgress'] == true ? ' · in progress' : ''}',
                        null,
                      ),
                    ),
                ],
                if (grades.isNotEmpty) ...[
                  const _Heading('Recent grades'),
                  for (final g in grades)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _ParentCard(
                        '${g['title']} · ${_n(_dbl(g['score']))}/${_n(_dbl(g['maxScore']))}',
                        '${g['courseName']}${(g['feedback'] as String?)?.isNotEmpty == true ? '\nTeacher: ${g['feedback']}' : ''}',
                        null,
                      ),
                    ),
                ],
                const SizedBox(height: 4),
                const _ParentCard(
                  'How to support learning',
                  'Ask your child to show you their latest quiz result or assignment feedback.',
                  null,
                ),
              ],
            );
          },
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
    final childId = ref.watch(resolvedActiveChildIdProvider);
    if (childId.isEmpty) {
      return const _ParentElScaffold(
          title: 'Course', children: [_ParentCard('No child selected', 'Pick a child first.', null)]);
    }
    final summaryAsync = ref.watch(_parentLearningProvider(childId));

    return summaryAsync.when(
      loading: () => const _ParentElScaffold(title: 'Course', children: [_ParentLoadingCard()]),
      error: (e, _) => _ParentElScaffold(
        title: 'Course',
        children: [_ParentCard('Could not load', ApiFailure.from(e).message, null)],
      ),
      data: (data) {
        final enrollment = _list(data['enrollments']).where((e) => e['courseSpaceId'] == courseId).firstOrNull;
        final course = Map<String, dynamic>.from((enrollment?['courseSpace'] as Map?) ?? const {});
        final progress = _list(data['progresses']).where((p) => p['courseId'] == courseId).firstOrNull;
        if (enrollment == null) {
          return const _ParentElScaffold(
            title: 'Course',
            children: [_ParentCard('Not available', 'This course is not linked to your child.', null)],
          );
        }
        final tasks = (data['tasks'] as Map?) ?? const {};
        final todo = _list(tasks['assignments']).where((a) => a['courseId'] == courseId).toList();
        final quizzes = _list(tasks['quizzes']).where((q) => q['courseId'] == courseId).toList();
        final courseName = '${course['subjectName'] ?? ''} · ${course['className'] ?? ''}';
        final grades = _list(tasks['recentGrades']).where((g) => g['courseName'] == '${course['subjectName']} · ${course['className']}').toList();
        final pct = _int(progress?['completionPercent']);

        return _ParentElScaffold(
          title: courseName,
          onRefresh: () async {
            ref.invalidate(_parentLearningProvider(childId));
            await ref.read(_parentLearningProvider(childId).future);
          },
          children: [
            _ProgressCard(progress: pct),
            _ParentCard('Materials', '${_int(progress?['viewed'])} of ${_int(progress?['materials'])} viewed', null),
            _ParentCard('Assignments', '${_int(progress?['submissions'])} of ${_int(progress?['assignments'])} handed in', null),
            _ParentCard('Quizzes', '${_int(progress?['attempts'])} of ${_int(progress?['quizzes'])} attempted', null),
            if (todo.isNotEmpty) ...[
              const _Heading('Work to hand in'),
              for (final a in todo) _TaskRow(task: a),
            ],
            if (quizzes.isNotEmpty) ...[
              const _Heading('Quizzes to take'),
              for (final q in quizzes)
                _ParentCard('${q['title']}', '${_int(q['attemptsUsed'])} of ${_int(q['maxAttempts'])} attempts used', null),
            ],
            if (grades.isNotEmpty) ...[
              const _Heading('Recent grades'),
              for (final g in grades)
                _ParentCard('${g['title']} · ${_n(_dbl(g['score']))}/${_n(_dbl(g['maxScore']))}',
                    (g['feedback'] as String?)?.isNotEmpty == true ? 'Teacher: ${g['feedback']}' : 'Graded', null),
            ],
            if (todo.isEmpty && quizzes.isEmpty)
              const _ParentCard('All caught up', 'There is no outstanding work in this course.', null),
          ],
        );
      },
    );
  }
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task});
  final Map<String, dynamic> task;

  @override
  Widget build(BuildContext context) {
    final due = _date(task['dueAt']);
    final overdue = task['overdue'] == true;
    final status = switch (task['status']) {
      'DRAFT' => 'Draft saved, not handed in',
      'RETURNED' => 'Returned for correction',
      _ => 'Not started',
    };
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: _ParentCard(
        '${task['title']}',
        '${task['courseName']}\n$status · ${due == null ? 'No deadline' : 'Due ${DateFormat('EEE d MMM, HH:mm').format(due)}'}${overdue ? ' · OVERDUE' : ''}',
        null,
        warn: overdue,
      ),
    );
  }
}

// ─── Shared widgets ──────────────────────────────────────────────────────────

class _ParentElScaffold extends StatelessWidget {
  const _ParentElScaffold({required this.title, required this.children, this.onRefresh});
  final String title;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final list = ListView.separated(
      physics: onRefresh == null ? null : const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 110),
      itemBuilder: (_, i) => children[i],
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemCount: children.length,
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        backgroundColor: AppColors.eLearningPrimary,
        foregroundColor: Colors.white,
      ),
      body: onRefresh == null ? list : RefreshIndicator(onRefresh: onRefresh!, child: list),
    );
  }
}

class _Heading extends StatelessWidget {
  const _Heading(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 20, bottom: 8),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
      );
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.items});
  final List<(String, String)> items;

  @override
  Widget build(BuildContext context) => Card(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        color: AppColors.eLearningLight,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              for (final i in items)
                Column(children: [
                  Text(i.$1, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppColors.eLearningPrimary)),
                  Text(i.$2, style: const TextStyle(fontSize: 12)),
                ]),
            ],
          ),
        ),
      );
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({required this.progress});
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
              Text('$progress% complete', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: AppColors.eLearningPrimary)),
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
  Widget build(BuildContext context) => const Center(
        child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator()),
      );
}

class _ParentCard extends StatelessWidget {
  const _ParentCard(this.title, this.subtitle, this.onTap, {this.warn = false, this.progress});
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool warn;
  final double? progress;

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: warn ? BorderSide(color: Colors.red.shade300) : BorderSide.none,
        ),
        child: Column(
          children: [
            ListTile(
              onTap: onTap,
              leading: warn ? Icon(Icons.warning_rounded, color: Colors.red.shade400) : null,
              title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
              subtitle: Text(subtitle),
              trailing: onTap != null ? const Icon(Icons.chevron_right_rounded) : null,
            ),
            if (progress != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
                child: LinearProgressIndicator(
                  value: progress!.clamp(0, 1),
                  minHeight: 6,
                  borderRadius: BorderRadius.circular(6),
                  color: AppColors.eLearningPrimary,
                  backgroundColor: AppColors.eLearningLight,
                ),
              ),
          ],
        ),
      );
}
