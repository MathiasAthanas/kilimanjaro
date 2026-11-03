# Login Throttle and Error Handling Deployment Report

Date: 2026-11-03

Application commit: `2515683` (`fix(auth): remove shared login throttles`)

Production release: `/opt/kilimanjaro/releases/2515683-20261103T091920Z`

## Purpose

Remove the overlapping login rate limits that caused legitimate users behind a shared address to receive intermittent HTTP 429 responses. Replace the frontend's `Unknown API error` fallback with clear sign-in guidance.

## Implemented Changes

- The gateway login proxy uses `@SkipThrottle()`.
- General gateway API throttling remains active for non-login routes.
- The auth service's global request throttle and Redis IP login counter were removed.
- Per-account failed-password tracking and temporary account locking remain active.
- Already-normalized API errors retain their HTTP status and server message.
- The login page provides clear messages for invalid credentials, inactive or locked accounts, network failures, service failures, and HTTP 429 responses.
- Auth dependency manifests and lockfiles were updated reproducibly.

## Verification

- Dashboard tests: 25 files and 156 tests passed.
- Clean archive builds passed for the gateway, auth service, and dashboard.
- The production activation script built all eight backend services and passed its health check.
- Twelve consecutive Mobile QA parent login/logout cycles returned HTTP 200. This exceeds the previous limit of ten and produced no HTTP 429 response.
- Gateway health reported auth, students, academics, finance, notifications, and analytics reachable.
- All eight PM2 applications were online after activation.
- The production dashboard returned HTTP 200 and served `assets/index-DuKL_rhy.js`.
- Nginx configuration validation passed before reload.
- Redis was active and both gateway and auth service startup logs showed healthy operation.
- Release-name scans found no Codex, ChatGPT, OpenAI, or `.claude` metadata markers.

## Data and Migrations

- No database schema migration was required or run.
- No school, class, student, staff, or finance records were changed by deployment.
- Verification used the dedicated Mobile QA parent account and generated normal login/logout audit events only. Every issued refresh token was revoked through logout.

## Rollback

- Previous backend release: `/opt/kilimanjaro/releases/256fba3-20261103T104500Z`
- Previous frontend files: `/var/www/kilimanjaro-manage.backup-2515683-20261103T091920Z`
- Backend activation used the atomic release script with automatic rollback on a failed gateway health check.

## Dependency Audit Note

Locked installs reported existing dependency audit findings (backend: 97; dashboard: 34). No automatic `npm audit fix` was run because it can introduce breaking dependency upgrades. This deployment did not add a new runtime dependency.
