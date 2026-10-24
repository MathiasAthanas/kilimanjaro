// ignore_for_file: use_build_context_synchronously
import 'dart:convert';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:open_file/open_file.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_failure.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/elearning_models.dart';
import '../../../widgets/common/ks_error_view.dart';

// ─── Data providers local to the teaching screens ────────────────────────────

typedef _CourseAssignment = ({String courseId, String assignmentId});

final _reviewDeskProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(elearningApiServiceProvider).reviewDesk();
});

final _submissionsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, _CourseAssignment>((ref, key) {
  return ref
      .watch(elearningApiServiceProvider)
      .assignmentSubmissions(key.courseId, key.assignmentId);
});

final _missingProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, _CourseAssignment>((ref, key) {
  return ref
      .watch(elearningApiServiceProvider)
      .missingSubmissions(key.courseId, key.assignmentId);
});

final _quizResultsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, ({String courseId, String quizId})>(
        (ref, key) {
  return ref
      .watch(elearningApiServiceProvider)
      .quizResults(key.courseId, key.quizId);
});

final _rosterProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, courseId) {
  return ref.watch(elearningApiServiceProvider).courseRoster(courseId);
});

// ─── Shared helpers ──────────────────────────────────────────────────────────

void _toast(BuildContext context, String message) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Runs a server action, reporting failures in plain language.
Future<bool> _run(BuildContext context, Future<void> Function() action,
    {String? success}) async {
  try {
    await action();
    if (success != null) _toast(context, success);
    return true;
  } catch (e) {
    _toast(context, ApiFailure.from(e).message);
    return false;
  }
}

Future<bool> _confirm(BuildContext context, String title, String message,
    {String action = 'Confirm'}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
            onPressed: () => Navigator.of(dialog).pop(false),
            child: const Text('Cancel')),
        FilledButton(
            onPressed: () => Navigator.of(dialog).pop(true),
            child: Text(action)),
      ],
    ),
  );
  return ok == true;
}

Future<T?> _sheet<T>(BuildContext context, Widget child) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (sheet) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(sheet).viewInsets.bottom),
      child: child,
    ),
  );
}

String _num(num? v) {
  if (v == null) return '—';
  final d = v.toDouble();
  return d % 1 == 0 ? d.toStringAsFixed(0) : d.toStringAsFixed(1);
}

String _dateTime(DateTime? d) =>
    d == null ? 'No deadline' : DateFormat('EEE d MMM, HH:mm').format(d.toLocal());

double? _dbl(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

String _statusLabel(String status) => switch (status) {
      'DRAFT' => 'Draft',
      'PUBLISHED' => 'Published',
      'CLOSED' => 'Closed',
      'ACTIVE' => 'Active',
      'ARCHIVED' => 'Archived',
      'SUBMITTED' => 'To grade',
      'GRADED' => 'Graded',
      'RETURNED' => 'Returned',
      'MISSING' => 'Missing',
      'AUTO_GRADED' => 'Auto-marked',
      'MANUALLY_GRADED' => 'Marked',
      _ => status,
    };

// ─── Courses home ────────────────────────────────────────────────────────────

class TeacherCoursesHomeScreen extends ConsumerWidget {
  const TeacherCoursesHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(elearningCoursesProvider);
    final desk = ref.watch(_reviewDeskProvider).valueOrNull;
    final summary = (desk?['summary'] as Map?) ?? const {};
    final toGrade = (summary['submittedAssignments'] as num? ?? 0).toInt() +
        (summary['shortAnswersPending'] as num? ?? 0).toInt();
    final courses = coursesAsync.valueOrNull ?? const <ElearningCourseModel>[];

    return _TeacherElScaffold(
      title: 'E-Learning',
      subtitle: 'Create, publish, grade and follow learner progress.',
      onRefresh: () async {
        ref.invalidate(_reviewDeskProvider);
        ref.invalidate(elearningCoursesProvider);
        await ref.read(elearningCoursesProvider.future);
      },
      children: [
        _MetricGrid(values: [
          ('To grade', desk == null ? '—' : '$toGrade'),
          ('Courses', coursesAsync.hasValue ? '${courses.length}' : '—'),
          (
            'Students',
            coursesAsync.hasValue
                ? '${courses.fold<int>(0, (a, c) => a + c.enrolledCount)}'
                : '—'
          ),
        ]),
        if ((summary['lateSubmissions'] as num? ?? 0) > 0)
          _ActionCard(
            '${summary['lateSubmissions']} late submission${(summary['lateSubmissions'] as num) == 1 ? '' : 's'} waiting',
            'Late work is marked automatically with the penalty you set.',
            Icons.schedule_rounded,
            null,
          ),
        coursesAsync.when(
          data: (list) => list.isEmpty
              ? const _ActionCard(
                  'No courses yet',
                  'Courses appear here once your class-subjects are set up for e-learning.',
                  Icons.school_rounded,
                  null,
                )
              : Column(
                  children: [
                    for (final course in list)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ActionCard(
                          '${course.subjectName} · ${course.className}',
                          '${course.lessons.length} lessons · ${course.enrolledCount} students · ${_statusLabel(course.status)}',
                          Icons.school_rounded,
                          () => context.push('/teacher/courses/${course.id}'),
                        ),
                      ),
                  ],
                ),
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(
            error: e,
            onRetry: () => ref.invalidate(elearningCoursesProvider),
          ),
        ),
      ],
    );
  }
}

// ─── Course workspace ────────────────────────────────────────────────────────

class TeacherCourseDetailScreen extends ConsumerWidget {
  const TeacherCourseDetailScreen({super.key, required this.courseId});
  final String courseId;

  Future<void> _newLesson(BuildContext context, WidgetRef ref) async {
    final body = await _sheet<Map<String, dynamic>>(context, const _LessonForm());
    if (body == null || !context.mounted) return;
    final ok = await _run(context,
        () => ref.read(elearningApiServiceProvider).createLesson(courseId, body),
        success: 'Lesson created. Add materials, then publish it.');
    if (ok) {
      ref.invalidate(elearningLessonsProvider(courseId));
      ref.invalidate(elearningCourseProvider(courseId));
    }
  }

  Future<void> _newQuiz(BuildContext context, WidgetRef ref, List<ElearningLessonModel> lessons) async {
    final body = await _sheet<Map<String, dynamic>>(context, _QuizForm(lessons: lessons));
    if (body == null || !context.mounted) return;
    try {
      final quiz = await ref.read(elearningApiServiceProvider).createQuiz(courseId, body);
      ref.invalidate(elearningQuizzesProvider(courseId));
      if (context.mounted) {
        _toast(context, 'Quiz created. Add your questions next.');
        context.push('/teacher/courses/$courseId/quizzes/${quiz['id']}/builder');
      }
    } catch (e) {
      _toast(context, ApiFailure.from(e).message);
    }
  }

