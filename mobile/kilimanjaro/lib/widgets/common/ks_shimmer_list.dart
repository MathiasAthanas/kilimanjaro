import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../core/theme/app_colors.dart';

/// Generic card-shape shimmer — use this for screens whose content is
/// cards, metric grids, charts, or anything that isn't a list of rows.
class KSShimmerCard extends StatelessWidget {
  const KSShimmerCard({super.key, this.height = 130, this.borderRadius = 22});

  final double height;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF1E293B) : AppColors.surface,
      highlightColor: isDark ? const Color(0xFF334155) : AppColors.border,
      child: Container(
        height: height,
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Stack of [count] shimmer cards with a [gap] between them.
class KSShimmerCards extends StatelessWidget {
  const KSShimmerCards({
    super.key,
    this.count = 3,
    this.heights = const [140, 100, 160],
    this.gap = 14,
  });

  final int count;
  final List<double> heights;
  final double gap;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++) ...[
          if (i > 0) SizedBox(height: gap),
          KSShimmerCard(
            height: i < heights.length ? heights[i] : heights.last,
          ),
        ],
      ],
    );
  }
}

class KSShimmerList extends StatelessWidget {
  const KSShimmerList({
    super.key,
    this.itemCount = 5,
    this.itemHeight = 72,
    this.showAvatar = true,
    this.showSubtitle = true,
  });

  final int itemCount;
  final double itemHeight;
  final bool showAvatar;
  final bool showSubtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF1E293B) : AppColors.surface,
      highlightColor: isDark ? const Color(0xFF334155) : AppColors.border,
      child: Column(
        children: List.generate(itemCount, (index) {
          return Container(
            height: itemHeight,
            margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
            child: Row(
              children: [
                if (showAvatar)
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                  )
                else
                  Container(width: 32, height: 32, color: Colors.white),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(width: double.infinity, height: 14, color: Colors.white),
                      if (showSubtitle) ...[
                        const SizedBox(height: 10),
                        FractionallySizedBox(
                          widthFactor: 0.5,
                          child: Container(height: 12, color: Colors.white),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          );
        }),
      ),
    );
  }
}
