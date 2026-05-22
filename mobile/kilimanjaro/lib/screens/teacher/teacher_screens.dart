import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/snackbar_provider.dart';
import '../../core/providers/teacher_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/teacher_models.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_search_bar.dart';
import '../../widgets/common/ks_text_field.dart';
import '../../widgets/teacher/teacher_surface.dart';

class TeacherHomeScreen extends ConsumerWidget {
  const TeacherHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classes = ref.watch(teacherClassesProvider);
    final assessments = ref.watch(teacherAssessmentsProvider);
    final sessions = ref.watch(teacherAttendanceSessionsProvider);
    final alerts = ref.watch(teacherAlertsProvider);
    final pairings = ref.watch(teacherPairingsProvider);
    final openAssessments = assessments
        .where((item) => item.status == TeacherAssessmentStatus.open)
        .toList();

    return Scaffold(
      appBar: KSAppBar(
        title: 'Mwalimu Rose',
        subtitle: 'Mathematics · Physics — Form 2 & 3',
        showBack: false,
        variant: KSAppBarVariant.hero,
        actions: [
          _HeroCount(
            label: 'Tasks',
            count:
                openAssessments.length +
                sessions.where((s) => s.isUrgent).length,
          ),
        ],
      ),
      body: TeacherSurface(
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.28,
            children: [
              _MetricTile(
                label: 'Classes',
                value: '${classes.length}',
                icon: Icons.menu_book_rounded,
                color: AppColors.skyBlue600,
              ),
              _MetricTile(
                label: 'Open Marks',
                value: '${openAssessments.length}',
                icon: Icons.edit_rounded,
                color: AppColors.accentAmber,
              ),
              _MetricTile(
                label: 'Alerts',
                value: '${alerts.length}',
                icon: Icons.warning_rounded,
                color: AppColors.accentRose,
              ),
              _MetricTile(
                label: 'Pairings',
                value: '${pairings.length}',
                icon: Icons.handshake_rounded,
                color: AppColors.accentTeal,
              ),
            ],
          ),
          const TeacherSectionTitle(title: "Today's Priority"),
          ...sessions.map(
            (session) => TeacherCard(
              onTap: () => context.go('/shell/teacher/attendance'),
              child: Row(
                children: [
                  Icon(
                    session.isUrgent
                        ? Icons.priority_high_rounded
                        : Icons.schedule_rounded,
                    color: session.isUrgent
                        ? AppColors.accentRose
                        : AppColors.skyBlue600,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session.title,
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        Text('${session.timeLabel} - ${session.statusLabel}'),
                      ],
                    ),
                  ),
                  TeacherStatusPill(
                    label: session.isUrgent ? 'URGENT' : 'PENDING',
                    color: session.isUrgent
                        ? AppColors.accentRose
                        : AppColors.accentAmber,
                  ),
                ],
              ),
            ),
          ),
          const TeacherSectionTitle(title: 'Open Assessments'),
          ...openAssessments.map(
            (item) => _AssessmentCard(
              item: item,
              onTap: () => context.push('/teacher/marks/${item.id}'),
            ),
          ),
          TeacherSectionTitle(
            title: 'Assigned Classes',
            action: 'View all',
            onAction: () => context.go('/shell/teacher/classes'),
          ),
          ...classes
              .take(2)
              .map(
                (item) => TeacherClassCard(
                  item: item,
                  onTap: () => context.push('/teacher/classes/${item.id}'),
                ),
              ),
        ],
      ),
    );
  }
}

class MyClassesScreen extends ConsumerWidget {
  const MyClassesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final classes = ref.watch(teacherClassesProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'My Classes',
        subtitle: 'All assigned class-subject combinations and learning status.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: classes
            .map(
              (item) => TeacherClassCard(
                item: item,
                onTap: () => context.push('/teacher/classes/${item.id}'),
              ),
            )
            .toList(),
      ),
    );
  }
}

class ClassDetailScreen extends ConsumerWidget {
  const ClassDetailScreen({super.key, required this.classSubjectId});

