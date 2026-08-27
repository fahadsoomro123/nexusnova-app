import os
import re
from pathlib import Path

VERSION = os.environ.get("NOVA_RELEASE_VERSION", "1.1.0")
VERSION_CODE = os.environ.get("NOVA_RELEASE_CODE", "110")
BUILD_FILE = Path("NexusNovaAndroid/app/build.gradle.kts")
MARKER = Path("NexusNovaAndroid/app/src/main/assets/www/NOVA-SOL57-BUILD.txt")

required = [
    Path("js/nexusnova-ai-sol57-v1.js"),
    Path("js/nexusnova-ai-sol57-interface-v1.js"),
    Path("js/nexusnova-ai-sol57-history-v1.js"),
    Path("js/nexusnova-ai-sol57-features-v1.js"),
    Path("js/nexusnova-ai-sol57-video-v1.js"),
    Path("js/nexusnova-ai-sol57-live-voice-v1.js"),
    Path("js/nexusnova-ai-sol57-readiness-v1.js"),
    Path("js/nexusnova-ai-sol57-final-v1.js"),
]
for path in required:
    if not path.is_file() or path.stat().st_size == 0:
        raise SystemExit(f"Missing NOVA 5.7 Sol source: {path}")

android_final = Path("NexusNovaAndroid/app/src/main/assets/www/js/nexusnova-ai-sol57-final-v1.js")
if required[-1].read_bytes() != android_final.read_bytes():
    raise SystemExit("Web/Android NOVA final integration module mismatch")

s = BUILD_FILE.read_text(encoding="utf-8")
s, a = re.subn(r"versionCode\s*=\s*\d+", f"versionCode = {VERSION_CODE}", s, count=1)
s, b = re.subn(r'versionName\s*=\s*"[^"]*"', f'versionName = "{VERSION}"', s, count=1)
if a != 1 or b != 1:
    raise SystemExit("Android version anchors missing")

signing = '''    signingConfigs {
        create("nexusRelease") {
            storeFile = file(System.getenv("NEXUSNOVA_SIGNING_STORE_FILE"))
            storePassword = System.getenv("NEXUSNOVA_SIGNING_STORE_PASSWORD")
            keyAlias = System.getenv("NEXUSNOVA_SIGNING_KEY_ALIAS")
            keyPassword = System.getenv("NEXUSNOVA_SIGNING_KEY_PASSWORD")
        }
    }

'''
if 'create("nexusRelease")' not in s:
    if "    buildTypes {\n" not in s:
        raise SystemExit("Android buildTypes anchor missing")
    s = s.replace("    buildTypes {\n", signing + "    buildTypes {\n", 1)

signing_line = '            signingConfig = signingConfigs.getByName("nexusRelease")\n'
if signing_line not in s:
    if "        release {\n" not in s:
        raise SystemExit("Android release anchor missing")
    s = s.replace("        release {\n", "        release {\n" + signing_line, 1)

BUILD_FILE.write_text(s, encoding="utf-8")
MARKER.write_text(
    "NOVA 5.7 Sol\n"
    f"source_commit={os.environ.get('GITHUB_SHA', 'local')}\n"
    f"version={VERSION}\n",
    encoding="utf-8",
)
print(f"Prepared NexusNova Android {VERSION} (code {VERSION_CODE}) with NOVA 5.7 Sol and permanent signing config.")
