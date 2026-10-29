import 'subject_result_model.dart';
import 'json_num.dart';

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
    this.startDate,
  });

  final String id;
  final String label;
  final String academicYear;

  /// "Term 2 · 2026", or just "Term 2" when the year is unknown.
  String get title => academicYear.isEmpty ? label : '$label · $academicYear';
  final List<SubjectResultModel> subjects;
  final double overallScore;
  final String overallGrade;
  final int rank;
  final int totalStudents;
  final bool isCurrent;
  final DateTime? startDate;

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
        ? numOf(reportCard['overallAverage'])?.toDouble() ?? _avgScore(subjects)
        : _avgScore(subjects);

    final String overallGrade = reportCard != null
        ? (reportCard['overallGrade'] as String? ?? '')
        : _gradeFromScore(overallScore);

    final int rank = reportCard != null ? (reportCard['rank'] as int? ?? 0) : 0;
    final int totalStudents = reportCard != null
        ? (reportCard['totalStudentsInClass'] as int? ?? 0)
        : (results.isNotEmpty ? (results.first['totalStudentsInClass'] as int? ?? 0) : 0);

    // "2026 Academic Year" reads better as "2026" next to the term name.
    final academicYear = ((term['academicYear'] as Map<String, dynamic>?)?['name'] as String?
            ?? term['academicYearName'] as String?
            ?? '')
        .replaceAll(RegExp(r'\s*academic year\s*', caseSensitive: false), ' ')
        .trim();

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
      startDate: DateTime.tryParse(term['startDate'] as String? ?? ''),
    );
  }

  static double _avgScore(List<SubjectResultModel> subjects) {
    if (subjects.isEmpty) return 0.0;
    return subjects.map((s) => s.score).reduce((a, b) => a + b) / subjects.length;
  }

  static String _gradeFromScore(double score) {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}
