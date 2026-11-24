# Production Deployment Report: dormitory boys/girls designation and principal reporting

Date: 2026-11-24
Commits: `7633ba5` (BenStance: boarding controls, principal reporting), `610caa2` (principal menu fix)
Release: `/opt/kilimanjaro/releases/dorm-gender-principal-610caa2-20261124T062155Z` (active)
Previous release (rollback target): `/opt/kilimanjaro/releases/invoice-logo-enrol-3b6466e-20261121T080034Z`

## Backups
- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_dorm_gender_20261124T062155Z.dump` (SHA-256 `e3a5a5ee50c56cf0e28c1b9c070c3974a28c9e7059434095165806b82445def6`, 876 objects)
- Dashboard: `frontend_pre_dorm_gender_20261124T062155Z.tar.gz` (SHA-256 `1963eae3976f56bb6b8af09441c58ea679ce88bcc0e3843bb04d0603941dc87f`)

## Migration (applied once, as `kilimanjaro_app`)
`students/20261122100000_dormitory_gender`: nullable `Dormitory.gender`. Production had no dormitories yet, so no data was touched. Row counts after: students 1209, invoices 1025, users 1753.

## What changed for users
- A dormitory is set as boys or girls. Placement is refused until it is set and refused when the student's gender differs.
- A student's gender cannot be changed while they are in a dormitory of another gender.
- Principal reporting reworked; the principal no longer opens `/finance` pages (see permissions). The principal menu no longer shows Billing Setup links.

## Verification
All eight services online, health reports every dependency reachable, dashboard 200 (`index-DV-k3ssc.js`), new routes answer 401 without a login, `prisma migrate diff` for student-service is empty. The only fresh error-log line is the existing Firebase warning.

## Rollback
Point `/opt/kilimanjaro/app` at the previous release and `pm2 startOrReload`; restore the dashboard archive. Keep the new column (the old version ignores it).
