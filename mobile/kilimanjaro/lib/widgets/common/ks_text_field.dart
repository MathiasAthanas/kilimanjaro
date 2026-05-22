import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ks_svg_icon.dart';

class KSTextField extends StatelessWidget {
  const KSTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.iconAsset,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
    this.trailing,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? iconAsset;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextField(
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: iconAsset == null
            ? null
            : Padding(
                padding: const EdgeInsets.all(14),
                child: KSSvgIcon(
                  iconAsset!,
                  color: isDark ? AppColors.darkTextSecondary : AppColors.textSecondary,
                ),
              ),
        suffixIcon: trailing == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(right: 8),
                child: trailing,
              ),
      ),
    );
  }
}
