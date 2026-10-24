import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/navigation/drawer_config.dart';
import '../../core/providers/auth_provider.dart';
import '../../core/providers/notification_provider.dart';
import '../../core/providers/school_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../models/auth_user.dart';
import '../../models/nav_item.dart';
import '../common/ks_avatar.dart';
import '../common/ks_role_badge.dart';
import '../common/ks_svg_icon.dart';

class KSSideDrawer extends ConsumerWidget {
  const KSSideDrawer({
    super.key,
    required this.role,
    required this.activeLocation,
    required this.onClose,
  });

  final UserRole role;
  final String activeLocation;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sections = drawerConfig[role] ?? const <DrawerSection>[];
    final user = ref.watch(currentUserProvider).valueOrNull;
    final safeBottom = MediaQuery.paddingOf(context).bottom;

    return Drawer(
      width: (MediaQuery.sizeOf(context).width * 0.88).clamp(320.0, 420.0),
      backgroundColor: AppColors.offWhite,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(left: Radius.circular(30)),
      ),
      child: SafeArea(
        bottom: false,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _DrawerHeader(role: role, user: user, onClose: onClose),
            ),
            const SliverToBoxAdapter(child: _SchoolSwitcher()),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
              sliver: SliverList.builder(
                itemCount: sections.length,
                itemBuilder: (context, sectionIndex) => _DrawerSectionView(
                  section: sections[sectionIndex],
                  activeLocation: activeLocation,
                  onTap: (item) => _handleItemTap(context, ref, item),
                ),
              ),
            ),
            SliverFillRemaining(
              hasScrollBody: false,
              child: Align(
                alignment: Alignment.bottomCenter,
                child: _DrawerFooter(
                  role: role,
                  safeBottom: safeBottom,
                  onLogout: () => _handleItemTap(
                    context,
                    ref,
                    const DrawerItem(
                      label: 'Logout',
                      iconAsset: 'assets/icons/logout.svg',
                      isDestructive: true,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleItemTap(
    BuildContext context,
    WidgetRef ref,
    DrawerItem item,
  ) async {
    final router = GoRouter.of(context);
    final auth = ref.read(authControllerProvider.notifier);
    final route = item.route;

    onClose();
    await Future<void>.delayed(const Duration(milliseconds: 80));

    if (item.isDestructive) {
      await auth.logout();
      router.go('/login');
      return;
    }

    if (route != null && route != activeLocation) {
      router.go(route);
    }
  }
}

class _DrawerHeader extends StatelessWidget {
  const _DrawerHeader({
    required this.role,
    required this.user,
    required this.onClose,
  });

  final UserRole role;
  final AuthUser? user;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(14),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppColors.heroGradient,
        borderRadius: BorderRadius.circular(26),
        boxShadow: [
          BoxShadow(
            color: AppColors.skyBlue900.withValues(alpha: 0.20),
            blurRadius: 26,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -42,
            top: -42,
            child: Container(
              width: 142,
              height: 142,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.white.withValues(alpha: 0.10),
                  width: 18,
                ),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Image.asset(
                      'assets/images/kilimanjaro_logo_icon.png',
                    ),
                  ),
                  const Spacer(),
                  IconButton.filledTonal(
                    onPressed: onClose,
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              Row(
                children: [
                  KSAvatar(name: user?.name ?? role.label, size: 52),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user?.name ?? role.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleLarge
                              ?.copyWith(color: AppColors.white),
                        ),
                        const SizedBox(height: 6),
                        KSRoleBadge(role: role),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                'Navigate quickly across ${role.label.toLowerCase()} tools and account settings.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppColors.white.withValues(alpha: 0.76),
                  height: 1.45,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DrawerSectionView extends StatelessWidget {
  const _DrawerSectionView({
    required this.section,
    required this.activeLocation,
    required this.onTap,
  });

  final DrawerSection section;
  final String activeLocation;
  final ValueChanged<DrawerItem> onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (section.title != null) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: Text(
                section.title!.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.textMuted,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.1,
                ),
              ),
            ),
          ],
          ...section.items.map(
            (item) => _DrawerTile(
              item: item,
              active: item.route != null && activeLocation == item.route,
              onTap: () => onTap(item),
            ),
          ),
        ],
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final DrawerItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tint = item.isDestructive
        ? AppColors.accentRose
        : active
        ? AppColors.skyBlue700
        : AppColors.textPrimary;

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: active ? AppColors.skyBlue50 : AppColors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: active
                    ? AppColors.skyBlue200
                    : AppColors.border.withValues(alpha: 0.72),
              ),
              boxShadow: active
                  ? [
                      BoxShadow(
                        color: AppColors.skyBlue900.withValues(alpha: 0.08),
                        blurRadius: 18,
                        offset: const Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: tint.withValues(alpha: active ? 0.14 : 0.10),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  alignment: Alignment.center,
                  child: KSSvgIcon(item.iconAsset, size: 20, color: tint),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.label,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      color: tint,
                      fontWeight: active ? FontWeight.w900 : FontWeight.w700,
                    ),
                  ),
                ),
                if (item.badge != null)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.accentAmber.withValues(alpha: 0.14),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      item.badge!.label,
                      style: const TextStyle(
                        color: AppColors.accentAmber,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  )
                else
                  Icon(
                    active
                        ? Icons.check_circle_rounded
                        : Icons.chevron_right_rounded,
                    color: active ? AppColors.skyBlue600 : AppColors.textMuted,
                    size: 20,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DrawerFooter extends StatelessWidget {
  const _DrawerFooter({
    required this.role,
    required this.safeBottom,
    required this.onLogout,
  });

  final UserRole role;
  final double safeBottom;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 14 + safeBottom),
      decoration: const BoxDecoration(
        color: AppColors.white,
        border: Border(top: BorderSide(color: AppColors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${role.label} workspace',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          TextButton.icon(
            onPressed: onLogout,
            icon: const Icon(Icons.logout_rounded, size: 18),
            label: const Text('Logout'),
            style: TextButton.styleFrom(foregroundColor: AppColors.accentRose),
          ),
        ],
      ),
    );
  }
}


/// Lets staff who belong to several schools pick the school they are working
/// in; the choice is sent with every request and reloads all data.
class _SchoolSwitcher extends ConsumerWidget {
  const _SchoolSwitcher();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final schools = ref.watch(userSchoolsProvider).valueOrNull ?? const <SchoolOption>[];
    if (schools.length < 2) return const SizedBox.shrink();
    final activeId = ref.watch(activeSchoolIdProvider).valueOrNull;
    final active = schools.where((s) => s.id == activeId).firstOrNull;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      child: Material(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(18),
        child: ListTile(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          leading: const Icon(Icons.apartment_rounded, color: AppColors.skyBlue600),
          title: Text(
            active?.name ?? 'All schools',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          subtitle: const Text('Tap to switch school'),
          trailing: const Icon(Icons.swap_horiz_rounded),
          onTap: () => _pick(context, ref, schools, activeId),
        ),
      ),
    );
  }

  Future<void> _pick(
    BuildContext context,
    WidgetRef ref,
    List<SchoolOption> schools,
    String? activeId,
  ) async {
    final user = ref.read(currentUserProvider).valueOrNull;
    final isGroup = user != null && user.schoolIds.isEmpty;
    const allSchools = '__all__';
    final chosen = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (isGroup)
              ListTile(
                leading: Icon(
                  activeId == null
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: AppColors.skyBlue600,
                ),
                title: const Text('All schools'),
                onTap: () => Navigator.of(sheetContext).pop(allSchools),
              ),
            for (final school in schools)
              ListTile(
                leading: Icon(
                  school.id == activeId
                      ? Icons.radio_button_checked_rounded
                      : Icons.radio_button_off_rounded,
                  color: AppColors.skyBlue600,
                ),
                title: Text(school.name),
                onTap: () => Navigator.of(sheetContext).pop(school.id),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (chosen == null) return;
    final next = chosen == allSchools ? null : chosen;
    if (next != activeId) await selectActiveSchool(ref, next);
  }
}
