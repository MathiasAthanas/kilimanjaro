import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/teacher_models.dart';

final teacherClassesProvider = Provider<List<TeacherClassSubject>>(
  (ref) => _classes,
);

final teacherClassByIdProvider = Provider.family<TeacherClassSubject?, String>((
  ref,
  id,
) {
  return _classes.where((item) => item.id == id).firstOrNull;
});

final teacherStudentsForClassProvider =
    Provider.family<List<TeacherStudent>, String>((ref, classSubjectId) {
      return _studentsByClass[classSubjectId] ?? const <TeacherStudent>[];
    });

final teacherStudentByIdProvider = Provider.family<TeacherStudent?, String>((
  ref,
  studentId,
) {
  for (final students in _studentsByClass.values) {
    final match = students.where((item) => item.id == studentId).firstOrNull;
    if (match != null) return match;
  }
  return null;
});

final teacherAssessmentsProvider = Provider<List<TeacherAssessment>>(
  (ref) => _assessments,
);

final teacherAssessmentByIdProvider =
    Provider.family<TeacherAssessment?, String>((ref, assessmentId) {
      return _assessments.where((item) => item.id == assessmentId).firstOrNull;
    });

final teacherMarksControllerProvider =
    StateNotifierProvider<
      TeacherMarksController,
      Map<String, List<TeacherMarkEntry>>
    >((ref) {
      return TeacherMarksController();
    });

class TeacherMarksController
    extends StateNotifier<Map<String, List<TeacherMarkEntry>>> {
  TeacherMarksController() : super(_initialMarks);

  void updateScore(String assessmentId, String studentId, double? score) {
    final rows = [...?state[assessmentId]];
    final index = rows.indexWhere((item) => item.student.id == studentId);
    if (index < 0) return;
    rows[index] = rows[index].copyWith(score: score, isAbsent: false);
    state = {...state, assessmentId: rows};
  }

  void markAbsent(String assessmentId, String studentId) {
    final rows = [...?state[assessmentId]];
    final index = rows.indexWhere((item) => item.student.id == studentId);
    if (index < 0) return;
    rows[index] = rows[index].copyWith(isAbsent: true, clearScore: true);
    state = {...state, assessmentId: rows};
  }
}

final teacherAttendanceSessionsProvider =
    Provider<List<TeacherAttendanceSession>>((ref) => _attendanceSessions);

final teacherAttendanceControllerProvider =
    StateNotifierProvider<
      TeacherAttendanceController,
      Map<String, Map<String, TeacherAttendanceStatus?>>
    >((ref) {
      return TeacherAttendanceController();
    });

class TeacherAttendanceController
    extends StateNotifier<Map<String, Map<String, TeacherAttendanceStatus?>>> {
  TeacherAttendanceController()
    : super({
        for (final session in _attendanceSessions)
          session.id: {
            for (final student
                in _studentsByClass[session.classSubjectId] ??
                    const <TeacherStudent>[])
              student.id: null,
          },
      });

  void setStatus(
    String sessionId,
    String studentId,
    TeacherAttendanceStatus status,
  ) {
    state = {
      ...state,
      sessionId: {...?state[sessionId], studentId: status},
    };
  }
}

final teacherAlertsProvider = Provider<List<TeacherPerformanceAlert>>(
  (ref) => _alerts,
);

final teacherAlertByIdProvider =
    Provider.family<TeacherPerformanceAlert?, String>((ref, id) {
      return _alerts.where((item) => item.id == id).firstOrNull;
    });

final teacherPairingsProvider = Provider<List<TeacherPairing>>(
  (ref) => _pairings,
);

final teacherPairingByIdProvider = Provider.family<TeacherPairing?, String>((
  ref,
  id,
) {
  return _pairings.where((item) => item.id == id).firstOrNull;
});

final teacherTimetableProvider = Provider<List<TeacherTimetableSlot>>(
  (ref) => _timetable,
);

final teacherSyllabusProvider = Provider<List<TeacherSyllabusProgress>>(
  (ref) => _syllabus,
);

final teacherAnnouncementsProvider = Provider<List<TeacherAnnouncement>>(
  (ref) => _announcements,
);

