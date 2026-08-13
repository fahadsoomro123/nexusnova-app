# NexusNova final Codex audit

Audit date: 2026-08-13

Originally audited commit: `4f193cfa0de64c9adcd2a4acbecf960056b602a0` (`Deep audit fixes and runtime repairs`)

Working branch: `codex-final-audit`

Protected branch: `stable-baseline` remained at `4f193cfa0de64c9adcd2a4acbecf960056b602a0`; it was not checked out, changed, merged, rebased, or deleted.

## 1. Scope and files inspected

Inspected the complete deployable web tree: `index.html`, `page2.html`, `styles.css`, every file in `css/`, every file in `js/`, `sw.js`, `manifest.webmanifest`, `icons/`, `firebase.json`, `.firebaserc`, `firestore.rules`, `package.json`, `package-lock.json`, `functions/`, and existing audit notes including `NEXUSNOVA-DEEP-AUDIT-REPORT.txt`.

Inspected the Android application: Gradle/configuration files, `AndroidManifest.xml`, all Kotlin/XML sources, caller-screening sources, and the complete `NexusNovaAndroid/app/src/main/assets/www/` mirror. Runtime web assets are now byte-identical between the canonical site and Android mirror. Deployment-only files intentionally remain separate from the mirror (`firebase.json`, `firestore.rules`, package metadata).

The approved visual design was preserved: no theme, layout, card, navigation, More-icon, wallet, or market redesign was introduced.

## 2. Bugs found

- Daily and PK News More cards targeted nonexistent tabs, blanking the dashboard.
- Multiple legacy mining, daily-reward, task, and withdrawal handlers directly wrote value fields to Firestore and raced the callable security module.
- The callable module required no App Check client initialization and had no email-verification refresh path.
- Firestore profile rules allowed an underspecified client-created referral model and did not enforce a complete zero-value creation schema.
- Withdrawal parsing accepted unbounded input and had no strict policy validation; the throttle was embedded in the public profile document.
- Market/wallet fallbacks could reduce Top 100 to about 16 assets if the late compatibility script failed.
- Several visible calculators executed user input through `Function()`.
- The service worker could fail its entire installation after one missing precache asset and could serve stale app code.
- Android loaded the app from `file://`, exposed a frame-wide JavaScript interface, granted web media permissions too broadly, lacked a file chooser, and had caller-contact privacy leaks.
- Android's canonical web mirror was stale in four runtime files after the final Firebase changes; the parity scan caught and corrected it.

## 3. Bugs actually fixed

- Retargeted Daily to `tasks` and PK News to `news`; `switchTab` now keeps the current view when a target is missing.
- Made callable-backed reward/mining/wallet handlers authoritative. Retired direct economic write paths no longer execute; the remaining executable dashboard writes are own-name editing and bounded chat creation only.
- Hardened functions with App Check enforcement, verified-email gating for value operations, server time, transactional mining/daily logic, disabled unverifiable task rewards, bounded decimal parsing, strict withdrawal policy parsing, and a server-only withdrawal rate-limit document.
- Replaced silent corrupted-value repair with fail-closed profile validation and explicit inconsistent-mining-session handling.
- Applied strict Firestore profile creation and name-only-update rules. Referral attribution is intentionally disabled until server-side proof exists.
- Added a real App Check integration path using a blank configuration marker, explicit token preflight, and clear failure messaging. No fake key was added.
- Added dashboard Refresh/Resend email-verification actions that reload the Firebase user and force a fresh ID token.
- Added a self-contained 100-asset zero-price fallback in `page2.js`, so an unavailable provider or failed compatibility file cannot reduce Market/Wallet below 100 rows.
- Replaced active `Function()` calculators with bounded recursive-descent parsers and synchronized the formerly stale Android root-level Mega asset copy.
- Bumped the service-worker cache, deletes obsolete caches, uses per-asset `Promise.allSettled` precaching, and uses network-first for HTML/JS/CSS.
- Migrated Android to `WebViewAssetLoader` on the secure appassets HTTPS origin; removed `NexusBridge`; restricted bridge messages to the trusted main frame; tightened navigation, file access, content access, mixed content, runtime permissions, file-picker size/MIME handling, backup policy, caller-screen direction, and contact isolation.
- Made native caller contacts account-scoped and contact-ID scoped, with 10–15 digit validation and safe active-account lifecycle handling. An unauthenticated Firebase state now clears the native active-account marker.

