import 'json_num.dart';

// Admissions pipeline models — mirror the `/admissions/*` API contracts.

class AdmissionsSummary {
  const AdmissionsSummary({
    required this.funnel,
    required this.total,
    required this.active,
    required this.enrolled,
    required this.conversionRate,
  });

  final Map<String, int> funnel;
  final int total;
  final int active;
  final int enrolled;
  final double conversionRate;

  factory AdmissionsSummary.fromJson(Map<String, dynamic> json) {
    final funnelRaw = json['funnel'] as List<dynamic>? ?? const [];
    final funnel = <String, int>{};
    for (final item in funnelRaw) {
      final map = item as Map<String, dynamic>;
      funnel[map['stage'] as String? ?? ''] = numOf(map['count'])?.toInt() ?? 0;
    }
    final totals = json['totals'] as Map<String, dynamic>? ?? const {};
    return AdmissionsSummary(
      funnel: funnel,
      total: numOf(totals['total'])?.toInt() ?? 0,
      active: numOf(totals['active'])?.toInt() ?? 0,
      enrolled: numOf(totals['enrolled'])?.toInt() ?? 0,
      conversionRate: numOf(totals['conversionRate'])?.toDouble() ?? 0,
    );
  }
}

class AdmissionStageEvent {
  const AdmissionStageEvent({
    required this.toStage,
    required this.createdAt,
    this.note,
  });

  final String toStage;
  final DateTime? createdAt;
  final String? note;

  factory AdmissionStageEvent.fromJson(Map<String, dynamic> json) {
    return AdmissionStageEvent(
      toStage: json['toStage'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      note: json['note'] as String?,
    );
  }
}

class AdmissionAssessment {
  const AdmissionAssessment({
    required this.id,
    required this.scheduledAt,
    this.subjectFocus,
    this.score,
    this.maxScore,
    required this.outcome,
    this.notes,
  });

  final String id;
  final DateTime? scheduledAt;
  final String? subjectFocus;
  final double? score;
  final double? maxScore;
  final String outcome; // PENDING | PASSED | FAILED | WAIVED
  final String? notes;

  factory AdmissionAssessment.fromJson(Map<String, dynamic> json) {
    return AdmissionAssessment(
      id: json['id'] as String? ?? '',
      scheduledAt: DateTime.tryParse(json['scheduledAt'] as String? ?? ''),
      subjectFocus: json['subjectFocus'] as String?,
      score: numOf(json['score'])?.toDouble(),
      maxScore: numOf(json['maxScore'])?.toDouble(),
      outcome: json['outcome'] as String? ?? 'PENDING',
      notes: json['notes'] as String?,
    );
  }
}

class AdmissionOffer {
  const AdmissionOffer({
    required this.id,
    required this.classId,
    required this.decision,
    this.feeExpectation,
    this.expiresAt,
    this.note,
  });

  final String id;
  final String classId;
  final String decision; // PENDING | ACCEPTED | DECLINED
  final double? feeExpectation;
  final DateTime? expiresAt;
  final String? note;

  factory AdmissionOffer.fromJson(Map<String, dynamic> json) {
    return AdmissionOffer(
      id: json['id'] as String? ?? '',
      classId: json['classId'] as String? ?? '',
      decision: json['decision'] as String? ?? 'PENDING',
      feeExpectation: numOf(json['feeExpectation'])?.toDouble(),
      expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
      note: json['note'] as String?,
    );
  }
}

class AdmissionApplicant {
  const AdmissionApplicant({
    required this.id,
    required this.fullName,
    required this.stage,
    required this.guardianName,
    required this.guardianPhone,
    required this.sourceChannel,
    this.className,
    this.prospectiveClassId,
    this.notes,
    this.createdAt,
    this.stageEvents = const [],
    this.assessments = const [],
    this.offer,
  });

  final String id;
  final String fullName;
  final String stage;
  final String guardianName;
  final String guardianPhone;
  final String sourceChannel;
  final String? className;
  final String? prospectiveClassId;
  final String? notes;
  final DateTime? createdAt;
  final List<AdmissionStageEvent> stageEvents;
  final List<AdmissionAssessment> assessments;
  final AdmissionOffer? offer;

  /// The most recent assessment, if any.
  AdmissionAssessment? get latestAssessment =>
      assessments.isEmpty ? null : assessments.first;

  factory AdmissionApplicant.fromJson(Map<String, dynamic> json) {
    final first = json['firstName'] as String? ?? '';
    final middle = json['middleName'] as String? ?? '';
    final last = json['lastName'] as String? ?? '';
    final cls = json['prospectiveClass'] as Map<String, dynamic>?;
    final classLabel = cls == null
        ? null
        : '${cls['name'] as String? ?? ''} ${cls['stream'] as String? ?? ''}'.trim();
    final events = (json['stageEvents'] as List<dynamic>? ?? const [])
        .map((item) => AdmissionStageEvent.fromJson(item as Map<String, dynamic>))
        .toList();
    final assessments = (json['assessments'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(AdmissionAssessment.fromJson)
        .toList();
    final offerJson = json['offer'] as Map<String, dynamic>?;
    return AdmissionApplicant(
      id: json['id'] as String? ?? '',
      fullName: [first, middle, last].where((p) => p.isNotEmpty).join(' '),
      stage: json['stage'] as String? ?? 'INQUIRY',
      guardianName:
          '${json['guardianFirstName'] as String? ?? ''} ${json['guardianLastName'] as String? ?? ''}'
              .trim(),
      guardianPhone: json['guardianPhone'] as String? ?? '',
      sourceChannel: json['sourceChannel'] as String? ?? 'WALK_IN',
      className: classLabel?.isEmpty ?? true ? null : classLabel,
      prospectiveClassId: cls == null ? null : cls['id'] as String?,
      notes: json['notes'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      stageEvents: events,
      assessments: assessments,
      offer: offerJson == null ? null : AdmissionOffer.fromJson(offerJson),
    );
  }
}

class NewInquiryInput {
  const NewInquiryInput({
    required this.firstName,
    required this.lastName,
    required this.guardianFirstName,
    required this.guardianLastName,
    required this.guardianPhone,
    this.sourceChannel = 'WALK_IN',
    this.notes,
  });

  final String firstName;
  final String lastName;
  final String guardianFirstName;
  final String guardianLastName;
  final String guardianPhone;
  final String sourceChannel;
  final String? notes;

  Map<String, dynamic> toJson() => {
        'firstName': firstName,
        'lastName': lastName,
        'guardianFirstName': guardianFirstName,
        'guardianLastName': guardianLastName,
        'guardianPhone': guardianPhone,
        'sourceChannel': sourceChannel,
        if (notes != null && notes!.isNotEmpty) 'notes': notes,
      };
}
