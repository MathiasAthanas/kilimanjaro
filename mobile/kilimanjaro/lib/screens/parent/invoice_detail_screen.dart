import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/invoice_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ParentInvoiceDetailScreen extends ConsumerWidget {
  const ParentInvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(parentInvoiceByIdProvider(invoiceId));
    final child = ref.watch(activeParentChildProvider).value;

    return Scaffold(
      appBar: KSAppBar(
        title: 'Invoice Details',
        subtitle: child != null
            ? 'Fee breakdown for ${child.firstName} · ${child.classLabel}'
            : null,
        variant: KSAppBarVariant.hero,
      ),
      body: invoiceAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: KSShimmerList(itemCount: 5),
        ),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
        data: (invoice) {
          if (invoice == null) {
            return const KSEmptyState(title: 'Invoice not found');
          }
          return ParentSurface(
            children: [
              ParentCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Invoice for: ${child?.name ?? 'Student'}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      invoice.id,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    ...invoice.items.map((item) => _InvoiceLine(item: item)),
                    Divider(
                      height: 26,
                      color: AppColors.border.withValues(alpha: 0.7),
                    ),
                    _AmountRow(
                      label: 'Total',
                      value: formatParentTzs(invoice.totalAmount),
                      bold: true,
                    ),
                    const SizedBox(height: 8),
                    _AmountRow(
                      label: 'Paid',
                      value: formatParentTzs(invoice.paidAmount),
                      color: AppColors.accentEmerald,
                    ),
                    const SizedBox(height: 8),
                    _AmountRow(
                      label: 'Outstanding',
                      value: formatParentTzs(invoice.outstandingAmount),
                      color: invoice.outstandingAmount > 0
                          ? AppColors.accentAmber
                          : AppColors.accentEmerald,
                      bold: true,
                    ),
                    const SizedBox(height: 14),
                    LinearProgressIndicator(
                      value: invoice.progress,
                      minHeight: 9,
                      borderRadius: BorderRadius.circular(999),
                      color: AppColors.skyBlue600,
                      backgroundColor: AppColors.border,
                    ),
                  ],
                ),
              ),
              ParentCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'How to Make a Payment',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _Step(text: 'Use M-Pesa or bank transfer.'),
                    _Step(
                      text:
                          'Use reference: ${child?.registrationNumber ?? 'KS-2024-00142'}.',
                    ),
                    _Step(
                      text:
                          'Pay ${formatParentTzs(invoice.outstandingAmount)} or a partial amount.',
                    ),
                    const _Step(
                      text: 'Contact school finance office for bank details.',
                    ),
                    const SizedBox(height: 10),
                    TextButton(
                      onPressed: () => context.push('/parent/contact'),
                      child: const Text('Contact school for assistance'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}


class _InvoiceLine extends StatelessWidget {
  const _InvoiceLine({required this.item});

  final InvoiceLineItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(child: Text(item.label)),
          Text(
            formatParentTzs(item.amount),
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({
    required this.label,
    required this.value,
    this.color,
    this.bold = false,
  });

  final String label;
  final String value;
  final Color? color;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(label)),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.check_circle_rounded,
            size: 18,
            color: AppColors.skyBlue600,
          ),
          const SizedBox(width: 8),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}
