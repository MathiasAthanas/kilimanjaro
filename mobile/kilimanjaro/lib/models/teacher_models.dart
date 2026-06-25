enum TeacherAssessmentStatus { draft, open, submitted, approved, locked }

enum TeacherAttendanceStatus { present, absent, late, excused }

enum TeacherAlertSeverity { medium, high, critical }

enum TeacherPairingStatus { suggested, active, rejected }

enum InterventionType { supportGiven, parentMeeting, followUp, peerPairing, other }

class TeacherClassSubject {
  const TeacherClassSubject({
    required this.id,
    required this.subject,
    required this.classLabel,
    required this.studentCount,
    required this.averageScore,
    required this.attendanceRate,
    required this.nextLesson,
  });

  final String id;
  final String subject;
  final String classLabel;
  final int studentCount;
  final double averageScore;
  final double attendanceRate;
  final String nextLesson;

  String get title => '$subject $classLabel';
}

class TeacherStudent {
  const TeacherStudent({
    required this.id,
    required this.name,
    required this.registrationNumber,
    required this.classLabel,
    required this.averageScore,
    required this.attendanceRate,
    this.currentMark,
  });

  final String id;
  final String name;
  final String registrationNumber;
  final String classLabel;
  final double averageScore;
  final double attendanceRate;
  final double? currentMark;

  String get firstName => name.split(' ').first;
}

class TeacherAssessment {
  const TeacherAssessment({
    required this.id,
    required this.classSubjectId,
    required this.title,
    required this.maxScore,
    required this.status,
    required this.dueLabel,
    required this.enteredCount,
    required this.totalStudents,
  });

  final String id;
  final String classSubjectId;
  final String title;
  final double maxScore;
  final TeacherAssessmentStatus status;
  final String dueLabel;
  final int enteredCount;
  final int totalStudents;
}

class TeacherMarkEntry {
  const TeacherMarkEntry({
    required this.student,
    this.score,
    this.isAbsent = false,
  });

  final TeacherStudent student;
  final double? score;
  final bool isAbsent;

  TeacherMarkEntry copyWith({
    double? score,
    bool? isAbsent,
    bool clearScore = false,
  }) {
    return TeacherMarkEntry(
      student: student,
      score: clearScore ? null : score ?? this.score,
      isAbsent: isAbsent ?? this.isAbsent,
    );
  }
}

class TeacherAttendanceSession {
  const TeacherAttendanceSession({
    required this.id,
    required this.classSubjectId,
    required this.title,
    required this.timeLabel,
    required this.statusLabel,
    required this.isUrgent,
  });

  final String id;
  final String classSubjectId;
  final String title;
  final String timeLabel;
  final String statusLabel;
  final bool isUrgent;
}

class TeacherPerformanceAlert {
  const TeacherPerformanceAlert({
    required this.id,
    required this.studentId,
    required this.studentName,
    required this.classLabel,
    required this.subject,
    required this.type,
    required this.message,
    required this.severity,
    required this.previousScore,
    required this.currentScore,
  });

  final String id;
  final String studentId;
  final String studentName;
  final String classLabel;
  final String subject;
  final String type;
  final String message;
  final TeacherAlertSeverity severity;
  final double previousScore;
  final double currentScore;
}

class TeacherPairing {
  const TeacherPairing({
    required this.id,
    required this.classSubjectId,
    required this.subject,
    required this.classLabel,
    required this.supportStudent,
    required this.mentorStudent,
    required this.reason,
    required this.status,
  });

  final String id;
  final String classSubjectId;
  final String subject;
  final String classLabel;
  final TeacherStudent supportStudent;
  final TeacherStudent mentorStudent;
  final String reason;
  final TeacherPairingStatus status;
}

class TeacherTimetableSlot {
  const TeacherTimetableSlot({
    required this.day,
    required this.time,
    required this.classSubjectId,
    required this.title,
    required this.room,
  });

  final String day;
  final String time;
  final String classSubjectId;
  final String title;
  final String room;
}

class TeacherSyllabusProgress {
  const TeacherSyllabusProgress({
    required this.classSubjectId,
    required this.title,
    required this.covered,
    required this.total,
    required this.nextTopic,
  });

  final String classSubjectId;
  final String title;
  final int covered;
  final int total;
  final String nextTopic;

  double get progress => total == 0 ? 0 : covered / total;
}

class TeacherAnnouncement {
  const TeacherAnnouncement({
    required this.id,
    required this.title,
    required this.body,
    required this.target,
    required this.dateLabel,
  });

  final String id;
  final String title;
  final String body;
  final String target;
  final String dateLabel;
}
