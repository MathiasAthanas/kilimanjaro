import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/hod_models.dart';

final hodApprovalsControllerProvider =
    StateNotifierProvider<HodApprovalsController, List<HodApproval>>(
      (ref) => HodApprovalsController(),
    );

class HodApprovalsController extends StateNotifier<List<HodApproval>> {
  HodApprovalsController() : super(_pendingApprovals);

  void approve(String id) {
    state = [
      for (final item in state)
        if (item.id == id)
          item.copyWith(status: HodApprovalStatus.approved)
        else
          item,
    ];
  }

  void reject(String id, String reason) {
    state = [
      for (final item in state)
        if (item.id == id)
          item.copyWith(
            status: HodApprovalStatus.rejected,
            rejectionReason: reason,
          )
        else
          item,
    ];
  }
}

final hodPendingApprovalsProvider = Provider<List<HodApproval>>((ref) {
  return ref
      .watch(hodApprovalsControllerProvider)
      .where((item) => item.status == HodApprovalStatus.pending)
      .toList();
});

final hodApprovalHistoryProvider = Provider<List<HodApproval>>((ref) {
  return [
    ...ref
        .watch(hodApprovalsControllerProvider)
        .where((item) => item.status != HodApprovalStatus.pending),
    ..._approvalHistory,
  ];
});

final hodApprovalByIdProvider = Provider.family<HodApproval?, String>((
  ref,
  id,
) {
  return ref
      .watch(hodApprovalsControllerProvider)
      .where((item) => item.id == id)
      .firstOrNull;
});

final hodSubjectsProvider = Provider<List<HodSubjectAnalytics>>(
  (ref) => _subjects,
);

final hodSubjectByIdProvider = Provider.family<HodSubjectAnalytics?, String>((
  ref,
  id,
) {
  return _subjects.where((item) => item.id == id).firstOrNull;
});

final hodTeachersProvider = Provider<List<HodTeacherSummary>>(
  (ref) => _teachers,
);

final hodTeacherByIdProvider = Provider.family<HodTeacherSummary?, String>((
  ref,
  id,
) {
  return _teachers.where((item) => item.id == id).firstOrNull;
});

final hodAlertsControllerProvider =
    StateNotifierProvider<HodAlertsController, List<HodDepartmentAlert>>(
      (ref) => HodAlertsController(),
    );

class HodAlertsController extends StateNotifier<List<HodDepartmentAlert>> {
  HodAlertsController() : super(_alerts);

  void escalate(String id) {
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(isEscalated: true) else item,
    ];
  }
}

final hodAlertsProvider = Provider<List<HodDepartmentAlert>>(
  (ref) => ref.watch(hodAlertsControllerProvider),
);

final hodPairingsControllerProvider =
    StateNotifierProvider<HodPairingsController, List<HodPairingSummary>>(
      (ref) => HodPairingsController(),
    );

class HodPairingsController extends StateNotifier<List<HodPairingSummary>> {
  HodPairingsController() : super(_pairings);

  void activatePairings(List<String> ids) {
    state = [
      for (final item in state)
        if (ids.contains(item.id)) item.copyWith(status: 'ACTIVE') else item,
    ];
  }
}

final hodPairingsProvider = Provider<List<HodPairingSummary>>(
  (ref) => ref.watch(hodPairingsControllerProvider),
);

final hodInterventionsControllerProvider =
    StateNotifierProvider<HodInterventionsController, List<HodIntervention>>(
      (ref) => HodInterventionsController(),
    );

class HodInterventionsController extends StateNotifier<List<HodIntervention>> {
  HodInterventionsController() : super(_interventions);

  void markFollowedUp(String id) {
    state = [
      for (final item in state)
        if (item.id == id) item.copyWith(followedUp: true) else item,
    ];
  }
}

final hodInterventionsProvider = Provider<List<HodIntervention>>(
  (ref) => ref.watch(hodInterventionsControllerProvider),
);

