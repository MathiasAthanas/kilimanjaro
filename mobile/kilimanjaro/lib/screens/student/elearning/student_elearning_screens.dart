import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:video_player/video_player.dart';

import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/elearning_models.dart';

// ─── Learning Home ────────────────────────────────────────────────────────────

class StudentLearnHomeScreen extends ConsumerWidget {
  const StudentLearnHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(elearningCoursesProvider);
    final summaryAsync = ref.watch(studentElearingSummaryProvider);

    return _LearnScaffold(
      title: 'Learning Hub',
      kicker: 'MY COURSES',
      subtitle: summaryAsync.when(
        data: (s) =>
            '${s.pendingAssignments} pending · ${s.availableQuizzes} quizzes ready',
        loading: () => 'Loading...',
        error: (_, __) => 'Tap a course to continue',
      ),
      children: [
        summaryAsync.when(
          data: (s) => _MetricStrip(items: [
            ('Pending', '${s.pendingAssignments}'),
            ('Quizzes', '${s.availableQuizzes}'),
            ('Unviewed', '${s.unviewedMaterials}'),
          ]),
          loading: () => const SizedBox(height: 108, child: Center(child: CircularProgressIndicator())),
          error: (_, __) => const SizedBox.shrink(),
        ),
        const _SectionTitle('My Courses'),
        coursesAsync.when(
          data: (courses) => courses.isEmpty
              ? const _EmptyState(
                  icon: Icons.school_rounded,
                  message: 'No courses enrolled yet')
              : Column(
                  children: courses
                      .map((course) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _CourseCard(
                              course: course,
                              onTap: () => context
                                  .push('/student/learn/courses/${course.id}'),
                            ),
                          ))
                      .toList(),
                ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorCard(message: e.toString()),
        ),
      ],
    );
  }
}

// ─── Course Space ─────────────────────────────────────────────────────────────

class StudentCourseSpaceScreen extends ConsumerWidget {
  const StudentCourseSpaceScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseAsync = ref.watch(elearningCourseProvider(courseId));
    final progressAsync = ref.watch(elearningProgressProvider(courseId));
    final announcementsAsync =
        ref.watch(elearningAnnouncementsProvider(courseId));

    return courseAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: e.toString()),
      data: (course) => _LearnScaffold(
        title: course.subjectName,
        kicker: '${course.className} · ${course.stageLabel}',
        subtitle: '${course.enrolledCount} students · ${course.status}',
        children: [
          progressAsync.when(
            data: (p) => _ProgressBanner(value: p.completionPercent),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          _SectionTitle('Lessons (${course.lessons.length})'),
          ...course.lessons.map(
            (lesson) => _TaskCard(
              icon: Icons.menu_book_rounded,
              title: lesson.title,
              subtitle: lesson.estimatedMinutes != null
                  ? '${lesson.estimatedMinutes} min'
                  : lesson.description ?? '',
              trailing: lesson.isPublished ? 'Open' : 'Draft',
              onTap: lesson.isPublished
                  ? () => context.push(
                      '/student/learn/courses/$courseId/lesson/${lesson.id}')
                  : null,
            ),
          ),
          const _SectionTitle('Announcements'),
          announcementsAsync.when(
            data: (items) => items.isEmpty
                ? const _EmptyState(
                    icon: Icons.campaign_rounded,
                    message: 'No announcements yet')
                : Column(
                    children: items
                        .map((a) => Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: _TaskCard(
                                icon: a.isPinned
                                    ? Icons.push_pin_rounded
                                    : Icons.campaign_rounded,
                                title: a.title,
                                subtitle: a.body.length > 80
                                    ? '${a.body.substring(0, 80)}…'
                                    : a.body,
                                trailing: a.isPinned ? 'Pinned' : '',
                              ),
                            ))
                        .toList(),
                  ),
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
          ),
          _TaskCard(
            icon: Icons.forum_rounded,
            title: 'Course Discussion',
            subtitle: 'Ask questions and see teacher replies',
            trailing: 'Open',
            onTap: () =>
                context.push('/student/learn/courses/$courseId/discussions'),
          ),
        ],
      ),
    );
  }
}

// ─── Lesson Screen ───────────────────────────────────────────────────────────

class StudentLessonScreen extends ConsumerWidget {
  const StudentLessonScreen({
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
    final assignmentsAsync = ref.watch(elearningAssignmentsProvider(courseId));
    final quizzesAsync = ref.watch(elearningQuizzesProvider(courseId));

    final lesson = lessonsAsync.value?.firstWhere(
      (l) => l.id == lessonId,
      orElse: () => ElearningLessonModel(
        id: lessonId,
        courseSpaceId: courseId,
        title: 'Lesson',
        orderIndex: 0,
        status: 'PUBLISHED',
        materials: const [],
      ),
    );

    return _LearnScaffold(
      title: lesson?.title ?? 'Lesson',
      kicker: 'LESSON ${(lesson?.weekNumber != null) ? "· Week ${lesson!.weekNumber}" : ""}',
      subtitle: lesson?.description ?? 'Read, watch and practise',
      children: [
        const _SectionTitle('Materials'),
        materialsAsync.when(
          data: (materials) => materials.isEmpty
              ? const _EmptyState(
                  icon: Icons.folder_open_rounded, message: 'No materials yet')
              : Column(
                  children: materials
                      .map((m) => Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: _MaterialCard(
                              material: m,
                              onTap: () => context.push(
                                  '/student/learn/materials/${m.id}'),
                            ),
                          ))
                      .toList(),
                ),
          loading: () =>
              const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorCard(message: e.toString()),
        ),
        const _SectionTitle('Assignments'),
        assignmentsAsync.when(
          data: (assignments) {
            final lessonAssignments =
                assignments.where((a) => a.lessonId == lessonId).toList();
            if (lessonAssignments.isEmpty) return const SizedBox.shrink();
            return Column(
              children: lessonAssignments
                  .map((a) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _TaskCard(
                          icon: Icons.assignment_rounded,
                          title: a.title,
                          subtitle: a.dueAt != null
                              ? 'Due ${DateFormat.MMMd().format(a.dueAt!)}'
                              : 'No due date',
                          trailing: a.isOverdue ? 'Overdue' : 'Open',
                          onTap: () => context
                              .push('/student/learn/assignments/${a.id}'),
                        ),
                      ))
                  .toList(),
            );
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
        const _SectionTitle('Quizzes'),
        quizzesAsync.when(
          data: (quizzes) {
            final lessonQuizzes =
                quizzes.where((q) => q.lessonId == lessonId).toList();
            if (lessonQuizzes.isEmpty) return const SizedBox.shrink();
            return Column(
              children: lessonQuizzes
                  .map((q) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _TaskCard(
                          icon: Icons.quiz_rounded,
                          title: q.title,
                          subtitle:
                              '${q.questionCount} questions · ${q.timeLimitMinutes ?? "∞"} min',
                          trailing: 'Start',
                          onTap: () => context
                              .push('/student/learn/quizzes/${q.id}'),
                        ),
                      ))
                  .toList(),
            );
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),
      ],
    );
  }
}

// ─── Material Viewer ─────────────────────────────────────────────────────────

class StudentMaterialViewerScreen extends ConsumerStatefulWidget {
  const StudentMaterialViewerScreen({super.key, required this.materialId});
  final String materialId;

