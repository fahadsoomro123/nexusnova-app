# nx-clean-startup-contract-v5: one branded dashboard splash, bounded and non-blocking.
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

# Android dashboard only: preserve the existing beautiful HTML splash, but make
# it incapable of trapping touches. prepare_native_web_shell.py + native splash
# release v4 remain independent hard-release owners, so network/Auth can never
# keep this overlay stuck on screen.
if 'nx-android-dashboard-startup-lockfix-v2' not in page:
    candidates = [
        '<div id="nxSplash" aria-hidden="false">',
        '<div id="nxSplash" aria-hidden="true">',
    ]
    old = next((value for value in candidates if value in page), None)
    if old is None:
        raise SystemExit('Dashboard splash markup not found')
    new = '<!-- nx-android-dashboard-startup-lockfix-v2 -->\n<div id="nxSplash" aria-hidden="false" style="pointer-events:none!important">'
    page = page.replace(old, new, 1)

# Never flash fabricated default mining values while Firestore restores.
page = page.replace('<div class="balance-amount" id="balance">0.0000</div>', '<div class="balance-amount" id="balance">—</div>', 1)
page = page.replace('<div class="balance-usd" id="usdValue">$ 0.00 USD</div>', '<div class="balance-usd" id="usdValue">SYNCING SECURE BALANCE</div>', 1)
page = page.replace('<span id="btnText">START MINING</span>', '<span id="btnText">SYNCING MINING</span>', 1)
page = page.replace('        MINER OFFLINE\n', '        CHECKING SECURE SESSION\n', 1)

# Source v4 has one startup owner. Do not reintroduce a second JavaScript
# full-screen shield; verify the clean launcher contract instead.
if 'nx-single-startup-owner-v4' not in launcher:
    raise SystemExit('Single startup owner v4 marker missing from dashboard launcher')
if 'nxSecureStartupShieldV3' in launcher:
    raise SystemExit('Deprecated secondary startup shield is still present')

page_path.write_text(page, encoding='utf-8')

if sha256(signin_path) != before_signin:
    raise SystemExit('Sign-in document changed during dashboard startup patch')

checks = {
    page_path: [
        'nx-android-dashboard-startup-lockfix-v2',
        'style="pointer-events:none!important"',
        'id="balance">—</div>',
        'SYNCING SECURE BALANCE',
        'SYNCING MINING',
        'CHECKING SECURE SESSION',
    ],
    launcher_path: ['nx-single-startup-owner-v4'],
}
for path, markers in checks.items():
    text = path.read_text(encoding='utf-8')
    missing = [marker for marker in markers if marker not in text]
    if missing:
        raise SystemExit(f'{path}: startup lockfix verification failed: {missing}')
    if path == page_path and 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important' in text:
        raise SystemExit('Dashboard splash was hidden instead of preserved')

print('Applied Android dashboard bounded branded splash; touch-safe and independently hard-released. Sign-in asset remained unchanged by this patch.')
