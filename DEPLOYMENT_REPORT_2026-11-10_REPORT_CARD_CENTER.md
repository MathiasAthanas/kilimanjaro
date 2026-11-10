# Report Card Center Deployment Report

Date: 2026-11-10

## Incident

The Report Card Generation Center displayed `No classes ready` even though the selected term already contained 444 published report cards. The compose workflow correctly refused to overwrite those cards and reported that they must be unpublished first.

The empty page was a dashboard integration defect, not missing report-card data. It called the generic results-publishing readiness endpoint and expected a class list that the endpoint does not provide.

## Resolution

- Added a school-scoped academic endpoint that groups existing report cards by class and term.
- Included the real class name, stream, generated-card count, published-card count, school, stage, year, and latest update time.
- Updated the Report Card Generation Center to consume this endpoint.
- Added explicit loading, error, retry, and genuine empty states.
- Kept the existing class-label normalizer so stream letters are not repeated.
- Preserved the existing per-class preview and per-student PDF download flow.

No report cards were unpublished, recomposed, updated, or deleted.

## Verification

- Academic service build: passed.
- Dashboard TypeScript and production builds: passed.
- Focused report-card tests before deployment: passed.
- Focused report-card tests on the deployed release: 4 passed.
- Production endpoint returned 10 class groups.
- Endpoint totals matched production data exactly: 444 generated and 444 published report cards.
- Backend HTTPS health: status `ok`; all reported dependencies reachable.
- Frontend HTTPS: HTTP 200.
- All eight PM2 services: online.

## Backup

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_report_center_20261110T135538Z.dump`
- Size: approximately 2.9 MB.
- SHA-256: `10703b13fba1d4a4ee4a43c127614bccb2d6555271733101ba01193c79c6ffeb`

## Deployment

- Git commit: `6a3aadd`
- Backend release: `/opt/kilimanjaro/releases/6a3aadd-20261110T135538Z`
- Previous backend release: `/opt/kilimanjaro/releases/9db4315-20261110T104141Z`
- Frontend root: `/var/www/kilimanjaro-manage`
- Frontend rollback directory: `/var/www/kilimanjaro-manage.previous-6a3aadd`
- Published frontend asset: `index-BkyfzlK-.js`
- No schema migration was required or executed.

The first activation attempt stopped before installation or release switching because its temporary shell script contained Windows line endings. The temporary script was normalized, then the normal release activation completed successfully. Production remained on the previous healthy release until activation succeeded.

## Rollback

- Backend: point `/opt/kilimanjaro/app` to `/opt/kilimanjaro/releases/9db4315-20261110T104141Z`, then reload the saved PM2 applications as the `kilimanjaro` user.
- Frontend: restore `/var/www/kilimanjaro-manage.previous-6a3aadd` to `/var/www/kilimanjaro-manage`, then validate and reload Nginx.
- No database rollback is required because this deployment performed no migration or data mutation.
