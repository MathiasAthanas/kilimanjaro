import '../../../models/announcement_model.dart';
import '../../../models/attendance_record_model.dart';
import '../../../models/child_summary_model.dart';
import '../../../models/contact_model.dart';
import '../../../models/invoice_model.dart';
import '../../../models/performance_snapshot_model.dart';
import '../../../models/performance_trend_model.dart';
import '../../../models/receipt_model.dart';
import '../../../models/report_card_model.dart';
import '../../../models/subject_result_model.dart';
import '../../../models/term_result_model.dart';
import '../interfaces/parent_service_interface.dart';
import 'mock_student_data_service.dart';

class MockParentDataService implements IParentService {
  MockParentDataService() : _studentService = MockStudentDataService();

  static const aminaId = 'child-amina';
  static const jabirId = 'child-jabir';

  final MockStudentDataService _studentService;

  static const _children = <ChildSummary>[
    ChildSummary(
      id: aminaId,
      name: 'Amina Baraka Juma',
      registrationNumber: 'KS-2024-00142',
      classLabel: 'Form 3A',
      academicYear: '2025/2026',
      overallScore: 79.3,
      overallGrade: 'B',
      attendanceRate: 89.6,
      outstandingBalance: 190000,
      currentTermId: 'term-2025-t1',
    ),
    ChildSummary(
      id: jabirId,
      name: 'Jabir Baraka Hassan',
      registrationNumber: 'KS-2025-00089',
      classLabel: 'Form 1B',
      academicYear: '2025/2026',
      overallScore: 70.6,
      overallGrade: 'B-',
      attendanceRate: 94.0,
      outstandingBalance: 0,
      currentTermId: 'term-2026-t1-jabir',
    ),
  ];

  static final _jabirTerms = <TermResultModel>[
    TermResultModel(
      id: 'term-2026-t1-jabir',
      label: 'Term 1',
      academicYear: '2025/2026',
      overallScore: 70.6,
      overallGrade: 'B-',
      rank: 14,
      totalStudents: 38,
      isCurrent: true,
      subjects: const [
        SubjectResultModel(
          id: 'jabir-mathematics',
          name: 'Mathematics',
          score: 72,
          grade: 'B-',
          rank: 13,
          totalStudents: 38,
          assessments: [
            AssessmentScore(label: 'CAT 1', score: 70, maxScore: 100),
            AssessmentScore(label: 'MID', score: 74, maxScore: 100),
            AssessmentScore(label: 'FINAL', score: 72, maxScore: 100),
          ],
        ),
        SubjectResultModel(
          id: 'jabir-english',
          name: 'English',
          score: 68,
          grade: 'C+',
          rank: 17,
          totalStudents: 38,
          assessments: [
            AssessmentScore(label: 'CAT 1', score: 66, maxScore: 100),
            AssessmentScore(label: 'MID', score: 70, maxScore: 100),
            AssessmentScore(label: 'FINAL', score: 68, maxScore: 100),
          ],
        ),
        SubjectResultModel(
          id: 'jabir-kiswahili',
          name: 'Kiswahili',
          score: 80,
          grade: 'B+',
          rank: 8,
          totalStudents: 38,
          assessments: [
            AssessmentScore(label: 'CAT 1', score: 78, maxScore: 100),
            AssessmentScore(label: 'MID', score: 82, maxScore: 100),
            AssessmentScore(label: 'FINAL', score: 80, maxScore: 100),
          ],
        ),
        SubjectResultModel(
          id: 'jabir-science',
          name: 'Science',
          score: 55,
          grade: 'D',
          rank: 28,
          totalStudents: 38,
          assessments: [
            AssessmentScore(label: 'CAT 1', score: 58, maxScore: 100),
            AssessmentScore(label: 'MID', score: 51, maxScore: 100),
            AssessmentScore(label: 'FINAL', score: 56, maxScore: 100),
          ],
        ),
        SubjectResultModel(
          id: 'jabir-social-studies',
          name: 'Social Studies',
          score: 78,
          grade: 'B',
          rank: 10,
          totalStudents: 38,
          assessments: [
            AssessmentScore(label: 'CAT 1', score: 75, maxScore: 100),
            AssessmentScore(label: 'MID', score: 79, maxScore: 100),
            AssessmentScore(label: 'FINAL', score: 80, maxScore: 100),
          ],
        ),
      ],
    ),
  ];