  final String classSubjectId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final item = ref.watch(teacherClassByIdProvider(classSubjectId));
    final students = ref.watch(teacherStudentsForClassProvider(classSubjectId));
    final assessments = ref
        .watch(teacherAssessmentsProvider)
        .where((a) => a.classSubjectId == classSubjectId)
        .toList();
    if (item == null) {
      return const Scaffold(body: KSEmptyState(title: 'Class not found'));
    }
    return Scaffold(
      appBar: KSAppBar(
        title: item.title,
        subtitle: '${item.studentCount} students · next ${item.nextLesson}',
        variant: KSAppBarVariant.hero,
        actions: [
          IconButton(
            onPressed: () =>
                context.push('/teacher/classes/$classSubjectId/students'),
            icon: const Icon(Icons.groups_rounded),
          ),
        ],
      ),
      body: TeacherSurface(
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.95,
            children: [
              _MetricTile(
                label: 'Average',
                value: '${item.averageScore.toStringAsFixed(1)}%',
                icon: Icons.bar_chart_rounded,
                color: AppColors.skyBlue600,
              ),
              _MetricTile(
                label: 'Attendance',
                value: '${item.attendanceRate.toStringAsFixed(0)}%',
                icon: Icons.calendar_month_rounded,
                color: AppColors.accentEmerald,
              ),
              _MetricTile(
                label: 'Students',
                value: '${students.length}',
                icon: Icons.groups_rounded,
                color: AppColors.accentIndigo,
              ),
            ],
          ),
          const TeacherSectionTitle(title: 'Assessments'),
          ...assessments.map(
            (a) => _AssessmentCard(
              item: a,
              onTap: () => context.push('/teacher/marks/${a.id}'),
            ),
          ),
          TeacherSectionTitle(
            title: 'Students',
            action: 'See all',
            onAction: () =>
                context.push('/teacher/classes/$classSubjectId/students'),
          ),
          ...students.take(5).map((student) => _StudentCard(student: student)),
        ],
      ),
    );
  }
}

class ClassStudentListScreen extends ConsumerStatefulWidget {
  const ClassStudentListScreen({super.key, required this.classSubjectId});
  final String classSubjectId;

  @override
  ConsumerState<ClassStudentListScreen> createState() =>
      _ClassStudentListScreenState();
}

class _ClassStudentListScreenState
    extends ConsumerState<ClassStudentListScreen> {
  final _search = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final item = ref.watch(teacherClassByIdProvider(widget.classSubjectId));
    final students = ref.watch(
      teacherStudentsForClassProvider(widget.classSubjectId),
    );
    final filtered = students
        .where((s) => s.name.toLowerCase().contains(_query.toLowerCase()))
        .toList();
    return Scaffold(
      appBar: KSAppBar(title: item?.title ?? 'Students'),
      body: TeacherSurface(
        header: TeacherCard(
          child: KSSearchBar(
            controller: _search,
            hintText: 'Search students...',
            onChanged: (value) => setState(() => _query = value),
          ),
        ),
        children: filtered
            .map((student) => _StudentCard(student: student))
            .toList(),
      ),
    );
  }
}

class AssessmentListScreen extends ConsumerWidget {
  const AssessmentListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assessments = ref.watch(teacherAssessmentsProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Marks Entry',
        subtitle: 'Open, draft, submitted, and approved assessments.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: assessments
            .map(
              (item) => _AssessmentCard(
                item: item,
                onTap: () => context.push('/teacher/marks/${item.id}'),
              ),
            )
            .toList(),
      ),
    );
  }
}

