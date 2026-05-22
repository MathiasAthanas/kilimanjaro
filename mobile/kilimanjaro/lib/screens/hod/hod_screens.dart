import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/hod_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/hod_models.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/hod/hod_surface.dart';

class HodHomeScreen extends ConsumerWidget {
  const HodHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref.watch(hodPendingApprovalsProvider);
    final subjects = ref.watch(hodSubjectsProvider);
    final teachers = ref.watch(hodTeachersProvider);
    final alerts = ref.watch(hodAlertsProvider);
    final atRisk = subjects.fold<int>(
      0,
      (total, subject) => total + subject.atRiskStudents,
    );

    return Scaffold(
      appBar: KSAppBar(
        title: 'Department Command',
        subtitle: 'Approvals, performance, staff coverage, and risk.',
        showBack: false,
        variant: KSAppBarVariant.hero,
        actions: [_HeroCount(label: 'Pending', count: pending.length)],
      ),
      body: HodSurface(
        children: [
          HodInsightCard(
            title: pending.isEmpty
                ? 'Approval queue is clear'
                : '${pending.length} assessments need HOD decision',
            subtitle: pending.isEmpty
                ? 'No teacher submission is waiting for publishing approval.'
                : 'Oldest submission is ${pending.last.submittedAgo}; review it first before results are released.',
            icon: pending.isEmpty
                ? Icons.verified_rounded
                : Icons.assignment_late_rounded,
            color: pending.isEmpty
                ? AppColors.accentEmerald
                : AppColors.accentRose,
            onTap: () => context.go('/shell/hod/approvals'),
          ),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.22,
            children: [
              _MetricTile(
                label: 'Subjects',
                value: '${subjects.length}',
                icon: Icons.science_rounded,
                color: AppColors.skyBlue600,
              ),
              _MetricTile(
                label: 'Teachers',
                value: '${teachers.length}',
                icon: Icons.groups_2_rounded,
                color: AppColors.accentTeal,
              ),
              _MetricTile(
                label: 'At Risk',
                value: '$atRisk',
                icon: Icons.warning_amber_rounded,
                color: AppColors.accentRose,
              ),
              _MetricTile(
                label: 'Alerts',
                value: '${alerts.length}',
                icon: Icons.trending_down_rounded,
                color: AppColors.accentAmber,
              ),
            ],
          ),
          HodSectionTitle(
            title: 'Approval Queue',
            action: 'Open',
            onAction: () => context.go('/shell/hod/approvals'),
          ),
          if (pending.isEmpty)
            HodCard(
              child: _IconTextRow(
                icon: Icons.verified_rounded,
                color: AppColors.accentEmerald,
                title: 'No pending submissions',
                subtitle: 'All assessment marks are currently processed.',
              ),
            )
          else
            ...pending.take(2).map((item) => _ApprovalQueueCard(item: item)),
          HodSectionTitle(
            title: 'Subject Health',
            action: 'Analytics',
            onAction: () => context.go('/shell/hod/department'),
          ),
          ...subjects.map(
            (subject) => _SubjectCard(
              subject: subject,
              onTap: () =>
                  context.push('/hod/department/subject/${subject.id}'),
            ),
          ),
          HodSectionTitle(
            title: 'Staff Snapshot',
            action: 'Teachers',
            onAction: () => context.push('/hod/teachers'),
          ),
          ...teachers
              .take(3)
              .map(
                (teacher) => _TeacherCard(
                  teacher: teacher,
                  onTap: () => context.push('/hod/teachers/${teacher.id}'),
                ),
              ),
        ],
      ),
    );
  }
}

