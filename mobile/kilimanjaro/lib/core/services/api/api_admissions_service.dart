import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/admissions_models.dart';
import '../../config/app_config.dart';
import '../interfaces/admissions_service_interface.dart';

class ApiAdmissionsService implements IAdmissionsService {
  ApiAdmissionsService(this._storage) : _dio = _buildDio();

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
    } on DioException {
      return null;
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
    } on DioException {
      return [];
    }
  }

  @override
  Future<AdmissionApplicant?> getApplicant(String id) async {
    try {
      final opts = await _auth();
      final resp = await _dio.get<dynamic>('/admissions/applicants/$id', options: opts);
      final payload = _unwrap(resp.data);
      return payload == null ? null : AdmissionApplicant.fromJson(payload);
    } on DioException {
      return null;
    }
  }

  @override
  Future<AdmissionApplicant?> createInquiry(NewInquiryInput input) async {
    final opts = await _auth();
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants',
      data: input.toJson(),
      options: opts,
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
    final opts = await _auth();
    final resp = await _dio.post<dynamic>(
      '/admissions/applicants/$applicantId/transition',
      data: {'toStage': toStage, if (note != null && note.isNotEmpty) 'note': note},
      options: opts,
    );
    final payload = _unwrap(resp.data);
    return payload == null ? null : AdmissionApplicant.fromJson(payload);
  }
}