const _pendingApprovals = <HodApproval>[
  HodApproval(
    id: 'bio-f2a-cat2',
    subject: 'Biology',
    classLabel: 'Form 2A',
    assessmentType: 'CAT 2',
    teacherName: 'Mwalimu Grace Ndosi',
    submittedAgo: '2 hours ago',
    studentCount: 36,
    maxScore: 30,
    classAverage: 18.4,
    highest: 29,
    lowest: 6,
    distribution: {'A': 4, 'B': 8, 'C': 12, 'D': 8, 'F': 4},
  ),
  HodApproval(
    id: 'chem-f3b-mid',
    subject: 'Chemistry',
    classLabel: 'Form 3B',
    assessmentType: 'Midterm',
    teacherName: 'Ms. Amina Rashidi',
    submittedAgo: 'yesterday',
    studentCount: 40,
    maxScore: 50,
    classAverage: 28.2,
    highest: 47,
    lowest: 12,
    distribution: {'A': 2, 'B': 6, 'C': 14, 'D': 12, 'F': 6},
  ),
  HodApproval(
    id: 'physics-f3a-cat2',
    subject: 'Physics',
    classLabel: 'Form 3A',
    assessmentType: 'CAT 2',
    teacherName: 'Mwalimu Rose Mhina',
    submittedAgo: '3 days ago',
    studentCount: 42,
    maxScore: 30,
    classAverage: 19.8,
    highest: 30,
    lowest: 8,
    distribution: {'A': 6, 'B': 12, 'C': 14, 'D': 8, 'F': 2},
  ),
];

const _approvalHistory = <HodApproval>[
  HodApproval(
    id: 'bio-f1a-cat1',
    subject: 'Biology',
    classLabel: 'Form 1A',
    assessmentType: 'CAT 1',
    teacherName: 'Mwalimu Grace Ndosi',
    submittedAgo: '5 days ago',
    studentCount: 38,
    maxScore: 30,
    classAverage: 21.2,
    highest: 30,
    lowest: 10,
    distribution: {'A': 8, 'B': 12, 'C': 10, 'D': 6, 'F': 2},
    status: HodApprovalStatus.approved,
  ),
  HodApproval(
    id: 'chem-f2b-cat1',
    subject: 'Chemistry',
    classLabel: 'Form 2B',
    assessmentType: 'CAT 1',
    teacherName: 'Ms. Amina Rashidi',
    submittedAgo: '1 week ago',
    studentCount: 36,
    maxScore: 30,
    classAverage: 15.1,
    highest: 28,
    lowest: 4,
    distribution: {'A': 2, 'B': 5, 'C': 10, 'D': 11, 'F': 8},
    status: HodApprovalStatus.rejected,
    rejectionReason:
        'Several outlier scores need verification. Please recheck.',
  ),
];

const _subjects = <HodSubjectAnalytics>[
  HodSubjectAnalytics(
    id: 'biology',
    name: 'Biology',
    average: 62.4,
    syllabusCompletion: 71,
    atRiskStudents: 24,
    classes: [
      HodClassAnalytics(
        classLabel: 'Form 1A',
        teacherName: 'Grace Ndosi',
        average: 68,
        studentCount: 38,
      ),
      HodClassAnalytics(
        classLabel: 'Form 2A',
        teacherName: 'Grace Ndosi',
        average: 61,
        studentCount: 36,
      ),
      HodClassAnalytics(
        classLabel: 'Form 3A',
        teacherName: 'Hassan Ally',
        average: 65,
        studentCount: 42,
      ),
    ],
  ),
  HodSubjectAnalytics(
    id: 'chemistry',
    name: 'Chemistry',
    average: 54.8,
    syllabusCompletion: 64,
    atRiskStudents: 41,
    classes: [
      HodClassAnalytics(
        classLabel: 'Form 1A',
        teacherName: 'Amina Rashidi',
        average: 62,
        studentCount: 38,
      ),
      HodClassAnalytics(
        classLabel: 'Form 2A',
        teacherName: 'Amina Rashidi',
        average: 55,
        studentCount: 36,
      ),
      HodClassAnalytics(
        classLabel: 'Form 3B',
        teacherName: 'Amina Rashidi',
        average: 45,
        studentCount: 40,
      ),
    ],
  ),
  HodSubjectAnalytics(
    id: 'physics',
    name: 'Physics',
    average: 66.8,
    syllabusCompletion: 68,
    atRiskStudents: 18,
    classes: [
      HodClassAnalytics(
        classLabel: 'Form 3A',
        teacherName: 'Rose Mhina',
        average: 67,
        studentCount: 42,
      ),
      HodClassAnalytics(
        classLabel: 'Form 3B',
        teacherName: 'Rose Mhina',
        average: 65,
        studentCount: 40,
      ),
      HodClassAnalytics(
        classLabel: 'Form 4A',
        teacherName: 'Peter Kimani',
        average: 69,
        studentCount: 38,
      ),
    ],
  ),
];

