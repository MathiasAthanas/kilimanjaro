# A-Level Merit and Durable Bulk Report Deployment

Date: 2026-11-11

## Scope

- Show each A-Level student's assigned combination on the merit list.
- Show division and points together, for example `Div I - 5 pts`.
- Include combination and division points in Excel, CSV, and PDF merit exports.
- Prepare large combined PDFs and ZIP archives as persistent background jobs.
- Show preparation stage, percentage, processed-card count, reconnect status, safe retry, and artifact expiry in the dashboard.
- Resume interrupted server preparation after an academic-service restart.
- Keep a completed artifact available for repeated or ranged download for 24 hours.

## Source and verification

- Implementation commit: `5f6c67c` (`feat: persist bulk report preparation`).
- Pushed to `origin/main` before production deployment.
- Local academic focused tests: 4 passed.
- Local dashboard focused tests: 12 passed.
- Local API gateway, academic service, and dashboard builds passed.
- Local ZIP verification produced a valid archive with student-identifiable filenames and HTTP `206` byte-range support.

## Production safety

Production state before deployment:

- Active release: `/opt/kilimanjaro/releases/alevel-combinations-2b12bc8-20261111T154700Z`.
- All eight PM2 applications were online.
- Public frontend and API health endpoints returned HTTP `200`.
- Report cards: 444 total, 444 published.
- Term results: 4,077 with fingerprint `71057a99a82df0bf83d9d017725efef1`.

Rollback backups:

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_bulk_reports_20261111T170442Z.dump`.
- Database SHA-256: `a5edf3a4a7af62f82f8e2ae46511d5e15106e4876ec78a3724cc1ca32e8f6b1c`.
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_bulk_reports_20261111T170442Z.tar.gz`.
- Report-card archive SHA-256: `a63909f3dcd27527e0a8f73720ed13ffcd83ab0fd3ec9767141606c92c9944ce`.
- Frontend: `/opt/kilimanjaro/backups/frontend_pre_bulk-report-jobs-5f6c67c-20261111T171000Z_20261111T170944Z.tar.gz`.

## Deployment

- Active release: `/opt/kilimanjaro/releases/bulk-report-jobs-5f6c67c-20261111T171000Z`.
- Previous release retained for rollback: `/opt/kilimanjaro/releases/alevel-combinations-2b12bc8-20261111T154700Z`.
- Applied migration: `20261111170000_bulk_report_card_jobs`.
- The migration adds only `academics."BulkReportCardJob"` and its indexes. It does not update marks, report cards, students, exam windows, or publication state.
- Backend and dashboard production builds passed.
- PM2 reloaded and saved all eight applications.
- Dashboard asset containing the background progress UI is live.

## Production verification

- Public gateway health is `ok`; auth, student, academic, finance, notification, and analytics services are reachable.
- Public frontend and backend endpoints return HTTP `200`.
- A live A-Level merit read returned 7 rows; all 7 had a combination and division points.
- Example verified output included `HGE: Division I: 5` and `HGL: Division I: 5`.
- A production background job prepared 58 report cards:
  - status `READY`
  - progress `100%`
  - 58 of 58 files processed
  - valid 8,447,932-byte ZIP
  - 58 student-identifiable PDF entries
  - first entry: `Precious Pascal Mshanga - KEMS-P-26503.pdf`
  - byte-range request returned HTTP `206` with exactly 100 bytes
- The verification job, archive, and partial-range file were removed after testing.
- Final background-job count returned to zero.
- Final report-card state remained 444 total and 444 published.
- Final term-result count remained 4,077 with unchanged fingerprint `71057a99a82df0bf83d9d017725efef1`.

## Operational notes

- Dependency installation reported 82 backend and 29 dashboard advisories. No automatic or forced dependency upgrade was run because that could introduce unrelated production regressions.
- The notification service continues to log its existing warning that `FIREBASE_SERVICE_ACCOUNT_JSON` is not configured; FCM push notifications remain disabled. This release did not introduce that condition.
- Temporary release archives and deployment scripts were removed from `/var/tmp`.
- The active release was scanned for `codex`, `openai`, `.claude`, and `.qoder` paths. Two third-party `.claude` metadata directories created inside dashboard dependencies were removed; the final scan is clean.

## Rollback

To roll back application code, point `/opt/kilimanjaro/app` to `/opt/kilimanjaro/releases/alevel-combinations-2b12bc8-20261111T154700Z`, reload `/opt/kilimanjaro/app/backend/ecosystem.config.js` as the `kilimanjaro` user, and restore the frontend backup listed above. The additive job table can remain safely in place because the previous release does not use it.
