# Kilimanjaro Logic Fix Checklist

This file tracks application logic that needs to be implemented or reimplemented before production rollout. Each item should be discussed, built, tested locally, and then deployed.

## Implementation Status (2026-09-24)

The **core of all six focus areas is implemented, tested locally, and pushed to `main`.** A small set of refinements remains OUTSTANDING (listed below and left unchecked in the detailed lists). This summary is authoritative; individual checkboxes below reflect the same reality.

| Area | Status | Key commits |
|---|---|---|
| Super Admin School Editing | ✅ Done (preserved) | `0f9149b` |
| Schema foundation (nullable DOB, legacy admission, class combination) | ✅ Done | `cd8452b` |
| Predefined A-Level Combinations | ✅ Done (combo edit UI = create/delete only) | `d495406`, `78e1c50` |
| Class-first Student Import + A-Level Combination Import | ✅ Done (atomic rollback, subject-enrol reported/retryable) | `659ae39`, `ba7a6c2`, `4d8cf85`, `ba3a9bb` |
| Class-Focused Student Management | ✅ Done — full student + guardian CRUD; bulk actions partial | `5a4e437`, `ba3a9bb` |
| Admin User Management (delete, membership add/remove/move, linked records) | ✅ Done | `e72ad8d`, `4d8cf85`, `7789eae` |

**Design notes**
- Import is class-first (admin picks the class; it determines school/year/stage/stream/combination). It's a single importer that accepts legacy `.xlsx` (SheetJS) and normalized CSV — not a separate "Legacy Importer". Folder-as-school / filename-as-class auto-detection (production checklist) is intentionally not included.
- Import commit is failure-safe: the student DB write is one transaction, and a just-created auth account is rolled back if that write fails (shared parent accounts are left intact). A-Level subject enrolment result is reported and retryable, never silently swallowed.
- Student "delete" is archive-by-status (SUSPENDED / GRADUATED / TRANSFERRED); there is intentionally no student hard-delete. User hard-delete is safe-guarded (blocked for students/guardians/class-teachers with reasons).
- All validation runs on the backend at commit (not only the frontend).

**OUTSTANDING (not yet done)**
- Bulk actions on the class page beyond export: bulk gender fill, bulk A-Level combination assign, bulk promote, bulk deactivate, bulk default-guardian.
- Direct "edit a combination's subject list" UI (currently create + delete + reseed).
- A dedicated separate Legacy Importer (unified importer covers the same formats).
- Not-yet-exercised local tests: O-Level import, O-Level/A-Level class-page views, delete-blocked-for-guardian.
- Backend integration test suites use old demo credentials (DB was reseeded) and need their fixtures updated to pass in this environment.

## Latest Local Verification Before Production Deploy (2026-09-24)

- [x] Class import template download added for the class-first importer.
- [x] Class import commit timeout raised to 120 seconds; preview timeout raised to 30 seconds.
- [x] Student-service RabbitMQ reconnect attempts throttled so a broker outage does not slow every imported row.
- [x] Real Kilimanjaro Excel files parsed locally; headers match importer expectations.
- [x] `Class 2 - 2026 - Class list(1).xlsx` imported locally into `Class 2 A`: 82/82 imported in 11.5 seconds.
- [x] Admin dashboard student metric fixed to read `meta.total` instead of the first page of 20 rows.
- [x] Admin dashboard user metric clarified to count all account roles, including student and parent portal accounts.
- [x] Student profile optional sub-resource calls updated to existing backend endpoints and no longer retry 404/403 optional data.
- [x] Dashboard TypeScript check passed.
- [x] Dashboard production build passed.
- [x] Student-service tests passed.
- [ ] Production DB backup taken before deployment.
- [ ] Production code deployment completed.
- [ ] Production health check passed after deployment.
- [ ] Production admin dashboard verified after deployment.

## Super Admin School Editing

Issue: school names cannot be edited reliably from the super admin school management panel; editing currently returns errors.

