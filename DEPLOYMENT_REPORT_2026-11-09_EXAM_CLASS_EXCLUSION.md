# Exam Window Class Exclusion Deployment Report

Date: 2026-11-09

## Requested change

Allow an administrator to remove one or more classes from an active exam window when those classes did not sit the exam. The operation must not delete the school class, enrolments, students, guardians, or login accounts.

## Implementation

- Added an impact-preview API that reports the affected classes, marks sheets, entered marks, and calculated results.
- Added an audited exclusion API for DRAFT, OPEN, and REOPENED exam windows.
- Prevented exclusion of every class in a window.
- Required an explicit entered-mark discard confirmation when marks exist.
- Added a serializable transaction and assessment row locks to prevent concurrent mark entry from being silently discarded.
- Converted the exam scope to an explicit list of the remaining classes.
- Removed only exam-window assessments, their marks, and calculated results for the selected classes.
- Published an `exam.window.classes.excluded` event and invalidated exam caches after commit.
- Added a dashboard flow for class selection, impact review, reason capture, typed confirmation, and entered-mark confirmation.
- Preserved the existing add-class flow so an excluded class can be added back later.

## Data and migration impact

- No schema or database migration is required.
- Deployment does not automatically exclude any production class.
- Production exam data changes only when an authorized administrator completes the new confirmation flow.

## Local verification

- Academic service build: passed.
- Academic service full Jest suite: 55 passed, 25 skipped, 0 failed.
- Exam-window add/exclude regression tests: 7 passed, 0 failed.
- Dashboard TypeScript check: passed.
- Dashboard exam Vitest suite: 7 passed, 0 failed.
- Dashboard production Vite build: passed.

## Production deployment

Status: deployed and verified.

### Backup and rollback

- Database backup: `/opt/kilimanjaro/storage/backups/pre-exam-class-exclusion-20261109T101900Z.dump`
- Backup size: 1,698,839 bytes
- Backup SHA-256: `7525862b0e71c2391c43cab599a9d994ccf58134ef1319855957d7e8e5a6f794`
- `pg_restore --list` validation: passed
- New backend release: `/opt/kilimanjaro/releases/a57d5be-20261109T102000Z`
- Backend rollback release: `/opt/kilimanjaro/releases/fafc1c5-20261105T142100Z`
- Frontend rollback copy: `/var/www/kilimanjaro-manage.backup-a57d5be-20261109T102700Z`
- Production frontend bundle: `assets/index-DFBCrYyj.js`

### Deployment notes

- No database migrations existed between the old and new application commits.
- The checked-in activation script had Windows CRLF line endings. The first two invocations stopped before dependency installation, build, release switching, or service restart. A byte-normalized temporary copy was then used successfully.
- The first dashboard build invocation used a `runuser` login shell that resolved its working directory to `/root`, so `npm ci` stopped before building. The existing frontend remained in service. The dashboard was then built explicitly from the release directory, verified, and published.
- Nginx configuration validation passed before reload.
- The release filename scan found no Codex, ChatGPT, OpenAI, or Claude metadata files.

### Production verification

- Public gateway health: `status: ok`; auth, students, academics, finance, notifications, and analytics reachable.
- PM2: all eight services online after reload.
- Public dashboard: HTTP 200 and serving `index-DFBCrYyj.js`.
- Academic service mapped both new routes:
  - `POST /api/v1/academics/exam-windows/:id/classes/exclusion-preview`
  - `POST /api/v1/academics/exam-windows/:id/classes/exclude`
- A read-only production preview for Primary Annual Exam, Class 4 A and Class 4 B returned:
  - 2 selected classes
  - 0 marks sheets
  - 0 entered marks
  - 0 calculated results
  - confirmation text `EXCLUDE 2 CLASSES`
- No exclusion was executed during deployment verification.
- Database verification after the preview confirmed the exam scope still contains 12 classes, including Class 4 A and Class 4 B.
- Database verification confirmed zero `EXAM_WINDOW_CLASSES_EXCLUDED` audit records.
- Academic error log had no new entry after 2026-11-05; gateway error log had no new entry after 2026-10-23.

### Dependency audit follow-up

The locked dependency trees currently report known vulnerabilities during clean installation:

- Backend: 82 total (7 low, 42 moderate, 28 high, 5 critical).
- Dashboard: 29 total (1 low, 11 moderate, 14 high, 3 critical).

No automatic `npm audit fix --force` was run because it can introduce breaking dependency upgrades. This is pre-existing dependency-maintenance work and should be handled in a separate reviewed change with full regression testing.
