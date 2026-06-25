import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/auth_user.dart';
import '../../../models/notification_model.dart';
import '../../../models/notification_preference_model.dart';
import '../../../models/search_result_model.dart';
import '../../config/app_config.dart';
import '../interfaces/notification_service_interface.dart';

class ApiNotificationService implements INotificationService {
  ApiNotificationService(this._storage) : _dio = _buildDio();

  final FlutterSecureStorage _storage;
  final Dio _dio;

  // Local cache for stream simulation (poll-based)
  final _streamController = StreamController<List<NotificationModel>>.broadcast();
  Timer? _pollTimer;

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

  Future<Options> _auth() async {
    final token = await _storage.read(key: 'access_token');
    return Options(
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
    );
  }

  Future<List<dynamic>> _getList(String path) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>(path, options: opts);
      if (resp.data is List) return resp.data as List<dynamic>;
      if (resp.data is Map) {
        final m = resp.data as Map<String, dynamic>;
        for (final key in ['data', 'items', 'notifications']) {
          if (m[key] is List) return m[key] as List<dynamic>;
        }
      }
    } on DioException {
      return [];
    }
    return [];
  }

  // ─── Notifications ────────────────────────────────────────────────────────

  @override
  Future<List<NotificationModel>> getNotifications(AuthUser user) async {
    final list = await _getList('/notifications');
    return list.cast<Map<String, dynamic>>().map(NotificationModel.fromJson).toList();
  }

  @override
  Stream<List<NotificationModel>> watchNotifications(AuthUser user) {
    // Poll every 30 seconds and emit to stream
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      final notifications = await getNotifications(user);
      _streamController.add(notifications);
    });

    // Emit immediately
    getNotifications(user).then(_streamController.add).catchError((_) {});

    return _streamController.stream;
  }

  @override
  Future<NotificationModel?> getNotificationById(AuthUser user, String id) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<Map<String, dynamic>>('/notifications/$id', options: opts);
      return NotificationModel.fromJson(resp.data!);
    } on DioException {
      return null;
    }
  }

  @override
  Future<void> markRead(AuthUser user, String id, {bool read = true}) async {
    final opts = await _auth();
    if (read) {
      await _dio.patch<void>('/notifications/$id/read', options: opts);
    }
  }

  @override
  Future<void> markAllRead(AuthUser user) async {
    final opts = await _auth();
    await _dio.patch<void>('/notifications/read-all', options: opts);
  }

  @override
  Future<void> deleteNotification(AuthUser user, String id) async {
    final opts = await _auth();
    await _dio.delete<void>('/notifications/$id', options: opts);
  }

  // ─── Preferences ─────────────────────────────────────────────────────────

  @override
  Future<List<NotificationPreferenceModel>> getPreferences(AuthUser user) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>('/notifications/preferences', options: opts);
      final list = resp.data is List
          ? resp.data as List<dynamic>
          : (resp.data as Map<String, dynamic>?)?['preferences'] as List<dynamic>? ?? [];
      return list.cast<Map<String, dynamic>>().map(NotificationPreferenceModel.fromJson).toList();
    } on DioException {
      return [];
    }
  }

  @override
  Future<void> updatePreference(AuthUser user, String key, NotificationPreferenceModel value) async {
    final opts = await _auth();
    final channels = <String, bool>{};
    value.channels.forEach((channel, enabled) {
      final channelKey = switch (channel) {
        NotificationChannel.inApp => 'IN_APP',
        NotificationChannel.sms => 'SMS',
        NotificationChannel.email => 'EMAIL',
        NotificationChannel.push => 'PUSH',
      };
      channels[channelKey] = enabled;
    });

    await _dio.put<void>(
      '/notifications/preferences',
      data: {'key': key, 'channels': channels},
      options: opts,
    );
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  @override
  Future<List<SearchResultModel>> search(AuthUser user, String query) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<Map<String, dynamic>>(
        '/search',
        queryParameters: {'q': query},
        options: opts,
      );
      final results = resp.data!['results'] as List<dynamic>? ?? [];
      return results.cast<Map<String, dynamic>>().map((r) {
        final item = r['item'] as Map<String, dynamic>? ?? {};
        return SearchResultModel(
          id: item['id'] as String? ?? '',
          type: SearchResultType.recent,
          title: item['title'] as String? ?? item['name'] as String? ?? '',
          subtitle: r['type'] as String? ?? '',
          route: '',
        );
      }).toList();
    } on DioException {
      return [];
    }
  }

  @override
  List<SearchResultModel> quickAccess(AuthUser user) {
    // Quick access shortcuts — role-based static list, no API call needed
    return switch (user.role) {
      UserRole.student => [
          const SearchResultModel(id: 'results', type: SearchResultType.shortcut, title: 'My Results', subtitle: 'View term results', route: '/student/results'),
          const SearchResultModel(id: 'attendance', type: SearchResultType.shortcut, title: 'Attendance', subtitle: 'View attendance', route: '/student/attendance'),
          const SearchResultModel(id: 'finance', type: SearchResultType.shortcut, title: 'Finance', subtitle: 'View invoice', route: '/student/finance'),
        ],
      UserRole.parent => [
          const SearchResultModel(id: 'children', type: SearchResultType.shortcut, title: 'My Children', subtitle: 'View children', route: '/parent/children'),
          const SearchResultModel(id: 'finance', type: SearchResultType.shortcut, title: 'Finance', subtitle: 'View fees', route: '/parent/finance'),
        ],
      UserRole.teacher => [
          const SearchResultModel(id: 'marks', type: SearchResultType.shortcut, title: 'Enter Marks', subtitle: 'Mark sheet', route: '/teacher/marks'),
          const SearchResultModel(id: 'attendance', type: SearchResultType.shortcut, title: 'Attendance', subtitle: 'Mark attendance', route: '/teacher/attendance'),
        ],
      _ => [],
    };
  }

  void dispose() {
    _pollTimer?.cancel();
    _streamController.close();
  }
}
