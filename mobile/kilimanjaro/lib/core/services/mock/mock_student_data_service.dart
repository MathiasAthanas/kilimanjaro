import '../../../models/announcement_model.dart';
import '../../../models/attendance_record_model.dart';
import '../../../models/invoice_model.dart';
import '../../../models/payment_model.dart';
import '../../../models/peer_pairing_model.dart';
import '../../../models/performance_snapshot_model.dart';
import '../../../models/performance_trend_model.dart';
import '../../../models/receipt_model.dart';
import '../../../models/report_card_model.dart';
import '../../../models/subject_result_model.dart';
import '../../../models/term_result_model.dart';
import '../interfaces/student_service_interface.dart';

class MockStudentDataService implements IStudentService {
  static const mathsId = '6f58ff6e-83b9-4fe0-a819-5cfec7e8c5a1';
  static const englishId = 'c4887bd1-7d35-4d33-b0d2-772eea51f36d';
  static const kiswahiliId = '8ecaa7a4-ab5c-49ff-a6ab-57bc65d7f0a8';
  static const biologyId = '2a8add00-ef43-42f8-a674-e9f1361bcb9e';
  static const chemistryId = 'd47ddd11-b6a8-4f2d-8f92-8f1b67dad23f';
  static const physicsId = '59ae09ca-b75f-4c9c-afd5-888f8377eafd';
  static const historyId = '3535a3d8-520e-4e04-a7de-0895d353de00';
  static const geographyId = 'f3ece2aa-452f-41a2-bf40-6f330a3d3550';
  static const civicsId = '12958f56-b3d6-4486-a8fc-33b41473c722';
  static const ictId = '2ee7193e-9d83-41df-a0d4-f432601e5e0a';

  static final _terms = <TermResultModel>[
    TermResultModel(
      id: 'term-2025-t1',
      label: 'Term 1',
      academicYear: '2025/2026',
      overallScore: 79.3,
      overallGrade: 'B',
      rank: 6,
      totalStudents: 42,
      isCurrent: true,
      subjects: [
        _subject(mathsId, 'Mathematics', 78, 'B', 8, 42, [82, 75, 72, 80]),
        _subject(englishId, 'English', 85, 'A-', 4, 42, [88, 82, 84, 86]),
        _subject(kiswahiliId, 'Kiswahili', 91, 'A', 2, 42, [93, 89, 90, 92]),
        _subject(biologyId, 'Biology', 65, 'C', 18, 42, [70, 62, 60, 68]),
        _subject(chemistryId, 'Chemistry', 58, 'D', 28, 42, [62, 55, 55, 60]),
        _subject(physicsId, 'Physics', 72, 'B-', 12, 42, [75, 68, 70, 74]),
        _subject(historyId, 'History', 88, 'A', 3, 42, [90, 86, 88, 88]),
        _subject(geographyId, 'Geography', 79, 'B', 7, 42, [80, 76, 78, 82]),
        _subject(civicsId, 'Civics', 83, 'A-', 5, 42, [85, 80, 82, 85]),
        _subject(ictId, 'ICT', 94, 'A+', 1, 42, [96, 92, 93, 95]),
      ],
    ),
    TermResultModel(
      id: 'term-2024-t2',
      label: 'Term 2',
      academicYear: '2024/2025',
      overallScore: 74.5,
      overallGrade: 'B-',
      rank: 8,
      totalStudents: 40,
      isCurrent: false,
      subjects: [
        _flatSubject(mathsId, 'Mathematics', 71, 'B-', 11, 40),
        _flatSubject(englishId, 'English', 80, 'B+', 6, 40),
        _flatSubject(kiswahiliId, 'Kiswahili', 88, 'A', 3, 40),
        _flatSubject(biologyId, 'Biology', 60, 'C', 22, 40),
        _flatSubject(chemistryId, 'Chemistry', 52, 'D', 31, 40),
        _flatSubject(physicsId, 'Physics', 68, 'C+', 15, 40),
        _flatSubject(historyId, 'History', 84, 'A-', 5, 40),
        _flatSubject(geographyId, 'Geography', 74, 'B', 10, 40),
        _flatSubject(civicsId, 'Civics', 78, 'B+', 8, 40),
        _flatSubject(ictId, 'ICT', 90, 'A', 2, 40),
      ],
    ),
    TermResultModel(
      id: 'term-2024-t1',
      label: 'Term 1',
      academicYear: '2024/2025',
      overallScore: 70.6,
      overallGrade: 'B-',
      rank: 10,
      totalStudents: 40,
      isCurrent: false,
      subjects: [
        _flatSubject(mathsId, 'Mathematics', 68, 'C+', 14, 40),
        _flatSubject(englishId, 'English', 76, 'B', 8, 40),
        _flatSubject(kiswahiliId, 'Kiswahili', 85, 'A-', 4, 40),
        _flatSubject(biologyId, 'Biology', 55, 'D', 26, 40),
        _flatSubject(chemistryId, 'Chemistry', 48, 'F', 35, 40),
        _flatSubject(physicsId, 'Physics', 63, 'C', 18, 40),
        _flatSubject(historyId, 'History', 80, 'B+', 7, 40),
        _flatSubject(geographyId, 'Geography', 70, 'B-', 13, 40),
        _flatSubject(civicsId, 'Civics', 75, 'B', 10, 40),
        _flatSubject(ictId, 'ICT', 86, 'A', 3, 40),
      ],
    ),
  ];