class MarksEntrySheetScreen extends ConsumerWidget {
  const MarksEntrySheetScreen({super.key, required this.assessmentId});
  final String assessmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assessment = ref.watch(teacherAssessmentByIdProvider(assessmentId));
    final rows =
        ref.watch(teacherMarksControllerProvider)[assessmentId] ??
        const <TeacherMarkEntry>[];
    if (assessment == null) {
      return const Scaffold(body: KSEmptyState(title: 'Assessment not found'));
    }
    final entered = rows
        .where((item) => item.score != null || item.isAbsent)
        .length;
    return Scaffold(
      appBar: KSAppBar(
        title: assessment.title,
        subtitle: 'Tap a row to enter marks using the numpad.',
        variant: KSAppBarVariant.hero,
        actions: [
          _HeroCount(label: 'Done', count: entered),
          TextButton(
            onPressed: () =>
                context.push('/teacher/marks/$assessmentId/submit'),
            child: const Text(
              'Submit',
              style: TextStyle(color: AppColors.white),
            ),
          ),
        ],
      ),
      body: TeacherSurface(
        children: [
          ...rows.map(
            (row) => TeacherCard(
              onTap: () => _showNumpad(context, ref, assessment, row),
              child: Row(
                children: [
                  KSAvatar(name: row.student.name, size: 42),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          row.student.name,
                          style: Theme.of(context).textTheme.titleSmall
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        Text(row.student.registrationNumber),
                      ],
                    ),
                  ),
                  if (row.isAbsent)
                    const TeacherStatusPill(
                      label: 'ABSENT',
                      color: AppColors.accentRose,
                    )
                  else
                    Text(
                      row.score == null
                          ? '-'
                          : '${row.score!.toStringAsFixed(0)}/${assessment.maxScore.toStringAsFixed(0)}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showNumpad(
    BuildContext context,
    WidgetRef ref,
    TeacherAssessment assessment,
    TeacherMarkEntry row,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => KSNumpad(
        maxScore: assessment.maxScore,
        initialValue: row.score?.toStringAsFixed(0) ?? '',
        onConfirm: (value) {
          ref
              .read(teacherMarksControllerProvider.notifier)
              .updateScore(assessment.id, row.student.id, value);
          Navigator.of(context).pop();
        },
        onAbsent: () {
          ref
              .read(teacherMarksControllerProvider.notifier)
              .markAbsent(assessment.id, row.student.id);
          Navigator.of(context).pop();
        },
      ),
    );
  }
}

class KSNumpad extends StatefulWidget {
  const KSNumpad({
    super.key,
    required this.maxScore,
    required this.initialValue,
    required this.onConfirm,
    required this.onAbsent,
  });

  final double maxScore;
  final String initialValue;
  final ValueChanged<double> onConfirm;
  final VoidCallback onAbsent;

  @override
  State<KSNumpad> createState() => _KSNumpadState();
}

class _KSNumpadState extends State<KSNumpad> {
  late String _value = widget.initialValue;

  @override
  Widget build(BuildContext context) {
    final parsed = double.tryParse(_value);
    final invalid = parsed != null && parsed > widget.maxScore;
    return SafeArea(
      child: SizedBox(
        height: 380,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.skyBlue50,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Text('Score'),
                        const Spacer(),
                        Text(
                          _value.isEmpty ? '-' : _value,
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        Text(' / ${widget.maxScore.toStringAsFixed(0)}'),
                      ],
                    ),
                    if (invalid)
                      const Text(
                        'Cannot exceed maximum score',
                        style: TextStyle(color: AppColors.accentRose),
                      )
                    else if (parsed != null)
                      Text(
                        '${(parsed / widget.maxScore * 100).round()}%',
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: GridView.count(
                  crossAxisCount: 3,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 1.65,
                  children:
                      [
                        '7',
                        '8',
                        '9',
                        '4',
                        '5',
                        '6',
                        '1',
                        '2',
                        '3',
                        'ABSENT',
                        '0',
                        'DEL',
                      ].map((key) {
                        return _NumpadKey(
                          label: key,
                          accent: key == 'ABSENT'
                              ? AppColors.accentRose
                              : key == 'DEL'
                              ? AppColors.accentAmber
                              : AppColors.skyBlue600,
                          onPressed: () {
                            if (key == 'ABSENT') {
                              widget.onAbsent();
                            } else if (key == 'DEL') {
                              setState(
                                () => _value = _value.isEmpty
                                    ? ''
                                    : _value.substring(0, _value.length - 1),
                              );
                            } else {
                              setState(
                                () => _value = (_value + key).replaceFirst(
                                  RegExp('^0+(?=.)'),
                                  '',
                                ),
                              );
                            }
                          },
                        );
                      }).toList(),
                ),
              ),
              KSButton(
                label: 'Confirm',
                onPressed: parsed == null || invalid
                    ? null
                    : () => widget.onConfirm(parsed),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AssessmentSubmitConfirmScreen extends ConsumerWidget {
  const AssessmentSubmitConfirmScreen({super.key, required this.assessmentId});
  final String assessmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assessment = ref.watch(teacherAssessmentByIdProvider(assessmentId));
    final rows =
        ref.watch(teacherMarksControllerProvider)[assessmentId] ??
        const <TeacherMarkEntry>[];
    if (assessment == null) {
      return const Scaffold(body: KSEmptyState(title: 'Assessment not found'));
    }
    final entered = rows
        .where((item) => item.score != null || item.isAbsent)
        .length;
    return Scaffold(
      appBar: KSAppBar(
        title: 'Review Before Submit',
        subtitle: '${assessment.title} · $entered of ${rows.length} completed.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 3,
            mainAxisSpacing: 10,
            crossAxisSpacing: 10,
            childAspectRatio: 0.95,
            children: [
              _MetricTile(
                label: 'Completed',
                value: '$entered/${rows.length}',
                icon: Icons.check_circle_rounded,
                color: AppColors.accentEmerald,
              ),
              _MetricTile(
                label: 'Absent',
                value: '${rows.where((item) => item.isAbsent).length}',
                icon: Icons.person_off_rounded,
                color: AppColors.accentRose,
              ),
              _MetricTile(
                label: 'Missing',
                value: '${rows.length - entered}',
                icon: Icons.pending_actions_rounded,
                color: AppColors.accentAmber,
              ),
            ],
          ),
          const TeacherSectionTitle(title: 'Submission Snapshot'),
          TeacherCard(
            child: Column(
              children: rows.take(6).map((row) {
                final value = row.isAbsent
                    ? 'ABSENT'
                    : row.score == null
                    ? 'Missing'
                    : '${row.score!.toStringAsFixed(0)}/${assessment.maxScore.toStringAsFixed(0)}';
                return _CompactDataRow(
                  label: row.student.name,
                  value: value,
                  color: row.isAbsent
                      ? AppColors.accentRose
                      : row.score == null
                      ? AppColors.accentAmber
                      : AppColors.accentEmerald,
                );
              }).toList(),
            ),
          ),
          KSButton(
            label: 'Submit to HOD',
            onPressed: entered == rows.length
                ? () => context.go('/teacher/marks/$assessmentId/review')
                : null,
          ),
        ],
      ),
    );
  }
}

class MarksReviewScreen extends ConsumerWidget {
  const MarksReviewScreen({super.key, required this.assessmentId});
  final String assessmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assessment = ref.watch(teacherAssessmentByIdProvider(assessmentId));
    return Scaffold(
      appBar: KSAppBar(
        title: 'Submitted for Review',
        subtitle:
            '${assessment?.title ?? 'Assessment'} · awaiting HOD approval.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          TeacherCard(
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: AppColors.accentAmber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.hourglass_top_rounded,
                    color: AppColors.accentAmber,
                  ),
                ),
                const SizedBox(width: 14),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Status: SUBMITTED',
                        style: TextStyle(fontWeight: FontWeight.w900),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'HOD approval is pending. You can still view the submitted marks.',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AttendanceMarkingScreen extends ConsumerWidget {
  const AttendanceMarkingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(teacherAttendanceSessionsProvider);
    final selected = sessions.first;
    final students = ref.watch(
      teacherStudentsForClassProvider(selected.classSubjectId),
    );
    final state =
        ref.watch(teacherAttendanceControllerProvider)[selected.id] ?? {};
    final marked = state.values.whereType<TeacherAttendanceStatus>().length;
    return Scaffold(
      appBar: KSAppBar(
        title: selected.title,
        subtitle: '${selected.timeLabel} · $marked of ${students.length} marked.',
        showBack: false,
        variant: KSAppBarVariant.hero,
        actions: [
          _HeroCount(label: 'Marked', count: marked),
          IconButton(
            onPressed: () => context.push('/teacher/attendance/history'),
            icon: const Icon(Icons.history_rounded),
          ),
        ],
      ),
      body: TeacherSurface(
        children: [
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: sessions.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final session = sessions[index];
                return TeacherStatusPill(
                  label:
                      '${session.timeLabel} ${session.title.split(' ').last}',
                  color: session == selected
                      ? AppColors.skyBlue600
                      : session.isUrgent
                      ? AppColors.accentRose
                      : AppColors.textSecondary,
                );
              },
            ),
          ),
          ...students.map(
            (student) => TeacherCard(
              child: Row(
                children: [
                  KSAvatar(name: student.name, size: 40),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      student.name,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  for (final status in TeacherAttendanceStatus.values)
                    Padding(
                      padding: const EdgeInsets.only(left: 4),
                      child: _AttendanceStatusButton(
                        status: status,
                        selected: state[student.id] == status,
                        onTap: () => ref
                            .read(teacherAttendanceControllerProvider.notifier)
                            .setStatus(selected.id, student.id, status),
                      ),
                    ),
                ],
              ),
            ),
          ),
          KSButton(
            label: 'Save Attendance',
            onPressed: marked == students.length
                ? () => ref
                      .read(snackbarProvider.notifier)
                      .show('Attendance saved for ${selected.title}.')
                : null,
          ),
        ],
      ),
    );
  }
}

class AttendanceHistoryScreen extends ConsumerWidget {
  const AttendanceHistoryScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(teacherAttendanceSessionsProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Attendance History',
        subtitle: 'Recent class registers and submission status.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: sessions
            .map(
              (s) => TeacherCard(
                child: _TimelineRow(
                  day: 'Today',
                  time: s.timeLabel,
                  title: s.title,
                  subtitle: s.statusLabel,
                  color: s.isUrgent
                      ? AppColors.accentRose
                      : AppColors.skyBlue600,
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class TeacherPerformanceAlertsScreen extends ConsumerWidget {
  const TeacherPerformanceAlertsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alerts = ref.watch(teacherAlertsProvider);
    return Scaffold(
      appBar: KSAppBar(
        title: 'Performance Alerts',
        subtitle: 'Staff-version alerts with full type and thresholds.',
        variant: KSAppBarVariant.hero,
        actions: [_HeroCount(label: 'Alerts', count: alerts.length)],
      ),
      body: TeacherSurface(
        children: alerts
            .map(
              (a) => _AlertCard(
                alert: a,
                onTap: () =>
                    context.push('/teacher/performance/alerts/${a.id}'),
              ),
            )
            .toList(),
      ),
    );
  }
}

class AlertDetailScreen extends ConsumerWidget {
  const AlertDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alert = ref.watch(teacherAlertByIdProvider(id));
    if (alert == null) {
      return const Scaffold(body: KSEmptyState(title: 'Alert not found'));
    }
    return Scaffold(
      appBar: KSAppBar(
        title: alert.type,
        subtitle: '${alert.studentName} · ${alert.subject}',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          _AlertCard(alert: alert),
          KSButton(
            label: 'View Student',
            onPressed: () => context.push(
              '/teacher/students/${alert.studentId}/performance',
            ),
          ),
          KSButton(
            label: 'Log Intervention',
            secondary: true,
            onPressed: () => context.push('/teacher/interventions/create'),
          ),
        ],
      ),
    );
  }
}

class PeerPairingsScreen extends ConsumerWidget {
  const PeerPairingsScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pairings = ref.watch(teacherPairingsProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Peer Pairings',
        subtitle: 'Suggested peer support links for teacher action.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: pairings
            .map(
              (p) => _PairingCard(
                pairing: p,
                onTap: () =>
                    context.push('/teacher/performance/pairings/${p.id}'),
              ),
            )
            .toList(),
      ),
    );
  }
}

class PairingDetailScreen extends ConsumerWidget {
  const PairingDetailScreen({super.key, required this.id});
  final String id;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pairing = ref.watch(teacherPairingByIdProvider(id));
    if (pairing == null) {
      return const Scaffold(body: KSEmptyState(title: 'Pairing not found'));
    }
    return Scaffold(
      appBar: KSAppBar(
        title: '${pairing.subject} Pairing',
        subtitle: pairing.reason,
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          _PairingCard(pairing: pairing),
          Row(
            children: [
              Expanded(
                child: KSButton(label: 'Activate', onPressed: () {}),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: KSButton(
                  label: 'Reject',
                  secondary: true,
                  onPressed: () {},
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class StudentPerformanceProfileScreen extends ConsumerWidget {
  const StudentPerformanceProfileScreen({super.key, required this.studentId});
  final String studentId;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(teacherStudentByIdProvider(studentId));
    final alerts = ref
        .watch(teacherAlertsProvider)
        .where((a) => a.studentId == studentId)
        .toList();
    if (student == null) {
      return const Scaffold(body: KSEmptyState(title: 'Student not found'));
    }
    return Scaffold(
      appBar: KSAppBar(
        title: student.name,
        subtitle: '${student.classLabel} · ${student.registrationNumber}',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 1.25,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            children: [
              _MetricTile(
                label: 'Average',
                value: '${student.averageScore.toStringAsFixed(0)}%',
                icon: Icons.bar_chart_rounded,
                color: AppColors.skyBlue600,
              ),
              _MetricTile(
                label: 'Attendance',
                value: '${student.attendanceRate.toStringAsFixed(0)}%',
                icon: Icons.calendar_month_rounded,
                color: AppColors.accentEmerald,
              ),
            ],
          ),
          const TeacherSectionTitle(title: 'Active Alerts'),
          ...alerts.map((a) => _AlertCard(alert: a)),
          KSButton(
            label: 'Log Intervention',
            secondary: true,
            onPressed: () => context.push('/teacher/interventions/create'),
          ),
        ],
      ),
    );
  }
}

class TimetableScreen extends ConsumerWidget {
  const TimetableScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final slots = ref.watch(teacherTimetableProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Weekly Timetable',
        subtitle: 'Teaching schedule with class, room, and time.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: slots
            .map(
              (s) => TeacherCard(
                child: _TimelineRow(
                  day: s.day,
                  time: s.time,
                  title: s.title,
                  subtitle: s.room,
                  color: _dayColor(s.day),
                ),
              ),
            )
            .toList(),
      ),
    );
  }
}

class SyllabusTrackerScreen extends ConsumerWidget {
  const SyllabusTrackerScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(teacherSyllabusProvider);
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Syllabus Tracker',
        subtitle: 'Coverage by class-subject with next topic.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: items
            .map((item) => _SyllabusProgressCard(item: item))
            .toList(),
      ),
    );
  }
}

