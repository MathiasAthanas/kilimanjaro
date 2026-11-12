# Production Deployment Report: Optional Department, Manager / Head of Finance Creation, Head of Finance Appointment Fix

Date: 2026-11-12  
Application commits: `ce8d68b` (feature and fixes), `e295268` (documentation only; the release was built from this HEAD)  
Active release: `/opt/kilimanjaro/releases/user-roles-e295268-20261112T145914Z`  
Previous release: `/opt/kilimanjaro/releases/report-card-points-74716e3-20261112T130100Z`

## Problem

- Creating or editing a user always forced a department. Every role started on the first department, so finance staff, administrators and heads of school received a department they did not need.
- The Edit User page could also write a display fallback (a phone number or `Portal account`) back as the user's department.
- The Manager role could not be created from the dashboard at all, and Head of Finance had no creation path other than appointing an existing user.
- Appointing a Head of Finance from the Manager workspace was rejected on every attempt (`Only a group-scoped account can assign a group-wide role`): the controller did not pass the acting user to the membership service, so the group-role check saw no actor.
- A Head of Finance who was replaced kept the group-wide primary role, and with it group-wide access.

## Implementation

Dashboard:

- The department is optional and starts on **None (no department)** for every role. It is sent only when chosen.
- **Head of Department** still requires a department, because the gateway filters a head's department view by it. Teachers see a hint that they will not appear in a head's view without one.
- Edit User keeps the real `department` field and no longer defaults to the first option. A saved value outside the filtered list is kept as `(current)`.
- **Manager (all schools)** and **Head of Finance (all schools)** are offered only to a group-scoped Super Admin or System Admin. They hide the department field, and both are flagged as privileged roles.
- Role and department rules moved to `dashboard/src/features/admin/utils/userForm.ts`.

Auth service:

- User creation refuses a second active Head of Finance (HTTP 409). Replacement stays in the Manager workspace.
- `POST /auth/memberships/head-of-finance` now passes the acting user to the assign and revoke checks, so a Manager or Super Admin can appoint.
- Appointing a Super Admin, System Admin or Manager as Head of Finance is refused, because appointing re-roles the person and would strip their existing access.
- When a Head of Finance membership ends (replacement or direct revoke), the person's primary role returns to the school-level role they still hold (Finance Officer preferred, otherwise Finance Officer). The change is written to the audit log. A user whose primary role was already changed is left alone.

## Scope Decision: Request Throttling

The working tree also contained an uncommitted removal of `@nestjs/throttler` from the gateway and six services. It was **not** deployed.

Production records (`DEPLOYMENT_REPORT_2026-11-02_RATE_LIMIT_FIX.md` and `DEPLOYMENT_REPORT_2026-11-03_LOGIN_THROTTLE_FIX.md`) show only the login throttles and the auth service's global throttle were removed. The gateway's general per-user throttle (300 requests per minute, `GatewayThrottlerGuard`) remains active in production. The uncommitted work would also have removed that guard, which production does not do. It remains uncommitted in the working tree. A backup branch `backup/throttle-wip-d5e8247` and a patch of it were kept locally.

## Tests And Builds

- Auth service: 31 unit tests passed across 7 suites (the integration spec that logs in with a demo account that no longer exists was excluded; it was already failing). TypeScript check passed.
- New auth tests: 5 for group-role creation, 7 for Head of Finance appointment.
- Dashboard: 28 files and 172 tests passed, including the new Create User page tests; `tsc -b` and the production Vite build passed locally and on the server.
- No database migration was part of this release (`git diff 74716e3..HEAD` touched no `prisma/migrations`).

## Production Backup

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_user_roles_20261112T150021Z.dump`
- Database SHA-256: `ff72600415ed32cdbbea24696306f90206c46408a4df10cf3968c0d666a15715`
- Frontend: `/opt/kilimanjaro/backups/frontend_pre_user_roles_20261112T150021Z.tar.gz`
- Frontend SHA-256: `5d52de856f76d9848cda0b461ba2c9147104de7e7ac9c43ddcd7e61bb8dec496`
- State record: `/opt/kilimanjaro/backups/pre_user_roles_20261112T150021Z.txt`
- Report-card files were not backed up because this release does not touch them.
- Release archive SHA-256 (verified on the server before staging): `caaf4f9fc8c1dc001aad4f907de62a91bc04337008fe772c7258632a7babdc85`

## Data Invariants

Captured before and after activation (auth schema):

| Check | Before | After |
|---|---|---|
| Users | 1750, fingerprint `2e20b5610d5a106fe425e771f3572eee` | identical |
| School memberships | 1779, fingerprint `583bbee41fa68289a909d073f382313a` | identical |

The fingerprints cover user id, role, department and active flag, and membership id, user, school, role and active flag. Production held no Manager or Head of Finance users at the time, so the appointment and demotion paths were verified by tests only, not against production data.

## Runtime Verification

- The activation script built all eight services, passed its gateway health check and saved the PM2 list.
- All eight PM2 applications are online; local and public gateway health report auth, students, academics, finance, notifications and analytics reachable.
- The dashboard returns HTTP 200 and serves `assets/index-BL1_VDHp.js`, which contains the new form labels (`None (no department)`, `Manager (all schools)`, `Head of Finance (all schools)`, `Select a department`).
- `nginx -t` passed before the reload.
- Unauthenticated calls to `POST /auth/memberships/head-of-finance` and `GET /auth/users` return HTTP 401, so the routes are live and protected.
- Error logs: the auth-service error log was last written 2026-10-23 and the gateway error log 2026-11-10, so the retained Redis and report-card-composition errors predate this release and no new error was recorded. Redis is active.
- The release fingerprint scan is clean (no Codex, ChatGPT, OpenAI, `.claude` or `.qoder` entries).
- No authenticated browser or API smoke test was run against production.

## Deployment Notes

- The release archive was built with Windows line endings (`core.autocrlf`), as was the previous release. The shell scripts therefore had `\r` stripped in the staged release (`sed -i 's/\r$//'`) before activation. The first activation attempt stopped at line 2 (`set: pipefail: invalid option name`) before changing anything; the symlink, PM2 processes and health were unchanged. The second attempt succeeded.
- `deployment/*.sh` should be packaged with LF line endings, or stripped as above, in future releases.
- Auth-service `.env` is not safe to `source` (an unquoted value on line 11); the runbook's use of the academic-service `.env` for `DATABASE_URL` was used instead.
- `git push` of the implementation commits was blocked by the tool permission check during this session, so `ce8d68b` and `e295268` were deployed from the local repository and are not yet on `origin/main`.
- Dependency-audit findings were not addressed; no new runtime dependency was added.

## Rollback

Backend:

```bash
previous_release="/opt/kilimanjaro/releases/report-card-points-74716e3-20261112T130100Z"
ln -sfn "$previous_release" /opt/kilimanjaro/app.next
mv -Tf /opt/kilimanjaro/app.next /opt/kilimanjaro/app
sudo -u kilimanjaro -H bash -lc "cd /opt/kilimanjaro/app/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
curl -fsS http://127.0.0.1:3000/health
```

Dashboard: restore `/opt/kilimanjaro/backups/frontend_pre_user_roles_20261112T150021Z.tar.gz` using the dashboard rollback procedure in `deployment.md`.

No database rollback is needed: no schema or data change was made by the deployment.

## Cleanup

The uploaded archive and activation log were removed from `/var/tmp`. The previous release and all backups were kept.
