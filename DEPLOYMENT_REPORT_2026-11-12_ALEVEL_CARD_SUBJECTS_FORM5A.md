# Production Deployment Report: A-Level Report-Card Subjects and Form 5 A Terminal Exam Correction

Date: 2026-11-12  
Application commit: `ebbba54` (`feat(reports): show every A-Level subject the student sat in one table`)  
Active release: `/opt/kilimanjaro/releases/alevel-cards-ebbba54-20261112T181341Z`  
Previous release: `/opt/kilimanjaro/releases/user-roles-e295268-20261112T145914Z`

## Problem

Kilimanjaro Islamic High School, Form 5 A, Terminal Exam (Term 1):

- All seven published report cards said `Ungraded - no A-Level principal combination is assigned`, although the exam results showed Division I, II and III. The cards had been composed at 08:22, before the combination was attached during composition and before most subsidiary marks (Academic Communication, Basic Applied Mathematics, Historia ya Tanzania na Maadili) were uploaded between 08:23 and 09:43.
- Subsidiary subjects the students had sat were missing from the cards. The school wants them shown without affecting the average, position, division or any count.
- Zuwena Yunusi's History was recorded as `Not sat`, which the engine counts as zero, so her average (35.7) and Division III included an exam she did not sit.

## Implementation

- Report-card composition keeps a subject that does not count toward the aggregate (outside the student's combination) only when the student has a real score. Not sat, absent, exempt and missing reference subjects stay off the card.
- A-Level cards show every subject in one "Subject Results" table: principals first, then the remaining subjects. There are no markers or footnotes, and remarks follow the school's single A-Level grading scale for every subject (A Distinction, B Merit, C Credit, D Pass, E Subsidiary Pass, S Fail).
- The "Subjects assessed" note is hidden on A-Level cards.
- Average, position, division and subject counts are unchanged: they still use only the subjects that count.

## Tests

- Academic service: 26 suites passed, 126 tests passed, 25 skipped, 0 failed. TypeScript check passed.
- New tests cover the composition rule, the one-table A-Level layout on one page, and the hidden note.
- A sample card was rendered and inspected before release, and the generated production PDFs were inspected afterward.
- No database migration was part of this release.

## Production Backup

Taken immediately before activation:

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_alevel_cards_20261112T181352Z.dump`
- Database SHA-256: `2410af8e155fcc3714d304167919e4529b3daa0ead2fa7f2a8881a357d30a8e3`
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_alevel_cards_20261112T181352Z.tar.gz`
- Report-card SHA-256: `8dae91b61c449affbfa495e36ea2f99da1588a5e5ff743d6a4d4306c7dd16db8`
- State record: `/opt/kilimanjaro/backups/pre_alevel_cards_20261112T181352Z.txt`
- Release archive SHA-256 (verified on the server): `f9887af415f4d7e8012d6a5f566a7ee95aefb49013939dee21d59f104716d9d9`
- No dashboard change; the dashboard was not republished.

## Data Correction (Form 5 A, Terminal Exam only)

The backend was activated first. The correction then ran the application's own services (the code the API uses) from the active release as the requesting super admin account, because no API credential was available to the deployment operator. The one-off script was removed afterward.

1. Precheck: window `CLOSED`, 7 published cards, Zuwena's History mark `Not sat`, no exemptions.
2. Unpublished the class and term: 21 term results and 7 report cards (visibility only; no marks changed).
3. Created one exemption for Zuwena Yunusi, History, Terminal Exam: "Did not sit History in the Terminal Exam (recorded as Not sat); excluded from calculations." A real score would have been used instead, but the mark was still `Not sat`.
4. Recalculated the window: 7 students, 1 exempt subject result, 1 ungraded.
5. Recomposed Form 5 A only: 7 report cards regenerated.
6. Inspected the results and PDFs, then republished the class and term.

### Before and after

| Student | Before: average / division | After: average / division |
|---|---|---|
| Khairun Kihango | 79.7 / Ungraded on card | 79.7 / Division I (5 pts) |
| Rahma Katanga | 78.0 / Ungraded on card | 78.0 / Division I (5 pts) |
| Zaynab Abdallah | 74.0 / Ungraded on card | 74.0 / Division I (5 pts) |
| Tausi Abeid | 67.7 / Ungraded on card | 67.7 / Division I (8 pts) |
| Najma Hassan | 65.7 / Ungraded on card | 65.7 / Division I (8 pts) |
| Zuhura Kamwalu | 55.3 / Ungraded on card | 55.3 / Division II (12 pts) |
| Zuwena Yunusi | 35.7 / Ungraded on card (merit list: Division III, 15 pts, with History as 0) | 53.5 / Ungraded (two eligible principals) |

- Ranks are unchanged (1 to 7).
- Term results for the class went from 21 rows (principals only) to 38 rows: counted principals plus the subsidiary subjects each student sat. No `Not sat` or absent row remains. Zuwena's exempt History row exists but is hidden from the card by the school's default report policy.
- Zuwena becomes Ungraded because the ACSEE division needs three eligible principals and her History is exempt. Her average is now calculated from Economics and Geography.
- Cards: 7 of 7 published again, all PDFs regenerated and owned by the application user.

## Data Invariants

Fingerprints of everything except Form 5 A, before and after, were identical:

| Check | Before and after |
|---|---|
| Report cards (other classes) | 708, `bdd31e33cb07497ca69f77d04eae9fa8` |
| Term results (other classes) | 6886, `aa1849a083869f0214aa65f62274f4db` |
| Window results (other classes) | 708, `867240ffdbc982cad620fd236f18687e` |
| Marks (all) | 7008, `2942669e02cf00632abcdacb98124e3d` |
| Users | 1752 (unchanged by this release) |

The PDF file count stayed at 716 (the cards were overwritten in place). The exam window remains `CLOSED` and its merit results remain unpublished, as they were before the correction.

## Runtime Verification

- All eight PM2 applications are online; public and local health report all dependencies reachable; the dashboard returns HTTP 200.
- The academic-service error log has no entry newer than 2026-11-10.
- The release fingerprint scan is clean, and temporary files in `/var/tmp` were removed.

## Notes

- If Zuwena did sit History, enter her mark, revoke the exemption, then recalculate and recompose Form 5 A. That restores a three-principal division.
- General Studies is in every combination but has no assessment in the Terminal Exam, so it does not appear on any card. An assessment would need to be created for it.
- As in earlier releases, the Windows-built archive carries CRLF line endings; `deployment/*.sh` were stripped of `\r` in the staged release before activation.
- `git push` of this commit is done manually by the repository owner.

## Rollback

Backend:

```bash
previous_release="/opt/kilimanjaro/releases/user-roles-e295268-20261112T145914Z"
ln -sfn "$previous_release" /opt/kilimanjaro/app.next
mv -Tf /opt/kilimanjaro/app.next /opt/kilimanjaro/app
sudo -u kilimanjaro -H bash -lc "cd /opt/kilimanjaro/app/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
curl -fsS http://127.0.0.1:3000/health
```

Report cards: restore `/opt/kilimanjaro/backups/report_cards_pre_alevel_cards_20261112T181352Z.tar.gz` only if the previous PDFs must be returned exactly. The Form 5 A database rows (cards, term results, exemption) would need the database backup above, restored selectively; do not restore the whole database merely to roll back code.
