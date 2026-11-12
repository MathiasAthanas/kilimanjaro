# Production Deployment Report: Report-Card Unpublish Workflow and French Results

Date: 2026-11-12  
Commit: `39acfa6`  
Active release: `/opt/kilimanjaro/releases/report-card-lifecycle-39acfa6-20261112T113300Z`

## Problem

Kilimanjaro Modern boys secondary School added French marks for Form 1 B after report cards had already been composed and published. The Annual Exam merit results contained French, but the report-card composition still contained the previous nine subjects.

Unpublishing an exam window only changes the visibility of that exam window's merit results. It does not unpublish term results or report cards. The backend had a separate class/term result-unpublish operation, but it was not visible from the report-card composition screen and did not authorize the `SYSTEM_ADMIN` role.

`TermResult` is the intermediate per-student, per-subject record used to create a term report card. Before correction, production contained 17 French marks and 17 French entries in the Annual Exam merit results, but zero French `TermResult` rows. Therefore, regenerating the existing cards without recomposition could only reproduce the old nine-subject cards.

## Implementation

- Added a visible **Published report cards** section to `/exams/compose`.
- Added an **Unpublish to regenerate** action for each published class and term.
- Added an impact-preview endpoint showing the exact number of report cards and subject-result rows that will be hidden.
- The UI explicitly shows that zero marks are deleted.
- Added a required reason and typed class-name confirmation.
- Added `SYSTEM_ADMIN` authorization for result publication and unpublication.
- Added school-scope validation before every preview, publish, or unpublish operation.
- Added audit logging of the administrator's reason.
- Added a **Single class** composition selector so one class can be corrected without recomposing other classes.
- After successful unpublishing, the affected class is selected automatically for recomposition.

Unpublishing changes visibility only. It does not delete marks, students, term-result records, report-card records, or generated PDFs.

## Tests

- Academic service full test run: 26 suites passed, 110 tests passed, 1 suite skipped.
- New focused lifecycle tests: 3 passed.
- Academic Nest build passed.
- Dashboard TypeScript and Vite production build passed.
- Production migration check: no pending migrations.

The new tests cover exact impact counts, non-destructive unpublishing, Administrator access, audit reasons, and cross-school access denial.

## Production Backup

Created immediately before deployment and correction:

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_report_card_lifecycle_20261112T113230Z.dump`
- Database SHA-256: `bba194b3bd3347de390616c57fa5eb2fcdade6a447bf515165111bfbf193d5a3`
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_report_card_lifecycle_20261112T113230Z.tar.gz`
- Report-card SHA-256: `30536d598641552616c95570ef593fce784e7b85d4b8ce36bdd2366a2d61bbc1`
- State record: `/opt/kilimanjaro/backups/pre_report_card_lifecycle_20261112T113230Z.txt`
- Frontend backup: `/opt/kilimanjaro/backups/frontend_pre_report-card-lifecycle-39acfa6-20261112T113300Z_20261112T113320Z.tar.gz`

## Form 1 B Correction

The production API workflow was used after deployment:

1. Previewed the impact: 17 report cards, 153 subject-result rows, and 0 marks affected.
2. Unpublished only Form 1 B for Term 2.
3. Composed only Form 1 B from the published Annual Exam window.
4. Regenerated all 17 PDFs.
5. Republished Form 1 B immediately.

Before correction:

- French marks: 17.
- French exam-window results: 17.
- French term-result rows: 0.
- Form 1 B cards: 17 published cards, each with 9 subjects.

After correction:

- French marks: 17 and unchanged.
- French term-result rows: 17, all published, all matching their source marks.
- Form 1 B cards: 17 published cards, each with 10 subjects.
- Generated PDFs: 17, regenerated between `2026-11-12 11:37:45` and `11:37:46` UTC.
- A live result API request returned French as a published subject with its score and grade.
- The Annual Exam remained published with 101 of 101 merit results published.
- The other 698 report cards were unchanged.
- The other 6,737 term-result rows were unchanged.

## Runtime Verification

- All eight PM2 services are online.
- Public API health reports all dependencies reachable.
- Production dashboard returns HTTP 200.
- No academic-service error was recorded for the controlled refresh.
- The active release fingerprint scan is clean.
- Temporary deployment and verification files were removed from `/var/tmp`.

## Administrator Workflow

Open **Grading > Compose Report Cards**, or navigate directly to `/exams/compose`.

1. Select the academic year and term.
2. Find the class under **Published report cards**.
3. Select **Unpublish to regenerate**.
4. Review the exact impact, enter a reason, and type the requested confirmation.
5. Confirm unpublishing.
6. The class is selected automatically under **Single class**.
7. Select the relevant exam window, verify the weight, enable immediate publication if appropriate, and generate the cards.

Students and parents temporarily lose visibility only between steps 5 and 7. Their marks and records remain intact.
