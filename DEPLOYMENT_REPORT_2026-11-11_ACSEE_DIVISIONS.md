# ACSEE Division Calculation Deployment Report

Date: 2026-11-11

## Requested behavior

- Calculate A-Level divisions from the best three principal subjects in the student's assigned combination.
- Use canonical ACSEE grade points: A=1, B=2, C=3, D=4, E=5, S=6, F=7.
- Apply Division I (3-9), II (10-12), III (13-17), IV (18-19), and Division 0 (20+).
- Exclude General Studies and other subsidiary subjects from division points.
- Do not calculate an A-Level division when the student has no valid principal combination.

## Implementation

- Corrected the shared result engine and added exact boundary tests for all five division outcomes.
- Removed the legacy reversed-points calculation and the two-pass override that made Division IV unreachable.
- Made A-Level scale points canonical on scale creation and editing.
- Added a data migration that normalizes existing A-Level grade points and pass flags without changing marks or score boundaries.
- Require at least three principal subjects plus the compulsory subsidiary when creating combinations.
- Added a structured readiness blocker for A-Level students without a combination.
- Added combination assignment to the A-Level class roster for selected students.
- Made bulk combination reassignment atomic and deactivate previous combination enrollments before activating the replacement.

## Local verification

- Focused backend tests: 42 passed, 0 failed.
- Full academic-service tests: 93 passed, 25 skipped, 0 failed.
- Dashboard TypeScript check: passed.
- Dashboard production build: passed.
- Academic-service production build: passed.
- Migration SQL execution against the local database: passed.
- Local gateway health: all services reachable.

## Production pre-deployment state

- Active release: `/opt/kilimanjaro/releases/aec12b9-20261111T101500Z`.
- All eight PM2 services were online and the public gateway health check passed.
- Backup: `/opt/kilimanjaro/backups/kilimanjaro-pre-acsee-20261111T112707Z.dump`.
- Backup SHA-256: `a069c703bbb9e95fc74bbf31c28da683162364314809d3f4f596592d77f2ff9f`.
- Backup size: 2.7 MB.
- Marks: 6,639.
- Exam-window results: 451.
- Exam-window result fingerprint: `e2160a2d6b611ea4c2ad35321b851a9a`.
- A-Level term results: 0.
- Active A-Level combinations: 0.
- Active combination enrollments: 0.
- Existing A-Level scale had canonical A-S points but an incorrect F=0/pass flag; the migration corrects F to 7/non-passing.

## Data safety decision

No production student combination will be guessed from class names, streams, or marks. Existing marks and calculated window results will remain untouched during deployment. Administrators must seed/create the actual combinations and assign them from each A-Level class roster; readiness then permits calculation.

## Production deployment result

- Git commit: `1bb0247` (`fix: correct ACSEE divisions and combinations`).
- Active release: `/opt/kilimanjaro/releases/1bb0247-20261111T113000Z`.
- Previous release retained for rollback: `/opt/kilimanjaro/releases/aec12b9-20261111T101500Z`.
- Frontend backup: `/opt/kilimanjaro/backups/frontend_pre_1bb0247-20261111T113000Z_20261111T112930Z.tar.gz`.
- Migration `20261111120000_normalize_acsee_division_points` applied successfully; Prisma reports the production schema is current.
- A-Level boundaries after migration: A=1/pass, B=2/pass, C=3/pass, D=4/pass, E=5/pass, S=6/non-pass, F=7/non-pass.
- Live engine checks passed: AAA=3/I, ABF=10/II, AEF=13/III, DFF=18/IV, SFF=20/0.
- General Studies was excluded from the live division fixtures.
- Live A-Level readiness returned `A_LEVEL_COMBINATION_MISSING` for 7 students and did not permit closing the window.
- The live dashboard bundle contains the A-Level combination assignment control.
- Exam-window results remained at 451 and their fingerprint remained `e2160a2d6b611ea4c2ad35321b851a9a`.
- Marks increased from 6,639 to 6,656 while the deployment ran because users were concurrently entering results. The migration does not update the marks table, and no mark was overwritten by this deployment.
- All eight PM2 services are online; public gateway health reports all dependent services reachable.
- The notification service continues to report the pre-existing warning that Firebase credentials are absent, so push notifications remain disabled. This is unrelated to ACSEE result calculation.
