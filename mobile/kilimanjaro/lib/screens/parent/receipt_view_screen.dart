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

class ParentReceiptViewScreen extends ConsumerWidget {
  const ParentReceiptViewScreen({super.key, required this.receiptId});

  final String receiptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receiptAsync = ref.watch(parentReceiptByIdProvider(receiptId));
    final receipt = receiptAsync.valueOrNull;

    return Scaffold(
      appBar: KSAppBar(
        title: receipt?.isVoided == true ? 'Voided receipt' : 'Payment receipt',
        subtitle: receipt != null && receipt.studentName.isNotEmpty ? 'For ${receipt.studentName}' : null,
        variant: KSAppBarVariant.hero,
      ),
      body: receiptAsync.when(
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(parentReceiptByIdProvider(receiptId))),
        data: (receipt) {
          if (receipt == null) return const KSEmptyState(title: 'Receipt not found');
          return ParentSurface(children: [
            ReceiptBody(receipt: receipt, card: _card),
            if (!receipt.isVoided)
              PdfButton(
                path: '/finance/receipts/${receipt.id}/pdf',
                fileName: '${receipt.receiptNumber.isEmpty ? 'receipt' : receipt.receiptNumber}.pdf',
                label: 'Download receipt (PDF)',
              ),
            if (receipt.invoiceId.isNotEmpty)
              OutlinedButton.icon(
                onPressed: () => context.push('/parent/finance/invoice/${receipt.invoiceId}'),
                icon: const Icon(Icons.receipt_long_rounded, size: 18),
                label: const Text('View the invoice this paid'),
                style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              ),
          ]);
        },
      ),
    );
  }
}
