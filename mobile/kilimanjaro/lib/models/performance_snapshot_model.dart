enum PerformanceAlertType {
  suddenDecline,
  atRisk,
  consistentExcellence,
}

enum PerformanceAlertSeverity {
  low,
  high,
  critical,
}

class PerformanceAlertModel {
  const PerformanceAlertModel({
    required this.id,
    required this.subjectId,
    required this.subjectName,
    required this.type,
    required this.severity,
    required this.title,
    required this.message,
    required this.isResolved,
  });

  final String id;
  final String subjectId;
  final String subjectName;
  final PerformanceAlertType type;
  final PerformanceAlertSeverity severity;
  final String title;
  final String message;
  final bool isResolved;
}

class PerformanceSnapshotModel {
  const PerformanceSnapshotModel({
    required this.subjectId,
    required this.subjectName,
    required this.currentScore,
    required this.previousScore,
    required this.trendDelta,
    required this.rank,
    required this.totalStudents,
  });

  final String subjectId;
  final String subjectName;
  final double currentScore;
  final double previousScore;
  final double trendDelta;
  final int rank;
  final int totalStudents;
}