  @override
  ConsumerState<StudentMaterialViewerScreen> createState() =>
      _StudentMaterialViewerScreenState();
}

class _StudentMaterialViewerScreenState
    extends ConsumerState<StudentMaterialViewerScreen> {
  File? _cachedFile;
  String? _noteBody;   // set when the material is a plain text NOTE
  String? _noteTitle;
  bool _loading = true;
  String? _error;
  VideoPlayerController? _videoController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMaterial());
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  Future<void> _loadMaterial() async {
    final service = ref.read(elearningApiServiceProvider);
    try {
      await service.viewMaterial(widget.materialId);
      final info = await service.downloadMaterial(widget.materialId);

      // Handle NOTE type — show body inline without a file download.
      if (info['type'] == 'NOTE') {
        if (mounted) {
          setState(() {
            _noteBody  = (info['body']  as String?) ?? '';
            _noteTitle = (info['title'] as String?);
            _loading   = false;
          });
        }
        return;
      }

      final downloadInfo = info['download'] as Map<String, dynamic>?;
      final url = downloadInfo?['url'] as String?;
      if (url != null && url.isNotEmpty) {
        final fullUrl = url.startsWith('http') ? url : '${_baseUrl()}$url';
        final file = await DefaultCacheManager().getSingleFile(fullUrl);
        if (mounted) setState(() { _cachedFile = file; _loading = false; });
      } else {
        if (mounted) setState(() { _loading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  String _baseUrl() => 'http://localhost:3000';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor:
          Theme.of(context).brightness == Brightness.dark ? Colors.black : Colors.white,
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              size: 48, color: AppColors.error),
                          const SizedBox(height: 16),
                          Text(_error!,
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium),
                          const SizedBox(height: 16),
                          FilledButton(
                            onPressed: () {
                              setState(() { _loading = true; _error = null; });
                              _loadMaterial();
                            },
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                    ),
                  )
                : _noteBody != null
                    ? _NoteViewer(
                        title: _noteTitle,
                        body: _noteBody!,
                        onBack: () => context.pop(),
                      )
                    : _cachedFile != null
                        ? _FileViewer(file: _cachedFile!)
                        : Column(
                            children: [
                              _BackBar(onBack: () => context.pop()),
                              const Expanded(
                                child: Center(
                                  child: Text('No file available for this material.'),
                                ),
                              ),
                            ],
                          ),
      ),
    );
  }
}

class _FileViewer extends StatefulWidget {
  const _FileViewer({required this.file});
  final File file;

  @override
  State<_FileViewer> createState() => _FileViewerState();
}

class _FileViewerState extends State<_FileViewer> {
  VideoPlayerController? _video;
  bool _videoReady = false;

  @override
  void initState() {
    super.initState();
    final path = widget.file.path.toLowerCase();
    if (path.endsWith('.mp4') || path.endsWith('.webm') || path.endsWith('.m4v')) {
      _video = VideoPlayerController.file(widget.file)
        ..initialize().then((_) {
          if (mounted) setState(() => _videoReady = true);
          _video?.play();
        });
    }
  }

  @override
  void dispose() {
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final path = widget.file.path.toLowerCase();

    if (_video != null) {
      return Column(
        children: [
          _BackBar(onBack: () => context.pop()),
          Expanded(
            child: _videoReady
                ? Center(
                    child: AspectRatio(
                      aspectRatio: _video!.value.aspectRatio,
                      child: VideoPlayer(_video!),
                    ),
                  )
                : const Center(child: CircularProgressIndicator()),
          ),
          if (_videoReady)
            VideoProgressIndicator(_video!, allowScrubbing: true,
                padding: const EdgeInsets.all(16)),
          if (_videoReady)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  icon: Icon(_video!.value.isPlaying
                      ? Icons.pause_rounded
                      : Icons.play_arrow_rounded),
                  iconSize: 40,
                  onPressed: () {
                    setState(() {
                      _video!.value.isPlaying
                          ? _video!.pause()
                          : _video!.play();
                    });
                  },
                ),
              ],
            ),
          const SizedBox(height: 16),
        ],
      );
    }

    if (path.endsWith('.pdf')) {
      return Column(
        children: [
          _BackBar(onBack: () => context.pop()),
          Expanded(
            child: PDFView(
              filePath: widget.file.path,
              enableSwipe: true,
              swipeHorizontal: false,
              autoSpacing: true,
              pageFling: true,
            ),
          ),
        ],
      );
    }

    if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.webp')) {
      return Column(
        children: [
          _BackBar(onBack: () => context.pop()),
          Expanded(
            child: InteractiveViewer(
              child: Center(child: Image.file(widget.file)),
            ),
          ),
        ],
      );
    }

    // Fallback: plain text / note
    return FutureBuilder<String>(
      future: widget.file.readAsString(),
      builder: (context, snap) => Column(
        children: [
          _BackBar(onBack: () => context.pop()),
          Expanded(
            child: snap.hasData
                ? SingleChildScrollView(
                    padding: const EdgeInsets.all(24),
                    child: Text(snap.data!,
                        style: Theme.of(context).textTheme.bodyLarge),
                  )
                : const Center(child: CircularProgressIndicator()),
          ),
        ],
      ),
    );
  }
}

