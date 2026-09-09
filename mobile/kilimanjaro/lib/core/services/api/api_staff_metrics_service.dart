import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/auth_user.dart';
import '../../config/app_config.dart';

class StaffMetric {
  const StaffMetric({required this.label, required this.value, this.detail});

  final String label;
  final String value;
  final String? detail;
}

/// Read-only headline metrics for web-primary staff roles (Principal, AQA,
/// Finance, System Admin). These roles work in the web dashboard — the mobile
/// app gives them a glanceable summary, notifications and profile only.
class ApiStaffMetricsService {
  ApiStaffMetricsService(this._storage) : _dio = _buildDio();

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

  Future<Map<String, dynamic>?> _get(String path) async {
    try {
      final opts = await _auth();
      final resp = await _dio.get<dynamic>(path, options: opts);
      final data = resp.data;
      if (data is Map<String, dynamic>) {
        final inner = data['data'];
        return inner is Map<String, dynamic> ? inner : data;
      }
    } on DioException {
      return null;
    }
    return null;
  }

  String _formatTzs(dynamic value) {
    final number = num.tryParse('${value ?? 0}') ?? 0;
    if (number >= 1000000000) {
      return 'TZS ${(number / 1000000000).toStringAsFixed(1)}B';
    }
    if (number >= 1000000) {
      return 'TZS ${(number / 1000000).toStringAsFixed(1)}M';
    }
    return 'TZS ${number.toStringAsFixed(0)}';
  }

  Future<List<StaffMetric>> getMetrics(UserRole role) async {
    if (role == UserRole.finance || role == UserRole.headOfFinance) {
      final finance = await _get('/analytics/finance/overview');
      final billing = finance?['billing'] as Map<String, dynamic>? ?? const {};
      return [
        StaffMetric(
          label: 'Collection Rate',
          value:
              '${(num.tryParse('${billing['collectionRate'] ?? 0}') ?? 0).toStringAsFixed(1)}%',
          detail: 'Against total invoiced',
        ),
        StaffMetric(
          label: 'Collected',
          value: _formatTzs(billing['totalCollected']),
          detail: 'This academic year',
        ),
        StaffMetric(
          label: 'Outstanding',
          value: _formatTzs(billing['totalOutstanding']),
          detail: 'Awaiting payment',
        ),
      ];
    }

    final academic = await _get('/analytics/academic/overview');
    final enrolment = await _get('/analytics/enrolment');
    final summary = enrolment?['summary'] as Map<String, dynamic>? ?? const {};
    final atRisk = academic?['atRiskStudents'];
    final atRiskCount = atRisk is List ? atRisk.length : 0;
    return [
      StaffMetric(
        label: 'School Average',
        value:
            '${(num.tryParse('${academic?['schoolAverage'] ?? 0}') ?? 0).toStringAsFixed(1)}%',
        detail: 'Current term, published marks',
      ),
      StaffMetric(
        label: 'Pass Rate',
        value:
            '${(num.tryParse('${academic?['passRate'] ?? 0}') ?? 0).toStringAsFixed(1)}%',
        detail: 'Across all subjects',
      ),
      StaffMetric(
        label: 'Active Students',
        value: '${summary['active'] ?? summary['total'] ?? 0}',
        detail: '$atRiskCount flagged at risk',
      ),
    ];
  }
}
