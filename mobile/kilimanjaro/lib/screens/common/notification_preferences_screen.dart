import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../models/notification_model.dart';
import '../../models/notification_preference_model.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_toggle.dart';

class NotificationPreferencesScreen extends ConsumerWidget {
  const NotificationPreferencesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider).value;
    final prefsMap = ref.watch(notificationPreferencesControllerProvider);
    final initialAsync = ref.watch(preferencesProvider);
    final prefs = prefsMap.isNotEmpty
        ? prefsMap.values.toList()
        : (initialAsync.value ?? const []);
    final grouped = <String, List<NotificationPreferenceModel>>{};
    for (final item in prefs) {
      grouped.putIfAbsent(item.section, () => []).add(item);
    }

    return Scaffold(
      appBar: const KSAppBar(title: 'Notification Preferences'),
      body: initialAsync.isLoading && prefs.isEmpty
          ? const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 4))
          : CommonScreenSurface(
              header: CommonHeroCard(
                user: user,
                iconAsset: 'assets/icons/bell.svg',
                title: 'Notification Control',
                subtitle:
                    'Fine-tune which events reach you and the channel each event should use.',
              ),
              children: [
                for (final entry in grouped.entries) ...[
                  CommonSectionTitle(title: entry.key),
                  CommonCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (var i = 0; i < entry.value.length; i++)
                          _PreferenceRow(
                            item: entry.value[i],
                            showDivider: i != entry.value.length - 1,
                            onChanged: (channel, value) {
                              ref
                                  .read(
                                    notificationPreferencesControllerProvider
                                        .notifier,
                                  )
                                  .toggleChannel(
                                    entry.value[i].key,
                                    channel,
                                    value,
                                  );
                            },
                          ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _PreferenceRow extends StatelessWidget {
  const _PreferenceRow({
    required this.item,
    required this.showDivider,
    required this.onChanged,
  });

  final NotificationPreferenceModel item;
  final bool showDivider;
  final void Function(NotificationChannel channel, bool value) onChanged;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: showDivider
            ? Border(
                bottom: BorderSide(
                  color: isDark
                      ? AppColors.darkBorder.withValues(alpha: 0.5)
                      : AppColors.border.withValues(alpha: 0.7),
                ),
              )
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            item.label,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(
            item.description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: NotificationChannel.values.map((channel) {
              return _ChannelToggle(
                channel: channel,
                value: item.channels[channel] ?? false,
                onChanged: (value) => onChanged(channel, value),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _ChannelToggle extends StatelessWidget {
  const _ChannelToggle({
    required this.channel,
    required this.value,
    required this.onChanged,
  });

  final NotificationChannel channel;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: _color.withValues(alpha: value ? 0.12 : 0.06),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _color.withValues(alpha: value ? 0.28 : 0.12),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            _label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: _color,
            ),
          ),
          const SizedBox(width: 8),
          KSToggle(width: 38, value: value, onChanged: onChanged),
        ],
      ),
    );
  }

  String get _label => switch (channel) {
    NotificationChannel.inApp => 'APP',
    NotificationChannel.sms => 'SMS',
    NotificationChannel.email => 'EMAIL',
    NotificationChannel.push => 'PUSH',
  };

  Color get _color => switch (channel) {
    NotificationChannel.inApp => AppColors.skyBlue600,
    NotificationChannel.sms => AppColors.accentAmber,
    NotificationChannel.email => AppColors.accentIndigo,
    NotificationChannel.push => AppColors.accentTeal,
  };
}
