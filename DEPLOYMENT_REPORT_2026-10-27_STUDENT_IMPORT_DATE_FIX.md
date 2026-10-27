# Student Import Excel Date Fix

Date: 2026-10-27

## Incident

Class imports containing Excel numeric date cells failed during student duplicate detection. Values such as `45000` were converted to text by the browser and then parsed by JavaScript as year 45000. The student service passed the resulting `Date` object into a Prisma raw query, where the deployed query protocol rejected its nested date representation.

## Fix

- Convert Excel serial dates to ISO `YYYY-MM-DD` while reading `.xlsx` files.
- Repeat strict date normalization in the student service so CSV/API callers receive the same protection.
- Reject ambiguous, impossible, future, and out-of-range dates; DOB remains optional and an invalid value produces a row-specific warning.
- Bind the normalized ISO string, rather than a JavaScript `Date` object, in duplicate detection.

## Verification

- `45000` converts to `2023-03-15`.
- `45030` converts to `2023-04-14`.
- The commit-path test imports `JONATHAN WILSON NGOWI` with the normalized DOB.
- Student import tests: 4/4 passed.
- Dashboard spreadsheet tests: 2/2 passed.
- Student-service TypeScript and Nest builds passed.
- Dashboard TypeScript and production builds passed.

## Production Record

- Live release: pending
- Rollback release: pending
- Gateway health: pending
- Dashboard verification: pending
