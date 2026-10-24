import 'package:flutter_test/flutter_test.dart';
import 'package:kilimanjaro/models/admissions_models.dart';
import 'package:kilimanjaro/models/contact_model.dart';

void main() {
  group('AdmissionApplicant.fromJson', () {
    test('parses class id, assessments and offer from the detail payload', () {
      final applicant = AdmissionApplicant.fromJson({
        'id': 'a1',
        'firstName': 'Amina',
        'lastName': 'Juma',
        'stage': 'OFFER',
        'guardianFirstName': 'Salma',
        'guardianLastName': 'Juma',
        'guardianPhone': '+255700000000',
        'sourceChannel': 'REFERRAL',
        'prospectiveClass': {'id': 'cls-1', 'name': 'Form 1', 'stream': 'A'},
        'assessments': [
          {
            'id': 'as-2',
            'scheduledAt': '2026-02-01T09:00:00.000Z',
            'subjectFocus': 'Maths',
            'score': 78,
            'maxScore': 100,
            'outcome': 'PASSED',
          },
          {'id': 'as-1', 'scheduledAt': '2026-01-01T09:00:00.000Z', 'outcome': 'PENDING'},
        ],
        'offer': {
          'id': 'of-1',
          'classId': 'cls-1',
          'decision': 'PENDING',
          'feeExpectation': 500000,
        },
      });

      expect(applicant.fullName, 'Amina Juma');
      expect(applicant.prospectiveClassId, 'cls-1');
      expect(applicant.assessments.length, 2);
      // Most-recent first (as ordered by the backend).
      expect(applicant.latestAssessment!.id, 'as-2');
      expect(applicant.latestAssessment!.outcome, 'PASSED');
      expect(applicant.offer!.decision, 'PENDING');
      expect(applicant.offer!.classId, 'cls-1');
    });

    test('tolerates a minimal inquiry payload with no lifecycle records', () {
      final applicant = AdmissionApplicant.fromJson({
        'id': 'a2',
        'firstName': 'Bob',
        'lastName': 'K',
        'stage': 'INQUIRY',
        'guardianPhone': '0700111222',
      });
      expect(applicant.assessments, isEmpty);
      expect(applicant.offer, isNull);
      expect(applicant.prospectiveClassId, isNull);
    });
  });

  group('ContactSchoolModel.fromJson', () {
    test('maps school-contact fields and actions', () {
      final contact = ContactSchoolModel.fromJson({
        'schoolName': 'Kilimanjaro Primary',
        'address': 'Moshi',
        'emergencyPhone': '+255222222222',
        'actions': [
          {'type': 'PHONE', 'label': 'Call', 'value': '+255222222222'},
          {'type': 'EMAIL', 'label': 'Email', 'value': 'info@example.test'},
        ],
      });
      expect(contact.schoolName, 'Kilimanjaro Primary');
      expect(contact.emergencyPhone, '+255222222222');
      expect(contact.actions.length, 2);
      expect(contact.actions.first.type, ContactType.phone);
      expect(contact.actions[1].type, ContactType.email);
    });
  });
}
