import '../../../models/announcement_model.dart';
import '../../../models/attendance_record_model.dart';
import '../../../models/invoice_model.dart';
import '../../../models/payment_model.dart';
import '../../../models/peer_pairing_model.dart';
import '../../../models/performance_snapshot_model.dart';
import '../../../models/performance_trend_model.dart';
import '../../../models/receipt_model.dart';
import '../../../models/report_card_model.dart';
import '../../../models/term_result_model.dart';

abstract interface class IStudentService {
  Future<List<TermResultModel>> getTerms();
  Future<TermResultModel?> getTerm(String termId);
  Future<ReportCardModel?> getReportCard(String termId);
  Future<List<AttendanceRecordModel>> getAttendanceRecords();
  Future<List<PerformanceAlertModel>> getAlerts();
  Future<List<PerformanceSnapshotModel>> getPerformanceSnapshots();
  Future<PerformanceTrendModel?> getPerformanceTrend(String subjectId);
  Future<PeerPairingModel?> getPeerPairing(String subjectId);
  Future<InvoiceModel> getCurrentInvoice();
  Future<List<PaymentModel>> getPayments();
  Future<ReceiptModel?> getReceipt(String receiptId);
  Future<List<AnnouncementModel>> getAnnouncements();
}
