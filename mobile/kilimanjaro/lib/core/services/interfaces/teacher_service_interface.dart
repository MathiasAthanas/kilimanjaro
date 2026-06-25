import '../../../models/announcement_model.dart';
import '../../../models/teacher_models.dart';

abstract interface class ITeacherService {
  Future<List<TeacherClassSubject>> getClasses();
  Future<List<TeacherStudent>> getStudentsForClass(String classSubjectId);
  Future<List<TeacherAssessment>> getAssessments({String? classSubjectId});
  Future<List<TeacherMarkEntry>> getMarkSheet(String assessmentId);
  Future<void> submitMarks(String assessmentId, List<TeacherMarkEntry> entries);
  Future<void> submitAssessmentForApproval(String assessmentId);
  Future<List<TeacherAttendanceSession>> getAttendanceSessions();
  Future<void> markAttendance(String classSubjectId, DateTime date, List<Map<String, dynamic>> entries);
  Future<List<TeacherPerformanceAlert>> getAlerts();
  Future<List<TeacherPairing>> getPairings();
  Future<void> activatePairing(String pairingId);
  Future<void> rejectPairing(String pairingId, String reason);
  Future<List<TeacherTimetableSlot>> getTimetable();
  Future<List<TeacherSyllabusProgress>> getSyllabusProgress();
  Future<void> updateSyllabusProgress(String classSubjectId, int covered);
  Future<List<AnnouncementModel>> getAnnouncements();
}
