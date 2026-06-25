class ChildSummary {
  const ChildSummary({
    required this.id,
    required this.name,
    required this.registrationNumber,
    required this.classLabel,
    required this.academicYear,
    required this.overallScore,
    required this.overallGrade,
    required this.attendanceRate,
    required this.outstandingBalance,
    required this.currentTermId,
    this.educationStage,
    this.combinationCode,
  });

  final String id;
  final String name;
  final String registrationNumber;
  final String classLabel;
  final String academicYear;
  final double overallScore;
  final String overallGrade;
  final double attendanceRate;
  final double outstandingBalance;
  final String currentTermId;
  final String? educationStage;
  final String? combinationCode;

  factory ChildSummary.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'] as Map<String, dynamic>? ?? json;
    final performance = json['performance'] as Map<String, dynamic>?;
    final attendanceSummary = json['attendanceSummary'] as Map<String, dynamic>?;
    final invoices = json['invoices'] as List<dynamic>?;

    final outstandingBalance = invoices != null
        ? invoices.fold<double>(0.0, (sum, inv) {
            final m = inv as Map<String, dynamic>;
            return sum + (double.tryParse((m['outstandingBalance'] ?? '0').toString()) ?? 0.0);
          })
        : (json['outstandingBalance'] as num?)?.toDouble() ?? 0.0;

    return ChildSummary(
      id: profile['id'] as String? ?? '',
      name: profile['name'] as String? ?? '',
      registrationNumber: profile['registrationNumber'] as String? ?? profile['regNumber'] as String? ?? '',
      classLabel: (profile['class'] as Map<String, dynamic>?)?['name'] as String? ?? profile['classLabel'] as String? ?? '',
      academicYear: (profile['academicYear'] as Map<String, dynamic>?)?['name'] as String? ?? profile['academicYear'] as String? ?? '',
      overallScore: (performance?['overallScore'] as num?)?.toDouble() ?? (json['overallScore'] as num?)?.toDouble() ?? 0.0,
      overallGrade: performance?['overallGrade'] as String? ?? json['overallGrade'] as String? ?? '',
      attendanceRate: (attendanceSummary?['attendanceRate'] as num?)?.toDouble() ?? (json['attendanceRate'] as num?)?.toDouble() ?? 0.0,
      outstandingBalance: outstandingBalance,
      currentTermId: profile['currentTermId'] as String? ?? json['currentTermId'] as String? ?? '',
      educationStage: profile['educationStage'] as String? ?? json['educationStage'] as String?,
      combinationCode: profile['combinationCode'] as String? ?? json['combinationCode'] as String?,
    );
  }

  String get firstName => name.split(' ').first;
  bool get isFullyPaid => outstandingBalance <= 0;
  String get stageLabel {
    switch (educationStage) {
      case 'PRIMARY':
        return 'Primary';
      case 'A_LEVEL':
        return combinationCode == null ? 'A-Level' : 'A-Level $combinationCode';
      case 'O_LEVEL':
        return 'O-Level';
      default:
        return classLabel;
    }
  }
}
