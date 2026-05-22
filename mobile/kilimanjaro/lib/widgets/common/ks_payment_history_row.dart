import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../models/receipt_model.dart';

class KSPaymentHistoryRow extends StatelessWidget {
  const KSPaymentHistoryRow({
    super.key,
    required this.receipt,
    required this.childName,
    required this.onTap,
  });

  final ReceiptModel receipt;
  final String childName;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: _color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(_icon, color: _color, size: 20),
      ),
      title: Text(
        'TZS ${receipt.amount.toStringAsFixed(0)}',
        style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: AppColors.accentEmerald,
              fontWeight: FontWeight.w700,
            ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${receipt.method} • ${receipt.date.day}/${receipt.date.month}/${receipt.date.year}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          Text(
            childName,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.accentIndigo),
          ),
        ],
      ),
      trailing: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.receipt_long_rounded,
            size: 18,
            color: Theme.of(context).brightness == Brightness.dark
                ? AppColors.darkMuted
                : AppColors.textMuted,
          ),
          const SizedBox(height: 2),
          Text('Receipt', style: Theme.of(context).textTheme.bodySmall?.copyWith(fontSize: 10)),
        ],
      ),
    );
  }

  IconData get _icon {
    final method = receipt.method.toLowerCase();
    if (method.contains('mobile')) return Icons.phone_android_rounded;
    if (method.contains('bank')) return Icons.account_balance_rounded;
    if (method.contains('cash')) return Icons.payments_rounded;
    return Icons.card_giftcard_rounded;
  }

  Color get _color {
    final method = receipt.method.toLowerCase();
    if (method.contains('mobile')) return AppColors.accentEmerald;
    if (method.contains('bank')) return AppColors.skyBlue500;
    if (method.contains('cash')) return AppColors.accentAmber;
    return AppColors.accentIndigo;
  }
}
