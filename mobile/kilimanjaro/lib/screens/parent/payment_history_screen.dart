import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_payment_history_row.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class PaymentHistoryScreen extends ConsumerWidget {
  const PaymentHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync = ref.watch(parentReceiptsProvider);
    final selectedChild = ref.watch(_paymentFilterProvider);
    final children =
        ref.watch(parentChildrenProvider).value ?? const <ChildSummary>[];

    return Scaffold(
      appBar: const KSAppBar(
        title: 'Payment History',
        subtitle: 'Payments across all linked children',
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(parentReceiptsProvider),
        child: paymentsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: KSShimmerList(itemCount: 6),
          ),
          error: (error, stack) => const KSEmptyState(
            title: 'Something went wrong',
            subtitle: 'We couldn\'t load your data. Pull down to refresh.',
          ),
        data: (payments) {
          final filtered = selectedChild == null
              ? payments
              : payments
                    .where((item) => item.childId == selectedChild)
                    .toList();
          final academicYearPayments = filtered
              .where((item) => item.receipt.date.year == 2026)
              .toList();
          if (filtered.isEmpty) {
            return const KSEmptyState(title: 'No payments recorded yet');
          }
          final grouped = <String, List<ParentPaymentEntry>>{};
          for (final item in filtered) {
            final key = formatParentMonth(item.receipt.date);
            grouped.putIfAbsent(key, () => []).add(item);
          }
          final total = academicYearPayments.fold<double>(
            0,
            (sum, item) => sum + item.receipt.amount,
          );

          return ParentSurface(
            children: [
              ParentCard(
                child: Column(
                  children: [
                    Text(
                      formatParentTzs(total),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: AppColors.accentEmerald,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text('Total paid this academic year'),
                    const SizedBox(height: 14),
                    if (children.length > 1)
                      SizedBox(
                        height: 42,
                        child: ListView(
                          scrollDirection: Axis.horizontal,
                          children: [
                            _FilterChip(
                              label: 'All Children',
                              active: selectedChild == null,
                              onTap: () =>
                                  ref
                                          .read(_paymentFilterProvider.notifier)
                                          .state =
                                      null,
                            ),
                            ...children.map(
                              (child) => _FilterChip(
                                label: child.firstName,
                                active: selectedChild == child.id,
                                onTap: () =>
                                    ref
                                            .read(_paymentFilterProvider.notifier)
                                            .state =
                                        child.id,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              for (final entry in grouped.entries) ...[
                ParentSectionTitle(title: entry.key.toUpperCase()),
                ...entry.value.map(
                  (payment) => KSPaymentHistoryRow(
                    receipt: payment.receipt,
                    childName: payment.childName,
                    onTap: () => context.push(
                      '/parent/finance/receipt/${payment.receipt.id}',
                    ),
                  ),
                ),
              ],
            ],
          );
        },
        ),
      ),
    );
  }
}

final _paymentFilterProvider = StateProvider<String?>((ref) => null);

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(label),
        selected: active,
        onSelected: (_) => onTap(),
      ),
    );
  }
}
