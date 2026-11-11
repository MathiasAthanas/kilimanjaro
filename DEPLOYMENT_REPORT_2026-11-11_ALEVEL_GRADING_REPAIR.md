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