const _classes = <TeacherClassSubject>[
  TeacherClassSubject(
    id: 'math-f2a',
    subject: 'Mathematics',
    classLabel: 'Form 2A',
    studentCount: 38,
    averageScore: 68.4,
    attendanceRate: 91.2,
    nextLesson: 'Today 07:30',
  ),
  TeacherClassSubject(
    id: 'math-f3a',
    subject: 'Mathematics',
    classLabel: 'Form 3A',
    studentCount: 42,
    averageScore: 75.6,
    attendanceRate: 89.6,
    nextLesson: 'Tue 07:30',
  ),
  TeacherClassSubject(
    id: 'physics-f3a',
    subject: 'Physics',
    classLabel: 'Form 3A',
    studentCount: 42,
    averageScore: 72.1,
    attendanceRate: 88.9,
    nextLesson: 'Today 11:30',
  ),
  TeacherClassSubject(
    id: 'physics-f3b',
    subject: 'Physics',
    classLabel: 'Form 3B',
    studentCount: 40,
    averageScore: 70.8,
    attendanceRate: 94.0,
    nextLesson: 'Today 09:30',
  ),
];

final _baseStudents = <TeacherStudent>[
  const TeacherStudent(
    id: 'stu-amani',
    name: 'Amani Bakari',
    registrationNumber: 'KS-2024-0201',
    classLabel: 'Form 2A',
    averageScore: 74,
    attendanceRate: 92,
  ),
  const TeacherStudent(
    id: 'stu-baraka',
    name: 'Baraka Mwita',
    registrationNumber: 'KS-2024-0202',
    classLabel: 'Form 2A',
    averageScore: 63,
    attendanceRate: 88,
  ),
  const TeacherStudent(
    id: 'stu-dina',
    name: 'Dina Kamau',
    registrationNumber: 'KS-2024-0203',
    classLabel: 'Form 2A',
    averageScore: 81,
    attendanceRate: 95,
  ),
  const TeacherStudent(
    id: 'stu-john',
    name: 'John Mwangi',
    registrationNumber: 'KS-2024-0204',
    classLabel: 'Form 2A',
    averageScore: 40,
    attendanceRate: 82,
  ),
  const TeacherStudent(
    id: 'stu-grace',
    name: 'Grace Temba',
    registrationNumber: 'KS-2024-0205',
    classLabel: 'Form 2A',
    averageScore: 88,
    attendanceRate: 96,
  ),
  const TeacherStudent(
    id: 'stu-pendo',
    name: 'Pendo Shayo',
    registrationNumber: 'KS-2024-0206',
    classLabel: 'Form 2A',
    averageScore: 47,
    attendanceRate: 79,
  ),
];

final _form3Students = <TeacherStudent>[
  const TeacherStudent(
    id: 'stu-amina',
    name: 'Amina Baraka Juma',
    registrationNumber: 'KS-2024-00142',
    classLabel: 'Form 3A',
    averageScore: 79.3,
    attendanceRate: 89.6,
    currentMark: 36,
  ),
  const TeacherStudent(
    id: 'stu-neema',
    name: 'Neema Hassan',
    registrationNumber: 'KS-2024-00143',
    classLabel: 'Form 3A',
    averageScore: 76,
    attendanceRate: 91,
  ),
  const TeacherStudent(
    id: 'stu-brian',
    name: 'Brian Mwangi',
    registrationNumber: 'KS-2024-00144',
    classLabel: 'Form 3A',
    averageScore: 84,
    attendanceRate: 94,
  ),
  const TeacherStudent(
    id: 'stu-salma',
    name: 'Salma Omari',
    registrationNumber: 'KS-2024-00145',
    classLabel: 'Form 3A',
    averageScore: 69,
    attendanceRate: 86,
  ),
  const TeacherStudent(
    id: 'stu-isaac',
    name: 'Isaac Peter',
    registrationNumber: 'KS-2024-00146',
    classLabel: 'Form 3A',
    averageScore: 71,
    attendanceRate: 90,
  ),
];

