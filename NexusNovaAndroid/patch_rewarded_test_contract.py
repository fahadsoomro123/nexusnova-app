from pathlib import Path

MANAGER = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
MINING = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-admob-nexus-pass-v1.js')
DAILY = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-daily-ad-test-v1.js')
WATCH = Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-watch-ad-reward-v1.js')

for path in [MANAGER, MINING, DAILY, WATCH]:
    if not path.exists():
        raise SystemExit(f'Rewarded production guard missing prepared file: {path}')

manager = MANAGER.read_text(encoding='utf-8')
mining = MINING.read_text(encoding='utf-8')
daily = DAILY.read_text(encoding='utf-8')
watch = WATCH.read_text(encoding='utf-8')

GUARD_MARKER = 'nx-rewarded-production-proof-guard-v1'

# A web feature marked testOnly must never accidentally receive production
# inventory in a release APK. This is especially important for Daily Reward,
# whose current ad proof is intentionally a TEST-flow until a production proof
# endpoint is deployed.
if GUARD_MARKER not in manager:
    old = '''            val purpose = sanitizePurpose(rewardPurpose)\n\n            if (showingRewarded) {'''
    new = '''            val purpose = sanitizePurpose(rewardPurpose)\n\n            // nx-rewarded-production-proof-guard-v1\n            // Test-only reward flows are permitted in debug APKs, but a release\n            // APK must never silently substitute live inventory for them.\n            if (!TEST_MODE && testOnly) {\n                dispatch(\n                    "rewarded-unavailable",\n                    mapOf(\n                        "reason" to "production-proof-not-enabled",\n                        "rewardPurpose" to purpose,\n                        "testOnly" to true,\n                        "sdkFamily" to SDK_FAMILY\n                    )\n                )\n                return@post\n            }\n\n            if (showingRewarded) {'''
    if old not in manager:
        raise SystemExit('Rewarded production guard insertion point not found')
    manager = manager.replace(old, new, 1)

# Mining Boost currently proves its UI with rewarded TEST ads and applies a
# bounded Firestore timestamp shift. Until the ad proof itself is server-side,
# mark this request testOnly so release APKs cannot turn it into an insecure
# live value-bearing placement.
old_mining = "post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected })"
new_mining = "post('showRewardedAd', { rewardPurpose:'mining-boost', boostKind:expected, testOnly:true })"
if new_mining not in mining:
    if old_mining not in mining:
        raise SystemExit('Mining Boost rewarded request insertion point not found')
    mining = mining.replace(old_mining, new_mining, 1)

# Daily Reward must remain explicitly testOnly until a production ad-proof
# contract is deployed. The secure +5 claim itself is still server-authoritative.
if "rewardPurpose: REWARD_PURPOSE,\n      testOnly: true" not in daily:
    raise SystemExit('Daily Reward is no longer explicitly testOnly')

# Watch Ad has its own signed SSV gate; production must remain disabled in the
# web layer until that endpoint is confirmed live.
if 'const PRODUCTION_SSV_ENABLED = false;' not in watch:
    raise SystemExit('Watch Ad production SSV safety switch was unexpectedly enabled')

MANAGER.write_text(manager, encoding='utf-8')
MINING.write_text(mining, encoding='utf-8')

checks = [
    (MANAGER, GUARD_MARKER),
    (MANAGER, 'production-proof-not-enabled'),
    (MINING, "boostKind:expected, testOnly:true"),
    (DAILY, 'testOnly: true'),
    (WATCH, 'PRODUCTION_SSV_ENABLED = false'),
]
for path, marker in checks:
    if marker not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Rewarded production guard verification failed: {path} -> {marker}')

print('Applied reward-proof guard: debug TEST rewarded flows remain test-only; release cannot silently use live value-bearing inventory.')
