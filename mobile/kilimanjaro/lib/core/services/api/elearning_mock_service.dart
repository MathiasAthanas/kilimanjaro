// ignore_for_file: unused_element
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/elearning_models.dart';
import 'elearning_api_service.dart';

/// Drop-in replacement for [ElearningApiService] that returns realistic demo
/// data with no network calls.  Activated via [AppConfig.useMockElearning].
///
/// To reconnect to the real backend: set AppConfig.useMockElearning = false.
class ElearningMockService extends ElearningApiService {
  ElearningMockService() : super(const FlutterSecureStorage());

  // Adds a brief artificial delay so loading indicators appear naturally.
  static const _d = Duration(milliseconds: 380);

  // ─── Stable IDs ─────────────────────────────────────────────────────────────

  // Courses
  static const _cMath = 'c-math-f4';
  static const _cPhys = 'c-phys-f6';
  static const _cHist = 'c-hist-f3';
  static const _cBiol = 'c-biol-f2';
  static const _cEng  = 'c-eng-f5';

  // Lessons — named <subject initial>_<number>
  static const _lM1 = 'l-m-1';
  static const _lM2 = 'l-m-2';
  static const _lM3 = 'l-m-3';
  static const _lP1 = 'l-p-1';
  static const _lP2 = 'l-p-2';
  static const _lP3 = 'l-p-3';
  static const _lH1 = 'l-h-1';
  static const _lH2 = 'l-h-2';
  static const _lH3 = 'l-h-3';
  static const _lB1 = 'l-b-1';
  static const _lB2 = 'l-b-2';
  static const _lB3 = 'l-b-3';
  static const _lE1 = 'l-e-1';
  static const _lE2 = 'l-e-2';
  static const _lE3 = 'l-e-3';

  // Assignments
  static const _aM1 = 'a-m-1';
  static const _aM2 = 'a-m-2';
  static const _aP1 = 'a-p-1';
  static const _aP2 = 'a-p-2';
  static const _aH1 = 'a-h-1';
  static const _aB1 = 'a-b-1';
  static const _aE1 = 'a-e-1';

  // Quizzes
  static const _qM1 = 'q-m-1';
  static const _qP1 = 'q-p-1';
  static const _qH1 = 'q-h-1';
  static const _qB1 = 'q-b-1';
  static const _qE1 = 'q-e-1';

  // ─── Material helpers ────────────────────────────────────────────────────────

  static ElearningMaterialModel _note({
    required String id,
    required String lessonId,
    required String courseId,
    required String title,
    required String body,
    required int order,
  }) =>
      ElearningMaterialModel(
        id: id,
        lessonId: lessonId,
        courseSpaceId: courseId,
        title: title,
        type: 'NOTE',
        status: 'PUBLISHED',
        orderIndex: order,
        body: body,
        downloadable: false,
        viewCount: 14 + order * 3,
      );

  static ElearningMaterialModel _slide({
    required String id,
    required String lessonId,
    required String courseId,
    required String title,
    required int order,
  }) =>
      ElearningMaterialModel(
        id: id,
        lessonId: lessonId,
        courseSpaceId: courseId,
        title: title,
        type: 'SLIDE',
        status: 'PUBLISHED',
        orderIndex: order,
        fileKey: 'elearning/slides/$id.pdf',
        fileOriginalName: '$title.pdf',
        fileMimeType: 'application/pdf',
        fileSizeBytes: 384000,
        downloadable: true,
        viewCount: 9 + order * 2,
      );

  // ─── Lesson builders ─────────────────────────────────────────────────────────

  static ElearningLessonModel _lesson({
    required String id,
    required String courseId,
    required String title,
    required String description,
    required int orderIndex,
    required int weekNumber,
    required int estimatedMinutes,
    List<ElearningMaterialModel> materials = const [],
  }) =>
      ElearningLessonModel(
        id: id,
        courseSpaceId: courseId,
        title: title,
        description: description,
        orderIndex: orderIndex,
        weekNumber: weekNumber,
        status: 'PUBLISHED',
        publishedAt: DateTime(2025, 1, 13 + orderIndex),
        estimatedMinutes: estimatedMinutes,
        materials: materials,
      );

  // ─── Pre-built lessons (lightweight — materials loaded separately) ────────────

  static final _mathLessons = [
    _lesson(id: _lM1, courseId: _cMath, title: 'Introduction to Algebra',         description: 'Variables, constants and basic algebraic expressions.',      orderIndex: 1, weekNumber: 1, estimatedMinutes: 45),
    _lesson(id: _lM2, courseId: _cMath, title: 'Quadratic Equations',              description: 'Solving by factorisation, completing the square and formula.', orderIndex: 2, weekNumber: 2, estimatedMinutes: 60),
    _lesson(id: _lM3, courseId: _cMath, title: 'Functions and Graphs',             description: 'Domain, range and plotting linear and quadratic functions.',    orderIndex: 3, weekNumber: 3, estimatedMinutes: 45),
  ];

  static final _physLessons = [
    _lesson(id: _lP1, courseId: _cPhys, title: 'Mechanics and Motion',            description: 'Distance, displacement, speed, velocity and acceleration.',   orderIndex: 1, weekNumber: 1, estimatedMinutes: 50),
    _lesson(id: _lP2, courseId: _cPhys, title: "Newton's Laws of Motion",         description: 'All three laws with real-world examples and problem sets.',   orderIndex: 2, weekNumber: 2, estimatedMinutes: 55),
    _lesson(id: _lP3, courseId: _cPhys, title: 'Energy and Work',                 description: 'Kinetic energy, potential energy and the work-energy theorem.', orderIndex: 3, weekNumber: 3, estimatedMinutes: 55),
  ];

  static final _histLessons = [
    _lesson(id: _lH1, courseId: _cHist, title: 'Pre-Colonial East Africa',        description: 'Kingdoms, trade routes and societies before colonisation.',    orderIndex: 1, weekNumber: 1, estimatedMinutes: 40),
    _lesson(id: _lH2, courseId: _cHist, title: 'Colonial Period 1885–1961',       description: 'The Berlin Conference, resistance movements and impact.',      orderIndex: 2, weekNumber: 2, estimatedMinutes: 45),
    _lesson(id: _lH3, courseId: _cHist, title: 'Independence and Nationalism',    description: 'TANU, Julius Nyerere and the road to uhuru.',                  orderIndex: 3, weekNumber: 3, estimatedMinutes: 45),
  ];

  static final _biolLessons = [
    _lesson(id: _lB1, courseId: _cBiol, title: 'Cell Structure and Function',     description: 'Plant and animal cells, organelles and their roles.',          orderIndex: 1, weekNumber: 1, estimatedMinutes: 50),
    _lesson(id: _lB2, courseId: _cBiol, title: 'Photosynthesis',                  description: 'Light and dark reactions, chlorophyll and glucose production.', orderIndex: 2, weekNumber: 2, estimatedMinutes: 45),
    _lesson(id: _lB3, courseId: _cBiol, title: 'Human Digestive System',          description: 'Organs, enzymes and nutrient absorption pathways.',             orderIndex: 3, weekNumber: 3, estimatedMinutes: 55),
  ];

  static final _engLessons = [
    _lesson(id: _lE1, courseId: _cEng,  title: 'Essay Writing Techniques',        description: 'Argumentative, descriptive and expository essay structures.',  orderIndex: 1, weekNumber: 1, estimatedMinutes: 40),
    _lesson(id: _lE2, courseId: _cEng,  title: 'Comprehension and Summary',       description: 'Skimming, scanning and summarising unseen passages.',          orderIndex: 2, weekNumber: 2, estimatedMinutes: 40),
    _lesson(id: _lE3, courseId: _cEng,  title: 'Poetry Analysis',                 description: 'Themes, imagery, tone and poetic devices in set poems.',       orderIndex: 3, weekNumber: 3, estimatedMinutes: 45),
  ];

