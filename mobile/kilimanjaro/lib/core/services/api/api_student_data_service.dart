import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/announcement_model.dart';
import '../../../models/attendance_record_model.dart';
import '../../../models/invoice_model.dart';
import '../../../models/payment_model.dart';
import '../../../models/peer_pairing_model.dart';
import '../../../models/performance_snapshot_model.dart';
import '../../../models/performance_trend_model.dart';
import '../../../models/receipt_model.dart';
import '../../../models/report_card_model.dart';
import '../../../models/term_result_model.dart';
import '../../config/app_config.dart';
import '../interfaces/student_service_interface.dart';

class ApiStudentDataService implements IStudentService {
  ApiStudentDataService(this._storage) : _dio = _buildDio();

  final FlutterSecureStorage _storage;
  final Dio _dio;
  String? _cachedStudentId;
  Map<String, dynamic>? _cachedPerformanceProfile;

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

  Future<List<dynamic>> _getList(String path, {Map<String, dynamic>? params}) async {
    final opts = await _auth();
    final resp = await _dio.get<dynamic>(path, queryParameters: params, options: opts);
    if (resp.data is List) return resp.data as List<dynamic>;
    if (resp.data is Map) {
      final m = resp.data as Map<String, dynamic>;
      for (final key in ['data', 'items', 'results']) {
        if (m[key] is List) return m[key] as List<dynamic>;
      }
    }
    return [];
  }

  // ─── Terms + Results ──────────────────────────────────────────────────────

