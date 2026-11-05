# Subject Stage Uniqueness Deployment Report

Date: 2026-11-05

## Scope

- Application commit: `fafc1c5` (`fix(academics): scope subject codes by stage`)
- Production release: `/opt/kilimanjaro/releases/fafc1c5-20261105T142100Z`
- Frontend rollback copy: `/var/www/kilimanjaro-manage.backup-fafc1c5-20261105T142900Z`

## Cause

`academics.Subject.code` had a database-wide unique constraint. Subjects are
stage-specific, so creating an O-Level subject such as Biology with code `BIO`
failed when the same code already existed for A-Level. The API exposed the raw
Prisma uniqueness failure as an internal server error.

Subjects remain a shared curriculum catalogue. School separation continues at
the class-subject assignment layer, where `ClassSubject.schoolId` scopes each
assignment to a school. This avoids duplicating an identical stage curriculum
for every school.

## Changes

- Replaced global subject-code uniqueness with uniqueness by code and education stage.
- Kept stage-neutral legacy subject codes unique through a partial index.
- Normalized subject names and codes before create/update operations.
- Added clear HTTP 409 responses for real same-stage duplicates.
- Updated A-Level combination seeding to match subjects within A-Level only.
- Clarified the shared-catalogue behavior on the Subject Management page.
- Added regression tests for cross-stage reuse, same-stage conflicts, and concurrent conflicts.

## Production Data Review

- Kilimanjaro Nursery School has Baby Class A/B, KG 1 A/B, and KG 2 A/B.
- Kilimanjaro Islamic High School has Form 5 A and Form 6 A.
- Kilimanjaro Islamic secondary School has nine Form 1-4 classes.
- Existing subjects before migration: 36.
- Stage-neutral subjects: 0.
- Duplicate code/stage groups before migration: 0.
- Existing subject and class-subject records were not rewritten.

Teaching staff available for future assignment:

- Kilimanjaro Nursery School: 11 teachers.
- Kilimanjaro Islamic High School: 4 teachers.
- Kilimanjaro Islamic secondary School: 25 teachers.

These schools currently have zero class-subject assignments. Administrators
must assign catalogue subjects and teachers to their classes after selecting or
creating the required stage subjects.

## Backup And Migration

- Backup: `/opt/kilimanjaro/storage/backups/pre-subject-stage-uniqueness-20261105T142059Z.dump`
- Size: 1,371,879 bytes
- SHA-256: `8bc12605b0057d5ee99c76c1feb3e3de1d1c0e43b103351d5d396d6a07e87b19`
- `pg_restore --list` validation passed before migration.
- Applied only `20261105143000_subject_code_per_stage/migration.sql` because the production database has shared cross-service Prisma migration history.

## Verification

- Focused subject tests: 3 passed.
- Complete academic service tests: 51 passed; integration-only suite skipped by design.
- Academic service production build: passed.
- Dashboard TypeScript check: passed.
- Dashboard production build: passed.
- Transactional database test accepted the same code across Primary and O-Level.
- The same transaction blocked a duplicate within O-Level and rolled back to zero test rows.
- Deployed service runtime test created the same temporary code in O-Level and A-Level.
- Deployed service returned HTTP 409 for the repeated O-Level code.
- Runtime test subjects were deleted; remaining verification subject count is zero.
- Public gateway health reports all downstream services reachable.
- All eight PM2 services are online.
- Production frontend serves `assets/index-D8PMBu15.js`.
- Release-name scan found no Codex, ChatGPT, OpenAI, or `.claude` metadata paths.

## Operational Flow

1. Open Subject Management and create any missing subject for its education stage.
2. If the same code exists in another stage, creation is now allowed.
3. If it already exists in the selected stage, use the existing subject shown in the catalogue.
4. Open the relevant class and assign the subject to an active teacher from that school.

