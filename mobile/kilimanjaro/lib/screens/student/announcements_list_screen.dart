import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/announcement_model.dart';
import '../../widgets/common/ks_announcement_card.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/student/student_surface.dart';

class AnnouncementsListScreen extends ConsumerWidget {
  const AnnouncementsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(announcementFilterProvider);
    final items = [...ref.watch(filteredAnnouncementsProvider)]
      ..sort((a, b) => a.priority.index.compareTo(b.priority.index));
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          const SliverToBoxAdapter(
            child: StudentHeroHeader(
              kicker: 'ANNOUNCEMENTS',
              title: 'School updates',
              subtitle:
                  'Stay current with notices, deadlines, events, and urgent announcements.',
            ),
          ),
          SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
            sliver: SliverList.list(
              children: [
                StudentSurface(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  children: [
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          _FilterChip(
                            label: 'All',
                            active: filter == null,
                            onTap: () =>
                                ref
                                        .read(
                                          announcementFilterProvider.notifier,
                                        )
                                        .state =
                                    null,
                          ),
                          ...AnnouncementPriority.values.map(
                            (priority) => _FilterChip(
                              label:
                                  priority.name[0].toUpperCase() +
                                  priority.name.substring(1),
                              active: filter == priority,
                              onTap: () =>
                                  ref
                                          .read(
                                            announcementFilterProvider.notifier,
                                          )
                                          .state =
                                      priority,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                if (items.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(32),
                    child: KSEmptyState(
                      title: 'No announcements right now',
                      subtitle: 'Check back later for school-wide updates.',
                    ),
                  )
                else ...[
                  if (items.any(
                    (item) => item.priority == AnnouncementPriority.urgent,
                  )) ...[
                    Text(
                      'Urgent First',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 10),
                  ],
                  ...items.map(
                    (item) => KSAnnouncementCard(
                      announcement: item,
                      onTap: () =>
                          context.push('/student/announcements/${item.id}'),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => onTap(),
        selectedColor: AppColors.skyBlue100,
        backgroundColor: AppColors.white,
        side: BorderSide(
          color: active ? AppColors.skyBlue300 : AppColors.border,
        ),
      ),
    );
  }
}
