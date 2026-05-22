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

  String get firstName => name.split(' ').first;
  bool get isFullyPaid => outstandingBalance <= 0;
}
