# NexusNova Android App

Canonical Android source repository for NexusNova.

## Source of truth

- `fresh-rebuild/` — canonical web UI/runtime source used by the Android WebView shell.
- `NexusNovaAndroid/` — Android application shell, native services, bridges, Gradle project and generated bundled web assets.
- `.github/workflows/` — CI, QA and signed APK workflows.

Android builds sync `fresh-rebuild/` into `NexusNovaAndroid/app/src/main/assets/www/` during `preBuild`. Do not hand-edit the generated bundled web copy as an independent source.

## Development rule

Make app/runtime changes in the canonical source paths above. Preserve OTA compatibility and verify both the web runtime and Android build before release.
