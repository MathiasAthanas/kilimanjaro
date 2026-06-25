class PerformanceTrendPoint {
  const PerformanceTrendPoint({
    required this.label,
    required this.value,
    required this.grade,
  });

  final String label;
  final double value;
  final String grade;

  factory PerformanceTrendPoint.fromJson(Map<String, dynamic> json) {
    return PerformanceTrendPoint(
      label: json['label'] as String? ?? json['termName'] as String? ?? '',
      value: (json['value'] as num?)?.toDouble() ?? (json['score'] as num?)?.toDouble() ?? 0.0,
      grade: json['grade'] as String? ?? '',
    );
  }
}

class PerformanceTrendModel {
  const PerformanceTrendModel({
    required this.subjectId,
    required this.subjectName,
    required this.points,
  });

  final String subjectId;
  final String subjectName;
  final List<PerformanceTrendPoint> points;

  factory PerformanceTrendModel.fromJson(Map<String, dynamic> json) {
    final rawPoints = json['points'] as List<dynamic>? ?? json['history'] as List<dynamic>? ?? [];
    return PerformanceTrendModel(
      subjectId: json['subjectId'] as String? ?? '',
      subjectName: json['subjectName'] as String? ?? '',
      points: rawPoints
          .map((p) => PerformanceTrendPoint.fromJson(p as Map<String, dynamic>))
          .toList(),
    );
  }
}
