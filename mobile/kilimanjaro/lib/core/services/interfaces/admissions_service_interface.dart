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
}
