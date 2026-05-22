import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/student/student_surface.dart';
import 'student_formatters.dart';

class AttendanceDetailScreen extends ConsumerWidget {
  const AttendanceDetailScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recordsAsync = ref.watch(studentAttendanceProvider);
    return Scaffold(
      body: recordsAsync.when(
        data: (records) => CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: StudentHeroHeader(
                kicker: 'ATTENDANCE LOG',
                title: '${records.length} school days',
                subtitle:
                    'Chronological attendance records from the current academic period.',
                trailing: IconButton.filledTonal(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList.separated(
                itemCount: records.length,
                separatorBuilder: (_, __) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final record = records[records.length - 1 - index];
                  final color = _statusColor(record.status);
                  return StudentSurface(
                    padding: const EdgeInsets.all(15),
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: color.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(
                              _statusIcon(record.status),
                              color: color,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  formatLongDate(record.date),
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                                const SizedBox(height: 3),
                                Text(
                                  record.status.name.toUpperCase(),
                                  style: Theme.of(context).textTheme.bodySmall
                                      ?.copyWith(
                                        color: color,
                                        fontWeight: FontWeight.w800,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
      ),
    );
  }

  Color _statusColor(AttendanceStatus status) => switch (status) {
    AttendanceStatus.present => AppColors.accentEmerald,
    AttendanceStatus.absent => AppColors.accentRose,
    AttendanceStatus.late => AppColors.accentAmber,
    AttendanceStatus.excused => AppColors.accentIndigo,
    AttendanceStatus.noSchool => AppColors.textMuted,
  };

  IconData _statusIcon(AttendanceStatus status) => switch (status) {
    AttendanceStatus.present => Icons.check_rounded,
    AttendanceStatus.absent => Icons.close_rounded,
    AttendanceStatus.late => Icons.schedule_rounded,
    AttendanceStatus.excused => Icons.event_available_rounded,
    AttendanceStatus.noSchool => Icons.event_busy_rounded,
  };
}
