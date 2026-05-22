import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class KSRankBadge extends StatelessWidget {
  const KSRankBadge({
    super.key,
    required this.rank,
    required this.total,
  });

  final int rank;
  final int total;

  @override
  Widget build(BuildContext context) {
    final medalColor = rank <= 3 ? AppColors.accentAmber : AppColors.skyBlue500;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: medalColor.withValues(alpha: isDark ? 0.18 : 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.workspace_premium_rounded, size: 18, color: medalColor),
          const SizedBox(width: 8),
          Text(
            '${_ordinal(rank)} of $total',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: medalColor,
            ),
          ),
        ],
      ),
    );
  }

  String _ordinal(int value) {
    if (value % 100 >= 11 && value % 100 <= 13) return '${value}th';
    return switch (value % 10) {
      1 => '${value}st',
      2 => '${value}nd',
      3 => '${value}rd',
      _ => '${value}th',
    };
  }
}
