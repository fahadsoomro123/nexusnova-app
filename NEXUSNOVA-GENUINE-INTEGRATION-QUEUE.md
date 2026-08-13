# NexusNova — Genuine Integration Queue

This file is the source-of-truth for features that must NOT be faked. A feature leaves this queue only after its real API/native/backend path is configured and tested.

## Rules
- Never generate fake balances, tickets, caller names, tracking states, reward proofs, payment confirmations or provider data.
- Public/no-key APIs may run directly in the client when safe.
- Secret API keys/tokens must stay in a backend/native secure configuration, never in public frontend code.
- Value-bearing NVX changes must be server-authoritative.

## Pending / blocked integrations

### AI core
Status: REWORK REQUIRED
Need: app-aware NVX/mining/profile context, persistent account-scoped memory, reliable NexusNova commands, and improved voice behavior. Existing Gemini/Firebase AI layer is not considered final until the app-context and memory behavior is verified in runtime.

### Daily reward / secure mining / protected NVX mutations
Status: DEPLOYMENT + SECURITY REQUIRED
Existing code: authenticated Firebase callable Functions with App Check enforcement.
Need: production Firebase App Check site/app registration, deployed Functions/rules, verified runtime test.

### Community task verification
Status: BACKEND REQUIRED
Need: real campaign/provider verification before any NVX credit. Telegram/community membership must not be accepted from a client-only button click.

### Watch Ad reward (+NVX)
Status: AD PROVIDER + BACKEND REQUIRED
Need: legitimate rewarded-ad SDK/provider, verified completion callback/server validation, then server-side NVX credit.

### Learning
Status: RUNTIME WIRING PENDING
Created: js/nexusnova-learning-engine-v1.js
Commit: b1ee7a452b22daa37279325ee78dcca65b4dd7fa
Includes: Wikimedia live knowledge lookup, real solved/past-paper web search, live-source quiz, local study planner.
Blocker: existing late-loader update was blocked by tool safety status, so do not call this runtime-complete until the loader is wired and tested.

### Travel — Flights
Status: PROVIDER API REQUIRED
Need: real flight search/schedule/fare API. Booking requires provider/affiliate/commercial access and payment flow. Never show invented fares or availability.

### Travel — Pakistan Railway
Status: PROVIDER/OFFICIAL DATA REQUIRED
Need: legitimate Pakistan Railways schedule/availability source or authorized provider. Ticket purchase must use an official/provider flow.

### Travel — Bus
Status: PROVIDER API/PARTNERSHIP REQUIRED
Need: real bus operator/aggregator routes, schedules, fares and booking integration.

### Caller ID
Status: API + ANDROID NATIVE REQUIRED
Web/PWA: manual lookup/validation only.
Android: native Caller ID / call-screening role bridge exists, but verified caller identity/spam reputation requires a legitimate data provider and Android permission/store-policy compliance.

### Wallet deposit / withdrawal production setup
Status: SECURITY + CONFIGURATION REQUIRED
Existing backend refuses fake addresses and unconfigured withdrawals.
Need: chosen custody/non-custody design, supported networks/assets, real deposit address mapping, withdrawal policy, ledger/audit process and production security review.

### Pakistan Hub — Government services / utilities
Status: OFFICIAL SERVICE CONNECTIONS REQUIRED
Need: official Pakistan/Sindh government portals/APIs where available; utility providers should use official bill/service endpoints or safe external links. No fake bill status.

### Islamic Hub extras
Status: CLIENT/API WIRING REQUIRED
Prayer Times and Qibla already have real live paths.
Pending: Hijri Calendar, Ramadan calendar, Sehri/Iftar view, 99 Names & Duas. Prefer reputable/public sources and local verified static religious reference data where an API is unnecessary.

### Documents
Status: LOCAL/API FEATURE COMPLETION REQUIRED
Current: file inspection and image handoff to AI.
Pending: genuine receipt extraction/OCR and PDF maker. Prefer local/browser processing where possible; OCR/AI provider only when needed.

### File Vault
Status: STORAGE BACKEND REQUIRED
Current: local file inspection only.
Need: Firebase Storage or equivalent private object storage, per-user authorization rules, upload/download/delete, quotas and encryption/security review.

### QR Tools — Payment QR
Status: PAYMENT PROVIDER/STANDARD REQUIRED
Generic text/Wi-Fi/contact QR is real.
Payment QR must be tied to a legitimate payment standard/provider and must never display a fake payment confirmation.

### Security — App Lock
Status: ANDROID NATIVE REQUIRED
Web security/permission/backup tools exist.
Need: Android biometric/device-credential integration and secure local state handling.

### Marketplace
Status: BACKEND + STORAGE + PAYMENT REQUIRED
Need: real listings database, seller ownership, images/storage, search/categories, favorites, moderation, orders, payment provider and abuse controls.

### Orders & Delivery
Status: BACKEND + COURIER API REQUIRED
Need: real order records, status state machine, payment linkage, courier/tracking provider and verified return/refund workflow.

### Notifications
Status: FCM / NATIVE PUSH REQUIRED
Browser notification permission and in-app reminder behavior exist.
Need: Firebase Cloud Messaging/device tokens/server send rules for alerts while app is closed; user preference controls and unsubscribe/token cleanup.

## Already genuine/local enough — do not replace with fake APIs
- Watch/Entertainment service launcher: real external YouTube/YouTube Music/Dailymotion/Netflix links.
- Browser: real URL viewer with external-open fallback.
- Settings: local preferences + Firebase account actions.
- Super App search, Daily Tools, Calendar, Reminders, Finance calculators/logs.
- Weather: real Open-Meteo live data with browser geolocation.
- Bible: native English/Urdu reader with real corpus sources.
- Habits, Savings, Contacts, Shopping list.
- QR generation, Wi-Fi QR, Contact QR, scanner route.
- Security permission manager, wallet route and local data backup.
- Teacher Toolkit local Lesson Planner, Quiz Template, Worksheet, Attendance and Grade Average.