class PendingApprovalsScreen extends ConsumerWidget {
  const PendingApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(hodPendingApprovalsProvider);
    return Scaffold(
      appBar: KSAppBar(
        title: 'Marks Approval',
        subtitle: 'Review submitted assessments before publishing to students and parents.',
        showBack: false,
        variant: KSAppBarVariant.hero,
        actions: [
          _HeroCount(label: 'Queue', count: items.length),
          IconButton(
            onPressed: () => context.push('/hod/approvals/history'),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      body: HodSurface(
        children: items.isEmpty
            ? [
                HodCard(
                  child: _IconTextRow(
                    icon: Icons.done_all_rounded,
                    color: AppColors.accentEmerald,
                    title: 'Queue clear',
                    subtitle: 'No teacher submissions are waiting for review.',
                  ),
                ),
              ]
            : items
                  .map(
                    (item) =>
                        _ApprovalQueueCard(item: item, showQuickAction: true),
                  )
                  .toList(),
      ),
    );
  }
}

class MarksReviewApprovalScreen extends ConsumerWidget {
  const MarksReviewApprovalScreen({super.key, required this.assessmentId});

  final String assessmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final item = ref.watch(hodApprovalByIdProvider(assessmentId));
    if (item == null) {
      return const Scaffold(body: KSEmptyState(title: 'Assessment not found'));
    }
    final rows = _sampleRowsFor(item);
    return Scaffold(
      appBar: KSAppBar(
        title: '${item.classLabel} ${item.assessmentType}',
        subtitle: '${item.teacherName} · ${item.studentCount} students · submitted ${item.submittedAgo}.',
        variant: KSAppBarVariant.hero,
        actions: [_HeroCount(label: 'Avg', count: item.averagePercent.round())],
      ),
      body: HodSurface(
        children: [
          _MarksReviewPanel(item: item),
          if (item.averagePercent < 55)
            HodCard(
              child: _IconTextRow(
                icon: Icons.priority_high_rounded,
                color: AppColors.accentRose,
                title: 'Review required',
                subtitle:
                    'The class average is below threshold. Confirm outliers before approval.',
              ),
            ),
          const HodSectionTitle(title: 'Sample Mark Rows'),
          ...rows.map((row) => _MarkRow(row: row, maxScore: item.maxScore)),
          _ApprovalActions(item: item),
        ],
      ),
    );
  }
}

class ApprovalHistoryScreen extends ConsumerWidget {
  const ApprovalHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(hodApprovalHistoryProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Processed Submissions',
        subtitle: 'Approved and rejected assessments with audit context.',
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: history
            .map(
              (item) => HodCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            '${item.subject} ${item.classLabel}',
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(fontWeight: FontWeight.w900),
                          ),
                        ),
                        HodPill(
                          label: item.status.name.toUpperCase(),
                          color: item.status == HodApprovalStatus.approved
                              ? AppColors.accentEmerald
                              : AppColors.accentRose,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('${item.assessmentType} - ${item.teacherName}'),
                    if (item.rejectionReason != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        item.rejectionReason!,
                        style: const TextStyle(color: AppColors.accentRose),
                      ),
                    ],
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class DepartmentOverviewScreen extends ConsumerWidget {
  const DepartmentOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subjects = ref.watch(hodSubjectsProvider);
    final average =
        subjects.fold<double>(0, (sum, item) => sum + item.average) /
        subjects.length;
    final syllabus =
        subjects.fold<double>(0, (sum, item) => sum + item.syllabusCompletion) /
        subjects.length;
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Science Department',
        subtitle: 'Subject outcomes, coverage pace, and class-level comparison.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: [
          HodGlassBand(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _CompactStat(
                      label: 'Department average',
                      value: '${average.toStringAsFixed(1)}%',
                      color: _scoreColor(average),
                    ),
                  ),
                  Expanded(
                    child: _CompactStat(
                      label: 'Syllabus coverage',
                      value: '${syllabus.toStringAsFixed(0)}%',
                      color: AppColors.accentTeal,
                    ),
                  ),
                ],
              ),
            ],
          ),
          _DepartmentSubjectTabs(subjects: subjects),
        ],
      ),
    );
  }
}

class SubjectDetailAnalyticsScreen extends ConsumerWidget {
  const SubjectDetailAnalyticsScreen({super.key, required this.subjectId});

