# NexusNova — Genuine Integration Queue & Strict Verification Status

This file is the source-of-truth for features that must NOT be faked.

## Verification rule
A feature may use only one of these labels:

- **CONFIRMED WORKING** — runtime behavior was actually observed/confirmed.
- **CODE READY / TEST PENDING** — code/handler exists, but runtime behavior has not yet been confirmed.
- **API / NATIVE / BACKEND PENDING** — the genuine feature still requires a real provider, privileged Android capability, deployed backend, or production configuration.

**Important:** code existence alone is NOT proof that a feature works. Do not promote `CODE READY / TEST PENDING` to `CONFIRMED WORKING` without runtime evidence.

## Rules
- Never generate fake balances, tickets, caller names, tracking states, reward proofs, payment confirmations or provider data.
- Public/no-key APIs may run directly in the client when safe.
- Secret API keys/tokens must stay in a backend/native secure configuration, never in public frontend code.
- Value-bearing NVX changes must be server-authoritative.
- A polished button is not a completed feature.

## Ordered feature status

### PK NEWS
Status: **CONFIRMED WORKING / IMPERFECT**
Runtime evidence: user confirmed news now appears. Image/source quality is not considered perfect; NEWS was frozen so the project could move forward.

### WATCH / Entertainment
Status: **CODE READY / TEST PENDING**
Current code opens real YouTube, YouTube Music, Dailymotion and Netflix pages. Runtime not yet confirmed under the strict verification rule.

### BROWSER
Status: **CODE FIXED / TEST PENDING**
Previous classification as working was incorrect. Many sites block iframe embedding with CSP/X-Frame-Options. Web Browser V2 now attempts a real top-level/external page and provides a direct fallback link instead of relying on universal iframe browsing.
Latest web fix commit: `7557d5ab4575babbfe7103d30e1bdf24e11e85c5`.
A second legacy/mega browser helper still contains iframe-oriented behavior and remains to be harmonized. Do NOT call Browser confirmed until runtime test passes.

### CALLER ID
Status: **API / NATIVE / BACKEND PENDING**
Current local/manual phonebook lookup is real, but it is not a global caller identity database.
Android bridge exists for caller role/native actions, but verified caller name/spam reputation requires a legitimate provider and Android permission/store-policy compliance.

### SETTINGS
Status: **CODE READY / TEST PENDING**
Settings persistence and apply handlers exist (theme, compact mode, preferences, AI settings and account actions), but runtime behavior has not yet been confirmed under the strict rule.

### SUPER APP
Status: **CODE READY / TEST PENDING**
Universal feature search and navigation handlers exist. Runtime confirmation pending.

### DAILY TOOLS
Status: **CODE READY / TEST PENDING**
Calculator, notes and to-do handlers exist. Runtime confirmation pending.

### CALENDAR
Status: **CODE READY / TEST PENDING**
Local add/delete event logic exists. Runtime confirmation pending.

### REMINDERS
Status: **CODE READY / TEST PENDING**
Local reminder storage and 15-second due check exist; browser Notification is used when permission is granted. Closed-app reliable push is a separate FCM requirement. Runtime confirmation pending.

### FINANCE
Status: **CODE READY / TEST PENDING**
Expense logging, EMI, tip/bill split, savings and currency logic exist. Runtime confirmation pending.

### WEATHER
Status: **CODE READY / TEST PENDING**
Uses browser geolocation and live Open-Meteo data. Runtime confirmation pending.

### LEARNING
Status: **RUNTIME WIRING PENDING**
Created: `js/nexusnova-learning-engine-v1.js`
Commit: `b1ee7a452b22daa37279325ee78dcca65b4dd7fa`
Includes Wikimedia live knowledge lookup, real solved/past-paper web search, live-source quiz and local study planner.
Blocker: late-loader wiring has not yet been committed successfully. Do not call runtime-complete.

### PAKISTAN HUB
Status: **PARTIAL / API PENDING**
Live RSS news path exists. Government Services and Utilities require official service connections or safe official links. No fake bill/service status.

### ISLAMIC HUB
Status: **PARTIAL / WIRING PENDING**
Prayer Times uses a real live path and Qibla routes to the real Qibla feature.
Pending: Hijri Calendar, Ramadan, Sehri/Iftar and 99 Names & Duas.