  @override
  Future<List<TermResultModel>> getTerms() async {
    // Single aggregated call: terms + results + report cards
    final opts = await _auth();
    final resp = await _dio.get<Map<String, dynamic>>(
      '/mobile/student/terms-overview',
      options: opts,
    );
    final data = resp.data!;
    return _buildTermModels(
      terms: (data['terms'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
      results: (data['results'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
      reportCards: (data['reportCards'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
    );
  }

  @override
  Future<TermResultModel?> getTerm(String termId) async {
    final opts = await _auth();
    final resp = await _dio.get<Map<String, dynamic>>(
      '/mobile/student/terms-overview',
      options: opts,
    );
    final data = resp.data!;
    final allModels = _buildTermModels(
      terms: (data['terms'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
      results: (data['results'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
      reportCards: (data['reportCards'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>(),
    );
    return allModels.where((m) => m.id == termId).firstOrNull;
  }

  List<TermResultModel> _buildTermModels({
    required List<Map<String, dynamic>> terms,
    required List<Map<String, dynamic>> results,
    required List<Map<String, dynamic>> reportCards,
  }) {
    final byTerm = <String, List<Map<String, dynamic>>>{};
    for (final r in results) {
      final termId = r['termId'] as String? ?? '';
      byTerm.putIfAbsent(termId, () => []).add(r);
    }

    final models = <TermResultModel>[];
    for (final term in terms) {
      final termId = term['id'] as String? ?? '';
      final termResults = byTerm[termId];
      if (termResults == null || termResults.isEmpty) continue;

      final reportCard = reportCards
          .where((rc) => rc['termId'] == termId)
          .firstOrNull;

      models.add(TermResultModel.fromComponents(
        term: term,
        results: termResults,
        reportCard: reportCard,
      ));
    }

    models.sort((a, b) {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return 0;
    });
    return models;
  }

  // ─── Report Card ──────────────────────────────────────────────────────────

  @override
  Future<ReportCardModel?> getReportCard(String termId) async {
    final opts = await _auth();
    try {
      // Use the mobile-specific aggregated endpoint
      final resp = await _dio.get<Map<String, dynamic>>(
        '/mobile/student/report-cards/$termId',
        options: opts,
      );
      final data = resp.data!;
      final reportCard = data['reportCard'] as Map<String, dynamic>?;
      if (reportCard == null) return null;
      return ReportCardModel.fromJson(reportCard);
    } on DioException {
      return null;
    }
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  @override
  Future<List<AttendanceRecordModel>> getAttendanceRecords() async {
    final list = await _getList('/students/attendance');
    return list
        .cast<Map<String, dynamic>>()
        .map(AttendanceRecordModel.fromJson)
        .toList();
  }

  // ─── Performance ─────────────────────────────────────────────────────────

  Future<Map<String, dynamic>?> _getStudentPerformanceProfile() async {
    if (_cachedPerformanceProfile != null) return _cachedPerformanceProfile;
    final opts = await _auth();
    try {
      if (_cachedStudentId == null) {
        final dashboard = await _dio.get<Map<String, dynamic>>(
          '/mobile/student/dashboard',
          options: opts,
        );
        _cachedStudentId =
            (dashboard.data?['profile'] as Map<String, dynamic>?)?['id'] as String?;
      }
      if (_cachedStudentId == null) return null;
      final resp = await _dio.get<Map<String, dynamic>>(
        '/students/performance/$_cachedStudentId',
        options: opts,
      );
      _cachedPerformanceProfile = resp.data;
      return _cachedPerformanceProfile;
    } on DioException {
      return null;
    }
  }

  @override
  Future<List<PerformanceAlertModel>> getAlerts() async {
    final profile = await _getStudentPerformanceProfile();
    if (profile == null) return [];
    final alerts = profile['alerts'] as List<dynamic>? ?? [];
    return alerts
        .cast<Map<String, dynamic>>()
        .map(PerformanceAlertModel.fromJson)
        .toList();
  }

  @override
  Future<List<PerformanceSnapshotModel>> getPerformanceSnapshots() async {
    final profile = await _getStudentPerformanceProfile();
    if (profile == null) return [];
    final snapshots = profile['snapshots'] as List<dynamic>? ?? profile['latestSnapshots'] as List<dynamic>? ?? [];
    return snapshots
        .cast<Map<String, dynamic>>()
        .map(PerformanceSnapshotModel.fromJson)
        .toList();
  }

  @override
  Future<PerformanceTrendModel?> getPerformanceTrend(String subjectId) async {
    final profile = await _getStudentPerformanceProfile();
    if (profile == null) return null;
    final trends = profile['trends'] as List<dynamic>? ?? profile['subjectTrends'] as List<dynamic>? ?? [];
    final match = trends.cast<Map<String, dynamic>>()
        .where((t) => t['subjectId'] == subjectId)
        .firstOrNull;
    if (match == null) return null;
    return PerformanceTrendModel.fromJson(match);
  }

  // ─── Peer Pairing ─────────────────────────────────────────────────────────

  @override
  Future<PeerPairingModel?> getPeerPairing(String subjectId) async {
    final profile = await _getStudentPerformanceProfile();
    if (profile == null) return null;
    final pairings = profile['pairings'] as List<dynamic>? ?? profile['activePairings'] as List<dynamic>? ?? [];
    final match = pairings.cast<Map<String, dynamic>>()
        .where((p) => p['subjectId'] == subjectId)
        .firstOrNull;
    if (match == null) return null;
    return PeerPairingModel.fromJson(match);
  }

  // ─── Finance ──────────────────────────────────────────────────────────────

  @override
  Future<InvoiceModel> getCurrentInvoice() async {
    final opts = await _auth();
    final resp = await _dio.get<Map<String, dynamic>>(
      '/mobile/student/finance',
      options: opts,
    );
    final data = resp.data!;
    final invoices = data['invoices'] as List<dynamic>? ?? [];
    if (invoices.isEmpty) throw Exception('No invoice found');

    // Return first non-paid invoice, or most recent
    final list = invoices.cast<Map<String, dynamic>>();
    final current = list.where((i) => i['status'] != 'PAID').firstOrNull ?? list.first;
    return InvoiceModel.fromJson(current);
  }

  @override
  Future<List<PaymentModel>> getPayments() async {
    final opts = await _auth();
    final resp = await _dio.get<Map<String, dynamic>>(
      '/mobile/student/finance',
      options: opts,
    );
    final data = resp.data!;
    final payments = data['payments'] as List<dynamic>? ?? [];
    return payments.cast<Map<String, dynamic>>().map(PaymentModel.fromJson).toList();
  }

  @override
  Future<ReceiptModel?> getReceipt(String receiptId) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<Map<String, dynamic>>(
        '/finance/receipts/$receiptId',
        options: opts,
      );
      return ReceiptModel.fromJson(resp.data!);
    } on DioException {
      return null;
    }
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async {
    final list = await _getList('/notifications/announcements/active');
    return list.cast<Map<String, dynamic>>().map(AnnouncementModel.fromJson).toList();
  }
}
