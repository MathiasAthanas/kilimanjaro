import '../../models/auth_user.dart';
import '../../models/nav_item.dart';

const _icons = 'assets/icons';

final navConfig = <UserRole, List<NavItem>>{
  UserRole.student: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/student/home',
    ),
    NavItem(
      label: 'Results',
      iconAsset: '$_icons/chart-bar.svg',
      iconActiveAsset: '$_icons/chart-bar_filled.svg',
      route: '/shell/student/results',
    ),
    NavItem(
      label: 'Attendance',
      iconAsset: '$_icons/calendar-check.svg',
      iconActiveAsset: '$_icons/calendar-check_filled.svg',
      route: '/shell/student/attendance',
    ),
    NavItem(
      label: 'Learn',
      iconAsset: '$_icons/book-open.svg',
      iconActiveAsset: '$_icons/book-open_filled.svg',
      route: '/shell/student/learn',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.parent: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/parent/home',
    ),
    NavItem(
      label: 'Academics',
      iconAsset: '$_icons/graduation-cap.svg',
      iconActiveAsset: '$_icons/graduation-cap_filled.svg',
      route: '/shell/parent/academics',
    ),
    NavItem(
      label: 'Finance',
      iconAsset: '$_icons/coin-stack.svg',
      iconActiveAsset: '$_icons/coin-stack_filled.svg',
      route: '/shell/parent/finance',
    ),
    NavItem(
      label: 'Learning',
      iconAsset: '$_icons/book-open.svg',
      iconActiveAsset: '$_icons/book-open_filled.svg',
      route: '/shell/parent/learning',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.teacher: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/teacher/home',
    ),
    NavItem(
      label: 'Classes',
      iconAsset: '$_icons/book-open.svg',
      iconActiveAsset: '$_icons/book-open_filled.svg',
      route: '/shell/teacher/classes',
    ),
    NavItem(
      label: 'Courses',
      iconAsset: '$_icons/graduation-cap.svg',
      iconActiveAsset: '$_icons/graduation-cap_filled.svg',
      route: '/shell/teacher/courses',
    ),
    NavItem(
      label: 'Attendance',
      iconAsset: '$_icons/calendar-check.svg',
      iconActiveAsset: '$_icons/calendar-check_filled.svg',
      route: '/shell/teacher/attendance',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.hod: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/hod/home',
    ),
    NavItem(
      label: 'Approvals',
      iconAsset: '$_icons/clipboard-check.svg',
      iconActiveAsset: '$_icons/clipboard-check_filled.svg',
      route: '/shell/hod/approvals',
    ),
    NavItem(
      label: 'Department',
      iconAsset: '$_icons/building-office.svg',
      iconActiveAsset: '$_icons/building-office_filled.svg',
      route: '/shell/hod/department',
    ),
    NavItem(
      label: 'Performance',
      iconAsset: '$_icons/chart-line.svg',
      iconActiveAsset: '$_icons/chart-line_filled.svg',
      route: '/shell/hod/performance',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.academicQa: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/aqa/home',
    ),
    NavItem(
      label: 'Performance',
      iconAsset: '$_icons/shield-check.svg',
      iconActiveAsset: '$_icons/shield-check_filled.svg',
      route: '/shell/aqa/performance',
    ),
    NavItem(
      label: 'Analytics',
      iconAsset: '$_icons/chart-bar-square.svg',
      iconActiveAsset: '$_icons/chart-bar-square_filled.svg',
      route: '/shell/aqa/analytics',
    ),
    NavItem(
      label: 'Interventions',
      iconAsset: '$_icons/hand-raised.svg',
      iconActiveAsset: '$_icons/hand-raised_filled.svg',
      route: '/shell/aqa/interventions',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.principal: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/principal/home',
    ),
    NavItem(
      label: 'Approvals',
      iconAsset: '$_icons/clipboard-check.svg',
      iconActiveAsset: '$_icons/clipboard-check_filled.svg',
      route: '/shell/principal/approvals',
    ),
    NavItem(
      label: 'Analytics',
      iconAsset: '$_icons/chart-bar-square.svg',
      iconActiveAsset: '$_icons/chart-bar-square_filled.svg',
      route: '/shell/principal/analytics',
    ),
    NavItem(
      label: 'Students',
      iconAsset: '$_icons/user-group.svg',
      iconActiveAsset: '$_icons/user-group_filled.svg',
      route: '/shell/principal/students',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.finance: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/finance/home',
    ),
    NavItem(
      label: 'Invoices',
      iconAsset: '$_icons/document-text.svg',
      iconActiveAsset: '$_icons/document-text_filled.svg',
      route: '/shell/finance/invoices',
    ),
    NavItem(
      label: 'Payments',
      iconAsset: '$_icons/banknotes.svg',
      iconActiveAsset: '$_icons/banknotes_filled.svg',
      route: '/shell/finance/payments',
    ),
    NavItem(
      label: 'Reports',
      iconAsset: '$_icons/chart-bar.svg',
      iconActiveAsset: '$_icons/chart-bar_filled.svg',
      route: '/shell/finance/reports',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  UserRole.admin: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/admin/home',
    ),
    NavItem(
      label: 'Users',
      iconAsset: '$_icons/user-group.svg',
      iconActiveAsset: '$_icons/user-group_filled.svg',
      route: '/shell/admin/users',
    ),
    NavItem(
      label: 'System',
      iconAsset: '$_icons/cog-6-tooth.svg',
      iconActiveAsset: '$_icons/cog-6-tooth_filled.svg',
      route: '/shell/admin/system',
    ),
    NavItem(
      label: 'Notify',
      iconAsset: '$_icons/bell.svg',
      iconActiveAsset: '$_icons/bell_filled.svg',
      route: '/shell/admin/notifications',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
};
