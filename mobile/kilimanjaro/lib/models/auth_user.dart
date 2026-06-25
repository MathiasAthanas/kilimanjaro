enum UserRole {
  student('STUDENT'),
  parent('PARENT'),
  teacher('TEACHER'),
  hod('HOD'),
  academicQa('ACADEMIC_QA'),
  principal('PRINCIPAL'),
  finance('FINANCE'),
  admin('SYSTEM_ADMIN');

  const UserRole(this.value);
  final String value;

  String get shellSegment => switch (this) {
        UserRole.student => 'student',
        UserRole.parent => 'parent',
        UserRole.teacher => 'teacher',
        UserRole.hod => 'hod',
        UserRole.academicQa => 'aqa',
        UserRole.principal => 'principal',
        UserRole.finance => 'finance',
        UserRole.admin => 'admin',
      };

  String get label => switch (this) {
        UserRole.student => 'Student',
        UserRole.parent => 'Parent',
        UserRole.teacher => 'Teacher',
        UserRole.hod => 'Head Of Department',
        UserRole.academicQa => 'Academic QA',
        UserRole.principal => 'Principal',
        UserRole.finance => 'Finance',
        UserRole.admin => 'System Admin',
      };

  static UserRole fromValue(String role) {
    return UserRole.values.firstWhere((item) => item.value == role);
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.role,
    this.email,
    this.registrationNumber,
    this.phone,
    this.profilePhotoUrl,
    this.joinedAt,
    this.lastLoginAt,
    this.bio,
  });

  final String id;
  final String name;
  final UserRole role;
  final String? email;
  final String? registrationNumber;
  final String? phone;
  final String? profilePhotoUrl;
  final DateTime? joinedAt;
  final DateTime? lastLoginAt;
  final String? bio;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    final joinedRaw = json['joinedAt'] as String? ?? json['createdAt'] as String?;
    final lastLoginRaw = json['lastLoginAt'] as String?;
    return AuthUser(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? json['fullName'] as String? ?? '',
      role: UserRole.fromValue(json['role'] as String? ?? 'STUDENT'),
      email: json['email'] as String?,
      registrationNumber: json['registrationNumber'] as String?,
      phone: json['phone'] as String?,
      profilePhotoUrl: json['profilePhotoUrl'] as String? ?? json['avatarUrl'] as String?,
      joinedAt: joinedRaw != null ? DateTime.parse(joinedRaw) : null,
      lastLoginAt: lastLoginRaw != null ? DateTime.parse(lastLoginRaw) : null,
      bio: json['bio'] as String?,
    );
  }
}
