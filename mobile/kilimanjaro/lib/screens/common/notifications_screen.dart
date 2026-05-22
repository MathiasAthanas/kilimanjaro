import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/notification_model.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_notification_card.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import 'notification_filters.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}
class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  NotificationFeedFilter _filter = NotificationFeedFilter.all;

  @override
  Widget build(BuildContext context) {
    final unread = ref.watch(unreadCountProvider);
    final groups = ref.watch(notificationGroupsProvider);
    final userAsync = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: KSAppBar(
        title: 'Notifications',
        subtitle: unread == 0 ? 'You\'re all caught up' : '$unread unread update${unread == 1 ? '' : 's'}',
        variant: KSAppBarVariant.hero,
        showBack: false,
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: () async {
                final user = await ref.read(currentUserProvider.future);
                if (user == null) return;
                await ref.read(notificationServiceProvider).markAllRead(user);
              },
              style: TextButton.styleFrom(foregroundColor: AppColors.white),
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(notificationsStreamProvider),
        child: userAsync.when(
          data: (user) {
            if (user == null) return const SizedBox.shrink();
            final visibleGroups = _visibleGroups(groups);

            return CommonScreenSurface(
              children: [
                _FilterStrip(
                  selected: _filter,
                  onSelected: (value) => setState(() => _filter = value),
                ),
                const SizedBox(height: 16),
                if (visibleGroups.isEmpty)
                  const CommonCard(
                    child: KSEmptyState(
                      title: 'No notifications here',
                      subtitle: 'Try another filter or pull to refresh.',
                    ),
                  )
                else
                  for (final group in visibleGroups) ...[
                    CommonSectionTitle(title: group.label),
                    ...group.items.map(
                      (item) => KSNotificationCard(
                        item: item,
                        onTap: () async {
                          await ref
                              .read(notificationServiceProvider)
                              .markRead(user, item.id);
                          if (context.mounted) {
                            context.go(
                              '/shell/${user.role.shellSegment}/notifications/${item.id}',
                            );
                          }
                        },
                        onLongPress: () async {
                          await ref
                              .read(notificationServiceProvider)
                              .markRead(user, item.id, read: !item.isRead);
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
              ],
            );
          },
          loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 6)),
          error: (error, stack) => const KSEmptyState(
            title: 'Could not load notifications',
            subtitle: 'Pull down to try again.',
          ),
        ),
      ),
    );
  }

  List<NotificationGroup> _visibleGroups(List<NotificationGroup> groups) {
    return groups
        .map(
          (group) => NotificationGroup(
            label: group.label,
            items: group.items.where(_filter.matches).toList(),
          ),
        )
        .where((group) => group.items.isNotEmpty)
        .toList();
  }
}

class _FilterStrip extends StatelessWidget {
  const _FilterStrip({required this.selected, required this.onSelected});

  final NotificationFeedFilter selected;
  final ValueChanged<NotificationFeedFilter> onSelected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: NotificationFeedFilter.values.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = NotificationFeedFilter.values[index];
          return KSChip(
            label: item.label,
            color: AppColors.skyBlue600,
            filled: selected == item,
            leadingDot: false,
            onTap: () => onSelected(item),
          );
        },
      ),
    );
  }
}
