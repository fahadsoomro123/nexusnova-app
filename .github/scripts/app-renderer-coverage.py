#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "fresh-rebuild/src/features/hub/app-registry.js"
APP_SCREEN = ROOT / "fresh-rebuild/src/features/apps/app-screen.js"
APPS_DIR = ROOT / "fresh-rebuild/src/features/apps"

registry_text = REGISTRY.read_text(encoding="utf-8")
app_screen_text = APP_SCREEN.read_text(encoding="utf-8")

registry_ids = re.findall(r"\bid:\s*['\"]([a-z0-9-]+)['\"]", registry_text)
if not registry_ids:
    raise SystemExit("No app ids found in app registry")

# Only renderer maps actually referenced by app-screen count as routed renderers.
renderer_names = set(re.findall(r"\b([A-Za-z0-9_]+Renderers)\[id\]", app_screen_text))
if not renderer_names:
    raise SystemExit("No renderer maps found in app-screen routing chain")

renderer_ids: set[str] = set()
renderer_sources: dict[str, str] = {}

export_re = re.compile(
    r"export\s+const\s+([A-Za-z0-9_]+Renderers)\s*=\s*(?:Object\.freeze\()?\s*\{(.*?)\}\s*\)?\s*;",
    re.S,
)
key_re = re.compile(r"(?:^|[,\n])\s*(?:['\"]([a-z0-9-]+)['\"]|([a-zA-Z_$][\w$-]*))\s*:")

for path in sorted(APPS_DIR.glob("*.js")):
    text = path.read_text(encoding="utf-8")
    for match in export_re.finditer(text):
        name, body = match.groups()
        if name not in renderer_names:
            continue
        for key_match in key_re.finditer(body):
            key = key_match.group(1) or key_match.group(2)
            if not key:
                continue
            renderer_ids.add(key)
            renderer_sources.setdefault(key, path.name)

missing = [app_id for app_id in registry_ids if app_id not in renderer_ids]
extra = sorted(renderer_ids.difference(registry_ids))

print("NexusNova app renderer coverage")
print(f"Registry apps: {len(registry_ids)}")
print(f"Routed renderer ids: {len(renderer_ids)}")
print(f"Missing renderer ids: {len(missing)}")
for app_id in missing:
    print(f"MISSING {app_id}")
print(f"Extra renderer ids: {len(extra)}")
for app_id in extra:
    print(f"EXTRA {app_id} ({renderer_sources.get(app_id, 'unknown')})")

if missing:
    sys.exit(1)
