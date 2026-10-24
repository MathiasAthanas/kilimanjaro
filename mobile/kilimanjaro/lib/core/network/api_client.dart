import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/app_config.dart';
import 'api_failure.dart';
import 'error_monitor.dart';
import 'session_bus.dart';

const String accessTokenKey = 'access_token';
const String refreshTokenKey = 'refresh_token';
const String _correlationHeader = 'X-Correlation-ID';

/// Builds a fully-configured [Dio] for one API surface.
///
/// Every service in the app goes through this so authentication, correlation
/// ids, single-flight token refresh, and error monitoring are applied in
/// exactly one place. [pathPrefix] is appended to [AppConfig.apiBaseUrl]
/// (e.g. `/api/v1` or `/elearning`).
Dio buildApiClient(
  FlutterSecureStorage storage, {
  String pathPrefix = '',
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: '${AppConfig.apiBaseUrl}$pathPrefix',
      connectTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  dio.interceptors.add(_AuthInterceptor(storage));
  dio.interceptors.add(_ActiveSchoolInterceptor(storage));
  dio.interceptors.add(_EnvelopeInterceptor());
  dio.interceptors.add(_IdempotencyInterceptor());
  dio.interceptors.add(_RefreshInterceptor(storage));
  dio.interceptors.add(_MonitoringInterceptor());
  return dio;
}

/// The backend wraps payloads as `{success, data}` (service responses) or
/// `{data, meta:{generatedAt,...}}` (gateway UI aggregates). Services parse the
/// bare payload, so unwrap both shapes once here instead of in every caller.
/// Secure-storage key holding the school the user is currently working in.
const String activeSchoolStorageKey = 'active_school_id';

/// Sends the selected school as `X-Active-School` so multi-school staff see
/// that school's data; the gateway ignores ids outside the user's membership.
class _ActiveSchoolInterceptor extends Interceptor {
  _ActiveSchoolInterceptor(this._storage);
  final FlutterSecureStorage _storage;

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      if (options.extra['noActiveSchool'] == true) return handler.next(options);
      final id = await _storage.read(key: activeSchoolStorageKey);
      if (id != null && id.isNotEmpty) options.headers['X-Active-School'] = id;
    } catch (_) {}
    handler.next(options);
  }
}

class _EnvelopeInterceptor extends Interceptor {
  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    var body = response.data;
    for (var i = 0; i < 2; i++) {
      if (body is! Map || !body.containsKey('data')) break;
      final isServiceEnvelope = body['success'] is bool;
      final meta = body['meta'];
      final isUiEnvelope = meta is Map && meta.containsKey('generatedAt');
      if (!isServiceEnvelope && !isUiEnvelope) break;
      body = body['data'];
    }
    response.data = body;
    handler.next(response);
  }
}

/// Options that mark a write as idempotent. Attach these to a POST/PUT/PATCH
/// that must not be duplicated if it is retried (e.g. after a token refresh) —
/// marks submission, attendance, payments, admissions conversion. The client
/// generates a stable `Idempotency-Key` and reuses it across the retry so the
/// server can collapse duplicates.
///
///   await _dio.post('/…', data: body, options: idempotentWrite());
Options idempotentWrite({Map<String, dynamic>? headers}) => Options(
      headers: headers,
      extra: {_idempotentFlag: true},
    );

const String _idempotentFlag = '__idempotent__';

/// Generates and pins an `Idempotency-Key` for writes opted in via
/// [idempotentWrite]. The key lives on the request's `extra`, so the single
/// post-refresh retry reuses the exact same key rather than minting a new one.
class _IdempotencyInterceptor extends Interceptor {
  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) {
    final method = options.method.toUpperCase();
    final isWrite = method == 'POST' || method == 'PUT' || method == 'PATCH';
    if (isWrite &&
        options.extra[_idempotentFlag] == true &&
        !options.headers.containsKey('Idempotency-Key')) {
      final key = options.extra['__idempotencyKey__'] as String? ??
          _newCorrelationId();
      options.extra['__idempotencyKey__'] = key;
      options.headers['Idempotency-Key'] = key;
    }
    handler.next(options);
  }
}