class TeacherAnnouncementsListScreen extends ConsumerWidget {
  const TeacherAnnouncementsListScreen({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(teacherAnnouncementsProvider);
    return Scaffold(
      appBar: KSAppBar(
        title: 'Announcements',
        subtitle: 'Class communication sent by the teacher.',
        variant: KSAppBarVariant.hero,
        actions: [
          IconButton(
            onPressed: () => context.push('/teacher/announcements/create'),
            icon: const Icon(Icons.add_rounded),
          ),
        ],
      ),
      body: TeacherSurface(
        children: items.map((a) => _TeacherAnnouncementCard(item: a)).toList(),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/teacher/announcements/create'),
        child: const Icon(Icons.add_rounded),
      ),
    );
  }
}

class CreateAnnouncementScreen extends StatefulWidget {
  const CreateAnnouncementScreen({super.key});
  @override
  State<CreateAnnouncementScreen> createState() =>
      _CreateAnnouncementScreenState();
}

class _CreateAnnouncementScreenState extends State<CreateAnnouncementScreen> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Create Announcement',
        subtitle: 'Send a targeted update to students, parents, or staff.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          TeacherCard(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: const [
                TeacherStatusPill(
                  label: 'STUDENTS',
                  color: AppColors.skyBlue600,
                ),
                TeacherStatusPill(
                  label: 'PARENTS',
                  color: AppColors.accentAmber,
                ),
                TeacherStatusPill(
                  label: 'TEACHERS',
                  color: AppColors.accentTeal,
                ),
              ],
            ),
          ),
          TeacherCard(
            child: Column(
              children: [
                KSTextField(
                  controller: _title,
                  label: 'Title',
                  iconAsset: 'assets/icons/megaphone.svg',
                ),
                const SizedBox(height: 14),
                KSTextField(
                  controller: _body,
                  label: 'Message',
                  iconAsset: 'assets/icons/edit-pencil.svg',
                ),
              ],
            ),
          ),
          KSButton(
            label: 'Publish Announcement',
            onPressed: () => context.pop(),
          ),
        ],
      ),
    );
  }
}

