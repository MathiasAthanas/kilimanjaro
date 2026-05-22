import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import 'ks_svg_icon.dart';

enum TrendDirection { improving, declining, stable }

class KSStatCard extends StatefulWidget {
  const KSStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.iconAsset,
    required this.iconColor,
    this.subtitle,
    this.trend,
    this.trendValue,
    this.onTap,
    this.isLoading = false,
  });

  final String label;
  final String value;
  final String iconAsset;
  final Color iconColor;
  final String? subtitle;
  final TrendDirection? trend;
  final String? trendValue;
  final VoidCallback? onTap;
  final bool isLoading;

  @override
  State<KSStatCard> createState() => _KSStatCardState();
}

class _KSStatCardState extends State<KSStatCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final content = Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: isDark ? null : (_pressed ? AppShadows.shadow2 : AppShadows.shadow1),
        border: isDark ? Border.all(color: AppColors.darkBorder) : null,
      ),
      child: widget.isLoading
          ? Shimmer.fromColors(
              baseColor: isDark ? const Color(0xFF1E293B) : AppColors.surface,
              highlightColor: isDark ? const Color(0xFF334155) : AppColors.border,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(width: 40, height: 40, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
                  const SizedBox(height: 12),
                  Container(width: 72, height: 20, color: Colors.white),
                  const SizedBox(height: 6),
                  Container(width: 90, height: 12, color: Colors.white),
                ],
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: widget.iconColor.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Center(
                        child: KSSvgIcon(
                          widget.iconAsset,
                          size: 18,
                          color: widget.iconColor,
                        ),
                      ),
                    ),
                    const Spacer(),
                    if (widget.trendValue != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: _trendColor.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: _trendColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              widget.trendValue!,
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _trendColor),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  widget.value,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: isDark ? AppColors.darkText : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  widget.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                  ),
                ),
                if (widget.subtitle != null)
                  Text(
                    widget.subtitle!,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                    ),
                  ),
              ],
            ),
    );

    if (widget.onTap == null) return content;
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapCancel: () => setState(() => _pressed = false),
      onTapUp: (_) => setState(() => _pressed = false),
      child: AnimatedScale(
        duration: const Duration(milliseconds: 160),
        scale: _pressed ? 0.97 : 1,
        child: content,
      ),
    );
  }

  Color get _trendColor => switch (widget.trend) {
        TrendDirection.improving => AppColors.accentEmerald,
        TrendDirection.declining => AppColors.accentRose,
        _ => AppColors.textMuted,
      };
}
