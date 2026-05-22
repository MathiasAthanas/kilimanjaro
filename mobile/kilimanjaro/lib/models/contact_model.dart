enum ContactType {
  phone,
  whatsapp,
  email,
  maps,
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
}
