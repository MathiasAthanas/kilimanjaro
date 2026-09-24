# Kilimanjaro Production Fix Checklist

This file tracks production issues that need to be implemented or reimplemented. Update each item as it is discussed, built, tested locally, and deployed to production.

## Current Focus: Universal Promotion Pathways

Goal: define editable default promotion pathways that the system can apply to real classes for each school and academic year.

### Pathway Rules To Support

- [ ] Normal promotion
  - [ ] Class 1 -> Class 2
  - [ ] Class 2 -> Class 3
  - [ ] Class 3 -> Class 4
  - [ ] Class 4 -> Class 5
  - [ ] Class 5 -> Class 6
  - [ ] Form 1 -> Form 2
  - [ ] Form 2 -> Form 3
  - [ ] Form 3 -> Form 4
  - [ ] Form 5 -> Form 6

- [ ] Cross-stage transitions
  - [ ] Class 6 -> Form 1
  - [ ] Class 7 -> Form 1
  - [ ] Form 4 -> Form 5

- [ ] Graduation / exit pathways
  - [ ] Class 6 -> Graduate
  - [ ] Class 7 -> Graduate
  - [ ] Form 4 -> Graduate
  - [ ] Form 6 -> Graduate

### Required Behavior

- [ ] Pathways are defined as universal editable templates.
- [ ] Templates can be applied to real classes for a selected school and academic year.
- [ ] Terminal classes can have more than one valid outcome.
- [ ] Admin can choose the correct pathway during promotion.
- [ ] Admin can edit or disable pathway exceptions.
- [ ] Existing `ClassPathway` records are generated only after real classes exist.
- [ ] The UI should not force a single route for terminal classes.

### Implementation Notes

- Primary terminal year may be Class 6 or Class 7 depending on stage configuration.
- Class 6/7 can either graduate/exit or move to Form 1.
- Form 4 can either graduate/exit or move to Form 5.
- Form 6 graduates/exits.
- Real pathway records need valid `fromClassId`, optional `toClassId`, `academicYearId`, and `transitionType`.
- Graduation pathways should use `transitionType = GRADUATION` and no `toClassId`.
- Cross-stage pathways should use `transitionType = CROSS_STAGE`.
- Same-stage promotions should use the normal promotion transition type used by the backend.

### Verification Checklist

- [ ] Local DB has a backup before changes.
- [ ] Pathway templates appear in the admin UI.
- [ ] Templates are editable.
- [ ] Applying templates creates real `ClassPathway` records.
- [ ] Pathways are scoped to the selected school/year.
- [ ] Promotion workflow can select graduation at Class 6/7.
- [ ] Promotion workflow can select graduation at Form 4.
- [ ] Promotion workflow can select graduation at Form 6.
- [ ] Promotion workflow can select Class 6/7 -> Form 1.
- [ ] Promotion workflow can select Form 4 -> Form 5.
- [ ] Backend tests pass.
- [ ] Dashboard build passes.
- [ ] Production DB backup taken before deploy.
- [ ] Production deployment completed.
- [ ] Production health check passes.

## Later Production Checklist

### Schools

- [ ] Fix `Kilimanjaro Primary Shool` to `Kilimanjaro Primary School` in production.
- [ ] Review school codes that look truncated.
- [ ] Confirm school type and gender for every school.

### Academic Year And Terms

- [ ] Keep `2026` as current academic year.
- [ ] Create terms for 2026.

### Classes And Streams

- [ ] Create all classes/streams from the Excel files.
- [ ] Attach every class to the correct school.
- [ ] Confirm no class has a blank `schoolId`.

### Academic Setup

- [ ] Add subjects.
- [ ] Add assessment types.
- [ ] Add grading scales.
- [ ] Add A-Level subject combinations.

### Kilimanjaro Excel Importer

- [ ] Accept `.xlsx` files.
- [ ] Detect folder as school.
- [ ] Detect file name as class/year.
- [ ] Detect stream as class stream.
- [ ] Split full name into first/middle/last.
- [ ] Generate student password from uppercase last name.
- [ ] Preview validation before commit.

### Student Import

- [ ] Import per class file.
- [ ] Verify student count against source files.
- [ ] Create student auth accounts.
- [ ] Create student records.
- [ ] Create enrolments into correct class/school/year.

### Post-Import Enrichment

- [ ] Add missing dates of birth.
- [ ] Clean guardian names and contacts.
- [ ] Assign fees.
- [ ] Assign A-Level combinations/subjects.
- [ ] Verify student login credentials.

### Production Deployment

- [ ] Take production DB backup before changes.
- [ ] Apply migrations/scripts.
- [ ] Run health checks.
- [ ] Test admin login.
- [ ] Test school-scoped import.
- [ ] Test promotion workflow.
- [ ] Confirm dashboard works against production API.
