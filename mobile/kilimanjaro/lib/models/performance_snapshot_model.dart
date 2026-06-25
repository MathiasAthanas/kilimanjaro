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

  factory PerformanceAlertModel.fromJson(Map<String, dynamic> json) {
    final alertType = json['alertType'] as String? ?? json['type'] as String? ?? '';
    final severity = json['severity'] as String? ?? '';
    return PerformanceAlertModel(
      id: json['id'] as String? ?? '',
      subjectId: json['subjectId'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      type: _parseType(alertType),
      severity: _parseSeverity(severity),
      title: json['title'] as String? ?? _titleFromType(alertType),
      message: json['message'] as String? ?? '',
      isResolved: json['isResolved'] as bool? ?? false,
    );
  }

  static PerformanceAlertType _parseType(String raw) {
    switch (raw.toUpperCase()) {
      case 'SUDDEN_DECLINE':
        return PerformanceAlertType.suddenDecline;
      case 'AT_RISK':
        return PerformanceAlertType.atRisk;
      case 'CONSISTENT_EXCELLENCE':
        return PerformanceAlertType.consistentExcellence;
      default:
        return PerformanceAlertType.atRisk;
    }
  }

  static PerformanceAlertSeverity _parseSeverity(String raw) {
    switch (raw.toUpperCase()) {
      case 'LOW':
        return PerformanceAlertSeverity.low;
      case 'HIGH':
        return PerformanceAlertSeverity.high;
      case 'CRITICAL':
        return PerformanceAlertSeverity.critical;
      default:
        return PerformanceAlertSeverity.low;
    }
  }

  static String _titleFromType(String alertType) {
    switch (alertType.toUpperCase()) {
      case 'SUDDEN_DECLINE':
        return 'Sudden Decline';
      case 'AT_RISK':
        return 'At Risk';
      case 'CONSISTENT_EXCELLENCE':
        return 'Consistent Excellence';
      default:
        return 'Performance Alert';
    }
  }
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

  factory PerformanceSnapshotModel.fromJson(Map<String, dynamic> json) {
    final current = (json['currentScore'] as num?)?.toDouble() ?? (json['score'] as num?)?.toDouble() ?? 0.0;
    final previous = (json['previousScore'] as num?)?.toDouble() ?? 0.0;
    return PerformanceSnapshotModel(
      subjectId: json['subjectId'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      currentScore: current,
      previousScore: previous,
      trendDelta: (json['trendDelta'] as num?)?.toDouble() ?? (current - previous),
      rank: json['rank'] as int? ?? 0,
      totalStudents: json['totalStudentsInClass'] as int? ?? json['totalStudents'] as int? ?? 0,
    );
  }
}
