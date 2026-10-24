import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/child_summary_model.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_avatar.dart';
import '../../widgets/common/ks_child_switcher.dart';
import '../../widgets/common/ks_error_view.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/finance/finance_ui.dart';
import '../../widgets/parent/parent_surface.dart';

Widget _card({required Widget child, VoidCallback? onTap}) => ParentCard(onTap: onTap, child: child);

class ParentFinanceOverviewScreen extends ConsumerWidget {
  const ParentFinanceOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final children = ref.watch(parentChildrenProvider).valueOrNull ?? const <ChildSummary>[];
    final activeId = ref.watch(resolvedActiveChildIdProvider);
    final activeChild = children.where((c) => c.id == activeId).firstOrNull ?? ref.watch(activeParentChildProvider).valueOrNull;
    final invoiceAsync = ref.watch(activeParentInvoiceProvider);
    final invoicesAsync = ref.watch(activeParentInvoicesProvider);
    final receiptsAsync = ref.watch(parentReceiptsProvider);
    final byChild = ref.watch(parentOutstandingByChildProvider).valueOrNull ?? const <String, double>{};
    final total = ref.watch(parentCombinedOutstandingProvider);
    final firstName = activeChild?.firstName ?? 'Your child';

    Future<void> refresh() async {
      ref.invalidate(parentAllInvoicesProvider);
      ref.invalidate(activeParentInvoicesProvider);
      ref.invalidate(parentReceiptsProvider);
      await ref.read(parentAllInvoicesProvider.future).then((_) {}, onError: (_) {});
    }

    return Scaffold(
      appBar: const KSAppBar(
        title: 'School Fees',
        subtitle: 'What is owed and what has been paid',
        variant: KSAppBarVariant.hero,
        showBack: false,
      ),
      body: RefreshIndicator(
        onRefresh: refresh,
        child: Column(children: [
          if (children.length > 1)
            KSChildSwitcher(
              children: children,
              activeChildId: activeId,
              onSwitch: (value) => ref.read(activeParentChildIdProvider.notifier).state = value,
            ),
          Expanded(
            child: ParentSurface(children: [
              _FamilyHero(
                children: children,
                byChild: byChild,
                total: total.valueOrNull,
                loading: total.isLoading,
                failed: total.hasError,
                activeId: activeId,
                onPick: (id) => ref.read(activeParentChildIdProvider.notifier).state = id,
              ),
              ParentSectionTitle(title: "$firstName's current invoice"),
              invoiceAsync.when(
                loading: () => const ParentCard(child: KSShimmerList(itemCount: 3)),
                error: (e, _) => KSErrorView(error: e, onRetry: refresh),
                data: (invoice) => invoice == null
                    ? ParentCard(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('No invoice yet', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
                          const SizedBox(height: 6),
                          Text('The school has not billed $firstName for any term yet. Invoices appear here as soon as they are issued.'),
                        ]),
                      )
                    : Column(children: [
                        InvoiceHeadline(
                          invoice: invoice,
                          card: _card,
                          onTap: () => context.push('/parent/finance/invoice/${invoice.id}'),
                        ),
                        if (invoice.isOpen) ...[
                          const SizedBox(height: 12),
                          HowToPayCard(invoice: invoice, card: _card, onContact: () => context.push('/parent/contact')),
                        ],
                      ]),
              ),
              invoicesAsync.maybeWhen(
                data: (all) => all.length <= 1
                    ? const SizedBox.shrink()
                    : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        ParentSectionTitle(title: 'All invoices', subtitle: 'Every term billed for $firstName.'),
                        for (final i in all)
                          InvoiceRow(invoice: i, card: _card, onTap: () => context.push('/parent/finance/invoice/${i.id}')),
                      ]),
                orElse: () => const SizedBox.shrink(),
              ),
              ParentSectionTitle(
                title: 'Payments',
                subtitle: 'Latest payments the school has confirmed.',
                action: 'See all',
                onAction: () => context.push('/parent/finance/payments'),
              ),
              receiptsAsync.when(
                loading: () => const ParentCard(child: KSShimmerList(itemCount: 3)),
                error: (e, _) => KSErrorView(error: e, onRetry: refresh),
                data: (all) {
                  final mine = all.where((p) => p.childId == activeId).take(3).toList();
                  if (mine.isEmpty) {
                    return ParentCard(child: Text('No payments have been confirmed for $firstName yet.'));
                  }
                  return Column(children: [
                    for (final p in mine)
                      ReceiptRow(
                        receipt: p.receipt,
                        card: _card,
                        onTap: () => context.push('/parent/finance/receipt/${p.receipt.id}'),
                      ),
                  ]);
                },
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _FamilyHero extends StatelessWidget {
  const _FamilyHero({
    required this.children,
    required this.byChild,
    required this.total,
    required this.loading,
    required this.failed,
    required this.activeId,
    required this.onPick,
  });

  final List<ChildSummary> children;
  final Map<String, double> byChild;
  final double? total;
  final bool loading;
  final bool failed;
  final String activeId;
  final void Function(String id) onPick;

  @override
  Widget build(BuildContext context) {
    final amount = total ?? 0;
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(gradient: AppColors.heroGradient, borderRadius: BorderRadius.circular(28)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(
          'Total outstanding',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(color: AppColors.white.withValues(alpha: 0.78), fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 8),
        Text(
          loading ? '…' : failed ? 'Unavailable' : tzs(amount),
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(color: amount > 0 ? AppColors.accentAmber : AppColors.white, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 4),
        Text(
          amount > 0 || loading ? 'across ${children.length} ${children.length == 1 ? 'child' : 'children'}' : 'Everything is paid up. Thank you!',
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.white.withValues(alpha: 0.74)),
        ),
        if (children.length > 1) const SizedBox(height: 14),
        if (children.length > 1)
          ...children.map((child) {
            final owed = byChild[child.id] ?? 0;
            final selected = child.id == activeId;
            return InkWell(
              onTap: () => onPick(child.id),
              borderRadius: BorderRadius.circular(14),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(children: [
                  KSAvatar(name: child.name, size: 30),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      child.name,
                      style: TextStyle(color: AppColors.white, fontWeight: selected ? FontWeight.w900 : FontWeight.w600),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.white.withValues(alpha: selected ? 0.26 : 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      owed <= 0 ? 'PAID' : tzs(owed),
                      style: TextStyle(color: owed <= 0 ? AppColors.white : AppColors.accentAmber, fontWeight: FontWeight.w900),
                    ),
                  ),
                ]),
              ),
            );
          }),
      ]),
    );
  }
}