class CreateInterventionScreen extends StatefulWidget {
  const CreateInterventionScreen({super.key});
  @override
  State<CreateInterventionScreen> createState() =>
      _CreateInterventionScreenState();
}

class _CreateInterventionScreenState extends State<CreateInterventionScreen> {
  final _notes = TextEditingController();
  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const KSAppBar(
        title: 'Intervention Record',
        subtitle: 'Document support given, parent meetings, or follow-up plans.',
        variant: KSAppBarVariant.hero,
      ),
      body: TeacherSurface(
        children: [
          TeacherCard(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: const [
                TeacherStatusPill(
                  label: 'SUPPORT GIVEN',
                  color: AppColors.skyBlue600,
                ),
                TeacherStatusPill(
                  label: 'PARENT MEETING',
                  color: AppColors.accentIndigo,
                ),
                TeacherStatusPill(
                  label: 'FOLLOW-UP',
                  color: AppColors.accentAmber,
                ),
              ],
            ),
          ),
          TeacherCard(
            child: KSTextField(
              controller: _notes,
              label: 'Notes',
              iconAsset: 'assets/icons/hand-raised.svg',
            ),
          ),
          KSButton(label: 'Save Intervention', onPressed: () => context.pop()),
        ],
      ),
    );
  }
}

class _NumpadKey extends StatelessWidget {
  const _NumpadKey({
    required this.label,
    required this.accent,
    required this.onPressed,
  });

