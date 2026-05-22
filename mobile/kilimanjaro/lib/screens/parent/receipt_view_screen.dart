import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/parent_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/common/ks_app_bar.dart';
import '../../widgets/common/ks_empty_state.dart';
import '../../widgets/common/ks_shimmer_list.dart';
import '../../widgets/parent/parent_surface.dart';
import 'parent_formatters.dart';

class ParentReceiptViewScreen extends ConsumerWidget {
  const ParentReceiptViewScreen({super.key, required this.receiptId});

  final String receiptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receiptAsync = ref.watch(parentReceiptByIdProvider(receiptId));
    final child = ref.watch(activeParentChildProvider).value;

    return Scaffold(
      appBar: KSAppBar(
        title: 'Payment Confirmed',
        subtitle: child != null ? 'Receipt for ${child.firstName}' : null,
        variant: KSAppBarVariant.hero,
        actions: const [
          Padding(
            padding: EdgeInsets.only(right: 8),
            child: Icon(Icons.verified_rounded, color: Colors.white, size: 30),
          ),
        ],
      ),
      body: receiptAsync.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(16),
          child: KSShimmerList(itemCount: 5),
        ),
        error: (error, stack) => const KSEmptyState(
          title: 'Something went wrong',
          subtitle: 'We couldn\'t load your data. Pull down to refresh.',
        ),
        data: (receipt) {
          if (receipt == null) {
            return const KSEmptyState(title: 'Receipt not found');
          }
          return ParentSurface(
            children: [
              Center(
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 520),
                  decoration: BoxDecoration(
                    color: Theme.of(context).brightness == Brightness.dark
                        ? AppColors.darkSurface.withValues(alpha: 0.96)
                        : const Color(0xFFFDF8ED),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x18000000),
                        blurRadius: 24,
                        offset: Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(24),
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.accentEmerald,
                              Color(0xFF0D9488),
                            ],
                          ),
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(24),
                          ),
                        ),
                        child: Column(
                          children: [
                            const Text(
                              'PAYMENT CONFIRMED',
                              style: TextStyle(
                                color: AppColors.white,
                                letterSpacing: 1.4,
                              ),
                            ),
                            const SizedBox(height: 12),
                            const Icon(
                              Icons.check_circle_rounded,
                              color: AppColors.white,
                              size: 40,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              formatParentTzs(receipt.amount),
                              style: const TextStyle(
                                color: AppColors.white,
                                fontSize: 36,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            Text(
                              receipt.id,
                              style: Theme.of(context).textTheme.headlineSmall
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 8),
                            Text('For: ${child?.name ?? 'Student'}'),
                            const SizedBox(height: 16),
                            const _DashedDivider(),
                            _ReceiptRow(
                              label: 'Date',
                              value: formatParentLongDate(receipt.date),
                            ),
                            _ReceiptRow(label: 'Method', value: receipt.method),
                            _ReceiptRow(
                              label: 'Reference',
                              value: receipt.reference,
                            ),
                            _ReceiptRow(
                              label: 'Issued by',
                              value: receipt.issuedBy,
                            ),
                          ],
                        ),
                      ),
                      SizedBox(
                        height: 16,
                        width: double.infinity,
                        child: CustomPaint(
                          painter: _PerforationPainter(
                            color: Theme.of(context).scaffoldBackgroundColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final dashCount = (constraints.maxWidth / 10).floor();
          return Row(
            children: List.generate(
              dashCount,
              (index) => Expanded(
                child: Container(
                  height: 1,
                  margin: const EdgeInsets.symmetric(horizontal: 2),
                  color: AppColors.textMuted.withValues(alpha: 0.45),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PerforationPainter extends CustomPainter {
  const _PerforationPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = color;
    const radius = 6.0;
    final count = math.max(1, (size.width / (radius * 2)).floor());
    for (var i = 0; i < count; i++) {
      final x = (i + 0.5) * (size.width / count);
      final path = Path()
        ..moveTo(x - radius, 0)
        ..arcTo(
          Rect.fromCircle(center: Offset(x, 0), radius: radius),
          math.pi,
          math.pi,
          false,
        )
        ..close();
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _PerforationPainter oldDelegate) =>
      oldDelegate.color != color;
}