## 4. Features verified working

- More-menu navigation target integrity: 25 targets, no missing tab target, no duplicate page IDs.
- Top-100 fallback integrity: exactly 100 unique assets, with no invented price when live data is unavailable.
- Currency converter successful-path VM check: USD to PKR produced `277.8647`; its code maintains multiple live sources and cache fallback.
- Offline Market/Wallet fallback VM check: 100 unique, zero-price assets render rather than a fake price list.
- Calculator parser harness: `1+2*3` evaluates to `7`; `alert(1)` is rejected without execution.
- Unauthenticated dashboard route behavior: a local browser visit to `page2.html` redirected to the login page without console errors before the temporary test surface was removed.
- JS syntax, CSS structural checks, local-reference checks, active Android mirror hashes, and Android XML parsing all passed.

## 5. Features partially working

- Live market/news/gold/FX data have robust code paths and error states, but current provider availability was not revalidated end-to-end from this restricted environment.
- AI/voice, camera, location, notifications, QR, built-in browser, and file tools have guarded browser/device paths, but require real browser/device capabilities and consent for full validation.
- Family/emergency/phonebook UI is now account-isolated; physical Android caller-screen and native file-picker behavior remain unverified without an APK/device.
- Service-worker source behavior is repaired and statically verified. Browser registration/activation in the deployed origin remains unverified.
- Withdrawal now safely creates a review request when configured; it is not a complete balance-reservation, custody, or automated payout system.

### More-menu coverage

Every listed More card has a present `tab-*` target after the repair. This confirms reachability; provider/device-dependent content is not promoted to a stronger status without a live provider/device run.

| More item | Status | Evidence |
| --- | --- | --- |
| Travel | PARTIALLY WORKING | Target is present; browser/travel source is provider dependent. |
| Health | PARTIALLY WORKING | Local calculators are present; device/health integrations are not live-tested. |
| Smart | PARTIALLY WORKING | Target and tool scripts are reachable; external integrations remain optional. |
| Qibla | PARTIALLY WORKING | Secure-context location path is repaired; location/device permission is unverified. |
| PK News | FIXED AND VERIFIED | Retargeted from missing `regional-news` to live `news` tab. |
| Watch | EXTERNAL SETUP REQUIRED | Rewarded-ad provider is intentionally not simulated. |
| Browser | PARTIALLY WORKING | Safe URL handling is present; Android external/browser behavior needs device test. |
| Caller | PARTIALLY WORKING | Secure bridge/static caller checks pass; no real call-screening device run. |
| Settings | PARTIALLY WORKING | Bounded profile name and verification controls are wired; Firebase live path is unverified. |
| Super App | PARTIALLY WORKING | Target/handlers are reachable; included tools vary by browser/provider capability. |
| Daily Tools | FIXED AND VERIFIED | Retargeted Daily navigation resolves to the existing tasks tab. |
| Calendar | PARTIALLY WORKING | Local persistence path is reachable; device notification sync is unverified. |
| Reminders | PARTIALLY WORKING | Local UI path is reachable; scheduled/push delivery is provider/device dependent. |
| Finance | PARTIALLY WORKING | Local calculations parse; live price/FX inputs remain network dependent. |
| Weather | PARTIALLY WORKING | Error/fallback path exists; live provider not rerun. |
| Learning | PARTIALLY WORKING | Local generation/navigation targets are present; external search/provider behavior varies. |
| Pakistan Hub | PARTIALLY WORKING | News target is reachable; feed availability is external. |
| Islamic Hub | PARTIALLY WORKING | Local utilities work in source; prayer/location services are external/device dependent. |
| Habits | PARTIALLY WORKING | Local tool is reachable; storage is device-local. |
| Savings | PARTIALLY WORKING | Local tool is reachable; no banking backend is claimed. |
| Contacts | PARTIALLY WORKING | Account-scoped web/native paths are static-verified; Android device flow is unverified. |
| Shopping | PARTIALLY WORKING | Local list flow is reachable; price search/provider results are external. |
| Documents | PARTIALLY WORKING | File UI and Android chooser hardening are present; OCR/storage provider is not connected. |
| File Vault | EXTERNAL SETUP REQUIRED | No encrypted/cloud vault backend is configured; browser storage is not represented as a secure vault. |
| QR Tools | PARTIALLY WORKING | QR path is guarded with remote-sharing consent; scanner/device validation is unverified. |
| Security | PARTIALLY WORKING | Local device/security status path is reachable; privileged security controls require platform setup. |
| Marketplace | EXTERNAL SETUP REQUIRED | Listing/payment backend is intentionally not fabricated. |
| Orders | EXTERNAL SETUP REQUIRED | Courier/order backend is intentionally not fabricated. |
| Notifications | PARTIALLY WORKING | Browser permission path exists; FCM/push needs provider setup and device testing. |
| Teacher Toolkit | PARTIALLY WORKING | Local tool target/handlers are reachable; no external learning backend is claimed. |