- [x] Inspect super admin school edit UI.
- [x] Inspect backend school update endpoint.
- [x] Fix school name/code/type/gender editing from the management panel.
- [x] Verify super admin can edit a school name locally.
- [x] Include this fix when pushing to git and deploying.

Resolution: fixed backend school update validation by allowing `code` in `UpdateSchoolDto`, normalizing it, checking duplicate codes, and persisting it. Verified locally through the gateway by editing and restoring `Kilimanjaro Primary School`.

## Student Management Import Reimplementation

Issue: the current student import expects too many CSV fields and depends on `class_name` matching text. For real school data, imports should be class-first and tolerant of missing legacy data.

### Desired Flow

- [x] In Student Management, show the available classes before upload.
- [x] Admin selects the target class first.
- [x] Uploaded students are imported into the selected class.
- [x] The upload no longer requires `class_name` when a target class is selected.
- [x] The upload no longer requires `stream` when a target class is selected.
- [x] The selected class determines the school, academic year, education stage, and stream context.

### Legacy Importer

- [ ] Add a separate `Legacy Importer` for existing school class-list files.
- [x] Legacy importer accepts `.xlsx`.
- [x] Legacy importer accepts the current Kilimanjaro class-list format:
  - [x] `Admission Number`
  - [x] `Name`
  - [x] `Stream`
  - [x] `Contacts`
  - [x] `Gender`
- [x] Legacy importer can also accept normalized CSV where useful.
- [x] Legacy importer shows a preview before committing.

### A-Level Combination Import Logic

- [x] A-Level classes can be defined with a subject combination attached.
- [x] Admin can select a target such as `Form 5 HGE`, `Form 5 PCB`, `Form 6 HGE`, or `Form 6 PCB`.
- [x] When importing into an A-Level class, the selected class determines the combination.
- [x] Import does not require a separate combination column when the target class already has a combination.
- [x] If the uploaded file has a `Stream` value, use it as a warning/check only.
- [x] Warn when file stream/combination differs from the selected A-Level class combination.
- [x] Imported A-Level students should be enrolled into the selected combination subjects where configured.
- [x] Block A-Level import into a class that requires a combination but has no combination attached.

### Predefined A-Level Combinations

- [x] Provide a predefined list of common A-Level combinations.
- [x] Admin can select from predefined combinations when creating/editing A-Level classes.
- [x] Admin can add a missing combination if it does not exist.
- [ ] Admin can edit a combination's subject list.
- [x] Admin can attach the correct combination to a class easily.
- [x] Combination setup should validate required principal/subsidiary subject rules where configured.
- [x] Predefined combinations should not prevent custom school-specific combinations.

Suggested initial common combinations:

- [x] PCM - Physics, Chemistry, Advanced Mathematics
- [x] PCB - Physics, Chemistry, Biology
- [x] PGM - Physics, Geography, Advanced Mathematics
- [x] EGM - Economics, Geography, Advanced Mathematics
- [x] HGE - History, Geography, Economics
- [x] HKL - History, Kiswahili, Literature in English
- [x] HGL - History, Geography, Literature in English
- [x] CBG - Chemistry, Biology, Geography
- [x] CBA - Chemistry, Biology, Agriculture
- [x] ECA - Economics, Commerce, Accountancy/Book Keeping
- [x] HKE - History, Kiswahili, Economics

### Field Mapping

- [x] `Name` is split into `firstName`, `middleName`, and `lastName`.
- [x] Last word in `Name` becomes `lastName`.
- [x] Middle words become `middleName`.
- [x] Student password is generated from uppercase cleaned `lastName`.
- [x] `Gender` is normalized to `MALE` or `FEMALE` when present.
- [x] `Contacts` is normalized into guardian/contact phone when present.
- [x] `Admission Number` is preserved as a legacy/external admission number if the system supports it.
- [x] If legacy admission number is not yet supported, add support before final import.

### Nullable Legacy Fields