  final String label;
  final Color accent;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: accent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: accent.withValues(alpha: 0.25),
              width: 1.4,
            ),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: accent,
                fontWeight: FontWeight.w900,
                fontSize: label.length > 2 ? 13 : 20,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AttendanceStatusButton extends StatelessWidget {
  const _AttendanceStatusButton({
    required this.status,
    required this.selected,
    required this.onTap,
  });

  final TeacherAttendanceStatus status;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: selected ? _color : _color.withValues(alpha: 0.09),
          shape: BoxShape.circle,
          border: Border.all(
            color: _color.withValues(alpha: selected ? 1 : 0.22),
          ),
        ),
        child: Center(
          child: Text(
            status.name[0].toUpperCase(),
            style: TextStyle(
              color: selected ? AppColors.white : _color,
              fontWeight: FontWeight.w900,
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }

  Color get _color => switch (status) {
    TeacherAttendanceStatus.present => AppColors.accentEmerald,
    TeacherAttendanceStatus.absent => AppColors.accentRose,
    TeacherAttendanceStatus.late => AppColors.accentAmber,
    TeacherAttendanceStatus.excused => AppColors.accentIndigo,
  };
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
    return Row(
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
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 3),
              Text(subtitle),
            ],
          ),
        ),
        Icon(Icons.chevron_right_rounded, color: color),
      ],
    );
  }
}

