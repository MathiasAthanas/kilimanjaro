import 'dart:async';
import 'dart:math';

import '../../../models/auth_user.dart';
import '../../../models/notification_model.dart';
import '../../../models/notification_preference_model.dart';
import '../../../models/search_result_model.dart';
import 'mock_notification_catalog.dart';
import '../interfaces/notification_service_interface.dart';

class MockNotificationService implements INotificationService {
  final _random = Random(42);
  final _streams = <String, StreamController<List<NotificationModel>>>{};
  final _notifications = <String, List<NotificationModel>>{};
  final _preferences = <String, List<NotificationPreferenceModel>>{};

  @override
  Future<List<NotificationModel>> getNotifications(AuthUser user) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    return List.unmodifiable(_seedNotifications(user));
  }

  @override
  Stream<List<NotificationModel>> watchNotifications(AuthUser user) {
    final controller = _streams.putIfAbsent(
      user.id,
      () => StreamController<List<NotificationModel>>.broadcast(
        onListen: () {
          _streams[user.id]?.add(List.unmodifiable(_seedNotifications(user)));
        },
      ),
    );
    return controller.stream;
  }

  @override
  Future<NotificationModel?> getNotificationById(AuthUser user, String id) async {
    final items = _seedNotifications(user);
    for (final item in items) {
      if (item.id == id) return item;
    }
    return null;
  }

  @override
  Future<void> markRead(AuthUser user, String id, {bool read = true}) async {
    final items = _seedNotifications(user);
    final index = items.indexWhere((item) => item.id == id);
    if (index == -1) return;
    items[index] = items[index].copyWith(isRead: read);
    _push(user);
  }

  @override
  Future<void> markAllRead(AuthUser user) async {
    final items = _seedNotifications(user);
    for (var i = 0; i < items.length; i++) {
      items[i] = items[i].copyWith(isRead: true);
    }
    _push(user);
  }

  @override
  Future<void> deleteNotification(AuthUser user, String id) async {
    _seedNotifications(user).removeWhere((item) => item.id == id);
    _push(user);
  }

  @override
  Future<List<NotificationPreferenceModel>> getPreferences(AuthUser user) async {
    await Future<void>.delayed(const Duration(milliseconds: 240));
    return List.unmodifiable(_preferences.putIfAbsent(user.id, _defaultPreferences));
  }

  @override
  Future<void> updatePreference(
    AuthUser user,
    String key,
    NotificationPreferenceModel value,
  ) async {
    final prefs = _preferences.putIfAbsent(user.id, _defaultPreferences);
    final index = prefs.indexWhere((item) => item.key == key);
    if (index != -1) prefs[index] = value;
  }

  @override
  Future<List<SearchResultModel>> search(AuthUser user, String query) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final normalized = query.trim().toLowerCase();
    if (normalized.isEmpty) return const [];

    final results = <SearchResultModel>[];
    if (user.role != UserRole.student && user.role != UserRole.parent) {
      results.addAll(
        mockStudents.where(
          (item) =>
              item.title.toLowerCase().contains(normalized) ||
              item.subtitle.toLowerCase().contains(normalized) ||
              (item.metaLabel?.toLowerCase().contains(normalized) ?? false),
        ),
      );
    }
    results.addAll(
      mockAnnouncements.where(
        (item) =>
            item.title.toLowerCase().contains(normalized) ||
            item.subtitle.toLowerCase().contains(normalized),
      ),
    );
    return results.take(8).toList();
  }

  @override
  List<SearchResultModel> quickAccess(AuthUser user) {
    return switch (user.role) {
      UserRole.student => const [
          SearchResultModel(
            id: 'quick_results',
            type: SearchResultType.shortcut,
            title: 'My Results',
            subtitle: 'Jump to latest published results',
            route: '/shell/student/results',
          ),
          SearchResultModel(
            id: 'quick_attendance',
            type: SearchResultType.shortcut,
            title: 'My Attendance',
            subtitle: 'View attendance trends',
            route: '/shell/student/attendance',
          ),
        ],
      UserRole.parent => const [
          SearchResultModel(
            id: 'quick_child',
            type: SearchResultType.shortcut,
            title: 'Amina Baraka Juma',
            subtitle: 'Child profile overview',
            route: '/shell/parent/children',
          ),
          SearchResultModel(
            id: 'quick_invoices',
            type: SearchResultType.shortcut,
            title: 'My Invoices',
            subtitle: 'Open finance summary',
            route: '/shell/parent/finance',
          ),
        ],
      _ => const [
          SearchResultModel(
            id: 'quick_students',
            type: SearchResultType.shortcut,
            title: 'All Students',
            subtitle: 'Browse student records',
            route: '/shell/admin/students',
          ),
          SearchResultModel(
            id: 'quick_alerts',
            type: SearchResultType.shortcut,
            title: 'Active Alerts',
            subtitle: 'Performance and finance alerts',
            route: '/shell/aqa/performance',
          ),
          SearchResultModel(
            id: 'quick_classes',
            type: SearchResultType.shortcut,
            title: 'Today\'s Classes',
            subtitle: 'Current teaching schedule',
            route: '/shell/teacher/timetable',
          ),
        ],
    };
  }

  List<NotificationModel> _seedNotifications(AuthUser user) {
    return _notifications.putIfAbsent(user.id, () {
      final now = DateTime.now();
      final events = NotificationEventType.values;
      final channels = NotificationChannel.values;
      return List.generate(20, (index) {
        final event = events[index % events.length];
        final channel = channels[index % channels.length];
        final daysAgo = index < 4 ? 0 : index < 8 ? 1 : _random.nextInt(12) + 2;
        final createdAt = now.subtract(
          Duration(days: daysAgo, hours: _random.nextInt(20), minutes: _random.nextInt(59)),
        );
        return NotificationModel(
          id: '${user.id}_notification_$index',
          title: _titleFor(event),
          body: _bodyFor(user, event, index),
          channel: channel,
          eventType: event,
          isRead: index % 3 == 0,
          createdAt: createdAt,
          sourceService: _serviceFor(event),
          targetRoute: _routeFor(user, event),
          actionLabel: _actionLabelFor(event),
        );
      })..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    });
  }

  void _push(AuthUser user) {
    _streams[user.id]?.add(List.unmodifiable(_seedNotifications(user)));
  }

  List<NotificationPreferenceModel> _defaultPreferences() {
    return defaultNotificationPreferences();
  }

  String _titleFor(NotificationEventType type) => switch (type) {
        NotificationEventType.paymentConfirmed => 'Payment Confirmed',
        NotificationEventType.resultsPublished => 'Results Published',
        NotificationEventType.attendanceMarked => 'Attendance Updated',
        NotificationEventType.performanceAlertCreated => 'Performance Alert',
        NotificationEventType.marksRejected => 'Marks Need Review',
        NotificationEventType.feeOverdue => 'Fee Overdue Notice',
        NotificationEventType.disciplineRecorded => 'Discipline Record Logged',
        NotificationEventType.studentEnrolled => 'Student Enrolled',
        NotificationEventType.announcement => 'School Announcement',
        NotificationEventType.marksApproved => 'Marks Approved',
      };

  String _bodyFor(AuthUser user, NotificationEventType type, int index) => switch (type) {
        NotificationEventType.paymentConfirmed =>
          'A TZS 350,000 payment for ${user.name} has been approved and a receipt is ready.',
        NotificationEventType.resultsPublished =>
          'Form 3 terminal results are now available. Tap to view subject performance and rankings.',
        NotificationEventType.attendanceMarked =>
          'Attendance for today has been recorded. There is a late arrival noted in the morning register.',
        NotificationEventType.performanceAlertCreated =>
          'The performance engine flagged Mathematics as high risk for ${user.name}. Review suggested intervention steps.',
        NotificationEventType.marksRejected =>
          'Marks submitted for Form 2 Physics require correction before publication.',
        NotificationEventType.feeOverdue =>
          'Fee balance remains overdue by ${index + 2} days. Please review the outstanding invoice breakdown.',
        NotificationEventType.disciplineRecorded =>
          'A new discipline record was added with follow-up notes from the school office.',
        NotificationEventType.studentEnrolled =>
          'A new learner from Moshi campus was added to the current academic year roster.',
        NotificationEventType.announcement =>
          'Assembly starts at 7:15 AM tomorrow. All stakeholders should note the updated timetable for Kilimanjaro campus.',
        NotificationEventType.marksApproved =>
          'Assessment marks have been approved and are now part of the official academic record.',
      };

  String _serviceFor(NotificationEventType type) => switch (type) {
        NotificationEventType.paymentConfirmed || NotificationEventType.feeOverdue => 'Finance Service',
        NotificationEventType.resultsPublished || NotificationEventType.marksRejected || NotificationEventType.marksApproved => 'Academic Service',
        NotificationEventType.performanceAlertCreated => 'Analytics Service',
        NotificationEventType.attendanceMarked || NotificationEventType.studentEnrolled => 'Student Service',
        _ => 'Notification Service',
      };

  String? _routeFor(AuthUser user, NotificationEventType type) => switch (type) {
        NotificationEventType.paymentConfirmed || NotificationEventType.feeOverdue => '/shell/${user.role.shellSegment}/finance',
        NotificationEventType.resultsPublished || NotificationEventType.marksApproved => '/shell/${user.role.shellSegment}/${user.role == UserRole.student ? 'results' : 'home'}',
        NotificationEventType.attendanceMarked => '/shell/${user.role.shellSegment}/attendance',
        NotificationEventType.performanceAlertCreated => '/shell/${user.role.shellSegment}/home',
        _ => '/shell/${user.role.shellSegment}/home',
      };

  String? _actionLabelFor(NotificationEventType type) => switch (type) {
        NotificationEventType.paymentConfirmed => 'Open Finance',
        NotificationEventType.resultsPublished => 'View Results',
        NotificationEventType.attendanceMarked => 'Open Attendance',
        NotificationEventType.performanceAlertCreated => 'View Alert',
        NotificationEventType.feeOverdue => 'Review Invoice',
        _ => null,
      };
}
