import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../models/notification_model.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_chip.dart';

class NotificationDetailScreen extends ConsumerWidget {
  const NotificationDetailScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: const KSAppBar(title: 'Notification'),
      body: userAsync.when(
        data: (user) {
          if (user == null) return const SizedBox.shrink();
          return FutureBuilder<NotificationModel?>(
            future: ref
                .read(notificationServiceProvider)
                .getNotificationById(user, id),
            builder: (context, snapshot) {
              final item = snapshot.data;
              if (item == null) {
                return const Center(child: CircularProgressIndicator());
              }
              return CommonScreenSurface(
                header: CommonHeroCard(
                  user: user,
                  title: item.title,
                  subtitle:
                      '${item.sourceService} - ${DateFormat('EEEE, MMM d - h:mm a').format(item.createdAt)}',
                ),
                children: [
                  CommonCard(
                    child: Row(
                      children: [
                        KSChip(
                          label: item.channel.name.toUpperCase(),
                          color: _channelColor(item.channel),
                          size: ChipSize.small,
                          leadingDot: false,
                        ),
                        const SizedBox(width: 8),
                        KSChip(
                          label: item.isRead ? 'READ' : 'UNREAD',
                          color: item.isRead
                              ? AppColors.accentTeal
                              : AppColors.accentAmber,
                          size: ChipSize.small,
                          leadingDot: false,
                        ),
                      ],
                    ),
                  ),
                  CommonCard(
                    child: Text(
                      item.body,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyLarge?.copyWith(height: 1.6),
                    ),
                  ),
                  if (item.targetRoute != null && item.actionLabel != null)
                    CommonCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Related Action',
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'This update is linked to another screen in your ${user.role.label.toLowerCase()} workspace.',
                          ),
                          const SizedBox(height: 16),
                          KSButton(
                            label: 'Open ${item.actionLabel}',
                            secondary: true,
                            onPressed: () => context.go(item.targetRoute!),
                          ),
                        ],
                      ),
                    ),
                ],
              );
            },
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

  Color _channelColor(NotificationChannel channel) => switch (channel) {
    NotificationChannel.sms => AppColors.accentAmber,
    NotificationChannel.email => AppColors.accentIndigo,
    NotificationChannel.push => AppColors.accentTeal,
    NotificationChannel.inApp => AppColors.skyBlue600,
  };
}
