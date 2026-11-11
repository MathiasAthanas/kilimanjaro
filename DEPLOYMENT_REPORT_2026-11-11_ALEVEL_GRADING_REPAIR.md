# A-Level Grading Repair

Date: 2026-11-11

## Reported issue

Four Form 5 students in the closed Terminal Exam were shown as `Ungraded` even though each student had an assigned subject combination and entered marks.

## Root cause

- EGM referenced the catalogue subject `Advanced Mathematics`, while the exam used a separate duplicate record named `Advance Mathematics`. Different subject IDs meant the entered Mathematics mark was not recognized as an EGM principal result.
- HGL was incorrectly predefined with `Literature in English`. NECTA defines HGL as History, Geography and English Language.
- Legacy A-Level subjects were all marked compulsory. The calculation therefore included unrelated subjects from other combinations and treated their missing marks as `NOT_SAT` zeroes.
- Calculation did not block when an assigned combination had fewer than three principal subjects represented in the exam window.

Official reference: [NECTA ACSEE subject combinations](https://necta.go.tz/pages/acsee).

## Implementation

- Make an assigned A-Level combination authoritative for expected subjects; unrelated legacy `isCompulsory` flags no longer add other combinations' subjects.
- Correct predefined HGL and HKL templates to use English Language.
- Add calculation/readiness validation that identifies the student, combination and missing principal subject and blocks closing instead of silently generating `Ungraded`.
- Preserve the existing rule that approved exemptions can legitimately leave a student ungraded when fewer than three eligible principals remain.

## Verification before deployment

- Focused engine, calculator and combination tests: 44 passed.
- Full academic-service suite: 101 passed, 25 skipped, 0 failed.
- Academic-service TypeScript check: passed.

## Production repair plan

1. Back up the complete production database.
2. Repoint the two existing Advanced Mathematics class-subject and assessment records to the canonical subject ID; marks remain linked to the same assessments and class-subject records.
3. Replace Literature in English with English Language in existing HGL/HKL definitions and their student enrollments.
4. Recalculate only the affected closed Terminal Exam through the supported API.
5. Confirm all seven students receive divisions, unrelated subjects no longer affect averages, mark counts are unchanged, and service health remains OK.

## Production result

- Git commit: `2b12bc8` (`fix: enforce A-Level combination subjects`).
- Active release: `/opt/kilimanjaro/releases/alevel-combinations-2b12bc8-20261111T154700Z`.
- Full database backup: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_alevel_repair_20261111T154112Z.dump`.
- Database backup SHA-256: `122e2c8802b9d3b368f1079dc22727d75bc75ed07a406b84d93a65d77d68cc3b`.
- Focused pre-repair snapshot: `/opt/kilimanjaro/backups/alevel_terminal_pre_repair_20261111T154112Z.txt`.
- Snapshot SHA-256: `95fa1d79bf9a0853a76f600a3c1ee441d25e7dcfb96c2390514a2347209bd806`.
- Production backend and dashboard builds passed; no migrations were pending.
- Two class-subject records and two assessments were remapped to canonical Advanced Mathematics.
- Two HGL/HKL definitions and five associated enrollments were remapped to English Language.
- The affected closed Terminal Exam was recalculated through `POST /academics/exam-windows/:id/compute` without reopening or changing marks.
- Readiness after repair: 7 students, 21 expected principal results, 20 scored, 1 explicit `NOT_SAT`, 0 missing, 0 exemptions, 0 scale issues and 0 combination issues.
- Final results: 0 ungraded; five Division I, one Division II and one Division III.
- Mark integrity remained exactly 70 rows with unchanged fingerprint `17030b755ca4ff0519c23eddfa21d8ad`.
- Derived result scope is exactly 21 subject rows (three principals per student).
- All eight PM2 services remained online; public health passed and no new academic-service or gateway errors were logged.
