import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/models/child_summary_model.dart';
import 'package:kilimanjaro/models/json_num.dart';
import 'package:kilimanjaro/models/subject_result_model.dart';

void main() {
  group('numOf', () {
    test('accepts numbers and numeric strings (Prisma Decimal)', () {
      expect(numOf(5), 5);
      expect(numOf('85.50'), 85.5);
      expect(numOf('abc'), isNull);
      expect(numOf(null), isNull);
    });
  });

  group('SubjectResultModel.fromJson', () {
    test('parses assessmentScores sent as a {label: score} map', () {
      final model = SubjectResultModel.fromJson({
        'subjectId': 's1',
        'subjectName': 'Physics',
        'weightedTotal': '85',
        'grade': 'A',
        'rank': 1,
        'totalStudentsInClass': 8,
        'assessmentScores': {'CAT1': 82, 'FINAL': 87},
      });
      expect(model.score, 85);
      expect(model.assessments.map((a) => a.label), ['CAT1', 'FINAL']);
      expect(model.assessments.last.score, 87);
    });

    test('still parses the list shape', () {
      final model = SubjectResultModel.fromJson({
        'subjectId': 's1',
        'subjectName': 'Physics',
        'assessmentScores': [
          {'label': 'CAT1', 'score': 70, 'maxScore': 100},
        ],
      });
      expect(model.assessments.single.label, 'CAT1');
    });
  });

  group('ChildSummary.fromJson', () {
    final child = {
      'id': 'c1',
      'firstName': 'Baraka',
      'lastName': 'Mollel',
      'classLabel': 'Nursery A',
      'academicYear': '2026 Academic Year',
    };

    test('handles string labels and per-term attendance summaries', () {
      final summary = ChildSummary.fromJson({
        ...child,
        'profile': {
          'id': 'c1',
          'firstName': 'Baraka',
          'lastName': 'Mollel',
          'enrolments': [
            {'termId': 't2', 'class': {'name': 'Nursery', 'stream': 'A'}},
          ],
        },
        'attendanceSummary': [
          {'termId': 't1', 'attendanceRate': 50},
          {'termId': 't2', 'attendanceRate': 95.5},
        ],
        'performance': {
          'academicHistory': [
            {'termId': 't2', 'weightedTotal': 60},
            {'termId': 't2', 'weightedTotal': 80},
          ],
        },
      });
      expect(summary.name, 'Baraka Mollel');
      expect(summary.classLabel, 'Nursery A');
      expect(summary.academicYear, '2026 Academic Year');
      expect(summary.currentTermId, 't2');
      expect(summary.attendanceRate, 95.5);
      expect(summary.overallScore, 70);
      expect(summary.overallGrade, 'B');
    });
  });
}
