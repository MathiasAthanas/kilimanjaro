# Kilimanjaro Logic Fix Checklist

This file tracks application logic that needs to be implemented or reimplemented before production rollout. Each item should be discussed, built, tested locally, and then deployed.

## Implementation Status (2026-09-24)

All six focus areas implemented, tested locally, and pushed to `main`:

| Area | Status | Key commits |
|---|---|---|
| Super Admin School Editing | ✅ Done (preserved) | `0f9149b` |
| Schema foundation (nullable DOB, legacy admission, class combination) | ✅ Done | `cd8452b` |
| Predefined A-Level Combinations | ✅ Done | `d495406`, `78e1c50` |
| Student Import Reimplementation (class-first) + A-Level Combination Import | ✅ Done | `659ae39`, `ba7a6c2` |
| Class-Focused Student Management | ✅ Done | `5a4e437` |
| Admin User Management (safe delete, membership movement) | ✅ Done | `e72ad8d` |

Notes:
- Legacy `.xlsx` import uses SheetJS; import is class-first (the class determines school/year/stage/stream/combination). Folder-as-school / filename-as-class auto-detection from the production checklist is not part of this UI (admin picks the class explicitly).
- Backend enforces all validation on commit (not only the frontend).
- Verified locally against the live dev DB (schools incl. gender-specific ones); all 8 services healthy after changes.

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

- [ ] In Student Management, show the available classes before upload.
- [ ] Admin selects the target class first.
- [ ] Uploaded students are imported into the selected class.
- [ ] The upload no longer requires `class_name` when a target class is selected.
- [ ] The upload no longer requires `stream` when a target class is selected.
- [ ] The selected class determines the school, academic year, education stage, and stream context.

### Legacy Importer

- [ ] Add a separate `Legacy Importer` for existing school class-list files.
- [ ] Legacy importer accepts `.xlsx`.
- [ ] Legacy importer accepts the current Kilimanjaro class-list format:
  - [ ] `Admission Number`
  - [ ] `Name`
  - [ ] `Stream`
  - [ ] `Contacts`
  - [ ] `Gender`
- [ ] Legacy importer can also accept normalized CSV where useful.
- [ ] Legacy importer shows a preview before committing.

### A-Level Combination Import Logic

- [ ] A-Level classes can be defined with a subject combination attached.
- [ ] Admin can select a target such as `Form 5 HGE`, `Form 5 PCB`, `Form 6 HGE`, or `Form 6 PCB`.
- [ ] When importing into an A-Level class, the selected class determines the combination.
- [ ] Import does not require a separate combination column when the target class already has a combination.
- [ ] If the uploaded file has a `Stream` value, use it as a warning/check only.
- [ ] Warn when file stream/combination differs from the selected A-Level class combination.
- [ ] Imported A-Level students should be enrolled into the selected combination subjects where configured.
- [ ] Block A-Level import into a class that requires a combination but has no combination attached.

### Predefined A-Level Combinations

- [ ] Provide a predefined list of common A-Level combinations.
- [ ] Admin can select from predefined combinations when creating/editing A-Level classes.
- [ ] Admin can add a missing combination if it does not exist.
- [ ] Admin can edit a combination's subject list.
- [ ] Admin can attach the correct combination to a class easily.
- [ ] Combination setup should validate required principal/subsidiary subject rules where configured.
- [ ] Predefined combinations should not prevent custom school-specific combinations.

Suggested initial common combinations:

- [ ] PCM - Physics, Chemistry, Advanced Mathematics
- [ ] PCB - Physics, Chemistry, Biology
- [ ] PGM - Physics, Geography, Advanced Mathematics
- [ ] EGM - Economics, Geography, Advanced Mathematics
- [ ] HGE - History, Geography, Economics
- [ ] HKL - History, Kiswahili, Literature in English
- [ ] HGL - History, Geography, Literature in English
- [ ] CBG - Chemistry, Biology, Geography
- [ ] CBA - Chemistry, Biology, Agriculture
- [ ] ECA - Economics, Commerce, Accountancy/Book Keeping
- [ ] HKE - History, Kiswahili, Economics

### Field Mapping