  static final _reportCards = <ReportCardModel>[
    ReportCardModel(
      termId: 'term-2025-t1',
      title: 'Term 1 2025/2026',
      classLabel: 'Form 3',
      stream: 'A',
      overallScore: 79.3,
      overallGrade: 'B',
      rank: 6,
      totalStudents: 42,
      teacherRemark: const ReportCardRemark(
        author: 'Ms. Rose Mhina',
        role: 'Class Teacher',
        message: 'Amina is focused and consistent. Chemistry and Biology need extra revision, but her communication and ICT strengths are outstanding.',
      ),
      principalRemark: const ReportCardRemark(
        author: 'Mr. David Mwasimba',
        role: 'Principal',
        message: 'A positive term overall. Maintain discipline and keep pushing the sciences to match the excellence seen in ICT and Kiswahili.',
      ),
    ),
    ReportCardModel(
      termId: 'term-2024-t2',
      title: 'Term 2 2024/2025',
      classLabel: 'Form 2',
      stream: 'A',
      overallScore: 74.5,
      overallGrade: 'B-',
      rank: 8,
      totalStudents: 40,
      teacherRemark: const ReportCardRemark(
        author: 'Ms. Rose Mhina',
        role: 'Class Teacher',
        message: 'Strong upward movement. Keep working on chemistry foundations and laboratory interpretation.',
      ),
      principalRemark: const ReportCardRemark(
        author: 'Mr. David Mwasimba',
        role: 'Principal',
        message: 'Good growth. Continue balancing humanities excellence with science resilience.',
      ),
    ),
    ReportCardModel(
      termId: 'term-2024-t1',
      title: 'Term 1 2024/2025',
      classLabel: 'Form 2',
      stream: 'A',
      overallScore: 70.6,
      overallGrade: 'B-',
      rank: 10,
      totalStudents: 40,
      teacherRemark: const ReportCardRemark(
        author: 'Ms. Rose Mhina',
        role: 'Class Teacher',
        message: 'Solid base performance. Science intervention is strongly recommended this term.',
      ),
      principalRemark: const ReportCardRemark(
        author: 'Mr. David Mwasimba',
        role: 'Principal',
        message: 'A promising learner with room to improve science consistency.',
      ),
    ),
  ];

  static final _attendance = _buildAttendance();
  static final _invoice = InvoiceModel(
    id: 'INV-2026-T1-00142',
    title: 'Term 1 2025/2026 Invoice',
    issueDate: DateTime(2026, 3, 1),
    dueDate: DateTime(2026, 4, 15),
    totalAmount: 390000,
    paidAmount: 200000,
    outstandingAmount: 190000,
    status: 'PARTIALLY_PAID',
    items: const [
      InvoiceLineItem(label: 'Tuition Fee', amount: 350000, status: 'PARTIALLY_PAID'),
      InvoiceLineItem(label: 'ICT Fee', amount: 25000, status: 'ISSUED'),
      InvoiceLineItem(label: 'Library Fee', amount: 15000, status: 'ISSUED'),
    ],
  );

  static final _payments = <PaymentModel>[
    PaymentModel(
      id: 'RCP-2026-00312',
      amount: 200000,
      method: 'Mobile Money',
      date: DateTime(2026, 3, 5),
      invoiceId: _invoice.id,
    ),
    PaymentModel(
      id: 'RCP-2025-00289',
      amount: 390000,
      method: 'Bank Transfer',
      date: DateTime(2026, 1, 8),
      invoiceId: 'INV-2025-T2-00142',
    ),
    PaymentModel(
      id: 'RCP-2025-00145',
      amount: 350000,
      method: 'Cash',
      date: DateTime(2025, 9, 5),
      invoiceId: 'INV-2025-T1-00142',
    ),
  ];

