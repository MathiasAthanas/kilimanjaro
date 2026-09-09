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
      funnel[map['stage'] as String? ?? ''] = (map['count'] as num?)?.toInt() ?? 0;
    }
    final totals = json['totals'] as Map<String, dynamic>? ?? const {};
    return AdmissionsSummary(
      funnel: funnel,
      total: (totals['total'] as num?)?.toInt() ?? 0,
      active: (totals['active'] as num?)?.toInt() ?? 0,
      enrolled: (totals['enrolled'] as num?)?.toInt() ?? 0,
      conversionRate: (totals['conversionRate'] as num?)?.toDouble() ?? 0,
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

class AdmissionApplicant {
  const AdmissionApplicant({
    required this.id,
    required this.fullName,
    required this.stage,
    required this.guardianName,
    required this.guardianPhone,
    required this.sourceChannel,
    this.className,
    this.notes,
    this.createdAt,
    this.stageEvents = const [],
  });

  final String id;
  final String fullName;
  final String stage;
  final String guardianName;
  final String guardianPhone;
  final String sourceChannel;
  final String? className;
  final String? notes;
  final DateTime? createdAt;
  final List<AdmissionStageEvent> stageEvents;

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
      notes: json['notes'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
      stageEvents: events,
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
