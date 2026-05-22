enum NotificationChannel { inApp, sms, email, push }

enum NotificationEventType {
  paymentConfirmed,
  resultsPublished,
  attendanceMarked,
  performanceAlertCreated,
  marksRejected,
  feeOverdue,
  disciplineRecorded,
  studentEnrolled,
  announcement,
  marksApproved,
}

class NotificationModel {
  const NotificationModel({
    required this.id,
    required this.title,
    required this.body,
    required this.channel,
    required this.eventType,
    required this.isRead,
    required this.createdAt,
    required this.sourceService,
    this.targetRoute,
    this.actionLabel,
  });

  final String id;
  final String title;
  final String body;
  final NotificationChannel channel;
  final NotificationEventType eventType;
  final bool isRead;
  final DateTime createdAt;
  final String sourceService;
  final String? targetRoute;
  final String? actionLabel;

  NotificationModel copyWith({
    String? id,
    String? title,
    String? body,
    NotificationChannel? channel,
    NotificationEventType? eventType,
    bool? isRead,
    DateTime? createdAt,
    String? sourceService,
    String? targetRoute,
    String? actionLabel,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      title: title ?? this.title,
      body: body ?? this.body,
      channel: channel ?? this.channel,
      eventType: eventType ?? this.eventType,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      sourceService: sourceService ?? this.sourceService,
      targetRoute: targetRoute ?? this.targetRoute,
      actionLabel: actionLabel ?? this.actionLabel,
    );
  }
}

class NotificationGroup {
  const NotificationGroup({
    required this.label,
    required this.items,
  });

  final String label;
  final List<NotificationModel> items;
}
