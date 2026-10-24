import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/announcement_model.dart';
import '../../../models/hod_models.dart';
import '../../network/api_client.dart';
import '../../network/api_failure.dart';
import '../interfaces/hod_service_interface.dart';
import '../../../models/json_num.dart';

String _buildName(Map<String, dynamic> json) {
  final first = json['firstName'] as String? ?? '';
  final last = json['lastName'] as String? ?? '';
  final combined = '$first $last'.trim();
  return combined.isNotEmpty
      ? combined
      : (json['name'] as String? ?? json['fullName'] as String? ?? '');
}

String _buildNameFromNested(Map<String, dynamic>? nested, String? fallback) {
  if (nested != null) {
    final n = _buildName(nested);
    if (n.isNotEmpty) return n;
  }
  return fallback ?? '';
}

class ApiHodService implements IHodService {
  ApiHodService(this._storage)
      : _dio = buildApiClient(_storage, pathPrefix: '/api/v1');

  final FlutterSecureStorage _storage;
  final Dio _dio;

  Future<Options> _auth() async {
    final token = await _storage.read(key: 'access_token');
    return Options(
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
    );
  }

  Future<List<dynamic>> _getList(String path, {Map<String, dynamic>? params}) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>(path, queryParameters: params, options: opts);
      if (resp.data is List) return resp.data as List<dynamic>;
      if (resp.data is Map) {
        final m = resp.data as Map<String, dynamic>;
        for (final key in ['items', 'data', 'results', 'approvals', 'raw']) {
          if (m[key] is List) return m[key] as List<dynamic>;
        }
      }
      return const [];
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return const [];
      throw ApiFailure.fromDio(e);
    }
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  @override
  Future<List<HodApproval>> getPendingApprovals() async {
    final list = await _getList('/hod/approvals');
    return list.cast<Map<String, dynamic>>().map(_approvalFromJson).toList();
  }

  @override
  Future<List<HodApproval>> getApprovalHistory() async {
    final list = await _getList('/hod/approvals/history');
    return list.cast<Map<String, dynamic>>().map(_approvalFromJson).toList();
  }

  HodApproval _approvalFromJson(Map<String, dynamic> json) {
    final marks = json['marks'] as List<dynamic>? ?? [];
    final scores = marks
        .cast<Map<String, dynamic>>()
        .map((m) => numOf(m['score'])?.toDouble() ?? 0.0)
        .toList();

    // Build score distribution buckets
    final distribution = <String, int>{};
    for (final score in scores) {
      final bucket = '${(score / 10).floor() * 10}-${(score / 10).floor() * 10 + 9}';
      distribution[bucket] = (distribution[bucket] ?? 0) + 1;
    }

    final highest = scores.isEmpty ? 0.0 : scores.reduce((a, b) => a > b ? a : b);
    final lowest = scores.isEmpty ? 0.0 : scores.reduce((a, b) => a < b ? a : b);
    final classAverage = scores.isEmpty ? 0.0 : scores.reduce((a, b) => a + b) / scores.length;

    return HodApproval(
      id: json['id'] as String? ?? '',
      subject: json['subjectName'] as String? ?? json['subject'] as String? ?? '',
      classLabel: json['classLabel'] as String? ?? (json['class'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      assessmentType: json['assessmentType'] as String? ?? json['type'] as String? ?? '',
      teacherName: json['teacherName'] as String? ??
          _buildNameFromNested(json['teacher'] as Map<String, dynamic>?, null),
      submittedAgo: json['submittedAgo'] as String? ?? json['submittedAt'] as String? ?? '',
      studentCount: json['studentCount'] as int? ?? scores.length,
      maxScore: numOf(json['maxScore'])?.toDouble() ?? 100.0,
      classAverage: numOf(json['classAverage'])?.toDouble() ?? classAverage,
      highest: numOf(json['highest'])?.toDouble() ?? highest,
      lowest: numOf(json['lowest'])?.toDouble() ?? lowest,
      distribution: json['distribution'] != null
          ? Map<String, int>.from(json['distribution'] as Map)
          : distribution,
      status: _parseApprovalStatus(json['status'] as String? ?? 'SUBMITTED'),
      rejectionReason: json['rejectionReason'] as String?,
    );
  }

  HodApprovalStatus _parseApprovalStatus(String raw) {
    switch (raw.toUpperCase()) {
      case 'APPROVED':
        return HodApprovalStatus.approved;
      case 'REJECTED':
        return HodApprovalStatus.rejected;
      default:
        return HodApprovalStatus.pending;
    }
  }

  @override
  Future<List<HodMarkRow>> getAssessmentMarks(String assessmentId) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>('/academics/assessments/$assessmentId/marks/review', options: opts);
      final data = resp.data;
      final rows = data is Map ? data['studentMarks'] : null;
      return (rows is List ? rows : const [])
          .whereType<Map>()
          .map((m) => HodMarkRow(
                name: (m['name'] as String?)?.trim().isNotEmpty == true ? m['name'] as String : 'Student',
                registrationNumber: m['registrationNumber'] as String? ?? '',
                score: numOf(m['score'])?.toDouble() ?? 0.0,
                isAbsent: m['isAbsent'] == true,
                note: m['note'] as String?,
              ))
          .toList();
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  @override
  Future<void> approveAssessment(String assessmentId) async {
    final opts = await _auth();
    await _dio.patch<void>('/academics/assessments/$assessmentId/approve', options: opts);
  }

  @override
  Future<void> rejectAssessment(String assessmentId, String reason) async {
    final opts = await _auth();
    await _dio.patch<void>(
      '/academics/assessments/$assessmentId/reject',
      data: {'reason': reason},
      options: opts,
    );
  }

  // ─── Department ───────────────────────────────────────────────────────────

  @override
  Future<List<HodSubjectAnalytics>> getDepartmentSubjects() async {
    final list = await _getList('/hod/department');
    return list.cast<Map<String, dynamic>>().map((json) {
      final classes = (json['classes'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>().map((c) {
        return HodClassAnalytics(
          classLabel: c['classLabel'] as String? ?? '',
          teacherName: c['teacherName'] as String? ?? '',
          average: numOf(c['average'])?.toDouble() ?? 0.0,
          studentCount: c['studentCount'] as int? ?? 0,
        );
      }).toList();

      return HodSubjectAnalytics(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? json['subjectName'] as String? ?? '',
        average: numOf(json['average'])?.toDouble() ?? 0.0,
        syllabusCompletion: numOf(json['syllabusCompletion'])?.toDouble() ?? 0.0,
        atRiskStudents: json['atRiskStudents'] as int? ?? 0,
        classes: classes,
      );
    }).toList();
  }

  @override
  Future<List<HodTeacherSummary>> getDepartmentTeachers() async {
    final list = await _getList('/hod/teachers');
    return list.cast<Map<String, dynamic>>().map((json) {
      return HodTeacherSummary(
        id: json['id'] as String? ?? '',
        name: _buildName(json),
        subjects: json['subjects'] as String? ?? '',
        onTimeRate: numOf(json['onTimeRate'])?.toDouble() ?? 0.0,
        averageScore: numOf(json['averageScore'])?.toDouble() ?? 0.0,
        syllabusCompletion: numOf(json['syllabusCompletion'])?.toDouble() ?? 0.0,
      );
    }).toList();
  }

  // ─── Alerts ───────────────────────────────────────────────────────────────

  @override
  Future<List<HodDepartmentAlert>> getDepartmentAlerts() async {
    final list = await _getList('/hod/performance');
    return list.cast<Map<String, dynamic>>().map((json) {
      return HodDepartmentAlert(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        subject: json['subjectName'] as String? ?? json['subject'] as String? ?? '',
        classLabel: json['classLabel'] as String? ?? '',
        message: json['message'] as String? ?? '',
        severity: _parseAlertSeverity(json['severity'] as String? ?? ''),
        studentId: json['studentId'] as String?,
        isEscalated: json['isEscalated'] as bool? ?? false,
      );
    }).toList();
  }

  HodAlertSeverity _parseAlertSeverity(String raw) {
    switch (raw.toUpperCase()) {
      case 'LOW':
        return HodAlertSeverity.low;
      case 'HIGH':
        return HodAlertSeverity.high;
      case 'CRITICAL':
        return HodAlertSeverity.critical;
      default:
        return HodAlertSeverity.medium;
    }
  }

  @override
  Future<void> escalateAlert(String alertId, String note) async {
    final opts = await _auth();
    await _dio.patch<void>(
      '/students/performance/alerts/$alertId/escalate',
      data: {'note': note},
      options: opts,
    );
  }

  // ─── Pairings ─────────────────────────────────────────────────────────────

  @override
  Future<List<HodPairingSummary>> getPairings() async {
    final pairingList = await _getList('/academics/performance/pairings');
    return pairingList.cast<Map<String, dynamic>>().map((json) {
      return HodPairingSummary(
        id: json['id'] as String? ?? '',
        subject: json['subjectName'] as String? ?? '',
        classLabel: json['classLabel'] as String? ?? '',
        count: json['count'] as int? ?? 1,
        status: json['status'] as String? ?? 'SUGGESTED',
      );
    }).toList();
  }

  @override
  Future<void> activatePairing(String pairingId) async {
    final opts = await _auth();
    await _dio.patch<void>(
      '/academics/performance/pairings/$pairingId/activate',
      options: opts,
    );
  }

  // ─── Interventions ────────────────────────────────────────────────────────

  @override
  Future<List<HodIntervention>> getInterventions() async {
    final list = await _getList('/hod/interventions');
    return list.cast<Map<String, dynamic>>().map((json) {
      return HodIntervention(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? json['studentName'] as String? ?? '',
        teacherName: json['teacherName'] as String? ??
            _buildNameFromNested(json['performedBy'] as Map<String, dynamic>?, null),
        type: json['type'] as String? ?? '',
        note: json['note'] as String? ?? json['notes'] as String? ?? '',
        timeAgo: json['timeAgo'] as String? ?? json['createdAt'] as String? ?? '',
        followedUp: json['followedUp'] as bool? ?? json['isFollowedUp'] as bool? ?? false,
      );
    }).toList();
  }

  @override
  Future<void> createIntervention(Map<String, dynamic> data) async {
    await _dio.post<void>(
      '/academics/interventions',
      data: data,
      options: idempotentWrite(),
    );
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async {
    final list = await _getList('/hod/announcements');
    return list.cast<Map<String, dynamic>>().map(AnnouncementModel.fromJson).toList();
  }

  @override
  Future<void> createAnnouncement(Map<String, dynamic> data) async {
    // Persists to the same endpoint the web dashboard uses.
    await _dio.post<void>(
      '/notifications/announcements',
      data: data,
      options: idempotentWrite(),
    );
  }
}
