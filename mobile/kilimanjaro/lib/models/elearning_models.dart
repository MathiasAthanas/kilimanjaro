// E-Learning domain models matching the elearning-service Prisma schema.

class ElearningCourseModel {
  const ElearningCourseModel({
    required this.id,
    required this.classSubjectId,
    required this.teacherId,
    required this.termId,
    required this.academicYearId,
    required this.subjectName,
    required this.className,
    this.educationStage,
    this.classLevel,
    this.combinationId,
    this.description,
    this.coverColor,
    this.coverEmoji,
    required this.status,
    this.publishedAt,
    required this.enrolledCount,
    required this.lessons,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String classSubjectId;
  final String teacherId;
  final String termId;
  final String academicYearId;
  final String subjectName;
  final String className;
  final String? educationStage;
  final int? classLevel;
  final String? combinationId;
  final String? description;
  final String? coverColor;
  final String? coverEmoji;
  final String status;
  final DateTime? publishedAt;
  final int enrolledCount;
  final List<ElearningLessonModel> lessons;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory ElearningCourseModel.fromJson(Map<String, dynamic> json) =>
      ElearningCourseModel(
        id: json['id'] as String,
        classSubjectId: json['classSubjectId'] as String? ?? '',
        teacherId: json['teacherId'] as String? ?? '',
        termId: json['termId'] as String? ?? '',
        academicYearId: json['academicYearId'] as String? ?? '',
        subjectName: json['subjectName'] as String? ?? '',
        className: json['className'] as String? ?? '',
        educationStage: json['educationStage'] as String?,
        classLevel: (json['classLevel'] as num?)?.toInt(),
        combinationId: json['combinationId'] as String?,
        description: json['description'] as String?,
        coverColor: json['coverColor'] as String?,
        coverEmoji: json['coverEmoji'] as String?,
        status: json['status'] as String? ?? 'DRAFT',
        publishedAt: json['publishedAt'] != null
            ? DateTime.tryParse(json['publishedAt'] as String)
            : null,
        enrolledCount: (json['enrolledCount'] as num?)?.toInt() ?? 0,
        lessons: (json['lessons'] as List<dynamic>? ?? [])
            .map((l) => ElearningLessonModel.fromJson(l as Map<String, dynamic>))
            .toList(),
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
            DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
            DateTime.now(),
      );

  bool get isActive => status == 'ACTIVE';
  String get stageLabel {
    switch (educationStage) {
      case 'PRIMARY':
        return 'Primary';
      case 'A_LEVEL':
        return combinationId == null ? 'A-Level' : 'A-Level combination';
      case 'O_LEVEL':
        return 'O-Level';
      default:
        return className;
    }
  }
  String get emoji => coverEmoji ?? '📘';
}

class ElearningLessonModel {
  const ElearningLessonModel({
    required this.id,
    required this.courseSpaceId,
    required this.title,
    this.description,
    required this.orderIndex,
    this.weekNumber,
    required this.status,
    this.publishedAt,
    this.estimatedMinutes,
    required this.materials,
  });

  final String id;
  final String courseSpaceId;
  final String title;
  final String? description;
  final int orderIndex;
  final int? weekNumber;
  final String status;
  final DateTime? publishedAt;
  final int? estimatedMinutes;
  final List<ElearningMaterialModel> materials;

  factory ElearningLessonModel.fromJson(Map<String, dynamic> json) =>
      ElearningLessonModel(
        id: json['id'] as String,
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        description: json['description'] as String?,
        orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 0,
        weekNumber: (json['weekNumber'] as num?)?.toInt(),
        status: json['status'] as String? ?? 'DRAFT',
        publishedAt: json['publishedAt'] != null
            ? DateTime.tryParse(json['publishedAt'] as String)
            : null,
        estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt(),
        materials: (json['materials'] as List<dynamic>? ?? [])
            .map((m) =>
                ElearningMaterialModel.fromJson(m as Map<String, dynamic>))
            .toList(),
      );

  bool get isPublished => status == 'PUBLISHED';
}

class ElearningMaterialModel {
  const ElearningMaterialModel({
    required this.id,
    required this.lessonId,
    required this.courseSpaceId,
    required this.title,
    required this.type,
    required this.status,
    required this.orderIndex,
    this.body,
    this.fileKey,
    this.fileOriginalName,
    this.fileMimeType,
    this.fileSizeBytes,
    this.externalUrl,
    required this.downloadable,
    required this.viewCount,
  });

  final String id;
  final String lessonId;
  final String courseSpaceId;
  final String title;
  final String type; // PDF | NOTE | SLIDE | IMAGE | VIDEO | LINK | FILE
  final String status;
  final int orderIndex;
  final String? body;
  final String? fileKey;
  final String? fileOriginalName;
  final String? fileMimeType;
  final int? fileSizeBytes;
  final String? externalUrl;
  final bool downloadable;
  final int viewCount;

  factory ElearningMaterialModel.fromJson(Map<String, dynamic> json) =>
      ElearningMaterialModel(
        id: json['id'] as String,
        lessonId: json['lessonId'] as String? ?? '',
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        type: json['type'] as String? ?? 'NOTE',
        status: json['status'] as String? ?? 'DRAFT',
        orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 0,
        body: json['body'] as String?,
        fileKey: json['fileKey'] as String?,
        fileOriginalName: json['fileOriginalName'] as String?,
        fileMimeType: json['fileMimeType'] as String?,
        fileSizeBytes: (json['fileSizeBytes'] as num?)?.toInt(),
        externalUrl: json['externalUrl'] as String?,
        downloadable: json['downloadable'] as bool? ?? true,
        viewCount: (json['viewCount'] as num?)?.toInt() ?? 0,
      );

  bool get isPdf => type == 'PDF' || (fileMimeType?.contains('pdf') ?? false);
  bool get isVideo =>
      type == 'VIDEO' ||
      (fileMimeType?.startsWith('video/') ?? false) ||
      (externalUrl?.contains('youtube') ?? false) ||
      (externalUrl?.contains('youtu.be') ?? false);
  bool get isNote => type == 'NOTE';
  bool get isLink => type == 'LINK';

  String? get downloadUrl {
    if (externalUrl != null) return externalUrl;
    if (fileKey == null) return null;
    final parts = fileKey!.replaceAll('\\', '/').split('/');
    if (parts.length < 2) return null;
    final domain = parts[0];
    final filename = Uri.encodeComponent(parts.sublist(1).join('/'));
    return '/elearning/files/$domain/$filename';
  }
}

class ElearningAssignmentModel {
  const ElearningAssignmentModel({
    required this.id,
    required this.courseSpaceId,
    this.lessonId,
    required this.title,
    required this.instructions,
    required this.type,
    this.maxScore,
    this.dueAt,
    required this.allowLateSubmission,
    this.latePenaltyPercent,
    required this.status,
    this.publishedAt,
    this.closedAt,
  });

  final String id;
  final String courseSpaceId;
  final String? lessonId;
  final String title;
  final String instructions;
  final String type; // FILE_UPLOAD | TEXT | BOTH
  final double? maxScore;
  final DateTime? dueAt;
  final bool allowLateSubmission;
  final double? latePenaltyPercent;
  final String status;
  final DateTime? publishedAt;
  final DateTime? closedAt;

  factory ElearningAssignmentModel.fromJson(Map<String, dynamic> json) =>
      ElearningAssignmentModel(
        id: json['id'] as String,
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        lessonId: json['lessonId'] as String?,
        title: json['title'] as String? ?? '',
        instructions: json['instructions'] as String? ?? '',
        type: json['type'] as String? ?? 'BOTH',
        maxScore: (json['maxScore'] as num?)?.toDouble(),
        dueAt: json['dueAt'] != null
            ? DateTime.tryParse(json['dueAt'] as String)
            : null,
        allowLateSubmission: json['allowLateSubmission'] as bool? ?? true,
        latePenaltyPercent: (json['latePenaltyPercent'] as num?)?.toDouble(),
        status: json['status'] as String? ?? 'DRAFT',
        publishedAt: json['publishedAt'] != null
            ? DateTime.tryParse(json['publishedAt'] as String)
            : null,
        closedAt: json['closedAt'] != null
            ? DateTime.tryParse(json['closedAt'] as String)
            : null,
      );

  bool get isPublished => status == 'PUBLISHED';
  bool get isClosed => status == 'CLOSED';

  bool get isOverdue {
    if (dueAt == null) return false;
    return DateTime.now().isAfter(dueAt!);
  }
}

class ElearningSubmissionModel {
  const ElearningSubmissionModel({
    required this.id,
    required this.assignmentId,
    required this.studentId,
    required this.courseSpaceId,
    this.textContent,
    this.fileKey,
    this.fileOriginalName,
    this.fileMimeType,
    this.submittedAt,
    required this.isLate,
    required this.status,
    this.score,
    this.maxScore,
    this.feedback,
    this.gradedAt,
    this.gradedBy,
  });

  final String id;
  final String assignmentId;
  final String studentId;
  final String courseSpaceId;
  final String? textContent;
  final String? fileKey;
  final String? fileOriginalName;
  final String? fileMimeType;
  final DateTime? submittedAt;
  final bool isLate;
  final String status; // DRAFT | SUBMITTED | GRADED | RETURNED
  final double? score;
  final double? maxScore;
  final String? feedback;
  final DateTime? gradedAt;
  final String? gradedBy;

  factory ElearningSubmissionModel.fromJson(Map<String, dynamic> json) =>
      ElearningSubmissionModel(
        id: json['id'] as String,
        assignmentId: json['assignmentId'] as String? ?? '',
        studentId: json['studentId'] as String? ?? '',
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        textContent: json['textContent'] as String?,
        fileKey: json['fileKey'] as String?,
        fileOriginalName: json['fileOriginalName'] as String?,
        fileMimeType: json['fileMimeType'] as String?,
        submittedAt: json['submittedAt'] != null
            ? DateTime.tryParse(json['submittedAt'] as String)
            : null,
        isLate: json['isLate'] as bool? ?? false,
        status: json['status'] as String? ?? 'DRAFT',
        score: (json['score'] as num?)?.toDouble(),
        maxScore: (json['maxScore'] as num?)?.toDouble(),
        feedback: json['feedback'] as String?,
        gradedAt: json['gradedAt'] != null
            ? DateTime.tryParse(json['gradedAt'] as String)
            : null,
        gradedBy: json['gradedBy'] as String?,
      );

  bool get isGraded => status == 'GRADED';
  bool get isSubmitted => status == 'SUBMITTED' || status == 'GRADED';
  double? get scorePercent =>
      (score != null && maxScore != null && maxScore! > 0)
          ? (score! / maxScore!) * 100
          : null;
}

class ElearningQuizModel {
  const ElearningQuizModel({
    required this.id,
    required this.courseSpaceId,
    this.lessonId,
    required this.title,
    this.instructions,
    this.timeLimitMinutes,
    required this.maxAttempts,
    this.passingScore,
    required this.status,
    this.publishedAt,
    this.closedAt,
    required this.totalPoints,
    required this.questions,
  });

  final String id;
  final String courseSpaceId;
  final String? lessonId;
  final String title;
  final String? instructions;
  final int? timeLimitMinutes;
  final int maxAttempts;
  final double? passingScore;
  final String status;
  final DateTime? publishedAt;
  final DateTime? closedAt;
  final double totalPoints;
  final List<ElearningQuizQuestionModel> questions;

  factory ElearningQuizModel.fromJson(Map<String, dynamic> json) =>
      ElearningQuizModel(
        id: json['id'] as String,
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        lessonId: json['lessonId'] as String?,
        title: json['title'] as String? ?? '',
        instructions: json['instructions'] as String?,
        timeLimitMinutes: (json['timeLimitMinutes'] as num?)?.toInt(),
        maxAttempts: (json['maxAttempts'] as num?)?.toInt() ?? 1,
        passingScore: (json['passingScore'] as num?)?.toDouble(),
        status: json['status'] as String? ?? 'DRAFT',
        publishedAt: json['publishedAt'] != null
            ? DateTime.tryParse(json['publishedAt'] as String)
            : null,
        closedAt: json['closedAt'] != null
            ? DateTime.tryParse(json['closedAt'] as String)
            : null,
        totalPoints: (json['totalPoints'] as num?)?.toDouble() ?? 0,
        questions: (json['questions'] as List<dynamic>? ?? [])
            .map((q) => ElearningQuizQuestionModel.fromJson(
                q as Map<String, dynamic>))
            .toList(),
      );

  bool get isPublished => status == 'PUBLISHED';
  int get questionCount => questions.length;
}

class ElearningQuizQuestionModel {
  const ElearningQuizQuestionModel({
    required this.id,
    required this.quizId,
    required this.type,
    required this.prompt,
    required this.points,
    required this.orderIndex,
    this.explanation,
    this.correctAnswer,
    required this.options,
  });

  final String id;
  final String quizId;
  final String type; // MULTIPLE_CHOICE | TRUE_FALSE | SHORT_ANSWER
  final String prompt;
  final double points;
  final int orderIndex;
  final String? explanation;
  final String? correctAnswer;
  final List<ElearningQuizOptionModel> options;

  factory ElearningQuizQuestionModel.fromJson(Map<String, dynamic> json) =>
      ElearningQuizQuestionModel(
        id: json['id'] as String,
        quizId: json['quizId'] as String? ?? '',
        type: json['type'] as String? ?? 'MULTIPLE_CHOICE',
        prompt: json['prompt'] as String? ?? '',
        points: (json['points'] as num?)?.toDouble() ?? 1.0,
        orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 0,
        explanation: json['explanation'] as String?,
        correctAnswer: json['correctAnswer'] as String?,
        options: (json['options'] as List<dynamic>? ?? [])
            .map((o) => ElearningQuizOptionModel.fromJson(
                o as Map<String, dynamic>))
            .toList(),
      );
}

class ElearningQuizOptionModel {
  const ElearningQuizOptionModel({
    required this.id,
    required this.questionId,
    required this.text,
    required this.orderIndex,
  });

  final String id;
  final String questionId;
  final String text;
  final int orderIndex;

  factory ElearningQuizOptionModel.fromJson(Map<String, dynamic> json) =>
      ElearningQuizOptionModel(
        id: json['id'] as String,
        questionId: json['questionId'] as String? ?? '',
        text: json['text'] as String? ?? '',
        orderIndex: (json['orderIndex'] as num?)?.toInt() ?? 0,
      );
}

class ElearningQuizAttemptModel {
  const ElearningQuizAttemptModel({
    required this.id,
    required this.quizId,
    required this.studentId,
    required this.courseSpaceId,
    required this.attemptNumber,
    required this.startedAt,
    this.submittedAt,
    required this.status,
    this.totalScore,
    this.maxScore,
    this.percentScore,
    this.isPassed,
    required this.answers,
  });

  final String id;
  final String quizId;
  final String studentId;
  final String courseSpaceId;
  final int attemptNumber;
  final DateTime startedAt;
  final DateTime? submittedAt;
  final String status; // IN_PROGRESS | SUBMITTED | AUTO_GRADED | MANUALLY_GRADED
  final double? totalScore;
  final double? maxScore;
  final double? percentScore;
  final bool? isPassed;
  final List<ElearningQuizAnswerModel> answers;

  factory ElearningQuizAttemptModel.fromJson(Map<String, dynamic> json) =>
      ElearningQuizAttemptModel(
        id: json['id'] as String,
        quizId: json['quizId'] as String? ?? '',
        studentId: json['studentId'] as String? ?? '',
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 1,
        startedAt:
            DateTime.tryParse(json['startedAt'] as String? ?? '') ?? DateTime.now(),
        submittedAt: json['submittedAt'] != null
            ? DateTime.tryParse(json['submittedAt'] as String)
            : null,
        status: json['status'] as String? ?? 'IN_PROGRESS',
        totalScore: (json['totalScore'] as num?)?.toDouble(),
        maxScore: (json['maxScore'] as num?)?.toDouble(),
        percentScore: (json['percentScore'] as num?)?.toDouble(),
        isPassed: json['isPassed'] as bool?,
        answers: (json['answers'] as List<dynamic>? ?? [])
            .map((a) => ElearningQuizAnswerModel.fromJson(
                a as Map<String, dynamic>))
            .toList(),
      );

  bool get isInProgress => status == 'IN_PROGRESS';
  bool get isCompleted =>
      status == 'SUBMITTED' ||
      status == 'AUTO_GRADED' ||
      status == 'MANUALLY_GRADED';
}

class ElearningQuizAnswerModel {
  const ElearningQuizAnswerModel({
    required this.id,
    required this.attemptId,
    required this.questionId,
    this.selectedOptionId,
    this.textAnswer,
    this.isCorrect,
    this.scoreAwarded,
  });

  final String id;
  final String attemptId;
  final String questionId;
  final String? selectedOptionId;
  final String? textAnswer;
  final bool? isCorrect;
  final double? scoreAwarded;

  factory ElearningQuizAnswerModel.fromJson(Map<String, dynamic> json) =>
      ElearningQuizAnswerModel(
        id: json['id'] as String,
        attemptId: json['attemptId'] as String? ?? '',
        questionId: json['questionId'] as String? ?? '',
        selectedOptionId: json['selectedOptionId'] as String?,
        textAnswer: json['textAnswer'] as String?,
        isCorrect: json['isCorrect'] as bool?,
        scoreAwarded: (json['scoreAwarded'] as num?)?.toDouble(),
      );
}

class ElearningProgressModel {
  const ElearningProgressModel({
    required this.courseId,
    required this.studentId,
    required this.lessons,
    required this.materials,
    required this.viewed,
    required this.assignments,
    required this.submissions,
    required this.quizzes,
    required this.attempts,
    required this.completionPercent,
  });

  final String courseId;
  final String studentId;
  final int lessons;
  final int materials;
  final int viewed;
  final int assignments;
  final int submissions;
  final int quizzes;
  final int attempts;
  final int completionPercent;

  factory ElearningProgressModel.fromJson(Map<String, dynamic> json) =>
      ElearningProgressModel(
        courseId: json['courseId'] as String? ?? '',
        studentId: json['studentId'] as String? ?? '',
        lessons: (json['lessons'] as num?)?.toInt() ?? 0,
        materials: (json['materials'] as num?)?.toInt() ?? 0,
        viewed: (json['viewed'] as num?)?.toInt() ?? 0,
        assignments: (json['assignments'] as num?)?.toInt() ?? 0,
        submissions: (json['submissions'] as num?)?.toInt() ?? 0,
        quizzes: (json['quizzes'] as num?)?.toInt() ?? 0,
        attempts: (json['attempts'] as num?)?.toInt() ?? 0,
        completionPercent: (json['completionPercent'] as num?)?.toInt() ?? 0,
      );
}

class ElearningStudentSummaryModel {
  const ElearningStudentSummaryModel({
    required this.enrolledCount,
    required this.pendingAssignments,
    required this.availableQuizzes,
    required this.unviewedMaterials,
  });

  final int enrolledCount;
  final int pendingAssignments;
  final int availableQuizzes;
  final int unviewedMaterials;

  factory ElearningStudentSummaryModel.fromJson(Map<String, dynamic> json) =>
      ElearningStudentSummaryModel(
        enrolledCount: (json['courses'] as List<dynamic>? ?? []).length,
        pendingAssignments: (json['pendingAssignments'] as num?)?.toInt() ?? 0,
        availableQuizzes: (json['availableQuizzes'] as num?)?.toInt() ?? 0,
        unviewedMaterials: (json['unviewedMaterials'] as num?)?.toInt() ?? 0,
      );
}

class ElearningAnnouncementModel {
  const ElearningAnnouncementModel({
    required this.id,
    required this.courseSpaceId,
    required this.title,
    required this.body,
    required this.status,
    required this.isPinned,
    this.publishedAt,
    required this.createdBy,
    required this.createdAt,
  });

  final String id;
  final String courseSpaceId;
  final String title;
  final String body;
  final String status;
  final bool isPinned;
  final DateTime? publishedAt;
  final String createdBy;
  final DateTime createdAt;

  factory ElearningAnnouncementModel.fromJson(Map<String, dynamic> json) =>
      ElearningAnnouncementModel(
        id: json['id'] as String,
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        status: json['status'] as String? ?? 'DRAFT',
        isPinned: json['isPinned'] as bool? ?? false,
        publishedAt: json['publishedAt'] != null
            ? DateTime.tryParse(json['publishedAt'] as String)
            : null,
        createdBy: json['createdBy'] as String? ?? '',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );
}

class ElearningDiscussionModel {
  const ElearningDiscussionModel({
    required this.id,
    required this.courseSpaceId,
    this.lessonId,
    this.assignmentId,
    required this.title,
    required this.body,
    required this.authorId,
    required this.authorRole,
    required this.isResolved,
    required this.isPinned,
    required this.createdAt,
    required this.replies,
  });

  final String id;
  final String courseSpaceId;
  final String? lessonId;
  final String? assignmentId;
  final String title;
  final String body;
  final String authorId;
  final String authorRole;
  final bool isResolved;
  final bool isPinned;
  final DateTime createdAt;
  final List<ElearningReplyModel> replies;

  factory ElearningDiscussionModel.fromJson(Map<String, dynamic> json) =>
      ElearningDiscussionModel(
        id: json['id'] as String,
        courseSpaceId: json['courseSpaceId'] as String? ?? '',
        lessonId: json['lessonId'] as String?,
        assignmentId: json['assignmentId'] as String?,
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        authorId: json['authorId'] as String? ?? '',
        authorRole: json['authorRole'] as String? ?? 'STUDENT',
        isResolved: json['isResolved'] as bool? ?? false,
        isPinned: json['isPinned'] as bool? ?? false,
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
        replies: (json['replies'] as List<dynamic>? ?? [])
            .map((r) =>
                ElearningReplyModel.fromJson(r as Map<String, dynamic>))
            .toList(),
      );
}

class ElearningReplyModel {
  const ElearningReplyModel({
    required this.id,
    required this.threadId,
    required this.body,
    required this.authorId,
    required this.authorRole,
    required this.createdAt,
  });

  final String id;
  final String threadId;
  final String body;
  final String authorId;
  final String authorRole;
  final DateTime createdAt;

  factory ElearningReplyModel.fromJson(Map<String, dynamic> json) =>
      ElearningReplyModel(
        id: json['id'] as String,
        threadId: json['threadId'] as String? ?? '',
        body: json['body'] as String? ?? '',
        authorId: json['authorId'] as String? ?? '',
        authorRole: json['authorRole'] as String? ?? 'STUDENT',
        createdAt:
            DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
      );
}