  Future<void> _announce(BuildContext context, WidgetRef ref) async {
    final body = await _sheet<Map<String, dynamic>>(context, const _AnnouncementForm());
    if (body == null || !context.mounted) return;
    await _run(context,
        () => ref.read(elearningApiServiceProvider).createAnnouncement(courseId, body),
        success: 'Announcement posted to your class.');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseAsync = ref.watch(elearningCourseProvider(courseId));
    final lessonsAsync = ref.watch(elearningLessonsProvider(courseId));
    final quizzesAsync = ref.watch(elearningQuizzesProvider(courseId));
    final assignmentsAsync = ref.watch(elearningAssignmentsProvider(courseId));
    final course = courseAsync.valueOrNull;

    return _TeacherElScaffold(
      title: course == null ? 'Course' : '${course.subjectName} · ${course.className}',
      subtitle: 'Lessons, assignments, quizzes and communication.',
      onRefresh: () async {
        ref.invalidate(elearningCourseProvider(courseId));
        ref.invalidate(elearningLessonsProvider(courseId));
        ref.invalidate(elearningQuizzesProvider(courseId));
        ref.invalidate(elearningAssignmentsProvider(courseId));
        await ref.read(elearningLessonsProvider(courseId).future);
      },
      children: [
        if (course != null && !course.isActive)
          _ActionCard(
            'Publish this course',
            'Students cannot see it yet. Publish at least one lesson first, then publish the course.',
            Icons.rocket_launch_rounded,
            () async {
              final ok = await _run(context,
                  () => ref.read(elearningApiServiceProvider).publishCourse(courseId),
                  success: 'Course published. Students can now see it.');
              if (ok) {
                ref.invalidate(elearningCourseProvider(courseId));
                ref.invalidate(elearningCoursesProvider);
              }
            },
          ),
        if (course != null)
          _MetricGrid(values: [
            ('Students', '${course.enrolledCount}'),
            ('Lessons', lessonsAsync.hasValue ? '${lessonsAsync.value!.length}' : '—'),
            ('Status', _statusLabel(course.status)),
          ]),

        // ─── Lessons ───────────────────────────────────────────────────
        const _SectionLabel('Lessons'),
        lessonsAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(
            error: e,
            onRetry: () => ref.invalidate(elearningLessonsProvider(courseId)),
          ),
          data: (lessons) => Column(
            children: [
              for (final lesson in lessons)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ActionCard(
                    lesson.title,
                    '${lesson.weekNumber != null ? 'Week ${lesson.weekNumber} · ' : ''}${_statusLabel(lesson.status)} · ${lesson.materials.length} material${lesson.materials.length == 1 ? '' : 's'}',
                    Icons.menu_book_rounded,
                    () => context.push('/teacher/courses/$courseId/lesson/${lesson.id}'),
                  ),
                ),
              _ActionCard(
                'New lesson',
                lessons.isEmpty
                    ? 'Start by adding your first lesson.'
                    : 'Add another lesson to this course.',
                Icons.add_circle_rounded,
                () => _newLesson(context, ref),
              ),
            ],
          ),
        ),

        // ─── Assignments ───────────────────────────────────────────────
        const _SectionLabel('Assignments'),
        _ActionCard(
          'Assignments and grading',
          assignmentsAsync.maybeWhen(
            data: (items) {
              final toGrade = items.fold<int>(0, (a, i) => a + i.toGradeCount);
              return '${items.length} assignment${items.length == 1 ? '' : 's'}${toGrade > 0 ? ' · $toGrade to grade' : ''}';
            },
            orElse: () => 'Create tasks, review missing work, score and return feedback.',
          ),
          Icons.assignment_turned_in_rounded,
          () => context.push('/teacher/courses/$courseId/assignments'),
        ),

        // ─── Quizzes ───────────────────────────────────────────────────
        const _SectionLabel('Quizzes'),
        quizzesAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(
            error: e,
            onRetry: () => ref.invalidate(elearningQuizzesProvider(courseId)),
          ),
          data: (quizzes) => Column(
            children: [
              for (final quiz in quizzes)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ActionCard(
                    quiz.title,
                    '${quiz.questions.length} question${quiz.questions.length == 1 ? '' : 's'} · ${_statusLabel(quiz.status)}${quiz.attempts.isNotEmpty ? ' · ${quiz.attempts.length} attempt${quiz.attempts.length == 1 ? '' : 's'}' : ''}',
                    Icons.quiz_rounded,
                    () => context.push('/teacher/courses/$courseId/quizzes/${quiz.id}'),
                  ),
                ),
              _ActionCard(
                'New quiz',
                'Multiple choice, true/false and short answer questions.',
                Icons.add_circle_rounded,
                () => _newQuiz(context, ref, lessonsAsync.valueOrNull ?? const []),
              ),
            ],
          ),
        ),

        // ─── Communication & insights ─────────────────────────────────
        const _SectionLabel('Class'),
        _ActionCard(
          'Post an announcement',
          'Notify every student in this course.',
          Icons.campaign_rounded,
          () => _announce(context, ref),
        ),
        _ActionCard(
          'Engagement',
          'Completion per student and who needs a nudge.',
          Icons.analytics_rounded,
          () => context.push('/teacher/courses/$courseId/engagement'),
        ),
      ],
    );
  }
}

// ─── Lesson ──────────────────────────────────────────────────────────────────

class TeacherLessonDetailScreen extends ConsumerWidget {
  const TeacherLessonDetailScreen({
    super.key,
    required this.courseId,
    required this.lessonId,
  });
  final String courseId;
  final String lessonId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lessonsAsync = ref.watch(elearningLessonsProvider(courseId));
    final materialsAsync = ref.watch(
        elearningMaterialsProvider((courseId: courseId, lessonId: lessonId)));
    final lesson = lessonsAsync.valueOrNull
        ?.where((l) => l.id == lessonId)
        .cast<ElearningLessonModel?>()
        .firstWhere((_) => true, orElse: () => null);
    final materials = materialsAsync.valueOrNull ?? const <ElearningMaterialModel>[];

    return _TeacherElScaffold(
      title: lesson?.title ?? 'Lesson',
      subtitle: lesson == null
          ? ''
          : '${lesson.weekNumber != null ? 'Week ${lesson.weekNumber} · ' : ''}${_statusLabel(lesson.status)}',
      onRefresh: () async {
        ref.invalidate(elearningLessonsProvider(courseId));
        ref.invalidate(elearningMaterialsProvider((courseId: courseId, lessonId: lessonId)));
        await ref.read(elearningMaterialsProvider((courseId: courseId, lessonId: lessonId)).future);
      },
      children: [
        _MetricGrid(values: [
          ('Materials', '${materials.length}'),
          ('Live', '${materials.where((m) => m.status == 'PUBLISHED').length}'),
          ('Views', '${materials.fold<int>(0, (a, m) => a + m.viewCount)}'),
        ]),
        if (lesson != null && !lesson.isPublished)
          _ActionCard(
            'Publish lesson',
            materials.isEmpty
                ? 'Add at least one material first.'
                : 'Students will see the lesson and its materials.',
            Icons.publish_rounded,
            () async {
              final ok = await _run(context,
                  () => ref.read(elearningApiServiceProvider).publishLesson(courseId, lessonId),
                  success: 'Lesson published.');
              if (ok) {
                ref.invalidate(elearningLessonsProvider(courseId));
                ref.invalidate(elearningMaterialsProvider((courseId: courseId, lessonId: lessonId)));
              }
            },
          ),
        const _SectionLabel('Materials'),
        materialsAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(
            error: e,
            onRetry: () => ref.invalidate(
                elearningMaterialsProvider((courseId: courseId, lessonId: lessonId))),
          ),
          data: (items) => Column(
            children: [
              if (items.isEmpty)
                const _ActionCard('No materials yet',
                    'Add notes, files, videos or links for your students.', Icons.folder_open_rounded, null),
              for (final m in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _ActionCard(
                    m.title,
                    '${_materialLabel(m.type)} · ${_statusLabel(m.status)} · ${m.viewCount} view${m.viewCount == 1 ? '' : 's'}',
                    _materialIcon(m.type),
                    null,
                  ),
                ),
            ],
          ),
        ),
        _ActionCard(
          'Add material',
          'Write a note, upload a file, or share a video or link.',
          Icons.add_circle_rounded,
          () async {
            final added = await context.push<bool>(
                '/teacher/courses/$courseId/lesson/$lessonId/material/new');
            if (added == true) {
              ref.invalidate(elearningMaterialsProvider((courseId: courseId, lessonId: lessonId)));
              ref.invalidate(elearningLessonsProvider(courseId));
            }
          },
        ),
      ],
    );
  }
}

String _materialLabel(String type) => switch (type) {
      'NOTE' => 'Note',
      'PDF' => 'PDF',
      'SLIDE' => 'Slides',
      'IMAGE' => 'Image',
      'VIDEO' => 'Video',
      'LINK' => 'Link',
      _ => 'File',
    };

IconData _materialIcon(String type) => switch (type) {
      'NOTE' => Icons.sticky_note_2_rounded,
      'PDF' => Icons.picture_as_pdf_rounded,
      'SLIDE' => Icons.slideshow_rounded,
      'IMAGE' => Icons.image_rounded,
      'VIDEO' => Icons.play_circle_rounded,
      'LINK' => Icons.link_rounded,
      _ => Icons.description_rounded,
    };

// ─── Add material ────────────────────────────────────────────────────────────

class TeacherAddMaterialScreen extends ConsumerStatefulWidget {
  const TeacherAddMaterialScreen({
    super.key,
    required this.courseId,
    required this.lessonId,
  });
  final String courseId;
  final String lessonId;

  @override
  ConsumerState<TeacherAddMaterialScreen> createState() =>
      _TeacherAddMaterialScreenState();
}

