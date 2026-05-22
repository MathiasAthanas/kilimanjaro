import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/providers/student_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/common/ks_chip.dart';
import '../../widgets/common/ks_list_tile.dart';
import '../../widgets/common/ks_svg_icon.dart';
import '../../widgets/student/student_surface.dart';
import 'student_formatters.dart';

class FinanceOverviewScreen extends ConsumerWidget {
  const FinanceOverviewScreen({super.key});

  static final _today = DateTime(2026, 4, 3);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invoiceAsync = ref.watch(currentInvoiceProvider);
    final paymentsAsync = ref.watch(studentPaymentsProvider);
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;

    return Scaffold(
      body: invoiceAsync.when(
        data: (invoice) => paymentsAsync.when(
          data: (payments) {
            final dueDays = invoice.dueDate.difference(_today).inDays;
            final outstandingColor = _outstandingColor(
              dueDays,
              invoice.outstandingAmount,
            );

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(currentInvoiceProvider);
                ref.invalidate(studentPaymentsProvider);
              },
              child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: StudentHeroHeader(
                    kicker: 'FINANCE',
                    title: formatTzs(invoice.outstandingAmount),
                    subtitle: invoice.outstandingAmount <= 0
                        ? 'Your school account is fully paid.'
                        : dueDays < 0
                        ? '${dueDays.abs()} days overdue. Please clear the outstanding balance.'
                        : '$dueDays days remaining before the current invoice is due.',
                  ),
                ),
                SliverPadding(
                  padding: EdgeInsets.fromLTRB(16, 16, 16, bottomPadding),
                  sliver: SliverList.list(
                    children: [
                      StudentSurface(
                        children: [
                          Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: outstandingColor.withValues(
                                    alpha: 0.12,
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Icon(
                                  Icons.receipt_long_rounded,
                                  color: outstandingColor,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Current Invoice',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleLarge,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      invoice.title,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodyMedium,
                                    ),
                                  ],
                                ),
                              ),
                              KSChip.payment(invoice.status),
                            ],
                          ),
                          const SizedBox(height: 18),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: invoice.progress,
                              minHeight: 10,
                              backgroundColor: AppColors.accentEmerald
                                  .withValues(alpha: 0.14),
                              valueColor: const AlwaysStoppedAnimation<Color>(
                                AppColors.accentEmerald,
                              ),
                            ),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            '${formatTzs(invoice.paidAmount)} paid of ${formatTzs(invoice.totalAmount)}',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                          const SizedBox(height: 16),
                          FilledButton.icon(
                            onPressed: () => context.push(
                              '/student/finance/invoice/${invoice.id}',
                            ),
                            icon: const Icon(Icons.open_in_new_rounded),
                            label: const Text('View Invoice Details'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Fee Breakdown',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 10),
                      StudentSurface(
                        padding: EdgeInsets.zero,
                        children: [
                          ...invoice.items.map(
                            (item) => KSListTile(
                              title: item.label,
                              subtitle: formatTzs(item.amount),
                              trailing: KSChip.payment(item.status),
                              leading: const _FinanceIcon(),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                Text(
                                  'Total',
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                                const Spacer(),
                                Text(
                                  formatTzs(invoice.totalAmount),
                                  style: Theme.of(
                                    context,
                                  ).textTheme.titleMedium,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      Text(
                        'Recent Payments',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 10),
                      ...payments
                          .take(3)
                          .map(
                            (payment) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: StudentSurface(
                                onTap: () => context.push(
                                  '/student/finance/receipt/${payment.id}',
                                ),
                                padding: const EdgeInsets.all(14),
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 42,
                                        height: 42,
                                        decoration: BoxDecoration(
                                          color: AppColors.accentEmerald
                                              .withValues(alpha: 0.12),
                                          borderRadius: BorderRadius.circular(
                                            14,
                                          ),
                                        ),
                                        child: const Icon(
                                          Icons.check_circle_rounded,
                                          color: AppColors.accentEmerald,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '${formatTzs(payment.amount)} - ${payment.method}',
                                              style: Theme.of(
                                                context,
                                              ).textTheme.titleSmall,
                                            ),
                                            const SizedBox(height: 4),
                                            Text(
                                              formatShortDate(payment.date),
                                              style: Theme.of(
                                                context,
                                              ).textTheme.bodySmall,
                                            ),
                                          ],
                                        ),
                                      ),
                                      const Icon(Icons.chevron_right_rounded),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                      const SizedBox(height: 6),
                      StudentSurface(
                        color: AppColors.skyBlue50,
                        padding: const EdgeInsets.all(16),
                        children: const [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              KSSvgIcon(
                                'assets/icons/info-circle.svg',
                                size: 18,
                                color: AppColors.skyBlue700,
                              ),
                              SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Use Registration Number KS-2024-00142 as the payment reference at any M-Pesa or bank point.',
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
              ),
            );
          },
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

  Color _outstandingColor(int dueDays, double outstandingAmount) {
    if (outstandingAmount <= 0) return AppColors.accentEmerald;
    if (dueDays < 7) return AppColors.accentRose;
    if (dueDays <= 14) return AppColors.accentAmber;
    return AppColors.textPrimary;
  }
}

class _FinanceIcon extends StatelessWidget {
  const _FinanceIcon();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: AppColors.skyBlue50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: const Center(
        child: KSSvgIcon(
          'assets/icons/coin-stack.svg',
          size: 18,
          color: AppColors.skyBlue700,
        ),
      ),
    );
  }
}
