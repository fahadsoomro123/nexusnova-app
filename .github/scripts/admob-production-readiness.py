from pathlib import Path
import json
import sys

ROOT = Path('.')

PUBLISHER_ID = 'pub-5070673529890078'
PUBLISHER_NUMERIC = '5070673529890078'
PRODUCTION_APP_ID = f'ca-app-pub-{PUBLISHER_NUMERIC}~1824799663'
PRODUCTION_REWARDED_ID = f'ca-app-pub-{PUBLISHER_NUMERIC}/7194148596'
PRODUCTION_INTERSTITIAL_ID = f'ca-app-pub-{PUBLISHER_NUMERIC}/7807608294'
TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713'
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


# Publisher/developer-site ownership must stay valid even while the app itself
# is TEST-only.
root_ads = read('app-ads.txt').strip()
hosting_ads = read('firebase-public/app-ads.txt').strip()
if root_ads != APP_ADS_LINE:
    fail('root app-ads.txt does not match the NexusNova publisher record')
if hosting_ads != APP_ADS_LINE:
    fail('Firebase app-ads.txt does not match the NexusNova publisher record')
if root_ads != hosting_ads:
    fail('root and Firebase app-ads.txt copies have drifted')

try:
    firebase = json.loads(read('firebase.json'))
except Exception as exc:
    firebase = {}
    fail(f'firebase.json is invalid JSON: {exc}')

hosting = firebase.get('hosting') if isinstance(firebase, dict) else None
if not isinstance(hosting, dict) or hosting.get('public') != 'firebase-public':
    fail('Firebase Hosting developer site must remain firebase-public')

# Hard safety lock: ALL Android variants, including release/signed APKs, must
# use Google's test App ID and test BuildConfig flag until an explicit future
# production unlock is intentionally performed.
build = read('NexusNovaAndroid/app/build.gradle.kts')
if build.count('NEXUS_ADS_TEST_MODE\", \"true\"') < 2:
    fail('debug and release must both remain in AdMob TEST mode')
if 'NEXUS_ADS_TEST_MODE\", \"false\"' in build:
    fail('LIVE AdMob mode detected in active Android build config')
if build.count(TEST_APP_ID) < 2:
    fail('debug and release must both use Google test App ID')
if PRODUCTION_APP_ID in build:
    fail('production AdMob App ID must not be selectable by build.gradle')

manager = read('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt')
for marker in [
    '/21775744923/example/rewarded',
    '/21775744923/example/rewarded-interstitial',
    '/21775744923/example/interstitial',
]:
    if marker not in manager:
        fail(f'Google TEST inventory marker missing: {marker}')
if ('BuildConfig.NEXUS_ADS_TEST_MODE' not in manager and
        'const val TEST_MODE = true' not in manager):
    fail('native ad manager is not bound to TEST mode')

# Production IDs may remain dormant in native/SSV source for a later explicit
# unlock. Validate that dormant wiring is internally consistent, but never make
# it active while the safety lock is enabled.
if PRODUCTION_REWARDED_ID not in manager:
    fail('dormant production rewarded ID drifted')
if PRODUCTION_INTERSTITIAL_ID not in manager:
    fail('dormant production interstitial ID drifted')

patch = read('NexusNovaAndroid/patch_admob.py')
for marker in [
    'BuildConfig.NEXUS_ADS_TEST_MODE',
    'ServerSideVerificationOptions',
    'NexusAdConsentManager(this).gather',
]:
    if marker not in patch:
        fail(f'Android AdMob patch missing safety marker: {marker}')

reward_guard = read('NexusNovaAndroid/patch_rewarded_test_contract.py')
for marker in [
    'nx-rewarded-production-proof-guard-v1',
    'production-proof-not-enabled',
    'PRODUCTION_SSV_ENABLED = false',
]:
    if marker not in reward_guard:
        fail(f'rewarded TEST guard missing marker: {marker}')

watch = read('js/nexusnova-watch-ad-reward-v1.js')
if 'const PRODUCTION_SSV_ENABLED = false;' not in watch:
    fail('production Watch Ad value flow must remain disabled during TEST lock')

ssv = read('functions/admobRewardedSsv.js')
for marker in [
    'verifyGoogleSignature(req)',
    'admobRewardTransactions',
    "const EXPECTED_PURPOSE = 'task-watch-ad';",
]:
    if marker not in ssv:
        fail(f'dormant SSV safety marker missing: {marker}')

if errors:
    print('NexusNova AdMob TEST lock/readiness: FAIL')
    for item in errors:
        print(f' - {item}')
    sys.exit(1)

print('NexusNova AdMob TEST lock/readiness: PASS')
print(' - debug APKs: Google TEST inventory')
print(' - release/signed APKs: Google TEST inventory')
print(' - LIVE build selector: blocked')
print(' - production value-bearing Watch Ad: disabled')
print(' - dormant production wiring retained only for a future explicit unlock')
