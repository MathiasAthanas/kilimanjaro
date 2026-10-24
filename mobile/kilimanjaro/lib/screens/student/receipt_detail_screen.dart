import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/student_provider.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_error_view.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/finance/finance_ui.dart';
import '../../widgets/student/student_surface.dart';

Widget _card({required Widget child, VoidCallback? onTap}) => StudentSurface(onTap: onTap, padding: const EdgeInsets.all(18), children: [child]);

class ReceiptDetailScreen extends ConsumerWidget {
  const ReceiptDetailScreen({super.key, required this.receiptId});

  final String receiptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receiptAsync = ref.watch(receiptByIdProvider(receiptId));

    return Scaffold(
      body: receiptAsync.when(
        loading: () => const Padding(padding: EdgeInsets.fromLTRB(16, 80, 16, 16), child: KSShimmerList(itemCount: 4)),
        error: (e, _) => Padding(padding: const EdgeInsets.only(top: 80), child: KSErrorView(error: e, onRetry: () => ref.invalidate(receiptByIdProvider(receiptId)))),
        data: (receipt) {
          if (receipt == null) return const Center(child: KSEmptyState(title: 'Receipt not found'));
          return CustomScrollView(slivers: [
            SliverToBoxAdapter(
              child: StudentHeroHeader(
                kicker: receipt.isVoided ? 'VOIDED RECEIPT' : 'PAYMENT RECEIPT',
                title: tzs(receipt.amount),
                subtitle: receipt.isVoided ? 'This receipt no longer counts as proof of payment.' : 'Payment confirmed on ${financeDate(receipt.date)}.',
                trailing: IconButton.filledTonal(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: const Icon(Icons.arrow_back_rounded),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList.list(children: [
                ReceiptBody(receipt: receipt, card: _card),
                const SizedBox(height: 12),
                if (!receipt.isVoided)
                  PdfButton(
                    path: '/finance/receipts/${receipt.id}/pdf',
                    fileName: '${receipt.receiptNumber.isEmpty ? 'receipt' : receipt.receiptNumber}.pdf',
                    label: 'Download receipt (PDF)',
                  ),
                if (receipt.invoiceId.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    onPressed: () => context.push('/student/finance/invoice/${receipt.invoiceId}'),
                    icon: const Icon(Icons.receipt_long_rounded, size: 18),
                    label: const Text('View the invoice this paid'),
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                  ),
                ],
                const SizedBox(height: 100),
              ]),
            ),
          ]);
        },
      ),
    );
  }
}
