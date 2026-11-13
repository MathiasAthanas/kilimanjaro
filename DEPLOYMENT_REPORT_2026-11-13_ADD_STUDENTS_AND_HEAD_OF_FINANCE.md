# Production Deployment Report: Add Students To Marks Entry, Head Of Finance Access

Date: 2026-11-13  
Commits: `14d226e` (add students), `36e1b49` (Head of Finance)  
Releases (in order):

1. `/opt/kilimanjaro/releases/add-students-14d226e-20261113T090545Z` (previous: `avg-rule-bf9356a-20261113T080828Z`)
2. `/opt/kilimanjaro/releases/hof-finance-36e1b49-20261113T101124Z` (active)

## 1. Add students in the marks editor

Problem: after a window was closed and reopened, the marks editor only listed students who must sit the subject and are not exempt. Exempt students (including the 510 Not-sat students exempted earlier) and students not registered for an optional subject could not be given a mark.

Change (academic service + dashboard, no migration):

- The marks sheet (`GET .../assessments/:id/template`) now returns `addable`: class students not on the grid, each with a reason (`EXEMPT` or `NOT_TAKING`), whether the caller may add them, and any mark already on file.
- The marks editor has an **Add students (N)** button and panel: search, tick, Add. Added students appear in the grid highlighted, with a score box; the normal Save sends them with `add: true`.
- On save, in one transaction with the mark: an exempt student has their exemption revoked (audited as `MARKS_ADD_EXEMPT_STUDENT`); an unregistered student is registered for the subject (audited as `MARKS_ADD_UNREGISTERED_STUDENT`, administrator roles only; teachers see "ask an administrator").
- Server checks: the student must belong to the class, the window must be open or reopened, a score in range is required (Absent/Not sat are rejected for added students), combination subjects and class-wide exemptions are blocked with an explanation, a rejected row changes nothing.
- Saving does not recalculate anything; closing the window recalculates as before.
- Tests: 10 new backend tests, 4 panel tests, 3 page tests; full academic (136) and dashboard suites pass.

Read-only check against production after activation (no writes): Primary 483 exempt students offered across 34 marks sheets; Islamic secondary 19 across 6 sheets; Islamic High School shows students outside a subject's combination (administrators only). Staff started using the feature immediately: 8 `MARKS_ADD_EXEMPT_STUDENT` audit entries between 09:40 and 10:12 UTC.

## 2. Head of Finance: full finance-officer capability in every school

Problem: the Head of Finance saw only "Consolidated Finance" and many endpoints used by the finance screens listed the finance officer but not the Head of Finance.

Change (student, notification, analytics, finance services, API gateway, dashboard; no migration):

- `HEAD_OF_FINANCE` added beside `FINANCE` on every endpoint that listed only the finance officer: students, classes, academic years, terms, guardians, departments, attendance, discipline and performance reads; notifications, announcements, preferences and device tokens; payment evidence, cash drawers, bank statement import, reconciliation, asset maintenance and photos, fee-defaulter notices, file uploads, leadership dashboards and the finance board pack. Fund-request cancellation and the analytics finance privacy filter treat the role like the finance officer.
- Sidebar: group totals plus the full finance desk. Finance pages show a notice when a group-wide user has not chosen a school (records are created in the chosen school).
- Tests: navigation test for the new sidebar; all service suites and the dashboard suite pass.

## Backups And Verification

Taken before each release:

- Release 1: database `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_add_students_20261113T090621Z.dump` (SHA-256 `516e0edb21b752c77ef846cc5a7850bdb873909c2c449fdb6f51d90a3145f5e6`); frontend `frontend_pre_add_students_20261113T090621Z.tar.gz` (`2c491657496294368913eb6c698be1925acdd2f267b680b987a90542ea62fdab`).
- Release 2: database `kilimanjaro_prod_pre_hof_finance_20261113T101209Z.dump` (`b68d68c6b3eb1027e5826a049d12cda299e8b9a096efb584f669644e4c2de15f`); frontend `frontend_pre_hof_finance_20261113T101209Z.tar.gz` (`30842cb0218b63dd257dd106c8b0a26065aabb8603d777fa0140b3416df71282`).
- Archives: add-students `60c0021e2269663a772bb7060a28b2a09ea294579d89c2fe8d00e6646c81c32b`; Head of Finance `ea18144de1521a5bc001379ef8a1553d2b1acafb01cafc0d0418c09387da51ba`.

After activation: all eight PM2 services online; health reports every dependency reachable; dashboard 200 with bundle `index-xxJVIYiF.js`; no fresh error lines in the academic, student, notification, gateway or finance logs; compiled student, notification and gateway services contain the new role entries. Row counts are unchanged (marks 7011, results 715, report cards 715, users 1752, active subject enrolments 52).

Marks values, exemptions and window/publication state changed during the day because staff were editing live (exemptions 510 -> 502 through "Add students", the Islamic High School Terminal Exam was reopened and some cards unpublished by users). Those changes came from staff actions, not from the deployment.

## Notes

- The first attempt to activate release 2 failed at the backend build before anything was switched (production stayed on release 1, all services online). Cause: the operator's backup step had loaded the production environment (`NODE_ENV=production`) into the same shell, so `npm ci` skipped build tools. Re-run in a clean session. Run backup and activation in separate sessions.
- Throttle-removal work in the working tree remains uncommitted by design; production keeps the gateway throttle.
- Students with the status Not sat who are exempt stay exempt until a teacher or administrator adds a score for them; after adding marks, close or recalculate the window and recompose report cards for the affected class.

## Rollback

```bash
previous_release="/opt/kilimanjaro/releases/avg-rule-bf9356a-20261113T080828Z"
ln -sfn "$previous_release" /opt/kilimanjaro/app.next
mv -Tf /opt/kilimanjaro/app.next /opt/kilimanjaro/app
sudo -u kilimanjaro -H bash -lc "cd /opt/kilimanjaro/app/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
```

Restore the matching `frontend_pre_*` archive for the dashboard. Exemptions revoked through "Add students" stay revoked after a rollback; they are recorded in the audit log.
