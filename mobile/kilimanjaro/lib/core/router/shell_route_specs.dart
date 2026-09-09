import '../../models/auth_user.dart';

class ShellRouteSpec {
  const ShellRouteSpec({
    required this.prefix,
    required this.role,
    required this.tab2,
    required this.tab3,
    required this.tab4,
    required this.extras,
  });

  final String prefix;
  final UserRole role;
  final String tab2;
  final String tab3;
  final String tab4;
  final List<String> extras;
}

const shellRouteSpecs = <ShellRouteSpec>[
  ShellRouteSpec(
    prefix: 'student',
    role: UserRole.student,
    tab2: 'results',
    tab3: 'attendance',
    tab4: 'learn',
    extras: [
      'finance',
      'performance-trends',
      'report-cards',
      'announcements',
      'settings',
      'profile',
      'notifications',
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  ShellRouteSpec(
    prefix: 'parent',
    role: UserRole.parent,
    tab2: 'academics',
    tab3: 'finance',
    tab4: 'learning',
    extras: [
      'attendance',
      'performance-alerts',
      'report-cards',
      'announcements',
      'contact-school',
      'children',
      'settings',
      'profile',
      'notifications',
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  ShellRouteSpec(
    prefix: 'teacher',
    role: UserRole.teacher,
    tab2: 'classes',
    tab3: 'courses',
    tab4: 'attendance',
    extras: [
      'marks',
      'performance-alerts',
      'peer-pairings',
      'students',
      'timetable',
      'syllabus-tracker',
      'announcements',
      'settings',
      'profile',
      'notifications',
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  ShellRouteSpec(
    prefix: 'hod',
    role: UserRole.hod,
    tab2: 'approvals',
    tab3: 'department',
    tab4: 'performance',
    extras: [
      'courses',
      'teachers',
      'subject-analytics',
      'interventions',
      'timetable',
      'announcements',
      'settings',
      'profile',
      'notifications',
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  // Admissions is a field-capable role: pipeline summary, applicant capture
  // and follow-up happen on the go; heavy workflows stay in the web app.
  ShellRouteSpec(
    prefix: 'admissions',
    role: UserRole.admissions,
    tab2: 'applicants',
    tab3: 'inquiry',
    tab4: 'notifications',
    extras: [
      'settings',
      'profile',
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  // ── Web-primary desk roles ──────────────────────────────────────────────
  // Principal, AQA, Finance and System Admin run their day in the web
  // dashboard. Mobile gives them a read-only pulse + notifications + profile.
  ShellRouteSpec(
    prefix: 'aqa',
    role: UserRole.academicQa,
    tab2: 'notifications',
    tab3: 'profile',
    tab4: 'settings',
    extras: [
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  ShellRouteSpec(
    prefix: 'principal',
    role: UserRole.principal,
    tab2: 'notifications',
    tab3: 'profile',
    tab4: 'settings',
    extras: [
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  ShellRouteSpec(
    prefix: 'finance',
    role: UserRole.finance,
    tab2: 'notifications',
    tab3: 'profile',
    tab4: 'settings',
    extras: [
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
  ShellRouteSpec(
    prefix: 'admin',
    role: UserRole.admin,
    tab2: 'notifications',
    tab3: 'profile',
    tab4: 'settings',
    extras: [
      'notification-preferences',
      'change-password',
      'edit-profile',
      'about',
      'search',
    ],
  ),
];
