# Google Play Store Release Checklist

## Deployment Record (2026-09-28)

- [x] Dashboard legal pages deployed to `manage.kilimanjaroschools.site` and verified without authentication.
- [x] Verified HTTP 200 for privacy policy, terms of service, account deletion, support, and legal hub routes.
- [x] Applied auth migration `20260928090000_account_deletion_requests` after taking the production backup `/opt/kilimanjaro/storage/backups/kilimanjaro-prod-before-account-deletion-20260928134714.dump`.
- [x] Verified `POST /api/v1/auth/account-deletion-requests` is reachable through the production gateway and validates invalid input without creating a request.
- [x] All PM2 services were online after the release switch.

## Application Identity

- [x] Android application ID: `site.kilimanjaroschools.app`.
- [x] Android display name: `Kilimanjaro Schools`.
- [x] Google Play Store icon prepared: `mobile/kilimanjaro/assets/images/kilimanjaro_schools_play_store_512.png`.
  - 512 x 512 pixels.
  - PNG, true colour, no transparency.
  - 113 KB, below the Play Console 1 MB limit.
- [ ] Create the Play Console application using exactly `site.kilimanjaroschools.app` before uploading the first release.
- [ ] Confirm the final application name, short description, full description, category, developer contact email, website, and privacy policy URL in Play Console.

## Public URLs To Submit

These routes are public and do not require a Kilimanjaro Schools login:

- Privacy policy: `https://manage.kilimanjaroschools.site/privacy-policy`
- Terms of service: `https://manage.kilimanjaroschools.site/terms-of-service`
- Account deletion: `https://manage.kilimanjaroschools.site/account-deletion`
- Support: `https://manage.kilimanjaroschools.site/support`
- Legal links hub: `https://manage.kilimanjaroschools.site/legal`

- [x] Deploy the dashboard release containing these pages.
- [x] Confirm every URL returns HTTP 200 without login. Browser-incognito verification remains a final release check.
- [ ] Provision and monitor `support@kilimanjaroschools.site` before publishing. The public policy and support pages use this address.
- [ ] Add the privacy policy and account deletion URLs to the mobile application's settings/help area before release.

## Account Deletion Compliance

- [x] Public account deletion request form implemented at `/account-deletion`.
- [x] Request API implemented at `POST /api/v1/auth/account-deletion-requests`.
- [x] Requests are recorded without disclosing whether an email is associated with an account.
- [x] Page explains that account credentials are deleted or deactivated after verification, while school, financial, safeguarding, legal, and audit records may need to be retained.
- [x] Apply the `20260928090000_account_deletion_requests` auth-service migration in the production deployment.
- [ ] Assign an operations owner to review pending requests and verify identity/authority, especially for student accounts.
- [ ] Document the internal response and completion process, including the 30-day completion target stated on the public page.
- [ ] Implement the same deletion request entry point inside the mobile application.

## Google Play Declarations

- [ ] Complete the Data Safety form from a verified data inventory. The app may process account identifiers, names, email addresses, telephone numbers, school/class assignments, student records, attendance, assessments, report cards, finance data, notifications, documents, and device/app diagnostics. Do not guess: confirm each implemented SDK and API payload.
- [ ] Declare whether data is encrypted in transit. Production API requests must use HTTPS only.
- [ ] Declare whether users can request deletion. Use the public account deletion URL above.
- [ ] Complete the Content Rating questionnaire.
- [ ] Complete Target Audience and Families declarations. The app handles student accounts, so this requires careful review.
- [ ] Declare advertisements accurately. Select no ads only if the release has no advertising SDK or advertising content.
- [ ] Complete App Access instructions using valid review credentials and role-specific test steps if login is required.
- [ ] Provide the required developer contact email and ensure it is monitored.
- [ ] Complete the Sensitive Permissions and Financial Features declarations if the final Android manifest or feature set requires them.

## Store Listing Assets

- [x] Store icon is ready.
- [ ] Prepare at least two phone screenshots showing real, non-placeholder app screens.
- [ ] Prepare tablet screenshots if tablet support is claimed.
- [ ] Prepare the required feature graphic (1024 x 500) if requested by the selected Play Console listing type.
- [ ] Confirm every screenshot uses production-quality data and contains no credentials, real student PII, or development URLs.
- [ ] Write concise short and full store descriptions that accurately describe the released role workflows.

## Release Engineering

- [ ] Set the production mobile environment to `https://srms.kilimanjaroschools.site`; no localhost fallback may be used in a release.
- [ ] Complete all items in `MOBILE_PRODUCTION_READINESS_GAPS.md` that are in scope for the first release.
- [ ] Increment the Android version code and version name for every Play upload.
- [ ] Configure a non-exported Android upload key and back it up outside the repository.
- [ ] Build an Android App Bundle: `flutter build appbundle --release --dart-define=APP_ENV=production`.
- [ ] Install and test the release build on physical Android devices over Wi-Fi and mobile data.
- [ ] Test login, logout, expired-session handling, error screens, and account deletion request submission against staging before production rollout.
- [x] Verify API TLS and privacy URLs after deployment. Confirm the support mailbox before publishing.
- [ ] Start with Internal Testing, then Closed Testing, before Production rollout.

## Final Go/No-Go Gate

- [x] All public URLs are deployed and working.
- [ ] The deletion-request migration is applied and a submitted request is visible to the operations owner.
- [ ] The support mailbox is active.
- [ ] Data Safety answers match the released application, SDKs, and backend behavior.
- [ ] App Access instructions and review credentials work.
- [ ] Release AAB passes physical-device acceptance tests.
- [ ] No development credentials, localhost URL, placeholder content, or unauthorized student data is in the release.
