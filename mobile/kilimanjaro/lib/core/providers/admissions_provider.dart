import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../models/admissions_models.dart';
import '../services/api/api_admissions_service.dart';
import '../services/interfaces/admissions_service_interface.dart';

final admissionsServiceProvider = Provider<IAdmissionsService>((ref) {
  return ApiAdmissionsService(const FlutterSecureStorage());
});

final admissionsSummaryProvider = FutureProvider<AdmissionsSummary?>((ref) {
  return ref.watch(admissionsServiceProvider).getSummary();
});

final applicantsProvider =
    FutureProvider.family<List<AdmissionApplicant>, String?>((ref, stage) {
  return ref.watch(admissionsServiceProvider).getApplicants(stage: stage);
});

final applicantDetailProvider =
    FutureProvider.family<AdmissionApplicant?, String>((ref, id) {
  return ref.watch(admissionsServiceProvider).getApplicant(id);
});
