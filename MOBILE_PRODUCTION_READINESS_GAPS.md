# Mobile Production Readiness Gaps

## Scope

This document covers the Kilimanjaro Flutter mobile application for these roles:

- Student
- Parent
- Teacher
- Head of Department (HOD)
- Admissions

The application is not production-ready until the gaps below are closed and the release gate passes.

## 1. Mobile API Contract Alignment

### Gap

Teacher and HOD services call generic endpoints such as `/teacher/*` and `/hod/*`, while the API gateway provides dedicated mobile routes under `/mobile/teacher/*` and `/mobile/hod/*`. Several clients also guess response shapes by checking keys such as `items`, `data`, and `results`.

This can make a server failure or contract mismatch appear as an empty screen.

### Required implementation

- Define one versioned API contract for every mobile role and workflow.
- Use the dedicated `/mobile/...` gateway endpoints as the mobile API surface.
- Replace response-shape guessing with typed DTOs and explicit parsers.
- Keep endpoint paths, request bodies, and response models documented in one contract file.
- Add contract tests for successful, validation-error, forbidden, and unauthenticated responses.

### Completion evidence

- Every mobile endpoint has a documented request/response DTO.
- Each role can access only records in its authorized school, class, department, or family scope.
- Contract tests pass in CI against the staging API.

## 2. Centralized API Error Handling and Session Recovery

### Gap

Several services catch `DioException` and return an empty list or `null`. This hides authentication failures, authorization failures, timeouts, and backend errors from users.

### Required implementation

- Create one shared Dio client with interceptors for authentication, refresh, correlation IDs, and error conversion.
- Convert failures to typed application states: unauthenticated, forbidden, validation, offline, timeout, and server failure.
- Refresh an expired access token once. On refresh failure, clear the secure session and route to login.
- Render loading, empty, error, and retry states distinctly on every data screen.
- Capture production errors in monitoring with PII redaction.

### Completion evidence

- A 401 routes users to login after refresh fails.
- A 403 shows a permission message, not an empty page.
- A 500 and offline condition show retry controls and do not erase existing cached data.

## 3. Student E-Learning Uses Localhost

### Gap

The student E-Learning screen hardcodes `http://localhost:3000`. On a real phone, localhost is the phone itself, not the production backend.

### Required implementation

- Route every request through `AppConfig.apiBaseUrl`.
- Require an HTTPS production API URL at build time: `https://srms.kilimanjaroschools.site`.
- Keep separate local, staging, and production environment files.
- Reject release builds with missing, localhost, or non-HTTPS API configuration.

### Completion evidence

- Student lessons, materials, quizzes, progress, videos, downloads, and uploads work on a physical device using mobile data.

## 4. Teacher E-Learning Uses Placeholder IDs

### Gap

Teacher E-Learning navigation contains fixed identifiers such as `lesson-linear` and `quiz-linear`. These are not records from the backend.

### Required implementation

- Fetch assigned courses, lessons, materials, quizzes, submissions, and progress from the API.
- Navigate only with IDs returned by the backend.
- Persist lesson creation, material upload, quiz creation, publishing, grading, and learner feedback.
- Restrict access to the teacher's allocated courses, subjects, and classes.

### Completion evidence

- A teacher can create and publish real course content, and an authorized student can consume it.
- Unauthorized teachers cannot access another teacher's course or submissions.

## 5. Teacher Announcement and Intervention Actions Do Not Persist

### Gap

The teacher announcement composer and intervention workflow have UI paths that do not create persistent backend records. The intervention save action currently only confirms in the interface.

### Required implementation

- Add authenticated teacher announcement and intervention endpoints.
- Create typed request DTOs and validate school/class/student ownership on the server.
- Refresh the affected list after a successful mutation.
- Show server validation errors and prevent duplicate submissions.
- Record auditable events for publication and intervention changes.

### Completion evidence

- A saved announcement is visible to its intended recipients after app restart.
- A saved intervention is visible to the teacher, HOD, and authorized school administrators.

## 6. HOD Actions Are Incomplete or Use Incorrect Navigation

### Gap

The HOD announcement composer is a placeholder. HOD intervention actions route to a Teacher path rather than a HOD-specific workflow.

### Required implementation

- Implement HOD announcement submission against an HOD-authorized endpoint.
- Build a dedicated HOD intervention workflow and route.
- Validate department, subject, class, and school scope server-side.
- Support HOD approval, rejection, feedback, analytics, announcements, and escalations using real data.

### Completion evidence

- HOD users can complete every available action without entering a Teacher route.
- Department boundaries are enforced by backend authorization tests.

## 7. Parent Contact and Comparison Data Are Placeholders

### Gap

Parent class averages deliberately return an empty map. School contact details are hardcoded to a generic Kilimanjaro School response.

### Required implementation

- Decide whether privacy-safe class comparisons are allowed for parents.
- If allowed, expose aggregated comparison data only; never expose other students' identities or individual results.
- Add a token-scoped school-contact endpoint derived from the selected child and school configuration.
- Remove hardcoded school names, addresses, phone numbers, and office hours.
- Verify all parent endpoints validate the parent-child relationship on the server.

