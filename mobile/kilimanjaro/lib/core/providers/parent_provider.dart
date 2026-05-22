import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/announcement_model.dart';
import '../../models/attendance_record_model.dart';
import '../../models/child_summary_model.dart';
import '../../models/contact_model.dart';
import '../../models/invoice_model.dart';
import '../../models/performance_snapshot_model.dart';
import '../../models/performance_trend_model.dart';
import '../../models/receipt_model.dart';
import '../../models/report_card_model.dart';
import '../../models/subject_result_model.dart';
import '../../models/term_result_model.dart';
import '../services/interfaces/parent_service_interface.dart';
import '../services/mock/mock_parent_data_service.dart';

class ParentPaymentEntry {
  const ParentPaymentEntry({
    required this.receipt,
    required this.childId,
    required this.childName,
  });

  final ReceiptModel receipt;
  final String childId;
  final String childName;
}

final parentServiceProvider = Provider<IParentService>((ref) {
  return MockParentDataService();
});

final parentChildrenProvider = FutureProvider<List<ChildSummary>>((ref) async {
  return ref.watch(parentServiceProvider).getChildren();
});

final activeParentChildIdProvider =
    StateProvider<String>((ref) => MockParentDataService.aminaId);

final activeParentChildProvider = FutureProvider<ChildSummary?>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getChild(childId);
});

final parentTermsProvider =
    FutureProvider.family<List<TermResultModel>, String>((ref, childId) async {
  return ref.watch(parentServiceProvider).getTerms(childId);
});

final activeParentTermsProvider = FutureProvider<List<TermResultModel>>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getTerms(childId);
});

final activeParentTermProvider = FutureProvider<TermResultModel?>((ref) async {
  final terms = await ref.watch(activeParentTermsProvider.future);
  return terms.where((item) => item.isCurrent).firstOrNull;
});

final parentSelectedTermIdProvider = StateProvider<String?>((ref) => null);

final selectedParentTermProvider = FutureProvider<TermResultModel?>((ref) async {
  final selectedId = ref.watch(parentSelectedTermIdProvider);
  final terms = await ref.watch(activeParentTermsProvider.future);
  if (selectedId == null) return terms.where((item) => item.isCurrent).firstOrNull;
  return terms.where((item) => item.id == selectedId).firstOrNull;
});

final parentClassAveragesProvider =
    FutureProvider.family<Map<String, double>, String>((ref, termId) async {
  final childId = ref.watch(activeParentChildIdProvider);
  return ref.watch(parentServiceProvider).getClassAverages(childId, termId);
});

final parentAttendanceProvider =
    FutureProvider.family<List<AttendanceRecordModel>, String>((ref, childId) async {
  return ref.watch(parentServiceProvider).getAttendanceRecords(childId);
});

final activeParentAttendanceProvider = FutureProvider<List<AttendanceRecordModel>>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getAttendanceRecords(childId);
});

final parentAlertsProvider =
    FutureProvider.family<List<PerformanceAlertModel>, String>((ref, childId) async {
  return ref.watch(parentServiceProvider).getAlerts(childId);
});

final activeParentAlertsProvider = FutureProvider<List<PerformanceAlertModel>>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getAlerts(childId);
});

final activeParentSnapshotsProvider =
    FutureProvider<List<PerformanceSnapshotModel>>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getPerformanceSnapshots(childId);
});

final activeParentInvoiceProvider = FutureProvider<InvoiceModel>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getCurrentInvoice(childId);
});

final parentCombinedOutstandingProvider = FutureProvider<double>((ref) async {
  return ref.watch(parentServiceProvider).getCombinedOutstanding();
});

final parentReceiptsProvider = FutureProvider<List<ParentPaymentEntry>>((ref) async {
  final receipts = await ref.watch(parentServiceProvider).getReceipts();
  final children = await ref.watch(parentChildrenProvider.future);
  final amina = children.where((item) => item.id == MockParentDataService.aminaId).firstOrNull;
  final jabir = children.where((item) => item.id == MockParentDataService.jabirId).firstOrNull;
  final byInvoice = <String, ChildSummary>{
    if (amina != null) 'INV-2026-T1-00142': amina,
    if (amina != null) 'INV-2025-T2-00142': amina,
    if (amina != null) 'INV-2025-T1-00142': amina,
    if (jabir != null) 'INV-2026-T1-00089': jabir,
  };
  return receipts
      .map((item) {
        final child = byInvoice[item.invoiceId];
        if (child == null) return null;
        return ParentPaymentEntry(
          receipt: item,
          childId: child.id,
          childName: child.name,
        );
      })
      .whereType<ParentPaymentEntry>()
      .toList();
});

