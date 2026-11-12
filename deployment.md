# Kilimanjaro Production Deployment Runbook

Last updated: 2026-11-12  
Audience: deployment operators working on this repository  
Purpose: deploy committed changes without losing production data, persistent files, configuration, or rollback capability.

## 1. Production Reference

| Item | Value |
|---|---|
| VPS | `179.198.193.172` |
| SSH user | `root` |
| SSH key on the development computer | `$HOME\.ssh\kilimanjaro` |
| Web dashboard | `https://manage.kilimanjaroschools.site` |
| Public API | `https://srms.kilimanjaroschools.site/api/v1` |
| Health endpoint | `https://srms.kilimanjaroschools.site/health` |
| Certbot contact | `athanas.mathy@gmail.com` |
| Application user | `kilimanjaro` |
| Active-release symlink | `/opt/kilimanjaro/app` |
| Immutable releases | `/opt/kilimanjaro/releases` |
| Protected service configuration | `/etc/kilimanjaro/services/<service>.env` |
| Dashboard web root | `/var/www/kilimanjaro-manage` |
| Production backups | `/opt/kilimanjaro/backups` |
| Persistent report cards | `/opt/kilimanjaro/storage/report-cards` |
| Production database | `kilimanjaro_prod` |

Connect from PowerShell with:

```powershell
ssh -i $HOME\.ssh\kilimanjaro root@179.198.193.172
```

Never print, copy into chat, or commit production secrets or private-key contents.

## 2. Current Production Baseline

As of 2026-11-12:

- Active release: `/opt/kilimanjaro/releases/report-card-points-74716e3-20261112T130100Z`.
- Production application code: commit `74716e3`.
- `main` also contains documentation commit `31fdfb6`; that commit does not change runtime code.
- All eight PM2 services are online.
- The public gateway health endpoint reports its dependencies reachable.
- The production dashboard returns HTTP 200.
- No database migration was pending in the latest release.
- The latest controlled report-card regeneration preserved marks, results, rankings, and publication state.

The local working tree currently contains unrelated uncommitted work. A deployment must be built from a reviewed commit, never by copying the working directory.

## 3. Production Architecture

The backend is a Node/NestJS monorepo managed by PM2:

| PM2 application | Port |
|---|---:|
| `ks-api-gateway` | 3000 |
| `ks-auth-service` | 3001 |
| `ks-student-service` | 3002 |
| `ks-academic-service` | 3003 |
| `ks-finance-service` | 3004 |
| `ks-notification-service` | 3005 |
| `ks-analytics-service` | 3006 |
| `ks-elearning-service` | 3007 |

Only Nginx should be publicly exposed. UFW allows SSH, HTTP, and HTTPS; backend, PostgreSQL, Redis, and RabbitMQ ports must remain private.

Supporting services:

- PostgreSQL stores application data in service-owned schemas.
- Redis provides caching and runtime coordination.
- RabbitMQ carries asynchronous application events.
- Nginx serves the React dashboard and reverse-proxies the API gateway.
- Certbot manages TLS for both production domains.
- PM2 runs applications as the non-root `kilimanjaro` user.
- The system health timer checks PM2 and gateway health and restarts unhealthy services with a cooldown.

## 4. Non-Negotiable Safety Rules

1. Do not deploy a dirty working tree.
2. Do not overwrite production `.env` files with local files.
3. Do not run `prisma db push` in production.
4. Do not run a migration before taking and verifying a database backup.
5. Do not delete, truncate, rewrite, or reseed production data as part of a normal deployment.
6. Do not regenerate report cards, recalculate results, republish exams, or modify user records unless the requested change explicitly requires it.
7. Do not upload `.git`, local `.env`, editor state, temporary output, test databases, local dumps, or agent metadata.
8. Do not use destructive Git commands to prepare a release.
9. Keep the previous release and frontend archive until the new release has been verified.
10. Record every production change in a dated `DEPLOYMENT_REPORT_*.md` file without passwords or tokens.
11. If production data changes during deployment, record before-and-after counts or fingerprints that prove the intended scope.
12. Stop if the migration, build, health check, school scope, or data fingerprint differs from the expected result.

## 5. Decide the Deployment Scope

Before touching the VPS, identify what changed:

```powershell
git status --short
git log --oneline -10
git diff --stat <production-commit>..HEAD
git diff --name-only <production-commit>..HEAD
git diff --name-only <production-commit>..HEAD -- "backend/services/*/prisma/migrations"
```

Classify the release:

