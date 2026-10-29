import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_pdfview/flutter_pdfview.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:video_player/video_player.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:open_file/open_file.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_failure.dart';
import '../../../core/providers/auth_provider.dart';
import '../../../core/providers/elearning/elearning_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../models/elearning_models.dart';

// ─── Shared quiz row text ─────────────────────────────────────────────────────

String _quizSubtitle(ElearningQuizModel q) {
  final parts = <String>[
    '${q.questionCount} question${q.questionCount == 1 ? '' : 's'}',
    if (q.timeLimitMinutes != null) '${q.timeLimitMinutes} min',
    if (q.finishedAttempts.isNotEmpty) '${q.attemptsLeft} attempt${q.attemptsLeft == 1 ? '' : 's'} left',
  ];
  return parts.join(' · ');
}

String _quizTrailing(ElearningQuizModel q) {
  if (q.inProgressAttempt != null) return 'Continue';
  if (q.finishedAttempts.isNotEmpty) {
    if (q.finishedAttempts.any((a) => a.awaitingManualGrade) && q.bestPercent == null) return 'Marking';
    final best = q.bestPercent;
    if (best != null) return '${best.toStringAsFixed(0)}%';
  }
  if (q.isClosed) return 'Closed';
  return 'Start';
}

// ─── Learning Home ────────────────────────────────────────────────────────────

class StudentLearnHomeScreen extends ConsumerWidget {
  const StudentLearnHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(elearningCoursesProvider);
    final summaryAsync = ref.watch(studentElearingSummaryProvider);

    return _LearnScaffold(
      onRefresh: () async {
        ref.invalidate(studentElearingSummaryProvider);
        ref.invalidate(elearningCoursesProvider);
        await ref.read(elearningCoursesProvider.future);
      },
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
          error: (e, _) => _ErrorCard(message: ApiFailure.from(e).message),
        ),
      ],
    );
  }
}

// ─── Course Space ─────────────────────────────────────────────────────────────

class StudentCourseSpaceScreen extends ConsumerWidget {
  const StudentCourseSpaceScreen({super.key, required this.courseId});
  final String courseId;

