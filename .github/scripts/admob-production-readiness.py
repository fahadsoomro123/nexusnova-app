from pathlib import Path
import json
import re
import sys

ROOT = Path('.')

PUBLISHER_ID = 'pub-5070673529890078'
PUBLISHER_NUMERIC = '5070673529890078'
PRODUCTION_APP_ID = f'ca-app-pub-{PUBLISHER_NUMERIC}~1824799663'
PRODUCTION_REWARDED_ID = f'ca-app-pub-{PUBLISHER_NUMERIC}/7194148596'
PRODUCTION_INTERSTITIAL_ID = f'ca-app-pub-{PUBLISHER_NUMERIC}/7807608294'
EXPECTED_REWARDED_SUFFIX = '7194148596'
EXPECTED_PURPOSE = 'task-watch-ad'
EXPECTED_REWARD = '2.5'
APP_ADS_LINE = f'google.com, {PUBLISHER_ID}, DIRECT, f08c47fec0942fa0'

errors = []

def fail(message):
    errors.append(message)

def read(path):
    p = ROOT / path
    if not p.exists():
        fail(f'missing required file: {path}')
        return ''
    return p.read_text(encoding='utf-8')

root_ads = read('app-ads.txt').strip()
hosting_ads = read('firebase-public/app-ads.txt').strip()
if root_ads != APP_ADS_LINE:
    fail('root app-ads.txt does not match the NexusNova AdMob publisher record')
if hosting_ads != APP_ADS_LINE:
    fail('firebase-public/app-ads.txt does not match the NexusNova AdMob publisher record')
if root_ads != hosting_ads:
    fail('root and Firebase Hosting app-ads.txt copies have drifted')

try:
    firebase = json.loads(read('firebase.json'))
except Exception as exc:
    firebase = {}
    fail(f'firebase.json is invalid JSON: {exc}')

hosting = firebase.get('hosting') if isinstance(firebase, dict) else None
if not isinstance(hosting, dict):
    fail('firebase.json is missing hosting configuration')
else:
    if hosting.get('public') != 'firebase-public':
        fail('Firebase Hosting public directory must remain firebase-public')
    headers = hosting.get('headers') or []
    app_ads_header = next((item for item in headers if item.get('source') == '/app-ads.txt'), None)
    if not app_ads_header:
        fail('Firebase Hosting is missing /app-ads.txt headers')
    else:
        header_map = {h.get('key', '').lower(): h.get('value', '') for h in app_ads_header.get('headers', [])}
        if not header_map.get('content-type', '').lower().startswith('text/plain'):
            fail('/app-ads.txt must be served as text/plain')

build = read('NexusNovaAndroid/app/build.gradle.kts')
if PRODUCTION_APP_ID not in build:
    fail('Android release AdMob app ID does not match the NexusNova publisher')
if 'NEXUS_ADS_TEST_MODE\", \"true\"' not in build:
    fail('Android debug build must remain locked to AdMob test mode')
if 'NEXUS_ADS_TEST_MODE\", \"false\"' not in build:
    fail('Android release build must remain locked to production ad mode')

manager = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
if PRODUCTION_REWARDED_ID not in manager:
    fail('production rewarded ad unit ID drifted from the SSV contract')
if PRODUCTION_INTERSTITIAL_ID not in manager:
    fail('production interstitial ad unit ID is missing or changed')

patch = read('NexusNovaAndroid/patch_admob.py')
required_patch_markers = [
    'BuildConfig.NEXUS_ADS_TEST_MODE',
    'ServerSideVerificationOptions',
    'pendingRewardUserId = sanitizeRewardUserId(userId)',
    'pendingRewardCustomData = purpose',
    'REWARD_PURPOSE_WATCH_AD = \"task-watch-ad\"',
    '\"ssvIdentityReady\" to true',
    'INTERSTITIAL_ALLOWED_FEATURES',
]
for marker in required_patch_markers:
    if marker not in patch:
        fail(f'Android AdMob build patch is missing required SSV/ad-policy marker: {marker}')

reward_guard = read('NexusNovaAndroid/patch_rewarded_test_contract.py')
for marker in [
    'nx-rewarded-production-proof-guard-v1',
    'production-proof-not-enabled',
    "boostKind:expected, testOnly:true",
    'PRODUCTION_SSV_ENABLED = false',
]:
    if marker not in reward_guard:
        fail(f'rewarded production guard is missing marker: {marker}')

