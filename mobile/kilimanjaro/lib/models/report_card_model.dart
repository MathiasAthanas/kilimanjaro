class ReportCardRemark {
  const ReportCardRemark({
    required this.author,
    required this.role,
    required this.message,
  });

  final String author;
  final String role;
  final String message;
}

class ReportCardModel {
  const ReportCardModel({
    required this.termId,
    required this.title,
    required this.classLabel,
    required this.stream,
    required this.overallScore,
    required this.overallGrade,
    required this.rank,
    required this.totalStudents,
    required this.teacherRemark,
    required this.principalRemark,
  });

  final String termId;
  final String title;
  final String classLabel;
  final String stream;
  final double overallScore;
  final String overallGrade;
  final int rank;
  final int totalStudents;
  final ReportCardRemark teacherRemark;
  final ReportCardRemark principalRemark;
}
