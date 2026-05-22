import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';

class KSButton extends StatelessWidget {
  const KSButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.secondary = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool secondary;
  final Widget? icon;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !isLoading;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SizedBox(
      width: double.infinity,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: enabled ? onPressed : null,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 220),
            height: 54,
            decoration: BoxDecoration(
              gradient: secondary || !enabled ? null : AppColors.primaryGradient,
              color: secondary
                  ? Colors.transparent
                  : enabled
                      ? null
                      : isDark
                          ? AppColors.darkBorder
                          : AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: secondary
                  ? Border.all(color: AppColors.skyBlue500, width: 1.4)
                  : null,
              boxShadow: secondary || !enabled ? null : AppShadows.shadow3,
            ),
            alignment: Alignment.center,
            child: isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.2),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (icon != null) ...[icon!, const SizedBox(width: 10)],
                      Text(
                        label,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: secondary
                              ? AppColors.skyBlue600
                              : enabled
                                  ? AppColors.white
                                  : AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
