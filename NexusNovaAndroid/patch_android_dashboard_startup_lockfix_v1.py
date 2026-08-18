from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
PAGE = ROOT / 'page2.html'
LAUNCHER = ROOT / 'js/page2.js'
MARKER = 'nx-android-dashboard-startup-lockfix-v1'

for path in (PAGE, LAUNCHER):
    if not path.exists():
        raise SystemExit(f'Missing startup lockfix input: {path}')

page = PAGE.read_text(encoding='utf-8')
launcher = LAUNCHER.read_text(encoding='utf-8')

# Android dashboard only. Do NOT touch index.html / sign-in UI.
# The post-login HTML splash is hidden in markup before any JavaScript, network,
# Firebase, timer, load event, or WebView callback can fail. Web/PWA source is
# untouched because this patch runs only against the packaged Android assets.
if MARKER not in page:
    old = '<div id="nxSplash" aria-hidden="false">'
    new = (
        f'<!-- {MARKER} -->\n'
        '<div id="nxSplash" aria-hidden="true" '
        'style="display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important">'
    )
    if old not in page:
        # Accept an already accessibility-hidden splash only if it is not yet
        # deterministically hidden from first paint.
        old = '<div id="nxSplash" aria-hidden="true">'
    if old not in page:
        raise SystemExit('Dashboard nxSplash element not found in expected shape')
    page = page.replace(old, new, 1)

# Keep the authoritative mining placeholders safe while Firebase restores. The
# user never sees a fabricated 0 balance or an old offline mining state.
page = page.replace(
    '<div class="balance-amount" id="balance">0.0000</div>',
    '<div class="balance-amount" id="balance">—</div>',
    1,
)
page = page.replace(
    '<div class="balance-usd" id="usdValue">$ 0.00 USD</div>',
    '<div class="balance-usd" id="usdValue">SYNCING SECURE BALANCE</div>',
    1,
)
page = page.replace(
    '<span id="btnText">START MINING</span>',
    '<span id="btnText">SYNCING MINING</span>',
    1,
)
page = page.replace('        MINER OFFLINE\n', '        CHECKING SECURE SESSION\n', 1)

# The current page2 launcher can create a second full-screen shield after the
# HTML splash. In the Android packaged dashboard, suppress only that overlay.
# The rest of page2.js (Firebase/Auth, mining, ads, navigation) remains intact.
if 'nx-android-dashboard-no-secondary-shield-v1' not in launcher:
    anchor = '''  function installShield() {\n'''
    block = '''  function installShield() {\n    // nx-android-dashboard-no-secondary-shield-v1\n    // Android already owns launch presentation. Never place another full-screen\n    // readiness gate over the post-login dashboard.\n    const androidDashboard =\n      window.__nexusAndroidShell === true ||\n      location.pathname.startsWith('/nexusnova-native/') ||\n      new URLSearchParams(location.search).get('nxAndroid') === '1';\n    if (androidDashboard) {\n      const oldSplash = document.getElementById('nxSplash');\n      if (oldSplash) {\n        oldSplash.style.setProperty('display','none','important');\n        oldSplash.style.setProperty('visibility','hidden','important');\n        oldSplash.style.setProperty('opacity','0','important');\n        oldSplash.style.setProperty('pointer-events','none','important');\n      }\n      return;\n    }\n'''
    if anchor not in launcher:
        raise SystemExit('page2 startup shield install anchor not found')
    launcher = launcher.replace(anchor, block, 1)

PAGE.write_text(page, encoding='utf-8')
LAUNCHER.write_text(launcher, encoding='utf-8')

# Exact safety contract for the final prepared Android shell.
page_final = PAGE.read_text(encoding='utf-8')
launcher_final = LAUNCHER.read_text(encoding='utf-8')
required_page = [
    MARKER,
    'id="nxSplash" aria-hidden="true" style="display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important"',
    'id="balance">—</div>',
    'SYNCING SECURE BALANCE',
    'SYNCING MINING',
    'CHECKING SECURE SESSION',
]
required_launcher = [
    'nx-android-dashboard-no-secondary-shield-v1',
    "location.pathname.startsWith('/nexusnova-native/')",
    "oldSplash.style.setProperty('display','none','important')",
]
missing = [x for x in required_page if x not in page_final]
missing += [x for x in required_launcher if x not in launcher_final]
if missing:
    raise SystemExit('Android dashboard startup lockfix verification failed: ' + ', '.join(missing))

print('Android dashboard startup lockfix applied: sign-in untouched, no post-login blocking HTML splash, no Android secondary startup shield, secure mining placeholders preserved.')