  static final _jabirReportCard = ReportCardModel(
    termId: 'term-2026-t1-jabir',
    title: 'Term 1 2025/2026',
    classLabel: 'Form 1',
    stream: 'B',
    overallScore: 70.6,
    overallGrade: 'B-',
    rank: 14,
    totalStudents: 38,
    teacherRemark: const ReportCardRemark(
      author: 'Mr. Emmanuel Kimaro',
      role: 'Form Teacher',
      message:
          'Jabir has settled well into Form 1. Science needs more attention, but his consistency in Kiswahili and Social Studies is encouraging.',
    ),
    principalRemark: const ReportCardRemark(
      author: 'Mr. David Mwasimba',
      role: 'Principal',
      message:
          'A promising first term. Please support regular revision in Science while maintaining the strong attendance record.',
    ),
  );

  static final _jabirAttendance = _buildAttendance(
    presentCount: 38,
    absentDates: {DateTime(2026, 2, 19), DateTime(2026, 3, 5)},
    lateDates: {},
  );

  static final _aminaAlerts = <PerformanceAlertModel>[
    const PerformanceAlertModel(
      id: 'parent-amina-biology',
      subjectId: MockStudentDataService.biologyId,
      subjectName: 'Biology',
      type: PerformanceAlertType.atRisk,
      severity: PerformanceAlertSeverity.high,
      title: 'Biology needs attention',
      message: 'Amina may need extra help with Biology this term.',
      isResolved: false,
    ),
    const PerformanceAlertModel(
      id: 'parent-amina-ict',
      subjectId: MockStudentDataService.ictId,
      subjectName: 'Information Technology',
      type: PerformanceAlertType.consistentExcellence,
      severity: PerformanceAlertSeverity.low,
      title: 'ICT excellence',
      message: 'Amina is consistently excelling in Information Technology.',
      isResolved: false,
    ),
    const PerformanceAlertModel(
      id: 'parent-amina-chemistry',
      subjectId: MockStudentDataService.chemistryId,
      subjectName: 'Chemistry',
      type: PerformanceAlertType.suddenDecline,
      severity: PerformanceAlertSeverity.low,
      title: 'Chemistry recovered',
      message: 'Chemistry score has recovered.',
      isResolved: true,
    ),
  ];

  static final _jabirAlerts = <PerformanceAlertModel>[];

  static final _jabirInvoice = InvoiceModel(
    id: 'INV-2026-T1-00089',
    title: 'Term 1 2025/2026 Invoice',
    issueDate: DateTime(2026, 1, 10),
    dueDate: DateTime(2026, 2, 2),
    totalAmount: 280000,
    paidAmount: 280000,
    outstandingAmount: 0,
    status: 'PAID',
    items: const [
      InvoiceLineItem(label: 'Tuition Fee', amount: 250000, status: 'PAID'),
      InvoiceLineItem(label: 'Activity Fee', amount: 20000, status: 'PAID'),
      InvoiceLineItem(label: 'Uniform Support', amount: 10000, status: 'PAID'),
    ],
  );

