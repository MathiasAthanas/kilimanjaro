enum ContactType {
  phone,
  whatsapp,
  email,
  maps,
}

ContactType _contactTypeFromString(String? raw) {
  switch (raw?.toUpperCase()) {
    case 'WHATSAPP':
      return ContactType.whatsapp;
    case 'EMAIL':
      return ContactType.email;
    case 'MAPS':
    case 'MAP':
      return ContactType.maps;
    default:
      return ContactType.phone;
  }
}

class ContactActionModel {
  const ContactActionModel({
    required this.type,
    required this.label,
    required this.value,
    this.subtitle,
  });

  final ContactType type;
  final String label;
  final String value;
  final String? subtitle;
}

class TeacherContactModel {
  const TeacherContactModel({
    required this.name,
    required this.role,
    required this.subjects,
    required this.contactValue,
    required this.contactVisible,
  });

  final String name;
  final String role;
  final String subjects;
  final String contactValue;
  final bool contactVisible;
}

class FaqItemModel {
  const FaqItemModel({
    required this.question,
    required this.answer,
  });

  final String question;
  final String answer;
}

class ContactSchoolModel {
  const ContactSchoolModel({
    required this.schoolName,
    required this.address,
    required this.openHours,
    required this.actions,
    required this.teachers,
    required this.faqItems,
    required this.emergencyPhone,
  });

  final String schoolName;
  final String address;
  final String openHours;
  final List<ContactActionModel> actions;
  final List<TeacherContactModel> teachers;
  final List<FaqItemModel> faqItems;
  final String emergencyPhone;

  /// Builds a model from a token-scoped school-contact payload. Tolerant of
  /// missing fields so a partially-populated backend response still renders.
  factory ContactSchoolModel.fromJson(Map<String, dynamic> json) {
    final actions = (json['actions'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map((a) => ContactActionModel(
              type: _contactTypeFromString(a['type'] as String?),
              label: a['label'] as String? ?? '',
              value: a['value'] as String? ?? '',
              subtitle: a['subtitle'] as String?,
            ))
        .toList();
    final teachers = (json['teachers'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map((t) => TeacherContactModel(
              name: t['name'] as String? ?? '',
              role: t['role'] as String? ?? '',
              subjects: t['subjects'] as String? ?? '',
              contactValue: t['contactValue'] as String? ?? '',
              contactVisible: t['contactVisible'] as bool? ?? false,
            ))
        .toList();
    final faqItems = (json['faqItems'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map((f) => FaqItemModel(
              question: f['question'] as String? ?? '',
              answer: f['answer'] as String? ?? '',
            ))
        .toList();
    return ContactSchoolModel(
      schoolName: json['schoolName'] as String? ?? json['name'] as String? ?? '',
      address: json['address'] as String? ?? '',
      openHours: json['openHours'] as String? ?? json['officeHours'] as String? ?? '',
      emergencyPhone: json['emergencyPhone'] as String? ?? json['phone'] as String? ?? '',
      actions: actions,
      teachers: teachers,
      faqItems: faqItems,
    );
  }
}
