from pathlib import Path
import hashlib

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
page_path = ROOT / 'page2.html'
launcher_path = ROOT / 'js/page2.js'
signin_path = ROOT / 'index.html'


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


before_signin = sha256(signin_path)
page = page_path.read_text(encoding='utf-8')
launcher = launcher_path.read_text(encoding='utf-8')

# Android dashboard only: no HTML splash may own pointer events or visibility.
if 'nx-android-dashboard-startup-lockfix-v1' not in page:
    old = '<div id="nxSplash" aria-hidden="false">'
    if old not in page:
        old = '<div id="nxSplash" aria-hidden="true">'
    if old not in page:
        raise SystemExit('Dashboard splash markup not found')
    new = '<!-- nx-android-dashboard-startup-lockfix-v1 -->\n<div id="nxSplash" aria-hidden="true" style="display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important">'
    page = page.replace(old, new, 1)

# Never flash fabricated default mining values while Firestore restores.
page = page.replace('<div class="balance-amount" id="balance">0.0000</div>', '<div class="balance-amount" id="balance">—</div>', 1)
page = page.replace('<div class="balance-usd" id="usdValue">$ 0.00 USD</div>', '<div class="balance-usd" id="usdValue">SYNCING SECURE BALANCE</div>', 1)
page = page.replace('<span id="btnText">START MINING</span>', '<span id="btnText">SYNCING MINING</span>', 1)
page = page.replace('        MINER OFFLINE\n', '        CHECKING SECURE SESSION\n', 1)

# page2.js can create a second full-screen readiness shield. Suppress only that
# overlay inside the packaged Android dashboard. Web/PWA behavior is untouched.
if 'nx-android-dashboard-no-secondary-shield-v1' not in launcher:
    anchor = '  function installShield() {\n'
    block = '''  function installShield() {\n    // nx-android-dashboard-no-secondary-shield-v1\n    const androidDashboard = window.__nexusAndroidShell === true || location.pathname.startsWith('/nexusnova-native/') || new URLSearchParams(location.search).get('nxAndroid') === '1';\n    if (androidDashboard) {\n      const oldSplash = document.getElementById('nxSplash');\n      if (oldSplash) {\n        oldSplash.style.setProperty('display','none','important');\n        oldSplash.style.setProperty('visibility','hidden','important');\n        oldSplash.style.setProperty('opacity','0','important');\n        oldSplash.style.setProperty('pointer-events','none','important');\n      }\n      return;\n    }\n'''
    if anchor not in launcher:
        raise SystemExit('Secondary startup shield anchor missing')
    launcher = launcher.replace(anchor, block, 1)

page_path.write_text(page, encoding='utf-8')
launcher_path.write_text(launcher, encoding='utf-8')

if sha256(signin_path) != before_signin:
    raise SystemExit('Sign-in document changed during dashboard startup patch')

checks = {
    page_path: [
        'nx-android-dashboard-startup-lockfix-v1',
        'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important',
        'id="balance">—</div>',
        'SYNCING SECURE BALANCE',
        'SYNCING MINING',
        'CHECKING SECURE SESSION',
    ],
    launcher_path: ['nx-android-dashboard-no-secondary-shield-v1'],
}
for path, markers in checks.items():
    text = path.read_text(encoding='utf-8')
    missing = [marker for marker in markers if marker not in text]
    if missing:
        raise SystemExit(f'{path}: startup lockfix verification failed: {missing}')

print('Applied Android dashboard startup lockfix v1; sign-in asset remained byte-for-byte unchanged.')
