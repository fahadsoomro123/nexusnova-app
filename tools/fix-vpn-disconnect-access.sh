#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
from pathlib import Path
p = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnActivity.kt')
s = p.read_text(encoding='utf-8')
old1 = """        root.addView(buildStatsCard())
        root.addView(space(17))
"""
new1 = """        root.addView(buildStatsCard())
        root.addView(space(10))
        // Keep CONNECT/DISCONNECT controls above the potentially long server list so
        // an active tunnel can always be stopped without scrolling past every server.
        root.addView(buildActionPanel())
        root.addView(space(17))
"""
old2 = """        root.addView(serverList)

        root.addView(space(8))
        root.addView(buildActionPanel())
        root.addView(space(10))
        root.addView(buildPrivacyCard())
"""
new2 = """        root.addView(serverList)

        root.addView(space(10))
        root.addView(buildPrivacyCard())
"""
if old1 not in s:
    raise SystemExit('VPN action-panel insertion anchor missing')
if old2 not in s:
    raise SystemExit('VPN old action-panel anchor missing')
s = s.replace(old1, new1, 1).replace(old2, new2, 1)
if s.count('root.addView(buildActionPanel())') != 1:
    raise SystemExit('Expected exactly one VPN action panel')
p.write_text(s, encoding='utf-8')
PY
git diff --check
grep -n -A8 -B3 'Keep CONNECT/DISCONNECT controls above' NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnActivity.kt
