import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/nav_config.dart';
import '../../core/providers/shell_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../models/nav_item.dart';

class LiquidGlassNavBar extends ConsumerWidget {
  const LiquidGlassNavBar({
    super.key,
    required this.role,
    required this.currentIndex,
    required this.onItemSelected,
    required this.onMoreTap,
  });

  final UserRole role;
  final int currentIndex;
  final void Function(int index, String route) onItemSelected;
  final VoidCallback onMoreTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = navConfig[role]!;
    final shell = ref.watch(shellControllerProvider);
    final safeBottom = MediaQuery.paddingOf(context).bottom;

    return AnimatedSlide(
      duration: const Duration(milliseconds: 240),
      curve: Curves.easeOutCubic,
      offset: shell.isNavBarVisible ? Offset.zero : const Offset(0, 1.2),
      child: Padding(
        padding: EdgeInsets.fromLTRB(14, 0, 14, 12 + safeBottom),
        child: _BalancedNavChrome(
          child: Row(
            children: [
              for (var index = 0; index < items.length; index++)
                Expanded(
                  child: _BalancedNavItem(
                    item: items[index],
                    active: items[index].isMore
                        ? shell.isDrawerOpen
                        : index == currentIndex,
                    onTap: () {
                      HapticFeedback.lightImpact();
                      if (items[index].isMore) {
                        onMoreTap();
                        return;
                      }
                      final route = items[index].route;
                      if (route != null) onItemSelected(index, route);
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BalancedNavChrome extends StatelessWidget {
  const _BalancedNavChrome({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return ClipRRect(
      borderRadius: BorderRadius.circular(30),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 22, sigmaY: 22),
        child: Container(
          height: 76,
          padding: const EdgeInsets.all(7),
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.darkSurface.withValues(alpha: 0.94)
                : AppColors.white.withValues(alpha: 0.92),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: isDark
                  ? AppColors.white.withValues(alpha: 0.08)
                  : AppColors.white.withValues(alpha: 0.72),
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.skyBlue900.withValues(alpha: 0.15),
                blurRadius: 28,
                offset: const Offset(0, 14),
              ),
            ],
          ),
          child: child,
        ),
      ),
    );
  }
}

class _BalancedNavItem extends StatelessWidget {
  const _BalancedNavItem({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final NavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final inactive = isDark
        ? AppColors.darkTextSecondary
        : AppColors.textSecondary;
    final color = active ? AppColors.white : inactive;
    final activeColor = item.isMore
        ? AppColors.skyBlue800
        : AppColors.skyBlue600;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 190),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 2),
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
          decoration: BoxDecoration(
            gradient: active
                ? LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [activeColor, AppColors.skyBlue500],
                  )
                : null,
            borderRadius: BorderRadius.circular(24),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: SizedBox(
              width: 54,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    _iconForNavItem(item.label, active: active),
                    size: 21,
                    color: color,
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontSize: 9.5,
                      color: color,
                      fontWeight: active ? FontWeight.w900 : FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

IconData _iconForNavItem(String label, {required bool active}) {
  switch (label.toLowerCase()) {
    case 'home':
      return active ? Icons.home_rounded : Icons.home_outlined;
    case 'results':
      return active ? Icons.bar_chart_rounded : Icons.bar_chart_outlined;
    case 'attendance':
      return active
          ? Icons.calendar_month_rounded
          : Icons.calendar_today_outlined;
    case 'finance':
      return active
          ? Icons.account_balance_wallet_rounded
          : Icons.account_balance_wallet_outlined;
    case 'academics':
      return active ? Icons.school_rounded : Icons.school_outlined;
    case 'classes':
      return active ? Icons.menu_book_rounded : Icons.menu_book_outlined;
    case 'learn':
    case 'learning':
    case 'courses':
      return active ? Icons.school_rounded : Icons.school_outlined;
    case 'marks':
      return active ? Icons.edit_note_rounded : Icons.edit_note_outlined;
    case 'approvals':
      return active
          ? Icons.assignment_turned_in_rounded
          : Icons.assignment_turned_in_outlined;
    case 'department':
      return active ? Icons.apartment_rounded : Icons.apartment_outlined;
    case 'performance':
      return active ? Icons.insights_rounded : Icons.insights_outlined;
    case 'analytics':
      return active ? Icons.analytics_rounded : Icons.analytics_outlined;
    case 'interventions':
      return active
          ? Icons.volunteer_activism_rounded
          : Icons.volunteer_activism_outlined;
    case 'students':
      return active ? Icons.groups_rounded : Icons.groups_outlined;
    case 'invoices':
      return active ? Icons.description_rounded : Icons.description_outlined;
    case 'payments':
      return active ? Icons.payments_rounded : Icons.payments_outlined;
    case 'reports':
      return active ? Icons.assessment_rounded : Icons.assessment_outlined;
    case 'users':
      return active
          ? Icons.manage_accounts_rounded
          : Icons.manage_accounts_outlined;
    case 'system':
      return active
          ? Icons.settings_applications_rounded
          : Icons.settings_applications_outlined;
    case 'notify':
      return active
          ? Icons.notifications_rounded
          : Icons.notifications_none_rounded;
    case 'more':
      return active ? Icons.close_rounded : Icons.grid_view_rounded;
    default:
      return active ? Icons.circle_rounded : Icons.circle_outlined;
  }
}
