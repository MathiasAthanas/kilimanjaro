# Play Store Test Accounts

## Production QA Data (2026-09-30)

An isolated testing school was created for mobile release testing:

- School: `Kilimanjaro Mobile QA` (`KS-MOBILE-QA`)
- Academic year: `2026`
- Class: `Play Store Test Form 1 A`
- Scope: only the three accounts below and their linked test records

The credentials are intentionally not stored in source control. They were shared directly with the release owner.

| Role | Login identifier | Linked test data |
| --- | --- | --- |
| Student | `KS-MOBILE-QA-001` | One active student enrolment in the QA class |
| Parent | `playtest.parent.2026@kilimanjaroschools.site` | Primary guardian of the QA student |
| Teacher | `playtest.teacher.2026@kilimanjaroschools.site` | Class teacher for the QA class |

All three credentials were verified against the live login endpoint after creation. Each account requires a password change on first use.

## Safe Removal Procedure

Remove only this test dataset, in this order:

1. Reassign or clear the QA class's `classTeacherId`.
2. Delete the QA student's guardian link, enrolment, guardian record, and student record.
3. Delete the three associated auth users and their school memberships after the linked student/guardian records are gone.
4. Delete `Play Store Test Form 1 A`.
5. Delete `Kilimanjaro Mobile QA` (`KS-MOBILE-QA`).

This sequence removes only isolated QA records and does not alter real schools, users, classes, or application functionality. Remove any optional test records created by testers before running the procedure.