class _TeacherAddMaterialScreenState
    extends ConsumerState<TeacherAddMaterialScreen> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  final _url = TextEditingController();
  String _type = 'NOTE';
  bool _downloadable = true;
  bool _busy = false;
  String? _fileName;
  String? _fileBase64;
  String? _fileMime;
  int _fileSize = 0;

  static const _types = [
    ('NOTE', 'Note', Icons.sticky_note_2_rounded),
    ('FILE', 'File', Icons.description_rounded),
    ('VIDEO', 'Video', Icons.play_circle_rounded),
    ('LINK', 'Link', Icons.link_rounded),
  ];

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    _url.dispose();
    super.dispose();
  }

  static String _mimeFor(String ext) => switch (ext.toLowerCase()) {
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'ppt' => 'application/vnd.ms-powerpoint',
        'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt' => 'text/plain',
        'png' => 'image/png',
        'jpg' || 'jpeg' => 'image/jpeg',
        'mp4' => 'video/mp4',
        _ => 'application/octet-stream',
      };

  /// Maps a picked file onto the most specific material type the API knows.
  static String _typeForExt(String ext) => switch (ext.toLowerCase()) {
        'pdf' => 'PDF',
        'ppt' || 'pptx' => 'SLIDE',
        'png' || 'jpg' || 'jpeg' => 'IMAGE',
        'mp4' => 'VIDEO',
        _ => 'FILE',
      };

  String _apiType = 'FILE';

  Future<void> _pick() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg', 'mp4'],
    );
    final file = result?.files.single;
    if (file == null) return;
    final bytes = file.bytes;
    if (bytes == null || bytes.isEmpty) return _toast(context, 'That file could not be read.');
    if (bytes.length > 25 * 1024 * 1024) return _toast(context, 'Files must be 25 MB or smaller.');
    setState(() {
      _fileName = file.name;
      _fileBase64 = base64Encode(bytes);
      _fileMime = _mimeFor(file.extension ?? '');
      _fileSize = bytes.length;
      _apiType = _typeForExt(file.extension ?? '');
      if (_title.text.trim().isEmpty) {
        _title.text = file.name.replaceAll(RegExp(r'\.[^.]+$'), '');
      }
    });
  }

  Future<void> _save({required bool publish}) async {
    final title = _title.text.trim();
    if (title.isEmpty) return _toast(context, 'Give the material a title.');
    final body = <String, dynamic>{
      'title': title,
      'downloadable': _downloadable,
      'status': publish ? 'PUBLISHED' : 'DRAFT',
    };
    switch (_type) {
      case 'NOTE':
        if (_body.text.trim().isEmpty) return _toast(context, 'Write the note text first.');
        body['type'] = 'NOTE';
        body['body'] = _body.text.trim();
      case 'FILE':
        if (_fileBase64 == null) return _toast(context, 'Choose a file to upload.');
        body['type'] = _apiType;
      default:
        final url = _url.text.trim();
        if (!RegExp(r'^https?://', caseSensitive: false).hasMatch(url)) {
          return _toast(context, 'Paste a full link starting with http:// or https://');
        }
        body['type'] = _type;
        body['externalUrl'] = url;
    }
    setState(() => _busy = true);
    try {
      final service = ref.read(elearningApiServiceProvider);
      if (_type == 'FILE') {
        final uploaded = await service.uploadFile(
          fileName: _fileName!,
          contentBase64: _fileBase64!,
          mimeType: _fileMime ?? 'application/octet-stream',
          domain: 'materials',
        );
        body['fileKey'] = uploaded['fileKey'];
        body['fileOriginalName'] = _fileName;
        body['fileMimeType'] = _fileMime;
        body['fileSizeBytes'] = _fileSize;
      }
      await service.createMaterial(widget.courseId, widget.lessonId, body);
      if (mounted) {
        _toast(context, publish ? 'Material published.' : 'Material saved as a draft.');
        context.pop(true);
      }
    } catch (e) {
      _toast(context, ApiFailure.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _TeacherElScaffold(
      title: 'Add material',
      subtitle: 'Note, file, video or link.',
      children: [
        Wrap(spacing: 8, runSpacing: 8, children: [
          for (final t in _types)
            ChoiceChip(
              avatar: Icon(t.$3, size: 18),
              label: Text(t.$2),
              selected: _type == t.$1,
              onSelected: (_) => setState(() => _type = t.$1),
            ),
        ]),
        TextField(
          controller: _title,
          textCapitalization: TextCapitalization.sentences,
          decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder()),
        ),
        if (_type == 'NOTE')
          TextField(
            controller: _body,
            minLines: 8,
            maxLines: 16,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(
              labelText: 'Note text',
              alignLabelWithHint: true,
              border: OutlineInputBorder(),
            ),
          ),
        if (_type == 'LINK' || _type == 'VIDEO')
          TextField(
            controller: _url,
            keyboardType: TextInputType.url,
            decoration: InputDecoration(
              labelText: _type == 'VIDEO' ? 'Video link (YouTube, Vimeo…)' : 'Web link',
              hintText: 'https://',
              border: const OutlineInputBorder(),
            ),
          ),
        if (_type == 'FILE')
          _ActionCard(
            _fileName ?? 'Choose a file',
            _fileName == null
                ? 'PDF, Word, slides, spreadsheet, image or video (max 25 MB)'
                : '${(_fileSize / 1024).toStringAsFixed(0)} KB · tap to change',
            Icons.upload_file_rounded,
            _busy ? null : _pick,
          ),
        SwitchListTile(
          value: _downloadable,
          onChanged: (v) => setState(() => _downloadable = v),
          title: const Text('Students can download'),
          contentPadding: EdgeInsets.zero,
        ),
        Row(children: [
          Expanded(
            child: OutlinedButton(
              onPressed: _busy ? null : () => _save(publish: false),
              child: const Text('Save draft'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: AppColors.eLearningPrimary),
              onPressed: _busy ? null : () => _save(publish: true),
              child: Text(_busy ? 'Saving…' : 'Publish'),
            ),
          ),
        ]),
      ],
    );
  }
}

// ─── Assignments ─────────────────────────────────────────────────────────────

class TeacherAssignmentsScreen extends ConsumerWidget {
  const TeacherAssignmentsScreen({super.key, required this.courseId});
  final String courseId;