  static final _receipts = <ReceiptModel>[
    ReceiptModel(
      id: 'RCP-2026-00312',
      invoiceId: _invoice.id,
      amount: 200000,
      method: 'Mobile Money (M-Pesa)',
      reference: 'MPESA_REF_ABC123',
      date: DateTime(2026, 3, 5),
      issuedBy: 'Ms. Grace Temba (Finance Officer)',
    ),
    ReceiptModel(
      id: 'RCP-2025-00289',
      invoiceId: 'INV-2025-T2-00142',
      amount: 390000,
      method: 'Bank Transfer',
      reference: 'BTF_20260108_009',
      date: DateTime(2026, 1, 8),
      issuedBy: 'Ms. Grace Temba (Finance Officer)',
    ),
    ReceiptModel(
      id: 'RCP-2025-00145',
      invoiceId: 'INV-2025-T1-00142',
      amount: 350000,
      method: 'Cash',
      reference: 'CASH_20250905_145',
      date: DateTime(2025, 9, 5),
      issuedBy: 'Ms. Grace Temba (Finance Officer)',
    ),
  ];

  static final _announcements = <AnnouncementModel>[
    AnnouncementModel(
      id: 'ann-urgent-exams',
      title: 'End of Term Exams Begin Monday 28 April',
      body: 'All students are reminded that end of term examinations begin on Monday 28 April. Ensure your exam card is cleared, stationery is ready, and revision plans are finalized over the weekend.',
      priority: AnnouncementPriority.urgent,
      authorName: 'David Mwasimba',
      authorRole: 'Principal',
      publishedAt: DateTime(2026, 3, 19),
      attachment: const AnnouncementAttachment(name: 'Exam Timetable.pdf', sizeLabel: '248 KB'),
    ),
    AnnouncementModel(
      id: 'ann-science-exhibition',
      title: 'National Science Exhibition - Registration Deadline',
      body: 'Students interested in participating in the National Science Exhibition should submit proposals to the science office before Friday. Team slots are limited.',
      priority: AnnouncementPriority.high,
      authorName: 'James Kileo',
      authorRole: 'HOD',
      publishedAt: DateTime(2026, 3, 16),
    ),
    AnnouncementModel(
      id: 'ann-library-hours',
      title: 'Library Hours Extended During Exam Period',
      body: 'The library will remain open until 8:00 PM on weekdays throughout the exam period. Group study tables and supervised silence zones are available.',
      priority: AnnouncementPriority.normal,
      authorName: 'School Administration',
      authorRole: 'Administration',
      publishedAt: DateTime(2026, 3, 14),
    ),
    AnnouncementModel(
      id: 'ann-sports-day',
      title: 'Sports Day Postponed to 15 May',
      body: 'Sports Day has been moved to 15 May due to scheduling adjustments around the examination window. Updated house training sessions will be shared shortly.',
      priority: AnnouncementPriority.normal,
      authorName: 'Student Affairs',
      authorRole: 'Administration',
      publishedAt: DateTime(2026, 3, 11),
    ),
    AnnouncementModel(
      id: 'ann-photo-day',
      title: 'School Photo Day - Wednesday 23 April',
      body: 'Class photo sessions will be held on Wednesday 23 April. Students should attend in full school uniform and report to the assembly square when called.',
      priority: AnnouncementPriority.low,
      authorName: 'Communications Office',
      authorRole: 'Administration',
      publishedAt: DateTime(2026, 3, 7),
    ),
  ];

  static final _alerts = <PerformanceAlertModel>[
    const PerformanceAlertModel(
      id: 'alert-bio-risk',
      subjectId: biologyId,
      subjectName: 'Biology',
      type: PerformanceAlertType.atRisk,
      severity: PerformanceAlertSeverity.high,
      title: 'Biology needs attention',
      message: 'You are currently at 65%. A little more revision could move you above the 70% target.',
      isResolved: false,
    ),
    const PerformanceAlertModel(
      id: 'alert-chem-recovered',
      subjectId: chemistryId,
      subjectName: 'Chemistry',
      type: PerformanceAlertType.suddenDecline,
      severity: PerformanceAlertSeverity.low,
      title: 'Chemistry is recovering',
      message: 'Your chemistry scores dipped earlier, but the latest term shows recovery to 58%. Keep building on that.',
      isResolved: true,
    ),
    const PerformanceAlertModel(
      id: 'alert-ict-excellence',
      subjectId: ictId,
      subjectName: 'ICT',
      type: PerformanceAlertType.consistentExcellence,
      severity: PerformanceAlertSeverity.low,
      title: 'ICT excellence streak',
      message: 'Excellent consistency. You have scored above 90% for three straight terms.',
      isResolved: false,
    ),
  ];

  static final _pairing = PeerPairingModel(
    subjectId: biologyId,
    subjectName: 'Biology',
    peerName: 'Brian Mwangi',
    peerRank: 1,
    peerScore: 88,
    status: 'ACTIVE',
    startedAt: DateTime(2026, 2, 28),
  );

  @override
  Future<List<TermResultModel>> getTerms() async => _terms;

  @override
  Future<TermResultModel?> getTerm(String termId) async {
    return _terms.where((item) => item.id == termId).firstOrNull;
  }

