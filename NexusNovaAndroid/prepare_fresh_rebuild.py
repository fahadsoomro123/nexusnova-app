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

# The TEST APK owns an isolated local web bundle. Do not carry any historical
# page2/dashboard web asset into the fresh build by accident.
if WWW.exists():
    shutil.rmtree(WWW)
shutil.copytree(FRESH, WWW, ignore=shutil.ignore_patterns('AUDIT-*.md'))

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

# Force this branch's TEST APK to load the bundled fresh surface. Production
# GitHub Pages and stable branches are deliberately left untouched.
main = MAIN.read_text(encoding='utf-8')
old = '''        // The production GitHub Pages origin is the single source of truth.
        // A local asset copy remains only as an automatic offline/recovery fallback.
        loadProductionApp()
        showCallerSetupOnce()
'''
new = '''        // Fresh-rebuild TEST edition: load only the isolated bundled fresh app.
        // Stable/production GitHub Pages remains untouched outside this branch.
        loadUrlSafely(LOCAL_APP_URL)
        showCallerSetupOnce()
'''
if old not in main:
    raise SystemExit('Fresh MainActivity startup patch point not found')
main = main.replace(old, new, 1)
MAIN.write_text(main, encoding='utf-8')

marker = WWW / 'FRESH-REBUILD-BUILD.txt'
marker.write_text(
    'NexusNova Fresh Rebuild TEST\n'
    'Branch: nexusnova-fresh-rebuild-20260820\n'
    'UI source: fresh-rebuild/ only\n'
    'Bottom navigation: MINE + NOVA HUB\n',
    encoding='utf-8'
)

print(f'Prepared fresh Android bundle: {WWW}')
print(f'Fresh files: {sum(1 for p in WWW.rglob("*") if p.is_file())}')
