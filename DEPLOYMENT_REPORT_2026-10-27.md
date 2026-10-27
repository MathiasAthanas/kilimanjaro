# Login Email and Temporary Credential Deployment

Date: 2026-10-27

## Scope

- Allow a system administrator to edit a user's email login identifier from the user profile.
- Normalize email identifiers, reject duplicates, and revoke refresh sessions when an email changes.
- Retain newly issued temporary passwords using AES-256-GCM encryption at rest.
- Allow a system administrator to reveal and copy a temporary password only while the user must change it.
- Erase the recoverable temporary credential when the user changes or completes a reset of their password.
- Prevent the user-detail API from returning password hashes or encrypted credentials.

## Data Safety

- Migration `20261027090000_recoverable_temporary_credentials` adds one nullable column to `auth.users`.
- Existing user records and password hashes are not modified.
- Existing temporary passwords cannot be recovered. An administrator must reset a legacy account once to issue a recoverable temporary password.
- The production encryption key is stored only in `/etc/kilimanjaro/services/auth-service.env` and is not committed or printed.

## Verification Before Deployment

- Auth-service TypeScript check passed.
- Auth-service focused tests passed: 7/7.
- Prisma schema validation and client generation passed.
- Dashboard TypeScript check passed.
- Dashboard production build passed.
- Local gateway health passed after applying the additive migration to the configured local database.

## Production Record

- Implementation commit: `dad979c`
- Deployed release commit: `8ab9f4e`
- Live release: `/opt/kilimanjaro/releases/8ab9f4e-20261027T064340Z`
- Rollback release: `/opt/kilimanjaro/releases/9fbf9bb-20261026T0542Z`
- Database backup: `/opt/kilimanjaro/storage/backups/kilimanjaro-prod-pre-login-credential-20261027T064340Z.dump`
- Backup SHA-256: `a2d1872b189c254b9eef10f3178d689e5b43fed18d3acd326b26518e59ee7f45`
- Migration verification returned one matching `auth.users.temporaryPasswordEncrypted` column.
- A new production-only encryption key was generated into the protected auth-service environment file without printing or copying it.
- All eight PM2 services are online and gateway health reports all dependent services reachable.
- The dashboard was built with the production API URL, published to `/var/www/kilimanjaro-manage`, and Nginx validation passed.
- `https://manage.kilimanjaroschools.site/` returns HTTP 200.
- The temporary-password endpoint returns HTTP 401 without authentication.
- Fresh auth-service logs show successful Redis and RabbitMQ connections and application startup. Error-log lines shown by PM2 were historical entries from before this deployment.

## Stella Account

- The production account remains `stella@kems.site`; no user data or password was changed during deployment.
- The account still requires a password change, but its old temporary password predates this feature and was never stored recoverably.
- On the profile page, use **Reset Password** once. The newly issued temporary password can then be shown and copied on future visits until Stella changes it.

## Dependency Audit Note

- Existing dependency scans reported vulnerabilities during `npm ci` (backend: 64 total; dashboard: 22 total). No forced dependency upgrade was performed during this scoped deployment because that could introduce unrelated production regressions.
