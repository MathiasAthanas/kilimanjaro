# Production-Like Demo Data Status

Last updated: 2026-05-23

## Summary

The test VPS database has been populated with a production-like Kilimanjaro
Schools demo environment using real backend tables and the gateway operational
store. This is not frontend mock data.

The seeded school covers:

- Nursery / Pre-Primary using the current `PRIMARY` stage with level `0`.
- Standard 1 to Standard 7.
- Form 1 to Form 4 as O-Level.
- Form 5 to Form 6 as A-Level.
- Streams including primary A streams, Form 1 A/B, and A-Level PCM, EGM and
  HGL streams.

## Seed Counts On VPS

The successful VPS seed reported:

| Area | Count |
|---|---:|
| Auth users | 395 |
| Students | 216 |
| Guardians | 148 |
| Attendance records | 9504 |
| Subjects | 27 |
| Class subjects | 101 |
| Assessments | 202 |
| Marks | 2472 |
| Report cards | 216 |
| Invoices | 216 |
| Payments | 216 |
| E-learning courses | 17 |
| E-learning lessons | 65 |
| Assignments | 65 |
| Quizzes | 17 |
| Notifications | 50 |
| Notification templates | 28 |
| Notification preferences | 32 |
| SMS delivery logs | 8 |
| Auth audit logs | 62 |
| Academic audit logs | 3 |
| Academic interventions | 12 |
| Subject enrolments | 180 |
| Finance audit logs | 3 |
| Manual payment approvals | 1 |
| Student group memberships | 54 |
| Lesson progress records | 80 |
| Quiz answers | 96 |
| Discussion replies | 9 |
| E-learning audit logs | 15 |
| Generated analytics reports | 3 |
| Metric events | 5 |
| Gateway operation records | 263 |

The student count is slightly above 200 because existing test/demo records were
left intact and the seeder adds a deterministic complete 200-student demo set.

## Populated Modules

- Authentication: admin, principal, AQA, HOD, teacher, finance, parent, student
  and operational staff accounts, plus refresh-token, password-reset and auth
  audit-log coverage.
- Student management: students, guardians, links, enrolments, classes, pathways,
  attendance, discipline, performance snapshots, trends and alerts.
- Academics: subjects, class-subject assignments, A-Level combinations,
  assessment types, grading scales, assessments, marks, approvals, student
  subject enrolments, academic interventions, audit logs, term results, report
  cards, timetables and syllabus progress.
- Finance: fee categories, fee structures, student groups, group memberships,
  student fee assignments, invoices, invoice line items, payments, receipts,
  manual approval records, audit logs, number sequences, assets and finance
  analytics data.
- E-learning: course spaces, lessons, text notes, PDF/video-style materials,
  assignments, submissions, grading feedback, quizzes, attempts, quiz answers,
  material progress, lesson progress, course announcements, discussion threads,
  discussion replies and e-learning audit logs.
- Notifications: published announcements, templates, device tokens, user
  preferences, in-app notifications, SMS delivery logs and realistic recipient
  data.
- Analytics: dashboard snapshots, KPI history, generated reports, metric events
  and relational data for academic, finance, attendance and overview analytics.
- Operations store: staff profiles, payroll runs, leave requests, library books,
  borrowings, hostel rooms, hostel allocations, transport routes, transport
  allocations, budget lines, files, payment evidence, cash drawers, bank
  statement imports, bank reconciliation matches, asset maintenance/photos,
  report templates, scheduled reports, report-card jobs/signatures/comments,
  marks imports/autosaves, attendance sessions, mobile HOD decisions,
  notification jobs/retries/template tests/template versions, feature flags,
  engine runs and report jobs.

## Login Credentials

Detailed credentials are in:

- `docs/demo-login-credentials.md`

Main test accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@demo.kilimanjaro.test` | `Admin@Kili2026` |
| Principal | `principal@demo.kilimanjaro.test` | `Principal@Kili2026` |
| AQA | `aqa@demo.kilimanjaro.test` | `Aqa@Kili2026` |
| Finance | `finance@demo.kilimanjaro.test` | `Finance@Kili2026` |
| Teacher sample | `t-english@demo.kilimanjaro.test` | `Teacher@Kili2026` |
| HOD sample | `hod-science@demo.kilimanjaro.test` | `Hod@Kili2026` |
| Parent sample | `parent001@demo.kilimanjaro.test` | `Parent@Kili2026` |
| Student sample | `student001@demo.kilimanjaro.test` | `Student@Kili2026` |

## Verified Live Endpoints

After deployment and service restart, the following gateway checks returned 200:

- `/health`
- `/students/classes`
- `/students?limit=5`
- `/academics/subjects`
- `/academics/class-subjects`
- `/academics/assessments`
- `/finance/invoices`
- `/finance/payments`
- `/finance/assets/summary`
- `/elearning/courses`
- `/notifications/announcements/active`
- `/analytics/overview`
- `/analytics/academic/overview`
- `/analytics/finance/overview`
- `/admin/system/backups`
- `/principal/staff`
- `/admin/system/audit`
- `/admin/system/feature-flags`
- `/reports/downloads`
- `/finance/reconciliation/cash-drawers`
- `/finance/reconciliation/matches`
- `/aqa/performance/engine/runs`
- `/admin/system/settings`
- `/notifications/providers/health`

The authenticated smoke test also passed against the seeded admin user.

The seed script now fails deliberately if the smaller support tables are empty,
including notification templates/preferences/SMS logs, auth audit logs, academic
audit/intervention/subject-enrolment data, finance audit/manual-approval/group
membership data, e-learning lesson progress/quiz answers/discussion replies and
analytics generated reports/metric events.

## Test Scenarios

- Admin logs in and checks system settings, feature flags, audit records, reports
  and operational store records.
- Principal logs in and reviews staff, school overview, report card summaries,
  student profile data, academic analytics and finance analytics.
- AQA logs in and reviews academic performance, engine run records, at-risk
  students, subject trends and quality assurance data.
- HOD logs in and reviews department class subjects, pending assessment approval
  data, teacher performance and interventions.
- Teacher logs in and reviews assigned class subjects, timetable, assessments,
  marks, e-learning courses, submissions needing grading and course engagement.
- Student logs in and sees enrolled class, report card data, attendance,
  announcements, e-learning materials, assignments and quizzes.
- Parent logs in and sees linked children, finance status, reports, attendance,
  announcements and e-learning summary.
- Finance user logs in and reviews invoices, payments, receipts, fee categories,
  fee structures, assets, reconciliation records and collection analytics.

## Technical Notes

- Seeder entry point: `backend/scripts/seed-production-demo.js`.
- NPM command: `npm run seed:production-demo` from `backend/`.
- The seeder uses deterministic UUIDs and upserts where possible, so reruns do
  not duplicate the main demo data.
- The gateway operational modules are stored in
  `operations.operation_records` because dedicated relational tables do not yet
  exist for HR, library, hostel, transport, payroll, budget and reconciliation.
- Analytics initially failed because the analytics shadow Prisma schema modeled
  cross-schema enum columns as `String`. This was fixed by aligning those fields
  to the actual PostgreSQL enum types.
- No destructive database reset was performed. Existing test data was preserved.

## Deployment Status

- Backend changes were pushed to Git.
- VPS repository was pulled to the latest commit.
- Backend analytics service was rebuilt after schema correction.
- PM2 services were restarted and saved.
- Public health endpoint remains healthy:
  `https://srms.kilimanjaroschools.site/health`
