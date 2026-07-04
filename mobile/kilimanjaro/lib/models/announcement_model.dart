enum AnnouncementPriority {
  urgent,
  high,
  normal,
  low,
}

class AnnouncementAttachment {
  const AnnouncementAttachment({
    required this.name,
    required this.sizeLabel,
  });

  final String name;
  final String sizeLabel;

  factory AnnouncementAttachment.fromJson(Map<String, dynamic> json) {
    return AnnouncementAttachment(
      name: json['name'] as String? ?? json['fileName'] as String? ?? '',
      sizeLabel: json['sizeLabel'] as String? ?? json['size'] as String? ?? '',
    );
  }
}

class AnnouncementModel {
  const AnnouncementModel({
    required this.id,
    required this.title,
    required this.body,
    required this.priority,
    required this.authorName,
    required this.authorRole,
    required this.publishedAt,
    this.attachment,
  });

  final String id;
  final String title;
  final String body;
  final AnnouncementPriority priority;
  final String authorName;
  final String authorRole;
  final DateTime publishedAt;
  final AnnouncementAttachment? attachment;

  factory AnnouncementModel.fromJson(Map<String, dynamic> json) {
    final rawAttachment = json['attachment'] as Map<String, dynamic>?;
    return AnnouncementModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? json['content'] as String? ?? '',
      priority: _parsePriority(json['priority'] as String? ?? 'NORMAL'),
      authorName: _parseAuthorName(json),
      authorRole: json['authorRole'] as String? ?? (json['author'] as Map<String, dynamic>?)?['role'] as String? ?? '',
      publishedAt: DateTime.parse(json['publishedAt'] as String? ?? json['createdAt'] as String? ?? DateTime.now().toIso8601String()),
      attachment: rawAttachment != null ? AnnouncementAttachment.fromJson(rawAttachment) : null,
    );
  }

  static String _parseAuthorName(Map<String, dynamic> json) {
    if (json['authorName'] is String && (json['authorName'] as String).isNotEmpty) {
      return json['authorName'] as String;
    }
    final author = json['author'] as Map<String, dynamic>?;
    if (author != null) {
      final first = author['firstName'] as String? ?? '';
      final last = author['lastName'] as String? ?? '';
      final combined = '$first $last'.trim();
      if (combined.isNotEmpty) return combined;
      if ((author['name'] as String? ?? '').isNotEmpty) return author['name'] as String;
    }
    return '';
  }

  static AnnouncementPriority _parsePriority(String raw) {
    switch (raw.toUpperCase()) {
      case 'URGENT':
        return AnnouncementPriority.urgent;
      case 'HIGH':
        return AnnouncementPriority.high;
      case 'LOW':
        return AnnouncementPriority.low;
      default:
        return AnnouncementPriority.normal;
    }
  }
}