## 6. Broken remaining features

- Native Android Google popup login is **BROKEN** in the current WebView architecture. `signInWithPopup` navigates away to an external provider and cannot reliably return to the opener. Replace it with Android Credential Manager/Firebase native auth or a tested redirect/deep-link flow.
- Referral earning/attribution is intentionally unavailable rather than client-trusted. The UI reports that server-verified referrals are not yet launched.
- Community Task 1 is intentionally rejected rather than awarded. There is no server-side Telegram membership proof.

## 7. External setup required

- A real Firebase App Check Enterprise site key must replace the intentionally blank `nexusnova-app-check-site-key` marker. Register every web hosting origin and `https://appassets.androidplatform.net`, verify token issuance, then deploy the enforced Functions.
- Configure production reCAPTCHA instead of the current v2 test key, plus Firebase Auth authorized domains/action URLs and Google OAuth credentials/SHA fingerprints as appropriate.
- Deploy the reviewed `firestore.rules` and Functions; emulator/deployment validation could not run locally because Functions dependencies are absent.
- Configure `NEXUSNOVA_DEPOSIT_ADDRESSES_JSON` with real custody addresses and `NEXUSNOVA_WITHDRAWAL_POLICY_JSON` with a reviewed allowlist. Add a ledger, balance reservation, idempotency, and human/automated payout process before sending funds.
- Integrate Telegram verification, a rewarded-ad network, WalletConnect/provider configuration, FCM/push provider, and any live AI/courier/provider APIs before advertising those actions as production-complete.
- Supply a Gradle wrapper/toolchain/SDK and test on Android hardware before shipping an APK.

## 8. Firebase findings

- Firebase client configuration is public project configuration, not a secret. No private credential was identified in the reviewed client files.
- Every callable is now wrapped with `onCall({ enforceAppCheck: true }, ...)`; value-bearing calls also require `email_verified`.
- Mining, daily rewards, and withdrawals are server-timed and transactional. The task reward stays disabled until proof exists.
- Profile creation is exact-schema, zero-value, authenticated-email-bound, and server-timestamp-bound. Client updates can only change a bounded display name.
- Chat is intentionally public to signed-in users and bounded, but has no moderation or rate-limit service. Treat it as a public community feature.
- Existing user documents must be checked/migrated before deployment. Functions now fail closed for malformed or missing economic fields instead of silently resetting balances.

## 9. Security findings

- Removed active dynamic evaluation from deployed runtime JS. The static scan found zero `eval()`/`Function()` sites in canonical runtime JS, Android mirror JS, and the formerly stale root-level Android Mega copy.
- Replaced emergency-contact rendering and scoped family/phonebook storage by account where it contains contact data.
- QR generation now asks before sending entered text to the remote QR service.
- Direct client-side balance/mining/reward/withdrawal mutations are not executable. Firestore rules reject client mutations of those fields even if a stale client is used.
- Remaining risk: several low-sensitivity productivity/settings caches are device-local browser storage rather than encrypted per-user storage. Do not treat local browser storage as a secure vault for sensitive documents or credentials.
- Remaining risk: Android caller contact data is backup-disabled and account-scoped, but is still stored in standard app-private preferences rather than encrypted storage.

## 10. Android findings