  Future<void> _create(BuildContext context, WidgetRef ref) async {
    final lessons = ref.read(elearningLessonsProvider(courseId)).valueOrNull ?? const <ElearningLessonModel>[];
    final form = await _sheet<Map<String, dynamic>>(context, _AssignmentForm(lessons: lessons));
    if (form == null || !context.mounted) return;
    final publish = form.remove('_publish') == true;
    try {
      final service = ref.read(elearningApiServiceProvider);
      final created = await service.createAssignment(courseId, form);
      if (publish) await service.publishAssignment(courseId, created['id'] as String);
      ref.invalidate(elearningAssignmentsProvider(courseId));
      if (context.mounted) {
        _toast(context, publish ? 'Assignment published to your class.' : 'Assignment saved as a draft.');
      }
    } catch (e) {
      _toast(context, ApiFailure.from(e).message);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final assignmentsAsync = ref.watch(elearningAssignmentsProvider(courseId));
    return _TeacherElScaffold(
      title: 'Assignments',
      subtitle: 'Create, publish, close and grade.',
      onRefresh: () async {
        ref.invalidate(elearningAssignmentsProvider(courseId));
        await ref.read(elearningAssignmentsProvider(courseId).future);
      },
      children: [
        _ActionCard('New assignment', 'Written answer, file upload or both.',
            Icons.add_circle_rounded, () => _create(context, ref)),
        assignmentsAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(
            error: e,
            onRetry: () => ref.invalidate(elearningAssignmentsProvider(courseId)),
          ),
          data: (items) => items.isEmpty
              ? const _ActionCard('No assignments yet', 'Create your first one above.', Icons.assignment_rounded, null)
              : Column(
                  children: [
                    for (final a in items)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ActionCard(
                          a.title,
                          '${_statusLabel(a.status)} · ${_dateTime(a.dueAt)} · ${a.submissionCount} handed in${a.toGradeCount > 0 ? ' · ${a.toGradeCount} to grade' : ''}',
                          Icons.assignment_rounded,
                          () => context.push('/teacher/courses/$courseId/assignments/${a.id}'),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class TeacherAssignmentDetailScreen extends ConsumerWidget {
  const TeacherAssignmentDetailScreen({
    super.key,
    required this.courseId,
    required this.assignmentId,
  });
  final String courseId;
  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (courseId: courseId, assignmentId: assignmentId);
    final assignmentsAsync = ref.watch(elearningAssignmentsProvider(courseId));
    final submissionsAsync = ref.watch(_submissionsProvider(key));
    final missingAsync = ref.watch(_missingProvider(key));
    final assignment = assignmentsAsync.valueOrNull
        ?.where((a) => a.id == assignmentId)
        .cast<ElearningAssignmentModel?>()
        .firstWhere((_) => true, orElse: () => null);

    Future<void> refresh() async {
      ref.invalidate(elearningAssignmentsProvider(courseId));
      ref.invalidate(_submissionsProvider(key));
      ref.invalidate(_missingProvider(key));
      await ref.read(_submissionsProvider(key).future);
    }

    final submissions = submissionsAsync.valueOrNull ?? const <Map<String, dynamic>>[];
    final handedIn = submissions.where((s) => s['status'] != 'DRAFT').toList();
    final toGrade = handedIn.where((s) => s['status'] == 'SUBMITTED').length;

    return _TeacherElScaffold(
      title: assignment?.title ?? 'Assignment',
      subtitle: assignment == null
          ? ''
          : '${_statusLabel(assignment.status)} · ${_dateTime(assignment.dueAt)} · ${_num(assignment.maxScore)} marks',
      onRefresh: refresh,
      children: [
        _MetricGrid(values: [
          ('Handed in', '${handedIn.length}'),
          ('To grade', '$toGrade'),
          ('Missing', missingAsync.hasValue ? '${missingAsync.value!.length}' : '—'),
        ]),
        if (assignment != null && (assignment.instructions).trim().isNotEmpty)
          _ActionCard('Instructions', assignment.instructions, Icons.notes_rounded, null),
        if (assignment != null && assignment.status == 'DRAFT')
          _ActionCard('Publish assignment', 'Students will see it straight away.', Icons.publish_rounded, () async {
            final ok = await _run(context,
                () => ref.read(elearningApiServiceProvider).publishAssignment(courseId, assignmentId),
                success: 'Assignment published.');
            if (ok) await refresh();
          }),
        if (assignment != null && assignment.status == 'PUBLISHED')
          _ActionCard('Close assignment', 'Stop accepting new work. Marking stays open.', Icons.lock_rounded, () async {
            if (!await _confirm(context, 'Close this assignment?', 'Students will no longer be able to hand in or change work.', action: 'Close')) return;
            if (!context.mounted) return;
            final ok = await _run(context,
                () => ref.read(elearningApiServiceProvider).closeAssignment(courseId, assignmentId),
                success: 'Assignment closed.');
            if (ok) await refresh();
          }),
        const _SectionLabel('Submissions'),
        submissionsAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(_submissionsProvider(key))),
          data: (_) => handedIn.isEmpty
              ? const _ActionCard('Nothing handed in yet', 'Pull down to refresh.', Icons.inbox_rounded, null)
              : Column(
                  children: [
                    for (final s in handedIn)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _ActionCard(
                          (s['studentName'] as String?)?.isNotEmpty == true ? s['studentName'] as String : 'Student',
                          '${_statusLabel(s['status'] as String? ?? '')}${s['isLate'] == true ? ' · Late' : ''}${s['status'] == 'GRADED' ? ' · ${_num(_dbl(s['score']))}/${_num(_dbl(s['maxScore']))}' : ''}${(s['registrationNumber'] as String?)?.isNotEmpty == true ? ' · ${s['registrationNumber']}' : ''}',
                          s['status'] == 'GRADED'
                              ? Icons.check_circle_rounded
                              : s['status'] == 'RETURNED'
                                  ? Icons.undo_rounded
                                  : Icons.rate_review_rounded,
                          () async {
                            await context.push('/teacher/courses/$courseId/assignments/$assignmentId/grade/${s['id']}');
                            await refresh();
                          },
                        ),
                      ),
                  ],
                ),
        ),
        missingAsync.maybeWhen(
          data: (missing) => missing.isEmpty
              ? const SizedBox.shrink()
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionLabel('Not handed in (${missing.length})'),
                    for (final m in missing)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _ActionCard(
                          (m['studentName'] as String?)?.isNotEmpty == true ? m['studentName'] as String : 'Student',
                          (m['registrationNumber'] as String?) ?? 'Missing',
                          Icons.hourglass_empty_rounded,
                          null,
                        ),
                      ),
                  ],
                ),
          orElse: () => const SizedBox.shrink(),
        ),
      ],
    );
  }
}

// ─── Grading desk ────────────────────────────────────────────────────────────

class TeacherGradeSubmissionScreen extends ConsumerStatefulWidget {
  const TeacherGradeSubmissionScreen({
    super.key,
    required this.courseId,
    required this.assignmentId,
    required this.submissionId,
  });
  final String courseId;
  final String assignmentId;
  final String submissionId;

