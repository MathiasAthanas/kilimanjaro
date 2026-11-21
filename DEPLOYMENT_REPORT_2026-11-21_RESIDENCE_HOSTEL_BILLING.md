# Production Deployment Report: in campus / off campus, hostel, payment info, plans and invoices

Date: 2026-11-21
Commits: `9682bd9` (boarding base, BenStance), `4e910f8` (merge), `f9c0573`, `08fdf79`, `bc604e3`, `ae1644f`
Release: `/opt/kilimanjaro/releases/residence-hostel-billing-ae1644f-20261121T071317Z` (active)
Previous release (rollback target): `/opt/kilimanjaro/releases/finance-approval-37257de-20261114T150524Z`
Archive SHA-256: `f9378af506eefb1f28266b20de1cc92323ac73dae6d281672dec76747700e80c` (built with Unix line endings; a first archive with Windows line endings was discarded before use)

What the release contains is in `DEPLOYMENT_RUNBOOK_2026-11-21_RESIDENCE_HOSTEL_BILLING.md`.

## Backups (taken before any change)

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_residence_hostel_billing_20261121T071317Z.dump` (SHA-256 `952f2f0d7605f2d661e0d63e39092270c114fdd2da7823f52278140b8da5968d`, 778 objects listed)
- Dashboard: `frontend_pre_residence_hostel_billing_20261121T071317Z.tar.gz` (SHA-256 `3075126546b55bfd71c26d941daf6332f965f3dfc666886488e8497ac5a2c48f`)

## Migrations applied (database `kilimanjaro_prod`, each in its own transaction as `kilimanjaro_app`)

1. auth `20261119080000_add_matron_patron_roles`
2. students `20261118090000_add_student_residence_type`
3. students `20261119081000_add_hostel_operations`
4. students `20261121090000_residence_change_history`
5. finance `20261119090000_add_residence_fee_recalculation`
6. finance `20261121100000_payment_accounts_branding_plans`

Pre-checks: none of the new objects existed; no active duplicate fee prices (so migration 5 switched nothing off).
Post-checks: roles MATRON, PATRON and ADMISSIONS present; 14 new tables, all owned by `kilimanjaro_app`; new columns present; unique index `FeeStructure_target_key` present. Row counts unchanged (students 1209, invoices 1025, active fee structures 38, users 1753, classified students 0). `prisma migrate diff` shows no difference for auth and student, and only the four old `schoolId` index differences that already existed for finance.

## Activation

`deployment/activate-production-release.sh` installed, built all eight services, switched `/opt/kilimanjaro/app`, reloaded PM2 and passed its health check ("Activated and verified"). Dashboard built on the server (`index-ChaHYy0r.js`), copied to `/var/www/kilimanjaro-manage`, nginx reloaded; `https://manage.kilimanjaroschools.site/` returns 200.

After activation: all eight PM2 services online, health reports auth, students, academics, finance, notifications and analytics reachable, Redis and RabbitMQ connected, the new routes answer 401 without a token (not 404). The only fresh error-log line is the existing "FIREBASE_SERVICE_ACCOUNT_JSON is not set" warning.

## Not checked on production

No production login was used, so the authenticated screens were not clicked through there. The checklist in the runbook ("Verification") should be walked once by an administrator.

## Rollback

```bash
previous_release="/opt/kilimanjaro/releases/finance-approval-37257de-20261114T150524Z"
ln -sfn "$previous_release" /opt/kilimanjaro/app.next
mv -Tf /opt/kilimanjaro/app.next /opt/kilimanjaro/app
sudo -u kilimanjaro -H bash -lc "cd /opt/kilimanjaro/app/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
```

Restore `frontend_pre_residence_hostel_billing_*.tar.gz` for the dashboard. Keep the new tables and columns; the previous version ignores them.

## Notes

- The SSH host key for the hostname `srms.kilimanjaroschools.site` in the operator's `known_hosts` was stale. The server was reached by its IP, whose key had been trusted before and matches. The stale hostname entry should be refreshed.
- Throttle-removal work in the working tree stays uncommitted by design; production keeps the gateway throttle.