- [ ] `Name` is split into `firstName`, `middleName`, and `lastName`.
- [ ] Last word in `Name` becomes `lastName`.
- [ ] Middle words become `middleName`.
- [ ] Student password is generated from uppercase cleaned `lastName`.
- [ ] `Gender` is normalized to `MALE` or `FEMALE` when present.
- [ ] `Contacts` is normalized into guardian/contact phone when present.
- [ ] `Admission Number` is preserved as a legacy/external admission number if the system supports it.
- [ ] If legacy admission number is not yet supported, add support before final import.

### Nullable Legacy Fields

- [ ] Date of birth can be nullable during legacy import.
- [ ] Guardian first name can be nullable during legacy import.
- [ ] Guardian last name can be nullable during legacy import.
- [ ] Guardian relationship can default to `GUARDIAN`.
- [ ] Guardian phone/contact can be nullable during legacy import.
- [ ] Stream can be ignored when target class is selected.
- [ ] Nationality can default to `Tanzanian`.
- [ ] Admission date can default to the import date or selected academic year start date.

### Validation Rules

- [ ] Block import if student name is missing.
- [ ] Block import if target class is missing or invalid.
- [ ] Block import if the target class is not in the admin's selected/in-scope school.
- [ ] Block duplicate admission numbers within the same school when admission number is present.
- [ ] If school gender is `MALE`, missing student gender should auto-fill as `MALE`.
- [ ] If school gender is `FEMALE`, missing student gender should auto-fill as `FEMALE`.
- [ ] If school gender is `BOTH`, missing student gender should block import for that row.
- [ ] If provided gender conflicts with school gender, block import for that row.
- [ ] Warn, but do not block, when contact is missing.
- [ ] Warn, but do not block, when date of birth is missing.
- [ ] Warn, but do not block, when stream from the file differs from selected class stream.

### Clear Row-Level Error Messages

- [ ] Every validation error should include the row number.
- [ ] Every validation error should include the student name when available.
- [ ] Missing-field errors should name the exact missing field.
- [ ] Conflict errors should name the conflicting value and the expected value.
- [ ] For rows with no name, use row number and admission number when available.

Example messages:

- [ ] `Row 24, Asha Juma: gender is missing and Kilimanjaro Primary School accepts both male and female students. Add gender before import.`
- [ ] `Row 12, Neema Ally: gender FEMALE is not allowed in Kilimanjaro Modern Boys Secondary School, which is configured as MALE only.`
- [ ] `Row 8, Admission KISS401: student name is missing. Add Name before import.`
- [ ] `Row 31, Baraka Musa: selected class Form 5 HGE requires combination HGE, but no HGE combination is configured.`
- [ ] `Row 17, Halima Said: file stream PCB differs from selected class Form 5 HGE. Confirm the selected class or correct the file.`

### School Scope And Safety

- [ ] Import must always derive `schoolId` from the selected class.
- [ ] Import must never send students to all schools.
- [ ] School admin can only import into classes in their own school scope.
- [ ] Super admin can choose any school/class.
- [ ] Preview must display selected school, class, stream, and academic year.
- [ ] Commit must use backend validation, not only frontend validation.

### Testing

- [ ] Test import into one selected Primary class.
- [ ] Test import into one selected O-Level class.
- [ ] Test import into one selected A-Level class.
- [ ] Test missing contacts.
- [ ] Test missing gender.
- [ ] Test duplicate admission numbers.
- [ ] Test school admin cannot import into another school's class.
- [ ] Test generated student login password.
- [ ] Test student account can log in after import.
- [ ] Test imported student appears only under the selected school/class.

## Class-Focused Student Management

Issue: after importing and setting up classes, admins need a dedicated, reliable page for managing students by class. The current flow should be reworked so staff can quickly see who is in each class, which profiles are incomplete, which students have guardians attached, and what actions are still needed.

### Desired Page Structure

- [ ] Add a dedicated class student page.
- [ ] Route example: `/admin/classes/:classId/students`.
- [ ] The page title should show the selected class, school, stream, stage, and academic year.
- [ ] The page should load students only for the selected class.
- [ ] The page must respect school scope.
- [ ] School admins can only open classes in their school.
- [ ] Super admin/system admin can open any class.

### Class Student Overview

- [ ] Show total students in the selected class.
- [ ] Show active students.
- [ ] Show inactive/transferred/graduated students where applicable.
- [ ] Show students with guardians attached.
- [ ] Show students without guardians attached.
- [ ] Show complete profiles.
- [ ] Show incomplete profiles.
- [ ] Show gender breakdown.
- [ ] Show missing gender count.
- [ ] Show missing date of birth count.
- [ ] Show missing contact/guardian count.
- [ ] Show A-Level combination count if class is A-Level.

