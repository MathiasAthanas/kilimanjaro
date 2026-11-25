# Production Deployment Report: admin analytics, report preview dialog, working report exports

Date: 2026-11-25
Commit: `49d36bc` (merge of BenStance's `2a05c42` with the report export fixes `fdb2198`)
Release: `/opt/kilimanjaro/releases/admin-analytics-reports-49d36bc-20261125T084456Z` (active)
Previous release (rollback target): `/opt/kilimanjaro/releases/principal-finance-rules-500295e-20261124T073123Z`

No database migration. Backups: `kilimanjaro_prod_pre_admin_analytics_20261125T084456Z.dump` (SHA-256 `5c971aa5756ec9f0e37397c8dda7d3d391dadc5b59a2a5e57cb090d0b59ae7a9`) and `frontend_pre_admin_analytics_20261125T084456Z.tar.gz` (`b7c84e8ba6fc834c343b2cf4cf4794d47b648816fa014b1b11cb00e65c1cc242`), both in `/opt/kilimanjaro/backups`.

## Change
- Admin control centre charts, with three new read-only endpoints (auth `/auth/internal/dashboard-analytics`, student `/students/admin/dashboard-analytics`, gateway `/ui/admin/dashboard/analytics`). Counts and distributions only, no personal data.
- Student profile now returns full enrolment, residence change and dormitory history (student lifecycle panel).
- New executive charts on the Finance, Manager and Principal pages.
- Report pages (AQA, HOD, Finance, Operations export centre) open a filter and preview step before download.
- Report exports from the earlier fix: no blank pages, real tables, and PDF, Excel and CSV downloads that work.

Merge notes: conflicts were in the AQA, HOD and Operations export pages. The real server-side export was kept and wrapped in the preview dialog. The dialog gained a `formats` option, an `emptyMessage` for reports with no live preview data, and safe display of nested values. The search and date filters narrow the preview only; they do not change the downloaded file.

## Tests run before deploying
- Dashboard: `tsc -b`, 219 tests, production build.
- Backend unit tests: gateway 26, student 45, analytics 16 pass. Auth has 8 failures in the live-gateway integration suite that need demo accounts (known, predates this work).
- Browser check on the local dashboard: the AQA export page, the preview dialog, the PDF/XLSX/CSV buttons and the "preview not available" message.

## Verification on production
All eight services online (restart count 12 each, from the reload), gateway health reports every dependency reachable, dashboard 200 on `index-DEewu3Xl.js`, new analytics code present in the compiled auth, student and gateway services, no fresh errors in the gateway, auth or student logs, row counts unchanged (students 1209, invoices 1025).

## Not checked on production
No production login, so the new admin charts and the export dialog were not clicked through there. The admin analytics page could not be checked locally either, because the local gateway is still the old build.

## Rollback
Point `/opt/kilimanjaro/app` at the previous release and `pm2 startOrReload`; restore the dashboard from the backup archive.
