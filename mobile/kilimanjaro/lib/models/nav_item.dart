import 'auth_user.dart';

class NavItem {
  const NavItem({
    required this.label,
    required this.iconAsset,
    required this.iconActiveAsset,
    this.route,
    this.isMore = false,
  });

  final String label;
  final String iconAsset;
  final String iconActiveAsset;
  final String? route;
  final bool isMore;
}

class DrawerBadge {
  const DrawerBadge(this.label);
  final String label;
}

class DrawerItem {
  const DrawerItem({
    required this.label,
    required this.iconAsset,
    this.route,
    this.isDestructive = false,
    this.badge,
  });

  final String label;
  final String iconAsset;
  final String? route;
  final bool isDestructive;
  final DrawerBadge? badge;
}

class DrawerSection {
  const DrawerSection({required this.items, this.title});
  final String? title;
  final List<DrawerItem> items;
}

class ShellDestination {
  const ShellDestination({
    required this.role,
    required this.index,
    required this.title,
    required this.route,
  });

  final UserRole role;
  final int index;
  final String title;
  final String route;
}