  final String subjectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subject = ref.watch(hodSubjectByIdProvider(subjectId));
    if (subject == null) {
      return const Scaffold(body: KSEmptyState(title: 'Subject not found'));
    }
    return Scaffold(
      appBar: KSAppBar(
        title: '${subject.name} Analytics',
        subtitle: '${subject.classes.length} active classes · ${subject.atRiskStudents} at-risk learners.',
        variant: KSAppBarVariant.hero,
        actions: [_HeroCount(label: 'Avg', count: subject.average.round())],
      ),
      body: HodSurface(
        children: [
          HodCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ProgressLine(
                  label: 'Subject average',
                  value: subject.average / 100,
                  color: _scoreColor(subject.average),
                ),
                const SizedBox(height: 14),
                _ProgressLine(
                  label: 'Syllabus completion',
                  value: subject.syllabusCompletion / 100,
                  color: AppColors.accentTeal,
                ),
              ],
            ),
          ),
          const HodSectionTitle(title: 'Class Breakdown'),
          ...subject.classes.map(
            (klass) => HodCard(
              child: Row(
                children: [
                  _IconBadge(
                    icon: Icons.school_rounded,
                    color: _scoreColor(klass.average),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          klass.classLabel,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        Text(
                          '${klass.teacherName} - ${klass.studentCount} students',
                        ),
                      ],
                    ),
                  ),
                  HodPill(
                    label: '${klass.average.toStringAsFixed(0)}%',
                    color: _scoreColor(klass.average),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HodTeacherListScreen extends ConsumerWidget {
  const HodTeacherListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teachers = ref.watch(hodTeachersProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Teacher Oversight',
        subtitle: 'Staff performance, syllabus pace, and submission discipline.',
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: [
          HodInsightCard(
            title: 'Amina Rashidi needs support',
            subtitle:
                'Chemistry has the lowest department average and highest at-risk count. Prioritize coaching before the next midterm.',
            icon: Icons.psychology_rounded,
            color: AppColors.accentRose,
            onTap: () => context.push('/hod/teachers/amina'),
          ),
          ...teachers.map(
            (teacher) => _TeacherCard(
              teacher: teacher,
              onTap: () => context.push('/hod/teachers/${teacher.id}'),
            ),
          ),
        ],
      ),
    );
  }
}

class HodTeacherDetailScreen extends ConsumerWidget {
  const HodTeacherDetailScreen({super.key, required this.teacherId});

  final String teacherId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teacher = ref.watch(hodTeacherByIdProvider(teacherId));
    final subjects = ref.watch(hodSubjectsProvider);
    if (teacher == null) {
      return const Scaffold(body: KSEmptyState(title: 'Teacher not found'));
    }
    final classes = [
      for (final subject in subjects)
        ...subject.classes.where(
          (klass) => teacher.name.contains(klass.teacherName.split(' ').last),
        ),
    ];
    return Scaffold(
      appBar: KSAppBar(
        title: teacher.name,
        subtitle: teacher.subjects,
        variant: KSAppBarVariant.hero,
        actions: [_HeroCount(label: 'OnTime', count: teacher.onTimeRate.round())],
      ),
      body: HodSurface(
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.92,
            children: [
              _MetricTile(
                label: 'Average',
                value: '${teacher.averageScore.toStringAsFixed(0)}%',
                icon: Icons.insights_rounded,
                color: _scoreColor(teacher.averageScore),
              ),
              _MetricTile(
                label: 'On Time',
                value: '${teacher.onTimeRate.toStringAsFixed(0)}%',
                icon: Icons.timer_rounded,
                color: AppColors.accentEmerald,
              ),
              _MetricTile(
                label: 'Syllabus',
                value: '${teacher.syllabusCompletion.toStringAsFixed(0)}%',
                icon: Icons.library_books_rounded,
                color: AppColors.accentTeal,
              ),
            ],
          ),
          const HodSectionTitle(title: 'Assigned Classes'),
          if (classes.isEmpty)
            HodCard(
              child: _IconTextRow(
                icon: Icons.info_outline_rounded,
                color: AppColors.skyBlue600,
                title: 'No class breakdown linked yet',
                subtitle: 'Teacher profile is ready for backend class mapping.',
              ),
            )
          else
            ...classes.map(
              (klass) => HodCard(child: _ClassAnalyticsRow(klass: klass)),
            ),
        ],
      ),
    );
  }
}

class DepartmentAlertsScreen extends ConsumerWidget {
  const DepartmentAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(hodAlertsProvider);
    return Scaffold(
      appBar: KSAppBar(
        title: 'Performance Alerts',
        subtitle: 'Department-level flags requiring HOD action.',
        showBack: false,
        variant: KSAppBarVariant.hero,
        actions: [_HeroCount(label: 'Alerts', count: alerts.length)],
      ),
      body: HodSurface(
        children: [
          _FilterChips(
            labels: const [
              'All',
              'High',
              'Medium',
              'Biology',
              'Chemistry',
              'Physics',
            ],
            selected: 'All',
          ),
          HodGlassBand(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _CompactStat(
                      label: 'Unresolved',
                      value: '${alerts.length}',
                      color: AppColors.accentRose,
                    ),
                  ),
                  Expanded(
                    child: _CompactStat(
                      label: 'Escalated',
                      value: '${alerts.where((a) => a.isEscalated).length}',
                      color: AppColors.accentAmber,
                    ),
                  ),
                  Expanded(
                    child: _CompactStat(
                      label: 'Students',
                      value:
                          '${alerts.where((a) => a.studentId != null).length}',
                      color: AppColors.skyBlue600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          HodSectionTitle(
            title: 'Peer Pairings',
            action: 'Open',
            onAction: () => context.push('/hod/performance/pairings'),
          ),
          HodCard(
            child: _IconTextRow(
              icon: Icons.handshake_rounded,
              color: AppColors.accentTeal,
              title: 'Suggested peer support is available',
              subtitle:
                  'Review mentor pairings for underperforming learners by subject.',
            ),
            onTap: () => context.push('/hod/performance/pairings'),
          ),
          const HodSectionTitle(title: 'Active Alerts'),
          ...alerts.map((alert) => _AlertCard(alert: alert)),
          HodInsightCard(
            title: 'Good news: Biology rapid improvement',
            subtitle:
                'Four Biology students improved by more than 10 points over the last two assessments.',
            icon: Icons.trending_up_rounded,
            color: AppColors.accentEmerald,
          ),
        ],
      ),
    );
  }
}

class DepartmentPairingsScreen extends ConsumerWidget {
  const DepartmentPairingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(hodPairingsProvider);
    final suggested = items
        .where((item) => item.status == 'SUGGESTED')
        .toList();
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Department Pairings',
        subtitle: 'Suggested mentor groups based on subject performance gaps.',
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: [
          _FilterChips(
            labels: const [
              'All',
              'Suggested',
              'Active',
              'Chemistry',
              'Biology',
            ],
            selected: 'All',
          ),
          HodInsightCard(
            title:
                '${items.fold<int>(0, (sum, item) => sum + item.count)} pairings across Sciences',
            subtitle:
                '${suggested.length} groups are awaiting activation and ${items.length - suggested.length} are active.',
            icon: Icons.diversity_3_rounded,
            color: AppColors.accentIndigo,
          ),
          ...items.map((item) => _PairingCard(item: item)),
          KSButton(
            label: 'Activate Suggested Pairings',
            icon: const Icon(
              Icons.check_circle_rounded,
              color: AppColors.white,
            ),
            onPressed: suggested.isEmpty
                ? null
                : () {
                    ref
                        .read(hodPairingsControllerProvider.notifier)
                        .activatePairings(
                          suggested.map((item) => item.id).toList(),
                        );
                    ref
                        .read(snackbarProvider.notifier)
                        .show(
                          'Suggested pairings activated for the department.',
                        );
                  },
          ),
        ],
      ),
    );
  }
}

