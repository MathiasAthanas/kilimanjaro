# Production Deployment Report: Exam Analytics and A-Level Results

Date: 2026-11-12  
Production domains: `manage.kilimanjaroschools.site`, `srms.kilimanjaroschools.site`  
Active release: `/opt/kilimanjaro/releases/exam-analytics-b886616-20261112T090000Z`

## Scope Delivered

- A-Level merit lists and exports now retain every subject with a recorded result.
- Only the student's assigned combination/principal subjects contribute to A-Level totals, means, grades, ranks, points, and divisions.
- Supporting subjects are marked as display-only with `*`; they remain visible without changing the aggregate result.
- A-Level student combinations are resolved from active student subject enrolments and persisted into composed term results.
- Conflicting active combinations block composition instead of silently calculating an ambiguous result.
- O-Level and A-Level divisions now show their calculated points in the web merit list and exports.
- Class/stream summaries now include division counts where divisions apply.
- Admin analytics now include overall, class/stream, subject, and gender analysis for Nursery, Primary, O-Level, and A-Level.
- Subject analytics include entries, mean, highest, lowest, pass rate, grade distribution, and division distribution where applicable.
- Nursery analysis no longer falls through to O-Level division rules.
- Performance snapshot events are explicitly mapped before Prisma writes, preventing transport-only fields such as `schoolId` from breaking event ingestion.

## Git Revisions

- `f375b19` - retain supporting subjects and expand exam analytics.
- `c34f478` - carry student combinations into term result composition.
- `b886616` - sanitize performance snapshot event payloads.

All three commits were pushed to `main` before production deployment.

## Backups

Created before deployment and before any controlled recalculation:

- Database: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_exam_analytics_20261112T084502Z.dump`
- Database SHA-256: `3d5cb213add14e8a63b23f783c488305001a61914f0a8767c3e0f4ba8362809e`
- Report cards: `/opt/kilimanjaro/backups/report_cards_pre_exam_analytics_20261112T084502Z.tar.gz`
- Report-card backup SHA-256: `cd3a3d024e8812cffb20e423d6a53f80f46f9a630c5421fc92a54492e696ecef`
- A frontend backup was also created automatically by each immutable release deployment.

## Build and Automated Tests

- Academic service: 24 suites, 104 tests passed.
- Focused exam/report composition regression suite: 43 tests passed.
- Student performance snapshot regression test: 1 test passed.
- Academic service Nest build passed.
- Student service Nest build passed.
- Dashboard TypeScript and Vite production build passed.
- Prisma migration check found 20 migrations and no pending migration.

The regression coverage includes aggregate-subject filtering, supporting-subject visibility, division points, Nursery analysis, per-class analytics, combination resolution, and rejection of invalid snapshot event fields.

## Production Verification

The controlled verification used the published A-Level exam window `935a4cef-c773-4eca-a148-708187409132`.

- 7 students remained published.
- 10 subjects remained visible for every student.
- Exactly 3 combination subjects counted for each student's aggregate.
- Exactly 7 additional subjects remained display-only for each student.
- Division analysis accounted for all 7 students.
- Subject analysis contained all 10 visible subjects.
- All totals, means, points, grades, divisions, stream positions, and overall positions remained unchanged during the controlled replay.
- The window returned to `PUBLISHED` with all 7 results published.
- 70 performance snapshots were ingested across 7 students and 10 subjects.
- No new `schoolId` Prisma error or snapshot consumer error was written after the replay boundary.

Live export smoke tests also passed:

- XLSX: valid archive, `Grade Summaries` analytics worksheet present, 10,565 bytes.
- PDF: valid PDF output, 5,473 bytes.
- CSV: combinations, division points, and display-only markers present, 953 bytes.

## Data Integrity

Final production counts and fingerprints:

- Students: 1,208.
- Exam window results: 715.
- Term results: `6890|6890|87b33fc1949fd48092e5634a68401521`.
- Report cards: `715|715|1d0a1e23515199111f7b0ea659255b09`.

The term-result and report-card fingerprints were unchanged by the controlled A-Level replay. No student, mark, term result, or report card was added or deleted. The intended operational changes were the refreshed A-Level exam-window representation and successful downstream snapshot ingestion.

## Runtime Status

- API gateway: online.
- Auth service: online.
- Student service: online.
- Academic service: online.
- Finance service: online.
- Notification service: online.
- Analytics service: online.
- E-learning service: online.
- Public API health: healthy; all reported dependencies reachable.
- Public dashboard: HTTP 200.
- Active release fingerprint scan: clean.
- Temporary deployment and verification files were removed from `/var/tmp`.

## Operational Notes

- Peer-comparison warnings can occur when a subject has no eligible comparison candidates. They are non-fatal and do not block marks, calculations, publication, exports, or analytics.
- The existing notification configuration warning for a missing Firebase service-account value remains unrelated to this change.
- Dashboard dependency installation reported 29 npm audit advisories. No forced dependency upgrade was applied during this feature deployment because it could introduce unrelated breaking changes; dependency remediation should be handled as a separate tested maintenance release.
- The dashboard bundle-size warning remains a performance maintenance item and does not affect correctness.
