import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/student_provider.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_error_view.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/finance/finance_ui.dart';
import '../../widgets/student/student_surface.dart';

Widget _card({required Widget child, VoidCallback? onTap}) => StudentSurface(onTap: onTap, padding: const EdgeInsets.all(16), children: [child]);

class InvoiceDetailScreen extends ConsumerWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(studentInvoiceByIdProvider(invoiceId));

    return Scaffold(
      body: invoiceAsync.when(
        loading: () => const Padding(padding: EdgeInsets.fromLTRB(16, 80, 16, 16), child: KSShimmerList(itemCount: 5)),
        error: (e, _) => Padding(padding: const EdgeInsets.only(top: 80), child: KSErrorView(error: e, onRetry: () => ref.invalidate(studentInvoiceByIdProvider(invoiceId)))),
        data: (invoice) {
          if (invoice == null) return const Center(child: KSEmptyState(title: 'Invoice not found'));
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(studentInvoiceByIdProvider(invoiceId));
              await ref.read(studentInvoiceByIdProvider(invoiceId).future).catchError((_) => null);
            },
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: StudentHeroHeader(
                    kicker: 'INVOICE',
                    title: tzs(invoice.isCancelled || invoice.isWaived ? 0 : invoice.outstandingAmount),
                    subtitle: invoice.heading,
                    trailing: IconButton.filledTonal(
                      onPressed: () => Navigator.of(context).maybePop(),
                      icon: const Icon(Icons.arrow_back_rounded),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.all(16),
                  sliver: SliverList.list(children: [
                    InvoiceHeadline(invoice: invoice, card: _card),
                    const SizedBox(height: 12),
                    InvoiceBreakdown(invoice: invoice, card: _card),
                    const SizedBox(height: 12),
                    InvoicePaymentsList(invoice: invoice, card: _card, onReceipt: (id) => context.push('/student/finance/receipt/$id')),
                    const SizedBox(height: 12),
                    HowToPayCard(invoice: invoice, card: _card),
                    const SizedBox(height: 12),
                    PdfButton(
                      path: '/finance/invoices/${invoice.id}/pdf',
                      fileName: '${invoice.invoiceNumber.isEmpty ? 'invoice' : invoice.invoiceNumber}.pdf',
                      label: 'Download invoice (PDF)',
                    ),
                    const SizedBox(height: 100),
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
