import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';
import '../../models/child_summary_model.dart';
import '../../models/performance_snapshot_model.dart';
import '../../widgets/common/ks_alert_card.dart';
import '../../widgets/common/ks_announcement_card.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ParentHomeScreen extends ConsumerWidget {
  const ParentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider).value;
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];
    final activeChildId = ref.watch(activeParentChildIdProvider);
    final activeChildAsync = ref.watch(activeParentChildProvider);
    final activeChild = activeChildAsync.value;

    return Scaffold(
      appBar: KSAppBar(
        title: activeChild != null
            ? 'Hi ${user?.name.split(' ').first ?? 'Parent'}'
            : 'Parent Home',
        subtitle: activeChild != null
            ? '${activeChild.firstName} · ${activeChild.classLabel}'
            : 'Loading your children…',
        variant: KSAppBarVariant.hero,
        showBack: false,
        actions: [
          if (activeChild != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: _ScoreBubble(
                score: activeChild.overallScore,
                grade: activeChild.overallGrade,
              ),
            ),
          IconButton(
            onPressed: () => context.go('/shell/parent/notifications'),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(activeParentChildProvider);
          ref.invalidate(parentWeeklyAttendanceProvider);
          ref.invalidate(parentAnnouncementsProvider);
        },
        child: Column(
        children: [
          if (children.length > 1)
            KSChildSwitcher(
              children: children,
              activeChildId: activeChildId,
              onSwitch: (childId) {
                if (childId != activeChildId) {
                  ref.read(activeParentChildIdProvider.notifier).state =
                      childId;
                }
              },
            ),
          Expanded(
            child: activeChildAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KSShimmerList(itemCount: 6),
              ),
              error: (error, stack) => const KSEmptyState(
                title: 'Something went wrong',
                subtitle: 'We couldn\'t load your data. Pull down to refresh.',
              ),
              data: (child) {
                if (child == null) {
                  return const KSEmptyState(
                    title: 'Child profile missing',
                    subtitle: 'Parent home could not load the active child.',
                  );
                }
                return _ParentHomeContent(
                  key: ValueKey(child.id),
                  child: child,
                );
              },
            ),
          ),
        ],
        ),
      ),
    );
  }
}


class _ParentHomeContent extends ConsumerWidget {
  const _ParentHomeContent({super.key, required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts =
        ref.watch(activeParentAlertsProvider).value ??
        const <PerformanceAlertModel>[];
    final weekly =
        ref.watch(parentWeeklyAttendanceProvider).value ??
        const <ParentWeekDayStatus>[];
    final announcements =
        ref.watch(parentAnnouncementsProvider).value ?? const [];
    final secondChild = ref.watch(parentSecondChildProvider).value;
    final activeAlert = alerts
        .where(
          (item) =>
              !item.isResolved && item.severity != PerformanceAlertSeverity.low,
        )
        .firstOrNull;
    final positiveAlert = alerts
        .where((item) => item.type == PerformanceAlertType.consistentExcellence)
        .firstOrNull;
    final attendedWeek = weekly
        .where((item) => item.status == AttendanceStatus.present)
        .length;
    final schoolDaysThisWeek = weekly
        .where((item) => item.date.weekday <= DateTime.friday && !item.isFuture)
        .length;

    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 280),
      transitionBuilder: (child, animation) {
        return FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween(
              begin: const Offset(0, 0.025),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        );
      },
      child: ParentSurface(
        key: ValueKey('home-${child.id}'),
        children: [
          _MetricGrid(child: child),
          if (activeAlert != null)
            _AttentionBanner(
              child: child,
              alert: activeAlert,
              onTap: () => context.push('/parent/performance'),
            ),
          if (secondChild != null)
            _SecondChildGlance(
              child: secondChild,
              onTap: () {
                ref.read(activeParentChildIdProvider.notifier).state =
                    secondChild.id;
              },
            ),
          if (positiveAlert != null) ...[
            const ParentSectionTitle(title: 'Good News'),
            KSAlertCard(
              alertType: positiveAlert.type,
              severity: positiveAlert.severity,
              subjectName: positiveAlert.subjectName,
              studentName: child.firstName,
              isPositive: true,
              onTap: () => context.push('/parent/performance/trends'),
              messageOverride:
                  '${child.firstName} is consistently excelling in ${positiveAlert.subjectName} - keep encouraging this progress.',
            ),
          ],
          ParentSectionTitle(
            title: "This Week's Attendance",
            action: 'View full',
            onAction: () => context.go('/shell/parent/attendance'),
          ),
          ParentCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: weekly.map((item) => _WeekBox(item: item)).toList(),
                ),
                const SizedBox(height: 12),
                Text(
                  '${child.firstName} attended $attendedWeek of $schoolDaysThisWeek school days this week.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
          ),
          ParentSectionTitle(
            title: 'Announcements',
            action: 'See all',
            onAction: () => context.push('/parent/announcements'),
          ),
          ...announcements
              .take(2)
              .map(
                (item) => KSAnnouncementCard(
                  announcement: item,
                  onTap: () => context.push('/parent/announcements/${item.id}'),
                ),
              ),
          const ParentSectionTitle(title: 'Quick Access'),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.42,
            children: [
              _ActionTile(
                label: 'Academics',
                icon: Icons.school_rounded,
                color: AppColors.skyBlue500,
                onTap: () => context.go('/shell/parent/academics'),
              ),
              _ActionTile(
                label: 'Attendance',
                icon: Icons.calendar_month_rounded,
                color: AppColors.accentEmerald,
                onTap: () => context.go('/shell/parent/attendance'),
              ),
              _ActionTile(
                label: 'Fees',
                icon: Icons.payments_rounded,
                color: AppColors.accentAmber,
                onTap: () => context.go('/shell/parent/finance'),
              ),
              _ActionTile(
                label: 'Contact',
                icon: Icons.phone_rounded,
                color: AppColors.accentTeal,
                onTap: () => context.push('/parent/contact'),
              ),
            ].animate(interval: 40.ms).fadeIn().scaleXY(begin: 0.96, end: 1),
          ),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.child});

  final ChildSummary child;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      child: GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.9,
        children: [
          ParentMetricTile(
            label: 'Average',
            value: '${child.overallScore.toStringAsFixed(1)}%',
            iconAsset: 'assets/icons/chart-line.svg',
            color: AppColors.skyBlue600,
          ),
          ParentMetricTile(
            label: 'Attendance',
            value: '${child.attendanceRate.toStringAsFixed(1)}%',
            iconAsset: 'assets/icons/calendar-check.svg',
            color: AppColors.accentEmerald,
          ),
          ParentMetricTile(
            label: 'Balance',
            value: child.isFullyPaid
                ? 'Paid'
                : formatParentShortTzs(child.outstandingBalance),
            iconAsset: 'assets/icons/banknotes.svg',
            color: child.isFullyPaid
                ? AppColors.accentTeal
                : AppColors.accentAmber,
          ),
        ],
      ),
    );
  }
}

