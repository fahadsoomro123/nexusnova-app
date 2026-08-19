from pathlib import Path

# Legacy compatibility validator.
# Native startup v3 used to add timers and hard-stops to a second JS startup
# shield that no longer exists. Native splash release v4 + the dashboard lockfix
# now own the Android escape path, so v3 must not mutate launcher/UI/version.

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
LAUNCHER = ROOT / 'js/page2.js'
PAGE = ROOT / 'page2.html'
V4_PATCH = Path('NexusNovaAndroid/patch_native_splash_release_v4.py')

for path in (LAUNCHER, PAGE, V4_PATCH):
    if not path.exists():
        raise SystemExit(f'Missing native-startup-v3 compatibility input: {path}')

launcher = LAUNCHER.read_text(encoding='utf-8')
page = PAGE.read_text(encoding='utf-8')
v4_patch = V4_PATCH.read_text(encoding='utf-8')

if 'nx-single-startup-owner-v4' not in launcher:
    raise SystemExit('Native startup v3 compatibility: single startup owner v4 missing')
if 'nxSecureStartupShieldV3' in launcher:
    raise SystemExit('Native startup v3 compatibility: deprecated secondary shield returned')
if 'id="nxSplash"' not in page:
    raise SystemExit('Native startup v3 compatibility: branded dashboard splash missing')
if 'nx-native-splash-release-v4' not in v4_patch:
    raise SystemExit('Native startup v3 compatibility: native splash release v4 patch missing')

print('Native startup v3 legacy compatibility PASS: no mutations; v4 is sole native release owner.')