  // ─── Courses ─────────────────────────────────────────────────────────────────

  static final _courses = [
    ElearningCourseModel(
      id: _cMath,
      classSubjectId: 'cs-math-f4',
      teacherId: 'teacher-mwangi',
      termId: 'term-2025-1',
      academicYearId: 'ay-2025',
      subjectName: 'Mathematics',
      className: 'Form 4',
      educationStage: 'O_LEVEL',
      classLevel: 4,
      description: 'Algebra, geometry, trigonometry and statistics for O-Level candidates.',
      coverColor: '#4338CA',
      coverEmoji: '📐',
      status: 'ACTIVE',
      publishedAt: DateTime(2025, 1, 10),
      enrolledCount: 34,
      lessons: _mathLessons,
      createdAt: DateTime(2025, 1, 8),
      updatedAt: DateTime(2025, 5, 20),
    ),
    ElearningCourseModel(
      id: _cPhys,
      classSubjectId: 'cs-phys-f6',
      teacherId: 'teacher-kimaro',
      termId: 'term-2025-1',
      academicYearId: 'ay-2025',
      subjectName: 'Physics',
      className: 'Form 6 PCM',
      educationStage: 'A_LEVEL',
      classLevel: 6,
      combinationId: 'combo-pcm',
      description: 'Advanced mechanics, electricity, waves and modern physics for A-Level.',
      coverColor: '#0891B2',
      coverEmoji: '⚛️',
      status: 'ACTIVE',
      publishedAt: DateTime(2025, 1, 10),
      enrolledCount: 18,
      lessons: _physLessons,
      createdAt: DateTime(2025, 1, 8),
      updatedAt: DateTime(2025, 5, 19),
    ),
    ElearningCourseModel(
      id: _cHist,
      classSubjectId: 'cs-hist-f3',
      teacherId: 'teacher-osei',
      termId: 'term-2025-1',
      academicYearId: 'ay-2025',
      subjectName: 'History',
      className: 'Form 3',
      educationStage: 'O_LEVEL',
      classLevel: 3,
      description: 'East African and world history from pre-colonial times to the present.',
      coverColor: '#B45309',
      coverEmoji: '🏛️',
      status: 'ACTIVE',
      publishedAt: DateTime(2025, 1, 11),
      enrolledCount: 31,
      lessons: _histLessons,
      createdAt: DateTime(2025, 1, 9),
      updatedAt: DateTime(2025, 5, 18),
    ),
    ElearningCourseModel(
      id: _cBiol,
      classSubjectId: 'cs-biol-f2',
      teacherId: 'teacher-hassan',
      termId: 'term-2025-1',
      academicYearId: 'ay-2025',
      subjectName: 'Biology',
      className: 'Form 2',
      educationStage: 'O_LEVEL',
      classLevel: 2,
      description: 'Cells, living organisms, ecology and human biology for Form 2.',
      coverColor: '#15803D',
      coverEmoji: '🔬',
      status: 'ACTIVE',
      publishedAt: DateTime(2025, 1, 12),
      enrolledCount: 29,
      lessons: _biolLessons,
      createdAt: DateTime(2025, 1, 9),
      updatedAt: DateTime(2025, 5, 17),
    ),
    ElearningCourseModel(
      id: _cEng,
      classSubjectId: 'cs-eng-f5',
      teacherId: 'teacher-shirima',
      termId: 'term-2025-1',
      academicYearId: 'ay-2025',
      subjectName: 'English Language',
      className: 'Form 5',
      educationStage: 'A_LEVEL',
      classLevel: 5,
      description: 'Communication skills, essay writing, comprehension and literature analysis.',
      coverColor: '#7C3AED',
      coverEmoji: '📖',
      status: 'ACTIVE',
      publishedAt: DateTime(2025, 1, 12),
      enrolledCount: 22,
      lessons: _engLessons,
      createdAt: DateTime(2025, 1, 10),
      updatedAt: DateTime(2025, 5, 16),
    ),
  ];

  // ─── Materials per lesson ─────────────────────────────────────────────────────