class HodStudentPerformanceScreen extends StatelessWidget {
  const HodStudentPerformanceScreen({super.key, required this.studentId});

  final String studentId;

  @override
  Widget build(BuildContext context) {
    final name = studentId == 'jabir'
        ? 'Jabir Hassan'
        : studentId == 'amina'
        ? 'Amina Baraka Juma'
        : 'Student Profile';
    return Scaffold(
      appBar: KSAppBar(
        title: name,
        subtitle: 'Science performance profile prepared for HOD follow-up.',
        variant: KSAppBarVariant.hero,
        actions: [
          const _HeroCount(label: 'Risk', count: 3),
          IconButton(
            onPressed: () => context.push('/teacher/interventions/create'),
            icon: const Icon(Icons.edit_note_rounded),
          ),
        ],
      ),
      body: HodSurface(
        children: const [
          HodCard(
            child: _IconTextRow(
              icon: Icons.psychology_alt_rounded,
              color: AppColors.accentAmber,
              title: 'Intervention recommended',
              subtitle:
                  'Assign structured revision and monitor the next two assessments.',
            ),
          ),
          _StudentSubjectRow(
            subject: 'Biology',
            score: 48,
            trend: 'Down 8 pts',
          ),
          _StudentSubjectRow(
            subject: 'Chemistry',
            score: 42,
            trend: 'Down 14 pts',
          ),
          _StudentSubjectRow(subject: 'Physics', score: 56, trend: 'Stable'),
        ],
      ),
    );
  }
}

class HodInterventionsScreen extends ConsumerWidget {
  const HodInterventionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(hodInterventionsProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Intervention Log',
        subtitle: 'Follow-up history for department risks and support actions.',
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: [
          _FilterChips(
            labels: const ['All', 'Pending Follow-Up', 'Completed'],
            selected: 'All',
          ),
          HodGlassBand(
            children: [
              Row(
                children: [
                  Expanded(
                    child: _CompactStat(
                      label: 'Logged',
                      value: '${items.length}',
                      color: AppColors.skyBlue600,
                    ),
                  ),
                  Expanded(
                    child: _CompactStat(
                      label: 'Pending',
                      value:
                          '${items.where((item) => !item.followedUp).length}',
                      color: AppColors.accentAmber,
                    ),
                  ),
                ],
              ),
            ],
          ),
          ...items.map((item) => _InterventionCard(item: item)),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/teacher/interventions/create'),
        child: const Icon(Icons.add_rounded),
      ),
    );
  }
}

class HodAnnouncementsScreen extends StatelessWidget {
  const HodAnnouncementsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Department Notices',
        subtitle: 'Science department communication for teachers and classes.',
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: const [
          _AnnouncementCard(
            title: 'Science Practical Schedule',
            audience: 'Teachers',
            message:
                'All Form 3 practical records must be updated before Friday inspection.',
            date: 'Today, 9:30 AM',
          ),
          _AnnouncementCard(
            title: 'Assessment Moderation',
            audience: 'Science Department',
            message:
                'Submit CAT 2 moderation samples before marks approval starts.',
            date: 'Yesterday',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Announcement composer ready for API.')),
        ),
        icon: const Icon(Icons.campaign_rounded),
        label: const Text('Compose'),
      ),
    );
  }
}