class _BackBar extends StatelessWidget {
  const _BackBar({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded),
        onPressed: onBack,
      ),
      Text('Material',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w700)),
    ],
  );
}

// ─── Note Viewer ─────────────────────────────────────────────────────────────

class _NoteViewer extends StatelessWidget {
  const _NoteViewer({required this.body, this.title, required this.onBack});
  final String body;
  final String? title;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header bar
        Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [AppColors.eLearningDark, AppColors.eLearningPrimary],
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(4, 4, 16, 16),
              child: Row(children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new_rounded,
                      color: Colors.white70, size: 18),
                  onPressed: onBack,
                ),
                Expanded(
                  child: Text(
                    title ?? 'Study Note',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 17,
                    ),
                  ),
                ),
                const Icon(Icons.article_rounded, color: Colors.white54, size: 20),
              ]),
            ),
          ),
        ),
        // Note body
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _parseNoteBody(context, body, isDark),
            ),
          ),
        ),
      ],
    );
  }

  List<Widget> _parseNoteBody(
      BuildContext context, String raw, bool isDark) {
    final lines = raw.split('\n');
    final widgets = <Widget>[];
    for (final line in lines) {
      final trimmed = line.trim();
      if (trimmed.isEmpty) {
        widgets.add(const SizedBox(height: 12));
      } else if (trimmed.startsWith('# ')) {
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(trimmed.substring(2),
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w900,
                      color: AppColors.eLearningPrimary)),
        ));
      } else if (trimmed.startsWith('- ') ||
          trimmed.startsWith('• ') ||
          RegExp(r'^\d+\.').hasMatch(trimmed)) {
        // Bullet / numbered point
        widgets.add(Padding(
          padding: const EdgeInsets.only(left: 8, bottom: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 6, height: 6,
                margin: const EdgeInsets.only(top: 7, right: 10),
                decoration: BoxDecoration(
                  color: AppColors.eLearningPrimary,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
              Expanded(
                child: Text(
                  trimmed.replaceFirst(RegExp(r'^[-•]\s+'), ''),
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      height: 1.6,
                      color: isDark ? Colors.white : Colors.black87),
                ),
              ),
            ],
          ),
        ));
      } else if (trimmed.contains(':') && trimmed.length < 80) {
        // Key: value line — render as highlighted term
        final idx = trimmed.indexOf(':');
        final key = trimmed.substring(0, idx).trim();
        final val = trimmed.substring(idx + 1).trim();
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: RichText(
            text: TextSpan(
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  height: 1.6,
                  color: isDark ? Colors.white : Colors.black87),
              children: [
                TextSpan(
                  text: '$key: ',
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      color: AppColors.eLearningPrimary),
                ),
                TextSpan(text: val),
              ],
            ),
          ),
        ));
      } else {
        widgets.add(Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(trimmed,
              style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  height: 1.7,
                  color: isDark ? Colors.white : Colors.black87)),
        ));
      }
    }
    return widgets;
  }
}

// ─── Assignment Screen ───────────────────────────────────────────────────────

class StudentAssignmentScreen extends ConsumerWidget {
  const StudentAssignmentScreen({super.key, required this.assignmentId});
  final String assignmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submissionAsync =
        ref.watch(mySubmissionProvider(assignmentId));

    return _LearnScaffold(
      title: 'Assignment',
      kicker: 'COURSEWORK',
      subtitle: submissionAsync.when(
        data: (s) => s == null
            ? 'Not submitted yet'
            : s.isGraded
                ? 'Graded ${s.scorePercent?.toStringAsFixed(0) ?? ""}%'
                : 'Status: ${s.status}',
        loading: () => 'Loading...',
        error: (_, __) => '',
      ),
      children: [
        submissionAsync.when(
          data: (submission) {
            if (submission?.isGraded == true) {
              return _GradeBanner(submission: submission!);
            }
            return _TaskCard(
              icon: Icons.assignment_turned_in_rounded,
              title: submission == null
                  ? 'Not started'
                  : 'Status: ${submission.status}',
              subtitle: submission?.textContent?.isNotEmpty == true
                  ? '${submission!.textContent!.substring(0, submission.textContent!.length.clamp(0, 80))}…'
                  : 'No content yet',
              trailing: '',
            );
          },
          loading: () =>
              const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorCard(message: e.toString()),
        ),
        _PrimaryAction(
          label: 'Open Submission',
          onTap: () => context
              .push('/student/learn/assignments/$assignmentId/submit'),
        ),
      ],
    );
  }
}

// ─── Submit Assignment ───────────────────────────────────────────────────────

class StudentSubmitAssignmentScreen extends ConsumerStatefulWidget {
  const StudentSubmitAssignmentScreen({super.key, required this.assignmentId});
  final String assignmentId;

  @override
  ConsumerState<StudentSubmitAssignmentScreen> createState() =>
      _StudentSubmitAssignmentScreenState();
}

