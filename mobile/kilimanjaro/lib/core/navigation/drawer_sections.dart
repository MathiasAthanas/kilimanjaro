import '../../models/auth_user.dart';
import '../../models/nav_item.dart';

const _icons = 'assets/icons';

DrawerItem _item(String label, String icon, {String? route, bool destructive = false}) {
  return DrawerItem(
    label: label,
    iconAsset: '$_icons/$icon',
    route: route,
    isDestructive: destructive,
  );
}

DrawerSection _section(List<DrawerItem> items, {String? title}) {
  return DrawerSection(title: title, items: items);
}

final drawerSectionsByRole = <UserRole, List<DrawerSection>>{
  UserRole.student: [
    _section([
      _item('Performance Trends', 'trending-up.svg', route: '/shell/student/performance-trends'),
      _item('Report Cards', 'report-card.svg', route: '/shell/student/report-cards'),
      _item('Announcements', 'announcements.svg', route: '/shell/student/announcements'),
    ]),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/student/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/student/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.parent: [
    _section([
      _item('Performance Alerts', 'alert-circle.svg', route: '/shell/parent/performance-alerts'),
      _item('Report Cards', 'report-card.svg', route: '/shell/parent/report-cards'),
      _item('Announcements', 'announcements.svg', route: '/shell/parent/announcements'),
      _item('Contact School', 'contact-school.svg', route: '/shell/parent/contact-school'),
    ]),
    _section([
      _item('My Children', 'children.svg', route: '/shell/parent/children'),
      _item('Settings', 'settings.svg', route: '/shell/parent/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/parent/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.teacher: [
    _section([
      _item('Performance Alerts', 'alert-circle.svg', route: '/shell/teacher/performance-alerts'),
      _item('Peer Pairings', 'performance.svg', route: '/shell/teacher/peer-pairings'),
      _item('Students', 'students.svg', route: '/shell/teacher/students'),
      _item('Timetable', 'timetable.svg', route: '/shell/teacher/timetable'),
      _item('Syllabus Tracker', 'syllabus.svg', route: '/shell/teacher/syllabus-tracker'),
    ], title: 'Academic'),
    _section([
      _item('Announcements', 'announcements.svg', route: '/shell/teacher/announcements'),
    ], title: 'Communication'),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/teacher/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/teacher/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.hod: [
    _section([
      _item('Teachers', 'teacher.svg', route: '/shell/hod/teachers'),
      _item('Subject Analytics', 'analytics.svg', route: '/shell/hod/subject-analytics'),
      _item('Interventions', 'interventions.svg', route: '/shell/hod/interventions'),
      _item('Timetable', 'timetable.svg', route: '/shell/hod/timetable'),
    ], title: 'Management'),
    _section([
      _item('Announcements', 'announcements.svg', route: '/shell/hod/announcements'),
    ], title: 'Communication'),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/hod/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/hod/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.admissions: [
    _section([
      _item('Pipeline Summary', 'analytics.svg', route: '/shell/admissions/home'),
      _item('Applicants', 'students.svg', route: '/shell/admissions/applicants'),
      _item('New Inquiry', 'edit-pencil.svg', route: '/shell/admissions/inquiry'),
    ], title: 'Admissions'),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/admissions/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/admissions/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  // Web-primary desk roles: mobile is a companion (pulse + notifications +
  // profile); the full workspace lives in the web dashboard.
  UserRole.academicQa: _deskRoleSections('aqa'),
  UserRole.manager: _deskRoleSections('principal'),
  UserRole.headOfSchool: _deskRoleSections('principal'),
  UserRole.headOfFinance: _deskRoleSections('finance'),
  UserRole.superAdmin: _deskRoleSections('admin'),
  UserRole.principal: _deskRoleSections('principal'),
  UserRole.finance: _deskRoleSections('finance'),
  UserRole.admin: _deskRoleSections('admin'),
};

List<DrawerSection> _deskRoleSections(String prefix) => [
      _section([
        _item('Overview', 'analytics.svg', route: '/shell/$prefix/home'),
        _item('Notifications', 'bell.svg', route: '/shell/$prefix/notifications'),
      ], title: 'Summary'),
      _section([
        _item('Settings', 'settings.svg', route: '/shell/$prefix/settings'),
        _item('My Profile', 'user-circle.svg', route: '/shell/$prefix/profile'),
      ], title: 'Account'),
      _section([_item('Logout', 'logout.svg', destructive: true)]),
    ];
