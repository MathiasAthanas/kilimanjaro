# Production Deployment Report: Report-Card Division Points

Date: 2026-11-12  
Commit: `74716e3`  
Active release: `/opt/kilimanjaro/releases/report-card-points-74716e3-20261112T130100Z`

## Problem

O-Level report cards correctly stored both the division and its points, but the prominent summary displayed only the division. The verified Form 1 B example stored `Division I` with `10` points while its PDF showed only `DIVISION I`.

## Implementation

- Updated the report-card PDF summary to render division and points together.
- The example now displays `DIVISION I - 10 PTS`.
- Added a focused PDF-generation test covering O-Level term reports.
- No grading, division calculation, ranking, or publication logic was changed.

## Verification

- Focused PDF tests: 9 passed.
- Academic service production build passed.
- Dashboard production build passed.
- Production migration check found no pending migrations.
- All eight PM2 services are online.
- Public API health reports all dependencies reachable.
- Production dashboard returns HTTP 200.
- The regenerated production PDF was extracted and visually inspected; the points are visible and not clipped.

## Production Backup

Created immediately before deployment:

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_report_card_lifecycle_20261112T130036Z.dump`
- Database SHA-256: `cb313593486bdc977c683404b3654bd114c091632116e4ae16b9f4e1f895d10a`
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_report_card_lifecycle_20261112T130036Z.tar.gz`
- Report-card SHA-256: `1ec4b2b4d99403ddbc1d9dfdb4faf30e57df484498f14eb495648ebe38f3339c`
- State record: `/opt/kilimanjaro/backups/pre_report_card_lifecycle_20261112T130036Z.txt`

## Controlled PDF Regeneration

Only the 17 Form 1 B report-card PDFs for Term 2 were regenerated to apply the display correction.

- Published cards before: 17.
- Published cards after: 17.
- Report-card calculation fingerprint before and after: `c4a3854c4e7356cb70380f0686be30fe`.
- Term-result fingerprint before and after: `fbb80c4c2596e5188ecca099e9425d6f`.
- Existing marks, averages, grades, stream positions, overall positions, divisions, and publication states were preserved.
- The inspected card remains `68.8%`, grade `B`, stream position `1 / 17`, overall position `17 / 56`, and now visibly shows `DIVISION I - 10 PTS`.

