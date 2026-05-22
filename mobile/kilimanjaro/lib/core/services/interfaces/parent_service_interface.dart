import '../../../models/announcement_model.dart';
import '../../../models/attendance_record_model.dart';
import '../../../models/child_summary_model.dart';
import '../../../models/contact_model.dart';
import '../../../models/invoice_model.dart';
import '../../../models/performance_snapshot_model.dart';
import '../../../models/performance_trend_model.dart';
import '../../../models/receipt_model.dart';
import '../../../models/report_card_model.dart';
import '../../../models/term_result_model.dart';

abstract class IParentService {
  Future<List<ChildSummary>> getChildren();
  Future<ChildSummary?> getChild(String childId);
  Future<List<TermResultModel>> getTerms(String childId);
  Future<TermResultModel?> getTerm(String childId, String termId);
  Future<ReportCardModel?> getReportCard(String childId, String termId);
  Future<List<AttendanceRecordModel>> getAttendanceRecords(String childId);
  Future<List<PerformanceAlertModel>> getAlerts(String childId);
  Future<List<PerformanceSnapshotModel>> getPerformanceSnapshots(String childId);
  Future<PerformanceTrendModel?> getPerformanceTrend(String childId, String subjectId);
  Future<InvoiceModel> getCurrentInvoice(String childId);
  Future<InvoiceModel?> getInvoiceById(String invoiceId);
  Future<ReceiptModel?> getReceipt(String receiptId);
  Future<List<ReceiptModel>> getReceipts();
  Future<List<AnnouncementModel>> getAnnouncements();
  Future<ContactSchoolModel> getContactSchool(String childId);
  Future<double> getCombinedOutstanding();
  Future<Map<String, double>> getClassAverages(String childId, String termId);
}
