import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_error_view.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/finance/finance_ui.dart';
import '../../widgets/parent/parent_surface.dart';

Widget _card({required Widget child, VoidCallback? onTap}) => ParentCard(onTap: onTap, child: child);

class ParentInvoiceDetailScreen extends ConsumerWidget {
  const ParentInvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(parentInvoiceByIdProvider(invoiceId));
    final invoice = invoiceAsync.valueOrNull;

    return Scaffold(
      appBar: KSAppBar(
        title: 'Invoice',
        subtitle: invoice == null
            ? null
            : [invoice.studentName, invoice.className].where((s) => s.isNotEmpty).join(' · '),
        variant: KSAppBarVariant.hero,
      ),
      body: invoiceAsync.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(parentInvoiceByIdProvider(invoiceId))),
        data: (invoice) {
          if (invoice == null) return const KSEmptyState(title: 'Invoice not found');
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(parentInvoiceByIdProvider(invoiceId));
              await ref.read(parentInvoiceByIdProvider(invoiceId).future).catchError((_) => null);
            },
            child: ParentSurface(children: [
              InvoiceHeadline(invoice: invoice, card: _card),
              InvoiceBreakdown(invoice: invoice, card: _card),
              InvoicePaymentsList(
                invoice: invoice,
                card: _card,
                onReceipt: (id) => context.push('/parent/finance/receipt/$id'),
              ),
              HowToPayCard(invoice: invoice, card: _card, onContact: () => context.push('/parent/contact')),
              PdfButton(
                path: '/finance/invoices/${invoice.id}/pdf',
                fileName: '${invoice.invoiceNumber.isEmpty ? 'invoice' : invoice.invoiceNumber}.pdf',
                label: 'Download invoice (PDF)',
              ),
            ]),
          );
        },
      ),
    );
  }
}
