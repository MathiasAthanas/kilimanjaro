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

## 3. Finance fixes found by on-screen testing (commit `1d0f889`)

Release: `/opt/kilimanjaro/releases/finance-fixes-1d0f889-20261113T114140Z` (previous: `hof-finance-36e1b49-20261113T101124Z`). Archive SHA-256 `b43b987bfc5112e1b2161af68a3cb164f1480f17245d5bd0e019af2c0e4602dc`.

Found while testing the finance dashboard as the Head of Finance on a local copy (forms filled in on screen, approvals as a Head of School):

- **Adding a verification note to a payment returned a 500 for every finance user.** The Prisma schema listed `PAYMENT_NOTE_ADDED` but the database enum never received it. Additive migration `20261113120000_payment_note_audit_action` (`ALTER TYPE "finance"."FinancialAuditAction" ADD VALUE IF NOT EXISTS 'PAYMENT_NOTE_ADDED'`) applied directly to production before activation (the finance schema has no migration history table). The same check across every service's enums found no other missing values.
- **Adding a store item with Opening Qty or Reorder Level blank returned a 500** (empty string passed to Decimal). Blank now means not entered; a non-number returns a clear 400. Four new tests.

Backups taken before the change: database `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_finance_fixes_20261113T114232Z.dump` (SHA-256 `9fe894c4e60da98c2581313d9a859a6c4d55b4407b71b1ce3207369926712ce7`) and the dashboard archive `frontend_pre_finance_fixes_*.tar.gz`.

Verification: all eight services online, health OK, dashboard 200 (bundle `index-xxJVIYiF.js`), enum value present, store fix present in the compiled service, no fresh error lines in any log. Marks (7011, fingerprint `77d32e17...`), users (1752) and finance rows (1 invoice, 1 payment, 1 receipt) unchanged.

On-screen test coverage and gaps: tested fee category, invoice generation, cash and bank payments, verification notes, approve, reject and refund (as Head of School), receipts and PDFs, expenses, store items and stock receipt, assets, fund request create, review and disburse, defaulter contact log, all eight Export Center CSVs, statement PDF and CSV. Not tested: defaulter SMS (no dashboard button; the gateway endpoint only queues a stub job), the fee-structure form, and a real Head of Finance login on production.

## 4. Production finance schema catch-up (fee categories and fee structures returned 500)

Reported by staff at about 17:41 UTC: creating or editing fee categories and fee structures returned "Internal Server Error". The finance service log showed `The column schoolId does not exist in the current database` on `financialAuditLog.create()`, so every audited finance write failed.

Cause: three finance migrations from 2026-10-24 (`asset_school_scope`, `audit_school_scope`, `defaulter_contacts`) had never been applied to the production database (the finance schema has no migration history table, so nothing applies them automatically). My earlier on-screen finance tests ran against a local database that had them, so they did not catch it.

Fix (database only, no code change, no restart), 2026-11-13 17:49 UTC: backup `/opt/kilimanjaro/backups/finance_schema_pre_school_scope_20261113T174929Z.dump` (finance schema, SHA-256 `d6e169e0d0aa1e07037b05f8483142a1f090e4e12473bd2dbe21e8672796e8e7`), then the three idempotent migrations applied in one transaction (`Asset.schoolId`, `FinancialAuditLog.schoolId`, table `DefaulterContact`, indexes). The audit log was empty, so no rows were touched.

Verification: `prisma migrate diff` of production against each service's schema now shows no missing columns, tables or enum values in finance, academic, student, notification, auth, gateway or e-learning (analytics mirrors other schemas' tables and is not a real difference). Remaining finance differences are four extra `schoolId` indexes and one truncated index name; harmless. All 8 services online, health OK.

Lesson: after any finance deploy, run `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script` on the server and apply missing additive changes by hand.

## 5. Fee category form: Default Amount removed (commit `38d72ec`, dashboard only)

Staff reported that editing a fee category "would not save". The server was saving (PATCH returned 200 after section 4), but the form's Default Amount box was never sent or stored, because categories have no amount (amounts live in Fee Structures), so the typed value vanished and the list showed 0. Removed the field from the form and the list, limited Billing Frequency to Every term / Once only, replaced the misleading audit text.

Deployed 2026-11-13 17:56 UTC as a dashboard-only publish (no backend change, no restart, no database change): built from `dash-feecat-38d72ec.tar.gz` (SHA-256 `ac889c33c47c8123992c52ca826f63309ba2039b099ded9135a4494f8d9bd62d`) in `/opt/kilimanjaro/releases/dash-feecat-38d72ec-20261113T175508Z`, published to `/var/www/kilimanjaro-manage`, bundle `index-D2g08G0Y.js`. Previous dashboard archived as `frontend_pre_feecat_*.tar.gz` in `/opt/kilimanjaro/backups`. Rollback: restore that archive over `/var/www/kilimanjaro-manage`. The active backend release is still `finance-fixes-1d0f889-20261113T114140Z`.

## 6. Dashboard fixes during the client presentation (commit `0014e07`, dashboard only)

Deployed 2026-11-13 18:26 UTC as a dashboard-only publish (no backend restart, no database change), release `/opt/kilimanjaro/releases/dash-fixes-0014e07-20261113T182521Z`, archive SHA-256 `12043d6d9e722fb1c7ca689b5998131e5905898724fc7b01a68135e15fd29639`, bundle `index-DDeRrBh1.js`. Previous dashboard archived as `frontend_pre_dashfixes_*.tar.gz` in `/opt/kilimanjaro/backups`.

- Fee Matrix: saving the same cell twice in one visit no longer creates a second structure (the grid now reuses the live structure for that class and term). Verified on screen locally.
- Payment page timeline no longer reads "Payment recorded by Awaiting approval".
- Manager menu: new **Approve Payments** link to the real approval screen; the old "Pending Approvals" (a finance-officer verification queue with no approve button) is now called **Payment Queue**.

Not yet deployed: the backend half of the matrix fix (invoice generation prefers the newest structure when two match at the same level, commit `61cbe14`); it needs a finance-service restart.

Open item found by inspection: production's only "current" term is the leftover "Mobile QA Test Term"; real Terms 1-3 are not marked current, so Generate Invoices pre-selects the QA term. Needs a decision on which term is current.
