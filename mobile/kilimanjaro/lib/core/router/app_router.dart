import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/auth_user.dart';
import '../../screens/auth/forgot_password_screen.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/otp_verify_screen.dart';
import '../../screens/auth/reset_password_screen.dart';
import '../../screens/auth/splash_screen.dart';
import '../../screens/common/about_screen.dart';
import '../../screens/common/change_password_screen.dart';
import '../../screens/common/deep_link_landing_screen.dart';
import '../../screens/common/edit_profile_screen.dart';
import '../../screens/common/notification_detail_screen.dart';
import '../../screens/common/notification_preferences_screen.dart';
import '../../screens/common/notifications_screen.dart';
import '../../screens/parent/academic_overview_screen.dart';
import '../../screens/parent/announcement_detail_screen.dart';
import '../../screens/parent/announcements_list_screen.dart';
import '../../screens/parent/attendance_overview_screen.dart';
import '../../screens/parent/child_switcher_screen.dart';
import '../../screens/parent/contact_school_screen.dart';
import '../../screens/parent/finance_overview_screen.dart';
import '../../screens/parent/invoice_detail_screen.dart';
import '../../screens/parent/parent_home_screen.dart';
import '../../screens/parent/payment_history_screen.dart';
import '../../screens/parent/performance_alerts_screen.dart';
import '../../screens/parent/performance_trends_screen.dart' as parent_screens;
import '../../screens/parent/receipt_view_screen.dart';
import '../../screens/parent/report_card_view_screen.dart';
import '../../screens/parent/report_cards_list_screen.dart';
import '../../screens/parent/subject_results_detail_screen.dart';
import '../../screens/common/profile_screen.dart';
import '../../screens/common/search_screen.dart';
import '../../screens/common/settings_screen.dart';
import '../../screens/hod/elearning/hod_elearning_screens.dart'
    as hod_elearning;
import '../../screens/hod/hod_screens.dart' as hod_screens;
import '../../screens/parent/elearning/parent_elearning_screens.dart'
    as parent_elearning;
import '../../screens/student/announcement_detail_screen.dart';
import '../../screens/student/announcements_list_screen.dart';
import '../../screens/student/attendance_detail_screen.dart';
import '../../screens/student/attendance_overview_screen.dart';
import '../../screens/student/finance_overview_screen.dart';
import '../../screens/student/invoice_detail_screen.dart';
import '../../screens/student/performance_subject_screen.dart';
import '../../screens/student/performance_trends_screen.dart'
    as student_screens;
import '../../screens/student/receipt_detail_screen.dart';
import '../../screens/student/report_card_detail_screen.dart';
import '../../screens/student/report_cards_list_screen.dart';
import '../../screens/student/results_list_screen.dart';
import '../../screens/student/student_home_screen.dart';
import '../../screens/student/subject_performance_detail_screen.dart';
import '../../screens/student/term_results_detail_screen.dart';
import '../../screens/student/elearning/student_elearning_screens.dart'
    as student_elearning;
import '../../screens/teacher/elearning/teacher_elearning_screens.dart'
    as teacher_elearning;
import '../../screens/teacher/teacher_screens.dart' as teacher_screens;
import '../../screens/utility/force_update_screen.dart';
import '../../screens/utility/shell_demo_screen.dart';
import '../../widgets/shell/app_shell.dart';
import 'shell_route_specs.dart';
import 'transitions.dart';

