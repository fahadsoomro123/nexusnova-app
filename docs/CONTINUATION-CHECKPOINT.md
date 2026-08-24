# NexusNova continuation checkpoint

Updated: 24 Aug 2026

Current canonical app source: `fresh-rebuild/`
Current Android wrapper: `NexusNovaAndroid/`
Current working branch: `nexusnova-latest-full-apk-recovery-20260823`
Phone-PASS Golden baseline: `e6176f721216e3e0c3130c8811a4123bcafce8cc`
Disaster master: `apk-builds/full-disaster-master-20260824/NexusNova-FULL-DISASTER-MASTER-20260824.zip`

## Current phone-verified state
- App opens and Firebase login works on Android.
- Native Firebase App Check / reCAPTCHA Android failure is fixed.
- Firestore mining rollover was repaired; CLAIM & RENEW physically succeeded and mining restarted.
- Community Chat message write physically works.
- Profile save physically works.
- Marketplace listing write physically works.
- Current installed working debug APK integrity anchor: SHA256 `ba168d90c66ab0299208e55ab4f5fcc0afa31bd181efc8d94f47f96b8b540cf5`.

## Current app coverage
- Registered Nova apps: 58.
- Routed renderer coverage: 58/58; missing registered renderers: 0.
- Audit report: `apk-builds/app-audit/APP-RENDERER-COVERAGE.txt`.
- One non-registered legacy renderer alias `speed-test` remains in `live-tools.js`; it is not a missing app card.

## App Check / Firestore safety
- Firebase project: `nexusnova-6ade2`.
- Android package: `com.nexusnova.app`.
- Firebase App Check product enforcement remains OFF intentionally while broader metrics/verification continue.
- Do not randomly replace the currently working Firestore rules. The deployed rollover rule was phone-validated by successful CLAIM & RENEW.

## Mining / ad safety
- Do not force-expire or otherwise disturb an active mining session.
- The mining renewal interstitial change waits briefly for native interstitial readiness and falls back without permanently blocking mining.
- The next ad verification must happen at the next natural completed mining CLAIM & RENEW.
- If the ad does not appear but mining renews, inspect native ad readiness/events before changing mining logic.

## Android signing status
- Current installed build is from the pre-permanent-signing debug-key era.
- Permanent signed release workflow exists at `.github/workflows/nexusnova-permanent-signed-release.yml` and is manual-only.
- It requires the four `NEXUSNOVA_SIGNING_*` GitHub Actions secrets and verifies the release signature before publishing.
- Local Windows helper: `scripts/create-permanent-signing-key.ps1`.
- Private signing material must never be committed. The helper creates it outside the repository by default.
- Moving from the current debug signing identity to the new permanent signing identity can require one final uninstall/reinstall. After migration, all future Android updates must reuse the same permanent key and increasing versionCode values.

## Source / release rules
- Use `fresh-rebuild/` as the canonical modern app source for APK packaging.
- Normal web/UI/JS fixes use the OTA path; do not generate a native APK for web-only changes.
- Native Android bridge/dependency/manifest/signing changes require a native APK and physical-phone verification.
- Never package the legacy root `page2.html` shell as the modern app.

## Golden / recovery rule
- Never modify or force-move historical Golden branches.
- Bug fixes belong on the working branch.
- Create a NEW dated Golden only after the later state is physically verified on the phone.