final _studentsByClass = <String, List<TeacherStudent>>{
  'math-f2a': _baseStudents,
  'math-f3a': _form3Students,
  'physics-f3a': _form3Students,
  'physics-f3b': [
    const TeacherStudent(
      id: 'stu-jabir',
      name: 'Jabir Hassan',
      registrationNumber: 'KS-2025-00089',
      classLabel: 'Form 3B',
      averageScore: 70.6,
      attendanceRate: 94,
    ),
    const TeacherStudent(
      id: 'stu-rehema',
      name: 'Rehema Ally',
      registrationNumber: 'KS-2025-00090',
      classLabel: 'Form 3B',
      averageScore: 78,
      attendanceRate: 95,
    ),
    const TeacherStudent(
      id: 'stu-omari',
      name: 'Omari Said',
      registrationNumber: 'KS-2025-00091',
      classLabel: 'Form 3B',
      averageScore: 66,
      attendanceRate: 88,
    ),
  ],
};

const _assessments = <TeacherAssessment>[
  TeacherAssessment(
    id: 'assess-math-f2a-cat1',
    classSubjectId: 'math-f2a',
    title: 'CAT 1',
    maxScore: 30,
    status: TeacherAssessmentStatus.locked,
    dueLabel: 'Approved',
    enteredCount: 38,
    totalStudents: 38,
  ),
  TeacherAssessment(
    id: 'assess-math-f2a-cat2',
    classSubjectId: 'math-f2a',
    title: 'CAT 2',
    maxScore: 30,
    status: TeacherAssessmentStatus.open,
    dueLabel: 'Due today',
    enteredCount: 0,
    totalStudents: 38,
  ),
  TeacherAssessment(
    id: 'assess-math-f3a-mid',
    classSubjectId: 'math-f3a',
    title: 'Midterm',
    maxScore: 50,
    status: TeacherAssessmentStatus.open,
    dueLabel: 'Due Friday',
    enteredCount: 1,
    totalStudents: 42,
  ),
  TeacherAssessment(
    id: 'assess-physics-f3a-cat2',
    classSubjectId: 'physics-f3a',
    title: 'CAT 2',
    maxScore: 30,
    status: TeacherAssessmentStatus.open,
    dueLabel: 'Due tomorrow',
    enteredCount: 0,
    totalStudents: 42,
  ),
  TeacherAssessment(
    id: 'assess-physics-f3b-cat1',
    classSubjectId: 'physics-f3b',
    title: 'CAT 1',
    maxScore: 30,
    status: TeacherAssessmentStatus.approved,
    dueLabel: 'HOD approved',
    enteredCount: 40,
    totalStudents: 40,
  ),
];

final _initialMarks = <String, List<TeacherMarkEntry>>{
  for (final assessment in _assessments)
    assessment.id: [
      for (final student
          in _studentsByClass[assessment.classSubjectId] ??
              const <TeacherStudent>[])
        TeacherMarkEntry(student: student, score: student.currentMark),
    ],
};

const _attendanceSessions = <TeacherAttendanceSession>[
  TeacherAttendanceSession(
    id: 'att-math-f2a',
    classSubjectId: 'math-f2a',
    title: 'Mathematics Form 2A',
    timeLabel: '07:30-08:30',
    statusLabel: 'Not yet marked',
    isUrgent: true,
  ),
  TeacherAttendanceSession(
    id: 'att-physics-f3b',
    classSubjectId: 'physics-f3b',
    title: 'Physics Form 3B',
    timeLabel: '09:30-10:30',
    statusLabel: 'Not yet marked',
    isUrgent: false,
  ),
  TeacherAttendanceSession(
    id: 'att-physics-f3a',
    classSubjectId: 'physics-f3a',
    title: 'Physics Form 3A',
    timeLabel: '11:30-12:30',
    statusLabel: 'Future slot',
    isUrgent: false,
  ),
];

