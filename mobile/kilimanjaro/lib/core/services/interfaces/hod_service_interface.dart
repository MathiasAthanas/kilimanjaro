import '../../../models/announcement_model.dart';
import '../../../models/hod_models.dart';

abstract interface class IHodService {
  Future<List<HodApproval>> getPendingApprovals();
  Future<List<HodApproval>> getApprovalHistory();
  Future<void> approveAssessment(String assessmentId);
  Future<void> rejectAssessment(String assessmentId, String reason);
  Future<List<HodSubjectAnalytics>> getDepartmentSubjects();
  Future<List<HodTeacherSummary>> getDepartmentTeachers();
  Future<List<HodDepartmentAlert>> getDepartmentAlerts();
  Future<void> escalateAlert(String alertId, String note);
  Future<List<HodPairingSummary>> getPairings();
  Future<void> activatePairing(String pairingId);
  Future<List<HodIntervention>> getInterventions();
  Future<void> createIntervention(Map<String, dynamic> data);
  Future<List<AnnouncementModel>> getAnnouncements();
}
