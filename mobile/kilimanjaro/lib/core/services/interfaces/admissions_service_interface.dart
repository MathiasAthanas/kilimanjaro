import '../../../models/admissions_models.dart';

abstract interface class IAdmissionsService {
  Future<AdmissionsSummary?> getSummary();

  Future<List<AdmissionApplicant>> getApplicants({String? stage, String? search});

  Future<AdmissionApplicant?> getApplicant(String id);

  Future<AdmissionApplicant?> createInquiry(NewInquiryInput input);

  Future<AdmissionApplicant?> transitionStage({
    required String applicantId,
    required String toStage,
    String? note,
  });

  /// Update applicant details (partial). Maps to PATCH /admissions/applicants/:id.
  Future<AdmissionApplicant?> updateApplicant(
    String applicantId,
    Map<String, dynamic> changes,
  );

  /// Schedule an entrance assessment / interview.
  Future<AdmissionApplicant?> scheduleAssessment({
    required String applicantId,
    required DateTime scheduledAt,
    String? subjectFocus,
    double? maxScore,
    String? notes,
  });

  /// Record an assessment score / outcome.
  Future<AdmissionApplicant?> recordAssessment({
    required String assessmentId,
    double? score,
    String? outcome,
    String? notes,
  });

  /// Issue (or re-issue) an admission offer.
  Future<AdmissionApplicant?> issueOffer({
    required String applicantId,
    required String classId,
    double? feeExpectation,
    DateTime? expiresAt,
    String? note,
  });

  /// Record the guardian decision on an offer (ACCEPTED / DECLINED).
  Future<AdmissionApplicant?> decideOffer({
    required String applicantId,
    required String decision,
    String? note,
  });

  /// Convert an accepted applicant into an enrolled student. Idempotent on the
  /// server so an applicant cannot be converted twice.
  Future<AdmissionApplicant?> convert({
    required String applicantId,
    DateTime? admissionDate,
  });
}
