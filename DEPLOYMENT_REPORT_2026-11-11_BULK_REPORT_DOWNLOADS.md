# Bulk Report Download Deployment Report

Date: 2026-11-11

## Reported failure

- Combined class report-card PDF downloads failed through the public API.
- ZIP downloads containing the individual report cards also failed.
- The browser alternated between HTTP 400 and a terminated HTTP 200 response.

## Root cause

The academic service generated both files correctly, but the API gateway did not classify the bulk report-card URL as a binary route. The route ends with a term identifier and selects PDF or ZIP through the `format` query parameter, while the gateway only recognized paths ending in names such as `pdf`, `download`, or `export`. It consequently attempted to process PDF and ZIP bytes as JSON.

Browser-extension `contentscript.js`, `ObjectMultiplex`, and host-validation warnings shown in the console are unrelated to the application failure.

## Implementation

- Recognize class and class-level bulk report-card routes with `format=pdf` or `format=zip` as binary responses.
- Preserve content type, content disposition, content length, and report-card count headers.
- Allow up to three minutes for large combined report generation through the gateway.
- Decode downstream JSON error responses so the UI receives a meaningful API error rather than a byte-buffer representation.

## Data safety

This is a gateway-only transfer fix. It adds no migration and does not modify report cards, marks, exam windows, students, terms, publication state, or any other production data.

## Verification

- Direct academic-service generation before the fix: PDF 5,376,243 bytes and ZIP 5,388,610 bytes, both valid.
- Gateway focused tests: 10 passed, including the exact PDF and ZIP route shapes and binary error handling.
- Production backend and dashboard builds: passed.
- Prisma migration check: passed; no pending migrations.
- Public Class 1 B combined PDF: HTTP 200, 5,376,243 bytes, 37 valid pages.
- Public Class 1 B ZIP: HTTP 200, 5,388,610 bytes, 37 valid PDF entries and no archive errors.
- Public Class 1 all-stream PDF: HTTP 200, 10,752,472 bytes, 74 valid pages.
- Public Class 1 all-stream ZIP: HTTP 200, 10,777,271 bytes, 74 valid PDF entries and no archive errors.
- Responses expose the correct CORS origin, MIME type, content length, download filename, and PDF report count.

## Production deployment

- Git commit: `de314bf` (`fix: proxy bulk report downloads as binary`).
- Active release: `/opt/kilimanjaro/releases/de314bf-20261111T134800Z`.
- Previous release retained for rollback: `/opt/kilimanjaro/releases/17fd5bb-20261111T113700Z`.
- Database backup: `/opt/kilimanjaro/backups/kilimanjaro_prod_pre_bulk_reports_20261111T134636Z.dump`.
- Report-card file backup: `/opt/kilimanjaro/backups/report_cards_pre_bulk_reports_20261111T134636Z.tar.gz`.
- Database backup SHA-256: `9ed2b8351f81ca05bdc558f5a739889a28959661ab084ea86fe8b152344dabe1`.
- Report-card backup SHA-256: `a63909f3dcd27527e0a8f73720ed13ffcd83ab0fd3ec9767141606c92c9944ce`.
- Before and after verification: 444 report cards, all 444 published; 4,077 term results with unchanged fingerprint `71057a99a82df0bf83d9d017725efef1`.
- All eight PM2 services are online, the public gateway reports every dependency reachable, and the dashboard returns HTTP 200.

## Follow-up: school context reliability

After the binary gateway fix, a group administrator could download once while a school was selected but later receive HTTP 400 after returning to group scope. The live response was `Select a school before creating a report-card download`; the cards were still published.

The follow-up implementation:

- Infers the owning school from an unambiguous class/report selection when no school header is present.
- Keeps an all-stream selection spanning more than one school blocked until the school is explicit.
- Separates dashboard all-stream groups by school and sends that school with every bulk request.
- Allows three minutes for a bulk download without changing normal API timeouts.
- Decodes blob-form API failures and displays their actual message to the user.

Follow-up local verification: 96 academic tests passed, 25 skipped, dashboard TypeScript passed, 8 school-context tests passed, and both academic and dashboard production builds passed.

