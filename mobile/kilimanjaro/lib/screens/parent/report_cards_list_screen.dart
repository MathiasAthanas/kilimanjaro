import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ParentReportCardsListScreen extends ConsumerWidget {
  const ParentReportCardsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];
    final activeId = ref.watch(activeParentChildIdProvider);
    final child = ref.watch(activeParentChildProvider).value;
    final cardsAsync = ref.watch(parentReportCardsProvider);

    return Scaffold(
      appBar: KSAppBar(
        title: child != null ? "${child.firstName}'s Report Cards" : 'Report Cards',
        subtitle: child != null
            ? '${child.classLabel} · published terms only'
            : null,
        variant: KSAppBarVariant.hero,
      ),
      body: Column(
        children: [
          if (children.length > 1)
            KSChildSwitcher(
              children: children,
              activeChildId: activeId,
              onSwitch: (value) =>
                  ref.read(activeParentChildIdProvider.notifier).state = value,
            ),
          Expanded(
            child: cardsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KSShimmerList(itemCount: 5),
              ),
              error: (error, stack) => const KSEmptyState(
                title: 'Something went wrong',
                subtitle: 'We couldn\'t load your data. Pull down to refresh.',
              ),
              data: (cards) {
                if (cards.isEmpty) {
                  return const KSEmptyState(
                    title: 'No published report cards',
                    subtitle: 'Published parent report cards will appear here.',
                  );
                }
                return ParentSurface(
                  children: cards
                      .map(
                        (card) => ParentCard(
                          onTap: () => context.push(
                            '/parent/report-cards/${card.termId}',
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 50,
                                height: 50,
                                decoration: BoxDecoration(
                                  color: AppColors.skyBlue500.withValues(
                                    alpha: 0.12,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(
                                  Icons.description_rounded,
                                  color: AppColors.skyBlue600,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      card.title,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w900,
                                          ),
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      '${card.overallScore.toStringAsFixed(1)}% - Rank ${card.rank}/${card.totalStudents}',
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      'Published ${formatParentShortDate(card.generatedAt ?? DateTime.now())}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right_rounded),
                            ],
                          ),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
