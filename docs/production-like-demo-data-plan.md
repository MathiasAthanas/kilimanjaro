# Production-Like Demo Data Plan

This document defines the demo/testing environment required for Kilimanjaro Schools.
The target is not frontend mock data. The data must live in the real PostgreSQL
schemas used by the backend services so the mobile app and dashboard can later
consume the same APIs.

## Scope

The demo school represents a complete mixed school:

- Nursery / Kindergarten, represented in the current schema as `PRIMARY` stage
  classes with level `0` and curriculum codes `NURSERY` / `PRE_PRIMARY`.
- Primary Standard/Class 1 to Class 7.
- Secondary Form 1 to Form 4 as `O_LEVEL`.
- Advanced Level Form 5 to Form 6 as `A_LEVEL`.
- Around 200 active students distributed across stages, classes and streams.

## Schema Reality

The current production schema has strong relational support for:

- Authentication and roles.
- Students, guardians, enrolments, classes, terms, attendance, discipline,
  performance snapshots, trends, alerts and peer pairings.
- Academic subjects, class-subject allocations, A-Level combinations,
  assessments, marks, term results, report cards, timetables, syllabus tracking
  and interventions.
- Finance fee categories, structures, groups, invoices, payments, receipts,
  manual approvals, assets and audit logs.
- E-learning courses, lessons, materials, assignments, submissions, quizzes,
  attempts, progress, announcements, discussions and audit logs.
- Notifications, announcements, device tokens, preferences, SMS logs and
  delivery status.
- Analytics snapshots, KPI history, report jobs and metric events.

The current schema does not have dedicated relational tables for HR, payroll,
library, hostel, transport, staff profiles, leave, budgets or bank
reconciliation. These flows currently exist through the API gateway operational
store (`operations.operation_records`). The demo seeder must populate those
collections with realistic structured records so the UI and gateway workflows do
not appear empty.

## Seeder Strategy

The seeder is implemented as `backend/scripts/seed-production-demo.js`.

Key rules:

- Uses deterministic UUIDs from stable keys so reruns update the same records.
- Uses real Prisma clients for each service schema.
- Inserts only relationally valid data.
- Uses one shared demo password per role group for easy presentation testing.
- Creates enough academic, finance, e-learning and operational history to
  populate dashboards, charts and reports.
- Seeds operation-store collections for modules that do not yet have dedicated
  service tables.

## Demo Credentials

The seeder writes a credentials document after a successful run:

- `docs/demo-login-credentials.md`

All accounts use meaningful emails under `demo.kilimanjaro.test`.

## Validation

After seeding, verify:

- `/health` returns all core services reachable.
- Login succeeds for all main roles.
- Student, parent, teacher, HOD, AQA, finance, principal and admin dashboards
  load with non-empty data.
- Academic analytics, finance analytics, attendance analytics and e-learning
  analytics return non-empty datasets.
- Representative workflows can be demonstrated:
  teacher marks entry, report card review, fee payment, parent report view,
  student quiz attempt, assignment grading, attendance review, announcements and
  report generation.

## Deployment Procedure

1. Build backend workspaces.
2. Run Prisma migrations.
3. Run `node scripts/seed-production-demo.js` from the backend directory.
4. Restart PM2 services.
5. Run live smoke checks through the gateway.
6. Confirm public health at `https://srms.kilimanjaroschools.site/health`.

