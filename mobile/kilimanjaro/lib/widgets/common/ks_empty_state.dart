import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:lottie/lottie.dart';

import '../../core/theme/app_colors.dart';
import 'ks_button.dart';
import 'ks_svg_icon.dart';

class KSEmptyState extends StatelessWidget {
  const KSEmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.lottieAsset,
    this.svgAsset,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? subtitle;
  final String? lottieAsset;
  final String? svgAsset;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final lottie = lottieAsset;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (lottie != null)
              Animate(
                effects: [ScaleEffect(duration: 600.ms, curve: Curves.elasticOut)],
                child: Lottie.asset(lottie, width: 160, height: 160),
              )
            else
              Animate(
                effects: [ScaleEffect(duration: 600.ms, curve: Curves.elasticOut)],
                child: KSSvgIcon(
                  svgAsset ?? 'assets/icons/info-circle.svg',
                  size: 120,
                  color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                ),
              ),
            const SizedBox(height: 20),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ).animate().fadeIn(delay: 200.ms).slideY(begin: 0.08, end: 0),
            if (subtitle != null) ...[
              const SizedBox(height: 8),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: (Theme.of(context).textTheme.bodyMedium ??
                        const TextStyle())
                    .copyWith(height: 1.5),
              ).animate().fadeIn(delay: 300.ms),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 28),
              KSButton(
                label: actionLabel!,
                secondary: true,
                onPressed: onAction!,
              ).animate().fadeIn(delay: 400.ms).slideY(begin: 0.04, end: 0),
            ],
          ],
        ),
      ),
    );
  }
}