- Dashboard only: build and publish the dashboard; still back up the existing web root.
- Backend only: build and activate a new immutable release.
- Backend plus dashboard: use the full procedure below.
- Migration release: add database backup, migration review, migration verification, and rollback analysis.
- Data correction: use a dedicated reviewed script, database backup, exact target IDs, before/after fingerprints, and a separate report.
- Generated-document change: back up persistent generated files and regenerate only the explicitly approved scope.

Confirm that all intended code is committed and pushed. Do not include unrelated local changes merely because they exist.

## 6. Pre-Deployment Verification

Run checks appropriate to the changed surface before packaging:

```powershell
cd C:\Users\MICROSPACE\Desktop\kilimanjaro\backend
npm ci
npm run build
```

```powershell
cd C:\Users\MICROSPACE\Desktop\kilimanjaro\dashboard
npm ci
npm run build
```

Also run focused tests for every changed service or feature. For shared academic, authentication, school-scope, import, exam, or report-card logic, run the full affected service suite rather than only one test file.

For migrations:

1. Read every new `migration.sql` file.
2. Confirm it is additive or that its destructive effect is explicitly approved.
3. Test it against a restored production backup when the migration touches populated tables or constraints.
4. Verify the new code can read existing rows and that the previous release can tolerate additive columns or tables.
5. Define a database rollback plan before deploying.

## 7. Capture the Live Baseline

Connect and record the current release and runtime status:

```bash
readlink -f /opt/kilimanjaro/app
sudo -u kilimanjaro -H pm2 status
curl -fsS http://127.0.0.1:3000/health
curl -fsS https://srms.kilimanjaroschools.site/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://manage.kilimanjaroschools.site/
df -h /
free -h
```

Inspect recent logs for the services that will change. Distinguish old retained errors from errors created after the new process start:

```bash
sudo -u kilimanjaro -H pm2 logs ks-api-gateway --lines 100 --nostream
sudo -u kilimanjaro -H pm2 logs ks-academic-service --lines 100 --nostream
```

Do not proceed when services are already unhealthy until the existing incident is understood and recorded.

## 8. Back Up Production

Use a UTC timestamp and a release-specific label:

```bash
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
label="pre_<release-purpose>_${timestamp}"
mkdir -p /opt/kilimanjaro/backups
chmod 700 /opt/kilimanjaro/backups
```

Load the database URL without printing it, then create a PostgreSQL custom-format dump:

```bash
active="$(readlink -f /opt/kilimanjaro/app)"
set -a
source "$active/backend/services/academic-service/.env"
set +a
database_url="${DATABASE_URL%%\?*}"
pg_dump -Fc "$database_url" -f "/opt/kilimanjaro/backups/kilimanjaro_prod_${label}.dump"
pg_restore --list "/opt/kilimanjaro/backups/kilimanjaro_prod_${label}.dump" >/dev/null
sha256sum "/opt/kilimanjaro/backups/kilimanjaro_prod_${label}.dump"
```

Back up the dashboard:

```bash
tar -C /var/www -czf "/opt/kilimanjaro/backups/frontend_${label}.tar.gz" kilimanjaro-manage
sha256sum "/opt/kilimanjaro/backups/frontend_${label}.tar.gz"
```

Back up persistent files when the change can affect them:

```bash
tar -C /opt/kilimanjaro/storage -czf "/opt/kilimanjaro/backups/report_cards_${label}.tar.gz" report-cards
sha256sum "/opt/kilimanjaro/backups/report_cards_${label}.tar.gz"
```

Use the same pattern for receipts, uploads, e-learning files, or other persistent directories affected by a release. Record paths and SHA-256 values in the deployment report.

For a data correction, also save focused counts and deterministic fingerprints before making changes. The fingerprint must exclude timestamps or generated-file paths when those are the only fields expected to change.

## 9. Build a Clean Release Artifact

Create the archive from a reviewed Git commit. Include only runtime source and deployment scripts. This excludes the working tree, `.git`, untracked files, mobile builds, test exports, historical reports, credential-reference documents, and local tooling metadata:

```powershell
$sha = git rev-parse --short HEAD
$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$releaseId = "release-$sha-$timestamp"
git archive --format=tar.gz --output="tmp\$releaseId.tar.gz" HEAD backend dashboard deployment
Get-FileHash "tmp\$releaseId.tar.gz" -Algorithm SHA256
tar -tzf "tmp\$releaseId.tar.gz" | Select-Object -First 30
scp -i $HOME\.ssh\kilimanjaro "tmp\$releaseId.tar.gz" "root@179.198.193.172:/var/tmp/$releaseId.tar.gz"
```

