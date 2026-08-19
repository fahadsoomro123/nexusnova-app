from pathlib import Path

INDEX = Path('NexusNovaAndroid/app/src/main/assets/www/index.html')
DASHBOARD = Path('NexusNovaAndroid/app/src/main/assets/www/page2.html')


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    if not path.exists():
        raise SystemExit(f'{label}: staged HTML is missing: {path}')
    text = path.read_text(encoding='utf-8')
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one splash timing marker, found {count}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


# The native bootstrap used to dismiss the login/signup splash about 450 ms
# after DOMContentLoaded. Keep the hard 2.2 s safety release, but give the
# NexusNova identity enough time to register before the auth form appears.
replace_once(
    INDEX,
    'setTimeout(releaseSplash, 450);',
    'setTimeout(releaseSplash, 1900);',
    'Auth splash',
)

# patch_native_shell.py adds an independent dashboard hard-failsafe. Its old
# 450 ms DOM-ready release made the post-sign-in NexusNova transition feel like
# a flash. 1.4 s remains short and responsive while being visibly intentional.
replace_once(
    DASHBOARD,
    'setTimeout(nxForceReleaseSplash, 450);',
    'setTimeout(nxForceReleaseSplash, 1400);',
    'Dashboard splash',
)

index = INDEX.read_text(encoding='utf-8')
dashboard = DASHBOARD.read_text(encoding='utf-8')
if 'setTimeout(releaseSplash, 1900);' not in index:
    raise SystemExit('Auth splash readable timing was not applied')
if 'setTimeout(nxForceReleaseSplash, 1400);' not in dashboard:
    raise SystemExit('Dashboard splash readable timing was not applied')

print('Applied readable NexusNova splash timing: auth 1.9s, post-sign-in 1.4s, hard safety releases preserved.')