class _StudentSubmitAssignmentScreenState
    extends ConsumerState<StudentSubmitAssignmentScreen> {
  final _controller = TextEditingController();
  String? _fileName;
  String? _fileBase64;
  String? _fileMime;
  bool _submitting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    setState(() {
      _fileName = picked.name;
      _fileBase64 = base64Encode(bytes);
      _fileMime = 'image/jpeg';
    });
  }

  Future<void> _submit() async {
    if (_controller.text.trim().isEmpty && _fileBase64 == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add text or attach a file first')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final service = ref.read(elearningApiServiceProvider);
      String? fileKey;
      if (_fileBase64 != null && _fileName != null) {
        final uploaded = await service.uploadFile(
          fileName: _fileName!,
          contentBase64: _fileBase64!,
          mimeType: _fileMime ?? 'application/octet-stream',
        );
        fileKey = uploaded['fileKey'] as String?;
      }
      await ref
          .read(submissionNotifierProvider(widget.assignmentId).notifier)
          .saveOrSubmit({
        'textContent': _controller.text.trim(),
        if (fileKey != null) 'fileKey': fileKey,
        if (_fileName != null) 'fileOriginalName': _fileName,
        if (_fileMime != null) 'fileMimeType': _fileMime,
        'submit': true,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Submitted successfully!')),
        );
        context.pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return _LearnScaffold(
      title: 'Submit Assignment',
      kicker: 'SUBMISSION',
      subtitle: 'Type your answer or attach a file',
      children: [
        TextField(
          controller: _controller,
          minLines: 5,
          maxLines: 10,
          decoration: InputDecoration(
            hintText: 'Type your answer here...',
            filled: true,
            fillColor:
                Theme.of(context).brightness == Brightness.dark
                    ? Colors.grey[900]
                    : Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
        if (_fileName != null)
          _TaskCard(
            icon: Icons.attach_file_rounded,
            title: _fileName!,
            subtitle: 'File attached',
            trailing: '✓',
          ),
        _TaskCard(
          icon: Icons.image_rounded,
          title: 'Attach photo or document',
          subtitle: 'Pick from gallery',
          trailing: 'Pick',
          onTap: _pickFile,
        ),
        _PrimaryAction(
          label: _submitting ? 'Submitting...' : 'Submit Assignment',
          onTap: _submitting ? null : _submit,
        ),
      ],
    );
  }
}

// ─── Quiz Lobby ───────────────────────────────────────────────────────────────

class StudentQuizLobbyScreen extends ConsumerWidget {
  const StudentQuizLobbyScreen({super.key, required this.quizId});
  final String quizId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attemptAsync = ref.watch(quizAttemptNotifierProvider(quizId));
    final quizAsync    = ref.watch(elearningQuizByIdProvider(quizId));

    return quizAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (_, __) => _LearnScaffold(
        title: 'Quiz',
        kicker: 'QUIZ LOBBY',
        subtitle: 'Read the instructions, then start when ready',
        children: [_QuizStartButton(quizId: quizId, attemptAsync: attemptAsync)],
      ),
      data: (quiz) => _LearnScaffold(
        title: quiz.title,
        kicker: 'QUIZ LOBBY',
        subtitle: quiz.instructions ?? 'Read the instructions, then start when ready.',
        children: [
          // Quiz info strip
          _TapCard(
            child: Column(children: [
              Row(children: [
                _QuizInfoChip(
                  icon: Icons.quiz_rounded,
                  label: '${quiz.questionCount} questions',
                ),
                const SizedBox(width: 8),
                if (quiz.timeLimitMinutes != null)
                  _QuizInfoChip(
                    icon: Icons.timer_rounded,
                    label: '${quiz.timeLimitMinutes} min',
                  ),
                const SizedBox(width: 8),
                if (quiz.passingScore != null)
                  _QuizInfoChip(
                    icon: Icons.check_circle_rounded,
                    label: 'Pass: ${quiz.passingScore!.toStringAsFixed(0)}%',
                  ),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                _QuizInfoChip(
                  icon: Icons.repeat_rounded,
                  label: 'Max ${quiz.maxAttempts} attempt${quiz.maxAttempts == 1 ? "" : "s"}',
                ),
                const SizedBox(width: 8),
                _QuizInfoChip(
                  icon: Icons.star_rounded,
                  label: '${quiz.totalPoints.toStringAsFixed(0)} points',
                ),
              ]),
            ]),
          ),
          // Question type overview
          _TapCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Question types',
                    style: Theme.of(context).textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w900)),
                const SizedBox(height: 10),
                Wrap(spacing: 8, runSpacing: 8, children: [
                  for (final type in {for (final q in quiz.questions) q.type})
                    _QuizInfoChip(
                      icon: type == 'MULTIPLE_CHOICE'
                          ? Icons.radio_button_checked_rounded
                          : type == 'TRUE_FALSE'
                              ? Icons.check_box_rounded
                              : Icons.short_text_rounded,
                      label: type == 'MULTIPLE_CHOICE'
                          ? 'Multiple choice'
                          : type == 'TRUE_FALSE'
                              ? 'True / False'
                              : 'Short answer',
                    ),
                ]),
              ],
            ),
          ),
          _QuizStartButton(quizId: quizId, attemptAsync: attemptAsync),
        ],
      ),
    );
  }
}

class _QuizInfoChip extends StatelessWidget {
  const _QuizInfoChip({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: AppColors.eLearningLight,
      borderRadius: BorderRadius.circular(999),
    ),
    child: Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(icon, size: 14, color: AppColors.eLearningPrimary),
      const SizedBox(width: 5),
      Text(label, style: const TextStyle(
        fontSize: 12, fontWeight: FontWeight.w800,
        color: AppColors.eLearningPrimary,
      )),
    ]),
  );
}

class _QuizStartButton extends ConsumerWidget {
  const _QuizStartButton({required this.quizId, required this.attemptAsync});
  final String quizId;
  final AsyncValue<ElearningQuizAttemptModel?> attemptAsync;

