# Login Email and Temporary Credential Deployment

Date: 2026-10-27

## Scope

- Allow a system administrator to edit a user's email login identifier from the user profile.
- Normalize email identifiers, reject duplicates, and revoke refresh sessions when an email changes.
- Retain newly issued temporary passwords using AES-256-GCM encryption at rest.
- Allow a system administrator to reveal and copy a temporary password only while the user must change it.
- Erase the recoverable temporary credential when the user changes or completes a reset of their password.
- Prevent the user-detail API from returning password hashes or encrypted credentials.

## Data Safety

- Migration `20261027090000_recoverable_temporary_credentials` adds one nullable column to `auth.users`.
- Existing user records and password hashes are not modified.
- Existing temporary passwords cannot be recovered. An administrator must reset a legacy account once to issue a recoverable temporary password.
- The production encryption key is stored only in `/etc/kilimanjaro/services/auth-service.env` and is not committed or printed.

## Verification Before Deployment

- Auth-service TypeScript check passed.
- Auth-service focused tests passed: 7/7.
- Prisma schema validation and client generation passed.
- Dashboard TypeScript check passed.
- Dashboard production build passed.
- Local gateway health passed after applying the additive migration to the configured local database.

## Production Record

To be completed during deployment:

- Git commit: `dad979c`
- Database backup: pending
- Live release: pending
- Rollback release: pending
- Migration verification: pending
- Gateway and dashboard verification: pending
