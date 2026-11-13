# Production Deployment Report: Average From The Subjects A Student Has Marks For

Date: 2026-11-13  
Application commit: `bf9356a` (`feat(results): average from the subjects a student has marks for`)  
Active release: `/opt/kilimanjaro/releases/avg-rule-bf9356a-20261113T080828Z`  
Previous release: `/opt/kilimanjaro/releases/alevel-cards-ebbba54-20261112T181341Z`

## Business Rule Implemented

Agreed with the school (final verdict):

- The **average and class position** are always calculated from the subjects the student actually has marks for. There is no fixed subject count, in Nursery, Primary, O-Level or A-Level.
- A subject a teacher or admin records as **Not sat** or **Absent** is left out of the average, position, division and the report card. Subjects with no mark at all still block closing, as before.
- **A-Level:** every subject the student sat (including Academic Communication, Basic Applied Mathematics and Historia ya Maadili) counts in the average and position. Only the **division** uses the combination's principal subjects.
- **O-Level:** the division uses the seven best subjects (a failed subject can be one of them); the average uses every subject with a mark. A student with fewer than seven marked subjects is Ungraded.
- No minimum number of subjects is required for an average. A student with no marks at all shows "No assessed subjects" instead of an F-based average.

## Changes

Academic service:

- `COUNTED_STATUSES` is now `SCORED` only; summaries, expected counts and divisions follow it.
- The calculator no longer treats A-Level subjects outside the combination as reference-only: any subject with a mark counts, and the division stays restricted to the principals.
- Report composition leaves Not sat and Absent subjects off the card; report-card summaries, positions, overall positions and the PDF rows use the same rule.
- Performance and teacher analytics read only scored term-result rows.
- The readiness response now includes the assessment behind each class and subject.

Analytics service: term-result reads ignore Exempt, Not sat and Absent rows.

Dashboard: while a window is open or reopened, every subject column and cell in the readiness matrix links to the marks editor (**Enter marks** / **Edit** / **Enter mark**); on-screen guidance and the policy and marks-entry notes describe the new rule.

Tests: 126 academic-service tests and 172 dashboard tests pass; TypeScript checks pass for the academic service, analytics service and dashboard. New tests cover averages over exactly the marked subjects, Absent/Not sat exclusion, the O-Level best-seven rule with a failed subject, A-Level averages that include every subject sat, and composition.

No database migration was part of this release.

## Production Backup

Taken immediately before activation:

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_avg_rule_20261113T080832Z.dump` (SHA-256 `4eeabbbbc4b95813ded79ab3100002bf493d7d3a451a386f30850244925b0516`)
- Frontend: `/opt/kilimanjaro/backups/frontend_pre_avg_rule_20261113T080832Z.tar.gz` (SHA-256 `0519195e4ace626f51a17b2397eee07ee6abe23f4964ad09cb754cdb533cde03`)
- Report-card files: `/opt/kilimanjaro/backups/report_cards_pre_avg_rule_20261113T080832Z.tar.gz` (SHA-256 `59901961a14a2eef7638b8e438ece87b571dd57130b0c7ac58d70e50eed6b0c0`)
- Per-student before and after snapshots: `/opt/kilimanjaro/backups/snapshot_before_avg_rule.txt` and `snapshot_after_avg_rule.txt`
- Release archive SHA-256: `8fda633ce9965312cb64555bb4f838a21ba55529e8e890246ae682121d240a6f`

## Recompute And Publish

The backend and dashboard were activated first (all eight services online, dashboard bundle `index-B6zxD2L9.js`). Every exam window was then recalculated with the new rule, its report cards recomposed and its PDFs regenerated, using the application's own services as the requesting super admin account (no API credential was available to the deployment operator). The one-off scripts were removed afterward. Window and card visibility was restored.

| School | Window | Students | Result | Published |
|---|---|---|---|---|
| Islamic High School | Terminal Exam (A-Level) | 7 | Averages now include every subject sat; divisions unchanged | Window and 7 cards published |
| Islamic secondary School | Annual Exam | 163 | 58 averages rose (up to +18.4), 62 positions changed, no division changed | Window and 163 cards published |
| Modern boys secondary School | Annual Exam | 101 | 49 averages rose (up to +14.4), 20 positions changed, no division changed | Window and 101 cards published |
| Primary School | Annual Exam | 444 | Averages and positions unchanged from the earlier exemption correction; 6 students with no marks now show "No assessed subjects" | 444 cards published; window left open (see below) |

Islamic High School Form 5 A: the A-Level average now includes Academic Communication, Basic Applied Mathematics and Historia ya Maadili. The mean average moved by -4.6, four positions changed, and every division is unchanged (Zuwena Yunusi remains Ungraded with two eligible principals).

## Verification

- For all 715 students: the merit-list average equals the card average, class positions agree, and the card average equals the average of the subjects with marks.
- No Not sat or Absent row remains in the composed term results; only `SCORED` and `EXEMPT` rows exist.
- Marks: 7011 rows, fingerprint `66dc3bb8471b9fbf5b8b6d3a5dfd3c6b`, identical before and after the recompute. Users: 1752, unchanged.
- All eight PM2 services online; health reports every dependency reachable; the academic-service error log has no entry newer than 2026-11-10; the PDF count is unchanged at 716.

## Not Done / Open Items

- **Primary window is still reopened.** Four granted corrections remain open in Class 1 A (Islamic and Christian Religious Education), Class 1 B (Islamic Religious Education) and Class 2 B (Christian Religious Education). Closing the window would lock those edits, so it was left open and its merit list stays unpublished while the 444 report cards are published. After those corrections are entered, close the window (this recalculates), recompose the affected classes and publish the window.
- **Islamic High School Regional Mock Exam** (Form 6 A) is still open with marks only for Geography, Historia and Economics (three Economics marks entered 07:45).
- **Classes with no results yet:** Primary Class 4 A and B; Islamic secondary Form 2 A and B and Form 4 A and B; Modern boys Form 2 A and B and Form 4 A and B (no students enrolled); all six Nursery classes; Islamic High School Form 6 A.
- The 509 exemptions created earlier (490 primary, 19 Islamic secondary Form 1, plus Zuwena's History) remain valid; under the new rule Not sat subjects are left out in any case.
- Rules still open for a later decision: none requested.
- `git push` of the commits is done by the repository owner.

## Rollback

Backend and dashboard:

```bash
previous_release="/opt/kilimanjaro/releases/alevel-cards-ebbba54-20261112T181341Z"
ln -sfn "$previous_release" /opt/kilimanjaro/app.next
mv -Tf /opt/kilimanjaro/app.next /opt/kilimanjaro/app
sudo -u kilimanjaro -H bash -lc "cd /opt/kilimanjaro/app/backend && pm2 startOrReload ecosystem.config.js --update-env && pm2 save"
```

Restore `/opt/kilimanjaro/backups/frontend_pre_avg_rule_20261113T080832Z.tar.gz` for the dashboard. Results and cards computed under the new rule would then need to be recomputed with the previous code; use the before snapshot and the database backup above only for selective restores, not a whole-database restore.
