import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/student/student_surface.dart';

class ResultsListScreen extends ConsumerWidget {
  const ResultsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final termsAsync = ref.watch(studentTermsProvider);
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    return Scaffold(
      body: termsAsync.when(
        data: (terms) => RefreshIndicator(
          onRefresh: () async => ref.invalidate(studentTermsProvider),
          child: CustomScrollView(
          slivers: [
            const SliverToBoxAdapter(
              child: StudentHeroHeader(
                kicker: 'ACADEMIC RESULTS',
                title: 'Every term, clearly laid out',
                subtitle:
                    'Track performance term by term and open a full subject breakdown when needed.',
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
              sliver: SliverList.separated(
                itemCount: terms.length,
                separatorBuilder: (_, __) => const SizedBox(height: 14),
                itemBuilder: (context, index) {
                  final term = terms[index];
                  return StudentSurface(
                    onTap: () =>
                        context.push('/shell/student/results/${term.id}'),
                    gradient: term.isCurrent ? AppColors.heroGradient : null,
                    children: [
                      Row(
                        children: [
                          KSGradeDisplay(
                            grade: term.overallGrade,
                            size: GradeDisplaySize.small,
                            showLabel: false,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${term.label} ${term.academicYear}',
                                  style: Theme.of(context).textTheme.titleLarge
                                      ?.copyWith(
                                        color: term.isCurrent
                                            ? AppColors.white
                                            : null,
                                      ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${term.subjects.length} subjects recorded',
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(
                                        color: term.isCurrent
                                            ? AppColors.white.withValues(
                                                alpha: 0.78,
                                              )
                                            : null,
                                      ),
                                ),
                              ],
                            ),
                          ),
                          Icon(
                            Icons.chevron_right_rounded,
                            color: term.isCurrent
                                ? AppColors.white
                                : AppColors.textMuted,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: _ResultStat(
                              label: 'Overall',
                              value: '${term.overallScore.toStringAsFixed(1)}%',
                              light: term.isCurrent,
                            ),
                          ),
                          const SizedBox(width: 12),
                          KSRankBadge(
                            rank: term.rank,
                            total: term.totalStudents,
                          ),
                        ],
                      ),
                      if (term.isCurrent) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.white.withValues(alpha: 0.14),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'CURRENT TERM',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                        ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ],
          ),
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

class _ResultStat extends StatelessWidget {
  const _ResultStat({
    required this.label,
    required this.value,
    required this.light,
  });

  final String label;
  final String value;
  final bool light;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: light
            ? AppColors.white.withValues(alpha: 0.12)
            : AppColors.surface,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: light ? AppColors.white.withValues(alpha: 0.72) : null,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: light ? AppColors.white : null,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}
