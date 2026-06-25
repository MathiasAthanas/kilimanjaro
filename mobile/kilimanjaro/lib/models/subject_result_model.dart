class AssessmentScore {
  const AssessmentScore({
    required this.label,
    required this.score,
    required this.maxScore,
  });

  final String label;
  final double score;
  final double maxScore;

  factory AssessmentScore.fromJson(Map<String, dynamic> json) {
    return AssessmentScore(
      label: json['label'] as String? ?? '',
      score: (json['score'] as num?)?.toDouble() ?? 0.0,
      maxScore: (json['maxScore'] as num?)?.toDouble() ?? 100.0,
    );
  }
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

  factory SubjectResultModel.fromJson(Map<String, dynamic> json) {
    final rawScores = json['assessmentScores'] as List<dynamic>? ?? [];
    return SubjectResultModel(
      id: json['subjectId'] as String? ?? json['id'] as String? ?? '',
      name: json['subjectName'] as String? ?? '',
      score: (json['weightedTotal'] as num?)?.toDouble() ?? (json['score'] as num?)?.toDouble() ?? 0.0,
      grade: json['grade'] as String? ?? '',
      rank: json['rank'] as int? ?? 0,
      totalStudents: json['totalStudentsInClass'] as int? ?? json['totalStudents'] as int? ?? 0,
      assessments: rawScores
          .map((s) => AssessmentScore.fromJson(s as Map<String, dynamic>))
          .toList(),
    );
  }
}
