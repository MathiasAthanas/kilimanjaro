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
}
