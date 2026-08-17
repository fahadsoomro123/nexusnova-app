from pathlib import Path

ROOT = Path('NexusNovaAndroid/app/src/main/assets/www')
FILES = [ROOT / 'index.html', ROOT / 'page2.html']
MARKER = 'nx-android-test-no-blocking-html-splash-v1'

for path in FILES:
    if not path.exists():
        raise SystemExit(f'Missing Android splash input: {path}')

    text = path.read_text(encoding='utf-8')

    if MARKER not in text:
        old = '<div id="nxSplash" aria-hidden="false">'
        new = (
            f'<!-- {MARKER} -->\n'
            '<div id="nxSplash" aria-hidden="true" '
            'style="display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important">'
        )
        if old not in text:
            raise SystemExit(f'Blocking splash element not found: {path}')
        text = text.replace(old, new, 1)

    # Verify this Android-only packaged shell can never paint a blocking HTML
    # splash, even if the JS event loop is starved or a remote request hangs.
    required = [
        MARKER,
        'id="nxSplash" aria-hidden="true"',
        'display:none!important',
        'pointer-events:none!important',
    ]
    for needle in required:
        if needle not in text:
            raise SystemExit(f'Android no-splash verification failed: {path} -> {needle}')

    path.write_text(text, encoding='utf-8')

print('Android TEST shell now has no blocking HTML splash on login or dashboard.')