- [x] Date of birth can be nullable during legacy import.
- [x] Guardian first name can be nullable during legacy import.
- [x] Guardian last name can be nullable during legacy import.
- [x] Guardian relationship can default to `GUARDIAN`.
- [x] Guardian phone/contact can be nullable during legacy import.
- [x] Stream can be ignored when target class is selected.
- [x] Nationality can default to `Tanzanian`.
- [x] Admission date can default to the import date or selected academic year start date.

### Validation Rules

- [x] Block import if student name is missing.
- [x] Block import if target class is missing or invalid.
- [x] Block import if the target class is not in the admin's selected/in-scope school.
- [x] Block duplicate admission numbers within the same school when admission number is present.
- [x] If school gender is `MALE`, missing student gender should auto-fill as `MALE`.
- [x] If school gender is `FEMALE`, missing student gender should auto-fill as `FEMALE`.
- [x] If school gender is `BOTH`, missing student gender should block import for that row.
- [x] If provided gender conflicts with school gender, block import for that row.
- [x] Warn, but do not block, when contact is missing.
- [x] Warn, but do not block, when date of birth is missing.
- [x] Warn, but do not block, when stream from the file differs from selected class stream.

### Clear Row-Level Error Messages

- [x] Every validation error should include the row number.
- [x] Every validation error should include the student name when available.
- [x] Missing-field errors should name the exact missing field.
- [x] Conflict errors should name the conflicting value and the expected value.
- [x] For rows with no name, use row number and admission number when available.

Example messages:

- [ ] `Row 24, Asha Juma: gender is missing and Kilimanjaro Primary School accepts both male and female students. Add gender before import.`
- [ ] `Row 12, Neema Ally: gender FEMALE is not allowed in Kilimanjaro Modern Boys Secondary School, which is configured as MALE only.`
- [ ] `Row 8, Admission KISS401: student name is missing. Add Name before import.`
- [ ] `Row 31, Baraka Musa: selected class Form 5 HGE requires combination HGE, but no HGE combination is configured.`
- [ ] `Row 17, Halima Said: file stream PCB differs from selected class Form 5 HGE. Confirm the selected class or correct the file.`

### School Scope And Safety

- [x] Import must always derive `schoolId` from the selected class.
- [x] Import must never send students to all schools.
- [x] School admin can only import into classes in their own school scope.
- [x] Super admin can choose any school/class.
- [x] Preview must display selected school, class, stream, and academic year.
- [x] Commit must use backend validation, not only frontend validation.

### Testing

- [x] Test import into one selected Primary class.
- [ ] Test import into one selected O-Level class.
- [x] Test import into one selected A-Level class.
- [x] Test missing contacts.
- [x] Test missing gender.
- [x] Test duplicate admission numbers.
- [x] Test school admin cannot import into another school's class.
- [x] Test generated student login password.
- [x] Test student account can log in after import.
- [x] Test imported student appears only under the selected school/class.

## Class-Focused Student Management

Issue: after importing and setting up classes, admins need a dedicated, reliable page for managing students by class. The current flow should be reworked so staff can quickly see who is in each class, which profiles are incomplete, which students have guardians attached, and what actions are still needed.

### Desired Page Structure

- [x] Add a dedicated class student page.
- [x] Route example: `/admin/classes/:classId/students`.
- [x] The page title should show the selected class, school, stream, stage, and academic year.
- [x] The page should load students only for the selected class.
- [x] The page must respect school scope.
- [x] School admins can only open classes in their school.
- [x] Super admin/system admin can open any class.

### Class Student Overview

- [x] Show total students in the selected class.
- [x] Show active students.
- [x] Show inactive/transferred/graduated students where applicable.
- [x] Show students with guardians attached.
- [x] Show students without guardians attached.
- [x] Show complete profiles.
- [x] Show incomplete profiles.
- [x] Show gender breakdown.
- [x] Show missing gender count.
- [x] Show missing date of birth count.
- [x] Show missing contact/guardian count.
- [x] Show A-Level combination count if class is A-Level.

### Student Table Requirements