  @override
  Widget build(BuildContext context, WidgetRef ref) => attemptAsync.when(
    data: (attempt) {
      if (attempt?.isInProgress == true) {
        return _PrimaryAction(
          label: 'Continue Quiz',
          onTap: () => context.push('/student/learn/quizzes/$quizId/attempt'),
        );
      }
      return _PrimaryAction(
        label: 'Start Quiz',
        onTap: () async {
          try {
            await ref.read(quizAttemptNotifierProvider(quizId).notifier).start();
            if (context.mounted) {
              context.push('/student/learn/quizzes/$quizId/attempt');
            }
          } catch (e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context)
                  .showSnackBar(SnackBar(content: Text('Error: $e')));
            }
          }
        },
      );
    },
    loading: () => const Center(child: CircularProgressIndicator()),
    error: (e, _) => _ErrorCard(message: e.toString()),
  );
}

// ─── Quiz Attempt ─────────────────────────────────────────────────────────────

class StudentQuizAttemptScreen extends ConsumerStatefulWidget {
  const StudentQuizAttemptScreen({super.key, required this.quizId});
  final String quizId;

  @override
  ConsumerState<StudentQuizAttemptScreen> createState() =>
      _StudentQuizAttemptScreenState();
}

class _StudentQuizAttemptScreenState
    extends ConsumerState<StudentQuizAttemptScreen> {
  int _currentIndex = 0;
  final Map<String, String> _selectedOptions = {}; // questionId → optionId / 'true' / 'false'
  final Map<String, TextEditingController> _textControllers = {};
  bool _submitting = false;

  @override
  void dispose() {
    for (final c in _textControllers.values) { c.dispose(); }
    super.dispose();
  }

  TextEditingController _controllerFor(String qId) =>
      _textControllers.putIfAbsent(qId, TextEditingController.new);

  Future<void> _submitQuiz() async {
    setState(() => _submitting = true);
    try {
      // Save any open short-answer text as answers (fire-and-forget, best-effort).
      for (final entry in _textControllers.entries) {
        if (entry.value.text.isNotEmpty) {
          await ref
              .read(quizAttemptNotifierProvider(widget.quizId).notifier)
              .answer(entry.key, {'textAnswer': entry.value.text.trim()});
        }
      }
      final result = await ref
          .read(quizAttemptNotifierProvider(widget.quizId).notifier)
          .submit();
      if (mounted) {
        context.pushReplacement(
            '/student/learn/quizzes/${widget.quizId}/result/${result.id}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final attemptAsync = ref.watch(quizAttemptNotifierProvider(widget.quizId));
    final quizAsync    = ref.watch(elearningQuizByIdProvider(widget.quizId));

    return attemptAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: e.toString()),
      data: (attempt) {
        if (attempt == null) {
          return _ErrorScaffold(
              message: 'No active attempt. Go back and tap Start Quiz.');
        }
        return quizAsync.when(
          loading: () => const _LoadingScaffold(),
          error: (e, _) => _ErrorScaffold(message: e.toString()),
          data: (quiz) {
            final questions = [...quiz.questions]
              ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
            if (questions.isEmpty) {
              return Scaffold(
                appBar: AppBar(
                  title: Text(quiz.title),
                  backgroundColor: AppColors.eLearningPrimary,
                  foregroundColor: Colors.white,
                ),
                body: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text('No questions found.'),
                      const SizedBox(height: 24),
                      FilledButton(
                        style: FilledButton.styleFrom(
                            backgroundColor: AppColors.eLearningPrimary),
                        onPressed: _submitting ? null : _submitQuiz,
                        child: Text(_submitting ? 'Submitting…' : 'Submit Quiz'),
                      ),
                    ],
                  ),
                ),
              );
            }

            final q      = questions[_currentIndex];
            final isLast = _currentIndex == questions.length - 1;
            final isDark = Theme.of(context).brightness == Brightness.dark;

            return Scaffold(
              backgroundColor: isDark ? null : AppColors.offWhite,
              appBar: AppBar(
                title: Text(quiz.title),
                backgroundColor: AppColors.eLearningPrimary,
                foregroundColor: Colors.white,
                bottom: PreferredSize(
                  preferredSize: const Size.fromHeight(4),
                  child: LinearProgressIndicator(
                    value: (_currentIndex + 1) / questions.length,
                    backgroundColor: AppColors.eLearningPrimary,
                    valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                    minHeight: 4,
                  ),
                ),
              ),
              body: Column(
                children: [
                  // Question counter header
                  Container(
                    width: double.infinity,
                    color: AppColors.eLearningPrimary.withValues(alpha: 0.08),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Question ${_currentIndex + 1} of ${questions.length}',
                          style: TextStyle(
                            fontWeight: FontWeight.w900,
                            color: AppColors.eLearningPrimary,
                            fontSize: 13,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.eLearningPrimary,
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            '${q.points.toStringAsFixed(0)} pt${q.points == 1 ? "" : "s"}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w900),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Scrollable question + answer area
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(16, 20, 16, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Question prompt card
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: isDark ? Colors.grey[900] : Colors.white,
                              borderRadius: BorderRadius.circular(24),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(children: [
                                  _TypeBadge(type: q.type),
                                ]),
                                const SizedBox(height: 12),
                                Text(
                                  q.prompt,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(
                                          fontWeight: FontWeight.w700,
                                          height: 1.5),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Answer section
                          if (q.type == 'MULTIPLE_CHOICE')
                            _McqOptions(
                              options: q.options,
                              selectedId: _selectedOptions[q.id],
                              onSelect: (optId) async {
                                setState(() => _selectedOptions[q.id] = optId);
                                await ref
                                    .read(quizAttemptNotifierProvider(
                                            widget.quizId)
                                        .notifier)
                                    .answer(q.id,
                                        {'selectedOptionId': optId});
                              },
                            )
                          else if (q.type == 'TRUE_FALSE')
                            _TrueFalseOptions(
                              selected: _selectedOptions[q.id],
                              onSelect: (val) async {
                                setState(() => _selectedOptions[q.id] = val);
                                await ref
                                    .read(quizAttemptNotifierProvider(
                                            widget.quizId)
                                        .notifier)
                                    .answer(q.id,
                                        {'selectedOptionId': val});
                              },
                            )
                          else
                            _ShortAnswerField(
                              controller: _controllerFor(q.id),
                            ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),

                  // Navigation row
                  Container(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                    decoration: BoxDecoration(
                      color: isDark ? null : Colors.white,
                      border: const Border(
                          top: BorderSide(color: AppColors.border)),
                    ),
                    child: Row(children: [
                      if (_currentIndex > 0) ...[
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: AppColors.eLearningPrimary,
                              side: const BorderSide(
                                  color: AppColors.eLearningPrimary),
                              padding:
                                  const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(16)),
                            ),
                            onPressed: () =>
                                setState(() => _currentIndex--),
                            child: const Text('← Previous'),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        flex: isLast ? 1 : 2,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: isLast
                                ? Colors.green.shade600
                                : AppColors.eLearningPrimary,
                            padding:
                                const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: isLast
                              ? (_submitting ? null : _submitQuiz)
                              : () => setState(() => _currentIndex++),
                          child: Text(
                            isLast
                                ? (_submitting
                                    ? 'Submitting…'
                                    : 'Submit Quiz ✓')
                                : 'Next →',
                            style: const TextStyle(fontWeight: FontWeight.w900),
                          ),
                        ),
                      ),
                    ]),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// ─── Quiz answer widgets ──────────────────────────────────────────────────────

class _TypeBadge extends StatelessWidget {
  const _TypeBadge({required this.type});
  final String type;

  @override
  Widget build(BuildContext context) {
    final (label, icon) = switch (type) {
      'MULTIPLE_CHOICE' => ('Multiple Choice', Icons.radio_button_checked_rounded),
      'TRUE_FALSE'      => ('True / False',    Icons.check_box_rounded),
      _                 => ('Short Answer',    Icons.short_text_rounded),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.eLearningLight,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: AppColors.eLearningPrimary),
        const SizedBox(width: 5),
        Text(label,
            style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: AppColors.eLearningPrimary)),
      ]),
    );
  }
}

class _McqOptions extends StatelessWidget {
  const _McqOptions({
    required this.options,
    required this.selectedId,
    required this.onSelect,
  });
  final List<ElearningQuizOptionModel> options;
  final String? selectedId;
  final void Function(String) onSelect;

  @override
  Widget build(BuildContext context) {
    final sorted = [...options]
      ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
    final labels = ['A', 'B', 'C', 'D', 'E'];
    return Column(
      children: sorted.asMap().entries.map((e) {
        final idx      = e.key;
        final opt      = e.value;
        final selected = selectedId == opt.id;
        final isDark   = Theme.of(context).brightness == Brightness.dark;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: GestureDetector(
            onTap: () => onSelect(opt.id),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.eLearningPrimary
                    : (isDark ? Colors.grey[900] : Colors.white),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: selected
                      ? AppColors.eLearningPrimary
                      : AppColors.border,
                  width: selected ? 2 : 1,
                ),
              ),
              child: Row(children: [
                // Letter bubble
                Container(
                  width: 30, height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected
                        ? Colors.white.withValues(alpha: 0.25)
                        : AppColors.eLearningLight,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    idx < labels.length ? labels[idx] : '${idx + 1}',
                    style: TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 13,
                      color: selected
                          ? Colors.white
                          : AppColors.eLearningPrimary,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    opt.text,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: selected ? Colors.white : null,
                    ),
                  ),
                ),
                if (selected)
                  const Icon(Icons.check_circle_rounded,
                      color: Colors.white, size: 20),
              ]),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _TrueFalseOptions extends StatelessWidget {
  const _TrueFalseOptions({required this.selected, required this.onSelect});
  final String? selected;
  final void Function(String) onSelect;

  Widget _btn(BuildContext context, String val, IconData icon, Color accent) {
    final active = selected == val;
    return Expanded(
      child: GestureDetector(
        onTap: () => onSelect(val),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 22),
          decoration: BoxDecoration(
            color: active ? accent : Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: active ? accent : AppColors.border,
              width: active ? 2 : 1,
            ),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 32,
                color: active ? Colors.white : accent),
            const SizedBox(height: 8),
            Text(val,
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                  color: active ? Colors.white : accent,
                )),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Row(children: [
    _btn(context, 'True',  Icons.check_circle_rounded, Colors.green.shade600),
    const SizedBox(width: 12),
    _btn(context, 'False', Icons.cancel_rounded,        Colors.red.shade500),
  ]);
}

class _ShortAnswerField extends StatelessWidget {
  const _ShortAnswerField({required this.controller});
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    minLines: 3,
    maxLines: 6,
    textCapitalization: TextCapitalization.sentences,
    decoration: InputDecoration(
      hintText: 'Write your answer here…',
      filled: true,
      fillColor: Theme.of(context).brightness == Brightness.dark
          ? Colors.grey[900]
          : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(
            color: AppColors.eLearningPrimary, width: 2),
      ),
    ),
  );
}

// ─── Quiz Result ─────────────────────────────────────────────────────────────

class StudentQuizResultScreen extends ConsumerWidget {
  const StudentQuizResultScreen({
    super.key,
    required this.quizId,
    required this.attemptId,
  });
  final String quizId;
  final String attemptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attemptsAsync = ref.watch(myAttemptsProvider(quizId));

    return attemptsAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: e.toString()),
      data: (attempts) {
        final attempt =
            attempts.firstWhere((a) => a.id == attemptId,
                orElse: () => attempts.isNotEmpty ? attempts.last : throw StateError('Not found'));
        final score = attempt.percentScore?.toStringAsFixed(0) ?? '—';
        final passed = attempt.isPassed;
        return _LearnScaffold(
          title: passed == true ? 'Great work! 🎉' : 'Quiz Complete',
          kicker: 'QUIZ RESULT',
          subtitle: '$score% — ${passed == true ? "Passed" : passed == false ? "Not passed" : "Awaiting grade"}',
          children: [
            _ProgressBanner(value: attempt.percentScore?.toInt() ?? 0),
            _TaskCard(
              icon: Icons.check_circle_rounded,
              title: 'Score',
              subtitle:
                  '${attempt.totalScore?.toStringAsFixed(1) ?? "—"} / ${attempt.maxScore?.toStringAsFixed(1) ?? "—"} points',
              trailing: '$score%',
            ),
            _TaskCard(
              icon: Icons.lightbulb_rounded,
              title: 'Short answers',
              subtitle: 'Awaiting teacher review if any exist',
              trailing: 'Pending',
            ),
            _PrimaryAction(
              label: 'Back to Course',
              onTap: () => context.pop(),
            ),
          ],
        );
      },
    );
  }
}

// ─── Discussion ───────────────────────────────────────────────────────────────

class StudentDiscussionThreadScreen extends ConsumerStatefulWidget {
  const StudentDiscussionThreadScreen({super.key, required this.threadId});
  final String threadId;

  @override
  ConsumerState<StudentDiscussionThreadScreen> createState() =>
      _StudentDiscussionThreadScreenState();
}

class _StudentDiscussionThreadScreenState
    extends ConsumerState<StudentDiscussionThreadScreen> {
  final _controller = TextEditingController();
  bool _posting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _postReply() async {
    if (_controller.text.trim().isEmpty) return;
    setState(() => _posting = true);
    try {
      await ref
          .read(discussionNotifierProvider(widget.threadId).notifier)
          .reply(_controller.text.trim());
      _controller.clear();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final threadAsync =
        ref.watch(discussionNotifierProvider(widget.threadId));

    return threadAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: e.toString()),
      data: (thread) => _LearnScaffold(
        title: thread.title,
        kicker: 'DISCUSSION',
        subtitle: '${thread.replies.length} replies',
        children: [
          _TaskCard(
            icon: Icons.person_rounded,
            title: thread.body,
            subtitle: 'Posted by ${thread.authorRole}',
            trailing: thread.isResolved ? 'Resolved ✓' : '',
          ),
          const _SectionTitle('Replies'),
          ...thread.replies.map(
            (reply) => _TaskCard(
              icon: reply.authorRole == 'TEACHER'
                  ? Icons.school_rounded
                  : Icons.person_rounded,
              title: reply.body,
              subtitle: '${reply.authorRole} · ${DateFormat.MMMd().format(reply.createdAt)}',
              trailing: '',
            ),
          ),
          const _SectionTitle('Your reply'),
          TextField(
            controller: _controller,
            minLines: 3,
            maxLines: 5,
            decoration: InputDecoration(
              hintText: 'Type your question or comment...',
              filled: true,
              fillColor:
                  Theme.of(context).brightness == Brightness.dark
                      ? Colors.grey[900]
                      : Colors.white,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16)),
            ),
          ),
          _PrimaryAction(
            label: _posting ? 'Posting…' : 'Post Reply',
            onTap: _posting ? null : _postReply,
          ),
        ],
      ),
    );
  }
}

