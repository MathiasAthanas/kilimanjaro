import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';
import '../../models/child_summary_model.dart';
import '../../widgets/charts/ks_attendance_calendar.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_progress_ring.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ParentAttendanceOverviewScreen extends ConsumerWidget {
  const ParentAttendanceOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];
    final activeId = ref.watch(activeParentChildIdProvider);
    final child = ref.watch(activeParentChildProvider).value;
    final recordsAsync = ref.watch(activeParentAttendanceProvider);

    return Scaffold(
      appBar: KSAppBar(
        title: child != null ? "${child.firstName}'s Attendance" : 'Attendance',
        subtitle: child != null
            ? '${child.classLabel} · school attendance record'
            : null,
        variant: KSAppBarVariant.hero,
        showBack: false,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(activeParentAttendanceProvider),
        child: Column(
        children: [
          if (children.length > 1)
            KSChildSwitcher(
              children: children,
              activeChildId: activeId,
              onSwitch: (value) =>
                  ref.read(activeParentChildIdProvider.notifier).state = value,
            ),
          Expanded(
            child: recordsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(16),
                child: KSShimmerList(itemCount: 5),
              ),
              error: (error, stack) => const KSEmptyState(
                title: 'Something went wrong',
                subtitle: 'We couldn\'t load your data. Pull down to refresh.',
              ),
              data: (records) {
                final present = records
                    .where((item) => item.status == AttendanceStatus.present)
                    .length;
                final attendanceRate = records.isEmpty
                    ? 0.0
                    : present / records.length;
                final absences = records
                    .where((item) => item.status == AttendanceStatus.absent)
                    .take(3)
                    .toList();
                final currentMonth = DateTime(2026, 3);

                return ParentSurface(
                  children: [
                    ParentCard(
                      child: Column(
                        children: [
                          KSProgressRing(
                            value: attendanceRate,
                            color: attendanceRate >= 0.8
                                ? AppColors.accentEmerald
                                : AppColors.accentAmber,
                            size: 128,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            '${(attendanceRate * 100).toStringAsFixed(1)}%',
                            style: Theme.of(context).textTheme.headlineMedium
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            attendanceRate >= 0.8
                                ? 'Above the required 80% attendance level.'
                                : 'Below the required 80% attendance level.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: attendanceRate >= 0.8
                                  ? AppColors.accentEmerald
                                  : AppColors.accentAmber,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                    ParentSectionTitle(title: 'Absence Record'),
                    ParentCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (absences.isEmpty)
                            const Text('No recent absences recorded.')
                          else
                            ...absences.map(
                              (item) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 9,
                                      height: 9,
                                      decoration: const BoxDecoration(
                                        color: AppColors.accentRose,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        '${formatParentWeekdayDate(item.date)} - Absent',
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          const SizedBox(height: 8),
                          Text(
                            'You were notified by SMS on each absence day.',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(fontStyle: FontStyle.italic),
                          ),
                        ],
                      ),
                    ),
                    const ParentSectionTitle(title: 'Calendar'),
                    ParentCard(
                      child: KSAttendanceCalendar(
                        records: {
                          for (final item in records)
                            DateTime(
                              item.date.year,
                              item.date.month,
                              item.date.day,
                            ): item.status,
                        },
                        currentMonth: currentMonth,
                        onMonthChanged: (_) {},
                      ),
                    ),
                  ],
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