class HodTimetableScreen extends StatelessWidget {
  const HodTimetableScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      appBar: KSAppBar(
        title: 'Science Timetable',
        subtitle: 'Department periods, practical slots, and coverage checks.',
        variant: KSAppBarVariant.hero,
      ),
      body: HodSurface(
        children: [
          _TimelineRow(
            day: 'Mon',
            time: '08:00',
            title: 'Biology Form 2A',
            subtitle: 'Grace Ndosi - Lab 1',
            color: AppColors.skyBlue600,
          ),
          _TimelineRow(
            day: 'Wed',
            time: '10:20',
            title: 'Chemistry Form 3B',
            subtitle: 'Amina Rashidi - Practical prep',
            color: AppColors.accentTeal,
          ),
          _TimelineRow(
            day: 'Fri',
            time: '12:10',
            title: 'Physics Form 4A',
            subtitle: 'Peter Kimani - Lab 2',
            color: AppColors.accentAmber,
          ),
        ],
      ),
    );
  }
}

class _ApprovalQueueCard extends ConsumerWidget {
  const _ApprovalQueueCard({required this.item, this.showQuickAction = false});

  final HodApproval item;
  final bool showQuickAction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return HodCard(
      onTap: () => context.push('/hod/approvals/${item.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HodApprovalCard(item: item, margin: EdgeInsets.zero),
          const SizedBox(height: 12),
          GradeDistributionBar(distribution: item.distribution),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => context.push('/hod/approvals/${item.id}'),
                  icon: const Icon(Icons.fact_check_rounded),
                  label: const Text('Review Marks'),
                ),
              ),
              if (showQuickAction) ...[
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () => _quickApprove(context, ref),
                    icon: const Icon(Icons.verified_rounded),
                    label: const Text('Quick Approve'),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _quickApprove(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Approve marks?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${item.subject} ${item.classLabel} ${item.assessmentType}'),
            const SizedBox(height: 8),
            Text(
              'Average: ${item.classAverage.toStringAsFixed(1)}/${item.maxScore.toStringAsFixed(0)} (${item.averagePercent.toStringAsFixed(1)}%)',
            ),
            const SizedBox(height: 12),
            GradeDistributionBar(distribution: item.distribution),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    ref.read(hodApprovalsControllerProvider.notifier).approve(item.id);
    ref
        .read(snackbarProvider.notifier)
        .show('${item.subject} ${item.classLabel} approved.');
  }
}

class _MarksReviewPanel extends StatelessWidget {
  const _MarksReviewPanel({required this.item});

  final HodApproval item;

  @override
  Widget build(BuildContext context) {
    final absent = item.studentCount > 38 ? 2 : 1;
    final stdDev = item.subject == 'Chemistry' ? 8.1 : 6.4;
    return RepaintBoundary(
      child: HodCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${item.subject} ${item.classLabel} ${item.assessmentType}',
              style: Theme.of(
                context,
              ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text('${item.teacherName} - Submitted ${item.submittedAgo}'),
            const SizedBox(height: 16),
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              childAspectRatio: 1.08,
              children: [
                _ReviewCell(
                  label: 'Average',
                  value:
                      '${item.classAverage.toStringAsFixed(1)}/${item.maxScore.toStringAsFixed(0)}',
                  color: _scoreColor(item.averagePercent),
                ),
                _ReviewCell(
                  label: 'Highest',
                  value:
                      '${item.highest.toStringAsFixed(0)}/${item.maxScore.toStringAsFixed(0)}',
                  color: AppColors.accentEmerald,
                ),
                _ReviewCell(
                  label: 'Lowest',
                  value:
                      '${item.lowest.toStringAsFixed(0)}/${item.maxScore.toStringAsFixed(0)}',
                  color: AppColors.accentRose,
                ),
                _ReviewCell(
                  label: 'Marked',
                  value: '${item.studentCount - absent}/${item.studentCount}',
                  color: AppColors.skyBlue600,
                ),
                _ReviewCell(
                  label: 'Absent',
                  value: '$absent',
                  color: AppColors.accentAmber,
                ),
                _ReviewCell(
                  label: 'Std Dev',
                  value: stdDev.toStringAsFixed(1),
                  color: AppColors.textSecondary,
                ),
              ],
            ),
            const SizedBox(height: 16),
            GradeDistributionBar(distribution: item.distribution),
            const SizedBox(height: 16),
            _HistogramPreview(distribution: item.distribution),
          ],
        ),
      ),
    );
  }
}

class _DepartmentSubjectTabs extends StatefulWidget {
  const _DepartmentSubjectTabs({required this.subjects});
  final List<HodSubjectAnalytics> subjects;

  @override
  State<_DepartmentSubjectTabs> createState() => _DepartmentSubjectTabsState();
}

