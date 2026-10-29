import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/performance_snapshot_model.dart';
import '../../models/term_result_model.dart';
import '../../widgets/charts/ks_term_trend.dart';
import '../../widgets/charts/ks_sparkline.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_trend_arrow.dart';
import '../../widgets/parent/parent_surface.dart';

class PerformanceTrendsScreen extends ConsumerWidget {
  const PerformanceTrendsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final child = ref.watch(activeParentChildProvider).valueOrNull;
    final snapshotsAsync = ref.watch(activeParentSnapshotsProvider);

    return Scaffold(
      appBar: KSAppBar(
        title: child != null ? "${child.firstName}'s Trends" : 'Performance Trends',
        subtitle: child != null
            ? '${child.classLabel} · term-by-term academic trajectory'
            : null,
        variant: KSAppBarVariant.hero,
      ),
      body: snapshotsAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: KSShimmerList(itemCount: 6),
        ),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
        data: (snapshots) {
          final doingWell = snapshots
              .where((item) => item.currentScore >= 75)
              .toList();
          final roomToGrow = snapshots
              .where(
                (item) => item.currentScore >= 50 && item.currentScore < 75,
              )
              .toList();
          final needsFocus = snapshots
              .where((item) => item.currentScore < 50)
              .toList();

          return ParentSurface(
            children: [
              ParentCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Consumer(builder: (context, ref, _) {
                      final terms = ref.watch(activeParentTermsProvider).valueOrNull ?? const <TermResultModel>[];
                      return KSTermTrend(terms: terms, name: child?.firstName ?? 'Overall');
                    }),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _SummaryPill(
                          label:
                              '${snapshots.where((s) => s.trendDelta > 2).length} improving',
                        ),
                        _SummaryPill(
                          label:
                              '${snapshots.where((s) => s.trendDelta.abs() <= 2).length} stable',
                        ),
                        _SummaryPill(
                          label: '${needsFocus.length} need attention',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (doingWell.isNotEmpty) ...[
                const ParentSectionTitle(title: 'Doing Well'),
                ...doingWell.map((item) => _TrendCard(snapshot: item)),
              ],
              if (roomToGrow.isNotEmpty) ...[
                const ParentSectionTitle(title: 'Room to Grow'),
                ...roomToGrow.map((item) => _TrendCard(snapshot: item)),
              ],
              if (needsFocus.isNotEmpty) ...[
                const ParentSectionTitle(title: 'Needs Focus'),
                ...needsFocus.map((item) => _TrendCard(snapshot: item)),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _TrendCard extends StatelessWidget {
  const _TrendCard({required this.snapshot});

  final PerformanceSnapshotModel snapshot;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      onTap: () =>
          context.push('/parent/academics/subject/${snapshot.subjectId}'),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  snapshot.subjectName,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text('Current: ${snapshot.currentScore.toStringAsFixed(0)}%'),
                const SizedBox(height: 4),
                Text(
                  '3 terms tracked',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          SizedBox(
            width: 62,
            child: KSSparkline(
              values: [
                snapshot.previousScore - 2,
                snapshot.previousScore,
                snapshot.currentScore,
              ],
              color: AppColors.skyBlue500,
            ),
          ),
          const SizedBox(width: 10),
          KSTrendArrow(delta: snapshot.trendDelta),
        ],
      ),
    );
  }
}

class _SummaryPill extends StatelessWidget {
  const _SummaryPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.skyBlue500.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
