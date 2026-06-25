import 'subject_result_model.dart';

class TermResultModel {
  const TermResultModel({
    required this.id,
    required this.label,
    required this.academicYear,
    required this.subjects,
    required this.overallScore,
    required this.overallGrade,
    required this.rank,
    required this.totalStudents,
    required this.isCurrent,
  });

  final String id;
  final String label;
  final String academicYear;
  final List<SubjectResultModel> subjects;
  final double overallScore;
  final String overallGrade;
  final int rank;
  final int totalStudents;
  final bool isCurrent;

  /// Construct from backend data assembled by the API service.
  /// [term] is a Term object from /students/terms (with academicYear included).
  /// [results] is a list of TermResult rows from /academics/results for this termId.
  /// [reportCard] is the ReportCard object for this student+term (nullable).
  static TermResultModel fromComponents({
    required Map<String, dynamic> term,
    required List<Map<String, dynamic>> results,
    Map<String, dynamic>? reportCard,
  }) {
    final subjects = results
        .map((r) => SubjectResultModel.fromJson(r))
        .toList();

    final double overallScore = reportCard != null
        ? (reportCard['overallAverage'] as num?)?.toDouble() ?? _avgScore(subjects)
        : _avgScore(subjects);

    final String overallGrade = reportCard != null
        ? (reportCard['overallGrade'] as String? ?? '')
        : _gradeFromScore(overallScore);

    final int rank = reportCard != null ? (reportCard['rank'] as int? ?? 0) : 0;
    final int totalStudents = reportCard != null
        ? (reportCard['totalStudentsInClass'] as int? ?? 0)
        : (results.isNotEmpty ? (results.first['totalStudentsInClass'] as int? ?? 0) : 0);

    final academicYear = (term['academicYear'] as Map<String, dynamic>?)?['name'] as String?
        ?? term['academicYearName'] as String?
        ?? '';

    return TermResultModel(
      id: term['id'] as String? ?? '',
      label: term['name'] as String? ?? '',
      academicYear: academicYear,
      subjects: subjects,
      overallScore: overallScore,
      overallGrade: overallGrade,
      rank: rank,
      totalStudents: totalStudents,
      isCurrent: term['isCurrent'] as bool? ?? false,
    );
  }

  static double _avgScore(List<SubjectResultModel> subjects) {
    if (subjects.isEmpty) return 0.0;
    return subjects.map((s) => s.score).reduce((a, b) => a + b) / subjects.length;
  }

  static String _gradeFromScore(double score) {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }
}
