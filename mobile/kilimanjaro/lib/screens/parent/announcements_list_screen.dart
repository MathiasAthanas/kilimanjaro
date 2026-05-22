import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/announcement_model.dart';
import '../../widgets/common/ks_announcement_card.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/parent/parent_surface.dart';

class ParentAnnouncementsListScreen extends ConsumerWidget {
  const ParentAnnouncementsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final filter = ref.watch(parentAnnouncementFilterProvider);
    final items = ref.watch(filteredParentAnnouncementsProvider);
    final child = ref.watch(activeParentChildProvider).value;

    return Scaffold(
      appBar: KSAppBar(
        title: 'School Announcements',
        subtitle: child != null
            ? 'Updates for ${child.firstName} · ${child.classLabel}'
            : null,
        variant: KSAppBarVariant.hero,
        actions: [
          if (child != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: _CountBubble(count: items.length),
            ),
        ],
      ),
      body: ParentSurface(
        children: [
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _FilterChip(
                  label: 'All',
                  active: filter == null,
                  onTap: () =>
                      ref
                              .read(parentAnnouncementFilterProvider.notifier)
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
                                .read(parentAnnouncementFilterProvider.notifier)
                                .state =
                            priority,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            const ParentCard(
              child: KSEmptyState(title: 'No announcements right now'),
            )
          else
            ...items.map(
              (item) => Stack(
                children: [
                  KSAnnouncementCard(
                    announcement: item,
                    onTap: () =>
                        context.push('/parent/announcements/${item.id}'),
                  ),
                  if (item.id == 'ann-science-exhibition')
                    const Positioned(
                      right: 28,
                      top: 20,
                      child: _ChildTagChip(
                        label: "Amina's class",
                        color: AppColors.skyBlue500,
                      ),
                    ),
                  if (item.id == 'ann-jabir-parents-meeting')
                    const Positioned(
                      right: 28,
                      top: 20,
                      child: _ChildTagChip(
                        label: "Jabir's class",
                        color: AppColors.accentIndigo,
                      ),
                    ),
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
      ),
    );
  }
}

class _ChildTagChip extends StatelessWidget {
  const _ChildTagChip({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _CountBubble extends StatelessWidget {
  const _CountBubble({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.16),
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.white.withValues(alpha: 0.24)),
      ),
      child: Center(
        child: Text(
          '$count',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: AppColors.white,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}
