import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/auth_result.dart';
import '../../../models/auth_user.dart';
import '../interfaces/auth_service_interface.dart';

class MockAuthService implements IAuthService {
  MockAuthService(this._storage);

  final FlutterSecureStorage _storage;

  static const _roleKey = 'auth_role';
  static const _tokenKey = 'auth_token';
  static const _refreshKey = 'refresh_token';

  static final _users = <Map<String, dynamic>>[
    {
      'identifier': 'amina.juma@student.ks',
      'password': 'demo1234',
      'role': 'STUDENT',
      'name': 'Amina Juma',
      'registrationNumber': 'KS-2024-00142',
      'bio': 'Form 3A Student • Focused on sciences and debate club',
    },
    {
      'identifier': 'KS-2024-00142',
      'password': 'demo1234',
      'role': 'STUDENT',
      'name': 'Amina Juma',
      'registrationNumber': 'KS-2024-00142',
      'bio': 'Form 3A Student • Focused on sciences and debate club',
    },
    {
      'identifier': 'baraka.hassan@parent.ks',
      'password': 'demo1234',
      'role': 'PARENT',
      'name': 'Baraka Hassan',
      'bio': 'Parent of Amina and Neema • Follows academics and fee progress',
    },
    {
      'identifier': 'rose.mhina@ks.ac.tz',
      'password': 'demo1234',
      'role': 'TEACHER',
      'name': 'Mwalimu Rose Mhina',
      'bio': 'Mathematics Teacher • Form 2 and 3',
    },
    {
      'identifier': 'james.kileo@ks.ac.tz',
      'password': 'demo1234',
      'role': 'HOD',
      'name': 'Dr. James Kileo',
      'bio': 'Sciences HOD • Academic quality and departmental oversight',
    },
    {
      'identifier': 'fatuma.ally@ks.ac.tz',
      'password': 'demo1234',
      'role': 'ACADEMIC_QA',
      'name': 'Ms. Fatuma Ally',
      'bio': 'Academic QA Officer • Monitoring interventions and alerts',
    },
    {
      'identifier': 'david.mwasimba@ks.ac.tz',
      'password': 'demo1234',
      'role': 'PRINCIPAL',
      'name': 'Mr. David Mwasimba',
      'bio': 'School Principal • Strategic oversight and approvals',
    },
    {
      'identifier': 'grace.temba@ks.ac.tz',
      'password': 'demo1234',
      'role': 'FINANCE',
      'name': 'Ms. Grace Temba',
      'bio': 'Finance Officer • Invoices, collections, and reconciliations',
    },
    {
      'identifier': 'admin@ks.ac.tz',
      'password': 'demo1234',
      'role': 'SYSTEM_ADMIN',
      'name': 'System Admin',
      'bio': 'System Administrator • Full platform control',
    },
  ];

  @override
  Future<AuthUser?> getCurrentUser() async {
    final roleValue = await _storage.read(key: _roleKey);
    if (roleValue == null) return null;
    final match = _users.where((item) => item['role'] == roleValue);
    if (match.isEmpty) return null;
    return _toUser(match.first);
  }

  @override
  Future<AuthResult> login({
    required String identifier,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 800));

    final match = _users.where(
      (item) =>
          item['identifier'] == identifier.trim() && item['password'] == password,
    );

    if (match.isEmpty) {
      throw Exception('Invalid identifier or password');
    }

    final user = _toUser(match.first);
    final result = AuthResult(
      token: 'mock-access-${user.role.value.toLowerCase()}',
      refreshToken: 'mock-refresh-${user.role.value.toLowerCase()}',
      user: user,
    );

    await _storage.write(key: _roleKey, value: user.role.value);
    await _storage.write(key: _tokenKey, value: result.token);
    await _storage.write(key: _refreshKey, value: result.refreshToken);
    return result;
  }

  @override
  Future<void> logout() async {
    await _storage.deleteAll();
  }

  @override
  Future<void> requestPasswordReset(String email) async {
    await Future<void>.delayed(const Duration(milliseconds: 1200));
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 1000));
  }

  @override
  Future<void> verifyOtp({
    required String email,
    required String otp,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (otp != '123456') {
      throw Exception('Invalid verification code');
    }
  }

  AuthUser _toUser(Map<String, dynamic> entry) {
    return AuthUser(
      id: 'mock-${(entry['role'] as String).toLowerCase()}',
      name: entry['name'] as String,
      role: UserRole.fromValue(entry['role'] as String),
      email: (entry['identifier'] as String).contains('@')
          ? entry['identifier'] as String
          : null,
      registrationNumber: entry['registrationNumber'] as String?,
      phone: '+255 700 000 000',
      profilePhotoUrl: null,
      joinedAt: DateTime(2025, 1, 12),
      lastLoginAt: DateTime.now().subtract(const Duration(hours: 2, minutes: 18)),
      bio: entry['bio'] as String?,
    );
  }
}
