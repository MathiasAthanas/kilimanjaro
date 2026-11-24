# Production Deployment Report: principal and finance rules, final test round

Date: 2026-11-24
Commit: `500295e` (on top of `7633ba5` dormitory gender, `ec90154` roll call report)
Release: `/opt/kilimanjaro/releases/principal-finance-rules-500295e-20261124T073123Z` (active)
Previous release (rollback target): `/opt/kilimanjaro/releases/rollcall-report-ec90154-20261124T063840Z`

No database migration. Backups: `kilimanjaro_prod_pre_finance_rules_20261124T073123Z.dump` (SHA-256 `266a35d7df6b0fe832c7661c1a851a18eb5cbfcb1daa3061cf201d1ef43e61e7`) and `frontend_pre_finance_rules_20261124T073123Z.tar.gz` (`e61c8d8d760dea9ea4171082647c7e52ba3302e7116d418d19aeab51bb751809`).

## Change
Payment info, invoice look, payment plans, the sample invoice and "notify parent" are no longer open to the Principal (matches the rule that the Principal does not open finance pages). Screen text and runbook updated.

## Tests run before deploying
- Backend unit tests: finance 26, student 45, notification 6, academic 136, analytics 4, gateway 26 all pass. Known failures that predate this work: 1 elearning env-validation fixture (missing ACADEMIC_SERVICE_URL and STUDENT_SERVICE_URL in the test) and 8 auth live-gateway integration tests that need demo accounts.
- Dashboard: `tsc -b`, 214 tests, production build.
- Local end-to-end walk-through, 32 of 33 checks: logins for six roles; dormitories need a boys/girls designation; a boy is refused in a girls dormitory; matron refused outside her dormitory; dormitory gender cannot change with the other gender inside; moving off campus frees the bed; roll call report for Head of School, Manager and matron; alerts limited to leaders; Head of School reads notifications; finance reads payment info, plans and settings; part-paid invoice shows paid and balance per instalment; invoice and sample PDFs; matron refused finance; finance officer refused classifying; inquiry without a residence choice accepted. The one failing check was a wrong test payload (direct enrolment on the API leaves in/off campus optional; the screens and applicant conversion require it).

## Verification on production
All eight services online, health reports every dependency reachable, dashboard 200 (`index-BmPwzf0r.js`), routes answer 401 without a login, student-service reached auth-service and found 2 school leaders, notification-service answers, row counts unchanged (students 1209, invoices 1025, users 1753). Only fresh error-log line is the existing Firebase warning.

## Not checked on production
No production login, so screens were not clicked through there.

## Rollback
Point `/opt/kilimanjaro/app` at the previous release and `pm2 startOrReload`; restore the dashboard archive.