ssv = read('functions/admobRewardedSsv.js')
checks = {
    rf"const EXPECTED_AD_UNIT = '{re.escape(EXPECTED_REWARDED_SUFFIX)}';": 'SSV expected ad unit',
    rf"const EXPECTED_PURPOSE = '{re.escape(EXPECTED_PURPOSE)}';": 'SSV reward purpose',
    rf'const REWARD_NVX = {re.escape(EXPECTED_REWARD)};': 'SSV +2.5 NVX amount',
}
for pattern, label in checks.items():
    if not re.search(pattern, ssv):
        fail(f'{label} does not match the Android/web reward contract')
if 'verifyGoogleSignature(req)' not in ssv or 'admobRewardTransactions' not in ssv:
    fail('SSV signature verification or idempotency store is missing')

watch = read('js/nexusnova-watch-ad-reward-v1.js')
if "const PURPOSE = 'task-watch-ad';" not in watch:
    fail('Watch Ad client purpose does not match SSV custom_data')
if 'const REWARD_NVX = 2.5;' not in watch:
    fail('Watch Ad client display amount does not match SSV reward')
if 'const PRODUCTION_SSV_ENABLED = false;' not in watch:
    fail('Production Watch Ad must stay disabled until the signed SSV endpoint is confirmed live')
if 'ssvIdentityReady' not in watch:
    fail('Watch Ad client is missing the native SSV capability handshake')

daily_gate = read('js/nexusnova-daily-ad-test-v1.js')
if "const REWARD_PURPOSE = 'daily-reward-test';" not in daily_gate:
    fail('Daily Reward ad purpose changed unexpectedly')
if 'testOnly: true' not in daily_gate:
    fail('Daily Reward ad flow must remain test-only before production proof is available')
if 'window.nexusSecureClaimDaily' not in daily_gate:
    fail('Daily Reward ad gate is not wired to the secure claim bridge')

daily_secure = read('js/nexusnova-daily-secure-claim-v1.js')
for marker in [
    'window.nexusSecureClaimDaily = claimDailySecure',
    "httpsCallable(fnMod.getFunctions(app, 'us-central1'), 'claimDailyReward')",
    'await window.nexusRequireAppCheck()',
    'await user.getIdToken(true)',
    'result.claimed !== true',
]:
    if marker not in daily_secure:
        fail(f'Daily secure claim bridge missing marker: {marker}')

page2_boot = read('js/page2.js')
if "await import('./nexusnova-daily-secure-claim-v1.js?v=1');" not in page2_boot:
    fail('page2 bootstrap does not load the Daily secure claim bridge')

placements = read('js/nexusnova-ad-placements-v1.js')
for feature in ['wallet','tasks','emergency','quran','bukhari','bible','profile']:
    if f"'{feature}'" not in placements:
        fail(f'protected ad feature is missing from policy: {feature}')
for marker in [
    'INTERSTITIAL_MIN_GAP_MS = 180_000',
    'INTERSTITIAL_SESSION_MAX = 4',
    'pendingInterstitial',
    'markInterstitialShown()',
    "type === 'interstitial-showing'",
    "type === 'interstitial-unavailable'",
]:
    if marker not in placements:
        fail(f'interstitial cap/no-fill accounting marker missing: {marker}')
if 'sessionInterstitialCount + 1' not in placements:
    fail('interstitial session counter is not committed on a real show event')
if 'A request that is unavailable/no-fill never consumes a cooldown or session slot.' not in placements:
    fail('interstitial no-fill accounting contract is missing')

if errors:
    print('NexusNova AdMob production readiness: FAIL')
    for item in errors:
        print(f' - {item}')
    sys.exit(1)

print('NexusNova AdMob production readiness: PASS')
print(f' - publisher: {PUBLISHER_ID}')
print(f' - production rewarded: {PRODUCTION_REWARDED_ID}')
print(f' - Watch Ad SSV purpose/reward: {EXPECTED_PURPOSE} / +{EXPECTED_REWARD} NVX')
print(' - Firebase Hosting app-ads.txt root payload: consistent')
print(' - protected-screen and interstitial frequency policy: consistent')
print(' - no-fill/unavailable interstitial requests do not consume cooldown/session caps')
print(' - Daily Reward uses a secure callable bridge and propagates claim failures')
print(' - unreleased rewarded value flows stay test-only in release builds')
print(' - production Watch Ad credit remains safely disabled until SSV deployment is verified')
