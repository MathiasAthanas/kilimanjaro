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

  factory NotificationPreferenceModel.fromJson(Map<String, dynamic> json) {
    final rawChannels = json['channels'] as Map<String, dynamic>? ?? {};
    final channels = <NotificationChannel, bool>{};
    rawChannels.forEach((key, value) {
      switch (key.toUpperCase()) {
        case 'IN_APP':
        case 'INAPP':
          channels[NotificationChannel.inApp] = value as bool? ?? false;
          break;
        case 'SMS':
          channels[NotificationChannel.sms] = value as bool? ?? false;
          break;
        case 'EMAIL':
          channels[NotificationChannel.email] = value as bool? ?? false;
          break;
        case 'PUSH':
          channels[NotificationChannel.push] = value as bool? ?? false;
          break;
      }
    });

    return NotificationPreferenceModel(
      key: json['key'] as String? ?? '',
      section: json['section'] as String? ?? '',
      label: json['label'] as String? ?? '',
      description: json['description'] as String? ?? '',
      eventType: NotificationModel.parseEventType(json['eventType'] as String? ?? ''),
      channels: channels,
    );
  }

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
