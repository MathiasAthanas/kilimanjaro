import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/performance_snapshot_model.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_trend_arrow.dart';
import '../../widgets/student/student_surface.dart';

class PerformanceTrendsScreen extends ConsumerWidget {
  const PerformanceTrendsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshotsAsync = ref.watch(performanceSnapshotsProvider);
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    return Scaffold(
      body: snapshotsAsync.when(
        data: (snapshots) {
          final watchlist = snapshots
              .where((item) => item.currentScore < 70 || item.trendDelta <= -4)
              .toList();
          final improving = snapshots
              .where((item) => item.trendDelta >= 4)
              .toList();
          final stable = snapshots
              .where((item) => item.trendDelta > -4 && item.trendDelta < 4)
              .toList();

          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: StudentHeroHeader(
                  kicker: 'PERFORMANCE TRENDS',
                  title: '${watchlist.length} subjects need attention',
                  subtitle:
                      'Grouped by risk, improvement, and stable movement from the previous term.',
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
                sliver: SliverList.list(
                  children: [
                    StudentSurface(
                      children: [
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: [
                            KSChip(
                              label: '${watchlist.length} Watchlist',
                              color: AppColors.accentRose,
                            ),
                            KSChip(
                              label: '${improving.length} Improving',
                              color: AppColors.accentEmerald,
                            ),
                            KSChip(
                              label: '${stable.length} Stable',
                              color: AppColors.accentAmber,
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    _TrendGroupSection(
                      title: 'Needs Attention',
                      subtitle: 'Subjects below target or trending downward.',
                      items: watchlist,
                      tint: AppColors.accentRose,
                    ),
                    _TrendGroupSection(
                      title: 'Improving',
                      subtitle: 'Clear upward movement from the previous term.',
                      items: improving,
                      tint: AppColors.accentEmerald,
                    ),
                    _TrendGroupSection(
                      title: 'Stable',
                      subtitle: 'Consistent performance with smaller movement.',
                      items: stable,
                      tint: AppColors.accentAmber,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
      ),
    );
  }
}

class _TrendGroupSection extends StatelessWidget {
  const _TrendGroupSection({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.tint,
  });

  final String title;
  final String subtitle;
  final List<PerformanceSnapshotModel> items;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Section header ────────────────────────────────────────────
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 5,
                height: 36,
                decoration: BoxDecoration(
                  color: tint,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            )),
                    const SizedBox(height: 2),
                    Text(subtitle,
                        style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // ── Cards ─────────────────────────────────────────────────────
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _TrendCard(item: item, tint: tint),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Individual trend card ─────────────────────────────────────────────────

class _TrendCard extends ConsumerWidget {
  const _TrendCard({required this.item, required this.tint});

  final PerformanceSnapshotModel item;
  final Color tint;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subject = ref.watch(subjectByIdProvider(item.subjectId));
    final grade = subject?.grade ?? _gradeFromScore(item.currentScore);
    final accent =
        item.currentScore >= 70 ? AppColors.skyBlue500 : AppColors.accentRose;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: tint.withValues(alpha: isDark ? 0.25 : 0.18),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: isDark ? 0.18 : 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => context.push('/student/performance/${item.subjectId}'),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left tint accent bar
              Container(
                width: 5,
                decoration: BoxDecoration(
                  color: tint,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                  ),
                ),
              ),
              // Card content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Top row: name / grade  |  score / trend ───────
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.subjectName,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 6),
                                KSChip.grade(grade),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${item.currentScore.toStringAsFixed(0)}%',
                                style: Theme.of(context)
                                    .textTheme
                                    .headlineSmall
                                    ?.copyWith(
                                      color: accent,
                                      fontWeight: FontWeight.w800,
                                      height: 1.1,
                                    ),
                              ),
                              const SizedBox(height: 5),
                              KSTrendArrow(delta: item.trendDelta),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // ── Bottom row: rank badge | previous score ───────
                      Row(
                        children: [
                          KSRankBadge(
                              rank: item.rank, total: item.totalStudents),
                          const Spacer(),
                          Text(
                            'prev. ${item.previousScore.toStringAsFixed(0)}%',
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurface
                                          .withValues(alpha: 0.45),
                                    ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String _gradeFromScore(double score) {
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}