- `MainActivity` now serves local content through `https://appassets.androidplatform.net/assets/www/index.html`, enabling service-worker and geolocation secure-context behavior that `file://` prevented.
- `addJavascriptInterface`/`NexusBridge` was removed. The replacement WebMessage listener is origin- and main-frame-gated; arbitrary iframes cannot invoke contact actions.
- File/content access and mixed content are disabled. HTTP(S) external navigation is scheme constrained; custom schemes are rejected unless explicitly handled.
- Camera/microphone/location requests are gated and manifest permissions are present; the former blanket web permission grant was removed.
- File chooser now validates trusted top-level origin, MIME type (including PDF), individual/aggregate size, and unknown-size inputs. Android does not expose the requesting iframe origin to `onShowFileChooser`, so an HTTPS iframe can still present a user-initiated chooser while the trusted app page is top-level; the native bridge remains unavailable to that frame.
- Incoming caller UI is now gated to incoming calls and responds promptly. Caller contacts are active-account scoped and use exact contact IDs; a login page that resolves to no Firebase user clears the native active-account marker.
- Android source checks passed; APK compilation and device tests are **NOT VERIFIED** because no wrapper, JDK, Gradle, SDK, or local Android configuration exists in this workspace.

## 11. Cross-script conflicts found

- `core-failsafe.js`, legacy `page2.js` handlers, and the secure rewards module could all own mining/reward handlers. Legacy value paths were retired and the secure module reasserts the authoritative handlers.
- Dashboard is still a historically multi-owner script set: classic scripts execute during parsing while primary dashboard/rewards modules defer. Top-100 now reasserts final owners on DOM events, but a future maintenance pass should consolidate each global function to one owner rather than rely on overwrite timing.
- Market/Wallet now has an independent 100-asset fallback inside the primary dashboard, avoiding reliance on the late compatibility layer.

## 12. Service-worker/cache findings

- Cache name is now `nexusnova-shell-v6-final-stabilization`.
- Activation deletes all older caches.
- Installation caches each asset independently, so one unavailable optional asset no longer cancels the shell.
- HTML, JS, and CSS are network-first with cache fallback. This prevents a previous `page2.js` fix from being hidden behind stale cache when the network is reachable.

## 13. Exact tests and commands run

| Command/test | Result |
| --- | --- |
| `git branch --show-current; git rev-parse HEAD; git show-ref --verify refs/heads/stable-baseline` | `codex-final-audit`; both audit start and protected baseline resolved to `4f193cfa…` with no protected-branch mutation. |
| Recursive `node --check` across every non-`node_modules` JS file | **PASS** — 50 files. |
| In-memory Node static integration audit | **PASS** — 218 page IDs, 25 More targets, 0 duplicate/missing targets, 6 CSS files structurally balanced, 33 service-worker assets present, 36 active runtime mirror files byte-identical, fallback 100/100, all six callables protected, 0 dynamic-code sites. |
| In-memory Node executable-Firestore-write scan | **PASS** — only own-name `updateDoc` and chat `addDoc` remain live in dashboard code; no live transaction call. |
| `git diff --check` plus conflict-marker scan | **PASS**. |
| Recursive XML parse plus Android hardening scan | **PASS** — 11 XML files and 10 hardening assertions; legacy `NexusBridge.kt` absent. |
| Focused Node VM harnesses for Market/Wallet and calculators | **PASS** — 100 unique fallback rows; valid arithmetic accepted; attempted executable input rejected. |
| Currency converter VM successful path | **PASS** — USD→PKR result `277.8647`. |
| Local in-app browser test of unauthenticated `page2.html` | **PASS** — redirected to login with no console errors. |
| `npm.cmd run` | Only `start: servor --reload` exists; there is no automated package test script. |
| Functions module/emulator and Firebase deployment | **NOT VERIFIED** — no `node_modules` under root/functions and no live Firebase deployment credentials/configuration were used. |
| Android build | **NOT VERIFIED** — no Gradle wrapper, JDK, Gradle executable, Android SDK variables, or `local.properties`. |

## 14. Exact test results

The completed checks are static/in-memory and do not simulate a real balance, identity, wallet, or blockchain transaction. No fake API response, wallet balance, user account, CAPTCHA result, or Android device result was used. Provider-dependent paths are explicitly classified below instead of inferred from code presence.

## 15. Files changed

Canonical web/Firebase:

- `index.html`, `page2.html`, `sw.js`, `firestore.rules`, `functions/index.js`
- `js/core-failsafe.js`, `js/family-hub-v1.js`, `js/index.js`, `js/nexusnova-allinone-hub-v1.js`, `js/nexusnova-android-callerid-v1.js`, `js/nexusnova-mega-merge-v1.js`, `js/nexusnova-regional-qibla-browser-v1.js`, `js/nexusnova-tools-hub-v1.js`, `js/nexusnova-top100-live-fix-v3.js`, `js/page2.js`, `js/rewards-security-v1.js`, `js/wallet-actions-v2.js`

