import '../../models/notification_model.dart';

enum NotificationFeedFilter {
  all('All'),
  unread('Unread'),
  academic('Academic'),
  finance('Finance'),
  performance('Performance'),
  attendance('Attendance');

  const NotificationFeedFilter(this.label);
  final String label;

  bool matches(NotificationModel item) {
    return switch (this) {
      NotificationFeedFilter.all => true,
      NotificationFeedFilter.unread => !item.isRead,
      NotificationFeedFilter.academic => {
          NotificationEventType.resultsPublished,
          NotificationEventType.marksApproved,
          NotificationEventType.marksRejected,
        }.contains(item.eventType),
      NotificationFeedFilter.finance => {
          NotificationEventType.paymentConfirmed,
          NotificationEventType.feeOverdue,
        }.contains(item.eventType),
      NotificationFeedFilter.performance =>
        item.eventType == NotificationEventType.performanceAlertCreated,
      NotificationFeedFilter.attendance =>
        item.eventType == NotificationEventType.attendanceMarked,
    };
  }
}