class _SyllabusProgressCard extends StatelessWidget {
  const _SyllabusProgressCard({required this.item});

  final TeacherSyllabusProgress item;

  @override
  Widget build(BuildContext context) {
    final color = item.progress >= 0.75
        ? AppColors.accentEmerald
        : item.progress >= 0.65
        ? AppColors.accentAmber
        : AppColors.accentRose;
    return TeacherCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              TeacherStatusPill(
                label: '${(item.progress * 100).round()}%',
                color: color,
              ),
            ],
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: item.progress,
            minHeight: 10,
            color: color,
            backgroundColor: AppColors.border,
            borderRadius: BorderRadius.circular(999),
          ),
          const SizedBox(height: 10),
          Text('${item.covered}/${item.total} topics covered'),
          const SizedBox(height: 4),
          Text(
            'Next topic: ${item.nextTopic}',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _TeacherAnnouncementCard extends StatelessWidget {
  const _TeacherAnnouncementCard({required this.item});

  final TeacherAnnouncement item;

  @override
  Widget build(BuildContext context) {
    return TeacherCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.skyBlue600.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.campaign_rounded,
              color: AppColors.skyBlue600,
            ),
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
                        item.title,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                    ),
                    TeacherStatusPill(
                      label: item.target.toUpperCase(),
                      color: AppColors.accentTeal,
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  item.body,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.4),
                ),
                const SizedBox(height: 8),
                Text(
                  item.dateLabel,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CompactDataRow extends StatelessWidget {
  const _CompactDataRow({
    required this.label,
    required this.value,
    required this.color,
  });

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          TeacherStatusPill(label: value, color: color),
        ],
      ),
    );
  }
}

