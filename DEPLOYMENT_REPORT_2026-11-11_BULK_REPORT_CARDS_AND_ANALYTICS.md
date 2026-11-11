# Deployment Report: Bulk Report Cards and Teacher Grade Analytics

Date: 2026-11-11

## Scope

- Add school-scoped bulk report-card downloads for one class or one class level across all streams.
- Produce either one combined PDF or a ZIP containing the existing individual PDFs.
- Preserve individual student PDF downloads.
- Show the exam label, stream position, and whole-level position on report cards.
- Show published grade counts per subject in teacher analytics, excluding exempt results.

## Data Safety

- The database migration is additive. It adds nullable `examLabel`, `overallRank`, and `totalStudentsInLevel` columns plus an index.
- No student, mark, result, class, publication, or account record is deleted.
- Existing marks and publication state will be fingerprinted before and after recalculation.
- Bulk downloads require an explicitly selected school and only include published cards from that school, term, exam, and class scope.

## Local Verification

- Academic service build: passed.
- Academic service tests: 77 passed, 25 skipped integration cases, 0 failed.
- Dashboard type-check and production build: passed.
- Dashboard tests: 158 passed, 0 failed.
- Exact-class bulk test: combined PDF and ZIP generated from 8 published cards.
- All-stream level test: combined PDF and ZIP generated from 16 published cards across two streams.
- Teacher analytics test: real endpoint returned subject grade counts from published results.
- PDF visual review: exam label and both positions are readable and the representative Primary card remains one page.

## Production Procedure

1. Record current release, service health, report-card counts, publication counts, and valid-score fingerprint.
2. Back up the PostgreSQL database and persistent report-card PDF directory with checksums.
3. Deploy the committed source as a new immutable release.
4. Run Prisma migrations before activating the release.
5. Build and activate backend services and dashboard assets.
6. Recalculate existing report cards for the production term to populate exam and overall-position metadata.
7. Confirm publication counts and valid-score fingerprint are unchanged.
8. Test individual, exact-class PDF/ZIP, and all-stream PDF/ZIP downloads in production.
9. Record final release, asset, service health, and verification results below.

## Production Result

### Release

- Runtime commit: `aec12b9` (`feat(reports): add bulk cards and grade analytics`).
- Active release: `/opt/kilimanjaro/releases/aec12b9-20261111T101500Z`.
- Dashboard asset: `assets/index-DboEO6Ls.js`.
- Migration `20261111100000_report_card_exam_and_level_positions` completed at `2026-11-11 10:18:06 UTC`.

### Backups

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_bulk_reports_20261111T101309Z.dump`.
- Database SHA-256: `2b6e10d94ea81dc6e4afc8fde10b8b6b2208b2245d42afa067cf0eac8393d4e6`.
- Report-card PDFs: `/opt/kilimanjaro/backups/report_cards_pre_bulk_reports_20261111T101309Z.tar.gz`.
- PDF archive SHA-256: `421bf93ff0084d253d590859babc27e276d4e9c18b5466eabf65bd3478f90133`.
- Frontend rollback archive: `/opt/kilimanjaro/backups/frontend_pre_aec12b9-20261111T101500Z_20261111T101439Z.tar.gz`.

### Recalculation Safety

- Recalculated: 444 report cards across 10 classes.
- Publication state: 444 published before and 444 published after.
- Exam label: `Annual Exam` populated on all 444 cards.
- Stream and whole-level ranks: populated on all 444 cards.
- Alternative-subject changes: 0 rows.
- Term results: 4,077 before and after.
- Term-result fingerprint before and after: `71057a99a82df0bf83d9d017725efef1`.

### Live Functional Verification

- Class 1 A combined PDF: 37 cards and 37 pages.
- Class 1 A ZIP: 37 individual PDFs.
- Class 1 across all streams combined PDF: 74 cards and 74 pages.
- Class 1 across all streams ZIP: 74 individual PDFs.
- Existing individual download: valid one-page PDF returned.
- Teacher grade analytics: 6 graded courses returned for a live teacher; sample French distribution was A 41, B 13, C 2, D 1, F 1 (58 total).
- Gateway health: `ok`; auth, students, academics, finance, notifications, and analytics reachable.
- PM2: all eight services online.
- Dashboard: HTTP 200.
- Nginx configuration test: passed.
- No new service error entries were produced by deployment, recalculation, or download verification.
