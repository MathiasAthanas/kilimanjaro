class ReportCardRemark {
  const ReportCardRemark({
    required this.author,
    required this.role,
    required this.message,
  });

  final String author;
  final String role;
  final String message;

  factory ReportCardRemark.fromJson(Map<String, dynamic> json) {
    return ReportCardRemark(
      author: json['author'] as String? ?? '',
      role: json['role'] as String? ?? '',
      message: json['message'] as String? ?? '',
    );
  }

  static ReportCardRemark teacherFrom(String? comment) {
    return ReportCardRemark(
      author: 'Class Teacher',
      role: 'Teacher',
      message: comment ?? '',
    );
  }

  static ReportCardRemark principalFrom(String? comment) {
    return ReportCardRemark(
      author: 'Principal',
      role: 'Principal',
      message: comment ?? '',
    );
  }
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
    this.educationStage,
    this.combinationCode,
    this.reportTemplateCode,
    this.divisionSummary,
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
  final String? educationStage;
  final String? combinationCode;
  final String? reportTemplateCode;
  final String? divisionSummary;

  factory ReportCardModel.fromJson(Map<String, dynamic> json) {
    return ReportCardModel(
      termId: json['termId'] as String? ?? '',
      title: json['title'] as String? ?? json['overallRemark'] as String? ?? '',
      classLabel: json['classLabel'] as String? ?? (json['class'] as Map<String, dynamic>?)?['name'] as String? ?? '',
      stream: json['stream'] as String? ?? '',
      overallScore: (json['overallAverage'] as num?)?.toDouble() ?? (json['overallScore'] as num?)?.toDouble() ?? 0.0,
      overallGrade: json['overallGrade'] as String? ?? '',
      rank: json['rank'] as int? ?? 0,
      totalStudents: json['totalStudentsInClass'] as int? ?? json['totalStudents'] as int? ?? 0,
      teacherRemark: json['teacherRemark'] != null
          ? ReportCardRemark.fromJson(json['teacherRemark'] as Map<String, dynamic>)
          : ReportCardRemark.teacherFrom(json['teacherComment'] as String?),
      principalRemark: json['principalRemark'] != null
          ? ReportCardRemark.fromJson(json['principalRemark'] as Map<String, dynamic>)
          : ReportCardRemark.principalFrom(json['principalComment'] as String?),
      educationStage: json['educationStage'] as String?,
      combinationCode: json['combinationCode'] as String?,
      reportTemplateCode: json['reportTemplateCode'] as String?,
      divisionSummary: json['divisionSummary']?.toString(),
    );
  }

  String get stageLabel {
    switch (educationStage) {
      case 'PRIMARY':
        return 'Primary';
      case 'A_LEVEL':
        return combinationCode == null ? 'A-Level' : 'A-Level $combinationCode';
      case 'O_LEVEL':
        return 'O-Level';
      default:
        return 'Stage pending';
    }
  }
}
