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
  UserRole.academicQa: [
    _section([
      _item('All Classes', 'classes.svg', route: '/shell/aqa/classes'),
      _item('All Teachers', 'teacher.svg', route: '/shell/aqa/teachers'),
      _item('Engine Config', 'cpu-chip.svg', route: '/shell/aqa/engine-config'),
    ], title: 'Academic'),
    _section([
      _item('Reports', 'report-card.svg', route: '/shell/aqa/reports'),
    ], title: 'Reports'),
    _section([
      _item('Announcements', 'announcements.svg', route: '/shell/aqa/announcements'),
    ], title: 'Communication'),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/aqa/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/aqa/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.principal: [
    _section([
      _item('Finance', 'finance.svg', route: '/shell/principal/finance'),
      _item('Performance', 'performance.svg', route: '/shell/principal/performance'),
      _item('Discipline Overview', 'discipline.svg', route: '/shell/principal/discipline'),
      _item('Staff Overview', 'staff.svg', route: '/shell/principal/staff'),
    ], title: 'Operations'),
    _section([
      _item('Announcements', 'announcements.svg', route: '/shell/principal/announcements'),
    ], title: 'Communication'),
    _section([
      _item('Generate Reports', 'report-card.svg', route: '/shell/principal/reports'),
    ], title: 'Reports'),
    _section([
      _item('School Settings', 'settings.svg', route: '/shell/principal/school-settings'),
    ], title: 'System'),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/principal/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/principal/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.finance: [
    _section([
      _item('Fee Categories', 'finance.svg', route: '/shell/finance/fee-categories'),
      _item('Fee Structures', 'document-text.svg', route: '/shell/finance/fee-structures'),
      _item('Fee Assignments', 'receipt.svg', route: '/shell/finance/fee-assignments'),
      _item('Assets', 'assets.svg', route: '/shell/finance/assets'),
      _item('Audit Log', 'audit.svg', route: '/shell/finance/audit'),
    ], title: 'Finance'),
    _section([
      _item('Settings', 'settings.svg', route: '/shell/finance/settings'),
      _item('My Profile', 'user-circle.svg', route: '/shell/finance/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
  UserRole.admin: [
    _section([
      _item('Students', 'students.svg', route: '/shell/admin/students'),
      _item('Classes', 'classes.svg', route: '/shell/admin/classes'),
      _item('Subjects', 'subjects.svg', route: '/shell/admin/subjects'),
      _item('Grading Scales', 'grading.svg', route: '/shell/admin/grading-scales'),
      _item('Assessment Types', 'assessment-types.svg', route: '/shell/admin/assessment-types'),
    ], title: 'Academic'),
    _section([
      _item('Fee Categories', 'finance.svg', route: '/shell/admin/fee-categories'),
      _item('Performance Engine', 'cpu-chip.svg', route: '/shell/admin/performance-engine'),
    ], title: 'Finance'),
    _section([
      _item('Notification Templates', 'bell.svg', route: '/shell/admin/notification-templates'),
      _item('Send Manual Notification', 'announcements.svg', route: '/shell/admin/manual-notification'),
      _item('Notification Logs', 'audit.svg', route: '/shell/admin/notification-logs'),
    ], title: 'Communications'),
    _section([
      _item('Analytics', 'analytics.svg', route: '/shell/admin/analytics'),
      _item('Generate Reports', 'report-card.svg', route: '/shell/admin/reports'),
      _item('Financial Audit Log', 'audit.svg', route: '/shell/admin/financial-audit'),
      _item('System Audit Log', 'audit.svg', route: '/shell/admin/system-audit'),
    ], title: 'Reports & Audit'),
    _section([
      _item('System Settings', 'settings.svg', route: '/shell/admin/settings'),
      _item('Announcements', 'announcements.svg', route: '/shell/admin/announcements'),
    ], title: 'System'),
    _section([
      _item('My Profile', 'user-circle.svg', route: '/shell/admin/profile'),
    ], title: 'Account'),
    _section([_item('Logout', 'logout.svg', destructive: true)]),
  ],
};