Do not package with a recursive copy of the local repository. Do not include root-level operational notes, account lists, `.env` files, database dumps, generated output, or production secrets.

## 10. Stage the Release on the VPS

Use a unique immutable directory:

```bash
release_id="release-<short-sha>-<UTC timestamp>"
archive="/var/tmp/${release_id}.tar.gz"
release_dir="/opt/kilimanjaro/releases/${release_id}"
test ! -e "$release_dir"
mkdir -p "$release_dir"
tar -xzf "$archive" -C "$release_dir"
chown -R kilimanjaro:kilimanjaro "$release_dir"
```

Install protected configuration from `/etc/kilimanjaro/services`, never from the archive:

```bash
for service in api-gateway auth-service student-service academic-service finance-service notification-service analytics-service elearning-service; do
  install -o kilimanjaro -g kilimanjaro -m 600 \
    "/etc/kilimanjaro/services/${service}.env" \
    "$release_dir/backend/services/${service}/.env"
done
```

Copy the protected dashboard production configuration from the active release when present:

```bash
active="$(readlink -f /opt/kilimanjaro/app)"
if test -f "$active/dashboard/.env.production"; then
  install -o kilimanjaro -g kilimanjaro -m 600 \
    "$active/dashboard/.env.production" \
    "$release_dir/dashboard/.env.production"
fi
```

Confirm the dashboard API URL is exactly:

```text
https://srms.kilimanjaroschools.site/api/v1
```

### Protected configuration changes

When a release introduces a new environment variable, update the protected source under `/etc/kilimanjaro/services` before activation. Do not patch only the active release because the next deployment will replace that file.

1. Back up the affected protected environment file with a UTC timestamp.
2. Edit it on the VPS without printing its contents.
3. Keep ownership `root:kilimanjaro` and mode `640`.
4. Record only the variable name, purpose, and whether it was configured; never record its secret value.
5. Let the activation script install the protected file into the release with mode `600`.
6. Verify the service starts and that the old release remains compatible or has its own prior configuration backup.

## 11. Install and Build the Staged Release

Build as the application user:

```bash
sudo -u kilimanjaro -H bash -lc "cd '$release_dir/backend' && npm ci && npm run build"
sudo -u kilimanjaro -H bash -lc "cd '$release_dir/dashboard' && npm ci && npm run build"
```

Verify all compiled service entry points and generated Prisma clients exist before switching production. The tracked script `deployment/activate-production-release.sh` performs these backend checks and provides atomic backend activation with automatic health rollback.

Dependency-audit warnings must be recorded, not fixed with an unreviewed forced upgrade during a feature deployment.

## 12. Apply Reviewed Migrations

Migrations are a separate deployment step. The tracked activation script deliberately does not run them.

For each service with new migrations:

```bash
sudo -u kilimanjaro -H bash -lc "cd '$release_dir/backend/services/<service>' && npx prisma migrate status"
sudo -u kilimanjaro -H bash -lc "cd '$release_dir/backend/services/<service>' && npx prisma migrate deploy"
```

Then query PostgreSQL to verify the expected tables, columns, indexes, constraints, and backfilled row counts.

Rules:

- Never use `prisma db push` against production.
- Never mark a failed migration as applied without proving the database matches it.
- Never edit an already-applied migration.
- When an old migration-history exception requires direct SQL, run only a reviewed idempotent script in a transaction with `ON_ERROR_STOP`, then document the exact SQL file and verification output.
- Additive migrations may remain after a code rollback when the old release safely ignores them. Destructive migrations require a separate rollback design.

## 13. Activate Backend and Publish Dashboard

Preferred backend activation:

```bash
bash "$release_dir/deployment/activate-production-release.sh" "$release_dir"
```

The script:

- restores protected service configuration;
- installs locked backend dependencies;
- builds all eight services;
- verifies compiled entry points and Prisma clients;
- atomically switches `/opt/kilimanjaro/app`;
- reloads PM2 as `kilimanjaro`;
- checks gateway health;
- restores the previous symlink automatically if health fails;
- saves the working PM2 process list.

Publish the already-built dashboard without deleting the live directory first. Copy hashed assets before replacing `index.html`, so clients never receive an index referencing missing files:

```bash
mkdir -p /var/www/kilimanjaro-manage/assets /var/www/kilimanjaro-manage/images
rsync -a "$release_dir/dashboard/dist/assets/" /var/www/kilimanjaro-manage/assets/
if test -d "$release_dir/dashboard/dist/images"; then
  rsync -a "$release_dir/dashboard/dist/images/" /var/www/kilimanjaro-manage/images/
fi
find "$release_dir/dashboard/dist" -maxdepth 1 -type f ! -name index.html -exec cp -f {} /var/www/kilimanjaro-manage/ \;
cp -f "$release_dir/dashboard/dist/index.html" /var/www/kilimanjaro-manage/index.html
chown -R www-data:www-data /var/www/kilimanjaro-manage
nginx -t
systemctl reload nginx
```

Do not use `rsync --delete` unless the frontend backup has been verified and deletion is required; persistent or manually managed public files must not be removed accidentally.

## 14. Mandatory Post-Deployment Verification

### Runtime

```bash
readlink -f /opt/kilimanjaro/app
sudo -u kilimanjaro -H pm2 status
curl -fsS http://127.0.0.1:3000/health
curl -fsS https://srms.kilimanjaroschools.site/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://manage.kilimanjaroschools.site/
nginx -t
```

Require exactly eight PM2 applications online. The public health response must be `ok`, and the dashboard must return 200.

When Nginx, DNS, TLS, firewall, or system services changed, also run:

```bash
systemctl is-active nginx postgresql redis-server rabbitmq-server
systemctl is-active certbot.timer
certbot certificates
ufw status verbose
ss -ltnp
```

Confirm only the intended public ports are exposed and both production certificates cover the expected domains.

### Logs

Inspect fresh logs for every changed service:

```bash
sudo -u kilimanjaro -H pm2 logs <application-name> --lines 150 --nostream
```

Check for startup loops, Prisma errors, missing columns, unauthorized internal calls, queue failures, unhandled exceptions, and new HTTP 500 responses.

### Functional smoke tests

Use read-only API requests or narrowly scoped authenticated tests:

- Login and refresh work.
- A group-wide administrator sees all permitted schools.
- School-scoped users remain limited to their memberships.
- Dashboard school switching updates data without a hard refresh.
- Changed CRUD routes return expected responses.
- Changed imports preserve the selected school and class.
- Exam and report-card changes preserve publication and calculation rules.
- Generated PDFs and ZIPs download successfully when those paths changed.
- Mobile API compatibility is checked when shared contracts changed.

Do not run demo QA scripts that create records against production.

### Data invariants

When the release includes controlled production operations, compare the saved before/after counts or fingerprints. For example:

- students, users, schools, classes, enrolments, and guardians;
- exam marks and exam-window results;
- term results and report cards;
- published/unpublished counts;
- invoices, payments, and balances;
- persistent PDF count and checksums.

Only explicitly intended fields may change.

## 15. Rollback

### Backend

```bash
previous_release="/opt/kilimanjaro/releases/<previous-release>"
ln -sfn "$previous_release" /opt/kilimanjaro/app.next
mv -Tf /opt/kilimanjaro/app.next /opt/kilimanjaro/app
sudo -u kilimanjaro -H bash -lc "cd /opt/kilimanjaro/app/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
curl -fsS http://127.0.0.1:3000/health
```

### Dashboard

Restore the exact pre-deployment frontend archive:

```bash
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
test -d /var/www/kilimanjaro-manage
mv /var/www/kilimanjaro-manage "/var/www/kilimanjaro-manage.failed-${timestamp}"
tar -C /var/www -xzf /opt/kilimanjaro/backups/frontend_<label>.tar.gz
chown -R www-data:www-data /var/www/kilimanjaro-manage
nginx -t
systemctl reload nginx
```

Retain the failed frontend directory until the restored site is verified; remove it later only after resolving and checking its exact path.

### Database and persistent files

Do not restore the database merely because code was rolled back. Restore only when a migration or data operation caused a confirmed incompatible or corrupt state, and only after stopping writes and preserving the failed state for investigation.

Restore report-card or other persistent-file archives only when those files were changed and must return to their exact prior versions.

## 16. Cleanup and Production Hygiene

After successful verification:

1. Remove the uploaded archive and temporary scripts from `/var/tmp`.
2. Keep the current and previous release directories.
3. Keep database, frontend, and affected persistent-file backups.
4. Remove local/editor metadata introduced by dependencies.
5. Scan release paths for forbidden deployment metadata and confirm the result is clean.
6. Do not remove production logs needed for incident analysis.
7. Do not remove old releases until a separate retention review confirms they are no longer rollback targets.

Scan the active release by filename before declaring the deployment complete:

```bash
release_dir="$(readlink -f /opt/kilimanjaro/app)"
find "$release_dir" \( -type f -o -type d \) \
  \( -iname '*codex*' -o -iname '*chatgpt*' -o -iname '*openai*' -o -name '.claude' -o -name '.qoder' \) \
  -print
```

