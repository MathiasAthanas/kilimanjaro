import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/models/elearning_models.dart';

Map<String, dynamic> _quiz({List<Map<String, dynamic>> attempts = const [], int maxAttempts = 2, String status = 'PUBLISHED'}) => {
      'id': 'q1',
      'courseSpaceId': 'c1',
      'title': 'Energy checkpoint',
      'maxAttempts': maxAttempts,
      'status': status,
      'totalPoints': '8',
      'showCorrectAfter': 'IMMEDIATELY',
      'questions': [],
      'attempts': attempts,
    };

Map<String, dynamic> _attempt(String id, String status, {num? percent, bool? passed}) => {
      'id': id,
      'attemptNumber': 1,
      'status': status,
      'startedAt': '2026-10-24T10:00:00.000Z',
      'percentScore': percent,
      'isPassed': passed,
    };

void main() {
  group('ElearningQuizModel', () {
    test('counts only finished attempts against the limit', () {
      final quiz = ElearningQuizModel.fromJson(_quiz(attempts: [
        _attempt('a', 'AUTO_GRADED', percent: 40),
        _attempt('b', 'IN_PROGRESS'),
      ]));
      expect(quiz.finishedAttempts, hasLength(1));
      expect(quiz.attemptsLeft, 1);
      expect(quiz.inProgressAttempt?.id, 'b');
    });

    test('best percent ignores unmarked attempts', () {
      final quiz = ElearningQuizModel.fromJson(_quiz(attempts: [
        _attempt('a', 'SUBMITTED'),
        _attempt('b', 'MANUALLY_GRADED', percent: 81.25, passed: true),
        _attempt('c', 'AUTO_GRADED', percent: 50),
      ]));
      expect(quiz.bestPercent, 81.25);
      expect(quiz.attempts.first.awaitingManualGrade, isTrue);
    });

    test('reads the reveal policy and defaults to after-close', () {
      expect(ElearningQuizModel.fromJson(_quiz()).showCorrectAfter, 'IMMEDIATELY');
      final bare = _quiz()..remove('showCorrectAfter');
      expect(ElearningQuizModel.fromJson(bare).showCorrectAfter, 'AFTER_CLOSE');
    });
  });

  group('ElearningAssignmentModel.stateLabel', () {
    Map<String, dynamic> assignment({List<Map<String, dynamic>>? submissions, String status = 'PUBLISHED', String? dueAt}) => {
          'id': 'a1',
          'courseSpaceId': 'c1',
          'title': 'Essay',
          'instructions': '',
          'type': 'TEXT',
          'status': status,
          'maxScore': 20,
          'dueAt': dueAt,
          'allowLateSubmission': true,
          'submissions': submissions ?? [],
        };

    Map<String, dynamic> submission(String status, {num? score}) => {
          'id': 's1',
          'status': status,
          'score': score,
          'maxScore': 20,
        };

    test('shows the score once graded', () {
      final a = ElearningAssignmentModel.fromJson(assignment(submissions: [submission('GRADED', score: 17)]));
      expect(a.stateLabel, '17/20');
    });

    test('distinguishes returned, handed in and not started', () {
      expect(ElearningAssignmentModel.fromJson(assignment(submissions: [submission('RETURNED')])).stateLabel, 'Returned');
      expect(ElearningAssignmentModel.fromJson(assignment(submissions: [submission('SUBMITTED')])).stateLabel, 'Handed in');
      expect(ElearningAssignmentModel.fromJson(assignment(dueAt: '2999-01-01T00:00:00.000Z')).stateLabel, 'To do');
    });

    test('flags overdue work that was never handed in', () {
      final a = ElearningAssignmentModel.fromJson(assignment(dueAt: '2020-01-01T00:00:00.000Z'));
      expect(a.stateLabel, 'Overdue');
    });

    test('staff counts ignore drafts', () {
      final a = ElearningAssignmentModel.fromJson(assignment(submissions: [
        submission('DRAFT'),
        submission('SUBMITTED'),
        submission('GRADED', score: 10),
      ]));
      expect(a.submissionCount, 2);
      expect(a.toGradeCount, 1);
    });
  });

  group('ElearningQuizAttemptModel', () {
    test('parses the answer key review when revealed', () {
      final attempt = ElearningQuizAttemptModel.fromJson({
        ..._attempt('a', 'AUTO_GRADED', percent: 100, passed: true),
        'reveal': true,
        'expiresAt': null,
        'review': [
          {'questionId': 'q', 'prompt': 'Unit of power?', 'type': 'MULTIPLE_CHOICE', 'points': '1', 'correctAnswer': 'Watt'},
        ],
      });
      expect(attempt.reveal, isTrue);
      expect(attempt.review.single.correctAnswer, 'Watt');
      expect(attempt.expiresAt, isNull);
    });
  });
}
