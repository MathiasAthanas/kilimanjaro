import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_subject_card.dart';
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

class _TrendGroupSection extends ConsumerWidget {
  const _TrendGroupSection({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.tint,
  });

  final String title;
  final String subtitle;
  final List<dynamic> items;
  final Color tint;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: StudentSurface(
        children: [
          Row(
            children: [
              Container(
                width: 10,
                height: 34,
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
                    Text(title, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...items.map((item) {
            final subject = ref.watch(subjectByIdProvider(item.subjectId));
            if (subject == null) return const SizedBox.shrink();

            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Stack(
                children: [
                  KSSubjectCard(
                    subject: subject,
                    compact: true,
                    onTap: () =>
                        context.push('/student/performance/${item.subjectId}'),
                  ),
                  Positioned(
                    right: 18,
                    bottom: 18,
                    child: KSTrendArrow(delta: item.trendDelta),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