  static final _materialsByLesson = <String, List<ElearningMaterialModel>>{
    _lM1: [
      _note(id: 'mat-m1-1', lessonId: _lM1, courseId: _cMath, title: 'Algebra Notes – Week 1',    order: 1,
        body: 'An algebraic expression contains variables (letters) and constants (numbers). '
              'Example: 3x + 5 where x is the variable and 5 is the constant. '
              'Key rules: like terms can be added or subtracted; when multiplying powers with the same base, add the exponents.',
      ),
      _slide(id: 'mat-m1-2', lessonId: _lM1, courseId: _cMath, title: 'Algebra Slides – Week 1',   order: 2),
    ],
    _lM2: [
      _note(id: 'mat-m2-1', lessonId: _lM2, courseId: _cMath, title: 'Quadratic Equations Notes',  order: 1,
        body: 'A quadratic equation has the form ax² + bx + c = 0. '
              'Three methods to solve: (1) Factorisation, (2) Completing the square, (3) Quadratic formula: x = (−b ± √(b²−4ac)) / 2a. '
              'The discriminant b²−4ac tells us the nature of roots.',
      ),
      _slide(id: 'mat-m2-2', lessonId: _lM2, courseId: _cMath, title: 'Quadratic Equations Slides', order: 2),
    ],
    _lM3: [
      _note(id: 'mat-m3-1', lessonId: _lM3, courseId: _cMath, title: 'Functions and Graphs Notes',  order: 1,
        body: 'A function maps every input (domain) to exactly one output (range). '
              'Linear function: f(x) = mx + c produces a straight line with gradient m and y-intercept c. '
              'Quadratic function: f(x) = ax² + bx + c produces a parabola.',
      ),
    ],
    _lP1: [
      _note(id: 'mat-p1-1', lessonId: _lP1, courseId: _cPhys, title: 'Mechanics Notes – Week 1',    order: 1,
        body: 'Distance is the total path length; displacement is the shortest path from start to finish. '
              'Speed = distance / time. Velocity = displacement / time (vector). '
              'Acceleration = change in velocity / time taken (a = Δv / Δt).',
      ),
      _slide(id: 'mat-p1-2', lessonId: _lP1, courseId: _cPhys, title: 'Mechanics Slides – Week 1',  order: 2),
    ],
    _lP2: [
      _note(id: 'mat-p2-1', lessonId: _lP2, courseId: _cPhys, title: "Newton's Laws Notes",          order: 1,
        body: "Newton's 1st Law: An object remains at rest or in uniform motion unless acted on by a net force. "
              "Newton's 2nd Law: F = ma — net force equals mass times acceleration. "
              "Newton's 3rd Law: Every action has an equal and opposite reaction.",
      ),
      _slide(id: 'mat-p2-2', lessonId: _lP2, courseId: _cPhys, title: "Newton's Laws Slides",        order: 2),
    ],
    _lP3: [
      _note(id: 'mat-p3-1', lessonId: _lP3, courseId: _cPhys, title: 'Energy and Work Notes',         order: 1,
        body: 'Work done W = Fd·cosθ (force × displacement × cosine of angle). '
              'Kinetic Energy KE = ½mv². Gravitational Potential Energy GPE = mgh. '
              'Work-Energy Theorem: net work done on an object equals its change in kinetic energy.',
      ),
    ],
    _lH1: [
      _note(id: 'mat-h1-1', lessonId: _lH1, courseId: _cHist, title: 'Pre-Colonial Africa Notes',    order: 1,
        body: 'East Africa had well-organised states before European colonisation. '
              'Notable kingdoms include: Buganda, Bunyoro, and coastal Swahili city-states. '
              'Long-distance trade (gold, ivory, slaves) connected the interior to the Indian Ocean coast.',
      ),
      _slide(id: 'mat-h1-2', lessonId: _lH1, courseId: _cHist, title: 'Pre-Colonial Africa Slides',  order: 2),
    ],
    _lH2: [
      _note(id: 'mat-h2-1', lessonId: _lH2, courseId: _cHist, title: 'Colonial Period Notes',         order: 1,
        body: 'The Berlin Conference (1884–1885) partitioned Africa among European powers. '
              'Tanganyika came under German rule, then British mandate after WWI. '
              'Resistance: Maji Maji Uprising (1905–1907) was a major revolt against German taxation.',
      ),
      _slide(id: 'mat-h2-2', lessonId: _lH2, courseId: _cHist, title: 'Colonial Period Slides',      order: 2),
    ],
    _lH3: [
      _note(id: 'mat-h3-1', lessonId: _lH3, courseId: _cHist, title: 'Independence Notes',            order: 1,
        body: 'TANU (Tanganyika African National Union) was founded by Julius Nyerere in 1954. '
              'Tanganyika gained independence on 9 December 1961. '
              'In 1964, Tanganyika and Zanzibar merged to form the United Republic of Tanzania.',
      ),
    ],
    _lB1: [
      _note(id: 'mat-b1-1', lessonId: _lB1, courseId: _cBiol, title: 'Cell Biology Notes',            order: 1,
        body: 'All living things are made of cells. Animal cells have a cell membrane, nucleus, mitochondria and cytoplasm. '
              'Plant cells additionally have: cell wall (cellulose), chloroplasts and a large vacuole. '
              'The nucleus controls cell activities and contains DNA.',
      ),
      _slide(id: 'mat-b1-2', lessonId: _lB1, courseId: _cBiol, title: 'Cell Structure Slides',        order: 2),
    ],
    _lB2: [
      _note(id: 'mat-b2-1', lessonId: _lB2, courseId: _cBiol, title: 'Photosynthesis Notes',           order: 1,
        body: 'Photosynthesis converts light energy into chemical energy. '
              'Equation: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. '
              'Takes place in chloroplasts; chlorophyll absorbs red and blue wavelengths.',
      ),
    ],
    _lB3: [
      _note(id: 'mat-b3-1', lessonId: _lB3, courseId: _cBiol, title: 'Digestion Notes',               order: 1,
        body: 'Digestion breaks down food into absorbable nutrients. '
              'Mechanical digestion (teeth, stomach churning) and chemical digestion (enzymes). '
              'Key enzymes: amylase (starch→sugars), protease (proteins→amino acids), lipase (fats→fatty acids).',
      ),
      _slide(id: 'mat-b3-2', lessonId: _lB3, courseId: _cBiol, title: 'Digestive System Diagram',     order: 2),
    ],
    _lE1: [
      _note(id: 'mat-e1-1', lessonId: _lE1, courseId: _cEng,  title: 'Essay Writing Notes',           order: 1,
        body: 'Every essay has three parts: Introduction (hook + thesis), Body (supporting paragraphs), Conclusion (restate + call to action). '
              'Argumentative essays present a clear stance supported by evidence. '
              'Use topic sentences to open each body paragraph.',
      ),
      _slide(id: 'mat-e1-2', lessonId: _lE1, courseId: _cEng,  title: 'Essay Writing Slides',         order: 2),
    ],
    _lE2: [
      _note(id: 'mat-e2-1', lessonId: _lE2, courseId: _cEng,  title: 'Comprehension Notes',           order: 1,
        body: 'Skimming = reading for the main idea (read headings, first and last sentences). '
              'Scanning = looking for specific information (names, dates, figures). '
              'Summary = reduce a passage to key points in your own words, around 1/3 of original length.',
      ),
    ],
    _lE3: [
      _note(id: 'mat-e3-1', lessonId: _lE3, courseId: _cEng,  title: 'Poetry Analysis Notes',         order: 1,
        body: 'SLIMS framework: Subject (what the poem is about), Language (word choices), Imagery (metaphors, similes), Mood/Tone, Structure (rhyme, rhythm). '
              'Common devices: alliteration, onomatopoeia, personification, enjambment.',
      ),
      _slide(id: 'mat-e3-2', lessonId: _lE3, courseId: _cEng,  title: 'Poetry Devices Slides',        order: 2),
    ],
  };

  // ─── Assignments ─────────────────────────────────────────────────────────────

  static final _assignmentsByCourse = <String, List<ElearningAssignmentModel>>{
    _cMath: [
      ElearningAssignmentModel(
        id: _aM1, courseSpaceId: _cMath, lessonId: _lM1,
        title: 'Algebra Practice Set 1',
        instructions: 'Simplify the following expressions and solve for x:\n'
            '1. 3x + 7 = 22\n2. 5(x − 2) = 3x + 4\n3. 2x² − 8 = 0\n'
            'Show all working. Write answers on the provided sheet.',
        type: 'TEXT', maxScore: 30, allowLateSubmission: true, latePenaltyPercent: 10,
        dueAt: DateTime(2025, 5, 10), status: 'CLOSED',
        publishedAt: DateTime(2025, 5, 3), closedAt: DateTime(2025, 5, 12),
      ),
      ElearningAssignmentModel(
        id: _aM2, courseSpaceId: _cMath, lessonId: _lM2,
        title: 'Quadratic Equations Worksheet',
        instructions: 'Solve the following quadratic equations using the method indicated:\n'
            '1. x² − 5x + 6 = 0 (factorisation)\n2. 2x² + 4x − 6 = 0 (quadratic formula)\n'
            '3. x² + 6x + 9 = 0 (completing the square)\n'
            'Upload a photo of your working.',
        type: 'BOTH', maxScore: 40, allowLateSubmission: true, latePenaltyPercent: 5,
        dueAt: DateTime(2025, 5, 28), status: 'PUBLISHED',
        publishedAt: DateTime(2025, 5, 20),
      ),
    ],
    _cPhys: [
      ElearningAssignmentModel(
        id: _aP1, courseSpaceId: _cPhys, lessonId: _lP2,
        title: "Newton's Laws Problem Set",
        instructions: 'Answer the following problems, showing all formulae and units:\n'
            '1. A 5 kg object accelerates at 3 m/s². What net force acts on it?\n'
            '2. A car brakes from 20 m/s to rest in 4 s. Find deceleration and braking force (mass = 800 kg).\n'
            '3. Describe a real-life example of each of Newton\'s three laws.',
        type: 'TEXT', maxScore: 50, allowLateSubmission: false,
        dueAt: DateTime(2025, 5, 25), status: 'PUBLISHED',
        publishedAt: DateTime(2025, 5, 18),
      ),
      ElearningAssignmentModel(
        id: _aP2, courseSpaceId: _cPhys, lessonId: _lP3,
        title: 'Energy Conservation Lab Report',
        instructions: 'Write a short lab report (400–600 words) on the pendulum energy experiment.\n'
            'Include: aim, hypothesis, procedure, results table and conclusion.\n'
            'Attach your data sheet as an image.',
        type: 'BOTH', maxScore: 60, allowLateSubmission: true, latePenaltyPercent: 15,
        dueAt: DateTime(2025, 6, 5), status: 'PUBLISHED',
        publishedAt: DateTime(2025, 5, 22),
      ),
    ],
    _cHist: [
      ElearningAssignmentModel(
        id: _aH1, courseSpaceId: _cHist, lessonId: _lH2,
        title: 'Effects of Colonialism Essay',
        instructions: 'Write a 500-word essay on the political and economic effects of British colonial rule on Tanganyika. '
            'Use at least three specific examples. Marks awarded for content (20), structure (10) and language (10).',
        type: 'TEXT', maxScore: 40, allowLateSubmission: true, latePenaltyPercent: 10,
        dueAt: DateTime(2025, 5, 30), status: 'PUBLISHED',
        publishedAt: DateTime(2025, 5, 21),
      ),
    ],
    _cBiol: [
      ElearningAssignmentModel(
        id: _aB1, courseSpaceId: _cBiol, lessonId: _lB2,
        title: 'Photosynthesis Diagram Task',
        instructions: 'Draw and fully label a chloroplast. '
            'Write the balanced equation for photosynthesis and explain what happens in the light-dependent and light-independent reactions. '
            'You may scan or photograph your diagram.',
        type: 'BOTH', maxScore: 35, allowLateSubmission: true, latePenaltyPercent: 5,
        dueAt: DateTime(2025, 5, 29), status: 'PUBLISHED',
        publishedAt: DateTime(2025, 5, 19),
      ),
    ],
    _cEng: [
      ElearningAssignmentModel(
        id: _aE1, courseSpaceId: _cEng, lessonId: _lE1,
        title: 'Argumentative Essay — Technology in Schools',
        instructions: 'Write a 400–500 word argumentative essay on the topic: '
            '"Technology improves learning in Tanzanian secondary schools." '
            'Present a clear position, use evidence and address a counter-argument. '
            'Marks: Content 20, Language 15, Structure 10, Mechanics 5.',
        type: 'TEXT', maxScore: 50, allowLateSubmission: true, latePenaltyPercent: 10,
        dueAt: DateTime(2025, 5, 27), status: 'PUBLISHED',
        publishedAt: DateTime(2025, 5, 17),
      ),
    ],
  };

