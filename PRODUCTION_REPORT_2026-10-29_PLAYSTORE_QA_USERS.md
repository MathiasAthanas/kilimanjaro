# Play Store Mobile QA Users Production Report

## Purpose

Provision a removable, school-scoped dataset for testing the Android application across Student, Parent, Teacher, Head of Department, Principal, and Finance roles.

Plaintext temporary passwords are intentionally excluded from this repository report.

## Backup

- Created before any provisioning changes.
- File: `/opt/kilimanjaro/storage/backups/kilimanjaro-prod-pre-playstore-test-users-20261029T044143Z.dump`
- Format: PostgreSQL custom dump
- Validation: `pg_restore --list` passed
- Size: 1,094,174 bytes
- SHA-256: `6b474debc1ffe8d5c83beae53fa24c7404f72e565c0c87bb45b93e3623f5d4a2`

## Scope

- School: `Kilimanjaro Mobile QA`
- School code: `KS-MOBILE-QA`
- School ID: `5fecda5d-8fd2-41b5-8b84-b1578048c8b2`
- Class: `Play Store Test Form 1 A`
- Class ID: `0c721291-720c-4ced-a4d5-a2549f0b8918`
- Marker used on removable records: `PLAYSTORE_MOBILE_QA_2026`

## Accounts

All accounts are active, belong to this school only, have a recoverable encrypted temporary password, and must change their password on first sign-in.

| Role | Login | State before this operation |
| --- | --- | --- |
| Student | `KS-MOBILE-QA-001` | Existing tester; password reset |
| Student sibling | `KS-MOBILE-QA-002` | Created for Parent child-switcher testing |
| Parent | `playtest.parent.2026@kilimanjaroschools.site` | Existing tester; password reset |
| Teacher | `playtest.teacher.2026@kilimanjaroschools.site` | Existing tester; password reset |
| Head of Department | `playtest.hod.2026@kilimanjaroschools.site` | Created |
| Principal | `playtest.principal.2026@kilimanjaroschools.site` | Created |
| Finance | `playtest.finance.2026@kilimanjaroschools.site` | Created |

The two unrelated Lucy teacher memberships already present in this school were not modified.

## Linked Test Data

- QA term: `Mobile QA Test Term`, ID `6d073fd1-e12e-44eb-b1b1-6df49c33fa96`.
- Parent is the active primary guardian of both QA students.
- Both students are actively enrolled in `Play Store Test Form 1 A`.
- Sibling Student ID: `320c4b6f-40bb-4563-baa5-7cb38fba0887`.
- Guardian ID: `c9ca1c0d-808c-4c6b-b855-3f6a6b4f456d`.
- Teacher remains the class teacher.
- Department: `Mobile QA Sciences` (`MOBILE-QA-SCI`), ID `9723d8e0-9089-4fa5-9f5d-701503524c90`.
- Subject: `Mobile QA Digital Literacy` (`MOBILE-QA-DL`), ID `4f6a210c-d832-42e1-b4d4-fea1b3aa0b9a`.
- Class-subject assignment ID: `d6f3fe8b-09c3-46de-91b9-0308e6b6fa08`.
- HOD is actively assigned to the subject-owning department.
- Invoice: `INV-MOBILE-QA-2026-001`, ID `46a484ce-b1e8-47dc-9e67-c951678354ce`, total TZS 50,000.
- Payment: `PAY-MOBILE-QA-2026-001`, ID `2504c343-f3df-45bf-9a65-1bbb3c743f3f`, TZS 25,000, pending Finance approval.
- Finance identifiers: `MOBILE-QA-TUITION`, `MOBILE-QA-REF-001`.

## Schema Drift Resolved

Production lacked `students.DepartmentHod.schoolId`, although the deployed Prisma client already required it. The checked-in non-destructive migration was applied directly inside a PostgreSQL transaction:

`backend/services/student-service/prisma/migrations/20261014090000_school_scoped_departments/migration.sql`

The migration added and backfilled the missing school scope column and created the checked-in school-scoped department/HOD indexes. No department, HOD, user, or student record was removed.

## Verification

- All seven accounts authenticated through the production gateway.
- Every login returned the expected role.
- Every login returned `SCHOOL` scope with exactly one school.
- Every account returned forced password change status.
- Every account has an encrypted recoverable temporary credential.
- Parent has exactly two active linked QA children.
- Teacher/class/subject and HOD/department relationships are active.
- Finance invoice is issued and payment is pending approval.
- Unexpected active memberships outside the QA school: `0`.
- Production gateway health: `ok`; all dependencies reachable.
- Temporary server-side provisioning script was removed.

## Later Cleanup

Use the school ID, explicit IDs, unique codes, login identifiers, and marker above to build a dependency-ordered cleanup. Cleanup must include test login refresh tokens and audit records, the pending approval/payment/invoice chain, fee structure/category, class-subject and subject, department HOD assignment and department, sibling guardian link/enrolment/student, all seven QA account memberships/users, and any actions created by the testers after this report.

Do not delete the school or class until their then-current contents have been reviewed, because both existed before this operation.

