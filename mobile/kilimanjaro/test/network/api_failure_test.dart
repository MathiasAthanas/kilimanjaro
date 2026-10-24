import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/core/network/api_failure.dart';

DioException _dio(
  DioExceptionType type, {
  int? status,
  dynamic data,
}) {
  final request = RequestOptions(path: '/x');
  return DioException(
    requestOptions: request,
    type: type,
    response: status == null
        ? null
        : Response<dynamic>(
            requestOptions: request,
            statusCode: status,
            data: data,
          ),
  );
}

void main() {
  group('ApiFailure.fromDio maps transport errors', () {
    test('connection timeout -> timeout', () {
      final f = ApiFailure.fromDio(_dio(DioExceptionType.connectionTimeout));
      expect(f.kind, ApiFailureKind.timeout);
      expect(f.isRetryable, isTrue);
    });

    test('connection error -> offline', () {
      final f = ApiFailure.fromDio(_dio(DioExceptionType.connectionError));
      expect(f.kind, ApiFailureKind.offline);
      expect(f.isOffline, isTrue);
    });
  });

  group('ApiFailure.fromDio maps HTTP status codes', () {
    test('401 -> unauthenticated', () {
      final f = ApiFailure.fromDio(
          _dio(DioExceptionType.badResponse, status: 401));
      expect(f.kind, ApiFailureKind.unauthenticated);
      expect(f.isUnauthenticated, isTrue);
    });

    test('403 -> forbidden with server message', () {
      final f = ApiFailure.fromDio(_dio(DioExceptionType.badResponse,
          status: 403, data: {'message': 'Not your class'}));
      expect(f.kind, ApiFailureKind.forbidden);
      expect(f.message, 'Not your class');
    });

    test('404 -> notFound', () {
      final f = ApiFailure.fromDio(
          _dio(DioExceptionType.badResponse, status: 404));
      expect(f.kind, ApiFailureKind.notFound);
    });

    test('422 -> validation with field errors', () {
      final f = ApiFailure.fromDio(_dio(DioExceptionType.badResponse,
          status: 422, data: {
            'message': 'Invalid',
            'errors': {'email': 'required'}
          }));
      expect(f.kind, ApiFailureKind.validation);
      expect(f.fieldErrors?['email'], 'required');
    });

    test('500 -> server', () {
      final f = ApiFailure.fromDio(
          _dio(DioExceptionType.badResponse, status: 500));
      expect(f.kind, ApiFailureKind.server);
      expect(f.isRetryable, isTrue);
    });
  });

  test('ApiFailure.from is idempotent and wraps unknown errors', () {
    const existing = ApiFailure(
        kind: ApiFailureKind.server, message: 'boom');
    expect(identical(ApiFailure.from(existing), existing), isTrue);

    final wrapped = ApiFailure.from(StateError('nope'));
    expect(wrapped.kind, ApiFailureKind.unknown);
  });
}
