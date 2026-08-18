from pathlib import Path
import shutil

ROOT = Path('.')
ASSETS = ROOT / 'NexusNovaAndroid/app/src/main/assets/www'

for name in ['privacy-policy.html', 'account-deletion.html']:
    source = ROOT / name
    target = ASSETS / name
    if not source.exists():
        raise SystemExit(f'Android legal-page source missing: {source}')
    if not ASSETS.exists():
        raise SystemExit('Android web shell must be prepared before legal pages are copied')
    shutil.copy2(source, target)
    if not target.exists() or target.stat().st_size < 100:
        raise SystemExit(f'Android legal-page packaging failed: {target}')

print('Packaged Privacy Policy and Delete Account request pages into the Android web shell.')