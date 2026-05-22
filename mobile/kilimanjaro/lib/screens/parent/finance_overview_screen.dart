import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../models/invoice_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_payment_history_row.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ParentFinanceOverviewScreen extends ConsumerWidget {
  const ParentFinanceOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];
    final activeId = ref.watch(activeParentChildIdProvider);
    final activeChild = ref.watch(activeParentChildProvider).value;
    final invoiceAsync = ref.watch(activeParentInvoiceProvider);
    final combinedAsync = ref.watch(parentCombinedOutstandingProvider);
    final paymentsAsync = ref.watch(parentReceiptsProvider);

    return Scaffold(
      appBar: const KSAppBar(
        title: 'School Fees',
        subtitle: 'Total outstanding across all linked children',
        variant: KSAppBarVariant.hero,
        showBack: false,
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(activeParentInvoiceProvider);
          ref.invalidate(parentCombinedOutstandingProvider);
          ref.invalidate(parentReceiptsProvider);
        },
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
            child: ParentSurface(
              children: [
                _CombinedFinanceHero(
                  children: children,
                  total: combinedAsync.value,
                ),
                ParentSectionTitle(
                  title:
                      "${activeChild?.firstName ?? 'Child'}'s Current Invoice",
                ),
                invoiceAsync.when(
                  loading: () =>
                      const ParentCard(child: KSShimmerList(itemCount: 3)),
                  error: (error, stack) => const ParentCard(
                    child: KSEmptyState(title: 'Unable to load', subtitle: 'Try refreshing.'),
                  ),
                  data: (invoice) => _InvoiceCard(
                    invoice: invoice,
                    childName: activeChild?.firstName ?? 'Child',
                    onTap: () =>
                        context.push('/parent/finance/invoice/${invoice.id}'),
                  ),
                ),
                ParentSectionTitle(
                  title: 'Payment History',
                  subtitle: 'Latest receipts across all linked children.',
                  action: 'See all',
                  onAction: () => context.push('/parent/finance/payments'),
                ),
                paymentsAsync.when(
                  loading: () =>
                      const ParentCard(child: KSShimmerList(itemCount: 3)),
                  error: (error, stack) => const ParentCard(
                    child: KSEmptyState(title: 'Unable to load', subtitle: 'Try refreshing.'),
                  ),
                  data: (payments) {
                    final yearPayments = payments
                        .where((item) => item.receipt.date.year == 2026)
                        .take(3);
                    return Column(
                      children: yearPayments
                          .map(
                            (payment) => KSPaymentHistoryRow(
                              receipt: payment.receipt,
                              childName: payment.childName,
                              onTap: () => context.push(
                                '/parent/finance/receipt/${payment.receipt.id}',
                              ),
                            ),
                          )
                          .toList(),
                    );
                  },
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

class _CombinedFinanceHero extends StatelessWidget {
  const _CombinedFinanceHero({required this.children, required this.total});

  final List<ChildSummary> children;
  final double? total;

  @override
  Widget build(BuildContext context) {
    final amount =
        total ??
        children.fold<double>(
          0,
          (sum, child) => sum + child.outstandingBalance,
        );
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppColors.heroGradient,
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Total Outstanding',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AppColors.white.withValues(alpha: 0.78),
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            formatParentTzs(amount),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: amount > 0 ? AppColors.accentAmber : AppColors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Total outstanding across all children',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.white.withValues(alpha: 0.74),
            ),
          ),
          const SizedBox(height: 16),
          ...children.map(
            (child) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  KSAvatar(name: child.name, size: 30),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      child.name,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.white.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      child.isFullyPaid
                          ? 'PAID'
                          : formatParentTzs(child.outstandingBalance),
                      style: TextStyle(
                        color: child.isFullyPaid
                            ? AppColors.white
                            : AppColors.accentAmber,
                        fontWeight: FontWeight.w900,
                      ),
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
}

class _InvoiceCard extends StatelessWidget {
  const _InvoiceCard({
    required this.invoice,
    required this.childName,
    required this.onTap,
  });

  final InvoiceModel invoice;
  final String childName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final paid = invoice.outstandingAmount <= 0;
    return ParentCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "$childName's Current Invoice",
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Icon(
                Icons.chevron_right_rounded,
                color: paid ? AppColors.accentEmerald : AppColors.accentAmber,
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            formatParentTzs(invoice.outstandingAmount),
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
              color: paid ? AppColors.accentEmerald : AppColors.accentAmber,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          LinearProgressIndicator(
            value: invoice.progress,
            minHeight: 9,
            borderRadius: BorderRadius.circular(999),
            color: paid ? AppColors.accentEmerald : AppColors.skyBlue600,
            backgroundColor: AppColors.border,
          ),
          const SizedBox(height: 10),
          Text('Due ${formatParentLongDate(invoice.dueDate)}'),
          const SizedBox(height: 14),
          Divider(height: 1, color: AppColors.border.withValues(alpha: 0.7)),
          const SizedBox(height: 12),
          ...invoice.items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Expanded(child: Text(item.label)),
                  Text(
                    formatParentTzs(item.amount),
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w800,
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
}
