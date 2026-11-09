# Report Card Redesign Deployment Report

Date: 2026-11-09

## Scope

Deploy the redesigned academic report-card PDF while preserving all result-calculation, grading, ranking, exemption, publication, and persistence logic.

## Delivered Changes

- Added the existing Kilimanjaro Schools badge to generated report cards.
- Added stage-specific Primary, O-Level, CSEE, A-Level, and ACSEE layouts.
- Added responsive table density and multi-page continuation handling.
- Added student identity, term, class, position, summary, comments, signature, and official-document sections.
- Added readable visual treatment for failed, absent, not-sat, and exempt outcomes.
- Added deterministic footer and page numbering.
- Added compiled asset packaging for the report-card logo.
- Added regression coverage for all templates, empty results, long subject lists, and single-page Primary cards.

The change does not alter marks, averages, grades, points, rankings, exemptions, report-card database records, or publication rules.

## Source Control

- Commit: `e4c2848` (`feat(reports): redesign academic report cards`).
- Only the PDF renderer, its tests, its logo asset, and Nest asset-copy configuration were committed.
- Unrelated local service and throttling changes were not included.

## Verification

- Focused report-card tests: 7 passed, 0 failed.
- Full academic-service suite: 62 passed, 25 skipped, 0 failed.
- Academic-service production build: passed.
- Compiled logo asset verification: passed.
- Staged-release build from the committed source: passed.

## Production-Snapshot Test

A fresh production backup was restored to a temporary database. The staged academic service used isolated Redis, a disabled RabbitMQ endpoint, and a temporary PDF directory.

- Live snapshot window status: `PUBLISHED`.
- Calculated students available in the snapshot: 444.
- Class tested: Class 2 A.
- Students composed: 42.
- Term-result rows written to the clone: 378.
- PDFs generated: 42.
- Generation warnings: 0.
- Published during verification: no.

The same Ian John report used in the previous verification was regenerated. The new card contains nine subject outcomes, including the current Islamic Religious Education `NOT SAT` result, an overall average of 78.9%, grade B, and position 7 of 42.

Visual verification confirmed one clean A4 page with no clipping, overlap, blank extra page, or missing logo.

- Local sample: `output/pdf/verified-redesigned-report-card-ian-john.pdf`.
- Sample SHA-256: `00A8A41A18DFFE217D756433B3A18E569B8F0930781FAC5202E4EF02CEDC46D6`.

## Backup

- File: `/opt/kilimanjaro/storage/backups/pre-report-card-redesign-20261109T144456Z.dump`.
- Size: 2,020,427 bytes.
- SHA-256: `49a30488f7f6540e6471d508997f251d6db7c285ea0d36d2921a16621516f1b0`.
- `pg_restore --list` validation: passed.

## Production Deployment

- Active release: `/opt/kilimanjaro/releases/e4c2848-20261109T145000Z`.
- Database migrations: none required or executed.
- PM2: all eight services online.
- Public gateway health: healthy; all reported dependencies reachable.
- Compiled production logo asset: present, 138,135 bytes.

## Production Data Safety

No report-card composition or generation request was sent to production during verification.

Post-deployment read-only checks confirmed:

- Annual Exam status remains `PUBLISHED`.
- Exam scope remains 12 classes.
- Calculated window results remain 444.
- Production report-card count remains 0.

The temporary service and Redis instance were stopped, the cloned database was dropped, and temporary server PDF files were removed.
