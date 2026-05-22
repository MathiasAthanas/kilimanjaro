import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/charts/ks_attendance_calendar.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_progress_ring.dart';
import '../../widgets/student/student_surface.dart';
import 'student_formatters.dart';

class AttendanceOverviewScreen extends ConsumerWidget {
  const AttendanceOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recordsAsync = ref.watch(studentAttendanceProvider);
    final summary = ref.watch(attendanceSummaryProvider);
    final month = ref.watch(selectedAttendanceMonthProvider);
    final selectedDay = ref.watch(selectedAttendanceDateProvider);
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    return Scaffold(
      body: recordsAsync.when(
        data: (records) {
          final recordMap = {
            for (final item in records)
              DateTime(item.date.year, item.date.month, item.date.day):
                  item.status,
          };
          final total = summary.values.fold<int>(0, (sum, item) => sum + item);
          final present = summary[AttendanceStatus.present] ?? 0;
          final absent = summary[AttendanceStatus.absent] ?? 0;
          final late = summary[AttendanceStatus.late] ?? 0;
          final rate = total == 0 ? 0.0 : present / total;

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(studentAttendanceProvider),
            child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: StudentHeroHeader(
                  kicker: 'ATTENDANCE',
                  title: '${(rate * 100).toStringAsFixed(1)}% present',
                  subtitle:
                      '$present present days from $total recorded school days.',
                ),
              ),
              SliverPadding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
                sliver: SliverList.list(
                  children: [
                    StudentSurface(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: KSProgressRing(
                                value: rate,
                                color: AppColors.accentEmerald,
                                size: 116,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  KSChip(
                                    label: '$present Present',
                                    color: AppColors.accentEmerald,
                                  ),
                                  KSChip(
                                    label: '$absent Absent',
                                    color: AppColors.accentRose,
                                  ),
                                  KSChip(
                                    label: '$late Late',
                                    color: AppColors.accentAmber,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    StudentSurface(
                      children: [
                        Row(
                          children: [
                            IconButton(
                              onPressed: () =>
                                  ref
                                      .read(
                                        selectedAttendanceMonthProvider
                                            .notifier,
                                      )
                                      .state = DateTime(
                                    month.year,
                                    month.month - 1,
                                  ),
                              icon: const Icon(Icons.chevron_left_rounded),
                            ),
                            Expanded(
                              child: Text(
                                formatMonthYear(month),
                                textAlign: TextAlign.center,
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                            IconButton(
                              onPressed: () =>
                                  ref
                                      .read(
                                        selectedAttendanceMonthProvider
                                            .notifier,
                                      )
                                      .state = DateTime(
                                    month.year,
                                    month.month + 1,
                                  ),
                              icon: const Icon(Icons.chevron_right_rounded),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        KSAttendanceCalendar(
                          records: recordMap,
                          currentMonth: month,
                          selectedDay: selectedDay,
                          onMonthChanged: (value) =>
                              ref
                                      .read(
                                        selectedAttendanceMonthProvider
                                            .notifier,
                                      )
                                      .state =
                                  value,
                          onDaySelected: (value) =>
                              ref
                                      .read(
                                        selectedAttendanceDateProvider.notifier,
                                      )
                                      .state =
                                  value,
                        ),
                      ],
                    ),
                    if (selectedDay != null) ...[
                      const SizedBox(height: 14),
                      StudentSurface(
                        padding: const EdgeInsets.all(16),
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 12,
                                height: 12,
                                decoration: BoxDecoration(
                                  color: _statusColor(
                                    recordMap[DateTime(
                                      selectedDay.year,
                                      selectedDay.month,
                                      selectedDay.day,
                                    )],
                                  ),
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  '${formatLongDate(selectedDay)}: ${_statusLabel(recordMap[DateTime(selectedDay.year, selectedDay.month, selectedDay.day)])}',
                                  style: Theme.of(context).textTheme.bodyMedium,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: () =>
                          context.push('/shell/student/attendance/detail'),
                      icon: const Icon(Icons.list_alt_rounded),
                      label: const Text('Open Attendance Details'),
                    ),
                  ],
                ),
              ),
            ],
            ),
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

  String _statusLabel(AttendanceStatus? status) => switch (status) {
    AttendanceStatus.present => 'Present',
    AttendanceStatus.absent => 'Absent',
    AttendanceStatus.late => 'Late',
    AttendanceStatus.excused => 'Excused',
    AttendanceStatus.noSchool => 'No School',
    null => 'No record',
  };

  Color _statusColor(AttendanceStatus? status) => switch (status) {
    AttendanceStatus.present => AppColors.accentEmerald,
    AttendanceStatus.absent => AppColors.accentRose,
    AttendanceStatus.late => AppColors.accentAmber,
    AttendanceStatus.excused => AppColors.accentIndigo,
    AttendanceStatus.noSchool => AppColors.textMuted,
    null => AppColors.textMuted,
  };
}
