import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/announcement_model.dart';
import '../../../models/attendance_record_model.dart';
import '../../../models/child_summary_model.dart';
import '../../../models/contact_model.dart';
import '../../../models/invoice_model.dart';
import '../../../models/performance_snapshot_model.dart';
import '../../../models/performance_trend_model.dart';
import '../../../models/receipt_model.dart';
import '../../../models/report_card_model.dart';
import '../../../models/term_result_model.dart';
import '../../config/app_config.dart';
import '../interfaces/parent_service_interface.dart';

class ApiParentDataService implements IParentService {
  ApiParentDataService(this._storage) : _dio = _buildDio();

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

  Future<Map<String, dynamic>?> _getMap(String path) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>(path, options: opts);
      if (resp.data is Map) return resp.data as Map<String, dynamic>;
    } on DioException {
      return null;
    }
    return null;
  }

  Future<List<dynamic>> _getList(String path, {Map<String, dynamic>? params}) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>(path, queryParameters: params, options: opts);
      if (resp.data is List) return resp.data as List<dynamic>;
      if (resp.data is Map) {
        final m = resp.data as Map<String, dynamic>;
        for (final key in ['data', 'items', 'results', 'children']) {
          if (m[key] is List) return m[key] as List<dynamic>;
        }
      }
    } on DioException {
      return [];
    }
    return [];
  }

  // ─── Children ─────────────────────────────────────────────────────────────

  @override
  Future<List<ChildSummary>> getChildren() async {
    final opts = await _auth();
    final resp = await _dio.get<Map<String, dynamic>>(
      '/mobile/parent/children',
      options: opts,
    );
    final data = resp.data!;
    final children = data['children'] as List<dynamic>? ?? [];

    // Fetch dashboard data for each child in parallel for enrichment
    final summaries = await Future.wait(
      children.cast<Map<String, dynamic>>().map((child) => _buildChildSummary(child)),
    );
    return summaries;
  }

  Future<ChildSummary> _buildChildSummary(Map<String, dynamic> child) async {
    final childId = child['id'] as String? ?? '';
    try {
      final dash = await _getMap('/mobile/parent/children/$childId/dashboard');
      if (dash != null) {
        return ChildSummary.fromJson({...child, ...dash});
      }
    } on DioException {
      // fallback to basic data
    }
    return ChildSummary.fromJson(child);
  }

  @override
  Future<ChildSummary?> getChild(String childId) async {
    final dash = await _getMap('/mobile/parent/children/$childId/dashboard');
    if (dash == null) return null;
    return ChildSummary.fromJson(dash);
  }

  // ─── Terms + Results ──────────────────────────────────────────────────────

  @override
  Future<List<TermResultModel>> getTerms(String childId) async {
    final opts = await _auth();
    final resp = await _dio.get<Map<String, dynamic>>(
      '/mobile/parent/children/$childId/terms-overview',
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
  Future<TermResultModel?> getTerm(String childId, String termId) async {
    final allTerms = await getTerms(childId);
    return allTerms.where((t) => t.id == termId).firstOrNull;
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
  Future<ReportCardModel?> getReportCard(String childId, String termId) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<Map<String, dynamic>>(
        '/academics/report-cards/$childId/term/$termId',
        options: opts,
      );
      return ReportCardModel.fromJson(resp.data!);
    } on DioException {
      return null;
    }
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  @override
  Future<List<AttendanceRecordModel>> getAttendanceRecords(String childId) async {
    final list = await _getList('/students/attendance', params: {'studentId': childId});
    return list.cast<Map<String, dynamic>>().map(AttendanceRecordModel.fromJson).toList();
  }

  // ─── Performance ─────────────────────────────────────────────────────────

  Future<Map<String, dynamic>?> _getChildProfile(String childId) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<Map<String, dynamic>>(
        '/students/performance/$childId',
        options: opts,
      );
      return resp.data;
    } on DioException {
      return null;
    }
  }

  @override
  Future<List<PerformanceAlertModel>> getAlerts(String childId) async {
    final profile = await _getChildProfile(childId);
    if (profile == null) return [];
    final alerts = profile['alerts'] as List<dynamic>? ?? [];
    return alerts.cast<Map<String, dynamic>>().map(PerformanceAlertModel.fromJson).toList();
  }

  @override
  Future<List<PerformanceSnapshotModel>> getPerformanceSnapshots(String childId) async {
    final profile = await _getChildProfile(childId);
    if (profile == null) return [];
    final snapshots = profile['snapshots'] as List<dynamic>? ?? profile['latestSnapshots'] as List<dynamic>? ?? [];
    return snapshots.cast<Map<String, dynamic>>().map(PerformanceSnapshotModel.fromJson).toList();
  }

  @override
  Future<PerformanceTrendModel?> getPerformanceTrend(String childId, String subjectId) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<Map<String, dynamic>>(
        '/students/performance/$childId/subject/$subjectId',
        options: opts,
      );
      return PerformanceTrendModel.fromJson(resp.data!);
    } on DioException {
      return null;
    }
  }

  // ─── Finance ──────────────────────────────────────────────────────────────

  @override
  Future<InvoiceModel> getCurrentInvoice(String childId) async {
    final list = await _getList('/finance/invoices', params: {'studentId': childId});
    if (list.isEmpty) throw Exception('No invoice found for child $childId');
    final invoices = list.cast<Map<String, dynamic>>();
    final current = invoices.where((i) => i['status'] != 'PAID').firstOrNull ?? invoices.first;
    return InvoiceModel.fromJson(current);
  }

  @override
  Future<InvoiceModel?> getInvoiceById(String invoiceId) async {
    final data = await _getMap('/finance/invoices/$invoiceId');
    if (data == null) return null;
    return InvoiceModel.fromJson(data);
  }

  @override
  Future<ReceiptModel?> getReceipt(String receiptId) async {
    final data = await _getMap('/finance/receipts/$receiptId');
    if (data == null) return null;
    return ReceiptModel.fromJson(data);
  }

  @override
  Future<List<ReceiptModel>> getReceipts() async {
    final list = await _getList('/finance/receipts');
    return list.cast<Map<String, dynamic>>().map(ReceiptModel.fromJson).toList();
  }

  @override
  Future<double> getCombinedOutstanding() async {
    final children = await getChildren();
    return children.fold<double>(0.0, (sum, c) => sum + c.outstandingBalance);
  }

  @override
  Future<Map<String, double>> getClassAverages(String childId, String termId) async {
    // Class averages are staff-only data; return empty map (comparison chart degrades gracefully)
    return {};
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async {
    final list = await _getList('/notifications/announcements/active');
    return list.cast<Map<String, dynamic>>().map(AnnouncementModel.fromJson).toList();
  }

  // ─── Contact School ───────────────────────────────────────────────────────

  @override
  Future<ContactSchoolModel> getContactSchool(String childId) async {
    // Contact school info is static / school-wide; return a sensible default
    // that the school admin can configure later via a settings endpoint
    return const ContactSchoolModel(
      schoolName: 'Kilimanjaro School',
      address: 'Please contact the school office for the address',
      openHours: 'Mon–Fri: 7:00 AM – 5:00 PM',
      emergencyPhone: '',
      actions: [],
      teachers: [],
      faqItems: [],
    );
  }
}
