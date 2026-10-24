import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../models/invoice_model.dart';
import '../../widgets/common/ks_error_view.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/finance/finance_ui.dart';
import '../../widgets/student/student_surface.dart';

Widget _card({required Widget child, VoidCallback? onTap}) => StudentSurface(onTap: onTap, padding: const EdgeInsets.all(16), children: [child]);

class FinanceOverviewScreen extends ConsumerWidget {
  const FinanceOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoicesAsync = ref.watch(studentInvoicesProvider);
    final receiptsAsync = ref.watch(studentReceiptsProvider);
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    Future<void> refresh() async {
      ref.invalidate(studentInvoicesProvider);
      ref.invalidate(studentReceiptsProvider);
      await ref.read(studentInvoicesProvider.future).catchError((_) => const <InvoiceModel>[]);
    }

    return Scaffold(
      body: invoicesAsync.when(
        loading: () => const Padding(padding: EdgeInsets.fromLTRB(16, 80, 16, 16), child: KSShimmerList(itemCount: 5)),
        error: (e, _) => Padding(padding: const EdgeInsets.only(top: 80), child: KSErrorView(error: e, onRetry: refresh)),
        data: (invoices) {
          final current = currentInvoiceOf(invoices);
          final owed = invoices.where((i) => i.isOpen).fold<double>(0, (a, i) => a + i.outstandingAmount);
          final overdue = invoices.where((i) => i.isOpen && i.isOverdue).length;

          return RefreshIndicator(
            onRefresh: refresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: StudentHeroHeader(
                    kicker: 'FINANCE',
                    title: tzs(owed),
                    subtitle: invoices.isEmpty
                        ? 'The school has not issued an invoice for you yet.'
                        : owed <= 0
                            ? 'Your school account is fully paid.'
                            : overdue > 0
                                ? '$overdue overdue invoice${overdue == 1 ? '' : 's'}. Please clear the balance.'
                                : 'Outstanding across your open invoices.',
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
                  sliver: SliverList.list(children: [
                    if (current != null) ...[
                      Text('Current invoice', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 10),
                      InvoiceHeadline(invoice: current, card: _card, onTap: () => context.push('/student/finance/invoice/${current.id}')),
                      if (current.isOpen) ...[
                        const SizedBox(height: 12),
                        HowToPayCard(invoice: current, card: _card),
                      ],
                    ],
                    if (invoices.length > 1) ...[
                      const SizedBox(height: 18),
                      Text('All invoices', style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 10),
                      for (final i in invoices) InvoiceRow(invoice: i, card: _card, onTap: () => context.push('/student/finance/invoice/${i.id}')),
                    ],
                    const SizedBox(height: 18),
                    Text('Payments', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 10),
                    receiptsAsync.when(
                      loading: () => const KSShimmerList(itemCount: 3),
                      error: (e, _) => KSErrorView(error: e, onRetry: refresh),
                      data: (receipts) => receipts.isEmpty
                          ? _card(child: const Text('No payments have been confirmed yet. They show up here with a receipt as soon as the school confirms them.'))
                          : Column(children: [
                              for (final r in receipts) ReceiptRow(receipt: r, card: _card, onTap: () => context.push('/student/finance/receipt/${r.id}')),
                            ]),
                    ),
                  ]),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
