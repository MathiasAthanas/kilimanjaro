import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';
import '../../models/auth_user.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_settings_item.dart';
import '../../widgets/common/ks_shimmer_list.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userAsync = ref.watch(currentUserProvider);
    final unread = ref.watch(unreadCountProvider);

    final user = userAsync.value;

    return Scaffold(
      appBar: KSAppBar(
        title: user?.name ?? 'My Profile',
        subtitle: user != null ? _profileSubtitle(user) : 'Loading your profile…',
        variant: KSAppBarVariant.hero,
        showBack: false,
      ),
      body: userAsync.when(
        data: (user) {
          if (user == null) return const SizedBox.shrink();
          return CommonScreenSurface(
            children: [
              _ProfileStats(user: user, unread: unread),
              const CommonSectionTitle(
                title: 'Identity',
                subtitle: 'Information currently available for this account.',
              ),
              CommonCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    KSSettingsItem(
                      title: 'Email Address',
                      subtitle: user.email ?? 'Not set',
                      iconAsset: 'assets/icons/mail.svg',
                      iconColor: AppColors.accentIndigo,
                      showChevron: false,
                    ),
                    KSSettingsItem(
                      title: 'Phone Number',
                      subtitle: user.phone ?? 'Not set',
                      iconAsset: 'assets/icons/phone.svg',
                      iconColor: AppColors.accentEmerald,
                      showChevron: false,
                    ),
                    KSSettingsItem(
                      title: 'Registration Number',
                      subtitle:
                          user.registrationNumber ??
                          'Not required for this role',
                      iconAsset: 'assets/icons/school.svg',
                      iconColor: AppColors.skyBlue600,
                      showChevron: false,
                      showDivider: false,
                    ),
                  ],
                ),
              ),
              const CommonSectionTitle(title: 'Account Actions'),
              CommonCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    KSSettingsItem(
                      title: 'Edit Profile',
                      subtitle: 'Update contact details and bio',
                      iconAsset: 'assets/icons/edit-pencil.svg',
                      iconColor: AppColors.skyBlue600,
                      onTap: () => context.go(
                        '/shell/${user.role.shellSegment}/edit-profile',
                      ),
                    ),
                    KSSettingsItem(
                      title: 'Change Password',
                      subtitle: 'Keep this account protected',
                      iconAsset: 'assets/icons/lock.svg',
                      iconColor: AppColors.accentAmber,
                      onTap: () => context.go(
                        '/shell/${user.role.shellSegment}/change-password',
                      ),
                    ),
                    KSSettingsItem(
                      title: 'App Settings',
                      subtitle: 'Appearance, notifications and support',
                      iconAsset: 'assets/icons/settings.svg',
                      iconColor: AppColors.accentTeal,
                      showDivider: false,
                      onTap: () => context.go(
                        '/shell/${user.role.shellSegment}/settings',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Could not load profile',
          subtitle: 'Something went wrong. Please go back and try again.',
        ),
      ),
    );
  }

  String _profileSubtitle(AuthUser user) {
    final joined = user.joinedAt == null
        ? null
        : DateFormat('MMMM yyyy').format(user.joinedAt!);
    return joined == null
        ? '${user.role.label} account'
        : '${user.role.label} account since $joined';
  }
}

class _ProfileStats extends ConsumerWidget {
  const _ProfileStats({required this.user, required this.unread});

  final AuthUser user;
  final int unread;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final studentMetrics = user.role == UserRole.student
        ? _studentMetrics(ref)
        : <Widget>[];
    final joined = user.joinedAt == null
        ? 'Active'
        : DateFormat('MMM yyyy').format(user.joinedAt!);

    return CommonCard(
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 1.35,
        children: [
          CommonMetricPill(
            label: 'Joined',
            value: joined,
            iconAsset: 'assets/icons/user-circle.svg',
            color: AppColors.accentIndigo,
          ),
          CommonMetricPill(
            label: 'Unread',
            value: '$unread',
            iconAsset: 'assets/icons/bell.svg',
            color: AppColors.accentAmber,
          ),
          ...studentMetrics,
        ],
      ),
    );
  }

  List<Widget> _studentMetrics(WidgetRef ref) {
    final term = ref.watch(currentStudentTermProvider);
    final attendance = ref.watch(attendanceSummaryProvider);
    final invoice = ref.watch(currentInvoiceProvider).value;
    final totalAttendance = attendance.values.fold<int>(
      0,
      (sum, value) => sum + value,
    );
    final present = attendance[AttendanceStatus.present] ?? 0;
    final attendanceRate = totalAttendance == 0
        ? 0
        : (present / totalAttendance * 100).round();

    return [
      CommonMetricPill(
        label: 'Current Grade',
        value: term?.overallGrade ?? '--',
        iconAsset: 'assets/icons/graduation-cap.svg',
        color: AppColors.accentEmerald,
      ),
      CommonMetricPill(
        label: 'Fee Balance',
        value: invoice == null
            ? '--'
            : NumberFormat.compactCurrency(
                symbol: 'TZS ',
              ).format(invoice.outstandingAmount),
        iconAsset: 'assets/icons/banknotes.svg',
        color: invoice != null && invoice.outstandingAmount > 0
            ? AppColors.accentRose
            : AppColors.accentTeal,
      ),
      CommonMetricPill(
        label: 'Attendance',
        value: '$attendanceRate%',
        iconAsset: 'assets/icons/calendar-check.svg',
        color: AppColors.skyBlue600,
      ),
      CommonMetricPill(
        label: 'Average',
        value: term == null ? '--' : '${term.overallScore.toStringAsFixed(1)}%',
        iconAsset: 'assets/icons/chart-line.svg',
        color: AppColors.accentViolet,
      ),
    ];
  }
}