class _AttentionBanner extends StatelessWidget {
  const _AttentionBanner({
    required this.child,
    required this.alert,
    required this.onTap,
  });

  final ChildSummary child;
  final PerformanceAlertModel alert;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      padding: EdgeInsets.zero,
      onTap: onTap,
      child: IntrinsicHeight(
        child: Row(
          children: [
            Container(
              width: 5,
              decoration: BoxDecoration(
                color: _color,
                borderRadius: BorderRadius.circular(99),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: _color),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Needs Your Attention',
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${child.firstName} may need extra help with ${alert.subjectName} this term.',
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'A study partner has been arranged.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(color: AppColors.accentIndigo),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right_rounded),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color get _color => alert.severity == PerformanceAlertSeverity.critical
      ? AppColors.accentRose
      : AppColors.accentAmber;
}

class _SecondChildGlance extends StatelessWidget {
  const _SecondChildGlance({required this.child, required this.onTap});

  final ChildSummary child;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ParentSectionTitle(title: "${child.firstName}'s Overview"),
        ParentCard(
          onTap: onTap,
          child: Row(
            children: [
              KSAvatar(name: child.name, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${child.name} - ${child.classLabel}',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Wrap(
                      spacing: 9,
                      runSpacing: 5,
                      children: [
                        Text('${child.overallScore.toStringAsFixed(1)}% Avg'),
                        Text(
                          '${child.attendanceRate.toStringAsFixed(0)}% Attendance',
                          style: const TextStyle(
                            color: AppColors.accentEmerald,
                          ),
                        ),
                        Text(
                          child.isFullyPaid ? 'Fees: PAID' : 'Fees: Due',
                          style: TextStyle(
                            color: child.isFullyPaid
                                ? AppColors.accentEmerald
                                : AppColors.accentAmber,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.swap_horiz_rounded, color: AppColors.skyBlue600),
            ],
          ),
        ),
      ],
    );
  }
}

class _WeekBox extends StatelessWidget {
  const _WeekBox({required this.item});

  final ParentWeekDayStatus item;

  @override
  Widget build(BuildContext context) {
    final today = DateTime(2026, 3, 21);
    final isToday =
        item.date.day == today.day &&
        item.date.month == today.month &&
        item.date.year == today.year;
    final label = [
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ][item.date.weekday - 1];
    final color = switch (item.status) {
      AttendanceStatus.present => AppColors.accentEmerald,
      AttendanceStatus.absent => AppColors.accentRose,
      AttendanceStatus.late => AppColors.accentAmber,
      _ => AppColors.textMuted,
    };

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      width: 40,
      height: 50,
      decoration: BoxDecoration(
        color: isToday ? AppColors.skyBlue50 : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isToday ? AppColors.skyBlue500 : AppColors.border,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontSize: 10),
          ),
          const SizedBox(height: 7),
          if (item.isFuture || item.status == null)
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: color),
              ),
            )
          else if (item.status == AttendanceStatus.absent)
            Icon(Icons.close_rounded, size: 13, color: color)
          else if (item.status == AttendanceStatus.late)
            Icon(Icons.access_time_rounded, size: 13, color: color)
          else
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
        ],
      ),
    );
  }
}

class _ScoreBubble extends StatelessWidget {
  const _ScoreBubble({required this.score, required this.grade});

  final double score;
  final String grade;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 62,
      height: 62,
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.16),
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.white.withValues(alpha: 0.26)),
      ),
      child: Center(
        child: Text(
          grade,
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            color: AppColors.white,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ParentCard(
      onTap: onTap,
      margin: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: color),
          ),
          const Spacer(),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
