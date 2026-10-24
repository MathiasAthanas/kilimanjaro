import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/admissions_models.dart';
import '../../network/api_client.dart';
import '../../network/api_failure.dart';
import '../interfaces/admissions_service_interface.dart';

class ApiAdmissionsService implements IAdmissionsService {
  ApiAdmissionsService(this._storage)
      : _dio = buildApiClient(_storage, pathPrefix: '/api/v1');

  final FlutterSecureStorage _storage;
  final Dio _dio;

  Future<Options> _auth() async {
    final token = await _storage.read(key: 'access_token');
    return Options(
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
    );
  }

  Map<String, dynamic>? _unwrap(dynamic data) {
    if (data is! Map<String, dynamic>) return null;
    final inner = data['data'];
    return inner is Map<String, dynamic> ? inner : data;
  }

  @override
  Future<AdmissionsSummary?> getSummary() async {
    try {
      final opts = await _auth();
      final resp = await _dio.get<dynamic>('/admissions/analytics', options: opts);
      final payload = _unwrap(resp.data);
      return payload == null ? null : AdmissionsSummary.fromJson(payload);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiFailure.fromDio(e);
    }
  }

  @override
  Future<List<AdmissionApplicant>> getApplicants({String? stage, String? search}) async {
    try {
      final opts = await _auth();
      final resp = await _dio.get<dynamic>(
        '/admissions/applicants',
        queryParameters: {
          'limit': 100,
          if (stage != null && stage.isNotEmpty) 'stage': stage,
          if (search != null && search.isNotEmpty) 'search': search,
        },
        options: opts,
      );
      final payload = _unwrap(resp.data);
      final items = payload?['items'] as List<dynamic>? ?? const [];
      return items
          .map((item) => AdmissionApplicant.fromJson(item as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return const [];
      throw ApiFailure.fromDio(e);
    }
  }

  @override
  Future<AdmissionApplicant?> getApplicant(String id) async {
    try {
      final opts = await _auth();
      final resp = await _dio.get<dynamic>('/admissions/applicants/$id', options: opts);
      final payload = _unwrap(resp.data);
      return payload == null ? null : AdmissionApplicant.fromJson(payload);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      throw ApiFailure.fromDio(e);
    }
  }

  @override
  Future<AdmissionApplicant?> createInquiry(NewInquiryInput input) async {
    // Idempotent: a retried inquiry create must not produce duplicate applicants.
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants',
      data: input.toJson(),
      options: idempotentWrite(),
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> transitionStage({
    required String applicantId,
    required String toStage,
    String? note,
  }) async {
    // Idempotent: a retried stage transition must not double-apply.
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants/$applicantId/transition',
      data: {'toStage': toStage, if (note != null && note.isNotEmpty) 'note': note},
      options: idempotentWrite(),
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> updateApplicant(
    String applicantId,
    Map<String, dynamic> changes,
  ) async {
    final resp = await _dio.patch<dynamic>(
      '/admissions/applicants/$applicantId',
      data: changes,
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> scheduleAssessment({
    required String applicantId,
    required DateTime scheduledAt,
    String? subjectFocus,
    double? maxScore,
    String? notes,
  }) async {
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants/$applicantId/assessments',
      data: {
        'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        if (subjectFocus != null && subjectFocus.isNotEmpty) 'subjectFocus': subjectFocus,
        if (maxScore != null) 'maxScore': maxScore,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
      options: idempotentWrite(),
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> recordAssessment({
    required String assessmentId,
    double? score,
    String? outcome,
    String? notes,
  }) async {
    final resp = await _dio.patch<dynamic>(
      '/admissions/assessments/$assessmentId',
      data: {
        if (score != null) 'score': score,
        if (outcome != null && outcome.isNotEmpty) 'outcome': outcome,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> issueOffer({
    required String applicantId,
    required String classId,
    double? feeExpectation,
    DateTime? expiresAt,
    String? note,
  }) async {
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants/$applicantId/offer',
      data: {
        'classId': classId,
        if (feeExpectation != null) 'feeExpectation': feeExpectation,
        if (expiresAt != null) 'expiresAt': expiresAt.toUtc().toIso8601String(),
        if (note != null && note.isNotEmpty) 'note': note,
      },
      options: idempotentWrite(),
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> decideOffer({
    required String applicantId,
    required String decision,
    String? note,
  }) async {
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants/$applicantId/offer/decision',
      data: {
        'decision': decision,
        if (note != null && note.isNotEmpty) 'note': note,
      },
      options: idempotentWrite(),
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }

  @override
  Future<AdmissionApplicant?> convert({
    required String applicantId,
    DateTime? admissionDate,
  }) async {
    // Idempotent: the server rejects a second conversion; the key lets a retry
    // after a dropped response resolve to the same result instead of erroring.
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants/$applicantId/convert',
      data: {
        if (admissionDate != null)
          'admissionDate': admissionDate.toUtc().toIso8601String(),
      },
      options: idempotentWrite(),
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }
}
