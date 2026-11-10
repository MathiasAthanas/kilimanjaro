# Report Card Policy and Recalculation Deployment Report

Date: 2026-11-10

## Scope

- Overall Primary intervention now follows the configured overall pass mark instead of requiring every subject to pass.
- Failed subjects remain visible as separate support needs without changing an otherwise promotable overall verdict.
- Exempt subjects are excluded from averages, rankings, and printed report cards.
- IRE and CRE are treated as alternatives: scoring one exempts and hides the unscored counterpart. Scored results in both block composition or recalculation for review.
- Added `Configuration > Report Cards` for school-scoped pass marks, subject-support visibility, exempt-subject display, and controlled recalculation.

## Source and Verification

- Git commit: `51e830e` (`feat(reports): configure intervention and subject exemptions`).
- Academic service build: passed.
- Academic service full test run: 14 suites passed, 74 tests passed, 25 existing tests skipped.
- Focused policy, recalculation, result-engine, PDF, and access tests: passed.
- Dashboard TypeScript check: passed.
- Dashboard production build: passed.

## Backups

- PostgreSQL custom dump: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_report_policy_20261110T145953Z.dump`
- Report-card PDF archive: `/opt/kilimanjaro/backups/report_cards_pre_policy_20261110T145953Z.tar.gz`
- Backup checksums: `/opt/kilimanjaro/backups/report_policy_20261110T145953Z.sha256`
- Both archives passed checksum verification. The database dump passed `pg_restore --list`, and the PDF archive passed `tar -tzf`.

## Migration

- Applied additive migration `20261110143000_report_card_policy`.
- The first Prisma deploy attempt found `20261105143000_subject_code_per_stage` already present in the database but missing from the migration ledger.
- Both expected subject indexes were verified, the obsolete single-code index was absent, and the failed ledger entry was marked rolled back then recorded as applied. The new policy migration then completed successfully.
- No existing table or result data was removed by the migration.

## Deployment

- Backend release: `/opt/kilimanjaro/releases/51e830e-20261110T150220Z`
- Previous backend release: `/opt/kilimanjaro/releases/21b869e-20261110T141000Z`
- Frontend asset: `index-YY-j3d16.js`
- Frontend rollback directory: `/var/www/kilimanjaro-manage.previous-51e830e`
- The tracked atomic activation script built all eight services, switched `/opt/kilimanjaro/app`, reloaded PM2, and passed its health check.

## Safe Recalculation

Preflight preview for Term 3, 2026 at Kilimanjaro Primary School:

- 444 report cards
- 444 published cards
- 10 classes
- 420 unscored IRE/CRE counterpart rows eligible for exemption
- 0 students with scored results in both alternatives

Result:

- 444 report cards regenerated
- 444 published states preserved
- 420 counterpart rows changed to `EXEMPT`
- 0 valid scored rows changed

The scored-result fingerprint remained identical before and after recalculation:

- Count: 3,565
- Weighted-total sum: 267,936
- Fingerprint: `8192a05ca0ba68c3b498fbf3a8509705`

## Sample Verification

The previously incorrect sample changed from:

- Average 87.56%, grade A, 1 failing subject, `Needs intervention`

to:

- Average 98.5%, grade A, 0 failing counted subjects, 1 exempt subject, `Promotable`
- IRE remained scored at 88.
- CRE became exempt and is absent from the generated PDF.
- The PDF is a clean one-page official report card and remains published.

## Final Health

- All eight PM2 services: online.
- Gateway health: `ok`; auth, students, academics, finance, notifications, and analytics reachable.
- Public backend health: HTTP 200.
- Public report-card configuration route: HTTP 200.
- Primary verdict consistency check: 0 above-pass-mark intervention cards and 0 below-pass-mark promotable cards.
- Production still contains 444 report-card PDFs.

## Rollback

- Backend: point `/opt/kilimanjaro/app` to `/opt/kilimanjaro/releases/21b869e-20261110T141000Z` and reload the saved PM2 applications as the `kilimanjaro` user.
- Frontend: restore `/var/www/kilimanjaro-manage.previous-51e830e` to `/var/www/kilimanjaro-manage`.
- Data: restore the PostgreSQL dump only if the policy table or recalculated exemption state must be reverted. Restore the PDF archive to recover the exact pre-recalculation documents.
