class PerformanceTrendPoint {
  const PerformanceTrendPoint({
    required this.label,
    required this.value,
    required this.grade,
  });

  final String label;
  final double value;
  final String grade;
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
}
