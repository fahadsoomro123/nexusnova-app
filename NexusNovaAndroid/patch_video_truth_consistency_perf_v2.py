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

import re

# 1) QR decoding already has a robust on-demand loader in final-user-fixes.
page, removed = re.subn(
    r'\s*<script[^>]+src=["\']https://cdn\.jsdelivr\.net/npm/jsqr@1\.4\.0/dist/jsQR\.js["\'][^>]*></script>\s*',
    '\n', page, count=1, flags=re.I,
)
if removed == 0 and 'cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' in page:
    raise SystemExit('Could not remove parser-blocking jsQR startup tag.')

# 2) Expose TEST Vault inventory through the same API used by Mining Accelerator.
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

# 3) Defer optional Browser/news startup work until mining/auth has priority.
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
regional = regional.replace('    }, 800);\n', '    }, 3200);\n', 1)

# 4) Deterministically remove every blur spelling used by Mining Modern v2/v3/v4.
# Exact replacements first, then a broad property-level fallback.
for old, new in (
    ('backdrop-filter:blur(10px);', 'backdrop-filter:none;'),
    ('-webkit-backdrop-filter:blur(10px);', '-webkit-backdrop-filter:none;'),
    ('backdrop-filter:blur(12px);', 'backdrop-filter:none;'),
    ('-webkit-backdrop-filter:blur(12px);', '-webkit-backdrop-filter:none;'),
    ('backdrop-filter:blur(20px) saturate(125%)!important;', 'backdrop-filter:none!important;'),
    ('-webkit-backdrop-filter:blur(20px) saturate(125%)!important;', '-webkit-backdrop-filter:none!important;'),
):
    modern = modern.replace(old, new)
modern = re.sub(r'(?<!-webkit-)backdrop-filter\s*:\s*blur\([^;]*\)[^;]*;', 'backdrop-filter:none;', modern, flags=re.I)
modern = re.sub(r'-webkit-backdrop-filter\s*:\s*blur\([^;]*\)[^;]*;', '-webkit-backdrop-filter:none;', modern, flags=re.I)

# Durable markers.
page = page.replace('</body>', f'<!-- {MARKER} -->\n</body>', 1) if MARKER not in page else page
if MARKER not in vault: vault = f'/* {MARKER} */\n' + vault
if MARKER not in regional: regional = f'/* {MARKER} */\n' + regional
if MARKER not in modern: modern = f'/* {MARKER} */\n' + modern

PAGE.write_text(page, encoding='utf-8')
VAULT.write_text(vault, encoding='utf-8')
REGIONAL.write_text(regional, encoding='utf-8')
MODERN.write_text(modern, encoding='utf-8')

checks = [
    (PAGE, MARKER),
    (VAULT, 'testNvxPreview'),
    (VAULT, 'pendingVaults: totalPendingVaults()'),
    (REGIONAL, "requestIdleCallback(() => loadBrowserNow()"),
    (REGIONAL, '}, 3200);'),
    (MODERN, 'backdrop-filter:none'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Video consistency/performance verification failed: {path} -> {needle}')

final_page = PAGE.read_text(encoding='utf-8')
final_modern = MODERN.read_text(encoding='utf-8')
if 'cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js' in final_page:
    raise SystemExit('Parser-blocking jsQR CDN tag still exists in packaged page2.')
if 'backdrop-filter:blur(' in final_modern or '-webkit-backdrop-filter:blur(' in final_modern:
    raise SystemExit('Android mining modern layer still contains a live backdrop blur.')

print('Applied video consistency/performance v2: unified TEST Vault inventory, lazy QR/browser/news startup, and deterministic zero mining backdrop blur.')
