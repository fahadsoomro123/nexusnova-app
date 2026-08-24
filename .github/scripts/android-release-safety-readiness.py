#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]

checks = []

def require(path: str, needle: str, label: str):
    text = (ROOT / path).read_text(encoding='utf-8')
    ok = needle in text
    checks.append((ok, label, path))
    return text

build = require(
    'NexusNovaAndroid/app/build.gradle.kts',
    'buildConfigField("boolean", "NEXUS_ADS_TEST_MODE", "false")',
    'Release build disables Google test-ad mode'
)
require(
    'NexusNovaAndroid/app/build.gradle.kts',
    'manifestPlaceholders["admobAppId"] = "ca-app-pub-5070673529890078~1824799663"',
    'Release manifest uses NexusNova production AdMob app id'
)

main = (ROOT / 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt').read_text(encoding='utf-8')
appcheck_pos = main.find('NexusNativeAppCheck.initialize(this)')
webview_pos = main.find('webView = WebView(this)')
checks.append((appcheck_pos >= 0 and webview_pos >= 0 and appcheck_pos < webview_pos,
               'Native App Check initializes before main WebView creation',
               'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt'))
checks.append(('if (BuildConfig.NEXUS_ADS_TEST_MODE)' in main and
               'NexusAdConsentManager(this).gather { canRequestAds ->' in main and
               'if (canRequestAds && !isFinishing && !isDestroyed)' in main,
               'Production ad initialization is gated by UMP consent readiness',
               'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt'))

consent = (ROOT / 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdConsentManager.kt').read_text(encoding='utf-8')
checks.append(('requestConsentInfoUpdate' in consent and
               'loadAndShowConsentFormIfRequired' in consent and
               'consentInformation.canRequestAds()' in consent,
               'UMP refresh/form/canRequestAds flow is present',
               'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdConsentManager.kt'))

ad_manager = (ROOT / 'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt').read_text(encoding='utf-8')
checks.append(('val TEST_MODE = BuildConfig.NEXUS_ADS_TEST_MODE' in ad_manager and
               'PRODUCTION_REWARDED_AD_UNIT_ID' in ad_manager and
               'PRODUCTION_INTERSTITIAL_AD_UNIT_ID' in ad_manager,
               'Native ad manager selects test/production inventory from BuildConfig',
               'NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusAdManager.kt'))

workflow = (ROOT / '.github/workflows/nexusnova-permanent-signed-release.yml').read_text(encoding='utf-8')
checks.append(('workflow_dispatch:' in workflow and 'push:' not in workflow.split('permissions:', 1)[0],
               'Permanent signed release workflow is manual-only',
               '.github/workflows/nexusnova-permanent-signed-release.yml'))
for secret in (
    'NEXUSNOVA_SIGNING_KEYSTORE_B64',
    'NEXUSNOVA_SIGNING_STORE_PASSWORD',
    'NEXUSNOVA_SIGNING_KEY_ALIAS',
    'NEXUSNOVA_SIGNING_KEY_PASSWORD',
):
    checks.append((secret in workflow, f'Permanent signing workflow requires {secret}',
                   '.github/workflows/nexusnova-permanent-signed-release.yml'))
checks.append(('apksigner' in workflow and 'verify --verbose --print-certs' in workflow,
               'Permanent signed APK signature is verified before publication',
               '.github/workflows/nexusnova-permanent-signed-release.yml'))
checks.append(('rm -f "$NEXUSNOVA_SIGNING_STORE_FILE"' in workflow,
               'CI removes restored signing keystore after build',
               '.github/workflows/nexusnova-permanent-signed-release.yml'))

ignore = (ROOT / '.gitignore').read_text(encoding='utf-8')
for pattern in ('*.jks', '*.keystore', '*.p12', '*.jks.b64', '*.keystore.b64'):
    checks.append((pattern in ignore, f'Git ignores signing secret pattern {pattern}', '.gitignore'))

failed = 0
print('NexusNova Android release safety readiness')
for ok, label, path in checks:
    state = 'PASS' if ok else 'FAIL'
    print(f'{state} | {label} | {path}')
    if not ok:
        failed += 1
print(f'\nChecks: {len(checks)} | Failed: {failed}')
if failed:
    sys.exit(1)
