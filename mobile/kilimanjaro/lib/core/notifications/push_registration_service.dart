import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../network/api_client.dart';

/// Registers, refreshes, and revokes this device's push token against the
/// authenticated user. Backed by the gateway's device-token endpoints; failures
/// are non-fatal (push registration must never block the app), but they are not
/// swallowed silently at higher layers — the coordinator decides how to react.
class PushRegistrationService {
  PushRegistrationService(FlutterSecureStorage storage)
      : _dio = buildApiClient(storage, pathPrefix: '/api/v1');

  final Dio _dio;

  String get _platform => Platform.isIOS ? 'IOS' : 'ANDROID';

  /// Registers/refreshes the token for the current user against the existing
  /// gateway endpoint (`POST /notifications/device-tokens`).
  Future<void> register(String token) async {
    await _dio.post<void>(
      '/notifications/device-tokens',
      data: {'token': token, 'platform': _platform},
    );
  }

  /// Revokes the token (called on logout) so the device stops receiving the
  /// previous user's notifications (`DELETE /notifications/device-tokens/:token`).
  Future<void> unregister(String token) async {
    await _dio.delete<void>('/notifications/device-tokens/$token');
  }
}
