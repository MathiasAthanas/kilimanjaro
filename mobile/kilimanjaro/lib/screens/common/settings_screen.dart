import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/theme_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_settings_item.dart';
import '../../widgets/common/ks_shimmer_list.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final userAsync = ref.watch(currentUserProvider);

    final user = userAsync.value;

    return Scaffold(
      appBar: KSAppBar(
        title: 'Settings',
        subtitle: user != null ? '${user.role.label} workspace preferences' : null,
        variant: KSAppBarVariant.hero,
        showBack: false,
      ),
      body: userAsync.when(
        data: (user) {
          final segment = user?.role.shellSegment ?? 'student';
          return CommonScreenSurface(
            children: [
              const CommonSectionTitle(title: 'Experience'),
              CommonCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    KSSettingsItem(
                      title: 'Theme',
                      subtitle: 'Cycle between system, light, and dark modes',
                      iconAsset: 'assets/icons/device-phone.svg',
                      iconColor: AppColors.accentIndigo,
                      value: switch (themeMode) {
                        ThemeMode.light => 'Light',
                        ThemeMode.dark => 'Dark',
                        _ => 'System',
                      },
                      onTap: () async {
                        final next = switch (themeMode) {
                          ThemeMode.system => ThemeMode.light,
                          ThemeMode.light => ThemeMode.dark,
                          ThemeMode.dark => ThemeMode.system,
                        };
                        await ref
                            .read(themeModeControllerProvider.notifier)
                            .setThemeMode(next);
                      },
                    ),
                    KSSettingsItem(
                      title: 'Notification Preferences',
                      subtitle: 'Choose alerts and delivery channels',
                      iconAsset: 'assets/icons/bell.svg',
                      iconColor: AppColors.accentAmber,
                      onTap: () => context.go(
                        '/shell/$segment/notification-preferences',
                      ),
                    ),
                    KSSettingsItem(
                      title: 'Search',
                      subtitle: 'Find pages, students, updates, and shortcuts',
                      iconAsset: 'assets/icons/search.svg',
                      iconColor: AppColors.skyBlue600,
                      showDivider: false,
                      onTap: () => context.go('/shell/$segment/search'),
                    ),
                  ],
                ),
              ),
              const CommonSectionTitle(title: 'Account'),
              CommonCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    KSSettingsItem(
                      title: 'Edit Profile',
                      subtitle: 'Manage profile and contact details',
                      iconAsset: 'assets/icons/edit-pencil.svg',
                      iconColor: AppColors.accentTeal,
                      onTap: () => context.go('/shell/$segment/edit-profile'),
                    ),
                    KSSettingsItem(
                      title: 'Change Password',
                      subtitle: 'Update your login credentials',
                      iconAsset: 'assets/icons/lock.svg',
                      iconColor: AppColors.accentRose,
                      onTap: () =>
                          context.go('/shell/$segment/change-password'),
                    ),
                    KSSettingsItem(
                      title: 'About Kilimanjaro',
                      subtitle: 'Version, platform, and support details',
                      iconAsset: 'assets/icons/info-circle.svg',
                      iconColor: AppColors.skyBlue500,
                      showDivider: false,
                      onTap: () => context.go('/shell/$segment/about'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Could not load settings',
          subtitle: 'Something went wrong.',
        ),
      ),
    );
  }
}
