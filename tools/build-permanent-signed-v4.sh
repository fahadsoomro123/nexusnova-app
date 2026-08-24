#!/usr/bin/env bash
set -euo pipefail

export NEXUSNOVA_SIGNING_STORE_FILE="$RUNNER_TEMP/nexusnova-release.jks"
APK_NAME="NexusNova-PERMANENT-SIGNED-v${VERSION_NAME}-vc${VERSION_CODE}.apk"
LOG="$GITHUB_WORKSPACE/permanent-signed-release.log"
SIG="$GITHUB_WORKSPACE/permanent-signature.txt"

cleanup() {
  rm -f "$NEXUSNOVA_SIGNING_STORE_FILE"
}
trap cleanup EXIT

# Canonical source and native anchors.
test -s fresh-rebuild/index.html
test -s fresh-rebuild/src/main.js
test -s fresh-rebuild/src/features/apps/entertainment-resilient.js
test -s fresh-rebuild/src/features/apps/news-resilient.js
test -s NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NexusOtaWebManager.kt
test -s NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnActivity.kt

WEB=NexusNovaAndroid/app/src/main/assets/www
rm -rf "$WEB"
mkdir -p "$WEB"
cp -a fresh-rebuild/. "$WEB/"
printf 'source_commit=%s\nsource_tree=fresh-rebuild\n' "$GITHUB_SHA" > "$WEB/NEXUSNOVA_SOURCE.txt"

# Keep native VPN CONNECT/DISCONNECT controls above the variable-length server list.
python3 - <<'PY'
from pathlib import Path
p = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnActivity.kt')
s = p.read_text(encoding='utf-8')
marker = 'Keep CONNECT/DISCONNECT controls above the potentially long server list'
if marker not in s:
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
    if old1 not in s or old2 not in s:
        raise SystemExit('VPN disconnect accessibility anchors missing')
    s = s.replace(old1, new1, 1).replace(old2, new2, 1)
if s.count('root.addView(buildActionPanel())') != 1:
    raise SystemExit('Expected exactly one VPN action panel')
p.write_text(s, encoding='utf-8')
PY

grep -Fq 'Keep CONNECT/DISCONNECT controls above the potentially long server list' NexusNovaAndroid/app/src/main/java/com/nexusnova/app/NovaVpnActivity.kt

# Wire OTA into launcher, idempotently.
python3 - <<'PY'
from pathlib import Path
p = Path('NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt')
s = p.read_text(encoding='utf-8')
def ensure(old, new, label):
    global s
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'OTA anchor missing: {label}')
    s = s.replace(old, new, 1)
ensure(
    '    private var rendererCrashRecoveries = 0\n',
    '    private var rendererCrashRecoveries = 0\n    private val otaWebManager by lazy { NexusOtaWebManager(this) }\n    private var otaCheckStarted = false\n',
    'fields')
ensure(
    '                return assetLoader.shouldInterceptRequest(uri)\n                    ?: super.shouldInterceptRequest(view, request)\n',
    '                return otaWebManager.intercept(uri)\n                    ?: assetLoader.shouldInterceptRequest(uri)\n                    ?: super.shouldInterceptRequest(view, request)\n',
    'intercept')
old_finished = '''            override fun onPageFinished(view: WebView?, url: String?) {\n                super.onPageFinished(view, url)\n                val target = view ?: return\n                val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return\n                if (!isProductionOrigin(uri) || usingOfflineFallback) return\n                finishedWatchdogToken = mainFrameWatchdogToken\n                scheduleBlankScreenCheck(target, mainFrameWatchdogToken)\n            }\n'''
new_finished = '''            override fun onPageFinished(view: WebView?, url: String?) {\n                super.onPageFinished(view, url)\n                val target = view ?: return\n                val uri = url?.let { runCatching { Uri.parse(it) }.getOrNull() } ?: return\n                if (!isLocalOrigin(uri) || otaCheckStarted) return\n                otaCheckStarted = true\n                otaWebManager.checkForUpdate { updated ->\n                    if (!updated) return@checkForUpdate\n                    runOnUiThread {\n                        if (!isFinishing && !isDestroyed && target === webView) target.reload()\n                    }\n                }\n            }\n'''
ensure(old_finished, new_finished, 'page finished')
ensure(
    '                runCatching { target.destroy() }\n\n                if (isFinishing || isDestroyed) return true\n',
    '                runCatching { target.destroy() }\n\n                if (didCrash && otaWebManager.rollbackToBundled()) {\n                    window.decorView.postDelayed({\n                        if (!isFinishing && !isDestroyed) rebuildWebViewAfterRendererExit()\n                    }, RENDERER_CRASH_RECOVERY_DELAY_MS)\n                    return true\n                }\n\n                if (isFinishing || isDestroyed) return true\n',
    'rollback')
p.write_text(s, encoding='utf-8')
PY

grep -Fq 'otaWebManager.intercept(uri)' NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt
grep -Fq 'otaWebManager.checkForUpdate' NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt

