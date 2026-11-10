# Shared Subject Reuse Deployment Report

Date: 2026-11-10

## Objective

Allow an existing subject catalogue entry to be reused across schools without returning a duplicate-code failure, while preserving school isolation for class assignments, teachers, marks, exams, and academic years.

## Source

- Commit: `e911f7e fix(academics): reuse shared subjects across schools`
- Branch: `main`
- Git remote: pushed successfully

Only these implementation files were committed and deployed:

- `backend/services/academic-service/src/subjects/subjects.service.ts`
- `backend/services/academic-service/test/subjects.service.spec.ts`
- `dashboard/src/features/admin/pages/AdminPages.tsx`

Unrelated local service and throttling changes were not included.

## Behavior

- An identical normalized name, code, and education stage returns the existing catalogue subject with `reused: true`.
- The UI explains that the existing subject is ready for assignment instead of showing a generic failure.
- A code used by a differently named subject in the same stage remains blocked with a clear conflict message.
- A code can still be reused in a different education stage.
- `ClassSubject` records remain scoped by school, class, academic year, and teacher membership.
- No database schema migration or production data rewrite was required.

## Backups

Database backup:

- Path: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_subject_reuse_20261110T083000Z.dump`
- Format: PostgreSQL custom dump
- Size: approximately 2.3 MB
- SHA-256: `c8953e0cc10b3ea190bab449774322c062eb3011b6937654fb8be25a8eb85d1e`

Frontend backup:

- Path: `/opt/kilimanjaro/backups/kilimanjaro_manage_pre_subject_reuse_20261110T083000Z.tar.gz`

## Deployment

- Release: `/opt/kilimanjaro/releases/e911f7e-20261110T083000Z`
- Active link: `/opt/kilimanjaro/app`
- Frontend root: `/var/www/kilimanjaro-manage`

The initial staged release path was accidentally copied as a symlink to the previous release. The safety check exposed this before accepting it as the final release path. The build was stopped, the stage was recreated as a real directory, its resolved path and patched source were verified, and the normal activation script was rerun. Production services remained online. The corrected release was then built, activated, health-checked, and saved through PM2.

## Verification

Local verification:

- Academic subject tests: 5/5 passed
- Full academic-service suite: 64 passed, 25 environment-gated tests skipped
- Academic-service production build: passed
- Dashboard TypeScript and Vite production build: passed

Production verification:

- Deployed subject tests: 5/5 passed
- Shared subject assignment isolation test: passed for two different schools
- Compiled service contains the `reused: true` path
- Gateway health: OK
- Auth, students, academics, finance, notifications, and analytics: reachable
- Frontend HTTPS: HTTP 200
- Backend HTTPS health: HTTP 200
- All eight PM2 services: online after activation
- Subject catalogue duplicate keys: 0 before deployment
- Final subject count: 54; verification did not create or modify a subject

An unsigned direct service request was rejected with HTTP 401 as expected. The deployed Jest regression test was used for the non-mutating reuse verification.

## Rollback

Application rollback can point `/opt/kilimanjaro/app` back to:

- `/opt/kilimanjaro/releases/e4c2848-20261109T145000Z`

The database did not require migration, so application rollback does not require a database restore. The database dump remains available as an additional recovery point.
