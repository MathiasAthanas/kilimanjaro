# Gateway Rate Limit Incident and Fix Report

## Incident

The dashboard returned HTTP 429 while submitting `POST /api/v1/students/terms`.

The browser-extension `contentscript.js`, `ObjectMultiplex`, and host validation warnings were unrelated. The relevant failure was the gateway's `429 Too Many Requests` response.

## Root Cause

- Nginx correctly forwarded `X-Forwarded-For`.
- Express did not trust the reverse proxy, so the gateway saw requests as `127.0.0.1`.
- The global limiter allowed 60 requests per minute on the catch-all proxy handler.
- Consequently, normal dashboard requests from every user shared one limiter bucket.
- Loading data-heavy pages could consume the shared bucket and block unrelated writes such as term creation.

## Fix

- Added `GatewayThrottlerGuard`.
- Protected requests are tracked by authenticated user ID.
- Public requests are tracked by real client IP.
- Configured Express to trust exactly one reverse-proxy hop.
- Moved JWT validation before protected-request throttling so the user identity is trusted.
- Increased the normal authenticated dashboard allowance to 300 requests per minute.
- Kept login stricter at 10 requests per minute per client IP.

## Source Control

- Commit: `c5d8411` (`fix(gateway): scope rate limits to authenticated users`)
- Branch: `main`
- Pushed to `origin/main`.

## Verification

- Gateway TypeScript build: passed.
- Gateway focused tests: 2 suites, 9 tests passed.
- Production release: `/opt/kilimanjaro/releases/c5d8411-20261102T201023Z`.
- PM2 services: 8 of 8 online after activation.
- Public gateway health check: passed.
- Authenticated production rate-limit smoke: 70 of 70 requests passed in one session.

## Term 3 Result

The requested term already existed after the user's attempts, so no duplicate was created.

- Academic year: `2026`
- Name: `Term 3`
- Start date: `2026-09-14`
- End date: `2026-11-13`
- Term ID: `11b3cdce-e278-474c-8a88-5433f7c6e12b`
- Matching database records: exactly 1

## Deployment Notes

- No schema migration was required.
- The release activation retained the previous backend release for rollback.
- Temporary deployment archives were removed.
- `npm ci` reported 97 dependency vulnerabilities: 6 low, 60 moderate, 26 high, and 5 critical. No forced automatic dependency upgrade was applied during this incident fix because that could introduce unrelated breaking changes.
