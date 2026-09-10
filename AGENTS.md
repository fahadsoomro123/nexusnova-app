# NexusNova Repository Rules

This repository is the canonical NexusNova Android app source.

## Preserve working app behavior
- Do not redesign or rewrite working features unless the user explicitly approves that change.
- Protect Mining, Nova Hub apps, authentication, wallet/rewards, Firebase integration, native Android services, and current production UI.
- Treat similar/old-looking runtime files as removable only after dependency and runtime ownership are verified.

## Canonical web source
- `fresh-rebuild/` is the canonical bundled web source used by the Android app.
- `NexusNovaAndroid/app/src/main/assets/www/` is generated from `fresh-rebuild/` during Gradle `preBuild`; never maintain or commit a second copy there.

## Repository hygiene
- Never commit APK/AAB outputs, build directories, caches, logs, temporary previews, one-off release markers, `.env`, keystores, or local secrets.
- Keep only workflows/scripts that still serve the current build, QA, security, or recovery process.
- Do not recreate the deleted `nexusnova-app-public-build` mirror.

## Verification rule
Keep these states separate: source-code change, successful build/CI, OTA publication, phone-side OTA/application, and screenshot/device verification. Never claim a later state from an earlier one.
