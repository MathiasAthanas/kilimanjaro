import 'notification_model.dart';

class NotificationPreferenceModel {
  const NotificationPreferenceModel({
    required this.key,
    required this.section,
    required this.label,
    required this.description,
    required this.eventType,
    required this.channels,
  });

  final String key;
  final String section;
  final String label;
  final String description;
  final NotificationEventType eventType;
  final Map<NotificationChannel, bool> channels;

  NotificationPreferenceModel copyWith({
    String? key,
    String? section,
    String? label,
    String? description,
    NotificationEventType? eventType,
    Map<NotificationChannel, bool>? channels,
  }) {
    return NotificationPreferenceModel(
      key: key ?? this.key,
      section: section ?? this.section,
      label: label ?? this.label,
      description: description ?? this.description,
      eventType: eventType ?? this.eventType,
      channels: channels ?? this.channels,
    );
  }
}
