import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/network/api_failure.dart';
import '../../core/providers/admissions_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/admissions_models.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_button.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_text_field.dart';

// ─── Stage helpers ────────────────────────────────────────────────────────────

const _stageOrder = [
  'INQUIRY',
  'APPLICATION',
  'ASSESSMENT',
  'OFFER',
  'ACCEPTED',
  'ENROLLED',
  'REJECTED',
  'WITHDRAWN',
];

String _stageLabel(String stage) => switch (stage) {
      'INQUIRY' => 'Inquiry',
      'APPLICATION' => 'Application',
      'ASSESSMENT' => 'Assessment',
      'OFFER' => 'Offer',
      'ACCEPTED' => 'Accepted',
      'ENROLLED' => 'Enrolled',
      'REJECTED' => 'Rejected',
      'WITHDRAWN' => 'Withdrawn',
      _ => stage,
    };

Color _stageColor(String stage) => switch (stage) {
      'INQUIRY' => AppColors.accentAmber,
      'APPLICATION' => AppColors.skyBlue600,
      'ASSESSMENT' => AppColors.accentViolet,
      'OFFER' => AppColors.accentTeal,
      'ACCEPTED' || 'ENROLLED' => AppColors.accentEmerald,
      'REJECTED' => AppColors.accentRose,
      _ => AppColors.textSecondary,
    };

String _sourceLabel(String channel) => switch (channel) {
      'WALK_IN' => 'Walk-in',
      'REFERRAL' => 'Referral',
      'WEBSITE' => 'Website',
      'SOCIAL_MEDIA' => 'Social media',
      'PHONE_CALL' => 'Phone call',
      'SCHOOL_EVENT' => 'School event',
      _ => 'Other',
    };

// ─── Home: pipeline summary ───────────────────────────────────────────────────

class AdmissionsHomeScreen extends ConsumerWidget {
  const AdmissionsHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summaryAsync = ref.watch(admissionsSummaryProvider);
    final applicantsAsync = ref.watch(applicantsProvider(null));

