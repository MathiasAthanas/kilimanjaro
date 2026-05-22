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
}
