import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/network/api_failure.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/providers/principal_provider.dart';
import '../../core/providers/snackbar_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/common_screen_surface.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';

String _tzs(double value) {
  if (value >= 1000000000) return 'TZS ${(value / 1000000000).toStringAsFixed(1)}B';
  if (value >= 1000000) return 'TZS ${(value / 1000000).toStringAsFixed(1)}M';
  if (value >= 1000) return 'TZS ${(value / 1000).toStringAsFixed(0)}K';
  return 'TZS ${value.toStringAsFixed(0)}';
}

String _firstName(String fullName) {
  final parts = fullName.split(' ').where((p) => p.isNotEmpty && !p.endsWith('.')).toList();
  return parts.isEmpty ? fullName : parts.first;
}

Widget _loading() => const Padding(
      padding: EdgeInsets.symmetric(vertical: 48),
      child: Center(child: CircularProgressIndicator()),
    );

Widget _error(Object error) => KSEmptyState(
      title: 'Could not load this view',
      subtitle: ApiFailure.from(error).message,
    );

// ─── Home ────────────────────────────────────────────────────────────────────

class PrincipalHomeScreen extends ConsumerWidget {
  const PrincipalHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(principalOverviewProvider);
    final user = ref.watch(currentUserProvider).valueOrNull;

    return Scaffold(
      appBar: KSAppBar(
        title: user != null ? 'Hi ${_firstName(user.name)}' : 'Principal',
        subtitle: 'School pulse and decisions waiting for you.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => refreshPrincipalData(ref),
        child: CommonScreenSurface(
          children: [
            overviewAsync.when(
              loading: _loading,
              error: (e, _) => _error(e),
              data: (o) => Column(
                children: [
                  _MetricRow(
                    _Metric('School average', '${o.schoolAverage.toStringAsFixed(1)}%', Icons.insights_rounded, AppColors.skyBlue600),
                    _Metric('Pass rate', '${o.passRate.toStringAsFixed(1)}%', Icons.verified_rounded, AppColors.accentEmerald),
                  ),
                  _MetricRow(
                    _Metric('Attendance', '${o.attendanceRate.toStringAsFixed(1)}%', Icons.event_available_rounded, AppColors.accentTeal),
                    _Metric('Active students', '${o.activeStudents}', Icons.groups_rounded, AppColors.accentIndigo),
                  ),
                  _MetricRow(
                    _Metric('Fees collected', _tzs(o.collected), Icons.payments_rounded, AppColors.accentEmerald),
                    _Metric('Outstanding', _tzs(o.outstanding), Icons.account_balance_wallet_rounded, AppColors.accentAmber),
                  ),
                  const SizedBox(height: 18),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Needs your attention', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                  ),
                  const SizedBox(height: 10),
                  _AttentionTile(
                    icon: Icons.fact_check_rounded,
                    color: AppColors.skyBlue600,
                    title: '${o.pendingApprovals} mark sheets awaiting approval',
                    subtitle: 'Approved by HODs and ready for your final decision.',
                    onTap: () => context.go('/shell/principal/approvals'),
                  ),
                  _AttentionTile(
                    icon: Icons.request_quote_rounded,
                    color: AppColors.accentAmber,
                    title: '${o.pendingPayments} payments awaiting approval',
                    subtitle: 'Manual payments recorded by the finance office.',
                    onTap: () => context.go('/shell/principal/finance'),
                  ),
                  _AttentionTile(
                    icon: Icons.warning_amber_rounded,
                    color: AppColors.accentRose,
                    title: '${o.atRiskCount} learners flagged at risk',
                    subtitle: 'Review performance alerts and intervene early.',
                    onTap: () => context.go('/shell/principal/at-risk'),
                  ),
                  if (o.openDiscipline > 0)
                    _AttentionTile(
                      icon: Icons.gavel_rounded,
                      color: AppColors.accentViolet,
                      title: '${o.openDiscipline} discipline records',
                      subtitle: 'Recent behaviour incidents recorded by teachers.',
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

class _MetricRow extends StatelessWidget {
  const _MetricRow(this.left, this.right);

  final Widget left;
  final Widget right;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SizedBox(
        height: 112,
        child: Row(
          children: [
            Expanded(child: left),
            const SizedBox(width: 12),
            Expanded(child: right),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.label, this.value, this.icon, this.color);

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CommonCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 22),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          ),
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.textSecondary)),
        ],
      ),
    );
  }
}

class _AttentionTile extends StatelessWidget {
  const _AttentionTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GestureDetector(
        onTap: onTap,
        child: CommonCard(
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(14)),
                child: Icon(icon, color: color),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 2),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
              if (onTap != null) const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Approvals (marks) ───────────────────────────────────────────────────────

Future<String?> _askReason(BuildContext context, String title) async {
  final controller = TextEditingController();
  final reason = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLines: 3,
        decoration: const InputDecoration(hintText: 'Reason (required)'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            final text = controller.text.trim();
            if (text.isNotEmpty) Navigator.of(dialogContext).pop(text);
          },
          child: const Text('Reject'),
        ),
      ],
    ),
  );
  controller.dispose();
  return reason;
}

