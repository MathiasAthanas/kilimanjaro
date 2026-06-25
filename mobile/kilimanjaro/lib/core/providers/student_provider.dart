import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/announcement_model.dart';
import '../../models/attendance_record_model.dart';
import '../../models/invoice_model.dart';
import '../../models/payment_model.dart';
import '../../models/peer_pairing_model.dart';
import '../../models/performance_snapshot_model.dart';
import '../../models/performance_trend_model.dart';
import '../../models/receipt_model.dart';
import '../../models/report_card_model.dart';
import '../../models/subject_result_model.dart';
import '../../models/term_result_model.dart';
import '../config/app_config.dart';
import '../services/api/api_student_data_service.dart';
import '../services/interfaces/student_service_interface.dart';
import '../services/mock/mock_student_data_service.dart';
import 'auth_provider.dart';

final studentServiceProvider = Provider<IStudentService>((ref) {
  if (AppConfig.useMockData) return MockStudentDataService();
  return ApiStudentDataService(ref.watch(secureStorageProvider));
});

final studentTermsProvider = FutureProvider<List<TermResultModel>>((ref) async {
  return ref.watch(studentServiceProvider).getTerms();
});

final currentStudentTermProvider = Provider<TermResultModel?>((ref) {
  final terms = ref.watch(studentTermsProvider).value ?? const <TermResultModel>[];
  return terms.where((item) => item.isCurrent).firstOrNull;
});

final selectedResultsSubjectIdProvider = StateProvider<String?>((ref) => null);

final sortedCurrentSubjectsProvider = Provider<List<SubjectResultModel>>((ref) {
  final term = ref.watch(currentStudentTermProvider);
  return _sortSubjects(term?.subjects ?? const []);
});

final sortedSubjectsForTermProvider =
    FutureProvider.family<List<SubjectResultModel>, String>((ref, termId) async {
  final term = await ref.watch(termByIdProvider(termId).future);
  return _sortSubjects(term?.subjects ?? const []);
});

final subjectByIdProvider =
    Provider.family<SubjectResultModel?, String>((ref, subjectId) {
  final terms = ref.watch(studentTermsProvider).value ?? const <TermResultModel>[];
  for (final term in terms) {
    final match = term.subjects.where((item) => item.id == subjectId).firstOrNull;
    if (match != null) return match;
  }
  return null;
});

final reportCardsProvider = FutureProvider<List<ReportCardModel>>((ref) async {
  final terms = await ref.watch(studentTermsProvider.future);
  final service = ref.watch(studentServiceProvider);
  final futures = terms.map((term) => service.getReportCard(term.id));
  return (await Future.wait(futures)).whereType<ReportCardModel>().toList();
});

final studentAttendanceProvider = FutureProvider<List<AttendanceRecordModel>>((ref) async {
  return ref.watch(studentServiceProvider).getAttendanceRecords();
});

final attendanceSummaryProvider = Provider<Map<AttendanceStatus, int>>((ref) {
  final records = ref.watch(studentAttendanceProvider).value ?? const <AttendanceRecordModel>[];
  final summary = <AttendanceStatus, int>{};
  for (final record in records) {
    summary.update(record.status, (value) => value + 1, ifAbsent: () => 1);
  }
  return summary;
});

final studentAlertsProvider = FutureProvider<List<PerformanceAlertModel>>((ref) async {
  return ref.watch(studentServiceProvider).getAlerts();
});

final primaryStudentAlertProvider = Provider<PerformanceAlertModel?>((ref) {
  final alerts = ref.watch(studentAlertsProvider).value ?? const <PerformanceAlertModel>[];
  final critical = alerts.where((item) => !item.isResolved && item.severity != PerformanceAlertSeverity.low);
  if (critical.isNotEmpty) return critical.first;
  final positive = alerts.where((item) => item.type == PerformanceAlertType.consistentExcellence);
  return positive.firstOrNull;
});

final performanceSnapshotsProvider = FutureProvider<List<PerformanceSnapshotModel>>((ref) async {
  return ref.watch(studentServiceProvider).getPerformanceSnapshots();
});

final currentInvoiceProvider = FutureProvider<InvoiceModel>((ref) async {
  return ref.watch(studentServiceProvider).getCurrentInvoice();
});

final studentPaymentsProvider = FutureProvider<List<PaymentModel>>((ref) async {
  return ref.watch(studentServiceProvider).getPayments();
});

final announcementsProvider = FutureProvider<List<AnnouncementModel>>((ref) async {
  return ref.watch(studentServiceProvider).getAnnouncements();
});

final announcementFilterProvider =
    StateProvider<AnnouncementPriority?>((ref) => null);

final filteredAnnouncementsProvider = Provider<List<AnnouncementModel>>((ref) {
  final items = ref.watch(announcementsProvider).value ?? const <AnnouncementModel>[];
  final filter = ref.watch(announcementFilterProvider);
  if (filter == null) return items;
  return items.where((item) => item.priority == filter).toList();
});

final selectedAttendanceMonthProvider =
    StateProvider<DateTime>((ref) => DateTime(2026, 3));

final selectedAttendanceDateProvider = StateProvider<DateTime?>((ref) => null);

final performanceTrendProvider =
    FutureProvider.family<PerformanceTrendModel?, String>((ref, subjectId) async {
  return ref.watch(studentServiceProvider).getPerformanceTrend(subjectId);
});

final peerPairingProvider =
    FutureProvider.family<PeerPairingModel?, String>((ref, subjectId) async {
  return ref.watch(studentServiceProvider).getPeerPairing(subjectId);
});

final receiptByIdProvider =
    FutureProvider.family<ReceiptModel?, String>((ref, receiptId) async {
  return ref.watch(studentServiceProvider).getReceipt(receiptId);
});

final termByIdProvider =
    FutureProvider.family<TermResultModel?, String>((ref, termId) async {
  return ref.watch(studentServiceProvider).getTerm(termId);
});

final reportCardByIdProvider =
    FutureProvider.family<ReportCardModel?, String>((ref, termId) async {
  return ref.watch(studentServiceProvider).getReportCard(termId);
});

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}

List<SubjectResultModel> _sortSubjects(List<SubjectResultModel> input) {
  final subjects = [...input];
  subjects.sort((a, b) {
    final passingCompare =
        a.isPassing == b.isPassing ? 0 : (a.isPassing ? 1 : -1);
    if (passingCompare != 0) return passingCompare;
    return a.score.compareTo(b.score);
  });
  return subjects;
}
