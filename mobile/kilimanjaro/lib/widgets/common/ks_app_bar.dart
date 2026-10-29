import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../core/theme/app_colors.dart';
import 'ks_back_button.dart';

enum KSAppBarVariant { standard, hero }

class KSAppBar extends StatelessWidget implements PreferredSizeWidget {
  const KSAppBar({
    super.key,
    required this.title,
    this.showBack = true,
    this.actions = const [],
    this.variant = KSAppBarVariant.standard,
    this.subtitle,
    this.scrollOffset = 0,
  });

  final String title;
  final bool showBack;
  final List<Widget> actions;
  final KSAppBarVariant variant;
  final String? subtitle;
  final double scrollOffset;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final foreground = isDark ? AppColors.darkText : AppColors.textPrimary;
    final collapsed = scrollOffset > 24;

    if (variant == KSAppBarVariant.hero) {
      return AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: IconTheme(
          data: const IconThemeData(color: AppColors.white),
          child: Container(
            decoration: const BoxDecoration(gradient: AppColors.heroGradient),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: collapsed ? 0.08 : 0),
              ),
              child: SafeArea(
                bottom: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (showBack)
                        const Padding(
                          padding: EdgeInsets.only(right: 14, top: 4),
                          child: KSBackButton(
                            foregroundColor: AppColors.white,
                            backgroundColor: Color(0x1FFFFFFF),
                          ),
                        ),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // One line: long titles shrink to fit instead of wrapping and growing the header.
                            FittedBox(
                              fit: BoxFit.scaleDown,
                              alignment: Alignment.centerLeft,
                              child: AnimatedDefaultTextStyle(
                                duration: const Duration(milliseconds: 220),
                                curve: Curves.easeOutCubic,
                                style: GoogleFonts.spaceGrotesk(
                                  fontSize: collapsed ? 22 : 30,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.white,
                                  height: 1.1,
                                ),
                                child: Text(title, maxLines: 1, softWrap: false),
                              ),
                            ),
                            if (subtitle != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                subtitle!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w500,
                                  color: AppColors.white.withValues(alpha: 0.82),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      ...actions,
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        color: collapsed
            ? (isDark
                ? AppColors.darkSurface.withValues(alpha: 0.88)
                : AppColors.white.withValues(alpha: 0.88))
            : Colors.transparent,
        border: collapsed
            ? Border(
                bottom: BorderSide(
                  color: isDark ? AppColors.darkBorder : AppColors.border,
                ),
              )
            : null,
      ),
      child: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        titleSpacing: showBack ? 0 : NavigationToolbar.kMiddleSpacing,
        title: Text(
          title,
          style: theme.textTheme.titleLarge?.copyWith(color: foreground),
        ),
        leading: showBack
            ? Padding(
                padding: const EdgeInsets.only(left: 12),
                child: KSBackButton(
                  foregroundColor: foreground,
                  backgroundColor: isDark
                      ? AppColors.darkCard.withValues(alpha: 0.92)
                      : AppColors.white.withValues(alpha: 0.92),
                ),
              )
            : null,
        actions: actions,
        foregroundColor: foreground,
      ),
    );
  }

  /// Height of the status-bar inset, read without a BuildContext so the hero can size itself to the device.
  static double get _statusBarInset {
    final views = WidgetsBinding.instance.platformDispatcher.views;
    if (views.isEmpty) return 24;
    final view = views.first;
    return view.padding.top / view.devicePixelRatio;
  }

  @override
  Size get preferredSize => Size.fromHeight(
        variant == KSAppBarVariant.hero ? _statusBarInset + 92 : 64,
      );
}