Android source:

- `NexusNovaAndroid/app/src/main/AndroidManifest.xml`
- `NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt`
- `NexusNovaAndroid/app/src/main/java/com/nexusnova/app/PhonebookStore.kt`
- `NexusNovaAndroid/app/src/main/java/com/nexusnova/app/caller/NexusCallScreeningService.kt`
- Deleted `NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusBridge.kt`

Android web mirror:

- `NexusNovaAndroid/app/src/main/assets/www/index.html`, `page2.html`, `sw.js`
- `NexusNovaAndroid/app/src/main/assets/www/js/core-failsafe.js`, `family-hub-v1.js`, `index.js`, `nexusnova-allinone-hub-v1.js`, `nexusnova-android-callerid-v1.js`, `nexusnova-mega-merge-v1.js`, `nexusnova-regional-qibla-browser-v1.js`, `nexusnova-tools-hub-v1.js`, `nexusnova-top100-live-fix-v3.js`, `page2.js`, `rewards-security-v1.js`, `wallet-actions-v2.js`
- Synchronized stale unreferenced root-level `NexusNovaAndroid/app/src/main/assets/www/nexusnova-mega-merge-v1.js` and `.css` copies to the current safe loaded versions.

This report is also a changed file: `NEXUSNOVA-FINAL-CODEX-AUDIT.md`.

## 16. Remaining risks

- Live public APIs can be rate-limited, blocked by CORS, or unavailable. The UI now gives bounded errors/fallbacks but cannot make a third-party provider reliable.
- Existing Firefox/Chrome/mobile service-worker state needs a production deployment test even though the stale-cache strategy is corrected.
- The broad script architecture has multiple historical compatibility layers. The fixed value paths are protected, but a future bundled/module migration would reduce maintenance risk.
- Public chat needs moderation, anti-spam/rate limits, and abuse handling before a large public release.
- Device-local productivity data and non-encrypted Android preferences are not a replacement for encrypted server storage.

## 17. Release blockers

1. Configure and verify real Firebase App Check before deploying enforced callables; the site-key marker is deliberately blank.
2. Deploy/test Functions and Firestore rules against a staging project; migrate or repair existing profile documents first.
3. Do not automate withdrawals until a ledger/reservation/idempotency/custody process exists.
4. Replace the Android WebView Google popup flow with native/redirect authentication and test the authorized-domain/OAuth configuration.
5. Restore a reproducible Android build environment and perform physical-device tests for login, location, camera, file selection, caller role, contacts, and service worker.
6. Configure production CAPTCHA, task verification, ads, deposits, wallet provider integration, and other provider-backed features before release.

## 18. Final feature table