  @override
  ConsumerState<TeacherGradeSubmissionScreen> createState() =>
      _TeacherGradeSubmissionScreenState();
}

class _TeacherGradeSubmissionScreenState
    extends ConsumerState<TeacherGradeSubmissionScreen> {
  final _score = TextEditingController();
  final _feedback = TextEditingController();
  bool _seeded = false;
  bool _busy = false;

  @override
  void dispose() {
    _score.dispose();
    _feedback.dispose();
    super.dispose();
  }

  Future<void> _openFile(Map<String, dynamic> sub) async {
    setState(() => _busy = true);
    try {
      final info = await ref.read(elearningApiServiceProvider).submissionDownload(widget.submissionId);
      final url = (info['download'] as Map?)?['url'] as String?;
      if (url == null || url.isEmpty) {
        _toast(context, 'No file is attached to this submission.');
        return;
      }
      final token = await ref.read(secureStorageProvider).read(key: 'access_token');
      final full = url.startsWith('http') ? url : '${AppConfig.apiBaseUrl}$url';
      final file = await DefaultCacheManager().getSingleFile(
        full,
        headers: token == null ? null : {'Authorization': 'Bearer $token'},
      );
      final result = await OpenFile.open(file.path);
      if (result.type != ResultType.done && mounted) {
        _toast(context, 'No app on this device can open that file type.');
      }
    } catch (e) {
      _toast(context, ApiFailure.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _grade(double max) async {
    final score = double.tryParse(_score.text.trim());
    if (score == null) return _toast(context, 'Enter a score.');
    if (score < 0 || score > max) return _toast(context, 'The score must be between 0 and ${_num(max)}.');
    setState(() => _busy = true);
    final ok = await _run(context, () async {
      await ref.read(elearningApiServiceProvider).gradeSubmission(widget.submissionId, {
        'score': score,
        'maxScore': max,
        'feedback': _feedback.text.trim(),
      });
    }, success: 'Grade saved. The student can see it now.');
    if (mounted) setState(() => _busy = false);
    if (ok && mounted) context.pop();
  }

  Future<void> _return() async {
    if (_feedback.text.trim().isEmpty) {
      return _toast(context, 'Tell the student what to correct in the feedback box.');
    }
    if (!await _confirm(context, 'Return for correction?', 'The student can edit and hand the work in again. Any grade is cleared.', action: 'Return')) return;
    if (!mounted) return;
    setState(() => _busy = true);
    final ok = await _run(context, () async {
      await ref.read(elearningApiServiceProvider).returnSubmission(widget.submissionId, {'feedback': _feedback.text.trim()});
    }, success: 'Returned to the student.');
    if (mounted) setState(() => _busy = false);
    if (ok && mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final key = (courseId: widget.courseId, assignmentId: widget.assignmentId);
    final subsAsync = ref.watch(_submissionsProvider(key));
    final assignment = ref.watch(elearningAssignmentsProvider(widget.courseId)).valueOrNull
        ?.where((a) => a.id == widget.assignmentId)
        .cast<ElearningAssignmentModel?>()
        .firstWhere((_) => true, orElse: () => null);

    return subsAsync.when(
      loading: () => const _TeacherElScaffold(title: 'Grading desk', subtitle: '', children: [_InlineLoader()]),
      error: (e, _) => _TeacherElScaffold(
        title: 'Grading desk',
        subtitle: '',
        children: [KSErrorView(error: e, onRetry: () => ref.invalidate(_submissionsProvider(key)))],
      ),
      data: (subs) {
        final sub = subs.where((s) => s['id'] == widget.submissionId).cast<Map<String, dynamic>?>().firstWhere((_) => true, orElse: () => null);
        if (sub == null) {
          return const _TeacherElScaffold(title: 'Grading desk', subtitle: '', children: [
            _ActionCard('Submission not found', 'It may have been removed.', Icons.error_outline_rounded, null),
          ]);
        }
        final max = _dbl(sub['maxScore']) ?? assignment?.maxScore ?? 100;
        if (!_seeded) {
          _seeded = true;
          final existing = _dbl(sub['score']);
          if (sub['status'] == 'GRADED' && existing != null) _score.text = _num(existing);
          _feedback.text = (sub['feedback'] as String?) ?? '';
        }
        final name = (sub['studentName'] as String?)?.isNotEmpty == true ? sub['studentName'] as String : 'Student';
        final text = (sub['textContent'] as String?)?.trim() ?? '';
        final hasFile = (sub['fileKey'] as String?)?.isNotEmpty == true;
        final late = sub['isLate'] == true;
        final penalty = assignment?.latePenaltyPercent ?? 0;

        return _TeacherElScaffold(
          title: name,
          subtitle: '${assignment?.title ?? 'Assignment'} · ${_statusLabel(sub['status'] as String? ?? '')}${late ? ' · Late' : ''}',
          children: [
            if (late && penalty > 0)
              _ActionCard('Late submission', '${_num(penalty)}% will be deducted from the score you enter.', Icons.schedule_rounded, null),
            _ActionCard(
              'Student answer',
              text.isEmpty ? (hasFile ? 'No written answer, see the attached file.' : 'No written answer.') : text,
              Icons.edit_note_rounded,
              null,
            ),
            if (hasFile)
              _ActionCard(
                (sub['fileOriginalName'] as String?) ?? 'Attached file',
                'Tap to open',
                Icons.attach_file_rounded,
                _busy ? null : () => _openFile(sub),
              ),
            TextField(
              controller: _score,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Score (out of ${_num(max)})',
                border: const OutlineInputBorder(),
              ),
            ),
            TextField(
              controller: _feedback,
              minLines: 3,
              maxLines: 6,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Feedback for the student',
                alignLabelWithHint: true,
                border: OutlineInputBorder(),
              ),
            ),
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.eLearningPrimary,
                minimumSize: const Size.fromHeight(52),
              ),
              onPressed: _busy ? null : () => _grade(max),
              child: Text(_busy ? 'Working…' : (sub['status'] == 'GRADED' ? 'Update grade' : 'Save grade')),
            ),
            OutlinedButton(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
              onPressed: _busy ? null : _return,
              child: const Text('Return for correction'),
            ),
          ],
        );
      },
    );
  }
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

class TeacherQuizDetailScreen extends ConsumerWidget {
  const TeacherQuizDetailScreen({
    super.key,
    required this.courseId,
    required this.quizId,
  });
  final String courseId;
  final String quizId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (courseId: courseId, quizId: quizId);
    final quizAsync = ref.watch(elearningQuizProvider(key));
    final attempts = ref.watch(_quizResultsProvider(key)).valueOrNull ?? const <Map<String, dynamic>>[];

    Future<void> refresh() async {
      ref.invalidate(elearningQuizProvider(key));
      ref.invalidate(_quizResultsProvider(key));
      ref.invalidate(elearningQuizzesProvider(courseId));
      await ref.read(elearningQuizProvider(key).future);
    }

    return quizAsync.when(
      loading: () => const _TeacherElScaffold(title: 'Quiz', subtitle: '', children: [_InlineLoader()]),
      error: (e, _) => _TeacherElScaffold(
        title: 'Quiz',
        subtitle: '',
        children: [KSErrorView(error: e, onRetry: () => ref.invalidate(elearningQuizProvider(key)))],
      ),
      data: (quiz) {
        final needsMarking = attempts.where((a) => a['status'] == 'SUBMITTED').length;
        return _TeacherElScaffold(
          title: quiz.title,
          subtitle: '${_statusLabel(quiz.status)} · ${quiz.questions.length} question${quiz.questions.length == 1 ? '' : 's'} · ${_num(quiz.totalPoints)} pts',
          onRefresh: refresh,
          children: [
            _MetricGrid(values: [
              ('Questions', '${quiz.questions.length}'),
              ('Pass mark', quiz.passingScore != null ? '${_num(quiz.passingScore)}%' : '—'),
              ('Attempts', '${quiz.maxAttempts}'),
            ]),
            _ActionCard(
              'Settings',
              '${quiz.timeLimitMinutes != null ? '${quiz.timeLimitMinutes} min limit' : 'No time limit'} · answers ${switch (quiz.showCorrectAfter) {
                'IMMEDIATELY' => 'shown right after submitting',
                'NEVER' => 'never shown',
                _ => 'shown after the quiz closes',
              }}',
              Icons.tune_rounded,
              null,
            ),
            if (quiz.status == 'DRAFT')
              _ActionCard(
                'Publish quiz',
                quiz.questions.isEmpty ? 'Add at least one question first.' : 'Students will be able to start it straight away.',
                Icons.publish_rounded,
                () async {
                  final ok = await _run(context,
                      () => ref.read(elearningApiServiceProvider).publishQuiz(courseId, quizId),
                      success: 'Quiz published.');
                  if (ok) await refresh();
                },
              ),
            if (quiz.status == 'PUBLISHED')
              _ActionCard(
                'Close quiz',
                'Stop new attempts. Students can then see the answer key if you allowed it.',
                Icons.lock_rounded,
                () async {
                  if (!await _confirm(context, 'Close this quiz?', 'Nobody can start a new attempt after this.', action: 'Close')) return;
                  if (!context.mounted) return;
                  final ok = await _run(context,
                      () => ref.read(elearningApiServiceProvider).closeQuiz(courseId, quizId),
                      success: 'Quiz closed.');
                  if (ok) await refresh();
                },
              ),
            _ActionCard(
              quiz.status == 'DRAFT' ? 'Question builder' : 'Questions',
              quiz.status == 'DRAFT'
                  ? 'Add, review and remove questions.'
                  : 'Review the questions and answer key.',
              Icons.edit_note_rounded,
              () async {
                await context.push('/teacher/courses/$courseId/quizzes/$quizId/builder');
                await refresh();
              },
            ),
            _ActionCard(
              'Results and marking',
              needsMarking > 0
                  ? '$needsMarking attempt${needsMarking == 1 ? '' : 's'} need marking'
                  : '${attempts.length} attempt${attempts.length == 1 ? '' : 's'} so far',
              Icons.bar_chart_rounded,
              () async {
                await context.push('/teacher/courses/$courseId/quizzes/$quizId/results');
                await refresh();
              },
            ),
          ],
        );
      },
    );
  }
}

class TeacherQuizBuilderScreen extends ConsumerWidget {
  const TeacherQuizBuilderScreen({
    super.key,
    required this.courseId,
    required this.quizId,
  });
  final String courseId;
  final String quizId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (courseId: courseId, quizId: quizId);
    final quizAsync = ref.watch(elearningQuizProvider(key));

    Future<void> add() async {
      final body = await _sheet<Map<String, dynamic>>(context, const _QuestionForm());
      if (body == null || !context.mounted) return;
      final ok = await _run(context,
          () => ref.read(elearningApiServiceProvider).addQuestion(quizId, body),
          success: 'Question added.');
      if (ok) {
        ref.invalidate(elearningQuizProvider(key));
        ref.invalidate(elearningQuizzesProvider(courseId));
      }
    }

    return quizAsync.when(
      loading: () => const _TeacherElScaffold(title: 'Questions', subtitle: '', children: [_InlineLoader()]),
      error: (e, _) => _TeacherElScaffold(
        title: 'Questions',
        subtitle: '',
        children: [KSErrorView(error: e, onRetry: () => ref.invalidate(elearningQuizProvider(key)))],
      ),
      data: (quiz) {
        final questions = [...quiz.questions]..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
        final locked = quiz.status != 'DRAFT';
        return _TeacherElScaffold(
          title: quiz.title,
          subtitle: '${questions.length} question${questions.length == 1 ? '' : 's'} · ${_num(quiz.totalPoints)} points',
          onRefresh: () async {
            ref.invalidate(elearningQuizProvider(key));
            await ref.read(elearningQuizProvider(key).future);
          },
          children: [
            if (!locked)
              _ActionCard('Add a question', 'Multiple choice, true/false or short answer.', Icons.add_circle_rounded, add)
            else
              const _ActionCard(
                'Questions are locked',
                'This quiz is live. Questions can only be changed while it is a draft.',
                Icons.lock_rounded,
                null,
              ),
            for (var i = 0; i < questions.length; i++)
              _QuestionCard(
                number: i + 1,
                question: questions[i],
                onDelete: locked
                    ? null
                    : () async {
                        if (!await _confirm(context, 'Delete this question?', questions[i].prompt, action: 'Delete')) return;
                        if (!context.mounted) return;
                        final ok = await _run(context,
                            () => ref.read(elearningApiServiceProvider).deleteQuestion(quizId, questions[i].id));
                        if (ok) {
                          ref.invalidate(elearningQuizProvider(key));
                          ref.invalidate(elearningQuizzesProvider(courseId));
                        }
                      },
              ),
          ],
        );
      },
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.number, required this.question, this.onDelete});
  final int number;
  final ElearningQuizQuestionModel question;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) {
    final q = question;
    final options = [...q.options]..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(
                  'Q$number · ${switch (q.type) {
                    'MULTIPLE_CHOICE' => 'Multiple choice',
                    'TRUE_FALSE' => 'True / false',
                    _ => 'Short answer'
                  }} · ${_num(q.points)} pt${q.points == 1 ? '' : 's'}',
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 12, color: AppColors.eLearningPrimary),
                ),
              ),
              if (onDelete != null)
                IconButton(
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.delete_outline_rounded),
                  onPressed: onDelete,
                ),
            ]),
            Text(q.prompt, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            if (q.type == 'MULTIPLE_CHOICE')
              for (final o in options)
                Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    Icon(
                      o.isCorrect == true ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                      size: 18,
                      color: o.isCorrect == true ? Colors.green.shade600 : Colors.grey,
                    ),
                    const SizedBox(width: 8),
                    Expanded(child: Text(o.text)),
                  ]),
                ),
            if (q.type == 'TRUE_FALSE')
              Text('Correct answer: ${(q.correctAnswer ?? '').toLowerCase() == 'true' ? 'True' : 'False'}',
                  style: TextStyle(color: Colors.green.shade700, fontWeight: FontWeight.w800)),
            if (q.type == 'SHORT_ANSWER')
              const Text('Marked by you after the student submits.', style: TextStyle(fontStyle: FontStyle.italic)),
            if ((q.explanation ?? '').trim().isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Explanation: ${q.explanation}', style: const TextStyle(fontSize: 12.5)),
              ),
          ],
        ),
      ),
    );
  }
}

