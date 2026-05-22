import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../models/term_result_model.dart';
import '../../widgets/charts/ks_line_chart.dart';
import '../../widgets/charts/ks_sparkline.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_subject_compare_bar.dart';
import '../../widgets/parent/parent_surface.dart';

class AcademicOverviewScreen extends ConsumerWidget {
  const AcademicOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];
    final activeChildId = ref.watch(activeParentChildIdProvider);
    final childAsync = ref.watch(activeParentChildProvider);
    final termAsync = ref.watch(selectedParentTermProvider);

    final activeChild = childAsync.value;

    return Scaffold(
      appBar: KSAppBar(
        title: activeChild != null
            ? "${activeChild.firstName}'s Academics"
            : 'Academics',
        subtitle: activeChild != null
            ? '${activeChild.classLabel} — term progress summary'
            : null,
        variant: KSAppBarVariant.hero,
        showBack: false,
        actions: [
          IconButton(
            onPressed: () => _showTermSelector(context, ref),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(activeParentChildProvider);
          ref.invalidate(selectedParentTermProvider);
        },
        child: Column(
        children: [
          if (children.length > 1)
            KSChildSwitcher(
              children: children,
              activeChildId: activeChildId,
              onSwitch: (id) =>
                  ref.read(activeParentChildIdProvider.notifier).state = id,
            ),
          Expanded(
            child: childAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KSShimmerList(itemCount: 6),
              ),
              error: (error, stack) => const KSEmptyState(
                title: 'Something went wrong',
                subtitle: 'We couldn\'t load your data. Pull down to refresh.',
              ),
              data: (child) {
                if (child == null) {
                  return const KSEmptyState(title: 'No child selected');
                }
                return termAsync.when(
                  loading: () => const Padding(
                    padding: EdgeInsets.all(16),
                    child: KSShimmerList(itemCount: 6),
                  ),
                  error: (error, stack) => const KSEmptyState(
                    title: 'Something went wrong',
                    subtitle: 'We couldn\'t load your data. Pull down to refresh.',
                  ),
                  data: (term) {
                    if (term == null) {
                      return const KSEmptyState(
                        title: 'No academic term available',
                        subtitle: 'No published term was found for this child.',
                      );
                    }
                    return _AcademicsContent(
                      key: ValueKey('${child.id}-${term.id}'),
                      child: child,
                      term: term,
                    );
                  },
                );
              },
            ),
          ),
        ],
        ),
      ),
    );
  }

  Future<void> _showTermSelector(BuildContext context, WidgetRef ref) async {
    final terms = await ref.read(activeParentTermsProvider.future);
    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: terms
              .map(
                (term) => ListTile(
                  title: Text('${term.label} - ${term.academicYear}'),
                  subtitle: Text(
                    '${term.overallScore.toStringAsFixed(1)}% overall',
                  ),
                  trailing: term.isCurrent
                      ? const Icon(Icons.check_circle_rounded)
                      : null,
                  onTap: () {
                    ref.read(parentSelectedTermIdProvider.notifier).state =
                        term.id;
                    Navigator.of(context).pop();
                  },
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class _AcademicsContent extends ConsumerWidget {
  const _AcademicsContent({super.key, required this.child, required this.term});

  final ChildSummary child;
  final TermResultModel term;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subjectsAsync = ref.watch(activeParentSubjectsProvider);
    final classAveragesAsync = ref.watch(parentClassAveragesProvider(term.id));
    final failing = term.subjects.where((item) => !item.isPassing).length;
    final passing = term.subjects.length - failing;
    final best = term.subjects.reduce((a, b) => a.score > b.score ? a : b);

    return ParentSurface(
      header: ParentHero(
        child: child,
        title: "${child.firstName}'s Academics",
        subtitle:
            '${term.label} - ${term.academicYear}. Parent-friendly academic progress summary.',
        trailing: KSGradeDisplay(
          grade: term.overallGrade,
          size: GradeDisplaySize.medium,
          showLabel: false,
        ),
      ),
      children: [
        ParentCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'OVERALL AVERAGE',
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: AppColors.textSecondary,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.2,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${term.overallScore.toStringAsFixed(1)}%',
                          style: Theme.of(context).textTheme.displaySmall
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            KSGradeDisplay(
                              grade: term.overallGrade,
                              size: GradeDisplaySize.small,
                              showLabel: false,
                            ),
                            KSRankBadge(
                              rank: term.rank,
                              total: term.totalStudents,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  KSGradeDisplay(
                    grade: term.overallGrade,
                    size: GradeDisplaySize.large,
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: _MiniMetric(
                      label: 'Passing',
                      value: '$passing of ${term.subjects.length}',
                      color: AppColors.accentEmerald,
                    ),
                  ),
                  Expanded(
                    child: _MiniMetric(
                      label: 'Needs Help',
                      value: '$failing',
                      color: AppColors.accentRose,
                    ),
                  ),
                  Expanded(
                    child: _MiniMetric(
                      label: 'Best',
                      value: best.name,
                      color: AppColors.skyBlue600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Text(
                    'Last 3 terms:',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: KSSparkline(
                      values: [70.6, 74.5, 79.3],
                      color: AppColors.skyBlue500,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '+ Improving',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppColors.accentEmerald,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        ParentSectionTitle(
          title: 'All Subjects',
          subtitle: failing > 0
              ? '$failing subjects may need extra attention.'
              : 'All subjects are currently passing.',
        ),
        classAveragesAsync.when(
          loading: () => const ParentCard(child: KSShimmerList(itemCount: 4)),
          error: (error, stack) => const ParentCard(
            child: KSEmptyState(title: 'Unable to load', subtitle: 'Try refreshing.'),
          ),
          data: (classAverages) => subjectsAsync.when(
            loading: () => const ParentCard(child: KSShimmerList(itemCount: 4)),
            error: (error, stack) => const ParentCard(
              child: KSEmptyState(title: 'Unable to load', subtitle: 'Try refreshing.'),
            ),
            data: (subjects) => ParentCard(
              child: Column(
                children: [
                  for (var i = 0; i < subjects.length; i++) ...[
                    KSSubjectCompareBar(
                          subjectName: subjects[i].name,
                          studentScore: subjects[i].score,
                          classAverage:
                              classAverages[subjects[i].name] ??
                              (subjects[i].score - 5).clamp(0, 100),
                          grade: subjects[i].grade,
                          isPassing: subjects[i].isPassing,
                          onTap: () => context.push(
                            '/parent/academics/subject/${subjects[i].id}',
                          ),
                        )
                        .animate(delay: (i * 55).ms)
                        .fadeIn()
                        .slideX(begin: 0.025, end: 0),
                    if (i != subjects.length - 1)
                      Divider(color: AppColors.border.withValues(alpha: 0.65)),
                  ],
                ],
              ),
            ),
          ),
        ),
        const ParentSectionTitle(title: 'Term Progress'),
        ParentCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const KSLineChart(
                dataPoints: [
                  ChartPoint(x: 0, y: 70.6, grade: 'B-'),
                  ChartPoint(x: 1, y: 74.5, grade: 'B-'),
                  ChartPoint(x: 2, y: 79.3, grade: 'B'),
                ],
                labels: ['T1', 'T2', 'T1'],
                lineColor: AppColors.skyBlue500,
                height: 160,
              ),
              const SizedBox(height: 10),
              Text(
                '${child.firstName} is improving steadily across tracked terms.',
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: AppColors.accentEmerald),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: color,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}
