# Deployment guide — school-scoped finance, paged ledgers, branded PDFs

For the agent that deploys the backend and the web dashboard (and, optionally, the mobile build).
Everything described here is already on `main` (commits `6a068e0` through `4a97a36` and later; the backend part of the last batch is inside `4a97a36`). Read the whole page before touching anything.

## 1. What this release changes

| Area | Change | Needs |
|---|---|---|
| finance-service | Every finance read/write is school-scoped; document numbers carry the school code; paged ledger API (`?paged=1`) for invoices, payments, receipts; `GET /finance/payments/:id`; `GET /finance/reports/daily-summary`; fee assignments carry names; audit trail and assets are school-scoped; invoice/receipt PDFs are drawn fresh with the school's letterhead; defaulter follow-up log; hourly overdue check | **3 DB migrations**, rebuild, restart |
| analytics-service | Finance overview/forecast/assets and all academic/attendance/enrolment/student/department/overview endpoints honour *every* school in a user's scope; class rows name their school | rebuild, restart, **flush analytics cache** |
| academic-service | `GET /academics/assessments/:id/marks/review` is school-scoped and returns `studentMarks` (names + registration numbers) | rebuild, restart |
| student-service | `/students/internal/schools` returns motto, address, phone, email and `studentCount`; names/terms/search helpers | rebuild, restart |
| api-gateway | `principal/*` mobile routes accept `HEAD_OF_SCHOOL`, `MANAGER`, `SUPER_ADMIN`; finance dashboard roles; `/mobile/schools` lists the biggest school first | rebuild, restart |
| dashboard (web) | Finance pages on the real API, server-paged ledgers, CSV export centre, school letterheads, fixes to principal payment approvals, readable error messages | rebuild and upload `dist` |
| mobile | Parent/student finance with PDFs, principal finance cards, HOD marks sheet, mock layer removed | new build (optional, see §8) |

No new environment variables. No new npm dependencies.

## 2. Database migrations (run BEFORE the new code, as a separate reviewed step)

All three are **additive and idempotent** (`IF NOT EXISTS`), so they are safe to run before the new code is live and safe to run twice. Old code keeps working with the new columns/table in place, which makes a code rollback safe.

Order (finance schema, database `kilimanjaro_db`):

1. `backend/services/finance-service/prisma/migrations/20261024120000_asset_school_scope/migration.sql` — `Asset.schoolId`
2. `backend/services/finance-service/prisma/migrations/20261024130000_audit_school_scope/migration.sql` — `FinancialAuditLog.schoolId` + backfill from the logged record
3. `backend/services/finance-service/prisma/migrations/20261024140000_defaulter_contacts/migration.sql` — new table `DefaulterContact`

The databases have **no `_prisma_migrations` table**, so `prisma migrate deploy` will not work. Apply the SQL directly with a role that may alter the `finance` schema (the runtime user `kilimanjaro_app` may not be able to):

```bash
# 0. back up first
pg_dump -Fc -h <host> -U postgres kilimanjaro_db > /opt/kilimanjaro/storage/backups/pre-finance-scope-$(date +%Y%m%d-%H%M%S).dump

# 1. apply in one transaction
cd /opt/kilimanjaro/app/backend/services/finance-service/prisma/migrations
( echo 'begin;'
  cat 20261024120000_asset_school_scope/migration.sql \
      20261024130000_audit_school_scope/migration.sql \
      20261024140000_defaulter_contacts/migration.sql
  echo 'commit;' ) | psql -h <host> -U postgres -d kilimanjaro_db -v ON_ERROR_STOP=1

# 2. confirm
psql -h <host> -U postgres -d kilimanjaro_db -c "select table_name, column_name from information_schema.columns where table_schema='finance' and column_name='schoolId' and table_name in ('Asset','FinancialAuditLog','DefaulterContact')"
```

Expect three rows. If the app role needs table rights on the new table: `GRANT SELECT, INSERT, UPDATE, DELETE ON finance."DefaulterContact" TO kilimanjaro_app;`

Other services: if production was last deployed before commit `af7d0ce`, also check for earlier migrations you have not applied:
`git diff --name-only <production-commit>..origin/main -- 'backend/services/*/prisma/migrations'`
and apply each new `migration.sql` in timestamp order, per service schema. Do not apply anything you cannot map to a reviewed file.

## 3. Build and activate the backend

Use the existing release path (`deployment/README.md`, `deployment/activate-production-release.sh`):

