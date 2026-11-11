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
- Production gateway build and public-domain download verification: pending deployment.