// ─── Course Progress ─────────────────────────────────────────────────────────

class StudentCourseProgressScreen extends ConsumerWidget {
  const StudentCourseProgressScreen({super.key, required this.courseId});
  final String courseId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final progressAsync = ref.watch(elearningProgressProvider(courseId));

    return progressAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: e.toString()),
      data: (p) => _LearnScaffold(
        title: 'Your Progress',
        kicker: 'LEARNING JOURNEY',
        subtitle: '${p.completionPercent}% overall completion',
        children: [
          _ProgressBanner(value: p.completionPercent),
          _TaskCard(
            icon: Icons.menu_book_rounded,
            title: 'Materials',
            subtitle: '${p.viewed} of ${p.materials} viewed',
            trailing: '${p.materials > 0 ? (p.viewed * 100 ~/ p.materials) : 0}%',
          ),
          _TaskCard(
            icon: Icons.assignment_rounded,
            title: 'Assignments',
            subtitle: '${p.submissions} of ${p.assignments} submitted',
            trailing: '${p.assignments > 0 ? (p.submissions * 100 ~/ p.assignments) : 0}%',
          ),
          _TaskCard(
            icon: Icons.quiz_rounded,
            title: 'Quizzes',
            subtitle: '${p.attempts} of ${p.quizzes} attempted',
            trailing: '${p.quizzes > 0 ? (p.attempts * 100 ~/ p.quizzes) : 0}%',
          ),
        ],
      ),
    );
  }
}