class AppRouter {
  static void go(BuildContext context, String location) {
    GoRouter.of(context).go(location);
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  String titleForSegment(String value) => value
      .split('-')
      .map(
        (item) => item.isEmpty
            ? item
            : '${item[0].toUpperCase()}${item.substring(1)}',
      )
      .join(' ');

  GoRoute shellPageRoute(
    String path,
    UserRole role,
    String title, {
    String? subtitle,
  }) {
    if (role == UserRole.student) {
      if (path == '/shell/student/home') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const StudentHomeScreen(),
          ),
        );
      }
      if (path == '/shell/student/results') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const ResultsListScreen(),
          ),
          routes: [
            GoRoute(
              path: ':termId',
              pageBuilder: (context, state) => AppTransitions.utility(
                key: state.pageKey,
                child: TermResultsDetailScreen(
                  termId: state.pathParameters['termId'] ?? '',
                ),
              ),
            ),
          ],
        );
      }
      if (path == '/shell/student/attendance') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const AttendanceOverviewScreen(),
          ),
          routes: [
            GoRoute(
              path: 'detail',
              pageBuilder: (context, state) => AppTransitions.utility(
                key: state.pageKey,
                child: const AttendanceDetailScreen(),
              ),
            ),
          ],
        );
      }
      if (path == '/shell/student/finance') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const FinanceOverviewScreen(),
          ),
        );
      }
      if (path == '/shell/student/learn') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: student_elearning.StudentLearnHomeScreen(),
          ),
        );
      }
    }
    if (role == UserRole.parent) {
      if (path == '/shell/parent/home') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const ParentHomeScreen(),
          ),
        );
      }
      if (path == '/shell/parent/academics') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const AcademicOverviewScreen(),
          ),
        );
      }
      if (path == '/shell/parent/finance') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const ParentFinanceOverviewScreen(),
          ),
        );
      }
      if (path == '/shell/parent/attendance') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const ParentAttendanceOverviewScreen(),
          ),
        );
      }
      if (path == '/shell/parent/learning') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: parent_elearning.ParentLearningHomeScreen(),
          ),
        );
      }
    }
    if (role == UserRole.teacher) {
      if (path == '/shell/teacher/home') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const teacher_screens.TeacherHomeScreen(),
          ),
        );
      }
      if (path == '/shell/teacher/classes') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const teacher_screens.MyClassesScreen(),
          ),
        );
      }
      if (path == '/shell/teacher/marks') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const teacher_screens.AssessmentListScreen(),
          ),
        );
      }
      if (path == '/shell/teacher/courses') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => const NoTransitionPage(
            child: teacher_elearning.TeacherCoursesHomeScreen(),
          ),
        );
      }
      if (path == '/shell/teacher/attendance') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const teacher_screens.AttendanceMarkingScreen(),
          ),
        );
      }
    }
    if (role == UserRole.hod) {
      if (path == '/shell/hod/home') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const hod_screens.HodHomeScreen(),
          ),
        );
      }
      if (path == '/shell/hod/approvals') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const hod_screens.PendingApprovalsScreen(),
          ),
        );
      }
      if (path == '/shell/hod/department') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const hod_screens.DepartmentOverviewScreen(),
          ),
        );
      }
      if (path == '/shell/hod/performance') {
        return GoRoute(
          path: path,
          pageBuilder: (context, state) => NoTransitionPage(
            key: state.pageKey,
            child: const hod_screens.DepartmentAlertsScreen(),
          ),
        );
      }
    }

    return GoRoute(
      path: path,
      pageBuilder: (context, state) => NoTransitionPage(
        key: state.pageKey,
        child: ShellDemoScreen(role: role, title: title, subtitle: subtitle),
      ),
    );
  }

  StatefulShellBranch branch(List<GoRoute> routes) {
    return StatefulShellBranch(routes: routes);
  }

  GoRoute commonOrDemoRoute({
    required String prefix,
    required UserRole role,
    required String slug,
    required String Function(String) titleForSegment,
  }) {
    Page<dynamic> page(Widget child, GoRouterState state) =>
        AppTransitions.utility(key: state.pageKey, child: child);

    return GoRoute(
      path: '/shell/$prefix/$slug',
      pageBuilder: (context, state) {
        switch (slug) {
          case 'teachers':
            if (role == UserRole.hod) {
              return page(const hod_screens.HodTeacherListScreen(), state);
            }
            return page(
              ShellDemoScreen(
                role: role,
                title: titleForSegment(slug),
                subtitle: 'Teacher directory prepared for $prefix role flow.',
              ),
              state,
            );
          case 'subject-analytics':
            if (role == UserRole.hod) {
              return page(const hod_screens.DepartmentOverviewScreen(), state);
            }
            return page(
              ShellDemoScreen(
                role: role,
                title: titleForSegment(slug),
                subtitle: 'Subject analytics prepared for $prefix role flow.',
              ),
              state,
            );
          case 'interventions':
            if (role == UserRole.hod) {
              return page(const hod_screens.HodInterventionsScreen(), state);
            }
            return page(
              ShellDemoScreen(
                role: role,
                title: titleForSegment(slug),
                subtitle:
                    'Intervention workflow prepared for $prefix role flow.',
              ),
              state,
            );
          case 'courses':
            if (role == UserRole.hod) {
              return page(
                const hod_elearning.HodCoursesOverviewScreen(),
                state,
              );
            }
            if (role == UserRole.teacher) {
              return page(
                const teacher_elearning.TeacherCoursesHomeScreen(),
                state,
              );
            }
            return page(
              ShellDemoScreen(
                role: role,
                title: titleForSegment(slug),
                subtitle: 'Course spaces prepared for $prefix role flow.',
              ),
              state,
            );
          case 'performance-alerts':
            if (role == UserRole.teacher) {
              return page(
                const teacher_screens.TeacherPerformanceAlertsScreen(),
                state,
              );
            }
            return page(const PerformanceAlertsScreen(), state);
          case 'peer-pairings':
            return page(const teacher_screens.PeerPairingsScreen(), state);
          case 'students':
            return page(
              const teacher_screens.StudentPerformanceProfileScreen(
                studentId: 'stu-amina',
              ),
              state,
            );
          case 'timetable':
            if (role == UserRole.hod) {
              return page(const hod_screens.HodTimetableScreen(), state);
            }
            return page(const teacher_screens.TimetableScreen(), state);
          case 'syllabus-tracker':
            return page(const teacher_screens.SyllabusTrackerScreen(), state);
          case 'performance-trends':
            return page(
              role == UserRole.parent
                  ? const parent_screens.PerformanceTrendsScreen()
                  : const student_screens.PerformanceTrendsScreen(),
              state,
            );
          case 'report-cards':
            return page(
              role == UserRole.parent
                  ? const ParentReportCardsListScreen()
                  : const ReportCardsListScreen(),
              state,
            );
          case 'announcements':
            if (role == UserRole.hod) {
              return page(const hod_screens.HodAnnouncementsScreen(), state);
            }
            if (role == UserRole.teacher) {
              return page(
                const teacher_screens.TeacherAnnouncementsListScreen(),
                state,
              );
            }
            return page(
              role == UserRole.parent
                  ? const ParentAnnouncementsListScreen()
                  : const AnnouncementsListScreen(),
              state,
            );
          case 'contact-school':
            return page(const ContactSchoolScreen(), state);
          case 'children':
            return page(const ChildSwitcherScreen(), state);
          case 'profile':
            return page(const ProfileScreen(), state);
          case 'settings':
            return page(const SettingsScreen(), state);
          case 'about':
            return page(const AboutScreen(), state);
          case 'change-password':
            return page(const ChangePasswordScreen(), state);
          case 'edit-profile':
            return page(const EditProfileScreen(), state);
          case 'notifications':
            return page(const NotificationsScreen(), state);
          case 'notification-preferences':
            return page(const NotificationPreferencesScreen(), state);
          case 'search':
            return page(const SearchScreen(), state);
          default:
            return page(
              ShellDemoScreen(
                role: role,
                title: titleForSegment(slug),
                subtitle: 'Drawer destination prepared for $prefix role flow.',
              ),
              state,
            );
        }
      },
      routes: [
        if (slug == 'report-cards')
          GoRoute(
            path: ':termId',
            pageBuilder: (context, state) => AppTransitions.utility(
              key: state.pageKey,
              child: role == UserRole.parent
                  ? ParentReportCardViewScreen(
                      termId: state.pathParameters['termId'] ?? '',
                    )
                  : ReportCardDetailScreen(
                      termId: state.pathParameters['termId'] ?? '',
                    ),
            ),
          ),
        if (slug == 'announcements')
          GoRoute(
            path: ':id',
            pageBuilder: (context, state) => AppTransitions.utility(
              key: state.pageKey,
              child: role == UserRole.hod
                  ? const hod_screens.HodAnnouncementsScreen()
                  : role == UserRole.parent
                  ? ParentAnnouncementDetailScreen(
                      announcementId: state.pathParameters['id'] ?? '',
                    )
                  : AnnouncementDetailScreen(
                      announcementId: state.pathParameters['id'] ?? '',
                    ),
            ),
          ),
        if (slug == 'notifications')
          GoRoute(
            path: ':id',
            pageBuilder: (context, state) => AppTransitions.utility(
              key: state.pageKey,
              child: NotificationDetailScreen(
                id: state.pathParameters['id'] ?? '',
              ),
            ),
          ),
      ],
    );
  }

  List<GoRoute> drawerRoutes(String prefix, UserRole role, List<String> slugs) {
    return slugs
        .map(
          (slug) => commonOrDemoRoute(
            prefix: prefix,
            role: role,
            slug: slug,
            titleForSegment: titleForSegment,
          ),
        )
        .toList();
  }

  StatefulShellRoute shellRoute(
    String prefix,
    UserRole role,
    List<String> extras, {
    required String tab2,
    required String tab3,
    required String tab4,
  }) {
    return StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) =>
          AppShell(navigationShell: navigationShell, role: role),
      branches: [
        branch([
          shellPageRoute(
            '/shell/$prefix/home',
            role,
            'Home',
            subtitle: '${role.label} home dashboard surface',
          ),
          ...drawerRoutes(prefix, role, extras),
        ]),
        branch([
          shellPageRoute('/shell/$prefix/$tab2', role, titleForSegment(tab2)),
        ]),
        branch([
          shellPageRoute('/shell/$prefix/$tab3', role, titleForSegment(tab3)),
        ]),
        branch([
          shellPageRoute('/shell/$prefix/$tab4', role, titleForSegment(tab4)),
        ]),
      ],
    );
  }

  return GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(path: '/', redirect: (context, state) => '/splash'),
      GoRoute(
        path: '/splash',
        pageBuilder: (context, state) => AppTransitions.auth(
          key: state.pageKey,
          child: const SplashScreen(),
        ),
      ),
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) =>
            AppTransitions.auth(key: state.pageKey, child: const LoginScreen()),
      ),
      GoRoute(
        path: '/forgot-password',
        pageBuilder: (context, state) => AppTransitions.auth(
          key: state.pageKey,
          child: const ForgotPasswordScreen(),
        ),
      ),
      GoRoute(
        path: '/otp-verify',
        pageBuilder: (context, state) => AppTransitions.auth(
          key: state.pageKey,
          child: OtpVerifyScreen(
            email: state.uri.queryParameters['email'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/reset-password',
        pageBuilder: (context, state) => AppTransitions.auth(
          key: state.pageKey,
          child: ResetPasswordScreen(
            email: state.uri.queryParameters['email'] ?? '',
            otp: state.uri.queryParameters['otp'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/force-update',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ForceUpdateScreen(
            currentVersion: state.uri.queryParameters['current'] ?? '1.0.0',
            requiredVersion: state.uri.queryParameters['required'] ?? '1.0.0',
          ),
        ),
      ),
      GoRoute(
        path: '/search',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const SearchScreen(),
        ),
      ),
      GoRoute(
        path: '/deep-link',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: DeepLinkLandingScreen(
            title: state.uri.queryParameters['title'] ?? 'Notification',
            body:
                state.uri.queryParameters['body'] ??
                'Open this deep link to continue.',
          ),
        ),
      ),
      GoRoute(
        path: '/student/results/subject/:subjectId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: SubjectPerformanceDetailScreen(
            subjectId: state.pathParameters['subjectId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/performance/:subjectId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: PerformanceSubjectScreen(
            subjectId: state.pathParameters['subjectId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/finance/invoice/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: InvoiceDetailScreen(
            invoiceId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/finance/receipt/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ReceiptDetailScreen(
            receiptId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/report-cards/:termId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ReportCardDetailScreen(
            termId: state.pathParameters['termId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/announcements/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: AnnouncementDetailScreen(
            announcementId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/courses/:courseId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentCourseSpaceScreen(
            courseId: state.pathParameters['courseId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/courses/:courseId/lesson/:lessonId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentLessonScreen(
            courseId: state.pathParameters['courseId'] ?? '',
            lessonId: state.pathParameters['lessonId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/materials/:materialId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentMaterialViewerScreen(
            materialId: state.pathParameters['materialId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/assignments/:assignmentId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentAssignmentScreen(
            assignmentId: state.pathParameters['assignmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/assignments/:assignmentId/submit',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentSubmitAssignmentScreen(
            assignmentId: state.pathParameters['assignmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/quizzes/:quizId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentQuizLobbyScreen(
            quizId: state.pathParameters['quizId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/quizzes/:quizId/attempt',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentQuizAttemptScreen(
            quizId: state.pathParameters['quizId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/quizzes/:quizId/result/:attemptId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentQuizResultScreen(
            quizId: state.pathParameters['quizId'] ?? '',
            attemptId: state.pathParameters['attemptId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/progress/:courseId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentCourseProgressScreen(
            courseId: state.pathParameters['courseId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/student/learn/discussions/:threadId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: student_elearning.StudentDiscussionThreadScreen(
            threadId: state.pathParameters['threadId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/children',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const ChildSwitcherScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/performance',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const PerformanceAlertsScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/performance/trends',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const parent_screens.PerformanceTrendsScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/academics/subject/:subjectId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: SubjectResultsDetailScreen(
            subjectId: state.pathParameters['subjectId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/report-cards/:termId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ParentReportCardViewScreen(
            termId: state.pathParameters['termId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/report-cards',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const ParentReportCardsListScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/finance/invoice/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ParentInvoiceDetailScreen(
            invoiceId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/finance/payments',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const PaymentHistoryScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/finance/receipt/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ParentReceiptViewScreen(
            receiptId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/announcements/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: ParentAnnouncementDetailScreen(
            announcementId: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/announcements',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const ParentAnnouncementsListScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/contact',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const ContactSchoolScreen(),
        ),
      ),
      GoRoute(
        path: '/parent/learning/courses/:courseId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: parent_elearning.ParentCourseViewScreen(
            courseId: state.pathParameters['courseId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/learning/assignments/:assignmentId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: parent_elearning.ParentAssignmentViewScreen(
            assignmentId: state.pathParameters['assignmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/parent/learning/quizzes/:quizId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: parent_elearning.ParentQuizScoreScreen(
            quizId: state.pathParameters['quizId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/classes/:classSubjectId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.ClassDetailScreen(
            classSubjectId: state.pathParameters['classSubjectId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/classes/:classSubjectId/students',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.ClassStudentListScreen(
            classSubjectId: state.pathParameters['classSubjectId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/marks/:assessmentId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.MarksEntrySheetScreen(
            assessmentId: state.pathParameters['assessmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/marks/:assessmentId/submit',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.AssessmentSubmitConfirmScreen(
            assessmentId: state.pathParameters['assessmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/marks/:assessmentId/review',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.MarksReviewScreen(
            assessmentId: state.pathParameters['assessmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/attendance/history',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.AttendanceHistoryScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/performance/alerts',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.TeacherPerformanceAlertsScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/performance/alerts/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.AlertDetailScreen(
            id: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/performance/pairings',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.PeerPairingsScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/performance/pairings/:id',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.PairingDetailScreen(
            id: state.pathParameters['id'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/timetable',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.TimetableScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/syllabus',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.SyllabusTrackerScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/announcements',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.TeacherAnnouncementsListScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/students/:studentId/performance',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.StudentPerformanceProfileScreen(
            studentId: state.pathParameters['studentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/announcements/create',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_screens.CreateAnnouncementScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/interventions/create',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_screens.CreateInterventionScreen(
            studentId: state.uri.queryParameters['studentId'],
            classSubjectId: state.uri.queryParameters['classId'],
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_elearning.TeacherCourseDetailScreen(
            courseId: state.pathParameters['courseId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/lesson/:lessonId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_elearning.TeacherLessonDetailScreen(
            courseId: state.pathParameters['courseId'] ?? '',
            lessonId: state.pathParameters['lessonId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/lesson/:lessonId/material/new',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_elearning.TeacherAddMaterialScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/assignments',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_elearning.TeacherAssignmentsScreen(
            courseId: state.pathParameters['courseId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/assignments/:assignmentId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_elearning.TeacherAssignmentDetailScreen(
            courseId: state.pathParameters['courseId'] ?? '',
            assignmentId: state.pathParameters['assignmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path:
            '/teacher/courses/:courseId/assignments/:assignmentId/grade/:submissionId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_elearning.TeacherGradeSubmissionScreen(
            submissionId: state.pathParameters['submissionId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/quizzes/:quizId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: teacher_elearning.TeacherQuizDetailScreen(
            courseId: state.pathParameters['courseId'] ?? '',
            quizId: state.pathParameters['quizId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/quizzes/:quizId/builder',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_elearning.TeacherQuizBuilderScreen(),
        ),
      ),
      GoRoute(
        path: '/teacher/courses/:courseId/engagement',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const teacher_elearning.TeacherCourseEngagementScreen(),
        ),
      ),
      GoRoute(
        path: '/hod/approvals/history',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const hod_screens.ApprovalHistoryScreen(),
        ),
      ),
      GoRoute(
        path: '/hod/approvals/:assessmentId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: hod_screens.MarksReviewApprovalScreen(
            assessmentId: state.pathParameters['assessmentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/hod/department/subject/:subjectId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: hod_screens.SubjectDetailAnalyticsScreen(
            subjectId: state.pathParameters['subjectId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/hod/teachers',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const hod_screens.HodTeacherListScreen(),
        ),
      ),
      GoRoute(
        path: '/hod/teachers/:teacherId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: hod_screens.HodTeacherDetailScreen(
            teacherId: state.pathParameters['teacherId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/hod/performance/pairings',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const hod_screens.DepartmentPairingsScreen(),
        ),
      ),
      GoRoute(
        path: '/hod/students/:studentId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: hod_screens.HodStudentPerformanceScreen(
            studentId: state.pathParameters['studentId'] ?? '',
          ),
        ),
      ),
      GoRoute(
        path: '/hod/interventions',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const hod_screens.HodInterventionsScreen(),
        ),
      ),
      GoRoute(
        path: '/hod/announcements',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: const hod_screens.HodAnnouncementsScreen(),
        ),
      ),
      GoRoute(
        path: '/hod/courses/:courseId',
        pageBuilder: (context, state) => AppTransitions.utility(
          key: state.pageKey,
          child: hod_elearning.HodCourseDetailScreen(
            courseId: state.pathParameters['courseId'] ?? '',
          ),
        ),
      ),
      ...shellRouteSpecs.map(
        (spec) => shellRoute(
          spec.prefix,
          spec.role,
          spec.extras,
          tab2: spec.tab2,
          tab3: spec.tab3,
          tab4: spec.tab4,
        ),
      ),
    ],
    errorPageBuilder: (context, state) => AppTransitions.utility(
      key: state.pageKey,
      child: const ShellDemoScreen(
        role: UserRole.student,
        title: 'Route Not Found',
        subtitle: 'The requested destination could not be resolved.',
      ),
    ),
  );
});