# Restore and validate permanent signing key.
test -n "$NEXUSNOVA_SIGNING_KEYSTORE_B64"
test -n "$NEXUSNOVA_SIGNING_STORE_PASSWORD"
test -n "$NEXUSNOVA_SIGNING_KEY_ALIAS"
test -n "$NEXUSNOVA_SIGNING_KEY_PASSWORD"
printf '%s' "$NEXUSNOVA_SIGNING_KEYSTORE_B64" | base64 --decode > "$NEXUSNOVA_SIGNING_STORE_FILE"
test -s "$NEXUSNOVA_SIGNING_STORE_FILE"
chmod 600 "$NEXUSNOVA_SIGNING_STORE_FILE"
keytool -list -keystore "$NEXUSNOVA_SIGNING_STORE_FILE" -storepass "$NEXUSNOVA_SIGNING_STORE_PASSWORD" -alias "$NEXUSNOVA_SIGNING_KEY_ALIAS" >/dev/null

# Inject version and permanent signing into the release build.
python3 - <<'PY'
import os, re
from pathlib import Path
p = Path('NexusNovaAndroid/app/build.gradle.kts')
s = p.read_text(encoding='utf-8')
s, a = re.subn(r'versionCode\s*=\s*\d+', f'versionCode = {int(os.environ["VERSION_CODE"])}', s, count=1)
s, b = re.subn(r'versionName\s*=\s*"[^"]*"', f'versionName = "{os.environ["VERSION_NAME"]}"', s, count=1)
if a != 1 or b != 1:
    raise SystemExit('Android version anchors missing')
block = '''    signingConfigs {\n        create("nexusRelease") {\n            storeFile = file(System.getenv("NEXUSNOVA_SIGNING_STORE_FILE"))\n            storePassword = System.getenv("NEXUSNOVA_SIGNING_STORE_PASSWORD")\n            keyAlias = System.getenv("NEXUSNOVA_SIGNING_KEY_ALIAS")\n            keyPassword = System.getenv("NEXUSNOVA_SIGNING_KEY_PASSWORD")\n        }\n    }\n\n'''
if 'create("nexusRelease")' not in s:
    anchor = '    buildTypes {\n'
    if anchor not in s:
        raise SystemExit('buildTypes anchor missing')
    s = s.replace(anchor, block + anchor, 1)
line = '            signingConfig = signingConfigs.getByName("nexusRelease")\n'
if line not in s:
    anchor = '        release {\n'
    if anchor not in s:
        raise SystemExit('release buildType anchor missing')
    s = s.replace(anchor, anchor + line, 1)
p.write_text(s, encoding='utf-8')
PY

# Build and capture log.
(
  cd NexusNovaAndroid
  set -o pipefail
  gradle --no-daemon clean assembleRelease 2>&1 | tee "$LOG"
)

APK="$GITHUB_WORKSPACE/NexusNovaAndroid/app/build/outputs/apk/release/app-release.apk"
test -s "$APK"
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner | sort -V | tail -1)"
test -n "$APKSIGNER"
"$APKSIGNER" verify --verbose --print-certs "$APK" | tee "$SIG"
grep -Eq 'Verified using v(2|3) scheme.*true' "$SIG"

OUT="$RUNNER_TEMP/nexusnova-permanent-signed"
rm -rf "$OUT"
mkdir -p "$OUT"
cp "$APK" "$OUT/$APK_NAME"
(
  cd "$OUT"
  sha256sum "$APK_NAME" > SHA256.txt
)
cp "$SIG" "$OUT/signature.txt"
cp "$LOG" "$OUT/build.log"
cat > "$OUT/BUILD-STATUS.txt" <<EOF
NexusNova PERMANENT SIGNED RELEASE
Source commit: $GITHUB_SHA
Version name: $VERSION_NAME
Version code: $VERSION_CODE
Canonical web source: fresh-rebuild/
Latest web staged into APK: PASS
Entertainment resilient renderer bundled: PASS
News resilient renderer bundled: PASS
VPN disconnect controls above server list: PASS
OTA updater wired: PASS
Permanent signature verification: PASS
RESULT: PERMANENT-SIGNED APK READY
EOF

# Publish only verified output; clear stale failure output.
git config user.name 'NexusNova Signed Release Bot'
git config user.email 'actions@users.noreply.github.com'
git fetch origin apk-builds
PUB="$RUNNER_TEMP/nexusnova-apk-builds"
rm -rf "$PUB"
git worktree add "$PUB" origin/apk-builds
cd "$PUB"
rm -rf permanent-signed-release permanent-signed-release-failure
mkdir -p permanent-signed-release
cp -a "$OUT"/. permanent-signed-release/
git add -A permanent-signed-release permanent-signed-release-failure
git commit -m "Publish permanent signed NexusNova ${VERSION_NAME} (${VERSION_CODE}) $GITHUB_SHA"
git pull --rebase origin apk-builds
git push origin HEAD:apk-builds