### Student Table Requirements

- [ ] Display registration number.
- [ ] Display legacy/admission number if available.
- [ ] Display full student name.
- [ ] Display gender.
- [ ] Display class/stream.
- [ ] Display profile completeness status.
- [ ] Display guardian status.
- [ ] Display primary guardian name.
- [ ] Display primary guardian phone.
- [ ] Display account/login status.
- [ ] Display student status.
- [ ] Display last updated date.

Suggested table status labels:

- [ ] `Complete`
- [ ] `Missing DOB`
- [ ] `Missing Gender`
- [ ] `No Guardian`
- [ ] `Guardian Missing Phone`
- [ ] `No Login Account`
- [ ] `Inactive`
- [ ] `Transferred`
- [ ] `Graduated`

### Filtering And Search

- [ ] Search by student name.
- [ ] Search by registration number.
- [ ] Search by legacy/admission number.
- [ ] Filter by gender.
- [ ] Filter by profile completeness.
- [ ] Filter by guardian attached/missing.
- [ ] Filter by student status.
- [ ] Filter by A-Level combination where applicable.
- [ ] Filter by missing critical data.

### Profile Completeness Logic

- [ ] Define a clear profile completeness calculation.
- [ ] Minimum complete student profile should include:
  - [ ] First name.
  - [ ] Last name.
  - [ ] Gender.
  - [ ] Class/enrolment.
  - [ ] Active auth user account.
- [ ] Full complete student profile should include:
  - [ ] Date of birth.
  - [ ] Nationality.
  - [ ] Admission date.
  - [ ] Guardian attached.
  - [ ] Primary guardian phone.
  - [ ] Required stage-specific exam identifiers where applicable.
- [ ] Profile completeness should be returned by backend or calculated consistently in one frontend helper.
- [ ] UI should explain exactly what is missing per student.

Example missing profile message:

- [ ] `Asha Juma is missing: date of birth, guardian phone.`
- [ ] `Juma Ally has no guardian attached.`
- [ ] `Halima Said has no active login account.`

### Guardian Management From Student Page

- [ ] Add guardian to student.
- [ ] Edit guardian details.
- [ ] Link existing guardian account by phone/email.
- [ ] Create new guardian account.
- [ ] Mark guardian as primary.
- [ ] Remove/unlink guardian from student.
- [ ] Show all guardians linked to the student.
- [ ] Show whether guardian has a login account.
- [ ] Prevent duplicate guardian links.
- [ ] Support siblings sharing the same guardian account.

### Student CRUD Operations

- [ ] Create student manually inside a selected class.
- [ ] View student full profile.
- [ ] Edit student basic details.
- [ ] Edit student class/enrolment.
- [ ] Edit student status.
- [ ] Deactivate student.
- [ ] Reactivate student.
- [ ] Transfer student to another class in same school.
- [ ] Transfer student to another school where allowed.
- [ ] Graduate student.
- [ ] Delete student only when safe.
- [ ] Prevent destructive delete when student has dependent records unless explicitly supported.
- [ ] If hard delete is blocked, provide archive/deactivate instead.
- [ ] Every failure should return a clear user-facing message.

### Student Account Operations

- [ ] Create missing student auth account.
- [ ] Reset student password.
- [ ] Show generated temporary password after reset/create.
- [ ] Link existing auth user to student profile where safe.
- [ ] Unlink invalid auth user only when safe.
- [ ] Ensure student login registration number matches student profile registration number.
- [ ] Ensure imported students can log in.

### Bulk Actions From Class Student Page

- [ ] Bulk attach default guardian placeholder where allowed.
- [ ] Bulk export students.
- [ ] Bulk export missing-data report.
- [ ] Bulk update gender where school is gender-specific and gender is missing.
- [ ] Bulk assign A-Level combination subjects.
- [ ] Bulk promote selected students through configured pathway.
- [ ] Bulk deactivate selected students with confirmation.

### Backend Requirements

