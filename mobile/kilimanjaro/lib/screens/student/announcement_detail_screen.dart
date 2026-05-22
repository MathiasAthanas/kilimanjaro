import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/announcement_model.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_svg_icon.dart';
import '../../widgets/student/student_surface.dart';
import 'student_formatters.dart';

class AnnouncementDetailScreen extends ConsumerWidget {
  const AnnouncementDetailScreen({super.key, required this.announcementId});

  final String announcementId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final announcementsAsync = ref.watch(announcementsProvider);

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(announcementsProvider),
        child: announcementsAsync.when(
        data: (items) {
          final announcement = items
              .where((item) => item.id == announcementId)
              .firstOrNull;
          if (announcement == null) {
            return const KSEmptyState(title: 'Announcement not found');
          }

          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: StudentHeroHeader(
                  kicker: announcement.priority.name.toUpperCase(),
                  title: announcement.title,
                  subtitle:
                      'Posted by ${announcement.authorName} / ${timeAgo(announcement.publishedAt)}.',
                  trailing: IconButton.filledTonal(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList.list(
                  children: [
                    StudentSurface(
                      children: [
                        KSChip(
                          label: announcement.priority.name.toUpperCase(),
                          color: _priorityColor(announcement.priority),
                          size: ChipSize.large,
                        ),
                        const SizedBox(height: 14),
                        Text(
                          announcement.body,
                          style: Theme.of(
                            context,
                          ).textTheme.bodyLarge?.copyWith(height: 1.7),
                        ),
                      ],
                    ),
                    if (announcement.attachment != null) ...[
                      const SizedBox(height: 16),
                      StudentSurface(
                        padding: const EdgeInsets.all(16),
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppColors.skyBlue50,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Center(
                                  child: KSSvgIcon(
                                    'assets/icons/document-text.svg',
                                    size: 20,
                                    color: AppColors.skyBlue700,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      announcement.attachment!.name,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(announcement.attachment!.sizeLabel),
                                  ],
                                ),
                              ),
                              TextButton(
                                onPressed: () {},
                                child: const Text('Open'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
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
      ),
    );
  }

  Color _priorityColor(AnnouncementPriority priority) => switch (priority) {
    AnnouncementPriority.urgent => AppColors.accentRose,
    AnnouncementPriority.high => AppColors.accentAmber,
    AnnouncementPriority.normal => AppColors.skyBlue500,
    AnnouncementPriority.low => AppColors.accentTeal,
  };
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
