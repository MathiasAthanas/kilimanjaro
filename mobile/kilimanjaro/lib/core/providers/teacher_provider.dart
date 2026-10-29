import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/announcement_model.dart';
import '../../models/teacher_models.dart';
import '../services/api/api_teacher_service.dart';
import '../services/interfaces/teacher_service_interface.dart';
import 'auth_provider.dart';

// ─── Service ─────────────────────────────────────────────────────────────────

final teacherServiceProvider = Provider<ITeacherService>((ref) {
  return ApiTeacherService(ref.watch(secureStorageProvider));
});

// ─── Internal async loaders ──────────────────────────────────────────────────

final _teacherClassesLoader = FutureProvider<List<TeacherClassSubject>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getClasses();
});

final _teacherStudentsLoader =
    FutureProvider.family<List<TeacherStudent>, String>((ref, classSubjectId) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getStudentsForClass(classSubjectId);
});

final _teacherAssessmentsLoader = FutureProvider<List<TeacherAssessment>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getAssessments();
});

final _teacherAttendanceSessionsLoader =
    FutureProvider<List<TeacherAttendanceSession>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getAttendanceSessions();
});

final _teacherAlertsLoader = FutureProvider<List<TeacherPerformanceAlert>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getAlerts();
});

final _teacherPairingsLoader = FutureProvider<List<TeacherPairing>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getPairings();
});

final _teacherTimetableLoader = FutureProvider<List<TeacherTimetableSlot>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getTimetable();
});

final _teacherSyllabusLoader = FutureProvider<List<TeacherSyllabusProgress>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  return svc.getSyllabusProgress();
});

final _teacherAnnouncementsLoader = FutureProvider<List<TeacherAnnouncement>>((ref) async {
  final svc = ref.watch(teacherServiceProvider);
  final raw = await svc.getAnnouncements();
  return raw.map(_toTeacherAnnouncement).toList();
});

TeacherAnnouncement _toTeacherAnnouncement(AnnouncementModel a) {
  return TeacherAnnouncement(
    id: a.id,
    title: a.title,
    body: a.body,
    target: a.authorRole,
    dateLabel: '${a.publishedAt.day}/${a.publishedAt.month}/${a.publishedAt.year}',
  );
}

// ─── Public providers (same names screens use) ───────────────────────────────

final teacherClassesProvider = Provider<List<TeacherClassSubject>>((ref) {
  return ref.watch(_teacherClassesLoader).valueOrNull
      ?? const [];
});

final teacherClassByIdProvider = Provider.family<TeacherClassSubject?, String>((ref, id) {
  return ref.watch(teacherClassesProvider).where((c) => c.id == id).firstOrNull;
});

final teacherStudentsForClassProvider =
    Provider.family<List<TeacherStudent>, String>((ref, classSubjectId) {
  return ref.watch(_teacherStudentsLoader(classSubjectId)).valueOrNull
      ?? const [];
});

final teacherStudentByIdProvider = Provider.family<TeacherStudent?, String>((ref, studentId) {
  for (final cls in ref.watch(teacherClassesProvider)) {
    final match = ref.watch(teacherStudentsForClassProvider(cls.id))
        .where((s) => s.id == studentId)
        .firstOrNull;
    if (match != null) return match;
  }
  return null;
});

final teacherAssessmentsProvider = Provider<List<TeacherAssessment>>((ref) {
  return ref.watch(_teacherAssessmentsLoader).valueOrNull
      ?? const [];
});

final teacherAssessmentByIdProvider =
    Provider.family<TeacherAssessment?, String>((ref, assessmentId) {
  return ref.watch(teacherAssessmentsProvider)
      .where((a) => a.id == assessmentId)
      .firstOrNull;
});

// ─── Marks controller ─────────────────────────────────────────────────────────

class TeacherMarksController
    extends StateNotifier<Map<String, List<TeacherMarkEntry>>> {
  TeacherMarksController(this._service)
      : super(const {});

  final ITeacherService? _service;

  /// Load mark sheet from API for the given assessment (no-op if already loaded).
  Future<void> loadSheet(String assessmentId) async {
    if (_service == null || state.containsKey(assessmentId)) return;
    // _service is promoted to non-null after the null check above
    final sheet = await _service.getMarkSheet(assessmentId);
    state = {...state, assessmentId: sheet};
  }

  /// Submit marks then send the assessment for HOD approval.
  Future<void> submitSheet(String assessmentId) async {
    if (_service == null) return;
    await _service.submitMarks(assessmentId, state[assessmentId] ?? []);
    await _service.submitAssessmentForApproval(assessmentId);
  }

  void updateScore(String assessmentId, String studentId, double? score) {
    final rows = [...?state[assessmentId]];
    final index = rows.indexWhere((r) => r.student.id == studentId);
    if (index < 0) return;
    rows[index] = rows[index].copyWith(score: score, isAbsent: false);
    state = {...state, assessmentId: rows};
  }

  void markAbsent(String assessmentId, String studentId) {
    final rows = [...?state[assessmentId]];
    final index = rows.indexWhere((r) => r.student.id == studentId);
    if (index < 0) return;
    rows[index] = rows[index].copyWith(isAbsent: true, clearScore: true);
    state = {...state, assessmentId: rows};
  }
}

