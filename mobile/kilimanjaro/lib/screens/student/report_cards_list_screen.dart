import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/student/student_surface.dart';

class ReportCardsListScreen extends ConsumerWidget {
  const ReportCardsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(reportCardsProvider);
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    return Scaffold(
      body: cardsAsync.when(
        data: (cards) => CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(
              child: StudentHeroHeader(
                kicker: 'REPORT CARDS',
                title: 'Full academic documents',
                subtitle:
                    'Open class position, remarks, attendance, and subject performance in one place.',
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
              sliver: SliverList.separated(
                itemCount: cards.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final card = cards[index];
                  return StudentSurface(
                    onTap: () =>
                        context.push('/student/report-cards/${card.termId}'),
                    children: [
                      Row(
                        children: [
                          KSGradeDisplay(
                            grade: card.overallGrade,
                            size: GradeDisplaySize.medium,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  card.title,
                                  style: Theme.of(context).textTheme.titleLarge,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '${card.classLabel} ${card.stream}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '${card.overallScore.toStringAsFixed(1)}% / Rank ${card.rank}/${card.totalStudents}',
                                  style: Theme.of(context).textTheme.bodyMedium
                                      ?.copyWith(fontWeight: FontWeight.w700),
                                ),
                              ],
                            ),
                          ),
                          const Icon(Icons.chevron_right_rounded),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
      ),
    );
  }
}
