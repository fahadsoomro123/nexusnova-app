from pathlib import Path

# Legacy compatibility validator.
# Native startup v3 used to add timers and hard-stops to a second JS startup
# shield that no longer exists. Native splash release v4 + the dashboard lockfix
# now own the Android escape path, so v3 must not mutate launcher/UI/version.

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
LAUNCHER = ROOT / 'js/page2.js'
PAGE = ROOT / 'page2.html'
MAIN = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')

for path in (LAUNCHER, PAGE, MAIN):
    if not path.exists():
        raise SystemExit(f'Missing native-startup-v3 compatibility input: {path}')

launcher = LAUNCHER.read_text(encoding='utf-8')
page = PAGE.read_text(encoding='utf-8')
main = MAIN.read_text(encoding='utf-8')

if 'nx-single-startup-owner-v4' not in launcher:
    raise SystemExit('Native startup v3 compatibility: single startup owner v4 missing')
if 'nxSecureStartupShieldV3' in launcher:
    raise SystemExit('Native startup v3 compatibility: deprecated secondary shield returned')
if 'id="nxSplash"' not in page:
    raise SystemExit('Native startup v3 compatibility: branded dashboard splash missing')

# v4 is the only native timed splash-release owner now.
if 'scheduleNativeSplashRelease(target) // nx-native-splash-release-v4' not in main:
    raise SystemExit('Native startup v3 compatibility: native splash release v4 missing')

print('Native startup v3 legacy compatibility PASS: no mutations; v4 is sole native release owner.')
