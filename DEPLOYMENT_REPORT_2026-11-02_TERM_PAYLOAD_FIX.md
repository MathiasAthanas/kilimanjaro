# Term Creation Payload Fix Deployment Report

## Incoming Change

- Source commit: `760ff8b1da4de0f07defdc2f699012a76a8f9715`
- Author: BenStance
- Change: remove the unsupported `termNumber` field from the term creation request and sort displayed terms by start date.
- Added test: `dashboard/src/features/admin/utils/termPayload.test.ts`.

## Contract Review

The student-service `CreateTermDto` accepts:

- `academicYearId`
- `name`
- `startDate`
- `endDate`
- optional `isCurrent`

It does not accept `termNumber`. The incoming change therefore aligns the dashboard payload with backend validation and removes the cause of failed term creation requests.

## Local Verification

- Fast-forward pull completed without conflicts.
- Dashboard tests: 22 files, 137 tests passed.
- Production dashboard build: passed.
- Production API target: `https://srms.kilimanjaroschools.site/api/v1`.
- Untracked `KLM TEST RESULTS.docx` was not modified.

## Production Deployment

- Deployment type: frontend only.
- No database migration or database write was required.
- Frontend archive SHA-256: `97B122A6200C3A6AA05A30ACEAA94D1A254006B70D56A29EBD5E64674657A030`.
- Rollback backup: `/opt/kilimanjaro/storage/backups/kilimanjaro-frontend-pre-term-payload-fix-20261102T194239Z.tar.gz`.
- Nginx configuration validation passed before reload.
- Temporary server deployment archive was removed.

## Production Verification

- Dashboard URL responded successfully.
- Deployed asset: `assets/index-DVUkrsto.js`.
- Term management code is present in the deployed asset.
- Gateway health: `ok`.
- Auth, student, academic, finance, notification, and analytics dependencies: reachable.
