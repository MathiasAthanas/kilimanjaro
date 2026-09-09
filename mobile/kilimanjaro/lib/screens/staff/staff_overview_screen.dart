import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/auth_provider.dart';
import '../../core/services/api/api_staff_metrics_service.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';

final _staffMetricsServiceProvider = Provider<ApiStaffMetricsService>((ref) {
  return ApiStaffMetricsService(const FlutterSecureStorage());
});

final staffMetricsProvider =
    FutureProvider.family<List<StaffMetric>, UserRole>((ref, role) {
  return ref.watch(_staffMetricsServiceProvider).getMetrics(role);
});

/// Minimal authenticated landing for web-primary roles (Principal, AQA,
/// Finance, System Admin): a read-only pulse of their key numbers plus
/// shortcuts to notifications and profile. The full workspace lives on web.
class StaffOverviewScreen extends ConsumerWidget {
  const StaffOverviewScreen({super.key, required this.role});

  final UserRole role;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metricsAsync = ref.watch(staffMetricsProvider(role));
    final authState = ref.watch(authControllerProvider);
    final userName =
        authState is AuthAuthenticated ? authState.user.name : role.label;
    final segment = role.shellSegment;

    return Scaffold(
      appBar: KSAppBar(
        title: role.label,
        subtitle: 'Welcome back, $userName.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(staffMetricsProvider(role)),
        child: CommonScreenSurface(
          children: [
            metricsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const KSEmptyState(
                title: 'Could not load your summary',
                subtitle: 'Check your connection and pull to refresh.',
              ),
              data: (metrics) => Column(
                children: metrics
                    .map(
                      (metric) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: CommonCard(
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(metric.label,
                                        style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color:
                                                AppColors.textSecondary)),
                                    if (metric.detail != null)
                                      Text(metric.detail!,
                                          style: TextStyle(
                                              fontSize: 11,
                                              color:
                                                  AppColors.textSecondary)),
                                  ],
                                ),
                              ),
                              Text(metric.value,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleLarge
                                      ?.copyWith(
                                          fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 8),
            GestureDetector(
              onTap: () => context.go('/shell/$segment/notifications'),
              child: const CommonCard(
                child: _ShortcutRow(
                  icon: Icons.notifications_rounded,
                  title: 'Notifications',
                  subtitle: 'School events, approvals and alerts.',
                ),
              ),
            ),
            const SizedBox(height: 10),
            GestureDetector(
              onTap: () => context.go('/shell/$segment/profile'),
              child: const CommonCard(
                child: _ShortcutRow(
                  icon: Icons.person_rounded,
                  title: 'My Profile',
                  subtitle: 'Account details and security.',
                ),
              ),
            ),
            const SizedBox(height: 16),
            CommonCard(
              child: Row(
                children: [
                  const Icon(Icons.laptop_mac_rounded,
                      size: 22, color: AppColors.skyBlue600),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Your full ${role.label} workspace — approvals, analytics and reports — lives in the Kilimanjaro web dashboard.',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ShortcutRow extends StatelessWidget {
  const _ShortcutRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: AppColors.skyBlue600.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: AppColors.skyBlue600, size: 22),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              Text(subtitle,
                  style: TextStyle(
                      fontSize: 12, color: AppColors.textSecondary)),
            ],
          ),
        ),
        const Icon(Icons.chevron_right_rounded,
            color: AppColors.textSecondary),
      ],
    );
  }
}
