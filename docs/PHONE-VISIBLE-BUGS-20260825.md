# NexusNova phone-visible bugs — 25 Aug 2026

These are user-observed phone bugs and must not be confused with static/hidden code-audit findings. A code change is not a phone PASS until the user physically verifies it.

## P0 / visible

1. Weather screen scrolls horizontally left/right at whole-screen level.
   - Repair path: OTA/CSS responsive containment.
   - Source fix staged on audit branch in `assets/styles/phone-visible-fixes.css`.
   - Phone verification: pending.

2. Qibla actual compass screen appears scrambled/overlapped on phone.
   - Confirmed source cause: phone layout gives the center only 54% while compass width is 142%, causing overlap with side cards.
   - Repair path: OTA/CSS full-width centered compass on narrow screens.
   - Source fix staged on audit branch in `assets/styles/phone-visible-fixes.css`.
   - Phone verification: pending.

3. Emergency SOS saved contact cannot be edited after initial setup.
   - Repair path: explicit edit control with prefilled saved contact.
   - Source fix staged on audit branch in `src/emergency-sos.js`.
   - Phone verification: pending.

4. Emergency SOS floating control is too large/ugly/obtrusive.
   - Desired behavior: small side control, fades while idle, touch activates, then SOS can be sent; edit becomes available while active.
   - Source fix staged on audit branch: compact/faded button, first touch activates, second touch sends, pencil edit control, auto-fade after 4 seconds.
   - Phone verification: pending.

5. Nova VPN has no usable disconnect action after connection on the user's phone.
   - Native source does contain a separate DISCONNECT button, so phone behavior/accessibility is still broken.
   - Repair path: make the primary native action itself switch to DISCONNECT while tunnel is UP; verify on physical phone.
   - Requires native APK.
   - Status: pending.

6. Nova Drive does not reliably save drive data.
   - Existing hidden-audit save-on-exit protection is not accepted as resolving this user-visible bug until phone-tested.
   - Requires reproduction + storage persistence verification.
   - Status: pending.

7. Nova Drive speed/distance under-counts during driving.
   - Existing precision/noise filters may be too aggressive for the user's device/GPS cadence.
   - Repair path: compare raw GPS speed/distance against accepted distance filter; tune only after preserving anti-spike protection.
   - Native/phone verification required.
   - Status: pending.

8. Online/API-backed apps are broadly not working on phone, including Entertainment and Travel and potentially other provider-backed modules.
   - Treat ALL online/provider-backed apps as BROKEN until individually proven with real live data.
   - Do not call an app working merely because API/function code exists.
   - Repo documentation itself still lists Travel API provider connection as pending in `docs/NATIVE-BACKEND-NEXT.md`.
   - Common root-cause audit: Firebase Functions deployment, Firebase App Check, Firebase Secret Manager provider secrets, and frontend callable/provider mapping.
   - Status: active investigation.

## Safety boundary
- Do not modify mining reward/accounting or Firestore mining rules as part of these fixes.
- Do not modify protected Golden branch.
- OTA fixes first where sufficient; native VPN/Drive fixes go into the next permanently signed APK after signing setup.