1. Create a release directory under `/opt/kilimanjaro/releases/<short-sha>-<timestamp>` from `origin/main` (the commit that contains this guide or later).
2. Run `deployment/activate-production-release.sh /opt/kilimanjaro/releases/<release>`. It installs locked dependencies, restores the protected `/etc/kilimanjaro/services/*.env` files, builds every service, checks each compiled entry point and Prisma client, switches `/opt/kilimanjaro/app`, reloads PM2, checks gateway health, and **rolls back automatically** if health fails. Note the previous release path it prints; that is your rollback target.
3. `npm run build` already copies the generated Prisma client into `dist` (the `postbuild` step). If a build is ever done by hand after `prisma generate`, run `node ../../scripts/copy-prisma-generated.js` in that service, otherwise the running code will not know the new columns ("Unknown argument `schoolId`").

Services that changed: `finance-service`, `analytics-service`, `academic-service`, `student-service`, `api-gateway`. The activation script rebuilds and reloads all eight; that is fine.

Never print, copy or commit the contents of production `.env` files.

## 4. Flush the analytics cache

Analytics results are cached in Redis for up to 15 minutes under keys starting `analytics:`. The calculation changed (cancelled invoices excluded, multi-school scopes), so remove stale entries once after the restart:

```bash
redis-cli --scan --pattern 'analytics:*' | xargs -r -n 100 redis-cli del
```

(Use `-a <password>` / `-h` as the environment requires.)

## 5. Web dashboard

```bash
cd /opt/kilimanjaro/app/dashboard   # or the release's dashboard/
npm ci
VITE_API_BASE_URL=https://srms.kilimanjaroschools.site/api/v1 npm run build
rsync -a --delete dist/ /var/www/kilimanjaro-manage/
nginx -t && systemctl reload nginx
```

Keep the existing nginx site (`/etc/nginx/sites-available/kilimanjaro-manage`) with the SPA fallback `try_files $uri $uri/ /index.html`. Hard-refresh a browser afterwards (hashed asset names change, `index.html` must not be cached).

## 6. Smoke tests after activation (read-only against production)

Replace `$TOKEN` with a login token for a real finance or head-of-school account; do not create data in production.

```bash
API=https://srms.kilimanjaroschools.site/api/v1
curl -fsS https://srms.kilimanjaroschools.site/health
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/finance/invoices?paged=1&limit=5" | head -c 600     # items + meta + totals + counts + facets
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/finance/payments?paged=1&limit=5" | head -c 400
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/finance/audit-logs?limit=5" | head -c 400          # each row has schoolId
curl -fsS -H "Authorization: Bearer $TOKEN" "$API/finance/reports/daily-summary?days=7" | head -c 300
pm2 status && pm2 logs ks-finance-service --lines 40 --nostream
```

Then in the browser: finance home totals match the invoice ledger totals; open an invoice, download its PDF (school name and term name, not IDs); a head of school sees only their own school's records.

School-separation check (needs two accounts from different schools): the second account must get 403/404 on `GET /finance/payments/<id of the first school's payment>`.

**Do not run `backend/scripts/qa/*.js` against production.** They log in as demo accounts and create (then clean up) data. They are for a staging/QA copy of the database:
`BASE=http://<staging-gateway>/api/v1 node backend/scripts/qa/finance-e2e.js` (expects 129/129) and `elearning-e2e.js` (74/74), then `psql ... -f backend/scripts/qa/finance-e2e-cleanup.sql`.

## 7. Rollback

- Code: the activation script rolls back on a failed health check. To roll back later, point `/opt/kilimanjaro/app` at the previous release and `pm2 startOrReload .../backend/ecosystem.config.js --update-env`. The migrations stay in place (the old code ignores them).
- Web: re-upload the previous `dist`.
- Database: do not drop the new columns/table unless data loss is acceptable; restore from the dump in §2 only as a last resort.

## 8. Mobile (optional, only when you ship a new build)

The Flutter app is for **students, teachers, parents, heads of department and principals / heads of school / managers**. Finance, admissions, academic-QA and admin staff get a read-only pulse screen (key numbers, notifications, profile); their full workspace is the web dashboard. Build and signing steps: `docs/MOBILE_BUILD_REFERENCE.md` and `docs/PLAY_STORE_RELEASE_CHECKLIST.md`. The app reads the API base from the build configuration (`API_BASE_URL_ANDROID` etc.); make sure the production URL is set. Staff who belong to several schools start in the school with the most students and can switch from More.

## 9. Things the agent should tell the owner afterwards

- Which release directory is live and which is the rollback target.
- The migration output (three rows from the confirmation query).
- That analytics cache was flushed and the time.
- Any `pm2 logs` errors in the first minute.

## 10. Known limits (not blockers)

- Defaulter follow-up notes are now saved, but there is no reminder/notification when a follow-up date arrives.
- The dashboard still has about a dozen `react-hooks/exhaustive-deps` and fast-refresh lint warnings (no errors) in finance code.
- `finance.integration.spec.ts` and `academic.integration.spec.ts` only run with `RUN_INTEGRATION=1` against a running stack (default gateway `http://localhost:3000/api/v1`, override with `API_BASE`).
