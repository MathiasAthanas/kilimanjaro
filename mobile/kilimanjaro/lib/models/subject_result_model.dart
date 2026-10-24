import 'json_num.dart';

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
      score: numOf(json['score'])?.toDouble() ?? 0.0,
      maxScore: numOf(json['maxScore'])?.toDouble() ?? 100.0,
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
    // The backend stores scores as {label: score}; older payloads send a list.
    final rawScores = json['assessmentScores'];
    final assessments = <AssessmentScore>[];
    if (rawScores is Map) {
      rawScores.forEach((label, value) {
        final score = value is num ? value.toDouble() : double.tryParse('$value');
        if (score == null) return;
        assessments.add(AssessmentScore(label: '$label', score: score, maxScore: 100.0));
      });
    } else if (rawScores is List) {
      for (final item in rawScores) {
        if (item is Map<String, dynamic>) assessments.add(AssessmentScore.fromJson(item));
      }
    }
    return SubjectResultModel(
      id: json['subjectId'] as String? ?? json['id'] as String? ?? '',
      name: json['subjectName'] as String? ?? '',
      score: numOf(json['weightedTotal'])?.toDouble() ?? numOf(json['score'])?.toDouble() ?? 0.0,
      grade: json['grade'] as String? ?? '',
      rank: numOf(json['rank'])?.toInt() ?? 0,
      totalStudents: numOf(json['totalStudentsInClass'])?.toInt() ?? numOf(json['totalStudents'])?.toInt() ?? 0,
      assessments: assessments,
    );
  }
}
