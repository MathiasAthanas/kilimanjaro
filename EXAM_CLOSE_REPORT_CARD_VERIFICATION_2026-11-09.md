# Exam Close and Report Card Verification

Date: 2026-11-09

## Scope

Verify the Primary Annual Exam class-exclusion, readiness, close-and-calculate, and report-card generation workflow without changing production data.

## Production Safety

- Production backup used for the isolated test: `/opt/kilimanjaro/storage/backups/pre-exam-class-exclusion-20261109T101900Z.dump`.
- Backup SHA-256: `7525862b0e71c2391c43cab599a9d994ccf58134ef1319855957d7e8e5a6f794`.
- The backup was restored to a temporary PostgreSQL database.
- The temporary academic service used an isolated Redis instance and a disabled RabbitMQ endpoint.
- Production student data was accessed only through read-only profile and roster requests needed to render the sample.
- No close, exclusion, exemption, calculation, composition, or publication request was sent to the production academic service.

## Isolated End-to-End Result

The temporary database started as a current production snapshot.

1. Class 4 A and Class 4 B were excluded from the cloned exam window only.
2. Remaining incomplete class-subject combinations received test-only class exemptions so the clone could exercise the close endpoint.
3. Readiness passed with 444 students, 4,077 expected outcomes, and zero missing outcomes.
4. The real close endpoint returned HTTP 201.
5. The cloned window moved from `OPEN` to `CLOSED`.
6. Calculation wrote 444 `ExamWindowResult` records.
7. Draft composition for Class 2 A returned HTTP 201.
8. Composition processed 42 students and wrote 378 term-result rows.
9. It generated 42 report-card PDFs with zero warnings.
10. `publish` remained `false`, so the verification did not test or expose published cards.

## PDF Verification and Fix

The first visual test found that the footer caused an otherwise blank second page. The footer was moved inside PDFKit's printable area and made non-wrapping.

- Regression test: passed.
- Full academic-service suite: 56 passed, 25 skipped, 0 failed.
- Academic-service production build: passed.
- Retest composition: 42 PDFs generated with zero warnings.
- Sample PDF: one A4 page, visually inspected with no clipping or overlap.
- Sample: `output/pdf/verified-sample-report-card-class-2a.pdf`.
- Sample SHA-256: `EB1FA17DB6585F1B935AF7DA176AC9B2461A9AA40123BFBEE2A3B00F3130475C`.

## Deployment

- Git commit: `f6edc58` (`fix(reports): keep report card footer on page`).
- Active backend release: `/opt/kilimanjaro/releases/f6edc58-20261109T105800Z`.
- No database migration was required or executed.
- All eight PM2 services are online.
- Public gateway health is `ok`, with all reported dependencies reachable.

## Production Remains Unchanged

Post-deployment read-only database verification confirmed:

- Live window status: `OPEN`.
- Live scope: 12 classes.
- Class 4 A and Class 4 B are still included.
- Live calculated window results: 0.
- Live report cards: 0.
- Live class-exclusion audit records: 0.

The temporary academic service and Redis instance were stopped, the temporary database was dropped, and temporary server files were removed.

## Current Live Blocker

The workflow is functional, but the live window cannot safely close yet. The latest production readiness check reports:

- Students: 444.
- Expected outcomes: 4,077.
- Scored: 3,439.
- Absent: 22.
- Not sat: 430.
- Missing: 186.
- Exempt: 0.

The current first blocker is a missing Islamic Religious Education result for Aleena Iddi Mohammed, followed by 185 other missing outcomes. Each missing outcome must receive a score, `ABSENT`, `NOT SAT`, or an approved exemption. Classes that did not sit the exam can instead be removed using the new class-exclusion workflow.

Do not close the production window by bypassing readiness. Once readiness shows zero missing outcomes, the tested close-and-calculate and draft report-card composition sequence is safe to use.
