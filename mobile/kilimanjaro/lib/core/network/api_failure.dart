import 'package:dio/dio.dart';

/// The distinct application-level states a network call can resolve to.
///
/// Every failure that reaches the UI is one of these — screens branch on the
/// [ApiFailureKind] instead of guessing from an empty list or a null value.
enum ApiFailureKind {
  /// The session is missing/expired and refresh did not recover it (HTTP 401).
  unauthenticated,

  /// The user is authenticated but not allowed to see this resource (HTTP 403).
  forbidden,

  /// The request was rejected because the payload was invalid (HTTP 400/422).
  validation,

  /// The requested resource does not exist (HTTP 404).
  notFound,

  /// The device has no usable connection.
  offline,

  /// The request was sent but no response arrived in time.
  timeout,

  /// The backend failed (HTTP 5xx).
  server,

  /// Anything we could not classify.
  unknown,
}

/// A typed, user-safe representation of a failed API call.
///
/// Services throw this instead of swallowing errors into empty results, so the
/// difference between "no data" and "we couldn't load your data" is never lost.
class ApiFailure implements Exception {
  const ApiFailure({
    required this.kind,
    required this.message,
    this.statusCode,
    this.fieldErrors,
    this.correlationId,
    this.cause,
  });

  /// The category the UI branches on.
  final ApiFailureKind kind;

  /// A short, user-safe sentence suitable for display.
  final String message;

  /// The HTTP status code, when the request reached the server.
  final int? statusCode;

  /// Field-level validation errors keyed by field name, when available.
  final Map<String, String>? fieldErrors;

  /// The correlation id sent with the request, for support/monitoring.
  final String? correlationId;

  /// The original error, kept for logging only — never shown to users.
  final Object? cause;

  bool get isUnauthenticated => kind == ApiFailureKind.unauthenticated;
  bool get isForbidden => kind == ApiFailureKind.forbidden;
  bool get isOffline => kind == ApiFailureKind.offline;
  bool get isRetryable =>
      kind == ApiFailureKind.offline ||
      kind == ApiFailureKind.timeout ||
      kind == ApiFailureKind.server;

  /// Normalizes any thrown object into an [ApiFailure]. Idempotent: passing an
  /// [ApiFailure] returns it unchanged.
  static ApiFailure from(Object error) {
    if (error is ApiFailure) return error;
    if (error is DioException) return ApiFailure.fromDio(error);
    return ApiFailure(
      kind: ApiFailureKind.unknown,
      message: 'Something went wrong. Please try again.',
      cause: error,
    );
  }

  factory ApiFailure.fromDio(DioException e) {
    final correlationId =
        e.requestOptions.headers[_correlationHeader]?.toString();

    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiFailure(
          kind: ApiFailureKind.timeout,
          message: 'The request timed out. Check your connection and retry.',
          correlationId: correlationId,
          cause: e,
        );
      case DioExceptionType.connectionError:
        return ApiFailure(
          kind: ApiFailureKind.offline,
          message: 'You appear to be offline. Check your connection and retry.',
          correlationId: correlationId,
          cause: e,
        );
      case DioExceptionType.badCertificate:
        return ApiFailure(
          kind: ApiFailureKind.server,
          message: 'A secure connection could not be established.',
          correlationId: correlationId,
          cause: e,
        );
      case DioExceptionType.cancel:
        return ApiFailure(
          kind: ApiFailureKind.unknown,
          message: 'The request was cancelled.',
          correlationId: correlationId,
          cause: e,
        );
      case DioExceptionType.badResponse:
      case DioExceptionType.unknown:
        return _fromResponse(e, correlationId);
    }
  }

  static ApiFailure _fromResponse(DioException e, String? correlationId) {
    final status = e.response?.statusCode;
    // A DioExceptionType.unknown with a SocketException underneath is offline.
    if (status == null) {
      final text = e.error?.toString().toLowerCase() ?? '';
      if (text.contains('socket') ||
          text.contains('failed host lookup') ||
          text.contains('network is unreachable') ||
          text.contains('connection')) {
        return ApiFailure(
          kind: ApiFailureKind.offline,
          message: 'You appear to be offline. Check your connection and retry.',
          correlationId: correlationId,
          cause: e,
        );
      }
      return ApiFailure(
        kind: ApiFailureKind.unknown,
        message: 'Something went wrong. Please try again.',
        correlationId: correlationId,
        cause: e,
      );
    }

    final serverMessage = _extractMessage(e.response?.data);
    final fieldErrors = _extractFieldErrors(e.response?.data);

    if (status == 401) {
      return ApiFailure(
        kind: ApiFailureKind.unauthenticated,
        message: 'Your session has expired. Please sign in again.',
        statusCode: status,
        correlationId: correlationId,
        cause: e,
      );
    }
    if (status == 403) {
      return ApiFailure(
        kind: ApiFailureKind.forbidden,
        message: serverMessage ??
            'You do not have permission to view this content.',
        statusCode: status,
        correlationId: correlationId,
        cause: e,
      );
    }
    if (status == 404) {
      return ApiFailure(
        kind: ApiFailureKind.notFound,
        message: serverMessage ?? 'We could not find what you were looking for.',
        statusCode: status,
        correlationId: correlationId,
        cause: e,
      );
    }
    if (status == 400 || status == 422) {
      return ApiFailure(
        kind: ApiFailureKind.validation,
        message: serverMessage ?? 'Please check your details and try again.',
        statusCode: status,
        fieldErrors: fieldErrors,
        correlationId: correlationId,
        cause: e,
      );
    }
    if (status >= 500) {
      return ApiFailure(
        kind: ApiFailureKind.server,
        message: 'The server ran into a problem. Please try again shortly.',
        statusCode: status,
        correlationId: correlationId,
        cause: e,
      );
    }
    return ApiFailure(
      kind: ApiFailureKind.unknown,
      message: serverMessage ?? 'Something went wrong. Please try again.',
      statusCode: status,
      correlationId: correlationId,
      cause: e,
    );
  }

  /// Pulls a human message out of the common backend error envelopes:
  /// `{message}`, `{error}`, `{message: [..]}` (class-validator), `{errors:[{message}]}`.
  static String? _extractMessage(dynamic data) {
    if (data is Map) {
      final message = data['message'] ?? data['error'];
      if (message is String && message.trim().isNotEmpty) return message.trim();
      if (message is List && message.isNotEmpty) {
        return message.map((e) => e.toString()).join('\n');
      }
      final errors = data['errors'];
      if (errors is List && errors.isNotEmpty) {
        final first = errors.first;
        if (first is Map && first['message'] is String) {
          return first['message'] as String;
        }
        return errors.map((e) => e.toString()).join('\n');
      }
    }
    if (data is String && data.trim().isNotEmpty && data.length < 300) {
      return data.trim();
    }
    return null;
  }

  static Map<String, String>? _extractFieldErrors(dynamic data) {
    if (data is Map) {
      final errors = data['errors'];
      if (errors is Map) {
        final result = <String, String>{};
        errors.forEach((key, value) {
          if (value is String) {
            result[key.toString()] = value;
          } else if (value is List && value.isNotEmpty) {
            result[key.toString()] = value.first.toString();
          }
        });
        if (result.isNotEmpty) return result;
      }
    }
    return null;
  }

  /// The correlation-id header name, shared with the request interceptor.
  static const String _correlationHeader = 'X-Correlation-ID';

  @override
  String toString() =>
      'ApiFailure(${kind.name}, status: $statusCode, "$message")';
}
