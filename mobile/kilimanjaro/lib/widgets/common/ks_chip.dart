import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ks_svg_icon.dart';

enum ChipSize { small, medium, large }

class KSChip extends StatelessWidget {
  const KSChip({
    super.key,
    required this.label,
    required this.color,
    this.size = ChipSize.medium,
    this.leadingDot = true,
    this.leadingIcon,
    this.onTap,
    this.filled = false,
  });

  final String label;
  final Color color;
  final ChipSize size;
  final bool leadingDot;
  final String? leadingIcon;
  final VoidCallback? onTap;
  final bool filled;

  double get _height => switch (size) {
        ChipSize.small => 20,
        ChipSize.medium => 26,
        ChipSize.large => 32,
      };

  EdgeInsets get _padding => switch (size) {
        ChipSize.small => const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        ChipSize.medium => const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        ChipSize.large => const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      };

  double get _fontSize => switch (size) {
        ChipSize.small => 11,
        ChipSize.medium => 12,
        ChipSize.large => 13,
      };

  factory KSChip.grade(String grade) => KSChip(
        label: grade,
        color: _gradeColor(grade),
      );

  factory KSChip.payment(String status) => KSChip(
        label: status,
        color: switch (status.toUpperCase()) {
          'PAID' => AppColors.accentEmerald,
          'PARTIALLY_PAID' => AppColors.accentAmber,
          'OVERDUE' => AppColors.accentRose,
          _ => AppColors.skyBlue500,
        },
      );

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = filled
        ? color
        : color.withValues(alpha: isDark ? 0.18 : 0.12);
    final fg = filled ? AppColors.white : color;
    final child = Container(
      height: _height,
      padding: _padding,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(100),
        border: Border.all(
          color: filled ? color : color.withValues(alpha: isDark ? 0.25 : 0.30),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (leadingIcon != null)
            Padding(
              padding: const EdgeInsets.only(right: 5),
              child: KSSvgIcon(
                leadingIcon!,
                size: 12,
                color: fg,
              ),
            )
          else if (leadingDot)
            Padding(
              padding: const EdgeInsets.only(right: 5),
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
              ),
            ),
          Text(
            label,
            style: TextStyle(fontSize: _fontSize, fontWeight: FontWeight.w600, color: fg),
          ),
        ],
      ),
    );
    if (onTap == null) return child;
    return GestureDetector(onTap: onTap, child: child);
  }
}

Color _gradeColor(String grade) {
  final normalized = grade.trim().toUpperCase();
  if (normalized.startsWith('A')) return AppColors.accentEmerald;
  if (normalized.startsWith('B')) return AppColors.skyBlue500;
  if (normalized.startsWith('C')) return AppColors.accentAmber;
  if (normalized.startsWith('D') || normalized.startsWith('F')) {
    return AppColors.accentRose;
  }
  return AppColors.skyBlue500;
}