  /// Assignments and quizzes for the whole course, to-do items first.
  List<Widget> _courseWork(BuildContext context, WidgetRef ref) {
    final assignments = ref.watch(elearningAssignmentsProvider(courseId)).valueOrNull ?? const <ElearningAssignmentModel>[];
    final quizzes = ref.watch(elearningQuizzesProvider(courseId)).valueOrNull ?? const <ElearningQuizModel>[];
    int rank(ElearningAssignmentModel a) {
      final st = a.mySubmission?.status;
      if (st == null || st == 'DRAFT' || st == 'RETURNED') return a.isClosed ? 3 : 0;
      return st == 'SUBMITTED' ? 1 : 2;
    }
    final sorted = [...assignments]..sort((a, b) => rank(a).compareTo(rank(b)));
    return [
      if (sorted.isNotEmpty) ...[
        _SectionTitle('Assignments (${sorted.length})'),
        for (final a in sorted)
          _TaskCard(
            icon: Icons.assignment_rounded,
            title: a.title,
            subtitle: a.dueAt != null
                ? 'Due ${DateFormat('EEE d MMM, HH:mm').format(a.dueAt!.toLocal())}'
                : 'No deadline',
            trailing: a.stateLabel,
            onTap: () => context.push('/student/learn/assignments/${a.id}'),
          ),
      ],
      if (quizzes.isNotEmpty) ...[
        _SectionTitle('Quizzes (${quizzes.length})'),
        for (final q in quizzes)
          _TaskCard(
            icon: Icons.quiz_rounded,
            title: q.title,
            subtitle: _quizSubtitle(q),
            trailing: _quizTrailing(q),
            onTap: () => context.push('/student/learn/quizzes/${q.id}'),
          ),
      ],
      _TaskCard(
        icon: Icons.insights_rounded,
        title: 'My progress',
        subtitle: 'Materials viewed, work handed in, quizzes taken',
        trailing: 'Open',
        onTap: () => context.push('/student/learn/progress/$courseId'),
      ),
    ];
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final courseAsync = ref.watch(elearningCourseProvider(courseId));
    final progressAsync = ref.watch(elearningProgressProvider(courseId));
    final announcementsAsync =
        ref.watch(elearningAnnouncementsProvider(courseId));

    return courseAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
      data: (course) => _LearnScaffold(
        onRefresh: () async {
          ref.invalidate(elearningCourseProvider(courseId));
          ref.invalidate(elearningProgressProvider(courseId));
          ref.invalidate(elearningAnnouncementsProvider(courseId));
          ref.invalidate(elearningQuizzesProvider(courseId));
          ref.invalidate(elearningAssignmentsProvider(courseId));
          await ref.read(elearningAssignmentsProvider(courseId).future);
        },
        title: course.subjectName,
        kicker: '${course.className} · ${course.stageLabel}',
        subtitle: '${course.enrolledCount} students enrolled',
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
          ..._courseWork(context, ref),
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
      onRefresh: () async {
        ref.invalidate(elearningMaterialsProvider((courseId: courseId, lessonId: lessonId)));
        ref.invalidate(elearningQuizzesProvider(courseId));
        ref.invalidate(elearningAssignmentsProvider(courseId));
        await ref.read(elearningAssignmentsProvider(courseId).future);
      },
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
          error: (e, _) => _ErrorCard(message: ApiFailure.from(e).message),
        ),
        ...assignmentsAsync.maybeWhen(
          data: (assignments) {
            final items = assignments.where((a) => a.lessonId == lessonId).toList();
            if (items.isEmpty) return <Widget>[];
            return <Widget>[
              const _SectionTitle('Assignments'),
              for (final a in items)
                _TaskCard(
                  icon: Icons.assignment_rounded,
                  title: a.title,
                  subtitle: a.dueAt != null
                      ? 'Due ${DateFormat('EEE d MMM, HH:mm').format(a.dueAt!.toLocal())}'
                      : 'No deadline',
                  trailing: a.stateLabel,
                  onTap: () => context.push('/student/learn/assignments/${a.id}'),
                ),
            ];
          },
          orElse: () => <Widget>[],
        ),
        ...quizzesAsync.maybeWhen(
          data: (quizzes) {
            final items = quizzes.where((q) => q.lessonId == lessonId).toList();
            if (items.isEmpty) return <Widget>[];
            return <Widget>[
              const _SectionTitle('Quizzes'),
              for (final q in items)
                _TaskCard(
                  icon: Icons.quiz_rounded,
                  title: q.title,
                  subtitle: _quizSubtitle(q),
                  trailing: _quizTrailing(q),
                  onTap: () => context.push('/student/learn/quizzes/${q.id}'),
                ),
            ];
          },
          orElse: () => <Widget>[],
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
  String? _externalUrl; // LINK / VIDEO hosted elsewhere
  String _materialType = '';
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
      // The API answers { material: {...}, download: { url } }.
      final material = info['material'] is Map
          ? Map<String, dynamic>.from(info['material'] as Map)
          : info;
      final type = ((material['type'] as String?) ?? '').toUpperCase();
      final title = material['title'] as String?;
      final body = material['body'] as String?;
      final externalUrl = (material['externalUrl'] as String?)?.trim();
      final hasFile = (material['fileKey'] as String?)?.isNotEmpty == true;

      if (type == 'NOTE' || ((body ?? '').trim().isNotEmpty && !hasFile && (externalUrl ?? '').isEmpty)) {
        if (mounted) {
          setState(() {
            _materialType = type;
            _noteBody = body ?? '';
            _noteTitle = title;
            _loading = false;
          });
        }
        return;
      }

      if (!hasFile && (externalUrl ?? '').isNotEmpty) {
        if (mounted) {
          setState(() {
            _materialType = type;
            _noteTitle = title;
            _externalUrl = externalUrl;
            _loading = false;
          });
        }
        return;
      }

      final downloadInfo = info['download'] as Map<String, dynamic>?;
      final url = downloadInfo?['url'] as String?;
      if (url != null && url.isNotEmpty) {
        final fullUrl = url.startsWith('http') ? url : '${_baseUrl()}$url';
        // Stored files sit behind the API, so the download must carry the session token.
        final token = await ref.read(secureStorageProvider).read(key: 'access_token');
        final file = await DefaultCacheManager().getSingleFile(
          fullUrl,
          headers: token == null ? null : {'Authorization': 'Bearer $token'},
        );
        if (mounted) setState(() { _cachedFile = file; _noteTitle = title; _materialType = type; _loading = false; });
      } else {
        if (mounted) setState(() { _loading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  String _baseUrl() => AppConfig.apiBaseUrl;

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
                : _externalUrl != null
                    ? _ExternalLinkViewer(
                        title: _noteTitle,
                        url: _externalUrl!,
                        isVideo: _materialType == 'VIDEO',
                        onBack: () => context.pop(),
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

class _ExternalLinkViewer extends StatelessWidget {
  const _ExternalLinkViewer({required this.url, required this.isVideo, required this.onBack, this.title});
  final String url;
  final String? title;
  final bool isVideo;
  final VoidCallback onBack;

  Future<void> _open(BuildContext context) async {
    final uri = Uri.tryParse(url);
    final launched = uri != null && await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open the link on this device.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _BackBar(onBack: onBack),
        Expanded(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(isVideo ? Icons.play_circle_fill_rounded : Icons.link_rounded, size: 72, color: AppColors.eLearningPrimary),
                  const SizedBox(height: 16),
                  Text(title ?? (isVideo ? 'Video' : 'Link'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(url, textAlign: TextAlign.center, maxLines: 2, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodySmall),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: () => _open(context),
                    icon: Icon(isVideo ? Icons.play_arrow_rounded : Icons.open_in_new_rounded),
                    label: Text(isVideo ? 'Watch video' : 'Open link'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
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

    const external = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.odt', '.odp', '.ods', '.zip'];
    if (external.any(path.endsWith)) {
      return Column(
        children: [
          _BackBar(onBack: () => context.pop()),
          Expanded(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.description_rounded, size: 72, color: AppColors.eLearningPrimary),
                    const SizedBox(height: 16),
                    Text(widget.file.path.split(RegExp(r'[\\/]')).last, textAlign: TextAlign.center),
                    const SizedBox(height: 20),
                    FilledButton.icon(
                      onPressed: () => OpenFile.open(widget.file.path),
                      icon: const Icon(Icons.open_in_new_rounded),
                      label: const Text('Open with another app'),
                    ),
                  ],
                ),
              ),
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

class StudentAssignmentScreen extends ConsumerStatefulWidget {
  const StudentAssignmentScreen({super.key, required this.assignmentId});
  final String assignmentId;

  @override
  ConsumerState<StudentAssignmentScreen> createState() =>
      _StudentAssignmentScreenState();
}

class _StudentAssignmentScreenState
    extends ConsumerState<StudentAssignmentScreen> {
  final _controller = TextEditingController();
  bool _seeded = false;
  bool _busy = false;
  String? _fileName;
  String? _fileBase64;
  String? _fileMime;
  int _fileSize = 0;

  static const _maxFileBytes = 10 * 1024 * 1024;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _seed(ElearningSubmissionModel? submission) {
    if (_seeded) return;
    _seeded = true;
    if (submission?.textContent != null) {
      _controller.text = submission!.textContent!;
    }
  }

  Future<void> _chooseFile() async {
    final source = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.folder_open_rounded),
              title: const Text('Choose a file'),
              subtitle: const Text('PDF, Word, PowerPoint, Excel, text or image'),
              onTap: () => Navigator.of(sheet).pop('file'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded),
              title: const Text('Photo from gallery'),
              onTap: () => Navigator.of(sheet).pop('gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_camera_rounded),
              title: const Text('Take a photo'),
              onTap: () => Navigator.of(sheet).pop('camera'),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;
    try {
      String? name;
      List<int>? bytes;
      String mime = 'application/octet-stream';
      if (source == 'file') {
        final result = await FilePicker.platform.pickFiles(
          withData: true,
          type: FileType.custom,
          allowedExtensions: const ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'png', 'jpg', 'jpeg'],
        );
        final file = result?.files.single;
        if (file == null) return;
        name = file.name;
        bytes = file.bytes;
        mime = _mimeFor(file.extension ?? '');
      } else {
        final picked = await ImagePicker().pickImage(
          source: source == 'camera' ? ImageSource.camera : ImageSource.gallery,
          imageQuality: 80,
        );
        if (picked == null) return;
        name = picked.name;
        bytes = await picked.readAsBytes();
        mime = _mimeFor(name.split('.').last);
      }
      if (bytes == null || bytes.isEmpty) {
        _toast('That file could not be read.');
        return;
      }
      if (bytes.length > _maxFileBytes) {
        _toast('Files must be 10 MB or smaller.');
        return;
      }
      setState(() {
        _fileName = name;
        _fileBase64 = base64Encode(bytes!);
        _fileMime = mime;
        _fileSize = bytes.length;
      });
    } catch (e) {
      _toast('Could not attach the file: ${ApiFailure.from(e).message}');
    }
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
        _ => 'application/octet-stream',
      };

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _save(ElearningAssignmentModel assignment, {required bool submit}) async {
    final text = _controller.text.trim();
    final hasText = text.isNotEmpty;
    final existing = ref.read(submissionNotifierProvider(widget.assignmentId)).valueOrNull;
    final hasFile = _fileBase64 != null || (existing?.fileKey?.isNotEmpty ?? false);
    if (submit) {
      final wantsText = assignment.type == 'TEXT' || assignment.type == 'BOTH';
      final wantsFile = assignment.type == 'FILE_UPLOAD' || assignment.type == 'BOTH';
      if (assignment.type == 'TEXT' && !hasText) return _toast('Write your answer before submitting.');
      if (assignment.type == 'FILE_UPLOAD' && !hasFile) return _toast('Attach your file before submitting.');
      if (assignment.type == 'BOTH' && !hasText && !hasFile) return _toast('Add your answer or attach a file first.');
      if (!wantsText && !wantsFile) return;
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text((existing?.isSubmitted == true || existing?.status == 'RETURNED') ? 'Resubmit your work?' : 'Submit your work?'),
          content: Text(assignment.isOverdue
              ? assignment.allowLateSubmission
                  ? 'The deadline has passed. This will be marked late${(assignment.latePenaltyPercent ?? 0) > 0 ? ' and ${assignment.latePenaltyPercent!.toStringAsFixed(0)}% may be deducted' : ''}.'
                  : 'The deadline has passed.'
              : 'Your teacher will be able to see it straight away.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialog).pop(false), child: const Text('Not yet')),
            FilledButton(onPressed: () => Navigator.of(dialog).pop(true), child: const Text('Submit')),
          ],
        ),
      );
      if (confirmed != true) return;
    } else if (!hasText && !hasFile) {
      return _toast('Nothing to save yet.');
    }

    setState(() => _busy = true);
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
      await ref.read(submissionNotifierProvider(widget.assignmentId).notifier).saveOrSubmit({
        'textContent': text,
        if (fileKey != null) 'fileKey': fileKey,
        if (fileKey != null && _fileName != null) 'fileOriginalName': _fileName,
        if (fileKey != null && _fileMime != null) 'fileMimeType': _fileMime,
        if (fileKey != null) 'fileSizeBytes': _fileSize,
        'submit': submit,
      });
      ref.invalidate(elearningAssignmentsProvider(assignment.courseSpaceId));
      ref.invalidate(elearningProgressProvider(assignment.courseSpaceId));
      ref.invalidate(studentElearingSummaryProvider);
      if (mounted) {
        setState(() {
          _fileName = null;
          _fileBase64 = null;
        });
        _toast(submit ? 'Submitted. Well done!' : 'Draft saved.');
      }
    } catch (e) {
      _toast(ApiFailure.from(e).message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final assignmentAsync = ref.watch(elearningAssignmentByIdProvider(widget.assignmentId));
    final submissionAsync = ref.watch(submissionNotifierProvider(widget.assignmentId));

    return assignmentAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
      data: (assignment) {
        final submission = submissionAsync.valueOrNull;
        if (submissionAsync.hasValue) _seed(submission);
        final graded = submission?.isGraded == true;
        final closed = assignment.isClosed;
        final editable = !graded && !closed;
        final wantsText = assignment.type == 'TEXT' || assignment.type == 'BOTH';
        final wantsFile = assignment.type == 'FILE_UPLOAD' || assignment.type == 'BOTH';
        final due = assignment.dueAt;
        final dueLabel = due == null
            ? 'No deadline'
            : 'Due ${DateFormat('EEE d MMM, HH:mm').format(due.toLocal())}';

        return _LearnScaffold(
          title: assignment.title,
          kicker: 'ASSIGNMENT',
          subtitle: closed
              ? 'Closed'
              : assignment.isOverdue
                  ? 'Overdue · $dueLabel'
                  : dueLabel,
          children: [
            _TapCard(
              child: Wrap(spacing: 8, runSpacing: 8, children: [
                if (assignment.maxScore != null)
                  _QuizInfoChip(icon: Icons.star_rounded, label: '${assignment.maxScore!.toStringAsFixed(0)} marks'),
                _QuizInfoChip(
                  icon: Icons.assignment_turned_in_rounded,
                  label: switch (assignment.type) {
                    'TEXT' => 'Written answer',
                    'FILE_UPLOAD' => 'File upload',
                    _ => 'Answer and/or file',
                  },
                ),
                if (assignment.allowLateSubmission && (assignment.latePenaltyPercent ?? 0) > 0)
                  _QuizInfoChip(icon: Icons.schedule_rounded, label: '${assignment.latePenaltyPercent!.toStringAsFixed(0)}% late penalty'),
                if (!assignment.allowLateSubmission)
                  const _QuizInfoChip(icon: Icons.block_rounded, label: 'No late work'),
              ]),
            ),
            if (assignment.instructions.trim().isNotEmpty)
              _TapCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Instructions', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    Text(assignment.instructions, style: Theme.of(context).textTheme.bodyMedium?.copyWith(height: 1.5)),
                  ],
                ),
              ),
            if (graded) _GradeBanner(submission: submission!),
            if (!graded && submission != null)
              _TaskCard(
                icon: submission.status == 'RETURNED'
                    ? Icons.undo_rounded
                    : submission.status == 'SUBMITTED'
                        ? Icons.check_circle_rounded
                        : Icons.edit_note_rounded,
                title: switch (submission.status) {
                  'RETURNED' => 'Returned for correction',
                  'SUBMITTED' => submission.isLate ? 'Handed in late' : 'Handed in',
                  _ => 'Draft saved',
                },
                subtitle: submission.status == 'RETURNED' && (submission.feedback ?? '').isNotEmpty
                    ? 'Teacher: ${submission.feedback}'
                    : submission.status == 'SUBMITTED'
                        ? 'Waiting for your teacher to mark it. You can still update and resubmit.'
                        : 'Not handed in yet.',
                trailing: '',
              ),
            if (graded && (submission?.textContent ?? '').isNotEmpty)
              _TapCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Your answer', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    Text(submission!.textContent!),
                  ],
                ),
              ),
            if (closed && submission == null)
              const _ErrorCard(message: 'This assignment is closed and no longer accepts work.'),
            if (editable) ...[
              if (wantsText)
                TextField(
                  controller: _controller,
                  minLines: 6,
                  maxLines: 14,
                  decoration: InputDecoration(
                    hintText: 'Type your answer here...',
                    filled: true,
                    fillColor: Theme.of(context).brightness == Brightness.dark ? Colors.grey[900] : Colors.white,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              if (wantsFile) ...[
                if (_fileName != null)
                  _TaskCard(
                    icon: Icons.attach_file_rounded,
                    title: _fileName!,
                    subtitle: '${_fileSize < 1024 ? '< 1 KB' : _fileSize < 1024 * 1024 ? '${(_fileSize / 1024).toStringAsFixed(0)} KB' : '${(_fileSize / 1048576).toStringAsFixed(1)} MB'} · ready to upload',
                    trailing: 'Change',
                    onTap: _busy ? null : _chooseFile,
                  )
                else if (submission?.fileOriginalName != null)
                  _TaskCard(
                    icon: Icons.attach_file_rounded,
                    title: submission!.fileOriginalName!,
                    subtitle: 'Already attached. Choose another file to replace it.',
                    trailing: 'Replace',
                    onTap: _busy ? null : _chooseFile,
                  )
                else
                  _TaskCard(
                    icon: Icons.upload_file_rounded,
                    title: 'Attach a file',
                    subtitle: 'PDF, document, spreadsheet, slides or photo (max 10 MB)',
                    trailing: 'Choose',
                    onTap: _busy ? null : _chooseFile,
                  ),
              ],
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: _busy ? null : () => _save(assignment, submit: false),
                    style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                    child: const Text('Save draft'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: _PrimaryAction(
                    label: _busy
                        ? 'Working…'
                        : (submission?.isSubmitted == true || submission?.status == 'RETURNED')
                            ? 'Resubmit'
                            : 'Submit',
                    onTap: _busy ? null : () => _save(assignment, submit: true),
                  ),
                ),
              ]),
            ],
          ],
        );
      },
    );
  }
}

/// Older routes pointed at a separate submit screen; it is now part of the assignment screen.
class StudentSubmitAssignmentScreen extends StatelessWidget {
  const StudentSubmitAssignmentScreen({super.key, required this.assignmentId});
  final String assignmentId;

  @override
  Widget build(BuildContext context) => StudentAssignmentScreen(assignmentId: assignmentId);
}

// ─── Quiz Lobby ───────────────────────────────────────────────────────────────

String _formatQuizScore(ElearningQuizAttemptModel a) {
  final pct = a.percentScore;
  final points = a.totalScore != null && a.maxScore != null
      ? '${_trimNumber(a.totalScore!)}/${_trimNumber(a.maxScore!)}'
      : null;
  if (pct == null) return points ?? '—';
  return points == null
      ? '${pct.toStringAsFixed(0)}%'
      : '$points · ${pct.toStringAsFixed(0)}%';
}

String _trimNumber(double value) =>
    value % 1 == 0 ? value.toStringAsFixed(0) : value.toStringAsFixed(1);

String _attemptOutcome(ElearningQuizAttemptModel a) {
  if (a.awaitingManualGrade) return 'Awaiting marking';
  if (a.isPassed == true) return 'Passed';
  if (a.isPassed == false) return 'Not passed';
  return 'Completed';
}

class StudentQuizLobbyScreen extends ConsumerStatefulWidget {
  const StudentQuizLobbyScreen({super.key, required this.quizId});
  final String quizId;

  @override
  ConsumerState<StudentQuizLobbyScreen> createState() =>
      _StudentQuizLobbyScreenState();
}

class _StudentQuizLobbyScreenState
    extends ConsumerState<StudentQuizLobbyScreen> {
  bool _starting = false;

  void _refresh(ElearningQuizModel quiz) {
    ref.invalidate(elearningQuizByIdProvider(widget.quizId));
    ref.invalidate(elearningQuizzesProvider(quiz.courseSpaceId));
    ref.invalidate(studentElearingSummaryProvider);
  }

  Future<void> _start(ElearningQuizModel quiz) async {
    if (quiz.inProgressAttempt == null) {
      final timed = quiz.timeLimitMinutes != null;
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('Start the quiz?'),
          content: Text(timed
              ? 'You have ${quiz.timeLimitMinutes} minutes. The timer starts now and keeps running even if you leave. Your answers are saved as you go and submitted automatically when time is up.'
              : 'Your answers are saved as you go. This will use one of your ${quiz.attemptsLeft} remaining attempt${quiz.attemptsLeft == 1 ? '' : 's'}.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialog).pop(false), child: const Text('Not yet')),
            FilledButton(onPressed: () => Navigator.of(dialog).pop(true), child: const Text('Start')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _starting = true);
    try {
      await ref.read(elearningApiServiceProvider).startAttempt(widget.quizId);
      if (!mounted) return;
      await context.push('/student/learn/quizzes/${widget.quizId}/attempt');
      if (mounted) _refresh(quiz);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ApiFailure.from(e).message)));
        _refresh(quiz);
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final quizAsync = ref.watch(elearningQuizByIdProvider(widget.quizId));

    return quizAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
      data: (quiz) {
        final finished = quiz.finishedAttempts;
        final inProgress = quiz.inProgressAttempt;
        final canStart = !quiz.isClosed && quiz.attemptsLeft > 0 && quiz.questionCount > 0;
        final types = <String>{for (final q in quiz.questions) q.type};

        return _LearnScaffold(
          title: quiz.title,
          kicker: quiz.isClosed ? 'QUIZ · CLOSED' : 'QUIZ',
          subtitle: (quiz.instructions ?? '').trim().isNotEmpty
              ? quiz.instructions!.trim()
              : 'Read the details, then start when you are ready.',
          children: [
            _TapCard(
              child: Wrap(spacing: 8, runSpacing: 8, children: [
                _QuizInfoChip(icon: Icons.quiz_rounded, label: '${quiz.questionCount} question${quiz.questionCount == 1 ? '' : 's'}'),
                if (quiz.timeLimitMinutes != null)
                  _QuizInfoChip(icon: Icons.timer_rounded, label: '${quiz.timeLimitMinutes} min'),
                if (quiz.passingScore != null)
                  _QuizInfoChip(icon: Icons.check_circle_rounded, label: 'Pass: ${quiz.passingScore!.toStringAsFixed(0)}%'),
                _QuizInfoChip(
                  icon: Icons.repeat_rounded,
                  label: '${quiz.attemptsLeft} of ${quiz.maxAttempts} attempt${quiz.maxAttempts == 1 ? '' : 's'} left',
                ),
                _QuizInfoChip(icon: Icons.star_rounded, label: '${_trimNumber(quiz.totalPoints)} points'),
              ]),
            ),
            if (types.isNotEmpty)
              _TapCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('What to expect', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
                    const SizedBox(height: 10),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      for (final type in types)
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
                                  : 'Written answer (marked by your teacher)',
                        ),
                    ]),
                  ],
                ),
              ),
            if (finished.isNotEmpty) ...[
              _SectionTitle('Your attempts${quiz.bestPercent != null ? ' · best ${quiz.bestPercent!.toStringAsFixed(0)}%' : ''}'),
              for (final a in finished)
                _TaskCard(
                  icon: a.isPassed == true
                      ? Icons.emoji_events_rounded
                      : a.awaitingManualGrade
                          ? Icons.hourglass_top_rounded
                          : Icons.assignment_turned_in_rounded,
                  title: 'Attempt ${a.attemptNumber}',
                  subtitle: '${_formatQuizScore(a)} · ${_attemptOutcome(a)}',
                  trailing: 'View',
                  onTap: () => context.push('/student/learn/quizzes/${quiz.id}/result/${a.id}'),
                ),
            ],
            if (quiz.isClosed && inProgress == null)
              const _ErrorCard(message: 'This quiz is closed and no longer accepts attempts.')
            else if (quiz.questionCount == 0)
              const _ErrorCard(message: 'This quiz has no questions yet. Check back soon.')
            else if (inProgress != null)
              _PrimaryAction(
                label: _starting ? 'Opening…' : 'Continue quiz',
                onTap: _starting ? null : () => _start(quiz),
              )
            else if (canStart)
              _PrimaryAction(
                label: _starting
                    ? 'Starting…'
                    : finished.isEmpty
                        ? 'Start quiz'
                        : 'Try again',
                onTap: _starting ? null : () => _start(quiz),
              )
            else
              const _ErrorCard(message: 'You have used all your attempts for this quiz.'),
          ],
        );
      },
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
      Flexible(
        child: Text(label, style: const TextStyle(
          fontSize: 12, fontWeight: FontWeight.w800,
          color: AppColors.eLearningPrimary,
        )),
      ),
    ]),
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
  // questionId → optionId (multiple choice) or 'true' / 'false'
  final Map<String, String> _selected = {};
  final Map<String, TextEditingController> _texts = {};
  final Map<String, Timer> _saveTimers = {};
  bool _seeded = false;
  bool _submitting = false;
  bool _finished = false;
  Timer? _ticker;
  DateTime? _expiresAt;
  Duration? _remaining;

  @override
  void dispose() {
    _ticker?.cancel();
    for (final t in _saveTimers.values) { t.cancel(); }
    for (final c in _texts.values) { c.dispose(); }
    super.dispose();
  }

  TextEditingController _controllerFor(String qId) =>
      _texts.putIfAbsent(qId, TextEditingController.new);

  void _seed(ElearningQuizAttemptModel attempt, List<ElearningQuizQuestionModel> questions) {
    if (_seeded) return;
    _seeded = true;
    final byId = {for (final q in questions) q.id: q};
    for (final a in attempt.answers) {
      final q = byId[a.questionId];
      if (q == null) continue;
      switch (q.type) {
        case 'MULTIPLE_CHOICE':
          if (a.selectedOptionId != null) _selected[q.id] = a.selectedOptionId!;
        case 'TRUE_FALSE':
          final v = a.textAnswer?.toLowerCase();
          if (v == 'true' || v == 'false') _selected[q.id] = v!;
        default:
          if ((a.textAnswer ?? '').isNotEmpty) _controllerFor(q.id).text = a.textAnswer!;
      }
    }
    _expiresAt = attempt.expiresAt?.toLocal();
    if (_expiresAt != null) {
      _tick();
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    }
  }

  void _tick() {
    final end = _expiresAt;
    if (end == null || !mounted || _finished) return;
    final left = end.difference(DateTime.now());
    setState(() => _remaining = left.isNegative ? Duration.zero : left);
    if (left.inSeconds <= 0 && !_submitting) {
      _submit(auto: true);
    }
  }

  String _clock(Duration d) {
    final m = d.inMinutes.remainder(100).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  bool _isAnswered(ElearningQuizQuestionModel q) {
    if (q.type == 'SHORT_ANSWER') return (_texts[q.id]?.text.trim().isNotEmpty) ?? false;
    return _selected.containsKey(q.id);
  }

  Future<void> _save(String questionId, Map<String, dynamic> body) async {
    try {
      await ref
          .read(quizAttemptNotifierProvider(widget.quizId).notifier)
          .answer(questionId, body);
    } catch (e) {
      _handleSaveError(e);
    }
  }

  void _handleSaveError(Object e) {
    if (!mounted || _finished) return;
    final message = ApiFailure.from(e).message;
    if (message.contains('Time is up') || message.contains('already submitted')) {
      _finished = true;
      _ticker?.cancel();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Time is up. Your answers were submitted.')),
      );
      ref.invalidate(elearningQuizByIdProvider(widget.quizId));
      context.pop();
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Could not save that answer: $message')),
    );
  }

  void _onTextChanged(String questionId, String value) {
    _saveTimers[questionId]?.cancel();
    _saveTimers[questionId] = Timer(const Duration(milliseconds: 700), () {
      _save(questionId, {'textAnswer': value.trim()});
    });
  }

  Future<void> _flushTexts() async {
    for (final t in _saveTimers.values) { t.cancel(); }
    _saveTimers.clear();
    for (final entry in _texts.entries) {
      if (entry.value.text.trim().isNotEmpty) {
        await _save(entry.key, {'textAnswer': entry.value.text.trim()});
      }
    }
  }

  Future<void> _submit({bool auto = false, List<ElearningQuizQuestionModel> questions = const []}) async {
    if (_submitting || _finished) return;
    if (!auto) {
      final unanswered = questions.where((q) => !_isAnswered(q)).length;
      final ok = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('Submit your quiz?'),
          content: Text(unanswered > 0
              ? 'You have $unanswered unanswered question${unanswered == 1 ? '' : 's'}. You cannot change your answers after submitting.'
              : 'You cannot change your answers after submitting.'),
          actions: [
            TextButton(onPressed: () => Navigator.of(dialog).pop(false), child: const Text('Keep going')),
            FilledButton(onPressed: () => Navigator.of(dialog).pop(true), child: const Text('Submit')),
          ],
        ),
      );
      if (ok != true) return;
    }
    setState(() => _submitting = true);
    try {
      await _flushTexts();
      final result = await ref
          .read(quizAttemptNotifierProvider(widget.quizId).notifier)
          .submit();
      _finished = true;
      _ticker?.cancel();
      ref.invalidate(elearningQuizByIdProvider(widget.quizId));
      ref.invalidate(studentElearingSummaryProvider);
      final courseId = result.courseSpaceId;
      if (courseId.isNotEmpty) {
        ref.invalidate(elearningQuizzesProvider(courseId));
        ref.invalidate(elearningProgressProvider(courseId));
      }
      if (mounted) {
        context.pushReplacement(
            '/student/learn/quizzes/${widget.quizId}/result/${result.id}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ApiFailure.from(e).message)));
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<bool> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: const Text('Leave the quiz?'),
        content: Text(_expiresAt != null
            ? 'Your answers are saved, but the timer keeps running. You can come back and continue until it runs out.'
            : 'Your answers are saved. You can come back and continue later.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialog).pop(false), child: const Text('Stay')),
          FilledButton(onPressed: () => Navigator.of(dialog).pop(true), child: const Text('Leave')),
        ],
      ),
    );
    if (leave == true) await _flushTexts();
    return leave == true;
  }

  @override
  Widget build(BuildContext context) {
    final attemptAsync = ref.watch(quizAttemptNotifierProvider(widget.quizId));
    final quizAsync = ref.watch(elearningQuizByIdProvider(widget.quizId));

    return attemptAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
      data: (attempt) {
        if (attempt == null) {
          return const _ErrorScaffold(
              message: 'This attempt is no longer active. Go back to the quiz page.');
        }
        return quizAsync.when(
          loading: () => const _LoadingScaffold(),
          error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
          data: (quiz) {
            final questions = [...quiz.questions]
              ..sort((a, b) => a.orderIndex.compareTo(b.orderIndex));
            if (questions.isEmpty) {
              return const _ErrorScaffold(message: 'This quiz has no questions yet.');
            }
            _seed(attempt, questions);

            final index = _currentIndex.clamp(0, questions.length - 1);
            final q = questions[index];
            final isLast = index == questions.length - 1;
            final isDark = Theme.of(context).brightness == Brightness.dark;
            final answeredCount = questions.where(_isAnswered).length;
            final low = _remaining != null && _remaining!.inSeconds <= 60;

            return PopScope(
              canPop: false,
              onPopInvokedWithResult: (didPop, _) async {
                if (didPop) return;
                final nav = Navigator.of(context);
                if (await _confirmLeave() && mounted) nav.pop();
              },
              child: Scaffold(
                backgroundColor: isDark ? null : AppColors.offWhite,
                appBar: AppBar(
                  title: Text(quiz.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                  backgroundColor: AppColors.eLearningPrimary,
                  foregroundColor: Colors.white,
                  actions: [
                    if (_remaining != null)
                      Padding(
                        padding: const EdgeInsets.only(right: 14),
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: low ? Colors.red.shade600 : Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              const Icon(Icons.timer_rounded, size: 15, color: Colors.white),
                              const SizedBox(width: 4),
                              Text(_clock(_remaining!), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontFeatures: [FontFeature.tabularFigures()])),
                            ]),
                          ),
                        ),
                      ),
                  ],
                  bottom: PreferredSize(
                    preferredSize: const Size.fromHeight(4),
                    child: LinearProgressIndicator(
                      value: questions.isEmpty ? 0 : answeredCount / questions.length,
                      backgroundColor: AppColors.eLearningPrimary,
                      valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      minHeight: 4,
                    ),
                  ),
                ),
                body: Column(
                  children: [
                    // Question palette: jump to any question, answered ones are filled.
                    Container(
                      color: AppColors.eLearningPrimary.withValues(alpha: 0.08),
                      height: 56,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        itemCount: questions.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (_, i) {
                          final answered = _isAnswered(questions[i]);
                          final current = i == index;
                          return GestureDetector(
                            onTap: () {
                              _flushTexts();
                              setState(() => _currentIndex = i);
                            },
                            child: Container(
                              width: 36,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: answered ? AppColors.eLearningPrimary : Colors.transparent,
                                border: Border.all(
                                  color: AppColors.eLearningPrimary,
                                  width: current ? 3 : 1.2,
                                ),
                              ),
                              child: Text('${i + 1}', style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                color: answered ? Colors.white : AppColors.eLearningPrimary,
                              )),
                            ),
                          );
                        },
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Question ${index + 1} of ${questions.length} · $answeredCount answered',
                            style: const TextStyle(fontWeight: FontWeight.w900, color: AppColors.eLearningPrimary, fontSize: 13),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.eLearningPrimary,
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              '${_trimNumber(q.points)} pt${q.points == 1 ? "" : "s"}',
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: SingleChildScrollView(
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
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
                                  _TypeBadge(type: q.type),
                                  const SizedBox(height: 12),
                                  Text(
                                    q.prompt,
                                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700, height: 1.5),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                            if (q.type == 'MULTIPLE_CHOICE')
                              _McqOptions(
                                options: q.options,
                                selectedId: _selected[q.id],
                                onSelect: (optId) {
                                  setState(() => _selected[q.id] = optId);
                                  _save(q.id, {'selectedOptionId': optId});
                                },
                              )
                            else if (q.type == 'TRUE_FALSE')
                              _TrueFalseOptions(
                                selected: switch (_selected[q.id]) {
                                  'true' => 'True',
                                  'false' => 'False',
                                  _ => null,
                                },
                                onSelect: (val) {
                                  final answer = val.toLowerCase();
                                  setState(() => _selected[q.id] = answer);
                                  _save(q.id, {'textAnswer': answer});
                                },
                              )
                            else
                              _ShortAnswerField(
                                key: ValueKey(q.id),
                                controller: _controllerFor(q.id),
                                onChanged: (v) {
                                  setState(() {});
                                  _onTextChanged(q.id, v);
                                },
                              ),
                          ],
                        ),
                      ),
                    ),
                    Container(
                      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + MediaQuery.of(context).padding.bottom),
                      decoration: BoxDecoration(
                        color: isDark ? null : Colors.white,
                        border: const Border(top: BorderSide(color: AppColors.border)),
                      ),
                      child: Row(children: [
                        if (index > 0) ...[
                          Expanded(
                            child: OutlinedButton(
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.eLearningPrimary,
                                side: const BorderSide(color: AppColors.eLearningPrimary),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              ),
                              onPressed: () {
                                _flushTexts();
                                setState(() => _currentIndex = index - 1);
                              },
                              child: const Text('← Previous'),
                            ),
                          ),
                          const SizedBox(width: 12),
                        ],
                        Expanded(
                          flex: 2,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: isLast ? Colors.green.shade600 : AppColors.eLearningPrimary,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            onPressed: isLast
                                ? (_submitting ? null : () => _submit(questions: questions))
                                : () {
                                    _flushTexts();
                                    setState(() => _currentIndex = index + 1);
                                  },
                            child: Text(
                              isLast ? (_submitting ? 'Submitting…' : 'Submit quiz ✓') : 'Next →',
                              style: const TextStyle(fontWeight: FontWeight.w900),
                            ),
                          ),
                        ),
                      ]),
                    ),
                  ],
                ),
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
  const _ShortAnswerField({super.key, required this.controller, this.onChanged});
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    onChanged: onChanged,
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
    final quizAsync = ref.watch(elearningQuizByIdProvider(quizId));

    return attemptsAsync.when(
      loading: () => const _LoadingScaffold(),
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
      data: (attempts) {
        ElearningQuizAttemptModel? attempt;
        for (final a in attempts) {
          if (a.id == attemptId) attempt = a;
        }
        attempt ??= attempts.isNotEmpty ? attempts.last : null;
        if (attempt == null) {
          return const _ErrorScaffold(message: 'We could not find that attempt.');
        }
        final result = attempt;
        final quiz = quizAsync.valueOrNull;
        final percent = result.percentScore;
        final pending = result.awaitingManualGrade;
        final passed = result.isPassed;
        final questionsById = {for (final q in quiz?.questions ?? const <ElearningQuizQuestionModel>[]) q.id: q};
        final answersByQuestion = {for (final a in result.answers) a.questionId: a};

        String headline;
        if (pending) {
          headline = 'Submitted';
        } else if (passed == true) {
          headline = 'Great work!';
        } else if (passed == false) {
          headline = 'Keep practising';
        } else {
          headline = 'Quiz complete';
        }

        return _LearnScaffold(
          title: headline,
          kicker: 'ATTEMPT ${result.attemptNumber} · RESULT',
          subtitle: pending
              ? 'Your teacher still has to mark your written answers.'
              : passed == true
                  ? 'You passed this quiz.'
                  : passed == false
                      ? 'You did not reach the pass mark${result.passingScore != null ? ' of ${result.passingScore!.toStringAsFixed(0)}%' : ''}.'
                      : 'Your score is recorded.',
          children: [
            _ProgressBanner(value: (percent ?? 0).round().clamp(0, 100)),
            _TaskCard(
              icon: Icons.star_rounded,
              title: pending ? 'Score so far' : 'Score',
              subtitle: '${result.totalScore != null ? _trimNumber(result.totalScore!) : "—"} / ${result.maxScore != null ? _trimNumber(result.maxScore!) : "—"} points',
              trailing: percent == null ? '' : '${percent.toStringAsFixed(0)}%',
            ),
            if (pending)
              const _TaskCard(
                icon: Icons.hourglass_top_rounded,
                title: 'Written answers',
                subtitle: 'Waiting for your teacher. The score will update once they are marked.',
                trailing: 'Pending',
              ),
            if (result.reveal && result.review.isNotEmpty) ...[
              const _SectionTitle('Review your answers'),
              for (var i = 0; i < result.review.length; i++)
                _ReviewCard(
                  number: i + 1,
                  item: result.review[i],
                  question: questionsById[result.review[i].questionId],
                  answer: answersByQuestion[result.review[i].questionId],
                ),
            ] else if (!result.reveal)
              _TaskCard(
                icon: Icons.visibility_off_rounded,
                title: 'Answer key',
                subtitle: switch (quiz?.showCorrectAfter) {
                  'NEVER' => 'Your teacher keeps the correct answers hidden for this quiz.',
                  'IMMEDIATELY' => 'Correct answers appear once your attempt is submitted.',
                  _ => 'Correct answers are shown after the quiz closes.',
                },
                trailing: '',
              ),
            if (quiz != null && !quiz.isClosed && quiz.attemptsLeft > 0)
              _PrimaryAction(
                label: 'Try again (${quiz.attemptsLeft} left)',
                onTap: () => context.pushReplacement('/student/learn/quizzes/$quizId'),
              ),
            OutlinedButton(
              onPressed: () => context.pop(),
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
              child: const Text('Back to quiz'),
            ),
          ],
        );
      },
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.number, required this.item, this.question, this.answer});
  final int number;
  final ElearningQuizReviewItem item;
  final ElearningQuizQuestionModel? question;
  final ElearningQuizAnswerModel? answer;

  String _yourAnswer() {
    if (answer == null) return 'No answer';
    switch (item.type) {
      case 'MULTIPLE_CHOICE':
        final id = answer!.selectedOptionId;
        if (id == null) return 'No answer';
        for (final o in question?.options ?? const <ElearningQuizOptionModel>[]) {
          if (o.id == id) return o.text;
        }
        return 'No answer';
      case 'TRUE_FALSE':
        final v = (answer!.textAnswer ?? '').toLowerCase();
        return v == 'true' ? 'True' : v == 'false' ? 'False' : 'No answer';
      default:
        final t = (answer!.textAnswer ?? '').trim();
        return t.isEmpty ? 'No answer' : t;
    }
  }

  String? _correct() {
    final c = item.correctAnswer;
    if (c == null || c.isEmpty) return null;
    if (item.type == 'TRUE_FALSE') return c.toLowerCase() == 'true' ? 'True' : 'False';
    return c;
  }

  @override
  Widget build(BuildContext context) {
    final awarded = answer?.scoreAwarded;
    final isShort = item.type == 'SHORT_ANSWER';
    final correct = answer?.isCorrect;
    final marked = awarded != null;
    final color = !marked && isShort
        ? Colors.orange.shade700
        : correct == true
            ? Colors.green.shade600
            : Colors.red.shade500;
    final icon = !marked && isShort
        ? Icons.hourglass_top_rounded
        : correct == true
            ? Icons.check_circle_rounded
            : Icons.cancel_rounded;
    final correctText = _correct();

    return _TapCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text('Question $number', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
            ),
            Text(
              marked ? '${_trimNumber(awarded)} / ${_trimNumber(item.points)}' : (isShort ? 'Not marked yet' : '0 / ${_trimNumber(item.points)}'),
              style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 12),
            ),
          ]),
          const SizedBox(height: 8),
          Text(item.prompt, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600, height: 1.4)),
          const SizedBox(height: 8),
          Text('Your answer: ${_yourAnswer()}', style: Theme.of(context).textTheme.bodySmall),
          if (correctText != null && !isShort && correct != true)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text('Correct answer: $correctText', style: TextStyle(color: Colors.green.shade700, fontWeight: FontWeight.w800, fontSize: 12.5)),
            ),
          if ((item.explanation ?? '').trim().isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(item.explanation!.trim(), style: Theme.of(context).textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
            ),
        ],
      ),
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
            .showSnackBar(SnackBar(content: Text(ApiFailure.from(e).message)));
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
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
      data: (thread) => _LearnScaffold(
        title: thread.title,
        kicker: 'DISCUSSION',
        subtitle: '${thread.replies.length} replies',
        children: [
          _TaskCard(
            icon: Icons.person_rounded,
            title: thread.body,
            subtitle: 'Posted by ${thread.authorName.isNotEmpty ? thread.authorName : _roleLabel(thread.authorRole)}',
            trailing: thread.isResolved ? 'Resolved ✓' : '',
          ),
          const _SectionTitle('Replies'),
          ...thread.replies.map(
            (reply) => _TaskCard(
              icon: reply.authorRole == 'TEACHER'
                  ? Icons.school_rounded
                  : Icons.person_rounded,
              title: reply.body,
              subtitle: '${reply.authorName.isNotEmpty ? reply.authorName : _roleLabel(reply.authorRole)} · ${DateFormat('d MMM, HH:mm').format(reply.createdAt.toLocal())}',
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

String _roleLabel(String role) => switch (role) {
      'TEACHER' => 'Teacher',
      'HEAD_OF_DEPARTMENT' => 'Head of department',
      'STUDENT' => 'Student',
      'PARENT' => 'Parent',
      _ => role,
    };

class StudentCourseDiscussionsScreen extends ConsumerStatefulWidget {
  const StudentCourseDiscussionsScreen({super.key, required this.courseId});
  final String courseId;

  @override
  ConsumerState<StudentCourseDiscussionsScreen> createState() =>
      _StudentCourseDiscussionsScreenState();
}

class _StudentCourseDiscussionsScreenState
    extends ConsumerState<StudentCourseDiscussionsScreen> {
  final _title = TextEditingController();
  final _body = TextEditingController();
  bool _posting = false;

  @override
  void dispose() {
    _title.dispose();
    _body.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final title = _title.text.trim();
    final body = _body.text.trim();
    if (title.isEmpty || body.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add a title and your question first.')),
      );
      return;
    }
    setState(() => _posting = true);
    try {
      final thread = await ref
          .read(elearningApiServiceProvider)
          .createDiscussion(widget.courseId, title, body);
      _title.clear();
      _body.clear();
      ref.invalidate(elearningDiscussionsProvider(widget.courseId));
      if (mounted) context.push('/student/learn/discussions/${thread.id}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(ApiFailure.from(e).message)));
      }
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final threadsAsync = ref.watch(elearningDiscussionsProvider(widget.courseId));
    final fill = Theme.of(context).brightness == Brightness.dark ? Colors.grey[900] : Colors.white;

    return _LearnScaffold(
      onRefresh: () async {
        ref.invalidate(elearningDiscussionsProvider(widget.courseId));
        await ref.read(elearningDiscussionsProvider(widget.courseId).future);
      },
      title: 'Course Discussion',
      kicker: 'ASK AND ANSWER',
      subtitle: 'Questions from your class and replies from your teacher',
      children: [
        _TapCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ask a question', style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w900)),
              const SizedBox(height: 10),
              TextField(
                controller: _title,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Title',
                  filled: true,
                  fillColor: fill,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _body,
                minLines: 3,
                maxLines: 6,
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'What would you like to know?',
                  filled: true,
                  fillColor: fill,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
                ),
              ),
              const SizedBox(height: 12),
              _PrimaryAction(label: _posting ? 'Posting…' : 'Post question', onTap: _posting ? null : _ask),
            ],
          ),
        ),
        const _SectionTitle('Discussions'),
        threadsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => _ErrorCard(message: ApiFailure.from(e).message),
          data: (threads) => threads.isEmpty
              ? const _EmptyState(icon: Icons.forum_rounded, message: 'No discussions yet. Be the first to ask!')
              : Column(
                  children: [
                    for (final t in threads)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _TaskCard(
                          icon: t.isPinned ? Icons.push_pin_rounded : Icons.forum_rounded,
                          title: t.title,
                          subtitle: '${t.authorName.isNotEmpty ? t.authorName : _roleLabel(t.authorRole)} · ${t.replies.length} repl${t.replies.length == 1 ? 'y' : 'ies'}',
                          trailing: t.isResolved ? 'Resolved' : '',
                          onTap: () => context.push('/student/learn/discussions/${t.id}'),
                        ),
                      ),
                  ],
                ),
        ),
      ],
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
      error: (e, _) => _ErrorScaffold(message: ApiFailure.from(e).message),
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
    this.onRefresh,
  });
  final String title;
  final String kicker;
  final String subtitle;
  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final scroll = CustomScrollView(
          physics: onRefresh == null ? null : const AlwaysScrollableScrollPhysics(),
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
        );
    // The page sits on a light background under the status bar, so keep its clock and icons dark.
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: isDark ? null : AppColors.offWhite,
        body: SafeArea(
          child: onRefresh == null ? scroll : RefreshIndicator(onRefresh: onRefresh!, child: scroll),
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
          if (context.canPop())
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
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 10),
            Expanded(
              child: Container(
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
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(items[i].$2,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: AppColors.eLearningPrimary,
                          )),
                    ),
                    Text(items[i].$1,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        )),
                  ],
                ),
              ),
            ),
          ],
        ],
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
      Text(
          submission.score != null && submission.maxScore != null
              ? 'Grade: ${_trimNumber(submission.score!)} / ${_trimNumber(submission.maxScore!)} (${submission.scorePercent?.toStringAsFixed(0) ?? "—"}%)'
              : 'Grade: ${submission.scorePercent?.toStringAsFixed(0) ?? "—"}%',
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