  static final _allReceipts = <ReceiptModel>[
    ReceiptModel(
      id: 'RCP-2026-00312',
      invoiceId: 'INV-2026-T1-00142',
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
    ReceiptModel(
      id: 'RCP-2025-00401',
      invoiceId: 'INV-2026-T1-00089',
      amount: 280000,
      method: 'Bank Transfer',
      reference: 'BTF_20260202_401',
      date: DateTime(2026, 2, 2),
      issuedBy: 'Ms. Grace Temba (Finance Officer)',
    ),
  ];

  static final _announcements = <AnnouncementModel>[
    AnnouncementModel(
      id: 'ann-urgent-exams',
      title: 'End of Term Exams Begin Monday 28 April',
      body:
          'All students are reminded that end of term examinations begin on Monday 28 April. Ensure exam cards are cleared and revision plans are finalized over the weekend.',
      priority: AnnouncementPriority.urgent,
      authorName: 'David Mwasimba',
      authorRole: 'Principal',
      publishedAt: DateTime(2026, 3, 19),
      attachment: const AnnouncementAttachment(
        name: 'Exam Timetable.pdf',
        sizeLabel: '248 KB',
      ),
    ),
    AnnouncementModel(
      id: 'ann-science-exhibition',
      title: 'National Science Exhibition - Registration Deadline',
      body:
          'Students interested in participating in the National Science Exhibition should submit proposals to the science office before Friday.',
      priority: AnnouncementPriority.high,
      authorName: 'James Kileo',
      authorRole: 'HOD',
      publishedAt: DateTime(2026, 3, 16),
    ),
    AnnouncementModel(
      id: 'ann-library-hours',
      title: 'Library Hours Extended During Exam Period',
      body:
          'The library will remain open until 8:00 PM on weekdays throughout the exam period.',
      priority: AnnouncementPriority.normal,
      authorName: 'School Administration',
      authorRole: 'Administration',
      publishedAt: DateTime(2026, 3, 14),
    ),
    AnnouncementModel(
      id: 'ann-jabir-parents-meeting',
      title: 'Form 1 Parents Meeting - Wednesday 30 April 2026',
      body:
          'Parents and guardians of Form 1 students are invited to an orientation and progress meeting on Wednesday 30 April 2026 at 2:30 PM in the main hall.',
      priority: AnnouncementPriority.normal,
      authorName: 'Form 1 Office',
      authorRole: 'Academics',
      publishedAt: DateTime(2026, 3, 12),
    ),
  ];

  static final _contact = ContactSchoolModel(
    schoolName: 'Kilimanjaro Schools',
    address: 'Moshi, Kilimanjaro Region, Tanzania',
    openHours: 'Monday-Friday 7:30 AM - 4:30 PM',
    actions: const [
      ContactActionModel(
        type: ContactType.phone,
        label: 'Call the School',
        value: '+255 27 2751 000',
        subtitle: 'Main school line',
      ),
      ContactActionModel(
        type: ContactType.whatsapp,
        label: 'WhatsApp',
        value: '+255 712 000 001',
        subtitle: 'Quick messages - we respond within 2 hours',
      ),
      ContactActionModel(
        type: ContactType.email,
        label: 'Email Us',
        value: 'info@kilimanjaro.ac.tz',
        subtitle: 'For formal queries and documents',
      ),
      ContactActionModel(
        type: ContactType.maps,
        label: 'Get Directions',
        value: '-3.3689,37.3453',
        subtitle: 'Moshi town centre - open maps',
      ),
    ],
    teachers: const [
      TeacherContactModel(
        name: 'Mwalimu Rose Mhina',
        role: 'Class Teacher',
        subjects: 'Mathematics & Physics',
        contactValue: '+255 712 320 144',
        contactVisible: true,
      ),
      TeacherContactModel(
        name: 'Mr. Emmanuel Kimaro',
        role: 'Form 3A Class Teacher',
        subjects: 'Form 3A Class Teacher',
        contactValue: '+255 712 320 188',
        contactVisible: true,
      ),
      TeacherContactModel(
        name: 'Ms. Rehema Mtui',
        role: 'Science Teacher',
        subjects: 'Biology & Chemistry',
        contactValue: '',
        contactVisible: false,
      ),
    ],
    faqItems: const [
      FaqItemModel(
        question: 'When are results published?',
        answer:
            "Results are published at the end of each term, usually within 2 weeks of the final exam. You'll receive an SMS notification.",
      ),
      FaqItemModel(
        question: 'How do I pay school fees?',
        answer:
            "Use M-Pesa or bank transfer with your child's registration number as the reference. Contact the school for bank details.",
      ),
      FaqItemModel(
        question: 'What do I do if my child is absent?',
        answer:
            'Please send an SMS or WhatsApp message to the school on the day of absence explaining the reason.',
      ),
      FaqItemModel(
        question: 'How can I see my child\'s teacher?',
        answer:
            'You can schedule a meeting during school hours (7:30 AM-4:30 PM) or request an appointment via WhatsApp.',
      ),
    ],
    emergencyPhone: '+255 27 2751 000',
  );

  static const _classAverageMap = <String, Map<String, double>>{
    aminaId: {
      'Mathematics': 69,
      'English': 77,
      'Kiswahili': 82,
      'Biology': 71,
      'Chemistry': 63,
      'Physics': 68,
      'History': 81,
      'Geography': 72,
      'Civics': 76,
      'ICT': 86,
    },
    jabirId: {
      'Mathematics': 67,
      'English': 65,
      'Kiswahili': 73,
      'Science': 61,
      'Social Studies': 69,
    },
  };

  @override
  Future<List<ChildSummary>> getChildren() async => _children;

  @override
  Future<ChildSummary?> getChild(String childId) async {
    return _children.where((item) => item.id == childId).firstOrNull;
  }

  @override
  Future<List<TermResultModel>> getTerms(String childId) async {
    if (childId == jabirId) return _jabirTerms;
    return _studentService.getTerms();
  }

  @override
  Future<TermResultModel?> getTerm(String childId, String termId) async {
    final terms = await getTerms(childId);
    return terms.where((item) => item.id == termId).firstOrNull;
  }

  @override
  Future<ReportCardModel?> getReportCard(String childId, String termId) async {
    if (childId == jabirId) {
      return _jabirReportCard.termId == termId ? _jabirReportCard : null;
    }
    return _studentService.getReportCard(termId);
  }

  @override
  Future<List<AttendanceRecordModel>> getAttendanceRecords(String childId) async {
    if (childId == jabirId) return _jabirAttendance;
    return _studentService.getAttendanceRecords();
  }

  @override
  Future<List<PerformanceAlertModel>> getAlerts(String childId) async {
    return childId == jabirId ? _jabirAlerts : _aminaAlerts;
  }

  @override
  Future<List<PerformanceSnapshotModel>> getPerformanceSnapshots(String childId) async {
    if (childId == jabirId) {
      final current = _jabirTerms.first.subjects;
      return current
          .map(
            (subject) => PerformanceSnapshotModel(
              subjectId: subject.id,
              subjectName: subject.name,
              currentScore: subject.score,
              previousScore: subject.score - 4,
              trendDelta: 4,
              rank: subject.rank,
              totalStudents: subject.totalStudents,
            ),
          )
          .toList();
    }
    return _studentService.getPerformanceSnapshots();
  }

  @override
  Future<PerformanceTrendModel?> getPerformanceTrend(String childId, String subjectId) async {
    if (childId == jabirId) {
      final subject = _jabirTerms.first.subjects.where((item) => item.id == subjectId).firstOrNull;
      if (subject == null) return null;
      return PerformanceTrendModel(
        subjectId: subject.id,
        subjectName: subject.name,
        points: [
          PerformanceTrendPoint(label: 'T3 24/25', value: subject.score - 8, grade: subject.grade),
          PerformanceTrendPoint(label: 'T2 25/26', value: subject.score - 4, grade: subject.grade),
          PerformanceTrendPoint(label: 'T1 25/26', value: subject.score, grade: subject.grade),
        ],
      );
    }
    return _studentService.getPerformanceTrend(subjectId);
  }

  @override
  Future<InvoiceModel> getCurrentInvoice(String childId) async {
    if (childId == jabirId) return _jabirInvoice;
    return _studentService.getCurrentInvoice();
  }

  @override
  Future<InvoiceModel?> getInvoiceById(String invoiceId) async {
    if (invoiceId == _jabirInvoice.id) return _jabirInvoice;
    final aminaInvoice = await _studentService.getCurrentInvoice();
    if (aminaInvoice.id == invoiceId) return aminaInvoice;
    return null;
  }

  @override
  Future<ReceiptModel?> getReceipt(String receiptId) async {
    return _allReceipts.where((item) => item.id == receiptId).firstOrNull;
  }

  @override
  Future<List<ReceiptModel>> getReceipts() async {
    final receipts = [..._allReceipts];
    receipts.sort((a, b) => b.date.compareTo(a.date));
    return receipts;
  }

  @override
  Future<List<AnnouncementModel>> getAnnouncements() async => _announcements;

  @override
  Future<ContactSchoolModel> getContactSchool(String childId) async {
    return _contact;
  }

  @override
  Future<double> getCombinedOutstanding() async {
    return _children.fold<double>(0, (sum, item) => sum + item.outstandingBalance);
  }

  @override
  Future<Map<String, double>> getClassAverages(String childId, String termId) async {
    return _classAverageMap[childId] ?? const {};
  }

  static List<AttendanceRecordModel> _buildAttendance({
    required int presentCount,
    required Set<DateTime> absentDates,
    required Set<DateTime> lateDates,
  }) {
    final records = <AttendanceRecordModel>[];
    final today = DateTime(2026, 3, 21);
    var cursor = today;
    while (records.length < presentCount + absentDates.length + lateDates.length) {
      if (cursor.weekday <= DateTime.friday) {
        final key = DateTime(cursor.year, cursor.month, cursor.day);
        if (absentDates.contains(key)) {
          records.add(AttendanceRecordModel(date: cursor, status: AttendanceStatus.absent));
        } else if (lateDates.contains(key)) {
          records.add(AttendanceRecordModel(date: cursor, status: AttendanceStatus.late));
        } else {
          records.add(AttendanceRecordModel(date: cursor, status: AttendanceStatus.present));
        }
      }
      cursor = cursor.subtract(const Duration(days: 1));
    }
    return records..sort((a, b) => a.date.compareTo(b.date));
  }
}

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
