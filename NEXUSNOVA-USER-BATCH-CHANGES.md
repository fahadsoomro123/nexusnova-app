# NexusNova User Batch Repair + Feature Pass

## Base
This package was built from the user-supplied `wmaiqmvajz.github.zip` (Codex audit branch export). Existing approved visual styling was preserved except where the user explicitly requested visual/UX changes.

## Requested problems addressed

### Profile
- Added a final authenticated profile refresh that reads the signed-in Firebase user and its own Firestore `users/{uid}` document.
- Restores email, user id, stored name, total mined, tasks completed and stored referral code where available.
- Removed the misleading `Account loaded` fallback from `aux-v8.js`.
- No fake referral code is invented if the server has not created one.

### Bottom navigation
- Added a final navigation guard so only one bottom dock item keeps the `active` class.
- ALL APPS is highlighted for non-core feature screens.

### GOLD/FX + Money currency converters
- Replaced the final runtime converter handler with one canonical conversion path.
- Correct cross-rate formula: amount / source-USD-rate * target-USD-rate.
- Uses multiple live no-key sources with local cache and a finite timeout.
- A failed API no longer leaves the UI permanently on `Loading...`; it changes to a retryable error state.
- Added required ExchangeRate-API attribution.

### Tools navigation
- Tools main screen now has `Back to ALL APPS`.
- Every opened individual tool gets a `Back to Tools` header.
- When a tool is opened, the Tools menu is hidden and only the selected panel is shown instead of stacking tool outputs in one long screen.

### Height units
- Height-specific BMI fields now use Feet + Inches in both Tools BMI and Health BMI.
- General-purpose unit conversion is intentionally unchanged (centimeters remain valid as a general unit).

### QR Tools
- Camera scanning supports native `BarcodeDetector` where available.
- Added jsQR fallback for browsers without native QR decoding.
- Added `Upload QR Image` flow.
- Added Copy result and Open Link actions.
- Camera failure/permission denial now clearly points the user to image upload.

### Weather
- Removed the final runtime dependency on a hard-coded Karachi fallback.
- Added manual city search and `Use My Location`.
- Added a premium weather visual card with condition-specific visual styling, temperature, feels-like, humidity, wind and 3-day outlook.

### Prayer Times
- Removed the final runtime dependency on hard-coded Karachi.
- Added manual city search and `Use My Location`.
- Displays Fajr, Sunrise, Dhuhr, Asr, Maghrib and Isha for the selected/current location.

### Internet Speed Test
- Added a new Speed Test inside Tools.
- Measures ping, download and upload against Cloudflare speed endpoints.
- Displays a premium result gauge and progress state.

### Mining button
- Preserved mining logic.
- Added premium gradient/glow states for start/active/stop visual states.

### MORE renamed to ALL APPS
- Bottom navigation label changed to `ALL APPS`.
- Existing feature order is preserved.

## New scripture features

### Islamic Hub — Quran Pak
- Islamic Hub now contains a Quran reader.
- All 114 Surahs are selectable.
- Loads Arabic Uthmani text and Urdu Fateh Muhammad Jalandhry translation together, Ayah by Ayah.
- Includes last-read/bookmark persistence.
- Data source: Al Quran Cloud API (`quran-uthmani`, `ur.jalandhry`).

### Islamic Hub — Sahih Bukhari
- Islamic Hub contains a Sahih al-Bukhari reader.
- Arabic and Urdu are displayed together for a requested Hadith number.
- Previous/Next navigation and last-read persistence are included.
- Data source: fawazahmed0/hadith-api Arabic and Urdu Bukhari editions (Unlicense).

### Bible — separate from Islamic Hub
- A separate `Bible` item is added to ALL APPS immediately after Islamic Hub.
- It is NOT placed inside Islamic Hub.
- Includes all 66 Protestant book names and chapter selectors.
- English source: World English Bible (Public Domain).
- Urdu source: Biblica Open Urdu Contemporary Version via eBible.org (CC BY-SA 4.0).
- The reader selects English or Urdu and opens the chosen chapter; a full-page fallback is provided in case embedding is blocked by a browser/WebView.

## Security / provider-dependent items intentionally NOT bypassed
These are not honestly fixable with client-side code alone and have not been faked:
- Daily Reward requires real Firebase App Check and deployed secure Functions/Rules.
- Watch Ad requires a real ad/reward provider integration.
- Community task verification requires server-side verification.
- Real-value withdrawals require custody/ledger/accounting/security infrastructure.
- Native Android Google popup auth still requires a native or redirect-based Android auth solution.
- Android caller/device behavior still requires a real Android SDK/device build test.

## Static verification performed
- 52 JavaScript files parsed successfully with `node --check`: 0 syntax failures.
- `index.html`: 0 duplicate IDs, 0 missing local script/style/image references.
- `page2.html`: 0 duplicate IDs, 0 missing local script/style/image references.
- Service worker shell list: 35 local assets, 0 missing.
- 166 inline handler references / 80 unique handler names checked: 0 unresolved static handlers.
- No active `eval()` / `new Function()` found in app JS/functions scan.
- Confirmed requested IDs/UI wiring for Feet/Inches, QR image upload, Weather city, Prayer city, ALL APPS and final repair bundle.
- Confirmed root web and Android mirror byte-for-byte parity for all files changed in this pass.
- The environment blocked local Chromium navigation, so a full authenticated interactive browser run could not be executed here. Static/runtime-source validation was completed instead; StackBlitz remains the appropriate final interactive check.

## Files changed/added by this pass
- `page2.html`
- `js/aux-v8.js`
- `js/nexusnova-final-user-fixes-v1.js` (new)
- `css/nexusnova-final-user-fixes-v1.css` (new)
- `sw.js`
- Matching files under `NexusNovaAndroid/app/src/main/assets/www/`
- This report

## Cache
Service worker cache version was bumped to `nexusnova-shell-v7-user-batch` so previous stale JS/CSS should not mask this repair pass.
