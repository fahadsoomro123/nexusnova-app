#!/usr/bin/env bash
set -euo pipefail
PATCHED="$RUNNER_TEMP/build-permanent-signed-v4-safe.sh"
cp tools/build-permanent-signed-v4.sh "$PATCHED"
python3 - "$PATCHED" <<'PY'
from pathlib import Path
import sys
p = Path(sys.argv[1])
s = p.read_text(encoding='utf-8')
old = 'git add -A permanent-signed-release permanent-signed-release-failure\n'
new = 'git add -A\n'
if old not in s:
    raise SystemExit('Permanent signed publish pathspec anchor missing')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
PY
exec bash "$PATCHED"