- [ ] Add or verify endpoint for class student list with guardian/profile/account summary.
- [ ] Suggested endpoint: `GET /students/classes/:classId/students`.
- [ ] Response should include guardian summary.
- [ ] Response should include profile completeness summary.
- [ ] Response should include auth account status.
- [ ] Response should include active enrolment details.
- [ ] Endpoint must enforce school scope.
- [ ] Endpoint must be paginated for large classes.
- [ ] Endpoint should support filters and search.
- [ ] CRUD endpoints must use transactions where multiple records are touched.
- [ ] All writes must derive/validate `schoolId` from selected class or existing enrolment.

### Testing

- [ ] Test class page for Primary class.
- [ ] Test class page for O-Level class.
- [ ] Test class page for A-Level class.
- [ ] Test student with guardian.
- [ ] Test student without guardian.
- [ ] Test incomplete profile.
- [ ] Test completed profile.
- [ ] Test school admin cannot view another school's class students.
- [ ] Test super admin can view all class students.
- [ ] Test edit student.
- [ ] Test add guardian.
- [ ] Test unlink guardian.
- [ ] Test transfer student.
- [ ] Test reset password.
- [ ] Test delete/deactivate behavior.

## Admin User Management Fixes

Issue: admins cannot reliably delete users or move users between schools. User management needs clear, safe operations for deactivation, deletion, school reassignment, and membership changes.

### User Delete / Deactivate Logic

- [ ] Add clear admin action for deactivating a user.
- [ ] Add clear admin action for reactivating a user.
- [ ] Add clear admin action for deleting a user where safe.
- [ ] Prefer deactivate/archive when the user has dependent records.
- [ ] Hard delete should be blocked when it would break student, guardian, teacher, audit, finance, or academic history.
- [ ] Delete failure should explain exactly why deletion is blocked.
- [ ] UI should offer the safe alternative when hard delete is blocked.

Example messages:

- [ ] `This user cannot be deleted because they are linked to a student profile. Deactivate the account instead.`
- [ ] `This teacher cannot be deleted because they are assigned to classes. Remove assignments first or deactivate the account.`
- [ ] `This guardian cannot be deleted because they are linked to active students. Unlink the guardian first or deactivate the account.`

### User School Movement / Membership Logic

- [ ] Add UI to view all school memberships for a user.
- [ ] Add school membership to a user.
- [ ] Remove school membership from a user.
- [ ] Move user from one school to another.
- [ ] Support multi-school users where role allows it.
- [ ] Prevent school movement when it violates role rules.
- [ ] Prevent moving a student user without moving the student enrolment/profile correctly.
- [ ] Prevent moving a guardian user without considering linked students.
- [ ] Moving staff should update school membership and related assignments where needed.
- [ ] Moving students should be handled through student transfer/enrolment flow, not only auth membership.
- [ ] Every membership change must be audited.

### Role-Specific Movement Rules

- [ ] `SUPER_ADMIN` remains group scoped and should not be assigned to a single school.
- [ ] `SYSTEM_ADMIN` can remain group scoped unless intentionally school-scoped.
- [ ] `HEAD_OF_SCHOOL`, `TEACHER`, `FINANCE`, `ADMISSIONS`, and similar school roles require a school membership.
- [ ] `STUDENT` school movement requires student transfer logic.
- [ ] `PARENT/GUARDIAN` school access should come from linked students or explicit guardian membership.

### Backend Requirements

- [ ] Verify existing deactivate endpoint works from UI.
- [ ] Implement safe delete endpoint if missing.
- [ ] Implement user membership update endpoints if missing.
- [ ] Membership updates must validate actor scope.
- [ ] Membership updates must use transactions.
- [ ] Membership updates must create audit logs.
- [ ] Return clear errors for blocked deletes/moves.

### UI Requirements

- [ ] User detail page should show memberships.
- [ ] User detail page should show linked student/guardian/staff records.
- [ ] User detail page should show why delete is blocked.
- [ ] User detail page should allow deactivate/reactivate.
- [ ] User detail page should allow safe school membership edits.
- [ ] User detail page should distinguish between auth account operations and student/staff profile operations.

### Testing

- [ ] Test delete/deactivate normal staff user.
- [ ] Test delete blocked for linked student user.
- [ ] Test delete blocked for linked guardian user.
- [ ] Test move teacher to another school.
- [ ] Test move school admin to another school.
- [ ] Test student movement uses student transfer logic.
- [ ] Test school admin cannot move user into another school outside scope.
- [ ] Test super admin can manage memberships across schools.
- [ ] Test audit log is written.
