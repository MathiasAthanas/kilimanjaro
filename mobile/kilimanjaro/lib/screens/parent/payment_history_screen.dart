import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_error_view.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/finance/finance_ui.dart';
import '../../widgets/parent/parent_surface.dart';

Widget _card({required Widget child, VoidCallback? onTap}) => ParentCard(onTap: onTap, child: child);

final _paymentFilterProvider = StateProvider<String?>((ref) => null);
final _monthFormat = DateFormat('MMMM y');

class PaymentHistoryScreen extends ConsumerWidget {
  const PaymentHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync = ref.watch(parentReceiptsProvider);
    final selectedChild = ref.watch(_paymentFilterProvider);
    final children = ref.watch(parentChildrenProvider).valueOrNull ?? const <ChildSummary>[];

    return Scaffold(
      appBar: const KSAppBar(
        title: 'Payment History',
        subtitle: 'Every payment the school has confirmed',
        variant: KSAppBarVariant.hero,
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(parentReceiptsProvider);
          await ref.read(parentReceiptsProvider.future).then((_) {}, onError: (_) {});
        },
        child: paymentsAsync.when(
          loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 6)),
          error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(parentReceiptsProvider)),
          data: (payments) {
            final filtered = selectedChild == null ? payments : payments.where((p) => p.childId == selectedChild).toList();
            if (payments.isEmpty) {
              return const KSEmptyState(title: 'No payments yet', subtitle: 'Confirmed payments will be listed here with their receipts.');
            }
            final grouped = <String, List<ParentPaymentEntry>>{};
            for (final p in filtered) {
              grouped.putIfAbsent(_monthFormat.format(p.receipt.date), () => []).add(p);
            }
            final total = filtered.fold<double>(0, (sum, p) => sum + p.receipt.amount);

            return ParentSurface(children: [
              ParentCard(
                child: Column(children: [
                  Text(
                    tzs(total),
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: AppColors.accentEmerald, fontWeight: FontWeight.w900),
                  ),
                  const SizedBox(height: 4),
                  Text('paid in ${filtered.length} payment${filtered.length == 1 ? '' : 's'}${selectedChild == null && children.length > 1 ? ' across all children' : ''}'),
                  if (children.length > 1) ...[
                    const SizedBox(height: 14),
                    SizedBox(
                      height: 42,
                      child: ListView(scrollDirection: Axis.horizontal, children: [
                        _FilterChip(label: 'All children', active: selectedChild == null, onTap: () => ref.read(_paymentFilterProvider.notifier).state = null),
                        ...children.map((c) => _FilterChip(
                              label: c.firstName,
                              active: selectedChild == c.id,
                              onTap: () => ref.read(_paymentFilterProvider.notifier).state = c.id,
                            )),
                      ]),
                    ),
                  ],
                ]),
              ),
              if (filtered.isEmpty)
                const ParentCard(child: Text('No confirmed payments for this child yet.')),
              for (final entry in grouped.entries) ...[
                ParentSectionTitle(title: entry.key.toUpperCase()),
                for (final p in entry.value)
                  ReceiptRow(
                    receipt: p.receipt,
                    card: _card,
                    studentLabel: children.length > 1 ? p.childName : null,
                    onTap: () => context.push('/parent/finance/receipt/${p.receipt.id}'),
                  ),
              ],
            ]);
          },
        ),
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.active, required this.onTap});

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: ChoiceChip(label: Text(label), selected: active, onSelected: (_) => onTap()),
      );
}