class _AssessmentCard extends StatelessWidget {
  const _AssessmentCard({required this.item, this.onTap});
  final TeacherAssessment item;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final color = assessmentStatusColor(item.status);
    return TeacherCard(
      onTap: onTap,
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${item.enteredCount}/${item.totalStudents} entered - ${item.dueLabel}',
                ),
              ],
            ),
          ),
          TeacherStatusPill(
            label: assessmentStatusLabel(item.status),
            color: color,
          ),
        ],
      ),
    );
  }
}

class _StudentCard extends StatelessWidget {
  const _StudentCard({required this.student});
  final TeacherStudent student;
  @override
  Widget build(BuildContext context) {
    return TeacherCard(
      onTap: () => context.push('/teacher/students/${student.id}/performance'),
      child: Row(
        children: [
          KSAvatar(name: student.name, size: 42),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  student.name,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  '${student.registrationNumber} - ${student.averageScore.toStringAsFixed(0)}% avg',
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

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert, this.onTap});
  final TeacherPerformanceAlert alert;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final color = alert.severity == TeacherAlertSeverity.critical
        ? AppColors.accentRose
        : AppColors.accentAmber;
    return TeacherCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(Icons.warning_rounded, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  alert.type,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                Text(
                  '${alert.studentName} - ${alert.classLabel} - ${alert.subject}',
                ),
                Text(alert.message),
              ],
            ),
          ),
          TeacherStatusPill(
            label: '${alert.currentScore.toStringAsFixed(0)}%',
            color: color,
          ),
        ],
      ),
    );
  }
}

class _PairingCard extends StatelessWidget {
  const _PairingCard({required this.pairing, this.onTap});
  final TeacherPairing pairing;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    return TeacherCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${pairing.subject} ${pairing.classLabel}',
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _MiniStudent(
                  label: 'Needs support',
                  student: pairing.supportStudent,
                ),
              ),
              const Icon(Icons.arrow_forward_rounded),
              Expanded(
                child: _MiniStudent(
                  label: 'Mentor',
                  student: pairing.mentorStudent,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(pairing.reason),
        ],
      ),
    );
  }
}

class _MiniStudent extends StatelessWidget {
  const _MiniStudent({required this.label, required this.student});
  final String label;
  final TeacherStudent student;
  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        KSAvatar(name: student.name, size: 38),
        const SizedBox(height: 6),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        Text(
          student.firstName,
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
      ],
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
    return TeacherCard(
      margin: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color),
          const Spacer(),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900),
          ),
          Text(label),
        ],
      ),
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
      width: 62,
      height: 62,
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.16),
        shape: BoxShape.circle,
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

Color _dayColor(String day) => switch (day) {
  'Mon' => AppColors.skyBlue600,
  'Tue' => AppColors.accentTeal,
  'Wed' => AppColors.accentIndigo,
  'Thu' => AppColors.accentAmber,
  'Fri' => AppColors.accentEmerald,
  _ => AppColors.textSecondary,
};