const _alerts = <TeacherPerformanceAlert>[
  TeacherPerformanceAlert(
    id: 'alert-amina-biology',
    studentId: 'stu-amina',
    studentName: 'Amina Baraka Juma',
    classLabel: 'Form 3A',
    subject: 'Biology',
    type: 'AT_RISK',
    message: 'Below expected level; school support is active.',
    severity: TeacherAlertSeverity.high,
    previousScore: 72,
    currentScore: 65,
  ),
  TeacherPerformanceAlert(
    id: 'alert-john-math',
    studentId: 'stu-john',
    studentName: 'John Mwangi',
    classLabel: 'Form 2A',
    subject: 'Mathematics',
    type: 'SUDDEN_DECLINE',
    message: 'Major drop from 80% to 40% in CAT 2.',
    severity: TeacherAlertSeverity.critical,
    previousScore: 80,
    currentScore: 40,
  ),
  TeacherPerformanceAlert(
    id: 'alert-pendo-math',
    studentId: 'stu-pendo',
    studentName: 'Pendo Shayo',
    classLabel: 'Form 2A',
    subject: 'Mathematics',
    type: 'CHRONIC_UNDERPERFORMER',
    message: 'Three consecutive terms below 50%.',
    severity: TeacherAlertSeverity.high,
    previousScore: 49,
    currentScore: 47,
  ),
];

final _pairings = <TeacherPairing>[
  TeacherPairing(
    id: 'pair-john-grace',
    classSubjectId: 'math-f2a',
    subject: 'Mathematics',
    classLabel: 'Form 2A',
    supportStudent: _baseStudents[3],
    mentorStudent: _baseStudents[4],
    reason: 'John needs structured peer support after a sudden decline.',
    status: TeacherPairingStatus.suggested,
  ),
];

const _timetable = <TeacherTimetableSlot>[
  TeacherTimetableSlot(
    day: 'Mon',
    time: '07:30',
    classSubjectId: 'math-f2a',
    title: 'Math F2A',
    room: 'Room 12',
  ),
  TeacherTimetableSlot(
    day: 'Mon',
    time: '09:30',
    classSubjectId: 'physics-f3b',
    title: 'Physics F3B',
    room: 'Lab 2',
  ),
  TeacherTimetableSlot(
    day: 'Mon',
    time: '11:30',
    classSubjectId: 'physics-f3a',
    title: 'Physics F3A',
    room: 'Lab 1',
  ),
  TeacherTimetableSlot(
    day: 'Tue',
    time: '07:30',
    classSubjectId: 'math-f3a',
    title: 'Math F3A',
    room: 'Room 8',
  ),
  TeacherTimetableSlot(
    day: 'Wed',
    time: '11:30',
    classSubjectId: 'math-f3a',
    title: 'Math F3A',
    room: 'Room 8',
  ),
  TeacherTimetableSlot(
    day: 'Fri',
    time: '10:30',
    classSubjectId: 'physics-f3b',
    title: 'Physics F3B',
    room: 'Lab 2',
  ),
];

const _syllabus = <TeacherSyllabusProgress>[
  TeacherSyllabusProgress(
    classSubjectId: 'math-f2a',
    title: 'Mathematics Form 2A',
    covered: 12,
    total: 18,
    nextTopic: 'Linear equations',
  ),
  TeacherSyllabusProgress(
    classSubjectId: 'math-f3a',
    title: 'Mathematics Form 3A',
    covered: 14,
    total: 18,
    nextTopic: 'Trigonometry',
  ),
  TeacherSyllabusProgress(
    classSubjectId: 'physics-f3a',
    title: 'Physics Form 3A',
    covered: 10,
    total: 16,
    nextTopic: 'Waves',
  ),
  TeacherSyllabusProgress(
    classSubjectId: 'physics-f3b',
    title: 'Physics Form 3B',
    covered: 11,
    total: 16,
    nextTopic: 'Electricity',
  ),
];

const _announcements = <TeacherAnnouncement>[
  TeacherAnnouncement(
    id: 'teach-ann-1',
    title: 'Form 3A Midterm Revision',
    body: 'Revision materials are available for Mathematics and Physics.',
    target: 'Students',
    dateLabel: 'Today',
  ),
  TeacherAnnouncement(
    id: 'teach-ann-2',
    title: 'Science Lab Schedule',
    body: 'Physics practical sessions move to Lab 2 this week.',
    target: 'Students',
    dateLabel: 'Yesterday',
  ),
];

extension<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