// ─── Quiz results and manual marking ─────────────────────────────────────────

class TeacherQuizResultsScreen extends ConsumerWidget {
  const TeacherQuizResultsScreen({
    super.key,
    required this.courseId,
    required this.quizId,
  });
  final String courseId;
  final String quizId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final key = (courseId: courseId, quizId: quizId);
    final resultsAsync = ref.watch(_quizResultsProvider(key));
    final quiz = ref.watch(elearningQuizProvider(key)).valueOrNull;

    Future<void> refresh() async {
      ref.invalidate(_quizResultsProvider(key));
      await ref.read(_quizResultsProvider(key).future);
    }

    return _TeacherElScaffold(
      title: 'Results',
      subtitle: quiz?.title ?? '',
      onRefresh: refresh,
      children: [
        resultsAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(_quizResultsProvider(key))),
          data: (attempts) {
            final done = attempts.where((a) => a['status'] != 'IN_PROGRESS').toList();
            final scored = done.map((a) => _dbl(a['percentScore'])).whereType<double>().toList();
            final avg = scored.isEmpty ? null : scored.reduce((a, b) => a + b) / scored.length;
            final needs = done.where((a) => a['status'] == 'SUBMITTED').length;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MetricGrid(values: [
                  ('Attempts', '${done.length}'),
                  ('Average', avg == null ? '—' : '${avg.toStringAsFixed(0)}%'),
                  ('To mark', '$needs'),
                ]),
                const SizedBox(height: 12),
                if (done.isEmpty)
                  const _ActionCard('No attempts yet', 'Results appear as students submit.', Icons.inbox_rounded, null),
                for (final a in done)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ActionCard(
                      (a['studentName'] as String?)?.isNotEmpty == true ? a['studentName'] as String : 'Student',
                      'Attempt ${a['attemptNumber']} · ${_statusLabel(a['status'] as String? ?? '')} · ${_num(_dbl(a['totalScore']))}/${_num(_dbl(a['maxScore']))}${_dbl(a['percentScore']) != null ? ' (${_num(_dbl(a['percentScore']))}%)' : ''}${a['isPassed'] == true ? ' · Passed' : a['isPassed'] == false ? ' · Not passed' : ''}',
                      a['status'] == 'SUBMITTED' ? Icons.rate_review_rounded : Icons.check_circle_rounded,
                      quiz == null
                          ? null
                          : () async {
                              await _sheet<void>(context, _MarkAttemptSheet(attempt: a, quiz: quiz));
                              await refresh();
                            },
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _MarkAttemptSheet extends ConsumerStatefulWidget {
  const _MarkAttemptSheet({required this.attempt, required this.quiz});
  final Map<String, dynamic> attempt;
  final ElearningQuizModel quiz;

  @override
  ConsumerState<_MarkAttemptSheet> createState() => _MarkAttemptSheetState();
}

class _MarkAttemptSheetState extends ConsumerState<_MarkAttemptSheet> {
  final Map<String, TextEditingController> _scores = {};
  bool _busy = false;

  @override
  void dispose() {
    for (final c in _scores.values) { c.dispose(); }
    super.dispose();
  }

  Future<void> _mark(ElearningQuizQuestionModel q) async {
    final controller = _scores[q.id];
    final value = double.tryParse(controller?.text.trim() ?? '');
    if (value == null) return _toast(context, 'Enter a score for this answer.');
    if (value < 0 || value > q.points) return _toast(context, 'Score must be between 0 and ${_num(q.points)}.');
    setState(() => _busy = true);
    final ok = await _run(context, () async {
      await ref.read(elearningApiServiceProvider).gradeShortAnswer(
        widget.attempt['id'] as String,
        {'questionId': q.id, 'scoreAwarded': value},
      );
    }, success: 'Marked.');
    if (mounted) setState(() => _busy = false);
    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final answers = (widget.attempt['answers'] as List?)?.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList() ?? const <Map<String, dynamic>>[];
    final shorts = widget.quiz.questions.where((q) => q.type == 'SHORT_ANSWER').toList();
    final name = (widget.attempt['studentName'] as String?) ?? 'Student';

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
            Text(
              'Attempt ${widget.attempt['attemptNumber']} · ${_num(_dbl(widget.attempt['totalScore']))}/${_num(_dbl(widget.attempt['maxScore']))} points',
            ),
            const SizedBox(height: 16),
            if (shorts.isEmpty)
              const Text('This quiz was marked automatically. There are no written answers to mark.'),
            for (final q in shorts) ...[
              Builder(builder: (_) {
                final ans = answers.where((a) => a['questionId'] == q.id).cast<Map<String, dynamic>?>().firstWhere((_) => true, orElse: () => null);
                final text = (ans?['textAnswer'] as String?)?.trim() ?? '';
                final awarded = _dbl(ans?['scoreAwarded']);
                _scores.putIfAbsent(q.id, () => TextEditingController(text: awarded == null ? '' : _num(awarded)));
                return Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(q.prompt, style: const TextStyle(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 8),
                        Text(text.isEmpty ? 'No answer given' : text,
                            style: TextStyle(fontStyle: text.isEmpty ? FontStyle.italic : null)),
                        const SizedBox(height: 12),
                        if (text.isNotEmpty)
                          Row(children: [
                            Expanded(
                              child: TextField(
                                controller: _scores[q.id],
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: InputDecoration(
                                  labelText: 'Score (max ${_num(q.points)})',
                                  border: const OutlineInputBorder(),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            FilledButton(
                              onPressed: _busy ? null : () => _mark(q),
                              child: Text(awarded == null ? 'Save' : 'Update'),
                            ),
                          ]),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Engagement ──────────────────────────────────────────────────────────────

class TeacherCourseEngagementScreen extends ConsumerWidget {
  const TeacherCourseEngagementScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rosterAsync = ref.watch(_rosterProvider(courseId));
    return _TeacherElScaffold(
      title: 'Engagement',
      subtitle: 'Completion per student and who needs a nudge.',
      onRefresh: () async {
        ref.invalidate(_rosterProvider(courseId));
        await ref.read(_rosterProvider(courseId).future);
      },
      children: [
        rosterAsync.when(
          loading: () => const _InlineLoader(),
          error: (e, _) => KSErrorView(error: e, onRetry: () => ref.invalidate(_rosterProvider(courseId))),
          data: (roster) {
            final rows = roster
                .where((r) => r['status'] != 'INACTIVE')
                .map((r) {
                  final p = (r['progress'] as Map?) ?? const {};
                  return (
                    name: (r['studentName'] as String?)?.isNotEmpty == true ? r['studentName'] as String : 'Student',
                    reg: (r['registrationNumber'] as String?) ?? '',
                    pct: (p['completionPercent'] as num?)?.toInt() ?? 0,
                    viewed: (p['viewed'] as num?)?.toInt() ?? 0,
                    materials: (p['materials'] as num?)?.toInt() ?? 0,
                    submitted: (p['submissions'] as num?)?.toInt() ?? 0,
                    assignments: (p['assignments'] as num?)?.toInt() ?? 0,
                    attempts: (p['attempts'] as num?)?.toInt() ?? 0,
                    quizzes: (p['quizzes'] as num?)?.toInt() ?? 0,
                  );
                })
                .toList()
              ..sort((a, b) => a.pct.compareTo(b.pct));
            final avg = rows.isEmpty ? 0 : rows.fold<int>(0, (a, r) => a + r.pct) ~/ rows.length;
            final atRisk = rows.where((r) => r.pct < 40).length;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _MetricGrid(values: [
                  ('Students', '${rows.length}'),
                  ('Avg completion', '$avg%'),
                  ('Need a nudge', '$atRisk'),
                ]),
                const SizedBox(height: 12),
                if (rows.isEmpty)
                  const _ActionCard('No students enrolled yet', 'Students appear once they are linked to this class.', Icons.group_rounded, null),
                for (final r in rows)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Card(
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(children: [
                              Icon(
                                r.pct < 40 ? Icons.warning_rounded : Icons.check_circle_rounded,
                                size: 20,
                                color: r.pct < 40 ? Colors.red.shade400 : r.pct < 70 ? Colors.amber.shade700 : Colors.green.shade600,
                              ),
                              const SizedBox(width: 8),
                              Expanded(child: Text(r.name, style: const TextStyle(fontWeight: FontWeight.w900))),
                              Text('${r.pct}%', style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.eLearningPrimary)),
                            ]),
                            const SizedBox(height: 8),
                            LinearProgressIndicator(
                              value: r.pct / 100,
                              minHeight: 6,
                              borderRadius: BorderRadius.circular(6),
                              color: AppColors.eLearningPrimary,
                              backgroundColor: AppColors.eLearningLight,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Materials ${r.viewed}/${r.materials} · Work ${r.submitted}/${r.assignments} · Quizzes ${r.attempts}/${r.quizzes}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

// ─── Form sheets ─────────────────────────────────────────────────────────────

class _SheetFrame extends StatelessWidget {
  const _SheetFrame({required this.title, required this.children, required this.action, required this.onSubmit});
  final String title;
  final List<Widget> children;
  final String action;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
              const SizedBox(height: 16),
              for (final c in children) ...[c, const SizedBox(height: 12)],
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.eLearningPrimary,
                  minimumSize: const Size.fromHeight(52),
                ),
                onPressed: onSubmit,
                child: Text(action),
              ),
            ],
          ),
        ),
      );
}

InputDecoration _dec(String label, {String? hint}) =>
    InputDecoration(labelText: label, hintText: hint, border: const OutlineInputBorder());

class _LessonForm extends StatefulWidget {
  const _LessonForm();
  @override
  State<_LessonForm> createState() => _LessonFormState();
}

class _LessonFormState extends State<_LessonForm> {
  final _title = TextEditingController();
  final _desc = TextEditingController();
  final _week = TextEditingController();
  final _minutes = TextEditingController();

  @override
  void dispose() {
    _title.dispose(); _desc.dispose(); _week.dispose(); _minutes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _SheetFrame(
        title: 'New lesson',
        action: 'Create lesson',
        onSubmit: () {
          if (_title.text.trim().isEmpty) return _toast(context, 'Give the lesson a title.');
          Navigator.of(context).pop(<String, dynamic>{
            'title': _title.text.trim(),
            if (_desc.text.trim().isNotEmpty) 'description': _desc.text.trim(),
            if (int.tryParse(_week.text.trim()) != null) 'weekNumber': int.parse(_week.text.trim()),
            if (int.tryParse(_minutes.text.trim()) != null) 'estimatedMinutes': int.parse(_minutes.text.trim()),
          });
        },
        children: [
          TextField(controller: _title, textCapitalization: TextCapitalization.sentences, decoration: _dec('Title')),
          TextField(controller: _desc, minLines: 2, maxLines: 4, textCapitalization: TextCapitalization.sentences, decoration: _dec('Short description (optional)')),
          Row(children: [
            Expanded(child: TextField(controller: _week, keyboardType: TextInputType.number, decoration: _dec('Week'))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _minutes, keyboardType: TextInputType.number, decoration: _dec('Minutes'))),
          ]),
        ],
      );
}

class _AnnouncementForm extends StatefulWidget {
  const _AnnouncementForm();
  @override
  State<_AnnouncementForm> createState() => _AnnouncementFormState();
}

class _AnnouncementFormState extends State<_AnnouncementForm> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _pin = false;

  @override
  void dispose() {
    _title.dispose(); _body.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _SheetFrame(
        title: 'Announcement',
        action: 'Post to class',
        onSubmit: () {
          if (_title.text.trim().isEmpty || _body.text.trim().isEmpty) {
            return _toast(context, 'Add a title and a message.');
          }
          Navigator.of(context).pop(<String, dynamic>{
            'title': _title.text.trim(),
            'body': _body.text.trim(),
            'isPinned': _pin,
          });
        },
        children: [
          TextField(controller: _title, textCapitalization: TextCapitalization.sentences, decoration: _dec('Title')),
          TextField(controller: _body, minLines: 4, maxLines: 8, textCapitalization: TextCapitalization.sentences, decoration: _dec('Message')),
          SwitchListTile(
            value: _pin,
            onChanged: (v) => setState(() => _pin = v),
            title: const Text('Pin to the top'),
            contentPadding: EdgeInsets.zero,
          ),
        ],
      );
}

class _AssignmentForm extends StatefulWidget {
  const _AssignmentForm({required this.lessons});
  final List<ElearningLessonModel> lessons;
  @override
  State<_AssignmentForm> createState() => _AssignmentFormState();
}

class _AssignmentFormState extends State<_AssignmentForm> {
  final _title = TextEditingController();
  final _instructions = TextEditingController();
  final _max = TextEditingController(text: '100');
  final _penalty = TextEditingController(text: '0');
  String _type = 'BOTH';
  bool _late = true;
  DateTime? _due;
  String? _lessonId;

  @override
  void dispose() {
    _title.dispose(); _instructions.dispose(); _max.dispose(); _penalty.dispose();
    super.dispose();
  }

  Future<void> _pickDue() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _due ?? now.add(const Duration(days: 3)),
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_due ?? DateTime(now.year, now.month, now.day, 23, 59)),
    );
    if (time == null) return;
    setState(() => _due = DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  void _submit(bool publish) {
    final max = double.tryParse(_max.text.trim());
    final penalty = double.tryParse(_penalty.text.trim()) ?? 0;
    if (_title.text.trim().isEmpty) return _toast(context, 'Give the assignment a title.');
    if (max == null || max <= 0) return _toast(context, 'Enter the maximum score.');
    if (penalty < 0 || penalty > 100) return _toast(context, 'The late penalty must be between 0 and 100.');
    Navigator.of(context).pop(<String, dynamic>{
      'title': _title.text.trim(),
      'instructions': _instructions.text.trim(),
      'type': _type,
      'maxScore': max,
      if (_due != null) 'dueAt': _due!.toUtc().toIso8601String(),
      'allowLateSubmission': _late,
      'latePenaltyPercent': _late ? penalty : 0,
      if (_lessonId != null) 'lessonId': _lessonId,
      '_publish': publish,
    });
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('New assignment', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
              const SizedBox(height: 16),
              TextField(controller: _title, textCapitalization: TextCapitalization.sentences, decoration: _dec('Title')),
              const SizedBox(height: 12),
              TextField(controller: _instructions, minLines: 3, maxLines: 6, textCapitalization: TextCapitalization.sentences, decoration: _dec('Instructions')),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'TEXT', label: Text('Written')),
                  ButtonSegment(value: 'FILE_UPLOAD', label: Text('File')),
                  ButtonSegment(value: 'BOTH', label: Text('Both')),
                ],
                selected: {_type},
                onSelectionChanged: (s) => setState(() => _type = s.first),
              ),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: TextField(controller: _max, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: _dec('Max score'))),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                    onPressed: _pickDue,
                    icon: const Icon(Icons.event_rounded),
                    label: Text(_due == null ? 'Set deadline' : DateFormat('d MMM, HH:mm').format(_due!), overflow: TextOverflow.ellipsis),
                  ),
                ),
              ]),
              SwitchListTile(
                value: _late,
                onChanged: (v) => setState(() => _late = v),
                title: const Text('Accept late work'),
                contentPadding: EdgeInsets.zero,
              ),
              if (_late)
                TextField(controller: _penalty, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: _dec('Late penalty (%)', hint: '0 for none')),
              if (widget.lessons.isNotEmpty) ...[
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  initialValue: _lessonId,
                  decoration: _dec('Lesson (optional)'),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('Not linked to a lesson')),
                    for (final l in widget.lessons) DropdownMenuItem<String?>(value: l.id, child: Text(l.title, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (v) => setState(() => _lessonId = v),
                ),
              ],
              const SizedBox(height: 16),
              Row(children: [
                Expanded(child: OutlinedButton(onPressed: () => _submit(false), child: const Text('Save draft'))),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    style: FilledButton.styleFrom(backgroundColor: AppColors.eLearningPrimary, minimumSize: const Size.fromHeight(52)),
                    onPressed: () => _submit(true),
                    child: const Text('Publish'),
                  ),
                ),
              ]),
            ],
          ),
        ),
      );
}

