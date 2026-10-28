# Mobile Build Reference

Read this file before changing the Android identity, signing configuration, or creating a Play Store build.

## Stable Release Identity

- Android package / application ID: `site.kilimanjaroschools.app`
- App name: `Kilimanjaro Schools`
- Production API: `https://srms.kilimanjaroschools.site`
- Flutter production environment: `ENV=production`

Do not change the application ID after the first Google Play upload. Future updates must use this same package and signing key.

## Signing

- Upload key alias: `kilimanjaro-play-upload`
- Local keystore: `C:\Users\MICROSPACE\.keystores\kilimanjaro-schools-play-upload.jks`
- Local signing configuration: `mobile/kilimanjaro/android/key.properties`

The keystore and `key.properties` are deliberately ignored by Git. Do not commit them or publish their passwords. Losing the upload key requires using Google Play's upload-key reset process before future updates can be submitted.

## Build Command

From `mobile/kilimanjaro` on this workstation, use Android Studio's bundled Java runtime and build the signed AAB:

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
flutter build appbundle --release --dart-define=ENV=production
```

For an obfuscated production release, preserve split debug symbols outside the uploaded AAB:

```powershell
flutter build appbundle --release --obfuscate --split-debug-info=build/symbols/release-<version-name>-<version-code> --dart-define=ENV=production
```

Output:

```text
mobile/kilimanjaro/build/app/outputs/bundle/release/app-release.aab
```

Before every upload, increment `version:` in `mobile/kilimanjaro/pubspec.yaml`. The value after `+` is the Android version code and must be greater than the version code already uploaded to Google Play.

## Latest Build Record

Built on 2026-10-28 from the current local mobile workspace (replaces the rejected `1.0.2+3`).

- Package: `site.kilimanjaroschools.app`
- Version: `1.0.3+4`
- Size: `63.6 MB`
- SHA-256: `FCEF7609FB597C4844AD7110AF880942A4941129664E3012968338CD1FEF7C43`
- Signing key: local `kilimanjaro-play-upload` upload key
- Environment: `ENV=production`
- API target: `https://srms.kilimanjaroschools.site`

The hash and size apply only to this exact artifact. Replace this record after each successful signed release build.

**Do not upload this build until the production backend has been updated** to the release described in `deployment/DEPLOYMENT_GUIDE_2026-10-25.md`. The app depends on the gateway mobile adapters, e-learning rules and finance endpoints added on 2026-10-24; against an older backend, new screens show error states, which Google Play review treats as a broken app.

## Release Verification

Before uploading an AAB, confirm:

- The package remains `site.kilimanjaroschools.app`.
- The build is signed by `kilimanjaro-play-upload`.
- The version code is new.
- The production environment resolves to HTTPS `srms.kilimanjaroschools.site`, never localhost.
- The AAB has been tested on a physical Android device before a production rollout.
