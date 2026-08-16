from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
PAGE = ROOT / 'page2.html'
VAULT = ROOT / 'js/nexusnova-nova-vault-v1.js'
REGIONAL = ROOT / 'js/nexusnova-regional-qibla-browser-v1.js'
MODERN = ROOT / 'js/nexusnova-android-mining-modern-v2.js'
MARKER = 'nx-video-truth-consistency-perf-v2'

for path in (PAGE, VAULT, REGIONAL, MODERN):
    if not path.exists():
        raise SystemExit(f'Missing video consistency/perf input: {path}')

page = PAGE.read_text(encoding='utf-8')
vault = VAULT.read_text(encoding='utf-8')
regional = REGIONAL.read_text(encoding='utf-8')
modern = MODERN.read_text(encoding='utf-8')

if MARKER in page and MARKER in vault and MARKER in regional and MARKER in modern:
    print('Video consistency/performance v2 already applied.')
    raise SystemExit(0)

# 1) QR decoding already has a robust on-demand loader in final-user-fixes.
# Keeping the CDN tag in page2 makes a slow external request parser-block every
# later Android UI script, so remove it from the packaged native shell only.
import re
page, removed = re.subn(
    r'\s*<script[^>]+src=["\']https://cdn\.jsdelivr\.net/npm/jsqr@1\.4\.0/dist/jsQR\.js["\'][^>]*></script>\s*',
    '\n',
    page,
    count=1,
    flags=re.I,
)
if removed == 0 and 'cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' in page:
    raise SystemExit('Could not remove parser-blocking jsQR startup tag.')

# 2) TEST Vault inventory must be visible through the same public inventory()
# API used by the Mining Accelerator panel. Production Firestore inventory is
# still untouched; these local values exist only in the Android TEST overlay.
old_inventory = '''  const inventory = () => Object.freeze({
    booster: cleanInt(state.booster),
    rain: cleanInt(state.rain),
    timeWarp: cleanInt(state.timeWarp),
    pendingVaults: cleanInt(state.pending)
  });
'''
new_inventory = '''  const inventory = () => {
    const testInv = readTestInventory();
    return Object.freeze({
      booster: cleanInt(state.booster) + cleanInt(testInv.booster),
      rain: cleanInt(state.rain) + cleanInt(testInv.rain),
      timeWarp: cleanInt(state.timeWarp) + cleanInt(testInv.timeWarp),
      pendingVaults: totalPendingVaults(),
      testNvxPreview: Math.max(0, Number(testInv.nvx) || 0)
    });
  };
'''
if old_inventory in vault:
    vault = vault.replace(old_inventory, new_inventory, 1)
elif 'testNvxPreview' not in vault:
    raise SystemExit('Combined TEST Vault inventory patch point not found.')

# 3) Browser shell/extensions are useful, but they do not need to compete with
# Firebase Auth + the first mining snapshot. Load them during idle time instead
# of immediately during parser execution. User-triggered nxBrowse still calls
# loadBrowserNow() synchronously if the feature is opened first.
old_browser = '''  /* Browser must be ready before the user can interact with ALL APPS. */
  loadBrowserNow();
'''
new_browser = '''  /* Android startup priority: mining/auth first, optional Browser second. */
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => loadBrowserNow(), { timeout:2500 });
  } else {
    setTimeout(loadBrowserNow, 1800);
  }
'''
if old_browser in regional:
    regional = regional.replace(old_browser, new_browser, 1)
elif "requestIdleCallback(() => loadBrowserNow()" not in regional:
    raise SystemExit('Browser idle-load patch point not found.')

# Regional live news can begin after the home/mining state has settled. The
# feature remains automatic, merely lower priority on native startup.
regional = regional.replace(
    '    }, 800);\n',
    '    }, 3200);\n',
    1
)

# 4) Lower GPU/compositor cost on modest Android devices. Keep the modern solid
# gradients/borders but avoid real-time backdrop blurs. Different UI revisions
# used 10px, 12px and 20px blur values, so normalize every remaining blur in
# this Android-only mining presentation layer instead of matching one revision.
modern = re.sub(
    r'(?<!-webkit-)backdrop-filter\s*:\s*blur\([^;]+\)(?:\s+saturate\([^;]+\))?(!important)?;',
    lambda m: 'backdrop-filter:none' + ('!important' if m.group(1) else '') + ';',
    modern,
    flags=re.I,
)
modern = re.sub(
    r'-webkit-backdrop-filter\s*:\s*blur\([^;]+\)(?:\s+saturate\([^;]+\))?(!important)?;',
    lambda m: '-webkit-backdrop-filter:none' + ('!important' if m.group(1) else '') + ';',
    modern,
    flags=re.I,
)

# Durable markers.
page = page.replace('</body>', f'<!-- {MARKER} -->\n</body>', 1) if MARKER not in page else page
if MARKER not in vault:
    vault = f'/* {MARKER} */\n' + vault
if MARKER not in regional:
    regional = f'/* {MARKER} */\n' + regional
if MARKER not in modern:
    modern = f'/* {MARKER} */\n' + modern

PAGE.write_text(page, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')
REGIONAL.write_text(regional, encoding='utf-8')
MODERN.write_text(modern, encoding='utf-8')

checks = [
    (PAGE, MARKER),
    (VAULT, MARKER),
    (VAULT, 'testNvxPreview'),
    (VAULT, 'pendingVaults: totalPendingVaults()'),
    (REGIONAL, MARKER),
    (REGIONAL, "requestIdleCallback(() => loadBrowserNow()"),
    (REGIONAL, '}, 3200);'),
    (MODERN, MARKER),
    (MODERN, 'backdrop-filter:none'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Video consistency/performance verification failed: {path} -> {needle}')

if 'cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' in PAGE.read_text(encoding='utf-8'):
    raise SystemExit('Parser-blocking jsQR CDN tag still exists in packaged page2.')
if re.search(r'(?:-webkit-)?backdrop-filter\s*:\s*blur\(', MODERN.read_text(encoding='utf-8'), flags=re.I):
    raise SystemExit('Android mining modern layer still contains a live backdrop blur.')

print('Applied video consistency/performance v2: unified TEST Vault inventory, lazy QR/browser/news startup, and zero Android mining backdrop blur.')
