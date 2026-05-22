import '../../models/auth_user.dart';
import '../../models/nav_item.dart';
import 'drawer_sections.dart';

final drawerConfig = <UserRole, List<DrawerSection>>{
  for (final entry in drawerSectionsByRole.entries) entry.key: entry.value,
};
