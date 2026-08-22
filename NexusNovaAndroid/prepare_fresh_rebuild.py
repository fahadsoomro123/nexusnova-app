from pathlib import Path
import os
import shutil

ROOT = Path(__file__).resolve().parents[1]
FRESH = ROOT / 'fresh-rebuild'
ANDROID = ROOT / 'NexusNovaAndroid'
WWW = ANDROID / 'app/src/main/assets/www'
MAIN = ANDROID / 'app/src/main/java/com/nexusnova/app/MainActivity.kt'

if not (FRESH / 'index.html').is_file():
    raise SystemExit('fresh-rebuild/index.html is missing')
if not MAIN.is_file():
    raise SystemExit('MainActivity.kt is missing')

edition = os.environ.get('NEXUSNOVA_BUILD_EDITION', 'test').strip().lower()
if edition not in {'test', 'production'}:
    raise SystemExit(f'Unsupported NEXUSNOVA_BUILD_EDITION: {edition}')
production = edition == 'production'

# The fresh APK owns an isolated local web bundle. Do not carry any historical
# page2/dashboard web asset into the fresh build by accident.
if WWW.exists():
    shutil.rmtree(WWW)
shutil.copytree(FRESH, WWW, ignore=shutil.ignore_patterns('AUDIT-*.md'))

# Production copy must not keep TEST-only user-facing copy. Internal purpose
# identifiers remain unchanged because they are protocol identifiers, not UI.
if production:
    core = WWW / 'src/features/apps/core-apps.js'
    text = core.read_text(encoding='utf-8')
    replacements = {
        'TEST AdMob flow for the future +2.5 NVX task.': 'Complete a Google rewarded ad.',
        'WATCH TEST AD': 'WATCH AD',
        'TEST ads never credit +2.5 NVX.': 'Reward credit follows the secure server policy.',
        'Daily Reward is ready. TEST rewarded ad is used as the current gate.': 'Daily Reward is ready. Complete the rewarded ad to continue.',
        'Opening Google TEST rewarded ad…': 'Opening Google rewarded ad…',
        '✓ TEST ad completed. +2.5 NVX was NOT credited in TEST mode.': '✓ Ad completed.',
        'Android TEST inventory only in debug APK': 'Production APK uses live AdMob inventory; debug APK uses Google test inventory',
    }
    for old, new in replacements.items():
        if old not in text:
            raise SystemExit(f'Production UI copy marker missing: {old}')
        text = text.replace(old, new)
    core.write_text(text, encoding='utf-8')

# Optional public reCAPTCHA Enterprise App Check site key. This is not a secret;
# when CI has no configured value the marker intentionally remains blank and
# protected value actions fail closed instead of silently weakening security.
site_key = os.environ.get('NEXUSNOVA_APP_CHECK_SITE_KEY', '').strip()
if site_key:
    index = WWW / 'index.html'
    text = index.read_text(encoding='utf-8')
    marker = '<meta name="nexusnova-app-check-site-key" content="">'
    if marker not in text:
        raise SystemExit('Fresh App Check marker not found')
    text = text.replace(marker, f'<meta name="nexusnova-app-check-site-key" content="{site_key}">', 1)
    index.write_text(text, encoding='utf-8')

# Load the isolated bundled fresh surface using native APIs that already exist
# in MainActivity. Stable/production GitHub Pages remains untouched outside
# this CI checkout.
main = MAIN.read_text(encoding='utf-8')
startup = '''        loadProductionApp()\n'''
fresh_startup = '''        // Fresh-rebuild edition: load only the isolated bundled fresh app.\n        // Stable/production GitHub Pages remains untouched outside this CI checkout.\n        usingOfflineFallback = true\n        webView.loadUrl(LOCAL_APP_URL)\n'''
if main.count(startup) != 1:
    raise SystemExit(f'Fresh MainActivity startup patch point count was {main.count(startup)}, expected 1')
main = main.replace(startup, fresh_startup, 1)
MAIN.write_text(main, encoding='utf-8')

label = 'PRODUCTION' if production else 'TEST'
marker = WWW / 'FRESH-REBUILD-BUILD.txt'
marker.write_text(
    f'NexusNova Fresh Rebuild {label}\n'
    'Branch: nexusnova-fresh-rebuild-20260820\n'
    'UI source: fresh-rebuild/ only\n'
    'Bottom navigation: MINE + NOVA HUB\n',
    encoding='utf-8'
)

print(f'Prepared fresh Android bundle: {WWW}')
print(f'Edition: {label}')
print(f'Fresh files: {sum(1 for p in WWW.rglob("*") if p.is_file())}')
