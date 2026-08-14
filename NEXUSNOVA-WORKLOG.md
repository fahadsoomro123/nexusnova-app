# NexusNova Repair Worklog

Branch: `codex-final-audit`

Purpose: visible progress record for ongoing NexusNova repairs. Every meaningful code change should be accompanied by a Git commit and this log should be updated with what was inspected, fixed, and what remains.

## Current status

- ALL APPS back-navigation root conflict repaired and user-confirmed.
- ALL APPS approved order is protected by a loop-safe late-module guard; Bible stays immediately after Islamic Hub.
- Bible current build uses a native text reader rather than an external webpage iframe. BibleNLP corpus loading is hardened for slow connections and stale cached Bible iframes are removed.
- Currency Converter late-module overwrite race is guarded so the final converter remains authoritative.
- Profile retry logic was re-inspected: page2.js already retries authenticated profile loading for up to 15 seconds and refreshes on Profile open. A separate display guard now prevents a real referral value already rendered by the final Firestore layer from being overwritten by the older hardcoded Unavailable label.
- Quran/Sahih Bukhari sources were inspected. A source/cache guard is loaded for temporary data-provider failures; Bukhari CDN has a raw-source fallback path.
- Selected ALL APPS placeholder buttons that do not require a backend are now real local/browser tools: QR Scanner route, Wi-Fi QR, Contact QR, Teacher lesson/quiz/worksheet/attendance tools, Permission Manager, Wallet Security route, and local Data Backup.
- Marketplace, Orders, real payment QR, background push alerts, App Lock, rewarded ads, secure withdrawals and similar provider/backend features are not faked.
- `stable-baseline` remains untouched.

## Working rule

1. Inspect the actual source and conflicting handlers.
2. Fix on `codex-final-audit` only.
3. Record meaningful commits.
4. Re-read committed code and run available static/runtime checks before calling an item complete.
5. Do not mark Firebase/App Check/ad/payment/provider dependencies as fixed unless the real external setup is complete.

## Completed / important commits

- `24366b39a79d6e15a023ab973e4b1443e35af554` — fixed ALL APPS back buttons being immediately reclosed by the legacy document-level outside-click handler.
- `a18010b7fd10bc94e133491c8c833068d11066df` — hardened Bible corpus loading and removed stale Bible iframe behavior in web runtime.
- `646704ef3ccfdc436e56c52067a8849d08dc414d` — synced the initial Bible/back-navigation integrity repair to Android web assets.
- `aee0ec162bd44eacf40de423987320effaeb7649` — guarded the reliable Currency Converter against late page2.js overwrite.
- `01172c3c43022d82173c6b748fccbc5a597640dc` — restored the referenced ALL APPS v5 path with loop-safe approved-order/back-control logic.
- `a57f7ec2b5b509cca0cf79923e8f6058a0a22f6c` — added backend-free local app repairs for QR, Teacher Toolkit and Security Center.
- `0f4d1be5f983c96db00059317d6343ce035d9856` — loaded local app repairs in the actual web runtime.
- `0e35de83264bde2a090c6678a272eaa2dd98a0b8` — added referral display protection without inventing a referral code.
- `1c2744f83d276f6dc65cc5fbf397331cd5303fe0` — loaded the profile display guard in the actual web runtime.

## Still under inspection / pending

- Remaining localizable placeholder buttons, especially Document helper buttons and other ALL APPS modules.
- Service-worker pre-cache cleanup for the newest dynamic guard filenames. Current scripts are network-first, so web runtime can still load the newest guards.
- Android mirror must be re-synced with the latest web-only converter/order/local-tool/profile-display repairs before an APK/device release.
- Full Android build/device verification and native Google sign-in remain separate release work.