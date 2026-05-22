import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/performance_snapshot_model.dart';
import '../../models/subject_result_model.dart';
import '../../widgets/charts/ks_bar_chart.dart';
import '../../widgets/charts/ks_line_chart.dart';
import '../../widgets/common/ks_alert_card.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_subject_compare_bar.dart';
import '../../widgets/parent/parent_surface.dart';

class SubjectResultsDetailScreen extends ConsumerWidget {
  const SubjectResultsDetailScreen({super.key, required this.subjectId});

  final String subjectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subjectAsync = ref.watch(parentSubjectByIdProvider(subjectId));
    final child = ref.watch(activeParentChildProvider).value;
    final alerts =
        ref.watch(activeParentAlertsProvider).value ??
        const <PerformanceAlertModel>[];

    final subjectName = subjectAsync.value?.name;

    return Scaffold(
      appBar: KSAppBar(
        title: subjectName ?? 'Subject Detail',
        subtitle: child != null ? '${child.firstName} · ${child.classLabel}' : null,
        variant: KSAppBarVariant.hero,
      ),
      body: subjectAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: KSShimmerList(itemCount: 6),
        ),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
        data: (subject) {
          if (subject == null) {
            return const KSEmptyState(title: 'Subject not found');
          }
          final subjectAlert = alerts
              .where((item) => item.subjectId == subject.id)
              .firstOrNull;
          return ParentSurface(
            children: [
              _SubjectHeroCard(subject: subject),
              const ParentSectionTitle(title: 'Assessment Breakdown'),
              ParentCard(
                child: KSBarChart(
                  bars: subject.assessments
                      .map(
                        (item) => BarData(
                          label: item.label,
                          value: item.score,
                          maxValue: item.maxScore,
                          color: AppColors.skyBlue500,
                        ),
                      )
                      .toList(),
                ),
              ),
              const ParentSectionTitle(title: 'Score History'),
              ParentCard(
                child: ref
                    .watch(parentPerformanceTrendProvider(subjectId))
                    .when(
                      loading: () => const KSShimmerList(itemCount: 3),
                      error: (error, stack) => const Text('Unable to load', style: TextStyle(color: AppColors.textMuted)),
                      data: (trend) => trend == null
                          ? const SizedBox.shrink()
                          : KSLineChart(
                              dataPoints: [
                                for (var i = 0; i < trend.points.length; i++)
                                  ChartPoint(
                                    x: i.toDouble(),
                                    y: trend.points[i].value,
                                    grade: trend.points[i].grade,
                                  ),
                              ],
                              labels: trend.points
                                  .map((item) => item.label)
                                  .toList(),
                              lineColor: AppColors.skyBlue500,
                              height: 160,
                            ),
                    ),
              ),
              const ParentSectionTitle(title: 'vs Class Average'),
              ref
                  .watch(activeParentTermsProvider)
                  .when(
                    loading: () =>
                        const ParentCard(child: KSShimmerList(itemCount: 3)),
                    error: (error, stack) => const ParentCard(
                      child: KSEmptyState(title: 'Unable to load', subtitle: 'Try refreshing.'),
                    ),
                    data: (terms) => Column(
                      children: terms.map((term) {
                        final match = term.subjects
                            .where((item) => item.id == subject.id)
                            .firstOrNull;
                        if (match == null) return const SizedBox.shrink();
                        final average =
                            ref
                                .watch(parentClassAveragesProvider(term.id))
                                .value?[match.name] ??
                            (match.score - 5);
                        return ParentCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${term.label} - ${term.academicYear}',
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                              const SizedBox(height: 10),
                              KSSubjectCompareBar(
                                subjectName: match.name,
                                studentScore: match.score,
                                classAverage: average,
                                grade: match.grade,
                                isPassing: match.isPassing,
                              ),
                            ],
                          ),
                        ).animate().fadeIn().slideY(begin: 0.03, end: 0);
                      }).toList(),
                    ),
                  ),
              if (subjectAlert != null && child != null) ...[
                const ParentSectionTitle(title: 'Parent Notice'),
                KSAlertCard(
                  alertType: subjectAlert.type,
                  severity: subjectAlert.severity,
                  subjectName: subjectAlert.subjectName,
                  studentName: child.firstName,
                  onTap: () {},
                  showAction: false,
                  messageOverride:
                      '${child.firstName} may need extra support in ${subjectAlert.subjectName}. The school has already started follow-up.',
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SubjectHeroCard extends StatelessWidget {
  const _SubjectHeroCard({required this.subject});

  final SubjectResultModel subject;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject.name,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  '${subject.score.toStringAsFixed(0)}% score',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: subject.isPassing
                        ? AppColors.accentEmerald
                        : AppColors.accentRose,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 8),
                KSRankBadge(rank: subject.rank, total: subject.totalStudents),
              ],
            ),
          ),
          KSGradeDisplay(grade: subject.grade, size: GradeDisplaySize.large),
        ],
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