/// Attaches the bearer token (unless the caller already set one) plus a
/// correlation id and client identifier to every request.
class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._storage);

  final FlutterSecureStorage _storage;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!options.headers.containsKey('Authorization')) {
      final token = await _storage.read(key: accessTokenKey);
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    options.headers.putIfAbsent(_correlationHeader, _newCorrelationId);
    options.headers.putIfAbsent('X-Client', () => 'kilimanjaro-mobile');
    handler.next(options);
  }
}

/// Refreshes an expired access token at most once per burst, retries the failed
/// request, and on refresh failure clears the session and signals the app to
/// return to login.
class _RefreshInterceptor extends Interceptor {
  _RefreshInterceptor(this._storage);

  final FlutterSecureStorage _storage;

  // Shared across all instances so concurrent 401s trigger a single refresh.
  static Future<bool>? _inFlightRefresh;

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final response = err.response;
    final path = err.requestOptions.path;
    final isAuthCall = path.contains('/auth/login') ||
        path.contains('/auth/refresh') ||
        path.contains('/auth/logout');
    final alreadyRetried = err.requestOptions.extra['__retried__'] == true;

    if (response?.statusCode != 401 || isAuthCall || alreadyRetried) {
      return handler.next(err);
    }

    final refreshed = await (_inFlightRefresh ??= _refresh());
    _inFlightRefresh = null;

    if (!refreshed) {
      await _clearSession();
      SessionBus.instance.emitExpired();
      return handler.next(err);
    }

    try {
      final newToken = await _storage.read(key: accessTokenKey);
      final options = err.requestOptions
        ..extra['__retried__'] = true
        ..headers['Authorization'] = 'Bearer $newToken';
      // A fresh Dio avoids re-entering this interceptor chain on retry.
      final retryResponse = await Dio().fetch<dynamic>(options);
      return handler.resolve(retryResponse);
    } on DioException catch (retryError) {
      return handler.next(retryError);
    }
  }

  Future<bool> _refresh() async {
    final refreshToken = await _storage.read(key: refreshTokenKey);
    if (refreshToken == null || refreshToken.isEmpty) return false;
    try {
      final resp = await Dio().post<Map<String, dynamic>>(
        '${AppConfig.apiBaseUrl}/api/v1/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final body = resp.data ?? const <String, dynamic>{};
      // The backend wraps payloads as {success, data: {...}}.
      final data = body['data'] is Map<String, dynamic>
          ? body['data'] as Map<String, dynamic>
          : body;
      final newAccess =
          data['access_token'] as String? ?? data['accessToken'] as String?;
      final newRefresh =
          data['refresh_token'] as String? ?? data['refreshToken'] as String?;
      if (newAccess == null || newAccess.isEmpty) return false;
      await _storage.write(key: accessTokenKey, value: newAccess);
      if (newRefresh != null && newRefresh.isNotEmpty) {
        await _storage.write(key: refreshTokenKey, value: newRefresh);
      }
      return true;
    } on DioException {
      return false;
    }
  }

  Future<void> _clearSession() async {
    await _storage.delete(key: accessTokenKey);
    await _storage.delete(key: refreshTokenKey);
  }
}

/// Reports failed requests to the monitor with PII-redacted context.
class _MonitoringInterceptor extends Interceptor {
  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final failure = ApiFailure.fromDio(err);
    ErrorMonitor.instance.captureApiFailure(
      failure,
      method: err.requestOptions.method,
      path: err.requestOptions.path,
    );
    handler.next(err);
  }
}

final _random = Random();

String _newCorrelationId() {
  final now = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
  final salt = _random.nextInt(1 << 32).toRadixString(36);
  return 'kmob-$now-$salt';
}