  // ─── Mock submission (student has submitted aM1, currently graded) ───────────

  static final _mockSubmissions = <String, ElearningSubmissionModel>{
    _aM1: ElearningSubmissionModel(
      id: 'sub-m1-1',
      assignmentId: _aM1,
      studentId: 'student-demo',
      courseSpaceId: _cMath,
      textContent: '1. 3x + 7 = 22 → 3x = 15 → x = 5\n'
          '2. 5x − 10 = 3x + 4 → 2x = 14 → x = 7\n'
          '3. 2x² = 8 → x² = 4 → x = ±2',
      submittedAt: DateTime(2025, 5, 9, 14, 30),
      isLate: false,
      status: 'GRADED',
      score: 24,
      maxScore: 30,
      feedback: 'Good working shown throughout. Question 3 is correct but remember to state both roots clearly. Keep it up!',
      gradedAt: DateTime(2025, 5, 11, 9, 0),
      gradedBy: 'Mr. James Mwangi',
    ),
  };

  // ─── Quizzes ──────────────────────────────────────────────────────────────────

  static ElearningQuizOptionModel _opt(String id, String qId, String text, int order) =>
      ElearningQuizOptionModel(id: id, questionId: qId, text: text, orderIndex: order);

  static final _quizzesByCourse = <String, List<ElearningQuizModel>>{
    _cMath: [
      ElearningQuizModel(
        id: _qM1, courseSpaceId: _cMath, lessonId: _lM1,
        title: 'Algebra Fundamentals Quiz',
        instructions: 'Answer all 5 questions. You have 15 minutes. Choose the best answer for each question.',
        timeLimitMinutes: 15, maxAttempts: 2, passingScore: 60,
        status: 'PUBLISHED', publishedAt: DateTime(2025, 5, 5),
        totalPoints: 10,
        questions: [
          ElearningQuizQuestionModel(
            id: 'qq-m1-1', quizId: _qM1, type: 'MULTIPLE_CHOICE', orderIndex: 1, points: 2,
            prompt: 'What is the value of x in the equation  2x + 5 = 13?',
            correctAnswer: 'qq-m1-1-b', explanation: '2x = 13 − 5 = 8, therefore x = 4.',
            options: [
              _opt('qq-m1-1-a', 'qq-m1-1', 'x = 3', 1),
              _opt('qq-m1-1-b', 'qq-m1-1', 'x = 4', 2),
              _opt('qq-m1-1-c', 'qq-m1-1', 'x = 5', 3),
              _opt('qq-m1-1-d', 'qq-m1-1', 'x = 6', 4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-m1-2', quizId: _qM1, type: 'MULTIPLE_CHOICE', orderIndex: 2, points: 2,
            prompt: 'Which of the following is the correct factorisation of  3x² + 6x?',
            correctAnswer: 'qq-m1-2-a', explanation: 'Factor out 3x: 3x(x + 2).',
            options: [
              _opt('qq-m1-2-a', 'qq-m1-2', '3x(x + 2)', 1),
              _opt('qq-m1-2-b', 'qq-m1-2', '3(x² + 2x)', 2),
              _opt('qq-m1-2-c', 'qq-m1-2', 'x(3x + 6)', 3),
              _opt('qq-m1-2-d', 'qq-m1-2', '6x(x + 1)', 4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-m1-3', quizId: _qM1, type: 'TRUE_FALSE', orderIndex: 3, points: 2,
            prompt: 'A linear equation always produces a straight line when graphed.',
            correctAnswer: 'true', explanation: 'By definition, a linear equation produces a straight-line graph.',
            options: [
              _opt('qq-m1-3-t', 'qq-m1-3', 'True', 1),
              _opt('qq-m1-3-f', 'qq-m1-3', 'False', 2),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-m1-4', quizId: _qM1, type: 'MULTIPLE_CHOICE', orderIndex: 4, points: 2,
            prompt: 'If f(x) = 2x − 3, what is f(5)?',
            correctAnswer: 'qq-m1-4-a', explanation: 'f(5) = 2(5) − 3 = 10 − 3 = 7.',
            options: [
              _opt('qq-m1-4-a', 'qq-m1-4', '7', 1),
              _opt('qq-m1-4-b', 'qq-m1-4', '13', 2),
              _opt('qq-m1-4-c', 'qq-m1-4', '10', 3),
              _opt('qq-m1-4-d', 'qq-m1-4', '12', 4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-m1-5', quizId: _qM1, type: 'SHORT_ANSWER', orderIndex: 5, points: 2,
            prompt: 'Solve: x² − 9 = 0. Write both values of x.',
            correctAnswer: 'x = 3 or x = −3',
            explanation: 'x² = 9, so x = ±√9 = ±3.',
            options: [],
          ),
        ],
      ),
    ],
    _cPhys: [
      ElearningQuizModel(
        id: _qP1, courseSpaceId: _cPhys, lessonId: _lP2,
        title: "Motion and Forces Quiz",
        instructions: 'Answer all 5 questions. You have 20 minutes.',
        timeLimitMinutes: 20, maxAttempts: 2, passingScore: 60,
        status: 'PUBLISHED', publishedAt: DateTime(2025, 5, 8),
        totalPoints: 10,
        questions: [
          ElearningQuizQuestionModel(
            id: 'qq-p1-1', quizId: _qP1, type: 'MULTIPLE_CHOICE', orderIndex: 1, points: 2,
            prompt: "Which of Newton's laws is described by F = ma?",
            correctAnswer: 'qq-p1-1-b',
            options: [
              _opt('qq-p1-1-a', 'qq-p1-1', 'First Law',  1),
              _opt('qq-p1-1-b', 'qq-p1-1', 'Second Law', 2),
              _opt('qq-p1-1-c', 'qq-p1-1', 'Third Law',  3),
              _opt('qq-p1-1-d', 'qq-p1-1', 'Law of Gravitation', 4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-p1-2', quizId: _qP1, type: 'MULTIPLE_CHOICE', orderIndex: 2, points: 2,
            prompt: 'The SI unit of force is:',
            correctAnswer: 'qq-p1-2-c',
            options: [
              _opt('qq-p1-2-a', 'qq-p1-2', 'Joule',   1),
              _opt('qq-p1-2-b', 'qq-p1-2', 'Watt',    2),
              _opt('qq-p1-2-c', 'qq-p1-2', 'Newton',  3),
              _opt('qq-p1-2-d', 'qq-p1-2', 'Pascal',  4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-p1-3', quizId: _qP1, type: 'TRUE_FALSE', orderIndex: 3, points: 2,
            prompt: 'An object moving at constant velocity has zero acceleration.',
            correctAnswer: 'true',
            options: [
              _opt('qq-p1-3-t', 'qq-p1-3', 'True',  1),
              _opt('qq-p1-3-f', 'qq-p1-3', 'False', 2),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-p1-4', quizId: _qP1, type: 'MULTIPLE_CHOICE', orderIndex: 4, points: 2,
            prompt: 'Kinetic energy is calculated using:',
            correctAnswer: 'qq-p1-4-b',
            options: [
              _opt('qq-p1-4-a', 'qq-p1-4', 'mgh',    1),
              _opt('qq-p1-4-b', 'qq-p1-4', '½mv²',   2),
              _opt('qq-p1-4-c', 'qq-p1-4', 'mv',     3),
              _opt('qq-p1-4-d', 'qq-p1-4', 'Fd',     4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-p1-5', quizId: _qP1, type: 'SHORT_ANSWER', orderIndex: 5, points: 2,
            prompt: 'What is the approximate acceleration due to gravity on Earth?',
            correctAnswer: '9.8 m/s² or 10 m/s²',
            options: [],
          ),
        ],
      ),
    ],
    _cHist: [
      ElearningQuizModel(
        id: _qH1, courseSpaceId: _cHist, lessonId: _lH1,
        title: 'Pre-Colonial Africa Quiz',
        instructions: 'Answer all questions carefully.',
        timeLimitMinutes: 15, maxAttempts: 2, passingScore: 60,
        status: 'PUBLISHED', publishedAt: DateTime(2025, 5, 7),
        totalPoints: 8,
        questions: [
          ElearningQuizQuestionModel(
            id: 'qq-h1-1', quizId: _qH1, type: 'MULTIPLE_CHOICE', orderIndex: 1, points: 2,
            prompt: 'In which year was the Berlin Conference held?',
            correctAnswer: 'qq-h1-1-b',
            options: [
              _opt('qq-h1-1-a', 'qq-h1-1', '1870', 1),
              _opt('qq-h1-1-b', 'qq-h1-1', '1884', 2),
              _opt('qq-h1-1-c', 'qq-h1-1', '1900', 3),
              _opt('qq-h1-1-d', 'qq-h1-1', '1919', 4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-h1-2', quizId: _qH1, type: 'TRUE_FALSE', orderIndex: 2, points: 2,
            prompt: 'Julius Nyerere founded TANU in 1954.',
            correctAnswer: 'true',
            options: [
              _opt('qq-h1-2-t', 'qq-h1-2', 'True',  1),
              _opt('qq-h1-2-f', 'qq-h1-2', 'False', 2),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-h1-3', quizId: _qH1, type: 'MULTIPLE_CHOICE', orderIndex: 3, points: 2,
            prompt: 'The Maji Maji Uprising was a revolt against:',
            correctAnswer: 'qq-h1-3-c',
            options: [
              _opt('qq-h1-3-a', 'qq-h1-3', 'British missionaries',    1),
              _opt('qq-h1-3-b', 'qq-h1-3', 'Arab slave traders',      2),
              _opt('qq-h1-3-c', 'qq-h1-3', 'German colonial taxation', 3),
              _opt('qq-h1-3-d', 'qq-h1-3', 'Portuguese settlers',     4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-h1-4', quizId: _qH1, type: 'SHORT_ANSWER', orderIndex: 4, points: 2,
            prompt: 'Name the year Tanzania gained independence and the first president.',
            correctAnswer: '1961 / Julius Nyerere',
            options: [],
          ),
        ],
      ),
    ],
    _cBiol: [
      ElearningQuizModel(
        id: _qB1, courseSpaceId: _cBiol, lessonId: _lB1,
        title: 'Cells and Photosynthesis Quiz',
        instructions: 'Choose the best answer for each question.',
        timeLimitMinutes: 15, maxAttempts: 2, passingScore: 60,
        status: 'PUBLISHED', publishedAt: DateTime(2025, 5, 9),
        totalPoints: 8,
        questions: [
          ElearningQuizQuestionModel(
            id: 'qq-b1-1', quizId: _qB1, type: 'MULTIPLE_CHOICE', orderIndex: 1, points: 2,
            prompt: 'Which organelle is responsible for photosynthesis?',
            correctAnswer: 'qq-b1-1-b',
            options: [
              _opt('qq-b1-1-a', 'qq-b1-1', 'Mitochondria',  1),
              _opt('qq-b1-1-b', 'qq-b1-1', 'Chloroplast',   2),
              _opt('qq-b1-1-c', 'qq-b1-1', 'Ribosome',      3),
              _opt('qq-b1-1-d', 'qq-b1-1', 'Golgi body',    4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-b1-2', quizId: _qB1, type: 'TRUE_FALSE', orderIndex: 2, points: 2,
            prompt: 'Animal cells have a cell wall made of cellulose.',
            correctAnswer: 'false',
            explanation: 'Only plant cells have a cellulose cell wall.',
            options: [
              _opt('qq-b1-2-t', 'qq-b1-2', 'True',  1),
              _opt('qq-b1-2-f', 'qq-b1-2', 'False', 2),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-b1-3', quizId: _qB1, type: 'MULTIPLE_CHOICE', orderIndex: 3, points: 2,
            prompt: 'What is produced during photosynthesis?',
            correctAnswer: 'qq-b1-3-d',
            options: [
              _opt('qq-b1-3-a', 'qq-b1-3', 'Carbon dioxide and water',   1),
              _opt('qq-b1-3-b', 'qq-b1-3', 'Nitrogen and minerals',      2),
              _opt('qq-b1-3-c', 'qq-b1-3', 'Proteins and lipids',        3),
              _opt('qq-b1-3-d', 'qq-b1-3', 'Glucose and oxygen',         4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-b1-4', quizId: _qB1, type: 'SHORT_ANSWER', orderIndex: 4, points: 2,
            prompt: 'Name two organelles found in plant cells but NOT in animal cells.',
            correctAnswer: 'Chloroplast, cell wall (vacuole also accepted)',
            options: [],
          ),
        ],
      ),
    ],
    _cEng: [
      ElearningQuizModel(
        id: _qE1, courseSpaceId: _cEng, lessonId: _lE1,
        title: 'Essay and Language Quiz',
        instructions: 'Read each question carefully before answering.',
        timeLimitMinutes: 15, maxAttempts: 2, passingScore: 60,
        status: 'PUBLISHED', publishedAt: DateTime(2025, 5, 10),
        totalPoints: 8,
        questions: [
          ElearningQuizQuestionModel(
            id: 'qq-e1-1', quizId: _qE1, type: 'MULTIPLE_CHOICE', orderIndex: 1, points: 2,
            prompt: 'Which paragraph of an essay states the main argument (thesis)?',
            correctAnswer: 'qq-e1-1-a',
            options: [
              _opt('qq-e1-1-a', 'qq-e1-1', 'Introduction',  1),
              _opt('qq-e1-1-b', 'qq-e1-1', 'First body paragraph', 2),
              _opt('qq-e1-1-c', 'qq-e1-1', 'Conclusion', 3),
              _opt('qq-e1-1-d', 'qq-e1-1', 'Counter-argument', 4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-e1-2', quizId: _qE1, type: 'TRUE_FALSE', orderIndex: 2, points: 2,
            prompt: 'Alliteration is the repetition of the same vowel sounds.',
            correctAnswer: 'false',
            explanation: 'Alliteration is the repetition of consonant sounds at the start of words.',
            options: [
              _opt('qq-e1-2-t', 'qq-e1-2', 'True',  1),
              _opt('qq-e1-2-f', 'qq-e1-2', 'False', 2),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-e1-3', quizId: _qE1, type: 'MULTIPLE_CHOICE', orderIndex: 3, points: 2,
            prompt: 'Skimming a text means:',
            correctAnswer: 'qq-e1-3-b',
            options: [
              _opt('qq-e1-3-a', 'qq-e1-3', 'Reading every word carefully',          1),
              _opt('qq-e1-3-b', 'qq-e1-3', 'Reading quickly for the main idea',     2),
              _opt('qq-e1-3-c', 'qq-e1-3', 'Looking for specific names or figures', 3),
              _opt('qq-e1-3-d', 'qq-e1-3', 'Translating into another language',     4),
            ],
          ),
          ElearningQuizQuestionModel(
            id: 'qq-e1-4', quizId: _qE1, type: 'SHORT_ANSWER', orderIndex: 4, points: 2,
            prompt: 'Name one poetic device and give a brief definition.',
            correctAnswer: 'Any valid device e.g. metaphor, simile, personification',
            options: [],
          ),
        ],
      ),
    ],
  };

  // ─── Mock quiz attempt (student has completed the maths quiz) ────────────────

  static final _mathAttempt = ElearningQuizAttemptModel(
    id: 'attempt-m1-1',
    quizId: _qM1,
    studentId: 'student-demo',
    courseSpaceId: _cMath,
    attemptNumber: 1,
    startedAt: DateTime(2025, 5, 12, 10, 0),
    submittedAt: DateTime(2025, 5, 12, 10, 14),
    status: 'AUTO_GRADED',
    totalScore: 8,
    maxScore: 10,
    percentScore: 80,
    isPassed: true,
    answers: [],
  );

  // ─── Progress per course ─────────────────────────────────────────────────────

  static final _progressByCourse = <String, ElearningProgressModel>{
    _cMath: ElearningProgressModel(courseId: _cMath, studentId: 'student-demo',
        lessons: 3, materials: 5, viewed: 4, assignments: 2, submissions: 2, quizzes: 1, attempts: 1, completionPercent: 72),
    _cPhys: ElearningProgressModel(courseId: _cPhys, studentId: 'student-demo',
        lessons: 3, materials: 5, viewed: 3, assignments: 2, submissions: 0, quizzes: 1, attempts: 0, completionPercent: 45),
    _cHist: ElearningProgressModel(courseId: _cHist, studentId: 'student-demo',
        lessons: 3, materials: 5, viewed: 4, assignments: 1, submissions: 1, quizzes: 1, attempts: 1, completionPercent: 60),
    _cBiol: ElearningProgressModel(courseId: _cBiol, studentId: 'student-demo',
        lessons: 3, materials: 4, viewed: 2, assignments: 1, submissions: 0, quizzes: 1, attempts: 0, completionPercent: 38),
    _cEng:  ElearningProgressModel(courseId: _cEng,  studentId: 'student-demo',
        lessons: 3, materials: 4, viewed: 3, assignments: 1, submissions: 1, quizzes: 1, attempts: 0, completionPercent: 55),
  };

  // ─── Announcements per course ─────────────────────────────────────────────────

  static final _announcementsByCourse = <String, List<ElearningAnnouncementModel>>{
    _cMath: [
      ElearningAnnouncementModel(
        id: 'ann-m-1', courseSpaceId: _cMath,
        title: 'Quadratic Equations Worksheet — Due Friday',
        body: 'A reminder that the Quadratic Equations Worksheet is due this Friday, 28 May. '
              'Please show all working and upload a clear photograph of your answers. '
              'Late submissions will receive a 5% penalty per day.',
        status: 'PUBLISHED', isPinned: true, createdBy: 'Mr. James Mwangi',
        publishedAt: DateTime(2025, 5, 22), createdAt: DateTime(2025, 5, 22),
      ),
      ElearningAnnouncementModel(
        id: 'ann-m-2', courseSpaceId: _cMath,
        title: 'Mid-Term Revision Schedule',
        body: 'Extra revision classes for Mathematics will be held every Tuesday from 3:00 PM to 4:30 PM in Room 12. '
              'Bring your exercise books and the Algebra Practice Set corrections.',
        status: 'PUBLISHED', isPinned: false, createdBy: 'Mr. James Mwangi',
        publishedAt: DateTime(2025, 5, 16), createdAt: DateTime(2025, 5, 16),
      ),
    ],
    _cPhys: [
      ElearningAnnouncementModel(
        id: 'ann-p-1', courseSpaceId: _cPhys,
        title: "Newton's Laws Assignment — Due 25 May",
        body: "The Newton's Laws Problem Set is due on Sunday 25 May by 11:59 PM. "
              'Write clearly, include units in all calculations, and submit via this platform.',
        status: 'PUBLISHED', isPinned: true, createdBy: 'Mrs. Grace Kimaro',
        publishedAt: DateTime(2025, 5, 19), createdAt: DateTime(2025, 5, 19),
      ),
      ElearningAnnouncementModel(
        id: 'ann-p-2', courseSpaceId: _cPhys,
        title: 'Physics Lab Session — Thursday',
        body: 'This Thursday we will conduct the pendulum energy experiment in the Science Lab. '
              'Please arrive on time and wear your lab coat. Safety goggles are mandatory.',
        status: 'PUBLISHED', isPinned: false, createdBy: 'Mrs. Grace Kimaro',
        publishedAt: DateTime(2025, 5, 15), createdAt: DateTime(2025, 5, 15),
      ),
    ],
    _cHist: [
      ElearningAnnouncementModel(
        id: 'ann-h-1', courseSpaceId: _cHist,
        title: 'Essay Submission — Colonialism (Due 30 May)',
        body: 'Your essay on the effects of British colonial rule is due Friday 30 May. '
              'Expected length is 500 words. Marks will be deducted for plagiarism.',
        status: 'PUBLISHED', isPinned: true, createdBy: 'Mr. David Osei',
        publishedAt: DateTime(2025, 5, 20), createdAt: DateTime(2025, 5, 20),
      ),
      ElearningAnnouncementModel(
        id: 'ann-h-2', courseSpaceId: _cHist,
        title: 'Recommended Reading — Road to Uhuru',
        body: 'Students are encouraged to read Chapter 7 of "The Road to Uhuru" by Gideon Were. '
              'This will deepen your understanding of the independence movement for our next lesson.',
        status: 'PUBLISHED', isPinned: false, createdBy: 'Mr. David Osei',
        publishedAt: DateTime(2025, 5, 13), createdAt: DateTime(2025, 5, 13),
      ),
    ],
    _cBiol: [
      ElearningAnnouncementModel(
        id: 'ann-b-1', courseSpaceId: _cBiol,
        title: 'Photosynthesis Diagram Task — Due 29 May',
        body: 'Please submit your labelled chloroplast diagram and the photosynthesis equation by Thursday 29 May. '
              'A clear photo of hand-drawn work is acceptable.',
        status: 'PUBLISHED', isPinned: true, createdBy: 'Ms. Amina Hassan',
        publishedAt: DateTime(2025, 5, 21), createdAt: DateTime(2025, 5, 21),
      ),
      ElearningAnnouncementModel(
        id: 'ann-b-2', courseSpaceId: _cBiol,
        title: 'Biology Study Group',
        body: 'A peer study group meets every Wednesday lunch break in Library Room B. '
              'All Form 2 Biology students are welcome. Bring your notes.',
        status: 'PUBLISHED', isPinned: false, createdBy: 'Ms. Amina Hassan',
        publishedAt: DateTime(2025, 5, 12), createdAt: DateTime(2025, 5, 12),
      ),
    ],
    _cEng: [
      ElearningAnnouncementModel(
        id: 'ann-e-1', courseSpaceId: _cEng,
        title: 'Argumentative Essay Due 27 May',
        body: 'Submit your essay on "Technology improves learning in Tanzanian secondary schools" by Tuesday 27 May. '
              'Use the rubric provided: Content 20, Language 15, Structure 10, Mechanics 5.',
        status: 'PUBLISHED', isPinned: true, createdBy: 'Mr. Emmanuel Shirima',
        publishedAt: DateTime(2025, 5, 19), createdAt: DateTime(2025, 5, 19),
      ),
      ElearningAnnouncementModel(
        id: 'ann-e-2', courseSpaceId: _cEng,
        title: 'Poetry Week Next Week',
        body: 'Next week we begin our poetry unit. Please read the poems "If" by Rudyard Kipling '
              'and "Still I Rise" by Maya Angelou in preparation. Notes will be uploaded soon.',
        status: 'PUBLISHED', isPinned: false, createdBy: 'Mr. Emmanuel Shirima',
        publishedAt: DateTime(2025, 5, 14), createdAt: DateTime(2025, 5, 14),
      ),
    ],
  };

  // ─── Discussions per course ───────────────────────────────────────────────────

  static final _discussionsByCourse = <String, List<ElearningDiscussionModel>>{
    _cMath: [
      ElearningDiscussionModel(
        id: 'disc-m-1', courseSpaceId: _cMath,
        title: 'How do you know which method to use for quadratics?',
        body: 'I keep confusing myself on whether to use factorisation or the quadratic formula. '
              'Is there a rule for when to use each one?',
        authorId: 'student-aisha', authorRole: 'STUDENT',
        isResolved: true, isPinned: false,
        createdAt: DateTime(2025, 5, 14, 19, 30),
        replies: [
          ElearningReplyModel(id: 'rep-m-1-1', threadId: 'disc-m-1',
            body: 'Great question, Aisha. Try factorisation first — it is faster. '
                  'If the numbers are not neat factors, use the quadratic formula. '
                  'Completing the square is mainly needed when the question asks for vertex form.',
            authorId: 'teacher-mwangi', authorRole: 'TEACHER',
            createdAt: DateTime(2025, 5, 15, 8, 10),
          ),
          ElearningReplyModel(id: 'rep-m-1-2', threadId: 'disc-m-1',
            body: 'Thank you, Mr. Mwangi! That makes it much clearer.',
            authorId: 'student-aisha', authorRole: 'STUDENT',
            createdAt: DateTime(2025, 5, 15, 16, 45),
          ),
        ],
      ),
      ElearningDiscussionModel(
        id: 'disc-m-2', courseSpaceId: _cMath,
        title: 'Question on f(x) notation',
        body: 'In the functions lesson it says f(x) = 2x − 3. What does the "f" stand for? '
              'Can I use any letter?',
        authorId: 'student-baraka', authorRole: 'STUDENT',
        isResolved: false, isPinned: false,
        createdAt: DateTime(2025, 5, 18, 20, 0),
        replies: [
          ElearningReplyModel(id: 'rep-m-2-1', threadId: 'disc-m-2',
            body: 'Yes, Baraka — "f" is just a label for the function. You could write g(x) or h(x) just as well. '
                  'The important thing is the rule inside the brackets.',
            authorId: 'teacher-mwangi', authorRole: 'TEACHER',
            createdAt: DateTime(2025, 5, 19, 7, 55),
          ),
        ],
      ),
    ],
    _cPhys: [
      ElearningDiscussionModel(
        id: 'disc-p-1', courseSpaceId: _cPhys,
        title: "Confused about Newton's 3rd Law — rocket example",
        body: 'If every force has an equal and opposite reaction, why does a rocket move forward '
              'instead of staying still? The thrust and reaction should cancel out, no?',
        authorId: 'student-josephat', authorRole: 'STUDENT',
        isResolved: true, isPinned: true,
        createdAt: DateTime(2025, 5, 16, 21, 0),
        replies: [
          ElearningReplyModel(id: 'rep-p-1-1', threadId: 'disc-p-1',
            body: 'Excellent thinking, Josephat! The key is that the action and reaction act on '
                  'DIFFERENT objects. The rocket pushes exhaust gases backward; the gases push the '
                  'rocket forward. They do not cancel because they act on separate bodies.',
            authorId: 'teacher-kimaro', authorRole: 'TEACHER',
            createdAt: DateTime(2025, 5, 17, 7, 30),
          ),
          ElearningReplyModel(id: 'rep-p-1-2', threadId: 'disc-p-1',
            body: 'Oh! That makes perfect sense now. Thank you Mrs. Kimaro.',
            authorId: 'student-josephat', authorRole: 'STUDENT',
            createdAt: DateTime(2025, 5, 17, 17, 0),
          ),
        ],
      ),
    ],
    _cHist: [
      ElearningDiscussionModel(
        id: 'disc-h-1', courseSpaceId: _cHist,
        title: 'What was the main cause of the Maji Maji Uprising?',
        body: 'Our notes mention forced labour and taxation but I want to understand the deeper causes. '
              'Was religion a factor too?',
        authorId: 'student-neema', authorRole: 'STUDENT',
        isResolved: false, isPinned: false,
        createdAt: DateTime(2025, 5, 17, 18, 30),
        replies: [
          ElearningReplyModel(id: 'rep-h-1-1', threadId: 'disc-h-1',
            body: 'Excellent point, Neema. Yes — the belief in the protective "maji" (water) medicine '
                  'was a religious and spiritual mobiliser. It united different ethnic groups under one cause. '
                  'Combine that with economic grievances (cotton cultivation, hut tax) and you have a powerful revolt.',
            authorId: 'teacher-osei', authorRole: 'TEACHER',
            createdAt: DateTime(2025, 5, 18, 8, 0),
          ),
        ],
      ),
    ],
    _cBiol: [
      ElearningDiscussionModel(
        id: 'disc-b-1', courseSpaceId: _cBiol,
        title: 'Why do plant cells need both chloroplasts AND mitochondria?',
        body: 'Plants make their own food using chloroplasts. So why do they also need mitochondria?',
        authorId: 'student-zawadi', authorRole: 'STUDENT',
        isResolved: true, isPinned: false,
        createdAt: DateTime(2025, 5, 15, 17, 0),
        replies: [
          ElearningReplyModel(id: 'rep-b-1-1', threadId: 'disc-b-1',
            body: 'Wonderful question, Zawadi! Chloroplasts PRODUCE glucose through photosynthesis, '
                  'but the plant still needs to RELEASE energy from that glucose to power all its other processes — '
                  'growing, transporting minerals, reproducing. That energy release (cellular respiration) '
                  'happens in the mitochondria.',
            authorId: 'teacher-hassan', authorRole: 'TEACHER',
            createdAt: DateTime(2025, 5, 15, 19, 45),
          ),
        ],
      ),
    ],
    _cEng: [
      ElearningDiscussionModel(
        id: 'disc-e-1', courseSpaceId: _cEng,
        title: 'How long should a topic sentence be?',
        body: 'I am not sure if my topic sentences are too short or too long. '
              'Is there a rule for this?',
        authorId: 'student-furaha', authorRole: 'STUDENT',
        isResolved: false, isPinned: false,
        createdAt: DateTime(2025, 5, 19, 20, 15),
        replies: [
          ElearningReplyModel(id: 'rep-e-1-1', threadId: 'disc-e-1',
            body: 'A topic sentence should be one clear, confident sentence — usually 15 to 25 words. '
                  'It states the main point of the paragraph without explaining or giving evidence. '
                  'Think of it as a mini thesis for that paragraph.',
            authorId: 'teacher-shirima', authorRole: 'TEACHER',
            createdAt: DateTime(2025, 5, 20, 7, 40),
          ),
        ],
      ),
    ],
  };

  // ─── API overrides ────────────────────────────────────────────────────────────

  @override
  Future<List<ElearningCourseModel>> listCourses({
    String? status, String? educationStage, int? classLevel, String? combinationId,
  }) async {
    await Future.delayed(_d);
    return _courses;
  }

  @override
  Future<ElearningCourseModel> getCourse(String courseId) async {
    await Future.delayed(_d);
    return _courses.firstWhere(
      (c) => c.id == courseId,
      orElse: () => _courses.first,
    );
  }

  @override
  Future<List<ElearningLessonModel>> listLessons(String courseId) async {
    await Future.delayed(_d);
    final lessons = <String, List<ElearningLessonModel>>{
      _cMath: _mathLessons,
      _cPhys: _physLessons,
      _cHist: _histLessons,
      _cBiol: _biolLessons,
      _cEng:  _engLessons,
    };
    return lessons[courseId] ?? [];
  }

  @override
  Future<List<ElearningMaterialModel>> listMaterials(String courseId, String lessonId) async {
    await Future.delayed(_d);
    return _materialsByLesson[lessonId] ?? [];
  }

  @override
  Future<void> viewMaterial(String materialId) async {
    // No-op in mock mode.
  }

  @override
  Future<Map<String, dynamic>> downloadMaterial(String materialId) async {
    await Future.delayed(_d);
    // For NOTE materials, return the body so the viewer renders it inline.
    for (final materials in _materialsByLesson.values) {
      try {
        final mat = materials.firstWhere((m) => m.id == materialId);
        if (mat.isNote && mat.body != null) {
          return {'type': 'NOTE', 'body': mat.body!, 'download': {'url': ''}};
        }
      } catch (_) {}
    }
    return {'download': {'url': ''}};
  }

  @override
  Future<ElearningQuizModel> getQuizById(String quizId) async {
    await Future.delayed(_d);
    for (final quizzes in _quizzesByCourse.values) {
      try {
        return quizzes.firstWhere((q) => q.id == quizId);
      } catch (_) {}
    }
    return _quizzesByCourse.values.first.first;
  }

  @override
  Future<List<ElearningAssignmentModel>> listAssignments(String courseId) async {
    await Future.delayed(_d);
    return _assignmentsByCourse[courseId] ?? [];
  }

  @override
  Future<ElearningAssignmentModel> getAssignment(String courseId, String assignmentId) async {
    await Future.delayed(_d);
    final list = _assignmentsByCourse[courseId] ?? [];
    return list.firstWhere((a) => a.id == assignmentId, orElse: () => list.first);
  }

  @override
  Future<ElearningSubmissionModel?> mySubmission(String assignmentId) async {
    await Future.delayed(_d);
    return _mockSubmissions[assignmentId];
  }

  @override
  Future<ElearningSubmissionModel> upsertSubmission(String assignmentId, Map<String, dynamic> body) async {
    await Future.delayed(_d);
    // Return a fresh SUBMITTED model so the UI shows success.
    return ElearningSubmissionModel(
      id: 'sub-mock-${DateTime.now().millisecondsSinceEpoch}',
      assignmentId: assignmentId,
      studentId: 'student-demo',
      courseSpaceId: 'mock-course',
      textContent: body['textContent'] as String?,
      submittedAt: DateTime.now(),
      isLate: false,
      status: 'SUBMITTED',
    );
  }

  @override
  Future<List<ElearningSubmissionModel>> mySubmissions(String courseId) async {
    await Future.delayed(_d);
    return _mockSubmissions.values.toList();
  }

  @override
  Future<List<ElearningQuizModel>> listQuizzes(String courseId) async {
    await Future.delayed(_d);
    return _quizzesByCourse[courseId] ?? [];
  }

  @override
  Future<ElearningQuizModel> getQuiz(String courseId, String quizId) async {
    await Future.delayed(_d);
    final list = _quizzesByCourse[courseId] ?? [];
    return list.firstWhere((q) => q.id == quizId, orElse: () => list.first);
  }

  @override
  Future<ElearningQuizAttemptModel?> activeAttempt(String quizId) async {
    await Future.delayed(_d);
    return null; // No active attempt — shows "Start Quiz"
  }

  @override
  Future<ElearningQuizAttemptModel> startAttempt(String quizId) async {
    await Future.delayed(_d);
    return ElearningQuizAttemptModel(
      id: 'attempt-mock-${DateTime.now().millisecondsSinceEpoch}',
      quizId: quizId,
      studentId: 'student-demo',
      courseSpaceId: 'mock-course',
      attemptNumber: 1,
      startedAt: DateTime.now(),
      status: 'IN_PROGRESS',
      answers: const [],
    );
  }

  @override
  Future<void> saveAnswer(String attemptId, String questionId, Map<String, dynamic> body) async {
    // No-op in mock mode.
  }

  @override
  Future<ElearningQuizAttemptModel> submitAttempt(String attemptId) async {
    await Future.delayed(_d);
    return ElearningQuizAttemptModel(
      id: attemptId,
      quizId: _qM1,
      studentId: 'student-demo',
      courseSpaceId: 'mock-course',
      attemptNumber: 1,
      startedAt: DateTime.now().subtract(const Duration(minutes: 12)),
      submittedAt: DateTime.now(),
      status: 'AUTO_GRADED',
      totalScore: 8,
      maxScore: 10,
      percentScore: 80,
      isPassed: true,
      answers: const [],
    );
  }

  @override
  Future<List<ElearningQuizAttemptModel>> myAttempts(String quizId) async {
    await Future.delayed(_d);
    if (quizId == _qM1) return [_mathAttempt];
    return [];
  }

  @override
  Future<ElearningProgressModel> myProgress(String courseId) async {
    await Future.delayed(_d);
    return _progressByCourse[courseId] ??
        ElearningProgressModel(
          courseId: courseId, studentId: 'student-demo',
          lessons: 3, materials: 4, viewed: 2,
          assignments: 1, submissions: 0,
          quizzes: 1, attempts: 0, completionPercent: 35,
        );
  }

  @override
  Future<ElearningStudentSummaryModel> studentSummary() async {
    await Future.delayed(_d);
    return const ElearningStudentSummaryModel(
      enrolledCount: 5,
      pendingAssignments: 3,
      availableQuizzes: 4,
      unviewedMaterials: 7,
    );
  }

  @override
  Future<List<ElearningAnnouncementModel>> listAnnouncements(String courseId) async {
    await Future.delayed(_d);
    return _announcementsByCourse[courseId] ?? [];
  }

  @override
  Future<List<ElearningDiscussionModel>> listDiscussions(String courseId) async {
    await Future.delayed(_d);
    return _discussionsByCourse[courseId] ?? [];
  }

  @override
  Future<ElearningDiscussionModel> getDiscussion(String threadId) async {
    await Future.delayed(_d);
    for (final list in _discussionsByCourse.values) {
      try {
        return list.firstWhere((d) => d.id == threadId);
      } catch (_) {}
    }
    return _discussionsByCourse.values.first.first;
  }

  @override
  Future<ElearningReplyModel> addReply(String threadId, String body) async {
    await Future.delayed(_d);
    return ElearningReplyModel(
      id: 'rep-mock-${DateTime.now().millisecondsSinceEpoch}',
      threadId: threadId,
      body: body,
      authorId: 'student-demo',
      authorRole: 'STUDENT',
      createdAt: DateTime.now(),
    );
  }

  @override
  Future<Map<String, dynamic>> uploadFile({
    required String fileName,
    required String contentBase64,
    required String mimeType,
    String domain = 'submissions',
  }) async {
    await Future.delayed(_d);
    return {'fileKey': 'mock/$domain/$fileName'};
  }
}
