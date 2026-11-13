# Production Data Correction Report: Kilimanjaro Primary School, Annual Exam Not-Sat Exemptions

Date: 2026-11-13  
Application release (unchanged): `/opt/kilimanjaro/releases/alevel-cards-ebbba54-20261112T181341Z`  
Scope: Kilimanjaro Primary School, Annual Exam, Term 3, all 10 classes in the window (444 students)

No code was deployed. This was a controlled production data operation.

## Problem

Report-card averages divided by subjects that had no mark:

- 18 students had both Christian and Islamic Religious Education recorded `Not sat`; the automatic alternative-subject exemption cannot choose one, so both counted as zero (averages 10 to 21 points low).
- 2 students had one subject `Not sat` counted as zero.
- 6 students sat nothing and were published at 0.0%.
- The merit list counted the religion subject a student does not take as zero for all 444 students, so merit averages were 7 to 10 points below the card averages and 68 students had a different class rank than on their card. (The alternative-subject exemption is applied only when cards are composed.)

## Decision

Applied the rule "average is calculated from the marks present" to this exam by exempting every `Not sat` entry. `Absent` entries were deliberately left as they were (the Absent rule and a minimum-subject rule are still to be decided for future exams). The 6 whole-exam absentees remain at 0.0%.

## Procedure

Run with the application's own services from the active release as the requesting super admin account (no API credential was available to the deployment operator). Scripts were removed afterward.

1. Dry run: 510 marks flagged `Not sat` in the window, of which 20 belong to students no longer enrolled in those classes (no result rows; excluded). 490 target marks in 34 class and subject groups.
2. The results and cards had already been unpublished from the dashboard and the window recalculated.
3. Created 490 exemptions (reason: "Student did not sit or does not take this subject (recorded as Not sat); excluded from calculations.").
4. Recalculated the window and recomposed all 10 classes: 444 report cards regenerated.
5. Verified before publishing: no `Not sat` outcome remains (490 `EXEMPT`, 22 `Absent`, 3565 `Scored`); for all 444 students the merit-list average equals the card average and the class ranks agree; no card average is divided by a subject without a mark (the 6 whole-exam absentees remain at 0.0%).
6. Closed the window (recalculated: 444 students, 490 exempt subject results, 0 ungraded), published the window and published the 10 classes' cards at 06:56 to 06:57 UTC.

Examples (average before to after): Iyaad Bolyao 73.8 to 94.9; Hayfa Habibu 66.2 to 85.1; Michele Faustine 73.7 to 94.7; Nurhan Rashid 58.5 to 66.9; Adam Mntando 58.8 to 66.1; Sumaiya Kisija 87.6 to 98.5 (merit list).

## Production Backup

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_primary_exemptions_20261113T062907Z.dump`
- Database SHA-256: `f7c3de44ea74773eb9f84bfdeb4ae998bbd3a1152ddaae2711bd0a726701638a`
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_primary_exemptions_20261113T062907Z.tar.gz`
- Report-card SHA-256: `078b0b7599793c4a4138e84abda3077d0e62e2ef07b9be18b569083c2e1b87eb`
- State record: `/opt/kilimanjaro/backups/pre_primary_exemptions_20261113T062907Z.txt`

## Data Invariants

- Marks: 7008 rows, fingerprint `2942669e02cf00632abcdacb98124e3d`, identical before and after (no mark changed).
- Users: 1752, unchanged.
- Fingerprints of other schools' classes differ from the backup snapshot only because the Islamic secondary classes and their Annual Exam window were unpublished from the dashboard at 06:35 to 06:36 UTC (published flags only), not by this operation.
- The PDF count stayed at 716 (cards overwritten in place).

## Runtime Verification

All eight PM2 applications online; health reports all dependencies reachable; no academic-service error newer than 2026-11-10.

## Notes

- Immediately after publishing, the primary exam window was unpublished (06:57:38), reopened (06:58:07) and opened (07:00:05) from the dashboard. The 444 report cards stayed published; the merit list was unpublished and the window is open for editing. If marks are edited, recalculate and recompose before publishing again.
- 20 `Not sat` marks remain on students who are no longer enrolled in these classes; they have no effect on results.
- Class 4 A and Class 4 B (117 students) have no assessments in this window and therefore no cards.
- Still to decide for future exams: whether `Absent` is excluded like `Not sat`, and a minimum number of marked subjects below which a student is shown as incomplete.

## Rollback

Restore only what is needed from the backups above (primary term results, report cards, exemptions and window results, and the PDFs from the report-card archive). Do not restore the whole database merely to reverse this change.