const _teachers = <HodTeacherSummary>[
  HodTeacherSummary(
    id: 'grace',
    name: 'Mwalimu Grace Ndosi',
    subjects: 'Biology Form 1-2',
    onTimeRate: 100,
    averageScore: 64.2,
    syllabusCompletion: 74,
  ),
  HodTeacherSummary(
    id: 'hassan',
    name: 'Mr. Hassan Ally',
    subjects: 'Biology Form 3-4',
    onTimeRate: 87,
    averageScore: 62.1,
    syllabusCompletion: 68,
  ),
  HodTeacherSummary(
    id: 'amina',
    name: 'Ms. Amina Rashidi',
    subjects: 'Chemistry',
    onTimeRate: 93,
    averageScore: 54.8,
    syllabusCompletion: 63,
  ),
  HodTeacherSummary(
    id: 'rose',
    name: 'Mwalimu Rose Mhina',
    subjects: 'Physics Form 2-3',
    onTimeRate: 95,
    averageScore: 66.8,
    syllabusCompletion: 68,
  ),
  HodTeacherSummary(
    id: 'peter',
    name: 'Mr. Peter Kimani',
    subjects: 'Physics Form 4-5',
    onTimeRate: 80,
    averageScore: 67.2,
    syllabusCompletion: 72,
  ),
];

const _alerts = <HodDepartmentAlert>[
  HodDepartmentAlert(
    id: 'chem-chronic-f3b',
    title: 'CHRONIC_UNDERPERFORMER',
    subject: 'Chemistry',
    classLabel: 'Form 3B',
    message:
        '6 students are below threshold for three consecutive assessments.',
    severity: HodAlertSeverity.high,
  ),
  HodDepartmentAlert(
    id: 'jabir-decline',
    title: 'SUDDEN_DECLINE',
    subject: 'Chemistry',
    classLabel: 'Form 1B',
    message: 'Jabir Hassan dropped 14 points.',
    severity: HodAlertSeverity.high,
    studentId: 'jabir',
  ),
  HodDepartmentAlert(
    id: 'amina-risk',
    title: 'AT_RISK',
    subject: 'Biology',
    classLabel: 'Form 3A',
    message: 'Amina Baraka Juma needs Biology support.',
    severity: HodAlertSeverity.medium,
    studentId: 'amina',
  ),
  HodDepartmentAlert(
    id: 'physics-volatile',
    title: 'VOLATILE_PERFORMANCE',
    subject: 'Physics',
    classLabel: 'Form 3',
    message: '3 students have unstable performance.',
    severity: HodAlertSeverity.medium,
  ),
];

const _pairings = <HodPairingSummary>[
  HodPairingSummary(
    id: 'chem-f3b',
    subject: 'Chemistry',
    classLabel: 'Form 3B',
    count: 3,
    status: 'SUGGESTED',
  ),
  HodPairingSummary(
    id: 'bio-f3a',
    subject: 'Biology',
    classLabel: 'Form 3A',
    count: 1,
    status: 'ACTIVE',
  ),
  HodPairingSummary(
    id: 'physics-f3b',
    subject: 'Physics',
    classLabel: 'Form 3B',
    count: 1,
    status: 'SUGGESTED',
  ),
];

const _interventions = <HodIntervention>[
  HodIntervention(
    id: 'chem-f3b-revision',
    title: 'Chemistry Form 3B',
    teacherName: 'Ms. Amina Rashidi',
    type: 'Additional Lessons Assigned',
    note: 'Additional revision sessions scheduled.',
    timeAgo: '2 weeks ago',
    followedUp: false,
  ),
  HodIntervention(
    id: 'bio-f3a-support',
    title: 'Biology Form 3A',
    teacherName: 'Mr. Hassan Ally',
    type: 'Teacher Support Given',
    note: 'Reviewed struggling students list with teacher.',
    timeAgo: '1 week ago',
    followedUp: true,
  ),
];

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
