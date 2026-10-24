import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/elearning_models.dart';
import '../../network/api_client.dart';

/// Dio-based service that calls the elearning-service through the API gateway.
class ElearningApiService {
  ElearningApiService(this._storage)
      : _dio = buildApiClient(_storage, pathPrefix: '/elearning');

  final FlutterSecureStorage _storage;
  final Dio _dio;

  Future<Options> _authOptions() async {
    final token = await _storage.read(key: 'access_token');
    return Options(headers: token != null ? {'Authorization': 'Bearer $token'} : {});
  }

  // ─── Courses ─────────────────────────────────────────────────────────────

  Future<List<ElearningCourseModel>> listCourses({
    String? status,
    String? educationStage,
    int? classLevel,
    String? combinationId,
  }) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses',
      queryParameters: {
        if (status != null) 'status': status,
        if (educationStage != null) 'educationStage': educationStage,
        if (classLevel != null) 'classLevel': classLevel,
        if (combinationId != null) 'combinationId': combinationId,
      },
      options: opts,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) => ElearningCourseModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ElearningCourseModel> getCourse(String courseId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>('/courses/$courseId', options: opts);
    return ElearningCourseModel.fromJson(resp.data as Map<String, dynamic>);
  }

  // ─── Lessons ─────────────────────────────────────────────────────────────

  Future<List<ElearningLessonModel>> listLessons(String courseId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>('/courses/$courseId/lessons', options: opts);
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) => ElearningLessonModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Materials ───────────────────────────────────────────────────────────

  Future<List<ElearningMaterialModel>> listMaterials(
      String courseId, String lessonId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/lessons/$lessonId/materials',
      options: opts,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) => ElearningMaterialModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> viewMaterial(String materialId) async {
    final opts = await _authOptions();
    await _dio.post<dynamic>('/materials/$materialId/view', options: opts);
  }

  Future<Map<String, dynamic>> downloadMaterial(String materialId) async {
    final opts = await _authOptions();
    final resp =
        await _dio.get<dynamic>('/materials/$materialId/download', options: opts);
    return resp.data as Map<String, dynamic>;
  }

  // ─── Assignments ─────────────────────────────────────────────────────────

  Future<List<ElearningAssignmentModel>> listAssignments(String courseId) async {
    final opts = await _authOptions();
    final resp =
        await _dio.get<dynamic>('/courses/$courseId/assignments', options: opts);
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) =>
            ElearningAssignmentModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ElearningAssignmentModel> getAssignment(
      String courseId, String assignmentId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/assignments/$assignmentId',
      options: opts,
    );
    return ElearningAssignmentModel.fromJson(
        resp.data as Map<String, dynamic>);
  }

  /// Fetch an assignment directly by its ID (no courseId needed).
  Future<ElearningAssignmentModel> getAssignmentById(String assignmentId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>('/assignments/$assignmentId', options: opts);
    return ElearningAssignmentModel.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<ElearningSubmissionModel?> mySubmission(String assignmentId) async {
    final opts = await _authOptions();
    try {
      final resp = await _dio.get<dynamic>(
        '/assignments/$assignmentId/my-submission',
        options: opts,
      );
      if (resp.data == null) return null;
      return ElearningSubmissionModel.fromJson(
          resp.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<ElearningSubmissionModel> upsertSubmission(
      String assignmentId, Map<String, dynamic> body) async {
    final opts = await _authOptions();
    final resp = await _dio.post<dynamic>(
      '/assignments/$assignmentId/submissions',
      data: body,
      options: opts,
    );
    return ElearningSubmissionModel.fromJson(
        resp.data as Map<String, dynamic>);
  }

  Future<List<ElearningSubmissionModel>> mySubmissions(String courseId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/my-submissions',
      options: opts,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) =>
            ElearningSubmissionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Quizzes ─────────────────────────────────────────────────────────────

  Future<List<ElearningQuizModel>> listQuizzes(String courseId) async {
    final opts = await _authOptions();
    final resp =
        await _dio.get<dynamic>('/courses/$courseId/quizzes', options: opts);
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) => ElearningQuizModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ElearningQuizModel> getQuiz(String courseId, String quizId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/quizzes/$quizId',
      options: opts,
    );
    return ElearningQuizModel.fromJson(resp.data as Map<String, dynamic>);
  }

  /// Fetch a quiz directly by its ID (no courseId needed).
  Future<ElearningQuizModel> getQuizById(String quizId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>('/quizzes/$quizId', options: opts);
    return ElearningQuizModel.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<ElearningQuizAttemptModel> startAttempt(String quizId) async {
    final opts = await _authOptions();
    final resp = await _dio.post<dynamic>(
      '/quizzes/$quizId/attempts/start',
      options: opts,
    );
    return ElearningQuizAttemptModel.fromJson(
        resp.data as Map<String, dynamic>);
  }

  Future<ElearningQuizAttemptModel?> activeAttempt(String quizId) async {
    final opts = await _authOptions();
    try {
      final resp = await _dio.get<dynamic>(
        '/quizzes/$quizId/attempts/active',
        options: opts,
      );
      return ElearningQuizAttemptModel.fromJson(
          resp.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<void> saveAnswer(
      String attemptId, String questionId, Map<String, dynamic> body) async {
    final opts = await _authOptions();
    await _dio.patch<dynamic>(
      '/attempts/$attemptId/answer',
      data: {'questionId': questionId, ...body},
      options: opts,
    );
  }

  Future<ElearningQuizAttemptModel> submitAttempt(String attemptId) async {
    final opts = await _authOptions();
    final resp = await _dio.patch<dynamic>(
      '/attempts/$attemptId/submit',
      options: opts,
    );
    return ElearningQuizAttemptModel.fromJson(
        resp.data as Map<String, dynamic>);
  }

  Future<List<ElearningQuizAttemptModel>> myAttempts(String quizId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/quizzes/$quizId/my-attempts',
      options: opts,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) =>
            ElearningQuizAttemptModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Progress ────────────────────────────────────────────────────────────

  Future<ElearningProgressModel> myProgress(String courseId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/my-progress',
      options: opts,
    );
    return ElearningProgressModel.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<ElearningStudentSummaryModel> studentSummary() async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/analytics/student/summary',
      options: opts,
    );
    return ElearningStudentSummaryModel.fromJson(
        resp.data as Map<String, dynamic>);
  }

  // ─── Announcements ───────────────────────────────────────────────────────

  Future<List<ElearningAnnouncementModel>> listAnnouncements(
      String courseId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/announcements',
      options: opts,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) =>
            ElearningAnnouncementModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  // ─── Discussions ─────────────────────────────────────────────────────────

  Future<List<ElearningDiscussionModel>> listDiscussions(
      String courseId) async {
    final opts = await _authOptions();
    final resp = await _dio.get<dynamic>(
      '/courses/$courseId/discussions',
      options: opts,
    );
    final list = resp.data as List<dynamic>? ?? [];
    return list
        .map((e) =>
            ElearningDiscussionModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ElearningDiscussionModel> createDiscussion(
      String courseId, String title, String body) async {
    final opts = await _authOptions();
    final resp = await _dio.post<dynamic>(
      '/courses/$courseId/discussions',
      data: {'title': title, 'body': body},
      options: opts,
    );
    return ElearningDiscussionModel.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<ElearningDiscussionModel> getDiscussion(String threadId) async {
    final opts = await _authOptions();
    final resp =
        await _dio.get<dynamic>('/discussions/$threadId', options: opts);
    return ElearningDiscussionModel.fromJson(
        resp.data as Map<String, dynamic>);
  }

  Future<ElearningReplyModel> addReply(
      String threadId, String body) async {
    final opts = await _authOptions();
    final resp = await _dio.post<dynamic>(
      '/discussions/$threadId/replies',
      data: {'body': body},
      options: opts,
    );
    return ElearningReplyModel.fromJson(resp.data as Map<String, dynamic>);
  }

  // ─── Teaching (staff) ───────────────────────────────────────────────────

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    final opts = await _authOptions();
    final resp = await _dio.request<dynamic>(
      path,
      data: body,
      options: opts.copyWith(method: method),
    );
    return resp.data;
  }

  Map<String, dynamic> _map(dynamic v) =>
      v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

  List<Map<String, dynamic>> _maps(dynamic v) => v is List
      ? v.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList()
      : <Map<String, dynamic>>[];

  Future<Map<String, dynamic>> reviewDesk() async =>
      _map(await _send('GET', '/teacher/review-desk'));

  Future<Map<String, dynamic>> parentLearningSummary(String childId) async =>
      _map(await _send('GET', '/parent/$childId/learning-summary'));

  Future<void> publishCourse(String courseId) async =>
      _send('PATCH', '/courses/$courseId/publish');

  Future<Map<String, dynamic>> createLesson(
          String courseId, Map<String, dynamic> body) async =>
      _map(await _send('POST', '/courses/$courseId/lessons', body));

  Future<void> publishLesson(String courseId, String lessonId) async =>
      _send('PATCH', '/courses/$courseId/lessons/$lessonId/publish');

  Future<Map<String, dynamic>> createMaterial(
          String courseId, String lessonId, Map<String, dynamic> body) async =>
      _map(await _send(
          'POST', '/courses/$courseId/lessons/$lessonId/materials', body));

  Future<Map<String, dynamic>> createAssignment(
          String courseId, Map<String, dynamic> body) async =>
      _map(await _send('POST', '/courses/$courseId/assignments', body));

  Future<void> publishAssignment(String courseId, String id) async =>
      _send('PATCH', '/courses/$courseId/assignments/$id/publish');

  Future<void> closeAssignment(String courseId, String id) async =>
      _send('PATCH', '/courses/$courseId/assignments/$id/close');

  Future<List<Map<String, dynamic>>> assignmentSubmissions(
          String courseId, String id) async =>
      _maps(await _send('GET', '/courses/$courseId/assignments/$id/submissions'));

  Future<List<Map<String, dynamic>>> missingSubmissions(
          String courseId, String id) async =>
      _maps(await _send(
          'GET', '/courses/$courseId/assignments/$id/submissions/missing'));

  Future<Map<String, dynamic>> submissionDownload(String submissionId) async =>
      _map(await _send('GET', '/submissions/$submissionId/download'));

  Future<Map<String, dynamic>> gradeSubmission(
          String submissionId, Map<String, dynamic> body) async =>
      _map(await _send('PATCH', '/submissions/$submissionId/grade', body));

  Future<Map<String, dynamic>> returnSubmission(
          String submissionId, Map<String, dynamic> body) async =>
      _map(await _send('PATCH', '/submissions/$submissionId/return', body));

  Future<Map<String, dynamic>> createQuiz(
          String courseId, Map<String, dynamic> body) async =>
      _map(await _send('POST', '/courses/$courseId/quizzes', body));

  Future<Map<String, dynamic>> addQuestion(
          String quizId, Map<String, dynamic> body) async =>
      _map(await _send('POST', '/quizzes/$quizId/questions', body));

  Future<void> deleteQuestion(String quizId, String questionId) async =>
      _send('DELETE', '/quizzes/$quizId/questions/$questionId');

  Future<void> publishQuiz(String courseId, String quizId) async =>
      _send('PATCH', '/courses/$courseId/quizzes/$quizId/publish');

  Future<void> closeQuiz(String courseId, String quizId) async =>
      _send('PATCH', '/courses/$courseId/quizzes/$quizId/close');

  Future<List<Map<String, dynamic>>> quizResults(
          String courseId, String quizId) async =>
      _maps(await _send('GET', '/courses/$courseId/quizzes/$quizId/results'));

  Future<Map<String, dynamic>> gradeShortAnswer(
          String attemptId, Map<String, dynamic> body) async =>
      _map(await _send('PATCH', '/attempts/$attemptId/grade-short-answer', body));

  Future<List<Map<String, dynamic>>> courseRoster(String courseId) async =>
      _maps(await _send('GET', '/courses/$courseId/students'));

  Future<Map<String, dynamic>> createAnnouncement(
          String courseId, Map<String, dynamic> body) async =>
      _map(await _send('POST', '/courses/$courseId/announcements', body));

  // ─── File upload ─────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> uploadFile({
    required String fileName,
    required String contentBase64,
    required String mimeType,
    String domain = 'submissions',
  }) async {
    final opts = await _authOptions();
    final resp = await _dio.post<dynamic>(
      '/uploads/local',
      data: {
        'fileName': fileName,
        'contentBase64': contentBase64,
        'mimeType': mimeType,
        'domain': domain,
      },
      options: opts,
    );
    return resp.data as Map<String, dynamic>;
  }
}
