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

Status: pending backup and release deployment.

The production backup path, release identifier, service health checks, and read-only endpoint verification will be recorded here after deployment.
