import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/providers/notification_provider.dart';
import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/attendance_record_model.dart';
import '../../widgets/common/ks_announcement_card.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_grade_display.dart';
import '../../widgets/common/ks_rank_badge.dart';
import '../../widgets/common/ks_section_header.dart';
import '../../widgets/common/ks_subject_card.dart';
import '../../widgets/student/student_surface.dart';

class StudentHomeScreen extends ConsumerWidget {
  const StudentHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;
    final currentTerm = ref.watch(currentStudentTermProvider);
    final alert = ref.watch(primaryStudentAlertProvider);
    final attendanceSummary = ref.watch(attendanceSummaryProvider);
    final invoice = ref.watch(currentInvoiceProvider).value;
    final announcements = ref.watch(announcementsProvider).value ?? const [];
    final highlightedSubjects = ref
        .watch(sortedCurrentSubjectsProvider)
        .take(3)
        .toList();
    final user = ref.watch(currentUserProvider).value;
    final totalAttendance = attendanceSummary.values.fold<int>(
      0,
      (sum, item) => sum + item,
    );
    final present = attendanceSummary[AttendanceStatus.present] ?? 0;
    final attendanceRate = totalAttendance == 0
        ? 0.0
        : present / totalAttendance;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(currentStudentTermProvider);
          ref.invalidate(attendanceSummaryProvider);
          ref.invalidate(currentInvoiceProvider);
          ref.invalidate(announcementsProvider);
        },
        child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: StudentHeroHeader(
              kicker: 'STUDENT PORTAL',
              title: 'Hello, ${user?.name.split(' ').first ?? 'Amina'}',
              subtitle:
                  'Your academic, attendance, finance, and school updates in one focused view.',
              trailing: IconButton.filledTonal(
                onPressed: () => context.go('/shell/student/notifications'),
                icon: const Icon(Icons.notifications_rounded),
              ),
            ),
          ),
          SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
            sliver: SliverList.list(
              children: [
                _StudentSummaryCard(
                  termLabel: currentTerm == null
                      ? 'Current term'
                      : '${currentTerm.label} ${currentTerm.academicYear}',
                  score: currentTerm?.overallScore,
                  grade: currentTerm?.overallGrade ?? 'A',
                  rank: currentTerm?.rank ?? 1,
                  totalStudents: currentTerm?.totalStudents ?? 1,
                  outstanding: invoice?.outstandingAmount,
                ),
                const SizedBox(height: 16),
                _MetricGrid(
                  attendanceRate: attendanceRate,
                  score: currentTerm?.overallScore,
                  outstanding: invoice?.outstandingAmount,
                  onResults: () => context.go('/shell/student/results'),
                  onAttendance: () => context.go('/shell/student/attendance'),
                  onFinance: () => context.go('/shell/student/finance'),
                ),
                const SizedBox(height: 18),
                if (alert != null) ...[
                  _AttentionCard(alert: alert),
                  const SizedBox(height: 18),
                ],
                const SizedBox(height: 22),
                KSSectionHeader(
                  title: 'Current Term Subjects',
                  action: 'View Results',
                  onAction: () => context.go('/shell/student/results'),
                ),
                const SizedBox(height: 10),
                ...highlightedSubjects.map(
                  (subject) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: KSSubjectCard(
                      subject: subject,
                      compact: true,
                      onTap: () => context.push(
                        '/student/results/subject/${subject.id}',
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                KSSectionHeader(
                  title: 'Announcements',
                  action: 'See All',
                  onAction: () => context.go('/shell/student/announcements'),
                ),
                const SizedBox(height: 10),
                ...announcements
                    .take(2)
                    .map(
                      (item) => KSAnnouncementCard(
                        announcement: item,
                        onTap: () =>
                            context.push('/student/announcements/${item.id}'),
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
class _StudentSummaryCard extends StatelessWidget {
  const _StudentSummaryCard({
    required this.termLabel,
    required this.score,
    required this.grade,
    required this.rank,
    required this.totalStudents,
    required this.outstanding,
  });

  final String termLabel;
  final double? score;
  final String grade;
  final int rank;
  final int totalStudents;
  final double? outstanding;

  @override
  Widget build(BuildContext context) {
    return StudentSurface(
      children: [
        Row(
          children: [
            KSGradeDisplay(
              grade: grade,
              size: GradeDisplaySize.small,
              showLabel: false,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    termLabel,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${score?.toStringAsFixed(1) ?? '--'}% overall performance',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
            KSRankBadge(rank: rank, total: totalStudents),
          ],
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.account_balance_wallet_rounded,
                color: AppColors.accentAmber,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Outstanding balance',
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Text(
                outstanding == null
                    ? '--'
                    : 'TZS ${NumberFormat('#,###').format(outstanding)}',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(color: AppColors.accentAmber),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({
    required this.attendanceRate,
    required this.score,
    required this.outstanding,
    required this.onResults,
    required this.onAttendance,
    required this.onFinance,
  });

  final double attendanceRate;
  final double? score;
  final double? outstanding;
  final VoidCallback onResults;
  final VoidCallback onAttendance;
  final VoidCallback onFinance;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth > 560;
        final tiles = [
          StudentMetricTile(
            label: 'Academic Avg',
            value: '${score?.toStringAsFixed(1) ?? '--'}%',
            subtitle: 'Current term',
            icon: Icons.analytics_rounded,
            color: AppColors.skyBlue600,
            onTap: onResults,
          ),
          StudentMetricTile(
            label: 'Attendance',
            value: '${(attendanceRate * 100).toStringAsFixed(1)}%',
            subtitle: 'Present days',
            icon: Icons.calendar_month_rounded,
            color: AppColors.accentEmerald,
            onTap: onAttendance,
          ),
          StudentMetricTile(
            label: 'Finance',
            value: outstanding == null ? '--' : _compactMoney(outstanding!),
            subtitle: 'Outstanding',
            icon: Icons.receipt_long_rounded,
            color: AppColors.accentAmber,
            onTap: onFinance,
          ),
        ];

        if (wide) {
          return Row(
            children: [
              for (var i = 0; i < tiles.length; i++) ...[
                if (i > 0) const SizedBox(width: 12),
                Expanded(child: tiles[i]),
              ],
            ],
          );
        }

        return Column(
          children: [
            Row(
              children: [
                Expanded(child: tiles[0]),
                const SizedBox(width: 12),
                Expanded(child: tiles[1]),
              ],
            ),
            const SizedBox(height: 12),
            tiles[2],
          ],
        );
      },
    );
  }

  static String _compactMoney(double value) {
    if (value >= 1000000) return 'TZS ${(value / 1000000).toStringAsFixed(1)}M';
    if (value >= 1000) return 'TZS ${(value / 1000).toStringAsFixed(0)}K';
    return 'TZS ${value.toStringAsFixed(0)}';
  }
}

class _AttentionCard extends StatelessWidget {
  const _AttentionCard({required this.alert});

  final dynamic alert;

  @override
  Widget build(BuildContext context) {
    final critical =
        '${alert.severity}'.contains('critical') ||
        '${alert.type}'.contains('atRisk');
    final color = critical ? AppColors.accentRose : AppColors.accentEmerald;

    return StudentSurface(
      color: color.withValues(alpha: 0.10),
      children: [
        Row(
          children: [
            KSChip(
              label: critical ? 'NEEDS ATTENTION' : 'GOOD PROGRESS',
              color: color,
            ),
            const Spacer(),
            Icon(Icons.chevron_right_rounded, color: color),
          ],
        ),
        const SizedBox(height: 12),
        Text(alert.title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(
          alert.message,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.45),
        ),
      ],
    );
  }
}
