# Production Deployment Report: roll call report, overdue alerts and daily summary

Date: 2026-11-24
Commits: merge `ec90154` of branch `feature/rollcall-reports` (`145b8f9`) into main
Release: `/opt/kilimanjaro/releases/rollcall-report-ec90154-20261124T063840Z` (active)
Previous release (rollback target): `/opt/kilimanjaro/releases/dorm-gender-principal-610caa2-20261124T062155Z`

No database migration.

## Backups
- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_rollcall_20261124T063840Z.dump` (SHA-256 `7e25020872c1352d4a334739f4851b9d9383b56d0d69117c1ed73b3c78c862ea`)
- Dashboard: `frontend_pre_rollcall_20261124T063840Z.tar.gz` (SHA-256 `7e3a3dd87261a17c793e45b223900aeb28a7a4a50fdea9987dc99f38e296b68d`)

## What users get
- Roll Call Report and Roll Call History in the Head of School, Principal, Manager and admin menus (the report also for matron and patron, limited to their dormitories).
- Report: today per dormitory and session (done, missing, not due), who is absent, 7/14/30 day trend, rates per dormitory, most absent students. "Check and alert now" for leaders and admins.
- Overdue alert (08:00 morning, 21:00 evening, school time) to the Head of School, Principal and Manager, once per dormitory and session; daily summary at 21:30. Deadlines can be set with ROLLCALL_MORNING_DEADLINE and ROLLCALL_EVENING_DEADLINE.
- Fix: Head of School, Manager, Super Admin, Admissions, Matron and Patron could not read their in-app notifications (the API said "Insufficient role").

## Verification
All eight services online, health reports every dependency reachable, dashboard 200 (`index-C9ML4qeS.js`), the report route answers 401 without a login, student-service reached auth-service with the shared key and found 2 school leaders (no data created), notification-service answers. Row counts unchanged (students 1209, invoices 1025, users 1753). The only fresh error-log line is the existing Firebase warning.

## Not checked on production
No production login was used, so the report page and a real alert were not exercised there. Alerts only start once a dormitory with students exists.

## Rollback
Point `/opt/kilimanjaro/app` at the previous release and `pm2 startOrReload`; restore the dashboard archive. Nothing in the database needs undoing.