- [x] Display registration number.
- [x] Display legacy/admission number if available.
- [x] Display full student name.
- [x] Display gender.
- [x] Display class/stream.
- [x] Display profile completeness status.
- [x] Display guardian status.
- [x] Display primary guardian name.
- [x] Display primary guardian phone.
- [x] Display account/login status.
- [x] Display student status.
- [x] Display last updated date.

Suggested table status labels:

- [x] `Complete`
- [x] `Missing DOB`
- [x] `Missing Gender`
- [x] `No Guardian`
- [x] `Guardian Missing Phone`
- [x] `No Login Account`
- [x] `Inactive`
- [x] `Transferred`
- [x] `Graduated`

### Filtering And Search

- [x] Search by student name.
- [x] Search by registration number.
- [x] Search by legacy/admission number.
- [x] Filter by gender.
- [x] Filter by profile completeness.
- [x] Filter by guardian attached/missing.
- [x] Filter by student status.
- [x] Filter by A-Level combination where applicable.
- [x] Filter by missing critical data.

### Profile Completeness Logic

- [x] Define a clear profile completeness calculation.
- [x] Minimum complete student profile should include:
  - [x] First name.
  - [x] Last name.
  - [x] Gender.
  - [x] Class/enrolment.
  - [x] Active auth user account.
- [x] Full complete student profile should include:
  - [x] Date of birth.
  - [x] Nationality.
  - [x] Admission date.
  - [x] Guardian attached.
  - [x] Primary guardian phone.
  - [x] Required stage-specific exam identifiers where applicable.
- [x] Profile completeness should be returned by backend or calculated consistently in one frontend helper.
- [x] UI should explain exactly what is missing per student.

Example missing profile message:

- [ ] `Asha Juma is missing: date of birth, guardian phone.`
- [ ] `Juma Ally has no guardian attached.`
- [ ] `Halima Said has no active login account.`

### Guardian Management From Student Page

- [x] Add guardian to student.
- [x] Edit guardian details.
- [x] Link existing guardian account by phone/email.
- [x] Create new guardian account.
- [x] Mark guardian as primary.
- [x] Remove/unlink guardian from student.
- [x] Show all guardians linked to the student.
- [x] Show whether guardian has a login account.
- [x] Prevent duplicate guardian links.
- [x] Support siblings sharing the same guardian account.

### Student CRUD Operations

- [x] Create student manually inside a selected class.
- [x] View student full profile.
- [x] Edit student basic details.
- [x] Edit student class/enrolment.
- [x] Edit student status.
- [x] Deactivate student.
- [x] Reactivate student.
- [x] Transfer student to another class in same school.
- [x] Transfer student to another school where allowed.
- [x] Graduate student.
- [ ] Delete student only when safe.
- [ ] Prevent destructive delete when student has dependent records unless explicitly supported.
- [x] If hard delete is blocked, provide archive/deactivate instead.
- [x] Every failure should return a clear user-facing message.

### Student Account Operations

- [x] Create missing student auth account.
- [x] Reset student password.
- [x] Show generated temporary password after reset/create.
- [x] Link existing auth user to student profile where safe.
- [x] Unlink invalid auth user only when safe.
- [x] Ensure student login registration number matches student profile registration number.
- [x] Ensure imported students can log in.

### Bulk Actions From Class Student Page

- [ ] Bulk attach default guardian placeholder where allowed.
- [x] Bulk export students.
- [x] Bulk export missing-data report.
- [ ] Bulk update gender where school is gender-specific and gender is missing.
- [ ] Bulk assign A-Level combination subjects.
- [ ] Bulk promote selected students through configured pathway.
- [ ] Bulk deactivate selected students with confirmation.

### Backend Requirements

- [x] Add or verify endpoint for class student list with guardian/profile/account summary.
- [x] Suggested endpoint: `GET /students/classes/:classId/students`.
- [x] Response should include guardian summary.
- [x] Response should include profile completeness summary.
- [x] Response should include auth account status.
- [x] Response should include active enrolment details.
- [x] Endpoint must enforce school scope.
- [x] Endpoint must be paginated for large classes.
- [x] Endpoint should support filters and search.
- [x] CRUD endpoints must use transactions where multiple records are touched.
- [x] All writes must derive/validate `schoolId` from selected class or existing enrolment.

