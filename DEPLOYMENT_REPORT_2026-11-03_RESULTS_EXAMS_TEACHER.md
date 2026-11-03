# Production Deployment Report - 2026-11-03

## Scope

- Deployed commit `46428d1` from `main`.
- Included the result calculation engine, student/class exemptions, exam subject omissions, exam lifecycle controls, teacher workspace changes, and lesson topics.
- Added stricter school, class-subject, and student-roster validation for result exemptions before deployment.
- The untracked `KLM TEST RESULTS.docx` was not included or modified.

## Assessment And Tests

- Academic service: 43 tests passed; 25 intentionally skipped.
- Dashboard: 149 tests passed across 24 test files.
- Dashboard TypeScript check passed.
- Dashboard production build passed.
- All eight backend services built successfully on the production Linux host before activation.
- Flutter static analysis passed with no issues.
- Academic lint completed with no errors and four existing warnings.

## Database Backup

- Backup created before migration: `/opt/kilimanjaro/storage/backups/pre-results-exams-teacher-20261103T043919Z.dump`
- Size: `1,216,205` bytes.
- SHA-256: `bd6707c34a3daf799d9acf540f2506b833f4650863065ef30b5c72ce905534d9`
- `pg_restore --list` validation passed.

## Database Migrations

The academic migration ledger did not contain historical academic entries even though their schema changes were already present. Those existing migrations were baselined without executing their SQL. The following missing migrations were then applied successfully:

- `20261014090000_school_scoped_assessment_types`
- `20261103090000_result_calculation_exemptions`
- `20261104100000_exam_subject_exclusions`
- `20261104090000_lesson_topic`

Both the academic and e-learning Prisma migration checks report that the database is up to date.

## Deployment

- Backend release: `/opt/kilimanjaro/releases/46428d1-20261103T074117Z`
- Active backend symlink: `/opt/kilimanjaro/app`
- Previous frontend retained at `/var/www/kilimanjaro-manage.backup-20261103T080500Z`.
- Current frontend bundle: `assets/index-D61dwAjq.js`.
- Nginx configuration validation passed before and after the frontend switch.
- The staged activation script required Windows line-ending normalization before execution. Its first two attempts stopped before changing the active backend; the normalized script then built, activated, and health-checked successfully.

## Production Verification

- All eight PM2 services are online.
- Local gateway health returned `status: ok` with all reported dependencies reachable.
- Public gateway health returned HTTP 200.
- E-learning service health returned `status: ok`.
- Frontend, privacy policy, and account deletion pages returned HTTP 200.
- Authentication and newly added academic routes returned HTTP 401 without a token, confirming routing and access guards.
- The production health-check timer is enabled and active.
- No recent fatal, migration, or Prisma runtime errors were found after activation.
- Deployed source and path scans found no prohibited development-agent metadata; two third-party `.claude` metadata directories installed by dashboard dependencies were removed.

## Data Integrity

Core counts were identical before and after deployment:

| Record | Before | After |
| --- | ---: | ---: |
| Users | 1,750 | 1,750 |
| Students | 1,188 | 1,188 |
| Classes | 38 | 38 |
| Marks | 0 | 0 |
| Report cards | 0 | 0 |

## Residual Maintenance

Dependency audit output remains a separate maintenance concern. The backend currently reports 97 dependency advisories and the dashboard reports 34. No forced dependency upgrade was performed during this production deployment because it would introduce unrelated breaking-change risk. These should be reviewed and upgraded in a dedicated tested change set.