// ─── Shared layout ────────────────────────────────────────────────────────────

class _LearnScaffold extends StatelessWidget {
  const _LearnScaffold({
    required this.title,
    required this.kicker,
    required this.subtitle,
    required this.children,
  });
  final String title;
  final String kicker;
  final String subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? null : AppColors.offWhite,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: _Hero(kicker: kicker, title: title, subtitle: subtitle),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
              sliver: SliverList.separated(
                itemBuilder: (_, i) => children[i]
                    .animate()
                    .fadeIn(duration: 260.ms, delay: (i * 40).ms)
                    .slideY(begin: 0.04, end: 0),
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemCount: children.length,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LoadingScaffold extends StatelessWidget {
  const _LoadingScaffold();
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(child: CircularProgressIndicator()),
  );
}

class _ErrorScaffold extends StatelessWidget {
  const _ErrorScaffold({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(child: Padding(
      padding: const EdgeInsets.all(24),
      child: Text(message),
    )),
  );
}

class _Hero extends StatelessWidget {
  const _Hero({required this.kicker, required this.title, required this.subtitle});
  final String kicker;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.all(16),
    padding: const EdgeInsets.all(22),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [AppColors.eLearningDark, AppColors.eLearningPrimary],
      ),
      borderRadius: BorderRadius.circular(28),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white70, size: 18),
            onPressed: () => context.pop(),
          ),
          Text(kicker, style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Colors.white70,
            fontWeight: FontWeight.w900,
            letterSpacing: 2,
          )),
        ]),
        const SizedBox(height: 4),
        Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(
          color: Colors.white, fontWeight: FontWeight.w900,
        )),
        const SizedBox(height: 8),
        Text(subtitle, style: Theme.of(context).textTheme.bodyMedium?.copyWith(
          color: Colors.white.withValues(alpha: 0.82), fontWeight: FontWeight.w600,
        )),
      ],
    ),
  );
}

