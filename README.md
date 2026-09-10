# NexusNova

Canonical NexusNova Android app repository.

## Source of truth
- Android shell/native code: `NexusNovaAndroid/`
- Canonical bundled web app: `fresh-rebuild/`
- `NexusNovaAndroid/app/src/main/assets/www/` is generated from `fresh-rebuild/` during Android `preBuild` and must not be committed.
- Firebase backend/hosting configuration remains in this repository where required by the app.

## Repository hygiene
Do not commit APK/AAB files, generated Android web assets, build outputs, caches, logs, local environment files, keystores, or temporary preview/test artifacts.

## Release/OTA
Use the current canonical build workflow for signed APK builds. NexusNova OTA is hosted separately by the NexusNova website OTA channel; source state, OTA publication, and phone-side application are separate states and must be verified separately.