    return Scaffold(
      appBar: KSAppBar(
        title: 'Admissions Desk',
        subtitle: 'Every prospective family, from hello to enrolled.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(admissionsSummaryProvider);
          ref.invalidate(applicantsProvider);
        },
        child: CommonScreenSurface(
          children: [
            summaryAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const KSEmptyState(
                title: 'Could not load the pipeline',
                subtitle: 'Check your connection and pull to refresh.',
              ),
              data: (summary) => summary == null
                  ? const KSEmptyState(
                      title: 'Could not load the pipeline',
                      subtitle: 'Check your connection and pull to refresh.',
                    )
                  : _SummarySection(summary: summary),
            ),
            const SizedBox(height: 8),
            KSButton(
              label: 'Capture New Inquiry',
              icon: const Icon(Icons.person_add_alt_1_rounded,
                  size: 18, color: Colors.white),
              onPressed: () => context.go('/shell/admissions/inquiry'),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Recent Applicants',
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w800)),
                TextButton(
                  onPressed: () => context.go('/shell/admissions/applicants'),
                  child: const Text('View all'),
                ),
              ],
            ),
            applicantsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const SizedBox.shrink(),
              data: (applicants) => applicants.isEmpty
                  ? const KSEmptyState(
                      title: 'No applicants yet',
                      subtitle:
                          'Capture your first inquiry to start the pipeline.',
                    )
                  : Column(
                      children: applicants
                          .take(5)
                          .map((a) => _ApplicantTile(applicant: a))
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummarySection extends StatelessWidget {
  const _SummarySection({required this.summary});

  final AdmissionsSummary summary;

  @override
  Widget build(BuildContext context) {
    final activeStages =
        _stageOrder.where((s) => !['REJECTED', 'WITHDRAWN'].contains(s));
    final maxCount = summary.funnel.values.fold<int>(1, (m, v) => v > m ? v : m);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: CommonMetricPill(
                label: 'Active',
                value: '${summary.active}',
                iconAsset: 'assets/icons/user-group.svg',
                color: AppColors.skyBlue600,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CommonMetricPill(
                label: 'Enrolled',
                value: '${summary.enrolled}',
                iconAsset: 'assets/icons/graduation-cap.svg',
                color: AppColors.accentEmerald,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: CommonMetricPill(
                label: 'Conversion',
                value: '${summary.conversionRate.toStringAsFixed(0)}%',
                iconAsset: 'assets/icons/trending-up.svg',
                color: AppColors.accentAmber,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        CommonCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Pipeline Funnel',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              ...activeStages.map((stage) {
                final count = summary.funnel[stage] ?? 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(_stageLabel(stage),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: _stageColor(stage),
                              )),
                          Text('$count',
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w800)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: LinearProgressIndicator(
                          value: count / maxCount,
                          minHeight: 6,
                          backgroundColor:
                              _stageColor(stage).withValues(alpha: 0.12),
                          valueColor: AlwaysStoppedAnimation<Color>(
                              _stageColor(stage)),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Applicants list ──────────────────────────────────────────────────────────

class AdmissionsApplicantsScreen extends ConsumerStatefulWidget {
  const AdmissionsApplicantsScreen({super.key});

  @override
  ConsumerState<AdmissionsApplicantsScreen> createState() =>
      _AdmissionsApplicantsScreenState();
}

class _AdmissionsApplicantsScreenState
    extends ConsumerState<AdmissionsApplicantsScreen> {
  String? _stage;

  @override
  Widget build(BuildContext context) {
    final applicantsAsync = ref.watch(applicantsProvider(_stage));

    return Scaffold(
      appBar: KSAppBar(
        title: 'Applicants',
        subtitle: 'The full admissions register.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(applicantsProvider),
        child: CommonScreenSurface(
          children: [
            SizedBox(
              height: 40,
              child: ListView(
                scrollDirection: Axis.horizontal,
                children: [null, ..._stageOrder].map((stage) {
                  final selected = _stage == stage;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ChoiceChip(
                      label: Text(stage == null ? 'All' : _stageLabel(stage)),
                      selected: selected,
                      onSelected: (_) => setState(() => _stage = stage),
                    ),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 12),
            applicantsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (_, __) => const KSEmptyState(
                title: 'Could not load applicants',
                subtitle: 'Check your connection and pull to refresh.',
              ),
              data: (applicants) => applicants.isEmpty
                  ? const KSEmptyState(
                      title: 'No applicants in this stage',
                      subtitle: 'Try a different stage filter.',
                    )
                  : Column(
                      children: applicants
                          .map((a) => _ApplicantTile(applicant: a))
                          .toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ApplicantTile extends StatelessWidget {
  const _ApplicantTile({required this.applicant});

  final AdmissionApplicant applicant;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: () =>
            context.go('/shell/admissions/applicants/${applicant.id}'),
        child: CommonCard(
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: _stageColor(applicant.stage).withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(12),
              ),
              alignment: Alignment.center,
              child: Text(
                applicant.fullName.isEmpty
                    ? '?'
                    : applicant.fullName
                        .trim()
                        .split(' ')
                        .map((p) => p.isEmpty ? '' : p[0])
                        .take(2)
                        .join()
                        .toUpperCase(),
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: _stageColor(applicant.stage),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(applicant.fullName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(
                    applicant.className ?? 'Class not set',
                    style: TextStyle(
                        fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: _stageColor(applicant.stage).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                _stageLabel(applicant.stage),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: _stageColor(applicant.stage),
                ),
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }
}

// ─── Applicant detail ─────────────────────────────────────────────────────────

class AdmissionsApplicantDetailScreen extends ConsumerWidget {
  const AdmissionsApplicantDetailScreen({super.key, required this.applicantId});

  final String applicantId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final applicantAsync = ref.watch(applicantDetailProvider(applicantId));

    return Scaffold(
      appBar: KSAppBar(
        title: applicantAsync.value?.fullName ?? 'Applicant',
        subtitle: 'Admissions file',
      ),
      body: applicantAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => const KSEmptyState(
          title: 'Could not load this applicant',
          subtitle: 'Check your connection and try again.',
        ),
        data: (applicant) {
          if (applicant == null) {
            return const KSEmptyState(
              title: 'Applicant not found',
              subtitle: 'The record may have been removed.',
            );
          }
          return _ApplicantDetailBody(applicant: applicant);
        },
      ),
    );
  }
}

class _ApplicantDetailBody extends ConsumerWidget {
  const _ApplicantDetailBody({required this.applicant});

  final AdmissionApplicant applicant;

  Future<void> _callGuardian() async {
    final uri = Uri.parse('tel:${applicant.guardianPhone}');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  void _refresh(WidgetRef ref) {
    ref.invalidate(applicantDetailProvider(applicant.id));
    ref.invalidate(applicantsProvider);
    ref.invalidate(admissionsSummaryProvider);
  }

  /// Runs a lifecycle action, refreshes the views, and reports the outcome.
  Future<void> _run(
    BuildContext context,
    WidgetRef ref,
    Future<AdmissionApplicant?> Function() action,
    String success,
  ) async {
    try {
      await action();
      _refresh(ref);
      if (context.mounted) {
        ref.read(snackbarProvider.notifier).show(success);
      }
    } catch (e) {
      if (context.mounted) {
        ref
            .read(snackbarProvider.notifier)
            .show(ApiFailure.from(e).message);
      }
    }
  }

  Future<void> _advance(
      BuildContext context, WidgetRef ref, String toStage) {
    final service = ref.read(admissionsServiceProvider);
    return _run(
      context,
      ref,
      () => service.transitionStage(
        applicantId: applicant.id,
        toStage: toStage,
        note: 'Updated from the mobile admissions desk',
      ),
      'Moved to ${_stageLabel(toStage)}',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stage = applicant.stage;
    final canWithdraw =
        !['ENROLLED', 'REJECTED', 'WITHDRAWN'].contains(stage);
    final assessment = applicant.latestAssessment;
    final offer = applicant.offer;

    return CommonScreenSurface(
      children: [
        CommonCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(applicant.fullName,
                        style: Theme.of(context)
                            .textTheme
                            .titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color:
                          _stageColor(stage).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      _stageLabel(stage),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: _stageColor(stage),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _DetailRow('Target class', applicant.className ?? 'Not set'),
              _DetailRow('Guardian', applicant.guardianName),
              _DetailRow('Phone', applicant.guardianPhone),
              _DetailRow('Source', _sourceLabel(applicant.sourceChannel)),
              if (applicant.notes?.isNotEmpty ?? false)
                _DetailRow('Notes', applicant.notes!),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: KSButton(
                label: 'Call Guardian',
                icon: const Icon(Icons.call_rounded,
                    size: 18, color: Colors.white),
                onPressed: _callGuardian,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: KSButton(
                label: 'Edit',
                secondary: true,
                icon: const Icon(Icons.edit_rounded, size: 18),
                onPressed: () => _editDetails(context, ref),
              ),
            ),
          ],
        ),

        // ─── Assessment / offer status ──────────────────────────────────
        if (assessment != null) ...[
          const SizedBox(height: 12),
          _StatusCard(
            icon: Icons.fact_check_rounded,
            color: AppColors.accentViolet,
            title: 'Assessment',
            lines: [
              if (assessment.scheduledAt != null)
                'Scheduled ${_shortDate(assessment.scheduledAt!)}',
              if (assessment.subjectFocus?.isNotEmpty ?? false)
                'Focus: ${assessment.subjectFocus}',
              'Outcome: ${assessment.outcome}'
                  '${assessment.score != null ? ' · ${assessment.score!.toStringAsFixed(0)}'
                      '${assessment.maxScore != null ? '/${assessment.maxScore!.toStringAsFixed(0)}' : ''}' : ''}',
            ],
          ),
        ],
        if (offer != null) ...[
          const SizedBox(height: 12),
          _StatusCard(
            icon: Icons.mail_rounded,
            color: AppColors.accentTeal,
            title: 'Offer',
            lines: [
              'Decision: ${offer.decision}',
              if (offer.feeExpectation != null)
                'Fee expectation: ${offer.feeExpectation!.toStringAsFixed(0)}',
              if (offer.expiresAt != null)
                'Expires ${_shortDate(offer.expiresAt!)}',
            ],
          ),
        ],

        // ─── Stage-appropriate lifecycle actions ────────────────────────
        const SizedBox(height: 16),
        Text('Actions',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        ..._actionsForStage(context, ref, stage, assessment, offer),
        if (canWithdraw) ...[
          const SizedBox(height: 10),
          KSButton(
            label: 'Mark as Withdrawn',
            secondary: true,
            onPressed: () => _advance(context, ref, 'WITHDRAWN'),
          ),
        ],

        const SizedBox(height: 16),
        Text('Stage Timeline',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        if (applicant.stageEvents.isEmpty)
          const KSEmptyState(
            title: 'No events yet',
            subtitle: 'Stage changes are recorded here with dates.',
          )
        else
          CommonCard(
            child: Column(
              children: applicant.stageEvents.map((event) {
                final dateLabel = event.createdAt == null
                    ? ''
                    : _shortDate(event.createdAt!);
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(top: 5),
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          color: _stageColor(event.toStage),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_stageLabel(event.toStage),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800)),
                            if (event.note?.isNotEmpty ?? false)
                              Text(event.note!,
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: AppColors.textSecondary)),
                          ],
                        ),
                      ),
                      Text(dateLabel,
                          style: TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary)),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
      ],
    );
  }

  List<Widget> _actionsForStage(
    BuildContext context,
    WidgetRef ref,
    String stage,
    AdmissionAssessment? assessment,
    AdmissionOffer? offer,
  ) {
    final buttons = <Widget>[];
    void add(String label, VoidCallback onPressed, {bool primary = false}) {
      buttons
        ..add(const SizedBox(height: 10))
        ..add(KSButton(label: label, secondary: !primary, onPressed: onPressed));
    }

    switch (stage) {
      case 'INQUIRY':
        add('Move to Application', () => _advance(context, ref, 'APPLICATION'),
            primary: true);
        break;
      case 'APPLICATION':
        add('Schedule Assessment', () => _scheduleAssessment(context, ref),
            primary: true);
        break;
      case 'ASSESSMENT':
        add('Record Assessment Outcome',
            () => _recordOutcome(context, ref, assessment),
            primary: true);
        if (assessment != null &&
            (assessment.outcome == 'PASSED' || assessment.outcome == 'WAIVED')) {
          add('Issue Offer', () => _issueOffer(context, ref));
        }
        break;
      case 'OFFER':
        add('Record Guardian Decision', () => _decideOffer(context, ref),
            primary: true);
        add('Re-issue Offer', () => _issueOffer(context, ref));
        break;
      case 'ACCEPTED':
        add('Convert to Enrolled Student', () => _convert(context, ref),
            primary: true);
        break;
      case 'ENROLLED':
        buttons.add(const SizedBox(height: 4));
        buttons.add(const _StatusCard(
          icon: Icons.verified_rounded,
          color: AppColors.accentEmerald,
          title: 'Enrolled',
          lines: ['This applicant is now an enrolled student.'],
        ));
        break;
      default:
        break;
    }
    return buttons;
  }

  // ─── Action sheets ──────────────────────────────────────────────────────

  Future<void> _editDetails(BuildContext context, WidgetRef ref) async {
    final phone = TextEditingController(text: applicant.guardianPhone);
    final notes = TextEditingController(text: applicant.notes ?? '');
    final saved = await _showFormSheet(
      context,
      title: 'Edit details',
      fields: [
        KSTextField(
            controller: phone,
            label: 'Guardian phone',
            keyboardType: TextInputType.phone),
        const SizedBox(height: 12),
        KSTextField(controller: notes, label: 'Notes'),
      ],
    );
    if (saved != true) return;
    if (!context.mounted) return;
    final service = ref.read(admissionsServiceProvider);
    await _run(
      context,
      ref,
      () => service.updateApplicant(applicant.id, {
        'guardianPhone': phone.text.trim(),
        'notes': notes.text.trim(),
      }),
      'Details updated',
    );
  }

  Future<void> _scheduleAssessment(BuildContext context, WidgetRef ref) async {
    DateTime when = DateTime.now().add(const Duration(days: 1));
    final subject = TextEditingController();
    final maxScore = TextEditingController(text: '100');
    final notes = TextEditingController();
    final saved = await _showFormSheet(
      context,
      title: 'Schedule assessment',
      fields: [
        _DatePickerRow(
          label: 'When',
          initial: when,
          onChanged: (d) => when = d,
        ),
        const SizedBox(height: 12),
        KSTextField(controller: subject, label: 'Subject focus (optional)'),
        const SizedBox(height: 12),
        KSTextField(
            controller: maxScore,
            label: 'Max score',
            keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        KSTextField(controller: notes, label: 'Notes (optional)'),
      ],
    );
    if (saved != true) return;
    if (!context.mounted) return;
    final service = ref.read(admissionsServiceProvider);
    await _run(
      context,
      ref,
      () => service.scheduleAssessment(
        applicantId: applicant.id,
        scheduledAt: when,
        subjectFocus: subject.text.trim(),
        maxScore: double.tryParse(maxScore.text.trim()),
        notes: notes.text.trim(),
      ),
      'Assessment scheduled',
    );
  }

  Future<void> _recordOutcome(
      BuildContext context, WidgetRef ref, AdmissionAssessment? assessment) async {
    if (assessment == null) {
      ref
          .read(snackbarProvider.notifier)
          .show('Schedule an assessment first.');
      return;
    }
    final score = TextEditingController(
        text: assessment.score?.toStringAsFixed(0) ?? '');
    final notes = TextEditingController(text: assessment.notes ?? '');
    String outcome = assessment.outcome == 'PENDING' ? 'PASSED' : assessment.outcome;
    final saved = await _showFormSheet(
      context,
      title: 'Record outcome',
      fields: [
        _OutcomeDropdown(
          initial: outcome,
          onChanged: (v) => outcome = v,
        ),
        const SizedBox(height: 12),
        KSTextField(
            controller: score,
            label: 'Score (optional)',
            keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        KSTextField(controller: notes, label: 'Notes (optional)'),
      ],
    );
    if (saved != true) return;
    if (!context.mounted) return;
    final service = ref.read(admissionsServiceProvider);
    await _run(
      context,
      ref,
      () => service.recordAssessment(
        assessmentId: assessment.id,
        score: double.tryParse(score.text.trim()),
        outcome: outcome,
        notes: notes.text.trim(),
      ),
      'Outcome recorded',
    );
  }

  Future<void> _issueOffer(BuildContext context, WidgetRef ref) async {
    final classId =
        TextEditingController(text: applicant.prospectiveClassId ?? '');
    final fee = TextEditingController();
    final note = TextEditingController();
    DateTime? expiry;
    final saved = await _showFormSheet(
      context,
      title: 'Issue offer',
      fields: [
        KSTextField(
            controller: classId,
            label: 'Class ID',
            hint: 'Defaults to the prospective class'),
        const SizedBox(height: 12),
        KSTextField(
            controller: fee,
            label: 'Fee expectation (optional)',
            keyboardType: TextInputType.number),
        const SizedBox(height: 12),
        _DatePickerRow(
          label: 'Expires (optional)',
          initial: DateTime.now().add(const Duration(days: 14)),
          onChanged: (d) => expiry = d,
        ),
        const SizedBox(height: 12),
        KSTextField(controller: note, label: 'Note (optional)'),
      ],
    );
    if (saved != true) return;
    if (classId.text.trim().isEmpty) {
      if (context.mounted) {
        ref.read(snackbarProvider.notifier).show('A class ID is required.');
      }
      return;
    }
    if (!context.mounted) return;
    final service = ref.read(admissionsServiceProvider);
    await _run(
      context,
      ref,
      () => service.issueOffer(
        applicantId: applicant.id,
        classId: classId.text.trim(),
        feeExpectation: double.tryParse(fee.text.trim()),
        expiresAt: expiry,
        note: note.text.trim(),
      ),
      'Offer issued',
    );
  }

  Future<void> _decideOffer(BuildContext context, WidgetRef ref) async {
    String decision = 'ACCEPTED';
    final note = TextEditingController();
    final saved = await _showFormSheet(
      context,
      title: 'Guardian decision',
      fields: [
        _DecisionDropdown(initial: decision, onChanged: (v) => decision = v),
        const SizedBox(height: 12),
        KSTextField(controller: note, label: 'Note (optional)'),
      ],
    );
    if (saved != true) return;
    if (!context.mounted) return;
    final service = ref.read(admissionsServiceProvider);
    await _run(
      context,
      ref,
      () => service.decideOffer(
        applicantId: applicant.id,
        decision: decision,
        note: note.text.trim(),
      ),
      decision == 'ACCEPTED' ? 'Offer accepted' : 'Offer declined',
    );
  }

  Future<void> _convert(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Convert to student?'),
        content: Text(
            'This enrolls ${applicant.fullName} as a student and creates their '
            'account, class placement and invoice. This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Convert')),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!context.mounted) return;
    final service = ref.read(admissionsServiceProvider);
    await _run(
      context,
      ref,
      () => service.convert(applicantId: applicant.id),
      'Applicant enrolled as a student',
    );
  }
}

String _shortDate(DateTime d) =>
    '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

/// Shows a bottom sheet with the given fields and a Save/Cancel footer.
/// Returns true when the user taps Save.
Future<bool?> _showFormSheet(
  BuildContext context, {
  required String title,
  required List<Widget> fields,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (ctx) => Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 8,
        bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: Theme.of(ctx)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 16),
          ...fields,
          const SizedBox(height: 20),
          KSButton(
            label: 'Save',
            onPressed: () => Navigator.of(ctx).pop(true),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
        ],
      ),
    ),
  );
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.lines,
  });

  final IconData icon;
  final Color color;
  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    return CommonCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                ...lines.map((l) => Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: Text(l,
                          style: TextStyle(
                              fontSize: 12, color: AppColors.textSecondary)),
                    )),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DatePickerRow extends StatefulWidget {
  const _DatePickerRow({
    required this.label,
    required this.initial,
    required this.onChanged,
  });

  final String label;
  final DateTime initial;
  final ValueChanged<DateTime> onChanged;

  @override
  State<_DatePickerRow> createState() => _DatePickerRowState();
}

class _DatePickerRowState extends State<_DatePickerRow> {
  late DateTime _value = widget.initial;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final picked = await showDatePicker(
          context: context,
          initialDate: _value,
          firstDate: DateTime.now().subtract(const Duration(days: 365)),
          lastDate: DateTime.now().add(const Duration(days: 365 * 2)),
        );
        if (picked != null) {
          setState(() => _value = picked);
          widget.onChanged(picked);
        }
      },
      child: InputDecorator(
        decoration: InputDecoration(labelText: widget.label),
        child: Text(_shortDate(_value)),
      ),
    );
  }
}

class _OutcomeDropdown extends StatefulWidget {
  const _OutcomeDropdown({required this.initial, required this.onChanged});
  final String initial;
  final ValueChanged<String> onChanged;

  @override
  State<_OutcomeDropdown> createState() => _OutcomeDropdownState();
}

class _OutcomeDropdownState extends State<_OutcomeDropdown> {
  late String _value = widget.initial;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: _value,
      decoration: const InputDecoration(labelText: 'Outcome'),
      items: const [
        DropdownMenuItem(value: 'PASSED', child: Text('Passed')),
        DropdownMenuItem(value: 'FAILED', child: Text('Failed')),
        DropdownMenuItem(value: 'WAIVED', child: Text('Waived')),
      ],
      onChanged: (v) {
        if (v == null) return;
        setState(() => _value = v);
        widget.onChanged(v);
      },
    );
  }
}

class _DecisionDropdown extends StatefulWidget {
  const _DecisionDropdown({required this.initial, required this.onChanged});
  final String initial;
  final ValueChanged<String> onChanged;

  @override
  State<_DecisionDropdown> createState() => _DecisionDropdownState();
}

class _DecisionDropdownState extends State<_DecisionDropdown> {
  late String _value = widget.initial;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      initialValue: _value,
      decoration: const InputDecoration(labelText: 'Decision'),
      items: const [
        DropdownMenuItem(value: 'ACCEPTED', child: Text('Accepted')),
        DropdownMenuItem(value: 'DECLINED', child: Text('Declined')),
      ],
      onChanged: (v) {
        if (v == null) return;
        setState(() => _value = v);
        widget.onChanged(v);
      },
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary)),
          ),
          Expanded(
            child: Text(value,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}

// ─── New inquiry capture ──────────────────────────────────────────────────────

class AdmissionsNewInquiryScreen extends ConsumerStatefulWidget {
  const AdmissionsNewInquiryScreen({super.key});

  @override
  ConsumerState<AdmissionsNewInquiryScreen> createState() =>
      _AdmissionsNewInquiryScreenState();
}

class _AdmissionsNewInquiryScreenState
    extends ConsumerState<AdmissionsNewInquiryScreen> {
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _guardianFirst = TextEditingController();
  final _guardianLast = TextEditingController();
  final _guardianPhone = TextEditingController();
  final _notes = TextEditingController();
  String _source = 'WALK_IN';
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_firstName, _lastName, _guardianFirst, _guardianPhone]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _guardianFirst.dispose();
    _guardianLast.dispose();
    _guardianPhone.dispose();
    _notes.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _firstName.text.trim().isNotEmpty &&
      _lastName.text.trim().isNotEmpty &&
      _guardianFirst.text.trim().isNotEmpty &&
      _guardianPhone.text.trim().isNotEmpty &&
      !_saving;

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      final created =
          await ref.read(admissionsServiceProvider).createInquiry(
                NewInquiryInput(
                  firstName: _firstName.text.trim(),
                  lastName: _lastName.text.trim(),
                  guardianFirstName: _guardianFirst.text.trim(),
                  guardianLastName: _guardianLast.text.trim().isEmpty
                      ? _lastName.text.trim()
                      : _guardianLast.text.trim(),
                  guardianPhone: _guardianPhone.text.trim(),
                  sourceChannel: _source,
                  notes: _notes.text.trim(),
                ),
              );
      ref.invalidate(applicantsProvider);
      ref.invalidate(admissionsSummaryProvider);
      if (!mounted) return;
      ref
          .read(snackbarProvider.notifier)
          .show('Inquiry captured for ${created?.fullName ?? 'applicant'}');
      context.go('/shell/admissions/applicants');
    } catch (_) {
      if (!mounted) return;
      ref
          .read(snackbarProvider.notifier)
          .show('Could not save the inquiry — check the details and retry.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: KSAppBar(
        title: 'New Inquiry',
        subtitle: 'Capture a prospective family in under a minute.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: CommonScreenSurface(
        children: [
          KSTextField(controller: _firstName, label: 'Student first name'),
          const SizedBox(height: 12),
          KSTextField(controller: _lastName, label: 'Student last name'),
          const SizedBox(height: 12),
          KSTextField(controller: _guardianFirst, label: 'Guardian first name'),
          const SizedBox(height: 12),
          KSTextField(
              controller: _guardianLast,
              label: 'Guardian last name',
              hint: 'Defaults to the student surname'),
          const SizedBox(height: 12),
          KSTextField(
            controller: _guardianPhone,
            label: 'Guardian phone',
            hint: '0712…, 255712… or +255712… all work',
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _source,
            decoration: const InputDecoration(labelText: 'How did they hear about us?'),
            items: const [
              DropdownMenuItem(value: 'WALK_IN', child: Text('Walk-in')),
              DropdownMenuItem(value: 'REFERRAL', child: Text('Referral')),
              DropdownMenuItem(value: 'WEBSITE', child: Text('Website')),
              DropdownMenuItem(
                  value: 'SOCIAL_MEDIA', child: Text('Social media')),
              DropdownMenuItem(value: 'PHONE_CALL', child: Text('Phone call')),
              DropdownMenuItem(
                  value: 'SCHOOL_EVENT', child: Text('School event')),
              DropdownMenuItem(value: 'OTHER', child: Text('Other')),
            ],
            onChanged: (value) =>
                setState(() => _source = value ?? 'WALK_IN'),
          ),
          const SizedBox(height: 12),
          KSTextField(controller: _notes, label: 'Notes (optional)'),
          const SizedBox(height: 20),
          KSButton(
            label: 'Save Inquiry',
            isLoading: _saving,
            onPressed: _canSubmit ? _submit : null,
          ),
          const SizedBox(height: 8),
          Text(
            'The applicant starts in the Inquiry stage. Class placement, assessments and offers continue in the web workspace.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}