class _MetricStrip extends StatelessWidget {
  const _MetricStrip({required this.items});
  final List<(String, String)> items;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return SizedBox(
      height: 108,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemBuilder: (_, i) => Container(
          width: 116,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? Colors.grey[900] : Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(items[i].$2,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: AppColors.eLearningPrimary,
                  )),
              Text(items[i].$1,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  )),
            ],
          ),
        ),
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemCount: items.length,
      ),
    );
  }
}

class _CourseCard extends StatelessWidget {
  const _CourseCard({required this.course, required this.onTap});
  final ElearningCourseModel course;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _TapCard(
    onTap: onTap,
    child: Row(children: [
      Container(
        width: 58, height: 58,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.eLearningLight,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(course.emoji, style: const TextStyle(fontSize: 26)),
      ),
      const SizedBox(width: 14),
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(course.subjectName, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
          Text('${course.className} · ${course.stageLabel}', style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: course.enrolledCount > 0 ? 0.5 : 0,
            color: AppColors.eLearningPrimary,
            backgroundColor: AppColors.eLearningLight,
            borderRadius: BorderRadius.circular(999),
          ),
        ],
      )),
      const Icon(Icons.chevron_right_rounded, color: AppColors.textMuted),
    ]),
  );
}

class _MaterialCard extends StatelessWidget {
  const _MaterialCard({required this.material, this.onTap});
  final ElearningMaterialModel material;
  final VoidCallback? onTap;

  IconData get _icon {
    if (material.isPdf) return Icons.picture_as_pdf_rounded;
    if (material.isVideo) return Icons.play_circle_rounded;
    if (material.isLink) return Icons.link_rounded;
    return Icons.article_rounded;
  }

  @override
  Widget build(BuildContext context) => _TapCard(
    onTap: onTap,
    child: Row(children: [
      Icon(_icon, color: AppColors.eLearningPrimary, size: 28),
      const SizedBox(width: 12),
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(material.title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
          Text(material.type, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
        ],
      )),
      Text(material.type, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.eLearningPrimary, fontWeight: FontWeight.w900)),
    ]),
  );
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailing,
    this.onTap,
  });
  final IconData icon;
  final String title;
  final String subtitle;
  final String trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => _TapCard(
    onTap: onTap,
    child: Row(children: [
      Icon(icon, color: AppColors.eLearningPrimary),
      const SizedBox(width: 12),
      Expanded(child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
          if (subtitle.isNotEmpty)
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.textSecondary)),
        ],
      )),
      if (trailing.isNotEmpty)
        Text(trailing, style: Theme.of(context).textTheme.labelSmall?.copyWith(color: AppColors.eLearningPrimary, fontWeight: FontWeight.w900)),
    ]),
  );
}

class _TapCard extends StatelessWidget {
  const _TapCard({required this.child, this.onTap});
  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: isDark ? Colors.grey[900] : Colors.white,
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppColors.border),
          ),
          child: child,
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);
  final String title;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 10),
    child: Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
  );
}

class _ProgressBanner extends StatelessWidget {
  const _ProgressBanner({required this.value});
  final int value;
  @override
  Widget build(BuildContext context) => _TapCard(
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('$value% complete', style: Theme.of(context).textTheme.headlineSmall?.copyWith(
        fontWeight: FontWeight.w900, color: AppColors.eLearningPrimary,
      )),
      const SizedBox(height: 10),
      LinearProgressIndicator(
        value: value / 100,
        color: AppColors.eLearningPrimary,
        backgroundColor: AppColors.eLearningLight,
        minHeight: 10,
        borderRadius: BorderRadius.circular(999),
      ),
    ]),
  );
}

class _GradeBanner extends StatelessWidget {
  const _GradeBanner({required this.submission});
  final ElearningSubmissionModel submission;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      color: AppColors.eLearningLight,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: AppColors.eLearningPrimary.withValues(alpha: 0.3)),
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Grade: ${submission.scorePercent?.toStringAsFixed(0) ?? "—"}%',
          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
            fontWeight: FontWeight.w900, color: AppColors.eLearningPrimary,
          )),
      if (submission.feedback?.isNotEmpty == true) ...[
        const SizedBox(height: 8),
        Text('Feedback: ${submission.feedback}',
            style: Theme.of(context).textTheme.bodyMedium),
      ],
    ]),
  );
}

class _PrimaryAction extends StatelessWidget {
  const _PrimaryAction({required this.label, this.onTap});
  final String label;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: double.infinity,
    child: FilledButton(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.eLearningPrimary,
        padding: const EdgeInsets.symmetric(vertical: 16),
      ),
      onPressed: onTap,
      child: Text(label),
    ),
  );
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.error.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(16),
    ),
    child: Row(children: [
      const Icon(Icons.error_outline_rounded, color: AppColors.error),
      const SizedBox(width: 12),
      Expanded(child: Text(message, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppColors.error))),
    ]),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.icon, required this.message});
  final IconData icon;
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 32),
    child: Column(children: [
      Icon(icon, size: 48, color: AppColors.textMuted),
      const SizedBox(height: 12),
      Text(message, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textMuted)),
    ]),
  );
}
