import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/json_num.dart';
import '../../network/api_client.dart';
import '../../network/api_failure.dart';

/// Headline numbers for the principal's home screen.
class PrincipalOverview {
  const PrincipalOverview({
    required this.schoolAverage,
    required this.passRate,
    required this.attendanceRate,
    required this.activeStudents,
    required this.atRiskCount,
    required this.collectionRate,
    required this.collected,
    required this.outstanding,
    required this.pendingApprovals,
    required this.pendingPayments,
    required this.openDiscipline,
  });

  final double schoolAverage;
  final double passRate;
  final double attendanceRate;
  final int activeStudents;
  final int atRiskCount;
  final double collectionRate;
  final double collected;
  final double outstanding;
  final int pendingApprovals;
  final int pendingPayments;
  final int openDiscipline;

  factory PrincipalOverview.fromJson(Map<String, dynamic> json, {int? atRiskOverride}) {
    Map<String, dynamic> map(Object? v) => v is Map ? Map<String, dynamic>.from(v) : const {};
    final overview = map(json['overview']);
    final academic = map(json['academic']);
    final finance = map(json['finance']);
    final attendance = map(json['attendance']);
    final billing = map(finance['billing']);
    final counts = map(json['counts']);
    final enrolment = map(overview['enrolment']);
    final atRisk = academic['atRiskStudents'];
    double d(Object? v) => numOf(v)?.toDouble() ?? 0.0;
    int i(Object? v) => numOf(v)?.toInt() ?? 0;
    return PrincipalOverview(
      schoolAverage: d(academic['schoolAverage']),
      passRate: d(academic['passRate']),
      attendanceRate: d(attendance['schoolAttendanceRate']),
      activeStudents: i(enrolment['activeStudents'] ?? enrolment['totalStudents']),
      atRiskCount: atRiskOverride ?? (atRisk is List ? atRisk.length : 0),
      collectionRate: d(billing['collectionRate']),
      collected: d(billing['totalCollected']),
      outstanding: d(billing['totalOutstanding']),
      pendingApprovals: i(counts['approvals']),
      pendingPayments: i(counts['payments']),
      openDiscipline: i(counts['discipline']),
    );
  }
}

/// An assessment whose marks wait for the principal's final approval.
class PrincipalApproval {
  const PrincipalApproval({
    required this.id,
    required this.title,
    required this.subject,
    required this.classLabel,
    required this.teacherName,
    required this.submittedAgo,
    required this.studentCount,
  });

  final String id;
  final String title;
  final String subject;
  final String classLabel;
  final String teacherName;
  final String submittedAgo;
  final int studentCount;

  factory PrincipalApproval.fromJson(Map<String, dynamic> json) => PrincipalApproval(
        id: json['id'] as String? ?? '',
        title: json['assessmentType'] as String? ?? json['name'] as String? ?? 'Assessment',
        subject: json['subject'] as String? ?? '',
        classLabel: json['classLabel'] as String? ?? '',
        teacherName: json['teacherName'] as String? ?? '',
        submittedAgo: json['submittedAgo'] as String? ?? '',
        studentCount: numOf(json['studentCount'])?.toInt() ?? 0,
      );
}

/// A manual payment waiting for approval.
class PrincipalPayment {
  const PrincipalPayment({
    required this.approvalId,
    required this.amount,
    required this.method,
    required this.reference,
    required this.requestedAt,
    this.notes,
    this.studentName = '',
    this.registrationNumber = '',
    this.invoiceNumber = '',
    this.paymentNumber = '',
  });

  final String approvalId;
  final double amount;
  final String method;
  final String reference;
  final DateTime? requestedAt;
  final String? notes;
  final String studentName;
  final String registrationNumber;
  final String invoiceNumber;
  final String paymentNumber;