### Completion evidence

- A parent with children in different schools sees each child's real school contact details.
- A parent cannot request data for an unlinked student ID.

## 8. Admissions Lifecycle Is Partial

### Gap

Mobile Admissions supports inquiry creation, lists, details, and stage transition. It does not implement the full backend lifecycle.

### Required implementation

- Implement applicant edit/update.
- Implement assessment or interview scheduling.
- Implement assessment score/outcome recording.
- Implement offer issuance and re-issuance.
- Implement guardian offer decision recording.
- Implement conversion of an accepted applicant to an enrolled student.
- Show allowed transitions from backend state, not hardcoded client assumptions.
- Add idempotency safeguards so an applicant cannot be converted twice.

### Completion evidence

- An Admissions user completes: Inquiry -> Application -> Assessment -> Offer -> Decision -> Enrolment.
- The resulting student, account, class, school, and audit records are correct.

## 9. Push Notifications Are Not Implemented End-to-End

### Gap

The application has notification screens and preferences, but production push delivery has not been implemented and verified through Firebase Cloud Messaging (FCM).

### Required implementation

- Configure Firebase Messaging for Android and iOS.
- Request notification permissions at the correct point in the user journey.
- Register, refresh, and revoke device tokens against the authenticated user.
- Handle notifications in foreground, background, and terminated states.
- Deep-link each notification to the relevant record, such as a result, invoice, announcement, or task.
- Delete invalid device tokens after provider failures.

### Completion evidence

- Push notifications deliver to physical Android and iOS devices.
- Tapping each notification opens the correct authenticated screen.

## 10. Offline and Weak-Network Behavior

### Gap

Current behavior does not reliably distinguish offline state from empty data. Important school workflows may be used on weak connections.

### Required implementation

- Cache read-only content with expiry and a visible last-updated timestamp.
- Provide retry actions for failed reads.
- Queue only safe, idempotent writes locally where conflicts can be handled, such as attendance drafts.
- Do not blindly retry marks, payments, admissions conversion, account creation, or other non-idempotent mutations.
- Use idempotency keys for server-supported write operations.

### Completion evidence

- The application remains understandable in airplane mode and recovers cleanly when connectivity returns.
- Duplicate submissions cannot create duplicate attendance, marks, students, or payments.

## 11. Automated Test Coverage Is Insufficient

### Gap

The mobile test directory currently has a placeholder widget test only. There is no meaningful regression coverage for role workflows or API behavior.

### Required implementation

- Add unit tests for DTO mapping, token refresh/logout, validation, and API error conversion.
- Add widget tests for login, forms, loading, empty, error, retry, and permission states.
- Add integration tests for each role:
  - Student: results, attendance, fees, E-Learning.
  - Parent: child switching, reports, invoices, school contact.
  - Teacher: attendance, marks, approval submission, interventions.
  - HOD: approvals, department analytics, announcements, interventions.
  - Admissions: applicant-to-student conversion.
- Test real Android release builds on physical devices and mobile data.

### Completion evidence

- Automated test suites run in CI.
- Critical role journeys pass against staging before every production release.

## 12. Security, Configuration, and Operations

### Gap

The fallback API base URL is localhost. Production monitoring, release signing, privacy handling, and support processes require explicit completion.

### Required implementation

- Require a production HTTPS API URL at build time.
- Keep access and refresh tokens only in `flutter_secure_storage`.
- Never include backend secrets, passwords, private keys, or JWT signing keys in the app or environment file.
- Configure Android release signing and appropriate distribution controls.
- Add crash/error monitoring with PII redaction.
- Publish privacy policy, account deletion/support workflow, and data-retention information.
- Verify API TLS, CORS, rate limits, token expiry, and role authorization against staging and production.

### Completion evidence

- A release artifact is signed, uses only HTTPS production services, and contains no development credentials or localhost endpoints.
- Monitoring receives actionable, redacted crash and API-failure reports.

## Recommended Delivery Order

1. Establish the mobile API contract and shared API/error layer.
2. Remove localhost and placeholder IDs from E-Learning.
3. Complete persistent Teacher and HOD actions.
4. Complete Parent contact/comparison data with privacy controls.
5. Complete the full Admissions lifecycle.
6. Implement FCM and offline behavior.
7. Add automated tests, release configuration, monitoring, and physical-device acceptance testing.

## Production Release Gate

Do not release the mobile application until all conditions below are met:

- [ ] Every displayed workflow uses a real, authenticated production-equivalent API endpoint.
- [ ] No localhost URL, fake ID, static school data, or UI-only save action remains.
- [ ] API errors, expired sessions, and offline conditions are visible and recoverable.
- [ ] Role and school scope is tested for Student, Parent, Teacher, HOD, and Admissions accounts.
- [ ] Push notifications work on physical devices and deep-link correctly.
- [ ] Critical workflows have unit, widget, integration, and staging end-to-end coverage.
- [ ] Android release build is signed, analyzed, tested on real devices, and verified against staging.
- [ ] Production API TLS, authorization, logs, monitoring, privacy, and support procedures are approved.
