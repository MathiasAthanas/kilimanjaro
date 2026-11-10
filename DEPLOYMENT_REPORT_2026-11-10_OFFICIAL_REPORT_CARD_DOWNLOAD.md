# Official Report Card Download Deployment Report

Date: 2026-11-10

## Incident

The Report Card Generation Center listed the correct 444 published cards, but its download button generated a separate Analytics PDF. That document did not use the approved composed report-card template.

Verification also found that the 444 official PDFs had been written inside the release directory that generated them. The next backend release therefore could not find them. A direct verification request exposed this as an `ENOENT` stream error and PM2 restarted the academic service once.

## Resolution

- Changed the dashboard download action to request the official composed report card from the academic service.
- Removed the second Analytics report-generation step from this workflow.
- Added a readable-file check before sending a PDF.
- Replaced the unguarded file stream with Express file delivery so a missing file returns a controlled 404 instead of terminating the service process.
- Recovered all 444 official PDFs into persistent storage at `/opt/kilimanjaro/storage/report-cards`.
- Set the persistent academic-service configuration to `PDF_STORAGE_PATH=/opt/kilimanjaro/storage/report-cards`.

No report cards were recomposed, unpublished, updated, or deleted. No database data was changed.

## Verification

- Academic service build: passed.
- Dashboard TypeScript check: passed.
- Dashboard production build: passed.
- Report-card access and PDF tests: 12 passed locally and 12 passed on the deployed release.
- Persistent PDF recovery: 444 source files and 444 destination files; every copied file matched its source byte-for-byte.
- Downloaded production sample: valid PDF 1.3, one page, 150,939 bytes.
- Visual render matched the approved branded report-card layout and contained none of the removed mountain, trees, holistic-assessment, or attendance sections.
- All eight PM2 services: online.
- Backend HTTPS health: status `ok`; all reported dependencies reachable.
- Frontend HTTPS: HTTP 200.

## Backups

- Database backup retained from the immediately preceding report-center deployment: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_report_center_20261110T135538Z.dump`.
- Academic configuration backup: `/opt/kilimanjaro/backups/academic-service.env.pre-report-storage-20261110T141000Z`.
- Original PDF set remains in `/opt/kilimanjaro/releases/9db4315-20261110T104141Z/backend/services/academic-service/storage/report-cards`.
- Frontend rollback directory: `/var/www/kilimanjaro-manage.previous-21b869e`.

## Deployment

- Git commit: `21b869e`
- Backend release: `/opt/kilimanjaro/releases/21b869e-20261110T141000Z`
- Previous backend release: `/opt/kilimanjaro/releases/6a3aadd-20261110T135538Z`
- Frontend asset: `index-CisB40in.js`
- No schema migration was required or executed.

The tracked activation script contained Windows line endings in the archive. It was normalized and syntax-checked in the staged release before activation. The release then built all services, switched atomically, reloaded PM2, and passed health verification.

## Rollback

- Backend: point `/opt/kilimanjaro/app` to `/opt/kilimanjaro/releases/6a3aadd-20261110T135538Z`, then reload PM2 as the `kilimanjaro` user.
- Frontend: restore `/var/www/kilimanjaro-manage.previous-21b869e` to `/var/www/kilimanjaro-manage`.
- Configuration: restore `/opt/kilimanjaro/backups/academic-service.env.pre-report-storage-20261110T141000Z` only if persistent report-card storage must be reverted.
- The persistent PDFs should be retained during rollback because they are production documents, not disposable release artifacts.