  factory PrincipalPayment.fromJson(Map<String, dynamic> json) {
    final payment = json['payment'] is Map ? Map<String, dynamic>.from(json['payment'] as Map) : const <String, dynamic>{};
    final requested = json['requestedAt'] as String?;
    return PrincipalPayment(
      approvalId: json['id'] as String? ?? '',
      amount: numOf(payment['amount'])?.toDouble() ?? 0.0,
      method: payment['method'] as String? ?? '',
      reference: payment['referenceNumber'] as String? ?? payment['reference'] as String? ?? '',
      requestedAt: requested != null ? DateTime.tryParse(requested) : null,
      notes: (json['notes'] as String?) ?? (payment['notes'] as String?),
      studentName: json['studentName'] as String? ?? '',
      registrationNumber: json['registrationNumber'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? '',
      paymentNumber: payment['paymentNumber'] as String? ?? '',
    );
  }
}

/// A high/critical performance alert for a student.
class PrincipalAlert {
  const PrincipalAlert({
    required this.id,
    required this.title,
    required this.subject,
    required this.message,
    required this.severity,
    required this.score,
  });

  final String id;
  final String title;
  final String subject;
  final String message;
  final String severity;
  final double score;

  factory PrincipalAlert.fromJson(Map<String, dynamic> json) => PrincipalAlert(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        subject: json['subject'] as String? ?? json['subjectName'] as String? ?? '',
        message: json['message'] as String? ?? '',
        severity: (json['severity'] as String? ?? '').toUpperCase(),
        score: numOf(json['currentScore'])?.toDouble() ?? 0.0,
      );
}

/// Data and decisions behind the mobile principal workspace.
class ApiPrincipalService {
  ApiPrincipalService(this._storage) : _dio = buildApiClient(_storage, pathPrefix: '/api/v1');

  final FlutterSecureStorage _storage;
  final Dio _dio;

  Future<Options> _auth() async {
    final token = await _storage.read(key: 'access_token');
    return Options(headers: token != null ? {'Authorization': 'Bearer $token'} : {});
  }

  Future<List<Map<String, dynamic>>> _list(String path) async {
    try {
      final resp = await _dio.get<dynamic>(path, options: await _auth());
      final data = resp.data;
      final raw = data is List ? data : (data is Map ? (data['items'] ?? data['data']) : null);
      return (raw is List ? raw : const []).whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  Future<PrincipalOverview> getOverview() async {
    try {
      final resp = await _dio.get<dynamic>('/principal/dashboard', options: await _auth());
      final data = resp.data;
      // Performance alerts are the learners staff actually act on; prefer that count.
      int? alertCount;
      try {
        final alerts = await getAtRisk();
        if (alerts.isNotEmpty) alertCount = alerts.length;
      } catch (_) {}
      return PrincipalOverview.fromJson(
        data is Map ? Map<String, dynamic>.from(data) : const {},
        atRiskOverride: alertCount,
      );
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  Future<List<PrincipalApproval>> getApprovals() async =>
      (await _list('/principal/approvals')).map(PrincipalApproval.fromJson).toList();

  Future<List<PrincipalPayment>> getPendingPayments() async =>
      (await _list('/finance/payments/pending-approval')).map(PrincipalPayment.fromJson).toList();

  Future<List<PrincipalAlert>> getAtRisk() async =>
      (await _list('/principal/at-risk')).map(PrincipalAlert.fromJson).toList();

  Future<void> approveMarks(String assessmentId) async {
    try {
      await _dio.patch<void>(
        '/academics/assessments/$assessmentId/approve',
        data: const <String, dynamic>{},
        options: await _auth(),
      );
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  Future<void> rejectMarks(String assessmentId, String reason) async {
    try {
      await _dio.patch<void>(
        '/academics/assessments/$assessmentId/reject',
        data: {'reason': reason},
        options: await _auth(),
      );
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  Future<void> approvePayment(String approvalId) async {
    try {
      await _dio.patch<void>(
        '/finance/payments/approvals/$approvalId/approve',
        data: const <String, dynamic>{},
        options: await _auth(),
      );
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  Future<void> rejectPayment(String approvalId, String reason) async {
    try {
      await _dio.patch<void>(
        '/finance/payments/approvals/$approvalId/reject',
        data: {'rejectionReason': reason},
        options: await _auth(),
      );
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }
}
