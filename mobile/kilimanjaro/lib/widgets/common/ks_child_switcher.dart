import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../models/child_summary_model.dart';
import 'ks_avatar.dart';

class KSChildSwitcher extends StatelessWidget {
  const KSChildSwitcher({
    super.key,
    required this.children,
    required this.activeChildId,
    required this.onSwitch,
  });

  final List<ChildSummary> children;
  final String activeChildId;
  final ValueChanged<String> onSwitch;

  @override
  Widget build(BuildContext context) {
    if (children.length < 2) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final background = isDark ? AppColors.darkBg : AppColors.offWhite;
    final border = isDark ? AppColors.darkBorder : AppColors.border;

    return Container(
      height: 70,
      decoration: BoxDecoration(
        color: background.withValues(alpha: 0.96),
        border: Border(bottom: BorderSide(color: border)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: children.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final child = children[index];
          return _ChildPill(
            child: child,
            active: child.id == activeChildId,
            onTap: () => onSwitch(child.id),
          );
        },
      ),
    );
  }
}

class KSChildSwitcherHeaderDelegate extends SliverPersistentHeaderDelegate {
  const KSChildSwitcherHeaderDelegate({required this.child});

  final Widget child;

  @override
  double get minExtent => 70;

  @override
  double get maxExtent => 70;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return child;
  }

  @override
  bool shouldRebuild(covariant KSChildSwitcherHeaderDelegate oldDelegate) {
    return oldDelegate.child != child;
  }
}

class _ChildPill extends StatelessWidget {
  const _ChildPill({
    required this.child,
    required this.active,
    required this.onTap,
  });

  final ChildSummary child;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOutCubic,
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: active
                ? AppColors.skyBlue500
                : (isDark ? AppColors.darkCard : AppColors.white),
            borderRadius: BorderRadius.circular(24),
            border: active
                ? null
                : Border.all(
                    color: isDark ? AppColors.darkBorder : AppColors.border,
                  ),
            boxShadow: active ? AppShadows.shadow2 : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: active
                      ? Border.all(color: AppColors.white, width: 2)
                      : null,
                ),
                child: KSAvatar(name: child.name, size: 30),
              ),
              const SizedBox(width: 8),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    child.firstName,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: active
                          ? AppColors.white
                          : (isDark
                                ? AppColors.darkText
                                : AppColors.textSecondary),
                      fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                    ),
                  ),
                  Text(
                    child.classLabel,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: 10,
                      color: active
                          ? AppColors.white.withValues(alpha: 0.82)
                          : (isDark
                                ? AppColors.darkMuted
                                : AppColors.textMuted),
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: const Duration(milliseconds: 220),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: active
                      ? AppColors.white.withValues(alpha: 0.25)
                      : (isDark
                            ? AppColors.darkBorder.withValues(alpha: 0.6)
                            : AppColors.offWhite),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  child.isFullyPaid ? 'PAID' : 'DUE',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: active
                        ? AppColors.white
                        : child.isFullyPaid
                        ? AppColors.accentEmerald
                        : AppColors.accentAmber,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
