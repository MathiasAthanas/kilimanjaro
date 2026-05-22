import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class KSStickySectionHeader extends SliverPersistentHeaderDelegate {
  KSStickySectionHeader(this.title);

  final String title;

  @override
  double get minExtent => 32;

  @override
  double get maxExtent => 32;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          color: (isDark ? AppColors.darkBg : AppColors.offWhite)
              .withValues(alpha: 0.88),
          child: Text(
            title.toUpperCase(),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.8,
              color:
                  isDark ? AppColors.darkTextSecondary : AppColors.textMuted,
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant KSStickySectionHeader oldDelegate) {
    return title != oldDelegate.title;
  }
}