### Testing

- [x] Test class page for Primary class.
- [ ] Test class page for O-Level class.
- [ ] Test class page for A-Level class.
- [x] Test student with guardian.
- [x] Test student without guardian.
- [x] Test incomplete profile.
- [x] Test completed profile.
- [x] Test school admin cannot view another school's class students.
- [x] Test super admin can view all class students.
- [x] Test edit student.
- [x] Test add guardian.
- [x] Test unlink guardian.
- [x] Test transfer student.
- [x] Test reset password.
- [x] Test delete/deactivate behavior.

## Admin User Management Fixes

Issue: admins cannot reliably delete users or move users between schools. User management needs clear, safe operations for deactivation, deletion, school reassignment, and membership changes.

### User Delete / Deactivate Logic

- [x] Add clear admin action for deactivating a user.
- [x] Add clear admin action for reactivating a user.
- [x] Add clear admin action for deleting a user where safe.
- [x] Prefer deactivate/archive when the user has dependent records.
- [x] Hard delete should be blocked when it would break student, guardian, teacher, audit, finance, or academic history.
- [x] Delete failure should explain exactly why deletion is blocked.
- [x] UI should offer the safe alternative when hard delete is blocked.

Example messages:

- [x] `This user cannot be deleted because they are linked to a student profile. Deactivate the account instead.`
- [x] `This teacher cannot be deleted because they are assigned to classes. Remove assignments first or deactivate the account.`
- [x] `This guardian cannot be deleted because they are linked to active students. Unlink the guardian first or deactivate the account.`

### User School Movement / Membership Logic

- [x] Add UI to view all school memberships for a user.
- [x] Add school membership to a user.
- [x] Remove school membership from a user.
- [x] Move user from one school to another.
- [x] Support multi-school users where role allows it.
- [x] Prevent school movement when it violates role rules.
- [x] Prevent moving a student user without moving the student enrolment/profile correctly.
- [x] Prevent moving a guardian user without considering linked students.
- [x] Moving staff should update school membership and related assignments where needed.
- [x] Moving students should be handled through student transfer/enrolment flow, not only auth membership.
- [x] Every membership change must be audited.

### Role-Specific Movement Rules

- [x] `SUPER_ADMIN` remains group scoped and should not be assigned to a single school.
- [x] `SYSTEM_ADMIN` can remain group scoped unless intentionally school-scoped.
- [x] `HEAD_OF_SCHOOL`, `TEACHER`, `FINANCE`, `ADMISSIONS`, and similar school roles require a school membership.
- [x] `STUDENT` school movement requires student transfer logic.
- [x] `PARENT/GUARDIAN` school access should come from linked students or explicit guardian membership.

### Backend Requirements

- [x] Verify existing deactivate endpoint works from UI.
- [x] Implement safe delete endpoint if missing.
- [x] Implement user membership update endpoints if missing.
- [x] Membership updates must validate actor scope.
- [x] Membership updates must use transactions.
- [x] Membership updates must create audit logs.
- [x] Return clear errors for blocked deletes/moves.

### UI Requirements

- [x] User detail page should show memberships.
- [x] User detail page should show linked student/guardian/staff records.
- [x] User detail page should show why delete is blocked.
- [x] User detail page should allow deactivate/reactivate.
- [x] User detail page should allow safe school membership edits.
- [x] User detail page should distinguish between auth account operations and student/staff profile operations.

### Testing

- [x] Test delete/deactivate normal staff user.
- [x] Test delete blocked for linked student user.
- [ ] Test delete blocked for linked guardian user.
- [x] Test move teacher to another school.
- [ ] Test move school admin to another school.
- [x] Test student movement uses student transfer logic.
- [x] Test school admin cannot move user into another school outside scope.
- [x] Test super admin can manage memberships across schools.
- [x] Test audit log is written.
