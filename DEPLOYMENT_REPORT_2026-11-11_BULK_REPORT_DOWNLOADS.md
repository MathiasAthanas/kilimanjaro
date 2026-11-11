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

Follow-up production result:

- Commit: `7747028` (`fix: retain school scope for bulk report downloads`).
- Active release: `/opt/kilimanjaro/releases/7747028-20261111T141000Z`.
- The same Class 1 B PDF and ZIP were each downloaded twice consecutively without an active-school header; all four requests returned HTTP 200.
- Both PDF attempts contained 37 valid pages and both ZIP attempts contained 37 valid PDF files.
- Class 1 all-stream exports still returned 74 valid cards in both combined PDF and ZIP formats.
- Production remained at 444 published report cards and 4,077 term results with unchanged fingerprint `71057a99a82df0bf83d9d017725efef1`.
- All eight PM2 services remained online after verification.

## Follow-up: browser ZIP transport

Chrome received HTTP 200 for ZIP requests but repeatedly closed the connection after a random partial byte count. Server-side downloads remained complete. The response headers contained conflicting policies: CORS allowed `https://manage.kilimanjaroschools.site`, while Helmet emitted `Cross-Origin-Resource-Policy: same-origin` from `https://srms.kilimanjaroschools.site`.

The gateway now emits `Cross-Origin-Resource-Policy: cross-origin` for its API responses. The explicit CORS origin allowlist, credentials policy, JWT authentication and school authorization remain unchanged.

Browser transport deployment result:

- Commit: `994adb0` (`fix: allow cross-origin binary downloads`).
- Active release: `/opt/kilimanjaro/releases/cross-origin-zip-20261111T142500Z`.
- Public ZIP response: HTTP 200, 5,388,610 bytes, `Content-Type: application/zip`, and `Cross-Origin-Resource-Policy: cross-origin`.
- The ZIP contains 37 valid individual PDFs and passes full archive integrity validation.
- Two consecutive no-school-header ZIP downloads and the 74-card all-stream ZIP completed successfully.
- Production report-card and term-result counts and fingerprints remained unchanged.

## Follow-up: interrupted raw ZIP downloads

Production access logs showed that combined PDF downloads completed at the exact expected size, while browser ZIP requests started with HTTP 200 and then stopped at different partial byte counts. The academic service and API gateway logged no generation error, and repeated server-side ZIP downloads always produced a complete archive. This confirms that the cards remained published and the interruption occurred while raw ZIP bytes were travelling to the browser.

The dashboard ZIP path now requests a browser-safe JSON transport from the academic service. The service builds the same archive, encodes it as base64 in authenticated JSON, and the dashboard reconstructs the `.zip` locally before download. The existing raw `format=zip` API remains available; combined PDF behavior is unchanged.

Local verification:

- Browser-safe archive regression test: passed; decoded payload has a valid ZIP signature and both expected PDF entries.
- All report-card suites: 6 suites and 21 tests passed.
- Dashboard production build: passed.
- Academic TypeScript compilation: passed. The local post-build Prisma copy could not replace a DLL held open by the already-running Windows service; this does not affect the Linux production build.
- No migration or production data mutation is required.

Production result:

- Commit: `305abe4` (`fix: deliver bulk report ZIP through safe transport`).
- Active release: `/opt/kilimanjaro/releases/safe-zip-305abe4-20261111T145300Z`.
- Production backend and dashboard builds passed; all eight PM2 services are online and gateway health is OK.
- Prisma found 19 migrations with no pending migration to apply.
- Public safe-transport response: HTTP 200 and 7,184,919 JSON bytes.
- Decoded archive: 5,388,610 bytes, 37 individual PDFs, valid ZIP signature, and no archive integrity errors.
- Nginx recorded the complete response; the academic service and gateway produced no errors for the request.
- Production remained at 444 report cards, all published, and 4,077 term results with unchanged fingerprint `71057a99a82df0bf83d9d017725efef1`.

## Follow-up: identifiable individual PDF names

Individual PDFs inside an archive now include the student's full name and registration number. A single-class archive uses `Student Name - Registration.pdf`; an all-stream archive uses `Class - Student Name - Registration.pdf`. Middle names are retained when available, unsafe filename characters are removed, and the student identifier remains as a fallback when profile details are incomplete.

Local verification: all 6 report-card suites and 22 tests passed, including both filename formats, and the academic service TypeScript check passed.

Production result:

- Commit: `3cf7268` (`feat: name report PDFs by student`).
- Active release: `/opt/kilimanjaro/releases/student-report-names-3cf7268-20261111T151000Z`.
- Production builds passed, no migrations were pending, and all eight PM2 services remained online.
- The Class 1 B archive contains 37 valid PDFs named like `Humayrah Othuman Swai - KEMS-P-26600.pdf`.
- The Class 1 all-stream archive contains 74 valid PDFs, all matching the class-prefixed format, such as `Class 1 A - Sumaiya Shabani Kisija - KEMS-P-26587.pdf`.
- Archive integrity checks passed. Production remained at 444 published report cards and 4,077 term results with unchanged fingerprint `71057a99a82df0bf83d9d017725efef1`.

