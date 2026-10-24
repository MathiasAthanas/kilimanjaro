import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/hod_models.dart';
import '../services/api/api_hod_service.dart';
import '../services/interfaces/hod_service_interface.dart';
import 'auth_provider.dart';

// ─── Service ──────────────────────────────────────────────────────────────────

final hodServiceProvider = Provider<IHodService>((ref) {
  return ApiHodService(ref.watch(secureStorageProvider));
});

// ─── Internal async loaders (subjects + teachers + approval history) ──────────

final _hodApprovalHistoryLoader = FutureProvider<List<HodApproval>>((ref) async {
  final svc = ref.watch(hodServiceProvider);
  return svc.getApprovalHistory();
});

final _hodSubjectsLoader = FutureProvider<List<HodSubjectAnalytics>>((ref) async {
  final svc = ref.watch(hodServiceProvider);
  return svc.getDepartmentSubjects();
});

final _hodTeachersLoader = FutureProvider<List<HodTeacherSummary>>((ref) async {
  final svc = ref.watch(hodServiceProvider);
  return svc.getDepartmentTeachers();
});

// ─── Approvals controller ─────────────────────────────────────────────────────

class HodApprovalsController extends StateNotifier<List<HodApproval>> {
  HodApprovalsController(this._service)
      : super(const []) {
    _loadFromApi();
  }

  final IHodService? _service;

  Future<void> _loadFromApi() async {
    final items = await _service?.getPendingApprovals() ?? [];
    state = items;
  }

  void approve(String id) {
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(status: HodApprovalStatus.approved) else item,
    ];
    _service?.approveAssessment(id);
  }

  void reject(String id, String reason) {
    state = [
      for (final item in state)
        if (item.id == id)
          item.copyWith(status: HodApprovalStatus.rejected, rejectionReason: reason)
        else
          item,
    ];
    _service?.rejectAssessment(id, reason);
  }
}

final hodApprovalsControllerProvider =
    StateNotifierProvider<HodApprovalsController, List<HodApproval>>(
  (ref) => HodApprovalsController(ref.watch(hodServiceProvider)),
);

final hodPendingApprovalsProvider = Provider<List<HodApproval>>((ref) {
  return ref
      .watch(hodApprovalsControllerProvider)
      .where((item) => item.status == HodApprovalStatus.pending)
      .toList();
});

final hodApprovalHistoryProvider = Provider<List<HodApproval>>((ref) {
  final actioned = ref
      .watch(hodApprovalsControllerProvider)
      .where((item) => item.status != HodApprovalStatus.pending)
      .toList();
  final serverHistory = ref.watch(_hodApprovalHistoryLoader).valueOrNull
      ?? const [];
  return [...actioned, ...serverHistory];
});

final hodApprovalByIdProvider = Provider.family<HodApproval?, String>((ref, id) {
  return ref.watch(hodApprovalsControllerProvider).where((item) => item.id == id).firstOrNull;
});

/// The marks sheet (student by student) of an assessment waiting for review.
final hodAssessmentMarksProvider = FutureProvider.family<List<HodMarkRow>, String>((ref, id) {
  return ref.watch(hodServiceProvider).getAssessmentMarks(id);
});

// ─── Subjects & teachers ──────────────────────────────────────────────────────

final hodSubjectsProvider = Provider<List<HodSubjectAnalytics>>((ref) {
  return ref.watch(_hodSubjectsLoader).valueOrNull
      ?? const [];
});

final hodSubjectByIdProvider = Provider.family<HodSubjectAnalytics?, String>((ref, id) {
  return ref.watch(hodSubjectsProvider).where((s) => s.id == id).firstOrNull;
});

final hodTeachersProvider = Provider<List<HodTeacherSummary>>((ref) {
  return ref.watch(_hodTeachersLoader).valueOrNull
      ?? const [];
});

final hodTeacherByIdProvider = Provider.family<HodTeacherSummary?, String>((ref, id) {
  return ref.watch(hodTeachersProvider).where((t) => t.id == id).firstOrNull;
});

// ─── Alerts controller ────────────────────────────────────────────────────────

class HodAlertsController extends StateNotifier<List<HodDepartmentAlert>> {
  HodAlertsController(this._service)
      : super(const []) {
    _loadFromApi();
  }

  final IHodService? _service;

  Future<void> _loadFromApi() async {
    final items = await _service?.getDepartmentAlerts() ?? [];
    state = items;
  }

  /// Sends the escalation first; the alert only shows as escalated once the server accepted it.
  Future<void> escalate(String id) async {
    await _service?.escalateAlert(id, '');
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(isEscalated: true) else item,
    ];
  }
}

final hodAlertsControllerProvider =
    StateNotifierProvider<HodAlertsController, List<HodDepartmentAlert>>(
  (ref) => HodAlertsController(ref.watch(hodServiceProvider)),
);

final hodAlertsProvider = Provider<List<HodDepartmentAlert>>(
  (ref) => ref.watch(hodAlertsControllerProvider),
);

// ─── Pairings controller ──────────────────────────────────────────────────────

class HodPairingsController extends StateNotifier<List<HodPairingSummary>> {
  HodPairingsController(this._service)
      : super(const []) {
    _loadFromApi();
  }

  final IHodService? _service;

  Future<void> _loadFromApi() async {
    final items = await _service?.getPairings() ?? [];
    state = items;
  }

  void activatePairings(List<String> ids) {
    state = [
      for (final item in state)
        if (ids.contains(item.id)) item.copyWith(status: 'ACTIVE') else item,
    ];
    for (final id in ids) {
      _service?.activatePairing(id);
    }
  }
}

final hodPairingsControllerProvider =
    StateNotifierProvider<HodPairingsController, List<HodPairingSummary>>(
  (ref) => HodPairingsController(ref.watch(hodServiceProvider)),
);

final hodPairingsProvider = Provider<List<HodPairingSummary>>(
  (ref) => ref.watch(hodPairingsControllerProvider),
);

// ─── Interventions controller ──────────────────────────────────────────────────

class HodInterventionsController extends StateNotifier<List<HodIntervention>> {
  HodInterventionsController(this._service)
      : super(const []) {
    _loadFromApi();
  }

  final IHodService? _service;

  Future<void> _loadFromApi() async {
    final items = await _service?.getInterventions() ?? [];
    state = items;
  }

  void markFollowedUp(String id) {
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(followedUp: true) else item,
    ];
  }
}

final hodInterventionsControllerProvider =
    StateNotifierProvider<HodInterventionsController, List<HodIntervention>>(
  (ref) => HodInterventionsController(ref.watch(hodServiceProvider)),
);

final hodInterventionsProvider = Provider<List<HodIntervention>>(
  (ref) => ref.watch(hodInterventionsControllerProvider),
);
