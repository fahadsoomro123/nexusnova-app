from pathlib import Path

TARGETS = [
    Path('js/nexusnova-speedtest-app-v4.js'),
    Path('NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-speedtest-app-v4.js'),
]

OLD = """  function refreshNetworkLabel() {
    const label = $('nxSpeed4Network');
    if (!label) return;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const type = String(connection?.effectiveType || connection?.type || '').trim();
    label.textContent = type ? type.toUpperCase() : 'Network';
  }
"""

NEW = """  function refreshNetworkLabel() {
    const label = $('nxSpeed4Network');
    if (!label) return;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const type = String(connection?.effectiveType || connection?.type || '').trim();
    const nextLabel = type ? type.toUpperCase() : 'Network';
    // The Speed Test observer watches childList changes. Replacing textContent
    // with the same value creates a new text node and can self-trigger forever.
    // Only write when the visible label actually changed.
    if (label.textContent !== nextLabel) label.textContent = nextLabel;
  }
"""

patched = 0
for path in TARGETS:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    if NEW in text:
        patched += 1
        continue
    if OLD not in text:
        raise SystemExit(f'Speed Test network-label patch point not found: {path}')
    path.write_text(text.replace(OLD, NEW, 1), encoding='utf-8')
    patched += 1

if patched == 0:
    raise SystemExit('No Speed Test target existed for observer-loop guard')

for path in TARGETS:
    if not path.exists():
        continue
    text = path.read_text(encoding='utf-8')
    required = [
        "const nextLabel = type ? type.toUpperCase() : 'Network';",
        "if (label.textContent !== nextLabel) label.textContent = nextLabel;",
    ]
    missing = [token for token in required if token not in text]
    if missing:
        raise SystemExit(f'Speed Test observer guard verification failed for {path}: {missing}')

print('Applied Speed Test observer-loop guard: network label now updates only when changed.')