Future<bool> _confirm(BuildContext context, String title, String body) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: const Text('Approve')),
      ],
    ),
  );
  return result ?? false;
}

class PrincipalApprovalsScreen extends ConsumerWidget {
  const PrincipalApprovalsScreen({super.key});

  Future<void> _decide(
    BuildContext context,
    WidgetRef ref,
    Future<void> Function() action,
    String successMessage,
  ) async {
    final snackbar = ref.read(snackbarProvider.notifier);
    try {
      await action();
      refreshPrincipalData(ref);
      snackbar.show(successMessage);
    } catch (e) {
      snackbar.show(ApiFailure.from(e).message, isError: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final approvalsAsync = ref.watch(principalApprovalsProvider);
    final service = ref.read(principalServiceProvider);

    return Scaffold(
      appBar: const KSAppBar(
        title: 'Marks Approval',
        subtitle: 'Final approval locks results and publishes them.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(principalApprovalsProvider),
        child: CommonScreenSurface(
          children: [
            approvalsAsync.when(
              loading: _loading,
              error: (e, _) => _error(e),
              data: (items) => items.isEmpty
                  ? const KSEmptyState(
                      title: 'Nothing waiting',
                      subtitle: 'Mark sheets approved by heads of department will appear here.',
                    )
                  : Column(
                      children: [
                        for (final item in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: CommonCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(item.title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                                  const SizedBox(height: 4),
                                  Text(
                                    [item.subject, item.classLabel].where((e) => e.isNotEmpty).join(' · '),
                                    style: const TextStyle(color: AppColors.textSecondary),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    [
                                      if (item.teacherName.isNotEmpty) item.teacherName,
                                      if (item.submittedAgo.isNotEmpty) item.submittedAgo,
                                      if (item.studentCount > 0) '${item.studentCount} students',
                                    ].join(' · '),
                                    style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                                  ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton(
                                          onPressed: () async {
                                            final reason = await _askReason(context, 'Reject marks');
                                            if (reason == null || !context.mounted) return;
                                            await _decide(context, ref, () => service.rejectMarks(item.id, reason), 'Marks sent back to the teacher.');
                                          },
                                          child: const Text('Reject'),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: FilledButton(
                                          onPressed: () async {
                                            final ok = await _confirm(context, 'Approve marks?', '${item.title} will be locked and published.');
                                            if (!ok || !context.mounted) return;
                                            await _decide(context, ref, () => service.approveMarks(item.id), 'Marks approved.');
                                          },
                                          child: const Text('Approve'),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
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

// ─── Finance ─────────────────────────────────────────────────────────────────

String _methodLabel(String raw) {
  if (raw.isEmpty) return '';
  final words = raw.replaceAll('_', ' ').toLowerCase().split(' ');
  return words.map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}').join(' ');
}

String _waiting(DateTime since) {
  final d = DateTime.now().difference(since);
  if (d.inMinutes < 60) return d.inMinutes <= 1 ? 'just now' : '${d.inMinutes} min';
  if (d.inHours < 24) return '${d.inHours} h';
  return '${d.inDays} d ${d.inHours % 24} h';
}

class PrincipalFinanceScreen extends ConsumerWidget {
  const PrincipalFinanceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(principalOverviewProvider);
    final paymentsAsync = ref.watch(principalPaymentsProvider);
    final service = ref.read(principalServiceProvider);
    final snackbar = ref.read(snackbarProvider.notifier);

    Future<void> run(Future<void> Function() action, String message) async {
      try {
        await action();
        refreshPrincipalData(ref);
        snackbar.show(message);
      } catch (e) {
        snackbar.show(ApiFailure.from(e).message, isError: true);
      }
    }

    return Scaffold(
      appBar: const KSAppBar(
        title: 'Finance',
        subtitle: 'Collections and payments awaiting your approval.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => refreshPrincipalData(ref),
        child: CommonScreenSurface(
          children: [
            overviewAsync.maybeWhen(
              data: (o) => Column(
                children: [
                  CommonCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Collection rate', style: Theme.of(context).textTheme.labelLarge),
                        const SizedBox(height: 6),
                        Text('${o.collectionRate.toStringAsFixed(1)}%', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        LinearProgressIndicator(value: (o.collectionRate / 100).clamp(0.0, 1.0), minHeight: 8, borderRadius: BorderRadius.circular(8)),
                        const SizedBox(height: 10),
                        Text('Collected ${_tzs(o.collected)} · Outstanding ${_tzs(o.outstanding)}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],
              ),
              orElse: () => const SizedBox.shrink(),
            ),
            Text('Payments awaiting approval', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            paymentsAsync.when(
              loading: _loading,
              error: (e, _) => _error(e),
              data: (items) => items.isEmpty
                  ? const KSEmptyState(title: 'No payments waiting', subtitle: 'Manual payments needing approval will appear here.')
                  : Column(
                      children: [
                        for (final p in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: CommonCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(p.studentName.isEmpty ? 'Payment' : p.studentName, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                                            if (p.registrationNumber.isNotEmpty)
                                              Text(p.registrationNumber, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                          ],
                                        ),
                                      ),
                                      Text(_tzs(p.amount), style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    [
                                      if (p.invoiceNumber.isNotEmpty) 'Invoice ${p.invoiceNumber}',
                                      _methodLabel(p.method),
                                      if (p.reference.isNotEmpty) 'Ref ${p.reference}',
                                    ].where((e) => e.isNotEmpty).join(' · '),
                                    style: const TextStyle(color: AppColors.textSecondary),
                                  ),
                                  if (p.requestedAt != null)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text('Waiting ${_waiting(p.requestedAt!)}', style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                    ),
                                  if (p.notes != null && p.notes!.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(p.notes!, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                                    ),
                                  const SizedBox(height: 12),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: OutlinedButton(
                                          onPressed: () async {
                                            final reason = await _askReason(context, 'Reject payment');
                                            if (reason == null) return;
                                            await run(() => service.rejectPayment(p.approvalId, reason), 'Payment rejected.');
                                          },
                                          child: const Text('Reject'),
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: FilledButton(
                                          onPressed: () async {
                                            final ok = await _confirm(context, 'Approve payment?', '${_tzs(p.amount)} for ${p.studentName.isEmpty ? 'this invoice' : p.studentName} will be applied to the invoice and a receipt issued.');
                                            if (!ok) return;
                                            await run(() => service.approvePayment(p.approvalId), 'Payment approved.');
                                          },
                                          child: const Text('Approve'),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
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

// ─── At-risk learners ────────────────────────────────────────────────────────

class PrincipalAtRiskScreen extends ConsumerWidget {
  const PrincipalAtRiskScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final alertsAsync = ref.watch(principalAtRiskProvider);

    return Scaffold(
      appBar: const KSAppBar(
        title: 'At-Risk Learners',
        subtitle: 'High and critical performance alerts across the school.',
        showBack: false,
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(principalAtRiskProvider),
        child: CommonScreenSurface(
          children: [
            alertsAsync.when(
              loading: _loading,
              error: (e, _) => _error(e),
              data: (items) => items.isEmpty
                  ? const KSEmptyState(title: 'No learners at risk', subtitle: 'Performance alerts will appear here.')
                  : Column(
                      children: [
                        for (final a in items)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: CommonCard(
                              child: Row(
                                children: [
                                  Container(
                                    width: 6,
                                    height: 52,
                                    decoration: BoxDecoration(
                                      color: a.severity == 'CRITICAL' ? AppColors.accentRose : AppColors.accentAmber,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(a.title.isEmpty ? a.subject : a.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                                        const SizedBox(height: 2),
                                        Text(a.message, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                                      ],
                                    ),
                                  ),
                                  Text('${a.score.toStringAsFixed(0)}%', style: const TextStyle(fontWeight: FontWeight.w900)),
                                ],
                              ),
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