### BIBLE
Status: **CONFIRMED WORKING**
Previously verified native English/Urdu reader with real corpus sources. Do not rewrite without new runtime evidence of a failure.

### HABITS
Status: **CODE READY / TEST PENDING**
Local add/check-in logic exists. Runtime confirmation pending.

### SAVINGS
Status: **CODE READY / TEST PENDING**
Local goal/progress logic exists. Runtime confirmation pending.

### CONTACTS
Status: **CODE READY / TEST PENDING**
Local contacts and call-link logic exist. Runtime confirmation pending.

### SHOPPING
Status: **CODE READY / TEST PENDING**
Local shopping list exists. Current-price search is a web search helper, not a retailer inventory/price API. Runtime confirmation pending.

### DOCUMENTS
Status: **PARTIAL / API OR LOCAL COMPLETION PENDING**
Current file inspection and image handoff exist.
Pending: genuine receipt extraction/OCR and PDF maker.

### FILE VAULT
Status: **API / BACKEND PENDING**
Current screen only inspects selected files locally.
Need private storage, per-user authorization rules, upload/download/delete, quotas and security review.

### QR TOOLS
Status: **PARTIAL / TEST PENDING**
Generic QR generation, Wi-Fi QR, Contact QR and scanner route have code paths.
Payment QR requires a legitimate payment standard/provider.

### SECURITY
Status: **PARTIAL / TEST + NATIVE PENDING**
Permission manager, wallet route and local backup have code paths.
App Lock requires Android biometric/device-credential integration.

### MARKETPLACE
Status: **API / BACKEND PENDING**
Need real listings database, ownership, images/storage, search/categories, favorites, moderation, orders, payment and abuse controls.

### ORDERS & DELIVERY
Status: **API / BACKEND PENDING**
Need real order records, payment linkage, courier/tracking provider and verified return/refund workflow.

### NOTIFICATIONS
Status: **PARTIAL / FCM PENDING**
Browser permission/in-app reminders have code paths.
Closed-app notifications require Firebase Cloud Messaging/device tokens/server send rules and token cleanup.

### TEACHER TOOLKIT
Status: **CODE READY / TEST PENDING**
Local Lesson Planner, Quiz Template, Worksheet, Attendance and Grade Average handlers exist. Runtime confirmation pending. AI-generated/solved educational content is a separate integration task.

## Core integration queue

### AI core
Status: **REWORK REQUIRED**
Need app-aware NVX/mining/profile context, persistent account-scoped memory, reliable NexusNova commands and improved voice behavior. Existing Gemini/Firebase AI layer is not considered final until app-context and memory behavior are verified in runtime.

### Daily reward / secure mining / protected NVX mutations
Status: **DEPLOYMENT + SECURITY REQUIRED**
Existing code uses authenticated Firebase callable Functions with App Check enforcement.
Need production Firebase App Check registration, deployed Functions/rules and verified runtime test.

### Community task verification
Status: **BACKEND REQUIRED**
Need real campaign/provider verification before any NVX credit.

### Watch Ad reward (+NVX)
Status: **AD PROVIDER + BACKEND REQUIRED**
Need legitimate rewarded-ad SDK/provider, verified completion callback/server validation, then server-side NVX credit.

### Travel — Flights
Status: **PROVIDER API REQUIRED**
Need real flight search/schedule/fare API. Booking requires provider/affiliate/commercial access and payment flow.

### Travel — Pakistan Railway
Status: **PROVIDER/OFFICIAL DATA REQUIRED**
Need legitimate Pakistan Railways schedule/availability source or authorized provider.

### Travel — Bus
Status: **PROVIDER API/PARTNERSHIP REQUIRED**
Need real routes, schedules, fares and booking integration.

### Wallet deposit / withdrawal production setup
Status: **SECURITY + CONFIGURATION REQUIRED**
Backend refuses fake addresses and unconfigured withdrawals.
Need chosen custody/non-custody design, supported networks/assets, real deposit address mapping, withdrawal policy, ledger/audit process and production security review.

### QR Tools — Payment QR
Status: **PAYMENT PROVIDER/STANDARD REQUIRED**
Must use a legitimate payment standard/provider and never display fake payment confirmation.

### Security — App Lock
Status: **ANDROID NATIVE REQUIRED**
Need Android biometric/device-credential integration and secure local state handling.