final parentAnnouncementsProvider = FutureProvider<List<AnnouncementModel>>((ref) async {
  return ref.watch(parentServiceProvider).getAnnouncements();
});

final parentAnnouncementFilterProvider =
    StateProvider<AnnouncementPriority?>((ref) => null);

final filteredParentAnnouncementsProvider = Provider<List<AnnouncementModel>>((ref) {
  final filter = ref.watch(parentAnnouncementFilterProvider);
  final items = ref.watch(parentAnnouncementsProvider).value ?? const <AnnouncementModel>[];
  final sorted = [...items]..sort((a, b) => a.priority.index.compareTo(b.priority.index));
  if (filter == null) return sorted;
  return sorted.where((item) => item.priority == filter).toList();
});

final parentReportCardsProvider = FutureProvider<List<ReportCardModel>>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  final terms = await ref.watch(parentServiceProvider).getTerms(childId);
  final service = ref.watch(parentServiceProvider);
  final cards = await Future.wait(
    terms.map((term) => service.getReportCard(childId, term.id)),
  );
  return cards.whereType<ReportCardModel>().toList();
});

final parentReportCardByIdProvider =
    FutureProvider.family<ReportCardModel?, String>((ref, termId) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getReportCard(childId, termId);
});

final parentTermByIdProvider =
    FutureProvider.family<TermResultModel?, String>((ref, termId) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getTerm(childId, termId);
});

final parentReceiptByIdProvider =
    FutureProvider.family<ReceiptModel?, String>((ref, receiptId) async {
  return ref.watch(parentServiceProvider).getReceipt(receiptId);
});

final parentInvoiceByIdProvider =
    FutureProvider.family<InvoiceModel?, String>((ref, invoiceId) async {
  return ref.watch(parentServiceProvider).getInvoiceById(invoiceId);
});

final parentPerformanceTrendProvider =
    FutureProvider.family<PerformanceTrendModel?, String>((ref, subjectId) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getPerformanceTrend(childId, subjectId);
});

final parentContactSchoolProvider = FutureProvider<ContactSchoolModel>((ref) async {
  final childId = ref.watch(activeParentChildIdProvider);
  await Future<void>.delayed(const Duration(milliseconds: 500));
  return ref.watch(parentServiceProvider).getContactSchool(childId);
});

final activeParentSubjectsProvider = FutureProvider<List<SubjectResultModel>>((ref) async {
  final term = await ref.watch(selectedParentTermProvider.future);
  final subjects = [...?term?.subjects];
  subjects.sort((a, b) {
    final passingCompare = a.isPassing == b.isPassing ? 0 : (a.isPassing ? 1 : -1);
    if (passingCompare != 0) return passingCompare;
    return a.score.compareTo(b.score);
  });
  return subjects;
});

final parentSubjectByIdProvider =
    FutureProvider.family<SubjectResultModel?, String>((ref, subjectId) async {
  final childId = ref.watch(activeParentChildIdProvider);
  final terms = await ref.watch(parentServiceProvider).getTerms(childId);
  for (final term in terms) {
    for (final subject in term.subjects) {
      if (subject.id == subjectId) return subject;
    }
  }
  return null;
});

final parentWeeklyAttendanceProvider =
    Provider<AsyncValue<List<ParentWeekDayStatus>>>((ref) {
  final attendance = ref.watch(activeParentAttendanceProvider);
  return attendance.whenData(_buildWeeklyStatus);
});

final parentSecondChildProvider = Provider<AsyncValue<ChildSummary?>>((ref) {
  final activeId = ref.watch(activeParentChildIdProvider);
  final children = ref.watch(parentChildrenProvider);
  return children.whenData(
    (items) => items.where((item) => item.id != activeId).firstOrNull,
  );
});

List<ParentWeekDayStatus> _buildWeeklyStatus(List<AttendanceRecordModel> records) {
  final today = DateTime(2026, 3, 21);
  final monday = DateTime(today.year, today.month, today.day)
      .subtract(Duration(days: today.weekday - DateTime.monday));
  final normalized = <DateTime, AttendanceStatus>{
    for (final record in records)
      DateTime(record.date.year, record.date.month, record.date.day): record.status,
  };

  return List.generate(7, (index) {
    final date = monday.add(Duration(days: index));
    final key = DateTime(date.year, date.month, date.day);
    final inFuture = date.isAfter(today);
    final status = normalized[key];
    return ParentWeekDayStatus(
      date: key,
      status: inFuture ? null : status,
      isFuture: inFuture,
    );
  });
}

class ParentWeekDayStatus {
  const ParentWeekDayStatus({
    required this.date,
    required this.status,
    required this.isFuture,
  });

  final DateTime date;
  final AttendanceStatus? status;
  final bool isFuture;
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
