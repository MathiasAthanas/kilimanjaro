enum HodApprovalStatus { pending, approved, rejected }

enum HodAlertSeverity { low, medium, high, critical }

class HodApproval {
  const HodApproval({
    required this.id,
    required this.subject,
    required this.classLabel,
    required this.assessmentType,
    required this.teacherName,
    required this.submittedAgo,
    required this.studentCount,
    required this.maxScore,
    required this.classAverage,
    required this.highest,
    required this.lowest,
    required this.distribution,
    this.status = HodApprovalStatus.pending,
    this.rejectionReason,
  });

  final String id;
  final String subject;
  final String classLabel;
  final String assessmentType;
  final String teacherName;
  final String submittedAgo;
  final int studentCount;
  final double maxScore;
  final double classAverage;
  final double highest;
  final double lowest;
  final Map<String, int> distribution;
  final HodApprovalStatus status;
  final String? rejectionReason;

  double get averagePercent =>
      maxScore == 0 ? 0 : classAverage / maxScore * 100;

  HodApproval copyWith({HodApprovalStatus? status, String? rejectionReason}) {
    return HodApproval(
      id: id,
      subject: subject,
      classLabel: classLabel,
      assessmentType: assessmentType,
      teacherName: teacherName,
      submittedAgo: submittedAgo,
      studentCount: studentCount,
      maxScore: maxScore,
      classAverage: classAverage,
      highest: highest,
      lowest: lowest,
      distribution: distribution,
      status: status ?? this.status,
      rejectionReason: rejectionReason ?? this.rejectionReason,
    );
  }
}

class HodSubjectAnalytics {
  const HodSubjectAnalytics({
    required this.id,
    required this.name,
    required this.average,
    required this.syllabusCompletion,
    required this.atRiskStudents,
    required this.classes,
  });

  final String id;
  final String name;
  final double average;
  final double syllabusCompletion;
  final int atRiskStudents;
  final List<HodClassAnalytics> classes;
}

class HodClassAnalytics {
  const HodClassAnalytics({
    required this.classLabel,
    required this.teacherName,
    required this.average,
    required this.studentCount,
  });

  final String classLabel;
  final String teacherName;
  final double average;
  final int studentCount;
}

class HodTeacherSummary {
  const HodTeacherSummary({
    required this.id,
    required this.name,
    required this.subjects,
    required this.onTimeRate,
    required this.averageScore,
    required this.syllabusCompletion,
  });

  final String id;
  final String name;
  final String subjects;
  final double onTimeRate;
  final double averageScore;
  final double syllabusCompletion;
}

class HodDepartmentAlert {
  const HodDepartmentAlert({
    required this.id,
    required this.title,
    required this.subject,
    required this.classLabel,
    required this.message,
    required this.severity,
    this.studentId,
    this.isEscalated = false,
  });

  final String id;
  final String title;
  final String subject;
  final String classLabel;
  final String message;
  final HodAlertSeverity severity;
  final String? studentId;
  final bool isEscalated;

  HodDepartmentAlert copyWith({bool? isEscalated}) {
    return HodDepartmentAlert(
      id: id,
      title: title,
      subject: subject,
      classLabel: classLabel,
      message: message,
      severity: severity,
      studentId: studentId,
      isEscalated: isEscalated ?? this.isEscalated,
    );
  }
}

class HodPairingSummary {
  const HodPairingSummary({
    required this.id,
    required this.subject,
    required this.classLabel,
    required this.count,
    required this.status,
  });

  final String id;
  final String subject;
  final String classLabel;
  final int count;
  final String status;

  HodPairingSummary copyWith({String? status}) {
    return HodPairingSummary(
      id: id,
      subject: subject,
      classLabel: classLabel,
      count: count,
      status: status ?? this.status,
    );
  }
}

class HodIntervention {
  const HodIntervention({
    required this.id,
    required this.title,
    required this.teacherName,
    required this.type,
    required this.note,
    required this.timeAgo,
    required this.followedUp,
  });

  final String id;
  final String title;
  final String teacherName;
  final String type;
  final String note;
  final String timeAgo;
  final bool followedUp;

  HodIntervention copyWith({bool? followedUp}) {
    return HodIntervention(
      id: id,
      title: title,
      teacherName: teacherName,
      type: type,
      note: note,
      timeAgo: timeAgo,
      followedUp: followedUp ?? this.followedUp,
    );
  }
}
