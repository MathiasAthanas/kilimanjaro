import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import 'ks_svg_icon.dart';

class KSListTile extends StatefulWidget {
  const KSListTile({
    super.key,
    required this.title,
    this.leading,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.isDestructive = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
    this.showDivider = true,
    this.backgroundColor,
    this.borderRadius,
  });

  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool isDestructive;
  final EdgeInsets padding;
  final bool showDivider;
  final Color? backgroundColor;
  final BorderRadius? borderRadius;

  @override
  State<KSListTile> createState() => _KSListTileState();
}

class _KSListTileState extends State<KSListTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = widget.backgroundColor ??
        (_pressed
            ? (isDark ? AppColors.darkCard : AppColors.surface)
            : Colors.transparent);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: widget.borderRadius ?? BorderRadius.circular(16),
        onTap: widget.onTap == null
            ? null
            : () {
                HapticFeedback.selectionClick();
                widget.onTap?.call();
              },
        onHighlightChanged: (value) => setState(() => _pressed = value),
        child: Container(
          padding: widget.padding,
          decoration: BoxDecoration(
            color: bg,
            borderRadius: widget.borderRadius ?? BorderRadius.circular(16),
            border: widget.showDivider
                ? Border(
                    bottom: BorderSide(
                      color: isDark
                          ? AppColors.darkBorder.withValues(alpha: 0.5)
                          : AppColors.border.withValues(alpha: 0.6),
                      width: 0.5,
                    ),
                  )
                : null,
          ),
          child: Row(
            children: [
              SizedBox(width: 44, child: Center(child: widget.leading)),
              const SizedBox(width: 4),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: widget.isDestructive
                            ? AppColors.accentRose
                            : (isDark ? AppColors.darkText : AppColors.textPrimary),
                      ),
                    ),
                    if (widget.subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        widget.subtitle!,
                        style: TextStyle(
                          fontSize: 13,
                          color: isDark
                              ? AppColors.darkTextSecondary
                              : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              widget.trailing ??
                  (widget.onTap != null
                      ? KSSvgIcon(
                          'assets/icons/chevron-right.svg',
                          size: 16,
                          color: isDark ? AppColors.darkMuted : AppColors.textMuted,
                        )
                      : const SizedBox.shrink()),
            ],
          ),
        ),
      ),
    );
  }
}