| Feature | Before | After | Verification evidence | Relevant files |
| --- | --- | --- | --- | --- |
| Email auth/profile creation | PARTIALLY WORKING | PARTIALLY WORKING | Profile schema static checks and unauthenticated route browser test passed; live Auth/CAPTCHA not exercised. | `index.html`, `js/index.js`, `js/page2.js`, `firestore.rules` |
| Email verification refresh | BROKEN | PARTIALLY WORKING | Refresh reloads user and forces ID token in source; Resend UI is wired and syntax checked, but live Firebase Auth was not run. | `page2.html`, `js/page2.js` |
| Web Google login | EXTERNAL SETUP REQUIRED | EXTERNAL SETUP REQUIRED | Requires Auth/OAuth authorized-domain configuration and live validation. | `index.html` |
| Native Android Google login | BROKEN | BROKEN | Popup flow cannot reliably return through current WebView external-navigation design. | `index.html`, `MainActivity.kt` |
| CAPTCHA/App Check | BROKEN | EXTERNAL SETUP REQUIRED | Clear App Check preflight and blank public configuration marker verified; real provider key intentionally absent. | `index.html`, `page2.html`, `js/page2.js`, `functions/index.js` |
| Mining lifecycle | BROKEN | EXTERNAL SETUP REQUIRED | Direct writes retired; callable/server-time/24-hour code and strict rules verified. Needs deployed App Check/Functions and verified email. | `js/page2.js`, `js/core-failsafe.js`, `js/rewards-security-v1.js`, `functions/index.js`, `firestore.rules` |
| Daily reward | BROKEN | EXTERNAL SETUP REQUIRED | Transactional callable plus replay guard verified statically; production setup needed. | `js/page2.js`, `js/rewards-security-v1.js`, `functions/index.js` |
| Community task reward | BROKEN | EXTERNAL SETUP REQUIRED | Reward deliberately disabled until server-side Telegram proof exists; no NVX is awarded. | `page2.html`, `js/rewards-security-v1.js`, `functions/index.js` |
| Rewarded ads | EXTERNAL SETUP REQUIRED | EXTERNAL SETUP REQUIRED | UI truthfully reports no provider; no fake reward. | `js/page2.js` |
| Market Top 100 | PARTIALLY WORKING | FIXED AND VERIFIED | Node VM/provider-offline path returns 100 unique zero-price assets; no 20/16-item fallback. | `js/page2.js`, `js/nexusnova-top100-live-fix-v3.js` |
| Wallet Top 100 display | PARTIALLY WORKING | FIXED AND VERIFIED | Same 100-asset fallback and mirror checks passed. | `js/page2.js`, `js/nexusnova-top100-live-fix-v3.js` |
| Wallet connection/on-chain balances | EXTERNAL SETUP REQUIRED | EXTERNAL SETUP REQUIRED | Requires a real injected wallet/provider and chain/device test; no balance is fabricated. | `js/wallet-*.js` |
| Deposit/withdrawal | BROKEN | EXTERNAL SETUP REQUIRED | Secure review-request code is fail-closed without real configuration; no custody/ledger is invented. | `js/wallet-actions-v2.js`, `functions/index.js`, `firestore.rules` |
| Currency converter | PARTIALLY WORKING | FIXED AND VERIFIED | Actual-source VM successful path gave USD→PKR `277.8647`; cache/multi-source wrapper traced. | `js/page2.js` |
| Gold/finance tools | PARTIALLY WORKING | PARTIALLY WORKING | Local calculations parse; live gold/FX providers remain network dependent. | `js/page2.js`, `js/aux-v8.js`, tool modules |
| News | PARTIALLY WORKING | PARTIALLY WORKING | Safe failure/render paths inspected; no current live provider browser test. | `js/news-fix.js`, `js/aux-v8.js`, `js/nexusnova-ultimate-upgrade.js` |
| Community chat | PARTIALLY WORKING | PARTIALLY WORKING | Bounded authenticated create/rules path is static-verified; no live Firebase moderation/rate-limit run. | `js/page2.js`, `firestore.rules` |
| AI chat/voice/commands | PARTIALLY WORKING | PARTIALLY WORKING | Unsupported-browser guards and non-recursive command paths were inspected; no live microphone/speech/provider session was run. | `js/nexusnova-ultimate-upgrade.js`, `js/voice-commands-v1.js`, `js/nexusnova-natural-voice-v1.js` |
| More-menu navigation | BROKEN | FIXED AND VERIFIED | 25/25 target scan passed; invalid targets retain current screen. | `page2.html`, `js/page2.js` |
| More provider-backed tools | PARTIALLY WORKING | PARTIALLY WORKING | Dead controls now provide honest integration/setup state; provider functions need configuration. | Mega/Super/Tools modules |
| Calculators | BROKEN | FIXED AND VERIFIED | Recursive parsers accept arithmetic and reject executable input; active dynamic-evaluation scan is zero. | `js/nexusnova-allinone-hub-v1.js`, `js/nexusnova-mega-merge-v1.js`, `js/nexusnova-tools-hub-v1.js` |
| Family/emergency/phonebook | PARTIALLY WORKING | PARTIALLY WORKING | Account scoping and normalized contact paths statically verified; device caller behavior not run. | `js/family-hub-v1.js`, `js/nexusnova-tools-hub-v1.js`, `PhonebookStore.kt` |
| Android caller bridge | BROKEN | PARTIALLY WORKING | Main-frame/origin gate, UID scope, exact deletion, and static Kotlin/XML checks passed; no physical-device caller flow was run. | `MainActivity.kt`, `PhonebookStore.kt`, caller bridge JS |
| Android APK/device behavior | NOT VERIFIED | NOT VERIFIED | No Gradle/JDK/SDK/wrapper or device available. | `NexusNovaAndroid/` |
| Service worker/cache | BROKEN | PARTIALLY WORKING | Version/network-first/all-settled static checks passed; deployed browser registration not run. | `sw.js`, `index.html`, `page2.html` |
