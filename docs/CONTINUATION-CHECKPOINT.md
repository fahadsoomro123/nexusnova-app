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
- Current working debug APK integrity anchor: SHA256 `ba168d90c66ab0299208e55ab4f5fcc0afa31bd181efc8d94f47f96b8b540cf5`.
- User confirmed the last APK installed and currently running on the phone was downloaded as `NexusNova-LATEST-FULL-PHONE-TEST-4.apk`; the pre-install file screenshot shows `27.85 MB`.
- The repository artifact `apk-builds/latest-fresh-full-phone-test/NexusNova-LATEST-FULL-PHONE-TEST.apk` is exactly `27,848,088` bytes (27.85 MB), so filename base + displayed size align with the saved working artifact. The local `-4` suffix is a duplicate-download filename suffix, not an app version number.
- Exact byte identity remains anchored by the repository SHA256 above unless a phone-side SHA256 is independently measured.

## Current app coverage
- Registered Nova apps: 58.
- Routed renderer coverage: 58/58; missing registered renderers: 0.
- Audit report: `apk-builds/app-audit/APP-RENDERER-COVERAGE.txt`.
- One non-registered legacy renderer alias `speed-test` remains in `live-tools.js`; it is not a missing app card.

## App Check / Firestore safety
- Firebase project: `nexusnova-6ade2`.
- Android package: `com.nexusnova.app`.
- Firebase App Check product enforcement remains OFF intentionally while broader metrics/verification continue.
- Callable Functions are statically guarded by `.github/scripts/functions-appcheck-readiness.py`; value-bearing/authenticated callables must retain `enforceAppCheck:true`.
- Provider S2S callbacks remain public by necessity but must retain provider cryptographic verification + transaction idempotency.
- Do not randomly replace the currently working Firestore rules. The deployed rollover rule was phone-validated by successful CLAIM & RENEW.

## Repository / CI security
- The GitHub repository is currently PUBLIC because the existing OTA/raw release architecture depends on unauthenticated public delivery. Do not flip it private without first separating public release delivery from private source storage.
- No private signing key/service-account/GitHub/OpenAI-style token was found in the current repository audit.
- `.github/scripts/repo-secret-readiness.py` rejects tracked private signing/credential files and high-confidence secret signatures.
- `.github/workflows/nexusnova-repo-secret-readiness.yml` runs the secret-readiness guard with `contents: read` only.
- `.github/dependabot.yml` monitors GitHub Actions, Android/Gradle and Functions/npm dependencies weekly.
- Android WebView security readiness was refreshed for the current architecture and now runs on the active branch.
- Rewarded/backend CI now runs on the active branch and includes Functions syntax, App Check boundary and rewarded-ad invariant checks.
- The Functions source runtime target is Node.js 22. This source change is NOT a live deployment by itself.

## Branch protection limitation
- `nexusnova-golden-phone-pass-20260823` still points to exact Golden commit `e6176f721216e3e0c3130c8811a4123bcafce8cc`.
- GitHub reports the Golden branch as `protected: false`.
- The working and disaster recovery branches have also been observed without GitHub branch protection.
- Until GitHub branch rules are explicitly enabled, the no-force-push/no-move rule is a documented operational policy rather than an enforced repository rule.
- Never force-move or develop on historical Golden/disaster branches.

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
