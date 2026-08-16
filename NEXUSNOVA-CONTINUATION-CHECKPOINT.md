# NexusNova Continuation Checkpoint

Updated: 2026-08-17 (Pakistan time)

## User instruction that controls the next phase

- Keep NexusNova in **TESTING edition** for now.
- Use **Google TEST ads / TEST IDs only** while placement and UX are being checked.
- Do **not** prepare or distribute the final production/release edition yet.
- Production/release comes only after ad placement, remaining feature checks, bug fixes, and final audit are complete.
- NexusNova UI/change requests are repository/code work. **Do not generate images** unless the user explicitly asks for an image.

## Latest functional work completed before the ad pass

- Login/session restore issue after Android Back was repaired.
- Secure balance startup/preload was improved.
- Book Focus was added so opening Quran/Hadith/Fiqh/Ja'fari/Bible/Urdu books does not leave the user searching below the fold.
- Qibla was redesigned as a live phone-orientation compass using location + motion/orientation where the device supports it.
- Internet Speed Test was redesigned and the gauge needle was linked to live measured progress.
- Weather was redesigned as an animated visual weather scene with current conditions and forecast information.
- Last known successful Qibla/Speed/Weather Android TEST build was based on commit `9431e4114111f1e23ed5f2f6d2e7f4283fcedbf8`.

## Ad configuration applied now

Ad settings bootstrap added in:
- `js/nexusnova-ad-settings-v2.js`

Loaded from the normal critical boot path through:
- `js/final-integrity-fix.js`

Current TEST ad policy:

### Rewarded ads — opt in only
- Daily Reward: rewarded-ad gate before the existing secure +5 NVX daily claim when eligible.
- Watch Ad task: TEST rewarded flow; TEST ads do not credit +2.5 NVX.
- Mining Booster / Nova Rain: TEST rewarded flow; production server-verified value remains disabled.

### Interstitial ads
- Only on eligible non-sensitive utilities and only at natural breaks.
- Minimum gap: 3 minutes.
- Session maximum: 4.
- First request only after 3 eligible engagement/break events.
- Eligible areas include Tools, Finance, Money, News, Learning, Travel, Smart Tools, AI, Entertainment, Browser, Calendar, Reminders, Weather, Pakistan Hub, Shopping, Marketplace, Orders and Teacher Toolkit.

### Protected / no forced interstitials
- Login/Auth
- Home/Mining core screen
- Wallet
- Profile
- Tasks core screen
- Emergency
- Health
- Location
- Caller ID
- Qibla
- Islamic Hub
- Quran
- Hadith/Bukhari
- Bible
- Security / File Vault
- Contacts
- Settings

### Banner/native policy
- No permanent bottom banner; it must never cover or compete with the NexusNova bottom dock.
- Inline/native feed ads are not enabled in this TEST pass yet; do not fake them with HTML placeholders. They can be added after rewarded/interstitial placement is confirmed visually.

### Privacy / diagnostics
- Native AdMob status, TEST-mode status, rewarded/interstitial readiness and diagnostics are wired into the Settings test card.
- Google UMP privacy controls remain separate and should only appear when required in production/eligible regions.

## Ad code commits in this pass

- `efa7427c3a738759649a349e306f2c6bc4398fa7` — add TEST ad settings/placement bootstrap.
- `13392c1e06f9a52e851d9af7a5dcc3cee7c79996` — load TEST ad settings from the normal app boot path.

## What the user should test next

1. Install the newest TEST APK produced after commit `13392c1e06f9a52e851d9af7a5dcc3cee7c79996`.
2. Confirm Settings shows `Ads • TESTING Edition` and TEST status.
3. Test Daily Reward rewarded-ad gate when Daily Reward is eligible.
4. Test Watch Ad task and confirm TEST mode does not add +2.5 NVX.
5. Test Mining Booster / Nova Rain rewarded flow.
6. Use several eligible utilities and return at natural breaks to verify interstitial timing/placement.
7. Confirm no forced interstitial appears in Wallet, Qibla, Islamic readers, Bible, Emergency, Health, Security or Login.
8. Continue testing the latest Qibla, Speed Test and Weather redesigns.

## Still pending before production release

- User visual/functional feedback on latest Qibla, Speed Test and Weather.
- Final scripture reader visual pass where needed: Quran/Bukhari/Bible page readability, premium controls, Bible counter and bottom-dock overlap.
- Decide and implement inline/native feed placements only after the current full-screen/rewarded ad UX is approved.
- Full app button/module audit: Working / Partially Working / Not Working.
- Fix remaining verified bugs.
- Final monetization/privacy check.
- Only then create the signed/final production release edition.

## Exact continuation phrase

If context is ever unclear, the user can say:

**`NexusNova checkpoint kholo aur TESTING ads wale point se exact continue karo — kuchh skip mat karna.`**

On receiving that phrase, read this checkpoint plus the current repository state first, then continue. Do not ask the user to repeat the project history unless the repository/checkpoint genuinely cannot resolve it.
