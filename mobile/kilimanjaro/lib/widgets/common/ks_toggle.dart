import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

class KSToggle extends StatefulWidget {
  const KSToggle({
    super.key,
    required this.value,
    required this.onChanged,
    this.activeColor = AppColors.skyBlue500,
    this.width = 50,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final Color activeColor;
  final double width;

  @override
  State<KSToggle> createState() => _KSToggleState();
}

class _KSToggleState extends State<KSToggle> {
  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trackColor = widget.value
        ? widget.activeColor
        : (isDark ? AppColors.darkCard : AppColors.surface);
    return GestureDetector(
      onTap: widget.onChanged == null ? null : () => widget.onChanged!(!widget.value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        width: widget.width,
        height: 28,
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: trackColor,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: widget.value
                ? widget.activeColor
                : (isDark ? AppColors.darkBorder : AppColors.border),
          ),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutBack,
          alignment: widget.value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: 20,
            height: 20,
            decoration: BoxDecoration(
              color: AppColors.white,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ),
    );
  }
}
