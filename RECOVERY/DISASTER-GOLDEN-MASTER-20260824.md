# NexusNova Disaster Golden Master — 24 Aug 2026

## Purpose
This branch is a disaster-recovery anchor for the current NexusNova state. It must not be used as a normal development branch and must never be force-moved to a newer commit.

## Immutable source anchor
- Repository: `fahadsoomro123/nexusnova-app`
- Recovery branch: `nexusnova-disaster-golden-master-20260824`
- Exact recoverable source commit: `d8be5cc12b015a4c13e39ccea0d1a81b9e79ced3`
- Exact source tree: `6549cf1754652aacca3e4f6ae95acba05f265678`
- Active development branch at capture: `nexusnova-latest-full-apk-recovery-20260823`
- Previous protected Golden retained untouched: `nexusnova-golden-phone-pass-20260823` @ `e6176f721216e3e0c3130c8811a4123bcafce8cc`
- Older approved backup retained: `nexusnova-master-backup-20260820-approved` @ `484a50ee95259daac98beb8b1caf2e2bae9526fe`

## Phone-verified state at capture
Confirmed on the user's Android phone before this recovery snapshot:
- App opens and login works.
- Native Firebase App Check / reCAPTCHA Android error is fixed.
- Mining CLAIM & RENEW succeeded and mining restarted.
- Current mining session was active after the successful rollover.
- Community Chat Firestore write works.
- Profile save Firestore write works.
- Marketplace listing Firestore write works.

Do not reinterpret this as proof that every app feature has been physically tested.

## Known intentionally pending items
- Firebase App Check enforcement remains OFF until broader secure-action verification is complete.
- Mining renewal interstitial behavior is pending the next natural completed ~24h CLAIM; do not force-expire mining merely to test it.
- Permanent Android signing workflow exists, but the permanent keystore and encrypted signing secrets must be created/backed up separately before using it.
- The currently installed native build came from the pre-permanent-signing era; the first migration to the permanent key may require one final uninstall/reinstall.

## OTA anchor
- Latest production web OTA source version at capture: `a5058be75d90b945825f85da5422a96bedde534a`
- OTA release branch: `nexusnova-ota-release`
- The OTA cleanup removed verbose mining preflight diagnostics only; mining reward/rollover logic was not changed by that cleanup.

## Critical tracked-file integrity anchors
These Git blob IDs must match when recovering the source commit:
- `fresh-rebuild/src/core/firebase-backend.js` -> `824226d856cc2ace60805c50387ac2537b1bddc9`
- `firestore.rules` -> `ca766a67dbd3771c29e89f9228e0ba34ffbee289`
- `NexusNovaAndroid/app/build.gradle.kts` -> `3657e8ba747a344876e599508b1594d43dd24d10`
- `.github/workflows/nexusnova-permanent-signed-release.yml` -> `b77fbed575f42c568b94b85ad373038fbd6ecde0`

The commit/tree SHA is the authoritative integrity anchor for the complete tracked repository state.

## Secret handling — never store here
Do NOT commit any of the following to this branch or to a recovery ZIP:
- Android signing `.jks` / `.keystore` files.
- Keystore/store password, key password, alias credentials.
- GitHub encrypted-secret values.
- Firebase Admin/service-account private keys.
- Any private API/provider secret.

The permanent signing keystore must be backed up separately in at least two offline encrypted locations once created. Losing that key after migration can permanently break normal APK update continuity.

## Firebase / backend recovery notes
- Firebase project: `nexusnova-6ade2`.
- Android package: `com.nexusnova.app`.
- Firestore rules represented by this source commit were manually published and subsequently phone-validated by successful mining rollover plus Chat/Profile/Marketplace writes.
- Do not randomly replace deployed Firestore rules during recovery. First compare the deployed rules with this commit.
- Keep App Check enforcement OFF during disaster recovery until login + mining + direct Firestore writes are confirmed again.

## Recovery procedure
1. Stop all development writes.
2. Create a new temporary recovery branch from exact commit `d8be5cc12b015a4c13e39ccea0d1a81b9e79ced3`.
3. Verify tree SHA is `6549cf1754652aacca3e4f6ae95acba05f265678`.
4. Verify the critical blob IDs listed above.
5. Do NOT alter the historical Golden branches.
6. Restore/deploy web changes using the normal OTA path only.
7. Before a native APK build, restore the permanent signing key/secrets if permanent signing has already been activated. Never silently fall back to a new debug key for an update build.
8. Compare Firestore rules from this commit with Firebase before publishing them.
9. Test login on the physical phone.
10. Verify App Check-backed secure reads/writes.
11. Verify mining snapshot without changing an active session.
12. Only at a natural completed mining session test CLAIM & RENEW and the interstitial flow.
13. Test Community Chat send, Profile save, and Marketplace listing write.
14. Only after phone evidence create a NEW Golden branch. Never overwrite this disaster branch or any older Golden.

## Rollback rules
- Normal web/UI/JS regression: rollback/publish OTA web only.
- Native Android bridge/dependency/manifest/signing regression: use a native build only after signing continuity is confirmed.
- Firestore permission regression: inspect deployed rules and rule-compatible data first; do not mutate user balances or mining timestamps to make a test pass.
- Ad inventory failure must never corrupt or permanently block mining.

## Recovery lock
This recovery branch is archival. No feature work, no OTA development, no rule experiments, no version bumps, and no force-pushes belong here. If a newer state becomes phone-confirmed, create another dated Golden/Disaster branch instead of moving this one.