class _DepartmentSubjectTabsState extends State<_DepartmentSubjectTabs> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final current = widget.subjects[_index];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          height: 48,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: widget.subjects.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final subject = widget.subjects[index];
              final selected = index == _index;
              final color = subject.name == 'Chemistry'
                  ? AppColors.accentRose
                  : _scoreColor(subject.average);
              return ChoiceChip(
                selected: selected,
                label: Text(subject.name),
                selectedColor: color.withValues(alpha: 0.18),
                side: BorderSide(color: selected ? color : AppColors.border),
                onSelected: (_) => setState(() => _index = index),
              );
            },
          ),
        ),
        const SizedBox(height: 12),
        _SubjectCard(
          subject: current,
          onTap: () => context.push('/hod/department/subject/${current.id}'),
        ),
        HodCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${current.name} Class Table',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 12),
              ...current.classes.map(
                (klass) => _ClassAnalyticsRow(klass: klass),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({required this.labels, required this.selected});

  final List<String> labels;
  final String selected;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: labels.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final label = labels[index];
          final active = label == selected;
          return FilterChip(
            selected: active,
            label: Text(label),
            onSelected: (_) {},
            selectedColor: AppColors.skyBlue600.withValues(alpha: 0.16),
            side: BorderSide(
              color: active ? AppColors.skyBlue600 : AppColors.border,
            ),
          );
        },
      ),
    );
  }
}

