import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/student/student_surface.dart';
import 'student_formatters.dart';

class InvoiceDetailScreen extends ConsumerWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId});

  final String invoiceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(currentInvoiceProvider);
    final paymentsAsync = ref.watch(studentPaymentsProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final paperColor = isDark
        ? AppColors.darkSurface.withValues(alpha: 0.96)
        : const Color(0xFFFDF8ED);
    final paperInner = isDark
        ? AppColors.darkCard.withValues(alpha: 0.78)
        : Colors.white.withValues(alpha: 0.8);

    return Scaffold(
      body: invoiceAsync.when(
        data: (invoice) => paymentsAsync.when(
          data: (payments) => CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: StudentHeroHeader(
                  kicker: 'INVOICE DETAILS',
                  title: formatTzs(invoice.outstandingAmount),
                  subtitle: 'Outstanding balance for ${invoice.title}.',
                  trailing: IconButton.filledTonal(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.arrow_back_rounded),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.all(16),
                sliver: SliverList.list(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: paperColor,
                        borderRadius: BorderRadius.circular(26),
                        border: Border.all(color: AppColors.skyBlue200),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.skyBlue900.withValues(alpha: 0.08),
                            blurRadius: 24,
                            offset: const Offset(0, 12),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Icon(
                                Icons.description_rounded,
                                size: 32,
                                color: AppColors.skyBlue600,
                              ),
                              const SizedBox(width: 12),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'SCHOOL FEE INVOICE',
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  Text(invoice.id),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              _Cell(
                                label: 'Student',
                                value: 'Amina Baraka Juma',
                                backgroundColor: paperInner,
                              ),
                              _Cell(
                                label: 'Class',
                                value: 'Form 3A',
                                backgroundColor: paperInner,
                              ),
                              _Cell(
                                label: 'Term',
                                value: 'Term 1 2025/2026',
                                backgroundColor: paperInner,
                              ),
                              _Cell(
                                label: 'Issue Date',
                                value: formatLongDate(invoice.issueDate),
                                backgroundColor: paperInner,
                              ),
                              _Cell(
                                label: 'Due Date',
                                value: formatLongDate(invoice.dueDate),
                                backgroundColor: paperInner,
                              ),
                              _Cell(
                                label: 'Status',
                                value: invoice.status,
                                backgroundColor: paperInner,
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Line Items',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 12),
                          Table(
                            border: TableBorder.all(color: AppColors.border),
                            columnWidths: const {
                              0: FlexColumnWidth(2.2),
                              1: FlexColumnWidth(1.4),
                              2: FlexColumnWidth(1.6),
                            },
                            children: [
                              const TableRow(
                                decoration: BoxDecoration(
                                  color: AppColors.skyBlue700,
                                ),
                                children: [
                                  Padding(
                                    padding: EdgeInsets.all(10),
                                    child: Text(
                                      'Fee Type',
                                      style: TextStyle(color: AppColors.white),
                                    ),
                                  ),
                                  Padding(
                                    padding: EdgeInsets.all(10),
                                    child: Text(
                                      'Amount',
                                      style: TextStyle(color: AppColors.white),
                                    ),
                                  ),
                                  Padding(
                                    padding: EdgeInsets.all(10),
                                    child: Text(
                                      'Status',
                                      style: TextStyle(color: AppColors.white),
                                    ),
                                  ),
                                ],
                              ),
                              ...invoice.items.map(
                                (item) => TableRow(
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.all(10),
                                      child: Text(item.label),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(10),
                                      child: Text(formatTzs(item.amount)),
                                    ),
                                    Padding(
                                      padding: const EdgeInsets.all(10),
                                      child: Text(item.status),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Payment Summary',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _Summary(
                                  label: 'Invoiced',
                                  value: formatTzs(invoice.totalAmount),
                                ),
                              ),
                              Expanded(
                                child: _Summary(
                                  label: 'Paid',
                                  value: formatTzs(invoice.paidAmount),
                                  color: AppColors.accentEmerald,
                                ),
                              ),
                              Expanded(
                                child: _Summary(
                                  label: 'Outstanding',
                                  value: formatTzs(invoice.outstandingAmount),
                                  color: AppColors.accentAmber,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          Text(
                            'Payment History',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 8),
                          ...payments
                              .where((item) => item.invoiceId == invoiceId)
                              .map(
                                (item) => ListTile(
                                  contentPadding: EdgeInsets.zero,
                                  title: Text(item.id),
                                  subtitle: Text(
                                    '${item.method} / ${formatShortDate(item.date)}',
                                  ),
                                  trailing: Text(formatTzs(item.amount)),
                                ),
                              ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
          error: (error, stack) => const KSEmptyState(
            title: 'Something went wrong',
            subtitle: 'We couldn\'t load your data. Pull down to refresh.',
          ),
        ),
        loading: () => const Padding(padding: EdgeInsets.all(16), child: KSShimmerList(itemCount: 5)),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
      ),
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({
    required this.label,
    required this.value,
    required this.backgroundColor,
  });

  final String label;
  final String value;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.label, required this.value, this.color});

  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: Theme.of(context).textTheme.bodySmall),
        const SizedBox(height: 4),
        Text(
          value,
          textAlign: TextAlign.center,
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(color: color),
        ),
      ],
    );
  }
}
