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

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? json['message'] as String? ?? '',
      channel: _parseChannel(json['channel'] as String? ?? 'IN_APP'),
      eventType: parseEventType(json['eventType'] as String? ?? ''),
      isRead: json['isRead'] as bool? ?? json['read'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      sourceService: json['sourceService'] as String? ?? '',
      targetRoute: json['targetRoute'] as String?,
      actionLabel: json['actionLabel'] as String?,
    );
  }

  static NotificationChannel _parseChannel(String raw) {
    switch (raw.toUpperCase()) {
      case 'SMS':
        return NotificationChannel.sms;
      case 'EMAIL':
        return NotificationChannel.email;
      case 'PUSH':
        return NotificationChannel.push;
      default:
        return NotificationChannel.inApp;
    }
  }

  static NotificationEventType parseEventType(String raw) {
    switch (raw.toUpperCase()) {
      case 'PAYMENT_CONFIRMED':
        return NotificationEventType.paymentConfirmed;
      case 'RESULTS_PUBLISHED':
        return NotificationEventType.resultsPublished;
      case 'ATTENDANCE_MARKED':
        return NotificationEventType.attendanceMarked;
      case 'PERFORMANCE_ALERT_CREATED':
        return NotificationEventType.performanceAlertCreated;
      case 'MARKS_REJECTED':
        return NotificationEventType.marksRejected;
      case 'FEE_OVERDUE':
        return NotificationEventType.feeOverdue;
      case 'DISCIPLINE_RECORDED':
        return NotificationEventType.disciplineRecorded;
      case 'STUDENT_ENROLLED':
        return NotificationEventType.studentEnrolled;
      case 'ANNOUNCEMENT':
        return NotificationEventType.announcement;
      case 'MARKS_APPROVED':
        return NotificationEventType.marksApproved;
      default:
        return NotificationEventType.announcement;
    }
  }

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
