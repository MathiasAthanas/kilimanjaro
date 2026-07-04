import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/announcement_model.dart';
import '../../../models/teacher_models.dart';
import '../../config/app_config.dart';
import '../interfaces/teacher_service_interface.dart';

String _buildName(Map<String, dynamic> json) {
  final first = json['firstName'] as String? ?? '';
  final last = json['lastName'] as String? ?? '';
  final combined = '$first $last'.trim();
  return combined.isNotEmpty
      ? combined
      : (json['name'] as String? ?? json['fullName'] as String? ?? '');
}

class ApiTeacherService implements ITeacherService {
  ApiTeacherService(this._storage) : _dio = _buildDio();

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

  Future<List<dynamic>> _getList(String path, {Map<String, dynamic>? params}) async {
    final opts = await _auth();
    try {
      final resp = await _dio.get<dynamic>(path, queryParameters: params, options: opts);
      if (resp.data is List) return resp.data as List<dynamic>;
      if (resp.data is Map) {
        final m = resp.data as Map<String, dynamic>;
        for (final key in ['items', 'data', 'results', 'raw']) {
          if (m[key] is List) return m[key] as List<dynamic>;
        }
      }
    } on DioException {
      return [];
    }
    return [];
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
      studentCount: json['studentCount'] as int? ?? 0,
      averageScore: (json['averageScore'] as num?)?.toDouble() ?? 0.0,
      attendanceRate: (json['attendanceRate'] as num?)?.toDouble() ?? 0.0,
      nextLesson: json['nextLesson'] as String? ?? '',
    );
  }

  @override
  Future<List<TeacherStudent>> getStudentsForClass(String classSubjectId) async {
    final list = await _getList('/students/classes/$classSubjectId/students');
    return list.cast<Map<String, dynamic>>().map(_studentFromJson).toList();
  }

  TeacherStudent _studentFromJson(Map<String, dynamic> json) {
    return TeacherStudent(
      id: json['id'] as String? ?? '',
      name: _buildName(json),
      registrationNumber: json['registrationNumber'] as String? ?? '',
      classLabel: json['classLabel'] as String? ?? (json['class'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      averageScore: (json['averageScore'] as num?)?.toDouble() ?? 0.0,
      attendanceRate: (json['attendanceRate'] as num?)?.toDouble() ?? 0.0,
      currentMark: (json['currentMark'] as num?)?.toDouble(),
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
      maxScore: (json['maxScore'] as num?)?.toDouble() ?? 100.0,
      status: _parseAssessmentStatus(json['status'] as String? ?? ''),
      dueLabel: json['dueLabel'] as String? ?? json['dueDate'] as String? ?? '',
      enteredCount: json['enteredCount'] as int? ?? 0,
      totalStudents: json['totalStudents'] as int? ?? 0,
    );
  }

  TeacherAssessmentStatus _parseAssessmentStatus(String raw) {
    switch (raw.toUpperCase()) {
      case 'DRAFT':
        return TeacherAssessmentStatus.draft;
      case 'OPEN':
        return TeacherAssessmentStatus.open;
      case 'SUBMITTED':
        return TeacherAssessmentStatus.submitted;
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
      final student = json['student'] as Map<String, dynamic>? ?? json;
      return TeacherMarkEntry(
        student: _studentFromJson(student),
        score: (json['score'] as num?)?.toDouble(),
        isAbsent: json['isAbsent'] as bool? ?? false,
      );
    }).toList();
  }

  @override
  Future<void> submitMarks(String assessmentId, List<TeacherMarkEntry> entries) async {
    final opts = await _auth();
    final marks = entries.map((e) => {
      'studentId': e.student.id,
      'score': e.isAbsent ? null : e.score,
      'isAbsent': e.isAbsent,
    }).toList();
    await _dio.post<void>(
      '/academics/assessments/$assessmentId/marks/bulk',
      data: {'marks': marks},
      options: opts,
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
    final opts = await _auth();
    await _dio.post<void>(
      '/students/attendance',
      data: {
        'classSubjectId': classSubjectId,
        'date': date.toIso8601String().split('T').first,
        'records': entries,
      },
      options: opts,
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
        previousScore: (json['previousScore'] as num?)?.toDouble() ?? 0.0,
        currentScore: (json['currentScore'] as num?)?.toDouble() ?? 0.0,
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
        covered: json['covered'] as int? ?? json['completedTopics'] as int? ?? 0,
        total: json['total'] as int? ?? json['totalTopics'] as int? ?? 0,
        nextTopic: json['nextTopic'] as String? ?? '',
      );
    }).toList();
  }

  @override
  Future<void> updateSyllabusProgress(String classSubjectId, int covered) async {
    final opts = await _auth();
    await _dio.patch<void>(
      '/academics/syllabus/$classSubjectId',
      data: {'completedTopics': covered},
      options: opts,
    );
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async {
    final list = await _getList('/teacher/announcements');
    return list.cast<Map<String, dynamic>>().map(AnnouncementModel.fromJson).toList();
  }
}
