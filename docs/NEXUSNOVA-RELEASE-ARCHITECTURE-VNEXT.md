# NexusNova Release Architecture vNext

Status: implementation phase 1

## Production authority
Google Play is the authoritative distribution channel for native Android code.

- Native Kotlin/Android changes ship through an Android App Bundle (AAB).
- Play App Signing remains the release-signing authority for delivered APKs.
- Every native update must increase versionCode.
- Testing path: internal testing -> closed/open testing as needed -> staged production rollout -> monitored completion.
- In-app updates, when enabled, must use Google Play's Play Core in-app update flow rather than a custom APK downloader.

## Web/NovaCut update lane
The WebView content may use the existing NexusNova web OTA only for eligible interpreted web content.

- OTA payloads are versioned and tied to an exact bundled baseline.
- Manifest entries contain SHA-256 and byte-size declarations.
- Payloads are staged before activation.
- Activation is atomic.
- A failed or crashing OTA can roll back to the bundled baseline.
- OTA must never become the native APK distribution channel for the Play-distributed app.

## Release gates
A release candidate must pass:

1. Repository policy / frozen-zone guard.
2. Package identity validation.
3. Monotonic Android versionCode validation.
4. Android release build compilation.
5. Web/OTA payload sanity checks.
6. Required automated QA.
7. Human approval before merge/release.

## Rollout safety
Native releases should use Play Console staged rollout. The percentage is increased deliberately while release health and feedback are reviewed. A bad release is halted rather than being pushed to the entire install base.

## Rollback
Native rollback is handled by shipping a corrected Play release because users who already received a staged native release remain on that version after a rollout is halted.

Web OTA rollback is handled locally by removing/blocking the active overlay and returning to the signed bundled web baseline.

## Guardrails
The following remain outside this release-architecture work:

- SafePay / payment workers
- mining core and wallet engine
- FBR ATL checker
- Cloudflare workers/config/routes/workflows
- site logo
- sitemap/robots/canonical/indexing infrastructure

These paths require separate explicit scope and approval.
