import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/announcement_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';

class ParentAnnouncementDetailScreen extends ConsumerWidget {
  const ParentAnnouncementDetailScreen({
    super.key,
    required this.announcementId,
  });

  final String announcementId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final announcementsAsync = ref.watch(parentAnnouncementsProvider);
    final child = ref.watch(activeParentChildProvider).value;

    return Scaffold(
      appBar: KSAppBar(
        title: 'School Update',
        subtitle: child != null ? '${child.firstName} · ${child.classLabel}' : null,
        variant: KSAppBarVariant.hero,
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 8),
            child: Icon(Icons.campaign_rounded, color: Colors.white, size: 30),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(parentAnnouncementsProvider),
        child: announcementsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: KSShimmerList(itemCount: 4),
          ),
          error: (error, stack) => const KSEmptyState(
            title: 'Something went wrong',
            subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
        data: (items) {
          final announcement = items
              .where((item) => item.id == announcementId)
              .firstOrNull;
          if (announcement == null) {
            return const KSEmptyState(title: 'Announcement not found');
          }
          return ParentSurface(
            children: [
              ParentCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    KSChip(
                      label: announcement.priority.name.toUpperCase(),
                      color: _priorityColor(announcement.priority),
                      size: ChipSize.large,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      announcement.title,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Posted by ${announcement.authorName} - ${announcement.authorRole}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      announcement.body,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyLarge?.copyWith(height: 1.7),
                    ),
                  ],
                ),
              ),
              if (announcement.attachment != null)
                ParentCard(
                  child: Row(
                    children: [
                      Container(
                        width: 46,
                        height: 46,
                        decoration: BoxDecoration(
                          color: AppColors.skyBlue500.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: const Icon(
                          Icons.attach_file_rounded,
                          color: AppColors.skyBlue600,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              announcement.attachment!.name,
                              style: Theme.of(context).textTheme.titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                            Text(announcement.attachment!.sizeLabel),
                          ],
                        ),
                      ),
                      TextButton(onPressed: () {}, child: const Text('Open')),
                    ],
                  ),
                ),
            ],
          );
        },
        ),
      ),
    );
  }

  Color _priorityColor(AnnouncementPriority priority) => switch (priority) {
    AnnouncementPriority.urgent => AppColors.accentRose,
    AnnouncementPriority.high => AppColors.accentAmber,
    AnnouncementPriority.normal => AppColors.skyBlue600,
    AnnouncementPriority.low => AppColors.accentTeal,
  };
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
