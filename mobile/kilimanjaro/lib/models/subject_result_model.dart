class AssessmentScore {
  const AssessmentScore({
    required this.label,
    required this.score,
    required this.maxScore,
  });

  final String label;
  final double score;
  final double maxScore;
}

class SubjectResultModel {
  const SubjectResultModel({
    required this.id,
    required this.name,
    required this.score,
    required this.grade,
    required this.rank,
    required this.totalStudents,
    required this.assessments,
  });

  final String id;
  final String name;
  final double score;
  final String grade;
  final int rank;
  final int totalStudents;
  final List<AssessmentScore> assessments;

  bool get isPassing => score >= 70;
}
