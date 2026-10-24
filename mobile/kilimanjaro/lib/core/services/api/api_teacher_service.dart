import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/announcement_model.dart';
import '../../../models/teacher_models.dart';
import '../../network/api_client.dart';
import '../../network/api_failure.dart';
import '../interfaces/teacher_service_interface.dart';
import '../../../models/json_num.dart';

String _buildName(Map<String, dynamic> json) {
  final first = json['firstName'] as String? ?? '';
  final last = json['lastName'] as String? ?? '';
  final combined = '$first $last'.trim();
  return combined.isNotEmpty
      ? combined
      : (json['name'] as String? ?? json['fullName'] as String? ?? '');
}

class ApiTeacherService implements ITeacherService {
  ApiTeacherService(this._storage)
      : _dio = buildApiClient(_storage, pathPrefix: '/api/v1');

  final FlutterSecureStorage _storage;
  final Dio _dio;

  Future<Options> _auth() async {
    final token = await _storage.read(key: 'access_token');
    return Options(
      headers: token != null ? {'Authorization': 'Bearer $token'} : {},
    );
  }

  /// Fetches a list, unwrapping the common `{items|data|results|raw: [...]}`
  /// envelopes. Failures throw a typed [ApiFailure] so the UI can distinguish
  /// "no data" from "could not load" — they are never swallowed into `[]`.
  Future<List<dynamic>> _getList(String path, {Map<String, dynamic>? params}) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>(path, queryParameters: params, options: opts);
      if (resp.data is List) return resp.data as List<dynamic>;
      if (resp.data is Map) {
        final m = resp.data as Map<String, dynamic>;
        for (final key in ['items', 'data', 'results', 'rows', 'raw']) {
          if (m[key] is List) return m[key] as List<dynamic>;
        }
      }
      return const [];
    } on DioException catch (e) {
      throw ApiFailure.fromDio(e);
    }
  }

  // ─── Classes ──────────────────────────────────────────────────────────────

  @override
  Future<List<TeacherClassSubject>> getClasses() async {
    final list = await _getList('/teacher/classes');
    return list.cast<Map<String, dynamic>>().map(_classFromJson).toList();
  }

  TeacherClassSubject _classFromJson(Map<String, dynamic> json) {
    return TeacherClassSubject(
      id: json['id'] as String? ?? '',
      subject: json['subject'] as String? ?? (json['subjectName'] as String? ?? ''),
      classLabel: json['classLabel'] as String? ?? (json['class'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      studentCount: numOf(json['studentCount'])?.toInt() ?? 0,
      averageScore: numOf(json['averageScore'])?.toDouble() ?? 0.0,
      attendanceRate: numOf(json['attendanceRate'])?.toDouble() ?? 0.0,
      nextLesson: json['nextLesson'] as String? ?? '',
    );
  }

  @override
  Future<List<TeacherStudent>> getStudentsForClass(String classSubjectId) async {
    final list = await _getList('/teacher/class-subjects/$classSubjectId/students');
    return list.cast<Map<String, dynamic>>().map(_studentFromJson).toList();
  }

  TeacherStudent _studentFromJson(Map<String, dynamic> json) {
    return TeacherStudent(
      id: json['id'] as String? ?? '',
      name: _buildName(json),
      registrationNumber: json['registrationNumber'] as String? ?? '',
      classLabel: json['classLabel'] as String? ?? (json['class'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      averageScore: numOf(json['averageScore'])?.toDouble() ?? 0.0,
      attendanceRate: numOf(json['attendanceRate'])?.toDouble() ?? 0.0,
      currentMark: numOf(json['currentMark'])?.toDouble(),
    );
  }

  // ─── Assessments ──────────────────────────────────────────────────────────

  @override
  Future<List<TeacherAssessment>> getAssessments({String? classSubjectId}) async {
    final params = classSubjectId != null ? {'classSubjectId': classSubjectId} : null;
    final list = await _getList('/teacher/assessments', params: params);
    return list.cast<Map<String, dynamic>>().map(_assessmentFromJson).toList();
  }

  TeacherAssessment _assessmentFromJson(Map<String, dynamic> json) {
    return TeacherAssessment(
      id: json['id'] as String? ?? '',
      classSubjectId: json['classSubjectId'] as String? ?? '',
      title: json['title'] as String? ?? json['name'] as String? ?? '',
      maxScore: numOf(json['maxScore'])?.toDouble() ?? 100.0,
      status: _parseAssessmentStatus(json['status'] as String? ?? ''),
      dueLabel: json['dueLabel'] as String? ?? json['dueDate'] as String? ?? '',
      enteredCount: numOf(json['enteredCount'])?.toInt() ?? 0,
      totalStudents: numOf(json['totalStudents'])?.toInt() ?? 0,
    );
  }

  TeacherAssessmentStatus _parseAssessmentStatus(String raw) {
    switch (raw.toUpperCase()) {
      case 'DRAFT':
        return TeacherAssessmentStatus.draft;
      case 'OPEN':
        return TeacherAssessmentStatus.open;
      case 'MARKS_ENTERED':
        return TeacherAssessmentStatus.open;
      case 'REJECTED':
        return TeacherAssessmentStatus.open;
      case 'SUBMITTED':
        return TeacherAssessmentStatus.submitted;
      case 'HOD_APPROVED':
      case 'APPROVED':
        return TeacherAssessmentStatus.approved;
      case 'LOCKED':
        return TeacherAssessmentStatus.locked;
      default:
        return TeacherAssessmentStatus.draft;
    }
  }

  @override
  Future<List<TeacherMarkEntry>> getMarkSheet(String assessmentId) async {
    final list = await _getList('/academics/assessments/$assessmentId/marks/sheet');
    return list.cast<Map<String, dynamic>>().map((json) {
      final raw = json['student'] as Map<String, dynamic>? ?? json;
      final student = {...raw, 'id': raw['id'] ?? raw['studentId'] ?? ''};
      return TeacherMarkEntry(
        student: _studentFromJson(student),
        score: numOf(json['score'])?.toDouble(),
        isAbsent: json['isAbsent'] as bool? ?? false,
      );
    }).toList();
  }

  @override
  Future<void> submitMarks(String assessmentId, List<TeacherMarkEntry> entries) async {
    final marks = entries.map((e) => {
      'studentId': e.student.id,
      'score': e.isAbsent ? null : e.score,
      'isAbsent': e.isAbsent,
    }).toList();
    // Idempotent: a retried marks submission must not double-post.
    await _dio.post<void>(
      '/academics/assessments/$assessmentId/marks/bulk',
      data: {'marks': marks},
      options: idempotentWrite(),
    );
  }

  @override
  Future<void> submitAssessmentForApproval(String assessmentId) async {
    final opts = await _auth();
    await _dio.post<void>(
      '/academics/assessments/$assessmentId/submit',
      options: opts,
    );
  }

  // ─── Attendance ───────────────────────────────────────────────────────────

  @override
  Future<List<TeacherAttendanceSession>> getAttendanceSessions() async {
    final list = await _getList('/teacher/attendance');
    return list.cast<Map<String, dynamic>>().map((json) {
      return TeacherAttendanceSession(
        id: json['id'] as String? ?? '',
        classSubjectId: json['classSubjectId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        timeLabel: json['timeLabel'] as String? ?? json['date'] as String? ?? '',
        statusLabel: json['statusLabel'] as String? ?? json['status'] as String? ?? '',
        isUrgent: json['isUrgent'] as bool? ?? false,
      );
    }).toList();
  }

  @override
  Future<void> markAttendance(String classSubjectId, DateTime date, List<Map<String, dynamic>> entries) async {
    // Idempotent: a retried attendance post for the same session must not
    // create duplicate records.
    await _dio.post<void>(
      '/teacher/attendance',
      data: {
        'classSubjectId': classSubjectId,
        'date': date.toIso8601String().split('T').first,
        'records': entries,
      },
      options: idempotentWrite(),
    );
  }

  // ─── Performance Alerts ───────────────────────────────────────────────────

  @override
  Future<List<TeacherPerformanceAlert>> getAlerts() async {
    final list = await _getList('/teacher/alerts');
    return list.cast<Map<String, dynamic>>().map((json) {
      return TeacherPerformanceAlert(
        id: json['id'] as String? ?? '',
        studentId: json['studentId'] as String? ?? '',
        studentName: json['studentName'] as String? ?? '',
        classLabel: json['classLabel'] as String? ?? '',
        subject: json['subjectName'] as String? ?? json['subject'] as String? ?? '',
        type: json['alertType'] as String? ?? json['type'] as String? ?? '',
        message: json['message'] as String? ?? '',
        severity: _parseAlertSeverity(json['severity'] as String? ?? ''),
        previousScore: numOf(json['previousScore'])?.toDouble() ?? 0.0,
        currentScore: numOf(json['currentScore'])?.toDouble() ?? 0.0,
      );
    }).toList();
  }

  TeacherAlertSeverity _parseAlertSeverity(String raw) {
    switch (raw.toUpperCase()) {
      case 'HIGH':
        return TeacherAlertSeverity.high;
      case 'CRITICAL':
        return TeacherAlertSeverity.critical;
      default:
        return TeacherAlertSeverity.medium;
    }
  }

  // ─── Pairings ─────────────────────────────────────────────────────────────

  @override
  Future<List<TeacherPairing>> getPairings() async {
    final pairingList = await _getList('/academics/performance/pairings');
    return pairingList.cast<Map<String, dynamic>>().map((json) {
      final supportStudent = json['student'] as Map<String, dynamic>? ?? {};
      final mentorStudent = json['peer'] as Map<String, dynamic>? ?? {};
      return TeacherPairing(
        id: json['id'] as String? ?? '',
        classSubjectId: json['classSubjectId'] as String? ?? '',
        subject: json['subjectName'] as String? ?? '',
        classLabel: json['classLabel'] as String? ?? '',
        supportStudent: _studentFromJson(supportStudent),
        mentorStudent: _studentFromJson(mentorStudent),
        reason: json['reason'] as String? ?? '',
        status: _parsePairingStatus(json['status'] as String? ?? ''),
      );
    }).toList();
  }

  TeacherPairingStatus _parsePairingStatus(String raw) {
    switch (raw.toUpperCase()) {
      case 'ACTIVE':
        return TeacherPairingStatus.active;
      case 'REJECTED':
        return TeacherPairingStatus.rejected;
      default:
        return TeacherPairingStatus.suggested;
    }
  }

  @override
  Future<void> activatePairing(String pairingId) async {
    final opts = await _auth();
    await _dio.patch<void>('/academics/performance/pairings/$pairingId/activate', options: opts);
  }

  @override
  Future<void> rejectPairing(String pairingId, String reason) async {
    final opts = await _auth();
    await _dio.patch<void>(
      '/academics/performance/pairings/$pairingId/reject',
      data: {'reason': reason},
      options: opts,
    );
  }

  // ─── Timetable ────────────────────────────────────────────────────────────

  @override
  Future<List<TeacherTimetableSlot>> getTimetable() async {
    final list = await _getList('/teacher/timetable');
    return list.cast<Map<String, dynamic>>().map((json) {
      return TeacherTimetableSlot(
        day: json['day'] as String? ?? '',
        time: json['time'] as String? ?? json['startTime'] as String? ?? '',
        classSubjectId: json['classSubjectId'] as String? ?? '',
        title: json['title'] as String? ?? json['subjectName'] as String? ?? '',
        room: json['room'] as String? ?? json['venue'] as String? ?? '',
      );
    }).toList();
  }

  // ─── Syllabus ─────────────────────────────────────────────────────────────

  @override
  Future<List<TeacherSyllabusProgress>> getSyllabusProgress() async {
    final list = await _getList('/teacher/syllabus');
    return list.cast<Map<String, dynamic>>().map((json) {
      return TeacherSyllabusProgress(
        classSubjectId: json['classSubjectId'] as String? ?? json['id'] as String? ?? '',
        title: json['title'] as String? ?? json['subject'] as String? ?? '',
        covered: numOf(json['covered'])?.toInt() ?? numOf(json['coveredTopics'])?.toInt() ?? 0,
        total: numOf(json['total'])?.toInt() ?? numOf(json['totalTopics'])?.toInt() ?? 0,
        nextTopic: json['nextTopic'] as String? ?? '',
      );
    }).toList();
  }

  @override
  Future<void> updateSyllabusProgress(String classSubjectId, int covered) async {
    final opts = await _auth();
    await _dio.patch<void>(
      '/teacher/syllabus/$classSubjectId',
      data: {'coveredTopics': covered},
      options: opts,
    );
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async {
    final list = await _getList('/teacher/announcements');
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

  @override
  Future<void> createIntervention(Map<String, dynamic> data) async {
    await _dio.post<void>(
      '/academics/interventions',
      data: data,
      options: idempotentWrite(),
    );
  }
}
