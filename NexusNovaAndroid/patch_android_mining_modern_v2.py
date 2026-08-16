from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
PAGE = ROOT / 'page2.html'
SOURCE = Path('js/nexusnova-android-mining-modern-v2.js')
TARGET = ROOT / 'js/nexusnova-android-mining-modern-v2.js'
MARKER = 'nx-android-mining-modern-v2'
SCRIPT = '<script src="./js/nexusnova-android-mining-modern-v2.js?v=2" data-nx-android-mining-modern="2"></script>'

for path in (PAGE, SOURCE):
    if not path.exists():
        raise SystemExit(f'Missing Android mining modern input: {path}')

page = PAGE.read_text(encoding='utf-8')
source = SOURCE.read_text(encoding='utf-8')

if 'window.__nxAndroidMiningModernV2' not in source:
    raise SystemExit('Modern mining script lost its version guard.')
if 'nexusSecureMiningState' not in source:
    raise SystemExit('Modern mining script must read the secure mining owner.')
if 'miningStartedAt =' in source or 'updateDoc(' in source or 'runTransaction(' in source:
    raise SystemExit('Modern mining script must remain presentation-only.')

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(source, encoding='utf-8')

if SCRIPT not in page:
    if '</body>' not in page:
        raise SystemExit('page2 closing body missing for modern mining script.')
    page = page.replace('</body>', f'  <!-- {MARKER} -->\n  {SCRIPT}\n</body>', 1)
PAGE.write_text(page, encoding='utf-8')

checks = [
    (PAGE, MARKER),
    (PAGE, 'nexusnova-android-mining-modern-v2.js?v=2'),
    (TARGET, 'nxMiningSessionPulseV2'),
    (TARGET, 'TEST BOOST −${boostHours}H'),
    (TARGET, 'FIRESTORE VERIFIED'),
    (TARGET, 'max-height:82px!important'),
]
for path, needle in checks:
    if needle not in path.read_text(encoding='utf-8'):
        raise SystemExit(f'Android mining modern verification failed: {path} -> {needle}')

print('Packaged Android Mining Modern v2: compact dock + read-only session pulse/progress.')