Third-party packages can create metadata directories during `npm ci`. Remove only exact, inspected paths contained within the active release, then repeat the scan. Never use a broad recursive deletion against an unresolved or computed path.

## 17. Deployment Report Template

Create `DEPLOYMENT_REPORT_<YYYY-MM-DD>_<SCOPE>.md` containing:

- requested change and production impact;
- implementation commit and active release path;
- previous release path;
- test and build results;
- migration files and migration verification;
- database, frontend, and persistent-file backup paths and SHA-256 values;
- before/after data counts or fingerprints;
- public health, PM2, Nginx, and functional smoke-test results;
- any warnings or known limitations;
- exact rollback procedure;
- confirmation that temporary files and deployment metadata were removed.

Never include passwords, tokens, private keys, encryption keys, raw production `.env` values, or student-sensitive exports.

Commit and push the report separately if the runtime release was already built from the implementation commit.

## 18. Major Work Already Deployed

The production system has accumulated the following major deployment work:

- Base VPS hardening, PostgreSQL, Redis, RabbitMQ, Nginx, PM2, UFW, Certbot, HTTPS, protected configuration, and health monitoring.
- Eight-service backend and React dashboard release structure with immutable releases and rollback support.
- Multi-school and group-wide administrator scoping, school switching, role memberships, and school-aware imports.
- User management, editable login emails, temporary-password handling, bulk user editing, and staff/student account workflows.
- Academic years, terms, Nursery/Primary/O-Level/A-Level structures, classes, streams, subject combinations, teaching assignments, and promotion pathways.
- Student class-list import, legacy spreadsheet support, date parsing, gender handling, class rosters, guardian visibility, and controlled class/student cleanup.
- Exam types, assessment types, exam windows, class inclusion/exclusion, readiness, marks, exemptions, close/recalculate/publish flows, and correction workflows.
- Primary, O-Level, and A-Level result calculation, ACSEE combination-aware divisions, division points, merit lists, class/subject/gender analytics, and teacher grade distributions.
- Official report-card generation, persistent PDF storage, school-scoped report center, individual and bulk PDF/ZIP downloads, progress/resume jobs, clear filenames, and regenerated-card lifecycle controls.
- Report-card policy controls for pass marks, intervention, omitted/exempt subjects, IRE/CRE alternatives, stream and overall positions, divisions, and visible division points.
- Finance, notification, analytics, e-learning, timetable, audit, legal/Play Store pages, and production mobile API support.

Detailed historical evidence remains in the dated `DEPLOYMENT_REPORT_*.md` files. Do not infer current database state solely from an old report; always capture a fresh live baseline.

## 19. Latest Report-Card Deployment Record

The latest runtime change fixed the missing points display on O-Level cards:

- Stored production value was already correct: `Division I`, `10` points.
- Commit `74716e3` changed only the PDF summary presentation.
- Seventeen Form 1 B PDFs were regenerated.
- All 17 remained published.
- Report-card calculation fingerprint remained `c4a3854c4e7356cb70380f0686be30fe`.
- Term-result fingerprint remained `fbb80c4c2596e5188ecca099e9425d6f`.
- The inspected PDF displays `DIVISION I - 10 PTS` without clipping.
- Backup and verification details are in `DEPLOYMENT_REPORT_2026-11-12_REPORT_CARD_DIVISION_POINTS.md`.

## 20. Completion Checklist

- [ ] Intended commits reviewed and pushed.
- [ ] Dirty local work excluded.
- [ ] Backend build passed.
- [ ] Dashboard build passed.
- [ ] Focused and regression tests passed.
- [ ] Live baseline captured.
- [ ] Database backup created, validated, and checksummed.
- [ ] Frontend backup created and checksummed.
- [ ] Relevant persistent files backed up and checksummed.
- [ ] New migrations reviewed and tested.
- [ ] Clean immutable release staged.
- [ ] Protected configuration restored without being printed.
- [ ] Backend activated successfully.
- [ ] Dashboard published successfully.
- [ ] Exactly eight PM2 services online.
- [ ] Local and public health checks passed.
- [ ] Dashboard returned HTTP 200.
- [ ] Nginx validation passed.
- [ ] Fresh logs contain no release-related errors.
- [ ] Functional smoke tests passed.
- [ ] Data invariants or fingerprints passed.
- [ ] Rollback target recorded.
- [ ] Temporary server files removed.
- [ ] Deployment metadata scan clean.
- [ ] Dated deployment report committed and pushed.

