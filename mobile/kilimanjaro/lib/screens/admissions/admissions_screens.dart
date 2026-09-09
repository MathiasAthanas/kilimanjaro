import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

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

  Future<void> _advance(
      BuildContext context, WidgetRef ref, String toStage) async {
    final service = ref.read(admissionsServiceProvider);
    try {
      await service.transitionStage(
        applicantId: applicant.id,
        toStage: toStage,
        note: 'Updated from the mobile admissions desk',
      );
      ref.invalidate(applicantDetailProvider(applicant.id));
      ref.invalidate(applicantsProvider);
      ref.invalidate(admissionsSummaryProvider);
      if (context.mounted) {
        ref
            .read(snackbarProvider.notifier)
            .show('Moved to ${_stageLabel(toStage)}');
      }
    } catch (_) {
      if (context.mounted) {
        ref
            .read(snackbarProvider.notifier)
            .show('Could not update the stage — try again.');
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final canAdvanceToApplication = applicant.stage == 'INQUIRY';
    final canWithdraw = !['ENROLLED', 'REJECTED', 'WITHDRAWN']
        .contains(applicant.stage);

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
                          _stageColor(applicant.stage).withValues(alpha: 0.12),
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
        KSButton(
          label: 'Call Guardian',
          icon:
              const Icon(Icons.call_rounded, size: 18, color: Colors.white),
          onPressed: _callGuardian,
        ),
        if (canAdvanceToApplication) ...[
          const SizedBox(height: 10),
          KSButton(
            label: 'Move to Application',
            secondary: true,
            onPressed: () => _advance(context, ref, 'APPLICATION'),
          ),
        ],
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
                    : '${event.createdAt!.day.toString().padLeft(2, '0')}'
                        '/${event.createdAt!.month.toString().padLeft(2, '0')}'
                        '/${event.createdAt!.year}';
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
        const SizedBox(height: 12),
        CommonCard(
          child: Row(
            children: [
              const Icon(Icons.laptop_mac_rounded,
                  size: 20, color: AppColors.skyBlue600),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Assessments, offers and enrolment are completed in the web admissions workspace.',
                  style: TextStyle(
                      fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ],
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
