import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/shell_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../models/auth_user.dart';
import 'ks_avatar.dart';
import 'ks_role_badge.dart';
import 'ks_svg_icon.dart';

class CommonScreenSurface extends ConsumerWidget {
  const CommonScreenSurface({
    super.key,
    required this.children,
    this.header,
    this.padding = const EdgeInsets.fromLTRB(20, 16, 20, 0),
  });

  final Widget? header;
  final List<Widget> children;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bottomPadding = ref.watch(shellControllerProvider).navBarHeight + 24;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? const [AppColors.darkBg, Color(0xFF111C2E)]
              : const [Color(0xFFEFF8FF), AppColors.offWhite],
        ),
      ),
      child: ListView(
        padding: padding.copyWith(bottom: bottomPadding),
        children: [
          if (header != null) ...[header!, const SizedBox(height: 18)],
          ...children,
        ],
      ),
    );
  }
}

class CommonHeroCard extends StatelessWidget {
  const CommonHeroCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.user,
    this.iconAsset,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final AuthUser? user;
  final String? iconAsset;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppColors.heroGradient,
        borderRadius: BorderRadius.circular(28),
        boxShadow: AppShadows.shadow3,
      ),
      child: Row(
        children: [
          user == null
              ? _HeroIcon(iconAsset: iconAsset ?? 'assets/icons/grid-dots.svg')
              : KSAvatar(
                  name: user!.name,
                  imageUrl: user!.profilePhotoUrl,
                  size: 58,
                  heroTag: 'avatar_${user!.id}',
                ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppColors.white.withValues(alpha: 0.78),
                    height: 1.35,
                  ),
                ),
                if (user != null) ...[
                  const SizedBox(height: 10),
                  KSRoleBadge(role: user!.role),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 12), trailing!],
        ],
      ),
    );
  }
}

class CommonCard extends StatelessWidget {
  const CommonCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.margin = const EdgeInsets.only(bottom: 16),
  });

  final Widget child;
  final EdgeInsets padding;
  final EdgeInsets margin;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkSurface : AppColors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: isDark
              ? AppColors.darkBorder
              : AppColors.border.withValues(alpha: 0.7),
        ),
        boxShadow: isDark ? null : AppShadows.shadow1,
      ),
      child: child,
    );
  }
}

class CommonMetricPill extends StatelessWidget {
  const CommonMetricPill({
    super.key,
    required this.label,
    required this.value,
    required this.iconAsset,
    required this.color,
  });

  final String label;
  final String value;
  final String iconAsset;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: isDark ? 0.16 : 0.1),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          KSSvgIcon(iconAsset, size: 18, color: color),
          const SizedBox(height: 10),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              color: isDark ? AppColors.darkText : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: isDark
                  ? AppColors.darkTextSecondary
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class CommonSectionTitle extends StatelessWidget {
  const CommonSectionTitle({super.key, required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 4, 2, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: isDark ? AppColors.darkText : AppColors.textPrimary,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 3),
            Text(
              subtitle!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: isDark
                    ? AppColors.darkTextSecondary
                    : AppColors.textSecondary,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeroIcon extends StatelessWidget {
  const _HeroIcon({required this.iconAsset});

  final String iconAsset;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 58,
      height: 58,
      decoration: BoxDecoration(
        color: AppColors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.white.withValues(alpha: 0.24)),
      ),
      child: Center(
        child: KSSvgIcon(iconAsset, size: 25, color: AppColors.white),
      ),
    );
  }
}