class _CompactStat extends StatelessWidget {
  const _CompactStat({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: color,
            fontWeight: FontWeight.w900,
          ),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _ReviewCell extends StatelessWidget {
  const _ReviewCell({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: color,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _HistogramPreview extends StatelessWidget {
  const _HistogramPreview({required this.distribution});

  final Map<String, int> distribution;

  @override
  Widget build(BuildContext context) {
    final max = distribution.values.fold<int>(1, (m, v) => v > m ? v : m);
    return SizedBox(
      height: 70,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: distribution.entries.map((entry) {
          final color = _gradeColor(entry.key);
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 360),
                    curve: Curves.easeOutCubic,
                    height: 44 * entry.value / max,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(9),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(entry.key, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ApprovalActions extends ConsumerWidget {
  const _ApprovalActions({required this.item});

  final HodApproval item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return HodCard(
      margin: EdgeInsets.zero,
      child: Column(
        children: [
          KSButton(
            label: 'Approve Marks',
            icon: const Icon(Icons.verified_rounded, color: AppColors.white),
            onPressed: () => _approve(context, ref),
          ),
          const SizedBox(height: 12),
          KSButton(
            label: 'Reject for Correction',
            secondary: true,
            icon: const Icon(Icons.close_rounded, color: AppColors.skyBlue600),
            onPressed: () => _reject(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _approve(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Approve assessment?'),
        content: Text(
          '${item.subject} ${item.classLabel} will be published to student and parent results.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    ref.read(hodApprovalsControllerProvider.notifier).approve(item.id);
    ref
        .read(snackbarProvider.notifier)
        .show('${item.subject} ${item.classLabel} approved.');
    context.go('/shell/hod/approvals');
  }

  Future<void> _reject(BuildContext context, WidgetRef ref) async {
    final controller = TextEditingController();
    final reason = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          16,
          0,
          16,
          16 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: _RejectSheet(controller: controller),
      ),
    );
    controller.dispose();
    if (reason == null || !context.mounted) return;
    ref.read(hodApprovalsControllerProvider.notifier).reject(item.id, reason);
    ref
        .read(snackbarProvider.notifier)
        .show('${item.subject} ${item.classLabel} returned for correction.');
    context.go('/shell/hod/approvals');
  }
}

class _RejectSheet extends StatefulWidget {
  const _RejectSheet({required this.controller});
  final TextEditingController controller;

  @override
  State<_RejectSheet> createState() => _RejectSheetState();
}

class _RejectSheetState extends State<_RejectSheet> {
  @override
  Widget build(BuildContext context) {
    final valid = widget.controller.text.trim().length >= 20;
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Reject for Correction',
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          const Text('Give the teacher a clear reason. Minimum 20 characters.'),
          const SizedBox(height: 14),
          TextField(
            controller: widget.controller,
            maxLines: 4,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              hintText: 'Example: Verify the outlier scores and absentee rows.',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          KSButton(
            label: 'Reject Assessment',
            onPressed: valid
                ? () => Navigator.of(context).pop(widget.controller.text.trim())
                : null,
          ),
        ],
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return HodCard(
      margin: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _IconBadge(icon: icon, color: color),
          const Spacer(),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}

class _SubjectCard extends StatelessWidget {
  const _SubjectCard({required this.subject, this.onTap});

  final HodSubjectAnalytics subject;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final color = _scoreColor(subject.average);
    return HodCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _IconBadge(icon: Icons.science_rounded, color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  subject.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              HodPill(
                label: '${subject.average.toStringAsFixed(0)}%',
                color: color,
              ),
            ],
          ),
          const SizedBox(height: 14),
          _ProgressLine(
            label: 'Syllabus completion',
            value: subject.syllabusCompletion / 100,
            color: AppColors.accentTeal,
          ),
          const SizedBox(height: 8),
          Text(
            '${subject.atRiskStudents} at-risk students across ${subject.classes.length} classes',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _TeacherCard extends StatelessWidget {
  const _TeacherCard({required this.teacher, this.onTap});

  final HodTeacherSummary teacher;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return HodCard(
      onTap: onTap,
      child: Row(
        children: [
          KSAvatar(name: teacher.name, size: 46),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  teacher.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(teacher.subjects),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    HodPill(
                      label:
                          '${teacher.onTimeRate.toStringAsFixed(0)}% on-time',
                      color: AppColors.accentEmerald,
                    ),
                    HodPill(
                      label:
                          '${teacher.syllabusCompletion.toStringAsFixed(0)}% syllabus',
                      color: AppColors.accentTeal,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

class _AlertCard extends ConsumerWidget {
  const _AlertCard({required this.alert});

  final HodDepartmentAlert alert;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = _severityColor(alert.severity);
    return HodCard(
      onTap: alert.studentId == null
          ? null
          : () => context.push('/hod/students/${alert.studentId}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _IconBadge(icon: Icons.warning_rounded, color: color),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  alert.title.replaceAll('_', ' '),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              HodPill(label: alert.severity.name.toUpperCase(), color: color),
            ],
          ),
          const SizedBox(height: 10),
          Text('${alert.subject} - ${alert.classLabel}'),
          const SizedBox(height: 4),
          Text(alert.message),
          const SizedBox(height: 12),
          if (alert.isEscalated)
            const HodPill(
              label: 'ESCALATED TO PRINCIPAL',
              color: AppColors.accentRose,
            ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.end,
            children: [
              TextButton.icon(
                onPressed: () => ref
                    .read(snackbarProvider.notifier)
                    .show('HOD follow-up queued for ${alert.subject}.'),
                icon: const Icon(Icons.task_alt_rounded),
                label: const Text('Resolve'),
              ),
              if (alert.studentId != null)
                TextButton.icon(
                  onPressed: () =>
                      context.push('/hod/students/${alert.studentId}'),
                  icon: const Icon(Icons.person_search_rounded),
                  label: const Text('View Student'),
                ),
              OutlinedButton.icon(
                onPressed: alert.isEscalated
                    ? null
                    : () => _escalate(context, ref, alert),
                icon: const Icon(Icons.escalator_warning_rounded),
                label: const Text('Escalate'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _escalate(
    BuildContext context,
    WidgetRef ref,
    HodDepartmentAlert alert,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Escalate to Principal?'),
        content: const Text(
          'This will notify the Principal and Academic QA about this alert.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Escalate'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!context.mounted) return;
    ref.read(hodAlertsControllerProvider.notifier).escalate(alert.id);
    ref
        .read(snackbarProvider.notifier)
        .show('${alert.subject} alert escalated to Principal.');
  }
}

class _PairingCard extends StatelessWidget {
  const _PairingCard({required this.item});

  final HodPairingSummary item;

  @override
  Widget build(BuildContext context) {
    final active = item.status == 'ACTIVE';
    return HodCard(
      child: Row(
        children: [
          _IconBadge(
            icon: Icons.handshake_rounded,
            color: active ? AppColors.accentEmerald : AppColors.accentAmber,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${item.subject} ${item.classLabel}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text('${item.count} peer support pairings'),
              ],
            ),
          ),
          HodPill(
            label: item.status,
            color: active ? AppColors.accentEmerald : AppColors.accentAmber,
          ),
        ],
      ),
    );
  }
}

class _InterventionCard extends ConsumerWidget {
  const _InterventionCard({required this.item});

  final HodIntervention item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final color = item.followedUp
        ? AppColors.accentEmerald
        : AppColors.accentAmber;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: color, width: 4)),
        borderRadius: BorderRadius.circular(24),
      ),
      child: HodCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _IconBadge(icon: Icons.health_and_safety_rounded, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                HodPill(
                  label: item.followedUp ? 'FOLLOWED' : 'PENDING',
                  color: color,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text('${item.type} - ${item.teacherName}'),
            const SizedBox(height: 4),
            Text(item.note),
            const SizedBox(height: 8),
            Text(item.timeAgo, style: Theme.of(context).textTheme.bodySmall),
            if (!item.followedUp) ...[
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () {
                    ref
                        .read(hodInterventionsControllerProvider.notifier)
                        .markFollowedUp(item.id);
                    ref
                        .read(snackbarProvider.notifier)
                        .show('${item.title} marked as followed up.');
                  },
                  icon: const Icon(Icons.check_circle_rounded),
                  label: const Text('Mark as Followed Up'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AnnouncementCard extends StatelessWidget {
  const _AnnouncementCard({
    required this.title,
    required this.audience,
    required this.message,
    required this.date,
  });

  final String title;
  final String audience;
  final String message;
  final String date;

  @override
  Widget build(BuildContext context) {
    return HodCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _IconBadge(
            icon: Icons.campaign_rounded,
            color: AppColors.skyBlue600,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                    HodPill(label: audience, color: AppColors.accentTeal),
                  ],
                ),
                const SizedBox(height: 8),
                Text(message),
                const SizedBox(height: 8),
                Text(date, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ClassAnalyticsRow extends StatelessWidget {
  const _ClassAnalyticsRow({required this.klass});

  final HodClassAnalytics klass;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _IconBadge(
          icon: Icons.class_rounded,
          color: _scoreColor(klass.average),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                klass.classLabel,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              Text('${klass.studentCount} students'),
            ],
          ),
        ),
        HodPill(
          label: '${klass.average.toStringAsFixed(0)}%',
          color: _scoreColor(klass.average),
        ),
      ],
    );
  }
}

class _MarkRow extends StatelessWidget {
  const _MarkRow({required this.row, required this.maxScore});

  final _SampleMark row;
  final double maxScore;

  @override
  Widget build(BuildContext context) {
    final percent = maxScore == 0 ? 0.0 : row.score / maxScore * 100;
    final color = _scoreColor(percent);
    return HodCard(
      child: Row(
        children: [
          KSAvatar(name: row.name, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  row.name,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(row.regNo),
              ],
            ),
          ),
          HodPill(
            label:
                '${row.score.toStringAsFixed(0)}/${maxScore.toStringAsFixed(0)}',
            color: color,
          ),
        ],
      ),
    );
  }
}

class _StudentSubjectRow extends StatelessWidget {
  const _StudentSubjectRow({
    required this.subject,
    required this.score,
    required this.trend,
  });

  final String subject;
  final double score;
  final String trend;

  @override
  Widget build(BuildContext context) {
    return HodCard(
      child: Row(
        children: [
          _IconBadge(icon: Icons.science_rounded, color: _scoreColor(score)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(trend),
              ],
            ),
          ),
          HodPill(
            label: '${score.toStringAsFixed(0)}%',
            color: _scoreColor(score),
          ),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({
    required this.day,
    required this.time,
    required this.title,
    required this.subtitle,
    required this.color,
  });

  final String day;
  final String time;
  final String title;
  final String subtitle;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return HodCard(
      child: Row(
        children: [
          Container(
            width: 58,
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              children: [
                Text(
                  day,
                  style: TextStyle(color: color, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(time, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(subtitle),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final double value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            Text('${(value * 100).round()}%'),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: value.clamp(0, 1),
          minHeight: 10,
          color: color,
          backgroundColor: AppColors.border,
          borderRadius: BorderRadius.circular(999),
        ),
      ],
    );
  }
}

class _IconTextRow extends StatelessWidget {
  const _IconTextRow({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _IconBadge(icon: icon, color: color),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 4),
              Text(subtitle),
            ],
          ),
        ),
      ],
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(icon, color: color),
    );
  }
}

class _HeroCount extends StatelessWidget {
  const _HeroCount({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 66,
      height: 66,
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.16),
        shape: BoxShape.circle,
        border: Border.all(color: AppColors.white.withValues(alpha: 0.22)),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$count',
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w900,
                fontSize: 20,
              ),
            ),
            Text(
              label,
              style: const TextStyle(color: AppColors.white, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}

class _SampleMark {
  const _SampleMark(this.name, this.regNo, this.score);
  final String name;
  final String regNo;
  final double score;
}

List<_SampleMark> _sampleRowsFor(HodApproval item) {
  final max = item.maxScore;
  return [
    _SampleMark('Amina Baraka Juma', 'KS/F3/021', max * 0.82),
    _SampleMark('Jabir Hassan', 'KS/F3/029', max * 0.46),
    _SampleMark('Neema Ally', 'KS/F3/017', max * 0.74),
    _SampleMark('Brian Mwita', 'KS/F3/005', max * 0.58),
    _SampleMark('Zawadi Paul', 'KS/F3/041', max * 0.91),
  ];
}

Color _scoreColor(double score) {
  if (score >= 70) return AppColors.accentEmerald;
  if (score >= 55) return AppColors.skyBlue600;
  if (score >= 45) return AppColors.accentAmber;
  return AppColors.accentRose;
}

Color _gradeColor(String grade) {
  return switch (grade) {
    'A' => AppColors.accentEmerald,
    'B' => AppColors.skyBlue600,
    'C' => AppColors.accentAmber,
    'D' => AppColors.accentIndigo,
    'F' => AppColors.accentRose,
    _ => AppColors.textMuted,
  };
}

Color _severityColor(HodAlertSeverity severity) {
  return switch (severity) {
    HodAlertSeverity.low => AppColors.skyBlue600,
    HodAlertSeverity.medium => AppColors.accentAmber,
    HodAlertSeverity.high => AppColors.accentRose,
    HodAlertSeverity.critical => AppColors.accentRose,
  };
}
