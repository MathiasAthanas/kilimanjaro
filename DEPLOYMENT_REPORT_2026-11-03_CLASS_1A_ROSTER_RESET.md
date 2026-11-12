# Class 1 A Roster Reset Report

Date: 2026-11-03

## Scope

- Environment: production
- School: Kilimanjaro Primary Shool
- School ID: `d2ec55b5-1b4e-4268-b3d7-7440e5a4c2a9`
- Class: Class 1 A
- Class ID: `0a254bed-9102-434a-818a-9fbcca939470`
- Requested action: permanently delete the incorrect Class 1 A student import and the linked student login accounts while retaining the class.

## Backup

- File: `/opt/kilimanjaro/storage/backups/pre-class1a-roster-reset-20261103T103534Z.dump`
- Format: PostgreSQL custom archive
- Size: 1,252,773 bytes
- SHA-256: `cdccb15903eba5a515f5526d3e449b1b7fa9a612d9688e30f78eebb35f0ed6eb`
- Validation: `pg_restore --list` completed successfully before any database change.

## Failure Cause

The cleanup transaction was failing because production did not contain the
`students.StudentLifecycleOperation` audit table. Prisma rolled back each failed
transaction, so the earlier UI attempts did not partially delete students.

The existing reviewed migration SQL at
`backend/services/student-service/prisma/migrations/20261014122000_student_lifecycle_operations/migration.sql`
was applied directly. A broad `prisma migrate deploy` was not used because the
shared production database migration history contains migrations from multiple
services and would incorrectly attempt to replay unrelated migrations.

## Safety Preview

- Active enrolments selected: 69
- Unique student records: 69
- Linked student login accounts: 69
- Guardian links: 0
- Other active class enrolments: 0
- Attendance records: 0
- Discipline records: 0
- Student performance records: 0
- Academic marks/results/report cards/subject enrolments: 0
- Finance assignments/invoices/payments/receipts: 0
- E-learning enrolments/submissions/attempts/progress: 0
- Eligible students: 69
- Blocked students: 0

## Result

- Student records deleted: 69
- Linked student login accounts deleted: 69
- Login-account deletion failures: 0
- Class deleted: no
- Class 1 A active enrolments after cleanup: 0
- Class 1 A historical enrolment rows after cleanup: 0
- Class 1 A subject assignments retained: 9
- School student count before: 552
- School student count after: 483
- Remaining deleted registration-number accounts in auth: 0
- Lifecycle audit operation: `6ecfbdd1-58c7-462a-a6f2-3e2ac1de4a49`

## Health Verification

- API gateway health: `ok`
- Auth service: reachable
- Student service: reachable
- Academic service: reachable
- Finance service: reachable
- Notification service: reachable
- Analytics service: reachable

Class 1 A is now empty and ready for the corrected student import.