class _QuizForm extends StatefulWidget {
  const _QuizForm({required this.lessons});
  final List<ElearningLessonModel> lessons;
  @override
  State<_QuizForm> createState() => _QuizFormState();
}

class _QuizFormState extends State<_QuizForm> {
  final _title = TextEditingController();
  final _instructions = TextEditingController();
  final _minutes = TextEditingController();
  final _attempts = TextEditingController(text: '1');
  final _pass = TextEditingController(text: '50');
  String _reveal = 'AFTER_CLOSE';
  String? _lessonId;

  @override
  void dispose() {
    _title.dispose(); _instructions.dispose(); _minutes.dispose(); _attempts.dispose(); _pass.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _SheetFrame(
        title: 'New quiz',
        action: 'Create and add questions',
        onSubmit: () {
          final attempts = int.tryParse(_attempts.text.trim());
          final pass = double.tryParse(_pass.text.trim());
          if (_title.text.trim().isEmpty) return _toast(context, 'Give the quiz a title.');
          if (attempts == null || attempts < 1) return _toast(context, 'Attempts must be at least 1.');
          if (pass != null && (pass < 0 || pass > 100)) return _toast(context, 'Pass mark must be between 0 and 100.');
          Navigator.of(context).pop(<String, dynamic>{
            'title': _title.text.trim(),
            if (_instructions.text.trim().isNotEmpty) 'instructions': _instructions.text.trim(),
            if (int.tryParse(_minutes.text.trim()) != null) 'timeLimitMinutes': int.parse(_minutes.text.trim()),
            'maxAttempts': attempts,
            if (pass != null) 'passingScore': pass,
            'showCorrectAfter': _reveal,
            if (_lessonId != null) 'lessonId': _lessonId,
          });
        },
        children: [
          TextField(controller: _title, textCapitalization: TextCapitalization.sentences, decoration: _dec('Title')),
          TextField(controller: _instructions, minLines: 2, maxLines: 4, textCapitalization: TextCapitalization.sentences, decoration: _dec('Instructions (optional)')),
          Row(children: [
            Expanded(child: TextField(controller: _minutes, keyboardType: TextInputType.number, decoration: _dec('Time limit (min)', hint: 'None'))),
            const SizedBox(width: 12),
            Expanded(child: TextField(controller: _attempts, keyboardType: TextInputType.number, decoration: _dec('Attempts'))),
          ]),
          TextField(controller: _pass, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: _dec('Pass mark (%)')),
          const Text('Show correct answers', style: TextStyle(fontWeight: FontWeight.w800)),
          Wrap(spacing: 8, children: [
            for (final o in const [('AFTER_CLOSE', 'After quiz closes'), ('IMMEDIATELY', 'Right after submit'), ('NEVER', 'Never')])
              ChoiceChip(label: Text(o.$2), selected: _reveal == o.$1, onSelected: (_) => setState(() => _reveal = o.$1)),
          ]),
          if (widget.lessons.isNotEmpty)
            DropdownButtonFormField<String?>(
              initialValue: _lessonId,
              decoration: _dec('Lesson (optional)'),
              items: [
                const DropdownMenuItem<String?>(value: null, child: Text('Not linked to a lesson')),
                for (final l in widget.lessons) DropdownMenuItem<String?>(value: l.id, child: Text(l.title, overflow: TextOverflow.ellipsis)),
              ],
              onChanged: (v) => setState(() => _lessonId = v),
            ),
        ],
      );
}

class _QuestionForm extends StatefulWidget {
  const _QuestionForm();
  @override
  State<_QuestionForm> createState() => _QuestionFormState();
}

class _QuestionFormState extends State<_QuestionForm> {
  final _prompt = TextEditingController();
  final _points = TextEditingController(text: '1');
  final _explanation = TextEditingController();
  final List<TextEditingController> _options = [for (var i = 0; i < 4; i++) TextEditingController()];
  String _type = 'MULTIPLE_CHOICE';
  int _correct = 0;
  String _tf = 'true';

