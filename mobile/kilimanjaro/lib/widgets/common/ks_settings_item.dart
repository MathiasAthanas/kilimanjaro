import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'ks_list_tile.dart';
import 'ks_svg_icon.dart';

class KSSettingsItem extends StatelessWidget {
  const KSSettingsItem({
    super.key,
    required this.title,
    required this.iconAsset,
    required this.iconColor,
    this.subtitle,
    this.showChevron = true,
    this.value,
    this.customTrailing,
    this.onTap,
    this.showDivider = true,
  });

  final String title;
  final String iconAsset;
  final Color iconColor;
  final String? subtitle;
  final bool showChevron;
  final String? value;
  final Widget? customTrailing;
  final VoidCallback? onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return KSListTile(
      title: title,
      subtitle: subtitle,
      onTap: onTap,
      showDivider: showDivider,
      leading: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.15),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Center(
          child: KSSvgIcon(
            iconAsset,
            size: 18,
            color: iconColor,
          ),
        ),
      ),
      trailing: customTrailing ??
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (value != null)
                Text(
                  value!,
                  style: TextStyle(
                    fontSize: 14,
                    color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                  ),
                ),
              if (value != null && showChevron) const SizedBox(width: 8),
              if (showChevron)
                KSSvgIcon(
                  'assets/icons/chevron-right.svg',
                  size: 16,
                  color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                ),
            ],
          ),
    );
  }
}
