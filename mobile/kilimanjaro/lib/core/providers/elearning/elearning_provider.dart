import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/elearning_models.dart';
import '../../services/api/elearning_api_service.dart';
import '../auth_provider.dart';

// ─── Service provider ────────────────────────────────────────────────────────

final elearningApiServiceProvider = Provider<ElearningApiService>((ref) {
  return ElearningApiService(ref.watch(secureStorageProvider));
});

// ─── Course list ─────────────────────────────────────────────────────────────

final elearningCoursesProvider =
    FutureProvider<List<ElearningCourseModel>>((ref) async {
  return ref.watch(elearningApiServiceProvider).listCourses();
});

final activeCourseCountProvider = Provider<int>((ref) {
  final courses = ref.watch(elearningCoursesProvider).value ?? [];
  return courses.where((c) => c.isActive).length;
});

// ─── Single course ───────────────────────────────────────────────────────────

final elearningCourseProvider =
    FutureProvider.family<ElearningCourseModel, String>((ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).getCourse(courseId);
});

// ─── Lessons ─────────────────────────────────────────────────────────────────

final elearningLessonsProvider =
    FutureProvider.family<List<ElearningLessonModel>, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).listLessons(courseId);
});

// ─── Materials ───────────────────────────────────────────────────────────────

typedef _LessonKey = ({String courseId, String lessonId});

final elearningMaterialsProvider =
    FutureProvider.family<List<ElearningMaterialModel>, _LessonKey>(
        (ref, key) async {
  return ref
      .watch(elearningApiServiceProvider)
      .listMaterials(key.courseId, key.lessonId);
});

// ─── Assignments ─────────────────────────────────────────────────────────────

final elearningAssignmentsProvider =
    FutureProvider.family<List<ElearningAssignmentModel>, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).listAssignments(courseId);
});

final mySubmissionProvider =
    FutureProvider.family<ElearningSubmissionModel?, String>(
        (ref, assignmentId) async {
  return ref.watch(elearningApiServiceProvider).mySubmission(assignmentId);
});

final mySubmissionsProvider =
    FutureProvider.family<List<ElearningSubmissionModel>, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).mySubmissions(courseId);
});

// ─── Quizzes ─────────────────────────────────────────────────────────────────

final elearningQuizzesProvider =
    FutureProvider.family<List<ElearningQuizModel>, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).listQuizzes(courseId);
});

typedef _QuizKey = ({String courseId, String quizId});

final elearningQuizProvider =
    FutureProvider.family<ElearningQuizModel, _QuizKey>((ref, key) async {
  return ref
      .watch(elearningApiServiceProvider)
      .getQuiz(key.courseId, key.quizId);
});

final myAttemptsProvider =
    FutureProvider.family<List<ElearningQuizAttemptModel>, String>(
        (ref, quizId) async {
  return ref.watch(elearningApiServiceProvider).myAttempts(quizId);
});

// ─── Active quiz attempt (session state) ─────────────────────────────────────

class QuizAttemptNotifier
    extends AutoDisposeFamilyAsyncNotifier<ElearningQuizAttemptModel?, String> {
  @override
  Future<ElearningQuizAttemptModel?> build(String quizId) async {
    return ref.watch(elearningApiServiceProvider).activeAttempt(quizId);
  }

  Future<ElearningQuizAttemptModel> start() async {
    final attempt =
        await ref.read(elearningApiServiceProvider).startAttempt(arg);
    state = AsyncData(attempt);
    return attempt;
  }

  Future<void> answer(
      String questionId, Map<String, dynamic> answerBody) async {
    final current = state.value;
    if (current == null) return;
    await ref
        .read(elearningApiServiceProvider)
        .saveAnswer(current.id, questionId, answerBody);
  }

  Future<ElearningQuizAttemptModel> submit() async {
    final current = state.value;
    if (current == null) throw StateError('No active attempt');
    final result = await ref
        .read(elearningApiServiceProvider)
        .submitAttempt(current.id);
    state = AsyncData(result);
    ref.invalidate(myAttemptsProvider(arg));
    return result;
  }
}

final quizAttemptNotifierProvider =
    AutoDisposeAsyncNotifierProviderFamily<QuizAttemptNotifier,
        ElearningQuizAttemptModel?, String>(QuizAttemptNotifier.new);

// ─── Progress ─────────────────────────────────────────────────────────────────

final elearningProgressProvider =
    FutureProvider.family<ElearningProgressModel, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).myProgress(courseId);
});

final studentElearingSummaryProvider =
    FutureProvider<ElearningStudentSummaryModel>((ref) async {
  return ref.watch(elearningApiServiceProvider).studentSummary();
});

// ─── Announcements ───────────────────────────────────────────────────────────

final elearningAnnouncementsProvider =
    FutureProvider.family<List<ElearningAnnouncementModel>, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).listAnnouncements(courseId);
});

// ─── Discussions ─────────────────────────────────────────────────────────────

final elearningDiscussionsProvider =
    FutureProvider.family<List<ElearningDiscussionModel>, String>(
        (ref, courseId) async {
  return ref.watch(elearningApiServiceProvider).listDiscussions(courseId);
});

class DiscussionNotifier
    extends AutoDisposeFamilyAsyncNotifier<ElearningDiscussionModel, String> {
  @override
  Future<ElearningDiscussionModel> build(String threadId) async {
    return ref.watch(elearningApiServiceProvider).getDiscussion(threadId);
  }

  Future<void> reply(String body) async {
    await ref.read(elearningApiServiceProvider).addReply(arg, body);
    ref.invalidateSelf();
  }
}

final discussionNotifierProvider =
    AutoDisposeAsyncNotifierProviderFamily<DiscussionNotifier,
        ElearningDiscussionModel, String>(DiscussionNotifier.new);

// ─── Submission notifier ─────────────────────────────────────────────────────

class SubmissionNotifier extends AutoDisposeFamilyAsyncNotifier<
    ElearningSubmissionModel?, String> {
  @override
  Future<ElearningSubmissionModel?> build(String assignmentId) async {
    return ref.watch(elearningApiServiceProvider).mySubmission(assignmentId);
  }

  Future<void> saveOrSubmit(Map<String, dynamic> body) async {
    final updated = await ref
        .read(elearningApiServiceProvider)
        .upsertSubmission(arg, body);
    state = AsyncData(updated);
  }
}

final submissionNotifierProvider =
    AutoDisposeAsyncNotifierProviderFamily<SubmissionNotifier,
        ElearningSubmissionModel?, String>(SubmissionNotifier.new);