final teacherMarksControllerProvider =
    StateNotifierProvider<TeacherMarksController, Map<String, List<TeacherMarkEntry>>>((ref) {
  return TeacherMarksController(ref.watch(teacherServiceProvider));
});

// ─── Attendance ────────────────────────────────────────────────────────────────

final teacherAttendanceSessionsProvider =
    Provider<List<TeacherAttendanceSession>>((ref) {
  return ref.watch(_teacherAttendanceSessionsLoader).valueOrNull
      ?? const [];
});

class TeacherAttendanceController
    extends StateNotifier<Map<String, Map<String, TeacherAttendanceStatus?>>> {
  TeacherAttendanceController(this._service) : super(const {});

  final ITeacherService? _service;

  /// Load the student roster for a session from the API (no-op if already loaded).
  Future<void> loadSession(String sessionId, String classSubjectId) async {
    if (_service == null || state.containsKey(sessionId)) return;
    final students = await _service.getStudentsForClass(classSubjectId);
    state = {
      ...state,
      sessionId: {for (final s in students) s.id: s.todayStatus},
    };
  }

  /// Submit attendance records to the API.
  Future<void> submitAttendance(String sessionId, String classSubjectId) async {
    if (_service == null) return;
    final sessionState = state[sessionId] ?? {};
    final entries = sessionState.entries
        .map((e) => {
              'studentId': e.key,
              'status': e.value == null ? 'PRESENT' : e.value!.name.toUpperCase(),
            })
        .toList();
    await _service.markAttendance(classSubjectId, DateTime.now(), entries);
  }

  void setStatus(String sessionId, String studentId, TeacherAttendanceStatus status) {
    state = {
      ...state,
      sessionId: {...?state[sessionId], studentId: status},
    };
  }
}

/// Re-fetches today's attendance sessions (e.g. after a class register is saved).
void refreshTeacherAttendanceSessions(WidgetRef ref) {
  ref.invalidate(_teacherAttendanceSessionsLoader);
}

final teacherAttendanceControllerProvider =
    StateNotifierProvider<
      TeacherAttendanceController,
      Map<String, Map<String, TeacherAttendanceStatus?>>
    >((ref) {
  return TeacherAttendanceController(ref.watch(teacherServiceProvider));
});

// ─── Alerts, pairings, timetable, syllabus, announcements ─────────────────────

final teacherAlertsProvider = Provider<List<TeacherPerformanceAlert>>((ref) {
  return ref.watch(_teacherAlertsLoader).valueOrNull
      ?? const [];
});

final teacherAlertByIdProvider =
    Provider.family<TeacherPerformanceAlert?, String>((ref, id) {
  return ref.watch(teacherAlertsProvider).where((a) => a.id == id).firstOrNull;
});

final teacherPairingsProvider = Provider<List<TeacherPairing>>((ref) {
  return ref.watch(_teacherPairingsLoader).valueOrNull
      ?? const [];
});

final teacherPairingByIdProvider = Provider.family<TeacherPairing?, String>((ref, id) {
  return ref.watch(teacherPairingsProvider).where((p) => p.id == id).firstOrNull;
});

final teacherTimetableProvider = Provider<List<TeacherTimetableSlot>>((ref) {
  return ref.watch(_teacherTimetableLoader).valueOrNull
      ?? const [];
});

final teacherSyllabusProvider = Provider<List<TeacherSyllabusProgress>>((ref) {
  return ref.watch(_teacherSyllabusLoader).valueOrNull
      ?? const [];
});

final teacherAnnouncementsProvider = Provider<List<TeacherAnnouncement>>((ref) {
  return ref.watch(_teacherAnnouncementsLoader).valueOrNull
      ?? const [];
});

final teacherHighPerformersProvider =
    Provider.family<List<TeacherStudent>, String>((ref, classSubjectId) {
  final students = ref.watch(teacherStudentsForClassProvider(classSubjectId));
  return [...students]..sort((a, b) => b.averageScore.compareTo(a.averageScore));
});
