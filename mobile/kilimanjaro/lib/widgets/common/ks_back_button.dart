import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ks_svg_icon.dart';

class KSBackButton extends StatelessWidget {
  const KSBackButton({
    super.key,
    this.onTap,
    this.backgroundColor,
    this.foregroundColor,
  });

  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? foregroundColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap ?? () => Navigator.of(context).maybePop(),
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          width: 42,
          height: 42,
          decoration: BoxDecoration(
            color: backgroundColor ?? (isDark ? AppColors.darkCard : AppColors.white),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Center(
            child: KSSvgIcon(
              'assets/icons/arrow-left.svg',
              size: 18,
              color: foregroundColor ?? (isDark ? AppColors.darkText : AppColors.textPrimary),
            ),
          ),
        ),
      ),
    );
  }
}
