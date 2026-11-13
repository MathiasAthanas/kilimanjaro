# Production Data Correction Report: Kilimanjaro Islamic Secondary School, Form 1 Subject Exemptions

Date: 2026-11-12  
Application release (unchanged): `/opt/kilimanjaro/releases/alevel-cards-ebbba54-20261112T181341Z`  
Scope: Kilimanjaro Islamic secondary School, Form 1 A, Form 1 B and Form 1 C, Annual Exam, Term 2

No code was deployed for this correction. It was a controlled production data operation.

## Problem

Eighteen Form 1 students were recorded as `Not sat` in a subject they do not take. The engine counts `Not sat` as a zero with an F grade, so each student's published average, position and report card included a zero for a subject outside their programme.

Cause: EDK, French and Book Keeping are all flagged compulsory, and no optional-subject enrolments are recorded, so the system expected every student to sit them. Book Keeping is offered only to part of Form 1 C.

| Class | Subject | Students exempted |
|---|---|---|
| Form 1 A | EDK | 3 |
| Form 1 A | French | 1 |
| Form 1 B | EDK | 1 |
| Form 1 B | French | 1 |
| Form 1 C | Book Keeping | 11 |
| Form 1 C | EDK | 2 |

Total: 19 subject exemptions for 18 students (one Form 1 C student is exempted from both Book Keeping and EDK).

## Procedure

Run with the application's own services from the active release, as the requesting super admin account (no API credential was available to the deployment operator). The one-off script was removed afterward.

1. Dry run: confirmed exactly 19 marks recorded `Not sat` in these subjects and classes, 78 published Form 1 cards, no existing exemptions.
2. Unpublished the Annual Exam window and the Form 1 class results and cards (visibility only; marks untouched): 858 term results and 78 report cards.
3. Created six exemptions (one per class and subject), 19 student rows in total, with the reason "Student does not take this subject (recorded as Not sat); excluded from calculations."
4. Recalculated the window: 163 students across five classes, 19 exempt subject results, 0 ungraded.
5. Recomposed Form 1 A, B and C only and regenerated their 78 PDFs.
6. Inspected the results and a generated PDF, then republished the window and the three classes.

## Result

- No `Not sat` or absent entry remains in the Form 1 results; 19 `EXEMPT` rows exist and are hidden from the cards by the school's report policy.
- Affected students now have 9 or 10 subjects counted instead of 11; averages, positions and overall positions were recomputed, and published again. Examples:

| Student | Class | Average before | Average after | Position before | Position after |
|---|---|---|---|---|---|
| Namelock Thomas Loserino (Book Keeping, EDK) | Form 1 C | 34.6 | 42.2 | 19 | 16 |
| Mariam Ally Mahamoud | Form 1 C | 57.4 | 63.1 | 8 | 6 |
| Naheeda Bakari | Form 1 A | 55.6 | 61.2 | 21 | 13 |
| Grace Julius Cosmas | Form 1 B | 47.4 | 52.1 | 21 | 16 |
| Nadia Salum Mgunda | Form 1 A | 33.5 | 36.8 | 29 | 27 |
| Tahiya Abubakar Mohamed | Form 1 B | 26.6 | 29.3 | 30 | 30 |

- No student's division changed in the affected group (divisions use the best seven subjects).
- All 78 Form 1 report cards, 858 Form 1 term results and 163 window results are published; the window is `PUBLISHED`.

## Production Backup

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_islamic_form1_exemptions_20261112T184953Z.dump`
- Database SHA-256: `a593ab7263001938dd068b700f80431d3cb04c58b8d10b7c832db72a05925af9`
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_islamic_form1_exemptions_20261112T184953Z.tar.gz`
- Report-card SHA-256: `b163de07a0a2c37024a493811f8a42a7cf1f27cdf6105cab7abafc6a234ad59b`
- State record (including the full before values for every Form 1 student): `/opt/kilimanjaro/backups/pre_islamic_form1_exemptions_20261112T184953Z.txt`

## Data Invariants

Fingerprints of everything except Form 1 A, B and C were identical before and after:

| Check | Before and after |
|---|---|
| Report cards (other classes, all schools) | 637, `74194cf836c93f8efaa96691979c193b` |
| Term results (other classes) | 6066, `008e87a490c5a9bb6a10be6a63761fb5` |
| Window results (other classes, including Form 3 A and B in the same window) | 637, `8a26d300312aa5d184e29ec93eb09494` |
| Marks (all) | 7008, `2942669e02cf00632abcdacb98124e3d` |
| Users | 1752 |

The PDF count stayed at 716 (cards were overwritten in place).

## Runtime Verification

- All eight PM2 applications are online; public health reports all dependencies reachable; the dashboard returns HTTP 200.
- The academic-service error log has no entry newer than 2026-11-10.
- Temporary files in `/var/tmp` were removed.

## Notes and Recommendation

- The exemptions assume the 18 students do not take these subjects. If any of them did sit one, enter the mark, revoke that exemption, recalculate and recompose.
- Form 3 A and B share the Annual Exam window. Their merit results were unpublished and republished with the window; their values and report cards were not changed (see the fingerprints).
- To avoid repeating this, record optional-subject enrolments for Book Keeping, French and EDK and set those subjects to non-compulsory, so future exams do not expect every student to sit them.

## Rollback

Restore only what is needed, from the backups above: the database rows for Form 1 (term results, report cards, exemptions, window results) selectively from the dump, and the Form 1 PDFs from the report-card archive. Do not restore the whole database merely to reverse this change.
