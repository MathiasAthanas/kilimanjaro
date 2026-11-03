# Exam Window Class Management Deployment Report

Date: 2026-11-03

Application commit: `82cab78` (`feat(exams): add classes to active windows`)

Production release: `/opt/kilimanjaro/releases/82cab78-20261103T095435Z`

## Cause Confirmed

The live `Annual Exam` window used explicit class scope and contained nine class IDs. Kilimanjaro Primary School has twelve Primary classes for 2026. Class 5 B, Class 6 A and Class 6 B were not selected when the window was created. Each omitted class already has nine active subject assignments.

## Implemented Changes

- Added a visible `Manage classes` action to exam-window details.
- Shows classes as Included or Available and supports multi-selection.
- Filters candidates by the exam window's academic year and education stage.
- Supports safe additions while a window is DRAFT, OPEN or REOPENED.
- Converts the resulting scope to an explicit class list so later class creation cannot silently change a running exam.
- Creates marks sheets for active, non-omitted subjects when classes are added to an open window.
- Performs scope update and marks-sheet creation in one database transaction.
- Never removes existing classes, marks sheets or marks through this operation.
- Requires a CLOSED or PUBLISHED window to be reopened before its class scope can grow.
- Returns clear validation when a class is outside the school/year/stage or has no active subjects.

## Verification

- Focused backend tests: 3 passed.
- Complete dashboard tests: 26 files and 158 tests passed.
- Clean academic-service install and production build passed from commit `82cab78`.
- Dashboard TypeScript and production Vite build passed.
- Production route `POST /api/v1/academics/exam-windows/:id/classes` registered successfully.
- Production dashboard serves `assets/index-CzfNoFvV.js`, which contains the new class-management UI.
- Gateway health reports all downstream services reachable.
- All eight PM2 applications are online.
- Nginx configuration validation passed.
- Release marker scan found no Codex, ChatGPT, OpenAI or `.claude` metadata.

## Data and Migrations

- No schema migration was required or run.
- Deployment did not modify the live exam, classes, assessments or marks.
- The administrator must select and add the omitted classes through `Manage classes`.
- Adding Class 5 B, Class 6 A and Class 6 B will create 27 new marks sheets based on their current subject assignments.

## Rollback

- Previous backend release: `/opt/kilimanjaro/releases/2515683-20261103T091920Z`
- Previous frontend files: `/var/www/kilimanjaro-manage.backup-82cab78-20261103T095435Z`
- Backend activation used the atomic release script with automatic health-check rollback.