  @override
  Future<ReportCardModel?> getReportCard(String termId) async {
    return _reportCards.where((item) => item.termId == termId).firstOrNull;
  }

  @override
  Future<List<AttendanceRecordModel>> getAttendanceRecords() async => _attendance;

  @override
  Future<List<PerformanceAlertModel>> getAlerts() async => _alerts;

  @override
  Future<List<PerformanceSnapshotModel>> getPerformanceSnapshots() async {
    final current = _terms.first.subjects;
    final previous = _terms[1].subjects;
    return current.map((subject) {
      final prior = previous.where((item) => item.id == subject.id).firstOrNull;
      return PerformanceSnapshotModel(
        subjectId: subject.id,
        subjectName: subject.name,
        currentScore: subject.score,
        previousScore: prior?.score ?? subject.score,
        trendDelta: subject.score - (prior?.score ?? subject.score),
        rank: subject.rank,
        totalStudents: subject.totalStudents,
      );
    }).toList();
  }

  @override
  Future<PerformanceTrendModel?> getPerformanceTrend(String subjectId) async {
    final points = _terms
        .map((term) => term.subjects.where((subject) => subject.id == subjectId).firstOrNull)
        .whereType<SubjectResultModel>()
        .toList()
        .reversed
        .map((subject) {
      final term = _terms
          .where((item) => item.subjects.any((s) => s.id == subject.id))
          .firstOrNull;
      if (term == null) {
        return PerformanceTrendPoint(
          label: 'Unknown',
          value: subject.score,
          grade: subject.grade,
        );
      }
      return PerformanceTrendPoint(
        label: '${term.label.replaceAll('Term ', 'T')} ${term.academicYear.substring(2)}',
        value: subject.score,
        grade: subject.grade,
      );
    }).toList();
    if (points.isEmpty) return null;
    final subjectName =
        _terms.first.subjects.where((item) => item.id == subjectId).firstOrNull?.name ??
            'Subject';
    return PerformanceTrendModel(subjectId: subjectId, subjectName: subjectName, points: points);
  }

  @override
  Future<PeerPairingModel?> getPeerPairing(String subjectId) async {
    return _pairing.subjectId == subjectId ? _pairing : null;
  }

  @override
  Future<InvoiceModel> getCurrentInvoice() async => _invoice;

  @override
  Future<List<PaymentModel>> getPayments() async => _payments;

  @override
  Future<ReceiptModel?> getReceipt(String receiptId) async {
    return _receipts.where((item) => item.id == receiptId).firstOrNull;
  }

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async => _announcements;

  static SubjectResultModel _subject(
    String id,
    String name,
    double score,
    String grade,
    int rank,
    int totalStudents,
    List<double> marks,
  ) {
    return SubjectResultModel(
      id: id,
      name: name,
      score: score,
      grade: grade,
      rank: rank,
      totalStudents: totalStudents,
      assessments: [
        AssessmentScore(label: 'CAT 1', score: marks[0], maxScore: 100),
        AssessmentScore(label: 'CAT 2', score: marks[1], maxScore: 100),
        AssessmentScore(label: 'MID', score: marks[2], maxScore: 100),
        AssessmentScore(label: 'FINAL', score: marks[3], maxScore: 100),
      ],
    );
  }

  static SubjectResultModel _flatSubject(
    String id,
    String name,
    double score,
    String grade,
    int rank,
    int totalStudents,
  ) {
    return SubjectResultModel(
      id: id,
      name: name,
      score: score,
      grade: grade,
      rank: rank,
      totalStudents: totalStudents,
      assessments: const [],
    );
  }

  static List<AttendanceRecordModel> _buildAttendance() {
    final records = <AttendanceRecordModel>[];
    final today = DateTime(2026, 3, 21);
    var cursor = today;
    while (records.length < 48) {
      if (cursor.weekday <= DateTime.friday) {
        records.add(AttendanceRecordModel(date: cursor, status: AttendanceStatus.present));
      }
      cursor = cursor.subtract(const Duration(days: 1));
    }
    final absentDates = {
      DateTime(2026, 3, 4),
      DateTime(2026, 3, 6),
      DateTime(2026, 3, 12),
    };
    final lateDates = {
      DateTime(2026, 2, 23),
      DateTime(2026, 3, 9),
    };
    return records.map((record) {
      final key = DateTime(record.date.year, record.date.month, record.date.day);
      if (absentDates.contains(key)) {
        return AttendanceRecordModel(date: record.date, status: AttendanceStatus.absent);
      }
      if (lateDates.contains(key)) {
        return AttendanceRecordModel(date: record.date, status: AttendanceStatus.late);
      }
      return record;
    }).toList()..sort((a, b) => a.date.compareTo(b.date));
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
