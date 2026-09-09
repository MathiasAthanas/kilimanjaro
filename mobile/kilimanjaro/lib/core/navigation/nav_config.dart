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
  UserRole.admissions: const [
    NavItem(
      label: 'Home',
      iconAsset: '$_icons/home.svg',
      iconActiveAsset: '$_icons/home_filled.svg',
      route: '/shell/admissions/home',
    ),
    NavItem(
      label: 'Applicants',
      iconAsset: '$_icons/user-group.svg',
      iconActiveAsset: '$_icons/user-group_filled.svg',
      route: '/shell/admissions/applicants',
    ),
    NavItem(
      label: 'New Inquiry',
      iconAsset: '$_icons/edit-pencil.svg',
      iconActiveAsset: '$_icons/edit-pencil_filled.svg',
      route: '/shell/admissions/inquiry',
    ),
    NavItem(
      label: 'Alerts',
      iconAsset: '$_icons/bell.svg',
      iconActiveAsset: '$_icons/bell_filled.svg',
      route: '/shell/admissions/notifications',
    ),
    NavItem(
      label: 'More',
      iconAsset: '$_icons/grid-dots.svg',
      iconActiveAsset: '$_icons/grid-dots_filled.svg',
      isMore: true,
    ),
  ],
  // Web-primary desk roles: read-only pulse + notifications + profile only.
  UserRole.academicQa: _deskRoleNav('aqa'),
  UserRole.manager: _deskRoleNav('principal'),
  UserRole.headOfSchool: _deskRoleNav('principal'),
  UserRole.headOfFinance: _deskRoleNav('finance'),
  UserRole.superAdmin: _deskRoleNav('admin'),
  UserRole.principal: _deskRoleNav('principal'),
  UserRole.finance: _deskRoleNav('finance'),
  UserRole.admin: _deskRoleNav('admin'),
};

List<NavItem> _deskRoleNav(String prefix) => [
      NavItem(
        label: 'Home',
        iconAsset: '$_icons/home.svg',
        iconActiveAsset: '$_icons/home_filled.svg',
        route: '/shell/$prefix/home',
      ),
      NavItem(
        label: 'Alerts',
        iconAsset: '$_icons/bell.svg',
        iconActiveAsset: '$_icons/bell_filled.svg',
        route: '/shell/$prefix/notifications',
      ),
      NavItem(
        label: 'Profile',
        iconAsset: '$_icons/user-group.svg',
        iconActiveAsset: '$_icons/user-group_filled.svg',
        route: '/shell/$prefix/profile',
      ),
      NavItem(
        label: 'Settings',
        iconAsset: '$_icons/cog-6-tooth.svg',
        iconActiveAsset: '$_icons/cog-6-tooth_filled.svg',
        route: '/shell/$prefix/settings',
      ),
      NavItem(
        label: 'More',
        iconAsset: '$_icons/grid-dots.svg',
        iconActiveAsset: '$_icons/grid-dots_filled.svg',
        isMore: true,
      ),
    ];