  @override
  void dispose() {
    _prompt.dispose(); _points.dispose(); _explanation.dispose();
    for (final c in _options) { c.dispose(); }
    super.dispose();
  }

  void _submit() {
    final points = double.tryParse(_points.text.trim());
    if (_prompt.text.trim().isEmpty) return _toast(context, 'Write the question first.');
    if (points == null || points <= 0) return _toast(context, 'Points must be more than 0.');
    final body = <String, dynamic>{
      'type': _type,
      'prompt': _prompt.text.trim(),
      'points': points,
      if (_explanation.text.trim().isNotEmpty) 'explanation': _explanation.text.trim(),
    };
    if (_type == 'MULTIPLE_CHOICE') {
      final filled = <Map<String, dynamic>>[];
      for (var i = 0; i < _options.length; i++) {
        final text = _options[i].text.trim();
        if (text.isEmpty) continue;
        filled.add({'text': text, 'isCorrect': i == _correct});
      }
      if (filled.length < 2) return _toast(context, 'Add at least two options.');
      if (_options[_correct].text.trim().isEmpty) return _toast(context, 'The option marked correct is empty.');
      body['options'] = filled;
    } else if (_type == 'TRUE_FALSE') {
      body['correctAnswer'] = _tf;
    }
    Navigator.of(context).pop(body);
  }

  @override
  Widget build(BuildContext context) => _SheetFrame(
        title: 'Add question',
        action: 'Add question',
        onSubmit: _submit,
        children: [
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'MULTIPLE_CHOICE', label: Text('Choice')),
              ButtonSegment(value: 'TRUE_FALSE', label: Text('True/False')),
              ButtonSegment(value: 'SHORT_ANSWER', label: Text('Short')),
            ],
            selected: {_type},
            onSelectionChanged: (s) => setState(() => _type = s.first),
          ),
          TextField(controller: _prompt, minLines: 2, maxLines: 5, textCapitalization: TextCapitalization.sentences, decoration: _dec('Question')),
          if (_type == 'MULTIPLE_CHOICE') ...[
            const Text('Options (tap the circle to mark the correct one)', style: TextStyle(fontWeight: FontWeight.w800)),
            RadioGroup<int>(
              groupValue: _correct,
              onChanged: (v) => setState(() => _correct = v ?? 0),
              child: Column(children: [
                for (var i = 0; i < _options.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(children: [
                      Radio<int>(value: i),
                      Expanded(child: TextField(controller: _options[i], decoration: _dec('Option ${String.fromCharCode(65 + i)}'))),
                    ]),
                  ),
              ]),
            ),
          ],
          if (_type == 'TRUE_FALSE')
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'true', label: Text('Statement is true')),
                ButtonSegment(value: 'false', label: Text('Statement is false')),
              ],
              selected: {_tf},
              onSelectionChanged: (s) => setState(() => _tf = s.first),
            ),
          if (_type == 'SHORT_ANSWER')
            const Text('Students type a sentence and you mark it after they submit.', style: TextStyle(fontStyle: FontStyle.italic)),
          Row(children: [
            Expanded(child: TextField(controller: _points, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: _dec('Points'))),
          ]),
          TextField(controller: _explanation, minLines: 2, maxLines: 4, textCapitalization: TextCapitalization.sentences, decoration: _dec('Explanation shown with answers (optional)')),
        ],
      );
}

// ─── Layout primitives ───────────────────────────────────────────────────────

class _TeacherElScaffold extends StatelessWidget {
  const _TeacherElScaffold({
    required this.title,
    required this.subtitle,
    required this.children,
    this.onRefresh,
  });
  final String title;
  final String subtitle;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final list = ListView.separated(
      physics: onRefresh == null ? null : const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 110),
      itemBuilder: (_, i) {
        if (i == 0) {
          return subtitle.isEmpty
              ? const SizedBox.shrink()
              : Text(subtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.grey.shade600));
        }
        return children[i - 1];
      },
      separatorBuilder: (_, i) => SizedBox(height: i == 0 && subtitle.isEmpty ? 0 : 12),
      itemCount: children.length + 1,
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        backgroundColor: AppColors.eLearningPrimary,
        foregroundColor: Colors.white,
      ),
      body: onRefresh == null ? list : RefreshIndicator(onRefresh: onRefresh!, child: list),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 2, left: 4),
        child: Text(
          text.toUpperCase(),
          style: const TextStyle(
            fontWeight: FontWeight.w900,
            fontSize: 12,
            letterSpacing: 0.8,
            color: AppColors.eLearningPrimary,
          ),
        ),
      );
}

class _InlineLoader extends StatelessWidget {
  const _InlineLoader();

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(child: CircularProgressIndicator()),
      );
}

class _ActionCard extends StatelessWidget {
  const _ActionCard(this.title, this.subtitle, this.icon, this.onTap);
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        child: ListTile(
          onTap: onTap,
          leading: CircleAvatar(
            backgroundColor: AppColors.eLearningLight,
            child: Icon(icon, color: AppColors.eLearningPrimary),
          ),
          title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          subtitle: Text(subtitle),
          trailing: onTap == null ? null : const Icon(Icons.chevron_right_rounded),
        ),
      );
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.values});
  final List<(String, String)> values;

  @override
  Widget build(BuildContext context) => Row(
        children: [
          for (final value in values)
            Expanded(
              child: Card(
                margin: const EdgeInsets.symmetric(horizontal: 4),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      Text(
                        value.$2,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                          color: AppColors.eLearningPrimary,
                        ),
                      ),
                      Text(
                        value.$1,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      );
}
