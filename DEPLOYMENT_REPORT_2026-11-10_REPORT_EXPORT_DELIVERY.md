# Report, Export, and Result Delivery Deployment Report

Date: 2026-11-10

## Scope

Deployed the reviewed report and performance changes from commit `9db4315`:

- Removed the mountain, trees, and related illustration code from report-card PDFs.
- Excluded holistic-assessment and attendance blocks from printed report cards while retaining their underlying data.
- Kept academic results, summary, comments, signatures, branding, and a compact footer.
- Limited report-card results to the student's current class.
- Updated performance views and Excel exports to use class-specific subjects, concise headings, Primary-compatible columns, and `-` for absent/not-sat values.
- Added student and guardian recipient resolution for class-level `results.published` events.
- Kept generated but unpublished report cards hidden from students and parents.

Unrelated local throttling, service configuration, and package changes were excluded from the commit and deployment.

## Verification Before Deployment

- Academic service: 69 passed, 25 environment-gated tests skipped.
- Student service: 17 passed.
- Notification service: 6 passed.
- Academic, student, and notification production builds: passed.
- Dashboard TypeScript check and Vite production build: passed.
- PDF sample: one page; no mountain, trees, holistic assessment, or attendance section.

## Backups

Database backup:

- `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_reports_20261110T104141Z.dump`
- Size: approximately 2.4 MB
- SHA-256: `fd2a3d9e246c4ca57fdf4efdf359abd055865b793e050e0d06125b515cd170df`

Frontend backup:

- `/opt/kilimanjaro/backups/kilimanjaro_manage_pre_reports_20261110T104141Z.tar.gz`
- Size: approximately 3.6 MB
- SHA-256: `001b7a7ed962a6f78dd1be06a581bb5e6068f240d32f5884dc6f520119fb5cc7`

## Deployment

- Git commit: `9db4315d61b78f0534d9fe06aac1c1523c74228e`
- Backend release: `/opt/kilimanjaro/releases/9db4315-20261110T104141Z`
- Previous backend release: `/opt/kilimanjaro/releases/e911f7e-20261110T083000Z`
- Frontend root: `/var/www/kilimanjaro-manage`
- Frontend rollback directory: `/var/www/kilimanjaro-manage.previous-9db4315`
- Published frontend asset: `index-CSjHmmQr.js`
- No schema migration was required or executed.

The first two activation invocations stopped before dependency installation or release switching because the temporary CRLF-normalized script was malformed. The temporary script was corrected and syntax-checked before activation. The normal activation script then built all eight backend services, atomically switched the release, reloaded PM2, passed the gateway health check, and saved the process list. Production remained on the previous healthy release until the successful activation.

The first frontend publish command stopped before switching files because of shell quoting. The corrected command validated Nginx, staged the built dashboard, atomically replaced the frontend directory, and passed both frontend and backend HTTPS checks.

## Production Verification

- Backend HTTPS health: status `ok`; auth, students, academics, finance, notifications, and analytics reachable.
- Frontend HTTPS: HTTP 200.
- All eight PM2 services: online.
- Deployed report/export/access regression tests: 12 passed.
- Deployed result-recipient tests: 2 passed.
- Compiled student and notification services contain the new recipient-resolution path.
- Read-only production counts after deployment:
  - Published exam results: 444.
  - Composed report cards: 0.
  - Active `results.published` notification templates: 0.

The deployment did not create, update, or delete school data. The new report-card design will be used when report cards are composed. Result-notification delivery still requires an approved active notification template; no production template was inserted automatically.

## Rollback

- Backend: point `/opt/kilimanjaro/app` back to `/opt/kilimanjaro/releases/e911f7e-20261110T083000Z` and reload PM2.
- Frontend: replace `/var/www/kilimanjaro-manage` with `/var/www/kilimanjaro-manage.previous-9db4315`.
- No database rollback is required because no migration or data mutation was performed.
