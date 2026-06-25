import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/auth_result.dart';
import '../../../models/auth_user.dart';
import '../../config/app_config.dart';
import '../interfaces/auth_service_interface.dart';

class ApiAuthService implements IAuthService {
  ApiAuthService(this._storage) : _dio = _buildDio();

  final FlutterSecureStorage _storage;
  final Dio _dio;

  static Dio _buildDio() {
    return Dio(
      BaseOptions(
        baseUrl: '${AppConfig.apiBaseUrl}/api/v1',
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {'Content-Type': 'application/json'},
      ),
    );
  }

  Future<Options> _authOptions() async {
    final token = await _storage.read(key: 'access_token');
    return Options(
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
    );
  }

  @override
  Future<AuthResult> login({required String identifier, required String password}) async {
    final resp = await _dio.post<Map<String, dynamic>>(
      '/auth/login',
      data: {'identifier': identifier, 'password': password},
    );
    final result = AuthResult.fromJson(resp.data!);
    await _storage.write(key: 'access_token', value: result.token);
    await _storage.write(key: 'refresh_token', value: result.refreshToken);
    return result;
  }

  @override
  Future<void> logout() async {
    try {
      final opts = await _authOptions();
      await _dio.post<void>('/auth/logout', options: opts);
    } finally {
      await _storage.delete(key: 'access_token');
      await _storage.delete(key: 'refresh_token');
    }
  }

  @override
  Future<void> requestPasswordReset(String email) async {
    await _dio.post<void>(
      '/auth/password-reset/request',
      data: {'email': email},
    );
  }

  @override
  Future<void> verifyOtp({required String email, required String otp}) async {
    await _dio.post<void>(
      '/auth/password-reset/verify-otp',
      data: {'email': email, 'otp': otp},
    );
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String otp,
    required String newPassword,
  }) async {
    await _dio.post<void>(
      '/auth/password-reset/complete',
      data: {'email': email, 'otp': otp, 'newPassword': newPassword},
    );
  }

  @override
  Future<AuthUser?> getCurrentUser() async {
    final token = await _storage.read(key: 'access_token');
    if (token == null) return null;
    try {
      final opts = await _authOptions();
      final resp = await _dio.get<Map<String, dynamic>>('/auth/me', options: opts);
      return AuthUser.fromJson(resp.data!);
    } on DioException {
      return null;
    }
  }

  Future<bool> refreshToken() async {
    final refreshToken = await _storage.read(key: 'refresh_token');
    if (refreshToken == null) return false;
    try {
      final resp = await _dio.post<Map<String, dynamic>>(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final newToken = resp.data!['access_token'] as String? ?? resp.data!['accessToken'] as String?;
      if (newToken != null) {
        await _storage.write(key: 'access_token', value: newToken);
        return true;
      }
      return false;
    } on DioException {
      return false;
    }
  }
}
