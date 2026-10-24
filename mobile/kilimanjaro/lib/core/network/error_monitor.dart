import 'package:flutter/foundation.dart';

import 'api_failure.dart';

/// A report handed to whatever crash/monitoring backend is wired in production
/// (Sentry, Crashlytics, a custom endpoint). Every field is already redacted.
class ErrorReport {
  const ErrorReport({
    required this.kind,
    required this.message,
    this.statusCode,
    this.method,
    this.path,
    this.correlationId,
    this.stackTrace,
  });

  final String kind;
  final String message;
  final int? statusCode;
  final String? method;
  final String? path;
  final String? correlationId;
  final StackTrace? stackTrace;

  Map<String, dynamic> toJson() => {
        'kind': kind,
        'message': message,
        if (statusCode != null) 'statusCode': statusCode,
        if (method != null) 'method': method,
        if (path != null) 'path': path,
        if (correlationId != null) 'correlationId': correlationId,
      };
}

typedef ErrorReporter = void Function(ErrorReport report);

/// A single sink for production errors with PII redaction applied before
/// anything leaves the device.
///
/// In production, call [ErrorMonitor.instance.setReporter] once at startup to
/// forward reports to your monitoring backend. Until then reports are logged in
/// debug builds and dropped in release builds — never silently swallowed at the
/// call site.
class ErrorMonitor {
  ErrorMonitor._();

  static final ErrorMonitor instance = ErrorMonitor._();

  ErrorReporter? _reporter;

  void setReporter(ErrorReporter reporter) => _reporter = reporter;

  void captureApiFailure(
    ApiFailure failure, {
    String? method,
    String? path,
  }) {
    // A 401/validation error is expected control flow, not an incident.
    if (failure.kind == ApiFailureKind.unauthenticated ||
        failure.kind == ApiFailureKind.validation) {
      return;
    }
    _dispatch(ErrorReport(
      kind: failure.kind.name,
      message: _redact(failure.message),
      statusCode: failure.statusCode,
      method: method,
      path: _redactPath(path),
      correlationId: failure.correlationId,
    ));
  }

  void captureException(Object error, StackTrace stack) {
    _dispatch(ErrorReport(
      kind: 'exception',
      message: _redact(error.toString()),
      stackTrace: stack,
    ));
  }

  void _dispatch(ErrorReport report) {
    final reporter = _reporter;
    if (reporter != null) {
      reporter(report);
    } else if (kDebugMode) {
      debugPrint('[ErrorMonitor] ${report.toJson()}');
    }
  }

  /// Strips values that commonly carry PII (emails, phone numbers, long digit
  /// runs, bearer tokens) before a message is sent off-device.
  static String _redact(String input) {
    return input
        .replaceAll(
            RegExp(r'[\w.+-]+@[\w-]+\.[\w.-]+', caseSensitive: false), '[email]')
        .replaceAll(RegExp(r'\bBearer\s+[A-Za-z0-9._-]+'), 'Bearer [token]')
        .replaceAll(RegExp(r'\+?\d[\d\s-]{7,}\d'), '[number]');
  }

  /// Replaces likely id path segments so URLs in reports don't leak record ids.
  static String? _redactPath(String? path) {
    if (path == null) return null;
    return path
        .split('/')
        .map((segment) {
          final isId = RegExp(r'^[0-9a-fA-F-]{16,}$').hasMatch(segment) ||
              RegExp(r'^\d+$').hasMatch(segment);
          return isId ? ':id' : segment;
        })
        .join('/');
  }
}
