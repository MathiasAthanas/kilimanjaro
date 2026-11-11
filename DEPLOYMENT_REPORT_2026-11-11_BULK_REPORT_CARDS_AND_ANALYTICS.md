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

Pending deployment.
